import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const cols =
  "id, preferred_cuisine, preferred_hour_slot, price_sensitivity, coupon_redemption_rate_90d, last_nps_score, last_sentiment, friction_reason, party_size_mode, comer_fora_visits_90d, favorite_restaurant_id, lifetime_margin_brl, avg_margin_pct";

const { data, error } = await s.from("synthetic_users").select(cols).limit(1);
if (error) {
  console.log("FEATURE_STORE: MISSING");
  console.log(error.message);
  const sql = readFileSync(
    resolve("supabase/migrations/007_user_feature_store.sql"),
    "utf8",
  );
  console.log("--- SQL 007 (cole no SQL Editor) ---");
  console.log(sql);
  process.exit(2);
}
console.log("FEATURE_STORE: OK");
console.log(JSON.stringify(data?.[0] ?? {}, null, 2));
process.exit(0);
