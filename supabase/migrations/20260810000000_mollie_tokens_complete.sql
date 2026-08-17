create table if not exists public.mollie_tokens (
  id text primary key,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  organization_id text,
  profile_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mollie_tokens
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists expires_at timestamptz,
  add column if not exists organization_id text,
  add column if not exists profile_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mollie_tokens_pkey'
      and conrelid = 'public.mollie_tokens'::regclass
  ) then
    alter table public.mollie_tokens add primary key (id);
  end if;
end;
$$;

create or replace function public.set_mollie_tokens_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mollie_tokens_set_updated_at on public.mollie_tokens;
create trigger mollie_tokens_set_updated_at
before update on public.mollie_tokens
for each row execute function public.set_mollie_tokens_updated_at();

alter table public.mollie_tokens enable row level security;

grant select, insert, update, delete on public.mollie_tokens to service_role;

notify pgrst, 'reload schema';
