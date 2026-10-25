"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function createEventInbox({ directory }) {
  if (typeof directory !== "string" || !directory.trim()) {
    throw new Error("Slack event inbox directory is required.");
  }

  function eventPath({ workspaceId, eventId }) {
    if (
      typeof workspaceId !== "string" || !workspaceId.trim()
      || typeof eventId !== "string" || !eventId.trim()
    ) {
      throw new Error("Slack event identity is required.");
    }

    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify([workspaceId, eventId]))
      .digest("hex");

    return path.join(directory, `${hash}.json`);
  }

  function syncDirectory() {
    const directoryFd = fs.openSync(directory, "r");

    try {
      fs.fsyncSync(directoryFd);
    } finally {
      fs.closeSync(directoryFd);
    }
  }

  function receive({ workspaceId, eventId, tenantId, event }) {
    if (
      typeof tenantId !== "string" || !tenantId.trim()
      || !event || typeof event !== "object" || Array.isArray(event)
    ) {
      throw new Error("Invalid Slack event record.");
    }

    const destination = eventPath({ workspaceId, eventId });

    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

    const record = {
      workspaceId,
      eventId,
      tenantId,
      status: "RECEIVED",
      receivedAt: new Date().toISOString(),
      event,
    };

    const temporary = path.join(
      directory,
      `.${crypto.randomUUID()}.tmp`,
    );

    try {
      fs.writeFileSync(temporary, JSON.stringify(record), {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
        flush: true,
      });

      try {
        fs.linkSync(temporary, destination);
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw error;
        }

        const existing = JSON.parse(
          fs.readFileSync(destination, "utf8"),
        );

        if (
          existing.workspaceId !== workspaceId
          || existing.eventId !== eventId
          || existing.tenantId !== tenantId
          || existing.status !== "RECEIVED"
          || !existing.event
          || typeof existing.event !== "object"
        ) {
          throw new Error("Invalid existing Slack event record.");
        }

        syncDirectory();

        return { duplicate: true, record: null };
      }

      syncDirectory();

      return { duplicate: false, record };
    } finally {
      try {
        fs.unlinkSync(temporary);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("Slack event temporary cleanup failed:", error.message);
        }
      }
    }
  }

  function listPending({ limit = 100 } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error("Invalid Slack pending-event limit.");
    }

    let filenames;

    try {
      filenames = fs.readdirSync(directory)
        .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
        .sort();
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    const pending = [];

    for (const filename of filenames) {
      const record = JSON.parse(
        fs.readFileSync(path.join(directory, filename), "utf8"),
      );

      if (
        !record
        || typeof record !== "object"
        || Array.isArray(record)
        || typeof record.workspaceId !== "string"
        || !record.workspaceId
        || typeof record.eventId !== "string"
        || !record.eventId
        || typeof record.tenantId !== "string"
        || !record.tenantId
        || !record.event
        || typeof record.event !== "object"
        || Array.isArray(record.event)
        || !["RECEIVED", "PROCESSING", "COMPLETED"].includes(record.status)
        || eventPath(record) !== path.join(directory, filename)
      ) {
        throw new Error("Invalid stored Slack event record.");
      }

      if (record.status === "RECEIVED") {
        pending.push(record);

        if (pending.length >= limit) {
          break;
        }
      }
    }

    return pending;
  }

  return Object.freeze({ receive, listPending });
}

module.exports = { createEventInbox };
