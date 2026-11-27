import type { SyntheticUser } from "@/domain/personas";
import { mulberry32, standardize } from "@/domain/analytics/math";
import {
  CLUSTER_META,
  type ClusterId,
  ensureAllBusinessClusters,
  kmeans,
  mapCentroidsToClusters,
  pca2d,
} from "@/domain/analytics/pcaKmeans";
import { multipleRegression } from "@/domain/analytics/regression";
import {
  buildRetentionCurves,
  buildSeasonalitySeries,
  currentSeasonalityContext,
} from "@/domain/analytics/seasonality";
import type { SeasonalityContext } from "@/domain/analytics/calendarDemand";
import { pickFavoriteDishes, type FavoriteDish } from "@/domain/analytics/dishes";
import {
  pickEfficientRestaurantStrategy,
  pickEfficientUserStrategy,
  type BenefitType,
} from "@/domain/analytics/strategyOptimizer";
import {
  buildFeatureImpactReport,
  type FeatureImpactReport,
} from "@/domain/analytics/featureImpact";
import type { CatalogRestaurant } from "@/services/restaurants";

export type EnrichedUser = {
  id: string;
  code: string;
  display_name: string;
  archetype: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  couponRate: number;
  netMargin: number;
  cuisine: string;
  preferredHour: string;
  favoriteDishes: FavoriteDish[];
  reviewText: string;
  sentiment: "positivo" | "neutro" | "negativo";
  frictionReason: "preco" | "demora" | "qualidade" | "nenhum";
  /** Feature store persistida */
  priceSensitivity: number;
  partySizeMode: "1" | "2" | "4+";
  comerForaVisits90d: number;
  favoriteRestaurantId: string | null;
  lifetimeMarginBrl: number;
  avgMarginPct: number;
  lastNpsScore: number;
  cluster: ClusterId;
  clusterLabel: string;
  strategy: string;
  strategyId: string;
  strategyReason: string;
  strategyRoi: number;
  pcaX: number;
  pcaY: number;
  spendBefore: number;
  spendAfter: number;
  spendDeltaPct: number;
  marginBefore: number;
  marginAfter: number;
  churnRisk: number;
  benefitType: BenefitType;
  benefitValueBrl: number;
  giftbackBalanceBrl: number;
  minTicketBrl: number;
  freeDishName: string | null;
};

export type DashboardPayload = {
  seed: number;
  generatedAt: string;
  users: EnrichedUser[];
  clusters: Array<{
    id: ClusterId;
    label: string;
    strategy: string;
    color: string;
    userSharePct: number;
    revenueSharePct: number;
    profitSharePct: number;
    count: number;
  }>;
  kpis: {
    gmvBefore: number;
    gmvAfter: number;
    gmvDeltaAbs: number;
    gmvDeltaPct: number;
    lowDemandLiftPct: number;
    newComerForaUsers: number;
    newComerForaPct: number;
    campaignCost: number;
    incrementalNetRevenue: number;
    roi: number;
    liftVsControl: number;
    redemptionRate: number;
  };
  restaurants: Array<{
    id: string;
    name: string;
    neighborhood: string;
    priceRange: number;
    gmvBefore: number;
    gmvAfter: number;
    deltaPct: number;
    lowDemandDeltaPct: number;
    idlePct: number;
    strategy: string;
    strategyReason: string;
    benefitType: BenefitType;
    strategyRoi: number;
    minTicketBrl: number;
    freeDishName: string | null;
  }>;
  strategyMix: {
    cupom: number;
    giftback: number;
    prato_gratis: number;
    nenhum: number;
  };
  regression: ReturnType<typeof multipleRegression>;
  seasonality: ReturnType<typeof buildSeasonalitySeries>;
  /** Contexto de calendário “agora” (feriado / salário) para decisões de benefício. */
  seasonalityContext: SeasonalityContext;
  retention: ReturnType<typeof buildRetentionCurves>;
  /** Impacto calculado com vs sem cada feature V2. */
  featureImpact: FeatureImpactReport;
};

