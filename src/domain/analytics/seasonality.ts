import { mulberry32 } from "@/domain/analytics/math";

export type SeriesPoint = { date: string; value: number; trend: number; seasonal: number };

export type RetentionPoint = { day: number; cupom: number; giftback: number; controle: number };

/** Série sintética 90 dias com tendência + sazonalidade semanal. */
export function buildSeasonalitySeries(seed: number, days = 90): SeriesPoint[] {
  const rnd = mulberry32(seed ^ 0xabc1);
  const out: SeriesPoint[] = [];
  const start = new Date();
  start.setDate(start.getDate() - days);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const weekday = d.getDay(); // 0 domingo
    const seasonal = weekday === 5 || weekday === 6 ? 18 : weekday === 1 ? -8 : 4 * Math.sin((weekday / 7) * Math.PI * 2);
    const trend = 40 + i * 0.35;
    const noise = (rnd() - 0.5) * 10;
    const value = Math.max(5, trend + seasonal + noise);
    out.push({
      date: d.toISOString().slice(0, 10),
      value: Number(value.toFixed(1)),
      trend: Number(trend.toFixed(1)),
      seasonal: Number(seasonal.toFixed(1)),
    });
  }
  return out;
}

export function buildRetentionCurves(seed: number): RetentionPoint[] {
  const rnd = mulberry32(seed ^ 0x5555);
  const days = [0, 7, 14, 30, 45, 60];
  return days.map((day) => {
    const decay = (base: number) =>
      Number(Math.max(0.05, base * Math.exp(-day / (28 + rnd() * 10)) + rnd() * 0.03).toFixed(3));
    return {
      day,
      cupom: decay(1),
      giftback: decay(1.05),
      controle: decay(0.85),
    };
  });
}
