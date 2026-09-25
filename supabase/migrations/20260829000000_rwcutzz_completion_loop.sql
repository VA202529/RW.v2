-- RW Cutzz completion hardening: availability actions, deposit normalization,
-- and idempotent booking cancellation retries.

update public.services
set service_price = price_cents,
    deposit_amount = public.wp1_deposit_cents(price_cents, deposit_type, deposit_value)
where service_price is distinct from price_cents
   or deposit_amount is distinct from public.wp1_deposit_cents(price_cents, deposit_type, deposit_value);

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

  if v_booking.status = 'cancelled' then
    return jsonb_build_object(
      'status', 200,
      'already_cancelled', true,
      'requires_refund', false,
      'before_deadline', false,
      'booking_id', v_booking.id,
      'customer_id', v_customer.id,
      'customer_email', v_customer.email,
      'payment_intent_id', null,
      'deposit_cents', v_booking.deposit_cents,
      'action', p_action
    );
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
    'already_cancelled', false,
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
  v_credit_inserted_count integer := 0;
begin
  if p_action not in ('credit','refund') then
    return jsonb_build_object('status', 400, 'code', 'INVALID_ACTION');
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND');
  end if;

  select * into v_customer from public.customers where id = v_booking.customer_id;
  if v_booking.status = 'cancelled' then
    return jsonb_build_object(
      'status', 200,
      'already_cancelled', true,
      'customer_email', v_customer.email,
      'customer_id', v_customer.id,
      'credited', false,
      'refunded', false,
      'forfeited', false,
      'deposit_cents', v_booking.deposit_cents
    );
  end if;

  if v_booking.status <> 'confirmed' then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_NOT_CANCELLABLE');
  end if;

  v_before_deadline := v_booking.starts_at > now() + interval '24 hours';

  if v_before_deadline and p_action = 'credit' then
    insert into public.credits (customer_id, amount_cents, remaining_cents, source_booking_id)
    select v_booking.customer_id, v_booking.deposit_cents, v_booking.deposit_cents, v_booking.id
    where not exists (
      select 1 from public.credits where source_booking_id = v_booking.id
    );
    get diagnostics v_credit_inserted_count = row_count;
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      cancel_token = null
  where id = v_booking.id;

  if p_refunded then
    update public.payments
    set status = 'refunded',
        refunded_at = coalesce(refunded_at, now())
    where booking_id = v_booking.id and status = 'paid';
  end if;

  return jsonb_build_object(
    'status', 200,
    'already_cancelled', false,
    'customer_email', v_customer.email,
    'customer_id', v_customer.id,
    'credited', v_credit_inserted_count > 0,
    'refunded', v_before_deadline and p_action = 'refund' and p_refunded,
    'forfeited', not v_before_deadline,
    'deposit_cents', v_booking.deposit_cents
  );
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
  v_customer public.customers%rowtype;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  if p_new_status not in ('completed','no_show','cancelled') then return jsonb_build_object('status',400,'code','INVALID_STATUS'); end if;

  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then return jsonb_build_object('status',404,'code','BOOKING_NOT_FOUND'); end if;
  select * into v_customer from public.customers where id=v_booking.customer_id;

  if p_new_status = 'completed' then
    update public.bookings set status='completed' where id=p_booking_id;
    if not exists (select 1 from public.message_log where booking_id=p_booking_id and template='review_request') then
      insert into public.message_log(customer_id, booking_id, channel, template, status, status_updated_at)
      values(v_booking.customer_id, p_booking_id, 'email', 'review_request', 'queued', now());
    end if;
  elsif p_new_status = 'no_show' then
    update public.bookings set status='no_show' where id=p_booking_id;
  elsif p_new_status = 'cancelled' and p_refund_policy = 'none' then
    update public.bookings
    set status='cancelled',
        cancelled_at=coalesce(cancelled_at, now()),
        cancel_token=null
    where id=p_booking_id;
  else
    return jsonb_build_object('status',202,'code','REFUND_REQUIRED');
  end if;

  return jsonb_build_object(
    'status',200,
    'booking_id',p_booking_id,
    'customer_id',v_customer.id,
    'customer_email',v_customer.email,
    'deposit_cents',v_booking.deposit_cents
  );
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
  if p_action not in ('credit','refund') then return jsonb_build_object('status',400,'code','INVALID_ACTION'); end if;

  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then return jsonb_build_object('status',404,'code','BOOKING_NOT_FOUND'); end if;
  select * into v_customer from public.customers where id=v_booking.customer_id;

  if v_booking.status = 'cancelled' then
    return jsonb_build_object(
      'status',200,'already_cancelled',true,'requires_refund',false,'payment_intent_id',null,
      'customer_id',v_customer.id,'customer_email',v_customer.email,'deposit_cents',v_booking.deposit_cents,'action',p_action
    );
  end if;

  if v_booking.status <> 'confirmed' then
    return jsonb_build_object('status',409,'code','BOOKING_NOT_CANCELLABLE');
  end if;

  select * into v_payment
  from public.payments
  where booking_id=p_booking_id and status='paid' and amount_cents > 0
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'status',200,'already_cancelled',false,'requires_refund',v_payment.id is not null,'payment_intent_id',v_payment.stripe_payment_intent_id,
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
  v_date_from date;
  v_date_to date;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;

  if p_action = 'list' then
    v_date_from := coalesce(nullif(p_payload->>'date_from','')::date, current_date);
    v_date_to := coalesce(nullif(p_payload->>'date_to','')::date, v_date_from + 60);

    return jsonb_build_object('status',200,
      'rules', coalesce((select jsonb_agg(to_jsonb(r) order by weekday, opens_at, closes_at) from public.availability_rules r),'[]'::jsonb),
      'blocked_slots', coalesce((select jsonb_agg(to_jsonb(b) order by starts_at) from public.blocked_slots b where ends_at >= now()),'[]'::jsonb),
      'day_overrides', coalesce((
        select jsonb_agg(to_jsonb(d) order by override_date)
        from public.day_overrides d
        where d.override_date between v_date_from and v_date_to
      ),'[]'::jsonb)
    );
  elsif p_action = 'list_day_overrides' then
    v_date_from := coalesce(nullif(p_payload->>'date_from','')::date, current_date);
    v_date_to := coalesce(nullif(p_payload->>'date_to','')::date, v_date_from + 60);

    return jsonb_build_object('status',200,'day_overrides', coalesce((
      select jsonb_agg(to_jsonb(d) order by override_date)
      from public.day_overrides d
      where d.override_date between v_date_from and v_date_to
    ),'[]'::jsonb));
  elsif p_action in ('create_rule','update_rule') then
    if (p_payload->>'opens_at')::time >= (p_payload->>'closes_at')::time then
      return jsonb_build_object('status',400,'code','INVALID_TIME_RANGE');
    end if;

    if p_action='create_rule' then
      insert into public.availability_rules(weekday, opens_at, closes_at, is_active, max_bookings_per_day)
      values(
        (p_payload->>'weekday')::int,
        (p_payload->>'opens_at')::time,
        (p_payload->>'closes_at')::time,
        coalesce((p_payload->>'is_active')::boolean,true),
        nullif(p_payload->>'max_bookings_per_day','')::int
      )
      returning id into v_id;
    else
      v_id := (p_payload->>'id')::uuid;
      update public.availability_rules
      set weekday=(p_payload->>'weekday')::int,
          opens_at=(p_payload->>'opens_at')::time,
          closes_at=(p_payload->>'closes_at')::time,
          is_active=(p_payload->>'is_active')::boolean,
          max_bookings_per_day=nullif(p_payload->>'max_bookings_per_day','')::int
      where id=v_id;
    end if;
    return jsonb_build_object('status',200,'id',v_id);
  elsif p_action = 'set_weekday_active' then
    update public.availability_rules
    set is_active = coalesce((p_payload->>'is_active')::boolean, true)
    where weekday = (p_payload->>'weekday')::int;
    return jsonb_build_object('status',200);
  elsif p_action = 'set_max_bookings' then
    update public.availability_rules
    set max_bookings_per_day = nullif(p_payload->>'max_bookings_per_day','')::int
    where weekday = (p_payload->>'weekday')::int;
    return jsonb_build_object('status',200);
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
  elsif p_action = 'set_override' then
    if coalesce((p_payload->>'is_closed')::boolean,false) = false
      and nullif(p_payload->>'opens_at','') is not null
      and nullif(p_payload->>'closes_at','') is not null
      and (p_payload->>'opens_at')::time >= (p_payload->>'closes_at')::time then
      return jsonb_build_object('status',400,'code','INVALID_TIME_RANGE');
    end if;

    insert into public.day_overrides(override_date, is_closed, opens_at, closes_at, max_bookings, note)
    values(
      (p_payload->>'date')::date,
      coalesce((p_payload->>'is_closed')::boolean,false),
      nullif(p_payload->>'opens_at','')::time,
      nullif(p_payload->>'closes_at','')::time,
      nullif(p_payload->>'max_bookings','')::int,
      nullif(p_payload->>'note','')
    )
    on conflict (override_date) do update
    set is_closed=excluded.is_closed,
        opens_at=excluded.opens_at,
        closes_at=excluded.closes_at,
        max_bookings=excluded.max_bookings,
        note=excluded.note
    returning id into v_id;
    return jsonb_build_object('status',200,'id',v_id);
  elsif p_action = 'delete_override' then
    delete from public.day_overrides where override_date=(p_payload->>'date')::date;
    return jsonb_build_object('status',200);
  end if;
  return jsonb_build_object('status',400,'code','INVALID_ACTION');
end;
$$;

revoke all on function public.wp2_prepare_cancel(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.wp2_finalize_cancel(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.wp3_admin_update_booking_status(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.wp3_admin_cancel_prepare(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.wp3_admin_manage_availability(uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.wp2_prepare_cancel(uuid, text, uuid, text) to service_role;
grant execute on function public.wp2_finalize_cancel(uuid, text, boolean) to service_role;
grant execute on function public.wp3_admin_update_booking_status(uuid, uuid, text, text) to service_role;
grant execute on function public.wp3_admin_cancel_prepare(uuid, uuid, text) to service_role;
grant execute on function public.wp3_admin_manage_availability(uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';
