import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const bookingRoute = readFileSync(
  new URL("../RW Cutzz Booking & Shop/src/routes/boeken/index.tsx", import.meta.url),
  "utf8",
);

test("storefront treats planning date keys as local business dates", () => {
  assert.match(bookingRoute, /function parseLocalDate\(value: string\)/);
  assert.match(bookingRoute, /format\(parseLocalDate\(date\), "EEEE d MMMM"/);
  assert.doesNotMatch(bookingRoute, /format\(new Date\(date\), "EEEE d MMMM"/);

  const octStart = parseBusinessDate("2026-10-01");
  const octEnd = parseBusinessDate("2026-10-31");
  assert.equal(key(octStart), "2026-10-01");
  assert.equal(key(octEnd), "2026-10-31");
  assert.notEqual(key(octStart), "2026-10-02");
  assert.notEqual(key(octEnd), "2026-11-01");
});

function parseBusinessDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function key(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
