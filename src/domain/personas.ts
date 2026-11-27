export const ARCHETYPES = [
  "delivery_focused",
  "indecisive_explorer",
  "push_averse",
  "speed_seeker",
  "dinein_frequent",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  delivery_focused: "Focado em Delivery",
  indecisive_explorer: "Indeciso / Explorador",
  push_averse: "Avesso à Insistência",
  speed_seeker: "Decidido / Odeia Esperar",
  dinein_frequent: "Frequente Comer Fora",
};

export type PartySizeMode = "1" | "2" | "4+";
export type FrictionReason = "preco" | "demora" | "qualidade" | "nenhum";
export type SentimentLabel = "positivo" | "neutro" | "negativo";

export type SyntheticUser = {
  id: string;
  code: string;
  display_name: string;
  archetype: Archetype;
  user_delivery_orders_90d: number;
  user_dinein_checkins_90d: number;
  user_dinein_share_pct: number;
  user_avg_ticket_brl: number;
  user_group_order_ratio: number;
  user_push_ignored_streak: number;
  user_fatigue_score: number;
  user_days_since_last_dinein: number;
  preferred_neighborhood: string;
  /** Feature store (§7) */
  preferred_cuisine: string;
  preferred_hour_slot: string;
  price_sensitivity: number;
  coupon_redemption_rate_90d: number;
  last_nps_score: number;
  last_sentiment: SentimentLabel;
  friction_reason: FrictionReason;
  party_size_mode: PartySizeMode;
  comer_fora_visits_90d: number;
  favorite_restaurant_id: string | null;
  lifetime_margin_brl: number;
  avg_margin_pct: number;
};

export type DemoSessionMetrics = {
  cart_subtotal_brl: number;
  cart_main_items_count: number;
  cart_delivery_fee_brl: number;
  cart_delivery_eta_min: number;
  session_hesitation_sec: number;
  dist_to_restaurant_km: number;
  travel_time_min: number;
  ext_rain_probability_pct: number;
  ext_traffic_congestion_idx: number;
  rest_current_wait_min: number;
  rest_idle_capacity_pct: number;
  rest_active_promo_discount_pct: number;
  restaurant_id?: string | null;
};

export type RuleStatus = "approved" | "rejected" | "blocked";

export type DecisionRule = {
  rule_code: string;
  label: string;
  status: RuleStatus;
  detail: string;
  sort_order: number;
};

export type DecisionKpis = {
  fatigue_risk_pct: number;
  silent_mode: boolean;
  external_friction: number;
  financial_advantage_brl: number;
  time_saved_min: number;
  recommend_dinein: boolean;
  summary: string;
};
