import { createClient } from "@supabase/supabase-js";
import { buildAnalyticsDashboard } from "../src/services/analyticsEngine.ts";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await s.from("synthetic_users").select("*");
if (error) {
  console.error(error);
  process.exit(1);
}
const d = buildAnalyticsDashboard(data ?? [], 42);
for (const f of d.featureImpact.features) {
  console.log(
    `${f.id.padEnd(22)} Δvisitas=${String(f.delta.expectedVisits).padStart(7)}  Δmargem=${String(f.delta.marginBrl).padStart(9)}  ROI=${String(f.delta.roi).padStart(6)}  Δprim=${f.delta.primaryMetric}`,
  );
}
console.log(
  `STACK                   ΔGMV=${d.featureImpact.stack.deltaGmvBrl}  Δmargem=${d.featureImpact.stack.deltaMarginBrl}  ROI=${d.featureImpact.stack.roi}`,
);
