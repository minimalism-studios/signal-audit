const crypto = require("crypto");

const {
  buildLeadershipBriefPrompt,
} = require("../../../prompts/leadershipBrief");

const {
  parseLeadershipBrief,
} = require("../../parsers/leadershipBrief");

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_MAX_TOKENS = 2400;
const DEFAULT_HISTORY_LIMIT = 5000;

function createLeadershipIntelligence({
  openai,
  signalHistory,
  investigationStore,
  model = DEFAULT_MODEL,
}) {
  if (!openai) {
    throw new Error(
      "Leadership Brief service requires an OpenAI client.",
    );
  }

  if (
    !signalHistory
    || typeof signalHistory.listSignals !== "function"
  ) {
    throw new Error(
      "Leadership Brief service requires Signal History.",
    );
  }

  if (
    !investigationStore
    || typeof investigationStore
      .listInvestigations
      !== "function"
  ) {
    throw new Error(
      "Leadership Brief service requires an Investigation Store.",
    );
  }

  async function generateLeadershipBrief({
    start,
    end,
    limit = DEFAULT_HISTORY_LIMIT,
  }) {
    const reportingPeriod = normalizeReportingPeriod({
      start,
      end,
    });

    const records = signalHistory.listSignals({
      limit,
    });

    const periodRecords = records
      .filter((record) => (
        isRecordWithinPeriod(
          record,
          reportingPeriod,
        )
      ))
      .sort((left, right) => (
        Date.parse(left.receivedAt)
        - Date.parse(right.receivedAt)
      ));

    const findings = extractFindings(
      periodRecords,
    );

    const metrics = calculateMetrics({
      records: periodRecords,
      findings,
    });

    const storedInvestigations =
      investigationStore
        .listInvestigations();

    const investigationEvidence =
      buildLeadershipInvestigationEvidence({
        investigations:
          storedInvestigations,

        findings,

        reportingPeriod,
      });

    metrics.investigationsOpened =
      investigationEvidence
        .openedCount;

    metrics.investigationsResolved =
      investigationEvidence
        .resolvedCount;

    metrics.activeInvestigations =
      investigationEvidence
        .activeCount;

    const prompt = buildLeadershipBriefPrompt({
      reportingPeriod,
      metrics,
      findings,
      investigationEvidence,
    });

    const createCompletion = async (
      retryInstruction = null,
    ) => {
      const messages = [
        {
          role: "user",
          content: prompt,
        },
      ];

      if (retryInstruction) {
        messages.push({
          role: "user",
          content: retryInstruction,
        });
      }

      return openai.chat.completions.create({
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages,
      });
    };

    let result =
      await createCompletion();

    let content =
      getResponseContent(result);

    let modelBrief;

    try {
      modelBrief =
        parseLeadershipBrief(content);
    } catch (error) {
      console.warn(
        "Leadership Brief validation failed. Retrying once.",
        error.message,
      );

      const retryInstruction = `
    The previous Leadership Brief failed validation:

    ${error.message}

    Regenerate the complete Leadership Brief as valid JSON.

    Every item in topOperationalRisks, keyWins, watchItems, and
    recommendedActions must include at least one valid ID from the supplied
    findings in supportingFindingIds.

    Never return an empty supportingFindingIds array.
    Do not invent finding IDs.
    Use only finding IDs supplied in the original prompt.
    Omit any item that cannot be supported by a supplied finding.
    Preserve the canonical investigation counts.
    Do not describe a resolved investigation as active or unresolved.
    Do not claim no investigations were opened or resolved when the supplied
    investigation evidence reports a positive count.
      `.trim();

      result =
        await createCompletion(
          retryInstruction,
        );

      content =
        getResponseContent(result);

      modelBrief =
        parseLeadershipBrief(content);
    }

    validateCanonicalFields({
      leadershipBrief: modelBrief,
      reportingPeriod,
    });

    const leadershipBrief =
      parseLeadershipBrief({
        ...modelBrief,
        briefId:
          `leadership-brief-${crypto.randomUUID()}`,
        generatedAt:
          new Date().toISOString(),
        reportingPeriod,
      });

    validateFindingReferences({
      leadershipBrief,
      findings,
    });

    return {
      ...leadershipBrief,
      metrics,
    };
  }

  return {
    generateLeadershipBrief,
  };
}

function normalizeReportingPeriod({
  start,
  end,
}) {
  const normalizedStart = normalizeTimestamp(
    start,
    "start",
  );

  const normalizedEnd = normalizeTimestamp(
    end,
    "end",
  );

  if (
    Date.parse(normalizedStart)
    > Date.parse(normalizedEnd)
  ) {
    throw new RangeError(
      "Leadership Brief reporting-period start must not occur after end.",
    );
  }

  return {
    start: normalizedStart,
    end: normalizedEnd,
  };
}

function isRecordWithinPeriod(
  record,
  reportingPeriod,
) {
  if (
    !record
    || typeof record.receivedAt !== "string"
  ) {
    return false;
  }

  const receivedAt =
    Date.parse(record.receivedAt);

  if (Number.isNaN(receivedAt)) {
    return false;
  }

  return (
    receivedAt
      >= Date.parse(reportingPeriod.start)
    && receivedAt
      <= Date.parse(reportingPeriod.end)
  );
}

