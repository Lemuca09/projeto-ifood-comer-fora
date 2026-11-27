import { readFileSync } from "fs";
import path from "path";
import { getServerEnv } from "@/lib/env";
import { fallbackRank } from "@/ai/fallback";
import { outputGuard } from "@/guardrails/outputGuard";
import { ABUSE_LIMITS } from "@/guardrails/config";
import { CLAUDE_MODEL_RANK } from "@/ai/model";
import { callClaudeText } from "@/ai/claudeClient";
import { llmCacheKey, getLlmCache, setLlmCache } from "@/ai/llmGate";
import type { EligibleRestaurant, RankedItem } from "@/domain/types";

export const PROMPT_VERSION = "recommendation.v2";

function loadPrompt(): string {
  const file = path.join(
    process.cwd(),
    "src",
    "ai",
    "prompts",
    `${PROMPT_VERSION}.md`,
  );
  return readFileSync(file, "utf8");
}

function getCanary(): string {
  return process.env.LLM_CANARY ?? "";
}

function compactBenefit(
  b: NonNullable<Parameters<typeof rankWithAiOrFallback>[0]["benefitContext"]>,
) {
  return {
    t: b.benefitType,
    v: b.benefitValueBrl,
    min: b.minTicketBrl,
    dish: b.freeDishName ?? undefined,
    avg: b.avgTicketBrl,
  };
}

export async function rankWithAiOrFallback(params: {
  candidates: EligibleRestaurant[];
  occasion: string;
  neighborhood: string;
  partySize: number;
  preferredPriceRange?: number;
  occasionTextSafe: string;
  queryTextSafe?: string;
  benefitContext?: {
    clusterId?: string;
    clusterLabel?: string;
    benefitType?: "cupom" | "giftback" | "prato_gratis" | "nenhum";
    benefitValueBrl?: number;
    giftbackBalanceBrl?: number;
    avgTicketBrl?: number;
    minTicketBrl?: number;
    freeDishName?: string;
  };
  forceFallback?: boolean;
}): Promise<{
  items: RankedItem[];
  isFallback: boolean;
  model: string | null;
  outputGuardReason?: string;
  latencyMs?: number;
}> {
  const env = getServerEnv();
  const fallback = (reason?: string) => ({
    items: fallbackRank(
      params.candidates,
      params.occasion,
      params.preferredPriceRange,
    ),
    isFallback: true as const,
    model: null,
    outputGuardReason: reason,
  });

  if (
    params.forceFallback ||
    !env.AI_ENABLED ||
    !env.API_KEY_CLAUDE ||
    params.candidates.length === 0
  ) {
    return fallback(params.forceFallback ? "forced" : "ai_disabled");
  }

  // Limita candidatos = menos tokens de entrada; prioriza quem tem mais vaga
  const pool = [...params.candidates]
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, ABUSE_LIMITS.maxRankCandidates);

  const candidateIds = new Set(pool.map((c) => c.id));
  const compact = pool.map((c) => ({
    id: c.id,
    n: c.neighborhood,
    p: c.price_range,
    tags: c.occasion_tags.slice(0, 3),
    rem: c.remaining,
  }));

  const system = loadPrompt();
  const canary = getCanary();
  const started = Date.now();
  const benefit = params.benefitContext
    ? compactBenefit(params.benefitContext)
    : null;
  const cacheParts = [
    "rank",
    CLAUDE_MODEL_RANK,
    PROMPT_VERSION,
    params.neighborhood,
    params.occasion,
    params.partySize,
    params.preferredPriceRange ?? null,
    params.occasionTextSafe.slice(0, 120),
    params.queryTextSafe?.slice(0, 80) ?? null,
    benefit,
    compact,
  ];
  const cacheKey = llmCacheKey(cacheParts);

  const cachedText = getLlmCache(cacheKey);
  if (cachedText) {
    const guarded = outputGuard({
      rawText: cachedText,
      candidateIds,
      systemPrompt: system,
      canary,
    });
    if (guarded.ok) {
      return {
        items: guarded.items,
        isFallback: false,
        model: CLAUDE_MODEL_RANK,
        latencyMs: Date.now() - started,
      };
    }
  }

  try {
    const userPayload = {
      NAO_CONFIAVEL: {
        occ: params.occasionTextSafe.slice(0, 120),
        q: params.queryTextSafe?.slice(0, 80) ?? null,
        hood: params.neighborhood,
        party: params.partySize,
        price: params.preferredPriceRange ?? null,
        ben: benefit,
      },
      cands: compact,
      ...(canary ? { canary_interno_nao_ecoar: canary } : {}),
    };

    const text = await callClaudeText({
      system,
      user: JSON.stringify(userPayload),
      cacheParts,
      temperature: 0.15,
      maxTokens: ABUSE_LIMITS.maxOutputTokensRank,
      model: CLAUDE_MODEL_RANK,
    });

    if (!text) {
      return {
        ...fallback("throttled_or_empty"),
        latencyMs: Date.now() - started,
      };
    }

    setLlmCache(cacheKey, text);

    const guarded = outputGuard({
      rawText: text,
      candidateIds,
      systemPrompt: system,
      canary,
    });

    const latencyMs = Date.now() - started;
    if (!guarded.ok) {
      return { ...fallback(guarded.reason), latencyMs };
    }

    return {
      items: guarded.items,
      isFallback: false,
      model: CLAUDE_MODEL_RANK,
      latencyMs,
    };
  } catch {
    return { ...fallback("error_or_timeout"), latencyMs: Date.now() - started };
  }
}