/** Ruído determinístico 0..1 a partir do seed + chave (para KPIs variarem ao regenerar). */
function unitNoise(seed: number, key: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 2654435761);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Até 2 restaurantes por bairro, a partir do catálogo do banco. */
function pickPartnerRestaurants(
  catalog: CatalogRestaurant[],
  perNeighborhood = 2,
): CatalogRestaurant[] {
  const byHood = new Map<string, CatalogRestaurant[]>();
  for (const r of catalog) {
    if (!r.is_active) continue;
    const list = byHood.get(r.neighborhood) ?? [];
    if (list.length < perNeighborhood) {
      list.push(r);
      byHood.set(r.neighborhood, list);
    }
  }
  return Array.from(byHood.values()).flat();
}

const CUISINES = ["Japonesa", "Brasileira", "Italiana", "Hambúrguer", "Árabe", "Vegetariana"];
const HOURS = ["12h–14h", "19h–20h", "20h–21h30", "21h30–23h"];
const REVIEWS = [
  { text: "Preço subiu demais no salão.", sentiment: "negativo" as const, reason: "preco" as const },
  { text: "Fila longa na sexta, desisti.", sentiment: "negativo" as const, reason: "demora" as const },
  { text: "Comida ótima, volto no Comer Fora.", sentiment: "positivo" as const, reason: "nenhum" as const },
  { text: "Qualidade caiu no último pedido presencial.", sentiment: "negativo" as const, reason: "qualidade" as const },
  { text: "Voltei só porque tinha promoção no horário morto.", sentiment: "neutro" as const, reason: "preco" as const },
  { text: "Cupom com ticket mínimo fez sentido no jantar.", sentiment: "positivo" as const, reason: "nenhum" as const },
  { text: "Não precisava de desconto — só lembrete do horário.", sentiment: "positivo" as const, reason: "nenhum" as const },
];

function enrichFromPersona(u: SyntheticUser, rnd: () => number): Omit<
  EnrichedUser,
  | "cluster"
  | "clusterLabel"
  | "strategy"
  | "strategyId"
  | "strategyReason"
  | "strategyRoi"
  | "pcaX"
  | "pcaY"
  | "spendBefore"
  | "spendAfter"
  | "spendDeltaPct"
  | "marginBefore"
  | "marginAfter"
  | "churnRisk"
  | "benefitType"
  | "benefitValueBrl"
  | "giftbackBalanceBrl"
  | "minTicketBrl"
  | "freeDishName"
> {
  const frequency =
    u.user_dinein_checkins_90d +
    u.comer_fora_visits_90d * 0.35 +
    u.user_delivery_orders_90d * 0.15;
  const monetary = Number(u.user_avg_ticket_brl) * Math.max(1, u.user_dinein_checkins_90d);
  const couponRate = Number(
    Math.min(
      1,
      Math.max(
        0,
        u.coupon_redemption_rate_90d ??
          (u.archetype === "push_averse" ? 0.4 : 0.15),
      ),
    ).toFixed(3),
  );
  const recencyDays = u.user_days_since_last_dinein;
  const avgMarginPct = Number(u.avg_margin_pct ?? 16);
  const netMargin =
    u.lifetime_margin_brl > 0
      ? Number(u.lifetime_margin_brl)
      : Number((monetary * (avgMarginPct / 100)).toFixed(2));
  const cuisine =
    u.preferred_cuisine && CUISINES.includes(u.preferred_cuisine)
      ? u.preferred_cuisine
      : CUISINES[Math.floor(rnd() * CUISINES.length)];
  const preferredHour =
    u.preferred_hour_slot && HOURS.includes(u.preferred_hour_slot)
      ? u.preferred_hour_slot
      : HOURS[Math.floor(rnd() * HOURS.length)];
  const sentiment =
    u.last_sentiment ??
    (u.last_nps_score >= 8
      ? "positivo"
      : u.last_nps_score >= 5
        ? "neutro"
        : "negativo");
  const frictionReason = u.friction_reason ?? "nenhum";
  const rev =
    REVIEWS.find((r) => r.reason === frictionReason && r.sentiment === sentiment) ??
    REVIEWS.find((r) => r.reason === frictionReason) ??
    REVIEWS[Math.floor(rnd() * REVIEWS.length)];

  return {
    id: u.id,
    code: u.code,
    display_name: u.display_name,
    archetype: u.archetype,
    recencyDays,
    frequency: Number(frequency.toFixed(2)),
    monetary: Number(monetary.toFixed(2)),
    couponRate,
    netMargin,
    cuisine,
    preferredHour,
    favoriteDishes: pickFavoriteDishes(cuisine, rnd),
    reviewText: rev.text,
    sentiment,
    frictionReason,
    priceSensitivity: Number(u.price_sensitivity ?? 0.5),
    partySizeMode: u.party_size_mode ?? "2",
    comerForaVisits90d: u.comer_fora_visits_90d ?? 0,
    favoriteRestaurantId: u.favorite_restaurant_id ?? null,
    lifetimeMarginBrl: Number(u.lifetime_margin_brl ?? netMargin),
    avgMarginPct,
    lastNpsScore: u.last_nps_score ?? 7,
  };
}

