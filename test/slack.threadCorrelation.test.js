"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSlackThreadCorrelation } = require("../integrations/slack/threadCorrelation");

const REQUEST = {
  workspaceId: "T123",
  channelId: "C123",
  parentMessageTs: "1720000000.000100",
};

function fixture({
  ownership = { workspaceId: "T123", tenantId: "minimalism" },
  installation = {
    workspaceId: "T123",
    tenantId: "minimalism",
    status: "active",
  },
  channelAuthorized = true,
  lookupResult = {
    status: "found",
    signal: {
      id: "sig_1",
      source: "datadog",
      service: "payments-api",
      severity: "high",
      state: "DELIVERED",
      operationalState: "active",
      receivedAt: "2026-10-24T12:00:00.000Z",
      analysis: { summary: "Elevated latency detected." },
      secret: "must-not-be-exposed",
    },
  },
} = {}) {
  let lookups = 0;

  const correlation = createSlackThreadCorrelation({
    workspaceRegistry: {
      getWorkspace: () => ownership,
    },
    installationStore: {
      getInstallationMetadata: () => installation,
    },
    signalHistory: {
      findBySlackDelivery: () => {
        lookups += 1;
        return lookupResult;
      },
    },
    channelVerifier: {
      verifyChannel: async () => channelAuthorized,
    },
  });

  return {
    correlation,
    getLookups: () => lookups,
  };
}

test("returns limited evidence for an authorized workspace", async () => {
  const { correlation, getLookups } = fixture();
  const result = await correlation.resolveThread(REQUEST);

  assert.equal(result.status, "found");
  assert.equal(result.evidence.signalId, "sig_1");
  assert.equal(result.evidence.service, "payments-api");
  assert.equal(result.evidence.state, "DELIVERED");
  assert.equal(result.evidence.operationalState, "active");
  assert.equal(result.evidence.analysisSummary, "Elevated latency detected.");
  assert.equal(Object.hasOwn(result.evidence, "secret"), false);
  assert.equal(getLookups(), 1);
});

test("rejects unknown workspaces without retrieving evidence", async () => {
  const { correlation, getLookups } = fixture({ ownership: null });

  assert.deepEqual(await correlation.resolveThread(REQUEST), {
    status: "unauthorized",
    evidence: null,
  });
  assert.equal(getLookups(), 0);
});

test("rejects other tenants without retrieving evidence", async () => {
  const { correlation, getLookups } = fixture({
    ownership: { workspaceId: "T123", tenantId: "oasse" },
  });

  assert.equal((await correlation.resolveThread(REQUEST)).status, "unauthorized");
  assert.equal(getLookups(), 0);
});

test("rejects mismatched workspace ownership", async () => {
  const { correlation, getLookups } = fixture({
    ownership: { workspaceId: "TOTHER", tenantId: "minimalism" },
  });

  assert.equal((await correlation.resolveThread(REQUEST)).status, "unauthorized");
  assert.equal(getLookups(), 0);
});

test("rejects revoked installations without retrieving evidence", async () => {
  const { correlation, getLookups } = fixture({
    installation: {
      workspaceId: "T123",
      tenantId: "minimalism",
      status: "revoked",
    },
  });

  assert.equal((await correlation.resolveThread(REQUEST)).status, "unauthorized");
  assert.equal(getLookups(), 0);
});

test("rejects installation tenant mismatches", async () => {
  const { correlation, getLookups } = fixture({
    installation: {
      workspaceId: "T123",
      tenantId: "oasse",
      status: "active",
    },
  });

  assert.equal((await correlation.resolveThread(REQUEST)).status, "unauthorized");
  assert.equal(getLookups(), 0);
});

test("does not expose missing or ambiguous evidence", async () => {
  for (const status of ["not_found", "ambiguous"]) {
    const { correlation } = fixture({
      lookupResult: { status, signal: null },
    });

    assert.deepEqual(await correlation.resolveThread(REQUEST), {
      status,
      evidence: null,
    });
  }
});

test("rejects invalid requests before retrieving evidence", async () => {
  const { correlation, getLookups } = fixture();

  assert.deepEqual(await correlation.resolveThread({
    ...REQUEST,
    parentMessageTs: "",
  }), {
    status: "invalid_request",
    evidence: null,
  });

  assert.equal(getLookups(), 0);
});

test("blocks evidence retrieval when channel verification fails", async () => {
  const { correlation, getLookups } = fixture({
    channelAuthorized: false,
  });

  assert.deepEqual(await correlation.resolveThread(REQUEST), {
    status: "unauthorized",
    evidence: null,
  });

  assert.equal(getLookups(), 0);
});
