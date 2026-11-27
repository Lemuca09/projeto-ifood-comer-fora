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
import { ChartTitle } from "@/components/analytics/MetricInfoTip";
import { M } from "@/components/analytics/metricInfoHelp";

function toPct(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Number((value * 100).toFixed(1))
    : 0;
}

type Props = {
  /** Qual gráfico renderizar nesta instância */
  focus?: "demand" | "retention" | "all";
};

export function SeasonalityCharts({ focus = "all" }: Props) {
  const { dash, refresh } = useAnalyticsDashboard();

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

  const showDemand = focus === "demand" || focus === "all";
  const showRetention = focus === "retention" || focus === "all";

  return (
    <div className="space-y-4">
      {showDemand && (
        <div className="flex flex-wrap items-center gap-2 rounded-if border border-ifood/15 bg-ifood-soft/40 px-3 py-2 text-[11px] font-semibold text-ink">
          <span className="text-ifood">Agora</span>
          <span className="text-muted">·</span>
          <span>{ctx.summary}</span>
          <span className="text-muted">
            · intensidade ×{ctx.benefitIntensityMult}
          </span>
        </div>
      )}

      <div
        className={
          showDemand && showRetention
            ? "grid gap-4 lg:grid-cols-2"
            : "grid gap-4"
        }
      >
        {showDemand && (
          <section className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)] sm:p-5">
            <ChartTitle
              title="Demanda no calendário"
              info={{
                measures: "Movimento diário de saída para comer fora.",
                formula:
                  "Série = tendência + efeito weekday + efeito feriado/salário + ruído (seed)",
                variables:
                  "value · trend · seasonal · calendar · demandBoost",
                premise: "Comer Fora 2.0 sob calendário (feriados / salário BR)",
                columns: [
                  {
                    name: "Movimento (value)",
                    detail:
                      "Série sintética diária: tendência + weekend/monday + seno weekday + demandBoost de calendário + ruído da seed.",
                  },
                  {
                    name: "Tendência (trend)",
                    detail:
                      "Componente suave após remover efeitos de weekday e calendário da série observada.",
                  },
                  {
                    name: "Weekday (seasonal)",
                    detail:
                      "Efeito do dia da semana: média do DOW − média geral, estimado a partir da série gerada.",
                  },
                  {
                    name: "Feriado / salário (calendar)",
                    detail:
                      "Residual de calendário (demandBoost de getSeasonalityContext: payday, feriado). Não é dado real de Santos.",
                  },
                  M.seed,
                ],
              }}
            />
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
                    stroke="#a3a3a3"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="seasonal"
                    name="Weekday"
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
        )}

        {showRetention && (
          <section className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)] sm:p-5">
            <ChartTitle
              title="Retenção por incentivo"
              info={{
                measures: "% ainda ativos após 7 / 30 / 60 dias.",
                formula:
                  "Curvas sintéticas por tipo de benefício vs controle sem incentivo (decay por seed)",
                variables: "cupom · giftback · prato_gratis · controle · day",
                premise: "Com benefícios vs sem incentivo (controle)",
                columns: [
                  {
                    name: "Dia (eixo X)",
                    detail:
                      "Horizonte sintético de retenção (ex. 7 / 30 / 60). Não é cohort real de app.",
                  },
                  {
                    name: "cupom / giftback / prato",
                    detail:
                      "Curvas de retenção geradas por tipo de benefício (decay + ruído da seed). Representam % ainda ativos.",
                  },
                  {
                    name: "controle",
                    detail:
                      "Curva sem incentivo pago. Baseline sintética para comparar lift de retenção.",
                  },
                  M.benefitType,
                  M.seed,
                ],
              }}
            />
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
        )}
      </div>
    </div>
  );
}
