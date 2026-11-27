import type { EligibleRestaurant, RankedItem, ReasonCode } from "@/domain/types";

/** Ordenação determinística sem LLM. */
export function fallbackRank(
  candidates: EligibleRestaurant[],
  occasion: string,
  preferredPriceRange?: number,
): RankedItem[] {
  const scored = candidates.map((c) => {
    let score = 0;
    let reason: ReasonCode = "NEARBY";

    if (c.occasion_tags?.includes(occasion)) {
      score += 40;
      reason = "GOOD_MATCH";
    }
    if (preferredPriceRange && c.price_range <= preferredPriceRange) {
      score += 30;
      if (reason === "NEARBY" || reason === "GOOD_MATCH") reason = "PRICE_MATCH";
    } else if (!preferredPriceRange) {
      score += 10;
    } else if (preferredPriceRange && c.price_range > preferredPriceRange) {
      score -= 15; // evita estourar ticket com giftback/cupom
    }
    if (c.remaining >= 4) {
      score += 20;
      if (reason === "NEARBY") reason = "AVAILABILITY";
    }
    score += Math.max(0, 10 - c.price_range);

    return { c, score, reason };
  });

  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));

  return scored.slice(0, 3).map((s, i) => ({
    restaurant_id: s.c.id,
    reason_code: s.reason,
    rank: i + 1,
  }));
}
