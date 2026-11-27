import { brl } from "@/components/analytics/format";

export type BenefitCopyInput = {
  benefitType: string;
  benefitValueBrl: number;
  minTicketBrl: number;
  freeDishName: string | null;
  strategy?: string;
};

const CUISINE_NATURAL: Record<string, string> = {
  Japonesa: "comida japonesa",
  Brasileira: "comida brasileira",
  Italiana: "comida italiana",
  "Hambúrguer": "hambúrguer",
  Árabe: "comida árabe",
  Vegetariana: "comida vegetariana",
};

/** Primeiro nome limpo (remove prefixo "Persona "). */
export function firstName(displayName: string): string {
  const cleaned = displayName.replace(/^Persona\s+/i, "").trim();
  return cleaned.split(/\s+/)[0] || "oi";
}

export function cuisineNatural(cuisine: string): string {
  return CUISINE_NATURAL[cuisine] ?? cuisine.toLowerCase();
}

/** "19h–20h" → "entre 19h e 20h" */
export function scheduleNatural(preferredHour: string): string {
  const parts = preferredHour.split(/[–-]/).map((s) => s.trim());
  if (parts.length >= 2) return `entre ${parts[0]} e ${parts[1]}`;
  return preferredHour;
}

/** Frases naturais para UI / apresentação. */
export function benefitCopy(b: BenefitCopyInput): {
  title: string;
  detail: string;
  minSpendLine: string | null;
} {
  const minSpendLine =
    b.minTicketBrl > 0
      ? `Libera com gastos acima de ${brl(b.minTicketBrl)}`
      : null;

  if (b.benefitType === "prato_gratis") {
    return {
      title: `Prato grátis: ${b.freeDishName ?? "seu favorito"}`,
      detail: minSpendLine ?? "Válido no Comer Fora, no seu prato preferido",
      minSpendLine,
    };
  }
  if (b.benefitType === "cupom") {
    return {
      title: `Cupom de ${brl(b.benefitValueBrl)}`,
      detail: minSpendLine ?? "Desconto na hora de fechar a conta",
      minSpendLine,
    };
  }
  if (b.benefitType === "giftback") {
    return {
      title: `Giftback de ${brl(b.benefitValueBrl)}`,
      detail: "Volta como crédito na próxima visita ao salão",
      minSpendLine,
    };
  }
  return {
    title: "Sem desconto por agora",
    detail: "Você já pode sair para comer fora normalmente",
    minSpendLine: null,
  };
}

/** Copy de notificação pronta (fallback local ou guia do Claude). */
export function notificationCopy(input: {
  displayName: string;
  cuisine: string;
  preferredHour: string;
  benefitType: string;
  benefitValueBrl: number;
  minTicketBrl: number;
  freeDishName: string | null;
}): string {
  const nome = firstName(input.displayName);
  const comida = cuisineNatural(input.cuisine);
  const horario = scheduleNatural(input.preferredHour);
  const valor = brl(input.benefitValueBrl);

  if (input.benefitType === "cupom") {
    const trava =
      input.minTicketBrl > 0
        ? ` Válido com gastos acima de ${brl(input.minTicketBrl)}.`
        : "";
    return `Notificação: ${nome}, cupom de desconto hoje de ${valor} em ${comida}.${trava} Agende ${horario}!`;
  }
  if (input.benefitType === "giftback") {
    return `Notificação: ${nome}, você ganhou ${valor} de giftback para ${comida}. Use na próxima ida ao salão — que tal agendar ${horario}?`;
  }
  if (input.benefitType === "prato_gratis") {
    const prato = input.freeDishName ?? "seu prato favorito";
    const trava =
      input.minTicketBrl > 0
        ? ` Com gastos acima de ${brl(input.minTicketBrl)}.`
        : "";
    return `Notificação: ${nome}, ${prato} grátis hoje em ${comida}.${trava} Agende ${horario}!`;
  }
  return `Notificação: ${nome}, tem mesa boa de ${comida} te esperando. Agende ${horario} e aproveite o Comer Fora!`;
}
