import type { DashboardPayload, EnrichedUser } from "@/services/analyticsEngine";
import { benefitCopy } from "@/lib/benefitCopy";
import { freeDishForRestaurant } from "@/domain/dineOut/menu";

export type ClientRecoCard = {
  restaurantId: string;
  name: string;
  neighborhood: string;
  description: string | null;
  visitProbabilityPct: number;
  benefitTitle: string;
  benefitDetail: string;
  reasonLabel: string | null;
  isWinback: boolean;
};

export type ClientHistoryCard = {
  restaurantId: string;
  name: string;
  neighborhood: string;
  description: string | null;
  priceRange: number;
  typicalWaitMin: number | null;
  promoDiscountPct: number | null;
  lastVisitDaysAgo: number;
  visits90d: number;
  losingInterest: boolean;
  isFavorite: boolean;
  winbackTitle: string | null;
  winbackDetail: string | null;
};

type CatalogLike = {
  id: string;
  name: string;
  neighborhood: string;
  description?: string | null;
  price_range?: number;
  typical_wait_min?: number | null;
  promo_discount_pct?: number | null;
};

/** Recomendações a partir de restaurantes do banco (ex.: decision bootstrap). */
export function buildClientRecommendationsFromCatalog(
  restaurants: Array<
    CatalogLike & {
      score?: number;
      reason_label?: string;
      typical_wait_min?: number | null;
    }
  >,
  user: EnrichedUser,
): ClientRecoCard[] {
  const winbackUser =
    user.cluster === "churn_risk" ||
    user.churnRisk >= 45 ||
    user.lastNpsScore <= 5 ||
    (user.frictionReason !== "nenhum" && user.sentiment !== "positivo");

  return restaurants.map((r, i) => {
    const isFavorite = !!user.favoriteRestaurantId && r.id === user.favoriteRestaurantId;
    const scorePct =
      typeof r.score === "number"
        ? Math.min(96, Math.max(28, Math.round(r.score)))
        : Math.min(
            96,
            42 + ((user.code.charCodeAt(0) + i * 13) % 40) + (isFavorite ? 12 : 0),
          );
    const dish =
      user.benefitType === "prato_gratis"
        ? freeDishForRestaurant(r.name, r.description, user.code)
        : null;
    const copy = benefitCopy({
      benefitType: user.benefitType,
      benefitValueBrl: user.benefitValueBrl,
      minTicketBrl: user.minTicketBrl,
      freeDishName: dish?.name ?? user.freeDishName,
      strategy: user.strategy,
    });
    return {
      restaurantId: r.id,
      name: isFavorite ? `${r.name} ★` : r.name,
      neighborhood: r.neighborhood,
      description: r.description ?? null,
      visitProbabilityPct: scorePct,
      benefitTitle: copy.title,
      benefitDetail:
        user.minTicketBrl > 0
          ? `${copy.detail} · libera com gastos acima de R$ ${user.minTicketBrl.toFixed(0)}`
          : copy.detail,
      reasonLabel: r.reason_label ?? null,
      isWinback: winbackUser && i < 2,
    };
  });
}

/**
 * @deprecated Prefer buildClientRecommendationsFromCatalog com dados do banco.
 * Mantido para métricas/partner que ainda usam dash.restaurants.
 */
export function buildClientRecommendations(
  dash: DashboardPayload,
  user: EnrichedUser,
): ClientRecoCard[] {
  return buildClientRecommendationsFromCatalog(
    dash.restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      neighborhood: r.neighborhood,
      description: null,
      score: Math.round(38 + r.strategyRoi * 8),
    })),
    user,
  );
}

export function buildClientHistoryFromCatalog(
  restaurants: CatalogLike[],
  user: EnrichedUser,
): ClientHistoryCard[] {
  const losing = user.cluster === "churn_risk" || user.churnRisk >= 45;
  const favoriteId = user.favoriteRestaurantId;
  const historyPool = [...restaurants]
    .sort((a, b) => {
      if (favoriteId && a.id === favoriteId) return -1;
      if (favoriteId && b.id === favoriteId) return 1;
      return 0;
    })
    .slice(0, 5);

  const cards = historyPool.map((r, i) => {
    const isFavorite = !!favoriteId && r.id === favoriteId;
    const days = Math.max(
      3,
      Math.round(
        user.recencyDays *
          (isFavorite ? 1.15 : 0.4 + ((i + 1) % 4) * 0.35),
      ),
    );
    const visits = Math.max(
      isFavorite ? 2 : 1,
      Math.round(
        (user.comerForaVisits90d || user.frequency) /
          (isFavorite ? 1.15 : i + 2),
      ),
    );
    const favoriteChurn = isFavorite && days >= 14;
    const lowRecurrence = visits <= 2 || days >= 21;
    const showWinback =
      losing ||
      lowRecurrence ||
      favoriteChurn ||
      (user.frictionReason !== "nenhum" && user.lastNpsScore <= 6);
    // Sempre o benefício do otimizador (um tipo só). Winback só destaca, não troca o tipo.
    const offerWinback = showWinback && user.benefitType !== "nenhum";
    const dish =
      user.benefitType === "prato_gratis"
        ? freeDishForRestaurant(r.name, r.description, `${user.code}:wb`)
        : null;
    const copy = benefitCopy({
      benefitType: offerWinback ? user.benefitType : "nenhum",
      benefitValueBrl: offerWinback ? user.benefitValueBrl : 0,
      minTicketBrl: offerWinback ? user.minTicketBrl : 0,
      freeDishName: dish?.name ?? user.freeDishName,
    });
    const frictionLabel =
      user.frictionReason === "preco"
        ? "preço"
        : user.frictionReason === "demora"
          ? "demora"
          : user.frictionReason === "qualidade"
            ? "qualidade"
            : null;
    return {
      restaurantId: r.id,
      name: isFavorite ? `${r.name} ★` : r.name,
      neighborhood: r.neighborhood,
      description: r.description ?? null,
      priceRange: r.price_range ?? 2,
      typicalWaitMin:
        typeof r.typical_wait_min === "number" ? r.typical_wait_min : null,
      promoDiscountPct:
        typeof r.promo_discount_pct === "number" ? r.promo_discount_pct : null,
      lastVisitDaysAgo: days,
      visits90d: visits,
      losingInterest: showWinback,
      isFavorite,
      winbackTitle: offerWinback ? copy.title : null,
      winbackDetail: offerWinback
        ? `Reativação${frictionLabel ? ` · atrito: ${frictionLabel}` : ""}${
            isFavorite ? " · favorito" : ""
          } · ${copy.detail}`
        : null,
    };
  });
  return cards.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
}

export function buildClientHistory(
  dash: DashboardPayload,
  user: EnrichedUser,
): ClientHistoryCard[] {
  return buildClientHistoryFromCatalog(dash.restaurants, user);
}
