"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createEventInbox } = require("../integrations/slack/eventInbox");

function createFixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "signal-audit-slack-events-"),
  );

  t.after(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  return {
    directory,
    inbox: createEventInbox({ directory }),
  };
}

function receive(inbox, overrides = {}) {
  return inbox.receive({
    workspaceId: "T123",
    tenantId: "minimalism",
    eventId: "Ev123",
    event: {
      type: "message",
      channel: "D123",
      user: "U123",
      text: "Investigate the latest alert",
    },
    ...overrides,
  });
}

test("persists a received Slack event", (t) => {
  const { directory, inbox } = createFixture(t);
  const result = receive(inbox);

  assert.equal(result.duplicate, false);
  assert.equal(result.record.status, "RECEIVED");

  const files = fs.readdirSync(directory);
  assert.equal(files.length, 1);

  const saved = JSON.parse(
    fs.readFileSync(path.join(directory, files[0]), "utf8"),
  );

  assert.equal(saved.workspaceId, "T123");
  assert.equal(saved.tenantId, "minimalism");
  assert.equal(saved.eventId, "Ev123");
  assert.equal(saved.event.text, "Investigate the latest alert");
});

test("deduplicates repeated event IDs", (t) => {
  const { directory, inbox } = createFixture(t);

  assert.equal(receive(inbox).duplicate, false);
  assert.equal(receive(inbox).duplicate, true);
  assert.equal(fs.readdirSync(directory).length, 1);
});

test("deduplication survives inbox recreation", (t) => {
  const { directory, inbox } = createFixture(t);

  receive(inbox);

  const restartedInbox = createEventInbox({ directory });
  assert.equal(receive(restartedInbox).duplicate, true);
});

test("allows different event IDs in the same workspace", (t) => {
  const { directory, inbox } = createFixture(t);

  assert.equal(receive(inbox).duplicate, false);
  assert.equal(receive(inbox, { eventId: "Ev456" }).duplicate, false);
  assert.equal(fs.readdirSync(directory).length, 2);
});

test("separates identical event IDs across workspaces", (t) => {
  const { directory, inbox } = createFixture(t);

  assert.equal(receive(inbox).duplicate, false);
  assert.equal(receive(inbox, { workspaceId: "T456" }).duplicate, false);
  assert.equal(fs.readdirSync(directory).length, 2);
});

test("rejects invalid event records", (t) => {
  const { inbox } = createFixture(t);

  assert.throws(() => receive(inbox, { eventId: "" }));
  assert.throws(() => receive(inbox, { workspaceId: "" }));
  assert.throws(() => receive(inbox, { tenantId: "" }));
  assert.throws(() => receive(inbox, { event: null }));
});

test("rejects a corrupted existing event instead of acknowledging a duplicate", (t) => {
  const { directory, inbox } = createFixture(t);

  receive(inbox);

  const files = fs.readdirSync(directory);
  assert.equal(files.length, 1);

  const destination = path.join(directory, files[0]);

  fs.writeFileSync(destination, '{"incomplete":');

  assert.throws(
    () => receive(inbox),
    SyntaxError,
  );
});

test("rejects an existing event with mismatched ownership", (t) => {
  const { directory, inbox } = createFixture(t);

  receive(inbox);

  const files = fs.readdirSync(directory);
  const destination = path.join(directory, files[0]);

  const record = JSON.parse(fs.readFileSync(destination, "utf8"));
  record.tenantId = "another-tenant";

  fs.writeFileSync(destination, JSON.stringify(record));

  assert.throws(
    () => receive(inbox),
    /Invalid existing Slack event record/,
  );
});

test("lists persisted pending events after inbox recreation", (t) => {
  const { directory, inbox } = createFixture(t);

  receive(inbox);

  const reopened = createEventInbox({ directory });
  const pending = reopened.listPending();

  assert.equal(pending.length, 1);
  assert.equal(pending[0].status, "RECEIVED");
});

test("ignores temporary files when listing pending events", (t) => {
  const { directory, inbox } = createFixture(t);

  receive(inbox);
  fs.writeFileSync(path.join(directory, ".unfinished.tmp"), "incomplete");

  assert.equal(inbox.listPending().length, 1);
});

test("returns an empty pending list when storage is absent", (t) => {
  const { directory } = createFixture(t);

  fs.rmSync(directory, { recursive: true, force: true });

  const inbox = createEventInbox({ directory });

  assert.deepEqual(inbox.listPending(), []);
});

test("rejects invalid pending-event limits", (t) => {
  const { inbox } = createFixture(t);

  assert.throws(() => inbox.listPending({ limit: 0 }));
  assert.throws(() => inbox.listPending({ limit: 1001 }));
});
