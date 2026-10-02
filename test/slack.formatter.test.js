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


test(
  "renders Gatekeeper v1.1 authority separately from Signal Audit interpretation",
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
              "authority-boundary-test",
          },

          authoritativeSummary:
            "Gatekeeper held the proposed action because sufficient authority or evidence was not available.",

          executionPermitted:
            false,

          enforcementEffect:
            "HOLD",

          reasonCode:
            "ABSTAIN",

          resolutionRequirement:
            "SUFFICIENT_AUTHORITY_OR_EVIDENCE",

          authoritativeOwner:
            "OASSE",

          authoritativeOwnerTeam:
            "Gatekeeper",

          /*
           * Deliberately different from the
           * authoritative owner.
           */
          team:
            "Platform Operations",
        },

        auditResult: {
          summary:
            "Operational review is required.",

          findings: [
            {
              severity:
                "informational",

              title:
                "Governance hold requires operational review",

              executiveSummary:
                "Signal Audit identified an operational follow-up requirement.",

              businessImpact:
                "Business impact cannot be determined from the supplied evidence.",

              recommendedOwner:
                "Platform Operations",

              actions: {
                immediate: [
                  "Review the held request using the supplied Gatekeeper evidence.",
                ],
              },
            },
          ],
        },
      });

    assert.equal(
      message.includes(
        "*Gatekeeper Authority*",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "*Summary:* Gatekeeper held the proposed action because sufficient authority or evidence was not available.",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "*Execution permitted:* No",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "*Enforcement effect:* HOLD",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "*Reason:* ABSTAIN",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "*Resolution requirement:* SUFFICIENT_AUTHORITY_OR_EVIDENCE",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "*Authority owner:* OASSE / Gatekeeper",
      ),
      true,
    );

    /*
     * Signal Audit's operational ownership
     * remains independently represented.
     */
    assert.equal(
      message.includes(
        "*Owner:* Platform Operations",
      ),
      true,
    );
  },
);


test(
  "does not render Gatekeeper authority section for legacy signals",
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
                "Legacy Gatekeeper signal",

              executiveSummary:
                "Legacy signal remains supported.",

              recommendedOwner:
                null,

              actions: {
                immediate: [],
              },
            },
          ],
        },
      });

    assert.equal(
      message.includes(
        "*Gatekeeper Authority*",
      ),
      false,
    );
  },
);
