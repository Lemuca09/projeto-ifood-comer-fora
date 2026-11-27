import type { DashboardPayload, EnrichedUser } from "@/services/analyticsEngine";
import { benefitCopy } from "@/lib/benefitCopy";

export type ClientRecoCard = {
  restaurantId: string;
  name: string;
  neighborhood: string;
  visitProbabilityPct: number;
  benefitTitle: string;
  benefitDetail: string;
  strategy: string;
  clusterLabel: string;
  isWinback: boolean;
};

export type ClientHistoryCard = {
  restaurantId: string;
  name: string;
  neighborhood: string;
  lastVisitDaysAgo: number;
  visits90d: number;
  losingInterest: boolean;
  isFavorite: boolean;
  winbackTitle: string | null;
  winbackDetail: string | null;
};

function frictionWinbackBenefit(
  user: EnrichedUser,
): "cupom" | "giftback" | "prato_gratis" | "nenhum" {
  if (user.frictionReason === "preco") return "cupom";
  if (user.frictionReason === "qualidade") return "prato_gratis";
  if (user.frictionReason === "demora") return "giftback";
  if (user.benefitType === "nenhum") return "cupom";
  return user.benefitType;
}

export function buildClientRecommendations(
  dash: DashboardPayload,
  user: EnrichedUser,
): ClientRecoCard[] {
  const winbackUser =
    user.cluster === "churn_risk" ||
    user.churnRisk >= 45 ||
    user.lastNpsScore <= 5 ||
    (user.frictionReason !== "nenhum" && user.sentiment !== "positivo");

  return dash.restaurants
    .map((r, i) => {
      const cuisineBoost = user.cuisine
        ? r.name.toLowerCase().includes(user.cuisine.slice(0, 4).toLowerCase())
          ? 8
          : 3
        : 0;
      const hourBoost = /12h|19h|20h|21h/i.test(user.preferredHour)
        ? r.idlePct > 0.4
          ? 9
          : 4
        : r.idlePct > 0.4
          ? 7
          : 0;
      const favoriteBoost =
        user.favoriteRestaurantId && i === 0 ? 12 : 0;
      const base =
        38 +
        ((user.code.charCodeAt(0) + i * 17) % 35) +
        Math.round(r.strategyRoi * 4) +
        cuisineBoost +
        hourBoost +
        favoriteBoost;
      const copy = benefitCopy({
        benefitType: r.benefitType,
        benefitValueBrl:
          r.benefitType === "nenhum"
            ? 0
            : Math.max(12, Math.round((r.minTicketBrl || 100) * 0.18)),
        minTicketBrl: r.minTicketBrl,
        freeDishName: r.freeDishName,
        strategy: r.strategy,
      });
      return {
        restaurantId:
          user.favoriteRestaurantId && i === 0
            ? user.favoriteRestaurantId
            : `rest-${r.neighborhood}-${i}`,
        name:
          i === 0 && user.favoriteRestaurantId
            ? `${r.name} ★`
            : r.name,
        neighborhood: r.neighborhood,
        visitProbabilityPct: Math.min(96, Math.round(base)),
        benefitTitle: copy.title,
        benefitDetail:
          r.minTicketBrl > 0
            ? `${r.strategyReason} · libera com gastos acima de R$ ${r.minTicketBrl.toFixed(0)}`
            : r.strategyReason,
        strategy: r.strategy,
        clusterLabel: user.clusterLabel,
        isWinback: winbackUser && i < 2,
      };
    })
    .sort((a, b) => b.visitProbabilityPct - a.visitProbabilityPct)
    .slice(0, 6);
}

export function buildClientHistory(
  dash: DashboardPayload,
  user: EnrichedUser,
): ClientHistoryCard[] {
  const losing = user.cluster === "churn_risk" || user.churnRisk >= 45;
  const cards = dash.restaurants.slice(0, 5).map((r, i) => {
    const isFavorite = !!user.favoriteRestaurantId && i === 0;
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
    const winBenefit = frictionWinbackBenefit(user);
    const copy = benefitCopy({
      benefitType: showWinback ? winBenefit : "nenhum",
      benefitValueBrl: showWinback ? Math.max(user.benefitValueBrl, 18) : 0,
      minTicketBrl: showWinback ? Math.max(user.minTicketBrl, 80) : 0,
      freeDishName: user.freeDishName,
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
      restaurantId: isFavorite
        ? user.favoriteRestaurantId!
        : `hist-${r.neighborhood}-${i}`,
      name: isFavorite ? `${r.name} ★` : r.name,
      neighborhood: r.neighborhood,
      lastVisitDaysAgo: days,
      visits90d: visits,
      losingInterest: showWinback,
      isFavorite,
      winbackTitle: showWinback ? copy.title : null,
      winbackDetail: showWinback
        ? `Reativação${frictionLabel ? ` · atrito: ${frictionLabel}` : ""}${
            isFavorite ? " · favorito" : ""
          } · ${r.neighborhood} · ${copy.detail}`
        : null,
    };
  });
  return cards.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
}
