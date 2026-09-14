const crypto = require("crypto");

const {
  buildAnalyticsPrompt,
} = require("./prompt");

const {
  parseAnalyticsResult,
} = require("./parser");

const {
  validateOperationalAnalytics,
} = require("./validator");

const {
  normalizeReportingPeriod,
  isRecordWithinPeriod,
  collectServices,
  countOpenRecords,
  normalizeOptionalString,
  normalizeLowercaseString,
  uniqueStrings,
} = require("../evidence");

const {
  buildOperationalEvidence,
} = require("../evidence/builder");

const DEFAULT_MODEL =
  "gpt-4.1-mini";

const DEFAULT_MAX_TOKENS =
  5200;

const DEFAULT_HISTORY_LIMIT =
  5000;

function createOperationalAnalyticsIntelligence({
  openai,
  signalHistory,
  model = DEFAULT_MODEL,
}) {
  if (!openai) {
    throw new Error(
      "Operational Analytics Intelligence requires an OpenAI client.",
    );
  }

  if (
    !signalHistory
    || typeof signalHistory.listSignals
      !== "function"
  ) {
    throw new Error(
      "Operational Analytics Intelligence requires Signal History.",
    );
  }

  async function generateOperationalAnalytics({
    start,
    end,
    days = null,
    limit = DEFAULT_HISTORY_LIMIT,
  }) {
    console.log("analytics: starting");

    const analysisPeriod =
      normalizeReportingPeriod({
        start,
        end,
        days,
      });

    console.log("analytics: reporting period");

    const records =
      signalHistory.listSignals({
        limit,
      });

    console.log("analytics: records", records.length);

    const periodRecords =
      records
        .filter((record) =>
          isRecordWithinPeriod(
            record,
            analysisPeriod,
          ))
        .sort(
          (left, right) =>
            Date.parse(
              left.receivedAt,
            )
            - Date.parse(
              right.receivedAt,
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
      "analytics: findings",
      findings.length,
    );

    const canonicalMetrics =
      calculateCanonicalMetrics({
        records: periodRecords,
        findings,
      });

    const earlierRecordIds =
      new Set(
        evidence.timeline
          .earlierPeriod
          .recordIds,
      );

    const laterRecordIds =
      new Set(
        evidence.timeline
          .laterPeriod
          .recordIds,
      );

    const earlierFindingIds =
      new Set(
        evidence.timeline
          .earlierPeriod
          .findingIds,
      );

    const laterFindingIds =
      new Set(
        evidence.timeline
          .laterPeriod
          .findingIds,
      );

    /*
     * Preserve the comparison interface used by
     * Analytics pattern calculations while sourcing
     * the partition from canonical timeline evidence.
     */
    const comparison = {
      midpoint:
        evidence.timeline.midpoint,

      earlier: {
        records:
          periodRecords.filter(
            (record) =>
              earlierRecordIds.has(
                record.id,
              ),
          ),

        findings:
          findings.filter(
            (finding) =>
              earlierFindingIds.has(
                finding.id,
              ),
          ),
      },

      later: {
        records:
          periodRecords.filter(
            (record) =>
              laterRecordIds.has(
                record.id,
              ),
          ),

        findings:
          findings.filter(
            (finding) =>
              laterFindingIds.has(
                finding.id,
              ),
          ),
      },
    };

    const trendEvidence = {
      direction:
        determineTrendDirection({
          comparison,

          signalVolumeChange:
            evidence.timeline
              .signalVolumeChange,

          materialSignalChange:
            evidence.timeline
              .materialSignalChange,

          openExposureChange:
            evidence.timeline
              .openExposureChange,
        }),

      earlierPeriod:
        evidence.timeline
          .earlierPeriod,

      laterPeriod:
        evidence.timeline
          .laterPeriod,

      signalVolumeChange:
        evidence.timeline
          .signalVolumeChange,

      materialSignalChange:
        evidence.timeline
          .materialSignalChange,

      openExposureChange:
        evidence.timeline
          .openExposureChange,
    };

    const servicePatterns =
      calculateServicePatterns({
        records: periodRecords,
        findings,
        comparison,
      });

    const environmentPatterns =
      calculateEnvironmentPatterns({
        records: periodRecords,
        findings,
        comparison,
      });

    const severityPatterns =
      calculateSeverityPatterns({
        findings,
        comparison,
      });

    const categoryPatterns =
      calculateCategoryPatterns({
        findings,
        comparison,
      });

    const recurringPatterns =
      evidence.patterns.recurring;

    const correlations =
      calculateCorrelations({
        records: periodRecords,
        findings,
      });

    const prompt =
      buildAnalyticsPrompt({
        analysisPeriod,
        canonicalMetrics,
        trendEvidence,
        servicePatterns,
        environmentPatterns,
        severityPatterns,
        categoryPatterns,
        recurringPatterns,
        correlations,
        findings,

        confidenceSignals:
          evidence.confidenceSignals,
      });

    console.log("analytics: prompt size", prompt.length,);
    console.log("analytics: building prompt");

    const createCompletion = async (
      retryInstruction = null,
    ) => {
      const messages = [
        {
          role: "user",
          content: prompt,
        },
      ];

      if (retryInstruction) {
        messages.push({
          role: "user",
          content:
            retryInstruction,
        });
      }

      return openai
        .chat
        .completions
        .create({
          model,
          max_tokens:
            DEFAULT_MAX_TOKENS,
          messages,
        });
    };

    let result =
      await createCompletion();

    let content =
      getResponseContent(result);

    let analytics;

    try {
      analytics =
        parseAnalyticsResult(
          content,
        );

      validateOperationalAnalytics(
        analytics,
      );
    } catch (error) {
      console.warn(
        "Operational Analytics validation failed. Retrying once.",
        error.message,
      );

      const retryInstruction = `
The previous Operational Analytics response failed validation:

${error.message}

Regenerate the complete response as valid JSON.

Requirements:

- Use the exact JSON schema from the original prompt.
- Preserve every canonical field exactly.
- Do not invent signals, findings, services, environments, trends, causes, correlations, actions, or outcomes.
- Use only supplied finding identifiers.
- Return JSON only.
      `.trim();

      result =
        await createCompletion(
          retryInstruction,
        );

      content =
        getResponseContent(
          result,
        );

      analytics =
        parseAnalyticsResult(
          content,
        );

      validateOperationalAnalytics(
        analytics,
      );
    }

    analytics.metadata.evidenceConfidence =
      evidence.confidenceSignals
        .evidenceStrength;

    analytics.conclusion.confidence =
      evidence.confidenceSignals
        .evidenceStrength;

    validateCanonicalFields({
      analytics,
      analysisPeriod,
      canonicalMetrics,
      trendEvidence,
      servicePatterns,
      environmentPatterns,
      severityPatterns,
      categoryPatterns,
      recurringPatterns,
      correlations,
    });

    validateFindingReferences({
      analytics,
      findings,
    });

    return {
      analysisId:
        `operational-analytics-${crypto.randomUUID()}`,

      generatedAt:
        new Date().toISOString(),

      ...analytics,
    };
  }

  return {
    generateOperationalAnalytics,
  };
}

function calculateCanonicalMetrics({
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

  const materialFindings =
    findings.filter(
      isMaterialFinding,
    );

  return {
    signalsAnalyzed:
      analyzedRecords.length,

    findings:
      findings.length,

    materialFindings:
      materialFindings.length,

    services:
      services.length,

    environments:
      environments.length,
  };
}

function determineTrendDirection({
  comparison,
  signalVolumeChange,
  materialSignalChange,
  openExposureChange,
}) {
  const totalRecords =
    comparison.earlier
      .records.length
    + comparison.later
      .records.length;

  if (
    totalRecords < 2
    || comparison.earlier
      .records.length === 0
    || comparison.later
      .records.length === 0
  ) {
    return "indeterminate";
  }

  const weightedChange =
    materialSignalChange * 2
    + openExposureChange * 2
    + signalVolumeChange;

  if (weightedChange < 0) {
    return "improving";
  }

  if (weightedChange > 0) {
    return "worsening";
  }

  return "stable";
}

function calculateServicePatterns({
  records,
  findings,
  comparison,
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
            recordMatchesService(
              record,
              normalizedService,
            ),
        );

      const serviceFindings =
        findings.filter(
          (finding) =>
            findingMatchesService(
              finding,
              normalizedService,
            ),
        );

      const earlierCount =
        countServiceRecords(
          comparison.earlier
            .records,
          normalizedService,
        );

      const laterCount =
        countServiceRecords(
          comparison.later
            .records,
          normalizedService,
        );

      return {
        service,

        signals:
          serviceRecords.length,

        findings:
          serviceFindings.length,

        materialFindings:
          serviceFindings
            .filter(
              isMaterialFinding,
            )
            .length,

        openExposure:
          countOpenRecords(
            serviceRecords,
          ),

        earlierSignals:
          earlierCount,

        laterSignals:
          laterCount,

        change:
          laterCount
          - earlierCount,

        direction:
          determineCountDirection({
            earlier:
              earlierCount,

            later:
              laterCount,
          }),

        supportingFindingIds:
          uniqueStrings(
            serviceFindings.map(
              (finding) =>
                finding.id,
            ),
          ),
      };
    })
    .sort(
      (left, right) =>
        right.materialFindings
        - left.materialFindings
        || right.openExposure
        - left.openExposure
        || right.signals
        - left.signals
        || left.service.localeCompare(
          right.service,
        ),
    );
}

