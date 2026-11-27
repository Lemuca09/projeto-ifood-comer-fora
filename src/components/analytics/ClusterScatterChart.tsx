"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { CLUSTER_META, type ClusterId } from "@/domain/analytics/pcaKmeans";
import { ChartTitle } from "@/components/analytics/MetricInfoTip";
import { M } from "@/components/analytics/metricInfoHelp";

const CLUSTER_ORDER = Object.keys(CLUSTER_META) as ClusterId[];

export function ClusterScatterChart() {
  const { dash } = useAnalyticsDashboard();

  const byCluster = useMemo(() => {
    if (!dash) return null;
    const map: Record<ClusterId, { x: number; y: number; name: string }[]> = {
      vip_organic: [],
      loyal_price_sensitive: [],
      churn_risk: [],
      new_occasional: [],
    };
    for (const u of dash.users) {
      map[u.cluster].push({
        x: u.pcaX,
        y: u.pcaY,
        name: u.display_name,
      });
    }
    return map;
  }, [dash]);

  if (!dash || !byCluster) return null;

  return (
    <section className="space-y-4 rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)] sm:p-5">
      <ChartTitle
        title="Clusterização (PCA + K-Means)"
        info={{
          measures:
            "Mapa 2D das personas: cada ponto é um usuário; a cor é o cluster de negócio. PCA e K-Means usam o mesmo vetor de 5 métricas (padronizado).",
          formula:
            "features → standardize → pca2d (plot) + kmeans(k=4) → mapCentroidsToClusters",
          variables:
            "recencyDays · frequency · monetary · couponRate · netMargin",
          premise:
            "As 5 métricas alimentam os dois algoritmos. PCA só projeta em 2D; o K-Means agrupa no espaço 5D padronizado. Determinístico pela seed.",
          columns: [
            M.recencyDays,
            M.frequency,
            M.monetary,
            M.couponRate,
            M.netMargin,
            {
              name: "PCA (PC1 / PC2)",
              detail:
                "Projeção linear das 5 métricas padronizadas nos 2 eixos do gráfico (só visualização).",
            },
            {
              name: "K-Means",
              detail:
                "Agrupa nas mesmas 5 métricas padronizadas (k=4), não no plano PCA. Centróides → VIP, sensível a preço, perdendo interesse, novos/ocasionais.",
            },
            M.seed,
          ],
        }}
      />

      <ul className="flex flex-wrap gap-2">
        {CLUSTER_ORDER.map((id) => (
          <li
            key={id}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ifdl-color-border)] px-2.5 py-1 text-[11px] font-bold text-ink"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: CLUSTER_META[id].color }}
              aria-hidden
            />
            {CLUSTER_META[id].label}
            <span className="font-semibold text-muted">
              {byCluster[id].length}
            </span>
          </li>
        ))}
      </ul>

      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              type="number"
              dataKey="x"
              name="PC1"
              tick={{ fontSize: 10 }}
              label={{
                value: "PC1",
                position: "insideBottom",
                offset: -2,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="PC2"
              tick={{ fontSize: 10 }}
              label={{
                value: "PC2",
                angle: -90,
                position: "insideLeft",
                fontSize: 11,
              }}
            />
            <ZAxis range={[36, 36]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value: number, name: string) => [
                Number(value).toFixed(2),
                name === "x" ? "PC1" : name === "y" ? "PC2" : name,
              ]}
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload as { name?: string } | undefined)
                  ?.name ?? ""
              }
            />
            <Legend />
            {CLUSTER_ORDER.map((id) => (
              <Scatter
                key={id}
                name={CLUSTER_META[id].label}
                data={byCluster[id]}
                fill={CLUSTER_META[id].color}
                fillOpacity={0.75}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        Cada nuvem agrupa personas parecidas em RFM, uso de cupom e margem. O
        gráfico de participação mostra quanto cada grupo pesa em pessoas,
        faturamento e lucro.
      </p>
    </section>
  );
}
