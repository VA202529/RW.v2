begin;

select plan(21);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000a301','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-wp3@example.com','',now(),now(),now(),'{"app_role":"admin"}'::jsonb,'{}'::jsonb),
  ('00000000-0000-0000-0000-00000000c301','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-wp3@example.com','',now(),now(),now(),'{}'::jsonb,'{}'::jsonb),
  ('00000000-0000-0000-0000-00000000c302','00000000-0000-0000-0000-000000000000','authenticated','authenticated','blocked-wp3@example.com','',now(),now(),now(),'{}'::jsonb,'{}'::jsonb);

update public.customers set id='93000000-0000-0000-0000-000000000301' where email='admin-wp3@example.com';
update public.customers set id='93000000-0000-0000-0000-000000000302' where email='client-wp3@example.com';
update public.customers set id='93000000-0000-0000-0000-000000000303', is_blocked=true where email='blocked-wp3@example.com';

insert into public.services
  (id, name, price_cents, duration_minutes, buffer_minutes, deposit_type, deposit_value, is_active)
values
  ('13000000-0000-0000-0000-000000000001','WP3 Cut',4000,30,5,'fixed',1000,true);

insert into public.bookings
  (id, customer_id, service_id, starts_at, ends_at, status, source, deposit_cents, reminder_channel)
values
  ('33000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000302','13000000-0000-0000-0000-000000000001',now()+interval '3 days',now()+interval '3 days 30 minutes','confirmed','online',1000,'email'),
  ('33000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000302','13000000-0000-0000-0000-000000000001',now()+interval '4 days',now()+interval '4 days 30 minutes','confirmed','online',1000,'email'),
  ('33000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000302','13000000-0000-0000-0000-000000000001',now()+interval '5 days',now()+interval '5 days 30 minutes','confirmed','online',1000,'email');

insert into public.payments (booking_id, stripe_payment_intent_id, amount_cents, application_fee_cents, status, created_at)
values
  ('33000000-0000-0000-0000-000000000001','pi_wp3_1',1000,100,'paid',date_trunc('month', now() - interval '1 month') + interval '2 days'),
  ('33000000-0000-0000-0000-000000000002','pi_wp3_2',1000,100,'paid',date_trunc('month', now() - interval '1 month') + interval '3 days');

select is(
  (public.wp3_admin_update_booking_status('00000000-0000-0000-0000-00000000a301','33000000-0000-0000-0000-000000000001','completed','none')->>'status')::int,
  200,
  'completed status update succeeds'
);
select is((select status from public.bookings where id='33000000-0000-0000-0000-000000000001'), 'completed', 'completed updates booking status');
select is((select count(*)::int from public.message_log where booking_id='33000000-0000-0000-0000-000000000001' and template='review_request'), 1, 'completed queues review request');
select is(
  (public.wp3_admin_update_booking_status('00000000-0000-0000-0000-00000000a301','33000000-0000-0000-0000-000000000001','completed','none')->>'status')::int,
  200,
  'second completed update succeeds idempotently'
);
select is((select count(*)::int from public.message_log where booking_id='33000000-0000-0000-0000-000000000001' and template='review_request'), 1, 'second completed update adds no duplicate review request');

select is(
  (public.wp3_admin_update_booking_status('00000000-0000-0000-0000-00000000a301','33000000-0000-0000-0000-000000000002','no_show','none')->>'status')::int,
  200,
  'no_show status update succeeds'
);
select is((select status from public.bookings where id='33000000-0000-0000-0000-000000000002'), 'no_show', 'no_show updates booking status');
select is((select count(*)::int from public.message_log where booking_id='33000000-0000-0000-0000-000000000002'), 0, 'no_show creates no email log');
select is((select status from public.payments where booking_id='33000000-0000-0000-0000-000000000002'), 'paid', 'no_show does not refund');

