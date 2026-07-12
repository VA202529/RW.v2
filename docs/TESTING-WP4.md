# BarberFlow WP4 test report

## Automated tests

Run once Supabase CLI is installed:

```bash
supabase test db
```

WP4 adds `supabase/tests/database/wp4_acceptance.sql`, covering:

- last-unit stock hold conflict shape
- order expiry restores stock
- expired order late-payment conflict path
- full and partial credit checkout behavior
- cancel-order token/window/category rules
- application fee formula
- additive stock adjustment
- order webhook replay/log idempotency helper coverage

## Manual tests

1. Open `/winkel`, add products to cart, complete iDEAL test checkout.
2. Confirm `stripe-webhook` sets order `paid`, payment `paid`, sends `order_confirmation`, and sends magic link once for guests.
3. Let an order expire and confirm `expire-pending-orders` restores stock.
4. Cancel a paid order within 14 days and confirm Stripe refund with `refund_application_fee=true`.
5. In `/admin/webshop`, update stock with positive and negative deltas, mark order ready, and mark picked up.
6. Confirm `order_ready` uses `BARBER_OPENING_HOURS`.

## Environment variables added

```bash
BARBER_OPENING_HOURS=
```

## Notes

- Stock is decremented on order hold and restored on expiry/cancel/payment failure.
- Stripe sessions use direct charges on the connected account with `application_fee_amount = max(round(total * 0.03), 50)`.