function calculateEnvironmentPatterns({
  records,
  findings,
  comparison,
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
        environment.toLowerCase();

      const environmentRecords =
        records.filter(
          (record) =>
            normalizeLowercaseString(
              record.signal
                ?.environment,
            )
            === normalizedEnvironment,
        );

      const environmentFindings =
        findings.filter(
          (finding) =>
            normalizeLowercaseString(
              finding.environment,
            )
            === normalizedEnvironment,
        );

      const earlierCount =
        countEnvironmentRecords(
          comparison.earlier
            .records,
          normalizedEnvironment,
        );

      const laterCount =
        countEnvironmentRecords(
          comparison.later
            .records,
          normalizedEnvironment,
        );

      return {
        environment,

        signals:
          environmentRecords.length,

        findings:
          environmentFindings.length,

        materialFindings:
          environmentFindings
            .filter(
              isMaterialFinding,
            )
            .length,

        openExposure:
          countOpenRecords(
            environmentRecords,
          ),

        earlierSignals:
          earlierCount,

        laterSignals:
          laterCount,

        change:
          laterCount
          - earlierCount,

        direction:
          determineCountDirection({
            earlier:
              earlierCount,

            later:
              laterCount,
          }),

        supportingFindingIds:
          uniqueStrings(
            environmentFindings.map(
              (finding) =>
                finding.id,
            ),
          ),
      };
    })
    .sort(
      (left, right) =>
        right.materialFindings
        - left.materialFindings
        || right.openExposure
        - left.openExposure
        || right.signals
        - left.signals
        || left.environment
          .localeCompare(
            right.environment,
          ),
    );
}

