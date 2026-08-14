const {
  createTelemetryProcessor,
} = require(
  "../../services/telemetryProcessor",
);

function createDatadogProcessor({
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

    analyzeSignal:
      signalAuditService
        .runDatadogFindingAudit,
  });
}

module.exports = {
  createDatadogProcessor,
};
