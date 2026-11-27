-- Personas sintéticas + sessões de demo + log de decisão da IA
-- Sem PII real (AGENTS §8). Nomes são personas fictícias.

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
  -- carrinho / sessão
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

-- enriquecimento do catálogo para wait/promo
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
