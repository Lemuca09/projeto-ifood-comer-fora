/**
 * Verifica schema sem imprimir segredos.
 * node --env-file=.env scripts/check-db.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const pub = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("MISSING_ENV");
  process.exit(1);
}

const s = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "restaurants",
  "restaurant_slots",
  "app_events",
  "rate_buckets",
  "security_audit",
  "synthetic_users",
  "demo_sessions",
  "decision_runs",
];

let ok = true;
for (const name of tables) {
  const { count, error, status } = await s
    .from(name)
    .select("*", { count: "exact", head: true });
  if (error || status === 404) {
    console.log(`${name}: MISSING (${error?.message ?? status})`);
    ok = false;
  } else {
    console.log(`${name}: OK count=${count ?? 0}`);
  }
}

if (pub) {
  const c = createClient(url, pub, { auth: { persistSession: false } });
  const r = await c.auth.signInAnonymously();
  if (r.error) {
    console.log(`anonymous_auth: FAIL (${r.error.message})`);
    ok = false;
  } else {
    console.log("anonymous_auth: OK");
  }
}

if (!ok) {
  console.log("NEXT: cole supabase/APPLY_ALL.sql no SQL Editor do Supabase.");
}
process.exit(ok ? 0 : 2);