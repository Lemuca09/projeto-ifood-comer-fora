"use client";

import { useMemo, useState, useTransition } from "react";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { executiveBriefLocal } from "@/lib/executiveBriefLocal";

type Brief = {
  headline: string;
  lucroReal: string;
  canibalizacao: string;
  proximoPasso: string;
  isFallback: boolean;
};

export function ExecutiveInsightsCard() {
  const { dash } = useAnalyticsDashboard();
  const local = useMemo(
    () => (dash ? executiveBriefLocal(dash) : null),
    [dash],
  );
  const [brief, setBrief] = useState<Brief | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = brief ?? local;

  function generateWithAi() {
    if (!dash) return;
    startTransition(async () => {
      const res = await fetch("/api/analytics/gemini/executive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: dash.seed, useAi: true }),
      });
      const j = await res.json();
      if (res.ok) setBrief(j as Brief);
    });
  }

  if (!shown) return null;

  return (
    <section className="overflow-hidden rounded-if-lg border border-ifood/20 bg-gradient-to-br from-ifood-soft via-white to-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-title text-lg font-extrabold text-ink">
          Leitura executiva
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
            {shown.isFallback ? "Local (0 RPM)" : "Gemini"}
          </span>
          <button
            type="button"
            className="rounded-if border border-ifood/30 bg-white px-2.5 py-1 text-[11px] font-extrabold text-ifood disabled:opacity-50"
            disabled={pending || !dash}
            onClick={generateWithAi}
          >
            {pending ? "Gerando…" : "Gerar com Gemini"}
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <p className="font-title text-base font-extrabold text-ifood">
          {shown.headline}
        </p>
        <p className="text-sm text-ink">
          <span className="font-bold">Lucro real:</span> {shown.lucroReal}
        </p>
        <p className="text-sm text-ink">
          <span className="font-bold">Canibalização:</span> {shown.canibalizacao}
        </p>
        <p className="text-sm text-muted">
          <span className="font-bold text-ink">Próximo passo:</span>{" "}
          {shown.proximoPasso}
        </p>
      </div>
    </section>
  );
}
