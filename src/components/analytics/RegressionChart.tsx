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

const FEATURE_LABELS: Record<string, string> = {
  frequencia: "Quantas vezes volta",
  taxa_cupom: "Dependência de cupom",
  recencia_dias: "Dias sem visitar",
  risco_churn: "Risco de parar de voltar",
  beneficio_brl: "Valor do benefício",
  sensibilidade_preco: "Sensibilidade a preço",
  visitas_comer_fora: "Visitas Comer Fora (90d)",
  nps: "NPS recente",
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
    <section className="if-card flex max-h-[420px] flex-col p-4 sm:p-5 xl:max-h-[480px]">
      <h2 className="font-title text-lg font-extrabold">
        O que mais puxa o lucro incremental
      </h2>
      <p className="mt-1 text-xs text-muted">
        Efeito sobre a <strong className="font-semibold text-ink">margem ganha</strong>{" "}
        (depois − antes), não sobre o gasto total. Verdes sobem; vermelhas pressionam.
        (R² = {regression.r2})
      </p>
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
              width={150}
              tick={{ fontSize: 10 }}
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
