const crypto =
  require("crypto");

const {
  normalizeGatekeeperSignal,
} = require("./normalizer");

const OASSE_SIGNATURE_PREFIX =
  "v1=";

const OASSE_MAX_TIMESTAMP_SKEW_SECONDS =
  300;

function createOasseSignature({
  signingSecret,
  timestamp,
  rawBody,
}) {
  return crypto
    .createHmac(
      "sha256",
      signingSecret,
    )
    .update(
      Buffer.concat([
        Buffer.from(
          `${timestamp}.`,
          "ascii",
        ),
        rawBody,
      ]),
    )
    .digest("hex");
}

function signaturesMatch(
  providedSignature,
  expectedSignature,
) {
  if (
    typeof providedSignature !== "string"
    || !providedSignature.startsWith(
      OASSE_SIGNATURE_PREFIX,
    )
  ) {
    return false;
  }

  const providedHex =
    providedSignature.slice(
      OASSE_SIGNATURE_PREFIX.length,
    );

  if (
    !/^[0-9a-f]{64}$/.test(providedHex)
  ) {
    return false;
  }

  const providedBuffer =
    Buffer.from(
      providedHex,
      "hex",
    );

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "hex",
    );

  if (
    providedBuffer.length
    !== expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    expectedBuffer,
  );
}

function validateOasseTimestamp(
  timestamp,
  {
    nowSeconds =
      Math.floor(Date.now() / 1000),
  } = {},
) {
  if (
    typeof timestamp !== "string"
    || !/^[0-9]+$/.test(timestamp)
  ) {
    return false;
  }

  const timestampSeconds =
    Number(timestamp);

  if (
    !Number.isSafeInteger(timestampSeconds)
  ) {
    return false;
  }

  return (
    Math.abs(
      nowSeconds - timestampSeconds,
    )
    <= OASSE_MAX_TIMESTAMP_SKEW_SECONDS
  );
}

const OASSE_SCHEMA_VERSION =
  "oasse.signal_audit.webhook.v1";

const OASSE_EVENT_TYPE =
  "gatekeeper.decision.finalized";

const OASSE_DECISIONS =
  new Set([
    "ALLOW",
    "HOLD",
    "ESCALATE",
    "BLOCK",
  ]);

const OASSE_INTERNAL_OUTCOMES =
  new Set([
    "ALLOW",
    "BLOCK",
    "REVIEW",
    "REDIRECT",
    "ABSTAIN",
  ]);

function isNonEmptyString(value) {
  return (
    typeof value === "string"
    && value.trim() !== ""
  );
}

function isPlainObject(value) {
  return (
    value
    && typeof value === "object"
    && !Array.isArray(value)
  );
}

function validateOassePayload(
  payload,
) {
  if (!isPlainObject(payload)) {
    return "Payload must be a JSON object.";
  }

  if (
    payload.schema_version
    !== OASSE_SCHEMA_VERSION
  ) {
    return "Invalid schema_version.";
  }

  if (
    payload.event_type
    !== OASSE_EVENT_TYPE
  ) {
    return "Invalid event_type.";
  }

  if (
    !isNonEmptyString(
      payload.event_id,
    )
    || !/^gkwh-[0-9a-f]{24}$/.test(
      payload.event_id,
    )
  ) {
    return "Invalid event_id.";
  }

  const requiredStrings = [
    "pilot_id",
    "tenant_id",
    "request_id",
    "idempotency_key",
    "decision",
    "internal_outcome",
    "created_at",
  ];

  for (
    const field
    of requiredStrings
  ) {
    if (
      !isNonEmptyString(
        payload[field],
      )
    ) {
      return `Invalid ${field}.`;
    }
  }

  if (
    payload.benchmark_case_id
      !== null
    && !isNonEmptyString(
      payload.benchmark_case_id,
    )
  ) {
    return "Invalid benchmark_case_id.";
  }

  if (
    !OASSE_DECISIONS.has(
      payload.decision,
    )
  ) {
    return "Invalid decision.";
  }

  if (
    !OASSE_INTERNAL_OUTCOMES.has(
      payload.internal_outcome,
    )
  ) {
    return "Invalid internal_outcome.";
  }

  for (
    const field
    of [
      "policy",
      "authority",
      "context",
      "trace",
    ]
  ) {
    if (
      !isPlainObject(
        payload[field],
      )
    ) {
      return `Invalid ${field}.`;
    }
  }

  if (
    !isPlainObject(
      payload.receipt,
    )
    || !isNonEmptyString(
      payload.receipt.receipt_id,
    )
    || !isNonEmptyString(
      payload.receipt.created_at,
    )
  ) {
    return "Invalid receipt.";
  }

  return null;
}

