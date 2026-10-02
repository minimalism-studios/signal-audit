const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  createSignalHistory,
} = require(
  "../services/signalHistory",
);

const {
  createGatekeeperWebhookHandler,
} = require(
  "../integrations/gatekeeper/webhook",
);

function createResponse() {
  return {
    statusCode:
      null,
    body:
      null,

    status(code) {
      this.statusCode =
        code;

      return this;
    },

    json(body) {
      this.body =
        body;

      return this;
    },
  };
}

function signBody({
  signingSecret,
  timestamp,
  rawBody,
}) {
  return (
    "v1="
    + crypto
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
      .digest("hex")
  );
}

function createPayload({
  eventId =
    "gkwh-0123456789abcdef01234567",
} = {}) {
  return {
    schema_version:
      "oasse.signal_audit.webhook.v1",

    event_type:
      "gatekeeper.decision.finalized",

    event_id:
      eventId,

    pilot_id:
      "oasse-signal-audit-vanguard-2026-09-21",

    tenant_id:
      "oasse",

    benchmark_case_id:
      "SA-SIGNED-WEBHOOK-001",

    request_id:
      "request-signed-webhook-001",

    idempotency_key:
      "request-idempotency-001",

    decision:
      "HOLD",

    internal_outcome:
      "REVIEW",

    policy: {
      policy_id:
        "test-policy",
    },

    authority: {
      system:
        "gatekeeper",
    },

    context: {
      environment:
        "staging",
    },

    trace: {
      correlation_id:
        "correlation-signed-webhook-001",
    },

    receipt: {
      receipt_id:
        "receipt-signed-webhook-001",

      created_at:
        "2026-09-25T20:00:00.000Z",
    },

    created_at:
      "2026-09-25T20:00:00.000Z",
  };
}

function createRequest({
  payload,
  signingSecret,
  timestamp =
    String(
      Math.floor(
        Date.now() / 1000,
      ),
    ),
  signature = null,
  webhookId = null,
  idempotencyKey = null,
}) {
  /*
   * Compact JSON is sufficient for this test.
   * The important property is that the exact
   * same bytes are signed and presented to
   * the receiver as req.rawBody.
   */
  const rawBody =
    Buffer.from(
      JSON.stringify(payload),
      "utf8",
    );

  const headers = {
    "x-oasse-webhook-timestamp":
      timestamp,

    "x-oasse-webhook-signature":
      signature
      || signBody({
        signingSecret,
        timestamp,
        rawBody,
      }),

    "x-oasse-webhook-id":
      webhookId
      || payload.event_id,

    "idempotency-key":
      idempotencyKey
      || payload.event_id,
  };

  return {
    /*
     * Production Gatekeeper requests arrive
     * through express.raw(). The handler must
     * authenticate these bytes before parsing.
     */
    body:
      rawBody,

    rawBody,

    params: {
      connectionId:
        "oasse-gatekeeper",
    },

    get(name) {
      return (
        headers[
          name.toLowerCase()
        ]
        || undefined
      );
    },
  };
}

