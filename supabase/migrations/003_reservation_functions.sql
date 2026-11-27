-- Reserva e cancelamento transacionais (FOR UPDATE na linha do slot).

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
