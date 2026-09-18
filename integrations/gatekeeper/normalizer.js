function firstDefined(...values) {
  return values.find(
    (value) =>
      value !== undefined
      && value !== null
      && value !== ""
  );
}

function normalizeDecision(value) {
  if (
    value === undefined
    || value === null
    || value === ""
  ) {
    return "unknown";
  }

  return String(value)
    .trim()
    .toLowerCase();
}

function normalizeGatekeeperSignal(
  payload,
  connectionId,
) {
  if (
    !payload
    || typeof payload !== "object"
    || Array.isArray(payload)
  ) {
    throw new TypeError(
      "Gatekeeper payload must be an object.",
    );
  }

  const decision =
    normalizeDecision(
      firstDefined(
        payload.decision,
        payload.action,
        payload.result,
        payload.outcome,
        payload.status,
      ),
    );

  const receiptId =
    firstDefined(
      payload.receiptId,
      payload.receipt_id,
      payload.receipt?.id,
    ) || null;

  const decisionId =
    firstDefined(
      payload.decisionId,
      payload.decision_id,
      payload.id,
    ) || null;

  const traceId =
    firstDefined(
      payload.traceId,
      payload.trace_id,
      payload.trace?.id,
    ) || null;

  const service =
    firstDefined(
      payload.service,
      payload.serviceName,
      payload.service_name,
      payload.resource?.service,
      payload.resource?.serviceName,
      "gatekeeper",
    );

  const environment =
    firstDefined(
      payload.environment,
      payload.env,
      payload.resource?.environment,
      "unknown",
    );

  const severity =
    firstDefined(
      payload.severity,
      payload.priority,
      decision === "block"
        || decision === "blocked"
        || decision === "deny"
        || decision === "denied"
        ? "high"
        : "informational",
    );

  const title =
    firstDefined(
      payload.title,
      payload.summary,
      payload.message,
      decisionId
        ? `Gatekeeper decision ${decisionId}`
        : "Gatekeeper decision",
    );

  return {
    source:
      "gatekeeper",

    connectionId,

    status:
      decision,

    decision,

    decisionId,

    receiptId,

    traceId,

    fingerprint:
      firstDefined(
        payload.fingerprint,
        receiptId,
        decisionId,
        traceId,
      ) || null,

    title,

    service,

    environment,

    severity,

    team:
      firstDefined(
        payload.team,
        payload.owner,
        payload.resource?.team,
        "unspecified",
      ),

    description:
      firstDefined(
        payload.description,
        payload.reason,
        payload.message,
        payload.summary,
        "No Gatekeeper description provided.",
      ),

    policy:
      firstDefined(
        payload.policy,
        payload.policyName,
        payload.policy_name,
      ) || null,

    policyId:
      firstDefined(
        payload.policyId,
        payload.policy_id,
        payload.policy?.id,
      ) || null,

    rule:
      firstDefined(
        payload.rule,
        payload.ruleName,
        payload.rule_name,
      ) || null,

    subject:
      firstDefined(
        payload.subject,
        payload.principal,
        payload.actor,
      ) || null,

    resource:
      payload.resource || null,

    reason:
      firstDefined(
        payload.reason,
        payload.explanation,
      ) || null,

    occurredAt:
      firstDefined(
        payload.occurredAt,
        payload.occurred_at,
        payload.timestamp,
        payload.time,
      ) || null,

    receipt:
      payload.receipt || null,

    attributes:
      payload.attributes
      && typeof payload.attributes === "object"
      && !Array.isArray(payload.attributes)
        ? payload.attributes
        : {},

    rawPayload:
      payload,
  };
}

module.exports = {
  normalizeGatekeeperSignal,
};
