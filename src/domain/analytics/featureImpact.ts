/**
 * Impacto calculado feature a feature (com vs sem).
 *
 * Cada feature tem:
 * - baseline OFF: comportamento esperado sem a mecânica
 * - treatment ON: mesmo perfil, com a mecânica
 * - delta = ON − OFF (agregado na base)
 *
 * Não é A/B real de produção: é contrafactual determinístico por persona
 * usando Feature Store + regras de negócio documentadas em docs/METRICAS_IMPACTO_FEATURES.md
 */
import {
  partyBenefitMultiplier,
  requiredCheckIns,
} from "@/domain/dineOut/progressiveBenefit";

/** Subconjunto da persona enriquecida — evita import circular com analyticsEngine. */
export type FeatureImpactUser = {
  id: string;
  archetype: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  churnRisk: number;
  priceSensitivity: number;
  partySizeMode: "1" | "2" | "4+";
  comerForaVisits90d: number;
  frictionReason: "preco" | "demora" | "qualidade" | "nenhum";
  avgMarginPct: number;
  lastNpsScore: number;
};

export type FeatureImpactId =
  | "pre_order"
  | "digital_tab"
  | "split_bill"
  | "progressive_benefit";

export type FeatureScenarioKpis = {
  /** Probabilidade média de ir ao salão (0–1). */
  visitRate: number;
  /** Visitas esperadas na base (= soma das probs). */
  expectedVisits: number;
  /** GMV esperado (R$). */
  gmvBrl: number;
  /** Margem líquida esperada (R$). */
  marginBrl: number;
  /** Custo de benefício / operação da feature (R$). */
  costBrl: number;
  /** KPI específico da feature (unidade no campo unit). */
  primaryMetric: number;
  primaryMetricUnit: string;
  primaryMetricLabel: string;
};

export type FeatureImpactRow = {
  id: FeatureImpactId;
  name: string;
  why: string;
  off: FeatureScenarioKpis;
  on: FeatureScenarioKpis;
  delta: {
    visitRatePp: number;
    expectedVisits: number;
    gmvBrl: number;
    marginBrl: number;
    costBrl: number;
    primaryMetric: number;
    /** (Δmargem − Δcusto) / max(Δcusto, 1) */
    roi: number;
  };
};

