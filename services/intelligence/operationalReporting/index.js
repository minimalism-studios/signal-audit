const crypto = require("crypto");

const {
  buildReportingPrompt,
} = require("./prompt");

const {
  parseReportingResult,
} = require("./parser");

const {
  validateOperationalReport,
} = require("./validator");

const {
  normalizeReportingPeriod,
  isRecordWithinPeriod,
  normalizeOptionalString,
  uniqueStrings,
} = require("../evidence");

const {
  buildOperationalEvidence,
} = require("../evidence/builder");

const DEFAULT_MODEL =
  "gpt-4.1-mini";

const DEFAULT_MAX_TOKENS =
  5200;

const DEFAULT_HISTORY_LIMIT =
  5000;

function createOperationalReportingIntelligence({
  openai,
  signalHistory,
  investigationStore,
  model = DEFAULT_MODEL,
}) {
  if (!openai) {
    throw new Error(
      "Operational Reporting Intelligence requires an OpenAI client.",
    );
  }

  if (
    !signalHistory
    || typeof signalHistory.listSignals
      !== "function"
  ) {
    throw new Error(
      "Operational Reporting Intelligence requires Signal History.",
    );
  }

  if (
    !investigationStore
    || typeof investigationStore
      .listInvestigations
      !== "function"
  ) {
    throw new Error(
      "Operational Reporting Intelligence requires an Investigation Store.",
    );
  }

  async function generateOperationalReport({
    start,
    end,
    days = null,
    limit = DEFAULT_HISTORY_LIMIT,
  }) {
    const reportingPeriod =
      normalizeReportingPeriod({
        start,
        end,
        days,
      });

    const records =
      signalHistory.listSignals({
        limit,
      });

    const periodRecords =
      records
        .filter((record) =>
          isRecordWithinPeriod(
            record,
            reportingPeriod,
          ))
        .sort((left, right) =>
          Date.parse(left.receivedAt)
          - Date.parse(right.receivedAt));

    const evidence =
      buildOperationalEvidence({
        records:
          periodRecords,

        reportingPeriod,
      });

    const findings =
      evidence.findings;

    const metrics =
      evidence.metrics;

    const serviceExposure =
      evidence.patterns.services;

    const environmentExposure =
      evidence.patterns.environments;

    const recurringConditions =
      evidence.patterns.recurring;

    const storedInvestigations =
      investigationStore
        .listInvestigations();

    const periodInvestigations =
      storedInvestigations.filter(
        (investigation) =>
          isTimestampWithinPeriod(
            investigation.createdAt,
            reportingPeriod,
          )
          || isTimestampWithinPeriod(
            investigation
              .resolution
              ?.resolvedAt,
            reportingPeriod,
          ),
      );

    const investigations =
      periodInvestigations.map(
        normalizeReportingInvestigation,
      );

    const investigationMetrics =
      calculateInvestigationMetrics({
        investigations:
          periodInvestigations,

        reportingPeriod,
      });

    metrics.investigationsOpened =
      investigationMetrics
        .investigationsOpened;

    metrics.investigationsResolved =
      investigationMetrics
        .investigationsResolved;

    metrics.resolutionRate =
      investigationMetrics
        .resolutionRate;

    metrics.medianResolutionMinutes =
      investigationMetrics
        .medianResolutionMinutes;

    applyServiceInvestigationCounts({
      serviceExposure,
      investigations:
        periodInvestigations,
    });

    const leadershipActions = {
      completed: [],
      carryForward: [],
    };

    const prompt =
      buildReportingPrompt({
        reportingPeriod,
        metrics,
        investigations,
        serviceExposure,
        environmentExposure,
        recurringConditions,
        leadershipActions,
        findings,

        confidenceSignals:
          evidence.confidenceSignals,
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
          content:
            retryInstruction,
        });
      }

      return openai
        .chat
        .completions
        .create({
          model,
          max_tokens:
            DEFAULT_MAX_TOKENS,
          messages,
        });
    };

    let result =
      await createCompletion();

    let content =
      getResponseContent(result);

    let modelReport;

    try {
      modelReport =
        parseReportingResult(
          content,
        );

      validateOperationalReport(
        modelReport,
      );

      validateNarrativeConsistency({
        report:
          modelReport,

        metrics,
      });
    } catch (error) {
      console.warn(
        "Operational Report validation failed. Retrying once.",
        error.message,
      );

      const retryInstruction = `
The previous Operational Performance Report failed validation:

${error.message}

Regenerate the complete report as valid JSON.

Requirements:

- Use the exact JSON schema from the original prompt.
- Preserve the supplied reporting period and canonical metrics.
- Do not invent investigations or completed actions.
- Use only supplied finding IDs.
- Do not invent services, environments, timestamps, owners, actions, causes, or outcomes.
- Return JSON only.
      `.trim();

      result =
        await createCompletion(
          retryInstruction,
        );

      content =
        getResponseContent(result);

      modelReport =
        parseReportingResult(
          content,
        );

      validateOperationalReport(
        modelReport,
      );

      validateNarrativeConsistency({
        report:
          modelReport,

        metrics,
      });
    }

    /*
     * Investigations and investigation metrics are
     * canonical persisted evidence.
     */
    modelReport.investigations =
      investigations;

    modelReport.performance
      .investigationsOpened =
        metrics.investigationsOpened;

    modelReport.performance
      .investigationsResolved =
        metrics.investigationsResolved;

    modelReport.performance
      .resolutionRate =
        metrics.resolutionRate;

    modelReport.performance
      .medianResolutionMinutes =
        metrics.medianResolutionMinutes;

    modelReport.serviceExposure =
      modelReport.serviceExposure.map(
        (service) => {
          const canonical =
            serviceExposure.find(
              (item) =>
                item.service
                === service.service,
            );

          return canonical
            ? {
                ...service,

                investigations:
                  canonical
                    .investigations,
              }
            : service;
        },
      );

    modelReport.metadata.evidenceConfidence =
      evidence.confidenceSignals
        .evidenceStrength;

    modelReport.conclusion.confidence =
      evidence.confidenceSignals
        .evidenceStrength;

    /*
     * Confidence is canonical operational evidence,
     * not a model-selected interpretation.
     */
    modelReport.metadata.evidenceConfidence =
      evidence.confidenceSignals
        .evidenceStrength;

    modelReport.conclusion.confidence =
      evidence.confidenceSignals
        .evidenceStrength;

    validateCanonicalFields({
      report: modelReport,
      reportingPeriod,
      metrics,

      confidenceSignals:
        evidence.confidenceSignals,
    });

    validateFindingReferences({
      report: modelReport,
      findings,
    });

    validateEvidenceCollections({
      report: modelReport,
      investigations,
      leadershipActions,
    });

    return {
      reportId:
        `operational-report-${crypto.randomUUID()}`,

      generatedAt:
        new Date().toISOString(),

      ...modelReport,
    };
  }

  return {
    generateOperationalReport,
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

function normalizeReportingInvestigation(
  investigation,
) {
  const createdAt =
    Date.parse(
      investigation.createdAt,
    );

  const resolvedAt =
    Date.parse(
      investigation
        .resolution
        ?.resolvedAt,
    );

  const durationMinutes =
    Number.isFinite(createdAt)
    && Number.isFinite(resolvedAt)
      ? Math.max(
          0,
          Math.round(
            (
              resolvedAt
              - createdAt
            )
            / 60000,
          ),
        )
      : 0;

  const status =
    normalizeReportingInvestigationStatus(
      investigation.status,
    );

  const supportingFindingIds =
    uniqueStrings(
      investigation
        .evidence
        ?.signals
        ?.flatMap(
          (signalId) =>
            investigation
              .findings
              ?.filter(
                (finding) =>
                  finding.signalRecordId
                  === signalId,
              )
              .map(
                (finding) =>
                  finding.id,
              )
            ?? [],
        )
      ?? [],
    );

  return {
    id:
      String(
        investigation.id,
      ),

    title:
      normalizeOptionalString(
        investigation.title,
      )
      || "Untitled Investigation",

    priority:
      resolveInvestigationPriority(
        investigation.severity,
      ),

    severity:
      normalizeReportingSeverity(
        investigation.severity,
      ),

    status,

    service:
      normalizeOptionalString(
        investigation.service,
      ),

    environment:
      normalizeOptionalString(
        investigation.environment,
      ),

    durationMinutes,

    businessImpact:
      normalizeOptionalString(
        investigation
          .assessment
          ?.summary,
      ),

    outcome:
      normalizeOptionalString(
        investigation
          .resolution
          ?.summary,
      ),

    supportingFindingIds,
  };
}

function normalizeReportingInvestigationStatus(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
    )?.toLowerCase();

  if (
    [
      "new",
      "investigating",
      "monitoring",
      "resolved",
      "archived",
    ].includes(normalized)
  ) {
    if (normalized === "new") {
      return "open";
    }

    if (normalized === "archived") {
      return "closed";
    }

    return normalized;
  }

  return "unknown";
}

