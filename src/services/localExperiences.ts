import type { SupabaseClient } from "@supabase/supabase-js";
import {
  curateLocalExperiences,
  type ExperienceTrail,
} from "@/domain/dineOut/localExperiences";
import { formatSlotLocal } from "@/lib/dineTime";
import { listRestaurants, type CatalogRestaurant } from "@/services/restaurants";
import type { SlotRow } from "@/domain/types";

export type ExperienceCardPayload = {
  trailId: string;
  badge: string;
  title: string;
  story: string;
  cover: ExperienceTrail["cover"];
  inUserNeighborhood: boolean;
  restaurant: CatalogRestaurant;
  /** Horários livres reais (labels locais). Vazio = sem mesa agora. */
  availableSlots: string[];
  /** ISO do próximo slot, se houver. */
  nextSlotIso: string | null;
  /** Promo do cadastro do restaurante (só se > 0 no banco). */
  restaurantPromoPct: number | null;
};

/**
 * Monta a vitrine editorial com slots e promo 100% ground truth.
 * Benefício da conta do usuário NÃO é inventado aqui — a UI decide
 * se exibe o benefício ativo da sessão.
 */
export async function buildLocalExperienceCards(
  admin: SupabaseClient,
  params: {
    neighborhood: string;
    partySize: number;
    limit?: number;
  },
): Promise<ExperienceCardPayload[]> {
  const partySize = Math.min(20, Math.max(1, params.partySize));
  const limit = params.limit ?? 6;

  // Cidade inteira (Santos demo) para trilhas culturais; ranking prioriza o bairro.
  const cityRestaurants = await listRestaurants(admin, { limit: 80 });
  const curated = curateLocalExperiences(
    cityRestaurants,
    params.neighborhood,
    limit,
  );

  if (!curated.length) return [];

  const ids = curated.map((c) => c.restaurant.id);
  const from = new Date(Date.now() + 15 * 60 * 1000);
  const to = new Date(from.getTime() + 48 * 60 * 60 * 1000);

  const { data: slots, error } = await admin
    .from("restaurant_slots")
    .select("id, restaurant_id, starts_at, capacity, reserved_count")
    .in("restaurant_id", ids)
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const byRestaurant = new Map<string, SlotRow[]>();
  for (const slot of (slots ?? []) as SlotRow[]) {
    const remaining = slot.capacity - slot.reserved_count;
    if (remaining < partySize) continue;
    const list = byRestaurant.get(slot.restaurant_id) ?? [];
    list.push(slot);
    byRestaurant.set(slot.restaurant_id, list);
  }

  return curated.map((c) => {
    const open = byRestaurant.get(c.restaurant.id) ?? [];
    const slotLabels = open.slice(0, 3).map((s) => formatSlotLocal(s.starts_at));
    const promo = Number(c.restaurant.promo_discount_pct ?? 0);
    return {
      trailId: c.trailId,
      badge: c.badge,
      title: c.title,
      story: c.story,
      cover: c.cover,
      inUserNeighborhood: c.inUserNeighborhood,
      restaurant: c.restaurant,
      availableSlots: slotLabels,
      nextSlotIso: open[0]?.starts_at ?? null,
      restaurantPromoPct: promo > 0 ? promo : null,
    };
  });
}
