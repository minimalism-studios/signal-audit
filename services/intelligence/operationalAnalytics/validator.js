const DIRECTIONS = new Set([
  "improving",
  "stable",
  "worsening",
  "indeterminate",
]);

const CONFIDENCE_LEVELS =
  new Set([
    "high",
    "medium",
    "low",
  ]);

function validateOperationalAnalytics(
  analytics,
) {
  assertPlainObject(
    analytics,
    "Operational Analytics",
  );

  assertPlainObject(
    analytics.metadata,
    "metadata",
  );

  assertPlainObject(
    analytics.metadata
      .analysisPeriod,
    "metadata.analysisPeriod",
  );

  assertString(
    analytics.metadata
      .analysisPeriod.start,
    "metadata.analysisPeriod.start",
  );

  assertString(
    analytics.metadata
      .analysisPeriod.end,
    "metadata.analysisPeriod.end",
  );

  assertNonNegativeInteger(
    analytics.metadata
      .analysisPeriod.days,
    "metadata.analysisPeriod.days",
  );

  assertNonNegativeInteger(
    analytics.metadata
      .signalsAnalyzed,
    "metadata.signalsAnalyzed",
  );

  assertNonNegativeInteger(
    analytics.metadata.services,
    "metadata.services",
  );

  assertNonNegativeInteger(
    analytics.metadata
      .environments,
    "metadata.environments",
  );

  assertEnum(
    analytics.metadata
      .evidenceConfidence,
    CONFIDENCE_LEVELS,
    "metadata.evidenceConfidence",
  );

  assertString(
    analytics.metadata
      .confidenceReason,
    "metadata.confidenceReason",
  );

  assertPlainObject(
    analytics.summary,
    "summary",
  );

  assertString(
    analytics.summary.headline,
    "summary.headline",
  );

  assertString(
    analytics.summary.overview,
    "summary.overview",
  );

  assertEnum(
    analytics.summary
      .operationalPattern,
    DIRECTIONS,
    "summary.operationalPattern",
  );

  assertNullableString(
    analytics.summary
      .primaryConcentration,
    "summary.primaryConcentration",
  );

  assertNullableString(
    analytics.summary
      .materialInsight,
    "summary.materialInsight",
  );

  assertPlainObject(
    analytics.trendAnalysis,
    "trendAnalysis",
  );

  assertEnum(
    analytics.trendAnalysis
      .direction,
    DIRECTIONS,
    "trendAnalysis.direction",
  );

  assertString(
    analytics.trendAnalysis
      .summary,
    "trendAnalysis.summary",
  );

  [
    "signalVolumeChange",
    "materialSignalChange",
    "openExposureChange",
  ].forEach((field) => {
    assertFiniteNumber(
      analytics.trendAnalysis[
        field
      ],
      `trendAnalysis.${field}`,
    );
  });

  [
    "servicePatterns",
    "environmentPatterns",
    "severityPatterns",
    "categoryPatterns",
    "recurringPatterns",
    "correlations",
    "concentrationRisks",
    "leadershipInsights",
  ].forEach((field) => {
    assertArray(
      analytics[field],
      field,
    );
  });

  analytics.concentrationRisks
    .forEach(
      (risk, index) => {
        assertPlainObject(
          risk,
          `concentrationRisks[${index}]`,
        );

        assertString(
          risk.title,
          `concentrationRisks[${index}].title`,
        );

        assertString(
          risk.assessment,
          `concentrationRisks[${index}].assessment`,
        );

        assertStringArray(
          risk.supportingFindingIds,
          `concentrationRisks[${index}].supportingFindingIds`,
        );
      },
    );

  analytics.leadershipInsights
    .forEach(
      (insight, index) => {
        assertPlainObject(
          insight,
          `leadershipInsights[${index}]`,
        );

        assertString(
          insight.title,
          `leadershipInsights[${index}].title`,
        );

        assertString(
          insight.insight,
          `leadershipInsights[${index}].insight`,
        );

        assertNullableString(
          insight.implication,
          `leadershipInsights[${index}].implication`,
        );

        assertStringArray(
          insight.supportingFindingIds,
          `leadershipInsights[${index}].supportingFindingIds`,
        );
      },
    );

  assertPlainObject(
    analytics.conclusion,
    "conclusion",
  );

  assertString(
    analytics.conclusion
      .assessment,
    "conclusion.assessment",
  );

  assertNullableString(
    analytics.conclusion
      .primaryRisk,
    "conclusion.primaryRisk",
  );

  assertString(
    analytics.conclusion
      .nextAnalyticalPriority,
    "conclusion.nextAnalyticalPriority",
  );

  assertEnum(
    analytics.conclusion
      .confidence,
    CONFIDENCE_LEVELS,
    "conclusion.confidence",
  );

  assertString(
    analytics.conclusion
      .confidenceReason,
    "conclusion.confidenceReason",
  );

  return analytics;
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
      `Operational Analytics field "${fieldName}" must be an object.`,
    );
  }
}

function assertArray(
  value,
  fieldName,
) {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Operational Analytics field "${fieldName}" must be an array.`,
    );
  }
}

function assertString(
  value,
  fieldName,
) {
  if (
    typeof value !== "string"
    || value.trim() === ""
  ) {
    throw new TypeError(
      `Operational Analytics field "${fieldName}" must be a non-empty string.`,
    );
  }
}

function assertNullableString(
  value,
  fieldName,
) {
  if (value === null) {
    return;
  }

  assertString(
    value,
    fieldName,
  );
}

function assertStringArray(
  value,
  fieldName,
) {
  assertArray(
    value,
    fieldName,
  );

  value.forEach(
    (item, index) => {
      assertString(
        item,
        `${fieldName}[${index}]`,
      );
    },
  );
}

function assertFiniteNumber(
  value,
  fieldName,
) {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
  ) {
    throw new TypeError(
      `Operational Analytics field "${fieldName}" must be a finite number.`,
    );
  }
}

function assertNonNegativeInteger(
  value,
  fieldName,
) {
  if (
    !Number.isInteger(value)
    || value < 0
  ) {
    throw new TypeError(
      `Operational Analytics field "${fieldName}" must be a non-negative integer.`,
    );
  }
}

function assertEnum(
  value,
  allowedValues,
  fieldName,
) {
  if (
    typeof value !== "string"
    || !allowedValues.has(value)
  ) {
    throw new TypeError(
      `Operational Analytics field "${fieldName}" contains an unsupported value.`,
    );
  }
}

module.exports = {
  validateOperationalAnalytics,
};
