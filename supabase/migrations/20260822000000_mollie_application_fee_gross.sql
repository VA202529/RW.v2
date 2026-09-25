-- Keep the customer payment and ex-VAT platform revenue separate from Mollie's
-- gross application fee.
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
  v_application_fee integer;
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
        application_fee_cents = 0,
        paid_at = now(),
        provider_status = 'paid'
    where id = v_payment_id;

    return v_prepared || jsonb_build_object('requires_mollie', false);
  end if;

  v_amount_due := (v_prepared->>'amount_due_cents')::integer;
  v_fee := round(v_amount_due * 0.10)::integer;
  v_application_fee := v_fee + round(v_fee * 0.21)::integer;

  update public.payments
  set payment_provider = 'mollie',
      payment_mode = p_payment_mode,
      provider_status = 'open',
      platform_fee_rate = 0.10,
      platform_fee_ex_vat = v_fee,
      application_fee_cents = v_application_fee,
      service_price_snapshot = v_service.price_cents,
      deposit_amount_snapshot = v_booking.deposit_cents,
      remaining_amount_snapshot = greatest(v_service.price_cents - v_booking.deposit_cents, 0)
  where id = v_payment_id;

  return v_prepared || jsonb_build_object(
    'requires_mollie', true,
    'payment_mode', p_payment_mode,
    'platform_fee_ex_vat', v_fee,
    'application_fee_cents', v_application_fee,
    'service_price_snapshot', v_service.price_cents,
    'deposit_amount_snapshot', v_booking.deposit_cents,
    'remaining_amount_snapshot', greatest(v_service.price_cents - v_booking.deposit_cents, 0)
  );
end;
$$;

revoke all on function public.wp_mollie_prepare_booking_checkout(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.wp_mollie_prepare_booking_checkout(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
