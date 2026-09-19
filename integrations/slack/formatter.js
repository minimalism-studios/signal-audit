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

  if (clean(signal.policy)) {
    lines.push(
      `*Policy:* ${clean(signal.policy)}`,
    );
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
