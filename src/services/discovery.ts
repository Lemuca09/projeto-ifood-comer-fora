import type { SupabaseClient } from "@supabase/supabase-js";
import { REASON_LABELS } from "@/lib/constants";
import { sanitizeUserText, stripLikelyPii } from "@/lib/sanitize";
import { inputGuard } from "@/guardrails/inputGuard";
import { secureLog } from "@/guardrails/secureLog";
import { findEligibleRestaurants } from "@/services/catalog";
import { trackEvent } from "@/services/analytics";
import { PROMPT_VERSION, rankWithAiOrFallback } from "@/ai/recommendation";
import type { DiscoveryInput } from "@/validations/discovery";
import type { DiscoveryResult } from "@/domain/types";

export async function runDiscovery(
  admin: SupabaseClient,
  userId: string,
  input: DiscoveryInput,
  opts?: { forceFallback?: boolean },
): Promise<DiscoveryResult & { blocked?: boolean; limitReached?: boolean }> {
  const safeOccasion = stripLikelyPii(sanitizeUserText(input.occasion, 500));
  const guard = inputGuard(safeOccasion);

  await secureLog(admin, {
    category: "input_guard",
    decisao: guard.decisao,
    ruleIds: guard.ruleIds,
    score: guard.score,
    versao: "inputGuard.v1",
    sessionId: userId,
  });

  if (guard.decisao === "bloquear") {
    return {
      discoveryId: "",
      recommendationId: "",
      isFallback: true,
      items: [],
      blocked: true,
    };
  }

  const forceFallback =
    guard.decisao === "degradar" ||
    opts?.forceFallback === true ||
    input.skipAi === true;

  const { data: discovery, error: dErr } = await admin
    .from("discovery_requests")
    .insert({
      user_id: userId,
      occasion: input.occasion,
      neighborhood: input.neighborhood,
      party_size: input.partySize,
      preferred_price_range: input.preferredPriceRange ?? null,
      requested_for: input.requestedFor ?? null,
    })
    .select("id")
    .single();

  if (dErr || !discovery) throw dErr ?? new Error("discovery insert failed");

  await trackEvent(admin, {
    userId,
    eventType: "discovery",
    entityId: discovery.id,
    metadata: {
      neighborhood: input.neighborhood,
      occasion: input.occasion,
      party_size: input.partySize,
    },
  });

  const eligible = await findEligibleRestaurants(admin, {
    neighborhood: input.neighborhood,
    partySize: input.partySize,
    requestedFor: input.requestedFor,
    preferredPriceRange: input.preferredPriceRange,
  });

  const querySafe = input.queryText
    ? stripLikelyPii(sanitizeUserText(input.queryText, 400))
    : undefined;

  let preferredPriceRange = input.preferredPriceRange;
  const benefitValue =
    input.benefitContext?.benefitType === "nenhum"
      ? 0
      : (input.benefitContext?.giftbackBalanceBrl ||
          input.benefitContext?.benefitValueBrl ||
          0);
  const avgTicket = input.benefitContext?.avgTicketBrl ?? 0;
  const minTicket = input.benefitContext?.minTicketBrl ?? 0;
  if (!preferredPriceRange && (benefitValue > 0 || minTicket > 0) && avgTicket > 0) {
    const target = Math.max(minTicket || avgTicket - benefitValue, 20);
    preferredPriceRange = target <= 40 ? 1 : target <= 80 ? 2 : target <= 150 ? 3 : 4;
  }

  const ranked = await rankWithAiOrFallback({
    candidates: eligible,
    occasion: input.occasion,
    neighborhood: input.neighborhood,
    partySize: input.partySize,
    preferredPriceRange,
    occasionTextSafe: guard.textoSeguro,
    queryTextSafe: querySafe,
    benefitContext: input.benefitContext,
    forceFallback,
  });

  if (ranked.outputGuardReason) {
    await secureLog(admin, {
      category: "output_guard",
      decisao: "fallback",
      ruleIds: [ranked.outputGuardReason],
      versao: "outputGuard.v1",
      latenciaMs: ranked.latencyMs,
      sessionId: userId,
    });
  }

  await secureLog(admin, {
    category: "ai",
    decisao: ranked.isFallback ? "fallback" : "model",
    versao: ranked.isFallback ? undefined : PROMPT_VERSION,
    latenciaMs: ranked.latencyMs,
    sessionId: userId,
  });

  const { data: rec, error: rErr } = await admin
    .from("recommendations")
    .insert({
      discovery_id: discovery.id,
      model: ranked.model,
      prompt_version: ranked.isFallback ? null : PROMPT_VERSION,
      is_fallback: ranked.isFallback,
    })
    .select("id")
    .single();

  if (rErr || !rec) throw rErr ?? new Error("recommendation insert failed");

  if (ranked.items.length) {
    const { error: iErr } = await admin.from("recommendation_items").insert(
      ranked.items.map((item) => ({
        recommendation_id: rec.id,
        restaurant_id: item.restaurant_id,
        rank: item.rank,
        reason_code: item.reason_code,
      })),
    );
    if (iErr) throw iErr;
  }

  await trackEvent(admin, {
    userId,
    eventType: "recommend",
    entityId: rec.id,
    metadata: {
      discovery_id: discovery.id,
      is_fallback: ranked.isFallback,
      neighborhood: input.neighborhood,
    },
  });

  const byId = new Map(eligible.map((e) => [e.id, e]));
  const items = ranked.items
    .map((item) => {
      const restaurant = byId.get(item.restaurant_id);
      if (!restaurant) return null;
      return {
        rank: item.rank,
        reason_code: item.reason_code,
        reason_label: REASON_LABELS[item.reason_code],
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          description: restaurant.description,
          neighborhood: restaurant.neighborhood,
          address: restaurant.address,
          price_range: restaurant.price_range,
          occasion_tags: restaurant.occasion_tags,
          is_active: restaurant.is_active,
          is_synthetic: restaurant.is_synthetic,
        },
        next_slot: restaurant.slots[0] ?? null,
      };
    })
    .filter(Boolean) as DiscoveryResult["items"];

  return {
    discoveryId: discovery.id,
    recommendationId: rec.id,
    isFallback: ranked.isFallback,
    items,
  };
}
