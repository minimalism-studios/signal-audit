"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSlackEventsHandler } = require("../integrations/slack/eventsHandler");

function fixture({
  ownership = { workspaceId: "T123", tenantId: "minimalism" },
  installation = {
    workspaceId: "T123",
    tenantId: "minimalism",
    status: "active",
    botUserId: "UBOT",
  },
} = {}) {
  const received = [];

  const handler = createSlackEventsHandler({
    workspaceRegistry: {
      getWorkspace: () => ownership,
    },
    installationStore: {
      getInstallationMetadata: () => installation,
    },
    eventInbox: {
      receive: (record) => {
        received.push(record);
        return { duplicate: false };
      },
    },
  });

  return { handler, received };
}

function payload(eventOverrides = {}) {
  return {
    type: "event_callback",
    team_id: "T123",
    event_id: "Ev123",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D123",
      user: "U123",
      text: "Investigate this alert",
      ts: "1720000000.000001",
      ...eventOverrides,
    },
  };
}

test("stores an authorized direct message", () => {
  const { handler, received } = fixture();
  const result = handler.handleEvent(payload());

  assert.equal(result.accepted, true);
  assert.equal(result.stored, true);
  assert.equal(received.length, 1);
  assert.equal(received[0].tenantId, "minimalism");
  assert.equal(received[0].event.text, "Investigate this alert");
});

test("rejects unknown workspaces", () => {
  const { handler, received } = fixture({ ownership: null });

  assert.equal(handler.handleEvent(payload()).accepted, false);
  assert.equal(received.length, 0);
});

test("rejects inactive installations", () => {
  const { handler, received } = fixture({
    installation: {
      workspaceId: "T123",
      tenantId: "minimalism",
      status: "revoked",
    },
  });

  assert.equal(handler.handleEvent(payload()).accepted, false);
  assert.equal(received.length, 0);
});

test("rejects mismatched tenant ownership", () => {
  const { handler, received } = fixture({
    installation: {
      workspaceId: "T123",
      tenantId: "another-tenant",
      status: "active",
    },
  });

  assert.equal(handler.handleEvent(payload()).accepted, false);
  assert.equal(received.length, 0);
});

test("ignores bot-generated messages", () => {
  const { handler, received } = fixture();

  assert.equal(
    handler.handleEvent(payload({ bot_id: "B123" })).ignored,
    true,
  );
  assert.equal(
    handler.handleEvent(payload({ user: "UBOT" })).ignored,
    true,
  );
  assert.equal(received.length, 0);
});

test("ignores message subtypes", () => {
  const { handler, received } = fixture();

  assert.equal(
    handler.handleEvent(payload({ subtype: "message_changed" })).ignored,
    true,
  );
  assert.equal(received.length, 0);
});

test("ignores messages outside direct messages", () => {
  const { handler, received } = fixture();

  assert.equal(
    handler.handleEvent(payload({ channel_type: "channel" })).ignored,
    true,
  );
  assert.equal(received.length, 0);
});

test("rejects malformed event envelopes", () => {
  const { handler, received } = fixture();

  assert.equal(handler.handleEvent(null).accepted, false);
  assert.equal(handler.handleEvent({}).accepted, false);
  assert.equal(
    handler.handleEvent({ ...payload(), event_id: "" }).accepted,
    false,
  );
  assert.equal(received.length, 0);
});

test("passes thread timestamps into the inbox", () => {
  const { handler, received } = fixture();

  handler.handleEvent(payload({
    thread_ts: "1720000000.000000",
  }));

  assert.equal(
    received[0].event.threadTs,
    "1720000000.000000",
  );
});
