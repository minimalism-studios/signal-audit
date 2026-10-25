"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { verifySlackRequest } = require("../integrations/slack/requestVerifier");

const signingSecret = "test-signing-secret";
const now = 1_800_000_000_000;
const timestamp = String(now / 1000);
const rawBody = Buffer.from(
  JSON.stringify({ type: "event_callback", event_id: "Ev123" }),
);

function sign(body = rawBody, time = timestamp) {
  return `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(Buffer.concat([
      Buffer.from(`v0:${time}:`),
      body,
    ]))
    .digest("hex")}`;
}

test("accepts a valid signed Slack request", () => {
  assert.equal(verifySlackRequest({
    rawBody,
    timestamp,
    signature: sign(),
    signingSecret,
    now,
  }), true);
});

test("rejects a modified request body", () => {
  assert.equal(verifySlackRequest({
    rawBody: Buffer.from('{"type":"modified"}'),
    timestamp,
    signature: sign(),
    signingSecret,
    now,
  }), false);
});

test("rejects an invalid signature", () => {
  assert.equal(verifySlackRequest({
    rawBody,
    timestamp,
    signature: `v0=${"0".repeat(64)}`,
    signingSecret,
    now,
  }), false);
});

test("rejects expired timestamps", () => {
  const oldTimestamp = String(Number(timestamp) - 301);

  assert.equal(verifySlackRequest({
    rawBody,
    timestamp: oldTimestamp,
    signature: sign(rawBody, oldTimestamp),
    signingSecret,
    now,
  }), false);
});

test("rejects future timestamps outside the freshness window", () => {
  const futureTimestamp = String(Number(timestamp) + 301);

  assert.equal(verifySlackRequest({
    rawBody,
    timestamp: futureTimestamp,
    signature: sign(rawBody, futureTimestamp),
    signingSecret,
    now,
  }), false);
});

test("rejects malformed or missing authentication fields", () => {
  for (const overrides of [
    { rawBody: "not-a-buffer" },
    { timestamp: "invalid" },
    { signature: "invalid" },
    { signingSecret: "" },
  ]) {
    assert.equal(verifySlackRequest({
      rawBody,
      timestamp,
      signature: sign(),
      signingSecret,
      now,
      ...overrides,
    }), false);
  }
});
