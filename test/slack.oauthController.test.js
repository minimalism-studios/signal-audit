"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSlackOAuthController,
} = require("../integrations/slack/oauthController");

function fixture() {
  const attempts = [];

  const controller = createSlackOAuthController({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.signal-audit.com/api/integrations/slack/oauth/callback",
    scopes: ["chat:write", "channels:read"],
    stateRegistry: {
      create: (attempt) => attempts.push(attempt),
      consume: () => {},
    },
    workspaceRegistry: {
      claimWorkspace: () => {},
    },
    installationStore: {
      saveInstallation: () => {},
    },
    fetchImpl: async () => {
      throw new Error("Network access must not occur during initiation.");
    },
  });

  return { controller, attempts };
}

const context = {
  tenantId: "minimalism",
  userId: "admin-test",
  sessionId: "session-test",
};


test("rejects untrusted Slack OAuth redirect URIs", () => {
  const { createSlackOAuthController } =
    require("../integrations/slack/oauthController");

  const invalidUris = [
    "http://app.signal-audit.com/api/integrations/slack/oauth/callback",
    "https://evil.example/api/integrations/slack/oauth/callback",
    "https://app.signal-audit.com/unexpected",
    "https://app.signal-audit.com/api/integrations/slack/oauth/callback?next=evil",
    "https://app.signal-audit.com/api/integrations/slack/oauth/callback#fragment",
    "not-a-url",
  ];

  for (const redirectUri of invalidUris) {
    assert.throws(
      () => createSlackOAuthController({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri,
        scopes: ["chat:write"],
        stateRegistry: { create() {}, consume() {} },
        workspaceRegistry: { claimWorkspace() {} },
        installationStore: { saveInstallation() {} },
      }),
      /redirect URI/i,
      `Expected rejection of ${redirectUri}`,
    );
  }
});

test("creates a Slack authorization URL with registered state", () => {
  const { controller, attempts } = fixture();

  const url = new URL(
    controller.createAuthorizationAttempt(context),
  );

  assert.equal(url.origin, "https://slack.com");
  assert.equal(url.pathname, "/oauth/v2/authorize");
  assert.equal(url.searchParams.get("client_id"), "test-client-id");
  assert.equal(url.searchParams.get("scope"), "chat:write,channels:read");

  const state = url.searchParams.get("state");

  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].state, state);
  assert.equal(attempts[0].tenantId, "minimalism");
  assert.equal(attempts[0].userId, "admin-test");
  assert.equal(attempts[0].sessionId, "session-test");
});

test("rejects OAuth initiation for the OASSE tenant", () => {
  const { controller, attempts } = fixture();

  assert.throws(
    () => controller.createAuthorizationAttempt({
      ...context,
      tenantId: "oasse",
    }),
    /unavailable for this tenant/i,
  );

  assert.equal(attempts.length, 0);
});

test("rejects missing authenticated user or session identity", () => {
  const { controller, attempts } = fixture();

  for (const invalid of [
    { ...context, userId: "" },
    { ...context, sessionId: "" },
    { ...context, userId: null },
    { ...context, sessionId: null },
  ]) {
    assert.throws(
      () => controller.createAuthorizationAttempt(invalid),
      /invalid.*session context/i,
    );
  }

  assert.equal(attempts.length, 0);
});

test("generates distinct OAuth states for separate attempts", () => {
  const { controller, attempts } = fixture();

  controller.createAuthorizationAttempt(context);
  controller.createAuthorizationAttempt(context);

  assert.equal(attempts.length, 2);
  assert.notEqual(attempts[0].state, attempts[1].state);
});

test("completes OAuth installation after verifying Slack identity", async () => {
  const calls = [];
  const claims = [];
  const installations = [];
  const consumedStates = [];

  const controller = createSlackOAuthController({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.signal-audit.com/api/integrations/slack/oauth/callback",
    scopes: ["chat:write", "channels:read"],
    stateRegistry: {
      create() {},
      consume(context) {
        consumedStates.push(context);
      },
    },
    workspaceRegistry: {
      claimWorkspace(context) {
        claims.push(context);
      },
    },
    installationStore: {
      saveInstallation(installation) {
        installations.push(installation);
      },
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });

      if (url.endsWith("/oauth.v2.access")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              access_token: "xoxb-test-secret-token",
              token_type: "bot",
              team: { id: "T12345" },
              bot_user_id: "U12345",
              scope: "chat:write,channels:read",
            };
          },
        };
      }

      if (url.endsWith("/auth.test")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              team_id: "T12345",
              user_id: "U12345",
            };
          },
        };
      }

      throw new Error("Unexpected Slack endpoint");
    },
  });

  const result = await controller.completeAuthorizationAttempt({
    state: "test-state",
    code: "test-authorization-code",
    tenantId: "minimalism",
    userId: "admin-test",
    sessionId: "session-test",
  });

  assert.equal(consumedStates.length, 1);
  assert.equal(consumedStates[0].state, "test-state");
  assert.equal(calls.length, 2);
  assert.equal(claims.length, 1);
  assert.deepEqual(claims[0], {
    workspaceId: "T12345",
    tenantId: "minimalism",
  });

  assert.equal(installations.length, 1);
  assert.equal(installations[0].botToken, "xoxb-test-secret-token");
  assert.equal(installations[0].workspaceId, "T12345");

  assert.equal(result.workspaceId, "T12345");
  assert.equal(result.botUserId, "U12345");
  assert.equal(result.botToken, undefined);
  assert.equal(
    JSON.stringify(result).includes("xoxb-test-secret-token"),
    false,
  );

  const tokenRequest = calls[0];
  assert.equal(tokenRequest.options.method, "POST");

  const body = new URLSearchParams(tokenRequest.options.body);
  assert.equal(body.get("client_id"), "test-client-id");
  assert.equal(body.get("client_secret"), "test-client-secret");
  assert.equal(body.get("code"), "test-authorization-code");

  assert.equal(
    calls[1].options.headers.Authorization,
    "Bearer xoxb-test-secret-token",
  );
});

