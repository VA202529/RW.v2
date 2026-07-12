-- BarberFlow WP1: booking holds, checkout state, Stripe webhook helpers, and cron GC.

alter table public.bookings
  add column if not exists hold_ip text;

create table public.checkout_session_expirations (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  booking_id uuid references public.bookings(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processed','failed')),
  attempts int not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.checkout_session_expirations enable row level security;

create policy "Admins have full access to checkout_session_expirations"
  on public.checkout_session_expirations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists checkout_session_expirations_status_idx
  on public.checkout_session_expirations(status, created_at);

create or replace function public.wp1_deposit_cents(
  price_cents int,
  deposit_type text,
  deposit_value int
)
returns int
language sql
immutable
as $$
  select case
    when deposit_type = 'fixed' then deposit_value
    when deposit_type = 'percentage' then round(price_cents * deposit_value / 100.0)::int
    else 0
  end
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
  v_notes text;
  v_superseded_sessions text[];
begin
  if not coalesce(p_terms_accepted, false) then
    return jsonb_build_object('status', 400, 'code', 'TERMS_REQUIRED');
  end if;

  if p_email is null or length(trim(p_email)) = 0 then
    return jsonb_build_object('status', 400, 'code', 'EMAIL_REQUIRED');
  end if;

  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9]\d{6,14}$' then
    return jsonb_build_object('status', 400, 'code', 'INVALID_PHONE');
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and is_active = true
  for update;

  if not found then
    return jsonb_build_object('status', 404, 'code', 'SERVICE_NOT_FOUND');
  end if;

  if (
    select count(*)
    from public.bookings b
    join public.customers c on c.id = b.customer_id
    where c.email = p_email::extensions.citext
      and b.status = 'pending_payment'
      and b.expires_at > now()
  ) >= 3 then
    return jsonb_build_object('status', 429, 'code', 'RATE_LIMIT_EMAIL');
  end if;

  if p_ip is not null and (
    select count(*)
    from public.bookings b
    where b.hold_ip = p_ip
      and b.status = 'pending_payment'
      and b.expires_at > now()
  ) >= 3 then
    return jsonb_build_object('status', 429, 'code', 'RATE_LIMIT_IP');
  end if;

  with stale as (
    update public.bookings
    set status = 'superseded'
    where starts_at = p_starts_at
      and status = 'pending_payment'
      and expires_at <= now()
    returning id
  ), sessions as (
    insert into public.checkout_session_expirations (stripe_checkout_session_id, booking_id)
    select p.stripe_checkout_session_id, p.booking_id
    from public.payments p
    join stale s on s.id = p.booking_id
    where p.stripe_checkout_session_id is not null
    on conflict (stripe_checkout_session_id) do nothing
    returning stripe_checkout_session_id
  )
  select coalesce(array_agg(stripe_checkout_session_id), array[]::text[])
  into v_superseded_sessions
  from sessions;

  insert into public.customers (email, full_name, phone_e164, notes)
  values (p_email::extensions.citext, nullif(trim(p_full_name), ''), p_phone_e164, null)
  on conflict (email) do update
    set full_name = case
          when public.customers.auth_user_id is null then coalesce(public.customers.full_name, excluded.full_name)
          else public.customers.full_name
        end,
        phone_e164 = case
          when public.customers.auth_user_id is null then coalesce(public.customers.phone_e164, excluded.phone_e164)
          else public.customers.phone_e164
        end,
        notes = case
          when public.customers.auth_user_id is not null
           and (
             (excluded.full_name is not null and public.customers.full_name is distinct from excluded.full_name)
             or (excluded.phone_e164 is not null and public.customers.phone_e164 is distinct from excluded.phone_e164)
           )
          then concat_ws(E'\n', public.customers.notes, 'Guest booking details differed from auth-linked profile on ' || now()::text)
          else public.customers.notes
        end
  returning * into v_customer;

  insert into public.notification_prefs
    (customer_id, whatsapp_opt_in, marketing_email_opt_in)
  values
    (v_customer.id, coalesce(p_whatsapp_opt_in, false), coalesce(p_marketing_email_opt_in, false))
  on conflict (customer_id) do update
    set whatsapp_opt_in = public.notification_prefs.whatsapp_opt_in or excluded.whatsapp_opt_in,
        marketing_email_opt_in = public.notification_prefs.marketing_email_opt_in or excluded.marketing_email_opt_in;

  v_deposit_cents := public.wp1_deposit_cents(v_service.price_cents, v_service.deposit_type, v_service.deposit_value);

  begin
    insert into public.bookings (
      customer_id,
      service_id,
      starts_at,
      ends_at,
      status,
      expires_at,
      source,
      deposit_cents,
      reminder_channel,
      terms_accepted_at,
      hold_ip
    )
    values (
      v_customer.id,
      v_service.id,
      p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      'pending_payment',
      now() + interval '15 minutes',
      'online',
      v_deposit_cents,
      'email',
      now(),
      p_ip
    )
    returning * into v_booking;
  exception
    when unique_violation then
      return jsonb_build_object('status', 409, 'code', 'SLOT_TAKEN');
  end;

  return jsonb_build_object(
    'status', 201,
    'booking_id', v_booking.id,
    'customer_id', v_customer.id,
    'expires_at', v_booking.expires_at,
    'deposit_cents', v_booking.deposit_cents,
    'superseded_checkout_session_ids', to_jsonb(v_superseded_sessions)
  );
end;
$$;

create or replace function public.wp1_prepare_checkout(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_service public.services%rowtype;
  v_credit public.credits%rowtype;
  v_remaining int;
  v_apply int;
  v_credit_applied int := 0;
  v_payment_id uuid;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND');
  end if;

  if v_booking.status <> 'pending_payment' or v_booking.expires_at <= now() then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_NOT_PAYABLE');
  end if;

  select * into v_service from public.services where id = v_booking.service_id;
  v_remaining := v_booking.deposit_cents;

  for v_credit in
    select *
    from public.credits
    where customer_id = v_booking.customer_id
      and remaining_cents > 0
      and (expires_at is null or expires_at > now())
    order by created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_credit.remaining_cents, v_remaining);
    update public.credits
    set remaining_cents = remaining_cents - v_apply
    where id = v_credit.id;
    v_credit_applied := v_credit_applied + v_apply;
    v_remaining := v_remaining - v_apply;
  end loop;

  if v_remaining <= 0 then
    update public.bookings
    set status = 'confirmed'
    where id = v_booking.id;

    insert into public.payments (booking_id, amount_cents, application_fee_cents, status)
    values (v_booking.id, 0, 0, 'paid')
    returning id into v_payment_id;

    insert into public.message_log (customer_id, booking_id, channel, template, status)
    values (v_booking.customer_id, v_booking.id, 'email', 'booking_confirmed_credit', 'queued');

    return jsonb_build_object(
      'status', 200,
      'requires_stripe', false,
      'booking_id', v_booking.id,
      'payment_id', v_payment_id,
      'credit_applied_cents', v_credit_applied,
      'amount_due_cents', 0
    );
  end if;

  insert into public.payments (booking_id, amount_cents, application_fee_cents, status)
  values (v_booking.id, v_remaining, 100, 'pending')
  returning id into v_payment_id;

  return jsonb_build_object(
    'status', 200,
    'requires_stripe', true,
    'booking_id', v_booking.id,
    'payment_id', v_payment_id,
    'customer_id', v_booking.customer_id,
    'service_name', v_service.name,
    'customer_email', (select email::text from public.customers where id = v_booking.customer_id),
    'amount_due_cents', v_remaining,
    'credit_applied_cents', v_credit_applied
  );
end;
$$;

create or replace function public.wp1_attach_checkout_session(
  p_payment_id uuid,
  p_session_id text,
  p_payment_intent_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.payments
  set stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id
  where id = p_payment_id;
$$;

create or replace function public.wp1_record_stripe_event(
  p_event_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.webhook_events (provider, event_id, payload)
  values ('stripe', p_event_id, p_payload);
  return true;
exception
  when unique_violation then
    return false;
end;
$$;

create or replace function public.wp1_process_checkout_completed(
  p_booking_id uuid,
  p_session_id text,
  p_payment_intent_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('action', 'ignored', 'reason', 'BOOKING_NOT_FOUND');
  end if;

  update public.payments
  set stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_session_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id)
  where booking_id = p_booking_id
    and status in ('pending','failed');

  if v_booking.status = 'confirmed' then
    update public.payments set status = 'paid' where booking_id = p_booking_id and status <> 'refunded';
    return jsonb_build_object('action', 'already_confirmed');
  end if;

  begin
    update public.bookings
    set status = 'confirmed'
    where id = p_booking_id
      and status in ('pending_payment','superseded');
  exception
    when unique_violation then
      update public.bookings
      set status = 'refunded_conflict'
      where id = p_booking_id;

      insert into public.message_log (customer_id, booking_id, channel, template, status)
      values
        (v_booking.customer_id, p_booking_id, 'email', 'booking_refunded_conflict_apology', 'queued'),
        (v_booking.customer_id, p_booking_id, 'email', 'admin_booking_refund_alert', 'queued');

      return jsonb_build_object('action', 'refund_required');
  end;

  update public.payments
  set status = 'paid'
  where booking_id = p_booking_id and status <> 'refunded';

  insert into public.message_log (customer_id, booking_id, channel, template, status)
  values (v_booking.customer_id, p_booking_id, 'email', 'booking_confirmed', 'queued');

  return jsonb_build_object('action', 'confirmed');
end;
$$;

create or replace function public.wp1_mark_refunded_conflict(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set status = 'refunded_conflict'
  where id = p_booking_id;

  update public.payments
  set status = 'refunded',
      refunded_at = now()
  where booking_id = p_booking_id;
end;
$$;

create or replace function public.wp1_process_checkout_failed(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set status = 'superseded'
  where id = p_booking_id
    and status = 'pending_payment';

  update public.payments
  set status = 'failed'
  where booking_id = p_booking_id
    and status = 'pending';
end;
$$;

create or replace function public.wp1_supersede_expired_pending()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with expired as (
    update public.bookings
    set status = 'superseded'
    where status = 'pending_payment'
      and expires_at <= now()
    returning id
  ), queued as (
    insert into public.checkout_session_expirations (stripe_checkout_session_id, booking_id)
    select p.stripe_checkout_session_id, p.booking_id
    from public.payments p
    join expired e on e.id = p.booking_id
    where p.stripe_checkout_session_id is not null
    on conflict (stripe_checkout_session_id) do nothing
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

grant execute on function public.wp1_deposit_cents(int, text, int) to anon, authenticated;

revoke all on function public.wp1_create_booking_hold(uuid, timestamptz, text, text, text, boolean, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.wp1_prepare_checkout(uuid) from public, anon, authenticated;
revoke all on function public.wp1_attach_checkout_session(uuid, text, text) from public, anon, authenticated;
revoke all on function public.wp1_record_stripe_event(text, jsonb) from public, anon, authenticated;
revoke all on function public.wp1_process_checkout_completed(uuid, text, text) from public, anon, authenticated;
revoke all on function public.wp1_mark_refunded_conflict(uuid) from public, anon, authenticated;
revoke all on function public.wp1_process_checkout_failed(uuid) from public, anon, authenticated;
revoke all on function public.wp1_supersede_expired_pending() from public, anon, authenticated;

grant execute on function public.wp1_create_booking_hold(uuid, timestamptz, text, text, text, boolean, boolean, boolean, text) to service_role;
grant execute on function public.wp1_prepare_checkout(uuid) to service_role;
grant execute on function public.wp1_attach_checkout_session(uuid, text, text) to service_role;
grant execute on function public.wp1_record_stripe_event(text, jsonb) to service_role;
grant execute on function public.wp1_process_checkout_completed(uuid, text, text) to service_role;
grant execute on function public.wp1_mark_refunded_conflict(uuid) to service_role;
grant execute on function public.wp1_process_checkout_failed(uuid) to service_role;
grant execute on function public.wp1_supersede_expired_pending() to service_role;

-- Requires pg_cron to be enabled in the Supabase project.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'wp1-supersede-expired-pending-bookings',
  '*/5 * * * *',
  $$select public.wp1_supersede_expired_pending();$$
);
