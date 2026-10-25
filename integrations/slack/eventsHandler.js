"use strict";

function createSlackEventsHandler({
  workspaceRegistry,
  installationStore,
  eventInbox,
}) {
  if (
    !workspaceRegistry?.getWorkspace
    || !installationStore?.getInstallationMetadata
    || !eventInbox?.receive
  ) {
    throw new Error("Slack event handler dependencies are required.");
  }

  function handleEvent(payload) {
    if (
      !payload
      || payload.type !== "event_callback"
      || typeof payload.team_id !== "string"
      || !payload.team_id.trim()
      || typeof payload.event_id !== "string"
      || !payload.event_id.trim()
    ) {
      return { accepted: false, reason: "invalid_event" };
    }

    const workspaceId = payload.team_id.trim();
    const ownership = workspaceRegistry.getWorkspace(workspaceId);

    if (
      !ownership
      || ownership.workspaceId !== workspaceId
      || !ownership.tenantId
    ) {
      return { accepted: false, reason: "unauthorized_workspace" };
    }

    const installation = installationStore.getInstallationMetadata({
      workspaceId,
      tenantId: ownership.tenantId,
    });

    if (
      !installation
      || installation.status !== "active"
      || installation.workspaceId !== workspaceId
      || installation.tenantId !== ownership.tenantId
    ) {
      return { accepted: false, reason: "inactive_installation" };
    }

    const event = payload.event;

    if (!event || event.type !== "message") {
      return { accepted: true, ignored: true, reason: "unsupported_event" };
    }

    if (
      event.bot_id
      || event.user === installation.botUserId
      || event.subtype
    ) {
      return { accepted: true, ignored: true, reason: "bot_or_subtype" };
    }

    if (
      event.channel_type !== "im"
      || typeof event.channel !== "string"
      || !event.channel
      || typeof event.user !== "string"
      || !event.user
      || typeof event.text !== "string"
      || typeof event.ts !== "string"
      || !event.ts
    ) {
      return { accepted: true, ignored: true, reason: "unsupported_message" };
    }

    const result = eventInbox.receive({
      workspaceId,
      tenantId: ownership.tenantId,
      eventId: payload.event_id,
      event: {
        type: "message",
        channel: event.channel,
        user: event.user,
        text: event.text,
        ts: event.ts,
        threadTs: event.thread_ts || null,
      },
    });

    return {
      accepted: true,
      duplicate: result.duplicate,
      stored: !result.duplicate,
    };
  }

  return Object.freeze({ handleEvent });
}

module.exports = { createSlackEventsHandler };
