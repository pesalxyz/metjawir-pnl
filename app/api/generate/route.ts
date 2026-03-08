import { NextRequest, NextResponse } from "next/server";
import { generateSchema } from "@/lib/validation";
import { generateCardFromInput } from "@/lib/pnl/generateCard";
import { checkRateLimit } from "@/lib/cache/rateLimit";
import { log } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rate = checkRateLimit(ip);

  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please retry shortly.",
          details: { retryAfterSec: rate.retryAfterSec }
        }
      },
      { status: 429 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = generateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid request"
        }
      },
      { status: 400 }
    );
  }

  const started = Date.now();
  const result = await generateCardFromInput({
    rawInput: parsed.data.input,
    theme: parsed.data.theme,
    ratio: parsed.data.ratio,
    watermark: parsed.data.watermark,
    customBackgroundUrl: parsed.data.customBackgroundUrl
  });

  log(result.ok ? "INFO" : "WARN", "Card generate request completed", {
    ok: result.ok,
    signature: result.signature,
    elapsedMs: Date.now() - started,
    confidence: result.confidence,
    errorCode: result.error?.code
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : 422
  });
}
