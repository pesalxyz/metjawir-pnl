import { ParsedTransactionWithMeta } from "@solana/web3.js";
import { METEORA_PROGRAM_HINTS } from "@/lib/utils/constants";

export function detectMeteoraDlmmTransaction(tx: ParsedTransactionWithMeta): {
  isMeteora: boolean;
  hints: string[];
} {
  const hints = new Set<string>();

  const logs = tx.meta?.logMessages ?? [];
  for (const log of logs) {
    const lower = log.toLowerCase();
    for (const hint of METEORA_PROGRAM_HINTS) {
      if (lower.includes(hint.toLowerCase())) {
        hints.add(hint);
      }
    }
  }

  const raw = JSON.stringify(tx.transaction.message.instructions ?? []);
  for (const hint of METEORA_PROGRAM_HINTS) {
    if (raw.toLowerCase().includes(hint.toLowerCase())) {
      hints.add(hint);
    }
  }

  return {
    isMeteora: hints.size > 0,
    hints: [...hints]
  };
}
