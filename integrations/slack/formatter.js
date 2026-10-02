function clean(value) {
  if (
    value === undefined
    || value === null
    || value === ""
  ) {
    return null;
  }

  return String(value).trim();
}

function getPolicyId(policy) {
  if (
    policy
    && typeof policy === "object"
    && !Array.isArray(policy)
  ) {
    return clean(
      policy.policy_id
      || policy.policyId,
    );
  }

  return clean(policy);
}

function formatSlackAuditMessage({
  signal,
  auditResult,
}) {
  if (
    !signal
    || typeof signal !== "object"
  ) {
    throw new Error(
      "Signal is required.",
    );
  }

  if (
    !auditResult
    || typeof auditResult !== "object"
  ) {
    throw new Error(
      "Audit result is required.",
    );
  }

  const finding =
    Array.isArray(auditResult.findings)
      ? auditResult.findings[0]
      : null;

  if (!finding) {
    throw new Error(
      "Audit result must contain a finding.",
    );
  }

  const severity =
    clean(finding.severity)
      ?.toUpperCase()
    || "UNKNOWN";

  const lines = [
    "*Signal Audit — Gatekeeper*",
    "",
    `*${severity} — ${clean(finding.title) || "Operational finding"}*`,
    "",
    clean(finding.executiveSummary)
      || clean(auditResult.summary)
      || "No summary available.",
    "",
    `*Service:* ${clean(signal.service) || "Unspecified"}`,
    `*Decision:* ${clean(signal.decision) || clean(signal.status) || "Unknown"}`,
  ];

  const policyId =
    getPolicyId(
      signal.policy,
    );

  if (policyId) {
    lines.push(
      `*Policy:* ${policyId}`,
    );
  }

  /*
   * Gatekeeper v1.1 authoritative semantics.
   *
   * Keep Gatekeeper authority visibly separate
   * from Signal Audit's operational interpretation.
   */
  const hasAuthoritativeSemantics =
    clean(signal.authoritativeSummary)
    || typeof signal.executionPermitted === "boolean"
    || clean(signal.enforcementEffect)
    || clean(signal.reasonCode)
    || clean(signal.resolutionRequirement)
    || clean(signal.authoritativeOwner)
    || clean(signal.authoritativeOwnerTeam);

  if (hasAuthoritativeSemantics) {
    lines.push(
      "",
      "*Gatekeeper Authority*",
    );

    if (clean(signal.authoritativeSummary)) {
      lines.push(
        `*Summary:* ${clean(signal.authoritativeSummary)}`,
      );
    }

    if (
      typeof signal.executionPermitted
        === "boolean"
    ) {
      lines.push(
        `*Execution permitted:* ${
          signal.executionPermitted
            ? "Yes"
            : "No"
        }`,
      );
    }

    if (clean(signal.enforcementEffect)) {
      lines.push(
        `*Enforcement effect:* ${clean(signal.enforcementEffect)}`,
      );
    }

    if (clean(signal.reasonCode)) {
      lines.push(
        `*Reason:* ${clean(signal.reasonCode)}`,
      );
    }

    if (clean(signal.resolutionRequirement)) {
      lines.push(
        `*Resolution requirement:* ${clean(signal.resolutionRequirement)}`,
      );
    }

    const authoritativeOwner =
      [
        clean(signal.authoritativeOwner),
        clean(signal.authoritativeOwnerTeam),
      ]
        .filter(Boolean)
        .join(" / ");

    if (authoritativeOwner) {
      lines.push(
        `*Authority owner:* ${authoritativeOwner}`,
      );
    }
  }

  if (clean(finding.businessImpact)) {
    lines.push(
      `*Impact:* ${clean(finding.businessImpact)}`,
    );
  }

  const owner =
    clean(finding.recommendedOwner)
    || clean(signal.team);

  lines.push(
    `*Owner:* ${
      !owner
      || owner.toLowerCase() === "unspecified"
        ? "Unspecified"
        : owner
    }`,
  );

  const immediateActions =
    Array.isArray(
      finding.actions?.immediate,
    )
      ? finding.actions.immediate
          .map(clean)
          .filter(Boolean)
      : [];

  if (immediateActions.length > 0) {
    lines.push(
      "",
      "*Immediate action*",
      ...immediateActions.map(
        (action) => `• ${action}`,
      ),
    );
  }

  const identifiers = [
    ["Decision", signal.decisionId],
    ["Receipt", signal.receiptId],
    ["Trace", signal.traceId],
  ].filter(
    ([, value]) => clean(value),
  );

  if (identifiers.length > 0) {
    lines.push(
      "",
      ...identifiers.map(
        ([label, value]) =>
          `${label}: ${clean(value)}`,
      ),
    );
  }

  return lines.join("\n");
}

module.exports = {
  formatSlackAuditMessage,
};
