import type { REASON_CODES } from "@/lib/constants";

export type ReasonCode = (typeof REASON_CODES)[number];

export type RestaurantRow = {
  id: string;
  name: string;
  description: string | null;
  neighborhood: string;
  address: string;
  price_range: number;
  occasion_tags: string[];
  is_active: boolean;
  is_synthetic: boolean;
  typical_wait_min?: number | null;
  idle_capacity_pct?: number | null;
  promo_discount_pct?: number | null;
};

export type SlotRow = {
  id: string;
  restaurant_id: string;
  starts_at: string;
  capacity: number;
  reserved_count: number;
};

export type EligibleRestaurant = RestaurantRow & {
  slots: SlotRow[];
  remaining: number;
};

export type RankedItem = {
  restaurant_id: string;
  reason_code: ReasonCode;
  rank: number;
};

export type DiscoveryResult = {
  discoveryId: string;
  recommendationId: string;
  isFallback: boolean;
  /** Pedido fora de escopo / bloqueado pela guarda (sem chamar LLM). */
  blocked?: boolean;
  /** Resposta conversacional do concierge (Claude ou template local). */
  answer?: string;
  answerIsFallback?: boolean;
  /** Intenção detectada / ecoada pelo Claude (`price_high`, `proximity`, …). */
  userIntent?: string;
  /** Frase curta do que a pessoa pediu. */
  intentLabel?: string;
  /** Motivo do fallback Claude (créditos, timeout, schema, etc.). */
  aiFailReason?: string;
  nowLocal?: string;
  items: Array<{
    rank: number;
    reason_code: ReasonCode;
    reason_label: string;
    restaurant: RestaurantRow;
    next_slot: SlotRow | null;
    /** Horários livres confirmados no banco (ISO), só ground truth. */
    available_slots?: string[];
    cuisine?: string;
    promo_discount_pct?: number | null;
  }>;
};
