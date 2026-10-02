const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildGatekeeperFindingPrompt,
} = require("../prompts/gatekeeperFinding");

test(
  "Gatekeeper v1.1 prompt preserves semantic authority boundary",
  () => {
    const signal = {
      source: "gatekeeper",
      schemaVersion:
        "oasse.signal_audit.webhook.v1.1",
      decision: "hold",
      internalOutcome: "ABSTAIN",
      semantics: {
        authoritative_summary:
          "Gatekeeper held the proposed action because sufficient authority or evidence was not available.",
        execution_permitted: false,
        enforcement_effect: "HOLD",
        reason_code: "ABSTAIN",
        resolution_requirement:
          "SUFFICIENT_AUTHORITY_OR_EVIDENCE",
      },
      authoritativeSummary:
        "Gatekeeper held the proposed action because sufficient authority or evidence was not available.",
      executionPermitted: false,
      enforcementEffect: "HOLD",
      reasonCode: "ABSTAIN",
      resolutionRequirement:
        "SUFFICIENT_AUTHORITY_OR_EVIDENCE",
      authoritativeOwner: null,
      authoritativeOwnerTeam: null,
    };

    const prompt =
      buildGatekeeperFindingPrompt(signal);

    assert.match(
      prompt,
      /Gatekeeper Semantic Authority:/,
    );

    assert.match(
      prompt,
      /A HOLD is an enforced non-authorization state/,
    );

    assert.match(
      prompt,
      /ABSTAIN is a reason for the Gatekeeper result/,
    );

    assert.match(
      prompt,
      /Do not contradict, weaken, strengthen, reinterpret, or replace/,
    );

    assert.match(
      prompt,
      /"executionPermitted": false/,
    );

    assert.match(
      prompt,
      /"enforcementEffect": "HOLD"/,
    );

    assert.match(
      prompt,
      /"reasonCode": "ABSTAIN"/,
    );

    assert.match(
      prompt,
      /"resolutionRequirement": "SUFFICIENT_AUTHORITY_OR_EVIDENCE"/,
    );
  },
);

test(
  "Gatekeeper v1 prompt retains legacy prompt behavior",
  () => {
    const prompt =
      buildGatekeeperFindingPrompt({
        source: "gatekeeper",
        schemaVersion:
          "oasse.signal_audit.webhook.v1",
        decision: "hold",
        internalOutcome: "ABSTAIN",
      });

    assert.doesNotMatch(
      prompt,
      /Gatekeeper Semantic Authority:/,
    );

    assert.match(
      prompt,
      /Gatekeeper is authoritative for the governance decision and its receipt/,
    );
  },
);
