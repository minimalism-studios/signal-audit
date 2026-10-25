"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const { createSlackEventsRouter } = require("../integrations/slack/eventsRouter");

const signingSecret = "test-slack-signing-secret";

function sign(body, timestamp) {
  return `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;
}

async function fixture(t, handleEvent = () => ({ accepted: true })) {
  const app = express();

  app.use(
    "/api/integrations/slack/events",
    createSlackEventsRouter({
      signingSecret,
      eventsHandler: { handleEvent },
    }),
  );

  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  t.after(() => new Promise((resolve) => server.close(resolve)));

  return `http://127.0.0.1:${server.address().port}/api/integrations/slack/events`;
}

async function post(url, payload, options = {}) {
  const body = typeof payload === "string"
    ? payload
    : JSON.stringify(payload);

  const timestamp = options.timestamp
    ?? String(Math.floor(Date.now() / 1000));

  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": options.signature ?? sign(body, timestamp),
    },
    body,
  });
}

test("accepts a signed Slack URL verification challenge", async (t) => {
  const url = await fixture(t);

  const response = await post(url, {
    type: "url_verification",
    challenge: "challenge-123",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    challenge: "challenge-123",
  });
});

test("rejects invalid signatures", async (t) => {
  const url = await fixture(t);

  const response = await post(
    url,
    { type: "url_verification", challenge: "test" },
    { signature: "v0=" + "0".repeat(64) },
  );

  assert.equal(response.status, 401);
});

test("rejects stale request timestamps", async (t) => {
  const url = await fixture(t);

  const response = await post(
    url,
    { type: "url_verification", challenge: "test" },
    { timestamp: String(Math.floor(Date.now() / 1000) - 600) },
  );

  assert.equal(response.status, 401);
});

test("rejects malformed signed JSON", async (t) => {
  const url = await fixture(t);
  const response = await post(url, "{invalid-json");

  assert.equal(response.status, 400);
});

test("acknowledges accepted events", async (t) => {
  let calls = 0;

  const url = await fixture(t, () => {
    calls++;
    return { accepted: true, stored: true };
  });

  const response = await post(url, {
    type: "event_callback",
    team_id: "T123",
    event_id: "Ev123",
    event: { type: "message" },
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 1);
});

test("rejects unauthorized workspaces", async (t) => {
  const url = await fixture(t, () => ({
    accepted: false,
    reason: "unauthorized_workspace",
  }));

  const response = await post(url, {
    type: "event_callback",
    team_id: "UNKNOWN",
    event_id: "Ev123",
  });

  assert.equal(response.status, 403);
});

test("acknowledges duplicate events", async (t) => {
  const url = await fixture(t, () => ({
    accepted: true,
    duplicate: true,
  }));

  const response = await post(url, {
    type: "event_callback",
    team_id: "T123",
    event_id: "Ev123",
  });

  assert.equal(response.status, 200);
});

test("returns retryable failure when storage fails", async (t) => {
  const originalError = console.error;
  console.error = () => {};

  t.after(() => {
    console.error = originalError;
  });

  const url = await fixture(t, () => {
    throw new Error("Storage unavailable");
  });

  const response = await post(url, {
    type: "event_callback",
    team_id: "T123",
    event_id: "Ev123",
  });

  assert.equal(response.status, 503);
});
