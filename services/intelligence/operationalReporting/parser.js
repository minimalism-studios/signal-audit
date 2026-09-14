const CONFIDENCE_LEVELS = new Set([
  "high",
  "medium",
  "low",
]);

const OPERATIONAL_DIRECTIONS = new Set([
  "improving",
  "stable",
  "deteriorating",
  "indeterminate",
]);

const SEVERITIES = new Set([
  "critical",
  "high",
  "medium",
  "low",
  "unknown",
]);

const INVESTIGATION_STATUSES = new Set([
  "open",
  "investigating",
  "monitoring",
  "resolved",
  "closed",
  "unknown",
]);

const EXPOSURE_DIRECTIONS = new Set([
  "improving",
  "stable",
  "worsening",
  "indeterminate",
]);

const ENVIRONMENT_ASSESSMENTS =
  new Set([
    "healthy",
    "stable",
    "attention",
    "critical",
    "indeterminate",
  ]);

const CONDITION_STATUSES = new Set([
  "active",
  "monitoring",
  "resolved",
  "indeterminate",
]);

const ACTION_PRIORITIES = new Set([
  "critical",
  "high",
  "medium",
  "low",
]);

function parseReportingResult(rawResult) {
  const parsed =
    parseJsonResult(rawResult);

  assertPlainObject(
    parsed,
    "report",
  );

  const report = {
    metadata:
      parseMetadata(parsed.metadata),

    summary:
      parseSummary(parsed.summary),

    operationalNarrative:
      parseOperationalNarrative(
        parsed.operationalNarrative,
      ),

    performance:
      parsePerformance(
        parsed.performance,
      ),

    investigations:
      parseInvestigations(
        parsed.investigations,
      ),

    serviceExposure:
      parseServiceExposure(
        parsed.serviceExposure,
      ),

    environmentExposure:
      parseEnvironmentExposure(
        parsed.environmentExposure,
      ),

    recurringConditions:
      parseRecurringConditions(
        parsed.recurringConditions,
      ),

    leadershipActions:
      parseLeadershipActions(
        parsed.leadershipActions,
      ),

    conclusion:
      parseConclusion(
        parsed.conclusion,
      ),
  };

  validateReportConsistency(report);

  return report;
}

function parseMetadata(value) {
  assertPlainObject(
    value,
    "metadata",
  );

  assertPlainObject(
    value.reportingPeriod,
    "metadata.reportingPeriod",
  );

  const confidence =
    parseEnum(
      value.evidenceConfidence,
      CONFIDENCE_LEVELS,
      "metadata.evidenceConfidence",
    );

  return {
    reportingPeriod: {
      start:
        parseIsoTimestamp(
          value.reportingPeriod.start,
          "metadata.reportingPeriod.start",
        ),

      end:
        parseIsoTimestamp(
          value.reportingPeriod.end,
          "metadata.reportingPeriod.end",
        ),

      days:
        parseNonNegativeInteger(
          value.reportingPeriod.days,
          "metadata.reportingPeriod.days",
        ),
    },

    services:
      parseNonNegativeInteger(
        value.services,
        "metadata.services",
      ),

    environments:
      parseNonNegativeInteger(
        value.environments,
        "metadata.environments",
      ),

    signalsAnalyzed:
      parseNonNegativeInteger(
        value.signalsAnalyzed,
        "metadata.signalsAnalyzed",
      ),

    evidenceConfidence:
      confidence,

    confidenceReason:
      parseRequiredString(
        value.confidenceReason,
        "metadata.confidenceReason",
      ),
  };
}

function parseSummary(value) {
  assertPlainObject(
    value,
    "summary",
  );

  return {
    headline:
      parseRequiredString(
        value.headline,
        "summary.headline",
      ),

    overview:
      parseRequiredString(
        value.overview,
        "summary.overview",
      ),

    operationalDirection:
      parseEnum(
        value.operationalDirection,
        OPERATIONAL_DIRECTIONS,
        "summary.operationalDirection",
      ),

    materialChange:
      parseNullableString(
        value.materialChange,
        "summary.materialChange",
      ),

    carryForwardRisk:
      parseNullableString(
        value.carryForwardRisk,
        "summary.carryForwardRisk",
      ),
  };
}

function parseOperationalNarrative(value) {
  assertPlainObject(
    value,
    "operationalNarrative",
  );

  const title =
    parseRequiredString(
      value.title,
      "operationalNarrative.title",
    );

  if (title !== "What Changed") {
    throw new Error(
      'Reporting field "operationalNarrative.title" must equal "What Changed".',
    );
  }

  return {
    title,

    summary:
      parseRequiredString(
        value.summary,
        "operationalNarrative.summary",
      ),
  };
}

