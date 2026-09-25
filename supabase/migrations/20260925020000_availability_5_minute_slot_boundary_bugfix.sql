-- RW CUTZZ availability bugfix: customer candidates start every 5 minutes.
-- Duration, buffers, blocks, holds and working boundaries remain enforced by
-- rwcutzz_interval_is_available.

create or replace function public.rwcutzz_slot_interval_minutes()
returns int
language sql
stable
as $$
  select 5;
$$;

revoke all on function public.rwcutzz_slot_interval_minutes() from public, anon, authenticated;
grant execute on function public.rwcutzz_slot_interval_minutes() to service_role;

notify pgrst, 'reload schema';
