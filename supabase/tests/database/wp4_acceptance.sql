begin;

select plan(20);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000a401','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-wp4@example.com','',now(),now(),now(),'{"app_role":"admin"}'::jsonb,'{}'::jsonb),
  ('00000000-0000-0000-0000-00000000c401','00000000-0000-0000-0000-000000000000','authenticated','authenticated','shop-wp4@example.com','',now(),now(),now(),'{}'::jsonb,'{}'::jsonb);

update public.customers set id='94000000-0000-0000-0000-000000000401' where email='admin-wp4@example.com';
update public.customers set id='94000000-0000-0000-0000-000000000402' where email='shop-wp4@example.com';

insert into public.products(id,name,price_cents,stock,is_active,category)
values
  ('24000000-0000-0000-0000-000000000001','Last Unit',500,1,true,'general'),
  ('24000000-0000-0000-0000-000000000002','Forty Euro',4000,10,true,'general'),
  ('24000000-0000-0000-0000-000000000003','Sealed',1200,5,true,'sealed_cosmetics');

select is((public.wp4_create_order('[{"product_id":"24000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,'Shopper','shop-wp4@example.com',null,false,false,true,'203.0.113.40')->>'status')::int, 201, 'first last-unit order succeeds');
select is((public.wp4_create_order('[{"product_id":"24000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,'Shopper2','shop2-wp4@example.com',null,false,false,true,'203.0.113.41')->>'status')::int, 409, 'second last-unit order is out of stock');
select is((select stock from public.products where id='24000000-0000-0000-0000-000000000001'), 0, 'stock decremented on hold');

update public.orders set expires_at=now()-interval '1 minute' where customer_id='94000000-0000-0000-0000-000000000402';
select is(public.wp4_expire_pending_orders(), 1, 'expiry job supersedes one order');
select is((select stock from public.products where id='24000000-0000-0000-0000-000000000001'), 1, 'expiry restores stock');

insert into public.orders(id,customer_id,status,total_cents,application_fee_cents,created_at)
values('44000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000402','superseded',500,50,now());
insert into public.order_items(order_id,product_id,quantity,unit_price_cents)
values('44000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001',1,500);
update public.products set stock=0 where id='24000000-0000-0000-0000-000000000001';
select is((public.wp4_process_order_completed('44000000-0000-0000-0000-000000000001','cs_late','pi_late')->>'action'), 'refund_required', 'late payment on retaken stock requires refund');
select is((select status from public.orders where id='44000000-0000-0000-0000-000000000001'), 'refunded_conflict', 'late payment conflict marks order refunded_conflict');

insert into public.credits(customer_id,amount_cents,remaining_cents) values('94000000-0000-0000-0000-000000000402',5000,5000);
insert into public.orders(id,customer_id,status,total_cents,application_fee_cents,expires_at) values('44000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000402','pending_payment',500,50,now()+interval '10 minutes');
select is((public.wp4_prepare_order_checkout('44000000-0000-0000-0000-000000000002')->>'requires_stripe')::boolean, false, 'full credit skips Stripe');
select is((select status from public.orders where id='44000000-0000-0000-0000-000000000002'), 'paid', 'full credit marks order paid');

insert into public.orders(id,customer_id,status,total_cents,application_fee_cents,expires_at) values('44000000-0000-0000-0000-000000000003','94000000-0000-0000-0000-000000000402','pending_payment',4000,120,now()+interval '10 minutes');
update public.credits set remaining_cents=1000 where customer_id='94000000-0000-0000-0000-000000000402';
select is((public.wp4_prepare_order_checkout('44000000-0000-0000-0000-000000000003')->>'application_fee_cents')::int, 120, 'partial checkout returns application fee');

insert into public.orders(id,customer_id,status,total_cents,application_fee_cents,cancel_token,created_at) values('44000000-0000-0000-0000-000000000004','94000000-0000-0000-0000-000000000402','paid',500,50,public.wp2_hash_token('raw-order'),now());
insert into public.payments(order_id,amount_cents,application_fee_cents,status,stripe_payment_intent_id) values('44000000-0000-0000-0000-000000000004',500,50,'paid','pi_cancel');
select is((public.wp4_prepare_cancel_order('44000000-0000-0000-0000-000000000004',null,'raw-order')->>'status')::int, 200, 'valid cancel token can cancel paid order');
select is((public.wp4_prepare_cancel_order('44000000-0000-0000-0000-000000000004',null,'wrong')->>'status')::int, 403, 'invalid cancel token rejected');
update public.orders set created_at=now()-interval '15 days' where id='44000000-0000-0000-0000-000000000004';
select is((public.wp4_prepare_cancel_order('44000000-0000-0000-0000-000000000004',null,'raw-order')->>'status')::int, 403, 'after 14 days cancel rejected');

select is(public.wp4_order_application_fee(500), 50, 'fee minimum is 50 cents on 5 euro order');
select is(public.wp4_order_application_fee(4000), 120, 'fee is 3 percent on 40 euro order');

select is((public.wp4_admin_manage_products('00000000-0000-0000-0000-00000000a401','upsert',jsonb_build_object('id','24000000-0000-0000-0000-000000000002','stock_adjustment',-3))->'product'->>'stock')::int, 7, 'admin stock adjustment is additive');
select is((public.wp4_admin_manage_products('00000000-0000-0000-0000-00000000a401','upsert',jsonb_build_object('id','24000000-0000-0000-0000-000000000002','stock_adjustment',-99))->>'status')::int, 409, 'negative stock adjustment rejected');

insert into public.orders(id,customer_id,status,total_cents,application_fee_cents,cancel_token,created_at) values('44000000-0000-0000-0000-000000000005','94000000-0000-0000-0000-000000000402','picked_up',1200,50,public.wp2_hash_token('sealed'),now());
insert into public.order_items(order_id,product_id,quantity,unit_price_cents) values('44000000-0000-0000-0000-000000000005','24000000-0000-0000-0000-000000000003',1,1200);
select is((public.wp4_prepare_cancel_order('44000000-0000-0000-0000-000000000005',null,'sealed')->>'status')::int, 403, 'picked_up sealed cosmetics has no refund right');

select is(public.wp3_should_send_magic_link('94000000-0000-0000-0000-000000000402'), true, 'magic link initially not sent');
insert into public.message_log(customer_id,channel,template,status) values('94000000-0000-0000-0000-000000000402','email','magic_link','sent');
select is(public.wp3_should_send_magic_link('94000000-0000-0000-0000-000000000402'), false, 'magic link dedupe prevents duplicate');

select * from finish();

rollback;
