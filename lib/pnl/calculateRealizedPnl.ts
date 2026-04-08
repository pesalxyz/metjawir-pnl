import { getHistoricalPrice } from "@/lib/pricing/getHistoricalPrice";
import { ParsedPositionEvent, PnlSummary, ReconstructedPosition } from "@/types/domain";
import { safeNum } from "@/lib/utils/format";
import { log } from "@/lib/utils/logger";

export async function calculateRealizedPnl(position: ReconstructedPosition): Promise<PnlSummary> {
  let totalDepositUsd = 0;
  let totalWithdrawnUsd = 0;
  let totalFeesUsd = 0;
  let estimatedPricing = false;
  const depositedMints = new Set<string>();

  const valueToken = async (event: ParsedPositionEvent, mint: string, amount: number) => {
    try {
      const px = await getHistoricalPrice(mint, event.timestamp, event.poolAddress);
      if (px.estimated) estimatedPricing = true;
      return safeNum(amount) * safeNum(px.priceUsd);
    } catch (error) {
      log("WARN", "Token valuation failed; defaulting token contribution to zero", {
        mint,
        timestamp: event.timestamp,
        signature: event.signature,
        action: event.action,
        error: error instanceof Error ? error.message : String(error)
      });
      estimatedPricing = true;
      return 0;
    }
  };

  for (const event of position.events.sort((a, b) => a.timestamp - b.timestamp)) {
    if (event.valuedUsd) {
      totalDepositUsd += safeNum(event.valuedUsd.deposit);
      totalWithdrawnUsd += safeNum(event.valuedUsd.withdrawn);
      totalFeesUsd += safeNum(event.valuedUsd.fees);
      continue;
    }

    if (event.action === "OPEN_POSITION" || event.action === "ADD_LIQUIDITY") {
      if (event.tokenA) {
        totalDepositUsd += await valueToken(event, event.tokenA.mint, event.tokenA.amountUi);
        depositedMints.add(event.tokenA.mint);
      }
      if (event.tokenB) {
        totalDepositUsd += await valueToken(event, event.tokenB.mint, event.tokenB.amountUi);
        depositedMints.add(event.tokenB.mint);
      }
      continue;
    }

    if (event.action === "REMOVE_LIQUIDITY" || event.action === "CLOSE_POSITION") {
      for (const token of [event.tokenA, event.tokenB]) {
        if (!token) continue;
        const usd = await valueToken(event, token.mint, token.amountUi);

        // If a close tx returns a mint never seen on deposit side, treat it as fee/reward.
        if (event.action === "CLOSE_POSITION" && depositedMints.size > 0 && !depositedMints.has(token.mint)) {
          totalFeesUsd += usd;
        } else {
          totalWithdrawnUsd += usd;
        }
      }
    }

    if (event.action === "CLAIM_FEES" || event.action === "CLOSE_POSITION") {
      for (const fee of event.fees ?? []) {
        totalFeesUsd += await valueToken(event, fee.mint, fee.amountUi);
      }
    }

    if (event.action === "CLAIM_FEES" && (!event.fees || event.fees.length === 0)) {
      for (const token of [event.tokenA, event.tokenB]) {
        if (!token) continue;
        totalFeesUsd += await valueToken(event, token.mint, token.amountUi);
      }
    }
  }

  const netRealizedPnlUsd = totalWithdrawnUsd + totalFeesUsd - totalDepositUsd;
  const realizedPnlPct = totalDepositUsd > 0 ? (netRealizedPnlUsd / totalDepositUsd) * 100 : 0;

  const closeEvent = [...position.events].reverse().find((event) => event.action === "CLOSE_POSITION");
  const closePrice = closeEvent?.tokenA?.amountUi
    ? (closeEvent.tokenB?.amountUi ?? 0) / closeEvent.tokenA.amountUi
    : undefined;

  return {
    totalDepositUsd,
    totalWithdrawnUsd,
    totalFeesUsd,
    netRealizedPnlUsd,
    realizedPnlPct,
    estimatedPricing,
    closePrice
  };
}
