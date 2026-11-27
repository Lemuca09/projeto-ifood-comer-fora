import type { ClusterId } from "@/domain/analytics/pcaKmeans";
import type { FavoriteDish } from "@/domain/analytics/dishes";
import type { SeasonalityContext } from "@/domain/analytics/calendarDemand";
import { currentSeasonalityContext } from "@/domain/analytics/calendarDemand";

export type BenefitType = "cupom" | "giftback" | "prato_gratis" | "nenhum";

export type StrategyOptionId =
  | "nenhum"
  | "cupom_ticket_minimo"
  | "cupom_reativacao"
  | "cupom_low_demand"
  | "giftback_retencao"
  | "giftback_progressivo"
  | "prato_gratis_favorito"
  | "push_organico";

export type ScoredStrategy = {
  id: StrategyOptionId;
  benefitType: BenefitType;
  benefitValueBrl: number;
  giftbackBalanceBrl: number;
  /** Conta mínima no restaurante para liberar o benefício. */
  minTicketBrl: number;
  freeDishName: string | null;
  expectedLift: number;
  expectedIncrementalMargin: number;
  expectedCost: number;
  expectedRoi: number;
  label: string;
  reason: string;
};

export type UserStrategyInput = {
  cluster: ClusterId;
  spendBefore: number;
  avgTicketBrl: number;
  couponRate: number;
  /** 0 = VIP orgânico … 1 = muito sensível a preço */
  priceSensitivity?: number;
  recencyDays: number;
  frequency: number;
  monetary: number;
  churnRisk: number;
  sentiment: "positivo" | "neutro" | "negativo";
  frictionReason: "preco" | "demora" | "qualidade" | "nenhum";
  restaurantIdlePct?: number;
  favoriteDishes?: FavoriteDish[];
  partySizeMode?: "1" | "2" | "4+";
  comerForaVisits90d?: number;
  avgMarginPct?: number;
  /** Sazonalidade (feriado, salário, weekday) — define timing e intensidade. */
  seasonality?: SeasonalityContext;
};

const MARGIN_RATE = 0.16;
/** Cupom não pode passar desta fração do ticket mínimo (ex.: R$30 → min R$120). */
const MAX_COUPON_SHARE_OF_TICKET = 0.25;
/** Margem mínima desejada sobre o ticket após o desconto. */
const MIN_NET_MARGIN_AFTER_COUPON = 0.08;

/**
 * Trava cupom ao gasto: só libera valor alto se o ticket mínimo
 * compensar custo do benefício (desconto ≤ 25% e margem residual ≥ 8%).
 */
export function gateCouponBySpend(
  desiredCouponBrl: number,
  avgTicketBrl: number,
): { couponBrl: number; minTicketBrl: number; capped: boolean } {
  const desired = Math.max(0, Number(desiredCouponBrl.toFixed(2)));
  if (desired < 1) return { couponBrl: 0, minTicketBrl: 0, capped: false };

  // Ticket mínimo para o cupom "caber" com segurança
  const minByShare = desired / MAX_COUPON_SHARE_OF_TICKET;
  const minByMargin = desired / Math.max(MARGIN_RATE - MIN_NET_MARGIN_AFTER_COUPON, 0.05);
  let minTicket = Math.ceil(Math.max(minByShare, minByMargin, desired * 3.2));

  // Se o ticket médio da pessoa é bem menor, reduz o cupom até o que o gasto habitual aguenta
  const maxAffordable = Math.floor(avgTicketBrl * MAX_COUPON_SHARE_OF_TICKET);
  let coupon = desired;
  let capped = false;

  if (avgTicketBrl > 0 && minTicket > avgTicketBrl * 1.35 && maxAffordable >= 8) {
    // Oferece cupom menor alinhado ao gasto típico (ainda com trava)
    coupon = Math.min(desired, maxAffordable);
    minTicket = Math.ceil(Math.max(coupon / MAX_COUPON_SHARE_OF_TICKET, coupon * 3.2));
    capped = coupon < desired - 0.5;
  }

  // Cupom alto (ex. 30) só permanece se o min ticket compensar de verdade
  if (coupon >= 28 && minTicket < coupon / MAX_COUPON_SHARE_OF_TICKET) {
    minTicket = Math.ceil(coupon / MAX_COUPON_SHARE_OF_TICKET);
  }

  return {
    couponBrl: Number(coupon.toFixed(2)),
    minTicketBrl: Number(minTicket.toFixed(2)),
    capped,
  };
}

