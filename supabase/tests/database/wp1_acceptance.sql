begin;

select plan(18);

insert into public.services
  (id, name, price_cents, duration_minutes, buffer_minutes, deposit_type, deposit_value, is_active)
values
  ('11000000-0000-0000-0000-000000000001', 'WP1 Fixed', 4000, 30, 5, 'fixed', 1000, true),
  ('11000000-0000-0000-0000-000000000002', 'WP1 Percent', 5000, 45, 10, 'percentage', 20, true);

insert into public.availability_rules (weekday, opens_at, closes_at, is_active)
values
  (0, '09:00', '17:00', true),
  (1, '09:00', '17:00', true),
  (2, '09:00', '17:00', true),
  (3, '09:00', '17:00', true),
  (4, '09:00', '17:00', true),
  (5, '09:00', '17:00', true),
  (6, '09:00', '17:00', true);

select is(public.wp1_deposit_cents(5000, 'percentage', 20), 1000, 'percentage deposit is rounded to cents');
select is(public.wp1_deposit_cents(4000, 'fixed', 1250), 1250, 'fixed deposit uses deposit_value');

select is(
  (public.wp1_create_booking_hold(
    '11000000-0000-0000-0000-000000000001',
    '2026-08-10 10:00+00',
    'Alice',
    'alice-wp1@example.com',
    '+31612345678',
    true,
    true,
    true,
    '203.0.113.10'
  ) ->> 'status')::int,
  201,
  'first hold succeeds'
);

select is(
  (public.wp1_create_booking_hold(
    '11000000-0000-0000-0000-000000000001',
    '2026-08-10 10:00+00',
    'Bob',
    'bob-wp1@example.com',
    '+31612345679',
    false,
    false,
    true,
    '203.0.113.11'
  ) ->> 'status')::int,
  409,
  'parallel slot loser receives 409-shaped result'
);

update public.bookings
set expires_at = now() - interval '1 minute'
where starts_at = '2026-08-10 10:00+00';

select is(
  (public.wp1_create_booking_hold(
    '11000000-0000-0000-0000-000000000001',
    '2026-08-10 10:00+00',
    'Bob',
    'bob-wp1@example.com',
    '+31612345679',
    false,
    false,
    true,
    '203.0.113.11'
  ) ->> 'status')::int,
  201,
  'expired pending booking is superseded and new hold succeeds'
);

select is(
  (select count(*)::int from public.bookings where starts_at = '2026-08-10 10:00+00' and status = 'superseded'),
  1,
  'old expired hold is superseded'
);

select is(
  (public.wp1_create_booking_hold(
    '11000000-0000-0000-0000-000000000001',
    '2026-08-10 11:00+00',
    'Rate One',
    'rate-wp1@example.com',
    null,
    false,
    false,
    true,
    '203.0.113.12'
  ) ->> 'status')::int,
  201,
  'rate limit setup hold 1 succeeds'
);

select is(
  (public.wp1_create_booking_hold(
    '11000000-0000-0000-0000-000000000001',
    '2026-08-10 12:00+00',
    'Rate Two',
    'rate-wp1@example.com',
    null,
    false,
    false,
    true,
    '203.0.113.12'
  ) ->> 'status')::int,
  201,
  'rate limit setup hold 2 succeeds'
);

select is(
  (public.wp1_create_booking_hold(
    '11000000-0000-0000-0000-000000000001',
    '2026-08-10 13:00+00',
    'Rate Three',
    'rate-wp1@example.com',
    null,
    false,
    false,
    true,
    '203.0.113.12'
  ) ->> 'status')::int,
  201,
  'rate limit setup hold 3 succeeds'
);

select is(
  (public.wp1_create_booking_hold(
    '11000000-0000-0000-0000-000000000001',
    '2026-08-10 14:00+00',
    'Rate Four',
    'rate-wp1@example.com',
    null,
    false,
    false,
    true,
    '203.0.113.12'
  ) ->> 'status')::int,
  429,
  'fourth pending hold for same email/ip is rate limited'
);

insert into public.credits (customer_id, amount_cents, remaining_cents, created_at)
select customer_id, 400, 400, now() - interval '2 days'
from public.bookings
where starts_at = '2026-08-10 11:00+00';

select is(
  (public.wp1_prepare_checkout((select id from public.bookings where starts_at = '2026-08-10 11:00+00')) ->> 'amount_due_cents')::int,
  600,
  'partial credit reduces checkout amount'
);

insert into public.credits (customer_id, amount_cents, remaining_cents, created_at)
select customer_id, 1000, 1000, now() - interval '1 day'
from public.bookings
where starts_at = '2026-08-10 12:00+00';

select is(
  (public.wp1_prepare_checkout((select id from public.bookings where starts_at = '2026-08-10 12:00+00')) ->> 'requires_stripe')::boolean,
  false,
  'full credit confirms without Stripe'
);

select is(
  (select status from public.bookings where starts_at = '2026-08-10 12:00+00'),
  'confirmed',
  'full credit booking is confirmed'
);

select is(
  public.wp1_record_stripe_event('evt_wp1_replay', '{"type":"checkout.session.completed"}'::jsonb),
  true,
  'first webhook event insert is accepted'
);

select is(
  public.wp1_record_stripe_event('evt_wp1_replay', '{"type":"checkout.session.completed"}'::jsonb),
  false,
  'webhook replay is ignored'
);

select lives_ok(
  $$ select public.wp1_process_checkout_completed(
    (select id from public.bookings where starts_at = '2026-08-10 13:00+00'),
    'cs_test_recover',
    'pi_test_recover'
  ) $$,
  'payment-after-expiry while slot free recovers to confirmed'
);

select is(
  (select status from public.bookings where starts_at = '2026-08-10 13:00+00'),
  'confirmed',
  'recovered booking is confirmed'
);

select lives_ok(
  $$ select public.wp1_process_checkout_failed(
    (select id from public.bookings where starts_at = '2026-08-10 14:00+00')
  ) $$,
  'failed checkout supersedes pending booking'
);

select is(
  (select status from public.bookings where starts_at = '2026-08-10 14:00+00'),
  'superseded',
  'failed checkout booking is superseded'
);

select * from finish();

rollback;
