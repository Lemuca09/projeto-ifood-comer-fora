/**
 * Checagens compartilhadas de saída de texto (AGENTS §7.4).
 * Usadas pelo outputGuard de ranking e pelas rotas de analytics/concierge.
 */

const HTML_RE = /<\s*(script|iframe|img|svg|object|a)\b/i;
const URL_RE = /https?:\/\//i;
/** Padrões típicos de segredo em saída de modelo. */
const SECRET_RE =
  /\b(sk-[a-z0-9_-]{16,}|sk-ant-[a-z0-9_-]{16,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----)\b/i;

function ngrams(text: string, n = 8): Set<string> {
  const norm = text.toLowerCase().replace(/\s+/g, " ");
  const set = new Set<string>();
  for (let i = 0; i <= norm.length - n; i++) set.add(norm.slice(i, i + n));
  return set;
}

function overlapRatio(a: string, b: string): number {
  const A = ngrams(a);
  const B = ngrams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  return hit / A.size;
}

export function canaryLeak(text: string, canary: string): boolean {
  if (!canary) return false;
  const variants = [
    canary,
    canary.split("").reverse().join(""),
    Buffer.from(canary).toString("base64"),
    canary.split("").join(" "),
  ];
  const lower = text.toLowerCase();
  return variants.some((v) => v && lower.includes(v.toLowerCase()));
}

export function looksLikeSecret(text: string): boolean {
  return SECRET_RE.test(text);
}

export function hasHtmlOrUrl(text: string): boolean {
  return HTML_RE.test(text) || URL_RE.test(text);
}

export function systemPromptOverlap(
  systemPrompt: string,
  output: string,
  threshold = 0.35,
): boolean {
  if (!systemPrompt.trim()) return false;
  return overlapRatio(systemPrompt, output) > threshold;
}

/** Valida texto bruto de modelo antes de schema/parse específico. */
export function rawModelTextSafe(params: {
  rawText: string;
  canary?: string;
  systemPrompt?: string;
}): { ok: true } | { ok: false; reason: string } {
  const { rawText, canary = "", systemPrompt = "" } = params;
  if (canaryLeak(rawText, canary)) return { ok: false, reason: "canary" };
  if (hasHtmlOrUrl(rawText)) return { ok: false, reason: "html_or_url" };
  if (looksLikeSecret(rawText)) return { ok: false, reason: "secret_pattern" };
  if (systemPromptOverlap(systemPrompt, rawText)) {
    return { ok: false, reason: "prompt_overlap" };
  }
  return { ok: true };
}