function roi(incrMargin: number, cost: number): number {
  if (cost < 1) return incrMargin > 0 ? 0.35 : 0;
  return (incrMargin - cost) / Math.max(cost, 1);
}

function scoreOption(params: {
  id: StrategyOptionId;
  benefitType: BenefitType;
  value: number;
  lift: number;
  spendBefore: number;
  cannibalization: number;
  label: string;
  reason: string;
  giftbackBalanceBrl?: number;
  minTicketBrl?: number;
  freeDishName?: string | null;
  /** Margem média do perfil (feature store); fallback 16%. */
  marginRate?: number;
}): ScoredStrategy {
  const marginRate = Math.min(
    0.45,
    Math.max(0.05, params.marginRate ?? MARGIN_RATE),
  );
  const costFactor =
    params.benefitType === "nenhum"
      ? 0
      : params.benefitType === "prato_gratis"
        ? 0.75
        : 0.65;
  const grossLiftMargin = params.spendBefore * params.lift * marginRate;
  const cost = params.value * costFactor;
  const incr = grossLiftMargin * (1 - params.cannibalization) - cost * 0.35;
  return {
    id: params.id,
    benefitType: params.benefitType,
    benefitValueBrl: Number(params.value.toFixed(2)),
    giftbackBalanceBrl: Number((params.giftbackBalanceBrl ?? 0).toFixed(2)),
    minTicketBrl: Number((params.minTicketBrl ?? 0).toFixed(2)),
    freeDishName: params.freeDishName ?? null,
    expectedLift: Number(params.lift.toFixed(3)),
    expectedIncrementalMargin: Number(incr.toFixed(2)),
    expectedCost: Number(cost.toFixed(2)),
    expectedRoi: Number(roi(incr, cost).toFixed(2)),
    label: params.label,
    reason: params.reason,
  };
}

function efficiencyScore(
  s: ScoredStrategy,
  preferred?: StrategyOptionId,
  exploreNoise = 0,
  priceSensitivity = 0.5,
): number {
  let score = s.expectedIncrementalMargin * 4;
  if (s.benefitType === "cupom") {
    // Sensíveis a preço privilegiam cupom; VIP (baixa sensibilidade) penaliza
    score += Math.min(s.expectedRoi, 3) * 5 + 2 + priceSensitivity * 10;
    score -= (1 - priceSensitivity) * 8;
  } else if (s.benefitType === "giftback" || s.benefitType === "prato_gratis") {
    score += Math.min(s.expectedRoi, 3) * 7 + 4 + (1 - priceSensitivity) * 9;
    score -= priceSensitivity * 4;
  } else {
    score += Math.min(s.expectedRoi, 0.5) * 2 + (1 - priceSensitivity) * 3;
  }
  if (preferred && s.id === preferred) score += 7;
  score += exploreNoise;
  return score;
}

function withSeasonalityReason(reason: string, seasonality: SeasonalityContext): string {
  return `${reason} · Sazonalidade: ${seasonality.summary} (intensidade ×${seasonality.benefitIntensityMult}).`;
}

