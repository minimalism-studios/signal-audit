const {
  normalizeGrafanaAlert,
} = require("./normalizer");

function createGrafanaWebhookHandler({
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

  return async function grafanaWebhookHandler(
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

    const notification =
      req.body;

    const connectionId =
      req.params.connectionId;

    if (
      !notification
      || !Array.isArray(
        notification.alerts,
      )
    ) {
      return res.status(400).json({
        accepted:
          false,

        error:
          "Invalid Grafana webhook payload.",
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
      !== "grafana"
    ) {
      return res.status(400).json({
        accepted:
          false,

        error:
          `Connection "${connectionId}" is not a Grafana connection.`,
      });
    }

    const signals =
      notification.alerts.map(
        (alert) =>
          normalizeGrafanaAlert(
            notification,
            alert,
            connectionId,
          ),
      );

    /*
     * Acknowledge ingestion immediately.
     *
     * Signal processing continues after
     * Grafana receives the 202 response.
     */
    res.status(202).json({
      accepted:
        true,

      connectionId,

      alertsReceived:
        signals.length,
    });

    for (
      const signal
      of signals
    ) {
      try {
        await processSignal(
          signal,
        );
      } catch (error) {
        console.error(
          "Grafana Signal Audit processing error:",
          error,
        );
      }
    }
  };
}

module.exports = {
  createGrafanaWebhookHandler,
};