select is(
  jsonb_array_length(public.wp3_admin_manage_availability(
    '00000000-0000-0000-0000-00000000a301',
    'create_blocked_slot',
    jsonb_build_object('starts_at', now()+interval '5 days 5 minutes', 'ends_at', now()+interval '5 days 20 minutes', 'reason', 'test')
  )->'conflicts'),
  1,
  'blocked slot insert returns overlapping confirmed booking'
);

select is(
  (public.wp1_create_booking_hold('13000000-0000-0000-0000-000000000001', now()+interval '7 days', 'Blocked', 'blocked-wp3@example.com', null, false, false, true, '203.0.113.30')->>'status')::int,
  403,
  'blocked customer cannot book online'
);

select is(
  (public.wp3_admin_manual_booking('00000000-0000-0000-0000-00000000a301','13000000-0000-0000-0000-000000000001',now()+interval '8 days','Manual','manual-wp3@example.com',null)->>'status')::int,
  201,
  'manual booking succeeds'
);
select is(
  (public.wp3_admin_manual_booking('00000000-0000-0000-0000-00000000a301','13000000-0000-0000-0000-000000000001',(select starts_at from public.bookings where customer_id=(select id from public.customers where email='manual-wp3@example.com')),'Manual 2','manual2-wp3@example.com',null)->>'status')::int,
  409,
  'manual booking still enforces unique active slot'
);

select is(
  (public.wp3_admin_manage_services('00000000-0000-0000-0000-00000000a301','upsert',jsonb_build_object('id','13000000-0000-0000-0000-000000000001','name','WP3 Cut','description','x','price_cents',4000,'duration_minutes',30,'buffer_minutes',5,'deposit_type','fixed','deposit_value',1000,'is_active',false))->>'status')::int,
  200,
  'service deactivate succeeds'
);
select is((select is_active from public.services where id='13000000-0000-0000-0000-000000000001'), false, 'service is inactive');
select ok((select count(*) from public.bookings where service_id='13000000-0000-0000-0000-000000000001') > 0, 'existing bookings remain after service deactivation');

insert into public.notification_prefs(customer_id, marketing_email_opt_in)
values ('93000000-0000-0000-0000-000000000302', true), ('93000000-0000-0000-0000-000000000303', false)
on conflict(customer_id) do update set marketing_email_opt_in=excluded.marketing_email_opt_in;
select is(jsonb_array_length(public.wp3_broadcast_recipients('00000000-0000-0000-0000-00000000a301','Titel','Body')->'recipients'), 1, 'broadcast selects only opt-in customers');

insert into public.bookings(customer_id, service_id, starts_at, ends_at, status, source, deposit_cents)
values
  ('93000000-0000-0000-0000-000000000302','13000000-0000-0000-0000-000000000001',now()-interval '5 days',now()-interval '5 days'+interval '30 minutes','completed','online',1000),
  ('93000000-0000-0000-0000-000000000303','13000000-0000-0000-0000-000000000001',now()-interval '4 days',now()-interval '4 days'+interval '30 minutes','no_show','online',1000),
  ('93000000-0000-0000-0000-000000000303','13000000-0000-0000-0000-000000000001',now()-interval '3 days',now()-interval '3 days'+interval '30 minutes','cancelled','online',1000);
select is((public.wp3_admin_stats('00000000-0000-0000-0000-00000000a301', now()-interval '10 days', now()+interval '1 day')->>'no_show_pct')::numeric, 33.33, 'admin stats no_show percentage is correct');

select is((public.wp3_create_platform_invoice_previous_month()->>'total_fee_cents')::int, 200, 'platform invoice aggregates previous month application fees');

select is(public.wp3_should_send_magic_link('93000000-0000-0000-0000-000000000302'), true, 'magic link is initially needed');
insert into public.message_log(customer_id, channel, template, status) values ('93000000-0000-0000-0000-000000000302','email','magic_link','sent');
select is(public.wp3_should_send_magic_link('93000000-0000-0000-0000-000000000302'), false, 'magic link is deduplicated after first log');

select * from finish();

rollback;
