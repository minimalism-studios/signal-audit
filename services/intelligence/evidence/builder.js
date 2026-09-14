const {
  extractFindings,
  calculateReportingMetrics,
  calculateServiceExposure,
  calculateEnvironmentExposure,
  calculateRecurringConditions,
  countOpenRecords,
  uniqueStrings,
} = require("./index");

function buildOperationalEvidence({
  records,
  reportingPeriod,
}) {
  assertArray(
    records,
    "records",
  );

  assertPlainObject(
    reportingPeriod,
    "reportingPeriod",
  );

  const findings =
    extractFindings(
      records,
    );

  const metrics =
    calculateReportingMetrics({
      records,
      findings,
    });

  const servicePatterns =
    calculateServiceExposure({
      records,
      findings,
    });

  const environmentPatterns =
    calculateEnvironmentExposure({
      records,
      findings,
    });

  const recurringPatterns =
    calculateRecurringConditions({
      records,
      findings,
    });

  const sources =
    uniqueStrings(
      records.map(
        (record) =>
          record.source,
      ),
    );

  const findingRecordIds =
    new Set(
      findings.map(
        (finding) =>
          finding.signalRecordId,
      ),
    );

  const observationDates =
    uniqueStrings(
      records
        .map(
          (record) =>
            normalizeObservationDate(
              record.receivedAt,
            ),
        )
        .filter(Boolean),
    );

  const timeline =
    buildTimelineEvidence({
      records,
      findings,
      reportingPeriod,
    });

  const confidenceSignals =
    buildConfidenceSignals({
      records,
      findings,
      recurringPatterns,
      sources,
      observationDates,
    });

  return {
    metadata: {
      analysisPeriod: {
        start:
          reportingPeriod.start,

        end:
          reportingPeriod.end,

        days:
          reportingPeriod.days,
      },

      recordsObserved:
        records.length,

      signalsAnalyzed:
        metrics.signalsAnalyzed,

      findingsAnalyzed:
        findings.length,

      recordsWithFindings:
        findingRecordIds.size,

      services:
        metrics.serviceCount,

      environments:
        metrics.environmentCount,

      sources:
        sources.length,
    },

    metrics,

    timeline,

    patterns: {
      services:
        servicePatterns,

      environments:
        environmentPatterns,

      recurring:
        recurringPatterns,
    },

    confidenceSignals,

    findings,
  };
}

function buildTimelineEvidence({
  records,
  findings,
  reportingPeriod,
}) {
  const start =
    Date.parse(
      reportingPeriod.start,
    );

  const end =
    Date.parse(
      reportingPeriod.end,
    );

  const midpoint =
    start
    + (
      end - start
    ) / 2;

  const earlierRecords =
    records.filter(
      (record) =>
        Date.parse(
          record.receivedAt,
        ) < midpoint,
    );

  const laterRecords =
    records.filter(
      (record) =>
        Date.parse(
          record.receivedAt,
        ) >= midpoint,
    );

  const earlierRecordIds =
    new Set(
      earlierRecords.map(
        (record) =>
          record.id,
      ),
    );

  const laterRecordIds =
    new Set(
      laterRecords.map(
        (record) =>
          record.id,
      ),
    );

  const earlierFindings =
    findings.filter(
      (finding) =>
        earlierRecordIds.has(
          finding.signalRecordId,
        ),
    );

  const laterFindings =
    findings.filter(
      (finding) =>
        laterRecordIds.has(
          finding.signalRecordId,
        ),
    );

  const earlierMaterialSignals =
    earlierFindings.filter(
      isMaterialFinding,
    ).length;

  const laterMaterialSignals =
    laterFindings.filter(
      isMaterialFinding,
    ).length;

  const earlierOpenExposure =
    countOpenRecords(
      earlierRecords,
    );

  const laterOpenExposure =
    countOpenRecords(
      laterRecords,
    );

  return {
    midpoint:
      new Date(
        midpoint,
      ).toISOString(),

    earlierPeriod: {
      signals:
        earlierRecords.length,

      findings:
        earlierFindings.length,

      materialSignals:
        earlierMaterialSignals,

      openExposure:
        earlierOpenExposure,

      recordIds:
        earlierRecords.map(
          (record) =>
            record.id,
        ),

      findingIds:
        earlierFindings.map(
          (finding) =>
            finding.id,
        ),
    },

    laterPeriod: {
      signals:
        laterRecords.length,

      findings:
        laterFindings.length,

      materialSignals:
        laterMaterialSignals,

      openExposure:
        laterOpenExposure,

      recordIds:
        laterRecords.map(
          (record) =>
            record.id,
        ),

      findingIds:
        laterFindings.map(
          (finding) =>
            finding.id,
        ),
    },

    signalVolumeChange:
      laterRecords.length
      - earlierRecords.length,

    findingVolumeChange:
      laterFindings.length
      - earlierFindings.length,

    materialSignalChange:
      laterMaterialSignals
      - earlierMaterialSignals,

    openExposureChange:
      laterOpenExposure
      - earlierOpenExposure,
  };
}

function isMaterialFinding(
  finding,
) {
  return (
    finding?.severity
      === "critical"
    || finding?.severity
      === "high"
  );
}

function buildConfidenceSignals({
  records,
  findings,
  recurringPatterns,
  sources,
  observationDates,
}) {
  const recurringFindingIds =
    uniqueStrings(
      recurringPatterns.flatMap(
        (pattern) =>
          pattern.supportingFindingIds,
      ),
    );

  const materialFindings =
    findings.filter(
      (finding) =>
        finding.severity
          === "critical"
        || finding.severity
          === "high",
    );

  return {
    recordsObserved:
      records.length,

    findingsObserved:
      findings.length,

    materialFindings:
      materialFindings.length,

    observationDays:
      observationDates.length,

    independentSources:
      sources.length,

    recurringConditions:
      recurringPatterns.length,

    recurringFindingCount:
      recurringFindingIds.length,

    evidenceStrength:
      determineEvidenceStrength({
        records:
          records.length,

        findings:
          findings.length,

        observationDays:
          observationDates.length,

        independentSources:
          sources.length,

        recurringConditions:
          recurringPatterns.length,
      }),
  };
}

function determineEvidenceStrength({
  records,
  findings,
  observationDays,
  independentSources,
  recurringConditions,
}) {
  if (
    records === 0
    || findings === 0
  ) {
    return "low";
  }

  if (
    findings >= 20
    && observationDays >= 14
    && independentSources >= 2
    && recurringConditions >= 1
  ) {
    return "high";
  }

  if (
    findings >= 4
    && observationDays >= 2
  ) {
    return "moderate";
  }

  return "low";
}

function normalizeObservationDate(
  value,
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const timestamp =
    Date.parse(value);

  if (
    Number.isNaN(timestamp)
  ) {
    return null;
  }

  return new Date(timestamp)
    .toISOString()
    .slice(0, 10);
}

function assertPlainObject(
  value,
  fieldName,
) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new TypeError(
      `Operational Evidence field "${fieldName}" must be an object.`,
    );
  }
}

function assertArray(
  value,
  fieldName,
) {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Operational Evidence field "${fieldName}" must be an array.`,
    );
  }
}

module.exports = {
  buildOperationalEvidence,
};
