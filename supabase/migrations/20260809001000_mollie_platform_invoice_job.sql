-- Keep the existing monthly invoice job compatible with payment-mode separation.

create or replace function public.wp3_create_platform_invoice_previous_month()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', now() - interval '1 month')::date;
  v_end date := date_trunc('month', now())::date;
  v_deposits integer;
  v_fee integer;
  v_vat integer;
  v_total integer;
  v_id uuid;
begin
  select
    coalesce(sum(amount_cents), 0)::integer,
    coalesce(sum(platform_fee_ex_vat), 0)::integer
  into v_deposits, v_fee
  from public.payments
  where status = 'paid'
    and payment_provider = 'mollie'
    and payment_mode = 'live'
    and paid_at >= v_start
    and paid_at < v_end;

  v_vat := round(v_fee * 0.21)::integer;
  v_total := v_fee + v_vat;

  insert into public.platform_invoices(
    period_start,
    period_end,
    payment_mode,
    total_fee_cents,
    total_deposits_ex_vat,
    platform_fee_ex_vat,
    vat_amount,
    total_inc_vat,
    status
  ) values (
    v_start,
    v_end,
    'live',
    v_fee,
    v_deposits,
    v_fee,
    v_vat,
    v_total,
    'open'
  )
  on conflict(period_start, period_end, payment_mode) do update
  set total_fee_cents = excluded.total_fee_cents,
      total_deposits_ex_vat = excluded.total_deposits_ex_vat,
      platform_fee_ex_vat = excluded.platform_fee_ex_vat,
      vat_amount = excluded.vat_amount,
      total_inc_vat = excluded.total_inc_vat
  returning id into v_id;

  return jsonb_build_object(
    'status', 200,
    'id', v_id,
    'period_start', v_start,
    'period_end', v_end,
    'payment_mode', 'live',
    'total_fee_cents', v_fee,
    'total_deposits_ex_vat', v_deposits,
    'platform_fee_ex_vat', v_fee,
    'vat_amount', v_vat,
    'total_inc_vat', v_total
  );
end;
$$;

revoke all on function public.wp3_create_platform_invoice_previous_month() from public, anon, authenticated;
grant execute on function public.wp3_create_platform_invoice_previous_month() to service_role;

notify pgrst, 'reload schema';
