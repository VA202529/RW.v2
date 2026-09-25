-- Acceptance coverage for RW CUTZZ Availability Engine V2 Phase 1.
-- Self-contained: no pgTAP dependency. All fixture writes are rolled back.

begin;

do $$
declare
  v_service_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_slots jsonb;
  v_check jsonb;
  v_test_date date := date '2031-03-29';
  v_dst_date date := date '2031-03-30';
begin
  if to_regprocedure('public.rwcutzz_resolve_working_intervals(date)') is null then
    raise exception 'missing rwcutzz_resolve_working_intervals(date)';
  end if;
  if to_regprocedure('public.rwcutzz_interval_is_available(uuid,timestamp with time zone,uuid)') is null then
    raise exception 'missing rwcutzz_interval_is_available(uuid,timestamp with time zone,uuid)';
  end if;
  if to_regprocedure('public.rwcutzz_available_slots(uuid,date,date,boolean,uuid)') is null then
    raise exception 'missing rwcutzz_available_slots(uuid,date,date,boolean,uuid)';
  end if;
  if to_regprocedure('public.rwcutzz_lock_booking_domain()') is null then
    raise exception 'missing rwcutzz_lock_booking_domain()';
  end if;

  if public.rwcutzz_business_timezone() <> 'Europe/Amsterdam' then
    raise exception 'unexpected business timezone';
  end if;
  if public.rwcutzz_slot_interval_minutes() <> 5 then
    raise exception 'unexpected slot interval';
  end if;

  if not public.rwcutzz_booking_blocks_capacity('confirmed', null) then
    raise exception 'confirmed should block capacity';
  end if;
  if not public.rwcutzz_booking_blocks_capacity('pending_payment', now() + interval '5 minutes') then
    raise exception 'valid pending_payment should block capacity';
  end if;
  if public.rwcutzz_booking_blocks_capacity('pending_payment', now() - interval '1 second') then
    raise exception 'expired pending_payment should not block capacity';
  end if;
  if public.rwcutzz_booking_blocks_capacity('cancelled', null)
    or public.rwcutzz_booking_blocks_capacity('completed', null)
    or public.rwcutzz_booking_blocks_capacity('no_show', null)
    or public.rwcutzz_booking_blocks_capacity('superseded', null)
    or public.rwcutzz_booking_blocks_capacity('refunded_conflict', null) then
    raise exception 'historical/non-active statuses should not block capacity';
  end if;

  insert into public.services (
    id, name, description, price_cents, duration_minutes, buffer_minutes,
    deposit_type, deposit_value, is_active
  ) values (
    v_service_id, 'phase1 availability test service', 'rollback fixture',
    1000, 60, 15, 'fixed', 0, true
  );

  insert into public.customers (id, email, full_name)
  values (v_customer_id, 'phase1-availability-test@example.invalid', 'Phase1 Test');

  insert into public.availability_rules (weekday, opens_at, closes_at, is_active, max_bookings_per_day)
  values (6, '10:00', '12:00', true, null);

  v_slots := public.rwcutzz_available_slots(v_service_id, v_test_date, v_test_date, false, null);
  if jsonb_array_length(v_slots->'slots') = 0 then
    raise exception 'weekly availability should produce slots';
  end if;

  v_check := public.rwcutzz_interval_is_available(v_service_id, (v_test_date::text || ' 11:00')::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean then
    raise exception '60m service + 15m buffer should not fit at 11:00 before 12:00 closing';
  end if;

  insert into public.day_overrides (override_date, is_closed, opens_at, closes_at, max_bookings, note)
  values (v_test_date, true, null, null, null, 'rollback fixture')
  on conflict (override_date) do update set is_closed = excluded.is_closed, opens_at = null, closes_at = null;

  v_slots := public.rwcutzz_available_slots(v_service_id, v_test_date, v_test_date, false, null);
  if jsonb_array_length(v_slots->'slots') <> 0 then
    raise exception 'closed day override should suppress internal slots';
  end if;

  update public.day_overrides
  set is_closed = false, opens_at = '10:00', closes_at = '13:00', max_bookings = null
  where override_date = v_test_date;

  insert into public.blocked_slots (starts_at, ends_at, reason)
  values (
    (v_test_date::text || ' 10:00')::timestamp at time zone 'Europe/Amsterdam',
    (v_test_date::text || ' 11:00')::timestamp at time zone 'Europe/Amsterdam',
    'rollback fixture'
  );

  v_check := public.rwcutzz_interval_is_available(v_service_id, (v_test_date::text || ' 10:00')::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean then
    raise exception 'blocked interval should reject slot';
  end if;

  insert into public.bookings (
    id, customer_id, service_id, starts_at, ends_at, status, source, deposit_cents, terms_accepted_at
  ) values (
    v_booking_id, v_customer_id, v_service_id,
    (v_test_date::text || ' 11:00')::timestamp at time zone 'Europe/Amsterdam',
    (v_test_date::text || ' 12:00')::timestamp at time zone 'Europe/Amsterdam',
    'confirmed', 'manual', 0, now()
  );

  v_check := public.rwcutzz_interval_is_available(v_service_id, (v_test_date::text || ' 11:30')::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean then
    raise exception 'different-start overlap should reject';
  end if;

  v_check := public.rwcutzz_interval_is_available(v_service_id, (v_test_date::text || ' 12:05')::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean then
    raise exception 'buffer-induced overlap should reject';
  end if;

  update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking_id;
  v_check := public.rwcutzz_interval_is_available(v_service_id, (v_test_date::text || ' 11:00')::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean is not true then
    raise exception 'cancelled booking should release capacity';
  end if;

  insert into public.bookings (
    id, customer_id, service_id, starts_at, ends_at, status, expires_at, source, deposit_cents, terms_accepted_at
  ) values (
    gen_random_uuid(), v_customer_id, v_service_id,
    (v_test_date::text || ' 11:00')::timestamp at time zone 'Europe/Amsterdam',
    (v_test_date::text || ' 12:00')::timestamp at time zone 'Europe/Amsterdam',
    'pending_payment', now() - interval '1 minute', 'online', 0, now()
  );
  v_check := public.rwcutzz_interval_is_available(v_service_id, (v_test_date::text || ' 11:00')::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean is not true then
    raise exception 'expired hold should release capacity';
  end if;

  update public.system_settings set value = 'false'::jsonb where key = 'booking_open';
  v_slots := public.rwcutzz_available_slots(v_service_id, v_test_date, v_test_date, true, null);
  if jsonb_array_length(v_slots->'slots') <> 0 then
    raise exception 'booking_open=false should return no public slots';
  end if;
  v_slots := public.rwcutzz_available_slots(v_service_id, v_test_date, v_test_date, false, null);
  if jsonb_array_length(v_slots->'slots') = 0 then
    raise exception 'booking_open=false should not erase internal slots';
  end if;

  perform public.rwcutzz_resolve_working_intervals(v_dst_date);
  perform public.rwcutzz_lock_booking_domain();
end;
$$;

rollback;
