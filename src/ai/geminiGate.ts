import { createHash } from "crypto";

/** Cache + throttle global do processo — reduz RPM do Gemini. */
const CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_INTERVAL_MS = 4_000; // ~15 req/min no máximo por instância
const cache = new Map<string, { at: number; value: string }>();
let lastCallAt = 0;
let inFlight = 0;
const MAX_IN_FLIGHT = 1;

export function geminiCacheKey(parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);
}

export function getGeminiCache(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function setGeminiCache(key: string, value: string) {
  cache.set(key, { at: Date.now(), value });
  // limpeza simples
  if (cache.size > 200) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [k, v] of cache) {
      if (v.at < cutoff) cache.delete(k);
    }
  }
}

export async function withGeminiThrottle<T>(
  fn: () => Promise<T>,
): Promise<T | null> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  if (inFlight >= MAX_IN_FLIGHT) {
    return null; // saturação → caller usa fallback
  }
  inFlight += 1;
  lastCallAt = Date.now();
  try {
    return await fn();
  } finally {
    inFlight -= 1;
  }
}