function extractFindings(records) {
  const findings = [];

  records.forEach((record) => {
    if (
      !record.analysis
      || typeof record.analysis !== "object"
      || !Array.isArray(
        record.analysis.findings,
      )
    ) {
      return;
    }

    record.analysis.findings.forEach(
      (finding) => {
        if (
          !finding
          || typeof finding !== "object"
        ) {
          return;
        }

        const originalFindingId =
          normalizeOptionalString(
            finding.id,
          );

        if (!originalFindingId) {
          return;
        }

        findings.push({
          id: `${record.id}:${originalFindingId}`,
          originalFindingId,
          signalRecordId: record.id,
          source:
            normalizeLowercaseString(
              record.source,
            ),
          receivedAt: record.receivedAt,
          signalStatus:
            normalizeLowercaseString(
              record.status,
            ),
          service:
            normalizeOptionalString(
              record.service,
            ),
          environment:
            normalizeOptionalString(
              record.signal?.environment,
            ),
          team:
            normalizeOptionalString(
              record.signal?.team,
            ),
          fingerprint:
            normalizeOptionalString(
              record.fingerprint,
            ),
          title:
            normalizeOptionalString(
              finding.title,
            ),
          severity:
            normalizeLowercaseString(
              finding.severity,
            ),
          confidence:
            normalizeConfidence(
              finding.confidence,
            ),
          category:
            normalizeLowercaseString(
              finding.category,
            ),
          executiveSummary:
            normalizeOptionalString(
              finding.executiveSummary,
            ),
          businessImpact:
            normalizeOptionalString(
              finding.businessImpact,
            ),
          affectedServices:
            normalizeStringArray(
              finding.affectedServices,
            ),
          recommendedOwner:
            normalizeOptionalString(
              finding.recommendedOwner,
            ),
          actions:
            normalizeActions(
              finding.actions,
            ),
          evidence:
            normalizeStringArray(
              finding.evidence,
            ),
        });
      },
    );
  });

  return findings;
}

function calculateMetrics({
  records,
  findings,
}) {
  const sources = uniqueStrings(
    records.map(
      (record) => record.source,
    ),
  );

  const services = uniqueStrings(
    records.map(
      (record) => record.service,
    ),
  );

  const deliveredRecords =
    records.filter(
      (record) =>
        record.state === "delivered",
    );

  const failedRecords =
    records.filter(
      (record) =>
        record.state === "failed",
    );

  const analyzedRecords =
    records.filter(
      (record) =>
        record.analysis !== null
        && record.analysis !== undefined,
    );

  const activeRecords =
    records.filter(
      (record) =>
        normalizeLowercaseString(
          record.status,
        ) === "firing",
    );

  const resolvedRecords =
    records.filter((record) => {
      const status =
        normalizeLowercaseString(
          record.status,
        );

      return (
        status === "resolved"
        || status === "recovered"
      );
    });

  const severityCounts = findings.reduce(
    (counts, finding) => {
      const severity =
        finding.severity || "unknown";

      counts[severity] =
        (counts[severity] || 0) + 1;

      return counts;
    },
    {},
  );

  const categoryCounts = findings.reduce(
    (counts, finding) => {
      const category =
        finding.category || "unknown";

      counts[category] =
        (counts[category] || 0) + 1;

      return counts;
    },
    {},
  );

  const deliveryAttempts =
    deliveredRecords.length
    + failedRecords.length;

  const deliverySuccessRate =
    deliveryAttempts === 0
      ? null
      : Number(
          (
            deliveredRecords.length
            / deliveryAttempts
            * 100
          ).toFixed(2),
        );

  return {
    signalCount: records.length,
    analyzedSignalCount:
      analyzedRecords.length,
    findingCount: findings.length,
    activeSignalCount:
      activeRecords.length,
    resolvedSignalCount:
      resolvedRecords.length,
    deliveredSignalCount:
      deliveredRecords.length,
    failedSignalCount:
      failedRecords.length,
    deliverySuccessRate,
    sourceCount: sources.length,
    sources,
    serviceCount: services.length,
    services,
    severityCounts,
    categoryCounts,
  };
}

function isTimestampWithinPeriod(
  value,
  reportingPeriod,
) {
  if (
    typeof value !== "string"
  ) {
    return false;
  }

  const timestamp =
    Date.parse(value);

  const start =
    Date.parse(
      reportingPeriod.start,
    );

  const end =
    Date.parse(
      reportingPeriod.end,
    );

  return (
    Number.isFinite(timestamp)
    && Number.isFinite(start)
    && Number.isFinite(end)
    && timestamp >= start
    && timestamp <= end
  );
}

