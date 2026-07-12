-- BarberFlow WP3: admin dashboard, service/availability/client management, broadcast, and platform invoices.

create table if not exists public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  total_fee_cents int not null check (total_fee_cents >= 0),
  stripe_invoice_id text,
  created_at timestamptz not null default now(),
  constraint platform_invoices_period_unique unique (period_start, period_end)
);

alter table public.platform_invoices enable row level security;

create policy "Admins have full access to platform_invoices"
  on public.platform_invoices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.wp3_is_admin_user(p_auth_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users
    where id = p_auth_user_id
      and raw_app_meta_data ->> 'app_role' = 'admin'
  )
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

create or replace function public.wp3_admin_dashboard_data(p_auth_user_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then
    return jsonb_build_object('status', 403, 'code', 'FORBIDDEN');
  end if;
  return jsonb_build_object(
    'status', 200,
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'status', b.status,
        'source', b.source, 'deposit_cents', b.deposit_cents,
        'customer_name', c.full_name, 'customer_email', c.email, 'phone_e164', c.phone_e164,
        'service_id', s.id, 'service_name', s.name, 'price_cents', s.price_cents
      ) order by b.starts_at)
      from public.bookings b join public.customers c on c.id=b.customer_id join public.services s on s.id=b.service_id
      where b.starts_at >= p_from and b.starts_at < p_to
    ), '[]'::jsonb),
    'blocked_slots', coalesce((
      select jsonb_agg(to_jsonb(bs) order by bs.starts_at)
      from public.blocked_slots bs
      where bs.starts_at < p_to and bs.ends_at > p_from
    ), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.services s), '[]'::jsonb)
  );
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
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  select * into v_service from public.services where id=p_service_id;
  if not found then return jsonb_build_object('status',404,'code','SERVICE_NOT_FOUND'); end if;
  insert into public.customers(email, full_name, phone_e164)
  values (p_email::extensions.citext, nullif(trim(p_full_name),''), p_phone_e164)
  on conflict(email) do update
    set full_name=coalesce(public.customers.full_name, excluded.full_name),
        phone_e164=coalesce(public.customers.phone_e164, excluded.phone_e164)
  returning * into v_customer;
  begin
    insert into public.bookings(customer_id, service_id, starts_at, ends_at, status, source, deposit_cents, terms_accepted_at)
    values(v_customer.id, v_service.id, p_starts_at, p_starts_at + make_interval(mins => v_service.duration_minutes),
           'confirmed', 'manual', 0, now())
    returning * into v_booking;
  exception when unique_violation then
    return jsonb_build_object('status',409,'code','SLOT_TAKEN','message','Tijdstip is al bezet');
  end;
  return jsonb_build_object('status',201,'booking_id',v_booking.id);
end;
$$;

