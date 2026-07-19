-- BarberFlow WP2: account management, cancellation tokens, reminder queues, and unsubscribe tokens.

alter table public.bookings
  add column if not exists cancel_token text unique,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
before update on public.bookings
for each row execute function public.touch_updated_at();

create or replace function public.wp2_hash_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
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
      hold_ip,
      cancel_token
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
      p_ip,
      public.wp2_hash_token(v_cancel_token)
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
    'cancel_token', v_cancel_token,
    'superseded_checkout_session_ids', to_jsonb(v_superseded_sessions)
  );
end;
$$;

create or replace function public.wp2_get_account(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
begin
  select * into v_customer from public.customers where auth_user_id = p_auth_user_id;
  if not found then
    return jsonb_build_object('status', 404, 'code', 'CUSTOMER_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'status', 200,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'full_name', v_customer.full_name,
      'phone_e164', v_customer.phone_e164
    ),
    'upcoming', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.starts_at)
      from (
        select b.id, b.starts_at, b.ends_at, b.status, b.deposit_cents,
               greatest(s.price_cents - b.deposit_cents, 0) as remaining_cents,
               s.id as service_id, s.name as service_name
        from public.bookings b
        join public.services s on s.id = b.service_id
        where b.customer_id = v_customer.id
          and b.status = 'confirmed'
          and b.starts_at >= now()
      ) x
    ), '[]'::jsonb),
    'past', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.starts_at desc)
      from (
        select b.id, b.starts_at, b.status, s.name as service_name,
               not exists (select 1 from public.reviews r where r.booking_id = b.id) as can_review
        from public.bookings b
        join public.services s on s.id = b.service_id
        where b.customer_id = v_customer.id
          and (b.starts_at < now() or b.status in ('completed','cancelled','no_show'))
      ) x
    ), '[]'::jsonb),
    'visit_count', (select count(*) from public.bookings where customer_id = v_customer.id and status = 'completed'),
    'credit_cents', coalesce((select sum(remaining_cents) from public.credits where customer_id = v_customer.id), 0),
    'prefs', coalesce((
      select to_jsonb(p) - 'customer_id' from public.notification_prefs p where p.customer_id = v_customer.id
    ), '{"whatsapp_opt_in":false,"marketing_email_opt_in":false,"reminder_3h_enabled":true}'::jsonb)
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
  v_customer public.customers%rowtype;
  v_remaining int;
  v_apply int;
  v_credit_applied int := 0;
  v_payment_id uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND');
  end if;
  if v_booking.status <> 'pending_payment' or v_booking.expires_at <= now() then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_NOT_PAYABLE');
  end if;

  select * into v_service from public.services where id = v_booking.service_id;
  select * into v_customer from public.customers where id = v_booking.customer_id;
  v_remaining := v_booking.deposit_cents;

  for v_credit in
    select * from public.credits
    where customer_id = v_booking.customer_id
      and remaining_cents > 0
      and (expires_at is null or expires_at > now())
    order by created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_credit.remaining_cents, v_remaining);
    update public.credits set remaining_cents = remaining_cents - v_apply where id = v_credit.id;
    v_credit_applied := v_credit_applied + v_apply;
    v_remaining := v_remaining - v_apply;
  end loop;

  if v_remaining <= 0 then
    update public.bookings set status = 'confirmed' where id = v_booking.id;
    insert into public.payments (booking_id, amount_cents, application_fee_cents, status)
    values (v_booking.id, 0, 0, 'paid')
    returning id into v_payment_id;

    return jsonb_build_object(
      'status', 200,
      'requires_stripe', false,
      'booking_id', v_booking.id,
      'payment_id', v_payment_id,
      'customer_id', v_customer.id,
      'customer_email', v_customer.email,
      'auth_user_id', v_customer.auth_user_id,
      'service_name', v_service.name,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'deposit_cents', v_booking.deposit_cents,
      'remaining_cents', greatest(v_service.price_cents - v_booking.deposit_cents, 0),
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
    'customer_id', v_customer.id,
    'customer_email', v_customer.email,
    'service_name', v_service.name,
    'amount_due_cents', v_remaining,
    'credit_applied_cents', v_credit_applied
  );
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
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('action', 'ignored', 'reason', 'BOOKING_NOT_FOUND');
  end if;

  update public.payments
  set stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_session_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id)
  where booking_id = p_booking_id and status in ('pending','failed');

  if v_booking.status = 'confirmed' then
    update public.payments set status = 'paid' where booking_id = p_booking_id and status <> 'refunded';
    return jsonb_build_object('action', 'already_confirmed');
  end if;

  begin
    update public.bookings
    set status = 'confirmed'
    where id = p_booking_id and status in ('pending_payment','superseded');
  exception
    when unique_violation then
      update public.bookings set status = 'refunded_conflict' where id = p_booking_id;
      return jsonb_build_object('action', 'refund_required');
  end;

  update public.payments set status = 'paid' where booking_id = p_booking_id and status <> 'refunded';
  return jsonb_build_object('action', 'confirmed');
