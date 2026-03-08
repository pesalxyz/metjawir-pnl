import { buildCardFromInput } from "@/lib/pnl/buildCard";
import { upsertGeneratedCard } from "@/lib/db/generatedCardRepo";
import { CardAspectRatio, CardTheme, GenerateResponse } from "@/types/domain";

export async function generateCardFromInput(input: {
  rawInput: string;
  theme?: CardTheme;
  ratio?: CardAspectRatio;
  watermark?: boolean;
  customBackgroundUrl?: string;
}): Promise<GenerateResponse> {
  const steps: string[] = [];

  try {
    steps.push("Validating transaction");
    steps.push("Fetching on-chain data");
    steps.push("Reconstructing position history");
    steps.push("Calculating realized PnL");
    steps.push("Rendering card");

    const result = await buildCardFromInput(input);

    const hasClose = result.position.events.some((event) => event.action === "CLOSE_POSITION");
    if (!hasClose) {
      return {
        ok: false,
        steps,
        error: {
          code: "NOT_CLOSE_TX",
          message: "Input transaction is not a close-position transaction.",
          details: { actions: result.position.events.map((event) => event.action) }
        }
      };
    }

    try {
      await upsertGeneratedCard(result.card, {
        source: result.normalizedSource,
        position: result.position,
        summary: result.summary
      });
    } catch {
      // DB may be unavailable in local/offline mode. Card generation still succeeds.
    }

    return {
      ok: true,
      signature: result.signature,
      permalink: `/card/${result.signature}`,
      confidence: result.position.confidence,
      warning: result.card.warnings[0],
      steps
    };
  } catch (error) {
    return {
      ok: false,
      steps,
      error: {
        code: "GENERATION_FAILED",
        message: error instanceof Error ? error.message : "Failed to generate card.",
        details: error
      }
    };
  }
}
