import { benefitCopy } from "@/lib/benefitCopy";
import type { AppliedBenefit } from "@/domain/dineOut/types";

/** Multiplicador de cupom/giftback por tamanho da mesa. */
export function partyBenefitMultiplier(partySize: number): number {
  if (partySize <= 1) return 1;
  if (partySize === 2) return 1.15;
  if (partySize === 3) return 1.35;
  if (partySize === 4) return 1.6;
  if (partySize <= 6) return 1.9;
  return 2.25;
}

/** Check-ins para liberar o desconto: todos da mesa (cap demo = 8 assentos). */
export function requiredCheckIns(partySize: number): number {
  return Math.max(1, Math.min(Math.floor(partySize) || 1, 8));
}

export type ProgressivePreview = {
  partySize: number;
  multiplier: number;
  baseValueBrl: number;
  progressiveValueBrl: number;
  minTicketBrl: number;
  requiredCheckIns: number;
  title: string;
  detail: string;
  benefitType: string;
  freeDishName: string | null;
};

/**
 * Cupom/giftback sobe com o grupo; ticket mínimo sobe na mesma proporção
 * (desconto ≤ ~25% do ticket mín.) - sem capar pelo ticket médio individual.
 */
export function progressiveBenefitForParty(params: {
  partySize: number;
  benefitType: string;
  benefitValueBrl: number;
  minTicketBrl: number;
  freeDishName: string | null;
  avgTicketBrl?: number;
}): ProgressivePreview {
  const mult = partyBenefitMultiplier(params.partySize);
  const need = requiredCheckIns(params.partySize);
  const base = Math.max(params.benefitValueBrl, 0);

  if (params.benefitType === "nenhum" || base <= 0) {
    const copy = benefitCopy({
      benefitType: "nenhum",
      benefitValueBrl: 0,
      minTicketBrl: 0,
      freeDishName: null,
    });
    return {
      partySize: params.partySize,
      multiplier: mult,
      baseValueBrl: 0,
      progressiveValueBrl: 0,
      minTicketBrl: 0,
      requiredCheckIns: need,
      title: copy.title,
      detail: `Grupo de ${params.partySize}: benefício progressivo indisponível sem cupom/giftback base.`,
      benefitType: "nenhum",
      freeDishName: null,
    };
  }

  if (params.benefitType === "prato_gratis") {
    // Tipo vem do otimizador; só ajusta trava/check-in ao grupo - sem misturar cupom.
    const dishValue = Math.max(base, 18);
    const minTicket = Math.ceil(
      Math.max(params.minTicketBrl || 80, dishValue * 3.2) *
        (params.partySize >= 4 ? 1.15 : 1),
    );
    const copy = benefitCopy({
      benefitType: "prato_gratis",
      benefitValueBrl: dishValue,
      minTicketBrl: minTicket,
      freeDishName: params.freeDishName,
    });
    return {
      partySize: params.partySize,
      multiplier: 1,
      baseValueBrl: dishValue,
      progressiveValueBrl: dishValue,
      minTicketBrl: minTicket,
      requiredCheckIns: need,
      title: copy.title,
      detail: `${copy.detail} · grupo ${params.partySize} · check-in de todos (${need}) para liberar`,
      benefitType: "prato_gratis",
      freeDishName: params.freeDishName,
    };
  }

  // cupom | giftback: mesmo tipo do otimizador; valor escala com o grupo.
  const progressiveValue = Number((base * mult).toFixed(2));
  const minFromShare = progressiveValue / 0.25;
  const minFromBase = Math.max(params.minTicketBrl || 0, base * 3.2) * mult;
  const minTicket = Number(
    Math.ceil(Math.max(minFromShare, minFromBase, progressiveValue * 3.2)),
  );

  const copy = benefitCopy({
    benefitType: params.benefitType,
    benefitValueBrl: progressiveValue,
    minTicketBrl: minTicket,
    freeDishName: params.freeDishName,
  });
  const kindLabel =
    params.benefitType === "giftback" ? "Giftback" : "Cupom";

  return {
    partySize: params.partySize,
    multiplier: mult,
    baseValueBrl: base,
    progressiveValueBrl: progressiveValue,
    minTicketBrl: minTicket,
    requiredCheckIns: need,
    title: `${copy.title} · grupo ${params.partySize} pessoas`,
    detail: `${kindLabel} ${brlShort(base)} → ${brlShort(progressiveValue)} (${mult.toFixed(2)}×) · ticket mín. ${brlShort(minTicket)} · check-in de todos (${need}).`,
    benefitType: params.benefitType,
    freeDishName: params.freeDishName,
  };
}

function brlShort(n: number): string {
  return `R$ ${n.toFixed(0)}`;
}

export function toAppliedBenefit(
  preview: ProgressivePreview,
  applied: boolean,
): AppliedBenefit {
  return {
    applied,
    benefitType: preview.benefitType,
    benefitValueBrl: preview.progressiveValueBrl,
    minTicketBrl: preview.minTicketBrl,
    freeDishName: preview.freeDishName,
    title: preview.title,
    detail: preview.detail,
    progressive: true,
    baseValueBrl: preview.baseValueBrl,
    multiplier: preview.multiplier,
    requiredCheckIns: preview.requiredCheckIns,
    unlocked: false,
  };
}

export function isBenefitUnlocked(
  benefit: AppliedBenefit | null | undefined,
  checkedInCount: number,
  comandaTotalBrl: number,
  partySize?: number,
): boolean {
  if (!benefit?.applied) return false;
  if (benefit.benefitType === "nenhum") return false;
  // Sempre exige a mesa completa quando o partySize é conhecido
  // (ignora limiar parcial antigo persistido na visita).
  const need =
    partySize != null
      ? requiredCheckIns(partySize)
      : (benefit.requiredCheckIns ?? 1);
  if (checkedInCount < need) return false;
  if (benefit.minTicketBrl > 0 && comandaTotalBrl < benefit.minTicketBrl) {
    return false;
  }
  return true;
}
