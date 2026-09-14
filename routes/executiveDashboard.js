const express = require("express");

function createExecutiveDashboardRouter({
  executiveIntelligence,
  operationalReportingIntelligence,
  operationalAnalyticsIntelligence,
  forecastIntelligence,
}) {
  if (
    !executiveIntelligence
    || typeof executiveIntelligence
      .generateLeadershipBrief !== "function"
  ) {
    throw new Error(
      "Executive Dashboard requires Leadership Intelligence.",
    );
  }

  if (
    !operationalReportingIntelligence
    || typeof operationalReportingIntelligence
      .generateOperationalReport !== "function"
  ) {
    throw new Error(
      "Executive Dashboard requires Operational Reporting Intelligence.",
    );
  }
  if (
    !operationalAnalyticsIntelligence
    || typeof operationalAnalyticsIntelligence
      .generateOperationalAnalytics
        !== "function"
  ) {
    throw new Error(
      "Executive Dashboard requires Operational Analytics Intelligence.",
    );
  }
  if (
    !forecastIntelligence
    || typeof forecastIntelligence
      .generateForecast !== "function"
  ) {
    throw new Error(
      "Executive Dashboard router requires Forecast Intelligence.",
    );
  }

  const router = express.Router();

  router.get(
    "/leadership-brief",
    async (req, res, next) => {
      try {
        const reportingPeriod =
          resolveReportingPeriod(
            req.query.days,
          );

        const leadershipBrief =
          await executiveIntelligence
            .generateLeadershipBrief({
              start:
                reportingPeriod.start,
              end:
                reportingPeriod.end,
            });

        res.json(
          leadershipBrief,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/reporting",
    async (req, res, next) => {
      try {
        const reportingPeriod =
          resolveReportingPeriod(
            req.query.days,
          );

        const report =
          await operationalReportingIntelligence
            .generateOperationalReport({
              start:
                reportingPeriod.start,
              end:
                reportingPeriod.end,
              days:
                reportingPeriod.days,
            });

        res.json(report);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/analytics",
    async (req, res, next) => {
      try {
        const reportingPeriod =
          resolveReportingPeriod(
            req.query.days,
          );

        const analytics =
          await operationalAnalyticsIntelligence
            .generateOperationalAnalytics({
              start:
                reportingPeriod.start,
              end:
                reportingPeriod.end,
              days:
                reportingPeriod.days,
            });

        res.json(
          analytics,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/forecasting",
    async (req, res, next) => {
      try {
        const forecast =
          await forecastIntelligence
            .generateForecast({
              start:
                req.query.start,

              end:
                req.query.end,

              days:
                req.query.days
                  ? Number(
                      req.query.days,
                    )
                  : null,

              limit:
                req.query.limit
                  ? Number(
                      req.query.limit,
                    )
                  : undefined,
            });

        res.json(
          forecast,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function resolveReportingPeriod(
  value,
) {
  const days =
    parseDays(value);

  const end =
    new Date();

  const start =
    new Date(
      end.getTime()
      - days
      * 24
      * 60
      * 60
      * 1000,
    );

  return {
    days,
    start:
      start.toISOString(),
    end:
      end.toISOString(),
  };
}

function parseDays(value) {
  if (value === undefined) {
    return 7;
  }

  const days =
    Number(value);

  if (
    !Number.isInteger(days)
    || days < 1
    || days > 365
  ) {
    const error =
      new RangeError(
        'Query parameter "days" must be an integer from 1 through 365.',
      );

    error.status = 400;

    throw error;
  }

  return days;
}

module.exports = {
  createExecutiveDashboardRouter,
};
