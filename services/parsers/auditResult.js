const {
  createFinding,
} = require("../../models/finding");

/**
 * Parses and validates a structured Signal Audit response.
 *
 * Expected input:
 *
 * {
 *   auditId: string,
 *   generatedAt: ISO-8601 string,
 *   summary: string,
 *   findings: Finding[]
 * }
 *
 * @param {string|object} input
 * @returns {object}
 */
function parseAuditResult(input) {
  const parsed = parseInput(input);

  if (!isPlainObject(parsed)) {
    throw new TypeError("Audit result must be a JSON object.");
  }

  const auditId = normalizeRequiredString(
    parsed.auditId,
    "auditId",
  );

  const generatedAt = normalizeTimestamp(
    parsed.generatedAt,
    "generatedAt",
  );

  const summary = normalizeRequiredString(
    parsed.summary,
    "summary",
  );

  if (!Array.isArray(parsed.findings)) {
    throw new TypeError(
      'Audit result field "findings" must be an array.',
    );
  }

  if (parsed.findings.length === 0) {
    throw new RangeError(
      'Audit result field "findings" must contain at least one finding.',
    );
  }

  const findings = parsed.findings.map((finding, index) => {
    try {
      return createFinding(finding);
    } catch (error) {
      throw new Error(
        `Invalid finding at index ${index}: ${error.message}`,
      );
    }
  });

  return Object.freeze({
    auditId,
    generatedAt,
    summary,
    findings: Object.freeze([...findings]),
  });
}

/**
 * Safely validates an audit result without throwing.
 *
 * @param {string|object} input
 * @returns {{
 *   valid: true,
 *   auditResult: object
 * } | {
 *   valid: false,
 *   errors: string[]
 * }}
 */
function validateAuditResult(input) {
  try {
    return {
      valid: true,
      auditResult: parseAuditResult(input),
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
    };
  }
}

function parseInput(input) {
  if (typeof input === "string") {
    const normalized = stripCodeFences(input);

    try {
      return JSON.parse(normalized);
    } catch (error) {
      throw new SyntaxError(
        `Audit result contains invalid JSON: ${error.message}`,
      );
    }
  }

  if (isPlainObject(input)) {
    return input;
  }

  throw new TypeError(
    "Audit result input must be a JSON string or object.",
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

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(
      `Audit result field "${fieldName}" must be a non-empty string.`,
    );
  }

  return value.trim();
}

function normalizeTimestamp(value, fieldName) {
  const normalized = normalizeRequiredString(
    value,
    fieldName,
  );

  const timestamp = Date.parse(normalized);

  if (Number.isNaN(timestamp)) {
    throw new TypeError(
      `Audit result field "${fieldName}" must be a valid ISO-8601 timestamp.`,
    );
  }

  return new Date(timestamp).toISOString();
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  );
}

module.exports = {
  parseAuditResult,
  validateAuditResult,
};
