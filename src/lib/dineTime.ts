const TZ = "America/Sao_Paulo";

function spParts(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    ...options,
  }).formatToParts(date);
}

function calendarKey(date: Date): string {
  const parts = spParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const d = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${d}`;
}

/** Formata ISO → "20h" / "20h30" em America/Sao_Paulo. */
export function formatSlotLocal(iso: string): string {
  const d = new Date(iso);
  const parts = spParts(d, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
}

/**
 * Rótulo com dia relativo, para não parecer horário passado.
 * Ex.: "hoje às 22h", "amanhã às 19h", "sábado às 19h".
 */
export function formatSlotWhen(iso: string, now = new Date()): string {
  const slot = new Date(iso);
  const clock = formatSlotLocal(iso);
  const today = calendarKey(now);
  const slotDay = calendarKey(slot);
  if (slotDay === today) return `hoje às ${clock}`;

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (slotDay === calendarKey(tomorrow)) return `amanhã às ${clock}`;

  const weekday = spParts(slot, { weekday: "long" }).find(
    (p) => p.type === "weekday",
  )?.value;
  if (weekday) return `${weekday} às ${clock}`;
  return `em breve às ${clock}`;
}

/** 0 = hoje, 1 = amanhã, 2+ = dias à frente (calendário SP). */
export function slotDayOffset(iso: string, now = new Date()): number {
  const today = calendarKey(now);
  const slotDay = calendarKey(new Date(iso));
  if (slotDay === today) return 0;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    if (slotDay === calendarKey(d)) return i;
  }
  return 99;
}

export function nowLocalLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Relógio amigável para o texto: "16h" / "16h01". */
export function nowClockLabel(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
}

/** Mapeia party_size_mode da persona → partySize numérico. */
export function partySizeFromMode(mode: "1" | "2" | "4+" | undefined): number {
  if (mode === "1") return 1;
  if (mode === "4+") return 4;
  return 2;
}
