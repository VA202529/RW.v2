begin;

select plan(25);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000d201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wp2@example.com', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

update public.customers
set id = '92000000-0000-0000-0000-000000000001'
where email = 'wp2@example.com';

insert into public.services
  (id, name, price_cents, duration_minutes, buffer_minutes, deposit_type, deposit_value, is_active)
values
  ('12000000-0000-0000-0000-000000000001', 'WP2 Cut', 4000, 30, 5, 'fixed', 1000, true);

insert into public.bookings
  (id, customer_id, service_id, starts_at, ends_at, status, deposit_cents, cancel_token)
values
  ('32000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', now() + interval '72 hours', now() + interval '72 hours 30 minutes', 'confirmed', 1000, public.wp2_hash_token('raw-credit')),
  ('32000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', now() + interval '80 hours', now() + interval '80 hours 30 minutes', 'confirmed', 1000, public.wp2_hash_token('raw-refund')),
  ('32000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', now() + interval '3 hours', now() + interval '3 hours 30 minutes', 'confirmed', 1000, public.wp2_hash_token('raw-late')),
  ('32000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', now() + interval '90 hours', now() + interval '90 hours 30 minutes', 'confirmed', 1000, public.wp2_hash_token('raw-reschedule')),
  ('32000000-0000-0000-0000-000000000005', '92000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', now() + interval '96 hours', now() + interval '96 hours 30 minutes', 'confirmed', 1000, public.wp2_hash_token('raw-taken')),
  ('32000000-0000-0000-0000-000000000006', '92000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', now() + interval '48 hours', now() + interval '48 hours 30 minutes', 'confirmed', 1000, public.wp2_hash_token('raw-reminder-in')),
  ('32000000-0000-0000-0000-000000000007', '92000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', now() + interval '49 hours 1 minute', now() + interval '49 hours 31 minutes', 'confirmed', 1000, public.wp2_hash_token('raw-reminder-out'));

insert into public.payments
  (booking_id, stripe_payment_intent_id, amount_cents, application_fee_cents, status)
values
  ('32000000-0000-0000-0000-000000000001', 'pi_credit', 1000, 100, 'paid'),
  ('32000000-0000-0000-0000-000000000002', 'pi_refund', 1000, 100, 'paid'),
  ('32000000-0000-0000-0000-000000000003', 'pi_late', 1000, 100, 'paid');

select is(
  (public.wp2_prepare_cancel('32000000-0000-0000-0000-000000000001', 'credit', null, 'raw-credit') ->> 'status')::int,
  200,
  'valid raw cancellation token authorizes cancel'
);

select is(
  (public.wp2_prepare_cancel('32000000-0000-0000-0000-000000000001', 'credit', null, 'wrong') ->> 'status')::int,
  403,
  'invalid cancellation token is rejected'
);

select lives_ok($$ select public.wp2_finalize_cancel('32000000-0000-0000-0000-000000000001', 'credit', true) $$, 'cancel >24h credit finalizes');
select is((select status from public.bookings where id = '32000000-0000-0000-0000-000000000001'), 'cancelled', 'credit cancel sets booking cancelled');
select is((select remaining_cents from public.credits where source_booking_id = '32000000-0000-0000-0000-000000000001'), 1000, 'credit cancel creates usable credit');
select is((select status from public.payments where booking_id = '32000000-0000-0000-0000-000000000001'), 'refunded', 'credit cancel records payment refund');

select lives_ok($$ select public.wp2_finalize_cancel('32000000-0000-0000-0000-000000000002', 'refund', true) $$, 'cancel >24h refund finalizes');
select is((select count(*)::int from public.credits where source_booking_id = '32000000-0000-0000-0000-000000000002'), 0, 'refund cancel creates no credit');
select is((select status from public.bookings where id = '32000000-0000-0000-0000-000000000002'), 'cancelled', 'refund cancel sets booking cancelled');

select lives_ok($$ select public.wp2_finalize_cancel('32000000-0000-0000-0000-000000000003', 'credit', false) $$, 'cancel <24h finalizes without refund');
select is((select count(*)::int from public.credits where source_booking_id = '32000000-0000-0000-0000-000000000003'), 0, 'late cancel creates no credit');
select is((select status from public.payments where booking_id = '32000000-0000-0000-0000-000000000003'), 'paid', 'late cancel does not mark refund');

select is(
  (public.wp2_reschedule_booking('32000000-0000-0000-0000-000000000004', now() + interval '100 hours', null, 'raw-reschedule') ->> 'status')::int,
  200,
  'reschedule >24h succeeds'
);
select is((select status from public.bookings where id = '32000000-0000-0000-0000-000000000004'), 'cancelled', 'reschedule cancels old booking');
select is((select count(*)::int from public.bookings where starts_at > now() + interval '99 hours' and status = 'confirmed' and deposit_cents = 1000), 1, 'reschedule creates confirmed replacement with same deposit');

select is(
  (public.wp2_reschedule_booking('32000000-0000-0000-0000-000000000005', (select starts_at from public.bookings where status = 'confirmed' and id <> '32000000-0000-0000-0000-000000000005' limit 1), null, 'raw-taken') ->> 'status')::int,
  409,
  'reschedule to taken slot returns 409'
);
select is((select status from public.bookings where id = '32000000-0000-0000-0000-000000000005'), 'confirmed', 'taken-slot reschedule leaves old booking unchanged');

insert into public.reviews (booking_id, customer_id, rating, body)
values ('32000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000001', 5, 'Private name');

select is((public.wp2_delete_account_prepare('00000000-0000-0000-0000-00000000d201') ->> 'status')::int, 200, 'delete account anonymizes customer');
select like((select email::text from public.customers where id = '92000000-0000-0000-0000-000000000001'), 'deleted-%@deleted.invalid', 'delete account replaces email');
select is((select body from public.reviews where booking_id = '32000000-0000-0000-0000-000000000004'), '[verwijderd]', 'delete account scrubs review body');
select ok((select count(*) from public.bookings where customer_id = '92000000-0000-0000-0000-000000000001') > 0, 'bookings retain customer_id link');

select is(jsonb_array_length(public.wp2_due_emails('booking_reminder_48h')), 1, '48h reminder selector includes only bookings inside window');

insert into public.notification_prefs (customer_id, marketing_email_opt_in)
values ('92000000-0000-0000-0000-000000000001', true)
on conflict (customer_id) do update set marketing_email_opt_in = true;
select is((public.wp2_unsubscribe_email('deleted-92000000-0000-0000-0000-000000000001@deleted.invalid') ->> 'status')::int, 200, 'unsubscribe by signed email target succeeds at RPC layer');
select is((select marketing_email_opt_in from public.notification_prefs where customer_id = '92000000-0000-0000-0000-000000000001'), false, 'unsubscribe disables marketing email');

select isnt((select cancel_token from public.bookings where id = '32000000-0000-0000-0000-000000000006'), 'raw-reminder-in', 'raw cancel token is not stored in database');

select * from finish();

rollback;
