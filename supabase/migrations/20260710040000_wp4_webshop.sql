-- BarberFlow WP4: webshop orders, stock holds, pickup flow, and product admin.

alter table public.products
  add column if not exists category text not null default 'general'
    check (category in ('general','sealed_cosmetics'));

alter table public.orders
  add column if not exists cancel_token text unique,
  add column if not exists hold_ip text;

create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

create or replace function public.wp4_order_application_fee(p_total_cents int)
returns int
language sql
immutable
as $$
  select greatest(round(p_total_cents * 0.03)::int, 50)
$$;

create or replace function public.wp4_create_order(
  p_items jsonb,
  p_full_name text,
  p_email text,
  p_phone_e164 text,
  p_whatsapp_opt_in boolean,
  p_marketing_email_opt_in boolean,
  p_terms_accepted boolean,
  p_ip text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_customer public.customers%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_total int := 0;
  v_cancel_token text := gen_random_uuid()::text;
begin
  if not coalesce(p_terms_accepted, false) then return jsonb_build_object('status',400,'code','TERMS_REQUIRED'); end if;
  if p_email is null or length(trim(p_email)) = 0 then return jsonb_build_object('status',400,'code','EMAIL_REQUIRED'); end if;
  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9]\d{6,14}$' then return jsonb_build_object('status',400,'code','INVALID_PHONE'); end if;
  if jsonb_array_length(p_items) = 0 then return jsonb_build_object('status',400,'code','EMPTY_CART'); end if;

  select * into v_customer from public.customers where email = p_email::extensions.citext;
  if found and v_customer.is_blocked then
    return jsonb_build_object('status',403,'code','CUSTOMER_BLOCKED','message','Online bestellen niet beschikbaar, neem contact op met de kapper.');
  end if;

  if (
    select count(*) from public.orders o join public.customers c on c.id=o.customer_id
    where c.email = p_email::extensions.citext and o.status='pending_payment' and o.expires_at > now()
  ) >= 3 then return jsonb_build_object('status',429,'code','RATE_LIMIT_EMAIL'); end if;

  if p_ip is not null and (
    select count(*) from public.orders o
    where o.hold_ip = p_ip and o.status='pending_payment' and o.expires_at > now()
  ) >= 3 then return jsonb_build_object('status',429,'code','RATE_LIMIT_IP'); end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and is_active=true for update;
    if not found or v_product.stock < (v_item->>'quantity')::int then
      return jsonb_build_object('status',409,'code','OUT_OF_STOCK','product_id',v_item->>'product_id');
    end if;
    v_total := v_total + v_product.price_cents * (v_item->>'quantity')::int;
  end loop;

  insert into public.customers(email, full_name, phone_e164)
  values(p_email::extensions.citext, nullif(trim(p_full_name),''), p_phone_e164)
  on conflict(email) do update
    set full_name = case when public.customers.auth_user_id is null then coalesce(public.customers.full_name, excluded.full_name) else public.customers.full_name end,
        phone_e164 = case when public.customers.auth_user_id is null then coalesce(public.customers.phone_e164, excluded.phone_e164) else public.customers.phone_e164 end
  returning * into v_customer;

  insert into public.notification_prefs(customer_id, whatsapp_opt_in, marketing_email_opt_in)
  values(v_customer.id, coalesce(p_whatsapp_opt_in,false), coalesce(p_marketing_email_opt_in,false))
  on conflict(customer_id) do update
    set whatsapp_opt_in=public.notification_prefs.whatsapp_opt_in or excluded.whatsapp_opt_in,
        marketing_email_opt_in=public.notification_prefs.marketing_email_opt_in or excluded.marketing_email_opt_in;

  insert into public.orders(customer_id,status,expires_at,total_cents,application_fee_cents,terms_accepted_at,cancel_token,hold_ip)
  values(v_customer.id,'pending_payment',now()+interval '15 minutes',v_total,public.wp4_order_application_fee(v_total),now(),public.wp2_hash_token(v_cancel_token),p_ip)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    update public.products set stock = stock - (v_item->>'quantity')::int
    where id=(v_item->>'product_id')::uuid and stock >= (v_item->>'quantity')::int
    returning * into v_product;
    if not found then raise exception 'OUT_OF_STOCK' using errcode='23514'; end if;
    insert into public.order_items(order_id, product_id, quantity, unit_price_cents)
    values(v_order.id, v_product.id, (v_item->>'quantity')::int, v_product.price_cents);
  end loop;

  return jsonb_build_object('status',201,'order_id',v_order.id,'cancel_token',v_cancel_token,'total_cents',v_total);
exception when check_violation then
  return jsonb_build_object('status',409,'code','OUT_OF_STOCK');
end;
$$;

