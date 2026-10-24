const {
  createTelemetryProcessor,
} = require(
  "../../services/telemetryProcessor",
);

function createGrafanaProcessor({
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
      .runGrafanaFindingAudit
    !== "function"
  ) {
    throw new Error(
      "signalAuditService.runGrafanaFindingAudit is required.",
    );
  }

  return createTelemetryProcessor({
    source:
      "grafana",

    signalHistory,
    connectionStore,
    slackDeliveryService,

    analyzeSignal:
      signalAuditService
        .runGrafanaFindingAudit,
  });
}

module.exports = {
  createGrafanaProcessor,
};
