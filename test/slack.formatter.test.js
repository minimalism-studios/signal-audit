const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  formatSlackAuditMessage,
} = require(
  "../integrations/slack/formatter",
);

test(
  "renders Gatekeeper structured policy by policy_id",
  () => {
    const message =
      formatSlackAuditMessage({
        signal: {
          service:
            "gatekeeper",

          decision:
            "HOLD",

          policy: {
            policy_id:
              "transport-slack-verification",
          },

          decisionId:
            "SA-SIGNED-WEBHOOK-SLACK-CHECK",

          receiptId:
            "receipt-test",
        },

        auditResult: {
          summary:
            "Gatekeeper issued a HOLD decision.",

          findings: [
            {
              severity:
                "informational",

              title:
                "Gatekeeper HOLD decision",

              executiveSummary:
                "The request requires review.",

              businessImpact:
                "No confirmed business impact.",

              recommendedOwner:
                null,

              actions: {
                immediate: [
                  "Confirm the HOLD decision.",
                ],
              },
            },
          ],
        },
      });

    assert.equal(
      message.includes(
        "*Policy:* transport-slack-verification",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "[object Object]",
      ),
      false,
    );

    assert.equal(
      message.includes(
        "*Service:* gatekeeper\n"
        + "*Decision:* HOLD\n"
        + "*Policy:* transport-slack-verification",
      ),
      true,
    );
  },
);

test(
  "continues to render legacy scalar policy values",
  () => {
    const message =
      formatSlackAuditMessage({
        signal: {
          service:
            "gatekeeper",

          decision:
            "ALLOW",

          policy:
            "legacy-policy",
        },

        auditResult: {
          findings: [
            {
              severity:
                "informational",

              title:
                "Legacy policy",

              executiveSummary:
                "Legacy policy test.",

              actions: {
                immediate: [],
              },
            },
          ],
        },
      });

    assert.equal(
      message.includes(
        "*Policy:* legacy-policy",
      ),
      true,
    );
  },
);