function parsePerformance(value) {
  assertPlainObject(
    value,
    "performance",
  );

  return {
    signalsAnalyzed:
      parseNonNegativeInteger(
        value.signalsAnalyzed,
        "performance.signalsAnalyzed",
      ),

    materialSignals:
      parseNonNegativeInteger(
        value.materialSignals,
        "performance.materialSignals",
      ),

    investigationsOpened:
      parseNonNegativeInteger(
        value.investigationsOpened,
        "performance.investigationsOpened",
      ),

    investigationsResolved:
      parseNonNegativeInteger(
        value.investigationsResolved,
        "performance.investigationsResolved",
      ),

    resolutionRate:
      parsePercentage(
        value.resolutionRate,
        "performance.resolutionRate",
      ),

    medianResolutionMinutes:
      parseNonNegativeInteger(
        value.medianResolutionMinutes,
        "performance.medianResolutionMinutes",
      ),

    recurrenceRate:
      parsePercentage(
        value.recurrenceRate,
        "performance.recurrenceRate",
      ),

    servicesAffected:
      parseNonNegativeInteger(
        value.servicesAffected,
        "performance.servicesAffected",
      ),

    openExposure:
      parseNonNegativeInteger(
        value.openExposure,
        "performance.openExposure",
      ),
  };
}

function parseInvestigations(value) {
  assertArray(
    value,
    "investigations",
  );

  return value.map(
    (item, index) => {
      const path =
        `investigations[${index}]`;

      assertPlainObject(
        item,
        path,
      );

      return {
        id:
          parseRequiredString(
            item.id,
            `${path}.id`,
          ),

        title:
          parseRequiredString(
            item.title,
            `${path}.title`,
          ),

        priority:
          parsePositiveInteger(
            item.priority,
            `${path}.priority`,
          ),

        severity:
          parseEnum(
            item.severity,
            SEVERITIES,
            `${path}.severity`,
          ),

        status:
          parseEnum(
            item.status,
            INVESTIGATION_STATUSES,
            `${path}.status`,
          ),

        service:
          parseNullableString(
            item.service,
            `${path}.service`,
          ),

        environment:
          parseNullableString(
            item.environment,
            `${path}.environment`,
          ),

        durationMinutes:
          parseNonNegativeInteger(
            item.durationMinutes,
            `${path}.durationMinutes`,
          ),

        businessImpact:
          parseNullableString(
            item.businessImpact,
            `${path}.businessImpact`,
          ),

        outcome:
          parseNullableString(
            item.outcome,
            `${path}.outcome`,
          ),

        supportingFindingIds:
          parseStringArray(
            item.supportingFindingIds,
            `${path}.supportingFindingIds`,
          ),
      };
    },
  );
}

function parseServiceExposure(value) {
  assertArray(
    value,
    "serviceExposure",
  );

  return value.map(
    (item, index) => {
      const path =
        `serviceExposure[${index}]`;

      assertPlainObject(
        item,
        path,
      );

      return {
        service:
          parseRequiredString(
            item.service,
            `${path}.service`,
          ),

        materialFindings:
          parseNonNegativeInteger(
            item.materialFindings,
            `${path}.materialFindings`,
          ),

        investigations:
          parseNonNegativeInteger(
            item.investigations,
            `${path}.investigations`,
          ),

        openRisk:
          parseNonNegativeInteger(
            item.openRisk,
            `${path}.openRisk`,
          ),

        direction:
          parseEnum(
            item.direction,
            EXPOSURE_DIRECTIONS,
            `${path}.direction`,
          ),

        assessment:
          parseRequiredString(
            item.assessment,
            `${path}.assessment`,
          ),
      };
    },
  );
}

function parseEnvironmentExposure(value) {
  assertArray(
    value,
    "environmentExposure",
  );

  return value.map(
    (item, index) => {
      const path =
        `environmentExposure[${index}]`;

      assertPlainObject(
        item,
        path,
      );

      return {
        environment:
          parseRequiredString(
            item.environment,
            `${path}.environment`,
          ),

        signals:
          parseNonNegativeInteger(
            item.signals,
            `${path}.signals`,
          ),

        materialFindings:
          parseNonNegativeInteger(
            item.materialFindings,
            `${path}.materialFindings`,
          ),

        availability:
          parseNullablePercentage(
            item.availability,
            `${path}.availability`,
          ),

        assessment:
          parseEnum(
            item.assessment,
            ENVIRONMENT_ASSESSMENTS,
            `${path}.assessment`,
          ),
      };
    },
  );
}

