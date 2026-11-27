-- Feature store de inteligência para personas sintéticas (Comer Fora).
-- Rodar no SQL Editor após 006. Sem PII real.

alter table public.synthetic_users
  add column if not exists preferred_cuisine text not null default 'Brasileira'
    check (char_length(preferred_cuisine) between 1 and 40),
  add column if not exists preferred_hour_slot text not null default '19h–20h'
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
  'Feature store: culinária preferida para vitrine/pré-pedido/prato grátis';
comment on column public.synthetic_users.price_sensitivity is
  '0=insensível a preço (VIP) … 1=muito sensível (cupom)';
comment on column public.synthetic_users.comer_fora_visits_90d is
  'Visitas presenciais Comer Fora em 90d — 0 = só delivery / potencial conversão';
