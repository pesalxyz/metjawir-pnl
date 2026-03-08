import { parseSignature } from "@/lib/solana/parseSignature";
import { reconstructPositionHistory } from "@/lib/meteora/reconstructPositionHistory";
import { calculateRealizedPnl } from "@/lib/pnl/calculateRealizedPnl";
import { formatCardData } from "@/lib/pnl/formatCardData";
import { CardAspectRatio, CardData, CardTheme, ReconstructedPosition, PnlSummary } from "@/types/domain";

export async function buildCardFromInput(input: {
  rawInput: string;
  theme?: CardTheme;
  ratio?: CardAspectRatio;
  watermark?: boolean;
  customBackgroundUrl?: string;
}): Promise<{
  signature: string;
  card: CardData;
  position: ReconstructedPosition;
  summary: PnlSummary;
  normalizedSource: string;
}> {
  const normalized = parseSignature(input.rawInput);
  const position = await reconstructPositionHistory(normalized.signature);
  const summary = await calculateRealizedPnl(position);

  const card = formatCardData({
    signature: normalized.signature,
    position,
    summary,
    theme: input.theme,
    ratio: input.ratio,
    watermark: input.watermark,
    customBackgroundUrl: input.customBackgroundUrl
  });

  return {
    signature: normalized.signature,
    card,
    position,
    summary,
    normalizedSource: normalized.source
  };
}
