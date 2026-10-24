const {
  createTelemetryProcessor,
} = require(
  "../../services/telemetryProcessor",
);

function createDatadogProcessor({
  signalAuditService,
  signalHistory,
  connectionStore = null,
  slackDeliveryService = null,
}) {
  if (!signalAuditService) {
    throw new Error(
      "signalAuditService is required.",
    );
  }

  if (
    typeof signalAuditService
      .runDatadogFindingAudit
    !== "function"
  ) {
    throw new Error(
      "signalAuditService.runDatadogFindingAudit is required.",
    );
  }

  return createTelemetryProcessor({
    source:
      "datadog",

    signalHistory,
    connectionStore,
    slackDeliveryService,

    analyzeSignal:
      signalAuditService
        .runDatadogFindingAudit,
  });
}

module.exports = {
  createDatadogProcessor,
};
