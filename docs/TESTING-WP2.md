# BarberFlow WP2 test report

## Automated tests

Run:

```bash
supabase test db
```

WP2 adds `supabase/tests/database/wp2_acceptance.sql`, covering:

- cancel >24h with credit: booking cancelled, credit created, payment marked refunded
- cancel >24h with refund: booking cancelled, no credit
- cancel <24h: booking cancelled, no refund/credit
- reschedule >24h: old booking cancelled, replacement confirmed
- reschedule to taken slot: `409`, old booking unchanged
- account anonymization and review body scrubbing
- 48h reminder selector window
- raw cancel token accepted while only its SHA-256 hash is stored
- invalid cancel token rejected
- unsubscribe RPC clears marketing opt-in without login

## Manual tests

These require Supabase local/hosted functions, Resend, Stripe test mode, and a connected Stripe Standard account.

1. Book and pay a normal appointment with iDEAL test mode.
2. Confirm `stripe-webhook` sends `booking_confirmation`.
3. Confirm guest customers without `auth_user_id` also receive `magic_link`.
4. Use `/account` to request a Supabase magic link and log in.
5. Verify upcoming appointments, past appointments, visit count, credit balance, order placeholder, notification toggles, and delete-account confirmation.
6. Cancel >24h with `credit`; confirm Stripe refund is created with `refund_application_fee=true`, credit exists, and `booking_cancelled` is sent.
7. Cancel >24h with `refund`; confirm no credit exists and `booking_cancelled` mentions refund.
8. Cancel <24h; confirm no Stripe refund and no credit.
9. Reschedule >24h; confirm old booking is `cancelled`, new booking is `confirmed`, deposit transfers, and `booking_rescheduled` is sent.
10. Visit `/annuleer?booking=[id]&token=[raw_token]` from the confirmation email and cancel without login.
11. Visit `/uitschrijven?token=[signed_token]` and confirm `marketing_email_opt_in=false`.
12. Invoke `send-due-emails` internally for `booking_reminder_48h`, `booking_reminder_3h`, and `review_request`.

## Environment variables added

```bash
RESEND_FROM_EMAIL=
RESEND_UNSUBSCRIBE_SECRET=
SUPABASE_FUNCTIONS_URL=
INTERNAL_FUNCTION_SECRET=
```

Existing WP1 variables still apply, including `RESEND_API_KEY`, Stripe, Supabase, Turnstile and public Vite variables.

## Notes and deviations

- `send-email` is protected by `INTERNAL_FUNCTION_SECRET`. Supabase Edge Functions are technically routable, so this is the internal access boundary.
- Raw cancel tokens are only available at creation time and in Stripe Checkout metadata for the confirmation email. The database stores only the SHA-256 hash.
- Cron jobs use `current_setting('app.settings.supabase_functions_url', true)` and `current_setting('app.settings.internal_function_secret', true)` for `pg_net`; configure these settings in the deployed database environment before relying on cron delivery.
- Review route UI is intentionally not built because WP2 explicitly excludes reviews beyond the request email/link.
