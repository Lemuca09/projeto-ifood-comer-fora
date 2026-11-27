/**
 * Impacto calculado feature a feature (com vs sem).
 *
 * Recalcula a cada regenerate: seed + personas enriquecidas + sazonalidade.
 * Contrato em docs/METRICAS_IMPACTO_FEATURES.md.
 */
import { mulberry32 } from "@/domain/analytics/math";
import type { SeasonalityContext } from "@/domain/analytics/calendarDemand";
import { currentSeasonalityContext } from "@/domain/analytics/calendarDemand";
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
  /** Campos que mudam ao regenerar (estratégia / cluster). */
  benefitType?: "cupom" | "giftback" | "prato_gratis" | "nenhum";
  benefitValueBrl?: number;
  cluster?: string;
};

export type FeatureImpactId =
  | "pre_order"
  | "digital_tab"
  | "split_bill"
  | "progressive_benefit";

export type FeatureScenarioKpis = {
  visitRate: number;
  expectedVisits: number;
  gmvBrl: number;
  marginBrl: number;
  costBrl: number;
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
    roi: number;
  };
};

export type FeatureImpactReport = {
  seed: number;
  userCount: number;
  generatedAt: string;
  seasonalitySummary: string;
  benefitIntensityMult: number;
  features: FeatureImpactRow[];
  stack: {
    off: FeatureScenarioKpis;
    on: FeatureScenarioKpis;
    deltaMarginBrl: number;
    deltaGmvBrl: number;
    roi: number;
  };
};