function createGatekeeperWebhookHandler({
  processSignal,
  webhookSecret,
  signingSecret = null,
  connectionStore,
  signalHistory = null,
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
    const connectionId =
      req.params.connectionId;

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

    const webhookAuth =
      connection.metadata
        ?.webhookAuth
      || "bearer";

    if (
      webhookAuth
      === "oasse-hmac-v1"
    ) {
      if (
        typeof signingSecret
          !== "string"
        || !signingSecret.trim()
      ) {
        console.error(
          "Gatekeeper signed webhook secret is not configured.",
        );

        return res.status(503).json({
          accepted:
            false,
          error:
            "Signed webhook transport is unavailable.",
        });
      }

      if (
        !Buffer.isBuffer(
          req.rawBody,
        )
      ) {
        return res.status(400).json({
          accepted:
            false,
          error:
            "Raw webhook body is required.",
        });
      }

      const timestamp =
        req.get(
          "x-oasse-webhook-timestamp",
        );

      const providedSignature =
        req.get(
          "x-oasse-webhook-signature",
        );

      if (
        !validateOasseTimestamp(
          timestamp,
        )
      ) {
        return res.status(401).json({
          accepted:
            false,
          error:
            "Invalid webhook timestamp.",
        });
      }

      const expectedSignature =
        createOasseSignature({
          signingSecret,
          timestamp,
          rawBody:
            req.rawBody,
        });

      if (
        !signaturesMatch(
          providedSignature,
          expectedSignature,
        )
      ) {
        return res.status(401).json({
          accepted:
            false,
          error:
            "Invalid webhook signature.",
        });
      }

      let payload;

      try {
        payload =
          JSON.parse(
            req.rawBody.toString(
              "utf8",
            ),
          );
      } catch (error) {
        return res.status(400).json({
          accepted:
            false,
          error:
            "Invalid Gatekeeper webhook JSON.",
        });
      }

      const webhookId =
        req.get(
          "x-oasse-webhook-id",
        );

      const transportIdempotencyKey =
        req.get(
          "idempotency-key",
        );

      if (
        !isNonEmptyString(
          webhookId,
        )
        || !isNonEmptyString(
          transportIdempotencyKey,
        )
      ) {
        return res.status(400).json({
          accepted:
            false,
          error:
            "Required webhook identity headers are missing.",
        });
      }

      const payloadValidationError =
        validateOassePayload(
          payload,
        );

      if (
        payloadValidationError
      ) {
        return res.status(400).json({
          accepted:
            false,
          error:
            payloadValidationError,
        });
      }

      if (
        webhookId
        !== payload.event_id
      ) {
        return res.status(400).json({
          accepted:
            false,
          error:
            "Webhook event identity mismatch.",
        });
      }

      if (
        transportIdempotencyKey
        !== payload.event_id
      ) {
        return res.status(400).json({
          accepted:
            false,
          error:
            "Webhook idempotency identity mismatch.",
        });
      }

      if (
        !signalHistory
        || typeof signalHistory
          .findByExternalEvent
          !== "function"
      ) {
        console.error(
          "Gatekeeper signed webhook replay protection is unavailable.",
        );

        return res.status(503).json({
          accepted:
            false,
          error:
            "Signed webhook replay protection is unavailable.",
        });
      }

      const existingEvent =
        signalHistory
          .findByExternalEvent({
            connectionId,
            source:
              "gatekeeper",
            eventId:
              payload.event_id,
          });

      if (existingEvent) {
        return res.status(200).json({
          accepted:
            true,
          duplicate:
            true,
          connectionId,
          eventId:
            payload.event_id,
        });
      }

      req.body =
        payload;
    } else {
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

      if (Buffer.isBuffer(req.rawBody)) {
        try {
          req.body =
            JSON.parse(
              req.rawBody.toString(
                "utf8",
              ),
            );
        } catch (error) {
          return res.status(400).json({
            accepted:
              false,
            error:
              "Invalid Gatekeeper webhook JSON.",
          });
        }
      }
    }

    const payload =
      req.body;

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

    const signal =
      normalizeGatekeeperSignal(
        payload,
        connectionId,
      );

    if (
      webhookAuth
      === "oasse-hmac-v1"
    ) {
      /*
       * processSignal() persists the RECEIVED
       * record synchronously before its first
       * asynchronous analysis boundary.
       *
       * Start processing, confirm durable
       * event_id persistence, then acknowledge
       * transport acceptance. Analysis and
       * downstream delivery may continue after
       * the 202 response.
       */
      const processingPromise =
        processSignal(
          signal,
        );

      const persistedEvent =
        signalHistory
          .findByExternalEvent({
            connectionId,
            source:
              "gatekeeper",
            eventId:
              signal.eventId,
          });

      if (!persistedEvent) {
        processingPromise.catch(
          (error) => {
            console.error(
              "Gatekeeper Signal Audit processing error:",
              error,
            );
          },
        );

        return res.status(503).json({
          accepted:
            false,
          error:
            "Gatekeeper event was not persisted.",
        });
      }

      res.status(202).json({
        accepted:
          true,
        duplicate:
          false,
        connectionId,
        eventId:
          signal.eventId,
        signalsReceived:
          1,
      });

      try {
        await processingPromise;
      } catch (error) {
        console.error(
          "Gatekeeper Signal Audit processing error:",
          error,
        );
      }

      return;
    }

    /*
     * Preserve the existing Bearer-authenticated
     * Gatekeeper transport behavior.
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
