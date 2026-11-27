-- Comer Fora — schema inicial (Direção 1)
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
