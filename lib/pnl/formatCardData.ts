import { CardData, CardTheme, CardAspectRatio, PnlSummary, ReconstructedPosition } from "@/types/domain";
import { shortAddress } from "@/lib/utils/format";

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hh = String(Math.floor(safe / 3600)).padStart(2, "0");
  const mm = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatCardData(input: {
  signature: string;
  position: ReconstructedPosition;
  summary: PnlSummary;
  theme?: CardTheme;
  ratio?: CardAspectRatio;
  watermark?: boolean;
  customBackgroundUrl?: string;
}): CardData {
  const { signature, position, summary } = input;
  const pairLabel = `${position.symbolA ?? "Token A"}/${position.symbolB ?? "Token B"}`;
  const firstTs = position.events.length ? Math.min(...position.events.map((event) => event.timestamp)) : position.closeTimestamp;
  const durationLabel = formatDuration(position.closeTimestamp - firstTs);

  const warnings = [...position.warnings];
  if (summary.estimatedPricing) {
    warnings.push("Estimated price data used for one or more events.");
  }

  return {
    signature,
    pairLabel,
    protocol: "Meteora DLMM",
    owner: position.owner,
    ownerShort: shortAddress(position.owner),
    closedAtIso: new Date(position.closeTimestamp * 1000).toISOString(),
    durationLabel,
    depositUsd: summary.totalDepositUsd,
    withdrawnUsd: summary.totalWithdrawnUsd,
    feesUsd: summary.totalFeesUsd,
    pnlUsd: summary.netRealizedPnlUsd,
    pnlPct: summary.realizedPnlPct,
    closePrice: summary.closePrice,
    poolAddress: position.poolAddress,
    positionAccount: position.positionAccount,
    confidence: position.confidence,
    warnings,
    theme: input.theme ?? "aurora",
    customBackgroundUrl: input.customBackgroundUrl ?? "/bg-v1.png",
    ratio: input.ratio ?? "1:1",
    watermark: input.watermark ?? true
  };
}
