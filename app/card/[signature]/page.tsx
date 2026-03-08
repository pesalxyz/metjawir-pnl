import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardWorkspace } from "@/components/card/card-workspace";
import { getGeneratedCard, mapGeneratedCardToCardData } from "@/lib/db/generatedCardRepo";
import { buildCardFromInput } from "@/lib/pnl/buildCard";
import { upsertGeneratedCard } from "@/lib/db/generatedCardRepo";

type Params = { signature: string };

async function loadCard(signature: string) {
  try {
    const found = await getGeneratedCard(signature);
    if (found) {
      const mapped = mapGeneratedCardToCardData(found);
      const staleZero =
        mapped.depositUsd === 0 && mapped.withdrawnUsd === 0 && mapped.feesUsd === 0 && mapped.pnlUsd === 0;
      if (!staleZero) return mapped;
    }
  } catch {
    // Continue with direct reconstruction if DB is unavailable.
  }

  try {
    const generated = await buildCardFromInput({ rawInput: signature });

    try {
      await upsertGeneratedCard(generated.card, {
        source: generated.normalizedSource,
        position: generated.position,
        summary: generated.summary
      });
    } catch {
      // DB optional for local/offline operation.
    }

    return generated.card;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { signature } = await params;
  const card = await loadCard(signature);

  if (!card) {
    return {
      title: "Card not found | Meteora PnL Card Generator"
    };
  }

  const title = `${card.pairLabel} ${card.pnlUsd >= 0 ? "+" : ""}${card.pnlUsd.toFixed(2)} USD`;
  const description = `Realized PnL ${card.pnlPct.toFixed(2)}% on Meteora DLMM`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/card/${signature}/opengraph-image`]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/card/${signature}/opengraph-image`]
    }
  };
}

export default async function CardPage({ params }: { params: Promise<Params> }) {
  const { signature } = await params;
  const card = await loadCard(signature);

  if (!card) {
    notFound();
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-4">
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          Back to generator
        </Link>
      </div>
      <CardWorkspace initialCard={card} />
    </>
  );
}
