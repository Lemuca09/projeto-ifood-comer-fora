-- Contadores atômicos (rate limit) + auditoria segura + versão em eventos

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
