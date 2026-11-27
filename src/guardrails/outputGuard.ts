import { aiRecommendationSchema } from "@/ai/schemas";
import { REASON_CODES } from "@/lib/constants";
import type { RankedItem } from "@/domain/types";

export type OutputGuardResult =
  | { ok: true; items: RankedItem[] }
  | { ok: false; reason: string };

const FORBIDDEN_FACT_RE =
  /\b(gr[aá]tis|free|garantido|R\$\s*\d|pre[cç]o|hor[aá]rio|dispon[ií]vel|lotado)\b/i;

const HTML_RE = /<\s*(script|iframe|img|svg|object|a)\b/i;
const URL_RE = /https?:\/\//i;

function ngrams(text: string, n = 8): Set<string> {
  const norm = text.toLowerCase().replace(/\s+/g, " ");
  const set = new Set<string>();
  for (let i = 0; i <= norm.length - n; i++) set.add(norm.slice(i, i + n));
  return set;
}

function overlapRatio(a: string, b: string): number {
  const A = ngrams(a);
  const B = ngrams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  return hit / A.size;
}

function canaryLeak(text: string, canary: string): boolean {
  if (!canary) return false;
  const variants = [
    canary,
    canary.split("").reverse().join(""),
    Buffer.from(canary).toString("base64"),
    canary.split("").join(" "),
  ];
  const lower = text.toLowerCase();
  return variants.some((v) => v && lower.includes(v.toLowerCase()));
}

/**
 * Valida saída do modelo antes de qualquer render.
 * Preço/horário/disponibilidade NÃO vêm do modelo — só IDs + motivo.
 */
export function outputGuard(params: {
  rawText: string;
  candidateIds: Set<string>;
  systemPrompt: string;
  canary: string;
}): OutputGuardResult {
  const { rawText, candidateIds, systemPrompt, canary } = params;

  if (canaryLeak(rawText, canary)) {
    return { ok: false, reason: "canary" };
  }
  if (HTML_RE.test(rawText) || URL_RE.test(rawText)) {
    return { ok: false, reason: "html_or_url" };
  }
  if (FORBIDDEN_FACT_RE.test(rawText)) {
    return { ok: false, reason: "commercial_claim" };
  }
  if (overlapRatio(systemPrompt, rawText) > 0.35) {
    return { ok: false, reason: "prompt_overlap" };
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
