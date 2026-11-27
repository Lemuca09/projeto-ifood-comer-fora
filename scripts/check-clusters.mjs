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
for (const seed of [42, 100, 777, 12345]) {
  const dash = buildAnalyticsDashboard(data ?? [], Number(seed));
  const line = dash.clusters
    .map((c) => `${c.id}:${c.count}`)
    .join(" | ");
  const empty = dash.clusters.filter((c) => c.count === 0).map((c) => c.id);
  console.log(
    `seed=${seed}  ${line}${empty.length ? "  EMPTY=" + empty.join(",") : ""}`,
  );
}
