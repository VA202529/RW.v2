-- Bounded Mollie reconciliation fallback for payments whose webhook may have been missed.

create or replace function public.wp_mollie_reconciliation_candidates(
  p_min_age interval default interval '15 minutes',
  p_limit int default 25
)
returns table (
  mollie_payment_id text
)
language sql
security definer
set search_path = public
as $$
  select p.mollie_payment_id
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  where p.payment_provider = 'mollie'
    and p.mollie_payment_id is not null
    and p.status = 'pending'
    and coalesce(p.provider_status, 'open') in ('open', 'pending', 'authorized')
    and b.status in ('pending_payment', 'superseded')
    and p.created_at <= now() - p_min_age
  order by p.created_at asc
  limit least(greatest(p_limit, 1), 25);
$$;

revoke all on function public.wp_mollie_reconciliation_candidates(interval, int) from public, anon, authenticated;
grant execute on function public.wp_mollie_reconciliation_candidates(interval, int) to service_role;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'mollie-reconciliation-fallback') then
    perform cron.unschedule('mollie-reconciliation-fallback');
  end if;
end;
$$;

select cron.schedule(
  'mollie-reconciliation-fallback',
  '*/15 * * * *',
  $$select net.http_post(
    url := current_setting('app.settings.supabase_functions_url', true) || '/mollie-reconcile',
    headers := jsonb_build_object('content-type','application/json','x-internal-secret', current_setting('app.settings.internal_function_secret', true)),
    body := '{}'::jsonb
  );$$
);
