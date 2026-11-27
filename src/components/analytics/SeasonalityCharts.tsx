"use client";

import { useEffect } from "react";
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

function toPct(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Number((value * 100).toFixed(1))
    : 0;
}

export function SeasonalityCharts() {
  const { dash, refresh } = useAnalyticsDashboard();

  // Dashboard em memória pode ser anterior ao campo prato_gratis (HMR).
  useEffect(() => {
    if (!dash?.retention?.length) return;
    if (dash.retention.some((r) => typeof r.prato_gratis !== "number")) {
      void refresh(dash.seed);
    }
  }, [dash, refresh]);

  if (!dash) return null;

  const series = dash.seasonality.filter((_, i) => i % 2 === 0);
  const ctx = dash.seasonalityContext;
  const retention = dash.retention.map((r) => ({
    day: r.day,
    cupom: toPct(r.cupom),
    giftback: toPct(r.giftback),
    prato_gratis: toPct(r.prato_gratis),
    controle: toPct(r.controle),
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-if border border-ifood/20 bg-ifood-soft/50 px-4 py-3 text-sm">
        <p className="text-[10px] font-bold uppercase text-ifood">
          Sazonalidade agora · intensidade de benefício ×
          {ctx.benefitIntensityMult}
        </p>
        <p className="mt-1 font-semibold text-ink">{ctx.summary}</p>
        <p className="mt-1 text-xs text-muted">
          {ctx.isPaydayWindow
            ? "Janela salário (dias 5–15): maior poder de compra → mais incentivo aos users."
            : ctx.isTightBudget
              ? "Fora da janela de salário: incentivo mais contido (bolso apertado)."
              : "Calendário sem pico de salário."}
          {ctx.holidayName ? ` · ${ctx.holidayName}` : ""}
          {ctx.preferLowDiscount
            ? " · Feriado de pico: orgânico / giftback vs cupom agressivo."
            : ctx.isPaydayWindow
              ? " · Preferência: cupom / giftback / prato com trava de ticket."
              : " · Preferência: estímulo pago se o salão estiver fraco."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="if-card p-4 sm:p-5">
          <h2 className="font-title text-lg font-extrabold">
            Quando as pessoas saem para comer
          </h2>
          <p className="mt-1 text-xs text-muted">
            1) saídas no período → 2) efeito do weekday → 3) efeito de
            feriado/salário → 4) tendência no que sobra. Verde = calendário
            (Natal, feriados, dias 5–15).
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
                  name="Movimento observado"
                  stroke="#ea1d2c"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  name="Tendência estimada"
                  stroke="#3f8efc"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="seasonal"
                  name="Efeito do dia (weekday)"
                  stroke="#f5a623"
                  dot={false}
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="calendar"
                  name="Feriado / salário"
                  stroke="#50a773"
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
            % ainda ativos após 7, 30 e 60 dias — cupom vs giftback vs prato
            grátis vs quem não recebeu incentivo.
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
                  dataKey="prato_gratis"
                  name="Prato grátis"
                  stroke="#f5a623"
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
    </div>
  );
}
