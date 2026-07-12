# BarberFlow WP3 test report

## Automated tests

Run once Supabase CLI is installed:

```bash
supabase test db
```

WP3 adds `supabase/tests/database/wp3_acceptance.sql`, covering:

- admin status update to `completed` and idempotent `review_request` logging
- `no_show` status without email/refund side effects
- blocked-slot overlap detection
- blocked customers rejected by online booking hold
- manual bookings with the same `uniq_active_slot` protection
- service deactivation without cancelling existing bookings
- broadcast recipient selection by marketing opt-in
- admin stats no-show percentage
- previous-month platform invoice total
- magic-link deduplication helper used by Stripe webhook

## Manual tests

1. Log in as a user with JWT `app_role='admin'` and open `/admin`.
2. Confirm non-admin users are redirected to `/`.
3. Use Agenda day/week toggle, open booking detail, mark completed/no-show/cancelled.
4. Create a manual booking and verify no payment row is created.
5. Add a blocked slot overlapping an active booking and verify conflict list appears.
6. Manage services, including deactivating one with upcoming bookings.
7. Search clients, edit notes on blur, and toggle blocked status.
8. Send an announcement broadcast with Resend test credentials; verify `resend.batch.send([...])` sends only opt-in customers.
9. Run `send-platform-invoice` internally and confirm the admin email is sent.

## Environment variables added

```bash
ADMIN_EMAIL=
```

Existing WP2 Resend/Supabase internal-function variables still apply.

## Notes

- Resend Batch API was checked against the official Resend docs: `resend.batch.send([...])`, up to 100 batch emails per call.
- The client-side `/admin` guard is cosmetic. Every admin Edge Function verifies admin status server-side through the `app_role='admin'` metadata.
- Webshop, reviews UI, PWA and WhatsApp remain intentionally out of scope.
