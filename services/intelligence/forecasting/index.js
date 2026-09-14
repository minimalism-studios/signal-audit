const {
  buildForecastPrompt,
} = require("./prompt");

const {
  parseForecastResult,
} = require("./parser");

const {
  validateOperationalForecast,
} = require("./validator");

const {
  normalizeReportingPeriod,
  isRecordWithinPeriod,
} = require("../evidence");

const {
  buildOperationalEvidence,
} = require("../evidence/builder");

const DEFAULT_MODEL =
  "gpt-4.1-mini";

const DEFAULT_MAX_TOKENS =
  4200;

const DEFAULT_HISTORY_LIMIT =
  5000;

function createForecastIntelligence({
  openai,
  signalHistory,
  model = DEFAULT_MODEL,
}) {
  if (!openai) {
    throw new Error(
      "Forecast Intelligence requires an OpenAI client.",
    );
  }

  if (
    !signalHistory
    || typeof signalHistory.listSignals
      !== "function"
  ) {
    throw new Error(
      "Forecast Intelligence requires Signal History.",
    );
  }

  async function generateForecast({
    start,
    end,
    days = null,
    limit = DEFAULT_HISTORY_LIMIT,
  }) {
    console.log(
      "forecast: starting",
    );

    const requestedDays =
      Number.isInteger(days)
      && days > 0
        ? days
        : 7;

    const resolvedEnd =
      typeof end === "string"
      && end.trim()
        ? end.trim()
        : new Date().toISOString();

    const resolvedStart =
      typeof start === "string"
      && start.trim()
        ? start.trim()
        : new Date(
            Date.parse(resolvedEnd)
            - requestedDays
              * 24
              * 60
              * 60
              * 1000,
          ).toISOString();

    const analysisPeriod =
      normalizeReportingPeriod({
        start: resolvedStart,
        end: resolvedEnd,
        days: requestedDays,
      });

    const records =
      signalHistory.listSignals({
        limit,
      });

    const periodRecords =
      records.filter((record) =>
        isRecordWithinPeriod(
          record,
          analysisPeriod,
        ),
      );

    const evidence =
      buildOperationalEvidence({
        records:
          periodRecords,

        reportingPeriod:
          analysisPeriod,
      });

    const findings =
      evidence.findings;

    console.log(
      "forecast: records",
      periodRecords.length,
    );

    console.log(
      "forecast: findings",
      findings.length,
    );

    const prompt =
      buildForecastPrompt({
        analysisPeriod,
        forecastWindow:
          "Next reporting period",

        canonicalMetrics: {
          signalsAnalyzed:
            evidence.metadata
              .signalsAnalyzed,

          findingsAnalyzed:
            evidence.metadata
              .findingsAnalyzed,
        },

        trendEvidence: {
          ...evidence.timeline,

          direction:
            determineForecastTrajectory({
              timeline:
                evidence.timeline,

              confidenceSignals:
                evidence
                  .confidenceSignals,
            }),
        },

        servicePatterns:
          evidence.patterns
            .services,

        environmentPatterns:
          evidence.patterns
            .environments,

        recurringPatterns:
          evidence.patterns
            .recurring,

        findings,

        confidenceSignals:
          evidence.confidenceSignals,
      });

    console.log(
      "forecast: prompt",
      prompt.length,
    );

    const completion =
      await openai
        .chat
        .completions
        .create({
          model,

          max_tokens:
            DEFAULT_MAX_TOKENS,

          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });

    console.log(
      "forecast: openai returned",
    );

    const content =
      completion
        .choices?.[0]
        ?.message?.content
      ?? "";

    const forecast =
      parseForecastResult(
        content,
      );

    validateOperationalForecast(
      forecast,
    );

    forecast.metadata.confidence =
      normalizeForecastConfidence(
        evidence.confidenceSignals
          .evidenceStrength,
      );

    forecast.executiveOutlook
      .operationalTrajectory =
        determineForecastTrajectory({
          timeline:
            evidence.timeline,

          confidenceSignals:
            evidence
              .confidenceSignals,
        });

    return forecast;
  }

  return {
    generateForecast,
  };
}

function normalizeForecastConfidence(
  evidenceStrength,
) {
  if (evidenceStrength === "high") {
    return "high";
  }

  if (
    evidenceStrength === "moderate"
  ) {
    return "moderate";
  }

  return "low";
}

function determineForecastTrajectory({
  timeline,
  confidenceSignals,
}) {
  const earlierSignals =
    timeline.earlierPeriod
      .signals;

  const laterSignals =
    timeline.laterPeriod
      .signals;

  if (
    confidenceSignals
      .evidenceStrength === "low"
    || earlierSignals === 0
    || laterSignals === 0
  ) {
    return "indeterminate";
  }

  const weightedChange =
    timeline
      .materialSignalChange * 2
    + timeline
      .openExposureChange * 2
    + timeline
      .signalVolumeChange;

  if (weightedChange < 0) {
    return "improving";
  }

  if (weightedChange > 0) {
    return "worsening";
  }

  return "stable";
}

module.exports = {
  createForecastIntelligence,
};
