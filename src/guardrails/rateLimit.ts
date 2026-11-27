import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { ABUSE_LIMITS } from "@/guardrails/config";

function hmacIp(ip: string): string {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? "dev";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/** IP só de header confiável da plataforma (Vercel). Nunca gravar IP em claro. */
export function clientIpHmac(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || "local";
  return hmacIp(ip);
}

async function bump(
  admin: SupabaseClient,
  key: string,
  windowSeconds: number,
  limit: number,
): Promise<{ allowed: boolean; count: number }> {
  const windowStart = new Date(
    Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000,
  ).toISOString();

  const { data: existing } = await admin
    .from("rate_buckets")
    .select("bucket_key, count, window_start")
    .eq("bucket_key", key)
    .maybeSingle();

  if (!existing || existing.window_start !== windowStart) {
    const { error } = await admin.from("rate_buckets").upsert({
      bucket_key: key,
      window_start: windowStart,
      count: 1,
    });
    if (error) {
      // Falha no contador = degradar (não chamar LLM) por segurança
      return { allowed: false, count: limit + 1 };
    }
    return { allowed: true, count: 1 };
  }

  const next = (existing.count as number) + 1;
  if (next > limit) return { allowed: false, count: next };

  await admin
    .from("rate_buckets")
    .update({ count: next })
    .eq("bucket_key", key)
    .eq("window_start", windowStart);

  return { allowed: true, count: next };
}

export async function checkAiBudget(params: {
  admin: SupabaseClient;
  sessionId: string;
  ipHmac: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  const dayKey = `ai:global:day:${new Date().toISOString().slice(0, 10)}`;
  const global = await bump(
    params.admin,
    dayKey,
    86400,
    ABUSE_LIMITS.globalDailyAiCalls,
  );
  if (!global.allowed) return { allowed: false, reason: "global_daily" };

  const sessMin = await bump(
    params.admin,
    `ai:sess:min:${params.sessionId}`,
    60,
    ABUSE_LIMITS.aiPerSessionPerMin,
  );
  if (!sessMin.allowed) return { allowed: false, reason: "session_minute" };

  const sessTotal = await bump(
    params.admin,
    `ai:sess:total:${params.sessionId}`,
    86400,
    ABUSE_LIMITS.aiPerSessionTotal,
  );
  if (!sessTotal.allowed) return { allowed: false, reason: "session_total" };

  const ipMin = await bump(
    params.admin,
    `ai:ip:min:${params.ipHmac}`,
    60,
    ABUSE_LIMITS.aiPerIpPerMin,
  );
  if (!ipMin.allowed) return { allowed: false, reason: "ip_minute" };

  return { allowed: true };
}

export async function checkWriteBudget(params: {
  admin: SupabaseClient;
  sessionId: string;
}): Promise<boolean> {
  const r = await bump(
    params.admin,
    `write:sess:min:${params.sessionId}`,
    60,
    ABUSE_LIMITS.writePerSessionPerMin,
  );
  return r.allowed;
}
