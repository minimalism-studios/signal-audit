const {
  createTelemetryProcessor,
} = require(
  "../../services/telemetryProcessor",
);

function createGatekeeperProcessor({
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
      .runStructuredAudit
    !== "function"
  ) {
    throw new Error(
      "signalAuditService.runStructuredAudit is required.",
    );
  }

  return createTelemetryProcessor({
    source:
      "gatekeeper",

    signalHistory,

    analyzeSignal:
      (signal) =>
        signalAuditService
          .runStructuredAudit({
            source:
              "gatekeeper",
            signal,
          }),
  });
}

module.exports = {
  createGatekeeperProcessor,
};
