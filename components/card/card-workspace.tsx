"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PnlCard } from "@/components/card/pnl-card";
import { CardData, CardTheme } from "@/types/domain";
import { THEME_CONFIGS } from "@/lib/utils/constants";

export function CardWorkspace({ initialCard }: { initialCard: CardData }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<CardData>({ ...initialCard, ratio: "1:1" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hidePercent, setHidePercent] = useState(false);
  const [hideTvl, setHideTvl] = useState(false);
  const [hideFees, setHideFees] = useState(false);

  const renderCardPng = async () => {
    if (!cardRef.current) throw new Error("Card not ready");
    const mod = await import("html-to-image");
    return mod.toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2
    });
  };

  const onDownloadPng = async () => {
    setBusy(true);
    setMessage(null);

    try {
      const dataUrl = await renderCardPng();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${card.signature}.png`;
      a.click();
      setMessage("PNG downloaded.");
    } catch {
      window.open(`/card/${card.signature}/opengraph-image`, "_blank");
      setMessage("Fallback image opened in new tab.");
    } finally {
      setBusy(false);
    }
  };

  const onCopyImage = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const dataUrl = await renderCardPng();
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        setMessage("Copy image is not supported in this browser.");
        return;
      }

      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob
        })
      ]);
      setMessage("Image copied.");
    } catch {
      setMessage("Failed to copy image.");
    } finally {
      setBusy(false);
    }
  };

  const onRegenerate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: card.signature,
          theme: card.theme,
          ratio: "1:1",
          watermark: card.watermark,
          customBackgroundUrl: card.customBackgroundUrl
        })
      });

      if (!res.ok) {
        setMessage("Regenerate failed.");
      } else {
        setMessage("Card regenerated.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const onTheme = (theme: CardTheme) => setCard((prev) => ({ ...prev, theme }));
  const onPresetBackground = (preset: "v1" | "v2") =>
    setCard((prev) => ({
      ...prev,
      customBackgroundUrl: preset === "v1" ? "/bg-v1.png" : "/bg-v2.png"
    }));

  const onUploadBackground = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Only image files are allowed.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setMessage("Image must be under 15MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (typeof data === "string") {
        setCard((prev) => ({ ...prev, customBackgroundUrl: data }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">PnL Card</h1>
          <p className="text-sm text-muted-foreground">/card/{card.signature}</p>
        </div>
        <Badge variant={card.confidence === "HIGH" ? "success" : card.confidence === "MEDIUM" ? "warning" : "danger"}>
          Confidence: {card.confidence}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex justify-center">
          <PnlCard ref={cardRef} card={card} hidePercent={hidePercent} hideTvl={hideTvl} hideFees={hideFees} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Customize and share</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {THEME_CONFIGS.map((theme) => (
                <Button
                  key={theme.id}
                  variant={card.theme === theme.id && !card.customBackgroundUrl ? "default" : "secondary"}
                  size="sm"
                  onClick={() => {
                    onTheme(theme.id);
                    setCard((prev) => ({ ...prev, customBackgroundUrl: undefined }));
                  }}
                >
                  {theme.label}
                </Button>
              ))}
              <Button
                variant={card.customBackgroundUrl === "/bg-v1.png" ? "default" : "secondary"}
                size="sm"
                onClick={() => onPresetBackground("v1")}
              >
                v1
              </Button>
              <Button
                variant={card.customBackgroundUrl === "/bg-v2.png" ? "default" : "secondary"}
                size="sm"
                onClick={() => onPresetBackground("v2")}
              >
                v2
              </Button>
            </div>

            <Button variant="secondary" size="sm" onClick={() => setCard((prev) => ({ ...prev, watermark: !prev.watermark }))}>
              Watermark: {card.watermark ? "On" : "Off"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setHidePercent((prev) => !prev)}>
              Hide Percent: {hidePercent ? "On" : "Off"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setHideTvl((prev) => !prev)}>
              Hide TVL: {hideTvl ? "On" : "Off"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setHideFees((prev) => !prev)}>
              Hide Fees: {hideFees ? "On" : "Off"}
            </Button>

            <label className="block text-xs text-muted-foreground">
              Custom background
              <input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={onUploadBackground} />
            </label>

            <div className="grid gap-2">
              <Button onClick={onDownloadPng} disabled={busy}>
                <Download className="h-4 w-4" /> Download PNG
              </Button>
              <Button variant="secondary" onClick={onCopyImage} disabled={busy}>
                <Copy className="h-4 w-4" /> Copy Image
              </Button>
              <Button variant="secondary" onClick={onRegenerate} disabled={busy}>
                <RefreshCw className="h-4 w-4" /> Regenerate
              </Button>
            </div>

            {message && <p className="text-xs text-cyan-300">{message}</p>}

            {card.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                {card.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
