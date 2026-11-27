-- Personas sintÃ©ticas + sessÃµes de demo + log de decisÃ£o da IA
-- Sem PII real (AGENTS Â§8). Nomes sÃ£o personas fictÃ­cias.

create table if not exists public.synthetic_users (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  archetype text not null
    check (archetype in (
      'delivery_focused',
      'indecisive_explorer',
      'push_averse',
      'speed_seeker',
      'dinein_frequent'
    )),
  user_delivery_orders_90d integer not null default 0 check (user_delivery_orders_90d >= 0),
  user_dinein_checkins_90d integer not null default 0 check (user_dinein_checkins_90d >= 0),
  user_dinein_share_pct numeric(5,2) not null default 0
    check (user_dinein_share_pct >= 0 and user_dinein_share_pct <= 100),
  user_avg_ticket_brl numeric(10,2) not null default 0 check (user_avg_ticket_brl >= 0),
  user_group_order_ratio numeric(5,2) not null default 0
    check (user_group_order_ratio >= 0 and user_group_order_ratio <= 1),
  user_push_ignored_streak integer not null default 0 check (user_push_ignored_streak >= 0),
  user_fatigue_score integer not null default 0
    check (user_fatigue_score between 0 and 100),
  user_days_since_last_dinein integer not null default 0 check (user_days_since_last_dinein >= 0),
  preferred_neighborhood text not null default 'Gonzaga',
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  synthetic_user_id uuid not null references public.synthetic_users(id),
  restaurant_id uuid references public.restaurants(id),
  -- carrinho / sessÃ£o
  cart_subtotal_brl numeric(10,2) not null default 0,
  cart_main_items_count integer not null default 1,
  cart_delivery_fee_brl numeric(10,2) not null default 0,
  cart_delivery_eta_min integer not null default 30,
  session_hesitation_sec integer not null default 0,
  dist_to_restaurant_km numeric(6,2) not null default 1,
  travel_time_min integer not null default 10,
  -- externo / restaurante no contexto do carrinho
  ext_rain_probability_pct integer not null default 0
    check (ext_rain_probability_pct between 0 and 100),
  ext_traffic_congestion_idx numeric(4,3) not null default 0.2
    check (ext_traffic_congestion_idx >= 0 and ext_traffic_congestion_idx <= 1),
  rest_current_wait_min integer not null default 5,
  rest_idle_capacity_pct integer not null default 40
    check (rest_idle_capacity_pct between 0 and 100),
  rest_active_promo_discount_pct numeric(5,2) not null default 0
    check (rest_active_promo_discount_pct >= 0 and rest_active_promo_discount_pct <= 100),
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id)
);

create table if not exists public.decision_runs (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id),
  synthetic_user_id uuid not null references public.synthetic_users(id),
  fatigue_risk_pct integer not null,
  silent_mode boolean not null default false,
  external_friction numeric(4,3) not null,
  financial_advantage_brl numeric(10,2) not null,
  time_saved_min integer not null,
  recommend_dinein boolean not null,
  summary text not null,
  is_fallback boolean not null default false,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_rules (
  id uuid primary key default gen_random_uuid(),
  decision_run_id uuid not null references public.decision_runs(id) on delete cascade,
  rule_code text not null,
  label text not null,
  status text not null check (status in ('approved', 'rejected', 'blocked')),
  detail text,
  sort_order smallint not null default 0
);

