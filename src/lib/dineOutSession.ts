import type { CartLine, DineOutVisit, VisitPhase } from "@/domain/dineOut/types";

const KEY = "cf_dineout_visits_v1";

function readAll(): Record<string, DineOutVisit> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DineOutVisit>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, DineOutVisit>) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getVisit(reservationId: string): DineOutVisit | null {
  return readAll()[reservationId] ?? null;
}

export function upsertVisit(
  partial: Omit<DineOutVisit, "updatedAt"> & { updatedAt?: string },
): DineOutVisit {
  const map = readAll();
  const prev = map[partial.reservationId];
  const next: DineOutVisit = {
    ...prev,
    ...partial,
    lines: partial.lines ?? prev?.lines ?? [],
    benefit:
      partial.benefit !== undefined
        ? partial.benefit
        : (prev?.benefit ?? null),
    checkIns: partial.checkIns ?? prev?.checkIns ?? [],
    split:
      partial.split !== undefined ? partial.split : (prev?.split ?? null),
    updatedAt: new Date().toISOString(),
  };
  map[partial.reservationId] = next;
  writeAll(map);
  return next;
}

export function setVisitPhase(
  reservationId: string,
  phase: VisitPhase,
  extra?: Partial<DineOutVisit>,
): DineOutVisit | null {
  const cur = getVisit(reservationId);
  if (!cur) return null;
  return upsertVisit({ ...cur, ...extra, phase });
}

export function setVisitLines(
  reservationId: string,
  lines: CartLine[],
): DineOutVisit | null {
  const cur = getVisit(reservationId);
  if (!cur) return null;
  return upsertVisit({ ...cur, lines });
}

export function listVisits(): DineOutVisit[] {
  return Object.values(readAll()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