export function buildAnalyticsDashboard(
  personas: SyntheticUser[],
  seed: number,
  catalogRestaurants: CatalogRestaurant[] = [],
): DashboardPayload {
  const rnd = mulberry32(seed);
  const seasonalityContext = currentSeasonalityContext();
  const base = personas.map((u) => enrichFromPersona(u, rnd));

  const features = base.map((u) => [
    u.recencyDays,
    u.frequency,
    u.monetary,
    u.couponRate,
    u.netMargin,
  ]);

  const { x: pcaX, y: pcaY } = pca2d(features);
  const { data: stdFeat } = standardize(features);

  const { labels, centroids } = kmeans(stdFeat, 4);
  const featureIndex = {
    recency: 0,
    frequency: 1,
    monetary: 2,
    couponRate: 3,
  };
  const clusterMap = mapCentroidsToClusters(centroids, featureIndex);
  const assignedClusters = ensureAllBusinessClusters(
    labels.map((l) => clusterMap[l] ?? "new_occasional"),
    stdFeat,
    featureIndex,
    0.1, // ≥10% da base em cada perfil
  );

  const users: EnrichedUser[] = base.map((u, i) => {
    const cluster = assignedClusters[i] ?? "new_occasional";
    const meta = CLUSTER_META[cluster];
    const spendBefore = u.monetary * (0.55 + rnd() * 0.2);
    const churnRisk = Math.min(
      100,
      Math.round(
        u.recencyDays * 1.2 +
          (u.sentiment === "negativo" ? 25 : 0) +
          u.couponRate * 20,
      ),
    );
    const restaurantIdlePct = 0.25 + rnd() * 0.5;

    const avgTicketBrl = Number(
      personas.find((p) => p.id === u.id)?.user_avg_ticket_brl ??
        Math.max(u.monetary / Math.max(u.frequency, 1), 35),
    );

    const picked = pickEfficientUserStrategy(
      {
        cluster,
        spendBefore,
        avgTicketBrl,
        couponRate: u.couponRate,
        priceSensitivity: u.priceSensitivity,
        recencyDays: u.recencyDays,
        frequency: u.frequency,
        monetary: u.monetary,
        churnRisk,
        sentiment: u.sentiment,
        frictionReason: u.frictionReason,
        restaurantIdlePct,
        favoriteDishes: u.favoriteDishes,
        partySizeMode: u.partySizeMode,
        comerForaVisits90d: u.comerForaVisits90d,
        avgMarginPct: u.avgMarginPct,
        seasonality: seasonalityContext,
      },
      rnd,
    );

    const spendAfter = spendBefore * (1 + picked.expectedLift);
    const marginBefore = spendBefore * (u.avgMarginPct / 100);
    const marginAfter = marginBefore + picked.expectedIncrementalMargin;

    return {
      ...u,
      cluster,
      clusterLabel: meta.label,
      strategy: picked.label,
      strategyId: picked.id,
      strategyReason: picked.reason,
      strategyRoi: picked.expectedRoi,
      pcaX: Number((pcaX[i] ?? 0).toFixed(3)),
      pcaY: Number((pcaY[i] ?? 0).toFixed(3)),
      spendBefore: Number(spendBefore.toFixed(2)),
      spendAfter: Number(spendAfter.toFixed(2)),
      spendDeltaPct: Number(
        (((spendAfter - spendBefore) / spendBefore) * 100).toFixed(1),
      ),
      marginBefore: Number(marginBefore.toFixed(2)),
      marginAfter: Number(marginAfter.toFixed(2)),
      churnRisk,
      benefitType: picked.benefitType,
      benefitValueBrl: picked.benefitValueBrl,
      giftbackBalanceBrl: picked.giftbackBalanceBrl,
      minTicketBrl: picked.minTicketBrl,
      freeDishName: picked.freeDishName,
    };
  });

  const totalUsers = users.length || 1;
  const totalRev = users.reduce((s, u) => s + u.spendAfter, 0) || 1;
  const totalProfit = users.reduce((s, u) => s + u.marginAfter, 0) || 1;

  const clusters = (Object.keys(CLUSTER_META) as ClusterId[]).map((id) => {
    const subset = users.filter((u) => u.cluster === id);
    const rev = subset.reduce((s, u) => s + u.spendAfter, 0);
    const profit = subset.reduce((s, u) => s + u.marginAfter, 0);
    return {
      id,
      label: CLUSTER_META[id].label,
      strategy: CLUSTER_META[id].strategy,
      color: CLUSTER_META[id].color,
      count: subset.length,
      userSharePct: Number(((subset.length / totalUsers) * 100).toFixed(1)),
      revenueSharePct: Number(((rev / totalRev) * 100).toFixed(1)),
      profitSharePct: Number(((profit / totalProfit) * 100).toFixed(1)),
    };
  });

  const gmvBefore = users.reduce((s, u) => s + u.spendBefore, 0);
  const gmvAfter = users.reduce((s, u) => s + u.spendAfter, 0);
  const campaignCost = users.reduce((s, u) => s + u.benefitValueBrl * 0.65, 0);
  const incrementalNetRevenue =
    users.reduce((s, u) => s + (u.marginAfter - u.marginBefore), 0);
  const controlLift = 0.04;
  const observedLift = gmvBefore ? (gmvAfter - gmvBefore) / gmvBefore : 0;

  const strategyMix = {
    cupom: users.filter((u) => u.benefitType === "cupom").length,
    giftback: users.filter((u) => u.benefitType === "giftback").length,
    prato_gratis: users.filter((u) => u.benefitType === "prato_gratis").length,
    nenhum: users.filter((u) => u.benefitType === "nenhum").length,
  };

  const clusterMix = clusters.map((c) => ({
    id: c.id,
    userSharePct: c.userSharePct,
  }));

  /** Parceiros: registros reais do banco (até 2 por bairro). Sem nomes inventados. */
  const partnerCatalog = pickPartnerRestaurants(catalogRestaurants);
  const restaurants = partnerCatalog.map((rest, i) => {
    const priceRange = rest.price_range || 2;
    const before = 7200 + i * 850 + rnd() * 1100 + priceRange * 400;
    const idleFromDb =
      typeof rest.idle_capacity_pct === "number"
        ? Math.min(0.95, Math.max(0.05, rest.idle_capacity_pct / 100))
        : null;
    const idlePct = Number(
      (idleFromDb ?? 0.28 + rnd() * 0.45).toFixed(2),
    );
    const lowDemandDeltaPct = Number((12 + rnd() * 18).toFixed(1));
    const sampleDish =
      users[Math.floor(rnd() * users.length)]?.favoriteDishes[0] ??
      pickFavoriteDishes(CUISINES[i % CUISINES.length], rnd, 1)[0];
    const restStrategy = pickEfficientRestaurantStrategy({
      neighborhood: rest.neighborhood,
      lowDemandDeltaPct,
      idlePct,
      nearbyClusterMix: clusterMix,
      topDishName: sampleDish?.name,
      topDishPriceBrl: sampleDish?.typicalPriceBrl,
      seasonality: seasonalityContext,
    });
    const after =
      before *
      (1 +
        Math.max(
          0.04,
          restStrategy.expectedLift * (0.85 + rnd() * 0.3),
        ));
    return {
      id: rest.id,
      name: rest.name,
      neighborhood: rest.neighborhood,
      priceRange,
      gmvBefore: Number(before.toFixed(2)),
      gmvAfter: Number(after.toFixed(2)),
      deltaPct: Number((((after - before) / before) * 100).toFixed(1)),
      lowDemandDeltaPct,
      idlePct,
      strategy: restStrategy.label,
      strategyReason: restStrategy.reason,
      benefitType: restStrategy.benefitType,
      strategyRoi: restStrategy.expectedRoi,
      minTicketBrl: restStrategy.minTicketBrl,
      freeDishName: restStrategy.freeDishName,
    };
  });

  // Alvo = margem incremental (depois − antes), não margem absoluta.
  // Evita tautologia "quanto gasta → lucro" (monetário colado em marginAfter).
  const X = users.map((u) => [
    u.frequency,
    u.couponRate,
    u.recencyDays,
    u.churnRisk,
    u.benefitValueBrl,
    u.priceSensitivity,
    u.comerForaVisits90d,
    u.lastNpsScore,
  ]);
  const y = users.map((u) => u.marginAfter - u.marginBefore);
  const regression = multipleRegression(X, y, [
    "frequencia",
    "taxa_cupom",
    "recencia_dias",
    "risco_churn",
    "beneficio_brl",
    "sensibilidade_preco",
    "visitas_comer_fora",
    "nps",
  ]);

  // Conversão sintética à vertical Comer Fora (varia de verdade com o seed).
  // Antes: delivery_focused && delta>10 → fixo em ~40 (= 1/5 da base).
  const newComerForaUsers = users.filter((u) => {
    // Já usa Comer Fora com frequência → não conta como "novo"
    if (u.comerForaVisits90d >= 2) return false;
    const candidate =
      u.comerForaVisits90d === 0 ||
      u.archetype === "delivery_focused" ||
      (u.cluster === "new_occasional" && u.frequency < 3.5);
    if (!candidate) return false;

    const baseP =
      u.benefitType === "nenhum"
        ? 0.1
        : u.benefitType === "cupom"
          ? 0.32
          : u.benefitType === "giftback"
            ? 0.42
            : 0.48; // prato_gratis
    const liftBoost = Math.min(Math.max(u.spendDeltaPct, 0) / 120, 0.28);
    const coldStart = u.comerForaVisits90d === 0 ? 0.08 : 0;
    const p = Math.min(0.82, baseP + liftBoost + coldStart);
    return unitNoise(seed, u.id) < p;
  }).length;

  return {
    seed,
    generatedAt: new Date().toISOString(),
    users,
    clusters,
    kpis: {
      gmvBefore: Number(gmvBefore.toFixed(2)),
      gmvAfter: Number(gmvAfter.toFixed(2)),
      gmvDeltaAbs: Number((gmvAfter - gmvBefore).toFixed(2)),
      gmvDeltaPct: Number((((gmvAfter - gmvBefore) / (gmvBefore || 1)) * 100).toFixed(1)),
      lowDemandLiftPct: Number(
        (
          restaurants.length
            ? restaurants.reduce((s, r) => s + r.lowDemandDeltaPct, 0) /
              restaurants.length
            : 0
        ).toFixed(1),
      ),
      newComerForaUsers,
      newComerForaPct: Number(((newComerForaUsers / totalUsers) * 100).toFixed(1)),
      campaignCost: Number(campaignCost.toFixed(2)),
      incrementalNetRevenue: Number(incrementalNetRevenue.toFixed(2)),
      roi: Number(
        (
          (incrementalNetRevenue - campaignCost) /
          Math.max(campaignCost, 1)
        ).toFixed(2),
      ),
      liftVsControl: Number(((observedLift - controlLift) * 100).toFixed(1)),
      redemptionRate: Number((0.42 + (seed % 20) / 100).toFixed(2)),
    },
    restaurants,
    strategyMix,
    regression,
    seasonality: buildSeasonalitySeries(seed),
    seasonalityContext,
    retention: buildRetentionCurves(seed),
    featureImpact: buildFeatureImpactReport(
      users.map((u) => ({
        id: u.id,
        archetype: u.archetype,
        recencyDays: u.recencyDays,
        frequency: u.frequency,
        monetary: u.monetary,
        churnRisk: u.churnRisk,
        priceSensitivity: u.priceSensitivity,
        partySizeMode: u.partySizeMode,
        comerForaVisits90d: u.comerForaVisits90d,
        frictionReason: u.frictionReason,
        avgMarginPct: u.avgMarginPct,
        lastNpsScore: u.lastNpsScore,
        benefitType: u.benefitType,
        benefitValueBrl: u.benefitValueBrl,
        cluster: u.cluster,
      })),
      seed,
      seasonalityContext,
    ),
  };
}
