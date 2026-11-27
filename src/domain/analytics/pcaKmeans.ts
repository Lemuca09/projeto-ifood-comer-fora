import { covariance, mulVec, powerIteration, standardize } from "@/domain/analytics/math";

export type ClusterId =
  | "vip_organic"
  | "loyal_price_sensitive"
  | "churn_risk"
  | "new_occasional";

export const CLUSTER_META: Record<
  ClusterId,
  { label: string; blurb: string; strategy: string; color: string }
> = {
  vip_organic: {
    label: "VIPs Orgânicos",
    blurb: "Gasta bem e quase não usa cupom - cuidado para não ‘ensinar’ desconto.",
    strategy: "Preferir lembrete ou giftback leve (o otimizador decide)",
    color: "#ea1d2c",
  },
  loyal_price_sensitive: {
    label: "Fiéis Sensíveis a Preço",
    blurb: "Volta com frequência, mas costuma responder a promoção.",
    strategy: "Cupom com valor mínimo de conta (o otimizador decide)",
    color: "#f5a623",
  },
  churn_risk: {
    label: "Perdendo Interesse",
    blurb: "Já foi um bom cliente e faz tempo que não volta ao salão.",
    strategy: "Reativação se o histórico valer o investimento (o otimizador decide)",
    color: "#3f8efc",
  },
  new_occasional: {
    label: "Novos / Ocasionais",
    blurb: "Poucas visitas ainda - precisa criar hábito no Comer Fora.",
    strategy: "Prato grátis / giftback progressivo / 1ª visita (o otimizador decide)",
    color: "#50a773",
  },
};

export function pca2d(features: number[][]): { x: number[]; y: number[]; loadings: number[][] } {
  if (!features.length) return { x: [], y: [], loadings: [] };
  const { data } = standardize(features);
  const cov = covariance(data);
  const v1 = powerIteration(cov);
  // deflação simples para 2º componente
  const lambda1 = v1.reduce((a, vi, i) => a + vi * mulVec(cov, v1)[i], 0);
  const cov2 = cov.map((row, i) =>
    row.map((c, j) => c - lambda1 * v1[i] * v1[j]),
  );
  const v2 = powerIteration(cov2);
  const x = data.map((row) => row.reduce((a, v, i) => a + v * v1[i], 0));
  const y = data.map((row) => row.reduce((a, v, i) => a + v * v2[i], 0));
  return { x, y, loadings: [v1, v2] };
}

export function kmeans(
  points: number[][],
  k: number,
  maxIter = 30,
): { labels: number[]; centroids: number[][] } {
  if (!points.length) return { labels: [], centroids: [] };
  const dim = points[0].length;
  const centroids: number[][] = [];
  // init: espalhar pelos quantis
  for (let c = 0; c < k; c++) {
    const idx = Math.min(points.length - 1, Math.floor((c + 0.5) * (points.length / k)));
    centroids.push([...points[idx]]);
  }

  let labels = points.map(() => 0);
  for (let iter = 0; iter < maxIter; iter++) {
    labels = points.map((p) => {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = p.reduce((a, v, i) => a + (v - centroids[c][i]) ** 2, 0);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    });
    const sums = Array.from({ length: k }, () => Array(dim).fill(0));
    const counts = Array(k).fill(0);
    points.forEach((p, i) => {
      const c = labels[i];
      counts[c]++;
      for (let j = 0; j < dim; j++) sums[c][j] += p[j];
    });
    for (let c = 0; c < k; c++) {
      if (!counts[c]) continue;
      centroids[c] = sums[c].map((s) => s / counts[c]);
    }
  }
  return { labels, centroids };
}

const BUSINESS_CLUSTER_ORDER: ClusterId[] = [
  "vip_organic",
  "loyal_price_sensitive",
  "churn_risk",
  "new_occasional",
];

/**
 * Score de quão bem um centroide (features padronizadas) combina com cada
 * perfil de negócio. Maior = melhor fit.
 */
