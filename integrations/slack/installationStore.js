"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function createInstallationStore({
  directory,
  encryptionKey,
  workspaceRegistry,
  validateTenantId,
}) {
  if (typeof directory !== "string" || !directory.trim()) {
    throw new Error("Installation directory is required.");
  }

  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    throw new Error("Installation encryption key must be 32 bytes.");
  }

  if (
    !workspaceRegistry ||
    typeof workspaceRegistry.getWorkspace !== "function"
  ) {
    throw new Error("Workspace registry is required.");
  }

  if (typeof validateTenantId !== "function") {
    throw new Error("Tenant validator is required.");
  }

  const key = Buffer.from(encryptionKey);

  function validateIdentity({ workspaceId, tenantId }) {
    if (typeof workspaceId !== "string" || !workspaceId.trim()) {
      throw new Error("Workspace ID is required.");
    }

    const normalizedTenantId = validateTenantId(tenantId);
    const normalizedWorkspaceId = workspaceId.trim();

    const owner = workspaceRegistry.getWorkspace(normalizedWorkspaceId);

    if (!owner || owner.tenantId !== normalizedTenantId) {
      throw new Error("Slack workspace ownership mismatch.");
    }

    return {
      workspaceId: normalizedWorkspaceId,
      tenantId: normalizedTenantId,
    };
  }

  function recordPath(workspaceId) {
    const hash = crypto
      .createHash("sha256")
      .update(workspaceId)
      .digest("hex");

    return path.join(directory, `${hash}.json`);
  }

  function encrypt(credentials, identity) {
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      key,
      iv,
    );

    cipher.setAAD(
      Buffer.from(JSON.stringify(identity)),
    );

    const ciphertext = Buffer.concat([
      cipher.update(
        JSON.stringify(credentials),
        "utf8",
      ),
      cipher.final(),
    ]);

    return {
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  function decrypt(encrypted, identity) {
    if (
      encrypted.version !== 1 ||
      encrypted.algorithm !== "aes-256-gcm"
    ) {
      throw new Error("Unsupported installation encryption format.");
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(encrypted.iv, "base64"),
    );

    decipher.setAAD(
      Buffer.from(JSON.stringify(identity)),
    );

    decipher.setAuthTag(
      Buffer.from(encrypted.tag, "base64"),
    );

    const plaintext = Buffer.concat([
      decipher.update(
        Buffer.from(encrypted.ciphertext, "base64"),
      ),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString("utf8"));
  }

  const integrityKey = crypto.hkdfSync(
    "sha256",
    key,
    Buffer.from("signal-audit-slack-installations"),
    Buffer.from("installation-record-integrity-v1"),
    32,
  );

  function integrityTag(record) {
    const { integrity, ...payload } = record;

    return crypto
      .createHmac("sha256", integrityKey)
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  function verifyIntegrity(record) {
    if (
      typeof record.integrity !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.integrity)
    ) {
      throw new Error("Invalid Slack installation record integrity.");
    }

    const expected = Buffer.from(
      integrityTag(record),
      "hex",
    );

    const actual = Buffer.from(
      record.integrity,
      "hex",
    );

    if (!crypto.timingSafeEqual(expected, actual)) {
      throw new Error("Invalid Slack installation record integrity.");
    }
  }

  function readRecord(workspaceId) {
    const filePath = recordPath(workspaceId);

    let contents;

    try {
      contents = fs.readFileSync(filePath, "utf8");
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
      throw new Error("Invalid Slack installation record.");
    }

    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record) ||
      record.workspaceId !== workspaceId ||
      typeof record.tenantId !== "string" ||
      !["active", "revoked"].includes(record.status) ||
      !Array.isArray(record.scopes) ||
      !record.scopes.every(
        (scope) => typeof scope === "string"
      ) ||
      (
        record.status === "active" &&
        (
          !record.encryptedCredentials ||
          typeof record.encryptedCredentials !== "object" ||
          Array.isArray(record.encryptedCredentials)
        )
      ) ||
      (
        record.status === "revoked" &&
        record.encryptedCredentials !== null
      )
    ) {
      throw new Error("Invalid Slack installation record.");
    }

    verifyIntegrity(record);

    return record;
  }

  function writeRecord(workspaceId, record) {
    fs.mkdirSync(directory, {
      recursive: true,
      mode: 0o700,
    });

    record.integrity = integrityTag(record);

    const destination = recordPath(workspaceId);
    const temporary = path.join(
      directory,
      `.${crypto.randomUUID()}.tmp`,
    );

    try {
      fs.writeFileSync(
        temporary,
        `${JSON.stringify(record, null, 2)}\n`,
        {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        },
      );

      fs.renameSync(temporary, destination);
    } finally {
      if (fs.existsSync(temporary)) {
        fs.unlinkSync(temporary);
      }
    }
  }

  function withWorkspaceLock(workspaceId, operation) {
    fs.mkdirSync(directory, {
      recursive: true,
      mode: 0o700,
    });

    const lockPath = `${recordPath(workspaceId)}.lock`;

    try {
      fs.mkdirSync(lockPath, { mode: 0o700 });
    } catch (error) {
      if (error.code === "EEXIST") {
        const conflict = new Error(
          "Slack installation update is already in progress.",
        );
        conflict.code = "INSTALLATION_LOCKED";
        conflict.status = 409;
        throw conflict;
      }
      throw error;
    }

    try {
      return operation();
    } finally {
      fs.rmdirSync(lockPath);
    }
  }

  function metadata(record) {
    return {
      workspaceId: record.workspaceId,
      tenantId: record.tenantId,
      status: record.status,
      botUserId: record.botUserId,
      scopes: [...record.scopes],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  function saveInstallation({
    workspaceId,
    tenantId,
    botToken,
    botUserId,
    scopes = [],
  }) {
    const identity = validateIdentity({
      workspaceId,
      tenantId,
    });

    if (typeof botToken !== "string" || !botToken.trim()) {
      throw new Error("Slack bot token is required.");
    }

    if (
      !Array.isArray(scopes) ||
      !scopes.every((scope) => typeof scope === "string")
    ) {
      throw new Error("Slack scopes must be an array of strings.");
    }

    return withWorkspaceLock(identity.workspaceId, () => {
    const existing = readRecord(identity.workspaceId);

    if (existing?.status === "revoked") {
      throw new Error(
        "Revoked Slack installation requires a new authorized OAuth flow.",
      );
    }

    const now = new Date().toISOString();

    const record = {
      ...identity,
      status: "active",
      botUserId: botUserId || null,
      scopes: [...scopes],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      encryptedCredentials: encrypt(
        { botToken },
        identity,
      ),
    };

    writeRecord(identity.workspaceId, record);

    return metadata(record);
    });
  }

  function getInstallationMetadata({ workspaceId, tenantId }) {
    const identity = validateIdentity({
      workspaceId,
      tenantId,
    });

    const record = readRecord(identity.workspaceId);

    if (!record || record.tenantId !== identity.tenantId) {
      return null;
    }

    return metadata(record);
  }

  function getInstallationCredentials({ workspaceId, tenantId }) {
    const identity = validateIdentity({
      workspaceId,
      tenantId,
    });

    const record = readRecord(identity.workspaceId);

    if (
      !record ||
      record.tenantId !== identity.tenantId ||
      record.status !== "active"
    ) {
      throw new Error("Active Slack installation not found.");
    }

    return decrypt(record.encryptedCredentials, identity);
  }

  function revokeInstallation({ workspaceId, tenantId }) {
    const identity = validateIdentity({
      workspaceId,
      tenantId,
    });

    return withWorkspaceLock(identity.workspaceId, () => {
    const record = readRecord(identity.workspaceId);

    if (!record || record.tenantId !== identity.tenantId) {
      throw new Error("Slack installation not found.");
    }

    record.status = "revoked";
    record.updatedAt = new Date().toISOString();

    // Remove encrypted credentials rather than retaining a usable token.
    record.encryptedCredentials = null;

    writeRecord(identity.workspaceId, record);

    return metadata(record);
    });
  }

  function listInstallations({ tenantId }) {
    const normalizedTenantId = validateTenantId(tenantId);

    if (!fs.existsSync(directory)) {
      return [];
    }

    return fs.readdirSync(directory)
      .filter((filename) => /^[a-f0-9]{64}\.json$/.test(filename))
      .map((filename) => {
        const record = JSON.parse(
          fs.readFileSync(
            path.join(directory, filename),
            "utf8",
          ),
        );

        if (
          !record ||
          typeof record.workspaceId !== "string" ||
          path.basename(recordPath(record.workspaceId)) !== filename
        ) {
          throw new Error("Invalid Slack installation record.");
        }

        return readRecord(record.workspaceId);
      })
      .filter((record) => {
        if (record.tenantId !== normalizedTenantId) {
          return false;
        }

        try {
          validateIdentity({
            workspaceId: record.workspaceId,
            tenantId: normalizedTenantId,
          });
          return true;
        } catch {
          return false;
        }
      })
      .map(metadata);
  }

  return Object.freeze({
    saveInstallation,
    getInstallationMetadata,
    getInstallationCredentials,
    revokeInstallation,
    listInstallations,
  });
}

module.exports = {
  createInstallationStore,
};
