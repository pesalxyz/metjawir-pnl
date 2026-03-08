import { Connection, PublicKey, ParsedTransactionWithMeta, ConfirmedSignatureInfo } from "@solana/web3.js";
import { DEFAULT_SOLANA_RPC } from "@/lib/utils/constants";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.toLowerCase().includes("too many requests");
}

function getEndpoints(): string[] {
  const endpoints: string[] = [];
  const key = process.env.HELIUS_API_KEY;
  if (key) {
    endpoints.push(`https://mainnet.helius-rpc.com/?api-key=${key}`);
  }
  endpoints.push(process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC);
  return [...new Set(endpoints)];
}

async function withFallback<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
  const endpoints = getEndpoints();
  let lastError: unknown;

  for (const endpoint of endpoints) {
    const connection = new Connection(endpoint, "confirmed");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await fn(connection);
      } catch (error) {
        lastError = error;
        if (!isRateLimitError(error)) break;
        await sleep(250 * 2 ** attempt + Math.floor(Math.random() * 120));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All Solana RPC endpoints failed");
}

export async function getParsedTransactionWithFallback(signature: string): Promise<ParsedTransactionWithMeta | null> {
  return withFallback((connection) =>
    connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed"
    })
  );
}

export async function getSignaturesForAddressWithFallback(
  address: string,
  limit = 150
): Promise<ConfirmedSignatureInfo[]> {
  return withFallback((connection) =>
    connection.getSignaturesForAddress(new PublicKey(address), {
      limit
    })
  );
}
