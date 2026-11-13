"use strict";

function createSlackEventProcessor({
  eventInbox,
  investigativeIntelligence,
  slackDelivery,
}) {
  if (
    typeof eventInbox?.claim !== "function"
    || typeof eventInbox?.complete !== "function"
    || typeof eventInbox?.close !== "function"
    || typeof investigativeIntelligence?.answerQuestion !== "function"
    || typeof slackDelivery?.postMessage !== "function"
  ) {
    throw new Error("Slack event processor dependencies are required.");
  }

  async function processEvent({ workspaceId, eventId } = {}) {
    const claim = eventInbox.claim({ workspaceId, eventId });

    if (!claim.claimed) {
      return { status: "already_claimed" };
    }

    const record = claim.record;
    const event = record.event;

    if (
      event?.type !== "message"
      || typeof event.channel !== "string"
      || typeof event.threadTs !== "string"
      || !/^\d+\.\d{6}$/.test(event.threadTs)
      || event.threadTs === event.ts
      || typeof event.text !== "string"
      || !event.text.trim()
    ) {
      eventInbox.close({
        workspaceId: record.workspaceId,
        eventId: record.eventId,
        reason: "ignored",
      });
      return { status: "ignored" };
    }

    let investigation;

    try {
      investigation = await investigativeIntelligence.answerQuestion({
        workspaceId: record.workspaceId,
        channelId: event.channel,
        parentMessageTs: event.threadTs,
        question: event.text,
      });
    } catch {
      eventInbox.close({
        workspaceId: record.workspaceId,
        eventId: record.eventId,
        reason: "investigation_failed",
      });
      return { status: "investigation_failed" };
    }

    if (
      investigation.status !== "answered"
      || typeof investigation.response?.answer !== "string"
      || !investigation.response.answer.trim()
    ) {
      eventInbox.close({
        workspaceId: record.workspaceId,
        eventId: record.eventId,
        reason: "not_answered",
      });
      return {
        status: "not_answered",
        reason: investigation.status,
      };
    }

    let delivery;

    try {
      delivery = await slackDelivery.postMessage({
        workspaceId: record.workspaceId,
        tenantId: record.tenantId,
        channelId: event.channel,
        threadTs: event.threadTs,
        text: investigation.response.answer,
      });
    } catch {
      eventInbox.close({
        workspaceId: record.workspaceId,
        eventId: record.eventId,
        reason: "delivery_failed",
      });
      return { status: "delivery_failed" };
    }

    if (
      delivery.channelId !== event.channel
      || typeof delivery.timestamp !== "string"
      || !/^\d+\.\d{6}$/.test(delivery.timestamp)
    ) {
      eventInbox.close({
        workspaceId: record.workspaceId,
        eventId: record.eventId,
        reason: "delivery_unconfirmed",
      });
      return { status: "delivery_unconfirmed" };
    }

    const completed = eventInbox.complete({
      workspaceId: record.workspaceId,
      eventId: record.eventId,
      responseChannelId: delivery.channelId,
      responseTs: delivery.timestamp,
    });

    return {
      status: "completed",
      responseTs: completed.responseTs,
    };
  }

  return Object.freeze({ processEvent });
}

module.exports = { createSlackEventProcessor };
