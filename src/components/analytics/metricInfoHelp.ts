import type { MetricInfoContent } from "@/components/analytics/MetricInfoTip";

/** Bloco reutilizável: o que é a métrica + como é gerada (seed / fórmula / banco). */
export type MetricCol = NonNullable<MetricInfoContent["columns"]>[number];

export const M = {
  recencyDays: {
    name: "recencyDays",
    detail:
      "Dias desde a última visita ao salão. Vem de user_days_since_last_dinein da persona sintética (seed).",
  },
  frequency: {
    name: "frequency",
    detail:
      "Intensidade de visitas. Calculada: dine-in 90d + 0,35×visitas Comer Fora + 0,15×pedidos delivery.",
  },
  monetary: {
    name: "monetary",
    detail:
      "Gasto agregado no período. Calculado: user_avg_ticket_brl × max(1, check-ins dine-in 90d).",
  },
  couponRate: {
    name: "couponRate",
    detail:
      "Taxa de resgate de cupom (0–1). Usa coupon_redemption_rate_90d da persona; se ausente, fallback por archetype (ex. push_averse ≈ 0,4).",
  },
  netMargin: {
    name: "netMargin",
    detail:
      "Margem líquida de referência. Prefere lifetime_margin_brl; senão monetary × (avg_margin_pct / 100).",
  },
  avgMarginPct: {
    name: "avg_margin_pct",
    detail:
      "Margem % média do perfil. Campo da persona sintética (seed); default ~16% se ausente.",
  },
  spendBefore: {
    name: "spendBefore",
    detail:
      "Gasto “antes” da estratégia. Calculado: monetary × fator (0,55–0,75) da seed (mulberry32).",
  },
  spendAfter: {
    name: "spendAfter",
    detail:
      "Gasto “depois”. Calculado: spendBefore × (1 + expectedLift) da estratégia escolhida pelo otimizador.",
  },
  spendDeltaPct: {
    name: "Gasto %",
    detail:
      "Variação percentual do gasto. Fórmula: (spendAfter − spendBefore) / spendBefore × 100.",
  },
  marginBefore: {
    name: "marginBefore",
    detail:
      "Margem antes. Calculada: spendBefore × (avg_margin_pct / 100).",
  },
  marginAfter: {
    name: "Lucro (marginAfter)",
    detail:
      "Margem depois. Calculada: marginBefore + expectedIncrementalMargin da estratégia.",
  },
  churnRisk: {
    name: "Risco de parar (churnRisk)",
    detail:
      "Score 0–100 heurístico (não é ML). Fórmula: min(100, round(recencyDays×1,2 + (sentimento negativo ? 25 : 0) + couponRate×20)).",
  },
  benefitType: {
    name: "benefitType",
    detail:
      "Tipo de incentivo: cupom | giftback | prato_gratis | nenhum. Saída de pickEfficientUserStrategy (ROI + cluster + sazonalidade).",
  },
  benefitValueBrl: {
    name: "benefitValueBrl",
    detail:
      "Valor em R$ do benefício. Definido pelo otimizador (trava de ticket mínimo quando cupom). A UI não inventa.",
  },
  minTicketBrl: {
    name: "minTicketBrl",
    detail:
      "Ticket mínimo para liberar o cupom. Gerado com o cupom no otimizador (proporcional ao valor do benefício).",
  },
  strategyRoi: {
    name: "strategyRoi / retorno est.",
    detail:
      "ROI estimado da estratégia escolhida (expectedRoi do otimizador), não o ROI global da campanha.",
  },
  cluster: {
    name: "Cluster",
    detail:
      "Rótulo de negócio após K-Means k=4 em [recencyDays, frequency, monetary, couponRate, netMargin] padronizados + mapeamento de centróides.",
  },
  priceSensitivity: {
    name: "price_sensitivity",
    detail:
      "Sensibilidade a preço (0–1). Campo da persona sintética; default 0,5. Pesa na escolha de cupom vs giftback.",
  },
  comerForaVisits90d: {
    name: "comer_fora_visits_90d",
    detail:
      "Visitas Comer Fora nos últimos 90 dias. Campo da persona (seed). Usado em frequency, conversão e features.",
  },
  lastNps: {
    name: "Probabilidade de recomendação",
    detail:
      "Nota 0–10 de quanto a pessoa recomendaria a experiência (campo last_nps_score da persona; default 7). Influencia sentimento da review sintética e a propensão de visita.",
  },
  idleCapacity: {
    name: "idle_capacity_pct",
    detail:
      "Ociosidade do salão (%). Derivada dos restaurant_slots (capacity − reserved): segunda quase vazia, fim de semana cheio, ajustada por salário/feriado. Fallback sintético 28–73% se sem slot.",
  },
  lowDemandDelta: {
    name: "lowDemandDeltaPct",
    detail:
      "Lift % em horário fraco no painel B2B. Sintético: 12–30% via seed + estratégia do restaurante.",
  },
  partySize: {
    name: "party_size_mode",
    detail:
      "Tamanho típico de mesa (ex. \"2\", \"4+\"). Campo da persona; afeta benefício progressivo e split.",
  },
  preferredHour: {
    name: "preferred_hour_slot",
    detail:
      "Faixa horária preferida. Campo da persona ou sorteio entre slots conhecidos (seed) se vazio.",
  },
  preferredCuisine: {
    name: "preferred_cuisine",
    detail:
      "Culinária favorita. Campo da persona ou sorteio na lista CUISINES (seed) se vazio.",
  },
  seed: {
    name: "seed",
    detail:
      "Semente da demo. Fixa o RNG (mulberry32): mesma seed → mesmos números. Não é aleatório a cada refresh.",
  },
} as const satisfies Record<string, MetricCol>;

export function cols(...keys: (keyof typeof M)[]): MetricCol[] {
  return keys.map((k) => M[k]);
}
