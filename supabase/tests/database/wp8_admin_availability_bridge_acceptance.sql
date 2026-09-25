-- RW CUTZZ Phase 2B admin availability bridge acceptance.
-- Self-contained, no pgTAP, all fixture writes rolled back.

begin;

do $$
declare
  v_service_id uuid := gen_random_uuid();
  v_date date := date '2033-10-04'; -- Tuesday
  v_period_date date := date '2033-10-06'; -- Thursday
  v_override_date date := date '2033-10-11'; -- Tuesday
  v_rule_id uuid;
  v_slots jsonb;
  v_intervals int;
begin
  if to_regclass('public.day_override_intervals') is null then
    raise exception 'missing day_override_intervals';
  end if;
  if to_regclass('public.availability_period_rules') is null then
    raise exception 'missing availability_period_rules';
  end if;

  insert into public.services(id, name, description, price_cents, duration_minutes, buffer_minutes, deposit_type, deposit_value, is_active)
  values(v_service_id, 'phase2b admin bridge service', 'rollback fixture', 1000, 30, 0, 'fixed', 0, true);

  insert into public.availability_rules(weekday, opens_at, closes_at, is_active, max_bookings_per_day)
  values (2, '09:00', '11:00', true, null);

  insert into public.day_overrides(override_date, is_closed, opens_at, closes_at, max_bookings, note)
  values (v_date, false, null, null, null, 'phase2b rollback fixture')
  returning id into v_rule_id;
  insert into public.day_override_intervals(day_override_id, opens_at, closes_at, sort_order)
  values (v_rule_id, '10:00', '13:00', 0), (v_rule_id, '14:00', '20:00', 1);

  select count(*) into v_intervals from public.rwcutzz_resolve_working_intervals(v_date);
  if v_intervals <> 2 then
    raise exception 'date override should resolve two intervals, got %', v_intervals;
  end if;

  v_slots := public.rwcutzz_available_slots(v_service_id, v_date, v_date, false, null);
  if exists (
    select 1 from jsonb_array_elements(v_slots->'slots') s
    where s->>'local_time' = '13:30'
  ) then
    raise exception 'gap between date override intervals should be unavailable';
  end if;

  insert into public.availability_period_rules(name, start_date, end_date, priority, is_active, note)
  values ('phase2b period', date '2033-10-01', date '2033-12-31', 10, true, 'rollback fixture')
  returning id into v_rule_id;
  insert into public.availability_period_rule_weekdays(period_rule_id, weekday)
  values (v_rule_id, 2), (v_rule_id, 4);
  insert into public.availability_period_rule_intervals(period_rule_id, opens_at, closes_at, sort_order)
  values (v_rule_id, '12:00', '20:00', 0);

  if not exists (select 1 from public.rwcutzz_resolve_working_intervals(v_period_date) where source='period_rule' and opens_at='12:00') then
    raise exception 'period rule should override weekly on matching weekday';
  end if;

  insert into public.day_overrides(override_date, is_closed, opens_at, closes_at, max_bookings, note)
  values (v_override_date, false, '08:00', '09:00', null, 'phase2b rollback fixture');

  if not exists (select 1 from public.rwcutzz_resolve_working_intervals(v_override_date) where source='day_override' and opens_at='08:00') then
    raise exception 'date override should override period rule';
  end if;

  update public.availability_period_rules set is_active=false where id=v_rule_id;
  if exists (select 1 from public.rwcutzz_resolve_working_intervals(v_period_date) where source='period_rule') then
    raise exception 'disabled period rule should be ignored';
  end if;

  perform public.wp3_admin_manage_availability(
    '00000000-0000-0000-0000-000000000000'::uuid,
    'get_slots',
    jsonb_build_object('service_id', v_service_id, 'date', v_date)
  );
exception
  when others then
    if sqlerrm not like '%FORBIDDEN%' then
      raise;
    end if;
end;
$$;

rollback;