function calculateSeverityPatterns({
  findings,
  comparison,
}) {
  return calculateFindingDistribution({
    findings,
    earlierFindings:
      comparison.earlier
        .findings,

    laterFindings:
      comparison.later
        .findings,

    getValue:
      (finding) =>
        finding.severity,

    fieldName:
      "severity",
  });
}

function calculateCategoryPatterns({
  findings,
  comparison,
}) {
  return calculateFindingDistribution({
    findings,
    earlierFindings:
      comparison.earlier
        .findings,

    laterFindings:
      comparison.later
        .findings,

    getValue:
      (finding) =>
        finding.category,

    fieldName:
      "category",
  });
}

function calculateFindingDistribution({
  findings,
  earlierFindings,
  laterFindings,
  getValue,
  fieldName,
}) {
  const values =
    uniqueStrings(
      findings.map(
        getValue,
      ),
    );

  return values
    .map((value) => {
      const normalizedValue =
        value.toLowerCase();

      const matchingFindings =
        findings.filter(
          (finding) =>
            normalizeLowercaseString(
              getValue(finding),
            )
            === normalizedValue,
        );

      const earlierCount =
        earlierFindings.filter(
          (finding) =>
            normalizeLowercaseString(
              getValue(finding),
            )
            === normalizedValue,
        ).length;

      const laterCount =
        laterFindings.filter(
          (finding) =>
            normalizeLowercaseString(
              getValue(finding),
            )
            === normalizedValue,
        ).length;

      return {
        [fieldName]:
          value,

        count:
          matchingFindings.length,

        earlierCount,
        laterCount,

        change:
          laterCount
          - earlierCount,

        direction:
          determineCountDirection({
            earlier:
              earlierCount,

            later:
              laterCount,
          }),

        supportingFindingIds:
          uniqueStrings(
            matchingFindings.map(
              (finding) =>
                finding.id,
            ),
          ),
      };
    })
    .sort(
      (left, right) =>
        right.count
        - left.count
        || String(
          left[fieldName],
        ).localeCompare(
          String(
            right[fieldName],
          ),
        ),
    );
}

