"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseInvestigativeResponse,
} = require("../services/intelligence/investigative/responseParser");

const authorizedSignalId = "signal-123";

function validResponse() {
  return {
    answer: "The alert reports elevated latency.",
    observations: [{
      text: "Latency exceeded the configured threshold.",
      evidenceQuote: "Latency exceeded the configured threshold.",
      supportingSignalIds: [authorizedSignalId],
    }],
    inferences: [
      "The service may be experiencing increased load.",
    ],
    missingEvidence: [
      "Request traces are unavailable.",
    ],
    confidence: "medium",
  };
}

test("accepts a grounded investigative response", () => {
  const result = parseInvestigativeResponse(
    JSON.stringify(validResponse()),
    authorizedSignalId,
  );

  assert.equal(result.confidence, "medium");
  assert.equal(result.observations.length, 1);
  assert.deepEqual(
    result.observations[0].supportingSignalIds,
    [authorizedSignalId],
  );
  assert.ok(Object.isFrozen(result));
});

test("rejects unauthorized signal references", () => {
  const response = validResponse();

  response.observations[0].supportingSignalIds = [
    "different-signal",
  ];

  assert.throws(
    () => parseInvestigativeResponse(
      response,
      authorizedSignalId,
    ),
    /authorized signal/,
  );
});

test("rejects unsupported confidence values", () => {
  const response = validResponse();
  response.confidence = "certain";

  assert.throws(
    () => parseInvestigativeResponse(
      response,
      authorizedSignalId,
    ),
    /confidence/,
  );
});

test("rejects malformed JSON", () => {
  assert.throws(
    () => parseInvestigativeResponse(
      "{invalid-json",
      authorizedSignalId,
    ),
    SyntaxError,
  );
});

test("rejects missing required answer", () => {
  const response = validResponse();
  delete response.answer;

  assert.throws(
    () => parseInvestigativeResponse(
      response,
      authorizedSignalId,
    ),
    /answer/,
  );
});

test("accepts an answer with no observations", () => {
  const response = validResponse();
  response.observations = [];

  const result = parseInvestigativeResponse(
    response,
    authorizedSignalId,
  );

  assert.deepEqual(result.observations, []);
});

test("rejects observations referencing multiple signals", () => {
  const response = validResponse();
  response.observations[0].supportingSignalIds = [
    authorizedSignalId,
    "unauthorized-signal",
  ];

  assert.throws(
    () => parseInvestigativeResponse(response, authorizedSignalId),
    /authorized signal/,
  );
});

test("rejects observations without evidence references", () => {
  const response = validResponse();
  response.observations[0].supportingSignalIds = [];

  assert.throws(
    () => parseInvestigativeResponse(response, authorizedSignalId),
    /authorized signal/,
  );
});

test("rejects oversized investigative answers", () => {
  const response = validResponse();
  response.answer = "x".repeat(4001);

  assert.throws(
    () => parseInvestigativeResponse(response, authorizedSignalId),
    /answer/,
  );
});

test("rejects excessive inference entries", () => {
  const response = validResponse();
  response.inferences = Array(11).fill("Possible explanation.");

  assert.throws(
    () => parseInvestigativeResponse(response, authorizedSignalId),
    /inferences/,
  );
});

test("rejects missing evidence disclosures with invalid types", () => {
  const response = validResponse();
  response.missingEvidence = ["Missing traces.", 123];

  assert.throws(
    () => parseInvestigativeResponse(response, authorizedSignalId),
    /missingEvidence/,
  );
});

test("freezes nested investigative response structures", () => {
  const result = parseInvestigativeResponse(
    validResponse(),
    authorizedSignalId,
  );

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.observations));
  assert.ok(Object.isFrozen(result.observations[0]));
  assert.ok(Object.isFrozen(
    result.observations[0].supportingSignalIds,
  ));
  assert.ok(Object.isFrozen(result.inferences));
  assert.ok(Object.isFrozen(result.missingEvidence));
});
