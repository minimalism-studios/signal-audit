const {
  createTelemetryProcessor,
} = require(
  "../../services/telemetryProcessor",
);

function createGrafanaProcessor({
  signalAuditService,
  signalHistory,
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

    analyzeSignal:
      signalAuditService
        .runGrafanaFindingAudit,
  });
}

module.exports = {
  createGrafanaProcessor,
};