create or replace function public.wp3_admin_update_booking_status(
  p_auth_user_id uuid,
  p_booking_id uuid,
  p_new_status text,
  p_refund_policy text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer_id uuid;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  if p_new_status not in ('completed','no_show','cancelled') then return jsonb_build_object('status',400,'code','INVALID_STATUS'); end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then return jsonb_build_object('status',404,'code','BOOKING_NOT_FOUND'); end if;
  v_customer_id := v_booking.customer_id;
  if p_new_status = 'completed' then
    update public.bookings set status='completed' where id=p_booking_id;
    if not exists (select 1 from public.message_log where booking_id=p_booking_id and template='review_request') then
      insert into public.message_log(customer_id, booking_id, channel, template, status, status_updated_at)
      values(v_customer_id, p_booking_id, 'email', 'review_request', 'queued', now());
    end if;
  elsif p_new_status = 'no_show' then
    update public.bookings set status='no_show' where id=p_booking_id;
  elsif p_new_status = 'cancelled' and p_refund_policy = 'none' then
    update public.bookings set status='cancelled', cancelled_at=now(), cancel_token=null where id=p_booking_id;
  else
    return jsonb_build_object('status',202,'code','REFUND_REQUIRED');
  end if;
  return jsonb_build_object('status',200,'booking_id',p_booking_id);
end;
$$;

create or replace function public.wp3_admin_cancel_prepare(p_auth_user_id uuid, p_booking_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer public.customers%rowtype;
  v_payment public.payments%rowtype;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then return jsonb_build_object('status',404,'code','BOOKING_NOT_FOUND'); end if;
  select * into v_customer from public.customers where id=v_booking.customer_id;
  select * into v_payment from public.payments where booking_id=p_booking_id and status='paid' and amount_cents > 0 order by created_at desc limit 1;
  return jsonb_build_object(
    'status',200,'requires_refund',v_payment.id is not null,'payment_intent_id',v_payment.stripe_payment_intent_id,
    'customer_id',v_customer.id,'customer_email',v_customer.email,'deposit_cents',v_booking.deposit_cents,'action',p_action
  );
end;
$$;

create or replace function public.wp3_admin_manage_availability(p_auth_user_id uuid, p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_conflicts jsonb;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  if p_action = 'list' then
    return jsonb_build_object('status',200,
      'rules', coalesce((select jsonb_agg(to_jsonb(r) order by weekday) from public.availability_rules r),'[]'::jsonb),
      'blocked_slots', coalesce((select jsonb_agg(to_jsonb(b) order by starts_at) from public.blocked_slots b where ends_at >= now()),'[]'::jsonb)
    );
  elsif p_action in ('create_rule','update_rule') then
    if p_action='create_rule' then
      insert into public.availability_rules(weekday, opens_at, closes_at, is_active)
      values((p_payload->>'weekday')::int,(p_payload->>'opens_at')::time,(p_payload->>'closes_at')::time,coalesce((p_payload->>'is_active')::boolean,true))
      returning id into v_id;
    else
      v_id := (p_payload->>'id')::uuid;
      update public.availability_rules
      set weekday=(p_payload->>'weekday')::int, opens_at=(p_payload->>'opens_at')::time, closes_at=(p_payload->>'closes_at')::time, is_active=(p_payload->>'is_active')::boolean
      where id=v_id;
    end if;
    return jsonb_build_object('status',200,'id',v_id);
  elsif p_action = 'delete_rule' then
    delete from public.availability_rules where id=(p_payload->>'id')::uuid;
    return jsonb_build_object('status',200);
  elsif p_action = 'create_blocked_slot' then
    select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'starts_at', b.starts_at, 'customer_name', c.full_name, 'service_name', s.name)), '[]'::jsonb)
    into v_conflicts
    from public.bookings b join public.customers c on c.id=b.customer_id join public.services s on s.id=b.service_id
    where b.status in ('pending_payment','confirmed')
      and b.starts_at < (p_payload->>'ends_at')::timestamptz
      and b.ends_at > (p_payload->>'starts_at')::timestamptz;
    insert into public.blocked_slots(starts_at, ends_at, reason)
    values((p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,p_payload->>'reason')
    returning id into v_id;
    return jsonb_build_object('status',201,'id',v_id,'conflicts',v_conflicts);
  elsif p_action = 'delete_blocked_slot' then
    delete from public.blocked_slots where id=(p_payload->>'id')::uuid;
    return jsonb_build_object('status',200);
  end if;
  return jsonb_build_object('status',400,'code','INVALID_ACTION');
end;
$$;

create or replace function public.wp3_admin_manage_services(p_auth_user_id uuid, p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_count int;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  if p_action='list' then
    return jsonb_build_object('status',200,'services',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.name) from (
        select s.*, (select count(*) from public.bookings b where b.service_id=s.id and b.status='confirmed' and b.starts_at >= now()) as upcoming_count
        from public.services s
      ) x
    ),'[]'::jsonb));
  elsif p_action='upsert' then
    v_id := nullif(p_payload->>'id','')::uuid;
    if v_id is null then
      insert into public.services(name, description, price_cents, duration_minutes, buffer_minutes, deposit_type, deposit_value, is_active)
      values(p_payload->>'name', p_payload->>'description', (p_payload->>'price_cents')::int, (p_payload->>'duration_minutes')::int,
             (p_payload->>'buffer_minutes')::int, p_payload->>'deposit_type', (p_payload->>'deposit_value')::int, (p_payload->>'is_active')::boolean)
      returning id into v_id;
    else
      update public.services set name=p_payload->>'name', description=p_payload->>'description', price_cents=(p_payload->>'price_cents')::int,
        duration_minutes=(p_payload->>'duration_minutes')::int, buffer_minutes=(p_payload->>'buffer_minutes')::int,
        deposit_type=p_payload->>'deposit_type', deposit_value=(p_payload->>'deposit_value')::int, is_active=(p_payload->>'is_active')::boolean
      where id=v_id;
    end if;
    select count(*) into v_count from public.bookings where service_id=v_id and status='confirmed' and starts_at >= now();
    return jsonb_build_object('status',200,'id',v_id,'upcoming_count',v_count);
  end if;
  return jsonb_build_object('status',400,'code','INVALID_ACTION');
