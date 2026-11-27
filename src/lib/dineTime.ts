/** Formata ISO → "20h" / "20h30" em America/Sao_Paulo. */
export function formatSlotLocal(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
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

/** Relógio amigável para prosa: "16h" / "16h01". */
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
