/** Limiares [PREMISSA] AGENTS §7.2 */
export const GUARD_THRESHOLDS = {
  permitirMax: 0,
  sanitizarMax: 39,
  degradarMax: 69,
  /** 70+ bloqueia; regra crítica soma 70 sozinha */
  bloquearMin: 70,
} as const;

/** Abuso [PREMISSA] AGENTS §7.5 */
export const ABUSE_LIMITS = {
  /** RPM baixo de propósito — cota Gemini estoura fácil na demo. */
  aiPerSessionPerMin: 3,
  aiPerIpPerMin: 6,
  aiPerSessionTotal: 12,
  maxOutputTokens: 500,
  timeoutMs: 8000,
  maxRetries: 0,
  globalDailyAiCalls: 80,
  writePerSessionPerMin: 30,
  maxBodyBytes: 8_192,
} as const;

export const APP_EVENT_VERSION = "1";
