-- Keep customer upserts away from admin-only customer fields.
-- The customers trigger only allows admins to change notes/is_blocked.

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

create or replace function public.wp4_create_order(
  p_items jsonb,
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
  v_customer public.customers%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_total int := 0;
  v_cancel_token text := gen_random_uuid()::text;
begin
  if not coalesce(p_terms_accepted, false) then return jsonb_build_object('status',400,'code','TERMS_REQUIRED'); end if;
  if p_email is null or length(trim(p_email)) = 0 then return jsonb_build_object('status',400,'code','EMAIL_REQUIRED'); end if;
  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9]\d{6,14}$' then return jsonb_build_object('status',400,'code','INVALID_PHONE'); end if;
  if jsonb_array_length(p_items) = 0 then return jsonb_build_object('status',400,'code','EMPTY_CART'); end if;

  select * into v_customer from public.customers where email = p_email::extensions.citext;
  if found and v_customer.is_blocked then
    return jsonb_build_object('status',403,'code','CUSTOMER_BLOCKED','message','Online bestellen niet beschikbaar, neem contact op met de kapper.');
  end if;

  if (
    select count(*) from public.orders o join public.customers c on c.id=o.customer_id
    where c.email = p_email::extensions.citext and o.status='pending_payment' and o.expires_at > now()
  ) >= 3 then return jsonb_build_object('status',429,'code','RATE_LIMIT_EMAIL'); end if;

  if p_ip is not null and (
    select count(*) from public.orders o
    where o.hold_ip = p_ip and o.status='pending_payment' and o.expires_at > now()
  ) >= 3 then return jsonb_build_object('status',429,'code','RATE_LIMIT_IP'); end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and is_active=true for update;
    if not found or v_product.stock < (v_item->>'quantity')::int then
      return jsonb_build_object('status',409,'code','OUT_OF_STOCK','product_id',v_item->>'product_id');
    end if;
    v_total := v_total + v_product.price_cents * (v_item->>'quantity')::int;
  end loop;

  if v_customer.id is null then
    insert into public.customers(email, full_name, phone_e164)
    values(p_email::extensions.citext, nullif(trim(p_full_name),''), p_phone_e164)
    returning * into v_customer;
  elsif v_customer.auth_user_id is null then
    update public.customers
       set full_name = coalesce(public.customers.full_name, nullif(trim(p_full_name),'')),
           phone_e164 = coalesce(public.customers.phone_e164, p_phone_e164)
     where id = v_customer.id
    returning * into v_customer;
  end if;

  insert into public.notification_prefs(customer_id, whatsapp_opt_in, marketing_email_opt_in)
  values(v_customer.id, coalesce(p_whatsapp_opt_in,false), coalesce(p_marketing_email_opt_in,false))
  on conflict(customer_id) do update
    set whatsapp_opt_in=public.notification_prefs.whatsapp_opt_in or excluded.whatsapp_opt_in,
        marketing_email_opt_in=public.notification_prefs.marketing_email_opt_in or excluded.marketing_email_opt_in;

  insert into public.orders(customer_id,status,expires_at,total_cents,application_fee_cents,terms_accepted_at,cancel_token,hold_ip)
  values(v_customer.id,'pending_payment',now()+interval '15 minutes',v_total,public.wp4_order_application_fee(v_total),now(),public.wp2_hash_token(v_cancel_token),p_ip)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    update public.products set stock = stock - (v_item->>'quantity')::int
    where id=(v_item->>'product_id')::uuid and stock >= (v_item->>'quantity')::int
    returning * into v_product;
    if not found then raise exception 'OUT_OF_STOCK' using errcode='23514'; end if;
    insert into public.order_items(order_id, product_id, quantity, unit_price_cents)
    values(v_order.id, v_product.id, (v_item->>'quantity')::int, v_product.price_cents);
  end loop;

  return jsonb_build_object('status',201,'order_id',v_order.id,'cancel_token',v_cancel_token,'total_cents',v_total);
exception when check_violation then
  return jsonb_build_object('status',409,'code','OUT_OF_STOCK');
end;
$$;
