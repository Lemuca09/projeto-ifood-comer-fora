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
    <section className="if-card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-title text-lg font-extrabold">
          Os 4 tipos de cliente
        </h2>
        <p className="mt-1 text-xs text-muted">
          Compare quantas pessoas há em cada grupo versus quanto faturamento e
          lucro elas geram — dá para ver onde a verba rende mais.
        </p>
      </div>

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
                    · {stats.count} pessoas ({stats.userSharePct}%)
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-muted">{meta.blurb}</p>
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
