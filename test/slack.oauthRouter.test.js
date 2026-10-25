"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createSlackOAuthRouter } = require("../integrations/slack/oauthRouter");

async function requestAs({ tenantId, user, sessionId = "session-test" }) {
  let controllerCalls = 0;
  const app = express();

  app.use((req, res, next) => {
    req.sessionID = sessionId;
    next();
  });

  app.use("/api/integrations/slack", createSlackOAuthRouter({
    controller: {
      createAuthorizationAttempt() {
        controllerCalls++;
        return "https://" + "slack.com/oauth/v2/authorize";
      },
      async completeAuthorizationAttempt() {
        controllerCalls++;
        return { workspaceId: "T123" };
      },
    },
    installationStore: {
      listInstallations() {
        return [];
      },
    },
    requireRequestTenantId() {
      return tenantId;
    },
    getRequestAuthentication() {
      return {
        authenticationService: {
          getCurrentUser() {
            return user;
          },
        },
        authorization: {
          hasPermission(currentUser, permission) {
            return permission === "integrations:manage"
              && currentUser?.role === "administrator";
          },
        },
      };
    },
  }));

  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/integrations/slack/oauth/start`,
      {
        redirect: "manual",
        headers: {
          "Sec-Fetch-Site": "same-origin",
        },
      },
    );

    return {
      status: response.status,
      controllerCalls,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("Slack OAuth rejects unauthenticated requests", async () => {
  const result = await requestAs({
    tenantId: "minimalism",
    user: null,
  });

  assert.equal(result.status, 401);
  assert.equal(result.controllerCalls, 0);
});

test("Slack OAuth rejects non-administrators", async () => {
  const result = await requestAs({
    tenantId: "minimalism",
    user: { id: "operator-test", role: "operator" },
  });

  assert.equal(result.status, 403);
  assert.equal(result.controllerCalls, 0);
});

test("Slack OAuth rejects OASSE tenant requests", async () => {
  const result = await requestAs({
    tenantId: "oasse",
    user: { id: "admin-test", role: "administrator" },
  });

  assert.equal(result.status, 403);
  assert.equal(result.controllerCalls, 0);
});

test("Slack OAuth allows authenticated Minimalism administrators", async () => {
  const result = await requestAs({
    tenantId: "minimalism",
    user: { id: "admin-test", role: "administrator" },
  });

  assert.equal(result.status, 302);
  assert.equal(result.controllerCalls, 1);
});

test("OAuth callback uses the authenticated administrator session", async () => {
  const contexts = [];
  const app = express();

  app.use((req, res, next) => {
    req.sessionID = "original-admin-session";
    next();
  });

  app.use("/api/integrations/slack", createSlackOAuthRouter({
    controller: {
      createAuthorizationAttempt() {
        throw new Error("Unexpected authorization initiation.");
      },
      async completeAuthorizationAttempt(context) {
        contexts.push(context);
        return {
          workspaceId: "T123",
          tenantId: "minimalism",
          botUserId: "U123",
          scopes: ["chat:write"],
        };
      },
    },
    installationStore: {
      listInstallations() {
        return [];
      },
    },
    requireRequestTenantId() {
      return "minimalism";
    },
    getRequestAuthentication() {
      return {
        authenticationService: {
          getCurrentUser() {
            return {
              id: "admin-test",
              role: "administrator",
            };
          },
        },
        authorization: {
          hasPermission(user, permission) {
            return user.role === "administrator"
              && permission === "integrations:manage";
          },
        },
      };
    },
  }));

  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/integrations/slack/oauth/callback?state=test-state&code=test-code`,
      { redirect: "manual" },
    );

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "/signal-interpreter/#/integrations",
    );

    assert.deepEqual(contexts, [{
      tenantId: "minimalism",
      userId: "admin-test",
      sessionId: "original-admin-session",
      state: "test-state",
      code: "test-code",
    }]);


  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("OAuth callback rejects lost authentication before controller execution", async () => {
  let callbackCalls = 0;
  const app = express();

  app.use((req, res, next) => {
    req.sessionID = "original-admin-session";
    next();
  });

  app.use("/api/integrations/slack", createSlackOAuthRouter({
    controller: {
      createAuthorizationAttempt() {
        return "https://" + "slack.com/oauth/v2/authorize";
      },
      async completeAuthorizationAttempt() {
        callbackCalls++;
        return { workspaceId: "T123" };
      },
    },
    installationStore: {
      listInstallations() {
        return [];
      },
    },
    requireRequestTenantId() {
      return "minimalism";
    },
    getRequestAuthentication() {
      return {
        authenticationService: {
          getCurrentUser() {
            return null;
          },
        },
        authorization: {
          hasPermission() {
            return false;
          },
        },
      };
    },
  }));

  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/integrations/slack/oauth/callback?state=test-state&code=test-code`,
    );

    assert.equal(response.status, 401);
    assert.equal(callbackCalls, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("OAuth callback errors do not expose credentials", async () => {
  const app = express();

  app.use((req, res, next) => {
    req.sessionID = "admin-session";
    next();
  });

  app.use("/api/integrations/slack", createSlackOAuthRouter({
    controller: {
      createAuthorizationAttempt() {
        return "https://" + "slack.com/oauth/v2/authorize";
      },
      async completeAuthorizationAttempt() {
        throw new Error(
          "Slack rejected xoxb-sensitive-token and client-secret-value",
        );
      },
    },
    installationStore: {
      listInstallations() {
        return [];
      },
    },
    requireRequestTenantId() {
      return "minimalism";
    },
    getRequestAuthentication() {
      return {
        authenticationService: {
          getCurrentUser() {
            return {
              id: "admin-test",
              role: "administrator",
            };
          },
        },
        authorization: {
          hasPermission(user, permission) {
            return user.role === "administrator"
              && permission === "integrations:manage";
          },
        },
      };
    },
  }));

  const server = app.listen(0);

  try {
    const { port } = server.address();

    const response = await fetch(
      `http://127.0.0.1:${port}/api/integrations/slack/oauth/callback?state=test-state&code=test-code`,
    );

    const body = await response.text();

    assert.equal(response.status, 400);
    assert.equal(body.includes("xoxb-sensitive-token"), false);
    assert.equal(body.includes("client-secret-value"), false);

    assert.deepEqual(JSON.parse(body), {
      error: "Slack installation could not be completed.",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("installation metadata is accessible to Minimalism administrators", async () => {
  const app = express();
  const tenantRequests = [];

  app.use((req, res, next) => {
    req.sessionID = "admin-session";
    next();
  });

  app.use("/api/integrations/slack", createSlackOAuthRouter({
    controller: {
      createAuthorizationAttempt() {
        return "https://" + "slack.com/oauth/v2/authorize";
      },
      async completeAuthorizationAttempt() {
        throw new Error("Unexpected callback");
      },
    },
    installationStore: {
      listInstallations(context) {
        tenantRequests.push(context);
        return [{
          workspaceId: "T12345",
          tenantId: "minimalism",
          botUserId: "U12345",
          scopes: ["chat:write"],
        }];
      },
    },
    requireRequestTenantId() {
      return "minimalism";
    },
    getRequestAuthentication() {
      return {
        authenticationService: {
          getCurrentUser() {
            return {
              id: "admin-test",
              role: "administrator",
            };
          },
        },
        authorization: {
          hasPermission(user, permission) {
            return user.role === "administrator"
              && permission === "integrations:manage";
          },
        },
      };
    },
  }));

  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/integrations/slack/installation`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.count, 1);
    assert.equal(body.installations[0].workspaceId, "T12345");
    assert.deepEqual(tenantRequests, [{ tenantId: "minimalism" }]);
    assert.equal(JSON.stringify(body).includes("xoxb-"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("installation metadata rejects unauthenticated requests", async () => {
  const app = express();
  let storeCalls = 0;

  app.use((req, res, next) => {
    req.sessionID = "test-session";
    next();
  });

  app.use("/api/integrations/slack", createSlackOAuthRouter({
    controller: {
      createAuthorizationAttempt() {
        return "https://" + "slack.com/oauth/v2/authorize";
      },
      async completeAuthorizationAttempt() {
        return {};
      },
    },
    installationStore: {
      listInstallations() {
        storeCalls++;
        return [];
      },
    },
    requireRequestTenantId() {
      return "minimalism";
    },
    getRequestAuthentication() {
      return {
        authenticationService: {
          getCurrentUser() {
            return null;
          },
        },
        authorization: {
          hasPermission() {
            return false;
          },
        },
      };
    },
  }));

  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/integrations/slack/installation`,
    );

    assert.equal(response.status, 401);
    assert.equal(storeCalls, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("OAuth start rejects cross-site navigation", async () => {
  const app = express();
  let controllerCalls = 0;

  app.use((req, res, next) => {
    req.sessionID = "admin-session";
    next();
  });

  app.use("/api/integrations/slack", createSlackOAuthRouter({
    controller: {
      createAuthorizationAttempt() {
        controllerCalls++;
        return "https://slack.com/oauth/v2/authorize";
      },
      async completeAuthorizationAttempt() {
        return {};
      },
    },
    installationStore: {
      listInstallations() {
        return [];
      },
    },
    requireRequestTenantId() {
      return "minimalism";
    },
    getRequestAuthentication() {
      return {
        authenticationService: {
          getCurrentUser() {
            return {
              id: "admin-test",
              role: "administrator",
            };
          },
        },
        authorization: {
          hasPermission(user, permission) {
            return user.role === "administrator"
              && permission === "integrations:manage";
          },
        },
      };
    },
  }));

  const server = app.listen(0);

  try {
    const { port } = server.address();

    const response = await fetch(
      `http://127.0.0.1:${port}/api/integrations/slack/oauth/start`,
      {
        redirect: "manual",
        headers: {
          "Sec-Fetch-Site": "cross-site",
        },
      },
    );

    assert.equal(response.status, 403);
    assert.equal(controllerCalls, 0);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
