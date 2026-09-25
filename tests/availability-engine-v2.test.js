import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260925000000_canonical_availability_engine_v2_phase1.sql", import.meta.url),
  "utf8",
);
const getSlots = readFileSync(new URL("../supabase/functions/get-slots/index.ts", import.meta.url), "utf8");

test("Phase 1 exposes a single canonical availability contract", () => {
  for (const fn of [
    "rwcutzz_resolve_working_intervals",
    "rwcutzz_interval_is_available",
    "rwcutzz_available_slots",
    "rwcutzz_booking_blocks_capacity",
    "rwcutzz_capacity_status_map",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${fn}\\b`));
  }

  assert.match(getSlots, /rwcutzz_available_slots/);
  assert.doesNotMatch(getSlots, /\.from\("availability_rules"\)/);
  assert.doesNotMatch(getSlots, /\.from\("blocked_slots"\)/);
  assert.doesNotMatch(getSlots, /\.from\("bookings"\)/);
});

test("capacity mapping keeps only confirmed and valid pending holds blocking", () => {
  assert.match(migration, /when p_status = 'confirmed' then true/);
  assert.match(migration, /when p_status = 'pending_payment' then p_expires_at is not null and p_expires_at > now\(\)/);

  for (const status of ["completed", "cancelled", "no_show", "superseded", "refunded_conflict"]) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
});

test("booking mutations use transaction-level locking and canonical revalidation", () => {
  assert.match(migration, /pg_advisory_xact_lock/);

  for (const fn of ["wp1_create_booking_hold", "wp3_admin_manual_booking", "wp2_reschedule_booking"]) {
    const start = migration.indexOf(`create or replace function public.${fn}`);
    assert.notEqual(start, -1, `${fn} should be redefined`);
    const next = migration.indexOf("create or replace function public.", start + 1);
    const body = migration.slice(start, next === -1 ? migration.length : next);
    assert.match(body, /rwcutzz_lock_booking_domain/);
    assert.match(body, /rwcutzz_interval_is_available/);
  }
});

test("availability checks interval overlaps, blocks, buffers and Europe/Amsterdam timezone", () => {
  assert.match(migration, /Europe\/Amsterdam/);
  assert.match(migration, /p_starts_at < b\.ends_at\s+and v_effective_ends_at > b\.starts_at/);
  assert.match(migration, /b\.ends_at \+ make_interval\(mins => coalesce\(s\.buffer_minutes, 0\)\)/);
  assert.match(migration, /v_effective_ends_at := v_ends_at \+ make_interval\(mins => v_service\.buffer_minutes\)/);
  assert.match(migration, /v_effective_ends_at <= w\.ends_at/);
});

test("booking_open is a public gate and does not erase underlying availability", () => {
  assert.match(migration, /if p_public and v_booking_open is false then/);
  assert.match(migration, /'booking_open', false, 'slots', '\[\]'::jsonb/);
  assert.match(migration, /p_public boolean default true/);
});

test("reschedule exclusion stays on the canonical RPC path", () => {
  assert.match(migration, /v_allowed := \(p_auth_user_id is not null and v_customer\.auth_user_id = p_auth_user_id\)/);
  assert.match(migration, /public\.rwcutzz_interval_is_available\(v_booking\.service_id, p_new_starts_at, v_booking\.id\)/);
  assert.match(getSlots, /exclude_booking_id: excludeBookingId/);
  assert.match(getSlots, /p_exclude_booking_id: excludeBookingId \?\? null/);
  assert.equal((getSlots.match(/p_exclude_booking_id:/g) ?? []).length, 1);
});
