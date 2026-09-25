-- Historical Setmore import support. This keeps normal booking-linked flows intact
-- while allowing audited historical records without fake payments or fake review
-- relationships.

alter table public.bookings
  drop constraint if exists bookings_source_check;

alter table public.bookings
  add constraint bookings_source_check
  check (source in ('online','manual','setmore_import'));

alter table public.reviews
  alter column booking_id drop not null,
  alter column customer_id drop not null;

alter table public.reviews
  add column if not exists source text not null default 'booking',
  add column if not exists external_review_id text,
  add column if not exists historical_author_name text,
  add column if not exists historical_period text,
  add column if not exists migration_fingerprint text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_source_check'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_source_check
      check (source in ('booking','historical_import'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_booking_or_historical_check'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_booking_or_historical_check
      check (
        (
          source = 'booking'
          and booking_id is not null
          and customer_id is not null
        )
        or (
          source = 'historical_import'
          and booking_id is null
          and customer_id is null
          and historical_author_name is not null
          and rating between 1 and 5
          and length(trim(coalesce(body, ''))) >= 10
        )
      );
  end if;
end;
$$;

create unique index if not exists reviews_migration_fingerprint_uidx
  on public.reviews(migration_fingerprint)
  where migration_fingerprint is not null;

create table if not exists public.migration_import_records (
  id uuid primary key default gen_random_uuid(),
  migration_name text not null,
  entity_type text not null check (entity_type in ('customer','booking','review','service')),
  source_file text not null,
  source_sheet text,
  external_id text,
  fingerprint text not null,
  target_table text not null,
  target_id uuid,
  action text not null check (action in ('matched','created','skipped','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  constraint migration_import_records_identity_unique unique (migration_name, entity_type, fingerprint)
);

alter table public.migration_import_records enable row level security;

create policy "Service role full access migration_import_records"
  on public.migration_import_records
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.migration_import_records to service_role;

drop index if exists uniq_active_slot;
create unique index uniq_active_slot
  on public.bookings (starts_at)
  where status in ('pending_payment','confirmed')
    and source in ('online','manual');

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
          r.source, r.historical_author_name, r.historical_period,
          coalesce(c.full_name, r.historical_author_name) as full_name,
          c.email,
          s.name as service_name,
          b.starts_at
        from public.reviews r
        left join public.customers c on c.id = r.customer_id
        left join public.bookings b on b.id = r.booking_id
        left join public.services s on s.id = b.service_id
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
    select r.id, r.rating, r.body, r.created_at,
      s.name as service_name,
      trim(coalesce(split_part(coalesce(c.full_name, r.historical_author_name), ' ', 1), 'Klant')) as first_name,
      case
        when coalesce(c.full_name, r.historical_author_name) is null
          or position(' ' in coalesce(c.full_name, r.historical_author_name)) = 0 then ''
        else upper(left(reverse(split_part(reverse(coalesce(c.full_name, r.historical_author_name)), ' ', 1)), 1)) || '.'
      end as last_initial,
      r.source,
      r.historical_period
    from public.reviews r
    left join public.customers c on c.id = r.customer_id
    left join public.bookings b on b.id = r.booking_id
    left join public.services s on s.id = b.service_id
    where r.is_visible = true and r.rating is not null
    order by r.created_at desc
    limit 10
  ) x
$$;

revoke all on function public.wp5_admin_manage_reviews(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wp5_public_reviews() from public, anon, authenticated;
grant execute on function public.wp5_admin_manage_reviews(uuid, text, jsonb) to service_role;
grant execute on function public.wp5_public_reviews() to service_role;

notify pgrst, 'reload schema';
