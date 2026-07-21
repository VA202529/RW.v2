alter table public.availability_rules
add column if not exists max_bookings_per_day integer default null;

create table if not exists public.day_overrides (
  id uuid primary key default gen_random_uuid(),
  override_date date not null unique,
  is_closed boolean not null default false,
  opens_at time,
  closes_at time,
  max_bookings integer default null,
  note text,
  created_at timestamptz not null default now(),
  constraint day_overrides_time_check check (
    is_closed = true
    or opens_at is null
    or closes_at is null
    or opens_at < closes_at
  )
);

alter table public.day_overrides enable row level security;

create policy "Public can read day_overrides"
  on public.day_overrides for select
  to anon, authenticated
  using (true);

create policy "Service role full access day_overrides"
  on public.day_overrides for all
  to service_role
  using (true);

grant select on public.day_overrides to anon, authenticated;
grant all on public.day_overrides to service_role;

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
      'rules', coalesce((select jsonb_agg(to_jsonb(r) order by weekday) from public.availability_rules r),'[]'::jsonb),
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

revoke all on function public.wp3_admin_manage_availability(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.wp3_admin_manage_availability(uuid, text, jsonb) to service_role;
