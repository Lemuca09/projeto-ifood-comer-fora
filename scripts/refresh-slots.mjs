/**
 * Garante slots futuros (próx. 7 dias, 19:00 e 20:30 America/Sao_Paulo).
 * node --env-file=.env scripts/refresh-slots.mjs
 */
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const { data: restaurants, error } = await s
  .from("restaurants")
  .select("id, name")
  .eq("is_active", true);
if (error) {
  console.error("FAIL", error.message);
  process.exit(1);
}

await s
  .from("restaurant_slots")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");

function spDateAt(dayOffset, hour, minute) {
  // Constrói instante equivalente a America/Sao_Paulo (UTC-3, sem DST neste uso demo)
  const now = new Date();
  const spNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = spNow.getUTCFullYear();
  const m = spNow.getUTCMonth();
  const d = spNow.getUTCDate() + dayOffset;
  // 19:00 SP = 22:00 UTC
  return new Date(Date.UTC(y, m, d, hour + 3, minute, 0));
}

const LOTADA = "11111111-1111-1111-1111-111111111111";
const slots = [];
for (const r of restaurants) {
  const full = r.id === LOTADA || r.name?.includes("Lotada");
  for (let day = 0; day <= 6; day++) {
    for (const [h, min] of [
      [19, 0],
      [20, 30],
    ]) {
      const starts = spDateAt(day, h, min);
      if (starts.getTime() <= Date.now() + 10 * 60 * 1000) continue;
      slots.push({
        restaurant_id: r.id,
        starts_at: starts.toISOString(),
        capacity: full ? 10 : 20,
        reserved_count: full ? 10 : 0,
      });
    }
  }
}

for (let i = 0; i < slots.length; i += 200) {
  const { error: e } = await s.from("restaurant_slots").insert(slots.slice(i, i + 200));
  if (e) {
    console.error("SLOTS_FAIL", e.message);
    process.exit(1);
  }
}

console.log(`SLOTS_OK count=${slots.length}`);
