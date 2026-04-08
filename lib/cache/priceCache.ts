import { prisma } from "@/lib/db/prisma";

export async function getNearestPriceCache(mint: string, timestamp: Date, windowSec = 3600) {
  const from = new Date(timestamp.getTime() - windowSec * 1000);
  const to = new Date(timestamp.getTime() + windowSec * 1000);

  try {
    const rows = await prisma.priceCache.findMany({
      where: {
        mint,
        timestamp: {
          gte: from,
          lte: to
        }
      }
    });

    if (!rows.length) return null;

    rows.sort(
      (a, b) =>
        Math.abs(a.timestamp.getTime() - timestamp.getTime()) -
        Math.abs(b.timestamp.getTime() - timestamp.getTime())
    );

    return rows[0];
  } catch {
    return null;
  }
}

export async function setPriceCache(input: {
  mint: string;
  timestamp: Date;
  priceUsd: number;
  source: string;
  estimated: boolean;
}) {
  try {
    return await prisma.priceCache.upsert({
      where: {
        mint_timestamp: {
          mint: input.mint,
          timestamp: input.timestamp
        }
      },
      update: {
        priceUsd: input.priceUsd,
        source: input.source,
        estimated: input.estimated
      },
      create: {
        mint: input.mint,
        timestamp: input.timestamp,
        priceUsd: input.priceUsd,
        source: input.source,
        estimated: input.estimated
      }
    });
  } catch {
    return null;
  }
}
