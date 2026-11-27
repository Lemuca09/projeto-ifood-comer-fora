"use client";

import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { ExecutiveInsightsCard } from "@/components/analytics/ExecutiveInsightsCard";
import { KpiGrid } from "@/components/analytics/KpiGrid";
import { ClusterParetoChart } from "@/components/analytics/ClusterParetoChart";
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
        <div className="h-28 animate-pulse rounded-if-lg bg-neutral-200" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-if bg-neutral-100" />
          ))}
        </div>
        <p className="text-center text-sm text-muted">
          Organizando clientes em grupos e calculando o que vale a pena investir…
        </p>
      </div>
    );
  }

  if (error && !dash) {
    return (
      <div className="if-card p-5">
        <p className="text-sm font-semibold text-ifood">{error}</p>
        <p className="mt-2 text-xs text-muted">
          Confirme o seed de personas e as migrations no Supabase.
        </p>
      </div>
    );
  }

  const mix = dash?.strategyMix;
  const mixLine = mix
    ? `${mix.cupom} cupom · ${mix.giftback} giftback · ${mix.prato_gratis} prato grátis · ${mix.nenhum} sem benefício`
    : "";

  return (
    <div className="space-y-6">
      {(regenerating || loading) && (
        <div className="rounded-if border border-ifood/20 bg-ifood-soft px-3 py-2 text-sm font-semibold text-ifood">
          Atualizando números e gráficos com a nova amostra…
        </div>
      )}

      <header className="space-y-2">
        <h1 className="font-title text-2xl font-extrabold text-ink sm:text-3xl">
          O que está gerando lucro de verdade
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          Separamos a base em 4 tipos de cliente, escolhemos o benefício mais
          eficiente para cada um (cupom, giftback, prato grátis ou nenhum) e
          comparamos o resultado{" "}
          <strong className="font-bold text-ink">antes × depois</strong>.
        </p>
        {dash && (
          <p className="text-xs text-muted">
            {dash.users.length} personas · {mixLine}
          </p>
        )}
      </header>

      <ExecutiveInsightsCard />
      <KpiGrid />
      <FeatureImpactPanel />
      <ClusterParetoChart />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
        <RegressionChart />
        <RestaurantCampaignPanel />
      </div>
      <SeasonalityCharts />
      <UsersMetricsTable />
    </div>
  );
}
