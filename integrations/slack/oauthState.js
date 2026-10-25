"use strict";

const crypto = require("node:crypto");

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function createOAuthStateManager({
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
} = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new Error("Invalid OAuth state expiration.");
  }

  function validateContext({ tenantId, userId, sessionId }) {
    for (const value of [tenantId, userId, sessionId]) {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error("Invalid OAuth session context.");
      }
    }

    return { tenantId, userId, sessionId };
  }

  function create({ session, tenantId, userId, sessionId }) {
    if (!session || typeof session !== "object") {
      throw new Error("OAuth session is required.");
    }

    const context = validateContext({
      tenantId,
      userId,
      sessionId,
    });

    const state = crypto.randomBytes(32).toString("base64url");

    session.slackOAuth = {
      stateHash: crypto
        .createHash("sha256")
        .update(state)
        .digest("hex"),
      ...context,
      expiresAt: now() + ttlMs,
    };

    return state;
  }

  function consume({
    session,
    state,
    tenantId,
    userId,
    sessionId,
  }) {
    if (!session || typeof session !== "object") {
      throw new Error("Invalid OAuth session.");
    }

    const attempt = session.slackOAuth;

    // Remove the attempt before validation to prevent reuse.
    delete session.slackOAuth;

    const context = validateContext({
      tenantId,
      userId,
      sessionId,
    });

    if (
      !attempt ||
      typeof state !== "string" ||
      !state ||
      !Number.isFinite(attempt.expiresAt) ||
      now() >= attempt.expiresAt ||
      attempt.tenantId !== context.tenantId ||
      attempt.userId !== context.userId ||
      attempt.sessionId !== context.sessionId
    ) {
      throw new Error("Invalid or expired Slack OAuth state.");
    }

    const suppliedHash = crypto
      .createHash("sha256")
      .update(state)
      .digest();

    if (
      typeof attempt.stateHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(attempt.stateHash) ||
      !crypto.timingSafeEqual(
        suppliedHash,
        Buffer.from(attempt.stateHash, "hex"),
      )
    ) {
      throw new Error("Invalid or expired Slack OAuth state.");
    }

    return context;
  }

  return Object.freeze({
    create,
    consume,
  });
}

module.exports = {
  createOAuthStateManager,
};
