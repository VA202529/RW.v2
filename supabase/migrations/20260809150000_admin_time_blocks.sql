create or replace function public.wp3_admin_add_time_block(
  p_auth_user_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_conflicts jsonb;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then
    return jsonb_build_object('status', 403, 'code', 'FORBIDDEN');
  end if;

  if p_date is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    return jsonb_build_object('status', 400, 'code', 'INVALID_TIME_RANGE');
  end if;

  v_starts_at := (p_date + p_start_time) at time zone 'Europe/Amsterdam';
  v_ends_at := (p_date + p_end_time) at time zone 'Europe/Amsterdam';

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', b.id,
      'starts_at', b.starts_at,
      'customer_name', c.full_name,
      'service_name', s.name
    )),
    '[]'::jsonb
  )
  into v_conflicts
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  join public.services s on s.id = b.service_id
  where b.status in ('pending_payment', 'confirmed')
    and b.starts_at < v_ends_at
    and b.ends_at > v_starts_at;

  insert into public.blocked_slots(starts_at, ends_at, reason)
  values(v_starts_at, v_ends_at, nullif(trim(p_note), ''))
  returning id into v_id;

  return jsonb_build_object('status', 201, 'id', v_id, 'conflicts', v_conflicts);
end;
$$;

revoke all on function public.wp3_admin_add_time_block(uuid, date, time, time, text) from public, anon, authenticated;
grant execute on function public.wp3_admin_add_time_block(uuid, date, time, time, text) to service_role;

notify pgrst, 'reload schema';
