function normalizeReportingPeriod({
  start,
  end,
  days,
}) {
  const normalizedStart =
    normalizeTimestamp(
      start,
      "start",
    );

  const normalizedEnd =
    normalizeTimestamp(
      end,
      "end",
    );

  if (
    Date.parse(normalizedStart)
    > Date.parse(normalizedEnd)
  ) {
    throw new RangeError(
      "Operational Reporting period start must not occur after end.",
    );
  }

  const calculatedDays =
    Math.max(
      1,
      Math.ceil(
        (
          Date.parse(normalizedEnd)
          - Date.parse(normalizedStart)
        )
        / 86400000,
      ),
    );

  const normalizedDays =
    Number.isInteger(days)
    && days > 0
      ? days
      : calculatedDays;

  return {
    start: normalizedStart,
    end: normalizedEnd,
    days: normalizedDays,
  };
}

function isRecordWithinPeriod(
  record,
  reportingPeriod,
) {
  if (
    !record
    || typeof record.receivedAt
      !== "string"
  ) {
    return false;
  }

  const receivedAt =
    Date.parse(record.receivedAt);

  if (
    Number.isNaN(receivedAt)
  ) {
    return false;
  }

  return (
    receivedAt
      >= Date.parse(
        reportingPeriod.start,
      )
    && receivedAt
      <= Date.parse(
        reportingPeriod.end,
      )
  );
}

function extractFindings(records) {
  const findings = [];

  records.forEach((record) => {
    const recordFindings =
      record?.analysis?.findings;

    if (
      !Array.isArray(
        recordFindings,
      )
    ) {
      return;
    }

    recordFindings.forEach(
      (finding) => {
        if (
          !finding
          || typeof finding
            !== "object"
        ) {
          return;
        }

        const originalFindingId =
          normalizeOptionalString(
            finding.id,
          );

        if (!originalFindingId) {
          return;
        }

        findings.push({
          id:
            `${record.id}:${originalFindingId}`,

          originalFindingId,

          signalRecordId:
            record.id,

          source:
            normalizeLowercaseString(
              record.source,
            ),

          receivedAt:
            record.receivedAt,

          signalStatus:
            normalizeLowercaseString(
              record.status,
            ),

          service:
            normalizeOptionalString(
              record.service,
            ),

          environment:
            normalizeOptionalString(
              record.signal
                ?.environment,
            ),

          team:
            normalizeOptionalString(
              record.signal?.team,
            ),

          fingerprint:
            normalizeOptionalString(
              record.fingerprint,
            ),

          title:
            normalizeOptionalString(
              finding.title,
            ),

          severity:
            normalizeLowercaseString(
              finding.severity,
            ),

          confidence:
            normalizeConfidence(
              finding.confidence,
            ),

          category:
            normalizeLowercaseString(
              finding.category,
            ),

          executiveSummary:
            normalizeOptionalString(
              finding.executiveSummary,
            ),

          businessImpact:
            normalizeOptionalString(
              finding.businessImpact,
            ),

          affectedServices:
            normalizeStringArray(
              finding.affectedServices,
            ),

          recommendedOwner:
            normalizeOptionalString(
              finding.recommendedOwner,
            ),

          actions:
            normalizeActions(
              finding.actions,
            ),

          evidence:
            normalizeStringArray(
              finding.evidence,
            ),
        });
      },
    );
  });

  return findings;
}

