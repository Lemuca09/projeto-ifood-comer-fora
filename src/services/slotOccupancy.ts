import type { SupabaseClient } from "@supabase/supabase-js";
import {
  expectedIdleFraction,
  expectedOccupancyFraction,
} from "@/domain/analytics/calendarDemand";

export { expectedIdleFraction, expectedOccupancyFraction };

/** Ociosidade % a partir de capacity/reserved dos slots (ground truth). */
export function idlePctFromSlots(
  slots: Array<{ capacity: number; reserved_count: number }>,
): number | null {
  if (!slots.length) return null;
  let free = 0;
  let cap = 0;
  for (const s of slots) {
    cap += Math.max(0, s.capacity);
    free += Math.max(0, s.capacity - s.reserved_count);
  }
  if (cap <= 0) return null;
  return Number(((free / cap) * 100).toFixed(1));
}

/** Ocupação % inversa da ociosidade dos slots. */
export function occupancyPctFromSlots(
  slots: Array<{ capacity: number; reserved_count: number }>,
): number | null {
  const idle = idlePctFromSlots(slots);
  if (idle == null) return null;
  return Number((100 - idle).toFixed(1));
}

/**
 * Busca slots futuros do restaurante e devolve ociosidade observada.
 * Fallback: expectedIdleFraction(hoje) se não houver slot.
 */
export async function idlePctForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ idlePct: number; fromSlots: boolean }> {
  const from = new Date(Date.now() + 15 * 60 * 1000);
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data, error } = await admin
    .from("restaurant_slots")
    .select("capacity, reserved_count")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString());
  if (error) throw error;
  const fromSlots = idlePctFromSlots(data ?? []);
  if (fromSlots != null) return { idlePct: fromSlots, fromSlots: true };
  return {
    idlePct: Number((expectedIdleFraction(new Date()) * 100).toFixed(1)),
    fromSlots: false,
  };
}
