-- RW CUTZZ Booking Domain / Availability Engine V2 - Phase 1.
-- Additive canonical server-side availability contract for slots and mutations.

create or replace function public.rwcutzz_business_timezone()
returns text
language sql
stable
as $$
  select 'Europe/Amsterdam'::text;
$$;

create or replace function public.rwcutzz_slot_interval_minutes()
returns int
language sql
stable
as $$
  select 15;
$$;

create or replace function public.rwcutzz_capacity_status_map()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'blocks_capacity', jsonb_build_array('confirmed', 'pending_payment'),
    'conditional', jsonb_build_object('pending_payment', 'expires_at > now()'),
    'does_not_block_capacity', jsonb_build_array('completed', 'cancelled', 'no_show', 'superseded', 'refunded_conflict')
  );
$$;

create or replace function public.rwcutzz_booking_blocks_capacity(
  p_status text,
  p_expires_at timestamptz
)
returns boolean
language sql
stable
as $$
  select case
    when p_status = 'confirmed' then true
    when p_status = 'pending_payment' then p_expires_at is not null and p_expires_at > now()
    else false
  end;
$$;

create or replace function public.rwcutzz_lock_booking_domain()
returns void
language sql
volatile
as $$
  select pg_advisory_xact_lock(hashtextextended('rwcutzz-booking-domain-v2', 0));
$$;

create or replace function public.rwcutzz_resolve_working_intervals(p_date date)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  opens_at time,
  closes_at time,
  max_bookings int,
  source text
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_tz text := public.rwcutzz_business_timezone();
  v_override public.day_overrides%rowtype;
  v_weekday int;
begin
  select * into v_override
  from public.day_overrides
  where override_date = p_date;

  if found then
    if v_override.is_closed then
      return;
    end if;

    if v_override.opens_at is not null and v_override.closes_at is not null then
      starts_at := (p_date::text || ' ' || v_override.opens_at::text)::timestamp at time zone v_tz;
      ends_at := (p_date::text || ' ' || v_override.closes_at::text)::timestamp at time zone v_tz;
      opens_at := v_override.opens_at;
      closes_at := v_override.closes_at;
      max_bookings := v_override.max_bookings;
      source := 'day_override';
      return next;
      return;
    end if;
  end if;

  v_weekday := extract(dow from p_date)::int;

  return query
  select
    (p_date::text || ' ' || r.opens_at::text)::timestamp at time zone v_tz as starts_at,
    (p_date::text || ' ' || r.closes_at::text)::timestamp at time zone v_tz as ends_at,
    r.opens_at,
    r.closes_at,
    r.max_bookings_per_day,
    'weekly'::text
  from public.availability_rules r
  where r.is_active = true
    and r.weekday = v_weekday
  order by r.opens_at, r.closes_at;
end;
$$;

