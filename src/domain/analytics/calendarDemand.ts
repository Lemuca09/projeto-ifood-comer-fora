/**
 * Calendário de demanda (BR) para sazonalidade e intensidade de benefício.
 * Feriados nacionais fixos + janela de salário (dias 5–15).
 */

export type CalendarFlags = {
  date: string;
  dayOfMonth: number;
  weekday: number;
  isHoliday: boolean;
  holidayName: string | null;
  /** Véspera de Natal / Ano Novo - pico de salão. */
  isHolidayEve: boolean;
  /** Dias 5–15: maior propensão a gastar (salário). */
  isPaydayWindow: boolean;
  /** Final do mês / início - bolso mais apertado. */
  isTightBudget: boolean;
};

/** Demanda e política de benefício derivadas do calendário. */
export type SeasonalityContext = CalendarFlags & {
  /** Empurrão aditivo no índice de movimento (mesma escala da série). */
  demandBoost: number;
  /**
   * Pressão de demanda natural (>1 = já tem movimento; <1 = precisa estimular).
   */
  demandPressure: number;
  /**
   * Multiplicador da intensidade de benefício pago (cupom/prato/giftback).
   * Janela de salário → maior; pico de feriado lotado → menor.
   */
  benefitIntensityMult: number;
  /** Preferir orgânico / giftback leve (ex.: véspera de Natal lotada). */
  preferLowDiscount: boolean;
  summary: string;
};

const FIXED_HOLIDAYS: Array<{ md: string; name: string }> = [
  { md: "01-01", name: "Ano Novo" },
  { md: "04-21", name: "Tiradentes" },
  { md: "05-01", name: "Dia do Trabalho" },
  { md: "09-07", name: "Independência" },
  { md: "10-12", name: "Nossa Senhora Aparecida" },
  { md: "11-02", name: "Finados" },
  { md: "11-15", name: "Proclamação da República" },
  { md: "11-20", name: "Consciência Negra" },
  { md: "12-25", name: "Natal" },
];

/** Feriados móveis aproximados (demo) por ano. */
const MOVABLE: Record<number, Array<{ md: string; name: string }>> = {
  2025: [
    { md: "03-03", name: "Carnaval" },
    { md: "03-04", name: "Carnaval" },
    { md: "04-18", name: "Sexta-feira Santa" },
    { md: "04-20", name: "Páscoa" },
    { md: "06-19", name: "Corpus Christi" },
  ],
  2026: [
    { md: "02-16", name: "Carnaval" },
    { md: "02-17", name: "Carnaval" },
    { md: "04-03", name: "Sexta-feira Santa" },
    { md: "04-05", name: "Páscoa" },
    { md: "06-04", name: "Corpus Christi" },
  ],
  2027: [
    { md: "02-08", name: "Carnaval" },
    { md: "02-09", name: "Carnaval" },
    { md: "03-26", name: "Sexta-feira Santa" },
    { md: "03-28", name: "Páscoa" },
    { md: "05-27", name: "Corpus Christi" },
  ],
};