function calculateReportingMetrics({
  records,
  findings,
}) {
  const analyzedRecords =
    records.filter(
      (record) =>
        record.analysis !== null
        && record.analysis
          !== undefined,
    );

  const materialFindings =
    findings.filter(
      (finding) =>
        finding.severity
          === "critical"
        || finding.severity
          === "high",
    );

  const services =
    collectServices({
      records,
      findings,
    });

  const environments =
    uniqueStrings(
      records.map(
        (record) =>
          record.signal
            ?.environment,
      ),
    );

  const activeRecords =
    records.filter((record) => {
      const status =
        normalizeLowercaseString(
          record.status,
        );

      return (
        status === "firing"
        || status === "open"
        || status
          === "investigating"
      );
    });

  const resolvedRecords =
    records.filter((record) => {
      const status =
        normalizeLowercaseString(
          record.status,
        );

      return (
        status === "resolved"
        || status === "recovered"
        || status === "closed"
      );
    });

  const resolutionDenominator =
    activeRecords.length
    + resolvedRecords.length;

  const resolutionRate =
    resolutionDenominator === 0
      ? 0
      : Number(
          (
            resolvedRecords.length
            / resolutionDenominator
            * 100
          ).toFixed(2),
        );

  const recurrenceGroups =
    groupRecurringRecords(
      records,
    );

  const recurrentRecordCount =
    [...recurrenceGroups.values()]
      .filter(
        (group) =>
          group.length > 1,
      )
      .reduce(
        (total, group) =>
          total + group.length,
        0,
      );

  const recurrenceRate =
    records.length === 0
      ? 0
      : Number(
          (
            recurrentRecordCount
            / records.length
            * 100
          ).toFixed(2),
        );

  return {
    signalsAnalyzed:
      analyzedRecords.length,

    materialSignals:
      materialFindings.length,

    investigationsOpened:
      0,

    investigationsResolved:
      0,

    resolutionRate,

    medianResolutionMinutes:
      0,

    recurrenceRate,

    servicesAffected:
      services.length,

    openExposure:
      activeRecords.length,

    serviceCount:
      services.length,

    environmentCount:
      environments.length,

    services,

    environments,
  };
}

function calculateServiceExposure({
  records,
  findings,
}) {
  const services =
    collectServices({
      records,
      findings,
    });

  return services
    .map((service) => {
      const normalizedService =
        service.toLowerCase();

      const serviceRecords =
        records.filter(
          (record) =>
            record.service
              ?.trim()
              .toLowerCase()
            === normalizedService
            || normalizeStringArray(
              record.signal
                ?.affectedServices,
            )
              .map(
                (value) =>
                  value.toLowerCase(),
              )
              .includes(
                normalizedService,
              ),
        );

      const serviceFindings =
        findings.filter(
          (finding) =>
            finding.service
              ?.trim()
              .toLowerCase()
            === normalizedService
            || finding
              .affectedServices
              .map(
                (value) =>
                  value.toLowerCase(),
              )
              .includes(
                normalizedService,
              ),
        );

      const materialFindings =
        serviceFindings.filter(
          (finding) =>
            finding.severity
              === "critical"
            || finding.severity
              === "high",
        );

      const openRisk =
        serviceRecords.filter(
          (record) => {
            const status =
              normalizeLowercaseString(
                record.status,
              );

            return (
              status === "firing"
              || status === "open"
              || status
                === "investigating"
            );
          },
        ).length;

      return {
        service,

        materialFindings:
          materialFindings.length,

        investigations: 0,

        openRisk,

        direction:
          determineExposureDirection(
            serviceRecords,
          ),

        assessment:
          buildServiceAssessment({
            service,
            materialFindings:
              materialFindings.length,
            openRisk,
          }),
      };
    })
    .sort(
      (left, right) =>
        right.openRisk
        - left.openRisk
        || right.materialFindings
        - left.materialFindings
        || left.service.localeCompare(
          right.service,
        ),
    );
}

function calculateEnvironmentExposure({
  records,
  findings,
}) {
  const environments =
    uniqueStrings(
      records.map(
        (record) =>
          record.signal
            ?.environment,
      ),
    );

  return environments
    .map((environment) => {
      const normalizedEnvironment =
        environment
          .toLowerCase();

      const environmentRecords =
        records.filter(
          (record) =>
            record.signal
              ?.environment
              ?.trim()
              .toLowerCase()
            === normalizedEnvironment,
        );

      const environmentFindings =
        findings.filter(
          (finding) =>
            finding.environment
              ?.trim()
              .toLowerCase()
            === normalizedEnvironment,
        );

      const materialFindings =
        environmentFindings.filter(
          (finding) =>
            finding.severity
              === "critical"
            || finding.severity
              === "high",
        ).length;

      return {
        environment,

        signals:
          environmentRecords.length,

        materialFindings,

        availability:
          null,

        assessment:
          determineEnvironmentAssessment({
            records:
              environmentRecords,
            materialFindings,
          }),
      };
    })
    .sort(
      (left, right) =>
        right.materialFindings
        - left.materialFindings
        || right.signals
        - left.signals
        || left.environment
          .localeCompare(
            right.environment,
          ),
    );
}

