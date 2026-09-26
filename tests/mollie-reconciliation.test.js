import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("Mollie webhook and reconciliation share canonical finalization", () => {
  const webhook = read("supabase/functions/mollie-webhook/index.ts");
  const reconcile = read("supabase/functions/mollie-reconcile/index.ts");
  const finalize = read("supabase/functions/_shared/mollie-finalize.ts");

  assert.match(webhook, /processMolliePaymentById/);
  assert.match(reconcile, /processMolliePaymentById/);
  assert.match(finalize, /wp_mollie_process_payment/);
  assert.match(finalize, /sendConfirmationIfNeeded/);
  assert.match(finalize, /booking_confirmation/);
});

test("Mollie reconciliation is bounded, delayed, and server-triggered", () => {
  const migration = read("supabase/migrations/20260926010000_mollie_reconciliation_fallback.sql");
  const reconcile = read("supabase/functions/mollie-reconcile/index.ts");

  assert.match(migration, /p_min_age interval default interval '15 minutes'/);
  assert.match(migration, /limit least\(greatest\(p_limit, 1\), 25\)/);
  assert.match(migration, /p\.status = 'pending'/);
  assert.match(migration, /coalesce\(p\.provider_status, 'open'\) in \('open', 'pending', 'authorized'\)/);
  assert.match(migration, /cron\.schedule\(\s*'mollie-reconciliation-fallback',\s*'\*\/15 \* \* \* \*'/);
  assert.match(reconcile, /requireInternal\(req\)/);
});

test("Mollie reconciliation continues after one candidate fails", () => {
  const reconcile = read("supabase/functions/mollie-reconcile/index.ts");

  assert.match(reconcile, /for \(const candidate of candidates \?\? \[\]\)/);
  assert.match(reconcile, /catch \(error\) \{\s*results\.errors \+= 1;/s);
  assert.match(reconcile, /\[mollie-reconcile\] payment failed/);
});
