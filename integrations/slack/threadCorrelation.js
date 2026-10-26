"use strict";

function createSlackThreadCorrelation({
  workspaceRegistry,
  installationStore,
  signalHistory,
  channelVerifier,
}) {
  if (
    typeof workspaceRegistry?.getWorkspace !== "function"
    || typeof installationStore?.getInstallationMetadata !== "function"
    || typeof signalHistory?.findBySlackDelivery !== "function"
    || typeof channelVerifier?.verifyChannel !== "function"
  ) {
    throw new Error("Slack thread correlation dependencies are required.");
  }

  async function resolveThread({ workspaceId, channelId, parentMessageTs } = {}) {
    if (
      typeof workspaceId !== "string" || !workspaceId.trim()
      || typeof channelId !== "string" || !channelId.trim()
      || typeof parentMessageTs !== "string" || !parentMessageTs.trim()
    ) {
      return { status: "invalid_request", evidence: null };
    }

    const ownership = workspaceRegistry.getWorkspace(workspaceId);

    if (
      !ownership
      || ownership.workspaceId !== workspaceId
      || ownership.tenantId !== "minimalism"
    ) {
      return { status: "unauthorized", evidence: null };
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
      return { status: "unauthorized", evidence: null };
    }

    let channelAuthorized = false;

    try {
      channelAuthorized = await channelVerifier.verifyChannel({
        workspaceId,
        tenantId: ownership.tenantId,
        channelId,
      });
    } catch {
      channelAuthorized = false;
    }

    if (channelAuthorized !== true) {
      return { status: "unauthorized", evidence: null };
    }

    const result = signalHistory.findBySlackDelivery({
      channelId,
      timestamp: parentMessageTs,
    });

    if (result.status !== "found") {
      return { status: result.status, evidence: null };
    }

    const record = result.signal;

    return {
      status: "found",
      evidence: {
        signalId: record.id,
        source: record.source ?? null,
        service: record.service ?? null,
        severity: record.severity ?? null,
        state: record.state ?? null,
        operationalState: record.operationalState ?? null,
        receivedAt: record.receivedAt ?? null,
        analysisSummary: record.analysis?.summary ?? null,
      },
    };
  }

  return Object.freeze({ resolveThread });
}

module.exports = { createSlackThreadCorrelation };
