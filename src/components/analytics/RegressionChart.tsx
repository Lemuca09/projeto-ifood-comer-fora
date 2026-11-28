"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { ChartTitle } from "@/components/analytics/MetricInfoTip";
import { M } from "@/components/analytics/metricInfoHelp";

const FEATURE_LABELS: Record<string, string> = {
  frequencia: "Frequência",
  taxa_cupom: "Cupom",
  recencia_dias: "Recência",
  risco_churn: "Churn",
  beneficio_brl: "Benefício R$",
  sensibilidade_preco: "Preço",
  visitas_comer_fora: "Visitas CF",
  nps: "NPS / reco",
};

export function RegressionChart() {
  const { dash } = useAnalyticsDashboard();
  if (!dash) return null;
  const { regression } = dash;

  const data = regression.featureNames
    .map((name, i) => ({
      name: FEATURE_LABELS[name] ?? name,
      beta: Number(regression.betas[i].toFixed(3)),
      p: regression.pValues[i],
    }))
    .sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));

  return (
    <section className="flex max-h-[420px] flex-col rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)] sm:p-5 xl:max-h-[480px]">
      <ChartTitle
        title="O que puxa o lucro incremental"
        info={{
          measures: `Betas da regressão sobre margem ganha (R² = ${regression.r2}). Barra = peso da feature em puxar (ou pressionar) o lucro incremental.`,
          formula:
            "y = marginAfter − marginBefore; X = features padronizadas; OLS → betas e p-values",
          variables:
            "frequency · couponRate · recencyDays · churnRisk · benefitValueBrl · priceSensitivity · comerForaVisits90d · lastNpsScore",
          premise:
            "Antes × depois · verdes sobem margem; vermelhas pressionam. Dados sintéticos da seed.",
          columns: [
            M.frequency,
            M.couponRate,
            M.recencyDays,
            M.churnRisk,
            M.benefitValueBrl,
            M.priceSensitivity,
            M.comerForaVisits90d,
            M.lastNps,
            {
              name: "beta / p-value",
              detail:
                "Coeficiente OLS da feature em y (margem incremental). p-value da significância no modelo sintético da demo.",
            },
          ],
        }}
      />
      <div className="mt-4 min-h-0 flex-1 w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={88}
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <Tooltip
              formatter={(v: number, _n, item) => [
                `impacto ${v} · confiança p≈${(item?.payload as { p: number })?.p}`,
                "efeito",
              ]}
            />
            <Bar dataKey="beta" name="impacto" radius={4}>
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.beta >= 0 ? "#50a773" : "#ea1d2c"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
