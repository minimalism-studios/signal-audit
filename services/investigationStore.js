const fs = require("fs");

const path = require("path");

const crypto = require("crypto");

const {
  resolveRetentionDays,
  isWithinRetention,
} = require("./retention");

const DEFAULT_FILE_PATH =
  process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(
        process.env.RAILWAY_VOLUME_MOUNT_PATH,
        "data",
        "investigations.json",
      )
    : path.join(
        __dirname,
        "../data/investigations.json",
      );

const INVESTIGATION_STATUSES =
  new Set([
    "new",
    "investigating",
    "monitoring",
    "resolved",
    "archived",
  ]);

function createInvestigationStore({

  filePath = DEFAULT_FILE_PATH,

  retentionDays =
    resolveRetentionDays(),

  signalHistory,
  events = null,
} = {}) {
  if (
    !signalHistory
    || typeof signalHistory.getSignal
      !== "function"
    || typeof signalHistory.resolveSignal
      !== "function"
  ) {
    throw new Error(
      "Investigation Store requires Signal History with getSignal() and resolveSignal().",
    );
  }

  function loadInvestigations() {
    ensureFile();

    const contents =
      fs.readFileSync(
        filePath,
        "utf8",
      );

    try {
      const investigations =
        JSON.parse(contents);

      if (
        !Array.isArray(
          investigations,
        )
      ) {
        throw new TypeError(
          "Investigation data must be an array.",
        );
      }

      const retainedInvestigations =
        investigations.filter(
          (investigation) => {

            const status =
              normalizeOptionalString(
                investigation.status,
              )?.toLowerCase()
              ?? "investigating";

            if (
              status !== "resolved"
              && status !== "archived"
            ) {

              return true;

            }

            const retentionTimestamp =
              status === "resolved"
                ? (
                    investigation
                      .resolution
                      ?.resolvedAt
                    || investigation
                      .updatedAt
                    || investigation
                      .createdAt
                  )
                : (
                    investigation
                      .updatedAt
                    || investigation
                      .resolution
                      ?.resolvedAt
                    || investigation
                      .createdAt
                  );

            return isWithinRetention(
              retentionTimestamp,
              retentionDays,
            );

          },
        );

      if (
        retainedInvestigations.length
        !== investigations.length
      ) {

        saveInvestigations(
          retainedInvestigations,
        );

      }

      return retainedInvestigations;

    } catch (error) {
      throw new Error(
        `Unable to load investigations: ${error.message}`,
      );
    }
  }

  function saveInvestigations(
    investigations,
  ) {
    fs.mkdirSync(
      path.dirname(filePath),
      {
        recursive: true,
      },
    );

    const temporaryPath =
      `${filePath}.tmp`;

    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(
        investigations,
        null,
        2,
      )}\n`,
      "utf8",
    );

    fs.renameSync(
      temporaryPath,
      filePath,
    );
  }

  function listInvestigations({
    status = null,
  } = {}) {
    const normalizedStatus =
      normalizeOptionalString(
        status,
      )?.toLowerCase()
      ?? null;

    return loadInvestigations()
      .filter(
        (investigation) =>
          !normalizedStatus
          || investigation.status
            === normalizedStatus,
      )
      .sort(
        (left, right) =>
          Date.parse(
            right.updatedAt,
          )
          - Date.parse(
            left.updatedAt,
          ),
      );
  }

  function getInvestigation(
    investigationId,
  ) {
    const normalizedId =
      requireString(
        investigationId,
        "investigationId",
      );

    return (
      loadInvestigations()
        .find(
          (investigation) =>
            investigation.id
            === normalizedId,
        )
      ?? null
    );
  }

  function createFromSignal({
    signalId,
    owner = "",
  }) {
    const normalizedSignalId =
      requireString(
        signalId,
        "signalId",
      );

    const record =
      signalHistory.getSignal(
        normalizedSignalId,
      );

    if (!record) {
      const error =
        new Error(
          "Signal was not found.",
        );

      error.status = 404;

      throw error;
    }

    const investigations =
      loadInvestigations();

    const existing =
      investigations.find(
        (investigation) =>
          ![
            "resolved",
            "archived",
          ].includes(
            investigation.status,
          )
          && investigation
            .evidence
            ?.signals
            ?.includes(
              normalizedSignalId,
            ),
      );

    if (existing) {
      return {
        investigation:
          existing,

        created:
          false,
      };
    }

    const now =
      new Date().toISOString();

    const findings =
      Array.isArray(
        record.analysis?.findings,
      )
        ? record.analysis.findings
            .filter(
              (finding) =>
                finding
                && typeof finding === "object"
                && !Array.isArray(finding),
            )
            .map(
              (finding) => ({
                ...finding,

                evidence:
                  normalizeStringArray(
                    finding.evidence,
                  ),

                affectedServices:
                  normalizeStringArray(
                    finding.affectedServices,
                  ),

                actions: {
                  immediate:
                    normalizeStringArray(
                      finding.actions?.immediate,
                    ),

                  shortTerm:
                    normalizeStringArray(
                      finding.actions?.shortTerm,
                    ),

                  longTerm:
                    normalizeStringArray(
                      finding.actions?.longTerm,
                    ),
                },
              }),
            )
        : [];

    const primaryFinding =
      findings[0]
      ?? null;

    const recommendations = {
      immediate:
        normalizeStringArray(
          findings.flatMap(
            (finding) =>
              finding.actions?.immediate
              ?? [],
          ),
        ),

      shortTerm:
        normalizeStringArray(
          findings.flatMap(
            (finding) =>
              finding.actions?.shortTerm
              ?? [],
          ),
        ),

      longTerm:
        normalizeStringArray(
          findings.flatMap(
            (finding) =>
              finding.actions?.longTerm
              ?? [],
          ),
        ),
    };

    const investigation = {
      id:
        `inv_${crypto.randomUUID()}`,

      title:
        normalizeOptionalString(
          record.signal?.title,
        )
        || normalizeOptionalString(
          record.analysis?.summary,
        )
        || normalizeOptionalString(
          record.service,
        )
        || "Untitled Investigation",

      question:
        `Why is ${
          normalizeOptionalString(
            record.service,
          )
          || "this service"
        } experiencing this condition?`,

      summary:
        normalizeOptionalString(
          record.analysis?.summary,
        )
        || "",

      status:
        "investigating",

      severity:
        normalizeOptionalString(
          record.severity,
        )
        || normalizeOptionalString(
          record.signal?.severity,
        )
        || "unknown",

      source:
        normalizeOptionalString(
          record.source,
        )
        || "unknown",

      connectionId:

        normalizeOptionalString(

          record.connectionId,

        ),

      service:
        normalizeOptionalString(
          record.service,
        )
        || null,

      environment:
        normalizeOptionalString(
          record.signal?.environment,
        )
        || null,

      owner:
        normalizeOptionalString(
          owner,
        )
        || "",

      assessment: {
        summary:
          normalizeOptionalString(
            record.analysis?.summary,
          )
          || normalizeOptionalString(
            primaryFinding
              ?.executiveSummary,
          )
          || "",

        confidence:
          normalizeConfidence(
            primaryFinding
              ?.confidence,
          ),

        updatedAt:
          now,
      },

      evidence: {
        signals: [
          normalizedSignalId,
        ],

        metrics: [],
        deployments: [],
        logs: [],
        incidents: [],

        environments:
          record.signal?.environment
            ? [
                record.signal
                  .environment,
              ]
            : [],
      },

      findings,

      timeline: [
        createTimelineEvent({
          type:
            "investigation-created",

          label:
            "Investigation created",

          timestamp:
            now,
        }),

        ...(
          findings.length > 0
            ? [
                createTimelineEvent({
                  type:
                    "signal-analysis-imported",

                  label:
                    "Operational assessment established",

                  description:
                    `${findings.length} structured finding${
                      findings.length === 1
                        ? ""
                        : "s"
                    } established the initial operational assessment and generated investigation recommendations.`,

                  timestamp:
                    now,
                }),
              ]
            : []
        ),
      ],

      recommendations,

      resolution: {
        status:
          "open",

        summary:
          "",

        rootCause:
          "",

        lessonsLearned:
          [],

        correctiveActions:
          [],

        preventiveActions:
          [],

        resolvedBy:
          "",

        resolvedAt:
          null,
      },

      createdAt:
        now,

      updatedAt:
        now,
    };

    investigations.unshift(
      investigation,
    );

    saveInvestigations(
      investigations,
    );

    if (
      events
      && typeof events.emit
        === "function"
    ) {
      events.emit(
        "investigation.created",
        investigation,
      );
    }

    return {
      investigation,
      created:
        true,
    };
  }

  function addSignal({
    investigationId,
    signalId,
  }) {
    const normalizedSignalId =
      requireString(
        signalId,
        "signalId",
      );

    const record =
      signalHistory.getSignal(
        normalizedSignalId,
      );

    if (!record) {
      const error =
        new Error(
          "Signal was not found.",
        );

      error.status = 404;

      throw error;
    }

    return mutateInvestigation(
      investigationId,
      (investigation) => {
        assertMutable(
          investigation,
        );

        const signalConnectionId =

          normalizeOptionalString(

            record.connectionId,

          );

        let investigationConnectionId =

          normalizeOptionalString(

            investigation.connectionId,

          );

        if (

          !investigationConnectionId

        ) {

          const existingSignalIds =

            normalizeStringArray(

              investigation.evidence

                ?.signals,

            );

          const existingConnectionIds =

            [

              ...new Set(

                existingSignalIds

                  .map(

                    (existingSignalId) =>

                      signalHistory

                        .getSignal(

                          existingSignalId,

                        )

                        ?.connectionId,

                  )

                  .map(

                    normalizeOptionalString,

                  )

                  .filter(Boolean),

              ),

            ];

          if (

            existingConnectionIds.length

            > 1

          ) {

            const error =

              new Error(

                "Investigation contains signals from multiple integration connections.",

              );

            error.status = 409;

            throw error;

          }

          investigationConnectionId =

            existingConnectionIds[0]

            || null;

          if (

            investigationConnectionId

          ) {

            investigation.connectionId =

              investigationConnectionId;

          }

        }

        if (

          investigationConnectionId

          && !signalConnectionId

        ) {

          const error =

            new Error(

              "Signal is not associated with an integration connection.",

            );

          error.status = 409;

          throw error;

        }

        if (

          investigationConnectionId

          && signalConnectionId

          && investigationConnectionId

            !== signalConnectionId

        ) {

          const error =

            new Error(

              "Signal belongs to a different integration connection.",

            );

          error.status = 409;

          throw error;

        }

        if (

          !investigationConnectionId

          && signalConnectionId

        ) {

          investigation.connectionId =

            signalConnectionId;

        }

        investigation.evidence ??= {};

        investigation.evidence
          .signals ??= [];

        if (
          !investigation
            .evidence
            .signals
            .includes(
              normalizedSignalId,
            )
        ) {
          investigation
            .evidence
            .signals
            .push(
              normalizedSignalId,
            );

          investigation.timeline ??= [];

          investigation.timeline.push(
            createTimelineEvent({
              type:
                "signal-attached",

              label:
                "Signal attached",

              description:
                `Additional telemetry was incorporated into the operational assessment.`,

              reference:
                normalizedSignalId,
            }),
          );
        }

        const environment =
          normalizeOptionalString(
            record.signal?.environment,
          );

        if (environment) {
          investigation
            .evidence
            .environments ??= [];

          if (
            !investigation
              .evidence
              .environments
              .includes(environment)
          ) {
            investigation
              .evidence
              .environments
              .push(environment);
          }
        }
      },
    );
  }

  function updateInvestigation({
    investigationId,
    changes,
  }) {
    assertPlainObject(
      changes,
      "changes",
    );

    return mutateInvestigation(
      investigationId,
      (investigation) => {
        if (
          Object.hasOwn(
            changes,
            "title",
          )
        ) {
          investigation.title =
            requireString(
              changes.title,
              "title",
            );
        }

        if (
          Object.hasOwn(
            changes,
            "question",
          )
        ) {
          investigation.question =
            normalizeOptionalString(
              changes.question,
            )
            || "";
        }

        if (
          Object.hasOwn(
            changes,
            "summary",
          )
        ) {
          investigation.summary =
            normalizeOptionalString(
              changes.summary,
            )
            || "";
        }

        if (
          Object.hasOwn(
            changes,
            "owner",
          )
        ) {
          investigation.owner =
            normalizeOptionalString(
              changes.owner,
            )
            || "";
        }

        if (
          Object.hasOwn(
            changes,
            "status",
          )
        ) {
          const status =
            normalizeStatus(
              changes.status,
            );

          if (
            status === "resolved"
          ) {
            throw new Error(
              "Use resolveInvestigation() to resolve an investigation.",
            );
          }

          investigation.status =
            status;
        }
      },
    );
  }

  function updateAssessment({
    investigationId,
    summary,
    confidence,
  }) {
    return mutateInvestigation(
      investigationId,
      (investigation) => {
        assertMutable(
          investigation,
        );

        investigation.assessment ??= {};

        if (
          summary !== undefined
        ) {
          investigation
            .assessment
            .summary =
              normalizeOptionalString(
                summary,
              )
              || "";
        }

        if (
          confidence !== undefined
        ) {
          investigation
            .assessment
            .confidence =
              normalizeConfidence(
                confidence,
              );
        }

        investigation
          .assessment
          .updatedAt =
            new Date().toISOString();
      },
    );
  }

  function updateRecommendations({
    investigationId,
    recommendations,
  }) {
    assertPlainObject(
      recommendations,
      "recommendations",
    );

    return mutateInvestigation(
      investigationId,
      (investigation) => {
        assertMutable(
          investigation,
        );

        investigation.recommendations = {
          immediate:
            normalizeStringArray(
              recommendations.immediate,
            ),

          shortTerm:
            normalizeStringArray(
              recommendations.shortTerm,
            ),

          longTerm:
            normalizeStringArray(
              recommendations.longTerm,
            ),
        };

        investigation.timeline ??= [];

        investigation.timeline.push(
          createTimelineEvent({
            type:
              "recommendations-updated",

            label:
              "Recommendations updated",
          }),
        );
      },
    );
  }

  function resolveInvestigation({
    investigationId,
    resolution,
  }) {
    assertPlainObject(
      resolution,
      "resolution",
    );

    const resolvedAt =
      normalizeOptionalTimestamp(
        resolution.resolvedAt,
      )
      || new Date().toISOString();

    const investigation =
      mutateInvestigation(
        investigationId,
        (investigation) => {
          assertMutable(
            investigation,
          );

        investigation.resolution = {
          ...investigation.resolution,

          status:
            "resolved",

          summary:
            normalizeOptionalString(
              resolution.summary,
            )
            || "",

          rootCause:
            normalizeOptionalString(
              resolution.rootCause,
            )
            || "",

          lessonsLearned:
            normalizeStringArray(
              resolution.lessonsLearned,
            ),

          correctiveActions:
            normalizeStringArray(
              resolution
                .correctiveActions,
            ),

          preventiveActions:
            normalizeStringArray(
              resolution
                .preventiveActions,
            ),

          resolvedBy:
            normalizeOptionalString(
              resolution.resolvedBy,
            )
            || "",

          resolvedAt,
        };

        investigation.status =
          "resolved";

        investigation.timeline ??= [];

        investigation.timeline.push(
          createTimelineEvent({
            type:
              "investigation-resolved",

            label:
              "Investigation resolved",

            description:
              "Investigation concluded and operational knowledge captured.",

            timestamp:
              resolvedAt,
          }),
        );
        },
      );

    const signalIds =
      normalizeStringArray(
        investigation.evidence
          ?.signals,
      );

    signalIds.forEach(
      (signalId) => {
        signalHistory.resolveSignal(
          signalId,
          {
            resolvedAt,
          },
        );
      },
    );

    if (
      events
      && typeof events.emit
        === "function"
    ) {
      events.emit(
        "investigation.resolved",
        investigation,
      );
    }

    return investigation;
  }

  function mutateInvestigation(
    investigationId,
    mutation,
  ) {
    const normalizedId =
      requireString(
        investigationId,
        "investigationId",
      );

    const investigations =
      loadInvestigations();

    const investigation =
      investigations.find(
        (item) =>
          item.id
          === normalizedId,
      );

    if (!investigation) {
      const error =
        new Error(
          "Investigation was not found.",
        );

      error.status = 404;

      throw error;
    }

    mutation(
      investigation,
    );

    investigation.updatedAt =
      new Date().toISOString();

    saveInvestigations(
      investigations,
    );

    if (
      events
      && typeof events.emit
        === "function"
    ) {
      events.emit(
        "investigation.updated",
        investigation,
      );
    }

    return investigation;
  }

  function ensureFile() {
    if (
      fs.existsSync(filePath)
    ) {
      return;
    }

    fs.mkdirSync(
      path.dirname(filePath),
      {
        recursive: true,
      },
    );

    fs.writeFileSync(
      filePath,
      "[]\n",
      "utf8",
    );
  }

  function purgeConnection(
    connectionId,
  ) {
    const normalizedConnectionId =
      requireString(
        connectionId,
        "connectionId",
      );

    const customerSignalIds =
      new Set(
        signalHistory
          .listAllSignals()
          .filter(
            (record) =>
              normalizeOptionalString(
                record.connectionId,
              )
              === normalizedConnectionId,
          )
          .map(
            (record) =>
              normalizeOptionalString(
                record.id,
              ),
          )
          .filter(Boolean),
      );

    const investigations =
      loadInvestigations();

    const deletedInvestigationIds =
      [];

    const retainedInvestigations =
      investigations.filter(
        (investigation) => {
          const directMatch =
            normalizeOptionalString(
              investigation.connectionId,
            )
            === normalizedConnectionId;

          const attachedSignalIds =
            normalizeStringArray(
              investigation.evidence
                ?.signals,
            );

          const legacyMatch =
            attachedSignalIds.some(
              (signalId) =>
                customerSignalIds.has(
                  signalId,
                ),
            );

          if (
            directMatch
            || legacyMatch
          ) {
            if (investigation.id) {
              deletedInvestigationIds
                .push(
                  investigation.id,
                );
            }

            return false;
          }

          return true;
        },
      );

    if (
      retainedInvestigations.length
      !== investigations.length
    ) {
      saveInvestigations(
        retainedInvestigations,
      );
    }

    return {
      connectionId:
        normalizedConnectionId,
      deletedCount:
        deletedInvestigationIds.length,
      investigationIds:
        deletedInvestigationIds,
    };
  }

  return {
    listInvestigations,
    getInvestigation,
    createFromSignal,
    addSignal,
    updateInvestigation,
    updateAssessment,
    updateRecommendations,
    purgeConnection,
    resolveInvestigation,
  };
}

function createTimelineEvent({
  type,
  label,
  description = "",
  reference = null,
  timestamp = null,
}) {
  return {
    id:
      `evt_${crypto.randomUUID()}`,

    timestamp:
      timestamp
      || new Date().toISOString(),

    type:
      requireString(
        type,
        "timeline.type",
      ),

    label:
      requireString(
        label,
        "timeline.label",
      ),

    description:
      normalizeOptionalString(
        description,
      )
      || "",

    reference:
      normalizeOptionalString(
        reference,
      ),
  };
}

function assertMutable(
  investigation,
) {
  if (
    [
      "resolved",
      "archived",
    ].includes(
      investigation.status,
    )
  ) {
    const error =
      new Error(
        "Resolved or archived investigations cannot be modified.",
      );

    error.status = 409;

    throw error;
  }
}

function normalizeStatus(
  value,
) {
  const normalized =
    requireString(
      value,
      "status",
    ).toLowerCase();

  if (
    !INVESTIGATION_STATUSES
      .has(normalized)
  ) {
    throw new RangeError(
      `Unsupported investigation status: ${normalized}.`,
    );
  }

  return normalized;
}

function normalizeConfidence(
  value,
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  const numericValue =
    Number(value);

  if (
    Number.isFinite(
      numericValue,
    )
  ) {
    return numericValue;
  }

  const normalized =
    normalizeOptionalString(
      value,
    );

  return normalized;
}

function normalizeOptionalTimestamp(
  value,
) {
  const normalized =
    normalizeOptionalString(
      value,
    );

  if (!normalized) {
    return null;
  }

  const timestamp =
    Date.parse(normalized);

  if (
    Number.isNaN(timestamp)
  ) {
    throw new TypeError(
      "Timestamp must be a valid date string.",
    );
  }

  return new Date(timestamp)
    .toISOString();
}

function normalizeStringArray(
  value,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(
          normalizeOptionalString,
        )
        .filter(Boolean),
    ),
  ];
}

function requireString(
  value,
  fieldName,
) {
  const normalized =
    normalizeOptionalString(
      value,
    );

  if (!normalized) {
    throw new TypeError(
      `${fieldName} must be a non-empty string.`,
    );
  }

  return normalized;
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

  return normalized || null;
}

function assertPlainObject(
  value,
  fieldName,
) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new TypeError(
      `${fieldName} must be an object.`,
    );
  }
}

module.exports = {
  createInvestigationStore,
};
