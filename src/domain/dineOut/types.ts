export type MenuItem = {
  id: string;
  name: string;
  priceBrl: number;
  category: "prato" | "bebida" | "sobremesa";
  prepMin: number;
};

export type CartLine = {
  itemId: string;
  name: string;
  unitPriceBrl: number;
  qty: number;
  source: "preorder" | "table";
};

export type VisitPhase =
  | "preorder"
  | "confirmed"
  | "totem_scanned"
  | "kitchen_started"
  | "checked_in"
  | "dining"
  | "paid";

export type AppliedBenefit = {
  applied: boolean;
  benefitType: string;
  benefitValueBrl: number;
  minTicketBrl: number;
  freeDishName: string | null;
  title: string;
  detail: string;
  progressive?: boolean;
  baseValueBrl?: number;
  multiplier?: number;
  requiredCheckIns?: number;
  unlocked?: boolean;
};

export type CheckInRecord = {
  guestId: string;
  guestName: string;
  at: string;
};

export type SplitPaymentState = {
  mode: "equal" | "by_item" | "custom";
  guestIds: string[];
  shares: Array<{ guestId: string; amountBrl: number; paid: boolean }>;
  invitedAt: string | null;
};

export type DineOutVisit = {
  reservationId: string;
  restaurantId: string;
  restaurantName: string;
  neighborhood: string;
  cuisine: string;
  slotStartsAt: string | null;
  partySize: number;
  phase: VisitPhase;
  lines: CartLine[];
  kitchenNotifiedAt: string | null;
  checkedInAt: string | null;
  paidAt: string | null;
  benefit: AppliedBenefit | null;
  checkIns: CheckInRecord[];
  split: SplitPaymentState | null;
  updatedAt: string;
};

export function cartTotal(lines: CartLine[]): number {
  return Number(
    lines.reduce((s, l) => s + l.unitPriceBrl * l.qty, 0).toFixed(2),
  );
}
