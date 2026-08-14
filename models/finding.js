const FINDING_SEVERITIES = Object.freeze([
  "critical",
  "high",
  "medium",
  "low",
  "informational",
]);

const FINDING_CATEGORIES = Object.freeze([
  "availability",
  "capacity",
  "configuration",
  "deployment",
  "dependency",
  "networking",
  "performance",
  "reliability",
  "security",
  "unknown",
]);

/**
 * Creates a normalized Signal Audit finding.
 *
 * This model is intentionally vendor-neutral. Grafana, Datadog, Jira,
 * ServiceNow, and other integrations should adapt to or from this model.
 *
 * @param {object} input
 * @returns {object}
 */
function createFinding(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Finding input must be an object.");
  }

  const finding = {
    id: normalizeRequiredString(input.id, "id"),
    severity: normalizeEnum(
      input.severity,
      FINDING_SEVERITIES,
      "severity",
    ),
    confidence: normalizeConfidence(input.confidence),
    category: normalizeEnum(
      input.category ?? "unknown",
      FINDING_CATEGORIES,
      "category",
    ),
    title: normalizeRequiredString(input.title, "title"),
    executiveSummary: normalizeRequiredString(
      input.executiveSummary,
      "executiveSummary",
    ),
    technicalAnalysis: normalizeRequiredString(
      input.technicalAnalysis,
      "technicalAnalysis",
    ),
    evidence: normalizeStringArray(input.evidence, "evidence"),
    businessImpact: normalizeRequiredString(
      input.businessImpact,
      "businessImpact",
    ),
    affectedServices: normalizeStringArray(
      input.affectedServices,
      "affectedServices",
    ),
    recommendedOwner: normalizeOptionalString(input.recommendedOwner),
    actions: {
      immediate: normalizeStringArray(
        input.actions?.immediate,
        "actions.immediate",
      ),
      shortTerm: normalizeStringArray(
        input.actions?.shortTerm,
        "actions.shortTerm",
      ),
      longTerm: normalizeStringArray(
        input.actions?.longTerm,
        "actions.longTerm",
      ),
    },
    relatedSignalIds: normalizeStringArray(
      input.relatedSignalIds,
      "relatedSignalIds",
    ),
  };

  return Object.freeze({
    ...finding,
    actions: Object.freeze({
      immediate: Object.freeze([...finding.actions.immediate]),
      shortTerm: Object.freeze([...finding.actions.shortTerm]),
      longTerm: Object.freeze([...finding.actions.longTerm]),
    }),
    evidence: Object.freeze([...finding.evidence]),
    affectedServices: Object.freeze([...finding.affectedServices]),
    relatedSignalIds: Object.freeze([...finding.relatedSignalIds]),
  });
}

/**
 * Validates an object and returns a normalized Finding.
 *
 * @param {object} input
 * @returns {{ valid: true, finding: object } | { valid: false, errors: string[] }}
 */
function validateFinding(input) {
  try {
    return {
      valid: true,
      finding: createFinding(input),
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
    };
  }
}

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`Finding field "${fieldName}" must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new TypeError("Optional finding fields must be strings when provided.");
  }

  return value.trim() || null;
}

function normalizeEnum(value, allowedValues, fieldName) {
  if (typeof value !== "string") {
    throw new TypeError(`Finding field "${fieldName}" must be a string.`);
  }

  const normalizedValue = value.trim().toLowerCase();

  if (!allowedValues.includes(normalizedValue)) {
    throw new RangeError(
      `Finding field "${fieldName}" must be one of: ${allowedValues.join(", ")}.`,
    );
  }

  return normalizedValue;
}

function normalizeConfidence(value) {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    throw new TypeError('Finding field "confidence" must be a number.');
  }

  if (confidence < 0 || confidence > 100) {
    throw new RangeError(
      'Finding field "confidence" must be between 0 and 100.',
    );
  }

  return Math.round(confidence);
}

function normalizeStringArray(value, fieldName) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new TypeError(`Finding field "${fieldName}" must be an array.`);
  }

  return value
    .map((item) => {
      if (typeof item !== "string") {
        throw new TypeError(
          `Every item in finding field "${fieldName}" must be a string.`,
        );
      }

      return item.trim();
    })
    .filter(Boolean);
}

module.exports = {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  createFinding,
  validateFinding,
};