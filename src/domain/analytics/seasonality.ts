import { mulberry32 } from "@/domain/analytics/math";
import {
  getCalendarFlags,
  getSeasonalityContext,
} from "@/domain/analytics/calendarDemand";

export type SeriesPoint = {
  date: string;
  value: number;
  trend: number;
  /** Efeito do weekday (média − média geral). */
  seasonal: number;
  /** Efeito de feriado / salário estimado após remover weekday. */
  calendar: number;
};

export type RetentionPoint = {
  day: number;
  cupom: number;
  giftback: number;
  prato_gratis: number;
  controle: number;
};

/**
 * 1) Observa saídas no período (inclui feriado + janela salário na geração)
 * 2) Efeito do dia (weekday)
 * 3) Efeito de calendário (feriado/salário) no residual
 * 4) Tendência no movimento sem weekday nem calendário
 */
export function buildSeasonalitySeries(seed: number, days = 90): SeriesPoint[] {
  const rnd = mulberry32(seed ^ 0xabc1);
  const start = new Date();
  start.setDate(start.getDate() - days);

  const dates: string[] = [];
  const weekdays: number[] = [];
  const observed: number[] = [];
  const calendarBoostPlanted: number[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ctx = getSeasonalityContext(d);
    const weekday = d.getDay();
    const weekendBoost = weekday === 5 || weekday === 6 ? 16 : 0;
    const mondayDrag = weekday === 1 ? -10 : 0;
    const softWave = 3 * Math.sin((weekday / 7) * Math.PI * 2);
    const drift = 38 + i * 0.32;
    const noise = (rnd() - 0.5) * 12;
    const value = Math.max(
      5,
      drift +
        weekendBoost +
        mondayDrag +
        softWave +
        ctx.demandBoost +
        noise,
    );

    dates.push(d.toISOString().slice(0, 10));
    weekdays.push(weekday);
    observed.push(value);
    calendarBoostPlanted.push(ctx.demandBoost);
  }

  const n = observed.length;

  // 2) Efeito do dia a partir das contagens
  const sumByDow = Array.from({ length: 7 }, () => 0);
  const countByDow = Array.from({ length: 7 }, () => 0);
  let sumAll = 0;
  for (let i = 0; i < n; i++) {
    sumByDow[weekdays[i]] += observed[i];
    countByDow[weekdays[i]] += 1;
    sumAll += observed[i];
  }
  const grandMean = sumAll / n;
  const effectByDow = sumByDow.map((s, dow) =>
    countByDow[dow] ? s / countByDow[dow] - grandMean : 0,
  );
  const seasonal = weekdays.map((dow) => effectByDow[dow]);

  // 3) Efeito de calendário: residual médio em dias de feriado/salário/folga
  const afterWeekday = observed.map((v, i) => v - seasonal[i]);
  let sumCal = 0;
  let nCal = 0;
  let sumTight = 0;
  let nTight = 0;
  let sumPay = 0;
  let nPay = 0;
  let sumHol = 0;
  let nHol = 0;
  for (let i = 0; i < n; i++) {
    const flags = getCalendarFlags(new Date(`${dates[i]}T12:00:00`));
    const r = afterWeekday[i];
    if (flags.isHoliday || flags.isHolidayEve) {
      sumHol += r;
      nHol += 1;
    } else if (flags.isPaydayWindow) {
      sumPay += r;
      nPay += 1;
    } else if (flags.isTightBudget) {
      sumTight += r;
      nTight += 1;
    } else {
      sumCal += r;
      nCal += 1;
    }
  }
  const meanOther = nCal ? sumCal / nCal : 0;
  const holEffect = nHol ? sumHol / nHol - meanOther : 0;
  const payEffect = nPay ? sumPay / nPay - meanOther : 0;
  const tightEffect = nTight ? sumTight / nTight - meanOther : 0;

  const calendar = dates.map((ds) => {
    const flags = getCalendarFlags(new Date(`${ds}T12:00:00`));
    if (flags.isHoliday || flags.isHolidayEve) return holEffect;
    if (flags.isPaydayWindow) return payEffect;
    if (flags.isTightBudget) return tightEffect;
    return 0;
  });

  // 4) Tendência no dessazonalizado (weekday + calendário)
  const deseasonalized = observed.map(
    (v, i) => v - seasonal[i] - calendar[i],
  );
  let sumT = 0;
  let sumY = 0;
  let sumTT = 0;
  let sumTY = 0;
  for (let t = 0; t < n; t++) {
    sumT += t;
    sumY += deseasonalized[t];
    sumTT += t * t;
    sumTY += t * deseasonalized[t];
  }
  const denom = n * sumTT - sumT * sumT;
  const slope = denom === 0 ? 0 : (n * sumTY - sumT * sumY) / denom;
  const intercept = (sumY - slope * sumT) / n;
  const trend = deseasonalized.map((_, t) => intercept + slope * t);

  return observed.map((value, i) => ({
    date: dates[i],
    value: Number(value.toFixed(1)),
    trend: Number(trend[i].toFixed(1)),
    seasonal: Number(seasonal[i].toFixed(1)),
    calendar: Number(calendar[i].toFixed(1)),
  }));
}

export function buildRetentionCurves(seed: number): RetentionPoint[] {
  const rnd = mulberry32(seed ^ 0x5555);
  const days = [0, 7, 14, 30, 45, 60];
  return days.map((day) => {
    const decay = (base: number) =>
      Number(
        Math.max(
          0.05,
          base * Math.exp(-day / (28 + rnd() * 10)) + rnd() * 0.03,
        ).toFixed(3),
      );
    return {
      day,
      cupom: decay(1),
      giftback: decay(1.05),
      // Prato favorito: retenção forte no curto prazo (experiência memorável).
      prato_gratis: decay(1.04),
      controle: decay(0.85),
    };
  });
}

export {
  currentSeasonalityContext,
  getSeasonalityContext,
} from "@/domain/analytics/calendarDemand";
