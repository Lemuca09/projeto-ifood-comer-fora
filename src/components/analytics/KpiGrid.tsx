"use client";

import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { brl, pct } from "@/components/analytics/format";

export function KpiGrid() {
  const { dash } = useAnalyticsDashboard();
  if (!dash) return null;
  const { kpis } = dash;

  const mix = dash.strategyMix;
  const mixTotal = Math.max(
    mix.cupom + mix.giftback + mix.prato_gratis + mix.nenhum,
    1,
  );

  const cards = [
    {
      label: "Faturamento depois da estratégia",
      value: brl(kpis.gmvAfter),
      sub: `Antes ${brl(kpis.gmvBefore)} · variação ${pct(kpis.gmvDeltaPct)} (${brl(kpis.gmvDeltaAbs)})`,
    },
    {
      label: "Ganho em horário fraco",
      value: pct(kpis.lowDemandLiftPct),
      sub: "Mais movimento quando o restaurante costuma ficar vazio",
    },
    {
      label: "Novos no Comer Fora",
      value: `${kpis.newComerForaUsers}`,
      sub: `${kpis.newComerForaPct}% da base: delivery/ocasionais que passaram a frequentar o salão após a estratégia`,
    },
    {
      label: "Retorno do dinheiro investido",
      value: `${kpis.roi}x`,
      sub: `Para cada R$ 1 em benefício, sobrou ${kpis.roi}x · custo ${brl(kpis.campaignCost)}`,
    },
    {
      label: "Efeito real vs. quem não recebeu",
      value: pct(kpis.liftVsControl),
      sub: `Lucro extra líquido ${brl(kpis.incrementalNetRevenue)} (descontando grupo controle)`,
    },
    {
      label: "Como a verba foi distribuída",
      value: `${Math.round((mix.cupom / mixTotal) * 100)}% cupom`,
      sub: `${Math.round((mix.giftback / mixTotal) * 100)}% giftback · ${Math.round((mix.prato_gratis / mixTotal) * 100)}% prato grátis · ${Math.round((mix.nenhum / mixTotal) * 100)}% sem benefício`,
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-title text-lg font-extrabold text-ink">
          Números para a apresentação
        </h2>
        <p className="mt-1 text-xs text-muted">
          Comparativo direto: o que mudou depois da estratégia por cliente.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <article key={c.label} className="if-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {c.label}
            </p>
            <p className="font-title mt-1 text-2xl font-extrabold text-ink">
              {c.value}
            </p>
            <p className="mt-1 text-xs font-semibold leading-snug text-muted">
              {c.sub}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
