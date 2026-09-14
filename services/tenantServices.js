const {
  createSignalHistory,
} = require("./signalHistory");

const {
  createConnectionStore,
} = require("./connectionStore");

const {
  createInvestigationStore,
} = require("./investigationStore");

const {
  createOperationalMemoryStore,
} = require("./operationalMemoryStore");

const {
  createUserStore,
} = require("./userStore");


const {
  createCustomerDataPurgeService,
} = require("./customerDataPurge");
const {
  createEventBus,
} = require("./eventBus");

const {
  createExecutiveIntelligence,
  createOperationalReportingIntelligence,
  createOperationalAnalyticsIntelligence,
  createForecastIntelligence,
} = require("./intelligence");

const {
  createGrafanaProcessor,
} = require(
  "../integrations/grafana/processor"
);

const {
  createDatadogProcessor,
} = require(
  "../integrations/datadog/processor"
);

const {
  createGrafanaWebhookHandler,
} = require(
  "../integrations/grafana/webhook"
);

const {
  createDatadogWebhookHandler,
} = require(
  "../integrations/datadog/webhook"
);

const {
  getTenantRuntimePaths,
} = require("./tenantContext");

function createTenantServices({
  tenantId,
  openai,
  signalAuditService,
  grafanaWebhookSecret,
  datadogWebhookSecret,
}) {
  if (!openai) {
    throw new Error(
      "openai is required.",
    );
  }

  if (!signalAuditService) {
    throw new Error(
      "signalAuditService is required.",
    );
  }

  const paths =
    getTenantRuntimePaths(
      tenantId,
    );

  const signalHistory =
    createSignalHistory({
      filePath:
        paths.signalHistory,
    });

  const connectionStore =
    createConnectionStore({
      filePath:
        paths.connections,
    });

  const userStore =

    createUserStore({

      filePath:

        paths.users,

      seedAdministratorEnabled:

        false,

    });

  const events =
    createEventBus();

  const operationalMemoryStore =
    createOperationalMemoryStore({
      filePath:
        paths.operationalMemory,
    });

  function synchronizeOperationalMemory(
    investigation,
  ) {
    return operationalMemoryStore
      .upsertInvestigation(
        investigation,
      );
  }

  events.on(
    "investigation.created",
    synchronizeOperationalMemory,
  );

  events.on(
    "investigation.updated",
    synchronizeOperationalMemory,
  );

  events.on(
    "investigation.resolved",
    synchronizeOperationalMemory,
  );

  const investigationStore =
    createInvestigationStore({
      filePath:
        paths.investigations,
      signalHistory,
      events,
    });

  operationalMemoryStore
    .upsertInvestigations(
      investigationStore
        .listInvestigations(),
    );
  const customerDataPurgeService =
    createCustomerDataPurgeService({
      signalHistory,
      investigationStore,
      operationalMemoryStore,
    });


  const executiveIntelligence =
    createExecutiveIntelligence({
      openai,
      signalHistory,
      investigationStore,
    });

  const operationalReportingIntelligence =
    createOperationalReportingIntelligence({
      openai,
      signalHistory,
      investigationStore,
    });

  const operationalAnalyticsIntelligence =
    createOperationalAnalyticsIntelligence({
      openai,
      signalHistory,
    });

  const forecastIntelligence =
    createForecastIntelligence({
      openai,
      signalHistory,
    });

  const processGrafanaSignal =
    createGrafanaProcessor({
      signalAuditService,
      signalHistory,
    });

  const processDatadogSignal =
    createDatadogProcessor({
      signalAuditService,
      signalHistory,
    });

  const grafanaWebhookHandler =
    createGrafanaWebhookHandler({
      processSignal:
        processGrafanaSignal,
      webhookSecret:
        grafanaWebhookSecret,
      connectionStore,
    });

  const datadogWebhookHandler =
    createDatadogWebhookHandler({
      processSignal:
        processDatadogSignal,
      webhookSecret:
        datadogWebhookSecret,
      connectionStore,
    });

  return Object.freeze({
    tenantId,
    paths,

    signalHistory,
    connectionStore,
    userStore,
    investigationStore,
    operationalMemoryStore,
    customerDataPurgeService,
    executiveIntelligence,
    operationalReportingIntelligence,
    operationalAnalyticsIntelligence,
    forecastIntelligence,

    processGrafanaSignal,
    processDatadogSignal,
    grafanaWebhookHandler,
    datadogWebhookHandler,
  });
}

module.exports = {
  createTenantServices,
};
