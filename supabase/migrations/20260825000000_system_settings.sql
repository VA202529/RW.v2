create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.system_settings(key, value)
values ('booking_open', 'true'::jsonb)
on conflict (key) do nothing;

alter table public.system_settings enable row level security;
revoke all on public.system_settings from anon, authenticated;
grant all on public.system_settings to service_role;

create or replace function public.get_booking_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((value #>> '{}')::boolean, true)
  from public.system_settings
  where key = 'booking_open';
$$;

revoke all on function public.get_booking_open() from public, anon, authenticated;
grant execute on function public.get_booking_open() to service_role;
