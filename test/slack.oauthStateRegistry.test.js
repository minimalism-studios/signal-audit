"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  createOAuthStateRegistry,
} = require("../integrations/slack/oauthStateRegistry");

const TEST_KEY = Buffer.alloc(32, 0x42);

function fixture(t, now = () => Date.now()) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "slack-oauth-state-"),
  );

  t.after(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  return {
    directory,
    registry: createOAuthStateRegistry({
      directory,
      encryptionKey: TEST_KEY,
      now,
    }),
  };
}

const context = {
  tenantId: "minimalism",
  userId: "admin-123",
  sessionId: "session-456",
};

function attempt(expiresAt = Date.now() + 300000) {
  return {
    state: crypto.randomBytes(32).toString("base64url"),
    ...context,
    expiresAt,
  };
}

test("persists state across registry instances", (t) => {
  const { directory, registry } = fixture(t);
  const entry = attempt();

  registry.create(entry);

  const second = createOAuthStateRegistry({
    directory,
    encryptionKey: TEST_KEY,
  });

  assert.deepEqual(
    second.consume(entry),
    context,
  );
});

test("rejects duplicate consumption across registry instances", (t) => {
  const { directory, registry } = fixture(t);
  const entry = attempt();

  registry.create(entry);

  const second = createOAuthStateRegistry({
    directory,
    encryptionKey: TEST_KEY,
  });

  assert.deepEqual(registry.consume(entry), context);

  assert.throws(
    () => second.consume(entry),
    /already been consumed/i,
  );
});

test("rejects expired state", (t) => {
  let clock = 1000;

  const { registry } = fixture(t, () => clock);
  const entry = attempt(2000);

  registry.create(entry);
  clock = 2000;

  assert.throws(
    () => registry.consume(entry),
    /invalid or expired/i,
  );
});

for (const field of ["tenantId", "userId", "sessionId"]) {
  test(`rejects mismatched ${field}`, (t) => {
    const { registry } = fixture(t);
    const entry = attempt();

    registry.create(entry);

    assert.throws(
      () => registry.consume({
        ...entry,
        [field]: "incorrect",
      }),
      /invalid or expired/i,
    );
  });
}

test("rejects an unknown state", (t) => {
  const { registry } = fixture(t);

  assert.throws(
    () => registry.consume(attempt()),
    /invalid or expired/i,
  );
});

test("rejects duplicate state registration", (t) => {
  const { registry } = fixture(t);
  const entry = attempt();

  registry.create(entry);

  assert.throws(
    () => registry.create(entry),
    (error) => error.code === "EEXIST",
  );
});

test("does not store raw OAuth state in the filename or record", (t) => {
  const { directory, registry } = fixture(t);
  const entry = attempt();

  const hash = registry.create(entry);
  const recordPath = path.join(directory, `${hash}.json`);
  const contents = fs.readFileSync(recordPath, "utf8");

  assert.equal(
    hash,
    crypto.createHash("sha256").update(entry.state).digest("hex"),
  );
  assert.equal(contents.includes(entry.state), false);
  assert.equal(fs.statSync(recordPath).mode & 0o777, 0o600);
});

test("rejects tampered tenant ownership", (t) => {
  const { directory, registry } = fixture(t);
  const entry = attempt();
  const hash = registry.create(entry);
  const filePath = path.join(directory, `${hash}.json`);

  const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
  record.tenantId = "another-tenant";
  fs.writeFileSync(filePath, JSON.stringify(record));

  assert.throws(
    () => registry.consume({
      ...entry,
      tenantId: "another-tenant",
    }),
    /integrity/i,
  );
});

test("rejects tampered expiration", (t) => {
  const { directory, registry } = fixture(t);
  const entry = attempt();
  const hash = registry.create(entry);
  const filePath = path.join(directory, `${hash}.json`);

  const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
  record.expiresAt += 3600000;
  fs.writeFileSync(filePath, JSON.stringify(record));

  assert.throws(
    () => registry.consume(entry),
    /integrity/i,
  );
});

