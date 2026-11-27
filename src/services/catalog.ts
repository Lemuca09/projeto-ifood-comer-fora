import type { SupabaseClient } from "@supabase/supabase-js";
import type { EligibleRestaurant, RestaurantRow, SlotRow } from "@/domain/types";

export async function findEligibleRestaurants(
  admin: SupabaseClient,
  params: {
    neighborhood: string;
    partySize: number;
    requestedFor?: string;
    preferredPriceRange?: number;
  },
): Promise<EligibleRestaurant[]> {
  const { data: restaurants, error } = await admin
    .from("restaurants")
    .select(
      "id, name, description, neighborhood, address, price_range, occasion_tags, is_active, is_synthetic, typical_wait_min, idle_capacity_pct, promo_discount_pct",
    )
    .eq("is_active", true)
    .eq("neighborhood", params.neighborhood);

  if (error) throw error;
  if (!restaurants?.length) return [];

  const ids = restaurants.map((r) => r.id);
  // Pra Hoje: a partir de ~15 min; janela 48h para pegar o próximo jantar
  // mesmo quando os slots de hoje já passaram.
  const from = params.requestedFor
    ? new Date(params.requestedFor)
    : new Date(Date.now() + 15 * 60 * 1000);
  const to = new Date(from.getTime() + 48 * 60 * 60 * 1000);

  const { data: slots, error: slotsError } = await admin
    .from("restaurant_slots")
    .select("*")
    .in("restaurant_id", ids)
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  if (slotsError) throw slotsError;

  const byRestaurant = new Map<string, SlotRow[]>();
  for (const slot of (slots ?? []) as SlotRow[]) {
    const remaining = slot.capacity - slot.reserved_count;
    if (remaining < params.partySize) continue;
    const list = byRestaurant.get(slot.restaurant_id) ?? [];
    list.push(slot);
    byRestaurant.set(slot.restaurant_id, list);
  }

  const eligible: EligibleRestaurant[] = [];
  for (const r of restaurants as RestaurantRow[]) {
    const openSlots = byRestaurant.get(r.id) ?? [];
    if (!openSlots.length) continue;
    if (
      params.preferredPriceRange &&
      r.price_range > params.preferredPriceRange + 1
    ) {
      // ainda pode entrar; ranking/fallback penaliza
    }
    eligible.push({
      ...r,
      slots: openSlots,
      remaining: openSlots[0].capacity - openSlots[0].reserved_count,
    });
  }

  return eligible;
}