function normalizeReportingSeverity(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
    )?.toLowerCase();

  return [
    "critical",
    "high",
    "medium",
    "low",
  ].includes(normalized)
    ? normalized
    : "unknown";
}

function resolveInvestigationPriority(
  severity,
) {
  switch (
    normalizeReportingSeverity(
      severity,
    )
  ) {
    case "critical":
      return 1;

    case "high":
      return 2;

    case "medium":
      return 3;

    case "low":
      return 4;

    default:
      return 5;
  }
}

function calculateInvestigationMetrics({
  investigations,
  reportingPeriod,
}) {
  const opened =
    investigations.filter(
      (investigation) =>
        isTimestampWithinPeriod(
          investigation.createdAt,
          reportingPeriod,
        ),
    );

  const resolved =
    investigations.filter(
      (investigation) =>
        isTimestampWithinPeriod(
          investigation
            .resolution
            ?.resolvedAt,
          reportingPeriod,
        ),
    );

  const durations =
    resolved
      .map(
        (investigation) => {
          const createdAt =
            Date.parse(
              investigation.createdAt,
            );

          const resolvedAt =
            Date.parse(
              investigation
                .resolution
                ?.resolvedAt,
            );

          if (
            !Number.isFinite(createdAt)
            || !Number.isFinite(resolvedAt)
            || resolvedAt < createdAt
          ) {
            return null;
          }

          return Math.round(
            (
              resolvedAt
              - createdAt
            )
            / 60000,
          );
        },
      )
      .filter(
        Number.isFinite,
      )
      .sort(
        (left, right) =>
          left - right,
      );

  const medianResolutionMinutes =
    calculateMedian(
      durations,
    );

  const resolutionDenominator =
    opened.length;

  const resolutionRate =
    resolutionDenominator === 0
      ? 0
      : Number(
          (
            resolved.length
            / resolutionDenominator
            * 100
          ).toFixed(2),
        );

  return {
    investigationsOpened:
      opened.length,

    investigationsResolved:
      resolved.length,

    resolutionRate,

    medianResolutionMinutes,
  };
}

