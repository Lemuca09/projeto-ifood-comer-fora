import type { SupabaseClient } from "@supabase/supabase-js";

export const RESTAURANT_SELECT =
  "id, name, description, neighborhood, address, price_range, occasion_tags, is_active, is_synthetic, typical_wait_min, idle_capacity_pct, promo_discount_pct";

export type CatalogRestaurant = {
  id: string;
  name: string;
  description: string | null;
  neighborhood: string;
  address: string;
  price_range: number;
  occasion_tags: string[];
  is_active: boolean;
  is_synthetic: boolean;
  typical_wait_min: number | null;
  idle_capacity_pct: number | null;
  promo_discount_pct: number | null;
};

export async function listRestaurants(
  admin: SupabaseClient,
  params?: { neighborhood?: string; limit?: number },
): Promise<CatalogRestaurant[]> {
  let query = admin
    .from("restaurants")
    .select(RESTAURANT_SELECT)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (params?.neighborhood) {
    query = query.eq("neighborhood", params.neighborhood);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CatalogRestaurant[];
}

export async function getRestaurantById(
  admin: SupabaseClient,
  id: string,
): Promise<CatalogRestaurant | null> {
  const { data, error } = await admin
    .from("restaurants")
    .select(RESTAURANT_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return (data as CatalogRestaurant | null) ?? null;
}
