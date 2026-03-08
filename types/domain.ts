export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type CardTheme = "aurora" | "midnight" | "emerald";

export type CardAspectRatio = "1:1" | "16:9";

export type NormalizedTxInput = {
  rawInput: string;
  signature: string;
  source: "raw" | "solscan" | "solanafm" | "solana-explorer" | "solbeach" | "oklink";
};

export type MeteoraActionType =
  | "OPEN_POSITION"
  | "ADD_LIQUIDITY"
  | "REMOVE_LIQUIDITY"
  | "CLAIM_FEES"
  | "CLOSE_POSITION";

export type TokenAmount = {
  mint: string;
  amountRaw: string;
  amountUi: number;
  decimals: number;
  symbol?: string;
};

export type ParsedPositionEvent = {
  signature: string;
  timestamp: number;
  slot?: number;
  action: MeteoraActionType;
  owner: string;
  positionAccount?: string;
  poolAddress?: string;
  tokenA?: TokenAmount;
  tokenB?: TokenAmount;
  fees?: TokenAmount[];
  valuedUsd?: {
    deposit?: number;
    withdrawn?: number;
    fees?: number;
  };
  notes?: string[];
  confidence: Confidence;
};

export type PricingResult = {
  mint: string;
  timestamp: number;
  priceUsd: number;
  source: "birdeye" | "jupiter" | "defillama" | "cache" | "estimate";
  estimated: boolean;
};

export type ReconstructedPosition = {
  signature: string;
  owner: string;
  positionAccount?: string;
  poolAddress?: string;
  tokenMintA?: string;
  tokenMintB?: string;
  symbolA?: string;
  symbolB?: string;
  closeTimestamp: number;
  events: ParsedPositionEvent[];
  warnings: string[];
  confidence: Confidence;
};

export type PnlSummary = {
  totalDepositUsd: number;
  totalWithdrawnUsd: number;
  totalFeesUsd: number;
  netRealizedPnlUsd: number;
  realizedPnlPct: number;
  estimatedPricing: boolean;
  closePrice?: number;
};

export type CardThemeConfig = {
  id: CardTheme;
  label: string;
  background: string;
  accent: string;
};

export type CardData = {
  signature: string;
  pairLabel: string;
  protocol: "Meteora DLMM";
  owner: string;
  ownerShort: string;
  closedAtIso: string;
  durationLabel?: string;
  depositUsd: number;
  withdrawnUsd: number;
  feesUsd: number;
  pnlUsd: number;
  pnlPct: number;
  closePrice?: number;
  poolAddress?: string;
  positionAccount?: string;
  confidence: Confidence;
  warnings: string[];
  theme: CardTheme;
  customBackgroundUrl?: string;
  ratio: CardAspectRatio;
  watermark: boolean;
  tokenLogoA?: string;
  tokenLogoB?: string;
};

export type GenerateRequest = {
  input: string;
  theme?: CardTheme;
  ratio?: CardAspectRatio;
  watermark?: boolean;
  customBackgroundUrl?: string;
};

export type GenerateResponse = {
  ok: boolean;
  signature?: string;
  permalink?: string;
  confidence?: Confidence;
  warning?: string;
  steps?: string[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};
