"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSlackChannelVerifier } = require("../integrations/slack/channelVerifier");

const REQUEST = {
  workspaceId: "T123",
  tenantId: "minimalism",
  channelId: "C123",
};

function fixture({
  auth = { ok: true, team_id: "T123" },
  channel = {
    ok: true,
    channel: {
      id: "C123",
      context_team_id: "T123",
      is_shared: false,
      is_ext_shared: false,
    },
  },
  credentials = { botToken: "xoxb-test-token" },
  credentialError = false,
  httpFailure = null,
  networkError = false,
} = {}) {
  const calls = [];
  let credentialReads = 0;

  const verifier = createSlackChannelVerifier({
    installationStore: {
      getInstallationCredentials: () => {
        credentialReads += 1;
        if (credentialError) {
          throw new Error("Active installation not found.");
        }
        return credentials;
      },
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });

      if (networkError) {
        throw new Error("Network unavailable");
      }

      const isAuth = url.endsWith("/auth.test");

      return {
        ok: httpFailure !== (isAuth ? "auth" : "channel"),
        json: async () => isAuth ? auth : channel,
      };
    },
  });

  return {
    verifier,
    calls,
    getCredentialReads: () => credentialReads,
  };
}

test("verifies a channel in the expected workspace", async () => {
  const { verifier, calls } = fixture();

  assert.equal(await verifier.verifyChannel(REQUEST), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://slack.com/api/auth.test");
  assert.equal(calls[1].url, "https://slack.com/api/conversations.info");
  assert.equal(calls[1].options.body, "channel=C123");
});

test("rejects tokens belonging to another workspace", async () => {
  const { verifier, calls } = fixture({
    auth: { ok: true, team_id: "TOTHER" },
  });

  assert.equal(await verifier.verifyChannel(REQUEST), false);
  assert.equal(calls.length, 1);
});

test("rejects channels belonging to another workspace", async () => {
  const { verifier } = fixture({
    channel: {
      ok: true,
      channel: {
        id: "C123",
        context_team_id: "TOTHER",
        is_shared: false,
        is_ext_shared: false,
      },
    },
  });

  assert.equal(await verifier.verifyChannel(REQUEST), false);
});

test("rejects shared and externally shared channels", async () => {
  for (const property of ["is_shared", "is_ext_shared"]) {
    const { verifier } = fixture({
      channel: {
        ok: true,
        channel: {
          id: "C123",
          context_team_id: "T123",
          is_shared: false,
          is_ext_shared: false,
          [property]: true,
        },
      },
    });

    assert.equal(await verifier.verifyChannel(REQUEST), false);
  }
});

test("rejects inactive installations", async () => {
  const { verifier, calls } = fixture({ credentialError: true });

  assert.equal(await verifier.verifyChannel(REQUEST), false);
  assert.equal(calls.length, 0);
});

test("rejects missing bot credentials", async () => {
  const { verifier, calls } = fixture({ credentials: {} });

  assert.equal(await verifier.verifyChannel(REQUEST), false);
  assert.equal(calls.length, 0);
});

test("rejects invalid tenant and channel identifiers", async () => {
  const { verifier, getCredentialReads } = fixture();

  assert.equal(
    await verifier.verifyChannel({ ...REQUEST, tenantId: "oasse" }),
    false,
  );
  assert.equal(
    await verifier.verifyChannel({ ...REQUEST, channelId: "" }),
    false,
  );
  assert.equal(getCredentialReads(), 0);
});

test("fails closed on Slack API and network errors", async () => {
  for (const configuration of [
    { httpFailure: "auth" },
    { httpFailure: "channel" },
    { networkError: true },
    { auth: { ok: false } },
    { channel: { ok: false } },
  ]) {
    const { verifier } = fixture(configuration);
    assert.equal(await verifier.verifyChannel(REQUEST), false);
  }
});