function businessFitScores(
  c: number[],
  featureIndex: {
    recency: number;
    frequency: number;
    monetary: number;
    couponRate: number;
  },
): Record<ClusterId, number> {
  const R = c[featureIndex.recency];
  const F = c[featureIndex.frequency];
  const M = c[featureIndex.monetary];
  const C = c[featureIndex.couponRate];
  return {
    // alto gasto, pouco cupom, frequência ok
    vip_organic: M * 1.4 - C * 1.2 + F * 0.5 - Math.abs(R) * 0.2,
    // frequência + cupom
    loyal_price_sensitive: F * 1.2 + C * 1.4 + M * 0.3 - R * 0.3,
    // sumiu (alta recência em dias) + LTV histórico
    churn_risk: R * 1.5 + M * 0.8 - F * 0.6 + C * 0.2,
    // baixa frequência / baixo monetary
    new_occasional: -F * 1.3 - M * 0.9 + Math.abs(C) * 0.1 + R * 0.2,
  };
}

/**
 * Mapeia cada centroide K-Means a um cluster de negócio **único** (1:1).
 * Evita o bug em que a heurística if/else colapsava tudo em VIP + Novos.
 */
export function mapCentroidsToClusters(
  centroids: number[][],
  featureIndex: {
    recency: number;
    frequency: number;
    monetary: number;
    couponRate: number;
  },
): ClusterId[] {
  if (!centroids.length) return [];

  const scores = centroids.map((c) => businessFitScores(c, featureIndex));

  // Atribuição gulosa por melhor score global, garantindo 1 centroide por perfil
  type Pair = { centroid: number; cluster: ClusterId; score: number };
  const pairs: Pair[] = [];
  for (let i = 0; i < centroids.length; i++) {
    for (const cluster of BUSINESS_CLUSTER_ORDER) {
      pairs.push({ centroid: i, cluster, score: scores[i][cluster] });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const usedCentroids = new Set<number>();
  const usedClusters = new Set<ClusterId>();
  const mapping: ClusterId[] = Array(centroids.length).fill("new_occasional");

  for (const p of pairs) {
    if (usedCentroids.has(p.centroid) || usedClusters.has(p.cluster)) continue;
    mapping[p.centroid] = p.cluster;
    usedCentroids.add(p.centroid);
    usedClusters.add(p.cluster);
    if (usedCentroids.size === centroids.length) break;
  }

  // Se k > 4 ou sobrou centroide, completa com o melhor perfil ainda livre / fallback
  for (let i = 0; i < centroids.length; i++) {
    if (usedCentroids.has(i)) continue;
    let best: ClusterId = "new_occasional";
    let bestScore = -Infinity;
    for (const cluster of BUSINESS_CLUSTER_ORDER) {
      if (usedClusters.has(cluster) && usedClusters.size < BUSINESS_CLUSTER_ORDER.length) {
        continue;
      }
      if (scores[i][cluster] > bestScore) {
        bestScore = scores[i][cluster];
        best = cluster;
      }
    }
    mapping[i] = best;
    usedCentroids.add(i);
    usedClusters.add(best);
  }

  return mapping;
}

/**
 * Garante que os 4 perfis de negócio tenham pelo menos 1 usuário.
 * Se um k-means ficou vazio, realoca os melhores candidatos do maior grupo.
 */
export function ensureAllBusinessClusters(
  userClusterIds: ClusterId[],
  standardizedFeatures: number[][],
  featureIndex: {
    recency: number;
    frequency: number;
    monetary: number;
    couponRate: number;
  },
  minSharePct = 0.08,
): ClusterId[] {
  const out = [...userClusterIds];
  const n = out.length;
  if (!n) return out;

  const minCount = Math.max(1, Math.floor(n * minSharePct));

  const recount = () => {
    const counts: Record<ClusterId, number> = {
      vip_organic: 0,
      loyal_price_sensitive: 0,
      churn_risk: 0,
      new_occasional: 0,
    };
    for (const id of out) counts[id]++;
    return counts;
  };

  for (const target of BUSINESS_CLUSTER_ORDER) {
    let counts = recount();
    while (counts[target] < minCount) {
      // origem = maior cluster diferente do target
      let source: ClusterId = BUSINESS_CLUSTER_ORDER.find(
        (c) => c !== target && counts[c] > minCount,
      ) as ClusterId;
      if (!source) {
        source = BUSINESS_CLUSTER_ORDER.reduce((a, b) =>
          counts[a] >= counts[b] && a !== target ? a : b !== target ? b : a,
        );
      }
      if (!source || source === target || counts[source] <= minCount) break;

      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < n; i++) {
        if (out[i] !== source) continue;
        const fit = businessFitScores(standardizedFeatures[i], featureIndex)[
          target
        ];
        if (fit > bestScore) {
          bestScore = fit;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) break;
      out[bestIdx] = target;
      counts = recount();
    }
  }

  return out;
}
