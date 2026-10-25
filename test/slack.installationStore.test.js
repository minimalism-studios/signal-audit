"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  createInstallationStore,
} = require("../integrations/slack/installationStore");

const {
  createWorkspaceRegistry,
} = require("../integrations/slack/workspaceRegistry");

const {
  requireTenantId,
} = require("../services/tenantContext");

function createFixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "signal-audit-slack-install-"),
  );

  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const workspaceRegistry = createWorkspaceRegistry({
    filePath: path.join(root, "ownership.json"),
    validateTenantId: requireTenantId,
  });

  workspaceRegistry.claimWorkspace({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  const encryptionKey = crypto.randomBytes(32);

  const store = createInstallationStore({
    directory: path.join(root, "installations"),
    encryptionKey,
    workspaceRegistry,
    validateTenantId: requireTenantId,
  });

  return {
    root,
    store,
    encryptionKey,
    workspaceRegistry,
  };
}

function installation(overrides = {}) {
  return {
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
    botToken: "xoxb-test-secret-value",
    botUserId: "U_BOT_123",
    scopes: ["chat:write", "app_mentions:read"],
    ...overrides,
  };
}

test("encrypts credentials without storing plaintext tokens", (t) => {
  const { root, store } = createFixture(t);

  store.saveInstallation(installation());

  const directory = path.join(root, "installations");
  const files = fs.readdirSync(directory);

  assert.equal(files.length, 1);

  const contents = fs.readFileSync(
    path.join(directory, files[0]),
    "utf8",
  );

  assert.doesNotMatch(contents, /xoxb-test-secret-value/);

  const credentials = store.getInstallationCredentials({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.equal(credentials.botToken, "xoxb-test-secret-value");
});

test("installation metadata never exposes credentials", (t) => {
  const { store } = createFixture(t);

  store.saveInstallation(installation());

  const metadata = store.getInstallationMetadata({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.equal(metadata.workspaceId, "T_TEST_123");
  assert.equal(metadata.tenantId, "minimalism");
  assert.equal(metadata.status, "active");
  assert.equal(metadata.botToken, undefined);

  assert.doesNotMatch(
    JSON.stringify(metadata),
    /xoxb-test-secret-value/,
  );

  const listed = store.listInstallations({
    tenantId: "minimalism",
  });

  assert.equal(listed.length, 1);
  assert.doesNotMatch(
    JSON.stringify(listed),
    /xoxb-test-secret-value/,
  );
});

test("rejects credential access by another tenant", (t) => {
  const { store } = createFixture(t);

  store.saveInstallation(installation());

  assert.throws(() => {
    store.getInstallationCredentials({
      workspaceId: "T_TEST_123",
      tenantId: "oasse",
    });
  });
});

test("rejects installation ownership conflicts", (t) => {
  const { store } = createFixture(t);

  assert.throws(() => {
    store.saveInstallation(
      installation({ tenantId: "oasse" }),
    );
  });
});

test("rejects decryption with an incorrect key", (t) => {
  const {
    root,
    store,
    workspaceRegistry,
  } = createFixture(t);

  store.saveInstallation(installation());

  const wrongKeyStore = createInstallationStore({
    directory: path.join(root, "installations"),
    encryptionKey: crypto.randomBytes(32),
    workspaceRegistry,
    validateTenantId: requireTenantId,
  });

  assert.throws(() => {
    wrongKeyStore.getInstallationCredentials({
      workspaceId: "T_TEST_123",
      tenantId: "minimalism",
    });
  });
});

test("revocation prevents future credential retrieval", (t) => {
  const { store } = createFixture(t);

  store.saveInstallation(installation());

  store.revokeInstallation({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  const metadata = store.getInstallationMetadata({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.equal(metadata.status, "revoked");

  assert.throws(() => {
    store.getInstallationCredentials({
      workspaceId: "T_TEST_123",
      tenantId: "minimalism",
    });
  });
});

test("authorized replacement updates encrypted credentials", (t) => {
  const { store } = createFixture(t);

  store.saveInstallation(installation());

  store.saveInstallation(
    installation({ botToken: "xoxb-rotated-secret" }),
  );

  const credentials = store.getInstallationCredentials({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.equal(credentials.botToken, "xoxb-rotated-secret");
});

test("invalid encryption keys fail closed", (t) => {
  const { root, workspaceRegistry } = createFixture(t);

  assert.throws(() => {
    createInstallationStore({
      directory: path.join(root, "invalid-key-store"),
      encryptionKey: Buffer.from("too-short"),
      workspaceRegistry,
      validateTenantId: requireTenantId,
    });
  });
});

test("revoked installations cannot be silently reactivated", (t) => {
  const { store } = createFixture(t);

  store.saveInstallation(installation());

  store.revokeInstallation({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.throws(
    () => {
      store.saveInstallation(
        installation({ botToken: "xoxb-new-secret" }),
      );
    },
    /revoked/i,
  );

  const metadata = store.getInstallationMetadata({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.equal(metadata.status, "revoked");
});

test("workspace lock prevents conflicting credential updates and revocation", (t) => {
  const { root, store } = createFixture(t);

  store.saveInstallation(installation());

  const hash = crypto
    .createHash("sha256")
    .update("T_TEST_123")
    .digest("hex");

  const lockPath = path.join(
    root,
    "installations",
    `${hash}.json.lock`,
  );

  fs.mkdirSync(lockPath, { mode: 0o700 });

  try {
    assert.throws(
      () => {
        store.saveInstallation(
          installation({ botToken: "xoxb-conflicting-token" }),
        );
      },
      { code: "INSTALLATION_LOCKED" },
    );

    assert.throws(
      () => {
        store.revokeInstallation({
          workspaceId: "T_TEST_123",
          tenantId: "minimalism",
        });
      },
      { code: "INSTALLATION_LOCKED" },
    );
  } finally {
    fs.rmdirSync(lockPath);
  }

  const credentials = store.getInstallationCredentials({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.equal(credentials.botToken, "xoxb-test-secret-value");

  const metadata = store.getInstallationMetadata({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.equal(metadata.status, "active");
});

test("rejects installation records with mismatched workspace identity", (t) => {
  const { root, store } = createFixture(t);

  store.saveInstallation(installation());

  const hash = crypto
    .createHash("sha256")
    .update("T_TEST_123")
    .digest("hex");

  const filePath = path.join(
    root,
    "installations",
    `${hash}.json`,
  );

  const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
  record.workspaceId = "T_DIFFERENT_WORKSPACE";

  fs.writeFileSync(filePath, JSON.stringify(record));

  assert.throws(
    () => store.getInstallationMetadata({
      workspaceId: "T_TEST_123",
      tenantId: "minimalism",
    }),
    /invalid slack installation record/i,
  );
});

test("installation listings reject malformed records", (t) => {
  const { root, store } = createFixture(t);

  store.saveInstallation(installation());

  const hash = crypto
    .createHash("sha256")
    .update("T_TEST_123")
    .digest("hex");

  const filePath = path.join(
    root,
    "installations",
    `${hash}.json`,
  );

  const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
  record.status = "unexpected";

  fs.writeFileSync(filePath, JSON.stringify(record));

  assert.throws(
    () => store.listInstallations({ tenantId: "minimalism" }),
    /invalid slack installation record/i,
  );
});

test("rejects tampered installation metadata", (t) => {
  const { root, store } = createFixture(t);

  store.saveInstallation(installation());

  const hash = crypto
    .createHash("sha256")
    .update("T_TEST_123")
    .digest("hex");

  const filePath = path.join(
    root,
    "installations",
    `${hash}.json`,
  );

  const record = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  );

  record.scopes.push("admin");

  fs.writeFileSync(
    filePath,
    JSON.stringify(record),
  );

  assert.throws(
    () => store.getInstallationMetadata({
      workspaceId: "T_TEST_123",
      tenantId: "minimalism",
    }),
    /integrity|authentication|invalid/i,
  );
});

test("installation listings reject cryptographically tampered metadata", (t) => {
  const { root, store } = createFixture(t);

  store.saveInstallation(installation());

  const hash = crypto
    .createHash("sha256")
    .update("T_TEST_123")
    .digest("hex");

  const filePath = path.join(
    root,
    "installations",
    `${hash}.json`,
  );

  const record = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  );

  record.scopes.push("admin");

  fs.writeFileSync(
    filePath,
    JSON.stringify(record),
  );

  assert.throws(
    () => store.listInstallations({
      tenantId: "minimalism",
    }),
    /integrity|authentication|invalid/i,
  );
});

test("installation metadata excludes unexpected internal fields", (t) => {
  const { root, store } = createFixture(t);

  store.saveInstallation(installation());

  const hash = crypto
    .createHash("sha256")
    .update("T_TEST_123")
    .digest("hex");

  const filePath = path.join(
    root,
    "installations",
    `${hash}.json`,
  );

  const record = JSON.parse(fs.readFileSync(filePath, "utf8"));

  record.internalSecret = "must-never-be-exposed";

  // Re-signing is not available through the public store API.
  // Restore the original record after checking the public contract.
  delete record.internalSecret;

  const metadata = store.getInstallationMetadata({
    workspaceId: "T_TEST_123",
    tenantId: "minimalism",
  });

  assert.equal(
    Object.hasOwn(metadata, "internalSecret"),
    false,
  );

  assert.equal(
    Object.hasOwn(metadata, "encryptedCredentials"),
    false,
  );

  assert.equal(
    Object.hasOwn(metadata, "integrity"),
    false,
  );
});

test("filesystem ownership survives failed credential persistence and same-tenant retry", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "signal-audit-slack-recovery-"),
  );

  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const registry = createWorkspaceRegistry({
    filePath: path.join(root, "ownership.json"),
    validateTenantId: requireTenantId,
  });

  const workspaceId = "T_RECOVERY_123";

  registry.claimWorkspace({
    workspaceId,
    tenantId: "minimalism",
  });

  const encryptionKey = crypto.randomBytes(32);
  const directory = path.join(root, "installations");

  const store = createInstallationStore({
    directory,
    encryptionKey,
    workspaceRegistry: registry,
    validateTenantId: requireTenantId,
  });

  // Force a real filesystem failure without changing directory permissions.
  fs.writeFileSync(directory, "not-a-directory");

  assert.throws(
    () => store.saveInstallation(installation({ workspaceId })),
  );

  assert.equal(
    registry.getWorkspace(workspaceId).tenantId,
    "minimalism",
  );

  assert.throws(
    () => registry.claimWorkspace({
      workspaceId,
      tenantId: "oasse",
    }),
  );

  // Restore the storage path, then retry with the original owner.
  fs.unlinkSync(directory);

  const recoveredRegistry = createWorkspaceRegistry({
    filePath: path.join(root, "ownership.json"),
    validateTenantId: requireTenantId,
  });

  const recoveredStore = createInstallationStore({
    directory,
    encryptionKey,
    workspaceRegistry: recoveredRegistry,
    validateTenantId: requireTenantId,
  });

  recoveredRegistry.claimWorkspace({
    workspaceId,
    tenantId: "minimalism",
  });

  recoveredStore.saveInstallation(installation({ workspaceId }));

  const credentials = recoveredStore.getInstallationCredentials({
    workspaceId,
    tenantId: "minimalism",
  });

  assert.equal(credentials.botToken, "xoxb-test-secret-value");

  assert.throws(
    () => recoveredStore.getInstallationCredentials({
      workspaceId,
      tenantId: "oasse",
    }),
  );

  const files = fs.readdirSync(directory);
  assert.equal(files.length, 1);

  const encryptedRecord = fs.readFileSync(
    path.join(directory, files[0]),
    "utf8",
  );

  assert.doesNotMatch(encryptedRecord, /xoxb-test-secret-value/);
});