test("rejects an incorrect integrity key", (t) => {
  const { directory, registry } = fixture(t);
  const entry = attempt();

  registry.create(entry);

  const incorrectKeyRegistry = createOAuthStateRegistry({
    directory,
    encryptionKey: Buffer.alloc(32, 0x43),
  });

  assert.throws(
    () => incorrectKeyRegistry.consume(entry),
    /integrity/i,
  );
});

test("rejects a modified integrity tag", (t) => {
  const { directory, registry } = fixture(t);
  const entry = attempt();
  const hash = registry.create(entry);
  const filePath = path.join(directory, `${hash}.json`);

  const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
  record.integrity = "0".repeat(64);
  fs.writeFileSync(filePath, JSON.stringify(record));

  assert.throws(
    () => registry.consume(entry),
    /integrity/i,
  );
});

test("cleanup removes expired OAuth records", (t) => {
  let clock = 1000;
  const { directory, registry } = fixture(t, () => clock);

  const entry = attempt(2000);
  const hash = registry.create(entry);

  clock = 2000;

  assert.deepEqual(
    registry.cleanupExpired(),
    { examined: 1, removed: 1 },
  );

  assert.equal(
    fs.existsSync(path.join(directory, `${hash}.json`)),
    false,
  );
});

test("cleanup preserves active OAuth records", (t) => {
  const { directory, registry } = fixture(t);
  const entry = attempt();
  const hash = registry.create(entry);

  assert.deepEqual(
    registry.cleanupExpired(),
    { examined: 1, removed: 0 },
  );

  assert.equal(
    fs.existsSync(path.join(directory, `${hash}.json`)),
    true,
  );
});

test("cleanup removes expired consumed states", (t) => {
  let clock = 1000;
  const { directory, registry } = fixture(t, () => clock);

  const entry = attempt(2000);
  const hash = registry.create(entry);

  registry.consume(entry);

  const marker = path.join(directory, `${hash}.consumed`);

  assert.equal(fs.existsSync(marker), true);

  clock = 2000;

  assert.deepEqual(
    registry.cleanupExpired(),
    { examined: 1, removed: 1 },
  );

  assert.equal(fs.existsSync(marker), false);
});

test("cleanup preserves tampered records", (t) => {
  let clock = 1000;
  const { directory, registry } = fixture(t, () => clock);

  const entry = attempt(2000);
  const hash = registry.create(entry);
  const filePath = path.join(directory, `${hash}.json`);

  const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
  record.expiresAt = 1500;
  fs.writeFileSync(filePath, JSON.stringify(record));

  clock = 3000;

  assert.deepEqual(
    registry.cleanupExpired(),
    { examined: 1, removed: 0 },
  );

  assert.equal(fs.existsSync(filePath), true);
});

test("cleanup respects its record limit", (t) => {
  let clock = 1000;
  const { registry } = fixture(t, () => clock);

  registry.create(attempt(2000));
  registry.create(attempt(2000));
  registry.create(attempt(2000));

  clock = 3000;

  assert.deepEqual(
    registry.cleanupExpired({ limit: 2 }),
    { examined: 2, removed: 2 },
  );
});

test("rejects malformed OAuth state values", (t) => {
  const { registry } = fixture(t);

  const invalidStates = [
    "",
    "short",
    "a".repeat(43),
    "a".repeat(44),
    "a".repeat(10000),
    "invalid+base64/state",
    null,
    undefined,
    12345,
  ];

  for (const state of invalidStates) {
    assert.throws(
      () => registry.create({ ...attempt(), state }),
      /Invalid Slack OAuth state/,
    );

    assert.throws(
      () => registry.consume({ ...attempt(), state }),
      /Invalid Slack OAuth state/,
    );
  }
});
