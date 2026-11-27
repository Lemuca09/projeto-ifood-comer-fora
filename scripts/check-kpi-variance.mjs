import { createClient } from "@supabase/supabase-js";
import { buildAnalyticsDashboard } from "../src/services/analyticsEngine.ts";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data } = await s.from("synthetic_users").select("*");
for (const seed of [1, 42, 99, 777, 12345, 888888]) {
  const d = buildAnalyticsDashboard(data ?? [], seed);
  const m = d.strategyMix;
  const total = m.cupom + m.giftback + m.prato_gratis + m.nenhum;
  console.log(
    `seed=${seed} novos=${d.kpis.newComerForaUsers} (${d.kpis.newComerForaPct}%) | cupom=${Math.round((m.cupom / total) * 100)}% gift=${Math.round((m.giftback / total) * 100)}% prato=${Math.round((m.prato_gratis / total) * 100)}% nenhum=${Math.round((m.nenhum / total) * 100)}%`,
  );
}
