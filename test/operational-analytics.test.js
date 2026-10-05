const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createOperationalAnalyticsIntelligence,
} = require(
  "../services/intelligence/operationalAnalytics"
);

function buildRecord({
  id,
  receivedAt,
  service = "checkout-api",
  environment = "production",
  fingerprint = "checkout-latency",
  status = "open",
  severity = "high",
}) {
  return {
    id,
    state: "ANALYZED",
    receivedAt,
    source: "test",
    service,
    status,
    severity,
    fingerprint,

    signal: {
      environment,
      team: "platform",
    },

    analysis: {
      findings: [
        {
          id: `finding-${id}`,
          severity,
          confidence: 0.9,
          category: "reliability",
          title: "Synthetic operational finding",
          executiveSummary:
            "Synthetic evidence for Operational Analytics regression coverage.",
          businessImpact:
            "Synthetic operational exposure.",
          affectedServices: [
            service,
          ],
          recommendedOwner: null,
          actions: {
            immediate: [],
            shortTerm: [],
            longTerm: [],
          },
          evidence: [
            "Synthetic evidence.",
          ],
        },
      ],
    },
  };
}

function buildInterpretation() {
  return {
    metadata: {
      confidenceReason:
        "The supplied evidence supports a bounded assessment.",
    },

    summary: {
      headline:
        "Operational signals show a supported concentration.",
      overview:
        "The supplied evidence contains a recurring operational pattern.",
      primaryConcentration:
        "checkout-api",
      materialInsight:
        "The concentration warrants leadership attention.",
    },

    trendAnalysis: {
      summary:
        "The canonical trend evidence indicates the supplied direction.",
    },

    concentrationRisks: [],

    leadershipInsights: [],

    conclusion: {
      assessment:
        "The evidence supports continued analysis of the concentration.",
      primaryRisk: null,
      nextAnalyticalPriority:
        "Determine whether the concentration persists in the next reporting period.",
      confidenceReason:
        "The conclusion is bounded by the supplied evidence.",
    },
  };
}

function buildSignalHistory(records) {
  return {
    listSignals() {
      return records;
    },
  };
}

test(
  "Operational Analytics assembles canonical fields outside the model response",
  async () => {
    const records = [
      buildRecord({
        id: "signal-1",
        receivedAt:
          "2026-10-01T12:00:00.000Z",
      }),
      buildRecord({
        id: "signal-2",
        receivedAt:
          "2026-10-02T12:00:00.000Z",
      }),
      buildRecord({
        id: "signal-3",
        receivedAt:
          "2026-10-03T12:00:00.000Z",
      }),
      buildRecord({
        id: "signal-4",
        receivedAt:
          "2026-10-04T12:00:00.000Z",
      }),
    ];

    let completionCalls = 0;
    let capturedPrompt = "";

    const openai = {
      chat: {
        completions: {
          async create(params) {
            completionCalls += 1;

            capturedPrompt =
              params.messages
                .map((message) =>
                  message.content
                )
                .join("\n");

            return {
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content:
                      JSON.stringify(
                        buildInterpretation(),
                      ),
                  },
                },
              ],
            };
          },
        },
      },
    };

    const analytics =
      createOperationalAnalyticsIntelligence({
        openai,
        signalHistory:
          buildSignalHistory(records),
      });

    const result =
      await analytics
        .generateOperationalAnalytics({
          start:
            "2026-10-01T00:00:00.000Z",
          end:
            "2026-10-05T00:00:00.000Z",
          days: 4,
        });

    assert.equal(
      completionCalls,
      1,
    );

    assert.equal(
      result.metadata.signalsAnalyzed,
      4,
    );

    assert.equal(
      result.metadata.evidenceConfidence,
      "medium",
    );

    assert.equal(
      result.conclusion.confidence,
      "medium",
    );

    assert.equal(
      result.summary.operationalPattern,
      result.trendAnalysis.direction,
    );

    assert.ok(
      Array.isArray(
        result.servicePatterns,
      ),
    );

    assert.ok(
      Array.isArray(
        result.environmentPatterns,
      ),
    );

    assert.ok(
      Array.isArray(
        result.severityPatterns,
      ),
    );

    assert.ok(
      Array.isArray(
        result.categoryPatterns,
      ),
    );

    assert.ok(
      Array.isArray(
        result.recurringPatterns,
      ),
    );

    assert.ok(
      Array.isArray(
        result.correlations,
      ),
    );

    assert.match(
      capturedPrompt,
      /produce only the interpretive portions/,
    );

    assert.doesNotMatch(
      capturedPrompt,
      /"signalsAnalyzed": 0/,
    );

    assert.doesNotMatch(
      capturedPrompt,
      /Preserve all canonical values exactly/,
    );
  },
);

test(
  "Operational Analytics rejects truncated model output without retrying",
  async () => {
    const records = [
      buildRecord({
        id: "signal-truncated",
        receivedAt:
          "2026-10-04T12:00:00.000Z",
      }),
    ];

    let completionCalls = 0;

    const openai = {
      chat: {
        completions: {
          async create() {
            completionCalls += 1;

            return {
              choices: [
                {
                  finish_reason: "length",
                  message: {
                    content:
                      '{"metadata":{"confidenceReason":"truncated"',
                  },
                },
              ],
            };
          },
        },
      },
    };

    const analytics =
      createOperationalAnalyticsIntelligence({
        openai,
        signalHistory:
          buildSignalHistory(records),
      });

    await assert.rejects(
      () =>
        analytics
          .generateOperationalAnalytics({
            start:
              "2026-10-04T00:00:00.000Z",
            end:
              "2026-10-05T00:00:00.000Z",
            days: 1,
          }),
      /exceeded the configured output token limit/,
    );

    assert.equal(
      completionCalls,
      1,
    );
  },
);
