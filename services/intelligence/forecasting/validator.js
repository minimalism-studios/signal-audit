const CONFIDENCE_VALUES = [
  "low",
  "moderate",
  "high",
];

const RISK_VALUES = [
  "low",
  "moderate",
  "high",
  "critical",
];

const TRAJECTORY_VALUES = [
  "improving",
  "stable",
  "worsening",
  "indeterminate",
];

const LIKELIHOOD_VALUES = [
  "low",
  "moderate",
  "high",
];

function validateOperationalForecast(
  forecast,
) {
  assertObject(
    forecast,
    "forecast",
  );

  validateMetadata(
    forecast.metadata,
  );

  validateExecutiveOutlook(
    forecast.executiveOutlook,
  );

  validatePriorityRisks(
    forecast.priorityRisks,
  );

  validateWatchItems(
    forecast.watchItems,
  );

  validateRecommendedFocus(
    forecast.recommendedFocus,
  );

  validatePositiveIndicators(
    forecast.positiveIndicators,
  );

  assertStringArray(
    forecast.assumptions,
    "assumptions",
  );

  assertNonEmptyString(
    forecast.conclusion,
    "conclusion",
  );

  return forecast;
}

function validateMetadata(metadata) {
  assertObject(
    metadata,
    "metadata",
  );

  assertNonEmptyString(
    metadata.analysisPeriod,
    "metadata.analysisPeriod",
  );

  assertNonEmptyString(
    metadata.forecastWindow,
    "metadata.forecastWindow",
  );

  assertNonNegativeInteger(
    metadata.signalsAnalyzed,
    "metadata.signalsAnalyzed",
  );

  assertNonNegativeInteger(
    metadata.findingsAnalyzed,
    "metadata.findingsAnalyzed",
  );

  assertEnum(
    metadata.confidence,
    CONFIDENCE_VALUES,
    "metadata.confidence",
  );

  assertNonEmptyString(
    metadata.confidenceReason,
    "metadata.confidenceReason",
  );
}

function validateExecutiveOutlook(
  outlook,
) {
  assertObject(
    outlook,
    "executiveOutlook",
  );

  assertNonEmptyString(
    outlook.headline,
    "executiveOutlook.headline",
  );

  assertNonEmptyString(
    outlook.summary,
    "executiveOutlook.summary",
  );

  assertEnum(
    outlook.overallRisk,
    RISK_VALUES,
    "executiveOutlook.overallRisk",
  );

  assertEnum(
    outlook.operationalTrajectory,
    TRAJECTORY_VALUES,
    "executiveOutlook.operationalTrajectory",
  );

  assertNonEmptyString(
    outlook.materialConcern,
    "executiveOutlook.materialConcern",
  );
}

function validatePriorityRisks(
  risks,
) {
  assertArray(
    risks,
    "priorityRisks",
  );

  risks.forEach(
    (risk, index) => {
      const path =
        `priorityRisks[${index}]`;

      assertObject(
        risk,
        path,
      );

      assertNonEmptyString(
        risk.title,
        `${path}.title`,
      );

      assertNonEmptyString(
        risk.service,
        `${path}.service`,
      );

      assertNonEmptyString(
        risk.forecast,
        `${path}.forecast`,
      );

      assertEnum(
        risk.likelihood,
        LIKELIHOOD_VALUES,
        `${path}.likelihood`,
      );

      assertEnum(
        risk.riskLevel,
        RISK_VALUES,
        `${path}.riskLevel`,
      );

      assertNonEmptyString(
        risk.businessImpact,
        `${path}.businessImpact`,
      );

      assertStringArray(
        risk.supportingFindingIds,
        `${path}.supportingFindingIds`,
        {
          requireItems: true,
        },
      );
    },
  );
}

function validateWatchItems(
  items,
) {
  assertArray(
    items,
    "watchItems",
  );

  items.forEach(
    (item, index) => {
      const path =
        `watchItems[${index}]`;

      assertObject(
        item,
        path,
      );

      assertNonEmptyString(
        item.title,
        `${path}.title`,
      );

      assertNonEmptyString(
        item.condition,
        `${path}.condition`,
      );

      assertNonEmptyString(
        item.monitorFor,
        `${path}.monitorFor`,
      );

      assertStringArray(
        item.supportingFindingIds,
        `${path}.supportingFindingIds`,
      );
    },
  );
}

function validateRecommendedFocus(
  items,
) {
  assertArray(
    items,
    "recommendedFocus",
  );

  items.forEach(
    (item, index) => {
      const path =
        `recommendedFocus[${index}]`;

      assertObject(
        item,
        path,
      );

      assertNonEmptyString(
        item.priority,
        `${path}.priority`,
      );

      assertNonEmptyString(
        item.rationale,
        `${path}.rationale`,
      );

      assertNonEmptyString(
        item.expectedEffect,
        `${path}.expectedEffect`,
      );

      assertStringArray(
        item.supportingFindingIds,
        `${path}.supportingFindingIds`,
      );
    },
  );
}

function validatePositiveIndicators(
  items,
) {
  assertArray(
    items,
    "positiveIndicators",
  );

  items.forEach(
    (item, index) => {
      const path =
        `positiveIndicators[${index}]`;

      assertObject(
        item,
        path,
      );

      assertNonEmptyString(
        item.indicator,
        `${path}.indicator`,
      );

      assertNonEmptyString(
        item.implication,
        `${path}.implication`,
      );

      assertStringArray(
        item.supportingFindingIds,
        `${path}.supportingFindingIds`,
      );
    },
  );
}

function assertObject(
  value,
  path,
) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new Error(
      `Forecast Intelligence field "${path}" must be an object.`,
    );
  }
}

function assertArray(
  value,
  path,
) {
  if (!Array.isArray(value)) {
    throw new Error(
      `Forecast Intelligence field "${path}" must be an array.`,
    );
  }
}

function assertNonEmptyString(
  value,
  path,
) {
  if (
    typeof value !== "string"
    || !value.trim()
  ) {
    throw new Error(
      `Forecast Intelligence field "${path}" must be a non-empty string.`,
    );
  }
}

function assertNonNegativeInteger(
  value,
  path,
) {
  if (
    !Number.isInteger(value)
    || value < 0
  ) {
    throw new Error(
      `Forecast Intelligence field "${path}" must be a non-negative integer.`,
    );
  }
}

function assertEnum(
  value,
  allowedValues,
  path,
) {
  assertNonEmptyString(
    value,
    path,
  );

  if (
    !allowedValues.includes(
      value,
    )
  ) {
    throw new Error(
      `Forecast Intelligence field "${path}" must be one of: ${allowedValues.join(", ")}.`,
    );
  }
}

function assertStringArray(
  value,
  path,
  {
    requireItems = false,
  } = {},
) {
  assertArray(
    value,
    path,
  );

  if (
    requireItems
    && value.length === 0
  ) {
    throw new Error(
      `Forecast Intelligence field "${path}" must contain at least one item.`,
    );
  }

  value.forEach(
    (item, index) => {
      assertNonEmptyString(
        item,
        `${path}[${index}]`,
      );
    },
  );
}

module.exports = {
  validateOperationalForecast,
};
