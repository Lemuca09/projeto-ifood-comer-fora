import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/** Service role - só no servidor. Nunca no client. */
export function createAdminClient() {
  const env = getServerEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
