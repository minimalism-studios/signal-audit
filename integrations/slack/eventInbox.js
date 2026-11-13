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
          || !["RECEIVED", "PROCESSING", "COMPLETED"].includes(existing.status)
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

  function claim({ workspaceId, eventId } = {}) {
    const destination = eventPath({ workspaceId, eventId });
    const marker = `${destination}.claim`;

    let markerFd;
    try {
      markerFd = fs.openSync(marker, "wx", 0o600);
    } catch (error) {
      if (error.code === "EEXIST") {
        return { claimed: false, record: null };
      }
      throw error;
    }

    try {
      const record = JSON.parse(fs.readFileSync(destination, "utf8"));

      if (
        record.workspaceId !== workspaceId
        || record.eventId !== eventId
        || record.status !== "RECEIVED"
      ) {
        throw new Error("Invalid pending Slack event record.");
      }

      const processing = {
        ...record,
        status: "PROCESSING",
        claimedAt: new Date().toISOString(),
      };

      const temporary = path.join(
        directory,
        `.${crypto.randomUUID()}.tmp`,
      );

      try {
        fs.writeFileSync(temporary, JSON.stringify(processing), {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
          flush: true,
        });
        fs.renameSync(temporary, destination);
        syncDirectory();
      } finally {
        try {
          fs.unlinkSync(temporary);
        } catch (error) {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }
      }

      return { claimed: true, record: processing };
    } finally {
      fs.closeSync(markerFd);
    }
  }

  function complete({
    workspaceId,
    eventId,
    responseChannelId,
    responseTs,
  } = {}) {
    const destination = eventPath({ workspaceId, eventId });
    const marker = `${destination}.claim`;

    if (
      typeof responseChannelId !== "string"
      || !/^[A-Z0-9]+$/.test(responseChannelId)
      || typeof responseTs !== "string"
      || !/^\d+\.\d{6}$/.test(responseTs)
    ) {
      throw new Error("Invalid Slack response identifiers.");
    }

    if (!fs.existsSync(marker)) {
      throw new Error("Slack event has not been claimed.");
    }

    const record = JSON.parse(fs.readFileSync(destination, "utf8"));

    if (
      record.workspaceId !== workspaceId
      || record.eventId !== eventId
      || record.status !== "PROCESSING"
    ) {
      throw new Error("Invalid Slack event completion transition.");
    }

    const completed = {
      ...record,
      status: "COMPLETED",
      responseChannelId,
      responseTs,
      completedAt: new Date().toISOString(),
    };

    const temporary = path.join(
      directory,
      `.${crypto.randomUUID()}.tmp`,
    );

    try {
      fs.writeFileSync(temporary, JSON.stringify(completed), {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
        flush: true,
      });

      fs.renameSync(temporary, destination);
      syncDirectory();
    } finally {
      try {
        fs.unlinkSync(temporary);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("Slack completion cleanup failed:", error.message);
        }
      }
    }

    return completed;
  }

  function close({ workspaceId, eventId, reason } = {}) {
    const destination = eventPath({ workspaceId, eventId });
    const marker = `${destination}.claim`;

    if (
      typeof reason !== "string"
      || !/^[a-z_]{1,64}$/.test(reason)
    ) {
      throw new Error("Invalid Slack event closure reason.");
    }

    if (!fs.existsSync(marker)) {
      throw new Error("Slack event has not been claimed.");
    }

    const record = JSON.parse(fs.readFileSync(destination, "utf8"));

    if (
      record.workspaceId !== workspaceId
      || record.eventId !== eventId
      || record.status !== "PROCESSING"
    ) {
      throw new Error("Invalid Slack event closure transition.");
    }

    const closed = {
      ...record,
      status: "CLOSED",
      closeReason: reason,
      closedAt: new Date().toISOString(),
    };

    const temporary = path.join(
      directory,
      `.${crypto.randomUUID()}.tmp`,
    );

    try {
      fs.writeFileSync(temporary, JSON.stringify(closed), {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
        flush: true,
      });
      fs.renameSync(temporary, destination);
      syncDirectory();
    } finally {
      try {
        fs.unlinkSync(temporary);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("Slack closure cleanup failed:", error.message);
        }
      }
    }

    return closed;
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
        || !["RECEIVED", "PROCESSING", "COMPLETED", "CLOSED"].includes(record.status)
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

  return Object.freeze({ receive, listPending, claim, complete, close });
}

module.exports = { createEventInbox };