function padMd(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getCalendarFlags(date: Date): CalendarFlags {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const day = date.getDate();
  const md = padMd(m, day);
  const dateStr = date.toISOString().slice(0, 10);

  const movable = MOVABLE[y] ?? [];
  const hit =
    FIXED_HOLIDAYS.find((h) => h.md === md) ??
    movable.find((h) => h.md === md) ??
    null;

  const isHolidayEve = md === "12-24" || md === "12-31";
  const isPaydayWindow = day >= 5 && day <= 15;
  const isTightBudget = day >= 25 || day <= 4;

  return {
    date: dateStr,
    dayOfMonth: day,
    weekday: date.getDay(),
    isHoliday: !!hit,
    holidayName: hit?.name ?? (isHolidayEve ? (md === "12-24" ? "Véspera de Natal" : "Véspera de Ano Novo") : null),
    isHolidayEve,
    isPaydayWindow,
    isTightBudget,
  };
}

/**
 * Contexto de sazonalidade para decisões de benefício.
 * - Janela de salário (5–15): mais incentivo (maior poder de compra).
 * - Pico de feriado/véspera lotado: benefício mais leve (já tem demanda).
 * - Folga / bolso apertado: estímulo com trava, sem exagerar o valor.
 */
export function getSeasonalityContext(date: Date): SeasonalityContext {
  const flags = getCalendarFlags(date);
  let demandBoost = 0;
  let demandPressure = 1;
  let benefitIntensityMult = 1;
  const bits: string[] = [];

  if (flags.isHolidayEve) {
    demandBoost += 22;
    demandPressure += 0.35;
    benefitIntensityMult *= 0.55;
    bits.push(`${flags.holidayName}: pico de salão - benefício leve / orgânico`);
  } else if (flags.isHoliday) {
    // Finados / Tiradentes: menos saída; Natal/Ano Novo/Carnaval: mais
    const quiet =
      flags.holidayName === "Finados" ||
      flags.holidayName === "Tiradentes";
    if (quiet) {
      demandBoost -= 8;
      demandPressure -= 0.15;
      benefitIntensityMult *= 1.2;
      bits.push(`${flags.holidayName}: demanda fraca - estimular com trava`);
    } else {
      demandBoost += 14;
      demandPressure += 0.22;
      benefitIntensityMult *= 0.7;
      bits.push(`${flags.holidayName}: salão aquecido - não queimar margem`);
    }
  }

  // Salário: capturar poder de compra com mais incentivo (cupom/giftback/prato)
  if (flags.isPaydayWindow) {
    demandBoost += 10;
    demandPressure += 0.18;
    benefitIntensityMult *= 1.35;
    bits.push(
      "Janela salário (dias 5–15): maior poder de compra - intensificar incentivo",
    );
  } else if (flags.isTightBudget) {
    demandBoost -= 7;
    demandPressure -= 0.12;
    benefitIntensityMult *= 0.85;
    bits.push(
      "Fora da janela de salário: incentivo mais contido (bolso apertado)",
    );
  }

  // Segunda fora do salário: horário fraco, leve estímulo
  if (flags.weekday === 1 && !flags.isPaydayWindow) {
    demandBoost -= 4;
    benefitIntensityMult *= 1.1;
    bits.push("Segunda + fora do salário: horário fraco");
  }

  demandPressure = Math.max(0.55, Math.min(1.6, demandPressure));
  benefitIntensityMult = Math.max(0.45, Math.min(1.7, benefitIntensityMult));

  // "Desconto baixo" só em pico de salão lotado - NÃO na janela de salário
  const preferLowDiscount =
    flags.isHolidayEve ||
    (flags.isHoliday &&
      flags.holidayName !== "Finados" &&
      flags.holidayName !== "Tiradentes");

  return {
    ...flags,
    demandBoost: Number(demandBoost.toFixed(1)),
    demandPressure: Number(demandPressure.toFixed(2)),
    benefitIntensityMult: Number(benefitIntensityMult.toFixed(2)),
    preferLowDiscount,
    summary: bits.length
      ? bits.join(" · ")
      : "Calendário neutro - intensidade padrão de benefício",
  };
}

/** Contexto “de hoje” (demo) para decisões do dashboard. */
export function currentSeasonalityContext(): SeasonalityContext {
  return getSeasonalityContext(new Date());
}

/**
 * Ocupação esperada do salão (0–1) alinhada à sazonalidade do case.
 * Segunda quase vazia; sex/sáb/dom cheios; feriado/salário ajustam.
 */
export function expectedOccupancyFraction(date: Date): number {
  const ctx = getSeasonalityContext(date);
  // 0=dom … 6=sáb
  const byDow: Record<number, number> = {
    0: 0.86, // domingo
    1: 0.14, // segunda
    2: 0.28,
    3: 0.36,
    4: 0.44,
    5: 0.78, // sexta
    6: 0.92, // sábado
  };
  let occ = byDow[ctx.weekday] ?? 0.4;
  // demandPressure ~0.55–1.6 → empurra ocupação
  occ *= 0.75 + 0.25 * ctx.demandPressure;
  if (ctx.isHolidayEve) occ = Math.max(occ, 0.94);
  if (ctx.weekday === 1 && !ctx.isPaydayWindow) occ = Math.min(occ, 0.22);
  return Number(Math.max(0.05, Math.min(0.98, occ)).toFixed(3));
}

/** Ociosidade = 1 − ocupação. */
export function expectedIdleFraction(date: Date): number {
  return Number((1 - expectedOccupancyFraction(date)).toFixed(3));
}
