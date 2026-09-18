const {
  normalizeGatekeeperSignal,
} = require("./normalizer");

function createGatekeeperWebhookHandler({
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

  if (
    typeof webhookSecret !== "string"
    || !webhookSecret.trim()
  ) {
    throw new Error(
      "Gatekeeper webhook secret is required.",
    );
  }

  return async function gatekeeperWebhookHandler(
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
      || typeof payload !== "object"
      || Array.isArray(payload)
    ) {
      return res.status(400).json({
        accepted:
          false,
        error:
          "Invalid Gatekeeper webhook payload.",
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
      !== "gatekeeper"
    ) {
      return res.status(400).json({
        accepted:
          false,
        error:
          `Connection "${connectionId}" is not a Gatekeeper connection.`,
      });
    }

    const signal =
      normalizeGatekeeperSignal(
        payload,
        connectionId,
      );

    /*
     * Acknowledge ingestion immediately.
     *
     * Signal Audit processing continues after
     * Gatekeeper receives the 202 response.
     */
    res.status(202).json({
      accepted:
        true,
      connectionId,
      signalsReceived:
        1,
    });

    try {
      await processSignal(
        signal,
      );
    } catch (error) {
      console.error(
        "Gatekeeper Signal Audit processing error:",
        error,
      );
    }
  };
}

module.exports = {
  createGatekeeperWebhookHandler,
};
