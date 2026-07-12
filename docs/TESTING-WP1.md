# BarberFlow WP1 test report

## Automated tests

Run database tests:

```bash
supabase test db
```

WP1 adds `supabase/tests/database/wp1_acceptance.sql`, covering:

- same-slot hold conflict shape: first hold succeeds, second returns `409`
- stale pending hold superseded before a new hold is inserted
- rate limit: fourth concurrent pending hold for the same email/IP returns `429`
- partial credit reduces Checkout amount
- full credit confirms the booking without Stripe
- webhook replay idempotency through `webhook_events`
- payment failure supersedes pending bookings
- payment-after-expiry with slot free recovers the booking to `confirmed`

## Manual Stripe test script

These checks require Stripe test mode, a connected Standard account, and iDEAL test-bank interaction. They cannot be fully proven by pgTAP alone.

Required environment:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECTED_ACCOUNT_ID=
TURNSTILE_SECRET_KEY=
TURNSTILE_SITE_KEY=
PUBLIC_SITE_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TURNSTILE_SITE_KEY=
```

1. Start Supabase locally and serve Edge Functions.
2. Run the frontend with `npm run dev`.
3. In Stripe CLI, forward connected-account Checkout events to `stripe-webhook`.
4. Create a booking hold in the UI and start iDEAL Checkout.
5. Complete payment before the 15-minute hold expires.
6. Verify booking is `confirmed`, payment is `paid`, and one `booking_confirmed` email intent is queued in `message_log`.

### Acceptance 3: payment after expiry, slot free

1. Create a hold and Checkout Session.
2. In the database, set that booking `status='superseded'` or let the hold expire while no new booking claims the slot.
3. Complete the iDEAL test-bank payment.
4. Verify the webhook recovers the booking to `confirmed` and does not refund.

### Acceptance 4: payment after expiry, slot retaken

1. Create hold A and its Checkout Session.
2. Expire/supersede hold A.
3. Create and confirm hold B on the same `starts_at`.
4. Complete hold A's iDEAL test-bank payment.
5. Verify Stripe creates a refund on the connected account with `refund_application_fee=true`.
6. Verify hold A is `refunded_conflict`, its payment is `refunded`, and apology/admin alert rows are queued in `message_log`.

### Turnstile

Call `create-booking-hold` with an invalid or missing token and confirm it returns `403` and creates no booking row.

### DST slot checks

Call `get-slots` for date ranges including the Europe/Amsterdam DST transition days:

- March transition day
- October transition day

Verify returned `local_time` values match configured wall-clock opening rules and do not drift by one hour.

## Stripe documentation consulted

- Direct charges: https://docs.stripe.com/connect/direct-charges
- Checkout Session create: https://docs.stripe.com/api/checkout/sessions/create
- Checkout Session expire: https://docs.stripe.com/api/checkout/sessions/expire
- Webhook signatures: https://docs.stripe.com/webhooks/signature
- Refunds: https://docs.stripe.com/api/refunds/create

Implementation notes from current docs:

- Direct charges are made by scoping requests to the connected account with the Stripe account option/header.
- Checkout Sessions can set `payment_intent_data.application_fee_amount`.
- `expires_at` on Checkout Sessions must be at least 30 minutes after creation.
- Direct-charge refunds must be issued on the connected account and explicitly set `refund_application_fee=true` to refund the platform fee.
- Webhook signature verification must use the raw request body.

## Deviations

- The 15-minute application hold remains in Postgres. Stripe Checkout Sessions are created with a 30-minute expiry because Stripe requires that minimum.
- Email sending is intentionally not implemented in WP1. The code queues `message_log` rows with status `queued` for WP2.
