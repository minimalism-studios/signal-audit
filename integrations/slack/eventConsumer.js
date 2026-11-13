"use strict";

function createSlackEventConsumer({
  eventInbox,
  eventProcessor,
}) {
  if (
    typeof eventInbox?.listPending !== "function"
    || typeof eventProcessor?.processEvent !== "function"
  ) {
    throw new Error("Slack event consumer dependencies are required.");
  }

  async function processPending({ limit = 10 } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Invalid Slack event consumer batch limit.");
    }

    const pending = eventInbox.listPending({ limit });
    const results = [];

    for (const record of pending) {
      try {
        const result = await eventProcessor.processEvent({
          workspaceId: record.workspaceId,
          eventId: record.eventId,
        });

        results.push({
          workspaceId: record.workspaceId,
          eventId: record.eventId,
          status: result.status,
        });
      } catch {
        results.push({
          workspaceId: record.workspaceId,
          eventId: record.eventId,
          status: "processing_error",
        });
      }
    }

    return Object.freeze({
      examined: pending.length,
      results,
    });
  }

  return Object.freeze({ processPending });
}

module.exports = { createSlackEventConsumer };
