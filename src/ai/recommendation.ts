import { readFileSync } from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerEnv } from "@/lib/env";
import { fallbackRank } from "@/ai/fallback";
import { outputGuard } from "@/guardrails/outputGuard";
import { ABUSE_LIMITS } from "@/guardrails/config";
import { GEMINI_MODEL } from "@/ai/model";
import {
  geminiCacheKey,
  getGeminiCache,
  setGeminiCache,
  withGeminiThrottle,
} from "@/ai/geminiGate";
import type { EligibleRestaurant, RankedItem } from "@/domain/types";

export const PROMPT_VERSION = "recommendation.v2";

function loadPrompt(): string {
  const file = path.join(process.cwd(), "src", "ai", "prompts", `${PROMPT_VERSION}.md`);
  return readFileSync(file, "utf8");
}

function getCanary(): string {
  return process.env.LLM_CANARY ?? "";
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
    !env.API_KEY_GEMINI ||
    params.candidates.length === 0
  ) {
    return fallback(params.forceFallback ? "forced" : "ai_disabled");
  }

  const candidateIds = new Set(params.candidates.map((c) => c.id));
  const compact = params.candidates.map((c) => ({
    restaurant_id: c.id,
    neighborhood: c.neighborhood,
    price_range: c.price_range,
    occasion_tags: c.occasion_tags,
    remaining: c.remaining,
  }));

  const system = loadPrompt();
  const canary = getCanary();
  const started = Date.now();
  const cacheKey = geminiCacheKey([
    "rank",
    GEMINI_MODEL,
    PROMPT_VERSION,
    params.neighborhood,
    params.occasion,
    params.partySize,
    params.preferredPriceRange ?? null,
    params.occasionTextSafe,
    params.queryTextSafe ?? null,
    params.benefitContext ?? null,
    compact,
  ]);

  const cachedText = getGeminiCache(cacheKey);
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
        model: GEMINI_MODEL,
        latencyMs: Date.now() - started,
      };
    }
  }

  try {
    const text = await withGeminiThrottle(async () => {
      const genAI = new GoogleGenerativeAI(env.API_KEY_GEMINI!);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: ABUSE_LIMITS.maxOutputTokens,
          temperature: 0.2,
        },
      });

      const userPayload = {
        NAO_CONFIAVEL: {
          occasion: params.occasionTextSafe,
          query: params.queryTextSafe ?? null,
          neighborhood: params.neighborhood,
          party_size: params.partySize,
          preferred_price_range: params.preferredPriceRange ?? null,
          beneficio: params.benefitContext ?? null,
        },
        candidatos: compact,
        ...(canary ? { canary_interno_nao_ecoar: canary } : {}),
      };

      const result = await Promise.race([
        model.generateContent([
          { text: system },
          { text: JSON.stringify(userPayload) },
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ABUSE_LIMITS.timeoutMs),
        ),
      ]);

      return result.response.text()?.trim() || null;
    });

    if (!text) {
      return { ...fallback("throttled_or_empty"), latencyMs: Date.now() - started };
    }

    setGeminiCache(cacheKey, text);

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
      model: GEMINI_MODEL,
      latencyMs,
    };
  } catch {
    return { ...fallback("error_or_timeout"), latencyMs: Date.now() - started };
  }
}
