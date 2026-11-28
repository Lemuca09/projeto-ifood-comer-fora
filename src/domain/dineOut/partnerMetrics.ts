import { mulberry32 } from "@/domain/analytics/math";

export type PartnerScenario = {
  id: "tradicional" | "comer_fora" | "comer_fora_beneficios";
  label: string;
  occupancyPct: number;
  avgTicketBrl: number;
  avgStayMin: number;
  recurrencePct: number;
  monthlyGmvBrl: number;
  benefitCostBrl: number;
  netMarginBrl: number;
  /** Canibalização estimada vs. ticket cheio (feature store). */
  cannibalizationPct: number;
};

export type PartnerDashboard = {
  restaurantName: string;
  neighborhood: string;
  /** Margem média da base (avg_margin_pct do feature store). */
  avgMarginPct: number;
  /** Soma de lifetime_margin_brl dos clientes do bairro (proxy ROI). */
  lifetimeMarginBrl: number;
  kpis: {
    occupancyPct: number;
    avgTicketBrl: number;
    avgStayMin: number;
    recurrencePct: number;
  };
  series: Array<{ week: string; tradicional: number; comerFora: number; comBeneficios: number }>;
  scenarios: PartnerScenario[];
};

export type PartnerMarginHints = {
  avgMarginPct?: number;
  lifetimeMarginBrl?: number;
  /** Ociosidade 0–1 vinda dos slots / idle_capacity_pct. */
  idlePct?: number;
};

/** KPIs sintéticos determinísticos - prova de valor para adesão do parceiro. */
export function buildPartnerDashboard(
  seed: number,
  restaurantName: string,
  neighborhood: string,
  hints: PartnerMarginHints = {},
): PartnerDashboard {
  const rnd = mulberry32(seed + 91);
  const avgMarginPct = Math.min(
    35,
    Math.max(10, hints.avgMarginPct ?? 18 + rnd() * 6),
  );
  const marginRate = avgMarginPct / 100;
  const lifetimeMarginBrl = Number(
    (hints.lifetimeMarginBrl ?? 12000 + rnd() * 8000).toFixed(0),
  );

  // Ocupação base = 1 − ociosidade observada nos slots (sazonalidade).
  const baseOcc =
    hints.idlePct != null
      ? Math.min(92, Math.max(8, (1 - hints.idlePct) * 100))
      : 42 + rnd() * 12;
  const baseTicket = 68 + rnd() * 28;
  const baseStay = 55 + rnd() * 18;
  const baseRec = 18 + rnd() * 10;

  const cfOcc = baseOcc + 14 + rnd() * 6;
  const cfTicket = baseTicket + 6 + rnd() * 8;
  const cfStay = baseStay - 8 - rnd() * 4; // pré-pedido reduz permanência ociosa
  const cfRec = baseRec + 8 + rnd() * 5;

  const benOcc = cfOcc + 5 + rnd() * 4;
  const benTicket = cfTicket + 9 + rnd() * 7;
  const benStay = cfStay + 2;
  const benRec = cfRec + 7 + rnd() * 4;

  const covers = 420 + Math.floor(rnd() * 80);
  const gmvTrad = covers * baseTicket * (baseOcc / 100);
  const gmvCf = covers * cfTicket * (cfOcc / 100);
  const gmvBen = covers * benTicket * (benOcc / 100);
  const benefitCost = gmvBen * 0.06;
  /** Benefícios com cupom agressivo canibalizam ~8–14% da margem incremental. */
  const cannibalizationPct = Number((8 + rnd() * 6).toFixed(1));

  const scenarios: PartnerScenario[] = [
    {
      id: "tradicional",
      label: "Operação tradicional (sem Comer Fora)",
      occupancyPct: Number(baseOcc.toFixed(1)),
      avgTicketBrl: Number(baseTicket.toFixed(0)),
      avgStayMin: Number(baseStay.toFixed(0)),
      recurrencePct: Number(baseRec.toFixed(1)),
      monthlyGmvBrl: Number(gmvTrad.toFixed(0)),
      benefitCostBrl: 0,
      netMarginBrl: Number((gmvTrad * marginRate).toFixed(0)),
      cannibalizationPct: 0,
    },
    {
      id: "comer_fora",
      label: "Comer Fora (reserva + pré-pedido)",
      occupancyPct: Number(cfOcc.toFixed(1)),
      avgTicketBrl: Number(cfTicket.toFixed(0)),
      avgStayMin: Number(cfStay.toFixed(0)),
      recurrencePct: Number(cfRec.toFixed(1)),
      monthlyGmvBrl: Number(gmvCf.toFixed(0)),
      benefitCostBrl: 0,
      netMarginBrl: Number((gmvCf * (marginRate + 0.02)).toFixed(0)),
      cannibalizationPct: 0,
    },
    {
      id: "comer_fora_beneficios",
      label: "Comer Fora + benefícios ativos",
      occupancyPct: Number(benOcc.toFixed(1)),
      avgTicketBrl: Number(benTicket.toFixed(0)),
      avgStayMin: Number(benStay.toFixed(0)),
      recurrencePct: Number(benRec.toFixed(1)),
      monthlyGmvBrl: Number(gmvBen.toFixed(0)),
      benefitCostBrl: Number(benefitCost.toFixed(0)),
      netMarginBrl: Number(
        (
          gmvBen * (marginRate + 0.01) * (1 - cannibalizationPct / 100) -
          benefitCost
        ).toFixed(0),
      ),
      cannibalizationPct,
    },
  ];

  const series = Array.from({ length: 8 }, (_, i) => ({
    week: `S${i + 1}`,
    tradicional: Number((gmvTrad / 8) * (0.85 + rnd() * 0.3)),
    comerFora: Number((gmvCf / 8) * (0.88 + rnd() * 0.28)),
    comBeneficios: Number((gmvBen / 8) * (0.9 + rnd() * 0.26)),
  }));

  const active = scenarios[2];
  return {
    restaurantName,
    neighborhood,
    avgMarginPct: Number(avgMarginPct.toFixed(1)),
    lifetimeMarginBrl,
    kpis: {
      occupancyPct: active.occupancyPct,
      avgTicketBrl: active.avgTicketBrl,
      avgStayMin: active.avgStayMin,
      recurrencePct: active.recurrencePct,
    },
    series,
    scenarios,
  };
}