create or replace function public.wp4_restore_order_stock(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
  set stock = p.stock + oi.quantity
  from public.order_items oi
  where oi.product_id = p.id and oi.order_id = p_order_id;
$$;

create or replace function public.wp4_prepare_order_checkout(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
  v_credit public.credits%rowtype;
  v_remaining int;
  v_apply int;
  v_credit_applied int := 0;
  v_payment_id uuid;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then return jsonb_build_object('status',404,'code','ORDER_NOT_FOUND'); end if;
  if v_order.status <> 'pending_payment' or v_order.expires_at <= now() then return jsonb_build_object('status',409,'code','ORDER_NOT_PAYABLE'); end if;
  select * into v_customer from public.customers where id=v_order.customer_id;
  v_remaining := v_order.total_cents;

  for v_credit in select * from public.credits where customer_id=v_order.customer_id and remaining_cents>0 and (expires_at is null or expires_at>now()) order by created_at asc for update loop
    exit when v_remaining <= 0;
    v_apply := least(v_credit.remaining_cents, v_remaining);
    update public.credits set remaining_cents=remaining_cents-v_apply where id=v_credit.id;
    v_credit_applied := v_credit_applied + v_apply;
    v_remaining := v_remaining - v_apply;
  end loop;

  if v_remaining <= 0 then
    update public.orders set status='paid' where id=v_order.id;
    insert into public.payments(order_id, amount_cents, application_fee_cents, status)
    values(v_order.id,0,0,'paid') returning id into v_payment_id;
    return jsonb_build_object('status',200,'requires_stripe',false,'order_id',v_order.id,'payment_id',v_payment_id,'customer_id',v_customer.id,'customer_email',v_customer.email,'total_cents',v_order.total_cents,'amount_due_cents',0,'credit_applied_cents',v_credit_applied);
  end if;

  insert into public.payments(order_id, amount_cents, application_fee_cents, status)
  values(v_order.id,v_remaining,public.wp4_order_application_fee(v_order.total_cents),'pending') returning id into v_payment_id;
  return jsonb_build_object(
    'status',200,'requires_stripe',true,'order_id',v_order.id,'payment_id',v_payment_id,'customer_id',v_customer.id,'customer_email',v_customer.email,
    'total_cents',v_order.total_cents,'amount_due_cents',v_remaining,'application_fee_cents',public.wp4_order_application_fee(v_order.total_cents),'credit_applied_cents',v_credit_applied,
    'items',coalesce((select jsonb_agg(jsonb_build_object('name',p.name,'quantity',oi.quantity,'unit_price_cents',oi.unit_price_cents)) from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=v_order.id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.wp4_attach_order_checkout(p_payment_id uuid, p_session_id text, p_payment_intent_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.payments set stripe_checkout_session_id=p_session_id, stripe_payment_intent_id=p_payment_intent_id where id=p_payment_id;
$$;

create or replace function public.wp4_process_order_completed(p_order_id uuid, p_session_id text, p_payment_intent_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_ok boolean;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then return jsonb_build_object('action','ignored'); end if;
  update public.payments set stripe_checkout_session_id=coalesce(stripe_checkout_session_id,p_session_id), stripe_payment_intent_id=coalesce(stripe_payment_intent_id,p_payment_intent_id) where order_id=p_order_id and status in ('pending','failed');
  if v_order.status='paid' then update public.payments set status='paid' where order_id=p_order_id and status <> 'refunded'; return jsonb_build_object('action','already_paid'); end if;
  if v_order.status='pending_payment' then
    update public.orders set status='paid' where id=p_order_id;
    update public.payments set status='paid' where order_id=p_order_id and status <> 'refunded';
    return jsonb_build_object('action','paid');
  end if;
  if v_order.status='superseded' then
    select not exists (
      select 1 from public.order_items oi join public.products p on p.id=oi.product_id
      where oi.order_id=p_order_id and p.stock < oi.quantity
    ) into v_ok;
    if v_ok then
      update public.products p set stock=p.stock-oi.quantity from public.order_items oi where oi.product_id=p.id and oi.order_id=p_order_id;
      update public.orders set status='paid' where id=p_order_id;
      update public.payments set status='paid' where order_id=p_order_id and status <> 'refunded';
      return jsonb_build_object('action','paid');
    end if;
    update public.orders set status='refunded_conflict' where id=p_order_id;
    return jsonb_build_object('action','refund_required');
  end if;
  return jsonb_build_object('action','ignored');
end;
$$;

create or replace function public.wp4_process_order_failed(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.orders where id=p_order_id and status='pending_payment') then
    perform public.wp4_restore_order_stock(p_order_id);
    update public.orders set status='superseded' where id=p_order_id;
  end if;
  update public.payments set status='failed' where order_id=p_order_id and status='pending';
end;
$$;

create or replace function public.wp4_expire_pending_orders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_count int := 0;
begin
  for v_order in select id from public.orders where status='pending_payment' and expires_at <= now() for update loop
    perform public.wp4_restore_order_stock(v_order.id);
    update public.orders set status='superseded' where id=v_order.id;
    update public.payments set status='failed' where order_id=v_order.id and status='pending';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.wp4_prepare_cancel_order(p_order_id uuid, p_auth_user_id uuid, p_cancel_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then return jsonb_build_object('status',404,'code','ORDER_NOT_FOUND'); end if;
  select * into v_customer from public.customers where id=v_order.customer_id;
  if not ((p_auth_user_id is not null and v_customer.auth_user_id=p_auth_user_id) or (p_cancel_token is not null and v_order.cancel_token=public.wp2_hash_token(p_cancel_token))) then
    return jsonb_build_object('status',403,'code','FORBIDDEN');
  end if;
  if v_order.status='picked_up' and exists (select 1 from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=v_order.id and p.category='sealed_cosmetics') then
    return jsonb_build_object('status',403,'code','NO_REFUND_RIGHT');
  end if;
  if v_order.status not in ('paid','ready_for_pickup') then return jsonb_build_object('status',409,'code','ORDER_NOT_CANCELLABLE'); end if;
  if v_order.created_at <= now() - interval '14 days' then return jsonb_build_object('status',403,'code','CANCELLATION_WINDOW_CLOSED'); end if;
  select * into v_payment from public.payments where order_id=p_order_id and status='paid' and amount_cents > 0 order by created_at desc limit 1;
  return jsonb_build_object('status',200,'order_id',v_order.id,'customer_id',v_customer.id,'customer_email',v_customer.email,'payment_intent_id',v_payment.stripe_payment_intent_id,'requires_refund',v_payment.id is not null,'total_cents',v_order.total_cents);
end;
$$;

create or replace function public.wp4_finalize_cancel_order(p_order_id uuid, p_refunded boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  select * into v_customer from public.customers where id=v_order.customer_id;
  perform public.wp4_restore_order_stock(p_order_id);
  update public.orders set status='cancelled', cancel_token=null where id=p_order_id;
  if p_refunded then update public.payments set status='refunded', refunded_at=now() where order_id=p_order_id and status='paid'; end if;
  return jsonb_build_object('status',200,'customer_id',v_customer.id,'customer_email',v_customer.email,'total_cents',v_order.total_cents);
end;
$$;

create or replace function public.wp4_admin_prepare_cancel_order(p_auth_user_id uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
  v_payment public.payments%rowtype;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then return jsonb_build_object('status',404,'code','ORDER_NOT_FOUND'); end if;
  select * into v_customer from public.customers where id=v_order.customer_id;
  if v_order.status='picked_up' and exists (select 1 from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=v_order.id and p.category='sealed_cosmetics') then
    return jsonb_build_object('status',403,'code','NO_REFUND_RIGHT');
  end if;
  if v_order.status not in ('paid','ready_for_pickup') then return jsonb_build_object('status',409,'code','ORDER_NOT_CANCELLABLE'); end if;
  if v_order.created_at <= now() - interval '14 days' then return jsonb_build_object('status',403,'code','CANCELLATION_WINDOW_CLOSED'); end if;
  select * into v_payment from public.payments where order_id=p_order_id and status='paid' and amount_cents > 0 order by created_at desc limit 1;
  return jsonb_build_object('status',200,'order_id',v_order.id,'customer_id',v_customer.id,'customer_email',v_customer.email,'payment_intent_id',v_payment.stripe_payment_intent_id,'requires_refund',v_payment.id is not null,'total_cents',v_order.total_cents);
end;
$$;

create or replace function public.wp4_get_account_orders(p_auth_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  from (
    select o.id,o.created_at,o.status,o.total_cents,
      (select string_agg(p.name || ' x' || oi.quantity, ', ') from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=o.id) as items_summary
    from public.orders o join public.customers c on c.id=o.customer_id
    where c.auth_user_id=p_auth_user_id
  ) x
$$;

create or replace function public.wp4_admin_manage_products(p_auth_user_id uuid, p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_product public.products%rowtype; v_adjust int;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  if p_action='list' then return jsonb_build_object('status',200,'products',coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from public.products p),'[]'::jsonb)); end if;
  if p_action='upsert' then
    v_id := nullif(p_payload->>'id','')::uuid;
    if v_id is null then
      insert into public.products(name,description,price_cents,stock,is_active,image_paths,category)
      values(p_payload->>'name',p_payload->>'description',(p_payload->>'price_cents')::int,coalesce((p_payload->>'stock')::int,0),coalesce((p_payload->>'is_active')::boolean,true),coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(p_payload->'image_paths','[]'::jsonb))),array[]::text[]),coalesce(p_payload->>'category','general'))
      returning * into v_product;
    else
      v_adjust := coalesce((p_payload->>'stock_adjustment')::int,0);
      update public.products
      set name=coalesce(p_payload->>'name',name), description=coalesce(p_payload->>'description',description), price_cents=coalesce((p_payload->>'price_cents')::int,price_cents),
          stock=stock+v_adjust, is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
          image_paths=coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(p_payload->'image_paths','[]'::jsonb))),image_paths),
          category=coalesce(p_payload->>'category',category)
      where id=v_id and stock+v_adjust >= 0 returning * into v_product;
      if not found then return jsonb_build_object('status',409,'code','NEGATIVE_STOCK'); end if;
    end if;
    return jsonb_build_object('status',200,'product',to_jsonb(v_product));
  elsif p_action='soft_delete' then
    update public.products set is_active=false where id=(p_payload->>'id')::uuid returning * into v_product;
    return jsonb_build_object('status',200,'product',to_jsonb(v_product));
  end if;
  return jsonb_build_object('status',400,'code','INVALID_ACTION');
end;
$$;

create or replace function public.wp4_admin_manage_orders(p_auth_user_id uuid, p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then return jsonb_build_object('status',403,'code','FORBIDDEN'); end if;
  if p_action='list' then
    return jsonb_build_object('status',200,'orders',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select o.id,o.status,o.created_at,o.total_cents,o.application_fee_cents,c.full_name,c.email,
          (select string_agg(p.name || ' x' || oi.quantity, ', ') from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=o.id) as items_summary
        from public.orders o join public.customers c on c.id=o.customer_id
        where (coalesce(p_payload->>'status','')='' or o.status=p_payload->>'status')
        limit coalesce((p_payload->>'limit')::int,50)
      ) x
    ),'[]'::jsonb));
  elsif p_action='update_status' then
    update public.orders set status=p_payload->>'status' where id=(p_payload->>'order_id')::uuid returning * into v_order;
    return jsonb_build_object('status',200,'order',to_jsonb(v_order));
  end if;
  return jsonb_build_object('status',400,'code','INVALID_ACTION');
end;
$$;

select cron.schedule(
  'wp4-expire-pending-orders',
  '*/5 * * * *',
  $$select public.wp4_expire_pending_orders();$$
);

revoke all on function public.wp4_order_application_fee(int) from public, anon, authenticated;
revoke all on function public.wp4_create_order(jsonb,text,text,text,boolean,boolean,boolean,text) from public, anon, authenticated;
revoke all on function public.wp4_restore_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.wp4_prepare_order_checkout(uuid) from public, anon, authenticated;
revoke all on function public.wp4_attach_order_checkout(uuid,text,text) from public, anon, authenticated;
revoke all on function public.wp4_process_order_completed(uuid,text,text) from public, anon, authenticated;
revoke all on function public.wp4_process_order_failed(uuid) from public, anon, authenticated;
revoke all on function public.wp4_expire_pending_orders() from public, anon, authenticated;
revoke all on function public.wp4_prepare_cancel_order(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.wp4_finalize_cancel_order(uuid,boolean) from public, anon, authenticated;
revoke all on function public.wp4_admin_prepare_cancel_order(uuid,uuid) from public, anon, authenticated;
revoke all on function public.wp4_get_account_orders(uuid) from public, anon, authenticated;
revoke all on function public.wp4_admin_manage_products(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.wp4_admin_manage_orders(uuid,text,jsonb) from public, anon, authenticated;

grant execute on function public.wp4_order_application_fee(int) to service_role;
grant execute on function public.wp4_create_order(jsonb,text,text,text,boolean,boolean,boolean,text) to service_role;
grant execute on function public.wp4_restore_order_stock(uuid) to service_role;
grant execute on function public.wp4_prepare_order_checkout(uuid) to service_role;
grant execute on function public.wp4_attach_order_checkout(uuid,text,text) to service_role;
grant execute on function public.wp4_process_order_completed(uuid,text,text) to service_role;
grant execute on function public.wp4_process_order_failed(uuid) to service_role;
grant execute on function public.wp4_expire_pending_orders() to service_role;
grant execute on function public.wp4_prepare_cancel_order(uuid,uuid,text) to service_role;
grant execute on function public.wp4_finalize_cancel_order(uuid,boolean) to service_role;
grant execute on function public.wp4_admin_prepare_cancel_order(uuid,uuid) to service_role;
grant execute on function public.wp4_get_account_orders(uuid) to service_role;
grant execute on function public.wp4_admin_manage_products(uuid,text,jsonb) to service_role;
grant execute on function public.wp4_admin_manage_orders(uuid,text,jsonb) to service_role;
