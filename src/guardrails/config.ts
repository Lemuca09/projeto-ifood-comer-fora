/** Limiares [PREMISSA] AGENTS §7.2 */
export const GUARD_THRESHOLDS = {
  permitirMax: 0,
  sanitizarMax: 39,
  degradarMax: 69,
  /** 70+ bloqueia; regra crítica soma 70 sozinha */
  bloquearMin: 70,
} as const;

/** Abuso + orçamento de tokens [PREMISSA] AGENTS §7.5 */
export const ABUSE_LIMITS = {
  /** RPM baixo — demo não precisa de rajada. */
  aiPerSessionPerMin: 2,
  aiPerIpPerMin: 4,
  aiPerSessionTotal: 8,
  /** Teto genérico; tarefas usam tetos menores abaixo. */
  maxOutputTokens: 520,
  /** Ranking: ≤3 itens JSON. */
  maxOutputTokensRank: 220,
  /** Brief/campanha/copy. */
  maxOutputTokensAnalytics: 160,
  /** Concierge “Pergunte onde jantar” (prosa curta + IDs). */
  maxOutputTokensConcierge: 480,
  /** Sentimento / classificação. */
  maxOutputTokensTiny: 90,
  /** Máx. candidatos enviados ao ranker. */
  maxRankCandidates: 8,
  timeoutMs: 10_000,
  maxRetries: 0,
  globalDailyAiCalls: 50,
  writePerSessionPerMin: 30,
  maxBodyBytes: 8_192,
} as const;

export const APP_EVENT_VERSION = "1";
