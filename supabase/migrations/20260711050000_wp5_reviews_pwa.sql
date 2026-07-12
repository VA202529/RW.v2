-- BarberFlow WP5: review tokens, moderation, and public review data.

alter table public.reviews
  add column if not exists review_token text unique;

alter table public.reviews
  alter column rating drop not null;

create or replace function public.wp5_prepare_review_request(p_booking_id uuid, p_raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer public.customers%rowtype;
  v_service public.services%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.status <> 'completed' then
    return jsonb_build_object('status', 422, 'code', 'BOOKING_NOT_COMPLETED');
  end if;

  select * into v_customer from public.customers where id = v_booking.customer_id;
  select * into v_service from public.services where id = v_booking.service_id;

  insert into public.reviews(booking_id, customer_id, is_visible, review_token)
  values(v_booking.id, v_booking.customer_id, false, public.wp2_hash_token(p_raw_token))
  on conflict(booking_id) do nothing;

  if not found then
    return jsonb_build_object('status', 409, 'code', 'REVIEW_ALREADY_EXISTS');
  end if;

  return jsonb_build_object(
    'status', 200,
    'booking_id', v_booking.id,
    'customer_id', v_customer.id,
    'to', v_customer.email,
    'service_name', v_service.name,
    'starts_at', v_booking.starts_at,
    'review_token', p_raw_token
  );
end;
$$;

create or replace function public.wp5_submit_review(
  p_auth_user_id uuid,
  p_booking_id uuid,
  p_raw_token text,
  p_rating int,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer public.customers%rowtype;
  v_review public.reviews%rowtype;
  v_body text := trim(coalesce(p_body, ''));
  v_allowed boolean := false;
begin
  if p_rating < 1 or p_rating > 5 then return jsonb_build_object('status', 422, 'code', 'INVALID_RATING'); end if;
  if length(v_body) < 10 then return jsonb_build_object('status', 422, 'code', 'BODY_TOO_SHORT'); end if;
  if length(v_body) > 1000 then return jsonb_build_object('status', 422, 'code', 'BODY_TOO_LONG'); end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then return jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'completed' then return jsonb_build_object('status', 422, 'code', 'BOOKING_NOT_COMPLETED'); end if;
  select * into v_customer from public.customers where id = v_booking.customer_id;
  select * into v_review from public.reviews where booking_id = p_booking_id for update;

  v_allowed := (p_auth_user_id is not null and v_customer.auth_user_id = p_auth_user_id)
    or (v_review.id is not null and p_raw_token is not null and v_review.review_token = public.wp2_hash_token(p_raw_token));
  if not v_allowed then return jsonb_build_object('status', 403, 'code', 'FORBIDDEN'); end if;

  if v_review.id is not null then
    if v_review.rating is not null or v_review.body is not null then
      return jsonb_build_object('status', 409, 'code', 'ALREADY_REVIEWED');
    end if;
    update public.reviews
    set rating = p_rating, body = v_body, created_at = now(), is_visible = false
    where id = v_review.id;
  else
    insert into public.reviews(booking_id, customer_id, rating, body, is_visible)
    values(p_booking_id, v_booking.customer_id, p_rating, v_body, false);
  end if;

  return jsonb_build_object('status', 200);
end;
$$;

create or replace function public.wp5_admin_manage_reviews(p_auth_user_id uuid, p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews%rowtype;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status', 403, 'code', 'FORBIDDEN'); end if;
  if p_action = 'list' then
    return jsonb_build_object('status', 200, 'reviews', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select r.id, r.booking_id, r.customer_id, r.rating, r.body, r.is_visible, r.created_at,
          c.full_name, c.email, s.name as service_name, b.starts_at
        from public.reviews r
        join public.customers c on c.id = r.customer_id
        join public.bookings b on b.id = r.booking_id
        join public.services s on s.id = b.service_id
        where r.rating is not null
          and ((not (p_payload ? 'is_visible')) or r.is_visible = (p_payload->>'is_visible')::boolean)
        limit coalesce((p_payload->>'limit')::int, 100)
        offset coalesce((p_payload->>'offset')::int, 0)
      ) x
    ), '[]'::jsonb));
  elsif p_action = 'toggle' then
    update public.reviews
    set is_visible = (p_payload->>'is_visible')::boolean
    where id = (p_payload->>'id')::uuid
    returning * into v_review;
    return jsonb_build_object('status', 200, 'review', to_jsonb(v_review));
  end if;
  return jsonb_build_object('status', 400, 'code', 'INVALID_ACTION');
end;
$$;

create or replace function public.wp5_public_reviews()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  from (
    select r.id, r.rating, r.body, r.created_at, s.name as service_name,
      trim(coalesce(split_part(c.full_name, ' ', 1), 'Klant')) as first_name,
      case
        when c.full_name is null or position(' ' in c.full_name) = 0 then ''
        else upper(left(reverse(split_part(reverse(c.full_name), ' ', 1)), 1)) || '.'
      end as last_initial
    from public.reviews r
    join public.customers c on c.id = r.customer_id
    join public.bookings b on b.id = r.booking_id
    join public.services s on s.id = b.service_id
    where r.is_visible = true and r.rating is not null
    order by r.created_at desc
    limit 10
  ) x
$$;

create or replace function public.wp5_get_booking_summary(p_booking_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object('status', 200, 'booking_id', b.id, 'service_name', s.name, 'starts_at', b.starts_at)
    from public.bookings b
    join public.services s on s.id = b.service_id
    where b.id = p_booking_id
  ), jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND'))
$$;

create or replace function public.wp5_get_account_reviews(p_auth_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  from (
    select r.id, r.booking_id, r.rating, r.body, r.is_visible, r.created_at, s.name as service_name, b.starts_at
    from public.reviews r
    join public.bookings b on b.id = r.booking_id
    join public.services s on s.id = b.service_id
    join public.customers c on c.id = r.customer_id
    where c.auth_user_id = p_auth_user_id and r.rating is not null
  ) x
$$;

revoke all on function public.wp5_prepare_review_request(uuid, text) from public, anon, authenticated;
revoke all on function public.wp5_submit_review(uuid, uuid, text, int, text) from public, anon, authenticated;
revoke all on function public.wp5_admin_manage_reviews(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wp5_public_reviews() from public, anon, authenticated;
revoke all on function public.wp5_get_booking_summary(uuid) from public, anon, authenticated;
revoke all on function public.wp5_get_account_reviews(uuid) from public, anon, authenticated;

grant execute on function public.wp5_prepare_review_request(uuid, text) to service_role;
grant execute on function public.wp5_submit_review(uuid, uuid, text, int, text) to service_role;
grant execute on function public.wp5_admin_manage_reviews(uuid, text, jsonb) to service_role;
grant execute on function public.wp5_public_reviews() to service_role;
grant execute on function public.wp5_get_booking_summary(uuid) to service_role;
grant execute on function public.wp5_get_account_reviews(uuid) to service_role;
