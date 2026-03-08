import { z } from "zod";
import { NormalizedTxInput } from "@/types/domain";

const signatureRegex = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

const explorerPatterns: Array<{
  source: NormalizedTxInput["source"];
  regex: RegExp;
}> = [
  {
    source: "solscan",
    regex: /^https?:\/\/(?:www\.)?solscan\.io\/tx\/([1-9A-HJ-NP-Za-km-z]{64,88})/i
  },
  {
    source: "solanafm",
    regex: /^https?:\/\/(?:www\.)?solanafm\.com\/tx\/([1-9A-HJ-NP-Za-km-z]{64,88})/i
  },
  {
    source: "solana-explorer",
    regex: /^https?:\/\/(?:explorer\.)?solana\.com\/tx\/([1-9A-HJ-NP-Za-km-z]{64,88})/i
  },
  {
    source: "solbeach",
    regex: /^https?:\/\/(?:www\.)?solbeach\.io\/transaction\/([1-9A-HJ-NP-Za-km-z]{64,88})/i
  },
  {
    source: "oklink",
    regex: /^https?:\/\/(?:www\.)?oklink\.com\/sol\/tx\/([1-9A-HJ-NP-Za-km-z]{64,88})/i
  }
];

const inputSchema = z.object({
  input: z.string().trim().min(1, "Input is required")
});

export function parseSignature(input: string): NormalizedTxInput {
  const parsed = inputSchema.safeParse({ input });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const rawInput = parsed.data.input;
  if (signatureRegex.test(rawInput)) {
    return {
      rawInput,
      signature: rawInput,
      source: "raw"
    };
  }

  for (const pattern of explorerPatterns) {
    const match = rawInput.match(pattern.regex);
    if (match?.[1] && signatureRegex.test(match[1])) {
      return {
        rawInput,
        signature: match[1],
        source: pattern.source
      };
    }
  }

  throw new Error("Unsupported input. Use a Solana signature or a supported explorer URL.");
}
