const test = require("node:test");
const assert = require("node:assert/strict");

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

test(
  "allows signed Gatekeeper handler initialization without Bearer secret",
  () => {
    assert.doesNotThrow(
      () =>
        createGatekeeperWebhookHandler({
          processSignal:
            async () => {},
          webhookSecret:
            null,
          signingSecret:
            "synthetic-signing-secret",
          connectionStore: {
            getConnection() {
              return {
                source:
                  "gatekeeper",
                metadata: {
                  webhookAuth:
                    "oasse-hmac-v1",
                },
              };
            },
          },
          signalHistory: {
            findByExternalEvent() {
              return null;
            },
          },
        }),
    );
  },
);

test(
  "fails closed when Bearer transport has no Bearer secret",
  async () => {
    let processingAttempts = 0;

    const handler =
      createGatekeeperWebhookHandler({
        processSignal:
          async () => {
            processingAttempts += 1;
          },
        webhookSecret:
          null,
        signingSecret:
          null,
        connectionStore: {
          getConnection() {
            return {
              source:
                "gatekeeper",
              metadata: {
                webhookAuth:
                  "bearer",
              },
            };
          },
        },
      });

    const req = {
      params: {
        connectionId:
          "bearer-test",
      },

      get() {
        return null;
      },

      body: {
        decision:
          "allow",
      },
    };

    const res =
      createResponse();

    await handler(
      req,
      res,
    );

    assert.equal(
      res.statusCode,
      503,
    );

    assert.equal(
      res.body.accepted,
      false,
    );

    assert.equal(
      res.body.error,
      "Bearer webhook transport is unavailable.",
    );

    assert.equal(
      processingAttempts,
      0,
    );
  },
);