export type FeatureImpactReport = {
  seed: number;
  userCount: number;
  features: FeatureImpactRow[];
  /** Empilhamento: só baseline tradicional vs todas as 4 features ON. */
  stack: {
    off: FeatureScenarioKpis;
    on: FeatureScenarioKpis;
    deltaMarginBrl: number;
    deltaGmvBrl: number;
    roi: number;
  };
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function partyHeadcount(mode: FeatureImpactUser["partySizeMode"]): number {
  if (mode === "1") return 1;
  if (mode === "2") return 2;
  return 4;
}

/**
 * Propensity baseline de ir ao salão sem features V2 de jornada.
 * Usa Feature Store: visitas CF, recência, churn, NPS, atrito.
 */
function baselineVisitProb(u: FeatureImpactUser): number {
  const cf = u.comerForaVisits90d;
  const base =
    cf >= 4 ? 0.55 : cf >= 2 ? 0.38 : cf === 1 ? 0.22 : 0.1;
  const recencyPen = Math.min(0.22, u.recencyDays / 180);
  const churnPen = (u.churnRisk / 100) * 0.18;
  const npsBoost = ((u.lastNpsScore ?? 7) - 5) * 0.02;
  const frictionPen =
    u.frictionReason === "demora"
      ? 0.08
      : u.frictionReason === "preco"
        ? 0.06
        : u.frictionReason === "qualidade"
          ? 0.07
          : 0;
  return clamp01(base - recencyPen - churnPen + npsBoost - frictionPen);
}

function ticketBrl(u: FeatureImpactUser): number {
  return Math.max(35, u.monetary / Math.max(u.frequency, 1));
}

function marginRate(u: FeatureImpactUser): number {
  return clamp01((u.avgMarginPct || 16) / 100);
}

function roundKpis(k: FeatureScenarioKpis): FeatureScenarioKpis {
  return {
    visitRate: Number(k.visitRate.toFixed(4)),
    expectedVisits: Number(k.expectedVisits.toFixed(2)),
    gmvBrl: Number(k.gmvBrl.toFixed(2)),
    marginBrl: Number(k.marginBrl.toFixed(2)),
    costBrl: Number(k.costBrl.toFixed(2)),
    primaryMetric: Number(k.primaryMetric.toFixed(2)),
    primaryMetricUnit: k.primaryMetricUnit,
    primaryMetricLabel: k.primaryMetricLabel,
  };
}

function aggregate(
  users: FeatureImpactUser[],
  perUser: (u: FeatureImpactUser) => {
    p: number;
    ticket: number;
    margin: number;
    cost: number;
    primary: number;
  },
  primaryLabel: string,
  primaryUnit: string,
): FeatureScenarioKpis {
  let visits = 0;
  let gmv = 0;
  let margin = 0;
  let cost = 0;
  let primarySum = 0;
  for (const u of users) {
    const r = perUser(u);
    visits += r.p;
    gmv += r.p * r.ticket;
    margin += r.p * r.margin;
    cost += r.cost;
    primarySum += r.primary;
  }
  const n = users.length || 1;
  return roundKpis({
    visitRate: visits / n,
    expectedVisits: visits,
    gmvBrl: gmv,
    marginBrl: margin,
    costBrl: cost,
    primaryMetric: primarySum / n,
    primaryMetricUnit: primaryUnit,
    primaryMetricLabel: primaryLabel,
  });
}

function deltaRow(
  off: FeatureScenarioKpis,
  on: FeatureScenarioKpis,
): FeatureImpactRow["delta"] {
  const dMargin = on.marginBrl - off.marginBrl;
  const dCost = on.costBrl - off.costBrl;
  return {
    visitRatePp: Number(((on.visitRate - off.visitRate) * 100).toFixed(2)),
    expectedVisits: Number((on.expectedVisits - off.expectedVisits).toFixed(2)),
    gmvBrl: Number((on.gmvBrl - off.gmvBrl).toFixed(2)),
    marginBrl: Number(dMargin.toFixed(2)),
    costBrl: Number(dCost.toFixed(2)),
    primaryMetric: Number((on.primaryMetric - off.primaryMetric).toFixed(2)),
    roi: Number(((dMargin - dCost) / Math.max(Math.abs(dCost), 1)).toFixed(2)),
  };
}

/** Pré-pedido: reduz atrito de espera → sobe P(visita) e corta minutos até 1º prato. */
function preOrderOff(u: FeatureImpactUser) {
  const p = baselineVisitProb(u);
  const t = ticketBrl(u);
  // Sem pré-pedido: ~18–28 min até 1º prato (fila pós-sentar)
  const minsToFirst =
    u.frictionReason === "demora" ? 28 : 18 + (u.churnRisk > 50 ? 6 : 0);
  return {
    p,
    ticket: t,
    margin: t * marginRate(u),
    cost: 0,
    primary: minsToFirst,
  };
}

function preOrderOn(u: FeatureImpactUser) {
  const off = preOrderOff(u);
  // Quem sofre com demora / é novo no CF ganha mais lift de conversão
  const lift =
    0.04 +
    (u.frictionReason === "demora" ? 0.08 : 0) +
    (u.comerForaVisits90d === 0 ? 0.05 : 0) +
    (u.archetype === "speed_seeker" ? 0.06 : 0);
  const p = clamp01(off.p + lift);
  // Com pré-pedido + check-in: 4–9 min até 1º prato
  const minsToFirst = u.frictionReason === "demora" ? 9 : 5;
  // Custo: risco residual de preparo antecipado (proxy no-show)
  const noShowRisk = clamp01(0.04 + (10 - (u.lastNpsScore ?? 7)) * 0.008);
  const cost = p * off.ticket * 0.03 * noShowRisk * 8;
  return {
    p,
    ticket: off.ticket,
    margin: off.ticket * marginRate(u),
    cost,
    primary: minsToFirst,
  };
}

/** Comanda digital: sobe ticket via add-ons e % pagamento in-app. */
function digitalTabOff(u: FeatureImpactUser) {
  const p = baselineVisitProb(u);
  const t = ticketBrl(u);
  // Sem comanda: poucos add-ons; pagamento in-app ~35%
  const payInApp = 0.35;
  return {
    p,
    ticket: t,
    margin: t * marginRate(u) * (0.85 + payInApp * 0.15),
    cost: 0,
    primary: payInApp * 100,
  };
}

function digitalTabOn(u: FeatureImpactUser) {
  const off = digitalTabOff(u);
  const addOnPct =
    0.08 +
    (u.partySizeMode === "4+" ? 0.07 : u.partySizeMode === "2" ? 0.04 : 0.02) +
    (u.comerForaVisits90d >= 2 ? 0.03 : 0);
  const ticket = off.ticket * (1 + addOnPct);
  const payInApp = clamp01(
    0.72 + (u.priceSensitivity < 0.4 ? 0.08 : 0) - u.priceSensitivity * 0.05,
  );
  // Custo: fee/processamento simulado ~1.2% do GMV esperado
  const p = clamp01(off.p + 0.02);
  const cost = p * ticket * 0.012;
  return {
    p,
    ticket,
    margin: ticket * marginRate(u) * (0.85 + payInApp * 0.15),
    cost,
    primary: payInApp * 100,
  };
}

/** Split bill: libera mesa em grupo — sobe P(visita) e conclusão de pagamento em party>1. */
function splitOff(u: FeatureImpactUser) {
  const heads = partyHeadcount(u.partySizeMode);
  const p =
    heads === 1
      ? baselineVisitProb(u)
      : clamp01(baselineVisitProb(u) * (heads === 2 ? 0.85 : 0.7));
  const t = ticketBrl(u) * heads;
  // % contas de grupo 100% pagas sem split (atrito alto)
  const fullyPaid = heads === 1 ? 0.92 : heads === 2 ? 0.55 : 0.38;
  return {
    p,
    ticket: t,
    margin: t * marginRate(u) * fullyPaid,
    cost: 0,
    primary: fullyPaid * 100,
  };
}

function splitOn(u: FeatureImpactUser) {
  const heads = partyHeadcount(u.partySizeMode);
  const off = splitOff(u);
  const groupLift =
    heads === 1 ? 0 : heads === 2 ? 0.07 : 0.14;
  const p = clamp01(off.p + groupLift);
  const t = ticketBrl(u) * heads;
  const fullyPaid = heads === 1 ? 0.94 : heads === 2 ? 0.82 : 0.78;
  const cost = heads > 1 ? p * 0.35 : 0; // custo operacional/UX split (simbólico)
  return {
    p,
    ticket: t,
    margin: t * marginRate(u) * fullyPaid,
    cost,
    primary: fullyPaid * 100,
  };
}

/** Benefício progressivo: mesa maior + check-in mínimo; ROI = margem incremental − custo do benefício. */
function progressiveOff(u: FeatureImpactUser) {
  const heads = partyHeadcount(u.partySizeMode);
  const p = baselineVisitProb(u);
  const t = ticketBrl(u) * heads;
  // Sem progressivo: check-in completo do grupo mais baixo
  const checkInComplete =
    heads === 1 ? 0.9 : heads === 2 ? 0.62 : 0.4;
  return {
    p,
    ticket: t,
    margin: t * marginRate(u) * checkInComplete,
    cost: 0,
    primary: checkInComplete * 100,
  };
}

function progressiveOn(u: FeatureImpactUser) {
  const heads = partyHeadcount(u.partySizeMode);
  const off = progressiveOff(u);
  const mult = partyBenefitMultiplier(heads);
  const need = requiredCheckIns(heads);
  const baseCoupon = 12 + u.priceSensitivity * 18;
  const benefit = baseCoupon * (mult - 1 + 1); // valor progressivo
  const minTicket = benefit / 0.25;
  // Lift de mesa: grupos 4+ respondem mais; sensíveis a preço também
  const lift =
    heads >= 4
      ? 0.12 + u.priceSensitivity * 0.08
      : heads === 2
        ? 0.05 + u.priceSensitivity * 0.04
        : 0.01;
  const p = clamp01(off.p + lift);
  // Check-in sobe porque benefício está condicionado a presença
  const checkInComplete = clamp01(
    (heads === 1 ? 0.92 : heads === 2 ? 0.78 : 0.72) +
      Math.min(0.08, need * 0.01),
  );
  // Só paga custo se check-in completo (trava de margem)
  const expectedCost = p * checkInComplete * benefit * 0.65;
  // Ticket efetivo respeita mínimo
  const ticket = Math.max(ticketBrl(u) * heads, minTicket * checkInComplete);
  return {
    p,
    ticket,
    margin: ticket * marginRate(u) * checkInComplete,
    cost: expectedCost,
    primary: checkInComplete * 100,
  };
}

function buildFeature(
  id: FeatureImpactId,
  name: string,
  why: string,
  users: FeatureImpactUser[],
  offFn: (u: FeatureImpactUser) => {
    p: number;
    ticket: number;
    margin: number;
    cost: number;
    primary: number;
  },
  onFn: (u: FeatureImpactUser) => {
    p: number;
    ticket: number;
    margin: number;
    cost: number;
    primary: number;
  },
  primaryLabel: string,
  primaryUnit: string,
): FeatureImpactRow {
  const off = aggregate(users, offFn, primaryLabel, primaryUnit);
  const on = aggregate(users, onFn, primaryLabel, primaryUnit);
  return { id, name, why, off, on, delta: deltaRow(off, on) };
}

/** Combina efeitos de forma subaditiva (evita somar lifts como se fossem independentes). */
function stackOn(u: FeatureImpactUser) {
  const pre = preOrderOn(u);
  const tab = digitalTabOn(u);
  const split = splitOn(u);
  const prog = progressiveOn(u);
  const p = clamp01(
    baselineVisitProb(u) +
      (pre.p - preOrderOff(u).p) * 0.85 +
      (tab.p - digitalTabOff(u).p) * 0.5 +
      (split.p - splitOff(u).p) * 0.75 +
      (prog.p - progressiveOff(u).p) * 0.7,
  );
  const ticket =
    ticketBrl(u) *
    partyHeadcount(u.partySizeMode) *
    (tab.ticket / Math.max(digitalTabOff(u).ticket, 1));
  const cost = pre.cost + tab.cost + split.cost + prog.cost;
  const margin =
    ticket * marginRate(u) * (split.primary / 100) * 0.95 - cost * 0.15;
  return {
    p,
    ticket,
    margin: Math.max(0, margin),
    cost,
    primary: (pre.primary + (100 - tab.primary) + (100 - split.primary)) / 3,
  };
}

function stackOff(u: FeatureImpactUser) {
  const b = baselineVisitProb(u);
  const t = ticketBrl(u) * partyHeadcount(u.partySizeMode);
  return {
    p: b,
    ticket: t,
    margin: t * marginRate(u) * 0.7,
    cost: 0,
    primary: 22,
  };
}

export function buildFeatureImpactReport(
  users: FeatureImpactUser[],
  seed: number,
): FeatureImpactReport {
  const features = [
    buildFeature(
      "pre_order",
      "Pedido antecipado (Pre-order)",
      "Mede se eliminar a fila pós-sentar aumenta ida ao salão e reduz minutos até o 1º prato, sem estourar custo de no-show.",
      users,
      preOrderOff,
      preOrderOn,
      "Minutos até o 1º prato",
      "min",
    ),
    buildFeature(
      "digital_tab",
      "Comanda digital integrada",
      "Mede se consumo + pagamento no app sobe ticket (add-ons) e taxa de quitação in-app.",
      users,
      digitalTabOff,
      digitalTabOn,
      "Pagamento in-app",
      "%",
    ),
    buildFeature(
      "split_bill",
      "Divisão de conta (Split Bill)",
      "Mede se remover atrito de pagar em grupo recupera visitas e % de contas 100% pagas.",
      users,
      splitOff,
      splitOn,
      "Contas 100% pagas",
      "%",
    ),
    buildFeature(
      "progressive_benefit",
      "Benefício progressivo por grupo",
      "Mede se incentivo escalonado por mesa + trava de check-in aumenta presença completa sem destruir margem.",
      users,
      progressiveOff,
      progressiveOn,
      "Check-in completo do grupo",
      "%",
    ),
  ];

  const off = aggregate(users, stackOff, "Índice de atrito (proxy)", "idx");
  const on = aggregate(users, stackOn, "Índice de atrito (proxy)", "idx");
  const dMargin = on.marginBrl - off.marginBrl;
  const dCost = on.costBrl - off.costBrl;

  return {
    seed,
    userCount: users.length,
    features,
    stack: {
      off,
      on,
      deltaMarginBrl: Number(dMargin.toFixed(2)),
      deltaGmvBrl: Number((on.gmvBrl - off.gmvBrl).toFixed(2)),
      roi: Number(((dMargin - dCost) / Math.max(Math.abs(dCost), 1)).toFixed(2)),
    },
  };
}