function calculateRecurringConditions({
  records,
  findings,
}) {
  const groups =
    groupRecurringRecords(
      records,
    );

  const findingsByRecordId =
    findings.reduce(
      (map, finding) => {
        const existing =
          map.get(
            finding.signalRecordId,
          ) || [];

        existing.push(finding);

        map.set(
          finding.signalRecordId,
          existing,
        );

        return map;
      },
      new Map(),
    );

  return [
    ...groups.entries(),
  ]
    .filter(
      ([, group]) =>
        group.length > 1,
    )
    .map(
      ([fingerprint, group]) => {
        const sortedGroup =
          group.slice().sort(
            (left, right) =>
              Date.parse(
                left.receivedAt,
              )
              - Date.parse(
                right.receivedAt,
              ),
          );

        const relatedFindings =
          sortedGroup.flatMap(
            (record) =>
              findingsByRecordId.get(
                record.id,
              ) || [],
          );

        const affectedServices =
          uniqueStrings([
            ...sortedGroup.map(
              (record) =>
                record.service,
            ),

            ...relatedFindings
              .flatMap(
                (finding) =>
                  finding
                    .affectedServices,
              ),
          ]);

        const latestRecord =
          sortedGroup[
            sortedGroup.length - 1
          ];

        const latestStatus =
          normalizeLowercaseString(
            latestRecord.status,
          );

        return {
          title:
            resolveRecurringTitle({
              fingerprint,
              records:
                sortedGroup,
              findings:
                relatedFindings,
            }),

          affectedServices,

          occurrences:
            sortedGroup.length,

          firstObserved:
            sortedGroup[0]
              .receivedAt,

          lastObserved:
            latestRecord.receivedAt,

          status:
            resolveConditionStatus(
              latestStatus,
            ),

          implication:
            buildRecurringImplication({
              affectedServices,
              occurrences:
                sortedGroup.length,
            }),

          supportingFindingIds:
            uniqueStrings(
              relatedFindings.map(
                (finding) =>
                  finding.id,
              ),
            ),
        };
      },
    )
    .sort(
      (left, right) =>
        right.occurrences
        - left.occurrences
        || Date.parse(
          right.lastObserved,
        )
        - Date.parse(
          left.lastObserved,
        ),
    );
}

function groupRecurringRecords(records) {
  return records.reduce(
    (groups, record) => {
      const key =
        normalizeOptionalString(
          record.fingerprint,
        );

      if (!key) {
        return groups;
      }

      const existing =
        groups.get(key) || [];

      existing.push(record);

      groups.set(
        key,
        existing,
      );

      return groups;
    },
    new Map(),
  );
}

function determineExposureDirection(
  records,
) {
  if (records.length < 2) {
    return "indeterminate";
  }

  const sorted =
    records.slice().sort(
      (left, right) =>
        Date.parse(left.receivedAt)
        - Date.parse(right.receivedAt),
    );

  const midpoint =
    Math.ceil(
      sorted.length / 2,
    );

  const earlier =
    sorted.slice(
      0,
      midpoint,
    );

  const later =
    sorted.slice(
      midpoint,
    );

  if (later.length === 0) {
    return "indeterminate";
  }

  const earlierOpen =
    countOpenRecords(earlier);

  const laterOpen =
    countOpenRecords(later);

  if (laterOpen < earlierOpen) {
    return "improving";
  }

  if (laterOpen > earlierOpen) {
    return "worsening";
  }

  return "stable";
}

function countOpenRecords(records) {
  return records.filter(
    (record) => {
      const status =
        normalizeLowercaseString(
          record.status,
        );

      return (
        status === "firing"
        || status === "open"
        || status
          === "investigating"
      );
    },
  ).length;
}

function determineEnvironmentAssessment({
  records,
  materialFindings,
}) {
  const openRecords =
    countOpenRecords(records);

  if (
    materialFindings > 0
    && openRecords > 0
  ) {
    return "critical";
  }

  if (
    materialFindings > 0
    || openRecords > 0
  ) {
    return "attention";
  }

  if (records.length > 0) {
    return "stable";
  }

  return "indeterminate";
}