test(
  "validates OASSE signed webhook transport and suppresses replay",
  async () => {
    const tempDirectory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "gatekeeper-signed-webhook-",
        ),
      );

    try {
      const signalHistory =
        createSignalHistory({
          filePath:
            path.join(
              tempDirectory,
              "signal-history.json",
            ),
        });

      const connectionStore = {
        getConnection(
          connectionId,
        ) {
          assert.equal(
            connectionId,
            "oasse-gatekeeper",
          );

          return {
            connectionId,
            source:
              "gatekeeper",

            metadata: {
              environment:
                "staging",

              webhookAuth:
                "oasse-hmac-v1",
            },

            outputs: {},
          };
        },
      };

      const signingSecret =
        "synthetic-oasse-signing-secret";

      let processingAttempts = 0;

      async function processSignal(
        signal,
      ) {
        processingAttempts += 1;

        const record =
          signalHistory.saveSignal(
            signal,
          );

        return {
          historyId:
            record.id,
          state:
            record.state,
          signal:
            record,
        };
      }

      const handler =
        createGatekeeperWebhookHandler({
          processSignal,
          webhookSecret:
            "legacy-bearer-secret",
          signingSecret,
          connectionStore,
          signalHistory,
        });

      const payload =
        createPayload();

      /*
       * First valid delivery:
       * authenticated, persisted, accepted.
       */
      const firstRequest =
        createRequest({
          payload,
          signingSecret,
        });

      const firstResponse =
        createResponse();

      await handler(
        firstRequest,
        firstResponse,
      );

      assert.equal(
        firstResponse.statusCode,
        202,
      );

      assert.equal(
        firstResponse.body.accepted,
        true,
      );

      assert.equal(
        firstResponse.body.duplicate,
        false,
      );

      assert.equal(
        firstResponse.body.eventId,
        payload.event_id,
      );

      assert.equal(
        processingAttempts,
        1,
      );

      const persisted =
        signalHistory
          .findByExternalEvent({
            connectionId:
              "oasse-gatekeeper",
            source:
              "gatekeeper",
            eventId:
              payload.event_id,
          });

      assert.ok(
        persisted,
      );

      assert.equal(
        persisted.signal.eventId,
        payload.event_id,
      );

      assert.equal(
        persisted.signal.receiptId,
        payload.receipt.receipt_id,
      );

      assert.equal(
        persisted.signal.decision,
        "hold",
      );

      assert.equal(
        persisted.signal.internalOutcome,
        "REVIEW",
      );

      assert.equal(
        persisted.signal.correlationId,
        "correlation-signed-webhook-001",
      );

      /*
       * Replay:
       * valid transport, same event_id,
       * successful 200, no second processing.
       */
      const replayRequest =
        createRequest({
          payload,
          signingSecret,
        });

      const replayResponse =
        createResponse();

      await handler(
        replayRequest,
        replayResponse,
      );

      assert.equal(
        replayResponse.statusCode,
        200,
      );

      assert.equal(
        replayResponse.body.accepted,
        true,
      );

      assert.equal(
        replayResponse.body.duplicate,
        true,
      );

      assert.equal(
        processingAttempts,
        1,
      );

      assert.equal(
        signalHistory
          .listAllSignals()
          .length,
        1,
      );

      /*
       * Invalid HMAC must not process.
       */
      const invalidSignatureRequest =
        createRequest({
          payload:
            createPayload({
              eventId:
                "gkwh-1123456789abcdef01234567",
            }),
          signingSecret,
          signature:
            `v1=${"0".repeat(64)}`,
        });

      const invalidSignatureResponse =
        createResponse();

      await handler(
        invalidSignatureRequest,
        invalidSignatureResponse,
      );

      assert.equal(
        invalidSignatureResponse
          .statusCode,
        401,
      );

      assert.equal(
        processingAttempts,
        1,
      );

      /*
       * Stale timestamp must not process.
       */
      const staleTimestamp =
        String(
          Math.floor(
            Date.now() / 1000,
          ) - 301,
        );

      const staleRequest =
        createRequest({
          payload:
            createPayload({
              eventId:
                "gkwh-2123456789abcdef01234567",
            }),
          signingSecret,
          timestamp:
            staleTimestamp,
        });

      const staleResponse =
        createResponse();

      await handler(
        staleRequest,
        staleResponse,
      );

      assert.equal(
        staleResponse.statusCode,
        401,
      );

      assert.equal(
        processingAttempts,
        1,
      );

      /*
       * Header/payload event identity mismatch
       * must not process.
       */
      const mismatchPayload =
        createPayload({
          eventId:
            "gkwh-3123456789abcdef01234567",
        });

      const mismatchRequest =
        createRequest({
          payload:
            mismatchPayload,
          signingSecret,
          webhookId:
            "gkwh-4123456789abcdef01234567",
        });

      const mismatchResponse =
        createResponse();

      await handler(
        mismatchRequest,
        mismatchResponse,
      );

      assert.equal(
        mismatchResponse.statusCode,
        400,
      );

      assert.equal(
        processingAttempts,
        1,
      );
    } finally {
      fs.rmSync(
        tempDirectory,
        {
          recursive:
            true,
          force:
            true,
        },
      );
    }
  },
);


