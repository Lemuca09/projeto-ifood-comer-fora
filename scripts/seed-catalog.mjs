/**
 * Seed determinístico via service role (sem imprimir segredos).
 * node --env-file=.env scripts/seed-catalog.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("MISSING_ENV");
  process.exit(1);
}

const s = createClient(url, key, { auth: { persistSession: false } });

const neighborhoods = [
  "Gonzaga",
  "Boqueirão",
  "Ponta da Praia",
  "Embaré",
  "Aparecida",
];

const templates = [
  ["Casa do Farol", "Frutos do mar leves para jantar a dois.", 3, ["jantar_a_dois", "especial"]],
  ["Boteco da Praça", "Petiscos rápidos e ambiente casual.", 2, ["rapido", "grupo"]],
  ["Massa & Brisa", "Massas artesanais e vinho da casa.", 3, ["jantar_a_dois", "familia"]],
  ["Burger Atlântico", "Burgers generosos para ir sem fome.", 2, ["rapido", "grupo"]],
  ["Sashimi Norte", "Japonesa contemporânea.", 4, ["jantar_a_dois", "especial"]],
  ["Cantina da Vovó", "Pratos caseiros em porções generosas.", 1, ["familia", "rapido"]],
  ["Pizza do Trapiche", "Forno a lenha e bordas recheadas.", 2, ["grupo", "familia"]],
  [
    "Buddha Bowl Maré",
    "Cardápio 100% vegetariano: bowls, falafel e pratos sem carne.",
    2,
    ["rapido", "jantar_a_dois"],
  ],
  ["Esfiha do Cais", "Comida árabe e esfihas no salão.", 2, ["grupo", "rapido"]],
];

const restaurants = [];
let n = 1;
for (const neighborhood of neighborhoods) {
  for (const [name, description, price_range, occasion_tags] of templates) {
    const id = `11111111-1111-1111-1111-${String(111111111100 + n).slice(-12)}`;
    restaurants.push({
      id,
      name: `${name} ${neighborhood.slice(0, 3)}`,
      description,
      neighborhood,
      address: `Rua Sintética ${100 + n}, ${neighborhood}`,
      price_range,
      occasion_tags,
      is_active: true,
      is_synthetic: true,
    });
    n++;
  }
}

// Cenário sem vagas (Boqueirão)
restaurants[9] = {
  ...restaurants[9],
  id: "11111111-1111-1111-1111-111111111111",
  name: "Casa Lotada Demo",
  description: "Sempre cheio - cenário SEM VAGAS.",
  neighborhood: "Boqueirão",
  address: "Av. Sintética 203, Boqueirão",
  price_range: 2,
  occasion_tags: ["grupo", "rapido"],
};

// Limpa catálogo (ordem FK)
await s.from("restaurant_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
await s.from("restaurant_hours").delete().neq("id", "00000000-0000-0000-0000-000000000000");
await s.from("restaurants").delete().neq("id", "00000000-0000-0000-0000-000000000000");

const { error: rErr } = await s.from("restaurants").insert(restaurants);
if (rErr) {
  console.error("RESTAURANTS_FAIL", rErr.code, rErr.message);
  process.exit(1);
}

/** Perfis de expediente (weekday 0=dom … 6=sáb) → open/close. */
const HOUR_PROFILES = [
  // full day
  { open: "11:00", close: "23:00" },
  // almoço + jantar (fecha no meio não modelado; janela contínua mais curta à noite)
  { open: "12:00", close: "22:30" },
  // foco jantar
  { open: "17:00", close: "23:30" },
  // até mais cedo
  { open: "11:30", close: "21:00" },
];

const hours = [];
for (let ri = 0; ri < restaurants.length; ri++) {
  const r = restaurants[ri];
  const profile = HOUR_PROFILES[ri % HOUR_PROFILES.length];
  for (let weekday = 0; weekday <= 6; weekday++) {
    // Dom/seg: alguns fecham mais cedo
    const close =
      (weekday === 0 || weekday === 1) && profile.close >= "23:00"
        ? "22:00"
        : profile.close;
    hours.push({
      restaurant_id: r.id,
      weekday,
      open_time: profile.open,
      close_time: close,
    });
  }
}
const { error: hErr } = await s.from("restaurant_hours").insert(hours);
if (hErr) {
  console.error("HOURS_FAIL", hErr.code, hErr.message);
  process.exit(1);
}

/** Alinhado a src/lib/constants.ts SLOT_HORIZON_END */
const SLOT_HORIZON_END = "2026-12-05";

function spNowParts() {
  const now = new Date();
  const sp = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return {
    y: sp.getUTCFullYear(),
    m: sp.getUTCMonth(),
    d: sp.getUTCDate(),
  };
}

function spDateAt(dayOffset, hour, minute) {
  const { y, m, d } = spNowParts();
  return new Date(Date.UTC(y, m, d + dayOffset, hour + 3, minute, 0));
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
  if (sp.getUTCHours() < 16) occ *= 0.75;
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

function parseHm(t) {
  const [hh, mm] = String(t).split(":").map(Number);
  return hh * 60 + (mm || 0);
}

const SLOT_STEP_MIN = 30;
const LAST_SEATING_BUFFER_MIN = 90;
const hoursByRest = new Map();
for (const h of hours) {
  let byDow = hoursByRest.get(h.restaurant_id);
  if (!byDow) {
    byDow = new Map();
    hoursByRest.set(h.restaurant_id, byDow);
  }
  byDow.set(h.weekday, {
    openMin: parseHm(h.open_time),
    closeMin: parseHm(h.close_time),
  });
}

function weekdaySp(dayOffset) {
  const { y, m, d } = spNowParts();
  return new Date(Date.UTC(y, m, d + dayOffset, 15, 0, 0)).getUTCDay();
}

const slots = [];
const maxDay = daysUntilHorizon();
for (const r of restaurants) {
  const full = r.id === "11111111-1111-1111-1111-111111111111";
  const capacity = full ? 10 : 20;
  const byDow = hoursByRest.get(r.id);
  if (!byDow) continue;
  for (let day = 0; day <= maxDay; day++) {
    const window = byDow.get(weekdaySp(day));
    if (!window) continue;
    const last = window.closeMin - LAST_SEATING_BUFFER_MIN;
    for (let m = window.openMin; m <= last; m += SLOT_STEP_MIN) {
      const starts = spDateAt(day, Math.floor(m / 60), m % 60);
      if (starts.getTime() <= Date.now() + 10 * 60 * 1000) continue;
      slots.push({
        restaurant_id: r.id,
        starts_at: starts.toISOString(),
        capacity,
        reserved_count: reservedFor(starts, capacity, full, r.id),
      });
    }
  }
}

// insert in chunks
for (let i = 0; i < slots.length; i += 200) {
  const chunk = slots.slice(i, i + 200);
  const { error: sErr } = await s.from("restaurant_slots").insert(chunk);
  if (sErr) {
    console.error("SLOTS_FAIL", sErr.code, sErr.message);
    process.exit(1);
  }
}

const { count } = await s
  .from("restaurants")
  .select("id", { count: "exact", head: true });
console.log(
  `SEED_OK restaurants=${count} slots≈${slots.length} horizon=${SLOT_HORIZON_END} days=0..${maxDay}`,
);
