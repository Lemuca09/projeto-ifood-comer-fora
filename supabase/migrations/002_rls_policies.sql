-- RLS: catálogo legível; dados do usuário isolados por auth.uid().
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
