-- View agregada para o painel (sem PII). Consumida via service role no servidor.

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
