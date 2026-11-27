import type { CartLine } from "@/domain/dineOut/types";
import { cartTotal } from "@/domain/dineOut/types";

export type SplitMode = "equal" | "by_item" | "custom";

export type SplitGuest = {
  id: string;
  name: string;
  handle: string;
  inviteChannel: "titular" | "link" | "qr";
  invited: boolean;
  paid: boolean;
};

export type SplitShare = {
  guestId: string;
  amountBrl: number;
  itemIds: string[];
};

/** Assentos da mesa - sem nomes inventados ao convidar. */
export function buildTableGuests(partySize: number): Omit<
  SplitGuest,
  "invited" | "paid"
>[] {
  const n = Math.max(1, Math.min(partySize, 8));
  const guests: Omit<SplitGuest, "invited" | "paid">[] = [
    {
      id: "titular",
      name: "Você (titular)",
      handle: "@voce",
      inviteChannel: "titular",
    },
  ];
  for (let i = 2; i <= n; i++) {
    guests.push({
      id: `seat-${i}`,
      name: `Convidado ${i}`,
      handle: `lugar ${i} da mesa`,
      inviteChannel: i % 2 === 0 ? "link" : "qr",
    });
  }
  return guests;
}

/** @deprecated use buildTableGuests - mantido para imports antigos */
export const DEMO_GUESTS = buildTableGuests(6);

export function splitInviteUrl(params: {
  mesa?: string;
  amountBrl: number;
  payers?: number;
  totalBrl?: number;
}): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://comerfora.app";
  const q = new URLSearchParams({
    mesa: params.mesa ?? "mesa",
    valor: params.amountBrl.toFixed(2),
    simulado: "1",
  });
  if (params.payers) q.set("pagantes", String(params.payers));
  if (typeof params.totalBrl === "number") {
    q.set("total", params.totalBrl.toFixed(2));
  }
  return `${origin}/split/convidado?${q.toString()}`;
}

export function expandLines(lines: CartLine[]): Array<{
  key: string;
  itemId: string;
  name: string;
  unitPriceBrl: number;
}> {
  const out: Array<{
    key: string;
    itemId: string;
    name: string;
    unitPriceBrl: number;
  }> = [];
  for (const l of lines) {
    for (let i = 0; i < l.qty; i++) {
      out.push({
        key: `${l.itemId}#${i}`,
        itemId: l.itemId,
        name: l.name,
        unitPriceBrl: l.unitPriceBrl,
      });
    }
  }
  return out;
}

export function splitEqual(
  totalBrl: number,
  guestIds: string[],
): SplitShare[] {
  if (guestIds.length === 0) return [];
  const each = Math.floor((totalBrl * 100) / guestIds.length) / 100;
  let allocated = 0;
  return guestIds.map((id, i) => {
    const amount =
      i === guestIds.length - 1
        ? Number((totalBrl - allocated).toFixed(2))
        : each;
    allocated = Number((allocated + amount).toFixed(2));
    return { guestId: id, amountBrl: amount, itemIds: [] };
  });
}

export function splitByItems(
  lines: CartLine[],
  assignments: Record<string, string>,
  guestIds: string[],
): SplitShare[] {
  const units = expandLines(lines);
  const map = new Map<string, SplitShare>();
  for (const id of guestIds) {
    map.set(id, { guestId: id, amountBrl: 0, itemIds: [] });
  }
  for (const u of units) {
    const gid = assignments[u.key];
    if (!gid || !map.has(gid)) continue;
    const s = map.get(gid)!;
    s.amountBrl = Number((s.amountBrl + u.unitPriceBrl).toFixed(2));
    s.itemIds.push(u.key);
  }
  return [...map.values()];
}

export function splitCustom(
  amounts: Record<string, number>,
  guestIds: string[],
): SplitShare[] {
  return guestIds.map((id) => ({
    guestId: id,
    amountBrl: Number((amounts[id] ?? 0).toFixed(2)),
    itemIds: [],
  }));
}

export function sharesTotal(shares: SplitShare[]): number {
  return Number(shares.reduce((s, x) => s + x.amountBrl, 0).toFixed(2));
}

export function coversTotal(
  shares: SplitShare[],
  billTotal: number,
  tol = 0.05,
): boolean {
  return Math.abs(sharesTotal(shares) - billTotal) <= tol;
}

export function billTotalFromLines(lines: CartLine[]): number {
  return cartTotal(lines);
}