function buildServiceAssessment({
  service,
  materialFindings,
  openRisk,
}) {
  if (
    materialFindings === 0
    && openRisk === 0
  ) {
    return (
      `${service} had no material findings or open signal exposure during the reporting period.`
    );
  }

  if (openRisk > 0) {
    return (
      `${service} carried ${openRisk} open signal exposure`
      + (
        materialFindings > 0
          ? ` and ${materialFindings} material findings.`
          : "."
      )
    );
  }

  return (
    `${service} produced ${materialFindings} material findings with no open signal exposure at period close.`
  );
}

function resolveRecurringTitle({
  fingerprint,
  records,
  findings,
}) {
  const findingTitle =
    findings.find(
      (finding) =>
        finding.title,
    )?.title;

  if (findingTitle) {
    return findingTitle;
  }

  const signalTitle =
    records.find(
      (record) =>
        normalizeOptionalString(
          record.signal?.title,
        ),
    )?.signal?.title;

  return (
    normalizeOptionalString(
      signalTitle,
    )
    || `Recurring condition ${fingerprint}`
  );
}

function resolveConditionStatus(
  status,
) {
  if (
    status === "resolved"
    || status === "recovered"
    || status === "closed"
  ) {
    return "resolved";
  }

  if (
    status === "firing"
    || status === "open"
    || status
      === "investigating"
  ) {
    return "active";
  }

  if (status === "monitoring") {
    return "monitoring";
  }

  return "indeterminate";
}

function buildRecurringImplication({
  affectedServices,
  occurrences,
}) {
  const serviceText =
    affectedServices.length > 0
      ? affectedServices.join(", ")
      : "the affected operational scope";

  return (
    `${occurrences} signals shared the same fingerprint across ${serviceText}, indicating a repeated operational condition during the reporting period.`
  );
}

function collectServices({
  records,
  findings,
}) {
  return uniqueStrings([
    ...records.map(
      (record) =>
        record.service,
    ),

    ...findings.map(
      (finding) =>
        finding.service,
    ),

    ...findings.flatMap(
      (finding) =>
        finding.affectedServices,
    ),
  ]);
}

function normalizeTimestamp(
  value,
  fieldName,
) {
  if (
    typeof value !== "string"
    || value.trim() === ""
  ) {
    throw new TypeError(
      `Operational Reporting field "${fieldName}" must be a non-empty timestamp string.`,
    );
  }

  const timestamp =
    Date.parse(
      value.trim(),
    );

  if (
    Number.isNaN(timestamp)
  ) {
    throw new TypeError(
      `Operational Reporting field "${fieldName}" must be a valid ISO-8601 timestamp.`,
    );
  }

  return new Date(
    timestamp,
  ).toISOString();
}

function normalizeOptionalString(
  value,
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized === ""
    ? null
    : normalized;
}

function normalizeLowercaseString(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
    );

  return normalized === null
    ? null
    : normalized.toLowerCase();
}

function normalizeConfidence(
  value,
) {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(value),
    ),
  );
}

function normalizeStringArray(
  value,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(value);
}

function normalizeActions(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return {
      immediate: [],
      shortTerm: [],
      longTerm: [],
    };
  }

  return {
    immediate:
      normalizeStringArray(
        value.immediate,
      ),

    shortTerm:
      normalizeStringArray(
        value.shortTerm,
      ),

    longTerm:
      normalizeStringArray(
        value.longTerm,
      ),
  };
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .filter(
          (value) =>
            typeof value
              === "string",
        )
        .map(
          (value) =>
            value.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

module.exports = {
  normalizeReportingPeriod,
  isRecordWithinPeriod,
  extractFindings,
  calculateReportingMetrics,
  calculateServiceExposure,
  calculateEnvironmentExposure,
  calculateRecurringConditions,
  groupRecurringRecords,
  determineExposureDirection,
  countOpenRecords,
  determineEnvironmentAssessment,
  buildServiceAssessment,
  resolveRecurringTitle,
  resolveConditionStatus,
  buildRecurringImplication,
  collectServices,
  normalizeTimestamp,
  normalizeOptionalString,
  normalizeLowercaseString,
  normalizeConfidence,
  normalizeStringArray,
  normalizeActions,
  uniqueStrings,
};
