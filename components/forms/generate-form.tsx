"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GenerateResponse } from "@/types/domain";

const schema = z.object({
  input: z.string().trim().min(1, "Enter a tx signature or supported explorer link.")
});

type FormData = z.infer<typeof schema>;

const progressSteps = [
  "Validating transaction",
  "Fetching on-chain data",
  "Reconstructing position history",
  "Calculating realized PnL",
  "Rendering card"
];

export function GenerateForm() {
  const router = useRouter();
  const [response, setResponse] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      input: ""
    }
  });

  const progressLabel = useMemo(() => progressSteps[progressIndex] ?? progressSteps[progressSteps.length - 1], [progressIndex]);

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setResponse(null);
    setProgressIndex(0);

    const ticker = setInterval(() => {
      setProgressIndex((prev) => Math.min(prev + 1, progressSteps.length - 1));
    }, 750);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: values.input })
      });
      const data = (await res.json()) as GenerateResponse;
      setResponse(data);

      if (data.ok && data.signature) {
        const recent = JSON.parse(localStorage.getItem("recentCards") ?? "[]") as string[];
        const next = [data.signature, ...recent.filter((item) => item !== data.signature)].slice(0, 5);
        localStorage.setItem("recentCards", JSON.stringify(next));
        router.push(`/card/${data.signature}`);
      }
    } catch (error) {
      setResponse({
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Unable to reach the generate endpoint.",
          details: error instanceof Error ? error.message : String(error)
        }
      });
    } finally {
      clearInterval(ticker);
      setProgressIndex(progressSteps.length - 1);
      setLoading(false);
    }
  });

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-2xl">Generator kertu Meteora PnL</CardTitle>
        <CardDescription>
          tempelaken tx posisi chedak koen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            placeholder="Paste tx signature or explorer URL"
            {...form.register("input")}
            aria-invalid={Boolean(form.formState.errors.input)}
          />
          {form.formState.errors.input && (
            <p className="text-sm text-red-300">{form.formState.errors.input.message}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Card
            </Button>
          </div>
        </form>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-border/70 bg-secondary/40 p-3 text-sm"
            >
              <p className="font-medium">{progressLabel}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {response && !response.ok && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-200">{response.error?.message}</p>
            <Accordion type="single" collapsible>
              <AccordionItem value="debug" className="border-none">
                <AccordionTrigger className="py-1 text-xs">Technical details</AccordionTrigger>
                <AccordionContent>
                  <pre className="overflow-x-auto text-xs">{JSON.stringify(response.error, null, 2)}</pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {response?.ok && response.confidence && (
          <Badge variant={response.confidence === "HIGH" ? "success" : response.confidence === "MEDIUM" ? "warning" : "danger"}>
            Confidence: {response.confidence}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
