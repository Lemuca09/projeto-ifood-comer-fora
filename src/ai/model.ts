/**
 * Modelos Claude por tarefa — Haiku barato para JSON curto;
 * Sonnet só no ranking/concierge (qualidade de escolha).
 * IDs datados: o alias curto `claude-sonnet-4-5` retornou 404 na API.
 */
export const CLAUDE_MODEL_RANK = "claude-sonnet-4-5-20250929";
export const CLAUDE_MODEL_FAST = "claude-haiku-4-5-20251001";

/** @deprecated use CLAUDE_MODEL_RANK / CLAUDE_MODEL_FAST */
export const CLAUDE_MODEL = CLAUDE_MODEL_RANK;
