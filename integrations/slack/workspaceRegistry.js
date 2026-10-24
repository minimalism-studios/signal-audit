const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function createWorkspaceRegistry({
  filePath,
  validateTenantId,
}) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error("Workspace registry filePath is required.");
  }

  if (typeof validateTenantId !== "function") {
    throw new Error("validateTenantId is required.");
  }

  const registryDirectory = `${filePath}.d`;

  function ownershipPath(workspaceId) {
    const hash = crypto
      .createHash("sha256")
      .update(workspaceId)
      .digest("hex");

    return path.join(registryDirectory, `${hash}.json`);
  }

  function readOwnership(workspaceId) {
    const recordPath = ownershipPath(workspaceId);

    let contents;

    try {
      contents = fs.readFileSync(recordPath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }

    let record;

    try {
      record = JSON.parse(contents);
    } catch {
      throw new Error("Invalid workspace ownership record.");
    }

    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record) ||
      record.workspaceId !== workspaceId ||
      typeof record.tenantId !== "string" ||
      !record.tenantId
    ) {
      throw new Error("Invalid workspace ownership record.");
    }

    return record;
  }

  function claimWorkspace({ workspaceId, tenantId }) {
    if (typeof workspaceId !== "string" || !workspaceId.trim()) {
      throw new Error("workspaceId is required.");
    }

    const normalizedWorkspaceId = workspaceId.trim();
    const normalizedTenantId = validateTenantId(tenantId);

    fs.mkdirSync(registryDirectory, {
      recursive: true,
      mode: 0o700,
    });

    const recordPath = ownershipPath(normalizedWorkspaceId);

    const record = {
      workspaceId: normalizedWorkspaceId,
      tenantId: normalizedTenantId,
      createdAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(
        recordPath,
        `${JSON.stringify(record, null, 2)}\n`,
        {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        },
      );

      return record;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }

    const existing = readOwnership(normalizedWorkspaceId);

    if (!existing) {
      throw new Error("Workspace ownership record is unavailable.");
    }

    if (existing.tenantId !== normalizedTenantId) {
      const error = new Error(
        "Slack workspace is already assigned to another tenant.",
      );

      error.code = "WORKSPACE_ALREADY_OWNED";
      error.status = 409;
      throw error;
    }

    return existing;
  }

  function getWorkspace(workspaceId) {
    if (typeof workspaceId !== "string" || !workspaceId.trim()) {
      return null;
    }

    return readOwnership(workspaceId.trim());
  }

  return {
    claimWorkspace,
    getWorkspace,
  };
}

module.exports = {
  createWorkspaceRegistry,
};
