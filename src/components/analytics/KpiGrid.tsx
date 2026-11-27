"use client";

import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { brl, pct } from "@/components/analytics/format";
import {
  MetricInfoTip,
  type MetricInfoContent,
} from "@/components/analytics/MetricInfoTip";
import { M } from "@/components/analytics/metricInfoHelp";

type KpiCard = {
  label: string;
  value: string;
  delta: string | null;
  deltaPositive: boolean | null;
  info: MetricInfoContent;
};

export function KpiGrid() {
  const { dash } = useAnalyticsDashboard();
  if (!dash) return null;
  const { kpis } = dash;

  const mix = dash.strategyMix;
  const mixTotal = Math.max(
    mix.cupom + mix.giftback + mix.prato_gratis + mix.nenhum,
    1,
  );

  const cards: KpiCard[] = [
    {
      label: "Faturamento depois",
      value: brl(kpis.gmvAfter),
      delta: pct(kpis.gmvDeltaPct),
      deltaPositive: kpis.gmvDeltaPct >= 0,
      info: {
        measures: "GMV sintético da base após a estratégia por cliente.",
        formula:
          "Σ spendAfter; spendAfter = spendBefore × (1 + lift); variação = (after − before) / before",
        variables:
          "spendBefore · spendAfter · expectedLift · monetary",
        premise: "Antes × depois da estratégia otimizada por persona",
        columns: [
          M.spendBefore,
          M.spendAfter,
          M.monetary,
          M.benefitType,
          {
            name: "gmvDeltaPct",
            detail:
              "Variação % do GMV da base. (Σ spendAfter − Σ spendBefore) / Σ spendBefore × 100.",
          },
        ],
      },
    },
    {
      label: "Horário fraco",
      value: pct(kpis.lowDemandLiftPct),
      delta: null,
      deltaPositive: null,
      info: {
        measures: "Ganho médio de movimento em janelas ociosas do salão.",
        formula: "Média(lowDemandDeltaPct) dos restaurantes parceiros no painel",
        variables: "idle_capacity_pct · lowDemandDeltaPct · seasonalityContext",
        premise: "Com vs sem estímulo em horário de baixa demanda",
        columns: [
          M.idleCapacity,
          M.lowDemandDelta,
          {
            name: "lowDemandLiftPct (KPI)",
            detail:
              "Média dos lowDemandDeltaPct dos restaurantes do painel parceiro nesta seed.",
          },
        ],
      },
    },
    {
      label: "Novos no Comer Fora",
      value: `${kpis.newComerForaUsers}`,
      delta: `${kpis.newComerForaPct}%`,
      deltaPositive: kpis.newComerForaPct > 0,
      info: {
        measures: "Personas delivery/ocasionais convertidas ao salão.",
        formula:
          "Contagem com P(conversão) por benefício + lift; % = novos / base",
        variables:
          "comer_fora_visits_90d · archetype · benefitType · spendDeltaPct",
        premise: "Quem tinha <2 visitas CF/90d e passa a frequentar o salão",
        columns: [
          M.comerForaVisits90d,
          M.benefitType,
          M.spendDeltaPct,
          {
            name: "newComerForaUsers / %",
            detail:
              "Contagem (e %) de personas com poucas visitas CF que, após benefício + lift, entram no critério de conversão da demo.",
          },
        ],
      },
    },
    {
      label: "ROI do investimento",
      value: `${kpis.roi}x`,
      delta: null,
      deltaPositive: kpis.roi >= 1,
      info: {
        measures: "Retorno líquido do dinheiro gasto em benefícios.",
        formula:
          "ROI = (margemIncremental − campaignCost) / campaignCost; custo ≈ Σ benefit × 0,65",
        variables:
          "benefitValueBrl · marginAfter · marginBefore · campaignCost",
        premise: "Margem ganha vs custo de cupom/giftback/prato",
        columns: [
          M.benefitValueBrl,
          M.marginBefore,
          M.marginAfter,
          {
            name: "campaignCost",
            detail:
              "Custo estimado da campanha. Σ benefitValueBrl × 0,65 (fator de custo absorvido na demo).",
          },
          {
            name: "roi",
            detail:
              "(Σ(marginAfter − marginBefore) − campaignCost) / campaignCost. Agregado da base, não por persona.",
          },
        ],
      },
    },
    {
      label: "Efeito vs controle",
      value: pct(kpis.liftVsControl),
      delta: brl(kpis.incrementalNetRevenue),
      deltaPositive: kpis.liftVsControl >= 0,
      info: {
        measures: "Lift de GMV acima do que a base cresceria sozinha.",
        formula:
          "(liftObservado − 4% controle) × 100; liftObservado = ΔGMV / GMV before",
        variables: "spendBefore · spendAfter · incrementalNetRevenue",
        premise: "Com estratégia vs grupo controle (~+4% orgânico)",
        columns: [
          M.spendBefore,
          M.spendAfter,
          {
            name: "controle (+4%)",
            detail:
              "Lift orgânico fixo de 4% na demo (não amostrado). Representa o que a base cresceria sem campanha.",
          },
          {
            name: "liftVsControl",
            detail:
              "(observedLift − 0,04) × 100, em pontos percentuais. observedLift = (gmvAfter − gmvBefore) / gmvBefore.",
          },
          {
            name: "incrementalNetRevenue",
            detail:
              "Σ (marginAfter − marginBefore) na base. Margem líquida incremental atribuída à estratégia.",
          },
        ],
      },
    },
    {
      label: "Mix de verba",
      value: `${Math.round((mix.cupom / mixTotal) * 100)}% cupom`,
      delta: `${Math.round((mix.giftback / mixTotal) * 100)}% GB · ${Math.round((mix.prato_gratis / mixTotal) * 100)}% prato · ${Math.round((mix.nenhum / mixTotal) * 100)}% sem incentivo`,
      deltaPositive: null,
      info: {
        measures: "Como o otimizador distribuiu tipos de benefício.",
        formula: "count(benefitType) / N personas",
        variables: "benefitType · cluster · price_sensitivity · couponRate",
        premise: "Mix escolhido por ROI (não R$ alocado)",
        columns: [
          M.benefitType,
          M.cluster,
          M.priceSensitivity,
          M.couponRate,
          {
            name: "% por tipo",
            detail:
              "count(benefitType === X) / N × 100 para cupom, giftback, prato e sem incentivo.",
          },
        ],
      },
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="font-title text-lg font-extrabold text-ink">
        Números-chave
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <article
            key={c.label}
            className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                {c.label}
              </p>
              <MetricInfoTip label={c.label} content={c.info} />
            </div>
            <p className="font-title mt-2 text-2xl font-extrabold text-ink">
              {c.value}
            </p>
            {c.delta != null && (
              <p
                className={`mt-1 text-xs font-extrabold ${
                  c.deltaPositive === true
                    ? "text-[var(--ifdl-color-success)]"
                    : c.deltaPositive === false
                      ? "text-ifood"
                      : "text-muted"
                }`}
              >
                {c.deltaPositive === true
                  ? `▲ ${c.delta}`
                  : c.deltaPositive === false
                    ? `▼ ${c.delta}`
                    : c.delta}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
