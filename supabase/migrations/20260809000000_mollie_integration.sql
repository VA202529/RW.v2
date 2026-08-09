-- Mollie booking deposits. Stripe remains available for webshop orders.

alter table public.services
  add column if not exists service_price integer,
  add column if not exists deposit_amount integer;

update public.services
set service_price = price_cents,
    deposit_amount = round(price_cents * 0.30)::integer
where service_price is null
   or deposit_amount is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_service_price_nonnegative'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_service_price_nonnegative
      check (service_price is null or service_price >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'services_deposit_amount_valid'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_deposit_amount_valid
      check (
        deposit_amount is null
        or (deposit_amount >= 0 and service_price is not null and deposit_amount <= service_price)
      );
  end if;
end;
$$;

create or replace function public.sync_service_mollie_amounts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.service_price := new.price_cents;
  new.deposit_amount := public.wp1_deposit_cents(
    new.price_cents,
    new.deposit_type,
    new.deposit_value
  );
  return new;
end;
$$;

drop trigger if exists services_sync_mollie_amounts on public.services;
create trigger services_sync_mollie_amounts
before insert or update of price_cents, deposit_type, deposit_value
on public.services
for each row execute function public.sync_service_mollie_amounts();

alter table public.payments
  add column if not exists mollie_payment_id text,
  add column if not exists payment_mode text,
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists provider_status text,
  add column if not exists platform_fee_rate numeric(5, 4) default 0.10,
  add column if not exists platform_fee_ex_vat integer,
  add column if not exists service_price_snapshot integer,
  add column if not exists deposit_amount_snapshot integer,
  add column if not exists remaining_amount_snapshot integer,
  add column if not exists paid_at timestamptz;

create unique index if not exists payments_mollie_payment_id_uidx
  on public.payments(mollie_payment_id)
  where mollie_payment_id is not null;

create index if not exists payments_mollie_mode_created_idx
  on public.payments(payment_mode, created_at desc)
  where payment_provider = 'mollie';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_payment_mode_valid'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_payment_mode_valid
      check (payment_mode is null or payment_mode in ('test', 'live'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_payment_provider_valid'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_payment_provider_valid
      check (payment_provider in ('stripe', 'mollie', 'credit'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_platform_fee_rate_valid'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_platform_fee_rate_valid
      check (platform_fee_rate is null or (platform_fee_rate >= 0 and platform_fee_rate <= 1));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_mollie_snapshots_valid'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_mollie_snapshots_valid
      check (
        payment_provider <> 'mollie'
        or (
          mollie_payment_id is null
          or (
            payment_mode in ('test', 'live')
            and platform_fee_ex_vat >= 0
            and service_price_snapshot >= 0
            and deposit_amount_snapshot > 0
            and remaining_amount_snapshot >= 0
          )
        )
      );
  end if;
end;
$$;

-- WP3 already created this table. Add Mollie invoice fields without replacing it.
create table if not exists public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  total_fee_cents integer not null default 0,
  stripe_invoice_id text,
  created_at timestamptz not null default now()
);

alter table public.platform_invoices
  add column if not exists payment_mode text not null default 'test',
  add column if not exists total_deposits_ex_vat integer not null default 0,
  add column if not exists platform_fee_ex_vat integer not null default 0,
  add column if not exists vat_amount integer not null default 0,
  add column if not exists total_inc_vat integer not null default 0,
  add column if not exists status text not null default 'open';

alter table public.platform_invoices
  drop constraint if exists platform_invoices_period_unique;

create unique index if not exists platform_invoices_period_mode_uidx
  on public.platform_invoices(period_start, period_end, payment_mode);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_invoices_payment_mode_valid'
      and conrelid = 'public.platform_invoices'::regclass
  ) then
    alter table public.platform_invoices
      add constraint platform_invoices_payment_mode_valid
      check (payment_mode in ('test', 'live'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_invoices_mollie_totals_nonnegative'
      and conrelid = 'public.platform_invoices'::regclass
  ) then
    alter table public.platform_invoices
      add constraint platform_invoices_mollie_totals_nonnegative
      check (
        total_deposits_ex_vat >= 0
        and platform_fee_ex_vat >= 0
        and vat_amount >= 0
        and total_inc_vat >= 0
      );
  end if;
end;
$$;

alter table public.platform_invoices enable row level security;

grant select, insert, update, delete on public.payments to service_role;
grant select, insert, update, delete on public.platform_invoices to service_role;

create or replace function public.wp_mollie_prepare_booking_checkout(
  p_booking_id uuid,
  p_service_id uuid,
  p_payment_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_service public.services%rowtype;
  v_existing public.payments%rowtype;
  v_prepared jsonb;
  v_payment_id uuid;
  v_amount_due integer;
  v_fee integer;
begin
  if p_payment_mode not in ('test', 'live') then
    return jsonb_build_object('status', 500, 'code', 'INVALID_MOLLIE_MODE');
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('status', 404, 'code', 'BOOKING_NOT_FOUND');
  end if;
  if v_booking.service_id <> p_service_id then
    return jsonb_build_object('status', 400, 'code', 'SERVICE_MISMATCH');
  end if;

  select * into v_service
  from public.services
  where id = p_service_id;

  if not found or not v_service.is_active then
    return jsonb_build_object('status', 404, 'code', 'SERVICE_NOT_FOUND');
  end if;
  if coalesce(v_service.deposit_amount, 0) <= 0 or v_booking.deposit_cents <= 0 then
    return jsonb_build_object('status', 400, 'code', 'INVALID_DEPOSIT');
  end if;

  select * into v_existing
  from public.payments
  where booking_id = p_booking_id
    and payment_provider = 'mollie'
    and payment_mode = p_payment_mode
    and status = 'pending'
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 200,
      'requires_mollie', true,
      'reused', true,
      'booking_id', p_booking_id,
      'payment_id', v_existing.id,
      'mollie_payment_id', v_existing.mollie_payment_id,
      'amount_due_cents', v_existing.amount_cents,
      'customer_id', v_booking.customer_id,
      'customer_email', (select email::text from public.customers where id = v_booking.customer_id),
      'service_name', v_service.name
    );
  end if;

  v_prepared := public.wp1_prepare_checkout(p_booking_id);
  if coalesce((v_prepared->>'status')::integer, 500) <> 200 then
    return v_prepared;
  end if;

  v_payment_id := (v_prepared->>'payment_id')::uuid;
  if coalesce((v_prepared->>'requires_stripe')::boolean, false) = false then
    update public.payments
    set payment_provider = 'credit',
        platform_fee_rate = 0,
        platform_fee_ex_vat = 0,
        paid_at = now(),
        provider_status = 'paid'
    where id = v_payment_id;

    return v_prepared || jsonb_build_object('requires_mollie', false);
  end if;

  v_amount_due := (v_prepared->>'amount_due_cents')::integer;
  v_fee := round(v_amount_due * 0.10)::integer;

  update public.payments
  set payment_provider = 'mollie',
      payment_mode = p_payment_mode,
      provider_status = 'open',
      platform_fee_rate = 0.10,
      platform_fee_ex_vat = v_fee,
      application_fee_cents = v_fee,
      service_price_snapshot = v_service.price_cents,
      deposit_amount_snapshot = v_booking.deposit_cents,
      remaining_amount_snapshot = greatest(v_service.price_cents - v_booking.deposit_cents, 0)
  where id = v_payment_id;

  return v_prepared || jsonb_build_object(
    'requires_mollie', true,
    'payment_mode', p_payment_mode,
    'platform_fee_ex_vat', v_fee,
    'service_price_snapshot', v_service.price_cents,
    'deposit_amount_snapshot', v_booking.deposit_cents,
    'remaining_amount_snapshot', greatest(v_service.price_cents - v_booking.deposit_cents, 0)
  );
end;
$$;

create or replace function public.wp_mollie_attach_payment(
  p_payment_id uuid,
  p_mollie_payment_id text,
  p_provider_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.payments
  set mollie_payment_id = p_mollie_payment_id,
      provider_status = p_provider_status
  where id = p_payment_id
    and payment_provider = 'mollie'
    and (mollie_payment_id is null or mollie_payment_id = p_mollie_payment_id);
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.wp_mollie_process_payment(
  p_mollie_payment_id text,
  p_provider_status text,
  p_paid_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
begin
  select * into v_payment
  from public.payments
  where mollie_payment_id = p_mollie_payment_id
    and payment_provider = 'mollie'
  for update;

  if not found then
    return jsonb_build_object('action', 'unknown_payment');
  end if;

  select * into v_booking
  from public.bookings
  where id = v_payment.booking_id
  for update;

  if p_provider_status in ('open', 'pending', 'authorized') then
    update public.payments
    set provider_status = p_provider_status
    where id = v_payment.id and status = 'pending';
    return jsonb_build_object('action', 'pending', 'booking_id', v_booking.id);
  end if;

  if p_provider_status in ('failed', 'canceled', 'expired') then
    if v_payment.status = 'paid' then
      return jsonb_build_object('action', 'already_paid', 'booking_id', v_booking.id);
    end if;
    update public.payments
    set status = 'failed', provider_status = p_provider_status
    where id = v_payment.id;
    update public.bookings
    set status = 'superseded'
    where id = v_booking.id and status = 'pending_payment';
    return jsonb_build_object('action', 'failed', 'booking_id', v_booking.id);
  end if;

  if p_provider_status <> 'paid' then
    update public.payments set provider_status = p_provider_status where id = v_payment.id;
    return jsonb_build_object('action', 'ignored', 'booking_id', v_booking.id);
  end if;

  if v_payment.status = 'paid' then
    if v_booking.status = 'confirmed' then
      return jsonb_build_object('action', 'already_confirmed', 'booking_id', v_booking.id);
    end if;
    return jsonb_build_object('action', 'refund_required', 'booking_id', v_booking.id, 'payment_id', v_payment.id);
  end if;

  update public.payments
  set status = 'paid', provider_status = 'paid', paid_at = coalesce(p_paid_at, now())
  where id = v_payment.id;

  if v_booking.status in ('cancelled', 'completed', 'no_show', 'refunded_conflict') then
    return jsonb_build_object('action', 'refund_required', 'booking_id', v_booking.id, 'payment_id', v_payment.id);
  end if;

  begin
    update public.bookings
    set status = 'confirmed'
    where id = v_booking.id
      and status in ('pending_payment', 'superseded');
  exception
    when unique_violation then
      update public.bookings
      set status = 'refunded_conflict'
      where id = v_booking.id;
      return jsonb_build_object('action', 'refund_required', 'booking_id', v_booking.id, 'payment_id', v_payment.id);
  end;

  if not found and v_booking.status <> 'confirmed' then
    return jsonb_build_object('action', 'refund_required', 'booking_id', v_booking.id, 'payment_id', v_payment.id);
  end if;

  return jsonb_build_object(
    'action', case when v_booking.status = 'confirmed' then 'already_confirmed' else 'confirmed' end,
    'booking_id', v_booking.id,
    'customer_id', v_booking.customer_id
  );
end;
$$;

create or replace function public.wp_mollie_mark_refunded_conflict(p_mollie_payment_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments
  set status = 'refunded', refunded_at = now(), provider_status = 'refunded'
  where mollie_payment_id = p_mollie_payment_id and payment_provider = 'mollie';

  update public.bookings b
  set status = 'refunded_conflict'
  from public.payments p
  where p.mollie_payment_id = p_mollie_payment_id
    and p.booking_id = b.id
    and b.status not in ('cancelled', 'completed', 'no_show');
end;
$$;

create or replace function public.wp_mollie_admin_payments(
  p_auth_user_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then
    return jsonb_build_object('status', 403, 'code', 'FORBIDDEN');
  end if;

  return jsonb_build_object(
    'status', 200,
    'summary', jsonb_build_object(
      'test', jsonb_build_object(
        'count', count(*) filter (where p.payment_mode = 'test'),
        'paid_cents', coalesce(sum(p.amount_cents) filter (where p.payment_mode = 'test' and p.status = 'paid'), 0),
        'platform_fee_cents', coalesce(sum(p.platform_fee_ex_vat) filter (where p.payment_mode = 'test' and p.status = 'paid'), 0)
      ),
      'live', jsonb_build_object(
        'count', count(*) filter (where p.payment_mode = 'live'),
        'paid_cents', coalesce(sum(p.amount_cents) filter (where p.payment_mode = 'live' and p.status = 'paid'), 0),
        'platform_fee_cents', coalesce(sum(p.platform_fee_ex_vat) filter (where p.payment_mode = 'live' and p.status = 'paid'), 0)
      )
    ),
    'payments', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'booking_id', p.booking_id,
      'mollie_payment_id', p.mollie_payment_id,
      'payment_mode', p.payment_mode,
      'status', p.status,
      'provider_status', p.provider_status,
      'amount_cents', p.amount_cents,
      'platform_fee_cents', p.platform_fee_ex_vat,
      'paid_at', p.paid_at,
      'created_at', p.created_at,
      'customer_name', c.full_name,
      'customer_email', c.email,
      'service_name', s.name
    ) order by p.created_at desc) filter (where p.id is not null), '[]'::jsonb)
  )
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  join public.customers c on c.id = b.customer_id
  join public.services s on s.id = b.service_id
  where p.payment_provider = 'mollie'
    and p.created_at >= p_from
    and p.created_at < p_to;
end;
$$;

revoke all on function public.wp_mollie_prepare_booking_checkout(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.wp_mollie_attach_payment(uuid, text, text) from public, anon, authenticated;
revoke all on function public.wp_mollie_process_payment(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.wp_mollie_mark_refunded_conflict(text) from public, anon, authenticated;
revoke all on function public.wp_mollie_admin_payments(uuid, timestamptz, timestamptz) from public, anon, authenticated;

grant execute on function public.wp_mollie_prepare_booking_checkout(uuid, uuid, text) to service_role;
grant execute on function public.wp_mollie_attach_payment(uuid, text, text) to service_role;
grant execute on function public.wp_mollie_process_payment(text, text, timestamptz) to service_role;
grant execute on function public.wp_mollie_mark_refunded_conflict(text) to service_role;
grant execute on function public.wp_mollie_admin_payments(uuid, timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';
