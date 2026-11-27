"use client";

import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { ExecutiveInsightsCard } from "@/components/analytics/ExecutiveInsightsCard";
import { KpiGrid } from "@/components/analytics/KpiGrid";
import { ClusterParetoChart } from "@/components/analytics/ClusterParetoChart";
import { ClusterScatterChart } from "@/components/analytics/ClusterScatterChart";
import { RegressionChart } from "@/components/analytics/RegressionChart";
import { SeasonalityCharts } from "@/components/analytics/SeasonalityCharts";
import { RestaurantCampaignPanel } from "@/components/analytics/RestaurantCampaignPanel";
import { UsersMetricsTable } from "@/components/analytics/UsersMetricsTable";
import { FeatureImpactPanel } from "@/components/analytics/FeatureImpactPanel";

export function AnalyticsDashboard() {
  const { loading, regenerating, error, dash } = useAnalyticsDashboard();

  if (loading && !dash) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-if-lg bg-neutral-200" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-if bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !dash) {
    return (
      <div className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-5">
        <p className="text-sm font-semibold text-ifood">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      {(regenerating || loading) && (
        <div className="rounded-if border border-ifood/20 bg-ifood-soft px-3 py-2 text-sm font-semibold text-ifood">
          Atualizando amostra…
        </div>
      )}

      <header>
        <h1 className="font-title text-2xl font-extrabold text-ink sm:text-3xl">
          Métricas
        </h1>
        {dash && (
          <p className="mt-1 text-xs text-muted">
            {dash.users.length} personas · seed {dash.seed}
          </p>
        )}
      </header>

      <ExecutiveInsightsCard />

      <KpiGrid />

      <section className="space-y-4">
        <h2 className="font-title text-sm font-extrabold uppercase tracking-wider text-muted">
          Pilar 1 · Performance financeira & margem
        </h2>
        <div className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
          <RegressionChart />
          <RestaurantCampaignPanel />
        </div>
        <FeatureImpactPanel />
      </section>

      {/* Pilar 2 - Operacional */}
      <section className="space-y-4">
        <h2 className="font-title text-sm font-extrabold uppercase tracking-wider text-muted">
          Pilar 2 · Eficiência operacional & salão
        </h2>
        <SeasonalityCharts focus="demand" />
      </section>

      {/* Pilar 3 - Retenção */}
      <section className="space-y-4">
        <h2 className="font-title text-sm font-extrabold uppercase tracking-wider text-muted">
          Pilar 3 · Retenção, engajamento & conversão
        </h2>
        <div className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
          <ClusterScatterChart />
          <ClusterParetoChart />
        </div>
        <SeasonalityCharts focus="retention" />
        <UsersMetricsTable />
      </section>
    </div>
  );
}
