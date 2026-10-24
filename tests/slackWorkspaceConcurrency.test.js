const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const registryModule = path.resolve(
  __dirname,
  "../integrations/slack/workspaceRegistry.js",
);

test("concurrent processes cannot assign one workspace to different tenants", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "slack-workspace-race-"),
  );

  try {
    const filePath = path.join(directory, "registry.json");
    const workspaceId = "T_CONCURRENT_TEST";

    function claim(tenantId) {
      return new Promise((resolve, reject) => {
        const script = `
          const { createWorkspaceRegistry } = require(${JSON.stringify(registryModule)});
          const registry = createWorkspaceRegistry({
            filePath: ${JSON.stringify(filePath)},
            validateTenantId: (id) => id,
          });
          try {
            const record = registry.claimWorkspace({
              workspaceId: ${JSON.stringify(workspaceId)},
              tenantId: ${JSON.stringify(tenantId)},
            });
            process.stdout.write(JSON.stringify({
              success: true,
              tenantId: record.tenantId,
            }));
          } catch (error) {
            process.stdout.write(JSON.stringify({
              success: false,
              code: error.code || "ERROR",
            }));
          }
        `;

        const child = spawn(process.execPath, ["-e", script]);
        let output = "";
        let errors = "";

        child.stdout.on("data", (chunk) => {
          output += chunk;
        });

        child.stderr.on("data", (chunk) => {
          errors += chunk;
        });

        child.on("error", reject);

        child.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(errors || `Child exited ${code}`));
            return;
          }

          try {
            resolve(JSON.parse(output));
          } catch {
            reject(new Error(`Invalid child output: ${output}`));
          }
        });
      });
    }

    const results = await Promise.all([
      claim("minimalism"),
      claim("oasse"),
    ]);

    assert.equal(
      results.filter((result) => result.success).length,
      1,
    );

    assert.equal(
      results.filter(
        (result) => result.code === "WORKSPACE_ALREADY_OWNED",
      ).length,
      1,
    );

    const { createWorkspaceRegistry } = require(registryModule);

    const registry = createWorkspaceRegistry({
      filePath,
      validateTenantId: (id) => id,
    });

    const owner = registry.getWorkspace(workspaceId);

    assert.equal(
      owner.tenantId,
      results.find((result) => result.success).tenantId,
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});
