"use client";

import { useState, useTransition } from "react";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { NEIGHBORHOODS } from "@/lib/constants";
import { brl, pct } from "@/components/analytics/format";
import { ChartTitle } from "@/components/analytics/MetricInfoTip";
import { M } from "@/components/analytics/metricInfoHelp";

type Plan = {
  beneficio: string;
  horarioIdeal: string;
  publicoAlvo: string;
  projecaoReceitaPct: number;
  roteiro: string;
  isFallback: boolean;
};

export function RestaurantCampaignPanel() {
  const { dash } = useAnalyticsDashboard();
  const [neighborhood, setNeighborhood] = useState<string>(NEIGHBORHOODS[0]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pending, startTransition] = useTransition();

  if (!dash) return null;

  function generate() {
    startTransition(async () => {
      const res = await fetch("/api/analytics/gemini/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: dash!.seed,
          neighborhood,
          useAi: true,
        }),
      });
      const json = await res.json();
      if (res.ok) setPlan(json as Plan);
    });
  }

  return (
    <section className="flex max-h-[420px] flex-col rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)] sm:p-5 xl:max-h-[480px]">
      <div className="shrink-0">
        <ChartTitle
          title="Plano para parceiros"
          info={{
            measures: "Incentivo sugerido por restaurante (GMV before → after).",
            formula:
              "gmvAfter = gmvBefore × (1 + lift); lift do otimizador B2B + sazonalidade",
            variables:
              "idle_capacity_pct · lowDemandDeltaPct · neighborhood · clusterMix · seasonality",
            premise: "Horário fraco / ociosidade × Comer Fora + benefícios",
            columns: [
              {
                name: "Restaurante",
                detail:
                  "Parceiro do catálogo Supabase (nome/bairro reais do seed de restaurantes). Sem inventar estabelecimento.",
              },
              {
                name: "GMV before / after",
                detail:
                  "Before: base sintética (ticket×faixa + seed). After: before × (1 + lift da estratégia B2B, com jitter da seed).",
              },
              {
                name: "Melhor estratégia",
                detail:
                  "pickEfficientRestaurantStrategy: cupom/giftback/prato/orgânico conforme ociosidade, mix de clusters vizinhos e calendário.",
              },
              M.idleCapacity,
              M.lowDemandDelta,
              {
                name: "Retorno",
                detail:
                  "ROI / lift estimado da estratégia B2B escolhida para aquele restaurante (otimizador + sazonalidade).",
              },
            ],
          }}
        />
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--ifdl-color-border)] text-muted">
                <th className="py-2 pr-2">Restaurante</th>
                <th className="py-2 pr-2">Melhor estratégia</th>
                <th className="py-2 pr-2">Faturamento</th>
                <th className="py-2 pr-2">Horário fraco</th>
                <th className="py-2">Retorno</th>
              </tr>
            </thead>
            <tbody>
              {dash.restaurants.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--ifdl-color-border)]"
                >
                  <td className="py-2 pr-2 font-bold">
                    {r.name}
                    <span className="block font-semibold text-muted">
                      {r.neighborhood} · {brl(r.gmvBefore)} → {brl(r.gmvAfter)}
                    </span>
                  </td>
                  <td className="max-w-[220px] py-2 pr-2">
                    <span className="font-bold capitalize text-ink">
                      {r.benefitType} · {r.strategy}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted">
                      {r.strategyReason}
                      {r.minTicketBrl > 0
                        ? ` · libera com gastos acima de ${brl(r.minTicketBrl)}`
                        : ""}
                      {r.freeDishName ? ` · ${r.freeDishName}` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-2 font-bold text-ifood">
                    {pct(r.deltaPct)}
                  </td>
                  <td className="py-2 pr-2">
                    {(r.idlePct * 100).toFixed(0)}% · low demand{" "}
                    {pct(r.lowDemandDeltaPct)}
                  </td>
                  <td className="py-2 font-bold">{r.strategyRoi}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-if bg-page p-3">
          <label className="text-xs font-bold">
            Bairro
            <select
              className="mt-1 block rounded-if border border-[var(--ifdl-color-border)] bg-white px-3 py-2 text-sm"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            >
              {NEIGHBORHOODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="if-btn-primary"
            disabled={pending}
            onClick={generate}
          >
            {pending ? "Gerando plano…" : "Gerar plano de campanha"}
          </button>
        </div>

        {plan && (
          <div className="rounded-if border border-ifood/20 bg-ifood-soft/40 p-4 text-sm">
            <p className="text-[10px] font-bold uppercase text-muted">
              {plan.isFallback ? "Fallback" : "Claude"} · plano pronto
            </p>
            <p className="mt-2">
              <span className="font-bold">Benefício:</span> {plan.beneficio}
            </p>
            <p>
              <span className="font-bold">Horário:</span> {plan.horarioIdeal}
            </p>
            <p>
              <span className="font-bold">Público:</span> {plan.publicoAlvo}
            </p>
            <p>
              <span className="font-bold">Projeção:</span> +
              {plan.projecaoReceitaPct}% receita
            </p>
            <p className="mt-2 text-muted">{plan.roteiro}</p>
          </div>
        )}
      </div>
    </section>
  );
}
