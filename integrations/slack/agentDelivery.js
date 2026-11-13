"use strict";

const { createSlackDeliveryService } = require("./delivery");

function createSlackAgentDelivery({
  installationStore,
  workspaceRegistry,
  channelVerifier,
  fetchImpl,
}) {
  if (
    typeof installationStore?.getInstallationCredentials !== "function"
    || typeof workspaceRegistry?.getWorkspace !== "function"
    || typeof channelVerifier?.verifyChannel !== "function"
  ) {
    throw new Error("Slack agent delivery authorization dependencies are required.");
  }

  async function postMessage({
    workspaceId,
    tenantId,
    channelId,
    threadTs,
    text,
  } = {}) {
    if (
      typeof workspaceId !== "string"
      || !workspaceId.trim()
      || typeof tenantId !== "string"
      || !tenantId.trim()
      || typeof channelId !== "string"
      || !channelId.trim()
      || typeof threadTs !== "string"
      || !/^\d+\.\d{6}$/.test(threadTs)
    ) {
      throw new Error("Valid Slack agent delivery context is required.");
    }

    const owner = workspaceRegistry.getWorkspace(workspaceId);

    if (!owner || owner.tenantId !== tenantId) {
      throw new Error("Slack agent workspace authorization denied.");
    }

    const verification = await channelVerifier.verifyChannel({
      workspaceId,
      tenantId,
      channelId,
    });

    if (verification !== true) {
      throw new Error("Slack agent channel authorization denied.");
    }

    const credentials = installationStore.getInstallationCredentials({
      workspaceId,
      tenantId,
    });

    const delivery = createSlackDeliveryService({
      botToken: credentials.botToken,
      ...(fetchImpl ? { fetchImpl } : {}),
    });

    return delivery.postMessage({
      channelId,
      threadTs,
      text,
    });
  }

  return Object.freeze({ postMessage });
}

module.exports = { createSlackAgentDelivery };
