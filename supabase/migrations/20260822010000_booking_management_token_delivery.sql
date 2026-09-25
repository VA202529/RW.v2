create table if not exists public.booking_management_token_delivery (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  encrypted_token text not null,
  created_at timestamptz not null default now()
);

alter table public.booking_management_token_delivery enable row level security;

revoke all on public.booking_management_token_delivery from anon, authenticated;
grant select, insert, update, delete on public.booking_management_token_delivery to service_role;
