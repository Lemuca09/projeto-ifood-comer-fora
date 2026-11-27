-- APPLY_ALL gerado em UTF-8. Rode no SQL Editor do Supabase.\n-- Habilite Anonymous Sign-ins antes.\n\n-- Comer Fora — schema inicial (Direção 1)
-- Dados comerciais e capacidade vivem só aqui; a IA não inventa IDs/vagas.

create extension if not exists "pgcrypto";

-- =========================================
-- 1. RESTAURANTS
-- =========================================
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  neighborhood text not null,
  address text not null,
  price_range smallint not null
    check (price_range between 1 and 4),
  occasion_tags text[] not null default '{}',
  is_active boolean not null default true,
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now(),
  constraint restaurants_name_len check (char_length(name) between 1 and 120),
  constraint restaurants_neighborhood_len check (char_length(neighborhood) between 1 and 80)
);

-- =========================================
-- 2. RESTAURANT HOURS
-- =========================================
create table public.restaurant_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,
  weekday smallint not null
    check (weekday between 0 and 6),
  open_time time not null,
  close_time time not null,
  unique (restaurant_id, weekday),
  check (open_time < close_time)
);

-- =========================================
-- 3. RESTAURANT SLOTS
-- =========================================
create table public.restaurant_slots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,
  starts_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  reserved_count integer not null default 0,
  check (reserved_count >= 0),
  check (reserved_count <= capacity),
  unique (restaurant_id, starts_at)
);

-- =========================================
-- 4. DISCOVERY REQUESTS
-- =========================================
create table public.discovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  occasion text not null
    check (char_length(occasion) between 1 and 500),
  neighborhood text not null
    check (char_length(neighborhood) between 1 and 80),
  party_size integer not null default 2
    check (party_size between 1 and 20),
  requested_for timestamptz,
  preferred_price_range smallint
    check (preferred_price_range is null or preferred_price_range between 1 and 4),
  requested_at timestamptz not null default now()
);

-- =========================================
-- 5. RECOMMENDATIONS
-- =========================================
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null
    references public.discovery_requests(id) on delete cascade,
  model text,
  prompt_version text,
  is_fallback boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================
-- 6. RECOMMENDATION ITEMS
-- =========================================
create table public.recommendation_items (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null
    references public.recommendations(id) on delete cascade,
  restaurant_id uuid not null
    references public.restaurants(id),
  rank smallint not null check (rank > 0),
  reason_code text not null
    check (reason_code in (
      'GOOD_MATCH',
      'PRICE_MATCH',
      'NEARBY',
      'AVAILABILITY',
      'POPULAR_CHOICE'
    )),
  unique (recommendation_id, restaurant_id),
  unique (recommendation_id, rank)
);

-- =========================================
-- 7. RESERVATIONS
-- =========================================
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  restaurant_id uuid not null
    references public.restaurants(id),
  slot_id uuid not null
    references public.restaurant_slots(id),
  party_size integer not null
    check (party_size between 1 and 20),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- =========================================
-- 8. SAVED PREFERENCES
-- =========================================
create table public.saved_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  preferred_neighborhood text
    check (preferred_neighborhood is null or char_length(preferred_neighborhood) <= 80),
  occasion text
    check (occasion is null or char_length(occasion) <= 500),
  price_range smallint
    check (price_range is null or price_range between 1 and 4),
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- =========================================
-- 9. RETURN INVITES
-- =========================================
create table public.return_invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  restaurant_id uuid not null
    references public.restaurants(id),
  reservation_id uuid not null
    references public.reservations(id),
  status text not null default 'created'
    check (status in ('created', 'viewed', 'accepted')),
  created_at timestamptz not null default now(),
  unique (reservation_id)
);

-- =========================================
-- 10. APP EVENTS
-- =========================================
create table public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  event_type text not null
    check (event_type in (
      'view',
      'discovery',
      'recommend',
      'restaurant_select',
      'reserve',
      'save_preference',
      'return_invite_view'
    )),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

-- Índices
create index idx_restaurants_neighborhood
  on public.restaurants (neighborhood)
  where is_active = true;

