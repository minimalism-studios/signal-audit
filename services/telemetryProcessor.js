const {
  SIGNAL_STATES,
} = require("../constants/signalStates");

function createTelemetryProcessor({
  source,
  signalHistory,
  analyzeSignal,
}) {
  if (
    typeof source !== "string"
    || source.trim() === ""
  ) {
    throw new Error(
      "Telemetry processor source is required.",
    );
  }

  if (!signalHistory) {
    throw new Error(
      "signalHistory is required.",
    );
  }

  if (
    typeof analyzeSignal !== "function"
  ) {
    throw new Error(
      "analyzeSignal is required.",
    );
  }

  const normalizedSource =
    source.trim().toLowerCase();

  return async function processSignal(
    signal,
  ) {
    if (
      !signal
      || typeof signal !== "object"
    ) {
      throw new Error(
        "Signal is required.",
      );
    }

    if (
      signal.source
      && signal.source
        .toLowerCase()
        !== normalizedSource
    ) {
      throw new Error(
        `Expected ${normalizedSource} signal but received ${signal.source}.`,
      );
    }

    /*
     * Signal Audit becomes the system
     * of record immediately.
     */
    const historyRecord =
      signalHistory.saveSignal({
        ...signal,
        source:
          normalizedSource,
      });

    try {
      const auditResult =
        await analyzeSignal(
          signal,
        );

      const analyzedRecord =
        signalHistory.updateSignal(
          historyRecord.id,
          {
            state:
              SIGNAL_STATES.ANALYZED,

            analysis:
              auditResult,

            analyzedAt:
              new Date().toISOString(),

            failureReason:
              null,
          },
        );

      return {
        historyId:
          historyRecord.id,

        state:
          analyzedRecord.state,

        signal:
          analyzedRecord,

        auditResult,
      };
    } catch (error) {
      signalHistory.updateSignal(
        historyRecord.id,
        {
          state:
            SIGNAL_STATES.FAILED,

          failureReason:
            error.message,

          failedAt:
            new Date().toISOString(),
        },
      );

      throw error;
    }
  };
}

module.exports = {
  createTelemetryProcessor,
};
