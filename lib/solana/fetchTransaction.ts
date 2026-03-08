import { Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import { DEFAULT_SOLANA_RPC } from "@/lib/utils/constants";
import { getTxCache, setTxCache } from "@/lib/cache/txCache";
import { log } from "@/lib/utils/logger";
import { MOCK_SIGNATURE } from "@/lib/utils/mock";

export type FetchTransactionResult = {
  signature: string;
  transaction: ParsedTransactionWithMeta | null;
  source: "cache" | "helius" | "rpc" | "mock";
};

function getHeliusUrl(): string | null {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return null;
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

function getFallbackRpc(): string {
  return process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.toLowerCase().includes("too many requests");
}

async function fromRpc(signature: string, endpoint: string) {
  const connection = new Connection(endpoint, "confirmed");
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed"
      });
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error)) break;
      await sleep(250 * 2 ** attempt + Math.floor(Math.random() * 120));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("RPC parsed transaction request failed");
}

function buildMockTx(signature: string): ParsedTransactionWithMeta {
  return {
    blockTime: Math.floor(new Date("2025-09-03T09:14:00.000Z").getTime() / 1000),
    meta: {
      err: null,
      fee: 5000,
      innerInstructions: [],
      loadedAddresses: { readonly: [], writable: [] },
      logMessages: ["Program log: Meteora DLMM close_position"],
      postBalances: [],
      postTokenBalances: [],
      preBalances: [],
      preTokenBalances: []
    },
    slot: 123456789,
    transaction: {
      message: {
        accountKeys: [],
        instructions: [] as never[],
        recentBlockhash: "mock",
        addressTableLookups: []
      } as never,
      signatures: [signature]
    },
    version: 0
  } as ParsedTransactionWithMeta;
}

export async function fetchTransaction(signature: string): Promise<FetchTransactionResult> {
  const cached = await getTxCache(signature);
  if (cached?.parsedPayload) {
    return {
      signature,
      source: "cache",
      transaction: cached.parsedPayload as unknown as ParsedTransactionWithMeta
    };
  }

  if (signature === MOCK_SIGNATURE) {
    const tx = buildMockTx(signature);
    await setTxCache({
      signature,
      source: "mock",
      rawPayload: tx,
      parsedPayload: tx,
      slot: BigInt(tx.slot),
      blockTime: tx.blockTime ? new Date(tx.blockTime * 1000) : undefined
    });
    return { signature, source: "mock", transaction: tx };
  }

  const helius = getHeliusUrl();
  if (helius) {
    try {
      const tx = await fromRpc(signature, helius);
      if (tx) {
        await setTxCache({
          signature,
          source: "helius",
          rawPayload: tx,
          parsedPayload: tx,
          slot: BigInt(tx.slot),
          blockTime: tx.blockTime ? new Date(tx.blockTime * 1000) : undefined
        });
      }
      return { signature, source: "helius", transaction: tx };
    } catch (error) {
      log("WARN", "Helius fetch failed, falling back to public RPC", {
        signature,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const fallbackRpc = getFallbackRpc();
  const tx = await fromRpc(signature, fallbackRpc);
  if (tx) {
    await setTxCache({
      signature,
      source: "rpc",
      rawPayload: tx,
      parsedPayload: tx,
      slot: BigInt(tx.slot),
      blockTime: tx.blockTime ? new Date(tx.blockTime * 1000) : undefined
    });
  }
  return { signature, source: "rpc", transaction: tx };
}