test(
  "accepts and preserves OASSE Gatekeeper v1.1 semantic envelope",
  async () => {
    const tempDirectory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "signal-audit-gatekeeper-v1-1-",
        ),
      );

    try {
      const signingSecret =
        "test-oasse-signing-secret";

      const connectionStore = {
        getConnection(
          connectionId,
        ) {
          assert.equal(
            connectionId,
            "oasse-gatekeeper",
          );

          return {
            connectionId,
            source:
              "gatekeeper",

            metadata: {
              environment:
                "staging",
              webhookAuth:
                "oasse-hmac-v1",
            },

            outputs: {},
          };
        },
      };

      const signalHistory =
        createSignalHistory({
          filePath:
            path.join(
              tempDirectory,
              "signal-history.json",
            ),
        });

      let processingAttempts = 0;

      async function processSignal(
        signal,
      ) {
        processingAttempts += 1;

        const record =
          signalHistory.saveSignal(
            signal,
          );

        return {
          historyId:
            record.id,
          state:
            record.state,
          signal:
            record,
        };
      }

      const handler =
        createGatekeeperWebhookHandler({
          processSignal,
          signingSecret,
          connectionStore,
          signalHistory,
        });

      const payload =
        createPayload({
          eventId:
            "gkwh-5123456789abcdef01234567",
        });

      payload.schema_version =
        "oasse.signal_audit.webhook.v1.1";

      payload.decision =
        "HOLD";

      payload.internal_outcome =
        "ABSTAIN";

      payload.semantics = {
        authoritative_summary:
          "Gatekeeper held the proposed action because sufficient authority or evidence was not available.",
        execution_permitted:
          false,
        enforcement_effect:
          "HOLD",
        reason_code:
          "ABSTAIN",
        resolution_requirement:
          "SUFFICIENT_AUTHORITY_OR_EVIDENCE",
        owner:
          "OASSE",
        owner_team:
          "Gatekeeper",
      };

      const request =
        createRequest({
          payload,
          signingSecret,
        });

      const response =
        createResponse();

      await handler(
        request,
        response,
      );

      assert.equal(
        response.statusCode,
        202,
      );

      assert.equal(
        response.body.accepted,
        true,
      );

      assert.equal(
        response.body.duplicate,
        false,
      );

      assert.equal(
        processingAttempts,
        1,
      );

      const persisted =
        signalHistory
          .findByExternalEvent({
            connectionId:
              "oasse-gatekeeper",
            source:
              "gatekeeper",
            eventId:
              payload.event_id,
          });

      assert.ok(
        persisted,
      );

      assert.equal(
        persisted.signal.schemaVersion,
        "oasse.signal_audit.webhook.v1.1",
      );

      assert.deepEqual(
        persisted.signal.semantics,
        payload.semantics,
      );

      assert.equal(
        persisted.signal.authoritativeSummary,
        payload.semantics
          .authoritative_summary,
      );

      assert.equal(
        persisted.signal.executionPermitted,
        false,
      );

      assert.equal(
        persisted.signal.enforcementEffect,
        "HOLD",
      );

      assert.equal(
        persisted.signal.reasonCode,
        "ABSTAIN",
      );

      assert.equal(
        persisted.signal.resolutionRequirement,
        "SUFFICIENT_AUTHORITY_OR_EVIDENCE",
      );

      assert.equal(
        persisted.signal.authoritativeOwner,
        "OASSE",
      );

      assert.equal(
        persisted.signal.authoritativeOwnerTeam,
        "Gatekeeper",
      );

      /*
       * Authoritative ownership must not overwrite
       * Signal Audit's existing team interpretation.
       */
      assert.notEqual(
        persisted.signal.team,
        payload.semantics.owner_team,
      );
    } finally {
      fs.rmSync(
        tempDirectory,
        {
          recursive:
            true,
          force:
            true,
        },
      );
    }
  },
);