function calculateCorrelations({
  records,
  findings,
}) {
  const correlations = [];

  correlations.push(
    ...groupFindingCorrelation({
      findings,
      type:
        "service-category",

      getKey:
        (finding) => {
          const service =
            resolveFindingService(
              finding,
            );

          const category =
            normalizeOptionalString(
              finding.category,
            );

          if (
            !service
            || !category
          ) {
            return null;
          }

          return {
            key:
              `${service.toLowerCase()}::${category.toLowerCase()}`,

            dimensions: {
              service,
              category,
            },
          };
        },
    }),
  );

  correlations.push(
    ...groupFindingCorrelation({
      findings,
      type:
        "service-severity",

      getKey:
        (finding) => {
          const service =
            resolveFindingService(
              finding,
            );

          const severity =
            normalizeOptionalString(
              finding.severity,
            );

          if (
            !service
            || !severity
          ) {
            return null;
          }

          return {
            key:
              `${service.toLowerCase()}::${severity.toLowerCase()}`,

            dimensions: {
              service,
              severity,
            },
          };
        },
    }),
  );

  correlations.push(
    ...groupFindingCorrelation({
      findings,
      type:
        "environment-severity",

      getKey:
        (finding) => {
          const environment =
            normalizeOptionalString(
              finding.environment,
            );

          const severity =
            normalizeOptionalString(
              finding.severity,
            );

          if (
            !environment
            || !severity
          ) {
            return null;
          }

          return {
            key:
              `${environment.toLowerCase()}::${severity.toLowerCase()}`,

            dimensions: {
              environment,
              severity,
            },
          };
        },
    }),
  );

  const recurringByFingerprint =
    records.reduce(
      (groups, record) => {
        const fingerprint =
          normalizeOptionalString(
            record.fingerprint,
          );

        const service =
          normalizeOptionalString(
            record.service,
          );

        if (
          !fingerprint
          || !service
        ) {
          return groups;
        }

        const key =
          `${fingerprint}::${service.toLowerCase()}`;

        const existing =
          groups.get(key)
          || {
            type:
              "fingerprint-service",

            dimensions: {
              fingerprint,
              service,
            },

            occurrences: 0,
            supportingFindingIds: [],
          };

        existing.occurrences += 1;

        const recordFindingIds =
          findings
            .filter(
              (finding) =>
                finding.signalRecordId
                === record.id,
            )
            .map(
              (finding) =>
                finding.id,
            );

        existing.supportingFindingIds =
          uniqueStrings([
            ...existing
              .supportingFindingIds,

            ...recordFindingIds,
          ]);

        groups.set(
          key,
          existing,
        );

        return groups;
      },
      new Map(),
    );

  correlations.push(
    ...[...recurringByFingerprint.values()]
      .filter(
        (item) =>
          item.occurrences > 1,
      ),
  );

  return correlations
    .filter(
      (item) =>
        item.occurrences > 1,
    )
    .sort(
      (left, right) =>
        right.occurrences
        - left.occurrences
        || left.type.localeCompare(
          right.type,
        ),
    );
}

