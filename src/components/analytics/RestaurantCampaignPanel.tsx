"use client";

import { useState, useTransition } from "react";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { NEIGHBORHOODS } from "@/lib/constants";
import { brl, pct } from "@/components/analytics/format";

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
    <section className="if-card flex max-h-[420px] flex-col p-4 sm:p-5 xl:max-h-[480px]">
      <div className="shrink-0">
        <h2 className="font-title text-lg font-extrabold">
          Plano para restaurantes parceiros
        </h2>
        <p className="mt-1 text-xs text-muted">
          Melhor incentivo por restaurante: ociosidade, clusters e sazonalidade
          (feriado lotado = mais leve; salário dias 5–15 = mais incentivo)
        </p>
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