function parseRecurringConditions(value) {
  assertArray(
    value,
    "recurringConditions",
  );

  return value.map(
    (item, index) => {
      const path =
        `recurringConditions[${index}]`;

      assertPlainObject(
        item,
        path,
      );

      return {
        title:
          parseRequiredString(
            item.title,
            `${path}.title`,
          ),

        affectedServices:
          parseStringArray(
            item.affectedServices,
            `${path}.affectedServices`,
          ),

        occurrences:
          parsePositiveInteger(
            item.occurrences,
            `${path}.occurrences`,
          ),

        firstObserved:
          parseIsoTimestamp(
            item.firstObserved,
            `${path}.firstObserved`,
          ),

        lastObserved:
          parseIsoTimestamp(
            item.lastObserved,
            `${path}.lastObserved`,
          ),

        status:
          parseEnum(
            item.status,
            CONDITION_STATUSES,
            `${path}.status`,
          ),

        implication:
          parseRequiredString(
            item.implication,
            `${path}.implication`,
          ),

        supportingFindingIds:
          parseStringArray(
            item.supportingFindingIds,
            `${path}.supportingFindingIds`,
          ),
      };
    },
  );
}

function parseLeadershipActions(value) {
  assertPlainObject(
    value,
    "leadershipActions",
  );

  assertArray(
    value.completed,
    "leadershipActions.completed",
  );

  assertArray(
    value.carryForward,
    "leadershipActions.carryForward",
  );

  return {
    completed:
      value.completed.map(
        (item, index) => {
          const path =
            `leadershipActions.completed[${index}]`;

          assertPlainObject(
            item,
            path,
          );

          return {
            title:
              parseRequiredString(
                item.title,
                `${path}.title`,
              ),

            owner:
              parseNullableString(
                item.owner,
                `${path}.owner`,
              ),

            relatedInvestigationId:
              parseNullableString(
                item.relatedInvestigationId,
                `${path}.relatedInvestigationId`,
              ),

            outcome:
              parseRequiredString(
                item.outcome,
                `${path}.outcome`,
              ),

            supportingFindingIds:
              parseStringArray(
                item.supportingFindingIds,
                `${path}.supportingFindingIds`,
              ),
          };
        },
      ),

    carryForward:
      value.carryForward.map(
        (item, index) => {
          const path =
            `leadershipActions.carryForward[${index}]`;

          assertPlainObject(
            item,
            path,
          );

          return {
            title:
              parseRequiredString(
                item.title,
                `${path}.title`,
              ),

            priority:
              parseEnum(
                item.priority,
                ACTION_PRIORITIES,
                `${path}.priority`,
              ),

            owner:
              parseNullableString(
                item.owner,
                `${path}.owner`,
              ),

            exposure:
              parseRequiredString(
                item.exposure,
                `${path}.exposure`,
              ),

            relatedInvestigationId:
              parseNullableString(
                item.relatedInvestigationId,
                `${path}.relatedInvestigationId`,
              ),

            supportingFindingIds:
              parseStringArray(
                item.supportingFindingIds,
                `${path}.supportingFindingIds`,
              ),
          };
        },
      ),
  };
}

function parseConclusion(value) {
  assertPlainObject(
    value,
    "conclusion",
  );

  return {
    assessment:
      parseRequiredString(
        value.assessment,
        "conclusion.assessment",
      ),

    carryForwardRisk:
      parseNullableString(
        value.carryForwardRisk,
        "conclusion.carryForwardRisk",
      ),

    nextPriority:
      parseRequiredString(
        value.nextPriority,
        "conclusion.nextPriority",
      ),

    confidence:
      parseEnum(
        value.confidence,
        CONFIDENCE_LEVELS,
        "conclusion.confidence",
      ),

    confidenceReason:
      parseRequiredString(
        value.confidenceReason,
        "conclusion.confidenceReason",
      ),
  };
}

