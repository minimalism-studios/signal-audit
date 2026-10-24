const {
  SIGNAL_STATES,
} = require("../constants/signalStates");

const {
  formatTelemetrySlackMessage,
} = require("../integrations/slack/telemetryFormatter");

function createTelemetryProcessor({
  source,
  signalHistory,
  analyzeSignal,
  connectionStore = null,
  slackDeliveryService = null,
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
    {
      existingHistoryRecord = null,
    } = {},
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
      existingHistoryRecord
      || signalHistory.saveSignal({
        ...signal,
        source:
          normalizedSource,
      });

    let analyzedResult;

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
            failedAt:
              null,
          },
        );

      analyzedResult = {
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

    if (!connectionStore || !signal.connectionId) {
      return analyzedResult;
    }

    let slackOutput;

    try {
      const connection = connectionStore.getConnection(
        signal.connectionId,
      );

      slackOutput = connection?.outputs?.slack;
    } catch (error) {
      const updatedRecord = signalHistory.updateSignal(
        historyRecord.id,
        {
          delivery: {
            status: "failed",
            destination: "slack",
            attemptedAt: new Date().toISOString(),
            error: `Connection lookup failed: ${error.message}`,
          },
        },
      );

      return {
        ...analyzedResult,
        signal: updatedRecord,
      };
    }

    if (!slackOutput?.enabled || !slackOutput.channelId) {
      return analyzedResult;
    }

    const attemptedAt = new Date().toISOString();

    try {
      if (!slackDeliveryService) {
        throw new Error("Slack delivery service is unavailable.");
      }

      const text = formatTelemetrySlackMessage({
        signal,
        auditResult: analyzedResult.auditResult,
      });

      const delivery = await slackDeliveryService.postMessage({
        channelId: slackOutput.channelId,
        text,
      });

      const updatedRecord = signalHistory.updateSignal(
        historyRecord.id,
        {
          state: SIGNAL_STATES.DELIVERED,
          delivery: {
            status: "delivered",
            destination: "slack",
            channelId: delivery.channelId,
            timestamp: delivery.timestamp,
            deliveredAt: new Date().toISOString(),
          },
        },
      );

      return {
        ...analyzedResult,
        state: updatedRecord.state,
        signal: updatedRecord,
      };
    } catch (error) {
      const updatedRecord = signalHistory.updateSignal(
        historyRecord.id,
        {
          delivery: {
            status: "failed",
            destination: "slack",
            channelId: slackOutput.channelId,
            attemptedAt,
            error: error.message,
          },
        },
      );

      return {
        ...analyzedResult,
        signal: updatedRecord,
      };
    }
  };
}

module.exports = {
  createTelemetryProcessor,
};
