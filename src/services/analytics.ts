import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_EVENT_VERSION } from "@/guardrails/config";

const ALLOWED_META_KEYS = new Set([
  "neighborhood",
  "occasion",
  "party_size",
  "is_fallback",
  "restaurant_id",
  "discovery_id",
  "recommendation_id",
  "reason_code",
  "status",
]);

export type AppEventType =
  | "view"
  | "discovery"
  | "recommend"
  | "restaurant_select"
  | "reserve"
  | "save_preference"
  | "return_invite_view";

export async function trackEvent(
  admin: SupabaseClient,
  params: {
    userId: string | null;
    eventType: AppEventType;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    isSynthetic?: boolean;
  },
) {
  const metadata: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params.metadata ?? {})) {
    if (ALLOWED_META_KEYS.has(k)) metadata[k] = v;
  }

  const { error } = await admin.from("app_events").insert({
    user_id: params.userId,
    event_type: params.eventType,
    entity_id: params.entityId ?? null,
    metadata,
    is_synthetic: params.isSynthetic ?? false,
    app_version: APP_EVENT_VERSION,
  });

  if (error) {
    console.error("trackEvent failed", error.code);
  }
}

export async function getFunnelMetrics(admin: SupabaseClient) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await admin
    .from("app_events")
    .select("user_id, event_type, is_synthetic")
    .gte("created_at", since);

  if (error) throw error;

  const live = (events ?? []).filter((e) => !e.is_synthetic);
  const seed = (events ?? []).filter((e) => e.is_synthetic);
  const usersRecommended = new Set(
    live.filter((e) => e.event_type === "recommend" && e.user_id).map((e) => e.user_id),
  );
  const usersReserved = new Set(
    live.filter((e) => e.event_type === "reserve" && e.user_id).map((e) => e.user_id),
  );

  const { count: fallbackCount } = await admin
    .from("recommendations")
    .select("*", { count: "exact", head: true })
    .eq("is_fallback", true)
    .gte("created_at", since);

  const { count: totalRecs } = await admin
    .from("recommendations")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);

  const recommended = usersRecommended.size;
  const reserved = [...usersReserved].filter((u) => usersRecommended.has(u)).length;

  return {
    windowDays: 30,
    formula:
      "conversão = usuários distintos com reserve (entre os que tiveram recommend) / usuários distintos com recommend",
    usersRecommended: recommended,
    usersReservedInFunnel: reserved,
    conversionPct: recommended === 0 ? 0 : Math.round((reserved / recommended) * 1000) / 10,
    totalDiscoveryEvents: live.filter((e) => e.event_type === "discovery").length,
    totalRecommendEvents: live.filter((e) => e.event_type === "recommend").length,
    totalReserveEvents: live.filter((e) => e.event_type === "reserve").length,
    seedEventCount: seed.length,
    liveEventCount: live.length,
    fallbackRatePct:
      !totalRecs || totalRecs === 0
        ? 0
        : Math.round(((fallbackCount ?? 0) / totalRecs) * 1000) / 10,
  };
}
