const {
  SIGNAL_STATES,
} = require(
  "../../constants/signalStates",
);

const {
  createTelemetryProcessor,
} = require(
  "../../services/telemetryProcessor",
);

const {
  formatSlackAuditMessage,
} = require(
  "../slack/formatter",
);

const {
  createGatekeeperAcknowledgement,
} = require(
  "./acknowledgement",
);

function createGatekeeperProcessor({
  signalAuditService,
  signalHistory,
  connectionStore,
  slackDeliveryService = null,
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

  if (!signalHistory) {
    throw new Error(
      "signalHistory is required.",
    );
  }

  if (!connectionStore) {
    throw new Error(
      "connectionStore is required.",
    );
  }

  if (
    typeof signalHistory
      .findByExternalReceipt
    !== "function"
  ) {
    throw new Error(
      "signalHistory.findByExternalReceipt is required.",
    );
  }

  const processTelemetry =
    createTelemetryProcessor({
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

  return async function processGatekeeperSignal(
    signal,
  ) {
    const existingSignal =
      signalHistory
        .findByExternalReceipt({
          connectionId:
            signal.connectionId,
          source:
            "gatekeeper",
          receiptId:
            signal.receiptId,
        });

    if (
      existingSignal
      && existingSignal.state
        !== SIGNAL_STATES.FAILED
      && existingSignal.state
        !== SIGNAL_STATES.RECEIVED
    ) {
      return {
        historyId:
          existingSignal.id,
        state:
          existingSignal.state,
        signal:
          existingSignal,
        auditResult:
          existingSignal.analysis,
        duplicate:
          true,

        acknowledgement:
          createGatekeeperAcknowledgement({
            historyRecord:
              existingSignal,
          }),
      };
    }

    const result =
      await processTelemetry(
        signal,
        {
          existingHistoryRecord:
            existingSignal
            && (
              existingSignal.state
                === SIGNAL_STATES.FAILED
              || existingSignal.state
                === SIGNAL_STATES.RECEIVED
            )
              ? existingSignal
              : null,
        },
      );

    const acknowledgement =
      createGatekeeperAcknowledgement({
        historyRecord:
          result.signal,
      });

    const resultWithAcknowledgement = {
      ...result,
      acknowledgement,
    };

    const connection =
      connectionStore.getConnection(
        signal.connectionId,
      );

    const slackOutput =
      connection.outputs?.slack;

    if (
      !slackOutput
      || slackOutput.enabled !== true
    ) {
      return resultWithAcknowledgement;
    }

    if (
      !slackDeliveryService
      || typeof slackDeliveryService
        .postMessage !== "function"
    ) {
      const deliveryError =
        "Slack output is enabled but Slack delivery is not configured.";

      const updatedSignal =
        signalHistory.updateSignal(
          result.historyId,
          {
            /*
             * Analysis succeeded.
             * Missing delivery configuration
             * must not change that outcome.
             */
            state:
              SIGNAL_STATES.ANALYZED,

            delivery: {
              status:
                "failed",
              destination:
                "slack",
              channelId:
                slackOutput.channelId
                || null,
              attemptedAt:
                new Date().toISOString(),
              error:
                deliveryError,
            },
          },
        );

      return {
        ...resultWithAcknowledgement,
        signal:
          updatedSignal,
      };
    }

    try {
      const text =
        formatSlackAuditMessage({
          signal,
          auditResult:
            result.auditResult,
        });

      const deliveryResult =
        await slackDeliveryService
          .postMessage({
            channelId:
              slackOutput.channelId,
            text,
          });

      const deliveredAt =
        new Date().toISOString();

      const updatedSignal =
        signalHistory.updateSignal(
          result.historyId,
          {
            state:
              SIGNAL_STATES.DELIVERED,

            delivery: {
              status:
                "delivered",
              destination:
                "slack",
              channelId:
                deliveryResult.channelId,
              timestamp:
                deliveryResult.timestamp,
              deliveredAt,
            },
          },
        );

      return {
        ...resultWithAcknowledgement,
        state:
          updatedSignal.state,
        signal:
          updatedSignal,
      };
    } catch (error) {
      const updatedSignal =
        signalHistory.updateSignal(
          result.historyId,
          {
            /*
             * Analysis succeeded.
             * Preserve ANALYZED state when
             * downstream delivery fails.
             */
            state:
              SIGNAL_STATES.ANALYZED,

            delivery: {
              status:
                "failed",
              destination:
                "slack",
              channelId:
                slackOutput.channelId
                || null,
              attemptedAt:
                new Date().toISOString(),
              error:
                error.message,
            },
          },
        );

      return {
        ...resultWithAcknowledgement,
        state:
          updatedSignal.state,
        signal:
          updatedSignal,
      };
    }
  };
}

module.exports = {
  createGatekeeperProcessor,
};
