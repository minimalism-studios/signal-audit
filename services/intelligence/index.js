const leadership =
  require("./leadership");

const operationalReporting =
  require("./operationalReporting");

const operationalAnalytics =
  require("./operationalAnalytics");

const forecasting =
  require("./forecasting");

module.exports = {
  leadership,
  operationalReporting,
  operationalAnalytics,
  forecasting,

  createLeadershipIntelligence:
    leadership.createLeadershipIntelligence,

  createExecutiveIntelligence:
    leadership.createExecutiveIntelligence,

  createOperationalReportingIntelligence:
    operationalReporting
      .createOperationalReportingIntelligence,

  buildReportingPrompt:
    operationalReporting.buildReportingPrompt,

  parseReportingResult:
    operationalReporting.parseReportingResult,

  validateOperationalReport:
    operationalReporting.validateOperationalReport,

  createOperationalAnalyticsIntelligence:
    operationalAnalytics
      .createOperationalAnalyticsIntelligence,

  createForecastIntelligence:
    forecasting.createForecastIntelligence,
};
