import { prisma } from "@/lib/db/prisma";

export async function getAssetMetadataCache(mint: string) {
  return prisma.assetMetadataCache.findUnique({ where: { mint } });
}

export async function setAssetMetadataCache(input: {
  mint: string;
  symbol?: string;
  name?: string;
  logoUri?: string;
  decimals?: number;
  source: string;
}) {
  return prisma.assetMetadataCache.upsert({
    where: { mint: input.mint },
    update: {
      symbol: input.symbol,
      name: input.name,
      logoUri: input.logoUri,
      decimals: input.decimals,
      source: input.source
    },
    create: {
      mint: input.mint,
      symbol: input.symbol,
      name: input.name,
      logoUri: input.logoUri,
      decimals: input.decimals,
      source: input.source
    }
  });
}
