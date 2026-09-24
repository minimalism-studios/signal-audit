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
      payload.benchmark_case_id,
    ) || null;

  const traceId =
    firstDefined(
      payload.traceId,
      payload.trace_id,
      payload.trace?.id,
      payload.correlation_id,
    ) || null;

  const service =
    firstDefined(
      payload.service,
      payload.serviceName,
      payload.service_name,
      payload.context?.service,
      payload.resource?.service,
      payload.resource?.serviceName,
      "gatekeeper",
    );

  const environment =
    firstDefined(
      payload.environment,
      payload.env,
      payload.context?.environment,
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
      payload.benchmark_case_id
        ? `Gatekeeper decision ${payload.benchmark_case_id}`
        : null,
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
        payload.benchmark_case_id,
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
        payload.context?.team,
        payload.resource?.team,
        "unspecified",
      ),

    description:
      firstDefined(
        payload.description,
        payload.reason,
        payload.message,
        payload.summary,
        payload.benchmark_case_id
          ? `Gatekeeper governance decision for ${payload.benchmark_case_id}.`
          : null,
        "No Gatekeeper description provided.",
      ),

    policy:
      firstDefined(
        payload.policy,
        payload.policyName,
        payload.policy_name,
        payload.policy_bundle?.id,
      ) || null,

    policyId:
      firstDefined(
        payload.policyId,
        payload.policy_id,
        payload.policy?.id,
        payload.policy_bundle?.id,
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
        payload.context?.actor,
      ) || null,

    resource:
      firstDefined(
        payload.resource,
        payload.context?.resource,
      ) || null,

    reason:
      firstDefined(
        payload.reason,
        payload.explanation,
      ) || null,

    occurredAt:
      firstDefined(
        payload.decision_timestamp,
        payload.occurredAt,
        payload.occurred_at,
        payload.timestamp,
        payload.time,
        payload.captured_at,
      ) || null,

    receipt:
      payload.receipt || null,

    /*
     * OASSE Vanguard contract fields.
     *
     * These values originate with Gatekeeper and remain
     * authoritative. Signal Audit preserves them for
     * presentation, reconciliation, and acknowledgement.
     */
    benchmarkCaseId:
      payload.benchmark_case_id || null,

    pilotId:
      payload.pilot_id || null,

    ordinal:
      payload.ordinal ?? null,

    internalOutcome:
      payload.internal_outcome || null,

    terminalStatus:
      payload.terminal_status || null,

    idempotencyKey:
      payload.idempotency_key || null,

    correlationId:
      payload.correlation_id || null,

    requestId:
      payload.request_id || null,

    decisionTimestamp:
      payload.decision_timestamp || null,

    capturedAt:
      payload.captured_at || null,

    contractValid:
      payload.contract_valid ?? null,

    contractErrors:
      Array.isArray(payload.contract_errors)
        ? payload.contract_errors
        : [],

    corpus:
      payload.corpus || null,

    policyBundle:
      payload.policy_bundle || null,

    authority:
      payload.authority || null,

    context:
      payload.context || null,

    resolvedDomain:
      payload.resolved_domain || null,

    resolvedState:
      payload.resolved_state || null,

    schemaVersion:
      payload.schema_version || null,

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
