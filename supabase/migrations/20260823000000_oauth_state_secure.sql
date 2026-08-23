create table if not exists public.oauth_pending_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz default null
);

alter table public.oauth_pending_states enable row level security;

revoke all on public.oauth_pending_states from anon, authenticated;
grant select, insert, update on public.oauth_pending_states to service_role;

create index if not exists oauth_pending_states_state_hash_idx
  on public.oauth_pending_states(state_hash);

create index if not exists oauth_pending_states_expires_at_idx
  on public.oauth_pending_states(expires_at);

create or replace function public.cleanup_expired_oauth_pending_states()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.oauth_pending_states
  where consumed_at is not null
    and expires_at < now() - interval '24 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_oauth_pending_states() from public, anon, authenticated;
grant execute on function public.cleanup_expired_oauth_pending_states() to service_role;