test(
  "rejects OASSE Gatekeeper v1.1 without semantic envelope",
  async () => {
    const tempDirectory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "signal-audit-gatekeeper-v1-1-invalid-",
        ),
      );

    try {
      const signingSecret =
        "test-oasse-signing-secret";

      const connectionStore = {
        getConnection(
          connectionId,
        ) {
          assert.equal(
            connectionId,
            "oasse-gatekeeper",
          );

          return {
            connectionId,
            source:
              "gatekeeper",

            metadata: {
              environment:
                "staging",
              webhookAuth:
                "oasse-hmac-v1",
            },

            outputs: {},
          };
        },
      };

      const signalHistory =
        createSignalHistory({
          filePath:
            path.join(
              tempDirectory,
              "signal-history.json",
            ),
        });

      let processingAttempts = 0;

      const handler =
        createGatekeeperWebhookHandler({
          signingSecret,
          connectionStore,
          signalHistory,
          processSignal:
            async () => {
              processingAttempts += 1;
            },
        });

      const payload =
        createPayload({
          eventId:
            "gkwh-6123456789abcdef01234567",
        });

      payload.schema_version =
        "oasse.signal_audit.webhook.v1.1";

      const request =
        createRequest({
          payload,
          signingSecret,
        });

      const response =
        createResponse();

      await handler(
        request,
        response,
      );

      assert.equal(
        response.statusCode,
        400,
      );

      assert.equal(
        processingAttempts,
        0,
      );

      assert.equal(
        signalHistory
          .listAllSignals()
          .length,
        0,
      );
    } finally {
      fs.rmSync(
        tempDirectory,
        {
          recursive:
            true,
          force:
            true,
        },
      );
    }
  },
);

test(
  "rejects invalid OASSE Gatekeeper v1.1 semantic values",
  async () => {
    const tempDirectory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "signal-audit-gatekeeper-v1-1-values-",
        ),
      );

    try {
      const signingSecret =
        "test-oasse-signing-secret";

      const connectionStore = {
        getConnection(
          connectionId,
        ) {
          assert.equal(
            connectionId,
            "oasse-gatekeeper",
          );

          return {
            connectionId,
            source:
              "gatekeeper",

            metadata: {
              environment:
                "staging",
              webhookAuth:
                "oasse-hmac-v1",
            },

            outputs: {},
          };
        },
      };

      const signalHistory =
        createSignalHistory({
          filePath:
            path.join(
              tempDirectory,
              "signal-history.json",
            ),
        });

      let processingAttempts = 0;

      const handler =
        createGatekeeperWebhookHandler({
          signingSecret,
          connectionStore,
          signalHistory,
          processSignal:
            async () => {
              processingAttempts += 1;
            },
        });

      const payload =
        createPayload({
          eventId:
            "gkwh-7123456789abcdef01234567",
        });

      payload.schema_version =
        "oasse.signal_audit.webhook.v1.1";

      payload.semantics = {
        authoritative_summary:
          "Invalid semantic test.",
        execution_permitted:
          "false",
        enforcement_effect:
          "UNKNOWN",
        reason_code:
          "ABSTAIN",
        resolution_requirement:
          "SUFFICIENT_AUTHORITY_OR_EVIDENCE",
      };

      const request =
        createRequest({
          payload,
          signingSecret,
        });

      const response =
        createResponse();

      await handler(
        request,
        response,
      );

      assert.equal(
        response.statusCode,
        400,
      );

      assert.equal(
        processingAttempts,
        0,
      );

      assert.equal(
        signalHistory
          .listAllSignals()
          .length,
        0,
      );
    } finally {
      fs.rmSync(
        tempDirectory,
        {
          recursive:
            true,
          force:
            true,
        },
      );
    }
  },
);
