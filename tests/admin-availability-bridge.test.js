import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260925010000_admin_availability_api_bridge_phase2b.sql", import.meta.url),
  "utf8",
);
const adminAvailability = readFileSync(
  new URL("../supabase/functions/admin-manage-availability/index.ts", import.meta.url),
  "utf8",
);
const adminReschedule = readFileSync(
  new URL("../supabase/functions/admin-reschedule-booking/index.ts", import.meta.url),
  "utf8",
);

test("Phase 2B adds multi-interval date overrides and period rule schema", () => {
  for (const table of [
    "day_override_intervals",
    "availability_period_rules",
    "availability_period_rule_weekdays",
    "availability_period_rule_intervals",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }
});

test("canonical resolver preserves priority date override > period rule > weekly", () => {
  const dateOverride = migration.indexOf("from public.day_overrides");
  const periodRule = migration.indexOf("from public.availability_period_rules");
  const weekly = migration.lastIndexOf("from public.availability_rules r");
  assert.ok(dateOverride > 0);
  assert.ok(periodRule > dateOverride);
  assert.ok(weekly > periodRule);
  assert.match(migration, /order by pr\.priority desc, pr\.created_at desc, pr\.id desc/);
});

test("admin availability bridge exposes booking_open and canonical slots without slot math", () => {
  assert.match(migration, /p_action = 'get_booking_open'/);
  assert.match(migration, /p_action = 'set_booking_open'/);
  assert.match(migration, /p_action = 'get_slots'/);
  assert.match(migration, /return public\.rwcutzz_available_slots/);
  assert.match(adminAvailability, /wp3_admin_manage_availability/);
});

test("admin bridge exposes period CRUD and override intervals", () => {
  for (const action of [
    "list_period_rules",
    "create_period_rule",
    "update_period_rule",
    "upsert_period_rule",
    "set_period_rule_enabled",
    "delete_period_rule",
    "set_override",
  ]) {
    assert.match(migration, new RegExp(action));
  }
  assert.match(migration, /jsonb_array_elements\(v_intervals\)/);
});

test("admin reschedule reuses wp2 RPC and separates notification outcome", () => {
  assert.match(adminReschedule, /requireAdmin/);
  assert.match(adminReschedule, /wp2_reschedule_booking/);
  assert.doesNotMatch(adminReschedule, /rwcutzz_interval_is_available/);
  assert.match(adminReschedule, /notification/);
  assert.match(adminReschedule, /failed/);
  assert.match(migration, /or public\.wp3_is_admin_user\(p_auth_user_id\)/);
});
