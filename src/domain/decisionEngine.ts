import type {
  DecisionKpis,
  DecisionRule,
  DemoSessionMetrics,
  SyntheticUser,
} from "@/domain/personas";
import type { RestaurantRow } from "@/domain/types";
import type { ReasonCode } from "@/domain/types";

export type RankedRestaurant = {
  restaurant: RestaurantRow & {
    typical_wait_min?: number;
    idle_capacity_pct?: number;
    promo_discount_pct?: number;
  };
  rank: number;
  reason_code: ReasonCode;
  score: number;
};

/** Índice de fadiga / risco de rejeição: min(100, streak * 25) */
export function fatigueRiskPct(streak: number): number {
  return Math.min(100, Math.max(0, streak) * 25);
}

/**
 * Atrito externo 0–1:
 * chuva 50% + trânsito 30% + deslocamento 20% (travel/60 capped).
 */
export function externalFriction(m: DemoSessionMetrics): number {
  const rain = m.ext_rain_probability_pct / 100;
  const traffic = m.ext_traffic_congestion_idx;
  const travel = Math.min(1, m.travel_time_min / 60);
  return Number((rain * 0.5 + traffic * 0.3 + travel * 0.2).toFixed(3));
}

export function financialAdvantageBrl(m: DemoSessionMetrics): number {
  const discountPart =
    (Number(m.cart_subtotal_brl) * Number(m.rest_active_promo_discount_pct)) / 100;
  return Number((discountPart + Number(m.cart_delivery_fee_brl)).toFixed(2));
}

export function timeSavedMin(m: DemoSessionMetrics): number {
  return m.cart_delivery_eta_min - (m.travel_time_min + m.rest_current_wait_min);
}

export function evaluateDecision(
  user: SyntheticUser,
  metrics: DemoSessionMetrics,
): { kpis: DecisionKpis; rules: DecisionRule[] } {
  const fatigue = fatigueRiskPct(user.user_push_ignored_streak);
  const silent = fatigue >= 50 || user.user_fatigue_score >= 50;
  const friction = externalFriction(metrics);
  const money = financialAdvantageBrl(metrics);
  const time = timeSavedMin(metrics);

  const rules: DecisionRule[] = [];
  let order = 0;
  const push = (
    rule_code: string,
    label: string,
    status: DecisionRule["status"],
    detail: string,
  ) => {
    rules.push({ rule_code, label, status, detail, sort_order: order++ });
  };

  // Fadiga
  if (silent) {
    push(
      "FATIGUE_SILENT",
      "Modo silencioso (fadiga)",
      "blocked",
      `Risco ${fatigue}% · score fadiga ${user.user_fatigue_score}. Abordagens invasivas bloqueadas.`,
    );
  } else {
    push(
      "FATIGUE_OK",
      "Fadiga de notificação sob controle",
      "approved",
      `Risco ${fatigue}% (< 50%).`,
    );
  }

  // Economia
  if (money > 20) {
    push(
      "ECONOMY_GT_20",
      "Economia > R$ 20",
      "approved",
      `Vantagem líquida R$ ${money.toFixed(2)} (promo + taxa delivery).`,
    );
  } else {
    push(
      "ECONOMY_GT_20",
      "Economia > R$ 20",
      "rejected",
      `Vantagem R$ ${money.toFixed(2)} insuficiente para converter com força.`,
    );
  }

  // Fila
  if (metrics.rest_current_wait_min < 15) {
    push(
      "WAIT_LT_15",
      "Fila < 15 min",
      "approved",
      `Espera atual ${metrics.rest_current_wait_min} min.`,
    );
  } else {
    push(
      "WAIT_LT_15",
      "Fila < 15 min",
      "rejected",
      `Espera ${metrics.rest_current_wait_min} min — atrito alto para quem odeia fila.`,
    );
  }

  // Clima / trânsito
  if (friction >= 0.55) {
    push(
      "EXTERNAL_FRICTION",
      "Atrito externo (chuva/trânsito/deslocamento)",
      "blocked",
      `Índice ${friction.toFixed(2)} ≥ 0.55 — clima/trânsito desencorajam saída.`,
    );
  } else {
    push(
      "EXTERNAL_FRICTION",
      "Atrito externo aceitável",
      "approved",
      `Índice ${friction.toFixed(2)}.`,
    );
  }

  // Tempo
  if (time > 0) {
    push(
      "TIME_SAVED",
      "Tempo economizado vs delivery",
      "approved",
      `${time} min a menos que o ETA do delivery.`,
    );
  } else {
    push(
      "TIME_SAVED",
      "Tempo economizado vs delivery",
      "rejected",
      `Salão não é mais rápido (${time} min).`,
    );
  }

  // Capacidade ociosa
  if (metrics.rest_idle_capacity_pct >= 25) {
    push(
      "IDLE_CAPACITY",
      "Salão com capacidade ociosa",
      "approved",
      `${metrics.rest_idle_capacity_pct}% ocioso — bom momento para Comer Fora.`,
    );
  } else {
    push(
      "IDLE_CAPACITY",
      "Salão com capacidade ociosa",
      "rejected",
      `Ociosidade ${metrics.rest_idle_capacity_pct}% baixa.`,
    );
  }

  // Arquétipo delivery: precisa incentivo claro
  if (user.archetype === "delivery_focused" && money < 15) {
    push(
      "DELIVERY_INCENTIVE",
      "Incentivo para perfil delivery",
      "rejected",
      "Perfil delivery exige incentivo financeiro mais claro.",
    );
  } else if (user.archetype === "delivery_focused") {
    push(
      "DELIVERY_INCENTIVE",
      "Incentivo para perfil delivery",
      "approved",
      "Há vantagem financeira suficiente para testar o salão.",
    );
  }

  // Speed seeker + fila
  if (user.archetype === "speed_seeker" && metrics.rest_current_wait_min >= 15) {
    push(
      "SPEED_WAIT",
      "Perfil velocidade × fila",
      "blocked",
      "Usuário odeia esperar — fila alta bloqueia recomendação forte.",
    );
  }

  const blocked = rules.some((r) => r.status === "blocked");
  const approvedCount = rules.filter((r) => r.status === "approved").length;
  const rejectedCount = rules.filter((r) => r.status === "rejected").length;

  let recommend = !blocked && approvedCount >= rejectedCount && (money >= 12 || time > 5);
  if (user.archetype === "dinein_frequent") recommend = !blocked && friction < 0.7;
  if (silent && recommend) {
    // ainda pode recomendar, mas modo silencioso (sem notificação invasiva)
  }
  if (friction >= 0.7) recommend = false;

  const summary = recommend
    ? silent
      ? "Recomendação suave de Comer Fora (modo silencioso — sem notificação invasiva)."
      : "Recomendação ativa de converter delivery → salão."
    : "Não recomendar saída agora — atrito ou risco de rejeição alto.";

  return {
    kpis: {
      fatigue_risk_pct: fatigue,
      silent_mode: silent,
      external_friction: friction,
      financial_advantage_brl: money,
      time_saved_min: time,
      recommend_dinein: recommend,
      summary,
    },
    rules,
  };
}

