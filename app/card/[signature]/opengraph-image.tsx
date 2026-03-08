import { ImageResponse } from "next/og";
import { getGeneratedCard, mapGeneratedCardToCardData } from "@/lib/db/generatedCardRepo";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ signature: string }> }) {
  const { signature } = await params;

  let pairLabel = "Meteora DLMM";
  let pnl = "PnL unavailable";
  let pct = "";

  try {
    const found = await getGeneratedCard(signature);
    if (found) {
      const card = mapGeneratedCardToCardData(found);
      pairLabel = card.pairLabel;
      pnl = `${card.pnlUsd >= 0 ? "+" : ""}${card.pnlUsd.toFixed(2)} USD`;
      pct = `${card.pnlPct >= 0 ? "+" : ""}${card.pnlPct.toFixed(2)}%`;
    }
  } catch {
    // Gracefully render fallback OG image.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #0d111f 0%, #111827 45%, #064e3b 100%)",
          color: "white",
          padding: 56,
          fontFamily: "system-ui"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 24,
            padding: 40,
            background: "rgba(0,0,0,0.25)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 42, fontWeight: 700 }}>{pairLabel}</div>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 24
              }}
            >
              Meteora DLMM
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 28, opacity: 0.8 }}>Realized PnL</div>
            <div style={{ fontSize: 86, fontWeight: 800, color: pnl.startsWith("-") ? "#fda4af" : "#6ee7b7" }}>
              {pnl}
            </div>
            <div style={{ fontSize: 42, color: pct.startsWith("-") ? "#fecdd3" : "#a7f3d0" }}>{pct}</div>
          </div>

          <div style={{ fontSize: 24, opacity: 0.7 }}>meteora-pnl-card-generator</div>
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
