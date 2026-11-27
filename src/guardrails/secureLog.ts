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
    session_hmac: entry.sessionId
      ? entry.sessionId.replace(/./g, "x").slice(0, 8) + entry.sessionId.slice(-4)
      : null,
  });
  if (error) {
    console.error("secureLog failed", error.code);
  }
}
