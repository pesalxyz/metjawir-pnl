import { getNearestPriceCache, setPriceCache } from "@/lib/cache/priceCache";
import { PricingResult } from "@/types/domain";
import { log } from "@/lib/utils/logger";

type ProviderResult = {
  priceUsd: number;
  source: PricingResult["source"];
  estimated?: boolean;
};

type GeckoTerminalPoolRow = {
  id: string;
  attributes?: {
    address?: string;
    reserve_in_usd?: string;
  };
};

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCER7zQ8MqqgYx8r6Yj7Xj3bpwT4i8iCLzD";
const geckoPoolSeriesCache = new Map<string, Array<{ ts: number; price: number }>>();
const coinGeckoSeriesCache = new Map<string, Array<{ ts: number; price: number }>>();

function isStableMint(mint: string): boolean {
  return mint === USDC_MINT || mint === USDT_MINT;
}

function nearestNumeric(values: Array<{ ts: number; price: number }>, target: number): number | null {
  const usable = values.filter((item) => Number.isFinite(item.ts) && Number.isFinite(item.price) && item.price > 0);
  if (!usable.length) return null;
  usable.sort((a, b) => Math.abs(a.ts - target) - Math.abs(b.ts - target));
  return usable[0]?.price ?? null;
}

async function fetchCoinGeckoHistorical(coinId: string, timestamp: number): Promise<ProviderResult | null> {
  const bucket = Math.floor(timestamp / 7200);
  const cacheKey = `${coinId}:${bucket}`;
  const cachedSeries = coinGeckoSeriesCache.get(cacheKey);
  if (cachedSeries) {
    const cachedPrice = nearestNumeric(cachedSeries, timestamp);
    if (cachedPrice) {
      return { priceUsd: cachedPrice, source: "coingecko" };
    }
  }

  const from = bucket * 7200;
  const to = from + 7200;
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;

    const json = (await res.json()) as { prices?: Array<[number, number]> };
    const series = (json.prices ?? []).map(([tsMs, px]) => ({ ts: Math.floor(tsMs / 1000), price: px }));
    coinGeckoSeriesCache.set(cacheKey, series);
    const price = nearestNumeric(series, timestamp);

    if (!price) return null;
    return { priceUsd: price, source: "coingecko" };
  } catch {
    return null;
  }
}

async function fetchGeckoTerminalPoolOhlcv(poolAddress: string, timestamp: number): Promise<number | null> {
  const bucket = Math.floor(timestamp / 3600);
  const cacheKey = `${poolAddress}:${bucket}`;
  const cachedSeries = geckoPoolSeriesCache.get(cacheKey);
  if (cachedSeries) {
    return nearestNumeric(cachedSeries, timestamp);
  }

  const beforeTimestamp = (bucket + 1) * 3600 + 120;
  const url =
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/minute?aggregate=1&before_timestamp=${beforeTimestamp}&limit=90&currency=usd`;

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: {
        attributes?: {
          ohlcv_list?: Array<[number, number, number, number, number, number]>;
        };
      };
    };

    const series = (json.data?.attributes?.ohlcv_list ?? []).map((row) => ({ ts: row[0], price: row[4] }));
    geckoPoolSeriesCache.set(cacheKey, series);
    const price = nearestNumeric(series, timestamp);

    return price;
  } catch {
    return null;
  }
}

async function fetchGeckoTerminalHistorical(
  mint: string,
  timestamp: number,
  preferredPoolAddress?: string
): Promise<ProviderResult | null> {
  const poolCandidates: string[] = [];

  if (preferredPoolAddress) {
    poolCandidates.push(preferredPoolAddress);
  }

  try {
    const poolsUrl = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`;
    const res = await fetch(poolsUrl, { next: { revalidate: 1800 } });
    if (res.ok) {
      const json = (await res.json()) as { data?: GeckoTerminalPoolRow[] };
      const ranked = (json.data ?? [])
        .map((row) => ({
          address: row.attributes?.address ?? row.id?.split("_").pop() ?? "",
          reserveUsd: Number(row.attributes?.reserve_in_usd ?? 0)
        }))
        .filter((row) => row.address)
        .sort((a, b) => b.reserveUsd - a.reserveUsd)
        .map((row) => row.address);

      for (const address of ranked) {
        if (!poolCandidates.includes(address)) {
          poolCandidates.push(address);
        }
      }
    }
  } catch {
    // Continue with any preferred pool only.
  }

  for (const poolAddress of poolCandidates.slice(0, 5)) {
    const price = await fetchGeckoTerminalPoolOhlcv(poolAddress, timestamp);
    if (price) {
      return {
        priceUsd: price,
        source: "geckoterminal"
      };
    }
  }

  return null;
}

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
  if (mint === WSOL_MINT) return 160;
  if (mint === USDC_MINT || mint === USDT_MINT) return 1;
  return 0;
}

export async function getHistoricalPrice(mint: string, timestamp: number, poolAddress?: string): Promise<PricingResult> {
  const target = new Date(timestamp * 1000);
  let cached = null;

  try {
    cached = await getNearestPriceCache(mint, target, 180);
  } catch (error) {
    log("WARN", "Price cache read failed; continuing with live providers", {
      mint,
      timestamp,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const shouldBypassEstimatedCache =
    Boolean(cached?.estimated) && (mint === WSOL_MINT || Boolean(poolAddress));

  if (cached && !shouldBypassEstimatedCache) {
    return {
      mint,
      timestamp,
      priceUsd: cached.priceUsd,
      source: "cache",
      estimated: cached.estimated
    };
  }

  let provider = await fetchBirdeye(mint, timestamp);
  if (!provider && mint === WSOL_MINT) provider = await fetchCoinGeckoHistorical("wrapped-solana", timestamp);
  if (!provider && isStableMint(mint)) provider = { priceUsd: 1, source: "estimate", estimated: false };
  if (!provider) provider = await fetchGeckoTerminalHistorical(mint, timestamp, poolAddress);
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