create or replace function public.rwcutzz_interval_is_available(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_exclude_booking_id uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_tz text := public.rwcutzz_business_timezone();
  v_local_date date;
  v_ends_at timestamptz;
  v_effective_ends_at timestamptz;
  v_fits_working_interval boolean;
  v_conflict_id uuid;
  v_max_bookings int;
  v_count int;
begin
  if p_starts_at is null then
    return jsonb_build_object('available', false, 'code', 'INVALID_STARTS_AT');
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and is_active = true;

  if not found then
    return jsonb_build_object('available', false, 'code', 'SERVICE_NOT_FOUND');
  end if;

  v_local_date := (p_starts_at at time zone v_tz)::date;
  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_effective_ends_at := v_ends_at + make_interval(mins => v_service.buffer_minutes);

  select exists (
    select 1
    from public.rwcutzz_resolve_working_intervals(v_local_date) w
    where p_starts_at >= w.starts_at
      and v_effective_ends_at <= w.ends_at
  )
  into v_fits_working_interval;

  select min(w.max_bookings) filter (where w.max_bookings is not null)
  into v_max_bookings
  from public.rwcutzz_resolve_working_intervals(v_local_date) w
  where p_starts_at >= w.starts_at
    and v_effective_ends_at <= w.ends_at;

  if coalesce(v_fits_working_interval, false) is not true then
    return jsonb_build_object('available', false, 'code', 'OUTSIDE_WORKING_INTERVAL');
  end if;

  select b.id into v_conflict_id
  from public.blocked_slots b
  where p_starts_at < b.ends_at
    and v_effective_ends_at > b.starts_at
  limit 1;

  if v_conflict_id is not null then
    return jsonb_build_object('available', false, 'code', 'BLOCKED_SLOT', 'conflict_id', v_conflict_id);
  end if;

  select b.id into v_conflict_id
  from public.bookings b
  join public.services s on s.id = b.service_id
  where (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
    and public.rwcutzz_booking_blocks_capacity(b.status, b.expires_at)
    and b.source in ('online', 'manual')
    and p_starts_at < (b.ends_at + make_interval(mins => coalesce(s.buffer_minutes, 0)))
    and v_effective_ends_at > b.starts_at
  limit 1;

  if v_conflict_id is not null then
    return jsonb_build_object('available', false, 'code', 'SLOT_TAKEN', 'conflict_id', v_conflict_id);
  end if;

  if v_max_bookings is not null then
    select count(*) into v_count
    from public.bookings b
    where (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      and public.rwcutzz_booking_blocks_capacity(b.status, b.expires_at)
      and b.source in ('online', 'manual')
      and (b.starts_at at time zone v_tz)::date = v_local_date;

    if v_count >= v_max_bookings then
      return jsonb_build_object('available', false, 'code', 'MAX_BOOKINGS_REACHED');
    end if;
  end if;

  return jsonb_build_object(
    'available', true,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'effective_ends_at', v_effective_ends_at,
    'buffer_minutes', v_service.buffer_minutes,
    'duration_minutes', v_service.duration_minutes
  );
end;
$$;

create or replace function public.rwcutzz_available_slots(
  p_service_id uuid,
  p_from date,
  p_to date,
  p_public boolean default true,
  p_exclude_booking_id uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_booking_open boolean;
  v_date date;
  v_interval record;
  v_cursor timestamptz;
  v_step interval := make_interval(mins => public.rwcutzz_slot_interval_minutes());
  v_check jsonb;
  v_slots jsonb := '[]'::jsonb;
begin
  if p_service_id is null or p_from is null or p_to is null or p_to < p_from or p_to > p_from + 31 then
    return jsonb_build_object('status', 400, 'code', 'INVALID_RANGE', 'slots', '[]'::jsonb);
  end if;

  v_booking_open := public.get_booking_open();
  if p_public and v_booking_open is false then
    return jsonb_build_object('status', 200, 'booking_open', false, 'slots', '[]'::jsonb);
  end if;

  v_date := p_from;
  while v_date <= p_to loop
    for v_interval in
      select * from public.rwcutzz_resolve_working_intervals(v_date)
    loop
      v_cursor := v_interval.starts_at;
      while v_cursor < v_interval.ends_at loop
        v_check := public.rwcutzz_interval_is_available(p_service_id, v_cursor, p_exclude_booking_id);
        if (v_check->>'available')::boolean then
          v_slots := v_slots || jsonb_build_array(jsonb_build_object(
            'starts_at', v_cursor,
            'local_date', (v_cursor at time zone public.rwcutzz_business_timezone())::date::text,
            'local_time', to_char(v_cursor at time zone public.rwcutzz_business_timezone(), 'HH24:MI')
          ));
        end if;
        v_cursor := v_cursor + v_step;
      end loop;
    end loop;
    v_date := v_date + 1;
  end loop;

  return jsonb_build_object(
    'status', 200,
    'booking_open', v_booking_open,
    'timezone', public.rwcutzz_business_timezone(),
    'slot_interval_minutes', public.rwcutzz_slot_interval_minutes(),
    'capacity_status_map', public.rwcutzz_capacity_status_map(),
    'slots', v_slots
  );
end;
$$;

create or replace function public.wp1_create_booking_hold(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_email text,
  p_phone_e164 text,
  p_whatsapp_opt_in boolean,
  p_marketing_email_opt_in boolean,
  p_terms_accepted boolean,
  p_ip text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_service public.services%rowtype;
  v_customer public.customers%rowtype;
  v_booking public.bookings%rowtype;
  v_deposit_cents int;
  v_cancel_token text := gen_random_uuid()::text;
  v_superseded_sessions text[];
  v_availability jsonb;
begin
  perform public.rwcutzz_lock_booking_domain();

  if public.get_booking_open() is false then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_CLOSED');
  end if;
  if not coalesce(p_terms_accepted, false) then
    return jsonb_build_object('status', 400, 'code', 'TERMS_REQUIRED');
  end if;
  if p_email is null or length(trim(p_email)) = 0 then
    return jsonb_build_object('status', 400, 'code', 'EMAIL_REQUIRED');
  end if;
  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9]\d{6,14}$' then
    return jsonb_build_object('status', 400, 'code', 'INVALID_PHONE');
  end if;

  select * into v_service from public.services where id = p_service_id and is_active = true for update;
  if not found then
    return jsonb_build_object('status', 404, 'code', 'SERVICE_NOT_FOUND');
  end if;

  select * into v_customer from public.customers where email = p_email::extensions.citext;
  if found and v_customer.is_blocked then
    return jsonb_build_object('status', 403, 'code', 'CUSTOMER_BLOCKED', 'message', 'Online boeken niet beschikbaar, neem contact op met de kapper.');
  end if;

  if (
    select count(*) from public.bookings b join public.customers c on c.id = b.customer_id
    where c.email = p_email::extensions.citext and b.status = 'pending_payment' and b.expires_at > now()
  ) >= 3 then
    return jsonb_build_object('status', 429, 'code', 'RATE_LIMIT_EMAIL');
  end if;

  if p_ip is not null and (
    select count(*) from public.bookings b
    where b.hold_ip = p_ip and b.status = 'pending_payment' and b.expires_at > now()
  ) >= 3 then
    return jsonb_build_object('status', 429, 'code', 'RATE_LIMIT_IP');
  end if;

  with stale as (
    update public.bookings set status = 'superseded'
    where status = 'pending_payment' and expires_at <= now()
    returning id
  ), sessions as (
    insert into public.checkout_session_expirations (stripe_checkout_session_id, booking_id)
    select p.stripe_checkout_session_id, p.booking_id
    from public.payments p join stale s on s.id = p.booking_id
    where p.stripe_checkout_session_id is not null
    on conflict (stripe_checkout_session_id) do nothing
    returning stripe_checkout_session_id
  )
  select coalesce(array_agg(stripe_checkout_session_id), array[]::text[]) into v_superseded_sessions from sessions;

  v_availability := public.rwcutzz_interval_is_available(p_service_id, p_starts_at, null);
  if (v_availability->>'available')::boolean is not true then
    return jsonb_build_object('status', 409, 'code', coalesce(v_availability->>'code', 'SLOT_UNAVAILABLE'));
  end if;

  insert into public.customers (email, full_name, phone_e164, notes)
  values (p_email::extensions.citext, nullif(trim(p_full_name), ''), p_phone_e164, null)
  on conflict (email) do update
    set full_name = case when public.customers.auth_user_id is null then coalesce(public.customers.full_name, excluded.full_name) else public.customers.full_name end,
        phone_e164 = case when public.customers.auth_user_id is null then coalesce(public.customers.phone_e164, excluded.phone_e164) else public.customers.phone_e164 end
  returning * into v_customer;

  insert into public.notification_prefs (customer_id, whatsapp_opt_in, marketing_email_opt_in)
  values (v_customer.id, coalesce(p_whatsapp_opt_in, false), coalesce(p_marketing_email_opt_in, false))
  on conflict (customer_id) do update
    set whatsapp_opt_in = public.notification_prefs.whatsapp_opt_in or excluded.whatsapp_opt_in,
        marketing_email_opt_in = public.notification_prefs.marketing_email_opt_in or excluded.marketing_email_opt_in;

  v_deposit_cents := public.wp1_deposit_cents(v_service.price_cents, v_service.deposit_type, v_service.deposit_value);

  insert into public.bookings (
    customer_id, service_id, starts_at, ends_at, status, expires_at, source, deposit_cents,
    reminder_channel, terms_accepted_at, hold_ip, cancel_token
  )
  values (
    v_customer.id, v_service.id, p_starts_at, p_starts_at + make_interval(mins => v_service.duration_minutes),
    'pending_payment', now() + interval '15 minutes', 'online', v_deposit_cents,
    'email', now(), p_ip, public.wp2_hash_token(v_cancel_token)
  )
  returning * into v_booking;

  return jsonb_build_object(
    'status', 201,
    'booking_id', v_booking.id,
    'customer_id', v_customer.id,
    'expires_at', v_booking.expires_at,
    'deposit_cents', v_booking.deposit_cents,
    'cancel_token', v_cancel_token,
    'superseded_checkout_session_ids', to_jsonb(v_superseded_sessions)
  );
exception
  when unique_violation then
    return jsonb_build_object('status', 409, 'code', 'SLOT_TAKEN');
end;
$$;

create or replace function public.wp3_admin_manual_booking(
  p_auth_user_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_email text,
  p_phone_e164 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_service public.services%rowtype;
  v_customer public.customers%rowtype;
  v_booking public.bookings%rowtype;
  v_availability jsonb;
begin
  perform public.rwcutzz_lock_booking_domain();

  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  select * into v_service from public.services where id=p_service_id and is_active = true;
  if not found then return jsonb_build_object('status',404,'code','SERVICE_NOT_FOUND'); end if;

  v_availability := public.rwcutzz_interval_is_available(p_service_id, p_starts_at, null);
  if (v_availability->>'available')::boolean is not true then
    return jsonb_build_object('status',409,'code',coalesce(v_availability->>'code','SLOT_UNAVAILABLE'));
  end if;

  insert into public.customers(email, full_name, phone_e164)
  values (p_email::extensions.citext, nullif(trim(p_full_name),''), p_phone_e164)
  on conflict(email) do update
    set full_name=coalesce(public.customers.full_name, excluded.full_name),
        phone_e164=coalesce(public.customers.phone_e164, excluded.phone_e164)
  returning * into v_customer;

  insert into public.bookings(customer_id, service_id, starts_at, ends_at, status, source, deposit_cents, terms_accepted_at)
  values(v_customer.id, v_service.id, p_starts_at, p_starts_at + make_interval(mins => v_service.duration_minutes),
         'confirmed', 'manual', 0, now())
  returning * into v_booking;

  return jsonb_build_object('status',201,'booking_id',v_booking.id);
exception
  when unique_violation then
    return jsonb_build_object('status',409,'code','SLOT_TAKEN','message','Tijdstip is al bezet');
end;
$$;

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
  v_availability jsonb;
  v_new_ends_at timestamptz;
begin
  perform public.rwcutzz_lock_booking_domain();

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

  if v_booking.status <> 'confirmed' then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_NOT_RESCHEDULABLE');
  end if;
  if v_booking.starts_at <= now() + interval '24 hours' then
    return jsonb_build_object('status', 409, 'code', 'RESCHEDULE_DEADLINE_PASSED');
  end if;
  if p_new_starts_at <= now() then
    return jsonb_build_object('status', 400, 'code', 'NEW_SLOT_IN_PAST');
  end if;

  v_availability := public.rwcutzz_interval_is_available(v_booking.service_id, p_new_starts_at, v_booking.id);
  if (v_availability->>'available')::boolean is not true then
    return jsonb_build_object('status',409,'code',coalesce(v_availability->>'code','SLOT_UNAVAILABLE'));
  end if;

  v_new_ends_at := p_new_starts_at + make_interval(mins => v_service.duration_minutes);

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_token = null
  where id = v_booking.id;

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
exception
  when unique_violation then
    update public.bookings
    set status = 'confirmed',
        cancelled_at = null,
        cancel_token = v_booking.cancel_token
    where id = v_booking.id;
    return jsonb_build_object('status', 409, 'code', 'SLOT_TAKEN');
end;
$$;

revoke all on function public.rwcutzz_business_timezone() from public, anon, authenticated;
revoke all on function public.rwcutzz_slot_interval_minutes() from public, anon, authenticated;
revoke all on function public.rwcutzz_capacity_status_map() from public, anon, authenticated;
revoke all on function public.rwcutzz_booking_blocks_capacity(text, timestamptz) from public, anon, authenticated;
revoke all on function public.rwcutzz_lock_booking_domain() from public, anon, authenticated;
revoke all on function public.rwcutzz_resolve_working_intervals(date) from public, anon, authenticated;
revoke all on function public.rwcutzz_interval_is_available(uuid, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.rwcutzz_available_slots(uuid, date, date, boolean, uuid) from public, anon, authenticated;

grant execute on function public.rwcutzz_business_timezone() to service_role;
grant execute on function public.rwcutzz_slot_interval_minutes() to service_role;
grant execute on function public.rwcutzz_capacity_status_map() to service_role;
grant execute on function public.rwcutzz_booking_blocks_capacity(text, timestamptz) to service_role;
grant execute on function public.rwcutzz_lock_booking_domain() to service_role;
grant execute on function public.rwcutzz_resolve_working_intervals(date) to service_role;
grant execute on function public.rwcutzz_interval_is_available(uuid, timestamptz, uuid) to service_role;
grant execute on function public.rwcutzz_available_slots(uuid, date, date, boolean, uuid) to service_role;

revoke all on function public.wp1_create_booking_hold(uuid, timestamptz, text, text, text, boolean, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.wp3_admin_manual_booking(uuid, uuid, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.wp2_reschedule_booking(uuid, timestamptz, uuid, text) from public, anon, authenticated;
grant execute on function public.wp1_create_booking_hold(uuid, timestamptz, text, text, text, boolean, boolean, boolean, text) to service_role;
grant execute on function public.wp3_admin_manual_booking(uuid, uuid, timestamptz, text, text, text) to service_role;
grant execute on function public.wp2_reschedule_booking(uuid, timestamptz, uuid, text) to service_role;

notify pgrst, 'reload schema';
