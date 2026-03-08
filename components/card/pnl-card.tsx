"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { CardData } from "@/types/domain";
import { formatPct, formatUsd } from "@/lib/utils/format";
import { THEME_CONFIGS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils/cn";

export const PnlCard = forwardRef<HTMLDivElement, { card: CardData; className?: string }>(({ card, className }, ref) => {
  const theme = THEME_CONFIGS.find((item) => item.id === card.theme) ?? THEME_CONFIGS[0];
  const usingLossBackground = card.pnlUsd < 0;
  const usingCustomBackground = Boolean(card.customBackgroundUrl) && !usingLossBackground;
  const backgroundImage = usingLossBackground
    ? "url('/bg-lose.png')"
    : card.customBackgroundUrl
      ? `url(${card.customBackgroundUrl})`
      : theme.background;

  return (
    <motion.div
      ref={ref}
      id="pnl-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-white/10 p-6 text-white shadow-2xl",
        "aspect-square w-[560px] max-w-full",
        className
      )}
      style={{
        backgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      {!usingCustomBackground && <div className="absolute inset-0 bg-grid bg-[length:18px_18px] opacity-25" />}
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-semibold tracking-tight">{card.pairLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border-white/15 bg-white/10 text-white">{card.protocol}</Badge>
          </div>
        </div>

        <div className="relative isolate w-fit overflow-hidden rounded-2xl border border-white/15 bg-black/40 px-4 py-3 backdrop-blur-sm">
          <div className="relative space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/90">PNL Sing Wis Terealisasi</p>
            <p className={cn("text-6xl font-extrabold tracking-tight", card.pnlUsd >= 0 ? "text-[rgb(0,255,64)]" : "text-rose-300")}>
              {formatUsd(card.pnlUsd)}
            </p>
            <p className={cn("text-4xl font-extrabold", card.pnlPct >= 0 ? "text-[rgb(0,255,64)]" : "text-rose-200")}>
              {formatPct(card.pnlPct)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Duit Sing di Depositaken" value={formatUsd(card.depositUsd)} />
          <Metric label="Duit Sing di WD" value={formatUsd(card.withdrawnUsd)} />
          <Metric label="Fees" value={formatUsd(card.feesUsd)} />
          <Metric label="Suwene Wektu" value={card.durationLabel ?? "00:00:00"} />
        </div>

        <div className={cn("mt-3 flex items-center gap-2 text-xs text-white/60", card.watermark ? "visible" : "invisible")}>
          <Image src="/discord.svg" alt="Discord" width={16} height={16} className="rounded-sm" />
          <span>METJAWIR</span>
        </div>
      </div>
    </motion.div>
  );
});
PnlCard.displayName = "PnlCard";

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-black/20 p-2", className)}>
      <p className="text-xs text-white/70">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
