import { ParsedTransactionWithMeta } from "@solana/web3.js";
import { fetchTransaction } from "@/lib/solana/fetchTransaction";
import { detectMeteoraDlmmTransaction } from "@/lib/meteora/detectInstruction";
import { Confidence, ParsedPositionEvent, ReconstructedPosition, TokenAmount } from "@/types/domain";
import { MOCK_SIGNATURE } from "@/lib/utils/mock";
import { getSignaturesForAddressWithFallback } from "@/lib/solana/rpc";

const WSOL_MINT = "So11111111111111111111111111111111111111112";

type Action = ParsedPositionEvent["action"];
type DlmmEventRow = Record<string, unknown>;

function pubkeyToString(input: unknown): string | undefined {
  if (!input) return undefined;
  if (typeof input === "string") return input;

  if (typeof input === "object") {
    const maybe = input as { pubkey?: unknown; toBase58?: () => string };
    if (typeof maybe.toBase58 === "function") return maybe.toBase58();
    if (maybe.pubkey) return pubkeyToString(maybe.pubkey);
  }

  return undefined;
}

function mintSymbol(mint: string): string | undefined {
  if (mint === WSOL_MINT) return "SOL";
  if (mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") return "USDC";
  if (mint === "Es9vMFrzaCER7zQ8MqqgYx8r6Yj7Xj3bpwT4i8iCLzD") return "USDT";
  return undefined;
}

function normalizeMint(mint?: string): string | undefined {
  if (!mint) return mint;
  return mint === "11111111111111111111111111111111" ? WSOL_MINT : mint;
}

function dedupeEvents(events: ParsedPositionEvent[]): ParsedPositionEvent[] {
  const seen = new Set<string>();
  const output: ParsedPositionEvent[] = [];

  for (const event of events) {
    const key = `${event.signature}:${event.action}:${event.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);

    output.push({
      ...event,
      tokenA: event.tokenA ? { ...event.tokenA, mint: normalizeMint(event.tokenA.mint) ?? event.tokenA.mint } : undefined,
      tokenB: event.tokenB ? { ...event.tokenB, mint: normalizeMint(event.tokenB.mint) ?? event.tokenB.mint } : undefined,
      fees: event.fees?.map((fee) => ({ ...fee, mint: normalizeMint(fee.mint) ?? fee.mint }))
    });
  }

  return output;
}

function mockHistory(signature: string): ReconstructedPosition {
  const owner = "6V3h9dw1vd2DQQRy6A1PM7jjYdu7hJwSPP7S4T8hC8k2";
  const positionAccount = "6Lyzk4SxA9xYdC7jFkdu8z9NMPsK9b7nQ8eC8vASn6k5";
  const poolAddress = "9m3kYv8YBZa7d8xV1LyQhB2YuhkprbeSxA7S3JGXv1Ue";

  const events: ParsedPositionEvent[] = [
    {
      signature: `${signature}-open`,
      timestamp: 1754300000,
      action: "OPEN_POSITION",
      owner,
      positionAccount,
      poolAddress,
      tokenA: {
        mint: WSOL_MINT,
        amountRaw: "10000000000",
        amountUi: 10,
        decimals: 9,
        symbol: "SOL"
      },
      tokenB: {
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amountRaw: "2500000000",
        amountUi: 2500,
        decimals: 6,
        symbol: "USDC"
      },
      confidence: "MEDIUM"
    },
    {
      signature,
      timestamp: 1756890840,
      action: "CLOSE_POSITION",
      owner,
      positionAccount,
      poolAddress,
      tokenA: {
        mint: WSOL_MINT,
        amountRaw: "11100000000",
        amountUi: 11.1,
        decimals: 9,
        symbol: "SOL"
      },
      tokenB: {
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amountRaw: "2970000000",
        amountUi: 2970,
        decimals: 6,
        symbol: "USDC"
      },
      fees: [
        {
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          amountRaw: "186200000",
          amountUi: 186.2,
          decimals: 6,
          symbol: "USDC"
        }
      ],
      confidence: "MEDIUM"
    }
  ];

  return {
    signature,
    owner,
    positionAccount,
    poolAddress,
    tokenMintA: events[0].tokenA?.mint,
    tokenMintB: events[0].tokenB?.mint,
    symbolA: "SOL",
    symbolB: "USDC",
    closeTimestamp: 1756890840,
    events,
    warnings: ["Mock reconstruction used. Replace parser heuristics for production mainnet precision."],
    confidence: "MEDIUM"
  };
}

function classifyAction(tx: ParsedTransactionWithMeta): Action {
  const logs = tx.meta?.logMessages?.join(" ").toLowerCase() ?? "";
  const has = (needle: string) => logs.includes(needle);

  // Prefer explicit Meteora instruction markers over generic "close" token/system logs.
  if (has("instruction: closepositionifempty") || has("instruction: close_position")) {
    return "CLOSE_POSITION";
  }
  if (has("instruction: claimfee")) return "CLAIM_FEES";
  if (has("instruction: removeliquidity")) return "REMOVE_LIQUIDITY";
  if (has("instruction: addliquidity")) return "ADD_LIQUIDITY";
  if (has("instruction: openposition") || has("instruction: initializeposition")) return "OPEN_POSITION";

  // Fallback keyword heuristics.
  if (logs.includes("claim")) return "CLAIM_FEES";
  if (logs.includes("remove")) return "REMOVE_LIQUIDITY";
  if (logs.includes("add")) return "ADD_LIQUIDITY";
  if (logs.includes("open")) return "OPEN_POSITION";
  return "CLOSE_POSITION";
}

function extractOwner(tx: ParsedTransactionWithMeta): string {
  const signer = tx.transaction.message.accountKeys.find((key) => (key as { signer?: boolean }).signer);
  return pubkeyToString(signer) ?? pubkeyToString(tx.transaction.message.accountKeys[0]) ?? "unknown";
}

function tokenDeltaMap(tx: ParsedTransactionWithMeta, owner: string):
  Array<{ mint: string; deltaUi: number; decimals: number }> {
  const decimalsMap = new Map<string, number>();
  const pre = new Map<string, number>();
  const post = new Map<string, number>();

  for (const item of tx.meta?.preTokenBalances ?? []) {
    if (item.owner !== owner || !item.mint) continue;
    const mint = normalizeMint(item.mint) ?? item.mint;
    const amount = Number(item.uiTokenAmount.uiAmount ?? 0);
    pre.set(mint, (pre.get(mint) ?? 0) + amount);
    decimalsMap.set(mint, item.uiTokenAmount.decimals ?? 0);
  }

  for (const item of tx.meta?.postTokenBalances ?? []) {
    if (item.owner !== owner || !item.mint) continue;
    const mint = normalizeMint(item.mint) ?? item.mint;
    const amount = Number(item.uiTokenAmount.uiAmount ?? 0);
    post.set(mint, (post.get(mint) ?? 0) + amount);
    decimalsMap.set(mint, item.uiTokenAmount.decimals ?? 0);
  }

  const mints = new Set<string>([...pre.keys(), ...post.keys()]);
  const deltas: Array<{ mint: string; deltaUi: number; decimals: number }> = [];

  for (const mint of mints) {
    const deltaUi = (post.get(mint) ?? 0) - (pre.get(mint) ?? 0);
    if (Math.abs(deltaUi) < 1e-12) continue;
    deltas.push({ mint, deltaUi, decimals: decimalsMap.get(mint) ?? 0 });
  }

  // Native SOL movement often represents wrapped SOL deposit/withdraw in DLMM flows.
  const ownerIdx = tx.transaction.message.accountKeys.findIndex(
    (key) => pubkeyToString(key) === owner
  );
  if (ownerIdx >= 0) {
    const preLamports = tx.meta?.preBalances?.[ownerIdx] ?? 0;
    const postLamports = tx.meta?.postBalances?.[ownerIdx] ?? 0;
    const deltaSol = (postLamports - preLamports) / 1_000_000_000;
    if (Math.abs(deltaSol) > 1e-9) {
      deltas.push({ mint: WSOL_MINT, deltaUi: deltaSol, decimals: 9 });
    }
  }

  deltas.sort((a, b) => Math.abs(b.deltaUi) - Math.abs(a.deltaUi));
  return deltas;
}

function tokenFromDelta(item: { mint: string; deltaUi: number; decimals: number }): TokenAmount {
  const absUi = Math.abs(item.deltaUi);
  const raw = BigInt(Math.round(absUi * 10 ** item.decimals)).toString();
  return {
    mint: item.mint,
    amountRaw: raw,
    amountUi: absUi,
    decimals: item.decimals,
    symbol: mintSymbol(item.mint)
  };
}

function buildEventFromTx(input: {
  signature: string;
  tx: ParsedTransactionWithMeta;
  owner: string;
  positionAccount?: string;
  poolAddress?: string;
}): ParsedPositionEvent | null {
  const action = classifyAction(input.tx);
  const deltas = tokenDeltaMap(input.tx, input.owner);

  const positive = deltas.filter((item) => item.deltaUi > 0);
  const negative = deltas.filter((item) => item.deltaUi < 0);

  const source = action === "OPEN_POSITION" || action === "ADD_LIQUIDITY" ? negative : positive;
  const tokenA = source[0] ? tokenFromDelta(source[0]) : undefined;
  const tokenB = source[1] ? tokenFromDelta(source[1]) : undefined;

  const fees: TokenAmount[] =
    action === "CLAIM_FEES" || action === "CLOSE_POSITION"
      ? source.slice(2).map(tokenFromDelta)
      : [];

  const event: ParsedPositionEvent = {
    signature: input.signature,
    timestamp: input.tx.blockTime ?? Math.floor(Date.now() / 1000),
    slot: input.tx.slot,
    action,
    owner: input.owner,
    positionAccount: input.positionAccount,
    poolAddress: input.poolAddress,
    tokenA,
    tokenB,
    fees,
    confidence: tokenA || tokenB || fees.length ? "MEDIUM" : "LOW"
  };

  if (!tokenA && !tokenB && fees.length === 0) {
    event.notes = ["No owner token delta extracted; event inferred from instruction logs."];
  }

  return event;
}

function pickConfidence(input: {
  events: ParsedPositionEvent[];
  hasClose: boolean;
  hasDeposits: boolean;
  hasWithdrawals: boolean;
}): Confidence {
  if (input.events.length >= 2 && input.hasClose && input.hasDeposits && input.hasWithdrawals) return "HIGH";
  if (input.events.length >= 1 && input.hasClose && (input.hasDeposits || input.hasWithdrawals)) return "MEDIUM";
  return "LOW";
}

function heuristicOwnerPositionPool(tx: ParsedTransactionWithMeta) {
  const owner = extractOwner(tx);
  let positionAccount: string | undefined;
  let poolAddress: string | undefined;

  for (const instruction of tx.transaction.message.instructions) {
    const programId = pubkeyToString(
      (instruction as { programId?: unknown }).programId ?? (instruction as { programIdIndex?: unknown }).programIdIndex
    );
    const accounts = (instruction as { accounts?: unknown[] }).accounts;
    if (!accounts || !Array.isArray(accounts) || accounts.length < 2) continue;

    if (programId?.startsWith("LBUZ")) {
      positionAccount = pubkeyToString(accounts[0]) ?? positionAccount;
      poolAddress = pubkeyToString(accounts[1]) ?? poolAddress;
      break;
    }
  }

  if (!positionAccount) {
    positionAccount = pubkeyToString(tx.transaction.message.accountKeys[1]);
  }
  if (!poolAddress) {
    poolAddress = pubkeyToString(tx.transaction.message.accountKeys[2]);
  }

  return { owner, positionAccount, poolAddress };
}

async function fetchJsonSafe<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function asNum(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

async function fetchDlmmHistoryFromApi(input: {
  signature: string;
  tx: ParsedTransactionWithMeta;
  owner: string;
}): Promise<{
  positionAccount?: string;
  poolAddress?: string;
  symbolA?: string;
  symbolB?: string;
  events: ParsedPositionEvent[];
} | null> {
  const keyCandidates = input.tx.transaction.message.accountKeys
    .slice(0, 20)
    .map((key) => pubkeyToString(key))
    .filter((value): value is string => Boolean(value));

  let positionAccount: string | undefined;
  for (const candidate of keyCandidates) {
    const check = await fetchJsonSafe<Record<string, unknown>>(`https://dlmm-api.meteora.ag/position/${candidate}`);
    if (check) {
      positionAccount = candidate;
      break;
    }
  }
  if (!positionAccount) return null;

  const deposits =
    (await fetchJsonSafe<DlmmEventRow[]>(`https://dlmm-api.meteora.ag/position/${positionAccount}/deposits`)) ?? [];
  const withdraws =
    (await fetchJsonSafe<DlmmEventRow[]>(`https://dlmm-api.meteora.ag/position/${positionAccount}/withdraws`)) ?? [];
  const claimFees =
    (await fetchJsonSafe<DlmmEventRow[]>(`https://dlmm-api.meteora.ag/position/${positionAccount}/claim_fees`)) ?? [];
  const claimRewards =
    (await fetchJsonSafe<DlmmEventRow[]>(`https://dlmm-api.meteora.ag/position/${positionAccount}/claim_rewards`)) ?? [];

  const pairAddress = (deposits[0]?.pair_address as string | undefined) ?? (withdraws[0]?.pair_address as string | undefined);
  const pairMeta = pairAddress
    ? await fetchJsonSafe<Record<string, unknown>>(`https://dlmm-api.meteora.ag/pair/${pairAddress}`)
    : null;
  const pairName = (pairMeta?.name as string | undefined) ?? "";
  const [symbolA, symbolB] = pairName.includes("-") ? pairName.split("-") : [undefined, undefined];

  const mapXY = (row: DlmmEventRow) => {
    const tokenXUsd = asNum(row.token_x_usd_amount);
    const tokenYUsd = asNum(row.token_y_usd_amount);
    const tokenXAmount = asNum(row.token_x_amount);
    const tokenYAmount = asNum(row.token_y_amount);
    return { tokenXUsd, tokenYUsd, tokenXAmount, tokenYAmount };
  };

  const events: ParsedPositionEvent[] = [];

  for (const row of deposits) {
    const ts = asNum(row.onchain_timestamp);
    const { tokenXUsd, tokenYUsd, tokenXAmount, tokenYAmount } = mapXY(row);
    events.push({
      signature: String(row.tx_id ?? `${positionAccount}-deposit-${ts}`),
      timestamp: ts,
      action: "ADD_LIQUIDITY",
      owner: input.owner,
      positionAccount,
      poolAddress: pairAddress,
      tokenA: tokenXAmount
        ? { mint: String(pairMeta?.mint_x ?? ""), amountRaw: String(tokenXAmount), amountUi: tokenXAmount, decimals: 0, symbol: symbolA }
        : undefined,
      tokenB: tokenYAmount
        ? { mint: String(pairMeta?.mint_y ?? ""), amountRaw: String(tokenYAmount), amountUi: tokenYAmount, decimals: 0, symbol: symbolB }
        : undefined,
      valuedUsd: { deposit: tokenXUsd + tokenYUsd },
      confidence: "HIGH"
    });
  }

  for (const row of withdraws) {
    const ts = asNum(row.onchain_timestamp);
    const { tokenXUsd, tokenYUsd, tokenXAmount, tokenYAmount } = mapXY(row);
    const txId = String(row.tx_id ?? `${positionAccount}-withdraw-${ts}`);
    events.push({
      signature: txId,
      timestamp: ts,
      action: txId === input.signature ? "CLOSE_POSITION" : "REMOVE_LIQUIDITY",
      owner: input.owner,
      positionAccount,
      poolAddress: pairAddress,
      tokenA: tokenXAmount
        ? { mint: String(pairMeta?.mint_x ?? ""), amountRaw: String(tokenXAmount), amountUi: tokenXAmount, decimals: 0, symbol: symbolA }
        : undefined,
      tokenB: tokenYAmount
        ? { mint: String(pairMeta?.mint_y ?? ""), amountRaw: String(tokenYAmount), amountUi: tokenYAmount, decimals: 0, symbol: symbolB }
        : undefined,
      valuedUsd: { withdrawn: tokenXUsd + tokenYUsd },
      confidence: "HIGH"
    });
  }

  for (const row of claimFees) {
    const ts = asNum(row.onchain_timestamp);
    const { tokenXUsd, tokenYUsd, tokenXAmount, tokenYAmount } = mapXY(row);
    events.push({
      signature: String(row.tx_id ?? `${positionAccount}-fees-${ts}`),
      timestamp: ts,
      action: "CLAIM_FEES",
      owner: input.owner,
      positionAccount,
      poolAddress: pairAddress,
      tokenA: tokenXAmount
        ? { mint: String(pairMeta?.mint_x ?? ""), amountRaw: String(tokenXAmount), amountUi: tokenXAmount, decimals: 0, symbol: symbolA }
        : undefined,
      tokenB: tokenYAmount
        ? { mint: String(pairMeta?.mint_y ?? ""), amountRaw: String(tokenYAmount), amountUi: tokenYAmount, decimals: 0, symbol: symbolB }
        : undefined,
      valuedUsd: { fees: tokenXUsd + tokenYUsd },
      confidence: "HIGH"
    });
  }

  for (const row of claimRewards) {
    const ts = asNum(row.onchain_timestamp);
    const rewardUsd = asNum(row.token_usd_amount);
    const rewardAmount = asNum(row.token_amount);
    const rewardMint = String(row.reward_mint_address ?? "");
    events.push({
      signature: String(row.tx_id ?? `${positionAccount}-rewards-${ts}`),
      timestamp: ts,
      action: "CLAIM_FEES",
      owner: input.owner,
      positionAccount,
      poolAddress: pairAddress,
      fees: rewardAmount
        ? [{ mint: rewardMint, amountRaw: String(rewardAmount), amountUi: rewardAmount, decimals: 0, symbol: mintSymbol(rewardMint) }]
        : undefined,
      valuedUsd: { fees: rewardUsd },
      confidence: "HIGH"
    });
  }

  if (!events.length) return null;
  return { positionAccount, poolAddress: pairAddress, symbolA, symbolB, events };
}

async function scanPositionHistory(input: {
  signature: string;
  owner: string;
  positionAccount?: string;
  poolAddress?: string;
}): Promise<ParsedPositionEvent[]> {
  if (!input.positionAccount || input.owner === "unknown") return [];

  // TODO: Expand pagination/checkpoint strategy for very long-lived positions.
  const sigs = await getSignaturesForAddressWithFallback(input.positionAccount, 40);
  const uniq = Array.from(new Set([input.signature, ...sigs.map((item) => item.signature)]));

  const events: ParsedPositionEvent[] = [];
  for (const signature of uniq) {
    const txResult = await fetchTransaction(signature);
    if (!txResult.transaction) continue;
    const event = buildEventFromTx({
      signature,
      tx: txResult.transaction,
      owner: input.owner,
      positionAccount: input.positionAccount,
      poolAddress: input.poolAddress
    });
    if (event) events.push(event);

    // Avoid bursting RPC providers with back-to-back requests.
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  return events;
}

export async function reconstructPositionHistory(signature: string): Promise<ReconstructedPosition> {
  if (signature === MOCK_SIGNATURE) {
    return mockHistory(signature);
  }

  const txResult = await fetchTransaction(signature);
  if (!txResult.transaction) {
    throw new Error("Transaction not found on Solana RPC.");
  }

  const detection = detectMeteoraDlmmTransaction(txResult.transaction);
  if (!detection.isMeteora) {
    throw new Error("Transaction is not detected as Meteora DLMM.");
  }

  const root = heuristicOwnerPositionPool(txResult.transaction);
  const warnings: string[] = [];

  const dlmmApi = await fetchDlmmHistoryFromApi({
    signature,
    tx: txResult.transaction,
    owner: root.owner
  });
  if (dlmmApi) {
    const apiEvents = dedupeEvents(dlmmApi.events).sort((a, b) => a.timestamp - b.timestamp);
    const closeEvent = [...apiEvents].reverse().find((event) => event.action === "CLOSE_POSITION");
    return {
      signature,
      owner: root.owner,
      positionAccount: dlmmApi.positionAccount ?? root.positionAccount,
      poolAddress: dlmmApi.poolAddress ?? root.poolAddress,
      tokenMintA: apiEvents[0]?.tokenA?.mint,
      tokenMintB: apiEvents[0]?.tokenB?.mint,
      symbolA: dlmmApi.symbolA ?? apiEvents[0]?.tokenA?.symbol,
      symbolB: dlmmApi.symbolB ?? apiEvents[0]?.tokenB?.symbol,
      closeTimestamp: closeEvent?.timestamp ?? txResult.transaction.blockTime ?? Math.floor(Date.now() / 1000),
      events: apiEvents,
      warnings: [],
      confidence: "HIGH"
    };
  }

  if (!root.positionAccount) {
    warnings.push("Position account could not be found from parsed transaction keys.");
  }

  const historyEvents = await scanPositionHistory({
    signature,
    owner: root.owner,
    positionAccount: root.positionAccount,
    poolAddress: root.poolAddress
  });

  let events = dedupeEvents(historyEvents).sort((a, b) => a.timestamp - b.timestamp);

  if (!events.length) {
    // Fallback to at least parse the provided tx.
    const fallback = buildEventFromTx({
      signature,
      tx: txResult.transaction,
      owner: root.owner,
      positionAccount: root.positionAccount,
      poolAddress: root.poolAddress
    });
    if (fallback) events = [fallback];
  }

  if (!events.length) {
    events = [
      {
        signature,
        timestamp: txResult.transaction.blockTime ?? Math.floor(Date.now() / 1000),
        slot: txResult.transaction.slot,
        action: classifyAction(txResult.transaction),
        owner: root.owner,
        positionAccount: root.positionAccount,
        poolAddress: root.poolAddress,
        confidence: "LOW",
        notes: ["Synthetic event created because detailed parsing returned no events."]
      }
    ];
  }

  const hasClose = events.some((event) => event.action === "CLOSE_POSITION");
  const hasDeposits = events.some(
    (event) => (event.action === "OPEN_POSITION" || event.action === "ADD_LIQUIDITY") && (event.tokenA || event.tokenB)
  );
  const hasWithdrawals = events.some(
    (event) => (event.action === "REMOVE_LIQUIDITY" || event.action === "CLOSE_POSITION") && (event.tokenA || event.tokenB)
  );

  const confidence = pickConfidence({ events, hasClose, hasDeposits, hasWithdrawals });

  if (!hasDeposits) {
    warnings.push("Could not fully reconstruct deposit-side history. PnL may be partial.");
  }
  if (confidence !== "HIGH") {
    warnings.push("Partial confidence: parser used resilient heuristics for one or more events.");
  }

  const closeEvent = [...events].reverse().find((event) => event.action === "CLOSE_POSITION");

  return {
    signature,
    owner: root.owner,
    positionAccount: root.positionAccount,
    poolAddress: root.poolAddress,
    tokenMintA: events[0]?.tokenA?.mint,
    tokenMintB: events[0]?.tokenB?.mint,
    symbolA: events[0]?.tokenA?.symbol,
    symbolB: events[0]?.tokenB?.symbol,
    closeTimestamp: closeEvent?.timestamp ?? txResult.transaction.blockTime ?? Math.floor(Date.now() / 1000),
    events,
    warnings,
    confidence
  };
}
