/** Limiares [PREMISSA] AGENTS §7.2 */
export const GUARD_THRESHOLDS = {
  permitirMax: 0,
  sanitizarMax: 39,
  degradarMax: 69,
  /** 70+ bloqueia; regra crítica soma 70 sozinha */
  bloquearMin: 70,
} as const;

/**
 * Abuso + orçamento de tokens [PREMISSA] AGENTS §7.5.
 * Valores de chamada/IP/sessão ficam *mais estritos* que o piso do AGENTS
 * (10/min sessão, 20/min IP, 20/sessão) - adequado à demo pública.
 */
export const ABUSE_LIMITS = {
  aiPerSessionPerMin: 2,
  aiPerIpPerMin: 4,
  aiPerSessionTotal: 8,
  /** Teto genérico; tarefas usam tetos menores abaixo. */
  maxOutputTokens: 520,
  /** Ranking: ≤3 itens JSON. */
  maxOutputTokensRank: 220,
  /** Brief/campanha/copy (160 cortava JSON no meio → claude_parse). */
  maxOutputTokensAnalytics: 320,
  /** Concierge “Pergunte onde jantar” (texto natural curto + IDs). */
  maxOutputTokensConcierge: 480,
  /** Sentimento / classificação. */
  maxOutputTokensTiny: 90,
  /** Máx. candidatos enviados ao ranker. */
  maxRankCandidates: 8,
  /** Timeout da chamada Anthropic (Haiku costuma responder em 2–4 s). */
  timeoutMs: 12_000,
  maxRetries: 0,
  globalDailyAiCalls: 50,
  writePerSessionPerMin: 30,
  maxBodyBytes: 8_192,
} as const;

export const APP_EVENT_VERSION = "1";
