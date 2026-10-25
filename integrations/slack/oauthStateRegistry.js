"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function createOAuthStateRegistry({
  directory,
  encryptionKey,
  now = () => Date.now(),
}) {
  if (typeof directory !== "string" || !directory.trim()) {
    throw new Error("OAuth state directory is required.");
  }

  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    throw new Error("OAuth state integrity key material must be 32 bytes.");
  }

  const integrityKey = crypto.hkdfSync(
    "sha256",
    encryptionKey,
    Buffer.from("signal-audit-slack-oauth"),
    Buffer.from("oauth-state-record-integrity-v1"),
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
      !record ||
      typeof record !== "object" ||
      Array.isArray(record) ||
      typeof record.integrity !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.integrity)
    ) {
      throw new Error("Invalid Slack OAuth state record integrity.");
    }

    const expected = Buffer.from(integrityTag(record), "hex");
    const actual = Buffer.from(record.integrity, "hex");

    if (!crypto.timingSafeEqual(expected, actual)) {
      throw new Error("Invalid Slack OAuth state record integrity.");
    }
  }

  function stateHash(state) {
    if (
      typeof state !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(state)
    ) {
      throw new Error("Invalid Slack OAuth state.");
    }

    const decoded = Buffer.from(state, "base64url");

    if (
      decoded.length !== 32 ||
      decoded.toString("base64url") !== state
    ) {
      throw new Error("Invalid Slack OAuth state.");
    }

    return crypto.createHash("sha256").update(state).digest("hex");
  }

  function statePath(hash) {
    return path.join(directory, `${hash}.json`);
  }

  function claimPath(hash) {
    return path.join(directory, `${hash}.consumed`);
  }

  function create({ state, tenantId, userId, sessionId, expiresAt }) {
    if (
      ![tenantId, userId, sessionId].every(
        (value) =>
          typeof value === "string" &&
          Boolean(value.trim()),
      ) ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now()
    ) {
      throw new Error("Invalid OAuth state context.");
    }

    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

    const hash = stateHash(state);

    const record = {
      stateHash: hash,
      tenantId,
      userId,
      sessionId,
      expiresAt,
    };

    record.integrity = integrityTag(record);

    fs.writeFileSync(
      statePath(hash),
      JSON.stringify(record),
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );

    return hash;
  }

  function consume({ state, tenantId, userId, sessionId }) {
    const hash = stateHash(state);
    let record;

    let contents;

    try {
      contents = fs.readFileSync(statePath(hash), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error("Invalid or expired Slack OAuth state.");
      }

      throw error;
    }

    try {
      record = JSON.parse(contents);
    } catch {
      throw new Error("Invalid Slack OAuth state record.");
    }

    verifyIntegrity(record);

    if (
      record.stateHash !== hash ||
      record.tenantId !== tenantId ||
      record.userId !== userId ||
      record.sessionId !== sessionId ||
      !Number.isSafeInteger(record.expiresAt) ||
      now() >= record.expiresAt
    ) {
      throw new Error("Invalid or expired Slack OAuth state.");
    }

    // Exclusive marker creation makes concurrent consumption fail closed.
    try {
      fs.writeFileSync(
        claimPath(hash),
        "",
        { mode: 0o600, flag: "wx" },
      );
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new Error("Slack OAuth state has already been consumed.");
      }
      throw error;
    }

    return {
      tenantId: record.tenantId,
      userId: record.userId,
      sessionId: record.sessionId,
    };
  }

  function cleanupExpired({ limit = 100 } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error("Invalid OAuth cleanup limit.");
    }

    let removed = 0;
    let examined = 0;

    let entries;

    try {
      entries = fs.readdirSync(directory);
    } catch (error) {
      if (error.code === "ENOENT") {
        return { examined, removed };
      }
      throw error;
    }

    for (const entry of entries) {
      if (examined >= limit) {
        break;
      }

      if (!/^[a-f0-9]{64}\.json$/.test(entry)) {
        continue;
      }

      examined += 1;

      const hash = entry.slice(0, -5);
      const recordFile = statePath(hash);

      let record;

      try {
        record = JSON.parse(fs.readFileSync(recordFile, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          continue;
        }
        throw error;
      }

      try {
        verifyIntegrity(record);
      } catch {
        continue;
      }

      if (
        record.stateHash !== hash ||
        !Number.isSafeInteger(record.expiresAt) ||
        now() < record.expiresAt
      ) {
        continue;
      }

      // Remove the authorization record before its consumption marker.
      fs.unlinkSync(recordFile);

      try {
        fs.unlinkSync(claimPath(hash));
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      removed += 1;
    }

    return { examined, removed };
  }

  return Object.freeze({ create, consume, cleanupExpired });
}

module.exports = { createOAuthStateRegistry };
