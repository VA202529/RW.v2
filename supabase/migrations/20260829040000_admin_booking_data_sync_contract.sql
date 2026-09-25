-- Admin data-sync contract for post-migration production data.
-- This does not mutate bookings. It labels legacy/test-like rows so the
-- frontend can keep them out of normal operational views while preserving them.

create or replace function public.wp3_admin_dashboard_data(
  p_auth_user_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wp3_is_admin_user(p_auth_user_id) then
    return jsonb_build_object('status', 403, 'code', 'FORBIDDEN');
  end if;

  return jsonb_build_object(
    'status', 200,
    'bookings', coalesce((
      with booking_rows as (
        select
          b.id,
          b.starts_at,
          b.ends_at,
          b.status,
          b.source,
          b.deposit_cents,
          b.created_at,
          c.full_name as customer_name,
          c.email as customer_email,
          c.phone_e164,
          s.id as service_id,
          s.name as service_name,
          s.price_cents,
          exists (
            select 1
            from public.payments p
            where p.booking_id = b.id
              and p.status = 'paid'
          ) as has_paid_payment,
          (
            select count(*)::int
            from public.payments p
            where p.booking_id = b.id
          ) as payment_count
        from public.bookings b
        join public.customers c on c.id = b.customer_id
        join public.services s on s.id = b.service_id
        where b.starts_at >= p_from
          and b.starts_at < p_to
      ),
      classified as (
        select
          br.*,
          case
            when br.source = 'setmore_import' then 'REAL_PRESERVE'
            when br.source = 'manual' then 'REAL_PRESERVE'
            when br.has_paid_payment then 'REAL_PRESERVE'
            when (coalesce(br.customer_email, '') || ' ' || coalesce(br.customer_name, '')) ~*
              '(^|[^[:alnum:]])(test|demo|mock|frontend|fix|supersede|onbekend|unknown|rwerf)([^[:alnum:]]|$)|example\.com|test[-+@]'
              then 'TEST_LEGACY'
            when br.status = 'superseded' and br.has_paid_payment = false then 'TEST_LEGACY'
            else 'UNCERTAIN_PRESERVE'
          end as booking_data_classification,
          case
            when br.source = 'setmore_import' then 'setmore_import'
            when br.source = 'manual' then 'manual'
            when br.has_paid_payment then 'real_paid_online'
            when (coalesce(br.customer_email, '') || ' ' || coalesce(br.customer_name, '')) ~*
              '(^|[^[:alnum:]])(test|demo|mock|frontend|fix|supersede|onbekend|unknown|rwerf)([^[:alnum:]]|$)|example\.com|test[-+@]'
              then 'legacy_test'
            when br.status = 'superseded' and br.has_paid_payment = false then 'legacy_test'
            else 'uncertain_preserve'
          end as booking_visibility_bucket,
          case
            when br.source = 'setmore_import' then 'imported_from_verified_setmore_file'
            when br.source = 'manual' then 'created_by_admin'
            when br.has_paid_payment then 'has_paid_payment_history'
            when (coalesce(br.customer_email, '') || ' ' || coalesce(br.customer_name, '')) ~*
              '(^|[^[:alnum:]])(test|demo|mock|frontend|fix|supersede|onbekend|unknown|rwerf)([^[:alnum:]]|$)|example\.com|test[-+@]'
              then 'matches_test_or_demo_identity_pattern'
            when br.status = 'superseded' and br.has_paid_payment = false then 'superseded_without_paid_payment'
            else 'not_enough_evidence_to_hide'
          end as booking_visibility_reason
        from booking_rows br
      )
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'starts_at', starts_at,
        'ends_at', ends_at,
        'status', status,
        'source', source,
        'deposit_cents', deposit_cents,
        'customer_name', customer_name,
        'customer_email', customer_email,
        'phone_e164', phone_e164,
        'service_id', service_id,
        'service_name', service_name,
        'price_cents', price_cents,
        'has_paid_payment', has_paid_payment,
        'payment_count', payment_count,
        'booking_data_classification', booking_data_classification,
        'booking_visibility_bucket', booking_visibility_bucket,
        'booking_visibility_reason', booking_visibility_reason
      ) order by starts_at)
      from classified
    ), '[]'::jsonb),
    'blocked_slots', coalesce((
      select jsonb_agg(to_jsonb(bs) order by bs.starts_at)
      from public.blocked_slots bs
      where bs.starts_at < p_to
        and bs.ends_at > p_from
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.name)
      from public.services s
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.wp3_admin_dashboard_data(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.wp3_admin_dashboard_data(uuid, timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';
