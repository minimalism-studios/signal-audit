"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSlackAgentDelivery } = require("../integrations/slack/agentDelivery");

test("rejects cross-tenant delivery before credentials or Slack access", async () => {
  let credentialReads = 0;
  let channelChecks = 0;
  let networkCalls = 0;

  const delivery = createSlackAgentDelivery({
    workspaceRegistry: {
      getWorkspace: () => ({ tenantId: "tenant-a" }),
    },
    installationStore: {
      getInstallationCredentials: () => {
        credentialReads++;
        return { botToken: "test-token" };
      },
    },
    channelVerifier: {
      verifyChannel: async () => {
        channelChecks++;
        return true;
      },
    },
    fetchImpl: async () => {
      networkCalls++;
      throw new Error("Network access must not occur.");
    },
  });

  await assert.rejects(
    delivery.postMessage({
      workspaceId: "T123",
      tenantId: "tenant-b",
      channelId: "C123",
      threadTs: "1720000001.000001",
      text: "Confidential investigation result",
    }),
    /workspace authorization denied/,
  );

  assert.equal(credentialReads, 0);
  assert.equal(channelChecks, 0);
  assert.equal(networkCalls, 0);
});

test("delivers an authorized reply using the workspace OAuth token", async () => {
  const calls = [];
  const workspaceId = "T123";
  const tenantId = "minimalism";
  const channelId = "C123";
  const threadTs = "1720000001.000001";

  const delivery = createSlackAgentDelivery({
    workspaceRegistry: {
      getWorkspace: (id) => {
        assert.equal(id, workspaceId);
        return { tenantId };
      },
    },
    installationStore: {
      getInstallationCredentials: (identity) => {
        assert.deepEqual(identity, { workspaceId, tenantId });
        calls.push("credentials");
        return { botToken: "workspace-specific-test-token" };
      },
    },
    channelVerifier: {
      verifyChannel: async (context) => {
        assert.deepEqual(context, { workspaceId, tenantId, channelId });
        calls.push("verification");
        return true;
      },
    },
    fetchImpl: async (url, options) => {
      calls.push("slack");
      assert.equal(url, "https://slack.com/api/chat.postMessage");
      assert.equal(
        options.headers.Authorization,
        "Bearer workspace-specific-test-token",
      );
      assert.deepEqual(JSON.parse(options.body), {
        channel: channelId,
        thread_ts: threadTs,
        text: "Investigation complete.",
      });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          channel: channelId,
          ts: "1720000003.000003",
        }),
      };
    },
  });

  const result = await delivery.postMessage({
    workspaceId,
    tenantId,
    channelId,
    threadTs,
    text: "Investigation complete.",
  });

  assert.equal(result.channelId, channelId);
  assert.equal(result.timestamp, "1720000003.000003");
  assert.deepEqual(calls, ["verification", "credentials", "slack"]);
});
