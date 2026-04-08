import { getNearestPriceCache, setPriceCache } from "@/lib/cache/priceCache";
import { PricingResult } from "@/types/domain";
import { log } from "@/lib/utils/logger";

type ProviderResult = {
  priceUsd: number;
  source: PricingResult["source"];
  estimated?: boolean;
};

async function fetchBirdeye(mint: string, timestamp: number): Promise<ProviderResult | null> {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) return null;

  const url = `https://public-api.birdeye.so/defi/history_price?address=${mint}&address_type=token&type=1m&time_from=${timestamp - 600}&time_to=${timestamp + 600}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-API-KEY": key,
        "x-chain": "solana"
      },
      next: { revalidate: 1800 }
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { items?: Array<{ value: number }> } };
    const price = data.data?.items?.[0]?.value;
    if (!price) return null;
    return { priceUsd: price, source: "birdeye" };
  } catch {
    return null;
  }
}

async function fetchJupiter(mint: string): Promise<ProviderResult | null> {
  const url = `https://price.jup.ag/v4/price?ids=${mint}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1200 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Record<string, { price: number }> };
    const price = data.data?.[mint]?.price;
    if (!price) return null;
    return { priceUsd: price, source: "jupiter", estimated: true };
  } catch {
    return null;
  }
}

async function fetchDefiLlama(mint: string): Promise<ProviderResult | null> {
  const key = `solana:${mint}`;
  const url = `https://coins.llama.fi/prices/current/${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { coins?: Record<string, { price: number }> };
    const price = json.coins?.[key]?.price;
    if (!price) return null;
    return { priceUsd: price, source: "defillama", estimated: true };
  } catch {
    return null;
  }
}

async function fetchDexScreener(mint: string): Promise<ProviderResult | null> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      pairs?: Array<{
        priceUsd?: string;
        liquidity?: { usd?: number };
        pairCreatedAt?: number;
      }>;
    };
    const pairs = json.pairs ?? [];
    if (!pairs.length) return null;

    // Choose the pair with strongest liquidity as best proxy.
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const candidate = pairs[0];
    const price = Number(candidate.priceUsd ?? 0);
    if (!price || Number.isNaN(price)) return null;

    return {
      priceUsd: price,
      source: "estimate",
      estimated: true
    };
  } catch {
    return null;
  }
}

function fallbackPriceForKnownMints(mint: string): number {
  if (mint === "So11111111111111111111111111111111111111112") return 160;
  if (mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") return 1;
  return 0;
}

export async function getHistoricalPrice(mint: string, timestamp: number): Promise<PricingResult> {
  const target = new Date(timestamp * 1000);
  let cached = null;

  try {
    cached = await getNearestPriceCache(mint, target, 3600);
  } catch (error) {
    log("WARN", "Price cache read failed; continuing with live providers", {
      mint,
      timestamp,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (cached) {
    return {
      mint,
      timestamp,
      priceUsd: cached.priceUsd,
      source: "cache",
      estimated: cached.estimated
    };
  }

  let provider = await fetchBirdeye(mint, timestamp);
  if (!provider) provider = await fetchJupiter(mint);
  if (!provider) provider = await fetchDefiLlama(mint);
  if (!provider) provider = await fetchDexScreener(mint);

  if (!provider) {
    const fallback = fallbackPriceForKnownMints(mint);
    provider = {
      priceUsd: fallback,
      source: "estimate",
      estimated: true
    };

    if (!fallback) {
      log("WARN", "No live or fallback price found for mint", { mint, timestamp });
    }
  }

  try {
    await setPriceCache({
      mint,
      timestamp: target,
      priceUsd: provider.priceUsd,
      source: provider.source,
      estimated: Boolean(provider.estimated)
    });
  } catch (error) {
    log("WARN", "Price cache write failed; using uncached provider result", {
      mint,
      timestamp,
      source: provider.source,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    mint,
    timestamp,
    priceUsd: provider.priceUsd,
    source: provider.source,
    estimated: Boolean(provider.estimated)
  };
}
