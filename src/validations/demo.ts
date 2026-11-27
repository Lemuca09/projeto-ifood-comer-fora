import { z } from "zod";

export const metricsSchema = z
  .object({
    cart_subtotal_brl: z.number().min(0).max(5000),
    cart_main_items_count: z.number().int().min(1).max(20),
    cart_delivery_fee_brl: z.number().min(0).max(100),
    cart_delivery_eta_min: z.number().int().min(5).max(120),
    session_hesitation_sec: z.number().int().min(0).max(600),
    dist_to_restaurant_km: z.number().min(0).max(30),
    travel_time_min: z.number().int().min(1).max(120),
    ext_rain_probability_pct: z.number().int().min(0).max(100),
    ext_traffic_congestion_idx: z.number().min(0).max(1),
    rest_current_wait_min: z.number().int().min(0).max(120),
    rest_idle_capacity_pct: z.number().int().min(0).max(100),
    rest_active_promo_discount_pct: z.number().min(0).max(100),
    restaurant_id: z.string().uuid().nullable().optional(),
  })
  .strict();

export const recalculateSchema = z
  .object({
    syntheticUserId: z.string().uuid(),
    metrics: metricsSchema,
    user_push_ignored_streak: z.number().int().min(0).max(10).optional(),
    user_fatigue_score: z.number().int().min(0).max(100).optional(),
  })
  .strict();