export function pickEfficientUserStrategy(
  input: UserStrategyInput,
  rnd: () => number,
): ScoredStrategy {
  const seasonality = input.seasonality ?? currentSeasonalityContext();
  const intensity = seasonality.benefitIntensityMult;
  const idle = input.restaurantIdlePct ?? 0.35;
  const avgTicket = Math.max(input.avgTicketBrl, 25);
  const marginRate = Math.min(
    0.45,
    Math.max(0.05, (input.avgMarginPct ?? 16) / 100),
  );
  const partyBoost = input.partySizeMode === "4+" ? 0.06 : input.partySizeMode === "2" ? 0.02 : 0;
  const newToCf = (input.comerForaVisits90d ?? 1) === 0;
  const so = (
    p: Omit<Parameters<typeof scoreOption>[0], "marginRate"> & {
      marginRate?: number;
    },
  ) => scoreOption({ ...p, marginRate: p.marginRate ?? marginRate });
  const options: ScoredStrategy[] = [];

  const organicLiftBoost = seasonality.preferLowDiscount ? 0.05 : 0;
  const paidLiftBoost =
    intensity >= 1.15 ? 0.04 : intensity <= 0.75 ? -0.03 : 0;

  options.push(
    so({
      id: "nenhum",
      benefitType: "nenhum",
      value: 0,
      lift: 0.015 + rnd() * 0.015 + organicLiftBoost,
      spendBefore: input.spendBefore,
      cannibalization: 0,
      label: "Sem benefício (orgânico)",
      reason: "Só vence quando benefício pago não se paga em margem.",
    }),
  );

  options.push(
    so({
      id: "push_organico",
      benefitType: "nenhum",
      value: 0,
      lift:
        0.03 +
        (input.sentiment === "positivo" ? 0.02 : 0) +
        rnd() * 0.015 +
        organicLiftBoost,
      spendBefore: input.spendBefore,
      cannibalization: 0,
      label: "Notificação orgânica (sem desconto)",
      reason: "Lembrete sem custo — útil em VIP estável e baixo churn.",
    }),
  );

  // —— Cupons com trava proporcional ao valor (intensidade sazonal) ——
  const rawTicketCoupon =
    (14 + rnd() * 10 + (input.frictionReason === "preco" ? 5 : 0)) * intensity;
  const gatedTicket = gateCouponBySpend(rawTicketCoupon, avgTicket);
  options.push(
    so({
      id: "cupom_ticket_minimo",
      benefitType: "cupom",
      value: gatedTicket.couponBrl,
      minTicketBrl: gatedTicket.minTicketBrl,
      lift:
        0.11 +
        input.couponRate * 0.12 +
        (input.cluster === "loyal_price_sensitive" ? 0.06 : 0) +
        (input.frictionReason === "preco" ? 0.04 : 0) +
        (newToCf ? 0.05 : 0) +
        paidLiftBoost +
        rnd() * 0.05,
      spendBefore: input.spendBefore,
      cannibalization:
        input.cluster === "vip_organic" ? 0.4 : input.couponRate < 0.12 ? 0.22 : 0.1,
      label: `Cupom de R$ ${gatedTicket.couponBrl.toFixed(0)}`,
      reason: gatedTicket.capped
        ? `Ajustado ao que você costuma gastar (~R$ ${avgTicket.toFixed(0)}). Libera com gastos acima de R$ ${gatedTicket.minTicketBrl.toFixed(0)}.`
        : `Libera com gastos acima de R$ ${gatedTicket.minTicketBrl.toFixed(0)}, para o desconto fazer sentido.`,
    }),
  );

  const rawReativ =
    (22 + rnd() * 14 + (input.churnRisk > 55 ? 8 : 0)) * intensity;
  const gatedReativ = gateCouponBySpend(rawReativ, avgTicket);
  options.push(
    so({
      id: "cupom_reativacao",
      benefitType: "cupom",
      value: gatedReativ.couponBrl,
      minTicketBrl: gatedReativ.minTicketBrl,
      lift:
        0.12 +
        Math.min(input.churnRisk, 100) / 220 +
        (input.recencyDays > 20 ? 0.12 : 0) +
        (input.monetary > 350 ? 0.06 : 0) +
        (input.frictionReason !== "nenhum" ? 0.04 : 0) +
        paidLiftBoost +
        rnd() * 0.04,
      spendBefore: input.spendBefore,
      cannibalization: input.cluster === "vip_organic" ? 0.5 : 0.15,
      label: `Cupom de reativação R$ ${gatedReativ.couponBrl.toFixed(0)}`,
      reason:
        gatedReativ.couponBrl >= 28
          ? `Cupom alto de R$ ${gatedReativ.couponBrl.toFixed(0)}: libera com gastos acima de R$ ${gatedReativ.minTicketBrl.toFixed(0)}.`
          : `Libera com gastos acima de R$ ${gatedReativ.minTicketBrl.toFixed(0)}.`,
    }),
  );

  if (idle > 0.35 || intensity >= 1.15) {
    const gatedLow = gateCouponBySpend(
      (12 + rnd() * 10) * Math.max(intensity, 1),
      avgTicket,
    );
    options.push(
      so({
        id: "cupom_low_demand",
        benefitType: "cupom",
        value: gatedLow.couponBrl,
        minTicketBrl: gatedLow.minTicketBrl,
        lift: 0.11 + idle * 0.18 + paidLiftBoost + rnd() * 0.04,
        spendBefore: input.spendBefore,
        cannibalization: 0.08,
        label: `Cupom no horário fraco R$ ${gatedLow.couponBrl.toFixed(0)}`,
        reason: `Para encher mesa vazia. Libera com gastos acima de R$ ${gatedLow.minTicketBrl.toFixed(0)}.`,
      }),
    );
  }

  // —— Prato grátis do favorito ——
  const topDish = input.favoriteDishes?.[0];
  if (topDish) {
    const dishCost = topDish.typicalPriceBrl;
    const minForDish = Math.ceil(
      Math.max(dishCost * 2.2, avgTicket * 1.05, dishCost / MAX_COUPON_SHARE_OF_TICKET),
    );
    options.push(
      so({
        id: "prato_gratis_favorito",
        benefitType: "prato_gratis",
        value: dishCost,
        minTicketBrl: minForDish,
        freeDishName: topDish.name,
        lift:
          0.15 +
          topDish.purchaseSharePct / 280 +
          (input.cluster === "loyal_price_sensitive" ||
          input.cluster === "new_occasional"
            ? 0.07
            : 0) +
          (input.frictionReason === "preco" ? 0.04 : 0) +
          (newToCf ? 0.06 : 0) +
          rnd() * 0.05,
        spendBefore: input.spendBefore,
        cannibalization: input.cluster === "vip_organic" ? 0.28 : 0.1,
        label: `Prato grátis: ${topDish.name}`,
        reason: `É o que você mais pede (${topDish.purchaseSharePct}% das vezes). Libera com gastos acima de R$ ${minForDish}.`,
      }),
    );
  }

  // Giftback: na janela de salário acompanha a intensidade; em feriado lotado fica leve
  const gbSeason = seasonality.isPaydayWindow
    ? intensity
    : seasonality.preferLowDiscount
      ? 1.05
      : intensity;
  const gbRet = (12 + rnd() * 8) * Math.min(gbSeason, 1.25);
  options.push(
    so({
      id: "giftback_retencao",
      benefitType: "giftback",
      value: gbRet,
      giftbackBalanceBrl: gbRet,
      minTicketBrl: Math.ceil(gbRet * 2),
      lift:
        0.1 +
        (input.cluster === "vip_organic" ? 0.08 : 0.04) +
        (input.frequency > 3 ? 0.05 : 0) +
        (seasonality.preferLowDiscount ? 0.03 : 0) +
        rnd() * 0.04,
      spendBefore: input.spendBefore,
      cannibalization: 0.04,
      label: "Giftback de retenção",
      reason: "Crédito pós-visita — forte em VIP sem canibalizar preço cheio.",
    }),
  );

  const gbProg =
    (10 + rnd() * 10 + (input.partySizeMode === "4+" ? 6 : 0)) *
    Math.min(gbSeason, 1.25);
  options.push(
    so({
      id: "giftback_progressivo",
      benefitType: "giftback",
      value: gbProg,
      giftbackBalanceBrl: gbProg * (0.4 + rnd() * 0.45),
      minTicketBrl: Math.ceil(gbProg * 2),
      lift:
        0.12 +
        (input.frequency < 3 ? 0.11 : 0.04) +
        (input.cluster === "new_occasional" ? 0.08 : 0) +
        partyBoost +
        (newToCf ? 0.05 : 0) +
        rnd() * 0.05,
      spendBefore: input.spendBefore,
      cannibalization: 0.06,
      label: "Giftback progressivo",
      reason:
        input.partySizeMode === "4+"
          ? "Escala com mesa 4+ — split e recorrência de grupo."
          : "Constrói 2ª/3ª visita em novos e ocasionais.",
    }),
  );

  const clusterBias: Partial<Record<ClusterId, StrategyOptionId>> = {
    vip_organic: "giftback_retencao",
    loyal_price_sensitive: "cupom_ticket_minimo",
    churn_risk: "cupom_reativacao",
    new_occasional: "prato_gratis_favorito",
  };
  const preferred =
    newToCf && (input.priceSensitivity ?? 0.5) > 0.55
      ? "cupom_ticket_minimo"
      : input.partySizeMode === "4+"
        ? "giftback_progressivo"
        : clusterBias[input.cluster];
  const sens = input.priceSensitivity ?? 0.5;

  const paid = options.filter((o) => o.benefitType !== "nenhum");
  const unpaid = options.filter((o) => o.benefitType === "nenhum");

  // Feriado lotado → orgânico/giftback; janela de salário → peso em benefício pago
  const seasonalExplore = seasonality.preferLowDiscount
    ? 8
    : seasonality.isPaydayWindow
      ? 0
      : 0;
  const paydayPaidBoost = seasonality.isPaydayWindow ? 10 : 0;

  // Ruído de exploração por seed → o mix muda ao clicar em Regerar
  const bestPaid = paid
    .map((p) => ({
      p,
      s:
        efficiencyScore(p, preferred, (rnd() - 0.5) * 14, sens) +
        (seasonality.preferLowDiscount && p.benefitType === "giftback"
          ? seasonalExplore
          : 0) -
        (seasonality.preferLowDiscount && p.benefitType === "cupom" ? 6 : 0) +
        (seasonality.isPaydayWindow && p.benefitType !== "nenhum"
          ? paydayPaidBoost
          : 0),
    }))
    .sort((a, b) => b.s - a.s)[0]?.p;
  const bestUnpaid = unpaid
    .map((p) => ({
      p,
      s:
        efficiencyScore(p, preferred, (rnd() - 0.5) * 6, sens) +
        (seasonality.preferLowDiscount ? seasonalExplore : 0) -
        (seasonality.isPaydayWindow ? 8 : 0),
    }))
    .sort((a, b) => b.s - a.s)[0]?.p;

  const finish = (picked: ScoredStrategy): ScoredStrategy => ({
    ...picked,
    reason: withSeasonalityReason(picked.reason, seasonality),
  });

  const paidIsWeak =
    !bestPaid ||
    !bestUnpaid ||
    bestPaid.expectedIncrementalMargin <
      bestUnpaid.expectedIncrementalMargin * 0.85 ||
    bestPaid.expectedRoi < 0.15 ||
    (seasonality.preferLowDiscount && bestPaid.benefitType === "cupom");

  const allowUnpaid =
    (paidIsWeak || seasonality.preferLowDiscount) &&
    !(input.churnRisk > 55 && !seasonality.preferLowDiscount) &&
    !(input.cluster === "loyal_price_sensitive" && intensity >= 1.2) &&
    !(input.cluster === "churn_risk" && input.monetary > 250 && !seasonality.preferLowDiscount);

  if (allowUnpaid && bestUnpaid && bestUnpaid.expectedIncrementalMargin >= 0) {
    if (
      input.cluster === "vip_organic" &&
      input.churnRisk < 40 &&
      bestPaid &&
      bestPaid.id === "giftback_retencao" &&
      bestPaid.expectedRoi >= 0.25
    ) {
      return finish(bestPaid);
    }
    if (
      input.cluster === "vip_organic" &&
      input.churnRisk < 35 &&
      bestPaid &&
      bestPaid.expectedRoi < 0.4
    ) {
      return finish(bestUnpaid);
    }
    // Pico de calendário: evita cupom agressivo; giftback > orgânico > cupom
    if (seasonality.preferLowDiscount && bestPaid?.benefitType === "cupom") {
      const gb = paid.find((p) => p.benefitType === "giftback");
      if (gb && gb.expectedRoi >= 0.15) return finish(gb);
      return finish(bestUnpaid);
    }
    if (bestPaid && bestPaid.expectedIncrementalMargin < 0) {
      return finish(bestUnpaid);
    }
  }

  if (
    bestPaid &&
    input.cluster === "vip_organic" &&
    (bestPaid.id === "cupom_reativacao" || bestPaid.id === "cupom_ticket_minimo")
  ) {
    const gb = paid.find((p) => p.id === "giftback_retencao");
    if (gb && gb.expectedIncrementalMargin > 0) return finish(gb);
  }

  // Novos: se prato grátis empatar perto do cupom, prefere prato/giftback
  if (bestPaid && input.cluster === "new_occasional" && bestPaid.benefitType === "cupom") {
    const alt = paid.find(
      (p) =>
        p.id === "prato_gratis_favorito" || p.id === "giftback_progressivo",
    );
    if (alt && alt.expectedRoi >= bestPaid.expectedRoi - 0.35) {
      return finish(alt);
    }
  }

  return finish(bestPaid ?? bestUnpaid!);
}