test("rejects a failed Slack token exchange without installing", async () => {
  const calls = [];
  const claims = [];
  const installations = [];
  const consumedStates = [];

  const controller = createSlackOAuthController({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.signal-audit.com/api/integrations/slack/oauth/callback",
    scopes: ["chat:write"],
    stateRegistry: {
      create() {},
      consume(context) {
        consumedStates.push(context);
      },
    },
    workspaceRegistry: {
      claimWorkspace(context) {
        claims.push(context);
      },
    },
    installationStore: {
      saveInstallation(context) {
        installations.push(context);
      },
    },
    fetchImpl: async (url) => {
      calls.push(url);

      return {
        ok: true,
        async json() {
          return {
            ok: false,
            error: "invalid_code",
          };
        },
      };
    },
  });

  await assert.rejects(
    controller.completeAuthorizationAttempt({
      state: "test-state",
      code: "invalid-code",
      tenantId: "minimalism",
      userId: "admin-test",
      sessionId: "session-test",
    }),
    /invalid slack oauth token response/i,
  );

  assert.equal(consumedStates.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(claims.length, 0);
  assert.equal(installations.length, 0);
});

test("rejects mismatched Slack workspace identity without installing", async () => {
  const claims = [];
  const installations = [];
  const calls = [];

  const controller = createSlackOAuthController({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.signal-audit.com/api/integrations/slack/oauth/callback",
    scopes: ["chat:write"],
    stateRegistry: {
      create() {},
      consume() {},
    },
    workspaceRegistry: {
      claimWorkspace(context) {
        claims.push(context);
      },
    },
    installationStore: {
      saveInstallation(context) {
        installations.push(context);
      },
    },
    fetchImpl: async (url) => {
      calls.push(url);

      if (url.endsWith("/oauth.v2.access")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              access_token: "xoxb-test-secret-token",
              token_type: "bot",
              team: { id: "T12345" },
              bot_user_id: "U12345",
              scope: "chat:write",
            };
          },
        };
      }

      if (url.endsWith("/auth.test")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              team_id: "TDIFFERENT",
              user_id: "U12345",
            };
          },
        };
      }

      throw new Error("Unexpected Slack endpoint");
    },
  });

  await assert.rejects(
    controller.completeAuthorizationAttempt({
      state: "test-state",
      code: "test-code",
      tenantId: "minimalism",
      userId: "admin-test",
      sessionId: "session-test",
    }),
    /slack workspace identity mismatch/i,
  );

  assert.equal(calls.length, 2);
  assert.equal(claims.length, 0);
  assert.equal(installations.length, 0);
});

test("rejects insufficient Slack OAuth scopes without installing", async () => {
  const claims = [];
  const installations = [];
  const calls = [];

  const controller = createSlackOAuthController({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.signal-audit.com/api/integrations/slack/oauth/callback",
    scopes: ["chat:write", "channels:read"],
    stateRegistry: {
      create() {},
      consume() {},
    },
    workspaceRegistry: {
      claimWorkspace(context) {
        claims.push(context);
      },
    },
    installationStore: {
      saveInstallation(context) {
        installations.push(context);
      },
    },
    fetchImpl: async (url) => {
      calls.push(url);

      if (url.endsWith("/oauth.v2.access")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              access_token: "xoxb-test-secret-token",
              token_type: "bot",
              team: { id: "T12345" },
              bot_user_id: "U12345",
              scope: "chat:write",
            };
          },
        };
      }

      if (url.endsWith("/auth.test")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              team_id: "T12345",
              user_id: "U12345",
            };
          },
        };
      }

      throw new Error("Unexpected Slack endpoint");
    },
  });

  await assert.rejects(
    controller.completeAuthorizationAttempt({
      state: "test-state",
      code: "test-code",
      tenantId: "minimalism",
      userId: "admin-test",
      sessionId: "session-test",
    }),
    /required scopes were not granted/i,
  );

  assert.equal(calls.length, 2);
  assert.equal(claims.length, 0);
  assert.equal(installations.length, 0);
});

