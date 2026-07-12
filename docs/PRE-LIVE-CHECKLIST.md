# BarberFlow pre-live checklist

## Open punten

- Supabase CLI installeren.
- `supabase test db` draaien voor WP0 t/m WP6.
- Stripe test mode met iDEAL-testbank handmatig doorlopen.
- Resend test credentials en webhook forwarding handmatig controleren.
- Meta Cloud API live test uitvoeren zodra business verification en templates actief zijn.
- Vite/esbuild advisory bewust laten staan tot geplande Vite 8 upgrade.

## Edge Functions

- `account-data`
- `admin-client-data`
- `admin-dashboard-data`
- `admin-manage-availability`
- `admin-manage-orders`
- `admin-manage-products`
- `admin-manage-reviews`
- `admin-manage-services`
- `admin-manual-booking`
- `admin-stats`
- `admin-update-booking-status`
- `cancel-booking`
- `cancel-order`
- `create-booking-hold`
- `create-checkout`
- `create-order`
- `create-order-checkout`
- `delete-account`
- `expire-pending-bookings`
- `expire-pending-orders`
- `get-booking-summary`
- `get-products`
- `get-public-reviews`
- `get-slots`
- `meta-webhook`
- `reschedule-booking`
- `send-broadcast`
- `send-due-emails`
- `send-email`
- `send-platform-invoice`
- `send-whatsapp`
- `stripe-webhook`
- `submit-review`
- `unsubscribe`
- `update-customer-phone`
- `update-notification-prefs`

## Migration files

- `20260710000000_wp0_schema_auth_security.sql`
- `20260710010000_wp1_booking_flow.sql`
- `20260710020000_wp2_account_cancel_email_reminders.sql`
- `20260710030000_wp3_admin_dashboard.sql`
- `20260710040000_wp4_webshop.sql`
- `20260711050000_wp5_reviews_pwa.sql`
- `20260711060000_wp6_whatsapp.sql`

## pg_cron jobs

- `wp1-supersede-expired-pending-bookings`: every 5 minutes.
- `wp2-booking-reminder-48h`: hourly.
- `wp2-booking-reminder-3h`: hourly.
- `wp2-review-request`: hourly.
- `wp3-platform-invoice-monthly`: first day of month, 08:00.
- `wp4-expire-pending-orders`: every 5 minutes.

## Env vars

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECTED_ACCOUNT_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_UNSUBSCRIBE_SECRET`
- `SUPABASE_FUNCTIONS_URL`
- `INTERNAL_FUNCTION_SECRET`
- `ADMIN_EMAIL`
- `BARBER_OPENING_HOURS`
- `META_WA_TOKEN`
- `META_WA_PHONE_NUMBER_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_SITE_KEY`
- `PUBLIC_SITE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_APP_NAME`
- `VITE_THEME_COLOR`
