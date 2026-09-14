const HEALTH_STATUSES = new Set([
  "healthy",
  "attention",
  "critical",
]);

const SEVERITIES = new Set([
  "critical",
  "high",
  "medium",
  "low",
]);

const ACTION_PRIORITIES = new Set([
  "immediate",
  "near-term",
  "strategic",
]);

const CONFIDENCE_LEVELS = new Set([
  "high",
  "medium",
  "low",
]);

/**
 * Parses and validates a structured Leadership Brief response.
 *
 * @param {string|object} input
 * @returns {object}
 */
function parseLeadershipBrief(input) {
  const parsed = parseInput(input);

  if (!isPlainObject(parsed)) {
    throw new TypeError(
      "Leadership Brief must be a JSON object.",
    );
  }

  const briefId = normalizeRequiredString(
    parsed.briefId,
    "briefId",
  );

  const generatedAt = normalizeTimestamp(
    parsed.generatedAt,
    "generatedAt",
  );

  const reportingPeriod = parseReportingPeriod(
    parsed.reportingPeriod,
  );

  const operationalHealth = parseOperationalHealth(
    parsed.operationalHealth,
  );

  const executiveSummary = normalizeRequiredString(
    parsed.executiveSummary,
    "executiveSummary",
  );

  const topOperationalRisks = parseArray(
    parsed.topOperationalRisks,
    "topOperationalRisks",
    parseOperationalRisk,
  );

  const keyWins = parseArray(
    parsed.keyWins,
    "keyWins",
    parseKeyWin,
  );

  const watchItems = parseArray(
    parsed.watchItems,
    "watchItems",
    parseWatchItem,
  );

  const recommendedActions = parseArray(
    parsed.recommendedActions,
    "recommendedActions",
    parseRecommendedAction,
  );

  const confidence = parseConfidence(
    parsed.confidence,
  );

  return deepFreeze({
    briefId,
    generatedAt,
    reportingPeriod,
    operationalHealth,
    executiveSummary,
    topOperationalRisks,
    keyWins,
    watchItems,
    recommendedActions,
    confidence,
  });
}

/**
 * Safely validates a Leadership Brief without throwing.
 *
 * @param {string|object} input
 * @returns {{
 *   valid: true,
 *   leadershipBrief: object
 * } | {
 *   valid: false,
 *   errors: string[]
 * }}
 */
function validateLeadershipBrief(input) {
  try {
    return {
      valid: true,
      leadershipBrief: parseLeadershipBrief(input),
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
    };
  }
}

function parseReportingPeriod(value) {
  assertPlainObject(value, "reportingPeriod");

  const start = normalizeTimestamp(
    value.start,
    "reportingPeriod.start",
  );

  const end = normalizeTimestamp(
    value.end,
    "reportingPeriod.end",
  );

  if (Date.parse(start) > Date.parse(end)) {
    throw new RangeError(
      'Leadership Brief field "reportingPeriod.start" must not occur after "reportingPeriod.end".',
    );
  }

  return {
    start,
    end,
  };
}

function parseOperationalHealth(value) {
  assertPlainObject(value, "operationalHealth");

  const status = normalizeEnum(
    value.status,
    "operationalHealth.status",
    HEALTH_STATUSES,
  );

  const reason = normalizeRequiredString(
    value.reason,
    "operationalHealth.reason",
  );

  return {
    status,
    reason,
  };
}

function parseOperationalRisk(value, index) {
  const fieldName = `topOperationalRisks[${index}]`;

  assertPlainObject(value, fieldName);

  return {
    title: normalizeRequiredString(
      value.title,
      `${fieldName}.title`,
    ),
    severity: normalizeEnum(
      value.severity,
      `${fieldName}.severity`,
      SEVERITIES,
    ),
    summary: normalizeRequiredString(
      value.summary,
      `${fieldName}.summary`,
    ),
    affectedServices: parseStringArray(
      value.affectedServices,
      `${fieldName}.affectedServices`,
    ),
    recommendedOwner: normalizeNullableString(
      value.recommendedOwner,
      `${fieldName}.recommendedOwner`,
    ),
    supportingFindingIds: parseNonEmptyStringArray(
      value.supportingFindingIds,
      `${fieldName}.supportingFindingIds`,
    ),
  };
}

function parseKeyWin(value, index) {
  const fieldName = `keyWins[${index}]`;

  assertPlainObject(value, fieldName);

  return {
    title: normalizeRequiredString(
      value.title,
      `${fieldName}.title`,
    ),
    summary: normalizeRequiredString(
      value.summary,
      `${fieldName}.summary`,
    ),
    supportingFindingIds: parseNonEmptyStringArray(
      value.supportingFindingIds,
      `${fieldName}.supportingFindingIds`,
    ),
  };
}

