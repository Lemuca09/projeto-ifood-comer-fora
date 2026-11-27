import type { SupabaseClient } from "@supabase/supabase-js";
import { REASON_LABELS } from "@/lib/constants";
import { sanitizeUserText, stripLikelyPii } from "@/lib/sanitize";
import { inputGuard } from "@/guardrails/inputGuard";
import { secureLog } from "@/guardrails/secureLog";
import { findEligibleRestaurants } from "@/services/catalog";
import { trackEvent } from "@/services/analytics";
import { PROMPT_VERSION, rankWithAiOrFallback } from "@/ai/recommendation";
import { generateDineConciergeAnswer } from "@/ai/dineConcierge";
import { runConciergePreLlm } from "@/guardrails/conciergePreLlm";
import { inferCuisine } from "@/domain/dineOut/menu";
import type { DiscoveryInput } from "@/validations/discovery";
import type { DiscoveryResult, ReasonCode } from "@/domain/types";

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

  // Texto livre do concierge: limpa PII; NER ajusta elegibilidade antes do catálogo.
  const querySafe = input.queryText
    ? stripLikelyPii(sanitizeUserText(input.queryText, 400))
    : undefined;

  let effectiveNeighborhood = input.neighborhood;
  let effectivePartySize = input.partySize;
  let preferredPriceRange = input.preferredPriceRange;

  if (querySafe) {
    const pre = runConciergePreLlm(querySafe);
    await secureLog(admin, {
      category: "input_guard",
      decisao: pre.guard.decisao,
      ruleIds: [...pre.ruleIds, "query_text"],
      score: pre.guard.score,
      versao: "inputGuard.v1+conciergePreLlm",
      sessionId: userId,
    });
    if (pre.entities.neighborhood) {
      effectiveNeighborhood = pre.entities.neighborhood;
    }
    if (pre.entities.partySize) {
      effectivePartySize = pre.entities.partySize;
    }
    if (!preferredPriceRange && pre.entities.priceHint) {
      preferredPriceRange =
        pre.entities.priceHint === "baixo"
          ? 1
          : pre.entities.priceHint === "alto"
            ? 4
            : 2;
    }
  }

  const eligible = await findEligibleRestaurants(admin, {
    neighborhood: effectiveNeighborhood,
    partySize: effectivePartySize,
    requestedFor: input.requestedFor,
    preferredPriceRange,
  });

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

  const conversational = input.conversational === true;
  const effectiveInput: DiscoveryInput = {
    ...input,
    neighborhood: effectiveNeighborhood,
    partySize: effectivePartySize,
    preferredPriceRange,
    queryText: querySafe,
  };

  const ranked = conversational
    ? null
    : await rankWithAiOrFallback({
        candidates: eligible,
        occasion: effectiveInput.occasion,
        neighborhood: effectiveNeighborhood,
        partySize: effectivePartySize,
        preferredPriceRange,
        occasionTextSafe: guard.textoSeguro,
        queryTextSafe: querySafe,
        benefitContext: input.benefitContext,
        forceFallback,
      });

  const concierge = conversational
    ? await generateDineConciergeAnswer({
        candidates: eligible,
        input: effectiveInput,
        forceFallback,
      })
    : null;

  if (concierge?.blockedByGuard) {
    await secureLog(admin, {
      category: "input_guard",
      decisao: "bloquear",
      ruleIds: concierge.guardRuleIds ?? ["concierge_pre_llm"],
      versao: "conciergePreLlm.v1",
      sessionId: userId,
    });
  }

  if (ranked?.outputGuardReason) {
    await secureLog(admin, {
      category: "output_guard",
      decisao: "fallback",
      ruleIds: [ranked.outputGuardReason],
      versao: "outputGuard.v1",
      latenciaMs: ranked.latencyMs,
      sessionId: userId,
    });
  }

  const isFallback = conversational
    ? (concierge?.isFallback ?? true)
    : (ranked?.isFallback ?? true);

  await secureLog(admin, {
    category: "ai",
    decisao: isFallback ? "fallback" : "model",
    versao: conversational
      ? isFallback
        ? undefined
        : "dine-concierge.v2"
      : isFallback
        ? undefined
        : PROMPT_VERSION,
    latenciaMs: ranked?.latencyMs,
    sessionId: userId,
  });

  const byId = new Map(eligible.map((e) => [e.id, e]));
  const groundById = new Map(
    (concierge?.ground ?? []).map((g) => [g.id, g]),
  );

  let rankedItems = ranked?.items ?? [];
  if (conversational && concierge) {
    rankedItems = concierge.orderedIds
      .map((id, idx) => {
        if (!byId.has(id)) return null;
        const g = groundById.get(id);
        const reason_code: ReasonCode = g?.matchCulinaria
          ? "GOOD_MATCH"
          : g && g.promoPct > 0
            ? "PRICE_MATCH"
            : "AVAILABILITY";
        return {
          restaurant_id: id,
          reason_code,
          rank: idx + 1,
        };
      })
      .filter(Boolean) as Array<{
      restaurant_id: string;
      reason_code: ReasonCode;
      rank: number;
    }>;
  }

  const { data: rec, error: rErr } = await admin
    .from("recommendations")
    .insert({
      discovery_id: discovery.id,
      model: conversational
        ? concierge && !concierge.isFallback
          ? "claude-concierge"
          : null
        : (ranked?.model ?? null),
      prompt_version: isFallback
        ? null
        : conversational
          ? "dine-concierge.v1"
          : PROMPT_VERSION,
      is_fallback: isFallback,
    })
    .select("id")
    .single();

  if (rErr || !rec) throw rErr ?? new Error("recommendation insert failed");

  if (rankedItems.length) {
    const { error: iErr } = await admin.from("recommendation_items").insert(
      rankedItems.map((item) => ({
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
      is_fallback: isFallback,
      neighborhood: input.neighborhood,
      conversational,
    },
  });

  const items = rankedItems
    .map((item) => {
      const restaurant = byId.get(item.restaurant_id);
      if (!restaurant) return null;
      const g = groundById.get(item.restaurant_id);
      const slotsIso =
        g?.slotsIso ?? restaurant.slots.slice(0, 4).map((s) => s.starts_at);
      return {
        rank: item.rank,
        reason_code: item.reason_code,
        reason_label:
          REASON_LABELS[item.reason_code] ??
          (item.rank === 1 ? "Combina com você agora" : "Boa alternativa"),
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
          typical_wait_min: restaurant.typical_wait_min ?? null,
          idle_capacity_pct: restaurant.idle_capacity_pct ?? null,
          promo_discount_pct: restaurant.promo_discount_pct ?? null,
        },
        next_slot: restaurant.slots[0] ?? null,
        available_slots: slotsIso,
        cuisine: g?.culinaria ?? inferCuisine(restaurant.name),
        promo_discount_pct: restaurant.promo_discount_pct ?? null,
      };
    })
    .filter(Boolean) as DiscoveryResult["items"];

  return {
    discoveryId: discovery.id,
    recommendationId: rec.id,
    isFallback,
    answer: concierge?.answer,
    answerIsFallback: concierge?.isFallback,
    nowLocal: concierge?.nowLocal,
    items,
  };
}
