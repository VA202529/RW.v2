-- BarberFlow WP6: WhatsApp notification helpers and customer phone updates.

create or replace function public.wp6_update_customer_phone(p_auth_user_id uuid, p_phone_e164 text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  if p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9]\d{6,14}$' then
    return jsonb_build_object('status', 422, 'code', 'INVALID_PHONE');
  end if;
  select id into v_customer_id from public.customers where auth_user_id = p_auth_user_id;
  if v_customer_id is null then return jsonb_build_object('status', 404, 'code', 'CUSTOMER_NOT_FOUND'); end if;
  update public.customers set phone_e164 = p_phone_e164 where id = v_customer_id;
  return jsonb_build_object('status', 200, 'phone_e164', p_phone_e164);
end;
$$;

create or replace function public.wp6_set_booking_reminder_channel(p_booking_id uuid, p_channel text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bookings
  set reminder_channel = p_channel
  where id = p_booking_id and p_channel in ('whatsapp','email');
$$;

create or replace function public.wp2_due_emails(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if p_kind = 'booking_reminder_48h' then
    with due as (
      update public.bookings b
      set reminder_48h_sent_at = now(),
          reminder_channel = 'email'
      where b.status = 'confirmed'
        and b.starts_at between now() + interval '47 hours' and now() + interval '49 hours'
        and b.reminder_48h_sent_at is null
      returning b.*
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'template', p_kind,
      'booking_id', d.id,
      'customer_id', c.id,
      'to', c.email,
      'customer_name', c.full_name,
      'phone_e164', c.phone_e164,
      'whatsapp_opt_in', coalesce(p.whatsapp_opt_in, false),
      'service_name', s.name,
      'starts_at', d.starts_at,
      'deposit_cents', d.deposit_cents,
      'cancel_token_hash', d.cancel_token
    )), '[]'::jsonb)
    into v_rows
    from due d
    join public.customers c on c.id = d.customer_id
    join public.services s on s.id = d.service_id
    left join public.notification_prefs p on p.customer_id = c.id;
    return v_rows;
  elsif p_kind = 'booking_reminder_3h' then
    with due as (
      update public.bookings b
      set reminder_3h_sent_at = now(),
          reminder_channel = 'email'
      from public.notification_prefs p
      where p.customer_id = b.customer_id
        and p.reminder_3h_enabled = true
        and b.status = 'confirmed'
        and b.starts_at between now() + interval '2 hours 45 minutes' and now() + interval '3 hours 15 minutes'
        and b.reminder_3h_sent_at is null
      returning b.*
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'template', p_kind,
      'booking_id', d.id,
      'customer_id', c.id,
      'to', c.email,
      'customer_name', c.full_name,
      'phone_e164', c.phone_e164,
      'whatsapp_opt_in', coalesce(p.whatsapp_opt_in, false),
      'service_name', s.name,
      'starts_at', d.starts_at,
      'deposit_cents', d.deposit_cents
    )), '[]'::jsonb)
    into v_rows
    from due d
    join public.customers c on c.id = d.customer_id
    join public.services s on s.id = d.service_id
    left join public.notification_prefs p on p.customer_id = c.id;
    return v_rows;
  elsif p_kind = 'review_request' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'template', p_kind,
      'booking_id', b.id,
      'customer_id', c.id,
      'to', c.email,
      'service_name', s.name,
      'starts_at', b.starts_at
    )), '[]'::jsonb)
    into v_rows
    from public.bookings b
    join public.customers c on c.id = b.customer_id
    join public.services s on s.id = b.service_id
    where b.status = 'completed'
      and b.updated_at between now() - interval '25 hours' and now() - interval '23 hours'
      and not exists (
        select 1 from public.message_log m
        where m.booking_id = b.id and m.template = 'review_request'
      );
    return v_rows;
  end if;
  return '[]'::jsonb;
end;
$$;

revoke all on function public.wp6_update_customer_phone(uuid, text) from public, anon, authenticated;
revoke all on function public.wp6_set_booking_reminder_channel(uuid, text) from public, anon, authenticated;
grant execute on function public.wp6_update_customer_phone(uuid, text) to service_role;
grant execute on function public.wp6_set_booking_reminder_channel(uuid, text) to service_role;