function groupFindingCorrelation({
  findings,
  type,
  getKey,
}) {
  const groups =
    findings.reduce(
      (map, finding) => {
        const resolved =
          getKey(finding);

        if (!resolved) {
          return map;
        }

        const existing =
          map.get(
            resolved.key,
          )
          || {
            type,
            dimensions:
              resolved.dimensions,

            occurrences: 0,
            supportingFindingIds: [],
          };

        existing.occurrences += 1;

        existing
          .supportingFindingIds
          .push(
            finding.id,
          );

        map.set(
          resolved.key,
          existing,
        );

        return map;
      },
      new Map(),
    );

  return [
    ...groups.values(),
  ].map(
    (item) => ({
      ...item,

      supportingFindingIds:
        uniqueStrings(
          item.supportingFindingIds,
        ),
    }),
  );
}

function validateCanonicalFields({
  analytics,
  analysisPeriod,
  canonicalMetrics,
  trendEvidence,
  servicePatterns,
  environmentPatterns,
  severityPatterns,
  categoryPatterns,
  recurringPatterns,
  correlations,
}) {
  const metadata =
    analytics.metadata;

  if (
    metadata.analysisPeriod.start
      !== analysisPeriod.start
    || metadata.analysisPeriod.end
      !== analysisPeriod.end
    || metadata.analysisPeriod.days
      !== analysisPeriod.days
  ) {
    throw new Error(
      "Operational Analytics analysis period does not match canonical evidence.",
    );
  }

  const comparisons = [
    [
      metadata.signalsAnalyzed,
      canonicalMetrics
        .signalsAnalyzed,
      "metadata.signalsAnalyzed",
    ],

    [
      metadata.services,
      canonicalMetrics.services,
      "metadata.services",
    ],

    [
      metadata.environments,
      canonicalMetrics
        .environments,
      "metadata.environments",
    ],

    [
      analytics.trendAnalysis
        .direction,
      trendEvidence.direction,
      "trendAnalysis.direction",
    ],

    [
      analytics.trendAnalysis
        .signalVolumeChange,
      trendEvidence
        .signalVolumeChange,
      "trendAnalysis.signalVolumeChange",
    ],

    [
      analytics.trendAnalysis
        .materialSignalChange,
      trendEvidence
        .materialSignalChange,
      "trendAnalysis.materialSignalChange",
    ],

    [
      analytics.trendAnalysis
        .openExposureChange,
      trendEvidence
        .openExposureChange,
      "trendAnalysis.openExposureChange",
    ],
  ];

  comparisons.forEach(
    ([
      actual,
      expected,
      fieldName,
    ]) => {
      if (actual !== expected) {
        throw new Error(
          `Operational Analytics field "${fieldName}" does not match canonical evidence.`,
        );
      }
    },
  );

  const canonicalCollections = [
    [
      analytics.servicePatterns,
      servicePatterns,
      "servicePatterns",
    ],

    [
      analytics
        .environmentPatterns,
      environmentPatterns,
      "environmentPatterns",
    ],

    [
      analytics.severityPatterns,
      severityPatterns,
      "severityPatterns",
    ],

    [
      analytics.categoryPatterns,
      categoryPatterns,
      "categoryPatterns",
    ],

    [
      analytics.recurringPatterns,
      recurringPatterns,
      "recurringPatterns",
    ],

    [
      analytics.correlations,
      correlations,
      "correlations",
    ],
  ];

  canonicalCollections.forEach(
    ([
      actual,
      expected,
      fieldName,
    ]) => {
      if (
        JSON.stringify(actual)
        !== JSON.stringify(expected)
      ) {
        throw new Error(
          `Operational Analytics field "${fieldName}" does not match canonical evidence.`,
        );
      }
    },
  );
}