create index idx_slots_restaurant_date
  on public.restaurant_slots (restaurant_id, starts_at);

create index idx_discovery_user
  on public.discovery_requests (user_id, requested_at desc);

create index idx_recommendations_discovery
  on public.recommendations (discovery_id);

create index idx_reservations_user
  on public.reservations (user_id, created_at desc);

create index idx_reservations_restaurant
  on public.reservations (restaurant_id, status);

create index idx_events_type_date
  on public.app_events (event_type, created_at desc);

create index idx_events_user
  on public.app_events (user_id, created_at desc);
\n\n-- RLS: catálogo legível; dados do usuário isolados por auth.uid().
-- Writes de discovery/recomendação/reserva: preferir backend (service role) ou RPC.

alter table public.restaurants enable row level security;
alter table public.restaurant_hours enable row level security;
alter table public.restaurant_slots enable row level security;
alter table public.discovery_requests enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_items enable row level security;
alter table public.reservations enable row level security;
alter table public.saved_preferences enable row level security;
alter table public.return_invites enable row level security;
alter table public.app_events enable row level security;

-- Catálogo
create policy "Read active restaurants"
  on public.restaurants
  for select to authenticated
  using (is_active = true);

create policy "Read restaurant hours"
  on public.restaurant_hours
  for select to authenticated
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.is_active = true
    )
  );

create policy "Read restaurant slots"
  on public.restaurant_slots
  for select to authenticated
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.is_active = true
    )
  );

-- Discovery (leitura própria; insert só via service role no MVP)
create policy "Read own discoveries"
  on public.discovery_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Read own recommendations"
  on public.recommendations
  for select to authenticated
  using (
    exists (
      select 1 from public.discovery_requests d
      where d.id = discovery_id and d.user_id = (select auth.uid())
    )
  );

create policy "Read own recommendation items"
  on public.recommendation_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.recommendations r
      join public.discovery_requests d on d.id = r.discovery_id
      where r.id = recommendation_id and d.user_id = (select auth.uid())
    )
  );

-- Reservas / retenção / eventos
create policy "Read own reservations"
  on public.reservations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Read own preferences"
  on public.saved_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Upsert own preferences"
  on public.saved_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Update own preferences"
  on public.saved_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Read own invites"
  on public.return_invites
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Update own invites"
  on public.return_invites
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Read own events"
  on public.app_events
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Insert own events"
  on public.app_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Métricas agregadas: leitura autenticada só dos próprios eventos;
-- o painel público usa rota server-side com service role e agregação sem PII.
\n\n-- Reserva e cancelamento transacionais (FOR UPDATE na linha do slot).

