-- Regression coverage for October/DST date boundaries and 5-minute canonical slots.
-- Self-contained: every fixture write is rolled back.

begin;

do $$
declare
  v_service_30 uuid := gen_random_uuid();
  v_service_45 uuid := gen_random_uuid();
  v_service_60 uuid := gen_random_uuid();
  v_service_buffer uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_period_id uuid;
  v_slots jsonb;
  v_times text[];
  v_sources text[];
  v_check jsonb;
  v_date date := date '2026-10-01';
begin
  if public.rwcutzz_slot_interval_minutes() <> 5 then
    raise exception 'customer slot interval must be 5 minutes';
  end if;

  insert into public.services (id, name, description, price_cents, duration_minutes, buffer_minutes, deposit_type, deposit_value, is_active)
  values
    (v_service_30, 'bugfix 30m', 'rollback fixture', 1000, 30, 0, 'fixed', 0, true),
    (v_service_45, 'bugfix 45m', 'rollback fixture', 1000, 45, 0, 'fixed', 0, true),
    (v_service_60, 'bugfix 60m', 'rollback fixture', 1000, 60, 0, 'fixed', 0, true),
    (v_service_buffer, 'bugfix 30m buffer', 'rollback fixture', 1000, 30, 10, 'fixed', 0, true);

  insert into public.customers (id, email, full_name)
  values (v_customer_id, 'availability-bugfix@example.invalid', 'Availability Bugfix');

  delete from public.day_overrides
  where override_date between date '2026-10-01' and date '2026-10-31';
  delete from public.blocked_slots
  where starts_at < ('2026-11-01 00:00'::timestamp at time zone 'Europe/Amsterdam')
    and ends_at > ('2026-10-01 00:00'::timestamp at time zone 'Europe/Amsterdam');

  insert into public.availability_period_rules (id, name, start_date, end_date, priority, is_active, note)
  values (gen_random_uuid(), 'October bugfix fixture', date '2026-10-01', date '2026-10-31', 10000, true, 'rollback fixture')
  returning id into v_period_id;

  insert into public.availability_period_rule_weekdays (period_rule_id, weekday)
  select v_period_id, generate_series(0, 6);

  insert into public.availability_period_rule_intervals (period_rule_id, opens_at, closes_at, sort_order)
  values (v_period_id, '10:00', '17:00', 1);

  select coalesce(array_agg(distinct source order by source), array[]::text[])
  into v_sources
  from public.rwcutzz_resolve_working_intervals(date '2026-10-01');
  if v_sources <> array['period_rule']::text[] then
    raise exception '2026-10-01 should resolve from October period rule, got %', v_sources;
  end if;

  select coalesce(array_agg(distinct source order by source), array[]::text[])
  into v_sources
  from public.rwcutzz_resolve_working_intervals(date '2026-10-31');
  if v_sources <> array['period_rule']::text[] then
    raise exception '2026-10-31 should resolve from October period rule, got %', v_sources;
  end if;

  if exists (
    select 1 from public.rwcutzz_resolve_working_intervals(date '2026-11-01')
    where source = 'period_rule'
  ) then
    raise exception 'October period rule must not extend into 2026-11-01';
  end if;

  perform public.rwcutzz_resolve_working_intervals(date '2026-10-02');
  perform public.rwcutzz_resolve_working_intervals(date '2026-10-24');
  perform public.rwcutzz_resolve_working_intervals(date '2026-10-25');
  perform public.rwcutzz_resolve_working_intervals(date '2026-10-26');

  v_slots := public.rwcutzz_available_slots(v_service_30, v_date, v_date, false, null);
  select array_agg(slot->>'local_time' order by slot->>'local_time')
  into v_times
  from jsonb_array_elements(v_slots->'slots') slot;
  if v_times[1:4] <> array['10:00','10:05','10:10','10:15'] then
    raise exception '30m slots should begin in 5-minute steps, got %', v_times[1:4];
  end if;
  if v_times[array_length(v_times, 1)] <> '16:30' then
    raise exception '30m latest slot should be 16:30, got %', v_times[array_length(v_times, 1)];
  end if;
  if '09:55' = any(v_times) or '16:35' = any(v_times) or '17:00' = any(v_times) or '17:45' = any(v_times) then
    raise exception '30m slots contain outside-boundary candidates: %', v_times;
  end if;

  v_slots := public.rwcutzz_available_slots(v_service_45, v_date, v_date, false, null);
  select array_agg(slot->>'local_time' order by slot->>'local_time') into v_times from jsonb_array_elements(v_slots->'slots') slot;
  if v_times[array_length(v_times, 1)] <> '16:15' then
    raise exception '45m latest slot should be 16:15, got %', v_times[array_length(v_times, 1)];
  end if;

  v_slots := public.rwcutzz_available_slots(v_service_60, v_date, v_date, false, null);
  select array_agg(slot->>'local_time' order by slot->>'local_time') into v_times from jsonb_array_elements(v_slots->'slots') slot;
  if v_times[array_length(v_times, 1)] <> '16:00' then
    raise exception '60m latest slot should be 16:00, got %', v_times[array_length(v_times, 1)];
  end if;

  v_slots := public.rwcutzz_available_slots(v_service_buffer, v_date, v_date, false, null);
  select array_agg(slot->>'local_time' order by slot->>'local_time') into v_times from jsonb_array_elements(v_slots->'slots') slot;
  if v_times[array_length(v_times, 1)] <> '16:20' then
    raise exception '30m + 10m buffer latest slot should be 16:20, got %', v_times[array_length(v_times, 1)];
  end if;

  insert into public.bookings (id, customer_id, service_id, starts_at, ends_at, status, source, deposit_cents, terms_accepted_at)
  values (gen_random_uuid(), v_customer_id, v_service_30,
    '2026-10-01 10:15'::timestamp at time zone 'Europe/Amsterdam',
    '2026-10-01 10:45'::timestamp at time zone 'Europe/Amsterdam',
    'confirmed', 'manual', 0, now());

  v_slots := public.rwcutzz_available_slots(v_service_30, v_date, v_date, false, null);
  select array_agg(slot->>'local_time' order by slot->>'local_time') into v_times from jsonb_array_elements(v_slots->'slots') slot;
  if v_times && array['10:00','10:05','10:10','10:15','10:20','10:25','10:30','10:35','10:40'] then
    raise exception 'existing booking overlap candidates were returned: %', v_times;
  end if;
  if not ('10:45' = any(v_times)) then
    raise exception 'boundary-touching 10:45 should remain available after 10:15-10:45 booking';
  end if;

  insert into public.blocked_slots (starts_at, ends_at, reason)
  values ('2026-10-01 13:00'::timestamp at time zone 'Europe/Amsterdam', '2026-10-01 14:00'::timestamp at time zone 'Europe/Amsterdam', 'rollback fixture');
  v_slots := public.rwcutzz_available_slots(v_service_30, v_date, v_date, false, null);
  select array_agg(slot->>'local_time' order by slot->>'local_time') into v_times from jsonb_array_elements(v_slots->'slots') slot;
  if v_times && array['12:35','12:40','12:45','12:50','12:55','13:00','13:30'] then
    raise exception 'block-overlap candidates were returned: %', v_times;
  end if;
  if not ('14:00' = any(v_times)) then
    raise exception '14:00 should be available after 13:00-14:00 block';
  end if;

  delete from public.availability_period_rule_intervals where period_rule_id = v_period_id;
  insert into public.availability_period_rule_intervals (period_rule_id, opens_at, closes_at, sort_order)
  values (v_period_id, '10:00', '13:00', 1), (v_period_id, '14:00', '17:00', 2);
  v_slots := public.rwcutzz_available_slots(v_service_30, v_date, v_date, false, null);
  select array_agg(slot->>'local_time' order by slot->>'local_time') into v_times from jsonb_array_elements(v_slots->'slots') slot;
  if v_times && array['12:35','12:40','12:45','12:50','12:55'] then
    raise exception 'multiple intervals should not bridge closed gap: %', v_times;
  end if;
  if not ('14:00' = any(v_times)) then
    raise exception 'multiple intervals should resume at 14:00';
  end if;

  v_check := public.rwcutzz_interval_is_available(v_service_30, '2026-10-01 10:05'::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean then
    raise exception '10:05 should be rejected while overlapping 10:15-10:45 booking';
  end if;

  insert into public.bookings (id, customer_id, service_id, starts_at, ends_at, status, expires_at, source, deposit_cents, terms_accepted_at)
  values (gen_random_uuid(), v_customer_id, v_service_30,
    '2026-10-01 15:00'::timestamp at time zone 'Europe/Amsterdam',
    '2026-10-01 15:30'::timestamp at time zone 'Europe/Amsterdam',
    'pending_payment', now() + interval '15 minutes', 'online', 0, now());
  v_check := public.rwcutzz_interval_is_available(v_service_30, '2026-10-01 15:05'::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean then
    raise exception 'active hold should block overlapping 15:05 candidate';
  end if;

  insert into public.bookings (id, customer_id, service_id, starts_at, ends_at, status, expires_at, source, deposit_cents, terms_accepted_at)
  values (gen_random_uuid(), v_customer_id, v_service_30,
    '2026-10-01 15:45'::timestamp at time zone 'Europe/Amsterdam',
    '2026-10-01 16:15'::timestamp at time zone 'Europe/Amsterdam',
    'pending_payment', now() - interval '1 minute', 'online', 0, now());
  v_check := public.rwcutzz_interval_is_available(v_service_30, '2026-10-01 15:45'::timestamp at time zone 'Europe/Amsterdam', null);
  if (v_check->>'available')::boolean is not true then
    raise exception 'expired hold should not block 15:45 candidate';
  end if;
end;
$$;

rollback;