function calculateMedian(
  values,
) {
  if (
    !Array.isArray(values)
    || values.length === 0
  ) {
    return 0;
  }

  const midpoint =
    Math.floor(
      values.length / 2,
    );

  if (
    values.length % 2 === 1
  ) {
    return values[midpoint];
  }

  return Math.round(
    (
      values[midpoint - 1]
      + values[midpoint]
    )
    / 2,
  );
}

function applyServiceInvestigationCounts({
  serviceExposure,
  investigations,
}) {
  serviceExposure.forEach(
    (service) => {
      const normalizedService =
        normalizeOptionalString(
          service.service,
        )?.toLowerCase();

      service.investigations =
        investigations.filter(
          (investigation) =>
            normalizeOptionalString(
              investigation.service,
            )?.toLowerCase()
            === normalizedService,
        ).length;
    },
  );
}

function validateNarrativeConsistency({
  report,
  metrics,
}) {
  const narrativeText = [
    report.summary?.headline,
    report.summary?.overview,
    report.operationalNarrative
      ?.summary,
    report.conclusion?.assessment,
    report.conclusion
      ?.carryForwardRisk,
  ]
    .filter(
      (value) =>
        typeof value === "string",
    )
    .join(" ")
    .replace(
      /\s+/g,
      " ",
    )
    .trim();

  const contradictions = [];

  if (
    metrics.investigationsOpened
      > 0
    && containsNoInvestigationsOpenedClaim(
      narrativeText,
    )
  ) {
    contradictions.push(
      `Narrative claims no investigations were opened, but canonical investigationsOpened is ${metrics.investigationsOpened}.`,
    );
  }

  if (
    metrics.investigationsResolved
      > 0
    && containsNoInvestigationsResolvedClaim(
      narrativeText,
    )
  ) {
    contradictions.push(
      `Narrative claims no investigations were resolved, but canonical investigationsResolved is ${metrics.investigationsResolved}.`,
    );
  }

  if (
    metrics.investigationsOpened
      === 0
    && containsPositiveInvestigationsOpenedClaim(
      narrativeText,
    )
  ) {
    contradictions.push(
      "Narrative claims investigations were opened, but canonical investigationsOpened is 0.",
    );
  }

  if (
    metrics.investigationsResolved
      === 0
    && containsPositiveInvestigationsResolvedClaim(
      narrativeText,
    )
  ) {
    contradictions.push(
      "Narrative claims investigations were resolved, but canonical investigationsResolved is 0.",
    );
  }

  if (
    contradictions.length > 0
  ) {
    throw new Error(
      `Operational Report narrative contradicts canonical investigation evidence: ${
        contradictions.join(" ")
      }`,
    );
  }
}

