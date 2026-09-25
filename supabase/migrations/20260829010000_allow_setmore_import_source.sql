-- Allow historical Setmore appointments to remain auditably distinct from
-- runtime online/manual bookings.

alter table public.bookings
  drop constraint if exists bookings_source_check;

alter table public.bookings
  add constraint bookings_source_check
  check (source in ('online','manual','setmore_import'));

notify pgrst, 'reload schema';
