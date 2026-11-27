import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoSessionMetrics, SyntheticUser } from "@/domain/personas";
import {
  evaluateDecision,
  randomizeSessionMetrics,
  rankRestaurantsForContext,
} from "@/domain/decisionEngine";
import { REASON_LABELS } from "@/lib/constants";
import type { RestaurantRow } from "@/domain/types";

export type DemoBootstrapResult = {
  sessionId: string;
  user: SyntheticUser;
  metrics: DemoSessionMetrics;
  diagnosis: ReturnType<typeof evaluateDecision>["kpis"] & {
    rules: ReturnType<typeof evaluateDecision>["rules"];
  };
  recommendations: Array<{
    rank: number;
    reason_code: string;
    reason_label: string;
    score: number;
    restaurant: RestaurantRow & {
      typical_wait_min?: number;
      idle_capacity_pct?: number;
      promo_discount_pct?: number;
    };
  }>;
  decisionRunId: string;
  baseStats: {
    personaCount: number;
    eligibilityRatePct: number;
    avgFatigueRejectionPct: number;
    estimatedTicketUpliftBrl: number;
  };
  allUsers: SyntheticUser[];
};

async function loadUsers(admin: SupabaseClient): Promise<SyntheticUser[]> {
  const { data, error } = await admin.from("synthetic_users").select("*").order("code");
  if (error) throw error;
  return (data ?? []) as SyntheticUser[];
}

async function pickRestaurant(admin: SupabaseClient, neighborhood: string) {
  const { data } = await admin
    .from("restaurants")
    .select(
      "id, name, description, neighborhood, address, price_range, occasion_tags, is_active, is_synthetic, typical_wait_min, idle_capacity_pct, promo_discount_pct",
    )
    .eq("is_active", true)
    .eq("neighborhood", neighborhood)
    .limit(8);
  const list = data ?? [];
  if (!list.length) {
    const { data: anyR } = await admin
      .from("restaurants")
      .select(
        "id, name, description, neighborhood, address, price_range, occasion_tags, is_active, is_synthetic, typical_wait_min, idle_capacity_pct, promo_discount_pct",
      )
      .eq("is_active", true)
      .limit(8);
    const pool = anyR ?? [];
    return pool[Math.floor(Math.random() * Math.max(pool.length, 1))];
  }
  return list[Math.floor(Math.random() * list.length)];
}

export async function computeBaseStats(admin: SupabaseClient) {
  const users = await loadUsers(admin);
  if (!users.length) {
    return {
      personaCount: 0,
      eligibilityRatePct: 0,
      avgFatigueRejectionPct: 0,
      estimatedTicketUpliftBrl: 0,
    };
  }

  let eligible = 0;
  let fatigueRej = 0;
  let upliftSum = 0;

  for (const u of users) {
    const metrics = randomizeSessionMetrics(u);
    const { kpis } = evaluateDecision(u, metrics);
    if (kpis.recommend_dinein) eligible++;
    if (kpis.silent_mode) fatigueRej++;
    upliftSum += kpis.financial_advantage_brl * 0.15;
  }

  return {
    personaCount: users.length,
    eligibilityRatePct: Math.round((eligible / users.length) * 1000) / 10,
    avgFatigueRejectionPct: Math.round((fatigueRej / users.length) * 1000) / 10,
    estimatedTicketUpliftBrl: Math.round((upliftSum / users.length) * 100) / 100,
  };
}

export async function runDecisionAndPersist(
  admin: SupabaseClient,
  params: {
    authUserId: string;
    sessionId: string;
    user: SyntheticUser;
    metrics: DemoSessionMetrics;
  },
) {
  const { kpis, rules } = evaluateDecision(params.user, params.metrics);

  const { data: restaurants } = await admin
    .from("restaurants")
    .select(
      "id, name, description, neighborhood, address, price_range, occasion_tags, is_active, is_synthetic, typical_wait_min, idle_capacity_pct, promo_discount_pct",
    )
    .eq("is_active", true)
    .eq("neighborhood", params.user.preferred_neighborhood);

  let pool = restaurants ?? [];
  if (pool.length < 3) {
    const { data: more } = await admin
      .from("restaurants")
      .select(
        "id, name, description, neighborhood, address, price_range, occasion_tags, is_active, is_synthetic, typical_wait_min, idle_capacity_pct, promo_discount_pct",
      )
      .eq("is_active", true)
      .limit(20);
    pool = more ?? pool;
  }

  const ranked = rankRestaurantsForContext(
    pool as never,
    params.user,
    params.metrics,
    kpis,
  );

  const { data: run, error: runErr } = await admin
    .from("decision_runs")
    .insert({
      demo_session_id: params.sessionId,
      auth_user_id: params.authUserId,
      synthetic_user_id: params.user.id,
      fatigue_risk_pct: kpis.fatigue_risk_pct,
      silent_mode: kpis.silent_mode,
      external_friction: kpis.external_friction,
      financial_advantage_brl: kpis.financial_advantage_brl,
      time_saved_min: kpis.time_saved_min,
      recommend_dinein: kpis.recommend_dinein,
      summary: kpis.summary,
      is_fallback: true,
      model: null,
      prompt_version: "decisionEngine.v1",
    })
    .select("id")
    .single();

  if (runErr || !run) throw runErr ?? new Error("decision_run insert failed");

  if (rules.length) {
    await admin.from("decision_rules").insert(
      rules.map((r) => ({
        decision_run_id: run.id,
        rule_code: r.rule_code,
        label: r.label,
        status: r.status,
        detail: r.detail,
        sort_order: r.sort_order,
      })),
    );
  }

  if (ranked.length) {
    await admin.from("decision_recommendations").insert(
      ranked.map((r) => ({
        decision_run_id: run.id,
        restaurant_id: r.restaurant.id,
        rank: r.rank,
        reason_code: r.reason_code,
        score: r.score,
      })),
    );
  }

  return {
    decisionRunId: run.id as string,
    kpis,
    rules,
    recommendations: ranked.map((r) => ({
      rank: r.rank,
      reason_code: r.reason_code,
      reason_label: REASON_LABELS[r.reason_code],
      score: r.score,
      restaurant: r.restaurant,
    })),
  };
}

