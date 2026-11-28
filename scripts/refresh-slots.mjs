/**
 * Regenera restaurant_slots a partir de restaurant_hours.
 * Intervalo de 30 min; última mesa = close − 90 min.
 * Ocupação sazonal (seg quase vazia, fim de semana cheio).
 * Horizonte: até 05/12/2026.
 * node --env-file=.env scripts/refresh-slots.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SLOT_HORIZON_END = "2026-12-05";
const LOTADA = "11111111-1111-1111-1111-111111111111";
const SLOT_STEP_MIN = 30;
/** Última reserva X minutos antes do fechamento. */
const LAST_SEATING_BUFFER_MIN = 90;

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

const { data: hoursRows, error: hErr } = await s
  .from("restaurant_hours")
  .select("restaurant_id, weekday, open_time, close_time");
if (hErr) {
  console.error("HOURS_FAIL", hErr.message);
  process.exit(1);
}

/** restaurant_id → weekday → { openMin, closeMin } */
const hoursByRest = new Map();
for (const row of hoursRows ?? []) {
  const openMin = parseTimeToMinutes(row.open_time);
  const closeMin = parseTimeToMinutes(row.close_time);
  if (openMin == null || closeMin == null || closeMin <= openMin) continue;
  let byDow = hoursByRest.get(row.restaurant_id);
  if (!byDow) {
    byDow = new Map();
    hoursByRest.set(row.restaurant_id, byDow);
  }
  byDow.set(Number(row.weekday), { openMin, closeMin });
}

function parseTimeToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  const [hh, mm] = t.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function spNowParts() {
  const now = new Date();
  const sp = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return {
    y: sp.getUTCFullYear(),
    m: sp.getUTCMonth(),
    d: sp.getUTCDate(),
  };
}

/** Instantâneo UTC para horário civil SP (UTC-3). */
function spDateAt(dayOffset, hour, minute) {
  const { y, m, d } = spNowParts();
  return new Date(Date.UTC(y, m, d + dayOffset, hour + 3, minute, 0));
}

function weekdaySp(dayOffset) {
  const { y, m, d } = spNowParts();
  // Date.UTC noon avoids DST edge; weekday in SP ≈ UTC-3 same calendar day
  return new Date(Date.UTC(y, m, d + dayOffset, 15, 0, 0)).getUTCDay();
}

function daysUntilHorizon() {
  const { y, m, d } = spNowParts();
  const todayUtc = Date.UTC(y, m, d);
  const [hy, hm, hd] = SLOT_HORIZON_END.split("-").map(Number);
  const endUtc = Date.UTC(hy, hm - 1, hd);
  return Math.max(0, Math.floor((endUtc - todayUtc) / 86400000));
}