type ImpactCtx = {
  rnd: () => number;
  season: SeasonalityContext;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function partyHeadcount(mode: FeatureImpactUser["partySizeMode"]): number {
  if (mode === "1") return 1;
  if (mode === "2") return 2;
  return 4;
}

/** Ruído determinístico por usuário + seed (muda ao regenerar). */
function userNoise(ctx: ImpactCtx, userId: string, key: string): number {
  const salt =
    (userId.charCodeAt(0) || 1) * 17 +
    (userId.charCodeAt(userId.length - 1) || 1) * 31 +
    key.length * 13;
  return ((ctx.rnd() * 1000 + salt) % 1000) / 1000;
}

function baselineVisitProb(u: FeatureImpactUser, ctx: ImpactCtx): number {
  const cf = u.comerForaVisits90d;
  const base = cf >= 4 ? 0.55 : cf >= 2 ? 0.38 : cf === 1 ? 0.22 : 0.1;
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
  // Sazonalidade: janela de salário sobe propensão; feriado lotado também
  const seasonBoost =
    (ctx.season.demandPressure - 1) * 0.08 +
    (userNoise(ctx, u.id, "base") - 0.5) * 0.04;
  return clamp01(
    base - recencyPen - churnPen + npsBoost - frictionPen + seasonBoost,
  );
}

function ticketBrl(u: FeatureImpactUser, ctx: ImpactCtx): number {
  const raw = Math.max(35, u.monetary / Math.max(u.frequency, 1));
  // Salário: ticket efetivo um pouco maior (poder de compra)
  const pay =
    ctx.season.isPaydayWindow
      ? 1.06 + userNoise(ctx, u.id, "ticket") * 0.04
      : ctx.season.isTightBudget
        ? 0.94
        : 1;
  return raw * pay;
}

function marginRate(u: FeatureImpactUser): number {
  return clamp01((u.avgMarginPct || 16) / 100);
}

/** Intensidade de incentivo da estratégia atual × calendário. */
function incentiveAmp(u: FeatureImpactUser, ctx: ImpactCtx): number {
  const fromStrategy =
    u.benefitType === "cupom"
      ? 1.08
      : u.benefitType === "giftback"
        ? 1.05
        : u.benefitType === "prato_gratis"
          ? 1.06
          : 0.97;
  return fromStrategy * ctx.season.benefitIntensityMult;
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

export function buildFeatureImpactReport(
  users: FeatureImpactUser[],
  seed: number,
  seasonality?: SeasonalityContext,
): FeatureImpactReport {
  const season = seasonality ?? currentSeasonalityContext();
  const rnd = mulberry32(seed ^ 0xf1a7);
  const ctx: ImpactCtx = { rnd, season };
  const ampPay = season.isPaydayWindow ? 1.12 : 1;

  function preOrderOff(u: FeatureImpactUser) {
    const p = baselineVisitProb(u, ctx);
    const t = ticketBrl(u, ctx);
    const minsToFirst =
      u.frictionReason === "demora"
        ? 26 + userNoise(ctx, u.id, "preOff") * 4
        : 17 + userNoise(ctx, u.id, "preOff") * 5 + (u.churnRisk > 50 ? 5 : 0);
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
    const lift =
      (0.04 +
        (u.frictionReason === "demora" ? 0.08 : 0) +
        (u.comerForaVisits90d === 0 ? 0.05 : 0) +
        (u.archetype === "speed_seeker" ? 0.06 : 0) +
        userNoise(ctx, u.id, "preLift") * 0.03) *
      ampPay *
      (0.92 + incentiveAmp(u, ctx) * 0.08);
    const p = clamp01(off.p + lift);
    const minsToFirst =
      u.frictionReason === "demora"
        ? 8 + userNoise(ctx, u.id, "preOn") * 2
        : 4.5 + userNoise(ctx, u.id, "preOn") * 2.5;
    const noShowRisk = clamp01(
      0.04 + (10 - (u.lastNpsScore ?? 7)) * 0.008 + userNoise(ctx, u.id, "ns") * 0.02,
    );
    const cost = p * off.ticket * 0.03 * noShowRisk * 8;
    return {
      p,
      ticket: off.ticket,
      margin: off.ticket * marginRate(u),
      cost,
      primary: minsToFirst,
    };
  }

  function digitalTabOff(u: FeatureImpactUser) {
    const p = baselineVisitProb(u, ctx);
    const t = ticketBrl(u, ctx);
    const payInApp = 0.32 + userNoise(ctx, u.id, "payOff") * 0.06;
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
      (0.08 +
        (u.partySizeMode === "4+" ? 0.07 : u.partySizeMode === "2" ? 0.04 : 0.02) +
        (u.comerForaVisits90d >= 2 ? 0.03 : 0) +
        userNoise(ctx, u.id, "addon") * 0.03) *
      ampPay;
    const ticket = off.ticket * (1 + addOnPct);
    const payInApp = clamp01(
      0.7 +
        (u.priceSensitivity < 0.4 ? 0.08 : 0) -
        u.priceSensitivity * 0.05 +
        userNoise(ctx, u.id, "payOn") * 0.05,
    );
    const p = clamp01(off.p + 0.015 + userNoise(ctx, u.id, "tabP") * 0.02);
    const cost = p * ticket * 0.012;
    return {
      p,
      ticket,
      margin: ticket * marginRate(u) * (0.85 + payInApp * 0.15),
      cost,
      primary: payInApp * 100,
    };
  }

  function splitOff(u: FeatureImpactUser) {
    const heads = partyHeadcount(u.partySizeMode);
    const p =
      heads === 1
        ? baselineVisitProb(u, ctx)
        : clamp01(
            baselineVisitProb(u, ctx) * (heads === 2 ? 0.85 : 0.7),
          );
    const t = ticketBrl(u, ctx) * heads;
    const fullyPaid =
      heads === 1
        ? 0.9 + userNoise(ctx, u.id, "splitOff") * 0.04
        : heads === 2
          ? 0.52 + userNoise(ctx, u.id, "splitOff") * 0.06
          : 0.36 + userNoise(ctx, u.id, "splitOff") * 0.05;
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
      (heads === 1 ? 0 : heads === 2 ? 0.07 : 0.14) *
      ampPay *
      (0.9 + userNoise(ctx, u.id, "splitLift") * 0.2);
    const p = clamp01(off.p + groupLift);
    const t = ticketBrl(u, ctx) * heads;
    const fullyPaid =
      heads === 1
        ? 0.93
        : heads === 2
          ? 0.8 + userNoise(ctx, u.id, "splitOn") * 0.04
          : 0.76 + userNoise(ctx, u.id, "splitOn") * 0.04;
    // Custo operacional realista do split (não simbólico) → ROI estável
    const cost = heads > 1 ? p * t * 0.018 + heads * 0.8 : 0;
    return {
      p,
      ticket: t,
      margin: t * marginRate(u) * fullyPaid,
      cost,
      primary: fullyPaid * 100,
    };
  }

  function progressiveOff(u: FeatureImpactUser) {
    const heads = partyHeadcount(u.partySizeMode);
    const p = baselineVisitProb(u, ctx);
    const t = ticketBrl(u, ctx) * heads;
    const checkInComplete =
      heads === 1
        ? 0.88 + userNoise(ctx, u.id, "progOff") * 0.04
        : heads === 2
          ? 0.58 + userNoise(ctx, u.id, "progOff") * 0.06
          : 0.38 + userNoise(ctx, u.id, "progOff") * 0.05;
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
    const baseCoupon =
      (12 + u.priceSensitivity * 18 + (u.benefitValueBrl ?? 0) * 0.15) *
      season.benefitIntensityMult;
    const benefit = baseCoupon * mult;
    const minTicket = benefit / 0.25;
    const lift =
      (heads >= 4
        ? 0.12 + u.priceSensitivity * 0.08
        : heads === 2
          ? 0.05 + u.priceSensitivity * 0.04
          : 0.01) *
      ampPay *
      (0.9 + userNoise(ctx, u.id, "progLift") * 0.2);
    const p = clamp01(off.p + lift);
    const checkInComplete = clamp01(
      (heads === 1 ? 0.92 : heads === 2 ? 0.78 : 0.72) +
        Math.min(0.08, need * 0.01) +
        userNoise(ctx, u.id, "progCi") * 0.03,
    );
    const expectedCost = p * checkInComplete * benefit * 0.65;
    const ticket = Math.max(
      ticketBrl(u, ctx) * heads,
      minTicket * checkInComplete,
    );
    return {
      p,
      ticket,
      margin: ticket * marginRate(u) * checkInComplete,
      cost: expectedCost,
      primary: checkInComplete * 100,
    };
  }

  function stackOn(u: FeatureImpactUser) {
    const pre = preOrderOn(u);
    const tab = digitalTabOn(u);
    const split = splitOn(u);
    const prog = progressiveOn(u);
    const p = clamp01(
      baselineVisitProb(u, ctx) +
        (pre.p - preOrderOff(u).p) * 0.85 +
        (tab.p - digitalTabOff(u).p) * 0.5 +
        (split.p - splitOff(u).p) * 0.75 +
        (prog.p - progressiveOff(u).p) * 0.7,
    );
    const ticket =
      ticketBrl(u, ctx) *
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
    const b = baselineVisitProb(u, ctx);
    const t = ticketBrl(u, ctx) * partyHeadcount(u.partySizeMode);
    return {
      p: b,
      ticket: t,
      margin: t * marginRate(u) * 0.7,
      cost: 0,
      primary: 20 + userNoise(ctx, u.id, "stackOff") * 5,
    };
  }

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
    generatedAt: new Date().toISOString(),
    seasonalitySummary: season.summary,
    benefitIntensityMult: season.benefitIntensityMult,
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
