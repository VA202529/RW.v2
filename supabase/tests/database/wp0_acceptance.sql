begin;

select plan(28);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', '', now(), now(), now(), '{"app_role":"admin"}'::jsonb, '{}'::jsonb);

update public.customers set id = '90000000-0000-0000-0000-0000000000a1' where email = 'alice@example.com';
update public.customers set id = '90000000-0000-0000-0000-0000000000b2' where email = 'bob@example.com';
update public.customers set id = '90000000-0000-0000-0000-0000000000c3' where email = 'admin@example.com';

insert into public.services
  (id, name, price_cents, duration_minutes, deposit_type, deposit_value, is_active)
values
  ('10000000-0000-0000-0000-000000000001', 'Active service', 3000, 30, 'fixed', 1000, true),
  ('10000000-0000-0000-0000-000000000002', 'Inactive service', 3000, 30, 'fixed', 1000, false);

insert into public.products
  (id, name, price_cents, stock, is_active)
values
  ('20000000-0000-0000-0000-000000000001', 'Active product', 1000, 5, true),
  ('20000000-0000-0000-0000-000000000002', 'Inactive product', 1000, 5, false);

insert into public.bookings
  (id, customer_id, service_id, starts_at, ends_at, status, deposit_cents)
values
  ('30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '2026-08-01 10:00+00', '2026-08-01 10:30+00', 'confirmed', 1000),
  ('30000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000001', '2026-08-01 11:00+00', '2026-08-01 11:30+00', 'completed', 1000),
  ('30000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '2026-08-01 12:00+00', '2026-08-01 12:30+00', 'completed', 1000),
  ('30000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '2026-08-01 13:00+00', '2026-08-01 13:30+00', 'cancelled', 1000),
  ('30000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '2026-08-01 14:00+00', '2026-08-01 14:30+00', 'superseded', 1000),
  ('30000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000001', '2026-08-01 15:00+00', '2026-08-01 15:30+00', 'completed', 1000);

insert into public.orders
  (id, customer_id, status, total_cents, application_fee_cents)
values
  ('40000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000a1', 'paid', 1000, 100),
  ('40000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000b2', 'paid', 1000, 100);

insert into public.payments
  (id, booking_id, amount_cents, application_fee_cents, status)
values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1000, 100, 'paid'),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1000, 100, 'paid');

insert into public.credits
  (id, customer_id, amount_cents, remaining_cents)
values
  ('60000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000a1', 1000, 1000),
  ('60000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000b2', 1000, 1000);

insert into public.notification_prefs (customer_id)
values
  ('90000000-0000-0000-0000-0000000000a1'),
  ('90000000-0000-0000-0000-0000000000b2');

insert into public.reviews
  (id, booking_id, customer_id, rating, body, is_visible)
values
  ('70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000b2', 5, 'Visible review', true),
  ('70000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-0000000000b2', 4, 'Hidden review', false);

select throws_ok(
  $$ insert into public.bookings (customer_id, service_id, starts_at, ends_at, status)
     values ('90000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000001', '2026-08-01 10:00+00', '2026-08-01 10:30+00', 'pending_payment') $$,
  '23505',
  null,
  'second active booking at same starts_at fails'
);

select lives_ok(
  $$ insert into public.bookings (customer_id, service_id, starts_at, ends_at, status)
     values ('90000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000001', '2026-08-01 13:00+00', '2026-08-01 13:30+00', 'confirmed') $$,
  'same starts_at succeeds when existing booking is cancelled'
);

select lives_ok(
  $$ insert into public.bookings (customer_id, service_id, starts_at, ends_at, status)
     values ('90000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000001', '2026-08-01 14:00+00', '2026-08-01 14:30+00', 'confirmed') $$,
  'same starts_at succeeds when existing booking is superseded'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{}}', true);

select is((select count(*)::int from public.customers where email = 'bob@example.com'), 0, 'user cannot select another customer');
select is((select count(*)::int from public.bookings where customer_id = '90000000-0000-0000-0000-0000000000b2'), 0, 'user cannot select another customer booking');
select is((select count(*)::int from public.orders where customer_id = '90000000-0000-0000-0000-0000000000b2'), 0, 'user cannot select another customer order');
select is((select count(*)::int from public.payments where id = '50000000-0000-0000-0000-000000000002'), 0, 'user cannot select another customer payment');
select is((select count(*)::int from public.credits where customer_id = '90000000-0000-0000-0000-0000000000b2'), 0, 'user cannot select another customer credit');
select is((select count(*)::int from public.notification_prefs where customer_id = '90000000-0000-0000-0000-0000000000b2'), 0, 'user cannot select another customer notification prefs');

select throws_ok(
  $$ insert into public.bookings (customer_id, service_id, starts_at, ends_at, status)
     values ('90000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '2026-08-02 10:00+00', '2026-08-02 10:30+00', 'pending_payment') $$,
  '42501',
  null,
  'non-admin cannot insert bookings directly'
);
select throws_ok($$ insert into public.orders (customer_id, status, total_cents) values ('90000000-0000-0000-0000-0000000000a1', 'pending_payment', 1000) $$, '42501', null, 'non-admin cannot insert orders directly');
select throws_ok($$ insert into public.payments (booking_id, amount_cents, status) values ('30000000-0000-0000-0000-000000000001', 1000, 'pending') $$, '42501', null, 'non-admin cannot insert payments directly');
select throws_ok($$ insert into public.credits (customer_id, amount_cents, remaining_cents) values ('90000000-0000-0000-0000-0000000000a1', 1000, 1000) $$, '42501', null, 'non-admin cannot insert credits directly');
select is((with updated as (update public.bookings set status = 'cancelled' where id = '30000000-0000-0000-0000-000000000001' returning 1) select count(*)::int from updated), 0, 'non-admin cannot update bookings directly');
select is((with updated as (update public.orders set status = 'cancelled' where id = '40000000-0000-0000-0000-000000000001' returning 1) select count(*)::int from updated), 0, 'non-admin cannot update orders directly');
select is((with updated as (update public.payments set status = 'failed' where id = '50000000-0000-0000-0000-000000000001' returning 1) select count(*)::int from updated), 0, 'non-admin cannot update payments directly');
select is((with updated as (update public.credits set remaining_cents = 0 where id = '60000000-0000-0000-0000-000000000001' returning 1) select count(*)::int from updated), 0, 'non-admin cannot update credits directly');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon","app_metadata":{}}', true);

select is((select count(*)::int from public.services), 1, 'anonymous sees only active services');
select is((select count(*)::int from public.products), 1, 'anonymous sees only active products');
select is((select count(*)::int from public.reviews), 1, 'anonymous sees only visible reviews');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{}}', true);

select throws_ok(
  $$ insert into public.reviews (booking_id, customer_id, rating, body)
     values ('30000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000b2', 5, 'Not mine') $$,
  '42501',
  null,
  'review insert fails for booking user does not own'
);
select throws_ok(
  $$ insert into public.reviews (booking_id, customer_id, rating, body)
     values ('30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000a1', 5, 'Not completed') $$,
  '42501',
  null,
  'review insert fails when owned booking is not completed'
);
select lives_ok(
  $$ insert into public.reviews (booking_id, customer_id, rating, body)
     values ('30000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-0000000000a1', 5, 'Great') $$,
  'review insert succeeds for owned completed booking'
);
select throws_ok(
  $$ insert into public.reviews (booking_id, customer_id, rating, body)
     values ('30000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-0000000000a1', 5, 'Again') $$,
  '23505',
  null,
  'second review for same booking fails'
);

reset role;

select lives_ok($$ insert into public.webhook_events (provider, event_id, payload) values ('stripe', 'evt_1', '{}'::jsonb) $$, 'webhook event initial insert succeeds');
select throws_ok($$ insert into public.webhook_events (provider, event_id, payload) values ('stripe', 'evt_1', '{}'::jsonb) $$, '23505', null, 'duplicate webhook provider/event id fails');

select throws_ok($$ insert into public.customers (email, phone_e164) values ('badphone@example.com', '0612345678') $$, '23514', null, 'local phone number rejected');
select lives_ok($$ insert into public.customers (email, phone_e164) values ('goodphone@example.com', '+31612345678') $$, 'E.164 phone number accepted');

select * from finish();

rollback;