function validateReportConsistency(report) {
  if (
    report.metadata.signalsAnalyzed
    !== report.performance.signalsAnalyzed
  ) {
    throw new Error(
      "Reporting signal counts must match between metadata and performance.",
    );
  }

  if (
    report.metadata.evidenceConfidence
    !== report.conclusion.confidence
  ) {
    throw new Error(
      "Reporting confidence must match between metadata and conclusion.",
    );
  }

  report.investigations.forEach(
    (investigation, index) => {
      const expectedPriority =
        index + 1;

      if (
        investigation.priority
        !== expectedPriority
      ) {
        throw new Error(
          `Reporting investigation priority at index ${index} must equal ${expectedPriority}.`,
        );
      }
    },
  );

  report.recurringConditions.forEach(
    (condition, index) => {
      const first =
        Date.parse(
          condition.firstObserved,
        );

      const last =
        Date.parse(
          condition.lastObserved,
        );

      if (first > last) {
        throw new Error(
          `Reporting recurringConditions[${index}].firstObserved cannot be after lastObserved.`,
        );
      }
    },
  );

  const periodStart =
    Date.parse(
      report.metadata
        .reportingPeriod
        .start,
    );

  const periodEnd =
    Date.parse(
      report.metadata
        .reportingPeriod
        .end,
    );

  if (periodStart > periodEnd) {
    throw new Error(
      "Reporting period start cannot be after its end.",
    );
  }
}

function parseJsonResult(rawResult) {
  if (
    rawResult
    && typeof rawResult === "object"
    && !Array.isArray(rawResult)
  ) {
    return rawResult;
  }

  if (typeof rawResult !== "string") {
    throw new TypeError(
      "Reporting result must be a JSON string or object.",
    );
  }

  const trimmed =
    rawResult.trim();

  if (!trimmed) {
    throw new Error(
      "Reporting result cannot be empty.",
    );
  }

  const withoutFence =
    trimmed
      .replace(
        /^```(?:json)?\s*/i,
        "",
      )
      .replace(
        /\s*```$/,
        "",
      )
      .trim();

  try {
    return JSON.parse(
      withoutFence,
    );
  } catch (error) {
    throw new Error(
      `Reporting result contains invalid JSON: ${error.message}`,
    );
  }
}

function parseRequiredString(
  value,
  fieldName,
) {
  if (typeof value !== "string") {
    throw new TypeError(
      `Reporting field "${fieldName}" must be a string.`,
    );
  }

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `Reporting field "${fieldName}" cannot be empty.`,
    );
  }

  return normalized;
}

function parseNullableString(
  value,
  fieldName,
) {
  if (
    value === null
    || value === undefined
  ) {
    return null;
  }

  return parseRequiredString(
    value,
    fieldName,
  );
}

function parseStringArray(
  value,
  fieldName,
) {
  assertArray(
    value,
    fieldName,
  );

  return [
    ...new Set(
      value.map(
        (item, index) =>
          parseRequiredString(
            item,
            `${fieldName}[${index}]`,
          ),
      ),
    ),
  ];
}

function parseEnum(
  value,
  allowedValues,
  fieldName,
) {
  const normalized =
    parseRequiredString(
      value,
      fieldName,
    ).toLowerCase();

  if (
    !allowedValues.has(
      normalized,
    )
  ) {
    throw new Error(
      `Reporting field "${fieldName}" contains unsupported value "${value}".`,
    );
  }

  return normalized;
}

function parseNonNegativeInteger(
  value,
  fieldName,
) {
  if (
    !Number.isInteger(value)
    || value < 0
  ) {
    throw new TypeError(
      `Reporting field "${fieldName}" must be a non-negative integer.`,
    );
  }

  return value;
}

function parsePositiveInteger(
  value,
  fieldName,
) {
  if (
    !Number.isInteger(value)
    || value < 1
  ) {
    throw new TypeError(
      `Reporting field "${fieldName}" must be a positive integer.`,
    );
  }

  return value;
}

function parsePercentage(
  value,
  fieldName,
) {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < 0
    || value > 100
  ) {
    throw new TypeError(
      `Reporting field "${fieldName}" must be a number from 0 through 100.`,
    );
  }

  return value;
}

function parseNullablePercentage(
  value,
  fieldName,
) {
  if (
    value === null
    || value === undefined
  ) {
    return null;
  }

  return parsePercentage(
    value,
    fieldName,
  );
}

function parseIsoTimestamp(
  value,
  fieldName,
) {
  const normalized =
    parseRequiredString(
      value,
      fieldName,
    );

  if (
    Number.isNaN(
      Date.parse(normalized),
    )
  ) {
    throw new Error(
      `Reporting field "${fieldName}" must be a valid ISO-8601 timestamp.`,
    );
  }

  return normalized;
}

function assertPlainObject(
  value,
  fieldName,
) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new TypeError(
      `Reporting field "${fieldName}" must be an object.`,
    );
  }
}

function assertArray(
  value,
  fieldName,
) {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Reporting field "${fieldName}" must be an array.`,
    );
  }
}

module.exports = {
  parseReportingResult,
};
