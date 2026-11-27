"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";

export function SeasonalityCharts() {
  const { dash } = useAnalyticsDashboard();
  if (!dash) return null;

  const series = dash.seasonality.filter((_, i) => i % 2 === 0);
  const retention = dash.retention.map((r) => ({
    ...r,
    cupom: Number((r.cupom * 100).toFixed(1)),
    giftback: Number((r.giftback * 100).toFixed(1)),
    controle: Number((r.controle * 100).toFixed(1)),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="if-card p-4 sm:p-5">
        <h2 className="font-title text-lg font-extrabold">
          Quando as pessoas saem para comer
        </h2>
        <p className="mt-1 text-xs text-muted">
          Linha vermelha = movimento observado · azul = tendência · amarela =
          efeito do dia da semana (fim de semana sobe, segunda cai).
        </p>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                name="Movimento"
                stroke="#ea1d2c"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="trend"
                name="Tendência"
                stroke="#3f8efc"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="seasonal"
                name="Dia da semana"
                stroke="#f5a623"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="if-card p-4 sm:p-5">
        <h2 className="font-title text-lg font-extrabold">
          Quem continua voltando
        </h2>
        <p className="mt-1 text-xs text-muted">
          % ainda ativos após 7, 30 e 60 dias — cupom vs giftback vs quem não
          recebeu incentivo.
        </p>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={retention}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} unit="d" />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="cupom"
                name="Cupom"
                stroke="#ea1d2c"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="giftback"
                name="Giftback"
                stroke="#50a773"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="controle"
                name="Sem incentivo"
                stroke="#a3a3a3"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
