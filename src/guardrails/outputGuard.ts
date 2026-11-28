import { aiRecommendationSchema } from "@/ai/schemas";
import { REASON_CODES } from "@/lib/constants";
import type { RankedItem } from "@/domain/types";
import { rawModelTextSafe } from "@/guardrails/textSafety";

export type OutputGuardResult =
  | { ok: true; items: RankedItem[] }
  | { ok: false; reason: string };

const FORBIDDEN_FACT_RE =
  /\b(gr[aá]tis|free|garantido|R\$\s*\d|pre[cç]o|hor[aá]rio|dispon[ií]vel|lotado)\b/i;

/**
 * Valida saída do modelo antes de qualquer render.
 * Preço/horário/disponibilidade NÃO vêm do modelo - só IDs + motivo.
 */
export function outputGuard(params: {
  rawText: string;
  candidateIds: Set<string>;
  systemPrompt: string;
  canary: string;
}): OutputGuardResult {
  const { rawText, candidateIds, systemPrompt, canary } = params;

  const safety = rawModelTextSafe({ rawText, canary, systemPrompt });
  if (!safety.ok) {
    return { ok: false, reason: safety.reason };
  }
  if (FORBIDDEN_FACT_RE.test(rawText)) {
    return { ok: false, reason: "commercial_claim" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const parsed = aiRecommendationSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, reason: "schema" };
  }

  const seen = new Set<string>();
  const items: RankedItem[] = [];
  for (const [i, item] of parsed.data.recommendations.entries()) {
    if (!candidateIds.has(item.restaurant_id)) {
      return { ok: false, reason: "unknown_id" };
    }
    if (seen.has(item.restaurant_id)) {
      return { ok: false, reason: "duplicate_id" };
    }
    if (!(REASON_CODES as readonly string[]).includes(item.codigoMotivo)) {
      return { ok: false, reason: "bad_reason" };
    }
    seen.add(item.restaurant_id);
    items.push({
      restaurant_id: item.restaurant_id,
      reason_code: item.codigoMotivo,
      rank: i + 1,
    });
  }

  return { ok: true, items };
}
