"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createOAuthStateManager,
} = require("../integrations/slack/oauthState");

const context = {
  tenantId: "minimalism",
  userId: "admin-123",
  sessionId: "session-456",
};

test("creates and consumes valid OAuth state", () => {
  const manager = createOAuthStateManager();
  const session = {};

  const state = manager.create({ session, ...context });

  assert.equal(typeof state, "string");
  assert.ok(state.length >= 40);

  assert.deepEqual(
    manager.consume({ session, state, ...context }),
    context,
  );
});

test("rejects OAuth state replay", () => {
  const manager = createOAuthStateManager();
  const session = {};

  const state = manager.create({ session, ...context });

  manager.consume({ session, state, ...context });

  assert.throws(
    () => manager.consume({ session, state, ...context }),
    /invalid or expired/i,
  );
});

test("rejects expired OAuth state", () => {
  let currentTime = 1000;

  const manager = createOAuthStateManager({
    ttlMs: 300000,
    now: () => currentTime,
  });

  const session = {};
  const state = manager.create({ session, ...context });

  currentTime += 300000;

  assert.throws(
    () => manager.consume({ session, state, ...context }),
    /invalid or expired/i,
  );
});

for (const field of ["tenantId", "userId", "sessionId"]) {
  test(`rejects OAuth ${field} mismatch`, () => {
    const manager = createOAuthStateManager();
    const session = {};

    const state = manager.create({ session, ...context });

    assert.throws(
      () => manager.consume({
        session,
        state,
        ...context,
        [field]: "different-value",
      }),
      /invalid or expired/i,
    );
  });
}

test("rejects incorrect OAuth state", () => {
  const manager = createOAuthStateManager();
  const session = {};

  manager.create({ session, ...context });

  assert.throws(
    () => manager.consume({
      session,
      state: "incorrect-state",
      ...context,
    }),
    /invalid or expired/i,
  );
});

test("creating a new attempt invalidates the previous attempt", () => {
  const manager = createOAuthStateManager();
  const session = {};

  const first = manager.create({ session, ...context });
  const second = manager.create({ session, ...context });

  assert.notEqual(first, second);

  assert.throws(
    () => manager.consume({
      session,
      state: first,
      ...context,
    }),
    /invalid or expired/i,
  );
});
