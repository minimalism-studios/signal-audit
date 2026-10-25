"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const bcrypt = require("bcryptjs");

const ROOT = path.resolve(__dirname, "..");

async function getFreePort() {
  const server = net.createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();

  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });

  return port;
}

function createEnvironment(runtimeRoot, port, overrides = {}) {
  const env = { ...process.env };

  for (const key of [
    "SLACK_OAUTH_ENABLED",
    "SLACK_CLIENT_ID",
    "SLACK_CLIENT_SECRET",
    "SLACK_OAUTH_REDIRECT_URI",
    "SLACK_OAUTH_ENCRYPTION_KEY",
    "SLACK_OAUTH_SCOPES",
    "SLACK_WORKSPACE_AUTHORIZATION_ENABLED",
    "SLACK_BOT_TOKEN",
    "RAILWAY_VOLUME_MOUNT_PATH",
  ]) {
    delete env[key];
  }

  return {
    ...env,
    NODE_ENV: "test",
    PORT: String(port),
    SESSION_SECRET: "isolated-startup-test-session-secret",
    OPENAI_API_KEY: "sk-test-startup-only",
    RAILWAY_VOLUME_MOUNT_PATH: runtimeRoot,
    ...overrides,
  };
}
test("authenticated Minimalism administrator can read Slack installation status", async () => {
  const username = "oauth-regression-admin";
  const password = "isolated-oauth-regression-password";
  const passwordHash = await bcrypt.hash(password, 10);

  await withIsolatedApp(
    {
      ...validOAuthConfig,
      AUTH_USERNAME: username,
      AUTH_PASSWORD_HASH: passwordHash,
    },
    async ({ child, port }) => {
      await waitForHealth(child, port);

      const baseUrl = `http://127.0.0.1:${port}`;
      const headers = {
        Host: "app.signal-audit.com",
      };

      const unauthenticatedResponse = await fetch(
        `${baseUrl}/api/integrations/slack/installation`,
        { headers },
      );

      assert.equal(unauthenticatedResponse.status, 401);

      const loginResponse = await fetch(
        `${baseUrl}/auth/login`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        },
      );

      assert.equal(loginResponse.status, 200);

      const cookie = loginResponse.headers
        .get("set-cookie")
        ?.split(";")[0];

      assert.ok(cookie, "Authenticated session cookie is required.");

      const installationResponse = await fetch(
        `${baseUrl}/api/integrations/slack/installation`,
        {
          headers: {
            ...headers,
            Cookie: cookie,
          },
        },
      );

      assert.equal(installationResponse.status, 200);

      const result = await installationResponse.json();

      assert.deepEqual(result, {
        count: 0,
        installations: [],
      });
    },
  );
});
function launchApp(runtimeRoot, port, overrides = {}) {
  const child = spawn(
    process.execPath,
    ["app.js"],
    {
      cwd: ROOT,
      env: createEnvironment(runtimeRoot, port, overrides),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    output += chunk;
  });

  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  return {
    child,
    getOutput: () => output,
  };
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForExit(child, timeoutMs = 5000) {
  if (hasExited(child)) {
    return child.exitCode;
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("error", onError);
    };

    const onExit = (code) => {
      cleanup();
      resolve(code);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Application did not exit in time."));
    }, timeoutMs);

    child.once("exit", onExit);
    child.once("error", onError);

    // Close the race between the initial check and listener registration.
    if (hasExited(child)) {
      cleanup();
      resolve(child.exitCode);
    }
  });
}

async function waitForHealth(child, port, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Application exited before becoming healthy.");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/health`,
        { signal: AbortSignal.timeout(500) },
      );

      if (response.status === 200) {
        return;
      }
    } catch {
      // Startup may still be in progress.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Application did not become healthy in time.");
}

async function stopApp(child) {
  if (hasExited(child)) {
    return;
  }

  const waitForTermination = (timeoutMs) =>
    new Promise((resolve) => {
      if (hasExited(child)) {
        resolve(true);
        return;
      }

      let settled = false;

      const cleanup = () => {
        clearTimeout(timer);
        child.off("exit", onExit);
        child.off("error", onError);
      };

      const finish = (exited) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(exited);
      };

      const onExit = () => finish(true);
      const onError = () => finish(true);

      const timer = setTimeout(() => finish(hasExited(child)), timeoutMs);

      child.once("exit", onExit);
      child.once("error", onError);

      if (hasExited(child)) {
        finish(true);
      }
    });

  child.kill("SIGTERM");

  if (await waitForTermination(2000)) {
    return;
  }

  child.kill("SIGKILL");

  if (!(await waitForTermination(2000))) {
    throw new Error("Could not terminate the application test process.");
  }
}

async function withIsolatedApp(overrides, callback) {
  const runtimeRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "signal-audit-startup-"),
  );

  const port = await getFreePort();
  const app = launchApp(runtimeRoot, port, overrides);

  try {
    await callback({
      ...app,
      port,
      runtimeRoot,
    });
  } finally {
    await stopApp(app.child);
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
}

const validOAuthConfig = {
  SLACK_OAUTH_ENABLED: "true",
  SLACK_CLIENT_ID: "test-client-id",
  SLACK_CLIENT_SECRET: "test-client-secret",
  SLACK_OAUTH_REDIRECT_URI:
    "https://app.signal-audit.com/api/integrations/slack/oauth/callback",
  SLACK_OAUTH_ENCRYPTION_KEY:
    Buffer.alloc(32, 7).toString("base64"),
  SLACK_OAUTH_SCOPES: "chat:write",
};

test("application starts without OAuth configuration when OAuth is disabled", async () => {
  await withIsolatedApp({}, async ({ child, port }) => {
    await waitForHealth(child, port);
  });
});

test("OAuth startup fails when required configuration is missing", async () => {
  await withIsolatedApp(
    { SLACK_OAUTH_ENABLED: "true" },
    async ({ child, getOutput }) => {
      const code = await waitForExit(child);

      assert.notEqual(code, 0);
      assert.match(
        getOutput(),
        /Slack OAuth configuration is incomplete/,
      );
      assert.doesNotMatch(
        getOutput(),
        /test-client-secret|sk-test-startup-only/,
      );
    },
  );
});

test("OAuth startup rejects an invalid encryption key", async () => {
  await withIsolatedApp(
    {
      ...validOAuthConfig,
      SLACK_OAUTH_ENCRYPTION_KEY: "invalid-key",
    },
    async ({ child, getOutput }) => {
      const code = await waitForExit(child);

      assert.notEqual(code, 0);
      assert.match(
        getOutput(),
        /SLACK_OAUTH_ENCRYPTION_KEY must be canonical Base64/,
      );
      assert.doesNotMatch(
        getOutput(),
        /test-client-secret|sk-test-startup-only/,
      );
    },
  );
});

test("OAuth starts with valid configuration and tenant-scoped storage", async () => {
  await withIsolatedApp(
    validOAuthConfig,
    async ({ child, port, runtimeRoot }) => {
      await waitForHealth(child, port);

      const slackRoot = path.join(
        runtimeRoot,
        "tenants",
        "minimalism",
        "integrations",
        "slack",
      );

      assert.ok(
        fs.statSync(path.join(slackRoot, "installations")).isDirectory(),
      );

      assert.ok(
        fs.statSync(path.join(slackRoot, "oauth-state")).isDirectory(),
      );
    },
  );
});
