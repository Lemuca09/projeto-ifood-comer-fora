/**
 * Popula 200 personas sintéticas 100% distintas no Supabase (+ feature store §7).
 * Pré-requisito: migrations 006 + 007.
 * node --env-file=.env scripts/seed-personas.mjs
 */
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const ARCHETYPES = [
  "delivery_focused",
  "indecisive_explorer",
  "push_averse",
  "speed_seeker",
  "dinein_frequent",
];

const NEIGHBORHOODS = [
  "Gonzaga",
  "Boqueirão",
  "Ponta da Praia",
  "Embaré",
  "Aparecida",
];

const CUISINES = ["Japonesa", "Brasileira", "Italiana", "Hambúrguer", "Árabe", "Vegetariana"];
const HOURS = ["12h–14h", "19h–20h", "20h–21h30", "21h30–23h"];
const PARTY_MODES = ["1", "2", "4+"];
const FRICTIONS = ["preco", "demora", "qualidade", "nenhum"];

const FIRST = [
  "Ana", "Bruno", "Carla", "Diego", "Elena", "Fabio", "Giselle", "Hugo", "Iris", "João",
  "Kelly", "Leo", "Marina", "Nico", "Olga", "Paulo", "Quenia", "Rafa", "Sofia", "Tiago",
  "Uma", "Vitor", "Wanda", "Xavier", "Yara", "Zeca", "Alice", "Bia", "Caio", "Dora",
  "Enzo", "Fernanda", "Gabriel", "Helena", "Igor", "Julia", "Kaio", "Lara", "Miguel", "Nina",
];

const LAST = [
  "Delivery", "Sofa", "Casa", "Hesita", "Scroll", "Compara", "Mute", "OptOut", "Fadiga",
  "Rapido", "SemFila", "Express", "Salao", "Mesa", "Reserva", "App", "Carrinho", "Cupom",
  "Noite", "Almoco", "Grupo", "Solo", "Praia", "Centro", "Bairro", "Promo", "Fila", "Chuva",
  "Transito", "Ticket", "Selos", "Checkin", "Volta", "Novo", "Frequente", "Raro", "Mobile",
  "Web", "Demo", "Case",
];

function uniqueName(i) {
  const a = FIRST[i % FIRST.length];
  const b = LAST[Math.floor(i / FIRST.length) % LAST.length];
  const c = LAST[(i * 7 + 3) % LAST.length];
  return `Persona ${a} ${b}${c}${String(i + 1).padStart(3, "0")}`;
}

/** Garante combinação única de métricas por índice 0..199 */
function buildPersona(i, restaurantIds = []) {
  const archetype = ARCHETYPES[i % 5];
  const neighborhood = NEIGHBORHOODS[i % NEIGHBORHOODS.length];
  const code = `u${String(i + 1).padStart(3, "0")}`;

  // Espaços disjuntos por arquétipo + offset único i
  let delivery, dinein, share, ticket, group, streak, fatigue, days;

  switch (archetype) {
    case "delivery_focused":
      delivery = 28 + (i % 35); // 28–62
      dinein = i % 3; // 0–2
      share = Number(((dinein / Math.max(delivery + dinein, 1)) * 100).toFixed(2));
      ticket = 35 + (i % 50) + (i % 7) * 0.17;
      group = Number((0.02 + (i % 20) * 0.01).toFixed(2));
      streak = i % 2;
      fatigue = 5 + (i % 40);
      days = 60 + (i % 140);
      break;
    case "indecisive_explorer":
      delivery = 8 + (i % 25);
      dinein = 2 + (i % 8);
      share = Number((8 + (i % 30) + (i % 5) * 0.13).toFixed(2));
      ticket = 50 + (i % 60) + (i % 9) * 0.21;
      group = Number((0.2 + (i % 40) * 0.01).toFixed(2));
      streak = i % 3;
      fatigue = 15 + (i % 35);
      days = 10 + (i % 50);
      break;
    case "push_averse":
      delivery = 6 + (i % 22);
      dinein = 1 + (i % 7);
      share = Number((5 + (i % 35) + (i % 4) * 0.19).toFixed(2));
      ticket = 55 + (i % 55) + (i % 6) * 0.31;
      group = Number((0.08 + (i % 30) * 0.01).toFixed(2));
      streak = 2 + (i % 5); // >=2
      fatigue = 50 + (i % 50); // >=50
      days = 12 + (i % 70);
      break;
    case "speed_seeker":
      delivery = 10 + (i % 28);
      dinein = 3 + (i % 10);
      share = Number((10 + (i % 40) + (i % 8) * 0.11).toFixed(2));
      ticket = 32 + (i % 45) + (i % 11) * 0.23;
      group = Number((0.03 + (i % 25) * 0.01).toFixed(2));
      streak = i % 2;
      fatigue = 2 + (i % 30);
      days = 1 + (i % 25);
      break;
    default: // dinein_frequent
      delivery = 2 + (i % 12);
      dinein = 10 + (i % 20);
      share = Number((55 + (i % 40) + (i % 3) * 0.17).toFixed(2));
      ticket = 70 + (i % 80) + (i % 13) * 0.29;
      group = Number((0.35 + (i % 40) * 0.01).toFixed(2));
      streak = 0;
      fatigue = i % 15;
      days = i % 10;
      break;
  }

  // Fingerprint único extra no ticket (centavos únicos)
  ticket = Number((Math.floor(ticket * 100) / 100 + (i % 100) * 0.01).toFixed(2));
  if (share > 100) share = 100;
  if (group > 1) group = 1;

  // —— Feature store §7 ——
  const preferred_cuisine = CUISINES[i % CUISINES.length];
  const preferred_hour_slot = HOURS[(i * 3) % HOURS.length];
  const price_sensitivity = Number(
    (
      archetype === "dinein_frequent"
        ? 0.08 + (i % 20) * 0.01
        : archetype === "delivery_focused" || archetype === "indecisive_explorer"
          ? 0.55 + (i % 35) * 0.01
          : archetype === "push_averse"
            ? 0.35 + (i % 30) * 0.01
            : 0.25 + (i % 40) * 0.01
    ).toFixed(3),
  );
  const coupon_redemption_rate_90d = Number(
    Math.min(0.95, Math.max(0.02, price_sensitivity * 0.7 + (i % 17) * 0.01)).toFixed(4),
  );
  const last_nps_score =
    archetype === "dinein_frequent"
      ? 7 + (i % 4)
      : archetype === "push_averse"
        ? 3 + (i % 5)
        : 4 + (i % 7);
  const last_sentiment =
    last_nps_score >= 8 ? "positivo" : last_nps_score >= 5 ? "neutro" : "negativo";
  const friction_reason =
    last_sentiment === "positivo"
      ? "nenhum"
      : FRICTIONS[(i + (last_sentiment === "negativo" ? 0 : 1)) % 3];
  const party_size_mode =
    group >= 0.45 ? "4+" : PARTY_MODES[i % PARTY_MODES.length];
  const comer_fora_visits_90d =
    archetype === "dinein_frequent"
      ? 4 + (i % 12)
      : archetype === "delivery_focused"
        ? i % 3 === 0
          ? 0
          : i % 2
        : i % 5;
  const avg_margin_pct = Number(
    (12 + (1 - price_sensitivity) * 10 + (i % 9) * 0.3).toFixed(2),
  );
  const lifetime_margin_brl = Number(
    (ticket * Math.max(1, dinein + comer_fora_visits_90d) * (avg_margin_pct / 100)).toFixed(2),
  );
  const favorite_restaurant_id =
    restaurantIds.length > 0 && comer_fora_visits_90d > 0
      ? restaurantIds[i % restaurantIds.length]
      : null;

  return {
    code,
    display_name: uniqueName(i),
    archetype,
    user_delivery_orders_90d: delivery,
    user_dinein_checkins_90d: dinein,
    user_dinein_share_pct: share,
    user_avg_ticket_brl: ticket,
    user_group_order_ratio: group,
    user_push_ignored_streak: streak,
    user_fatigue_score: Math.min(100, fatigue),
    user_days_since_last_dinein: days,
    preferred_neighborhood: neighborhood,
    preferred_cuisine,
    preferred_hour_slot,
    price_sensitivity: Math.min(1, price_sensitivity),
    coupon_redemption_rate_90d,
    last_nps_score: Math.min(10, last_nps_score),
    last_sentiment,
    friction_reason,
    party_size_mode,
    comer_fora_visits_90d,
    favorite_restaurant_id,
    lifetime_margin_brl,
    avg_margin_pct,
    is_synthetic: true,
  };
}