async function upsertSession(
  admin: SupabaseClient,
  authUserId: string,
  user: SyntheticUser,
  metrics: DemoSessionMetrics,
) {
  const payload = {
    auth_user_id: authUserId,
    synthetic_user_id: user.id,
    restaurant_id: metrics.restaurant_id ?? null,
    cart_subtotal_brl: metrics.cart_subtotal_brl,
    cart_main_items_count: metrics.cart_main_items_count,
    cart_delivery_fee_brl: metrics.cart_delivery_fee_brl,
    cart_delivery_eta_min: metrics.cart_delivery_eta_min,
    session_hesitation_sec: metrics.session_hesitation_sec,
    dist_to_restaurant_km: metrics.dist_to_restaurant_km,
    travel_time_min: metrics.travel_time_min,
    ext_rain_probability_pct: metrics.ext_rain_probability_pct,
    ext_traffic_congestion_idx: metrics.ext_traffic_congestion_idx,
    rest_current_wait_min: metrics.rest_current_wait_min,
    rest_idle_capacity_pct: metrics.rest_idle_capacity_pct,
    rest_active_promo_discount_pct: metrics.rest_active_promo_discount_pct,
    updated_at: new Date().toISOString(),
    is_synthetic: true,
  };

  const { data: existing } = await admin
    .from("demo_sessions")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from("demo_sessions")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("session update failed");
    return data.id as string;
  }

  const { data, error } = await admin
    .from("demo_sessions")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("session insert failed");
  return data.id as string;
}

export async function bootstrapDemoSession(
  admin: SupabaseClient,
  authUserId: string,
  opts?: { syntheticUserId?: string },
): Promise<DemoBootstrapResult> {
  const users = await loadUsers(admin);
  if (!users.length) {
    throw new Error(
      "Nenhuma persona no banco. Rode migration 006 e scripts/seed-personas.mjs",
    );
  }

  const { data: existing } = await admin
    .from("demo_sessions")
    .select("synthetic_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  let user: SyntheticUser;
  if (opts?.syntheticUserId) {
    user = users.find((u) => u.id === opts.syntheticUserId) ?? users[0];
  } else {
    const previousId = existing?.synthetic_user_id as string | undefined;
    const pool = users.filter((u) => u.id !== previousId);
    const src = pool.length ? pool : users;
    user = src[Math.floor(Math.random() * src.length)];
  }

  const restaurant = await pickRestaurant(admin, user.preferred_neighborhood);
  const metrics = randomizeSessionMetrics(user, restaurant);
  const sessionId = await upsertSession(admin, authUserId, user, metrics);
  const decision = await runDecisionAndPersist(admin, {
    authUserId,
    sessionId,
    user,
    metrics,
  });
  const baseStats = await computeBaseStats(admin);

  return {
    sessionId,
    user,
    metrics,
    diagnosis: { ...decision.kpis, rules: decision.rules },
    recommendations: decision.recommendations,
    decisionRunId: decision.decisionRunId,
    baseStats,
    allUsers: users,
  };
}

export async function updateSessionAndRecalculate(
  admin: SupabaseClient,
  authUserId: string,
  input: {
    syntheticUserId: string;
    metrics: DemoSessionMetrics;
    /** Se true, também atualiza métricas do usuário sintético (streak/fadiga). */
    userOverrides?: Partial<
      Pick<
        SyntheticUser,
        "user_push_ignored_streak" | "user_fatigue_score" | "user_avg_ticket_brl"
      >
    >;
  },
): Promise<DemoBootstrapResult> {
  const users = await loadUsers(admin);
  let user = users.find((u) => u.id === input.syntheticUserId);
  if (!user) throw new Error("Persona não encontrada");

  if (input.userOverrides) {
    const { error } = await admin
      .from("synthetic_users")
      .update({
        user_push_ignored_streak:
          input.userOverrides.user_push_ignored_streak ?? user.user_push_ignored_streak,
        user_fatigue_score:
          input.userOverrides.user_fatigue_score ?? user.user_fatigue_score,
        user_avg_ticket_brl:
          input.userOverrides.user_avg_ticket_brl ?? user.user_avg_ticket_brl,
      })
      .eq("id", user.id);
    if (error) throw error;
    const refreshed = await loadUsers(admin);
    user = refreshed.find((u) => u.id === user!.id)!;
  }

  const sessionId = await upsertSession(admin, authUserId, user, input.metrics);
  const decision = await runDecisionAndPersist(admin, {
    authUserId,
    sessionId,
    user,
    metrics: input.metrics,
  });
  const baseStats = await computeBaseStats(admin);
  const allUsers = await loadUsers(admin);

  return {
    sessionId,
    user,
    metrics: input.metrics,
    diagnosis: { ...decision.kpis, rules: decision.rules },
    recommendations: decision.recommendations,
    decisionRunId: decision.decisionRunId,
    baseStats,
    allUsers,
  };
}