function buildLeadershipInvestigationEvidence({
  investigations,
  findings,
  reportingPeriod,
}) {
  const activeStatuses =
    new Set([
      "new",
      "investigating",
      "monitoring",
    ]);

  const normalized =
    investigations.map(
      (investigation) => {
        const linkedSignalIds =
          new Set(
            investigation
              .evidence
              ?.signals
            ?? [],
          );

        const supportingFindingIds =
          uniqueStrings(
            findings
              .filter(
                (finding) =>
                  linkedSignalIds.has(
                    finding.signalRecordId,
                  ),
              )
              .map(
                (finding) =>
                  finding.id,
              ),
          );

        const status =
          normalizeLowercaseString(
            investigation.status,
          )
          || "unknown";

        return {
          id:
            investigation.id,

          title:
            normalizeOptionalString(
              investigation.title,
            )
            || "Untitled Investigation",

          status,

          severity:
            normalizeLowercaseString(
              investigation.severity,
            )
            || "unknown",

          service:
            normalizeOptionalString(
              investigation.service,
            ),

          environment:
            normalizeOptionalString(
              investigation.environment,
            ),

          owner:
            normalizeOptionalString(
              investigation.owner,
            ),

          summary:
            normalizeOptionalString(
              investigation.summary,
            ),

          resolutionSummary:
            normalizeOptionalString(
              investigation
                .resolution
                ?.summary,
            ),

          rootCause:
            normalizeOptionalString(
              investigation
                .resolution
                ?.rootCause,
            ),

          correctiveActions:
            normalizeStringArray(
              investigation
                .resolution
                ?.correctiveActions,
            ),

          preventiveActions:
            normalizeStringArray(
              investigation
                .resolution
                ?.preventiveActions,
            ),

          createdAt:
            investigation.createdAt,

          resolvedAt:
            investigation
              .resolution
              ?.resolvedAt
            ?? null,

          supportingFindingIds,
        };
      },
    );

  const opened =
    normalized.filter(
      (investigation) =>
        isTimestampWithinPeriod(
          investigation.createdAt,
          reportingPeriod,
        ),
    );

  const active =
    normalized.filter(
      (investigation) =>
        activeStatuses.has(
          investigation.status,
        ),
    );

  const resolved =
    normalized.filter(
      (investigation) =>
        investigation.status
          === "resolved"
        && isTimestampWithinPeriod(
          investigation.resolvedAt,
          reportingPeriod,
        ),
    );

  return {
    openedCount:
      opened.length,

    resolvedCount:
      resolved.length,

    activeCount:
      active.length,

    active,

    resolved,
  };
}

function validateCanonicalFields({
  leadershipBrief,
  reportingPeriod,
}) {
  if (
    leadershipBrief.reportingPeriod.start
    !== reportingPeriod.start
    || leadershipBrief.reportingPeriod.end
    !== reportingPeriod.end
  ) {
    throw new Error(
      "Leadership Brief reporting period does not match the requested reporting period.",
    );
  }
}

function validateFindingReferences({
  leadershipBrief,
  findings,
}) {
  const validFindingIds = new Set(
    findings.map((finding) => finding.id),
  );

  const references = [
    ...leadershipBrief.topOperationalRisks,
    ...leadershipBrief.keyWins,
    ...leadershipBrief.watchItems,
    ...leadershipBrief.recommendedActions,
  ].flatMap(
    (item) =>
      item.supportingFindingIds,
  );

  const invalidReferences =
    references.filter(
      (findingId) =>
        !validFindingIds.has(findingId),
    );

  if (invalidReferences.length > 0) {
    throw new Error(
      `Leadership Brief contains unsupported finding references: ${
        uniqueStrings(invalidReferences).join(", ")
      }`,
    );
  }
}

function getResponseContent(result) {
  const content =
    result?.choices?.[0]?.message?.content;

  if (
    typeof content !== "string"
    || content.trim() === ""
  ) {
    throw new Error(
      "OpenAI returned an empty Leadership Brief response.",
    );
  }

  return content;
}

function normalizeTimestamp(
  value,
  fieldName,
) {
  if (
    typeof value !== "string"
    || value.trim() === ""
  ) {
    throw new TypeError(
      `Leadership Brief field "${fieldName}" must be a non-empty timestamp string.`,
    );
  }

  const timestamp =
    Date.parse(value.trim());

  if (Number.isNaN(timestamp)) {
    throw new TypeError(
      `Leadership Brief field "${fieldName}" must be a valid ISO-8601 timestamp.`,
    );
  }

  return new Date(
    timestamp,
  ).toISOString();
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized === ""
    ? null
    : normalized;
}

function normalizeLowercaseString(value) {
  const normalized =
    normalizeOptionalString(value);

  return normalized === null
    ? null
    : normalized.toLowerCase();
}

function normalizeConfidence(value) {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(value),
    ),
  );
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(value);
}

function normalizeActions(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return {
      immediate: [],
      shortTerm: [],
      longTerm: [],
    };
  }

  return {
    immediate:
      normalizeStringArray(
        value.immediate,
      ),
    shortTerm:
      normalizeStringArray(
        value.shortTerm,
      ),
    longTerm:
      normalizeStringArray(
        value.longTerm,
      ),
  };
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .filter(
          (value) =>
            typeof value === "string",
        )
        .map(
          (value) => value.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

module.exports = {
  createLeadershipIntelligence,

  // Compatibility alias.
  createExecutiveIntelligence:
    createLeadershipIntelligence,
};