end;
$$;

create or replace function public.wp3_admin_client_data(p_auth_user_id uuid, p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  if p_action='list' then
    return jsonb_build_object('status',200,'customers',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select c.id,c.full_name,c.email,c.phone_e164,c.notes,c.is_blocked,c.created_at,
          (select count(*) from public.bookings b where b.customer_id=c.id and b.status='completed') as visit_count,
          (select max(starts_at) from public.bookings b where b.customer_id=c.id and b.status='completed') as last_visit_at,
          coalesce((select sum(remaining_cents) from public.credits cr where cr.customer_id=c.id),0) as credit_cents
        from public.customers c
        where coalesce(p_payload->>'q','') = ''
           or c.email::text ilike '%' || (p_payload->>'q') || '%'
           or c.full_name ilike '%' || (p_payload->>'q') || '%'
        limit coalesce((p_payload->>'limit')::int, 50)
        offset coalesce((p_payload->>'offset')::int, 0)
      ) x
    ),'[]'::jsonb));
  elsif p_action='update' then
    v_id := (p_payload->>'id')::uuid;
    update public.customers
    set notes=coalesce(p_payload->>'notes', notes),
        is_blocked=coalesce((p_payload->>'is_blocked')::boolean, is_blocked)
    where id=v_id;
    return jsonb_build_object('status',200);
  elsif p_action='detail' then
    v_id := (p_payload->>'id')::uuid;
    return jsonb_build_object('status',200,
      'bookings', coalesce((select jsonb_agg(to_jsonb(b) order by b.starts_at desc) from public.bookings b where b.customer_id=v_id),'[]'::jsonb),
      'credits', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.credits c where c.customer_id=v_id),'[]'::jsonb),
      'orders', '[]'::jsonb
    );
  end if;
  return jsonb_build_object('status',400,'code','INVALID_ACTION');
end;
$$;

