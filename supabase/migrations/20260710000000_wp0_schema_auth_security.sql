-- BarberFlow WP0: repository conventions, schema, auth, and security hardening.
-- All runtime secrets are supplied via Supabase secrets / environment variables.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email extensions.citext unique not null,
  full_name text,
  phone_e164 text,
  notes text,
  is_blocked boolean not null default false,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customers_phone_e164_check
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9]\d{6,14}$')
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  duration_minutes int not null check (duration_minutes > 0),
  buffer_minutes int not null default 0 check (buffer_minutes >= 0),
  deposit_type text not null check (deposit_type in ('fixed','percentage')),
  deposit_value int not null check (deposit_value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_rules_time_check check (opens_at < closes_at)
);

create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_slots_time_check check (starts_at < ends_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check (status in ('pending_payment','confirmed','completed','cancelled','no_show','superseded','refunded_conflict')),
  expires_at timestamptz,
  source text not null default 'online' check (source in ('online','manual')),
  deposit_cents int not null default 0 check (deposit_cents >= 0),
  reminder_channel text check (reminder_channel in ('whatsapp','email')),
  reminder_48h_sent_at timestamptz,
  reminder_3h_sent_at timestamptz,
  terms_accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bookings_time_check check (starts_at < ends_at)
);

create unique index uniq_active_slot on public.bookings (starts_at)
where status in ('pending_payment','confirmed');

create index bookings_customer_id_idx on public.bookings(customer_id);
create index bookings_status_expires_at_idx on public.bookings(status, expires_at);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  stock int not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  image_paths text[],
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null check (status in ('pending_payment','paid','ready_for_pickup','picked_up','cancelled','refunded','superseded','refunded_conflict')),
  expires_at timestamptz,
  total_cents int not null check (total_cents >= 0),
  application_fee_cents int not null default 0 check (application_fee_cents >= 0),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index orders_status_expires_at_idx on public.orders(status, expires_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_cents int not null check (amount_cents >= 0),
  application_fee_cents int not null default 0 check (application_fee_cents >= 0),
  status text not null check (status in ('pending','paid','refunded','partially_refunded','failed')),
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_exactly_one_parent_check
    check ((booking_id is not null)::int + (order_id is not null)::int = 1)
);

create index payments_booking_id_idx on public.payments(booking_id);
create index payments_order_id_idx on public.payments(order_id);

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  amount_cents int not null check (amount_cents >= 0),
  remaining_cents int not null check (remaining_cents >= 0),
  source_booking_id uuid references public.bookings(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint credits_remaining_lte_amount_check check (remaining_cents <= amount_cents)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  rating int not null check (rating between 1 and 5),
  body text,
  is_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sent_at timestamptz,
  resend_broadcast_id text,
  created_at timestamptz not null default now()
);

create table public.notification_prefs (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  whatsapp_opt_in boolean not null default false,
  marketing_email_opt_in boolean not null default false,
  reminder_3h_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email')),
  template text,
  provider_message_id text,
  status text not null check (status in ('queued','sent','delivered','read','failed')),
  status_updated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_log_provider_channel_unique unique (provider_message_id, channel)
);

create index message_log_booking_id_idx on public.message_log(booking_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','meta','resend')),
  event_id text not null,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint webhook_events_provider_event_id_unique unique (provider, event_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role') = 'admin', false)
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.customers (auth_user_id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), '')
  )
  on conflict (email) do update
    set auth_user_id = coalesce(public.customers.auth_user_id, excluded.auth_user_id),
        full_name = coalesce(public.customers.full_name, excluded.full_name)
    where public.customers.auth_user_id is null
       or public.customers.auth_user_id = excluded.auth_user_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_customer on auth.users;
create trigger on_auth_user_created_create_customer
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.prevent_customer_admin_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.notes is distinct from old.notes or new.is_blocked is distinct from old.is_blocked then
    raise exception 'Only admins can change customer notes or blocked status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger customers_prevent_admin_field_changes
before update on public.customers
for each row execute function public.prevent_customer_admin_field_changes();

create or replace function public.prevent_booking_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Booking rows are never deleted; update status instead'
    using errcode = '45000';
end;
$$;

create trigger bookings_prevent_delete
before delete on public.bookings
for each row execute function public.prevent_booking_delete();

alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.credits enable row level security;
alter table public.reviews enable row level security;
alter table public.announcements enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.message_log enable row level security;
alter table public.webhook_events enable row level security;
alter table public.order_items enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.services, public.products, public.reviews to anon;
grant execute on function public.is_admin() to anon, authenticated;

create policy "Admins have full access to customers" on public.customers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users can select own customer" on public.customers
  for select to authenticated using (auth_user_id = auth.uid());
create policy "Users can update own customer" on public.customers
  for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "Public can select active services" on public.services
  for select to anon, authenticated using (is_active = true);
create policy "Admins have full access to services" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Public can select active products" on public.products
  for select to anon, authenticated using (is_active = true);
create policy "Admins have full access to products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins have full access to availability_rules" on public.availability_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins have full access to blocked_slots" on public.blocked_slots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins have full access to announcements" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins have full access to webhook_events" on public.webhook_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins have full access to message_log" on public.message_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins have full access to bookings" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users can select own bookings" on public.bookings
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = bookings.customer_id and c.auth_user_id = auth.uid()
    )
  );

create policy "Admins have full access to orders" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users can select own orders" on public.orders
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = orders.customer_id and c.auth_user_id = auth.uid()
    )
  );

create policy "Admins have full access to order_items" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users can select own order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1
      from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = order_items.order_id and c.auth_user_id = auth.uid()
    )
  );

create policy "Admins have full access to payments" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users can select own booking payments" on public.payments
  for select to authenticated using (
    exists (
      select 1
      from public.bookings b
      join public.customers c on c.id = b.customer_id
      where b.id = payments.booking_id and c.auth_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = payments.order_id and c.auth_user_id = auth.uid()
    )
  );

create policy "Admins have full access to credits" on public.credits
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users can select own credits" on public.credits
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = credits.customer_id and c.auth_user_id = auth.uid()
    )
  );

create policy "Admins have full access to notification_prefs" on public.notification_prefs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users can select own notification prefs" on public.notification_prefs
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = notification_prefs.customer_id and c.auth_user_id = auth.uid()
    )
  );

create policy "Public can select visible reviews" on public.reviews
  for select to anon, authenticated using (is_visible = true);
create policy "Users can insert review for own completed booking" on public.reviews
  for insert to authenticated with check (
    exists (
      select 1
      from public.bookings b
      join public.customers c on c.id = b.customer_id
      where b.id = reviews.booking_id
        and b.customer_id = reviews.customer_id
        and b.status = 'completed'
        and c.auth_user_id = auth.uid()
    )
  );
create policy "Admins have full access to reviews" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Documented snippet, intentionally not auto-run:
--
-- update auth.users
-- set raw_app_meta_data =
--   coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('app_role', 'admin')
-- where id = '<USER_UUID>';