end;
$$;

create or replace function public.wp2_prepare_cancel(
  p_booking_id uuid,
  p_action text,
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
  v_payment public.payments%rowtype;
  v_allowed boolean;
  v_before_deadline boolean;
begin
  if p_action not in ('credit','refund') then
    return jsonb_build_object('status', 400, 'code', 'INVALID_ACTION');
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND');
  end if;

  select * into v_customer from public.customers where id = v_booking.customer_id;
  v_allowed := (p_auth_user_id is not null and v_customer.auth_user_id = p_auth_user_id)
    or (p_cancel_token is not null and v_booking.cancel_token = public.wp2_hash_token(p_cancel_token));
  if not v_allowed then
    return jsonb_build_object('status', 403, 'code', 'FORBIDDEN');
  end if;

  if v_booking.status <> 'confirmed' then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_NOT_CANCELLABLE');
  end if;

  select * into v_payment
  from public.payments
  where booking_id = p_booking_id and status = 'paid' and amount_cents > 0
  order by created_at desc
  limit 1;

  v_before_deadline := v_booking.starts_at > now() + interval '24 hours';

  return jsonb_build_object(
    'status', 200,
    'requires_refund', v_before_deadline and v_payment.id is not null,
    'before_deadline', v_before_deadline,
    'booking_id', v_booking.id,
    'customer_id', v_customer.id,
    'customer_email', v_customer.email,
    'payment_intent_id', v_payment.stripe_payment_intent_id,
    'deposit_cents', v_booking.deposit_cents,
    'action', p_action
  );
end;
$$;

create or replace function public.wp2_finalize_cancel(
  p_booking_id uuid,
  p_action text,
  p_refunded boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer public.customers%rowtype;
  v_before_deadline boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND');
  end if;
  select * into v_customer from public.customers where id = v_booking.customer_id;
  v_before_deadline := v_booking.starts_at > now() + interval '24 hours';

  if v_before_deadline and p_action = 'credit' then
    insert into public.credits (customer_id, amount_cents, remaining_cents, source_booking_id)
    values (v_booking.customer_id, v_booking.deposit_cents, v_booking.deposit_cents, v_booking.id);
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_token = null
  where id = v_booking.id;

  if p_refunded then
    update public.payments
    set status = 'refunded',
        refunded_at = now()
    where booking_id = v_booking.id and status = 'paid';
  end if;

  return jsonb_build_object(
    'status', 200,
    'customer_email', v_customer.email,
    'customer_id', v_customer.id,
    'credited', v_before_deadline and p_action = 'credit',
    'refunded', v_before_deadline and p_action = 'refund',
    'forfeited', not v_before_deadline
  );
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
  if v_booking.status <> 'confirmed' then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_NOT_RESCHEDULABLE');
  end if;
  if v_booking.starts_at <= now() + interval '24 hours' then
    return jsonb_build_object('status', 409, 'code', 'RESCHEDULE_DEADLINE_PASSED');
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_token = null
  where id = v_booking.id;

  begin
    insert into public.bookings (
      customer_id, service_id, starts_at, ends_at, status, source, deposit_cents,
      reminder_channel, terms_accepted_at, cancel_token
    )
    values (
      v_booking.customer_id, v_booking.service_id, p_new_starts_at,
      p_new_starts_at + make_interval(mins => v_service.duration_minutes),
      'confirmed', v_booking.source, v_booking.deposit_cents,
      'email', v_booking.terms_accepted_at, v_booking.cancel_token
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

  return jsonb_build_object(
    'status', 200,
    'old_booking_id', v_booking.id,
    'new_booking_id', v_new_booking.id,
    'customer_id', v_customer.id,
    'customer_email', v_customer.email,
    'service_name', v_service.name,
    'starts_at', v_new_booking.starts_at
  );
end;
$$;

create or replace function public.wp2_update_notification_prefs(
  p_auth_user_id uuid,
  p_whatsapp_opt_in boolean,
  p_marketing_email_opt_in boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select id into v_customer_id from public.customers where auth_user_id = p_auth_user_id;
  if v_customer_id is null then
    return jsonb_build_object('status', 404, 'code', 'CUSTOMER_NOT_FOUND');
  end if;

  insert into public.notification_prefs (customer_id, whatsapp_opt_in, marketing_email_opt_in)
  values (v_customer_id, coalesce(p_whatsapp_opt_in, false), coalesce(p_marketing_email_opt_in, false))
  on conflict (customer_id) do update
    set whatsapp_opt_in = excluded.whatsapp_opt_in,
        marketing_email_opt_in = excluded.marketing_email_opt_in;

  return jsonb_build_object('status', 200);
end;
$$;

create or replace function public.wp2_delete_account_prepare(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
begin
  select * into v_customer from public.customers where auth_user_id = p_auth_user_id for update;
  if not found then
    return jsonb_build_object('status', 404, 'code', 'CUSTOMER_NOT_FOUND');
  end if;

  update public.reviews
  set body = '[verwijderd]'
  where customer_id = v_customer.id;

  update public.customers
  set anonymized_at = now(),
      full_name = null,
      phone_e164 = null,
      email = ('deleted-' || id || '@deleted.invalid')::extensions.citext,
      auth_user_id = null
  where id = v_customer.id;

  return jsonb_build_object('status', 200, 'auth_user_id', p_auth_user_id, 'customer_id', v_customer.id);
end;
$$;

create or replace function public.wp2_unsubscribe_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_customer_id uuid;
begin
  select id into v_customer_id from public.customers where email = p_email::extensions.citext;
  if v_customer_id is null then
    return jsonb_build_object('status', 404, 'code', 'CUSTOMER_NOT_FOUND');
  end if;

  insert into public.notification_prefs (customer_id, marketing_email_opt_in)
  values (v_customer_id, false)
  on conflict (customer_id) do update
    set marketing_email_opt_in = false;

  return jsonb_build_object('status', 200);
end;
$$;

create or replace function public.wp2_due_emails(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if p_kind = 'booking_reminder_48h' then
    with due as (
      update public.bookings b
      set reminder_48h_sent_at = now(),
          reminder_channel = 'email'
      where b.status = 'confirmed'
        and b.starts_at between now() + interval '47 hours' and now() + interval '49 hours'
        and b.reminder_48h_sent_at is null
      returning b.*
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'template', p_kind,
      'booking_id', d.id,
      'customer_id', c.id,
      'to', c.email,
      'service_name', s.name,
      'starts_at', d.starts_at,
      'cancel_token_hash', d.cancel_token
    )), '[]'::jsonb)
    into v_rows
    from due d join public.customers c on c.id = d.customer_id join public.services s on s.id = d.service_id;
    return v_rows;
  elsif p_kind = 'booking_reminder_3h' then
    with due as (
      update public.bookings b
      set reminder_3h_sent_at = now(),
          reminder_channel = 'email'
      from public.notification_prefs p
      where p.customer_id = b.customer_id
        and p.reminder_3h_enabled = true
        and b.status = 'confirmed'
        and b.starts_at between now() + interval '2 hours 45 minutes' and now() + interval '3 hours 15 minutes'
        and b.reminder_3h_sent_at is null
      returning b.*
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'template', p_kind,
      'booking_id', d.id,
      'customer_id', c.id,
      'to', c.email,
      'service_name', s.name,
      'starts_at', d.starts_at
    )), '[]'::jsonb)
    into v_rows
    from due d join public.customers c on c.id = d.customer_id join public.services s on s.id = d.service_id;
    return v_rows;
  elsif p_kind = 'review_request' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'template', p_kind,
      'booking_id', b.id,
      'customer_id', c.id,
      'to', c.email,
      'service_name', s.name,
      'starts_at', b.starts_at
    )), '[]'::jsonb)
    into v_rows
    from public.bookings b
    join public.customers c on c.id = b.customer_id
    join public.services s on s.id = b.service_id
    where b.status = 'completed'
      and b.updated_at between now() - interval '25 hours' and now() - interval '23 hours'
      and not exists (
        select 1 from public.message_log m
        where m.booking_id = b.id and m.template = 'review_request'
      );
    return v_rows;
  end if;

  return '[]'::jsonb;
