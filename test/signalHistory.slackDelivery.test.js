"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createSignalHistory } = require("../services/signalHistory");

const CHANNEL = "C123456";
const TIMESTAMP = "1720000000.000100";

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function signal(id, overrides = {}) {
  return {
    id,
    connectionId: "connection-1",
    receivedAt: daysAgo(5),
    operationalState: "active",
    delivery: {
      status: "delivered",
      destination: "slack",
      channelId: CHANNEL,
      timestamp: TIMESTAMP,
    },
    ...overrides,
  };
}

function withHistory(records, callback) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "signal-history-slack-"),
  );

  try {
    const filePath = path.join(directory, "signal-history.json");
    fs.writeFileSync(filePath, JSON.stringify(records));

    const history = createSignalHistory({
      filePath,
      retentionDays: 30,
    });

    callback(history);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function lookup(history) {
  return history.findBySlackDelivery({
    channelId: CHANNEL,
    timestamp: TIMESTAMP,
  });
}

test("finds exactly one delivered Slack signal", () => {
  withHistory([signal("sig_1")], (history) => {
    const result = lookup(history);
    assert.equal(result.status, "found");
    assert.equal(result.signal.id, "sig_1");
  });
});

test("rejects channel and timestamp mismatches", () => {
  withHistory([signal("sig_1")], (history) => {
    assert.equal(
      history.findBySlackDelivery({
        channelId: "COTHER",
        timestamp: TIMESTAMP,
      }).status,
      "not_found",
    );

    assert.equal(
      history.findBySlackDelivery({
        channelId: CHANNEL,
        timestamp: "1720000000.999999",
      }).status,
      "not_found",
    );
  });
});

test("ignores unsuccessful and non-Slack deliveries", () => {
  withHistory([
    signal("sig_failed", {
      delivery: {
        status: "failed",
        destination: "slack",
        channelId: CHANNEL,
        timestamp: TIMESTAMP,
      },
    }),
    signal("sig_other", {
      delivery: {
        status: "delivered",
        destination: "other",
        channelId: CHANNEL,
        timestamp: TIMESTAMP,
      },
    }),
  ], (history) => {
    assert.deepEqual(lookup(history), {
      status: "not_found",
      signal: null,
    });
  });
});

test("rejects ambiguous delivery matches", () => {
  withHistory([
    signal("sig_1"),
    signal("sig_2"),
  ], (history) => {
    assert.deepEqual(lookup(history), {
      status: "ambiguous",
      signal: null,
    });
  });
});

test("does not retrieve expired resolved signals", () => {
  withHistory([
    signal("sig_expired", {
      operationalState: "resolved",
      resolvedAt: daysAgo(31),
    }),
  ], (history) => {
    assert.equal(lookup(history).status, "not_found");
  });
});

test("does not retrieve purged signals", () => {
  withHistory([signal("sig_deleted")], (history) => {
    history.purgeConnection("connection-1");
    assert.equal(lookup(history).status, "not_found");
  });
});

test("rejects invalid lookup identifiers", () => {
  withHistory([], (history) => {
    assert.throws(
      () => history.findBySlackDelivery({
        channelId: "",
        timestamp: TIMESTAMP,
      }),
      TypeError,
    );

    assert.throws(
      () => history.findBySlackDelivery({
        channelId: CHANNEL,
        timestamp: "",
      }),
      TypeError,
    );
  });
});
