import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureAnonymousUser(supabase: SupabaseClient) {
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user) {
    return existing.user;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      error?.message ??
        "Falha no login anônimo. Habilite Anonymous Sign-ins no Supabase Auth.",
    );
  }
  return data.user;
}