function occupancyFraction(starts) {
  const sp = new Date(starts.getTime() - 3 * 60 * 60 * 1000);
  const weekday = sp.getUTCDay();
  const dayOfMonth = sp.getUTCDate();
  const md = `${String(sp.getUTCMonth() + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
  const byDow = { 0: 0.86, 1: 0.14, 2: 0.28, 3: 0.36, 4: 0.44, 5: 0.78, 6: 0.92 };
  let occ = byDow[weekday] ?? 0.4;
  const isPayday = dayOfMonth >= 5 && dayOfMonth <= 15;
  if (isPayday) occ *= 1.08;
  if (dayOfMonth >= 25 || dayOfMonth <= 4) occ *= 0.9;
  if (md === "12-24" || md === "12-31") occ = Math.max(occ, 0.94);
  if (weekday === 1 && !isPayday) occ = Math.min(occ, 0.22);
  // Almoço (antes das 16h) um pouco mais vazio que o jantar no mesmo dia.
  const hour = sp.getUTCHours();
  if (hour < 16) occ *= 0.75;
  return Math.max(0.05, Math.min(0.98, occ));
}

function restaurantJitter(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 21) - 10) / 100;
}

function reservedFor(starts, capacity, full, restaurantId) {
  if (full) return capacity;
  let occ = occupancyFraction(starts) + restaurantJitter(restaurantId);
  occ = Math.max(0.05, Math.min(0.97, occ));
  let reserved = Math.round(capacity * occ);
  const minFree = occ >= 0.9 ? 1 : 2;
  return Math.min(capacity - minFree, Math.max(0, reserved));
}

function slotMinutesForDay(openMin, closeMin) {
  const last = closeMin - LAST_SEATING_BUFFER_MIN;
  const out = [];
  for (let m = openMin; m <= last; m += SLOT_STEP_MIN) out.push(m);
  return out;
}

const maxDay = daysUntilHorizon();
const byKey = new Map();
let skippedNoHours = 0;

for (const r of restaurants ?? []) {
  const full = r.id === LOTADA || r.name?.includes("Lotada");
  const capacity = full ? 10 : 20;
  const byDow = hoursByRest.get(r.id);
  if (!byDow || byDow.size === 0) {
    skippedNoHours++;
    continue;
  }

  for (let day = 0; day <= maxDay; day++) {
    const dow = weekdaySp(day);
    const window = byDow.get(dow);
    if (!window) continue;
    for (const mins of slotMinutesForDay(window.openMin, window.closeMin)) {
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;
      const starts = spDateAt(day, hour, minute);
      if (starts.getTime() <= Date.now() + 10 * 60 * 1000) continue;
      const starts_at = starts.toISOString();
      byKey.set(`${r.id}|${starts_at}`, {
        restaurant_id: r.id,
        starts_at,
        capacity,
        reserved_count: reservedFor(starts, capacity, full, r.id),
      });
    }
  }
}

const slots = [...byKey.values()];

let upserted = 0;
for (let i = 0; i < slots.length; i += 200) {
  const chunk = slots.slice(i, i + 200);
  const { error: e, count } = await s.from("restaurant_slots").upsert(chunk, {
    onConflict: "restaurant_id,starts_at",
    ignoreDuplicates: false,
    count: "exact",
  });
  if (e) {
    console.error("SLOTS_FAIL", e.message);
    process.exit(1);
  }
  upserted += count ?? chunk.length;
}

// Remove slots futuros fora do expediente atual (ex.: só 19h/20h30 antigos sem hours match)
// Mantém slots já passados; apaga futuros que não estão no set gerado.
{
  const keep = new Set(slots.map((x) => `${x.restaurant_id}|${x.starts_at}`));
  const { data: future } = await s
    .from("restaurant_slots")
    .select("id, restaurant_id, starts_at")
    .gte("starts_at", new Date().toISOString());
  const toDelete = (future ?? []).filter(
    (row) => !keep.has(`${row.restaurant_id}|${row.starts_at}`),
  );
  for (let i = 0; i < toDelete.length; i += 200) {
    const ids = toDelete.slice(i, i + 200).map((r) => r.id);
    if (!ids.length) continue;
    const { error: dErr } = await s.from("restaurant_slots").delete().in("id", ids);
    if (dErr) {
      // FK com reservas: ignora esses ids
      console.warn("SLOTS_CLEAN_PARTIAL", dErr.message);
    }
  }
}

const idleByRest = new Map();
for (const slot of slots) {
  const idlePct =
    ((slot.capacity - slot.reserved_count) / Math.max(slot.capacity, 1)) * 100;
  const list = idleByRest.get(slot.restaurant_id) ?? [];
  list.push(idlePct);
  idleByRest.set(slot.restaurant_id, list);
}

let idleUpdated = 0;
for (const [restaurantId, values] of idleByRest) {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const { error: uErr } = await s
    .from("restaurants")
    .update({ idle_capacity_pct: Math.round(avg) })
    .eq("id", restaurantId);
  if (uErr) {
    console.error("IDLE_FAIL", uErr.message);
    process.exit(1);
  }
  idleUpdated++;
}

const hourBuckets = {};
for (const slot of slots) {
  const sp = new Date(new Date(slot.starts_at).getTime() - 3 * 3600 * 1000);
  const key = `${sp.getUTCHours()}:${String(sp.getUTCMinutes()).padStart(2, "0")}`;
  hourBuckets[key] = (hourBuckets[key] ?? 0) + 1;
}

console.log(
  JSON.stringify({
    ok: true,
    upserted,
    idleUpdated,
    skippedNoHours,
    horizon: SLOT_HORIZON_END,
    days: `0..${maxDay}`,
    uniqueHours: Object.keys(hourBuckets).sort(),
    hourBuckets,
  }),
);
