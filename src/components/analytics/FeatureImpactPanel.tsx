"use client";

import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { brl } from "@/components/analytics/format";
import type { FeatureImpactRow } from "@/domain/analytics/featureImpact";

function ImpactCard({ row }: { row: FeatureImpactRow }) {
  const d = row.delta;
  const primaryBetter =
    row.id === "pre_order" ? d.primaryMetric < 0 : d.primaryMetric > 0;

  return (
    <article className="if-card flex flex-col gap-3 p-4">
      <header>
        <h3 className="font-title text-sm font-extrabold text-ink">{row.name}</h3>
        <p className="mt-1 text-[11px] leading-snug text-muted">{row.why}</p>
      </header>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-if bg-page p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Sem a feature
          </p>
          <p className="mt-1 font-extrabold text-ink">
            {row.off.primaryMetric.toFixed(1)}
            {row.off.primaryMetricUnit === "%" ? "%" : ` ${row.off.primaryMetricUnit}`}
          </p>
          <p className="text-[10px] text-muted">{row.off.primaryMetricLabel}</p>
          <p className="mt-2 text-[10px] text-muted">
            Visitas {row.off.expectedVisits.toFixed(1)} · Margem {brl(row.off.marginBrl)}
          </p>
        </div>
        <div className="rounded-if border border-ifood/20 bg-ifood-soft/40 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ifood">
            Com a feature
          </p>
          <p className="mt-1 font-extrabold text-ink">
            {row.on.primaryMetric.toFixed(1)}
            {row.on.primaryMetricUnit === "%" ? "%" : ` ${row.on.primaryMetricUnit}`}
          </p>
          <p className="text-[10px] text-muted">{row.on.primaryMetricLabel}</p>
          <p className="mt-2 text-[10px] text-muted">
            Visitas {row.on.expectedVisits.toFixed(1)} · Margem {brl(row.on.marginBrl)}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--ifdl-color-border)] pt-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-[10px] text-muted">Δ primária</dt>
          <dd
            className={`font-extrabold ${primaryBetter ? "text-ifood" : "text-amber-700"}`}
          >
            {d.primaryMetric > 0 ? "+" : ""}
            {d.primaryMetric.toFixed(1)}
            {row.on.primaryMetricUnit === "%" ? " pp" : ` ${row.on.primaryMetricUnit}`}
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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-title text-lg font-extrabold text-ink">
          Impacto calculado por feature
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Comparação <strong className="text-ink">com vs sem</strong> cada
          mecânica na base atual ({report.userCount} personas). Recalcula ao
          regenerar: seed {report.seed} · intensidade sazonal ×
          {report.benefitIntensityMult}. Primária = KPI de produto; margem e ROI
          = negócio.{" "}
          <code className="text-[10px]">docs/METRICAS_IMPACTO_FEATURES.md</code>
        </p>
        <p className="mt-1 text-[11px] font-semibold text-muted">
          {report.seasonalitySummary}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {report.features.map((row) => (
          <ImpactCard key={row.id} row={row} />
        ))}
      </div>

      <div className="if-card flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Pacote V2 empilhado
          </p>
          <p className="font-title mt-1 text-sm font-extrabold">
            Tradicional → todas as 4 features
          </p>
          <p className="mt-1 text-xs text-muted">
            Lifts subaditivos (não soma 4× o mesmo usuário)
          </p>
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
            <p className="text-muted">ROI pacote</p>
            <p className="font-extrabold">{stack.roi.toFixed(2)}x</p>
          </div>
        </div>
      </div>
    </section>
  );
}