export type RestaurantStrategyInput = {
  neighborhood: string;
  lowDemandDeltaPct: number;
  idlePct: number;
  nearbyClusterMix: Array<{ id: ClusterId; userSharePct: number }>;
  topDishName?: string;
  topDishPriceBrl?: number;
  seasonality?: SeasonalityContext;
};

export function pickEfficientRestaurantStrategy(
  input: RestaurantStrategyInput,
): ScoredStrategy {
  const seasonality = input.seasonality ?? currentSeasonalityContext();
  const intensity = seasonality.benefitIntensityMult;
  const priceShare =
    (input.nearbyClusterMix.find((c) => c.id === "loyal_price_sensitive")
      ?.userSharePct ?? 0) +
    (input.nearbyClusterMix.find((c) => c.id === "churn_risk")?.userSharePct ??
      0);
  const vipShare =
    input.nearbyClusterMix.find((c) => c.id === "vip_organic")?.userSharePct ??
    0;
  const newShare =
    input.nearbyClusterMix.find((c) => c.id === "new_occasional")
      ?.userSharePct ?? 0;

  const gatedLow = gateCouponBySpend(18 * intensity, 85);
  const gatedReativ = gateCouponBySpend(30 * intensity, 110);

  const dishName = input.topDishName ?? "Prato assinatura da casa";
  const dishPrice = input.topDishPriceBrl ?? 45;
  const dishMin = Math.ceil(Math.max(dishPrice * 2.2, dishPrice / MAX_COUPON_SHARE_OF_TICKET));

  const paidLift =
    intensity >= 1.15 ? 0.04 : intensity <= 0.75 ? -0.025 : 0;
  const organicLift = seasonality.preferLowDiscount ? 0.04 : 0;

  const candidates: ScoredStrategy[] = [
    scoreOption({
      id: "cupom_low_demand",
      benefitType: "cupom",
      value: gatedLow.couponBrl,
      minTicketBrl: gatedLow.minTicketBrl,
      lift: 0.12 + input.idlePct * 0.22 + paidLift,
      spendBefore: 10000,
      cannibalization: vipShare > 40 ? 0.28 : 0.1,
      label: `Cupom de R$ ${gatedLow.couponBrl.toFixed(0)} no horário fraco`,
      reason: `Salão ~${(input.idlePct * 100).toFixed(0)}% ocioso. Libera com gastos acima de R$ ${gatedLow.minTicketBrl.toFixed(0)}.`,
    }),
    scoreOption({
      id: "prato_gratis_favorito",
      benefitType: "prato_gratis",
      value: dishPrice,
      minTicketBrl: dishMin,
      freeDishName: dishName,
      lift: 0.11 + newShare / 400 + priceShare / 500 + paidLift * 0.5,
      spendBefore: 10000,
      cannibalization: 0.12,
      label: `Prato grátis: ${dishName}`,
      reason: `Prato mais pedido da região. Libera com gastos acima de R$ ${dishMin}.`,
    }),
    scoreOption({
      id: "giftback_progressivo",
      benefitType: "giftback",
      value: Math.round(14 * (seasonality.preferLowDiscount ? 1.1 : 1)),
      giftbackBalanceBrl: Math.round(14 * (seasonality.preferLowDiscount ? 1.1 : 1)),
      minTicketBrl: 28,
      lift: 0.09 + newShare / 350 + (seasonality.preferLowDiscount ? 0.03 : 0),
      spendBefore: 10000,
      cannibalization: 0.06,
      label: "Giftback para 1ª/2ª visita",
      reason: `Novos/ocasionais ~${newShare.toFixed(0)}%.`,
    }),
    scoreOption({
      id: "push_organico",
      benefitType: "nenhum",
      value: 0,
      lift: 0.035 + vipShare / 600 + organicLift,
      spendBefore: 10000,
      cannibalization: 0,
      label: "Campanha orgânica (sem desconto)",
      reason: `VIP ~${vipShare.toFixed(0)}%.`,
    }),
    scoreOption({
      id: "cupom_reativacao",
      benefitType: "cupom",
      value: gatedReativ.couponBrl,
      minTicketBrl: gatedReativ.minTicketBrl,
      lift: 0.14 + paidLift,
      spendBefore: 10000,
      cannibalization: 0.18,
      label: `Cupom de reativação R$ ${gatedReativ.couponBrl.toFixed(0)}`,
      reason: `Libera com gastos acima de R$ ${gatedReativ.minTicketBrl.toFixed(0)}.`,
    }),
  ];

  const preferred: StrategyOptionId | undefined = seasonality.preferLowDiscount
    ? vipShare > 30
      ? "push_organico"
      : "giftback_progressivo"
    : seasonality.isPaydayWindow
      ? newShare > 25
        ? "prato_gratis_favorito"
        : "cupom_reativacao"
      : input.idlePct > 0.4 || intensity >= 1.15
        ? "cupom_low_demand"
        : newShare > 28
          ? "prato_gratis_favorito"
          : vipShare > 45
            ? "push_organico"
            : "cupom_reativacao";

  candidates.sort(
    (a, b) => efficiencyScore(b, preferred) - efficiencyScore(a, preferred),
  );

  const best = candidates[0];
  const finish = (picked: ScoredStrategy): ScoredStrategy => ({
    ...picked,
    reason: withSeasonalityReason(picked.reason, seasonality),
  });
  if (best.benefitType === "nenhum") {
    const paidBest = candidates.find((c) => c.benefitType !== "nenhum");
    if (
      paidBest &&
      paidBest.expectedRoi >= 0.2 &&
      !seasonality.preferLowDiscount
    ) {
      return finish(paidBest);
    }
  }
  return finish(best);
}

export const CLUSTER_PLAYBOOK: Record<
  ClusterId,
  { defaultHint: string; avoid: string }
> = {
  vip_organic: {
    defaultHint: "Giftback leve ou orgânico; evitar cupom/prato grátis agressivo",
    avoid: "Cupom alto sem trava de ticket",
  },
  loyal_price_sensitive: {
    defaultHint: "Cupom com trava ou prato grátis do favorito",
    avoid: "Cupom alto sem gasto mínimo que compense",
  },
  churn_risk: {
    defaultHint: "Cupom de reativação com ticket mínimo proporcional",
    avoid: "Liberar R$30 em conta baixa",
  },
  new_occasional: {
    defaultHint: "Prato grátis do item mais pedido ou giftback progressivo",
    avoid: "Benefício alto sem evidência de retorno",
  },
};
