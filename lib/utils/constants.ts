import { CardThemeConfig } from "@/types/domain";

export const METEORA_PROGRAM_HINTS = [
  "Meteora",
  "DLMM",
  "LBUZ",
  "meteora"
];

export const THEME_CONFIGS: CardThemeConfig[] = [
  {
    id: "aurora",
    label: "Aurora",
    background: "linear-gradient(135deg, #140f2e 0%, #08243f 45%, #123f2f 100%)",
    accent: "#7ef7c7"
  },
  {
    id: "midnight",
    label: "Midnight",
    background: "linear-gradient(135deg, #0d111f 0%, #0f172a 50%, #111827 100%)",
    accent: "#7dd3fc"
  },
  {
    id: "emerald",
    label: "Emerald",
    background: "linear-gradient(135deg, #052e2b 0%, #064e3b 45%, #0f766e 100%)",
    accent: "#34d399"
  }
];

export const DEFAULT_SOLANA_RPC = "https://api.mainnet-beta.solana.com";