test("rejects replayed OAuth state before contacting Slack", async () => {
  const consumed = new Set();
  let networkCalls = 0;
  let installationCalls = 0;

  const controller = createSlackOAuthController({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.signal-audit.com/api/integrations/slack/oauth/callback",
    scopes: ["chat:write"],
    stateRegistry: {
      create() {},
      consume({ state }) {
        if (consumed.has(state)) {
          throw new Error("OAuth state already consumed.");
        }
        consumed.add(state);
      },
    },
    workspaceRegistry: {
      claimWorkspace() {},
    },
    installationStore: {
      saveInstallation() {
        installationCalls++;
      },
    },
    fetchImpl: async (url) => {
      networkCalls++;

      if (url.endsWith("/oauth.v2.access")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              access_token: "xoxb-test-token",
              token_type: "bot",
              team: { id: "T12345" },
              bot_user_id: "U12345",
              scope: "chat:write",
            };
          },
        };
      }

      if (url.endsWith("/auth.test")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              team_id: "T12345",
              user_id: "U12345",
            };
          },
        };
      }

      throw new Error("Unexpected Slack endpoint");
    },
  });

  const attempt = {
    state: "single-use-state",
    code: "test-code",
    tenantId: "minimalism",
    userId: "admin-test",
    sessionId: "session-test",
  };

  await controller.completeAuthorizationAttempt(attempt);

  assert.equal(networkCalls, 2);
  assert.equal(installationCalls, 1);

  await assert.rejects(
    controller.completeAuthorizationAttempt(attempt),
    /already consumed/i,
  );

  assert.equal(networkCalls, 2);
  assert.equal(installationCalls, 1);
});

test("retains workspace ownership after persistence failure and permits same-tenant retry", async () => {
  const owners = new Map();
  const installations = [];
  const consumedStates = new Set();
  let failNextSave = true;

  const controller = createSlackOAuthController({
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.signal-audit.com/api/integrations/slack/oauth/callback",
    scopes: ["chat:write"],
    stateRegistry: {
      create() {},
      consume({ state }) {
        if (consumedStates.has(state)) {
          throw new Error("OAuth state already consumed.");
        }
        consumedStates.add(state);
      },
    },
    workspaceRegistry: {
      claimWorkspace({ workspaceId, tenantId }) {
        const owner = owners.get(workspaceId);
        if (owner && owner !== tenantId) {
          throw new Error("WORKSPACE_ALREADY_OWNED");
        }
        owners.set(workspaceId, tenantId);
      },
    },
    installationStore: {
      saveInstallation(installation) {
        if (failNextSave) {
          failNextSave = false;
          throw new Error("Simulated credential persistence failure");
        }
        installations.push(installation);
      },
    },
    fetchImpl: async (url) => {
      if (url.endsWith("/oauth.v2.access")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              access_token: "xoxb-test-retry-token",
              token_type: "bot",
              team: { id: "T-RETRY" },
              bot_user_id: "U-RETRY",
              scope: "chat:write",
            };
          },
        };
      }

      if (url.endsWith("/auth.test")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              team_id: "T-RETRY",
              user_id: "U-RETRY",
            };
          },
        };
      }

      throw new Error("Unexpected Slack endpoint");
    },
  });

  const attempt = (state) => controller.completeAuthorizationAttempt({
    ...context,
    state,
    code: `code-${state}`,
  });

  await assert.rejects(
    attempt("first-attempt"),
    /Simulated credential persistence failure/,
  );

  assert.equal(owners.get("T-RETRY"), "minimalism");
  assert.equal(installations.length, 0);

  assert.equal(owners.get("T-RETRY"), "minimalism");

  const claimWorkspace = ({ workspaceId, tenantId }) => {
    const owner = owners.get(workspaceId);
    if (owner && owner !== tenantId) {
      throw new Error("WORKSPACE_ALREADY_OWNED");
    }
    owners.set(workspaceId, tenantId);
  };

  assert.throws(
    () => claimWorkspace({
      workspaceId: "T-RETRY",
      tenantId: "oasse",
    }),
    /WORKSPACE_ALREADY_OWNED/,
  );

  assert.equal(owners.get("T-RETRY"), "minimalism");

  const result = await attempt("fresh-second-attempt");

  assert.equal(result.workspaceId, "T-RETRY");
  assert.equal(installations.length, 1);
  assert.equal(installations[0].tenantId, "minimalism");
  assert.equal(owners.get("T-RETRY"), "minimalism");
  assert.equal(result.botToken, undefined);
  assert.equal(consumedStates.size, 2);
});
