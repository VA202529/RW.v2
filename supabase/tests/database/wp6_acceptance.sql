begin;

select plan(10);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000c601','00000000-0000-0000-0000-000000000000','authenticated','authenticated','wp6@example.com','',now(),now(),now(),'{}'::jsonb,'{}'::jsonb);

update public.customers set id='96000000-0000-0000-0000-000000000601', full_name='WP6 Klant' where email='wp6@example.com';

insert into public.services(id,name,price_cents,duration_minutes,buffer_minutes,deposit_type,deposit_value,is_active)
values('16000000-0000-0000-0000-000000000001','WP6 Cut',3000,30,0,'fixed',1000,true);

insert into public.bookings(id,customer_id,service_id,starts_at,ends_at,status,source,deposit_cents)
values('36000000-0000-0000-0000-000000000001','96000000-0000-0000-0000-000000000601','16000000-0000-0000-0000-000000000001',now()+interval '48 hours',now()+interval '48 hours 30 minutes','confirmed','online',1000);

select is((public.wp6_update_customer_phone('00000000-0000-0000-0000-00000000c601','0612345678')->>'status')::int, 422, 'invalid phone is rejected');
select is((public.wp6_update_customer_phone('00000000-0000-0000-0000-00000000c601','+31612345678')->>'status')::int, 200, 'valid phone is accepted');
select is((select phone_e164 from public.customers where id='96000000-0000-0000-0000-000000000601'), '+31612345678', 'customer phone is updated');
select is((public.wp2_update_notification_prefs('00000000-0000-0000-0000-00000000c601', true, false)->>'status')::int, 200, 'whatsapp opt-in can be toggled after phone save');
select is((select whatsapp_opt_in from public.notification_prefs where customer_id='96000000-0000-0000-0000-000000000601'), true, 'whatsapp opt-in stored');

select lives_ok($$select public.wp6_set_booking_reminder_channel('36000000-0000-0000-0000-000000000001','whatsapp')$$, 'reminder channel update helper runs');
select is((select reminder_channel from public.bookings where id='36000000-0000-0000-0000-000000000001'), 'whatsapp', 'reminder channel set to whatsapp');

insert into public.message_log(customer_id,booking_id,channel,template,provider_message_id,status)
values('96000000-0000-0000-0000-000000000601','36000000-0000-0000-0000-000000000001','whatsapp','booking_confirmation','wamid.test','sent');
select is((select count(*)::int from public.message_log where provider_message_id='wamid.test' and channel='whatsapp'), 1, 'whatsapp message log row exists for webhook update');

select ok((select pg_catalog.pg_get_functiondef('public.wp2_due_emails(text)'::regprocedure) like '%whatsapp_opt_in%'), 'due email payload includes whatsapp opt-in');
select ok((select pg_catalog.pg_get_functiondef('public.wp6_update_customer_phone(uuid,text)'::regprocedure) like '%^\\+[1-9]\\d{6,14}$%'), 'phone helper uses E.164 validation');

select * from finish();

rollback;
