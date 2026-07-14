-- Fix online booking for existing customers with admin-only notes/is_blocked guard.
-- Avoid INSERT ... ON CONFLICT touching admin-managed customer fields.

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
    where starts_at = p_starts_at and status = 'pending_payment' and expires_at <= now()
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

  if v_customer.id is null then
    insert into public.customers (email, full_name, phone_e164)
    values (p_email::extensions.citext, nullif(trim(p_full_name), ''), p_phone_e164)
    returning * into v_customer;
  elsif v_customer.auth_user_id is null then
    update public.customers
       set full_name = coalesce(public.customers.full_name, nullif(trim(p_full_name), '')),
           phone_e164 = coalesce(public.customers.phone_e164, p_phone_e164)
     where id = v_customer.id
    returning * into v_customer;
  end if;

  insert into public.notification_prefs (customer_id, whatsapp_opt_in, marketing_email_opt_in)
  values (v_customer.id, coalesce(p_whatsapp_opt_in, false), coalesce(p_marketing_email_opt_in, false))
  on conflict (customer_id) do update
    set whatsapp_opt_in = public.notification_prefs.whatsapp_opt_in or excluded.whatsapp_opt_in,
        marketing_email_opt_in = public.notification_prefs.marketing_email_opt_in or excluded.marketing_email_opt_in;

  v_deposit_cents := public.wp1_deposit_cents(v_service.price_cents, v_service.deposit_type, v_service.deposit_value);

  begin
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
  exception when unique_violation then
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