end;
$$;

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'wp2-booking-reminder-48h',
  '0 * * * *',
  $$select net.http_post(
    url := current_setting('app.settings.supabase_functions_url', true) || '/send-due-emails',
    headers := jsonb_build_object('content-type','application/json','x-internal-secret', current_setting('app.settings.internal_function_secret', true)),
    body := '{"kind":"booking_reminder_48h"}'::jsonb
  );$$
);

select cron.schedule(
  'wp2-booking-reminder-3h',
  '0 * * * *',
  $$select net.http_post(
    url := current_setting('app.settings.supabase_functions_url', true) || '/send-due-emails',
    headers := jsonb_build_object('content-type','application/json','x-internal-secret', current_setting('app.settings.internal_function_secret', true)),
    body := '{"kind":"booking_reminder_3h"}'::jsonb
  );$$
);

select cron.schedule(
  'wp2-review-request',
  '0 * * * *',
  $$select net.http_post(
    url := current_setting('app.settings.supabase_functions_url', true) || '/send-due-emails',
    headers := jsonb_build_object('content-type','application/json','x-internal-secret', current_setting('app.settings.internal_function_secret', true)),
    body := '{"kind":"review_request"}'::jsonb
  );$$
);

revoke all on function public.wp2_hash_token(text) from public, anon, authenticated;
revoke all on function public.wp2_get_account(uuid) from public, anon, authenticated;
revoke all on function public.wp2_prepare_cancel(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.wp2_finalize_cancel(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.wp2_reschedule_booking(uuid, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.wp2_update_notification_prefs(uuid, boolean, boolean) from public, anon, authenticated;
revoke all on function public.wp2_delete_account_prepare(uuid) from public, anon, authenticated;
revoke all on function public.wp2_unsubscribe_email(text) from public, anon, authenticated;
revoke all on function public.wp2_due_emails(text) from public, anon, authenticated;

grant execute on function public.wp2_hash_token(text) to service_role;
grant execute on function public.wp2_get_account(uuid) to service_role;
grant execute on function public.wp2_prepare_cancel(uuid, text, uuid, text) to service_role;
grant execute on function public.wp2_finalize_cancel(uuid, text, boolean) to service_role;
grant execute on function public.wp2_reschedule_booking(uuid, timestamptz, uuid, text) to service_role;
grant execute on function public.wp2_update_notification_prefs(uuid, boolean, boolean) to service_role;
grant execute on function public.wp2_delete_account_prepare(uuid) to service_role;
grant execute on function public.wp2_unsubscribe_email(text) to service_role;
grant execute on function public.wp2_due_emails(text) to service_role;
