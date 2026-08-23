import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

function hashState(state) {
  return createHash("sha256").update(state).digest("hex");
}

class MockStateStore {
  constructor() {
    this.rows = new Map();
    this.failUpdate = false;
  }

  insert(state, expiresAt) {
    const row = { id: randomBytes(16).toString("hex"), stateHash: hashState(state), expiresAt, consumedAt: null };
    this.rows.set(row.stateHash, row);
    return row;
  }

  async consume(state, now = Date.now()) {
    const row = this.rows.get(hashState(state));
    if (!row || row.expiresAt <= now || row.consumedAt) return { status: 400, error: "invalid_request" };
    if (this.failUpdate) return { status: 500, error: "server_error" };
    if (row.consumedAt) return { status: 400, error: "invalid_request" };
    row.consumedAt = now;
    return { status: 200, consumed: true };
  }
}

test("valid state within TTL succeeds", async () => {
  const store = new MockStateStore();
  const state = "a".repeat(64);
  store.insert(state, Date.now() + 60_000);
  assert.deepEqual(await store.consume(state), { status: 200, consumed: true });
});

test("unknown state returns generic 400", async () => {
  const result = await new MockStateStore().consume("unknown");
  assert.deepEqual(result, { status: 400, error: "invalid_request" });
});

test("expired state returns generic 400", async () => {
  const store = new MockStateStore();
  const state = "b".repeat(64);
  store.insert(state, Date.now() - 1);
  assert.deepEqual(await store.consume(state), { status: 400, error: "invalid_request" });
});

test("consumed state returns generic 400", async () => {
  const store = new MockStateStore();
  const state = "c".repeat(64);
  store.insert(state, Date.now() + 60_000);
  await store.consume(state);
  assert.deepEqual(await store.consume(state), { status: 400, error: "invalid_request" });
});

test("concurrent callbacks allow exactly one consumer", async () => {
  const store = new MockStateStore();
  const state = "d".repeat(64);
  store.insert(state, Date.now() + 60_000);
  const results = await Promise.all([store.consume(state), store.consume(state)]);
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  assert.equal(results.filter((result) => result.status === 400).length, 1);
});

test("database update failure returns safe 500 and does not consume", async () => {
  const store = new MockStateStore();
  const state = "e".repeat(64);
  store.insert(state, Date.now() + 60_000);
  store.failUpdate = true;
  assert.deepEqual(await store.consume(state), { status: 500, error: "server_error" });
  store.failUpdate = false;
  assert.equal((await store.consume(state)).status, 200);
});

test("token exchange failure leaves state consumed", async () => {
  const store = new MockStateStore();
  const state = "f".repeat(64);
  store.insert(state, Date.now() + 60_000);
  assert.equal((await store.consume(state)).status, 200);
  assert.deepEqual(await store.consume(state), { status: 400, error: "invalid_request" });
});
