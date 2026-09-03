-- Harden customer mail manage flow: protected summaries, interval reschedule checks,
-- and auditable payment preservation for rescheduled bookings.

alter table public.bookings
  add column if not exists rescheduled_from_booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists rescheduled_to_booking_id uuid references public.bookings(id) on delete set null;

create index if not exists bookings_rescheduled_from_idx on public.bookings(rescheduled_from_booking_id);
create index if not exists bookings_rescheduled_to_idx on public.bookings(rescheduled_to_booking_id);

create or replace function public.wp2_reschedule_booking(
  p_booking_id uuid,
  p_new_starts_at timestamptz,
  p_auth_user_id uuid,
  p_cancel_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer public.customers%rowtype;
  v_service public.services%rowtype;
  v_new_booking public.bookings%rowtype;
  v_allowed boolean;
  v_new_ends_at timestamptz;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND');
  end if;

  select * into v_customer from public.customers where id = v_booking.customer_id;
  select * into v_service from public.services where id = v_booking.service_id;

  v_allowed := (p_auth_user_id is not null and v_customer.auth_user_id = p_auth_user_id)
    or (p_cancel_token is not null and v_booking.cancel_token = public.wp2_hash_token(p_cancel_token));
  if not v_allowed then
    return jsonb_build_object('status', 403, 'code', 'FORBIDDEN');
  end if;

  if v_booking.status = 'cancelled' then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_ALREADY_CANCELLED');
  end if;
  if v_booking.status <> 'confirmed' then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_NOT_RESCHEDULABLE');
  end if;
  if v_booking.starts_at <= now() + interval '24 hours' then
    return jsonb_build_object('status', 409, 'code', 'RESCHEDULE_DEADLINE_PASSED');
  end if;
  if p_new_starts_at <= now() then
    return jsonb_build_object('status', 400, 'code', 'NEW_SLOT_IN_PAST');
  end if;

  v_new_ends_at := p_new_starts_at + make_interval(mins => v_service.duration_minutes);

  if exists (
    select 1
    from public.bookings b
    where b.id <> v_booking.id
      and (
        b.status = 'confirmed'
        or (b.status = 'pending_payment' and b.expires_at > now())
      )
      and b.starts_at < v_new_ends_at
      and b.ends_at > p_new_starts_at
  ) or exists (
    select 1
    from public.blocked_slots bs
    where bs.starts_at < v_new_ends_at
      and bs.ends_at > p_new_starts_at
  ) then
    return jsonb_build_object('status', 409, 'code', 'SLOT_TAKEN');
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_token = null
  where id = v_booking.id;

  begin
    insert into public.bookings (
      customer_id, service_id, starts_at, ends_at, status, source, deposit_cents,
      reminder_channel, terms_accepted_at, cancel_token, rescheduled_from_booking_id
    )
    values (
      v_booking.customer_id, v_booking.service_id, p_new_starts_at, v_new_ends_at,
      'confirmed', v_booking.source, v_booking.deposit_cents,
      'email', v_booking.terms_accepted_at, v_booking.cancel_token, v_booking.id
    )
    returning * into v_new_booking;
  exception
    when unique_violation then
      update public.bookings
      set status = 'confirmed',
          cancelled_at = null,
          cancel_token = v_booking.cancel_token
      where id = v_booking.id;
      return jsonb_build_object('status', 409, 'code', 'SLOT_TAKEN');
  end;

  update public.bookings
  set rescheduled_to_booking_id = v_new_booking.id
  where id = v_booking.id;

  update public.payments
  set booking_id = v_new_booking.id
  where booking_id = v_booking.id
    and status in ('paid', 'refunded', 'partially_refunded');

  return jsonb_build_object(
    'status', 200,
    'old_booking_id', v_booking.id,
    'new_booking_id', v_new_booking.id,
    'customer_id', v_customer.id,
    'customer_email', v_customer.email,
    'service_name', v_service.name,
    'starts_at', v_new_booking.starts_at,
    'ends_at', v_new_booking.ends_at,
    'rescheduled_from_booking_id', v_booking.id
  );
end;
$$;

revoke all on function public.wp2_reschedule_booking(uuid, timestamptz, uuid, text) from public, anon, authenticated;
grant execute on function public.wp2_reschedule_booking(uuid, timestamptz, uuid, text) to service_role;

notify pgrst, 'reload schema';
