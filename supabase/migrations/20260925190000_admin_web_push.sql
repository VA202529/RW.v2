create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.admin_push_subscriptions enable row level security;

revoke all on public.admin_push_subscriptions from public, anon, authenticated;
grant all on public.admin_push_subscriptions to service_role;

create index if not exists admin_push_subscriptions_admin_user_id_idx
  on public.admin_push_subscriptions(admin_user_id);

create table if not exists public.admin_push_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  template text not null,
  status text not null check (status in ('sent','failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.admin_push_log enable row level security;

revoke all on public.admin_push_log from public, anon, authenticated;
grant all on public.admin_push_log to service_role;

create unique index if not exists admin_push_log_booking_template_idx
  on public.admin_push_log(booking_id, template)
  where booking_id is not null;