function containsNoInvestigationsOpenedClaim(
  value,
) {
  return [
    /\bno\s+new\s+investigations?\s+(?:were\s+|was\s+)?opened\b/i,
    /\bno\s+investigations?\s+(?:were\s+|was\s+)?opened\b/i,
    /\bnone\s+(?:were\s+|was\s+)?opened\b/i,
    /\bzero\s+investigations?\s+(?:were\s+|was\s+)?opened\b/i,
  ].some(
    (pattern) =>
      pattern.test(value),
  );
}

function containsNoInvestigationsResolvedClaim(
  value,
) {
  return [
    /\bno\s+investigations?\s+(?:were\s+|was\s+)?resolved\b/i,
    /\bnone\s+(?:were\s+|was\s+)?resolved\b/i,
    /\bzero\s+investigations?\s+(?:were\s+|was\s+)?resolved\b/i,
  ].some(
    (pattern) =>
      pattern.test(value),
  );
}

function containsPositiveInvestigationsOpenedClaim(
  value,
) {
  return [
    /\b(?:one|two|three|several|multiple|\d+)\s+investigations?\s+(?:were\s+|was\s+)?opened\b/i,
    /\ba\s+new\s+investigation\s+(?:was\s+)?opened\b/i,
    /\bnew\s+investigations?\s+(?:were\s+|was\s+)?opened\b/i,
  ].some(
    (pattern) =>
      pattern.test(value),
  );
}

function containsPositiveInvestigationsResolvedClaim(
  value,
) {
  return [
    /\b(?:one|two|three|several|multiple|\d+)\s+investigations?\s+(?:were\s+|was\s+)?resolved\b/i,
    /\bthe\s+investigation\s+was\s+resolved\b/i,
    /\ban\s+investigation\s+was\s+resolved\b/i,
  ].some(
    (pattern) =>
      pattern.test(value),
  );
}