function validateFindingReferences({
  analytics,
  findings,
}) {
  const validFindingIds =
    new Set(
      findings.map(
        (finding) =>
          finding.id,
      ),
    );

  const references = [
    ...analytics
      .concentrationRisks
      .flatMap(
        (risk) =>
          risk.supportingFindingIds,
      ),

    ...analytics
      .leadershipInsights
      .flatMap(
        (insight) =>
          insight.supportingFindingIds,
      ),
  ];

  const invalidReferences =
    references.filter(
      (findingId) =>
        !validFindingIds.has(
          findingId,
        ),
    );

  if (
    invalidReferences.length > 0
  ) {
    throw new Error(
      `Operational Analytics contains unsupported finding references: ${
        uniqueStrings(
          invalidReferences,
        ).join(", ")
      }`,
    );
  }
}

function determineCountDirection({
  earlier,
  later,
}) {
  if (
    earlier === 0
    && later === 0
  ) {
    return "indeterminate";
  }

  if (later < earlier) {
    return "improving";
  }

  if (later > earlier) {
    return "worsening";
  }

  return "stable";
}

function isMaterialFinding(
  finding,
) {
  return (
    finding.severity
      === "critical"
    || finding.severity
      === "high"
  );
}

function recordMatchesService(
  record,
  normalizedService,
) {
  if (
    normalizeLowercaseString(
      record.service,
    )
    === normalizedService
  ) {
    return true;
  }

  const affectedServices =
    Array.isArray(
      record.signal
        ?.affectedServices,
    )
      ? record.signal
        .affectedServices
      : [];

  return affectedServices
    .some(
      (service) =>
        normalizeLowercaseString(
          service,
        )
        === normalizedService,
    );
}

function findingMatchesService(
  finding,
  normalizedService,
) {
  if (
    normalizeLowercaseString(
      finding.service,
    )
    === normalizedService
  ) {
    return true;
  }

  return finding
    .affectedServices
    .some(
      (service) =>
        normalizeLowercaseString(
          service,
        )
        === normalizedService,
    );
}

function countServiceRecords(
  records,
  normalizedService,
) {
  return records.filter(
    (record) =>
      recordMatchesService(
        record,
        normalizedService,
      ),
  ).length;
}

function countEnvironmentRecords(
  records,
  normalizedEnvironment,
) {
  return records.filter(
    (record) =>
      normalizeLowercaseString(
        record.signal
          ?.environment,
      )
      === normalizedEnvironment,
  ).length;
}

function resolveFindingService(
  finding,
) {
  return (
    normalizeOptionalString(
      finding.service,
    )
    || normalizeOptionalString(
      finding
        .affectedServices?.[0],
    )
  );
}

function getResponseContent(result) {
  const content =
    result?.choices?.[0]
      ?.message?.content;

  if (
    typeof content !== "string"
    || content.trim() === ""
  ) {
    throw new Error(
      "OpenAI returned an empty Operational Analytics response.",
    );
  }

  return content;
}

module.exports = {
  createOperationalAnalyticsIntelligence,

  buildAnalyticsPrompt,
  parseAnalyticsResult,
  validateOperationalAnalytics,
};
