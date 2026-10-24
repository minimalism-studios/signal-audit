const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSlackWorkspaceAuthorizer,
} = require("../integrations/slack/authorization");

const TOKEN = "xoxb-test-secret-do-not-log";

function makeAuthorizer({
  tenantId = "minimalism",
  workspaceId = "T_MINIMALISM",
  ownerTenantId = "minimalism",
  slackOk = true,
} = {}) {
  return createSlackWorkspaceAuthorizer({
    tenantId,
    botToken: TOKEN,
    workspaceRegistry: {
      getWorkspace(id) {
        if (id !== workspaceId || !ownerTenantId) {
          return null;
        }

        return {
          workspaceId: id,
          tenantId: ownerTenantId,
        };
      },
    },
    fetchImpl: async (url) => {
      if (url.endsWith("/auth.test")) {
        return {
          ok: true,
          json: async () => ({
            ok: slackOk,
            team_id: workspaceId,
          }),
        };
      }

      if (url.endsWith("/conversations.info")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            channel: {
              id: "C_ALLOWED",
              context_team_id: workspaceId,
              is_shared: false,
              is_ext_shared: false,
            },
          }),
        };
      }

      throw new Error("Unexpected Slack API request");
    },
  });
}

test("authorized tenant owns verified Slack workspace", async () => {
  const authorizer = makeAuthorizer();

  assert.equal(
    await authorizer.authorizeDelivery({
      channelId: "C_ALLOWED",
    }),
    true,
  );
});

test("cross-tenant workspace ownership is rejected", async () => {
  const authorizer = makeAuthorizer({
    tenantId: "oasse",
    ownerTenantId: "minimalism",
  });

  assert.equal(
    await authorizer.authorizeDelivery({
      channelId: "C_ALLOWED",
    }),
    false,
  );
});

test("unregistered Slack workspace is rejected", async () => {
  const authorizer = makeAuthorizer({
    ownerTenantId: null,
  });

  assert.equal(
    await authorizer.authorizeDelivery({
      channelId: "C_ALLOWED",
    }),
    false,
  );
});

test("failed Slack identity verification is rejected", async () => {
  const authorizer = makeAuthorizer({
    slackOk: false,
  });

  assert.equal(
    await authorizer.authorizeDelivery({
      channelId: "C_ALLOWED",
    }),
    false,
  );
});

test("channel belonging to another workspace is rejected", async () => {
  const requests = [];

  const authorizer = createSlackWorkspaceAuthorizer({
    tenantId: "minimalism",
    botToken: TOKEN,
    workspaceRegistry: {
      getWorkspace(id) {
        return id === "T_MINIMALISM"
          ? { workspaceId: id, tenantId: "minimalism" }
          : null;
      },
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });

      if (url.endsWith("/auth.test")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            team_id: "T_MINIMALISM",
          }),
        };
      }

      if (url.endsWith("/conversations.info")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            channel: {
              id: "C_OTHER",
              context_team_id: "T_OTHER",
            },
          }),
        };
      }

      throw new Error("Unexpected Slack API request");
    },
  });

  assert.equal(
    await authorizer.authorizeDelivery({
      channelId: "C_OTHER",
    }),
    false,
  );

  assert.equal(
    requests.some(({ url }) =>
      url.endsWith("/conversations.info")
    ),
    true,
  );
});

for (const scenario of [
  {
    name: "Slack Connect channel",
    is_shared: true,
    is_ext_shared: true,
  },
  {
    name: "internally shared channel",
    is_shared: true,
    is_ext_shared: false,
  },
  {
    name: "missing sharing metadata",
    is_shared: undefined,
    is_ext_shared: undefined,
  },
]) {
  test(`${scenario.name} is rejected`, async () => {
    const authorizer = createSlackWorkspaceAuthorizer({
      tenantId: "minimalism",
      botToken: TOKEN,
      workspaceRegistry: {
        getWorkspace(id) {
          return {
            workspaceId: id,
            tenantId: "minimalism",
          };
        },
      },
      fetchImpl: async (url) => ({
        ok: true,
        json: async () =>
          url.endsWith("/auth.test")
            ? {
                ok: true,
                team_id: "T_MINIMALISM",
              }
            : {
                ok: true,
                channel: {
                  id: "C_ALLOWED",
                  context_team_id: "T_MINIMALISM",
                  is_shared: scenario.is_shared,
                  is_ext_shared: scenario.is_ext_shared,
                },
              },
      }),
    });

    assert.equal(
      await authorizer.authorizeDelivery({
        channelId: "C_ALLOWED",
      }),
      false,
    );
  });
}