function validateCanonicalFields({
  report,
  reportingPeriod,
  metrics,
  confidenceSignals,
}) {
  if (
    report.metadata
      .reportingPeriod
      .start
      !== reportingPeriod.start
    || report.metadata
      .reportingPeriod
      .end
      !== reportingPeriod.end
    || report.metadata
      .reportingPeriod
      .days
      !== reportingPeriod.days
  ) {
    throw new Error(
      "Operational Report reporting period does not match the requested reporting period.",
    );
  }

  const canonicalComparisons = [
    [
      report.metadata
        .signalsAnalyzed,
      metrics.signalsAnalyzed,
      "metadata.signalsAnalyzed",
    ],

    [
      report.performance
        .signalsAnalyzed,
      metrics.signalsAnalyzed,
      "performance.signalsAnalyzed",
    ],

    [
      report.performance
        .materialSignals,
      metrics.materialSignals,
      "performance.materialSignals",
    ],

    [
      report.performance
        .investigationsOpened,
      metrics.investigationsOpened,
      "performance.investigationsOpened",
    ],

    [
      report.performance
        .investigationsResolved,
      metrics.investigationsResolved,
      "performance.investigationsResolved",
    ],

    [
      report.performance
        .resolutionRate,
      metrics.resolutionRate,
      "performance.resolutionRate",
    ],

    [
      report.performance
        .medianResolutionMinutes,
      metrics.medianResolutionMinutes,
      "performance.medianResolutionMinutes",
    ],

    [
      report.performance
        .servicesAffected,
      metrics.servicesAffected,
      "performance.servicesAffected",
    ],

    [
      report.performance
        .openExposure,
      metrics.openExposure,
      "performance.openExposure",
    ],

    [
      report.metadata.services,
      metrics.serviceCount,
      "metadata.services",
    ],

    [
      report.metadata
        .environments,
      metrics.environmentCount,
      "metadata.environments",
    ],

    [
      report.metadata
        .evidenceConfidence,
      confidenceSignals
        .evidenceStrength,
      "metadata.evidenceConfidence",
    ],

    [
      report.conclusion
        .confidence,
      confidenceSignals
        .evidenceStrength,
      "conclusion.confidence",
    ],
  ];

  canonicalComparisons.forEach(
    ([
      actual,
      expected,
      fieldName,
    ]) => {
      if (actual !== expected) {
        throw new Error(
          `Operational Report field "${fieldName}" does not match canonical evidence.`,
        );
      }
    },
  );
}

function validateFindingReferences({
  report,
  findings,
}) {
  const validFindingIds =
    new Set(
      findings.map(
        (finding) =>
          finding.id,
      ),
    );

  const references = [
    ...report.investigations
      .flatMap(
        (item) =>
          item.supportingFindingIds,
      ),

    ...report.recurringConditions
      .flatMap(
        (item) =>
          item.supportingFindingIds,
      ),

    ...report.leadershipActions
      .completed
      .flatMap(
        (item) =>
          item.supportingFindingIds,
      ),

    ...report.leadershipActions
      .carryForward
      .flatMap(
        (item) =>
          item.supportingFindingIds,
      ),
  ];

  const invalidReferences =
    references.filter(
      (findingId) =>
        !validFindingIds.has(
          findingId,
        ),
    );

  if (
    invalidReferences.length > 0
  ) {
    throw new Error(
      `Operational Report contains unsupported finding references: ${
        uniqueStrings(
          invalidReferences,
        ).join(", ")
      }`,
    );
  }
}

function validateEvidenceCollections({
  report,
  investigations,
  leadershipActions,
}) {
  const canonicalInvestigationIds =
    new Set(
      investigations.map(
        (investigation) =>
          investigation.id,
      ),
    );

  const reportInvestigationIds =
    report.investigations.map(
      (investigation) =>
        investigation.id,
    );

  const unsupportedInvestigationIds =
    reportInvestigationIds.filter(
      (investigationId) =>
        !canonicalInvestigationIds.has(
          investigationId,
        ),
    );

  if (
    unsupportedInvestigationIds.length
      > 0
  ) {
    throw new Error(
      `Operational Report contains unsupported investigations: ${
        uniqueStrings(
          unsupportedInvestigationIds,
        ).join(", ")
      }`,
    );
  }

  if (
    report.investigations.length
    !== investigations.length
  ) {
    throw new Error(
      "Operational Report investigation collection does not match canonical evidence.",
    );
  }

  if (
    leadershipActions.completed
      .length === 0
    && report.leadershipActions
      .completed.length !== 0
  ) {
    throw new Error(
      "Operational Report invented completed leadership actions.",
    );
  }

  if (
    leadershipActions.carryForward
      .length === 0
    && report.leadershipActions
      .carryForward.length !== 0
  ) {
    throw new Error(
      "Operational Report invented carry-forward leadership actions.",
    );
  }
}

function getResponseContent(result) {
  const content =
    result?.choices?.[0]
      ?.message?.content;

  if (
    typeof content !== "string"
    || content.trim() === ""
  ) {
    throw new Error(
      "OpenAI returned an empty Operational Report response.",
    );
  }

  return content;
}

module.exports = {
  createOperationalReportingIntelligence,

  buildReportingPrompt,
  parseReportingResult,
  validateOperationalReport,
};
