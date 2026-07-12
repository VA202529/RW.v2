begin;

select plan(13);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000a501','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-wp5@example.com','',now(),now(),now(),'{"app_role":"admin"}'::jsonb,'{}'::jsonb),
  ('00000000-0000-0000-0000-00000000c501','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-wp5@example.com','',now(),now(),now(),'{}'::jsonb,'{}'::jsonb);

update public.customers set id='95000000-0000-0000-0000-000000000501', full_name='Admin WP5' where email='admin-wp5@example.com';
update public.customers set id='95000000-0000-0000-0000-000000000502', full_name='Review Klant' where email='review-wp5@example.com';

insert into public.services(id,name,price_cents,duration_minutes,buffer_minutes,deposit_type,deposit_value,is_active)
values('15000000-0000-0000-0000-000000000001','WP5 Cut',3500,30,0,'fixed',1000,true);

insert into public.bookings(id,customer_id,service_id,starts_at,ends_at,status,source,deposit_cents)
values
  ('35000000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000502','15000000-0000-0000-0000-000000000001',now()-interval '2 days',now()-interval '2 days'+interval '30 minutes','completed','online',1000),
  ('35000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000502','15000000-0000-0000-0000-000000000001',now()+interval '2 days',now()+interval '2 days'+interval '30 minutes','confirmed','online',1000);

select is((public.wp5_prepare_review_request('35000000-0000-0000-0000-000000000001','raw-review')->>'status')::int, 200, 'review request prepares token row');
select is((select review_token from public.reviews where booking_id='35000000-0000-0000-0000-000000000001'), public.wp2_hash_token('raw-review'), 'raw review token is stored as hash');
select is((public.wp5_submit_review(null,'35000000-0000-0000-0000-000000000001','raw-review',5,'Hele fijne afspraak gehad')->>'status')::int, 200, 'submit-review with valid token succeeds');
select is((select is_visible from public.reviews where booking_id='35000000-0000-0000-0000-000000000001'), false, 'submitted review remains hidden');
select is((public.wp5_submit_review(null,'35000000-0000-0000-0000-000000000001','bad-token',5,'Hele fijne afspraak gehad')->>'status')::int, 403, 'invalid token rejected');
select is((public.wp5_submit_review(null,'35000000-0000-0000-0000-000000000001','raw-review',4,'Nog een tweede poging')->>'status')::int, 409, 'duplicate review rejected');

select is((public.wp5_prepare_review_request('35000000-0000-0000-0000-000000000002','raw-noncompleted')->>'status')::int, 422, 'non-completed booking cannot prepare review');
select is((public.wp5_submit_review('00000000-0000-0000-0000-00000000c501','35000000-0000-0000-0000-000000000002',null,4,'Dit mag nog niet')->>'status')::int, 422, 'non-completed booking cannot receive review');
select is((public.wp5_submit_review('00000000-0000-0000-0000-00000000c501','35000000-0000-0000-0000-000000000002',null,4,'te kort')->>'status')::int, 422, 'short review body rejected');

select is((public.wp5_admin_manage_reviews('00000000-0000-0000-0000-00000000a501','toggle',jsonb_build_object('id',(select id from public.reviews where booking_id='35000000-0000-0000-0000-000000000001'),'is_visible',true))->>'status')::int, 200, 'admin can publish review');
select is(jsonb_array_length(public.wp5_public_reviews()), 1, 'published review appears in public query');

select ok((select pg_catalog.pg_get_functiondef('public.wp5_public_reviews()'::regprocedure) like '%is_visible = true%'), 'public reviews query only visible reviews');
select ok((select pg_catalog.pg_get_functiondef('public.wp5_submit_review(uuid,uuid,text,int,text)'::regprocedure) like '%wp2_hash_token%'), 'submit-review validates raw token against stored hash');

select * from finish();

rollback;