const { data: restRows } = await s
  .from("restaurants")
  .select("id")
  .eq("is_active", true);
const restaurantIds = (restRows ?? []).map((r) => r.id);

const TOTAL = 200;
const personas = Array.from({ length: TOTAL }, (_, i) =>
  buildPersona(i, restaurantIds),
);

// Validação: nenhum clone exato de métricas+nome
const seen = new Set();
for (const p of personas) {
  const key = [
    p.display_name,
    p.archetype,
    p.user_delivery_orders_90d,
    p.user_dinein_checkins_90d,
    p.user_dinein_share_pct,
    p.user_avg_ticket_brl,
    p.user_group_order_ratio,
    p.user_push_ignored_streak,
    p.user_fatigue_score,
    p.user_days_since_last_dinein,
    p.preferred_neighborhood,
  ].join("|");
  if (seen.has(key)) {
    console.error("DUPLICATE", p.code);
    process.exit(1);
  }
  seen.add(key);
}

const { error: probe } = await s
  .from("synthetic_users")
  .select("id, preferred_cuisine, price_sensitivity")
  .limit(1);
if (probe) {
  console.error(
    "SCHEMA_MISSING: rode 006_personas_sessions_decisions.sql e 007_user_feature_store.sql",
  );
  console.error(probe.message);
  process.exit(2);
}

// Limpa decisões/sessões que referenciam users
await s.from("decision_recommendations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
await s.from("decision_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
await s.from("decision_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
await s.from("demo_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
await s.from("synthetic_users").delete().neq("id", "00000000-0000-0000-0000-000000000000");

for (let i = 0; i < personas.length; i += 50) {
  const chunk = personas.slice(i, i + 50);
  const { error } = await s.from("synthetic_users").insert(chunk);
  if (error) {
    console.error("USERS_FAIL", error.message);
    process.exit(1);
  }
}

// Enrich restaurants if columns exist
const { data: rests } = await s.from("restaurants").select("id, price_range").eq("is_active", true);
for (const r of rests ?? []) {
  const wait = 5 + (r.price_range % 4) * 4;
  const idle = 20 + (r.price_range * 12) % 60;
  const promo = r.price_range <= 2 ? 15 : r.price_range === 3 ? 10 : 5;
  await s
    .from("restaurants")
    .update({
      typical_wait_min: wait,
      idle_capacity_pct: idle,
      promo_discount_pct: promo,
    })
    .eq("id", r.id);
}

const { count } = await s.from("synthetic_users").select("*", { count: "exact", head: true });
const byArch = {};
for (const p of personas) byArch[p.archetype] = (byArch[p.archetype] ?? 0) + 1;
console.log(`PERSONAS_OK count=${count}`);
console.log("by_archetype", JSON.stringify(byArch));