create table if not exists public.decision_recommendations (
  id uuid primary key default gen_random_uuid(),
  decision_run_id uuid not null references public.decision_runs(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  rank smallint not null check (rank > 0),
  reason_code text not null,
  score numeric(8,2) not null default 0,
  unique (decision_run_id, restaurant_id),
  unique (decision_run_id, rank)
);

-- enriquecimento do catÃ¡logo para wait/promo
alter table public.restaurants
  add column if not exists typical_wait_min integer not null default 10,
  add column if not exists idle_capacity_pct integer not null default 35
    check (idle_capacity_pct between 0 and 100),
  add column if not exists promo_discount_pct numeric(5,2) not null default 0;

create index if not exists idx_synthetic_users_archetype on public.synthetic_users (archetype);
create index if not exists idx_demo_sessions_auth on public.demo_sessions (auth_user_id);
create index if not exists idx_decision_runs_session on public.decision_runs (demo_session_id, created_at desc);

alter table public.synthetic_users enable row level security;
alter table public.demo_sessions enable row level security;
alter table public.decision_runs enable row level security;
alter table public.decision_rules enable row level security;
alter table public.decision_recommendations enable row level security;

create policy "Read synthetic users"
  on public.synthetic_users for select to authenticated using (true);

create policy "Read own demo session"
  on public.demo_sessions for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "Read own decisions"
  on public.decision_runs for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "Read own decision rules"
  on public.decision_rules for select to authenticated
  using (
    exists (
      select 1 from public.decision_runs r
      where r.id = decision_run_id and r.auth_user_id = (select auth.uid())
    )
  );

create policy "Read own decision recommendations"
  on public.decision_recommendations for select to authenticated
  using (
    exists (
      select 1 from public.decision_runs r
      where r.id = decision_run_id and r.auth_user_id = (select auth.uid())
    )
  );
-- Feature store de inteligÃªncia para personas sintÃ©ticas (Comer Fora).
-- Rodar no SQL Editor apÃ³s 006. Sem PII real.

alter table public.synthetic_users
  add column if not exists preferred_cuisine text not null default 'Brasileira'
    check (char_length(preferred_cuisine) between 1 and 40),
  add column if not exists preferred_hour_slot text not null default '19hâ€“20h'
    check (char_length(preferred_hour_slot) between 1 and 40),
  add column if not exists price_sensitivity numeric(4,3) not null default 0.5
    check (price_sensitivity >= 0 and price_sensitivity <= 1),
  add column if not exists coupon_redemption_rate_90d numeric(5,4) not null default 0.2
    check (coupon_redemption_rate_90d >= 0 and coupon_redemption_rate_90d <= 1),
  add column if not exists last_nps_score integer not null default 7
    check (last_nps_score between 0 and 10),
  add column if not exists last_sentiment text not null default 'neutro'
    check (last_sentiment in ('positivo', 'neutro', 'negativo')),
  add column if not exists friction_reason text not null default 'nenhum'
    check (friction_reason in ('preco', 'demora', 'qualidade', 'nenhum')),
  add column if not exists party_size_mode text not null default '2'
    check (party_size_mode in ('1', '2', '4+')),
  add column if not exists comer_fora_visits_90d integer not null default 0
    check (comer_fora_visits_90d >= 0),
  add column if not exists favorite_restaurant_id uuid
    references public.restaurants(id) on delete set null,
  add column if not exists lifetime_margin_brl numeric(12,2) not null default 0
    check (lifetime_margin_brl >= 0),
  add column if not exists avg_margin_pct numeric(5,2) not null default 16
    check (avg_margin_pct >= 0 and avg_margin_pct <= 100);

create index if not exists idx_synthetic_users_cuisine
  on public.synthetic_users (preferred_cuisine);

create index if not exists idx_synthetic_users_cf_visits
  on public.synthetic_users (comer_fora_visits_90d);

create index if not exists idx_synthetic_users_favorite_rest
  on public.synthetic_users (favorite_restaurant_id)
  where favorite_restaurant_id is not null;

comment on column public.synthetic_users.preferred_cuisine is
  'Feature store: culinÃ¡ria preferida para vitrine/prÃ©-pedido/prato grÃ¡tis';
comment on column public.synthetic_users.price_sensitivity is
  '0=insensÃ­vel a preÃ§o (VIP) â€¦ 1=muito sensÃ­vel (cupom)';
comment on column public.synthetic_users.comer_fora_visits_90d is
  'Visitas presenciais Comer Fora em 90d â€” 0 = sÃ³ delivery / potencial conversÃ£o';
