"use strict";

const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);

function parseInvestigativeResponse(input, authorizedSignalId) {
  if (
    typeof authorizedSignalId !== "string"
    || !authorizedSignalId.trim()
  ) {
    throw new TypeError("Authorized signal ID is required.");
  }

  const parsed = typeof input === "string"
    ? JSON.parse(input)
    : input;

  if (
    !parsed
    || typeof parsed !== "object"
    || Array.isArray(parsed)
  ) {
    throw new TypeError("Investigative response must be an object.");
  }

  function requiredText(value, field) {
    if (
      typeof value !== "string"
      || !value.trim()
      || value.length > 4000
    ) {
      throw new TypeError(`Invalid investigative field: ${field}.`);
    }

    return value.trim();
  }

  function textArray(value, field) {
    if (!Array.isArray(value) || value.length > 10) {
      throw new TypeError(`Invalid investigative field: ${field}.`);
    }

    return Object.freeze(
      value.map((item) => requiredText(item, field)),
    );
  }

  if (
    !Array.isArray(parsed.observations)
    || parsed.observations.length > 10
  ) {
    throw new TypeError("Invalid investigative observations.");
  }

  const observations = parsed.observations.map((item) => {
    if (
      !item
      || typeof item !== "object"
      || Array.isArray(item)
      || !Array.isArray(item.supportingSignalIds)
      || item.supportingSignalIds.length !== 1
      || item.supportingSignalIds[0] !== authorizedSignalId
    ) {
      throw new TypeError(
        "Investigative observation must reference the authorized signal.",
      );
    }

    return Object.freeze({
      text: requiredText(item.text, "observation.text"),
      evidenceQuote: requiredText(
        item.evidenceQuote,
        "observation.evidenceQuote",
      ),
      supportingSignalIds: Object.freeze([authorizedSignalId]),
    });
  });

  if (!CONFIDENCE_LEVELS.has(parsed.confidence)) {
    throw new TypeError("Invalid investigative confidence.");
  }

  return Object.freeze({
    answer: requiredText(parsed.answer, "answer"),
    observations: Object.freeze(observations),
    inferences: textArray(parsed.inferences, "inferences"),
    missingEvidence: textArray(parsed.missingEvidence, "missingEvidence"),
    confidence: parsed.confidence,
  });
}

module.exports = { parseInvestigativeResponse };
