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

const hours = [];
for (const r of restaurants) {
  for (let weekday = 0; weekday <= 6; weekday++) {
    hours.push({
      restaurant_id: r.id,
      weekday,
      open_time: "11:00",
      close_time: "23:00",
    });
  }
}
const { error: hErr } = await s.from("restaurant_hours").insert(hours);
if (hErr) {
  console.error("HOURS_FAIL", hErr.code, hErr.message);
  process.exit(1);
}

const slots = [];
const base = new Date();
base.setMinutes(0, 0, 0);
for (const r of restaurants) {
  const full = r.id === "11111111-1111-1111-1111-111111111111";
  for (let day = 0; day <= 6; day++) {
    for (const hour of [19, 20.5]) {
      const starts = new Date(base.getTime() + day * 86400000);
      starts.setHours(Math.floor(hour), hour % 1 ? 30 : 0, 0, 0);
      if (starts <= new Date()) starts.setDate(starts.getDate() + 1);
      slots.push({
        restaurant_id: r.id,
        starts_at: starts.toISOString(),
        capacity: full ? 10 : 20,
        reserved_count: full ? 10 : 0,
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
console.log(`SEED_OK restaurants=${count} slots≈${slots.length}`);
