-- RW CUTZZ Phase 2B: secure admin-facing availability contracts.
-- Extends Phase 1 canonical resolver; does not duplicate slot/capacity logic.

create table if not exists public.day_override_intervals (
  id uuid primary key default gen_random_uuid(),
  day_override_id uuid not null references public.day_overrides(id) on delete cascade,
  opens_at time not null,
  closes_at time not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint day_override_intervals_time_check check (opens_at < closes_at)
);

create index if not exists day_override_intervals_override_order_idx
  on public.day_override_intervals(day_override_id, sort_order, opens_at);

alter table public.day_override_intervals enable row level security;
drop policy if exists "Service role full access day_override_intervals" on public.day_override_intervals;
create policy "Service role full access day_override_intervals"
  on public.day_override_intervals for all to service_role using (true) with check (true);
grant select, insert, update, delete on public.day_override_intervals to service_role;

create table if not exists public.availability_period_rules (
  id uuid primary key default gen_random_uuid(),
  name text,
  start_date date not null,
  end_date date not null,
  priority int not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_period_rules_date_check check (start_date <= end_date)
);

create table if not exists public.availability_period_rule_weekdays (
  period_rule_id uuid not null references public.availability_period_rules(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  primary key (period_rule_id, weekday)
);

create table if not exists public.availability_period_rule_intervals (
  id uuid primary key default gen_random_uuid(),
  period_rule_id uuid not null references public.availability_period_rules(id) on delete cascade,
  opens_at time not null,
  closes_at time not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint availability_period_rule_intervals_time_check check (opens_at < closes_at)
);

create index if not exists availability_period_rules_lookup_idx
  on public.availability_period_rules(is_active, start_date, end_date, priority desc, created_at desc);
create index if not exists availability_period_rule_intervals_order_idx
  on public.availability_period_rule_intervals(period_rule_id, sort_order, opens_at);

alter table public.availability_period_rules enable row level security;
alter table public.availability_period_rule_weekdays enable row level security;
alter table public.availability_period_rule_intervals enable row level security;

drop policy if exists "Service role full access availability_period_rules" on public.availability_period_rules;
create policy "Service role full access availability_period_rules"
  on public.availability_period_rules for all to service_role using (true) with check (true);
drop policy if exists "Service role full access availability_period_rule_weekdays" on public.availability_period_rule_weekdays;
create policy "Service role full access availability_period_rule_weekdays"
  on public.availability_period_rule_weekdays for all to service_role using (true) with check (true);
drop policy if exists "Service role full access availability_period_rule_intervals" on public.availability_period_rule_intervals;
create policy "Service role full access availability_period_rule_intervals"
  on public.availability_period_rule_intervals for all to service_role using (true) with check (true);

grant select, insert, update, delete on public.availability_period_rules to service_role;
grant select, insert, update, delete on public.availability_period_rule_weekdays to service_role;
grant select, insert, update, delete on public.availability_period_rule_intervals to service_role;

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
  v_period_rule public.availability_period_rules%rowtype;
  v_weekday int;
  v_has_override_intervals boolean;
begin
  select * into v_override
  from public.day_overrides
  where override_date = p_date;

  if found then
    if v_override.is_closed then
      return;
    end if;

    select exists (
      select 1 from public.day_override_intervals doi
      where doi.day_override_id = v_override.id
    ) into v_has_override_intervals;

    if v_has_override_intervals then
      return query
      select
        (p_date::text || ' ' || doi.opens_at::text)::timestamp at time zone v_tz,
        (p_date::text || ' ' || doi.closes_at::text)::timestamp at time zone v_tz,
        doi.opens_at,
        doi.closes_at,
        v_override.max_bookings,
        'day_override'::text
      from public.day_override_intervals doi
      where doi.day_override_id = v_override.id
      order by doi.sort_order, doi.opens_at, doi.closes_at;
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

  select pr.* into v_period_rule
  from public.availability_period_rules pr
  where pr.is_active = true
    and p_date between pr.start_date and pr.end_date
    and exists (
      select 1
      from public.availability_period_rule_weekdays w
      where w.period_rule_id = pr.id and w.weekday = v_weekday
    )
    and exists (
      select 1
      from public.availability_period_rule_intervals i
      where i.period_rule_id = pr.id
    )
  order by pr.priority desc, pr.created_at desc, pr.id desc
  limit 1;

  if found then
    return query
    select
      (p_date::text || ' ' || i.opens_at::text)::timestamp at time zone v_tz,
      (p_date::text || ' ' || i.closes_at::text)::timestamp at time zone v_tz,
      i.opens_at,
      i.closes_at,
      null::int,
      'period_rule'::text
    from public.availability_period_rule_intervals i
    where i.period_rule_id = v_period_rule.id
    order by i.sort_order, i.opens_at, i.closes_at;
    return;
  end if;

  return query
  select
    (p_date::text || ' ' || r.opens_at::text)::timestamp at time zone v_tz,
    (p_date::text || ' ' || r.closes_at::text)::timestamp at time zone v_tz,
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
  v_intervals jsonb;
  v_weekdays jsonb;
  v_override_id uuid;
  v_booking_open boolean;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;

  if p_action = 'get_booking_open' then
    return jsonb_build_object('status', 200, 'booking_open', public.get_booking_open());
  elsif p_action = 'set_booking_open' then
    if jsonb_typeof(p_payload->'booking_open') <> 'boolean' then
      return jsonb_build_object('status',400,'code','INVALID_BOOKING_OPEN');
    end if;
    v_booking_open := (p_payload->>'booking_open')::boolean;
    insert into public.system_settings(key, value, updated_by, updated_at)
    values ('booking_open', to_jsonb(v_booking_open), p_auth_user_id, now())
    on conflict (key) do update
    set value=excluded.value, updated_by=excluded.updated_by, updated_at=excluded.updated_at;
    return jsonb_build_object('status',200,'booking_open',v_booking_open);
  elsif p_action = 'get_slots' then
    return public.rwcutzz_available_slots(
      (p_payload->>'service_id')::uuid,
      coalesce(nullif(p_payload->>'from','')::date, nullif(p_payload->>'date','')::date),
      coalesce(nullif(p_payload->>'to','')::date, nullif(p_payload->>'date','')::date),
      false,
      null
    );
  elsif p_action = 'list' then
    v_date_from := coalesce(nullif(p_payload->>'date_from','')::date, current_date);
    v_date_to := coalesce(nullif(p_payload->>'date_to','')::date, v_date_from + 60);

    return jsonb_build_object('status',200,
      'booking_open', public.get_booking_open(),
      'rules', coalesce((select jsonb_agg(to_jsonb(r) order by weekday, opens_at, closes_at) from public.availability_rules r),'[]'::jsonb),
      'blocked_slots', coalesce((select jsonb_agg(to_jsonb(b) order by starts_at) from public.blocked_slots b where ends_at >= now()),'[]'::jsonb),
      'day_overrides', coalesce((
        select jsonb_agg(to_jsonb(d) || jsonb_build_object(
          'intervals', coalesce((
            select jsonb_agg(to_jsonb(i) order by i.sort_order, i.opens_at)
            from public.day_override_intervals i
            where i.day_override_id = d.id
          ), '[]'::jsonb)
        ) order by d.override_date)
        from public.day_overrides d
        where d.override_date between v_date_from and v_date_to
      ),'[]'::jsonb),
      'period_rules', coalesce((
        select jsonb_agg(to_jsonb(pr) || jsonb_build_object(
          'weekdays', coalesce((select jsonb_agg(w.weekday order by w.weekday) from public.availability_period_rule_weekdays w where w.period_rule_id=pr.id), '[]'::jsonb),
          'intervals', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order, i.opens_at) from public.availability_period_rule_intervals i where i.period_rule_id=pr.id), '[]'::jsonb),
          'date_override_count', (select count(*) from public.day_overrides d where d.override_date between pr.start_date and pr.end_date)
        ) order by pr.priority desc, pr.start_date, pr.created_at desc)
        from public.availability_period_rules pr
      ), '[]'::jsonb)
    );
  elsif p_action = 'list_day_overrides' then
    v_date_from := coalesce(nullif(p_payload->>'date_from','')::date, current_date);
    v_date_to := coalesce(nullif(p_payload->>'date_to','')::date, v_date_from + 60);

    return jsonb_build_object('status',200,'day_overrides', coalesce((
      select jsonb_agg(to_jsonb(d) || jsonb_build_object(
        'intervals', coalesce((
          select jsonb_agg(to_jsonb(i) order by i.sort_order, i.opens_at)
          from public.day_override_intervals i
          where i.day_override_id = d.id
        ), '[]'::jsonb)
      ) order by override_date)
      from public.day_overrides d
      where d.override_date between v_date_from and v_date_to
    ),'[]'::jsonb));
  elsif p_action in ('create_rule','update_rule') then
    if (p_payload->>'opens_at')::time >= (p_payload->>'closes_at')::time then
      return jsonb_build_object('status',400,'code','INVALID_TIME_RANGE');
    end if;
    if p_action='create_rule' then
      insert into public.availability_rules(weekday, opens_at, closes_at, is_active, max_bookings_per_day)
      values((p_payload->>'weekday')::int,(p_payload->>'opens_at')::time,(p_payload->>'closes_at')::time,coalesce((p_payload->>'is_active')::boolean,true),nullif(p_payload->>'max_bookings_per_day','')::int)
      returning id into v_id;
    else
      v_id := (p_payload->>'id')::uuid;
      update public.availability_rules
      set weekday=(p_payload->>'weekday')::int, opens_at=(p_payload->>'opens_at')::time, closes_at=(p_payload->>'closes_at')::time, is_active=(p_payload->>'is_active')::boolean, max_bookings_per_day=nullif(p_payload->>'max_bookings_per_day','')::int
      where id=v_id;
    end if;
    return jsonb_build_object('status',200,'id',v_id);
  elsif p_action = 'set_weekday_active' then
    update public.availability_rules set is_active = coalesce((p_payload->>'is_active')::boolean, true) where weekday = (p_payload->>'weekday')::int;
    return jsonb_build_object('status',200);
  elsif p_action = 'set_max_bookings' then
    update public.availability_rules set max_bookings_per_day = nullif(p_payload->>'max_bookings_per_day','')::int where weekday = (p_payload->>'weekday')::int;
    return jsonb_build_object('status',200);
  elsif p_action = 'delete_rule' then
    delete from public.availability_rules where id=(p_payload->>'id')::uuid;
    return jsonb_build_object('status',200);
  elsif p_action = 'create_blocked_slot' then
    select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'starts_at', b.starts_at, 'customer_name', c.full_name, 'service_name', s.name)), '[]'::jsonb)
    into v_conflicts
    from public.bookings b join public.customers c on c.id=b.customer_id join public.services s on s.id=b.service_id
    where public.rwcutzz_booking_blocks_capacity(b.status, b.expires_at)
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
    v_intervals := coalesce(p_payload->'intervals', '[]'::jsonb);
    if jsonb_array_length(v_intervals) = 0
      and coalesce((p_payload->>'is_closed')::boolean,false) = false
      and nullif(p_payload->>'opens_at','') is not null
      and nullif(p_payload->>'closes_at','') is not null
      and (p_payload->>'opens_at')::time >= (p_payload->>'closes_at')::time then
      return jsonb_build_object('status',400,'code','INVALID_TIME_RANGE');
    end if;

    if exists (
      select 1 from jsonb_array_elements(v_intervals) item
      where (item->>'opens_at')::time >= (item->>'closes_at')::time
    ) then
      return jsonb_build_object('status',400,'code','INVALID_TIME_RANGE');
    end if;

    insert into public.day_overrides(override_date, is_closed, opens_at, closes_at, max_bookings, note)
    values((p_payload->>'date')::date, coalesce((p_payload->>'is_closed')::boolean,false), nullif(p_payload->>'opens_at','')::time, nullif(p_payload->>'closes_at','')::time, nullif(p_payload->>'max_bookings','')::int, nullif(p_payload->>'note',''))
    on conflict (override_date) do update
    set is_closed=excluded.is_closed, opens_at=excluded.opens_at, closes_at=excluded.closes_at, max_bookings=excluded.max_bookings, note=excluded.note
    returning id into v_override_id;

    if p_payload ? 'intervals' then
      delete from public.day_override_intervals where day_override_id = v_override_id;
      insert into public.day_override_intervals(day_override_id, opens_at, closes_at, sort_order)
      select v_override_id, (item->>'opens_at')::time, (item->>'closes_at')::time, ord::int - 1
      from jsonb_array_elements(v_intervals) with ordinality as t(item, ord);
    end if;

    return jsonb_build_object('status',200,'id',v_override_id);
  elsif p_action = 'delete_override' then
    delete from public.day_overrides where override_date=(p_payload->>'date')::date;
    return jsonb_build_object('status',200);
  elsif p_action = 'list_period_rules' then
    return jsonb_build_object('status',200,'period_rules', coalesce((
      select jsonb_agg(to_jsonb(pr) || jsonb_build_object(
        'weekdays', coalesce((select jsonb_agg(w.weekday order by w.weekday) from public.availability_period_rule_weekdays w where w.period_rule_id=pr.id), '[]'::jsonb),
        'intervals', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order, i.opens_at) from public.availability_period_rule_intervals i where i.period_rule_id=pr.id), '[]'::jsonb),
        'date_override_count', (select count(*) from public.day_overrides d where d.override_date between pr.start_date and pr.end_date)
      ) order by pr.priority desc, pr.start_date, pr.created_at desc)
      from public.availability_period_rules pr
    ), '[]'::jsonb));
  elsif p_action in ('create_period_rule','update_period_rule','upsert_period_rule') then
    v_intervals := coalesce(p_payload->'intervals', '[]'::jsonb);
    v_weekdays := coalesce(p_payload->'weekdays', '[]'::jsonb);
    if jsonb_array_length(v_intervals) = 0 or jsonb_array_length(v_weekdays) = 0 then
      return jsonb_build_object('status',400,'code','MISSING_PERIOD_RULE_PARTS');
    end if;
    if (p_payload->>'start_date')::date > (p_payload->>'end_date')::date then
      return jsonb_build_object('status',400,'code','INVALID_DATE_RANGE');
    end if;
    if exists (select 1 from jsonb_array_elements(v_intervals) item where (item->>'opens_at')::time >= (item->>'closes_at')::time) then
      return jsonb_build_object('status',400,'code','INVALID_TIME_RANGE');
    end if;
    if exists (select 1 from jsonb_array_elements(v_weekdays) item where (item #>> '{}')::int not between 0 and 6) then
      return jsonb_build_object('status',400,'code','INVALID_WEEKDAY');
    end if;

    v_id := nullif(p_payload->>'id','')::uuid;
    if v_id is null then
      insert into public.availability_period_rules(name, start_date, end_date, priority, is_active, note)
      values(nullif(p_payload->>'name',''), (p_payload->>'start_date')::date, (p_payload->>'end_date')::date, coalesce(nullif(p_payload->>'priority','')::int, 0), coalesce((p_payload->>'is_active')::boolean, true), nullif(p_payload->>'note',''))
      returning id into v_id;
    else
      update public.availability_period_rules
      set name=nullif(p_payload->>'name',''), start_date=(p_payload->>'start_date')::date, end_date=(p_payload->>'end_date')::date, priority=coalesce(nullif(p_payload->>'priority','')::int, 0), is_active=coalesce((p_payload->>'is_active')::boolean, true), note=nullif(p_payload->>'note',''), updated_at=now()
      where id=v_id;
    end if;

    delete from public.availability_period_rule_weekdays where period_rule_id=v_id;
    insert into public.availability_period_rule_weekdays(period_rule_id, weekday)
    select distinct v_id, (item #>> '{}')::int from jsonb_array_elements(v_weekdays) item;

    delete from public.availability_period_rule_intervals where period_rule_id=v_id;
    insert into public.availability_period_rule_intervals(period_rule_id, opens_at, closes_at, sort_order)
    select v_id, (item->>'opens_at')::time, (item->>'closes_at')::time, ord::int - 1
    from jsonb_array_elements(v_intervals) with ordinality as t(item, ord);

    return jsonb_build_object('status',200,'id',v_id,'date_override_count', (
      select count(*) from public.day_overrides d
      where d.override_date between (p_payload->>'start_date')::date and (p_payload->>'end_date')::date
    ));
  elsif p_action = 'set_period_rule_enabled' then
    update public.availability_period_rules set is_active=(p_payload->>'is_active')::boolean, updated_at=now() where id=(p_payload->>'id')::uuid;
    return jsonb_build_object('status',200,'id',(p_payload->>'id')::uuid);
  elsif p_action = 'delete_period_rule' then
    delete from public.availability_period_rules where id=(p_payload->>'id')::uuid;
    return jsonb_build_object('status',200);
  end if;
  return jsonb_build_object('status',400,'code','INVALID_ACTION');
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

  v_allowed := (p_auth_user_id is not null and (
      v_customer.auth_user_id = p_auth_user_id
      or public.wp3_is_admin_user(p_auth_user_id)
    ))
    or (p_cancel_token is not null and v_booking.cancel_token = public.wp2_hash_token(p_cancel_token));
  if not v_allowed then
    return jsonb_build_object('status', 403, 'code', 'FORBIDDEN');
  end if;

  if v_booking.status <> 'confirmed' then
    return jsonb_build_object('status', 409, 'code', 'BOOKING_NOT_RESCHEDULABLE');
  end if;
  if not public.wp3_is_admin_user(p_auth_user_id) and v_booking.starts_at <= now() + interval '24 hours' then
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

revoke all on function public.rwcutzz_resolve_working_intervals(date) from public, anon, authenticated;
grant execute on function public.rwcutzz_resolve_working_intervals(date) to service_role;
revoke all on function public.wp3_admin_manage_availability(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.wp3_admin_manage_availability(uuid, text, jsonb) to service_role;
revoke all on function public.wp2_reschedule_booking(uuid, timestamptz, uuid, text) from public, anon, authenticated;
grant execute on function public.wp2_reschedule_booking(uuid, timestamptz, uuid, text) to service_role;

notify pgrst, 'reload schema';
