import { createHash } from "crypto";

/** Cache longo + throttle — prioriza reuso e corta RPM. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 6_000;
const cache = new Map<string, { at: number; value: string }>();
let lastCallAt = 0;
let inFlight = 0;
const MAX_IN_FLIGHT = 1;

export function llmCacheKey(parts: unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 40);
}

export function getLlmCache(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function setLlmCache(key: string, value: string) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 200) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [k, v] of cache) {
      if (v.at < cutoff) cache.delete(k);
    }
  }
}

export async function withLlmThrottle<T>(
  fn: () => Promise<T>,
): Promise<T | null> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  if (inFlight >= MAX_IN_FLIGHT) {
    return null;
  }
  inFlight += 1;
  lastCallAt = Date.now();
  try {
    return await fn();
  } finally {
    inFlight -= 1;
  }
}
