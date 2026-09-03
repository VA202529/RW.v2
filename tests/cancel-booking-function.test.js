import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("supabase/functions/cancel-booking/index.ts", "utf8");
const emailSource = readFileSync("supabase/functions/_shared/email.ts", "utf8");

test("cancel-booking imports an email helper that exists", () => {
  const match = source.match(/import\s+\{\s*([^}]+)\s*\}\s+from\s+"..\/_shared\/email\.ts"/);
  assert.ok(match, "expected cancel-booking to import from shared email helper");

  const imported = match[1].split(",").map((name) => name.trim());
  for (const name of imported) {
    assert.match(emailSource, new RegExp(`export\\s+async\\s+function\\s+${name}\\b`));
  }
});

test("Mollie cancellation does not depend on a Stripe payment intent", () => {
  assert.match(source, /payment\.payment_provider === "mollie"/);
  assert.match(source, /payment\.mollie_payment_id/);
  assert.doesNotMatch(source, /if\s*\([^)]*stripe_payment_intent_id[^)]*\)\s*\{/);
  assert.doesNotMatch(source, /PAYMENT_INTENT_MISSING/);
});

test("Mollie refund requests use a per-booking idempotency key", () => {
  assert.match(source, /`booking-cancel-\$\{bookingId\}`/);
});
