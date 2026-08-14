const {
  normalizeDatadogAlert,
} = require("./normalizer");

function createDatadogWebhookHandler({
  processSignal,
  webhookSecret,
  connectionStore,
}) {
  if (
    typeof processSignal
    !== "function"
  ) {
    throw new Error(
      "processSignal is required.",
    );
  }

  if (!connectionStore) {
    throw new Error(
      "connectionStore is required.",
    );
  }

  return async function datadogWebhookHandler(
    req,
    res,
  ) {
    const authorization =
      req.get("authorization");

    if (
      webhookSecret
      && authorization
        !== `Bearer ${webhookSecret}`
    ) {
      return res.status(401).json({
        accepted:
          false,

        error:
          "Unauthorized",
      });
    }

    const payload =
      req.body;

    const connectionId =
      req.params.connectionId;

    if (
      !payload
      || typeof payload
        !== "object"
      || Array.isArray(payload)
    ) {
      return res.status(400).json({
        accepted:
          false,

        error:
          "Invalid Datadog webhook payload.",
      });
    }

    let connection;

    try {
      connection =
        connectionStore.getConnection(
          connectionId,
        );
    } catch (error) {
      return res.status(404).json({
        accepted:
          false,

        error:
          error.message,
      });
    }

    if (
      connection.source
      !== "datadog"
    ) {
      return res.status(400).json({
        accepted:
          false,

        error:
          `Connection "${connectionId}" is not a Datadog connection.`,
      });
    }

    const signal =
      normalizeDatadogAlert(
        payload,
        connectionId,
      );

    /*
     * Acknowledge ingestion immediately.
     */
    res.status(202).json({
      accepted:
        true,

      connectionId,

      alertsReceived:
        1,
    });

    try {
      await processSignal(
        signal,
      );
    } catch (error) {
      console.error(
        "Datadog Signal Audit processing error:",
        error,
      );
    }
  };
}

module.exports = {
  createDatadogWebhookHandler,
};
