"use client";

import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { brl } from "@/components/analytics/format";
import type { FeatureImpactRow } from "@/domain/analytics/featureImpact";
import {
  ChartTitle,
  MetricInfoTip,
  type MetricInfoContent,
} from "@/components/analytics/MetricInfoTip";
import { M, type MetricCol } from "@/components/analytics/metricInfoHelp";

const FEATURE_COLS: Record<string, MetricCol[]> = {
  pre_order: [
    M.partySize,
    M.preferredHour,
    {
      name: "typical_wait_min / avg_ticket",
      detail:
        "Espera e ticket típicos da persona/restaurante na simulação on/off do pré-pedido (feature store + seed).",
    },
  ],
  digital_tab: [
    M.comerForaVisits90d,
    M.avgMarginPct,
    {
      name: "linhas da comanda",
      detail:
        "Itens/consumo sintéticos da comanda digital na simulação com vs sem a feature.",
    },
  ],
  split_bill: [
    M.partySize,
    {
      name: "user_group_order_ratio / ticket",
      detail:
        "Propensão a pedido em grupo e ticket da mesa na simulação de split (persona + seed).",
    },
  ],
  progressive_benefit: [
    M.benefitType,
    M.benefitValueBrl,
    M.minTicketBrl,
    M.partySize,
    M.priceSensitivity,
  ],
  local_experiences: [
    M.preferredHour,
    {
      name: "preferred_neighborhood / slots / tags",
      detail:
        "Bairro preferido, slots livres do restaurante (Supabase) e tags de ocasião editoriais - não inventam preço.",
    },
  ],
  dine_concierge: [
    M.preferredCuisine,
    M.preferredHour,
    M.benefitType,
    M.partySize,
    {
      name: "restaurant_slots",
      detail:
        "Horários livres do ground truth (Supabase). O concierge só narra candidatos elegíveis.",
    },
  ],
};

const IMPACT_METRIC_COLS: MetricCol[] = [
  {
    name: "Sem / Com (métrica primária)",
    detail:
      "Valor da métrica-chave da feature com a mecânica desligada vs ligada na simulação da base atual.",
  },
  {
    name: "Δ primária / Δ visitas / Δ margem / ROI",
    detail:
      "Diferenças on−off. ROI = (Δmargem − Δcusto) / |Δcusto| na simulação featureImpact.",
  },
];

const FEATURE_ORDER = [
  "pre_order",
  "digital_tab",
  "split_bill",
  "progressive_benefit",
  "local_experiences",
  "dine_concierge",
] as const;

function ImpactCard({
  row,
  premise,
}: {
  row: FeatureImpactRow;
  premise: string;
}) {
  const d = row.delta;
  const primaryBetter =
    row.id === "pre_order" ? d.primaryMetric < 0 : d.primaryMetric > 0;

  return (
    <article className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)]">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-title text-sm font-extrabold text-ink">{row.name}</h3>
        <MetricInfoTip
          label={row.name}
          content={{
            measures: row.why,
            formula: `Δ = on − off · ROI = (Δmargem − Δcusto) / |Δcusto|`,
            variables: "feature store + seed",
            premise,
            columns: [
              ...(FEATURE_COLS[row.id] ?? []),
              ...IMPACT_METRIC_COLS,
            ],
          }}
        />
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-if bg-page p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Sem
          </p>
          <p className="mt-1 font-extrabold text-ink">
            {row.off.primaryMetric.toFixed(1)}
            {row.off.primaryMetricUnit === "%"
              ? "%"
              : ` ${row.off.primaryMetricUnit}`}
          </p>
        </div>
        <div className="rounded-if border border-ifood/20 bg-ifood-soft/40 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ifood">
            Com
          </p>
          <p className="mt-1 font-extrabold text-ink">
            {row.on.primaryMetric.toFixed(1)}
            {row.on.primaryMetricUnit === "%"
              ? "%"
              : ` ${row.on.primaryMetricUnit}`}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--ifdl-color-border)] pt-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-[10px] text-muted">Δ primária</dt>
          <dd
            className={`font-extrabold ${primaryBetter ? "text-ifood" : "text-amber-700"}`}
          >
            {d.primaryMetric > 0 ? "+" : ""}
            {d.primaryMetric.toFixed(1)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted">Δ visitas</dt>
          <dd className="font-extrabold text-ink">
            {d.expectedVisits > 0 ? "+" : ""}
            {d.expectedVisits.toFixed(1)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted">Δ margem</dt>
          <dd className="font-extrabold text-ink">
            {d.marginBrl >= 0 ? "+" : ""}
            {brl(d.marginBrl)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted">ROI</dt>
          <dd className="font-extrabold text-ifood">{d.roi.toFixed(2)}x</dd>
        </div>
      </dl>
    </article>
  );
}

export function FeatureImpactPanel() {
  const { dash } = useAnalyticsDashboard();
  if (!dash?.featureImpact) return null;

  const report = dash.featureImpact;
  const stack = report.stack;
  const premise = "Com vs sem a feature · Comer Fora 2.0";

  const shown = [...report.features].sort((a, b) => {
    const ai = FEATURE_ORDER.indexOf(
      a.id as (typeof FEATURE_ORDER)[number],
    );
    const bi = FEATURE_ORDER.indexOf(
      b.id as (typeof FEATURE_ORDER)[number],
    );
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <section className="space-y-4">
      <ChartTitle
        title="Impacto por feature"
        info={{
          measures: "Efeito com vs sem cada mecânica na base atual.",
          formula: "GMV = Σ P(visita)×ticket · Δ = on − off",
          variables:
            "comer_fora_visits_90d · party_size_mode · price_sensitivity · benefitValueBrl · avg_margin_pct",
          premise,
          columns: [
            M.comerForaVisits90d,
            M.partySize,
            M.priceSensitivity,
            M.benefitValueBrl,
            M.avgMarginPct,
            {
              name: "Δ GMV / margem / ROI",
              detail:
                "Agregados da simulação featureImpact (on−off) por mecânica e no pacote empilhado.",
            },
          ],
        }}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((row) => (
          <ImpactCard key={row.id} row={row} premise={premise} />
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)]">
        <div className="flex items-center gap-2">
          <p className="font-title text-sm font-extrabold">Pacote V2 empilhado</p>
          <MetricInfoTip
            label="Pacote V2"
            content={{
              measures: "Lift conjunto das features (subaditivo).",
              formula: "Stack on − stack off · ROI pacote",
              variables:
                "pre_order · digital_tab · split_bill · progressive_benefit · local_experiences · dine_concierge",
              premise: "Tradicional → pacote completo Comer Fora 2.0",
              columns: [
                {
                  name: "Features do pacote",
                  detail:
                    "Pré-pedido, comanda digital, split, benefício progressivo, Descubra e Concierge - ligadas juntas vs todas off.",
                },
                {
                  name: "Δ GMV / Δ margem / ROI",
                  detail:
                    "Diferença stack on − stack off na simulação. ROI = (Δmargem − Δcusto) / |Δcusto| do pacote.",
                },
              ],
            } satisfies MetricInfoContent}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <div>
            <p className="text-muted">Δ GMV</p>
            <p className="font-extrabold">{brl(stack.deltaGmvBrl)}</p>
          </div>
          <div>
            <p className="text-muted">Δ margem</p>
            <p className="font-extrabold text-ifood">{brl(stack.deltaMarginBrl)}</p>
          </div>
          <div>
            <p className="text-muted">ROI</p>
            <p className="font-extrabold">{stack.roi.toFixed(2)}x</p>
          </div>
        </div>
      </div>
    </section>
  );
}
