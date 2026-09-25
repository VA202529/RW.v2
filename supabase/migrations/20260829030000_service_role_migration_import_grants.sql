-- Allow the guarded production migration importer to write real imported data.
-- Intentionally do not grant DELETE privileges; bookings remain protected.
grant usage on schema public to service_role;

grant select, insert, update on public.services to service_role;
grant select, insert, update on public.customers to service_role;
grant select, insert, update on public.bookings to service_role;
grant select, insert, update on public.reviews to service_role;
grant select, insert, update on public.migration_import_records to service_role;