create or replace function public.create_reservation(
  p_restaurant_id uuid,
  p_slot_id uuid,
  p_party_size integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_reservation_id uuid;
  v_slot public.restaurant_slots%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_party_size < 1 or p_party_size > 20 then
    raise exception 'Invalid party size';
  end if;

  select *
  into v_slot
  from public.restaurant_slots
  where id = p_slot_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception 'Slot not found';
  end if;

  if v_slot.starts_at <= now() then
    raise exception 'Slot unavailable';
  end if;

  if v_slot.capacity - v_slot.reserved_count < p_party_size then
    raise exception 'Insufficient capacity';
  end if;

  if not exists (
    select 1
    from public.restaurants
    where id = p_restaurant_id
      and is_active = true
  ) then
    raise exception 'Restaurant unavailable';
  end if;

  update public.restaurant_slots
  set reserved_count = reserved_count + p_party_size
  where id = p_slot_id;

  insert into public.reservations (
    user_id,
    restaurant_id,
    slot_id,
    party_size,
    status
  )
  values (
    v_user_id,
    p_restaurant_id,
    p_slot_id,
    p_party_size,
    'confirmed'
  )
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

create or replace function public.cancel_reservation(
  p_reservation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_res public.reservations%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_res
  from public.reservations
  where id = p_reservation_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_res.status = 'cancelled' then
    return;
  end if;

  perform 1
  from public.restaurant_slots
  where id = v_res.slot_id
  for update;

  update public.restaurant_slots
  set reserved_count = greatest(0, reserved_count - v_res.party_size)
  where id = v_res.slot_id;

  update public.reservations
  set status = 'cancelled'
  where id = p_reservation_id;
end;
$$;

revoke all on function public.create_reservation(uuid, uuid, integer)
  from public, anon;
grant execute on function public.create_reservation(uuid, uuid, integer)
  to authenticated;

revoke all on function public.cancel_reservation(uuid)
  from public, anon;
grant execute on function public.cancel_reservation(uuid)
  to authenticated;
\n\n-- View agregada para o painel (sem PII). Consumida via service role no servidor.

create or replace view public.funnel_metrics_30d
with (security_invoker = true)
as
select
  count(distinct user_id) filter (where event_type = 'recommend') as users_recommended,
  count(distinct user_id) filter (where event_type = 'reserve') as users_reserved,
  count(*) filter (where event_type = 'discovery') as total_discoveries,
  count(*) filter (where event_type = 'recommend') as total_recommendations,
  count(*) filter (where event_type = 'reserve') as total_reservations,
  count(*) filter (where event_type = 'return_invite_view') as total_invite_views
from public.app_events
where created_at >= now() - interval '30 days';

comment on view public.funnel_metrics_30d is
  'Agregados 30d do funil Comer Fora. Conversão = users_reserved / users_recommended.';
\n\n-- Contadores atômicos (rate limit) + auditoria segura + versão em eventos

create table if not exists public.rate_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0)
);

create table if not exists public.security_audit (
  id bigint generated always as identity primary key,
  category text not null,
  decisao text not null,
  rule_ids text[] not null default '{}',
  score integer,
  versao text,
  latencia_ms integer,
  session_hmac text,
  created_at timestamptz not null default now()
);

alter table public.app_events
  add column if not exists app_version text not null default '1';

alter table public.rate_buckets enable row level security;
alter table public.security_audit enable row level security;
-- Sem policies para authenticated: só service role no servidor.

comment on table public.security_audit is
  'Allowlist AGENTS §8: sem texto bruto, prompt, canary, IP ou segredo.';
\n\n-- Seed 100% sintético — Santos (bairros reais, estabelecimentos fictícios).
-- Cenários: vaga ok, sem vaga, preço alto (incompatível com faixa 1).

truncate table
  public.app_events,
  public.return_invites,
  public.saved_preferences,
  public.reservations,
  public.recommendation_items,
  public.recommendations,
  public.discovery_requests,
  public.restaurant_slots,
  public.restaurant_hours,
  public.restaurants
restart identity cascade;