function parseWatchItem(value, index) {
  const fieldName = `watchItems[${index}]`;

  assertPlainObject(value, fieldName);

  return {
    title: normalizeRequiredString(
      value.title,
      `${fieldName}.title`,
    ),
    summary: normalizeRequiredString(
      value.summary,
      `${fieldName}.summary`,
    ),
    supportingFindingIds: parseNonEmptyStringArray(
      value.supportingFindingIds,
      `${fieldName}.supportingFindingIds`,
    ),
  };
}

function parseRecommendedAction(value, index) {
  const fieldName = `recommendedActions[${index}]`;

  assertPlainObject(value, fieldName);

  return {
    priority: normalizeEnum(
      value.priority,
      `${fieldName}.priority`,
      ACTION_PRIORITIES,
    ),
    action: normalizeRequiredString(
      value.action,
      `${fieldName}.action`,
    ),
    reason: normalizeRequiredString(
      value.reason,
      `${fieldName}.reason`,
    ),
    recommendedOwner: normalizeNullableString(
      value.recommendedOwner,
      `${fieldName}.recommendedOwner`,
    ),
    supportingFindingIds: parseNonEmptyStringArray(
      value.supportingFindingIds,
      `${fieldName}.supportingFindingIds`,
    ),
  };
}

function parseConfidence(value) {
  assertPlainObject(value, "confidence");

  return {
    level: normalizeEnum(
      value.level,
      "confidence.level",
      CONFIDENCE_LEVELS,
    ),
    reason: normalizeRequiredString(
      value.reason,
      "confidence.reason",
    ),
  };
}

function parseArray(value, fieldName, parser) {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Leadership Brief field "${fieldName}" must be an array.`,
    );
  }

  return value.map((item, index) => {
    try {
      return parser(item, index);
    } catch (error) {
      throw new Error(
        `Invalid Leadership Brief item at ${fieldName}[${index}]: ${error.message}`,
      );
    }
  });
}

function parseStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Leadership Brief field "${fieldName}" must be an array.`,
    );
  }

  return value.map((item, index) => (
    normalizeRequiredString(
      item,
      `${fieldName}[${index}]`,
    )
  ));
}

function parseNonEmptyStringArray(value, fieldName) {
  const items = parseStringArray(
    value,
    fieldName,
  );

  if (items.length === 0) {
    throw new RangeError(
      `Leadership Brief field "${fieldName}" must contain at least one item.`,
    );
  }

  return items;
}

function parseInput(input) {
  if (typeof input === "string") {
    const normalized = stripCodeFences(input);

    try {
      return JSON.parse(normalized);
    } catch (error) {
      throw new SyntaxError(
        `Leadership Brief contains invalid JSON: ${error.message}`,
      );
    }
  }

  if (isPlainObject(input)) {
    return input;
  }

  throw new TypeError(
    "Leadership Brief input must be a JSON string or object.",
  );
}

function stripCodeFences(value) {
  const trimmed = value.trim();

  const fencedMatch = trimmed.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
  );

  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  return trimmed;
}

function assertPlainObject(value, fieldName) {
  if (!isPlainObject(value)) {
    throw new TypeError(
      `Leadership Brief field "${fieldName}" must be an object.`,
    );
  }
}

function normalizeRequiredString(value, fieldName) {
  if (
    typeof value !== "string"
    || value.trim() === ""
  ) {
    throw new TypeError(
      `Leadership Brief field "${fieldName}" must be a non-empty string.`,
    );
  }

  return value.trim();
}

function normalizeNullableString(value, fieldName) {
  if (value === null) {
    return null;
  }

  return normalizeRequiredString(
    value,
    fieldName,
  );
}

function normalizeTimestamp(value, fieldName) {
  const normalized = normalizeRequiredString(
    value,
    fieldName,
  );

  const timestamp = Date.parse(normalized);

  if (Number.isNaN(timestamp)) {
    throw new TypeError(
      `Leadership Brief field "${fieldName}" must be a valid ISO-8601 timestamp.`,
    );
  }

  return new Date(timestamp).toISOString();
}

function normalizeEnum(
  value,
  fieldName,
  allowedValues,
) {
  const normalized = normalizeRequiredString(
    value,
    fieldName,
  ).toLowerCase();

  if (!allowedValues.has(normalized)) {
    throw new RangeError(
      `Leadership Brief field "${fieldName}" must be one of: ${[
        ...allowedValues,
      ].join(", ")}.`,
    );
  }

  return normalized;
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  );
}

function deepFreeze(value) {
  if (
    value === null
    || typeof value !== "object"
    || Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach((child) => {
    deepFreeze(child);
  });

  return value;
}

module.exports = {
  parseLeadershipBrief,
  validateLeadershipBrief,
};
