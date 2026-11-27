"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { CLUSTER_META, type ClusterId } from "@/domain/analytics/pcaKmeans";
import { ChartTitle } from "@/components/analytics/MetricInfoTip";
import { M } from "@/components/analytics/metricInfoHelp";

export function ClusterParetoChart() {
  const { dash } = useAnalyticsDashboard();
  if (!dash) return null;

  const data = dash.clusters.map((c) => ({
    name: c.label,
    usuarios: c.userSharePct,
    receita: c.revenueSharePct,
    lucro: c.profitSharePct,
  }));

  return (
    <section className="space-y-4 rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)] sm:p-5">
      <ChartTitle
        title="Os 4 tipos de cliente"
        info={{
          measures:
            "Depois da clusterização: quanto cada perfil representa em pessoas, faturamento e lucro.",
          formula:
            "share = soma do cluster / total. Clusters vêm do K-Means (ver gráfico PCA).",
          variables:
            "cluster · spendAfter · marginAfter · count · userSharePct · revenueSharePct · profitSharePct",
          premise:
            "Barras de participação - complementar ao mapa PCA.",
          columns: [
            M.cluster,
            {
              name: "% das pessoas (userSharePct)",
              detail:
                "Participação do cluster na base. count(cluster) / N personas × 100. Contagem após K-Means + mapeamento.",
            },
            {
              name: "% do faturamento (revenueSharePct)",
              detail:
                "Participação no GMV after. Σ spendAfter do cluster / Σ spendAfter total × 100.",
            },
            {
              name: "% do lucro (profitSharePct)",
              detail:
                "Participação na margem after. Σ marginAfter do cluster / Σ marginAfter total × 100.",
            },
            M.spendAfter,
            M.marginAfter,
          ],
        }}
      />

      <ul className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(CLUSTER_META) as ClusterId[]).map((id) => {
          const meta = CLUSTER_META[id];
          const stats = dash.clusters.find((c) => c.id === id);
          return (
            <li
              key={id}
              className="rounded-if bg-page px-3 py-2.5 text-xs"
              style={{ borderLeft: `4px solid ${meta.color}` }}
            >
              <p className="font-extrabold text-ink">
                {meta.label}
                {stats ? (
                  <span className="ml-1 font-semibold text-muted">
                    · {stats.count} ({stats.userSharePct}%)
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Legend />
            <Bar dataKey="usuarios" name="% das pessoas" fill="#a3a3a3" radius={4} />
            <Bar dataKey="receita" name="% do faturamento" fill="#ea1d2c" radius={4} />
            <Bar dataKey="lucro" name="% do lucro" fill="#50a773" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
