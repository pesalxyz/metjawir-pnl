import { GeneratedCard, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CardData } from "@/types/domain";
import { shortAddress } from "@/lib/utils/format";

export async function getGeneratedCard(signature: string) {
  return prisma.generatedCard.findUnique({ where: { signature } });
}

export async function upsertGeneratedCard(card: CardData, rawSummary: unknown) {
  const jsonSummary = rawSummary as Prisma.InputJsonValue;

  return prisma.generatedCard.upsert({
    where: { signature: card.signature },
    update: {
      owner: card.owner,
      pairLabel: card.pairLabel,
      protocol: card.protocol,
      closeTimestamp: new Date(card.closedAtIso),
      depositUsd: card.depositUsd,
      withdrawnUsd: card.withdrawnUsd,
      feesUsd: card.feesUsd,
      pnlUsd: card.pnlUsd,
      pnlPct: card.pnlPct,
      closePrice: card.closePrice,
      poolAddress: card.poolAddress,
      positionAccount: card.positionAccount,
      confidence: card.confidence,
      warnings: card.warnings,
      theme: card.theme,
      ratio: card.ratio,
      watermark: card.watermark,
      customBackgroundUrl: card.customBackgroundUrl,
      tokenLogoA: card.tokenLogoA,
      tokenLogoB: card.tokenLogoB,
      rawSummary: jsonSummary
    },
    create: {
      signature: card.signature,
      owner: card.owner,
      pairLabel: card.pairLabel,
      protocol: card.protocol,
      closeTimestamp: new Date(card.closedAtIso),
      depositUsd: card.depositUsd,
      withdrawnUsd: card.withdrawnUsd,
      feesUsd: card.feesUsd,
      pnlUsd: card.pnlUsd,
      pnlPct: card.pnlPct,
      closePrice: card.closePrice,
      poolAddress: card.poolAddress,
      positionAccount: card.positionAccount,
      confidence: card.confidence,
      warnings: card.warnings,
      theme: card.theme,
      ratio: card.ratio,
      watermark: card.watermark,
      customBackgroundUrl: card.customBackgroundUrl,
      tokenLogoA: card.tokenLogoA,
      tokenLogoB: card.tokenLogoB,
      rawSummary: jsonSummary
    }
  });
}

export function mapGeneratedCardToCardData(card: GeneratedCard): CardData {
  const events = (card.rawSummary as { position?: { events?: Array<{ timestamp?: number }> } } | null)?.position?.events;
  let durationLabel: string | undefined;
  if (Array.isArray(events) && events.length > 0) {
    const timestamps = events.map((event) => Number(event.timestamp ?? 0)).filter((value) => Number.isFinite(value) && value > 0);
    if (timestamps.length > 0) {
      const first = Math.min(...timestamps);
      const closeTs = Math.floor(card.closeTimestamp.getTime() / 1000);
      const diff = Math.max(0, closeTs - first);
      const hh = String(Math.floor(diff / 3600)).padStart(2, "0");
      const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const ss = String(diff % 60).padStart(2, "0");
      durationLabel = `${hh}:${mm}:${ss}`;
    }
  }

  return {
    signature: card.signature,
    pairLabel: card.pairLabel,
    protocol: "Meteora DLMM",
    owner: card.owner,
    ownerShort: shortAddress(card.owner),
    closedAtIso: card.closeTimestamp.toISOString(),
    durationLabel,
    depositUsd: card.depositUsd,
    withdrawnUsd: card.withdrawnUsd,
    feesUsd: card.feesUsd,
    pnlUsd: card.pnlUsd,
    pnlPct: card.pnlPct,
    closePrice: card.closePrice ?? undefined,
    poolAddress: card.poolAddress ?? undefined,
    positionAccount: card.positionAccount ?? undefined,
    confidence: card.confidence as CardData["confidence"],
    warnings: Array.isArray(card.warnings) ? (card.warnings as string[]) : [],
    theme: card.theme as CardData["theme"],
    customBackgroundUrl: card.customBackgroundUrl ?? "/bg-v1.png",
    ratio: card.ratio as CardData["ratio"],
    watermark: card.watermark,
    tokenLogoA: card.tokenLogoA ?? undefined,
    tokenLogoB: card.tokenLogoB ?? undefined
  };
}