export function rankRestaurantsForContext(
  restaurants: Array<
    RestaurantRow & {
      typical_wait_min?: number;
      idle_capacity_pct?: number;
      promo_discount_pct?: number;
    }
  >,
  user: SyntheticUser,
  metrics: DemoSessionMetrics,
  kpis: DecisionKpis,
): RankedRestaurant[] {
  const scored = restaurants.map((r) => {
    let score = 40;
    let reason: ReasonCode = "NEARBY";

    if (r.neighborhood === user.preferred_neighborhood) {
      score += 25;
      reason = "NEARBY";
    }
    const promo = Number(r.promo_discount_pct ?? 0);
    if (promo >= 10) {
      score += 20;
      reason = "PRICE_MATCH";
    }
    const wait = r.typical_wait_min ?? 12;
    if (wait < 15) {
      score += 15;
      reason = "AVAILABILITY";
    }
    if (user.archetype === "speed_seeker" && wait < 10) score += 20;
    if (user.archetype === "dinein_frequent") score += 10;
    if (user.archetype === "delivery_focused" && promo >= 15) {
      score += 18;
      reason = "GOOD_MATCH";
    }
    if (kpis.silent_mode) score -= 5;
    if (!kpis.recommend_dinein) score -= 30;

    score += Math.max(0, 10 - r.price_range);

    return { restaurant: r, score, reason_code: reason };
  });

  scored.sort((a, b) => b.score - a.score || a.restaurant.name.localeCompare(b.restaurant.name));

  return scored.slice(0, 3).map((s, i) => ({
    restaurant: s.restaurant,
    rank: i + 1,
    reason_code: s.reason_code,
    score: s.score,
  }));
}

export function randomizeSessionMetrics(
  user: SyntheticUser,
  restaurant?: {
    id: string;
    typical_wait_min?: number;
    idle_capacity_pct?: number;
    promo_discount_pct?: number;
    price_range: number;
  },
): DemoSessionMetrics {
  const baseTicket = Number(user.user_avg_ticket_brl) || 60;
  const rain = Math.floor(Math.random() * 80);
  const traffic = Number((Math.random() * 0.8).toFixed(3));
  const travel = 8 + Math.floor(Math.random() * 25);
  const eta = 25 + Math.floor(Math.random() * 35);
  const hesitation =
    user.archetype === "indecisive_explorer"
      ? 90 + Math.floor(Math.random() * 120)
      : 15 + Math.floor(Math.random() * 40);

  return {
    cart_subtotal_brl: Number((baseTicket * (0.9 + Math.random() * 0.5)).toFixed(2)),
    cart_main_items_count: 1 + Math.floor(Math.random() * 3),
    cart_delivery_fee_brl: Number((6 + Math.random() * 12).toFixed(2)),
    cart_delivery_eta_min: eta,
    session_hesitation_sec: hesitation,
    dist_to_restaurant_km: Number((0.4 + Math.random() * 4).toFixed(2)),
    travel_time_min: travel,
    ext_rain_probability_pct: rain,
    ext_traffic_congestion_idx: traffic,
    rest_current_wait_min: restaurant?.typical_wait_min ?? 8 + Math.floor(Math.random() * 20),
    rest_idle_capacity_pct: restaurant?.idle_capacity_pct ?? 20 + Math.floor(Math.random() * 50),
    rest_active_promo_discount_pct: Number(
      restaurant?.promo_discount_pct ?? (10 + Math.random() * 15).toFixed(2),
    ),
    restaurant_id: restaurant?.id ?? null,
  };
}
