# BarberFlow WP0 security model

BarberFlow is single-tenant, but all customer-facing data is still protected with Postgres Row Level Security. Client-side role checks are never a security boundary; authorization lives in RLS policies and later Edge Functions that use the Supabase service role.

## Roles

Normal authenticated users can select their own customer-linked records only. They cannot directly insert or update bookings, orders, payments, credits, or notification preferences; those mutations are reserved for future Edge Functions.

Supabase Auth should be configured for email OTP / magic-link sign-in only. BarberFlow should not add password forms or ship password-based auth flows.

Admins are identified by the custom JWT app metadata claim:

```json
{
  "app_role": "admin"
}
```

The migration creates `public.is_admin()`, which checks:

```sql
(auth.jwt() -> 'app_metadata' ->> 'app_role') = 'admin'
```

To grant admin rights to a specific user, run this manually in a trusted environment:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('app_role', 'admin')
where id = '<USER_UUID>';
```

Do not expose the service role key to the browser.

## Public data

Anonymous users may read only:

- active services
- active products
- visible reviews

Availability internals, blocked slots, webhook events, message logs, and announcements are admin-only. Public slot availability will be exposed later through an Edge Function.

## Double-booking guarantee

The database enforces active slot uniqueness with:

```sql
create unique index uniq_active_slot on public.bookings (starts_at)
where status in ('pending_payment','confirmed');
```

This means a second booking with the same `starts_at` is rejected while an existing booking is `pending_payment` or `confirmed`. Historical or inactive lifecycle states such as `cancelled` and `superseded` do not block reuse of the slot. Booking rows are never deleted; lifecycle is status-driven.

## Auth trigger

When a Supabase Auth user is inserted, a trigger creates or links a `customers` row by case-insensitive email. This allows guest-created customer records to be claimed when the same email later signs in via magic link.

## Test command

Run the database acceptance tests with:

```bash
supabase test db
```
