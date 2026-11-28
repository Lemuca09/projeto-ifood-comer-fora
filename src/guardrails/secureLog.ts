import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Log allowlist - nunca texto bruto, prompt, canary, segredo, cookie, IP. */
export type SecureLogEntry = {
  category: "input_guard" | "output_guard" | "rate_limit" | "csrf" | "ai" | "system";
  decisao: string;
  ruleIds?: string[];
  score?: number;
  versao?: string;
  latenciaMs?: number;
  sessionId?: string;
};

function sessionHmac(sessionId: string): string {
  const secret =
    process.env.RATE_LIMIT_HMAC_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    "dev";
  return createHmac("sha256", secret).update(`session:${sessionId}`).digest("hex").slice(0, 32);
}

export async function secureLog(
  admin: SupabaseClient,
  entry: SecureLogEntry,
): Promise<void> {
  const { error } = await admin.from("security_audit").insert({
    category: entry.category,
    decisao: entry.decisao,
    rule_ids: entry.ruleIds ?? [],
    score: entry.score ?? null,
    versao: entry.versao ?? null,
    latencia_ms: entry.latenciaMs ?? null,
    session_hmac: entry.sessionId ? sessionHmac(entry.sessionId) : null,
  });
  if (error) {
    console.error("secureLog failed", error.code);
  }
}
