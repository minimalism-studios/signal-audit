const express = require("express");
const crypto = require("crypto");

const {
  SIGNAL_STATES,
} = require(
  "../constants/signalStates",
);

function createSignalInterpreterRouter({
  signalHistory,
  connectionStore,
  investigationStore,
  operationalMemoryStore,
  processGrafanaSignal,
  processDatadogSignal,
  authorization,
}) {
  if (!signalHistory) {
    throw new Error(
      "signalHistory is required.",
    );
  }

  if (!connectionStore) {
    throw new Error(
      "connectionStore is required.",
    );
  }

  if (!investigationStore) {
    throw new Error(
      "investigationStore is required.",
    );
  }

  if (!operationalMemoryStore) {
    throw new Error(
      "operationalMemoryStore is required.",
    );
  }

  if (
    typeof processGrafanaSignal
    !== "function"
  ) {
    throw new Error(
      "processGrafanaSignal is required.",
    );
  }

  if (
    typeof processDatadogSignal
    !== "function"
  ) {
    throw new Error(
      "processDatadogSignal is required.",
    );
  }

  if (
    !authorization
    || typeof authorization
      .requirePermission
      !== "function"
  ) {
    throw new Error(
      "Signal Interpreter Router requires authorization middleware.",
    );
  }

  const router = express.Router();

  function normalizeFilter(value) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized =
      value.trim().toLowerCase();

    return normalized === ""
      || normalized === "all"
        ? null
        : normalized;
  }

  router.get(
    "/signals",
    authorization.requirePermission(
      "signals:read",
    ),
    (req, res) => {
    const requestedLimit =
      Number.parseInt(
        req.query.limit,
        10,
      );

    const requestedPageSize =
      Number.parseInt(
        req.query.pageSize,
        10,
      );

    const pageSize =
      Number.isInteger(
        requestedPageSize,
      )
      && requestedPageSize > 0
        ? Math.min(
            requestedPageSize,
            200,
          )
        : Number.isInteger(
              requestedLimit,
            )
            && requestedLimit > 0
          ? Math.min(
              requestedLimit,
              200,
            )
          : 50;

    const requestedPage =
      Number.parseInt(
        req.query.page,
        10,
      );

    const page =
      Number.isInteger(
        requestedPage,
      )
      && requestedPage > 0
        ? requestedPage
        : 1;

    const result =
      signalHistory.searchSignals({
        query:
          req.query.query
          || req.query.q
          || null,
        source:
          normalizeFilter(
            req.query.source,
          ),
        service:
          normalizeFilter(
            req.query.service,
          ),
        severity:
          normalizeFilter(
            req.query.severity,
          ),
        state:
          normalizeFilter(
            req.query.state,
          ),
        status:
          normalizeFilter(
            req.query.status,
          ),
        startDate:
          req.query.startDate
          || null,
        endDate:
          req.query.endDate
          || null,
        page,
        pageSize,
      });

    return res.status(200).json({
      count:
        result.signals.length,
      signals:
        result.signals,
      pagination:
        result.pagination,
    });
      },
  );

  router.get(
    "/dashboard",
    (req, res) => {
      const allSignals =
        signalHistory.listAllSignals();

      const integrations =
        connectionStore.listConnections();

      const environments =
        new Set();

      let failedAnalyses = 0;

      allSignals.forEach((signal) => {
        if (
          signal.signal?.environment
        ) {
          environments.add(
            signal.signal.environment,
          );
        }

        if (
          signal.state ===
          SIGNAL_STATES.FAILED
        ) {
          failedAnalyses++;
        }
      });

      let overallHealth =
        "healthy";

      if (failedAnalyses > 0) {
        overallHealth =
          "warning";
      }

      if (
        integrations.length === 0
      ) {
        overallHealth =
          "warning";
      }

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0,
      );

      const signalsToday =
        allSignals.filter(
          (signal) => {
            if (
              !signal.receivedAt
            ) {
              return false;
            }

            return (
              new Date(
                signal.receivedAt,
              ) >= today
            );
          },
        );

      const recentSignals =
        allSignals.slice(
          0,
          5,
        );

      return res.status(200).json({
        summary: {
          totalSignals:
            allSignals.length,

          signalsToday:
            signalsToday.length,

          integrations:
            integrations.length,

          environments:
            environments.size,

          failedAnalyses,

          overallHealth,
        },

        recentSignals,

        integrations,
      });
    },
  );

  router.get(
    "/environments",
    (req, res) => {
      const allSignals =
        signalHistory.listAllSignals();

      const connections =
        connectionStore.listConnections();

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0,
      );

      const environments =
        new Map();

      allSignals.forEach((record) => {
        const environment =
          record.signal?.environment
          || "unknown";

        if (
          !environments.has(environment)
        ) {
          environments.set(
            environment,
            {
              id: environment,
              name:
                environment
                  .charAt(0)
                  .toUpperCase()
                  + environment.slice(1),

              status: "healthy",

              totalSignals: 0,
              signalsToday: 0,

              lastSignalReceived: null,

              sources: new Set(),
              integrations: new Set(),
            },
          );
        }

        const item =
          environments.get(environment);

        item.totalSignals++;

        if (
          record.receivedAt
          && new Date(record.receivedAt)
            >= today
        ) {
          item.signalsToday++;
        }

        if (
          !item.lastSignalReceived
          || new Date(record.receivedAt)
            >
            new Date(
              item.lastSignalReceived,
            )
        ) {
          item.lastSignalReceived =
            record.receivedAt;
        }

        if (record.source) {
          item.sources.add(
            record.source,
          );
        }

        if (record.connectionId) {
          item.integrations.add(
            record.connectionId,
          );
        }

        if (
          record.state
          === SIGNAL_STATES.FAILED
        ) {
          item.status =
            "warning";
        }
      });

      const payload =
        Array.from(
          environments.values(),
        ).map(
          (environment) => ({
            ...environment,

            sources:
              Array.from(
                environment.sources,
              ),

            integrations:
              environment.integrations
                .size,
          }),
        );

      return res.status(200).json({
        count: payload.length,

        environments: payload,
      });
    },
  );

  router.get(
    "/integrations",
    authorization.requirePermission(
      "integrations:read",
    ),
    (req, res) => {
      const integrations =
        connectionStore.listConnections();

      return res.status(200).json({
        count: integrations.length,
        integrations,
      });
    },
  );

  router.post(
    "/integrations",
    authorization.requirePermission(
      "integrations:write",
    ),
    (req, res, next) => {
      try {
        const integration =
          connectionStore
            .createConnection({
              connectionId:
                req.body
                  ?.connectionId,

              source:
                req.body
                  ?.source,

              status:
                req.body
                  ?.status
                || "active",

              outputs:
                req.body
                  ?.outputs
                || {},
            });

        return res
          .status(201)
          .json({
            integration,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/integrations/:connectionId/test",
    authorization.requirePermission(
      "integrations:write",
    ),
    async (req, res, next) => {
      try {
        const {
          connectionId,
        } = req.params;

        const connection =
          connectionStore
            .getConnection(
              connectionId,
              {
                requireActive:
                  false,
              },
            );

        if (
          connection.status
          !== "active"
        ) {
          return res
            .status(409)
            .json({
              success:
                false,

              error: {
                status:
                  409,

                message:
                  "Integration must be active before it can be tested.",
              },
            });
        }

        const testId =
          crypto.randomUUID();

        const testedAt =
          new Date().toISOString();

        const commonSignal = {
          source:
            connection.source,

          connectionId,

          isTest:
            true,

          testId,

          status:
            "firing",

          fingerprint:
            `signal-audit-test-${testId}`,

          title:
            "Signal Audit Connection Test",

          service:
            "signal-audit",

          environment:
            "test",

          severity:
            "low",

          team:
            "platform",

          description:
            "Synthetic operational signal generated to verify the Signal Audit integration pipeline.",

          startsAt:
            testedAt,

          labels: {
            alertname:
              "SignalAuditConnectionTest",

            service:
              "signal-audit",

            environment:
              "test",

            severity:
              "low",

            team:
              "platform",

            signal_audit_test:
              "true",
          },

          annotations: {
            summary:
              "Signal Audit Connection Test",

            description:
              "This synthetic signal verifies Signal History and AI analysis.",
          },
        };

        let result;

        if (
          connection.source
          === "grafana"
        ) {
          result =
            await processGrafanaSignal({
              ...commonSignal,

              values: {
                A:
                  1,
              },

              valueString:
                "test_value=1",

              dashboardUrl:
                null,

              panelUrl:
                null,

              generatorUrl:
                null,
            });
        } else if (
          connection.source
          === "datadog"
        ) {
          result =
            await processDatadogSignal({
              ...commonSignal,

              monitorId:
                `signal-audit-test-${testId}`,

              alertCycleKey:
                `signal-audit-test-${testId}`,

              monitorType:
                "metric alert",

              metric:
                "signal_audit.connection_test",

              value:
                1,

              threshold:
                1,

              scope:
                "environment:test",

              query:
                "avg(last_5m):avg:signal_audit.connection_test{*} >= 1",

              hostname:
                "signal-audit",

              tags: [
                "service:signal-audit",
                "environment:test",
                "severity:low",
                "team:platform",
                "signal_audit_test:true",
              ],

              alertUrl:
                null,

              rawPayload: {
                synthetic:
                  true,

                testId,
              },
            });
        } else {
          return res
            .status(400)
            .json({
              success:
                false,

              error: {
                status:
                  400,

                message:
                  `Unsupported integration source: ${connection.source}.`,
              },
            });
        }

        return res
          .status(200)
          .json({
            success:
              true,

            connectionId,

            source:
              connection.source,

            testedAt,

            testId,

            result: {
              historyId:
                result.historyId,

              analyzed:
                Boolean(
                  result.auditResult,
                ),
            },
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/integrations/:connectionId",
    authorization.requirePermission(
      "integrations:write",
    ),
    (req, res, next) => {
      try {
        const integration =
          connectionStore
            .updateConnection({
              connectionId:
                req.params
                  .connectionId,

              changes:
                req.body
                || {},
            });

        return res
          .status(200)
          .json({
            integration,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/integrations/:connectionId",
    authorization.requirePermission(
      "integrations:write",
    ),
    (req, res, next) => {
      try {
        const integration =
          connectionStore
            .deleteConnection(
              req.params
                .connectionId,
            );

        return res
          .status(200)
          .json({
            integration,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
  "/integrations/:connectionId",
  authorization.requirePermission(
    "integrations:read",
  ),
  (req, res) => {
    const {
      connectionId,
    } = req.params;

    const integration =
      connectionStore.getConnection(
        connectionId,
        {
          requireActive:
            false,
        },
      );

    if (!integration) {
      return res.status(404).json({
        error:
          "Integration not found.",
      });
    }

    const integrationSignals =
      signalHistory
        .listAllSignals()
        .filter(
          (record) =>
            record.connectionId
            === connectionId,
        );

    const lastSignal =
      integrationSignals[0]
      || null;

    const lastAnalyzedSignal =
      integrationSignals.find(
        (record) =>
          record.state
          === SIGNAL_STATES.ANALYZED
          && record.analyzedAt,
      )
      || null;

    const failedAnalyses =
      integrationSignals.filter(
        (record) =>
          record.state
          === SIGNAL_STATES.FAILED,
      ).length;

    return res.status(200).json({
      connectionId,

      ...integration,

      statistics: {
        signalsProcessed:
          integrationSignals.length,

        lastSignalReceived:
          lastSignal?.receivedAt
          || null,

        lastSignalAnalyzed:
          lastAnalyzedSignal
            ?.analyzedAt
          || null,

        failedAnalyses,
      },
    });
  },
);

  router.get(
    "/filters",
    (req, res) => {
      return res
        .status(200)
        .json(
          signalHistory.getAvailableFilters(),
        );
    },
  );

  router.get(
    "/signals/:id",
    authorization.requirePermission(
      "signals:read",
    ),
    (req, res) => {
    const record =
      signalHistory.getSignal(
        req.params.id,
      );

    if (!record) {
      return res.status(404).json({
        error: "Signal not found.",
      });
    }

    return res.status(200).json({
      signal: record,
    });
      },
  );

  router.get(
    "/investigations",
    authorization.requirePermission(
      "investigations:read",
    ),
    (req, res, next) => {
      try {
        const investigations =
          investigationStore
            .listInvestigations({
              status:
                req.query.status
                || null,
            });

        return res
          .status(200)
          .json({
            count:
              investigations.length,

            investigations,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/investigations/:id",
    authorization.requirePermission(
      "investigations:read",
    ),
    (req, res, next) => {
      try {
        const investigation =
          investigationStore
            .getInvestigation(
              req.params.id,
            );

        if (!investigation) {
          return res
            .status(404)
            .json({
              error:
                "Investigation not found.",
            });
        }

        return res
          .status(200)
          .json({
            investigation,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/investigations",
    authorization.requirePermission(
      "investigations:write",
    ),
    (req, res, next) => {
      try {
        const result =
          investigationStore
            .createFromSignal({
              signalId:
                req.body?.signalId,

              owner:
                req.body?.owner
                || "",
            });

        return res
          .status(
            result.created
              ? 201
              : 200,
          )
          .json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/investigations/:id",
    authorization.requirePermission(
      "investigations:write",
    ),
    (req, res, next) => {
      try {
        const investigation =
          investigationStore
            .updateInvestigation({
              investigationId:
                req.params.id,

              changes:
                req.body
                || {},
            });

        return res
          .status(200)
          .json({
            investigation,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/investigations/:id/signals",
    authorization.requirePermission(
      "investigations:write",
    ),
    (req, res, next) => {
      try {
        const investigation =
          investigationStore
            .addSignal({
              investigationId:
                req.params.id,

              signalId:
                req.body?.signalId,
            });

        return res
          .status(200)
          .json({
            investigation,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/investigations/:id/assessment",
    authorization.requirePermission(
      "investigations:write",
    ),
    (req, res, next) => {
      try {
        const investigation =
          investigationStore
            .updateAssessment({
              investigationId:
                req.params.id,

              summary:
                req.body?.summary,

              confidence:
                req.body?.confidence,
            });

        return res
          .status(200)
          .json({
            investigation,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/investigations/:id/recommendations",
    authorization.requirePermission(
      "investigations:write",
    ),
    (req, res, next) => {
      try {
        const investigation =
          investigationStore
            .updateRecommendations({
              investigationId:
                req.params.id,

              recommendations:
                req.body
                || {},
            });

        return res
          .status(200)
          .json({
            investigation,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/investigations/:id/resolution",
    authorization.requirePermission(
      "investigations:write",
    ),
    (req, res, next) => {
      try {
        const investigation =
          investigationStore
            .resolveInvestigation({
              investigationId:
                req.params.id,

              resolution:
                req.body
                || {},
            });

        return res
          .status(200)
          .json({
            investigation,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/operational-memory",
    authorization.requirePermission(
      "memory:read",
    ),
    (req, res, next) => {
      try {
        const documents =
          operationalMemoryStore
            .listDocuments({
              type:
                req.query.type,

              service:
                req.query.service,
            });

        return res
          .status(200)
          .json({
            count:
              documents.length,

            documents,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/operational-memory/:id",
    authorization.requirePermission(
      "memory:read",
    ),
    (req, res, next) => {
      try {
        const document =
          operationalMemoryStore
            .getDocument(
              req.params.id,
            );

        if (!document) {
          return res
            .status(404)
            .json({
              error:
                "Operational Memory document was not found.",
            });
        }

        return res
          .status(200)
          .json({
            document,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

module.exports = {
  createSignalInterpreterRouter,
};