create or replace function public.wp3_admin_stats(p_auth_user_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int; v_completed int; v_cancelled int; v_no_show int; v_unique int; v_returning int; v_customers int; v_wa int;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  select count(*), count(*) filter(where status='completed'), count(*) filter(where status='cancelled'), count(*) filter(where status='no_show')
  into v_total, v_completed, v_cancelled, v_no_show
  from public.bookings where starts_at >= p_from and starts_at < p_to;
  select count(*), count(*) filter(where completed_count >= 2) into v_unique, v_returning
  from (
    select customer_id, count(*) as completed_count from public.bookings
    where status='completed' and starts_at >= p_from and starts_at < p_to group by customer_id
  ) x;
  select count(*), count(*) filter(where p.whatsapp_opt_in=true) into v_customers, v_wa
  from public.customers c left join public.notification_prefs p on p.customer_id=c.id;
  return jsonb_build_object(
    'status',200,
    'bookings', jsonb_build_object('total',v_total,'completed',v_completed,'cancelled',v_cancelled,'no_show',v_no_show),
    'no_show_pct', case when (v_completed+v_no_show+v_cancelled)=0 then 0 else round(v_no_show::numeric/(v_completed+v_no_show+v_cancelled)*100,2) end,
    'deposit_revenue_cents', coalesce((select sum(p.amount_cents) from public.payments p join public.bookings b on b.id=p.booking_id where p.status='paid' and b.starts_at >= p_from and b.starts_at < p_to),0),
    'platform_fee_cents', coalesce((select sum(p.application_fee_cents) from public.payments p join public.bookings b on b.id=p.booking_id where p.status='paid' and b.starts_at >= p_from and b.starts_at < p_to),0),
    'return_rate_pct', case when v_unique=0 then 0 else round(v_returning::numeric/v_unique*100,2) end,
    'reminder_opt_in_pct', case when v_customers=0 then 0 else round(v_wa::numeric/v_customers*100,2) end,
    'no_show_by_reminder_channel', coalesce((select jsonb_object_agg(coalesce(reminder_channel,'none'), cnt) from (select reminder_channel, count(*) cnt from public.bookings where status='no_show' and starts_at >= p_from and starts_at < p_to group by reminder_channel) y),'{}'::jsonb),
    'new_customers', (select count(*) from public.customers where created_at >= p_from and created_at < p_to)
  );
end;
$$;

create or replace function public.wp3_broadcast_recipients(p_auth_user_id uuid, p_title text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_announcement_id uuid;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  insert into public.announcements(title, body, sent_at) values(p_title, p_body, now()) returning id into v_announcement_id;
  return jsonb_build_object('status',200,'announcement_id',v_announcement_id,'recipients',coalesce((
    select jsonb_agg(jsonb_build_object('customer_id', c.id, 'email', c.email))
    from public.customers c join public.notification_prefs p on p.customer_id=c.id
    where p.marketing_email_opt_in = true and c.anonymized_at is null
  ),'[]'::jsonb));
end;
$$;

create or replace function public.wp3_log_broadcast(p_auth_user_id uuid, p_template text, p_results jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  insert into public.message_log(customer_id, channel, template, provider_message_id, status, status_updated_at)
  select (r->>'customer_id')::uuid, 'email', p_template, nullif(r->>'provider_message_id',''), coalesce(r->>'status','sent'), now()
  from jsonb_array_elements(p_results) r;
  return jsonb_build_object('status',200);
end;
$$;

create or replace function public.wp3_create_platform_invoice_previous_month()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', now() - interval '1 month')::date;
  v_end date := date_trunc('month', now())::date;
  v_total int;
  v_id uuid;
begin
  select coalesce(sum(application_fee_cents),0) into v_total
  from public.payments
  where status='paid' and created_at >= v_start and created_at < v_end;
  insert into public.platform_invoices(period_start, period_end, total_fee_cents)
  values(v_start, v_end, v_total)
  on conflict(period_start, period_end) do update set total_fee_cents=excluded.total_fee_cents
  returning id into v_id;
  return jsonb_build_object('status',200,'id',v_id,'period_start',v_start,'period_end',v_end,'total_fee_cents',v_total);
end;
$$;

create or replace function public.wp3_should_send_magic_link(p_customer_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.message_log
    where customer_id = p_customer_id and template = 'magic_link'
  )
$$;

select cron.schedule(
  'wp3-platform-invoice-monthly',
  '0 8 1 * *',
  $$select net.http_post(
    url := current_setting('app.settings.supabase_functions_url', true) || '/send-platform-invoice',
    headers := jsonb_build_object('content-type','application/json','x-internal-secret', current_setting('app.settings.internal_function_secret', true)),
    body := '{}'::jsonb
  );$$
);

revoke all on function public.wp3_is_admin_user(uuid) from public, anon, authenticated;
revoke all on function public.wp3_admin_dashboard_data(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.wp3_admin_manual_booking(uuid, uuid, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.wp3_admin_update_booking_status(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.wp3_admin_cancel_prepare(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.wp3_admin_manage_availability(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wp3_admin_manage_services(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wp3_admin_client_data(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wp3_admin_stats(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.wp3_broadcast_recipients(uuid, text, text) from public, anon, authenticated;
revoke all on function public.wp3_log_broadcast(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wp3_create_platform_invoice_previous_month() from public, anon, authenticated;
revoke all on function public.wp3_should_send_magic_link(uuid) from public, anon, authenticated;

grant execute on function public.wp3_is_admin_user(uuid) to service_role;
grant execute on function public.wp3_admin_dashboard_data(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.wp3_admin_manual_booking(uuid, uuid, timestamptz, text, text, text) to service_role;
grant execute on function public.wp3_admin_update_booking_status(uuid, uuid, text, text) to service_role;
grant execute on function public.wp3_admin_cancel_prepare(uuid, uuid, text) to service_role;
grant execute on function public.wp3_admin_manage_availability(uuid, text, jsonb) to service_role;
grant execute on function public.wp3_admin_manage_services(uuid, text, jsonb) to service_role;
grant execute on function public.wp3_admin_client_data(uuid, text, jsonb) to service_role;
grant execute on function public.wp3_admin_stats(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.wp3_broadcast_recipients(uuid, text, text) to service_role;
grant execute on function public.wp3_log_broadcast(uuid, text, jsonb) to service_role;
grant execute on function public.wp3_create_platform_invoice_previous_month() to service_role;
grant execute on function public.wp3_should_send_magic_link(uuid) to service_role;
