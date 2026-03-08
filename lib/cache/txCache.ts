import { prisma } from "@/lib/db/prisma";

export async function getTxCache(signature: string) {
  try {
    return await prisma.txCache.findUnique({ where: { signature } });
  } catch {
    return null;
  }
}

export async function setTxCache(input: {
  signature: string;
  source: string;
  rawPayload: unknown;
  parsedPayload?: unknown;
  isMeteora?: boolean;
  positionAccount?: string;
  owner?: string;
  slot?: bigint;
  blockTime?: Date;
}) {
  try {
    return await prisma.txCache.upsert({
      where: { signature: input.signature },
      update: {
        source: input.source,
        rawPayload: input.rawPayload as object,
        parsedPayload: input.parsedPayload as object | undefined,
        isMeteora: input.isMeteora,
        positionAccount: input.positionAccount,
        owner: input.owner,
        slot: input.slot,
        blockTime: input.blockTime
      },
      create: {
        signature: input.signature,
        source: input.source,
        rawPayload: input.rawPayload as object,
        parsedPayload: input.parsedPayload as object | undefined,
        isMeteora: input.isMeteora,
        positionAccount: input.positionAccount,
        owner: input.owner,
        slot: input.slot,
        blockTime: input.blockTime
      }
    });
  } catch {
    return null;
  }
}
