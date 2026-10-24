const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createWorkspaceRegistry,
} = require("../integrations/slack/workspaceRegistry");

function setup(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "sa-slack-registry-"),
  );

  t.after(() => {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  });

  const filePath = path.join(
    directory,
    "workspace-ownership.json",
  );

  const createRegistry = () =>
    createWorkspaceRegistry({
      filePath,
      validateTenantId(value) {
        if (!["minimalism", "oasse"].includes(value)) {
          throw new Error("Unknown tenant");
        }

        return value;
      },
    });

  return {
    filePath,
    createRegistry,
  };
}

test("claims an unowned workspace", (t) => {
  const { createRegistry } = setup(t);
  const registry = createRegistry();

  const record = registry.claimWorkspace({
    workspaceId: "T_TEST_A",
    tenantId: "minimalism",
  });

  assert.equal(record.workspaceId, "T_TEST_A");
  assert.equal(record.tenantId, "minimalism");
  assert.ok(record.createdAt);
});

test("repeated claim by owner is idempotent", (t) => {
  const { createRegistry } = setup(t);
  const registry = createRegistry();

  const first = registry.claimWorkspace({
    workspaceId: "T_TEST_A",
    tenantId: "minimalism",
  });

  const second = registry.claimWorkspace({
    workspaceId: "T_TEST_A",
    tenantId: "minimalism",
  });

  assert.deepEqual(second, first);
});

test("rejects ownership by another tenant", (t) => {
  const { createRegistry } = setup(t);
  const registry = createRegistry();

  registry.claimWorkspace({
    workspaceId: "T_TEST_A",
    tenantId: "minimalism",
  });

  assert.throws(
    () =>
      registry.claimWorkspace({
        workspaceId: "T_TEST_A",
        tenantId: "oasse",
      }),
    {
      code: "WORKSPACE_ALREADY_OWNED",
      status: 409,
    },
  );
});

test("rejects unknown tenants", (t) => {
  const { createRegistry } = setup(t);
  const registry = createRegistry();

  assert.throws(
    () =>
      registry.claimWorkspace({
        workspaceId: "T_TEST_A",
        tenantId: "unknown",
      }),
    /Unknown tenant/,
  );
});

test("persists ownership across instances", (t) => {
  const { createRegistry } = setup(t);

  createRegistry().claimWorkspace({
    workspaceId: "T_TEST_A",
    tenantId: "minimalism",
  });

  const record = createRegistry().getWorkspace(
    "T_TEST_A",
  );

  assert.equal(record.tenantId, "minimalism");
});

test("returns null for unknown workspace", (t) => {
  const { createRegistry } = setup(t);

  assert.equal(
    createRegistry().getWorkspace("T_MISSING"),
    null,
  );
});