-- IDs fixos para demos e testes
insert into public.restaurants (
  id, name, description, neighborhood, address, price_range, occasion_tags, is_active, is_synthetic
) values
-- Gonzaga
('11111111-1111-1111-1111-111111111101', 'Casa do Farol', 'Frutos do mar leves para jantar a dois.', 'Gonzaga', 'Rua Sintética 101, Gonzaga', 3, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111102', 'Boteco da Praça', 'Petiscos rápidos e ambiente casual.', 'Gonzaga', 'Rua Sintética 102, Gonzaga', 2, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111103', 'Massa & Brisa', 'Massas artesanais e vinho da casa.', 'Gonzaga', 'Rua Sintética 103, Gonzaga', 3, array['jantar_a_dois','familia'], true, true),
('11111111-1111-1111-1111-111111111104', 'Burger Atlântico', 'Burgers generosos para ir sem fome.', 'Gonzaga', 'Rua Sintética 104, Gonzaga', 2, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111105', 'Sashimi Norte', 'Japonesa contemporânea.', 'Gonzaga', 'Rua Sintética 105, Gonzaga', 4, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111106', 'Cantina da Vovó G', 'Pratos caseiros em porções generosas.', 'Gonzaga', 'Rua Sintética 106, Gonzaga', 1, array['familia','rapido'], true, true),
('11111111-1111-1111-1111-111111111107', 'Pizza do Trapiche', 'Forno a lenha e bordas recheadas.', 'Gonzaga', 'Rua Sintética 107, Gonzaga', 2, array['grupo','familia'], true, true),
('11111111-1111-1111-1111-111111111108', 'Verde Maré', 'Opções vegetarianas e bowls.', 'Gonzaga', 'Rua Sintética 108, Gonzaga', 2, array['rapido','jantar_a_dois'], true, true),
-- Boqueirão
('11111111-1111-1111-1111-111111111109', 'Orla Grill', 'Grelhados com vista fictícia da orla.', 'Boqueirão', 'Av. Sintética 201, Boqueirão', 3, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111110', 'Taco da Duna', 'Mexicana rápida e colorida.', 'Boqueirão', 'Av. Sintética 202, Boqueirão', 1, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111111', 'Casa Lotada Demo', 'Sempre cheio — cenário SEM VAGAS.', 'Boqueirão', 'Av. Sintética 203, Boqueirão', 2, array['grupo','rapido'], true, true),
('11111111-1111-1111-1111-111111111112', 'Peixaria do Cais', 'Peixe frito e porções para compartilhar.', 'Boqueirão', 'Av. Sintética 204, Boqueirão', 2, array['familia','grupo'], true, true),
('11111111-1111-1111-1111-111111111113', 'Bistrô Areia', 'Menu degustação curto.', 'Boqueirão', 'Av. Sintética 205, Boqueirão', 4, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111114', 'Pastel & Cia BQ', 'Pastéis e caldo — rápido e barato.', 'Boqueirão', 'Av. Sintética 206, Boqueirão', 1, array['rapido'], true, true),
('11111111-1111-1111-1111-111111111115', 'Ramen da Enseada', 'Caldos longos e ovos moles.', 'Boqueirão', 'Av. Sintética 207, Boqueirão', 2, array['rapido','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111116', 'Churrasco do Farol', 'Espetos e mandioca frita.', 'Boqueirão', 'Av. Sintética 208, Boqueirão', 3, array['grupo','familia'], true, true),
-- Ponta da Praia
('11111111-1111-1111-1111-111111111117', 'Mirante do Estuário', 'Jantar especial com carteira alta.', 'Ponta da Praia', 'Rua Fictícia 301, Ponta da Praia', 4, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111118', 'Barco Anchova', 'Petiscos de bar com chopp.', 'Ponta da Praia', 'Rua Fictícia 302, Ponta da Praia', 2, array['grupo','rapido'], true, true),
('11111111-1111-1111-1111-111111111119', 'Casa do Bacalhau PP', 'Portuguesa acolhedora.', 'Ponta da Praia', 'Rua Fictícia 303, Ponta da Praia', 3, array['familia','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111120', 'Açaí da Ponta', 'Bowls e wraps leves.', 'Ponta da Praia', 'Rua Fictícia 304, Ponta da Praia', 1, array['rapido'], true, true),
('11111111-1111-1111-1111-111111111121', 'Trattoria Ítalo PP', 'Risotos e massas.', 'Ponta da Praia', 'Rua Fictícia 305, Ponta da Praia', 3, array['jantar_a_dois','familia'], true, true),
('11111111-1111-1111-1111-111111111122', 'Hot Dog do Cais', 'Lanches noturnos.', 'Ponta da Praia', 'Rua Fictícia 306, Ponta da Praia', 1, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111123', 'Thai da Maré', 'Curry e pads.', 'Ponta da Praia', 'Rua Fictícia 307, Ponta da Praia', 2, array['jantar_a_dois','rapido'], true, true),
('11111111-1111-1111-1111-111111111124', 'Steakhouse Estrela', 'Carnes nobres — preço alto.', 'Ponta da Praia', 'Rua Fictícia 308, Ponta da Praia', 4, array['especial','jantar_a_dois'], true, true),
-- Embaré
('11111111-1111-1111-1111-111111111125', 'Empório Embaré', 'Tábuas e vinhos.', 'Embaré', 'Rua Demo 401, Embaré', 3, array['jantar_a_dois','grupo'], true, true),
('11111111-1111-1111-1111-111111111126', 'Galeto da Esquina', 'Frango e farofa — família.', 'Embaré', 'Rua Demo 402, Embaré', 2, array['familia','grupo'], true, true),
('11111111-1111-1111-1111-111111111127', 'Crepe da Baía', 'Crepes doces e salgados.', 'Embaré', 'Rua Demo 403, Embaré', 1, array['rapido'], true, true),
('11111111-1111-1111-1111-111111111128', 'Sushi Embaré Lab', 'Combinados e temakis.', 'Embaré', 'Rua Demo 404, Embaré', 3, array['jantar_a_dois','grupo'], true, true),
('11111111-1111-1111-1111-111111111129', 'Falafel do Quarteirão', 'Árabe vegetariano.', 'Embaré', 'Rua Demo 405, Embaré', 1, array['rapido','familia'], true, true),
('11111111-1111-1111-1111-111111111130', 'Casa Nordeste E', 'Baião e carne de sol.', 'Embaré', 'Rua Demo 406, Embaré', 2, array['familia','grupo'], true, true),
('11111111-1111-1111-1111-111111111131', 'Fondue da Serra Fake', 'Experiência especial.', 'Embaré', 'Rua Demo 407, Embaré', 4, array['especial','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111132', 'Poke Wave', 'Pokes montados na hora.', 'Embaré', 'Rua Demo 408, Embaré', 2, array['rapido','jantar_a_dois'], true, true),
-- Aparecida
('11111111-1111-1111-1111-111111111133', 'Padoca & Prato', 'Almoço rápido de padaria.', 'Aparecida', 'Travessa Fake 501, Aparecida', 1, array['rapido','familia'], true, true),
('11111111-1111-1111-1111-111111111134', 'Cantina Aparecida', 'Italiana de bairro.', 'Aparecida', 'Travessa Fake 502, Aparecida', 2, array['familia','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111135', 'Parmegiana House', 'Clássicos empanados.', 'Aparecida', 'Travessa Fake 503, Aparecida', 2, array['familia','grupo'], true, true),
('11111111-1111-1111-1111-111111111136', 'Veg Aparecida', 'Cardápio 100% plant-based.', 'Aparecida', 'Travessa Fake 504, Aparecida', 2, array['rapido','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111137', 'Churrasquinho do Zé Fake', 'Espetinhos na calçada.', 'Aparecida', 'Travessa Fake 505, Aparecida', 1, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111138', 'Osteria da Colina', 'Jantar a dois sofisticado.', 'Aparecida', 'Travessa Fake 506, Aparecida', 4, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111139', 'Lámen do Beco', 'Lámens generosos.', 'Aparecida', 'Travessa Fake 507, Aparecida', 2, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111140', 'Doces & Ceia', 'Café noturno e sobremesas.', 'Aparecida', 'Travessa Fake 508, Aparecida', 2, array['jantar_a_dois','rapido'], true, true);

-- Horários: seg–dom 11:00–23:00 para todos
insert into public.restaurant_hours (restaurant_id, weekday, open_time, close_time)
select r.id, d.weekday, time '11:00', time '23:00'
from public.restaurants r
cross join generate_series(0, 6) as d(weekday);

-- Slots: próximos 7 dias, 19:00 e 20:30
-- Capacidade padrão 20; Casa Lotada Demo (111) reserved_count = capacity (SEM VAGAS)
insert into public.restaurant_slots (restaurant_id, starts_at, capacity, reserved_count)
select
  r.id,
  (date_trunc('day', now() at time zone 'America/Sao_Paulo') + (d.day || ' days')::interval + t.hour_offset)::timestamptz,
  case when r.id = '11111111-1111-1111-1111-111111111111' then 10 else 20 end,
  case when r.id = '11111111-1111-1111-1111-111111111111' then 10 else 0 end
from public.restaurants r
cross join generate_series(0, 6) as d(day)
cross join (values (interval '19 hours'), (interval '20 hours 30 minutes')) as t(hour_offset);
