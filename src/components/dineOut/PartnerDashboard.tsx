"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
import { buildPartnerDashboard } from "@/domain/dineOut/partnerMetrics";
import { brl } from "@/components/analytics/format";
import { FeatureImpactPanel } from "@/components/analytics/FeatureImpactPanel";
import {
  MetricInfoTip,
  type MetricInfoContent,
} from "@/components/analytics/MetricInfoTip";

type CompareMode = "beneficios" | "comer_fora";

export function PartnerDashboard() {
  const { dash } = useAnalyticsDashboard();
  const [mode, setMode] = useState<CompareMode>("comer_fora");

  const board = useMemo(() => {
    const seed = dash?.seed ?? 42;
    const r = dash?.restaurants[0];
    const users = dash?.users ?? [];
    const avgMarginPct =
      users.length > 0
        ? users.reduce((s, u) => s + u.avgMarginPct, 0) / users.length
        : undefined;
    const lifetimeMarginBrl =
      users.length > 0
        ? users.reduce((s, u) => s + u.lifetimeMarginBrl, 0)
        : undefined;
    return buildPartnerDashboard(
      seed,
      r?.name ?? "Casa Demo Comer Fora",
      r?.neighborhood ?? "Gonzaga",
      {
        avgMarginPct,
        lifetimeMarginBrl,
        idlePct: r?.idlePct,
      },
    );
  }, [dash]);

  const compareRows =
    mode === "beneficios"
      ? [
          {
            name: "Ocupação",
            off: board.scenarios[1].occupancyPct,
            on: board.scenarios[2].occupancyPct,
          },
          {
            name: "Ticket",
            off: board.scenarios[1].avgTicketBrl,
            on: board.scenarios[2].avgTicketBrl,
          },
          {
            name: "Recorrência",
            off: board.scenarios[1].recurrencePct,
            on: board.scenarios[2].recurrencePct,
          },
          {
            name: "Margem líq.",
            off: board.scenarios[1].netMarginBrl / 100,
            on: board.scenarios[2].netMarginBrl / 100,
          },
        ]
      : [
          {
            name: "Ocupação",
            off: board.scenarios[0].occupancyPct,
            on: board.scenarios[1].occupancyPct,
          },
          {
            name: "Ticket",
            off: board.scenarios[0].avgTicketBrl,
            on: board.scenarios[1].avgTicketBrl,
          },
          {
            name: "Permanência",
            off: board.scenarios[0].avgStayMin,
            on: board.scenarios[1].avgStayMin,
          },
          {
            name: "Recorrência",
            off: board.scenarios[0].recurrencePct,
            on: board.scenarios[1].recurrencePct,
          },
        ];

  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    info: MetricInfoContent;
  }> = [
    {
      label: "Ocupação de mesas",
      value: `${board.kpis.occupancyPct.toFixed(1)}%`,
      hint: "Comer Fora + benefícios",
      info: {
        measures:
          "% de mesas ocupadas no cenário ativo (Comer Fora + benefícios).",
        formula:
          "baseOcc (42–54% seed) + lift CF (~14–20 pp) + lift benefícios (~5–9 pp)",
        variables: "seed · occupancyPct do cenário comer_fora_beneficios",
        premise: "Sintético determinístico (mulberry32) - não é POS real",
        columns: [
          {
            name: "Ocupação",
            detail:
              "Gerada: ocupação base da seed, depois somam lifts do Comer Fora (reserva+pré-pedido) e dos benefícios ativos. O card mostra o cenário com benefícios.",
          },
        ],
      },
    },
    {
      label: "Ticket médio",
      value: brl(board.kpis.avgTicketBrl),
      hint: "Inclui pré-pedido e comanda",
      info: {
        measures: "Gasto médio por cliente no salão (pré-pedido + comanda).",
        formula:
          "baseTicket (68–96 seed) + lift CF (~6–14) + lift benefícios (~9–16)",
        variables: "seed · avgTicketBrl do cenário comer_fora_beneficios",
        premise: "Sintético; sobe com pré-pedido/comanda e incentivo",
        columns: [
          {
            name: "Ticket médio",
            detail:
              "Gerado na seed e aumentado nos cenários CF e +benefícios. Representa o ticket típico com consumo antecipado e na mesa.",
          },
        ],
      },
    },
    {
      label: "Tempo médio de permanência",
      value: `${board.kpis.avgStayMin} min`,
      hint: "Pré-pedido reduz espera ociosa",
      info: {
        measures: "Minutos médios na mesa até liberar para o próximo grupo.",
        formula:
          "baseStay (55–73) − redução CF (~8–12 min) por pré-pedido; benefícios quase não mudam",
        variables: "seed · avgStayMin",
        premise: "Pré-pedido encurta espera ociosa na mesa",
        columns: [
          {
            name: "Permanência",
            detail:
              "Gerada: base alta na operação tradicional; Comer Fora reduz minutos porque o prato começa perto da chegada. Menor permanência ociosa = mais giro.",
          },
        ],
      },
    },
    {
      label: "Taxa de recorrência",
      value: `${board.kpis.recurrencePct.toFixed(1)}%`,
      hint: "Clientes que voltam em 30d",
      info: {
        measures: "% de clientes que voltam ao salão em até 30 dias.",
        formula:
          "baseRec (18–28%) + lift CF (~8–13 pp) + lift benefícios (~7–11 pp)",
        variables: "seed · recurrencePct",
        premise: "Sintético; benefícios e CF aumentam retorno",
        columns: [
          {
            name: "Recorrência 30d",
            detail:
              "Gerada por seed e elevada nos cenários com Comer Fora e com benefícios (giftback/cupom/prato na narrativa do parceiro).",
          },
        ],
      },
    },
    {
      label: "Margem média",
      value: `${board.avgMarginPct.toFixed(1)}%`,
      hint: "avg_margin_pct · feature store",
      info: {
        measures: "Margem % média da base de personas (feature store).",
        formula:
          "Se há dash: média(avg_margin_pct das personas). Senão: 18–24% via seed",
        variables: "avg_margin_pct · seed",
        premise: "Vem da feature store quando a demo já carregou analytics",
        columns: [
          {
            name: "avg_margin_pct",
            detail:
              "Calculada na persona (seed: 12 + (1−price_sensitivity)×10 + ruído). No parceiro: média da base atual, ou fallback sintético se ainda não houver personas.",
          },
        ],
      },
    },
    {
      label: "Margem lifetime (base)",
      value: brl(board.lifetimeMarginBrl),
      hint: "Soma lifetime_margin_brl · ROI real",
      info: {
        measures:
          "Soma da margem lifetime dos clientes da base (proxy de valor do salão).",
        formula:
          "Σ lifetime_margin_brl das personas; fallback seed 12k–20k se vazio",
        variables: "lifetime_margin_brl · ticket · visitas · avg_margin_pct",
        premise: "Valor acumulado da base - não é caixa do mês",
        columns: [
          {
            name: "lifetime_margin_brl",
            detail:
              "Por persona: ticket × max(1, dine-in+CF) × (avg_margin_pct/100). No card: soma da base do analytics (ou valor sintético se a base ainda não carregou).",
          },
        ],
      },
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-if-lg border border-ifood/15 bg-gradient-to-br from-white via-ifood-soft/40 to-white px-5 py-7 shadow-if">
        <p className="text-xs font-bold uppercase tracking-wider text-ifood">
          Métricas de Incentivo ao Parceiro
        </p>
        <h1 className="font-title mt-2 text-3xl font-extrabold text-ink">
          {board.restaurantName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {board.neighborhood} · impacto do Comer Fora na ocupação e na margem.
          Números sintéticos para motivar adesão além dos ~25% do briefing.
        </p>
        <span className="synth-badge mt-3">Dados sintéticos</span>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="if-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {k.label}
              </p>
              <MetricInfoTip label={k.label} content={k.info} />
            </div>
            <p className="font-title mt-2 text-2xl font-extrabold text-ink">
              {k.value}
            </p>
            <p className="mt-1 text-[11px] text-muted">{k.hint}</p>
          </div>
        ))}
      </section>

      <section className="if-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-title text-lg font-extrabold">
              Comparativo de cenários
            </h2>
            <p className="text-xs text-muted">
              Alterne benefícios on/off ou Comer Fora vs. operação tradicional
            </p>
          </div>
          <div className="flex rounded-if border border-[var(--ifdl-color-border)] bg-page p-1">
            <button
              type="button"
              className={`rounded-if px-3 py-1.5 text-xs font-extrabold ${
                mode === "comer_fora"
                  ? "bg-white text-ifood shadow-sm"
                  : "text-muted"
              }`}
              onClick={() => setMode("comer_fora")}
            >
              Comer Fora vs tradicional
            </button>
            <button
              type="button"
              className={`rounded-if px-3 py-1.5 text-xs font-extrabold ${
                mode === "beneficios"
                  ? "bg-white text-ifood shadow-sm"
                  : "text-muted"
              }`}
              onClick={() => setMode("beneficios")}
            >
              Benefícios on vs off
            </button>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="off"
                name={
                  mode === "beneficios"
                    ? "Benefícios off"
                    : "Tradicional"
                }
                fill="#a3a3a3"
                radius={4}
              />
              <Bar
                dataKey="on"
                name={
                  mode === "beneficios"
                    ? "Benefícios on"
                    : "Comer Fora"
                }
                fill="#ea1d2c"
                radius={4}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="if-card relative z-0 space-y-3 overflow-visible p-4 hover:z-40 focus-within:z-40 sm:p-5">
        <div className="flex items-center gap-2">
          <h2 className="font-title text-lg font-extrabold">
            GMV semanal por cenário
          </h2>
          <div className="group relative z-[80] inline-flex">
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--ifdl-color-border)] bg-white text-[11px] font-bold text-muted transition hover:border-ifood hover:text-ifood focus:outline-none focus-visible:ring-2 focus-visible:ring-ifood"
              aria-label="Como o GMV semanal é calculado"
              aria-describedby="gmv-partner-hint"
            >
              i
            </button>
            <div
              id="gmv-partner-hint"
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-[80] mt-2 w-[min(92vw,22rem)] -translate-x-1/2 rounded-if border border-[var(--ifdl-color-border)] bg-white p-3 text-left text-[11px] leading-relaxed text-ink opacity-0 shadow-if transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:left-0 sm:translate-x-0"
            >
              <p className="font-extrabold text-ifood">Como calculamos este GMV</p>
              <p className="mt-1.5 text-muted">
                Números sintéticos para a demo do parceiro.{" "}
                <span className="font-semibold text-ink">
                  Pessoas atendidas
                </span>{" "}
                = clientes no salão no mês. Em cada cenário o GMV mensal é{" "}
                <span className="font-semibold text-ink">
                  pessoas atendidas × ticket médio × (ocupação ÷ 100)
                </span>
                . A série semanal divide esse mensal por 8 e aplica uma variação
                leve por semana (S1–S8).
              </p>
              <ul className="mt-2 space-y-1 text-muted">
                <li>
                  <span className="font-semibold text-ink">Tradicional:</span>{" "}
                  ocupação e ticket da operação sem Comer Fora.
                </li>
                <li>
                  <span className="font-semibold text-ink">Comer Fora:</span>{" "}
                  ocupação e ticket sobem com reserva + pré-pedido.
                </li>
                <li>
                  <span className="font-semibold text-ink">+ benefícios:</span>{" "}
                  mais lift de ocupação/ticket, com custo de benefício e
                  canibalização na margem.
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={board.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="tradicional"
                name="Tradicional"
                stroke="#a3a3a3"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="comerFora"
                name="Comer Fora"
                stroke="#f5a623"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="comBeneficios"
                name="Comer Fora + benefícios"
                stroke="#ea1d2c"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {board.scenarios.map((s) => (
          <div key={s.id} className="if-card space-y-2 p-4">
            <h3 className="font-title text-sm font-extrabold">{s.label}</h3>
            <p className="text-xs text-muted">
              GMV {brl(s.monthlyGmvBrl)} · custo benefício {brl(s.benefitCostBrl)}
            </p>
            <p className="text-sm font-extrabold text-ifood">
              Margem líquida {brl(s.netMarginBrl)}
            </p>
            {s.cannibalizationPct > 0 && (
              <p className="text-[11px] text-muted">
                Canibalização estimada {s.cannibalizationPct}% vs. ticket cheio
              </p>
            )}
          </div>
        ))}
      </section>

      <p className="text-xs text-muted">
        Abaixo: impacto <strong>calculado por feature</strong> na base de personas
        (com vs sem) - diferente do cenário de salão acima. Ver{" "}
        <code className="text-[10px]">docs/METRICAS_IMPACTO_FEATURES.md</code>.
      </p>
      <FeatureImpactPanel />
    </div>
  );
}
