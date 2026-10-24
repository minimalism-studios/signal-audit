function clean(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function formatTelemetrySlackMessage({
  signal,
  auditResult,
}) {
  if (!signal || typeof signal !== "object") {
    throw new Error("Signal is required.");
  }

  if (!auditResult || typeof auditResult !== "object") {
    throw new Error("Audit result is required.");
  }

  const finding = Array.isArray(auditResult.findings)
    ? auditResult.findings[0]
    : null;

  if (!finding) {
    throw new Error("Audit result must contain a finding.");
  }

  const source = clean(signal.source)?.toUpperCase() || "TELEMETRY";
  const severity = clean(finding.severity)?.toUpperCase() || "UNKNOWN";
  const title = clean(finding.title) || clean(signal.title) || "Operational finding";

  const lines = [
    `*Signal Audit — ${source}*`,
    "",
    `*${severity} — ${title}*`,
    "",
    clean(finding.executiveSummary)
      || clean(auditResult.summary)
      || "No summary available.",
    "",
    `*Service:* ${clean(signal.service) || "Unspecified"}`,
    `*Environment:* ${clean(signal.environment || signal.env) || "Unspecified"}`,
  ];

  if (clean(finding.businessImpact)) {
    lines.push(`*Business impact:* ${clean(finding.businessImpact)}`);
  }

  if (clean(finding.recommendedOwner)) {
    lines.push(`*Recommended owner:* ${clean(finding.recommendedOwner)}`);
  }

  if (Array.isArray(finding.actions) && finding.actions.length) {
    lines.push("", "*Recommended actions*");

    for (const action of finding.actions.slice(0, 3)) {
      const description =
        typeof action === "string"
          ? clean(action)
          : clean(action?.description || action?.action || action?.title);

      if (description) {
        lines.push(`• ${description}`);
      }
    }
  }

  return lines.join("\n");
}

module.exports = {
  formatTelemetrySlackMessage,
};
