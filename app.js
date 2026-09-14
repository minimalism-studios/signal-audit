require("dotenv").config();

const express = require("express");

const helmet = require("helmet");

const logger = require("./services/logger");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const FileStore =
  require(
    "session-file-store",
  )(session);

const OpenAI = require("openai");

const {
  createSignalAuditService,
} = require("./services/signalAudit");

const {
  createSignalHistory,
} = require("./services/signalHistory");

const {
  createConnectionStore,
} = require("./services/connectionStore");

const {
  createEventBus,
} = require("./services/eventBus");

const {
  createInvestigationStore,
} = require("./services/investigationStore");

const {
  createOperationalMemoryStore,
} = require("./services/operationalMemoryStore");

const {
  createCustomerDataPurgeService,
} = require("./services/customerDataPurge");

const {
  createUserStore,
} = require("./services/userStore");

const {
  createAuthenticationService,
} = require("./services/authentication");

const {
  createAuthorizationService,
} = require("./services/authorization");

const {
  createAuthenticationMiddleware,
} = require("./middleware/authentication");

const {
  createAuthorizationMiddleware,
} = require("./middleware/authorization");

const {
  createAuthenticationRouter,
} = require("./routes/authentication");

const {
  createUsersRouter,
} = require("./routes/users");

const {
  createSignalInterpreterRouter,
} = require("./routes/signalInterpreter");

const {
  createExecutiveIntelligence,
  createOperationalReportingIntelligence,
  createOperationalAnalyticsIntelligence,
  createForecastIntelligence,
} = require("./services/intelligence");

const {
  createExecutiveDashboardRouter,
} = require("./routes/executiveDashboard");

const {
  createGrafanaProcessor,
} = require("./integrations/grafana/processor");

const {
  createDatadogProcessor,
} = require("./integrations/datadog/processor");

const {
  createGrafanaWebhookHandler,
} = require("./integrations/grafana/webhook");

const {
  createDatadogWebhookHandler,
} = require("./integrations/datadog/webhook");

const {
  createTenantServices,
} = require("./services/tenantServices");

const {
  resolveTenantIdFromHostname,
} = require("./services/tenantContext");


if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is required.",
  );
}

const PORT =
  process.env.PORT || 3000;

if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  for (
    const directory
    of [
      "data",
      "config",
      "sessions",
    ]
  ) {
    fs.mkdirSync(
      path.join(
        process.env.RAILWAY_VOLUME_MOUNT_PATH,
        directory,
      ),
      {
        recursive: true,
      },
    );
  }
}

const app =
  express();

app.set(
  "trust proxy",
  1,
);

app.use(
  helmet({
    contentSecurityPolicy:
      false,
  }),
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "32kb",
  }),
);

app.use(
  session({
    name:
      "signal_audit_session",

    secret:
      process.env.SESSION_SECRET,

    resave:
      false,

    saveUninitialized:
      false,

    store:
      new FileStore({
        path:
          process.env.RAILWAY_VOLUME_MOUNT_PATH
            ? path.join(
                process.env.RAILWAY_VOLUME_MOUNT_PATH,
                "sessions",
              )
            : path.join(
                __dirname,
                "sessions",
              ),
      }),

    cookie: {
      httpOnly:
        true,

      sameSite:
        "lax",

      secure:
        process.env.NODE_ENV
        === "production",

      maxAge:
        1000
        * 60
        * 60
        * 8,
    },
  }),
);

app.use(
  "/signal-interpreter",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  express.static(
    path.join(
      __dirname,
      "public",
      "signal-interpreter",
    ),
  ),
);

app.use(
  "/shared",
  express.static(
    path.join(
      __dirname,
      "public",
      "shared",
    ),
  ),
);

app.use(
  "/login-assets",
  express.static(
    path.join(
      __dirname,
      "public",
      "login",
    ),
  ),
);

const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

const signalAuditService =
  createSignalAuditService({
    openai,
  });

const signalHistory =
  createSignalHistory();

const connectionStore =
  createConnectionStore();

const events =
  createEventBus();

const operationalMemoryStore =
  createOperationalMemoryStore();

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
    signalHistory,
    events,
  });

operationalMemoryStore
  .upsertInvestigations(
    investigationStore
      .listInvestigations(),
  );

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

const customerDataPurgeService =
  createCustomerDataPurgeService({
    signalHistory,
    investigationStore,
    operationalMemoryStore,
  });

const authorizationService =
  createAuthorizationService();

const userStore =
  createUserStore({
    seedUsername:
      process.env.AUTH_USERNAME,

    seedPasswordHash:
      process.env
        .AUTH_PASSWORD_HASH,
  });

const authenticationService =
  createAuthenticationService({
    userStore,
    authorizationService,
    googleClientId:
      process.env.GOOGLE_CLIENT_ID,
    tenantId:
      "minimalism",
  });

const authentication =
  createAuthenticationMiddleware({
    authenticationService,
  });

const authorization =
  createAuthorizationMiddleware({
    authenticationService,
    authorizationService,
  });

app.get(
  "/login",
  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireGuest(
        req,
        res,
        next,
      );
  },

  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "login",
        "index.html",
      ),
    );
  },
);

app.use(
  "/executive-dashboard",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const {
      authorization:
        requestAuthorization,
    } =
      getRequestAuthentication(req);

    return requestAuthorization
      .requirePermission(
        "executive:read",
      )(
        req,
        res,
        next,
      );
  },

  express.static(
    path.join(
      __dirname,
      "public",
      "executive-dashboard",
    ),
  ),
);

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
      process.env
        .GRAFANA_WEBHOOK_SECRET,

    connectionStore,
  });

const datadogWebhookHandler =
  createDatadogWebhookHandler({
    processSignal:
      processDatadogSignal,

    webhookSecret:
      process.env
        .DATADOG_WEBHOOK_SECRET,

    connectionStore,
  });

const oasseServices =
  createTenantServices({
    tenantId:
      "oasse",

    openai,

    signalAuditService,

    grafanaWebhookSecret:
      process.env
        .GRAFANA_WEBHOOK_SECRET,

    datadogWebhookSecret:
      process.env
        .DATADOG_WEBHOOK_SECRET,
  });

const oasseAuthenticationService =

  createAuthenticationService({

    userStore:

      oasseServices.userStore,

    authorizationService,

    googleClientId:

      process.env.GOOGLE_CLIENT_ID,

    tenantId:
      "oasse",
  });

const oasseAuthentication =

  createAuthenticationMiddleware({

    authenticationService:

      oasseAuthenticationService,

  });

const oasseAuthorization =

  createAuthorizationMiddleware({

    authenticationService:

      oasseAuthenticationService,

    authorizationService,

  });

function requireRequestTenantId(req) {

  const tenantId =
    resolveTenantIdFromHostname(
      req.hostname,
    );

  if (!tenantId) {
    const error =
      new Error(
        "Unknown tenant host.",
      );

    error.status = 404;

    throw error;
  }

  return tenantId;
}

function getRequestServices(req) {
  const tenantId =
    requireRequestTenantId(req);

  if (tenantId === "oasse") {
    return oasseServices;
  }

  return {
    signalHistory,
    connectionStore,
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
  };
}

function getRequestAuthentication(req) {
  const tenantId =
    requireRequestTenantId(req);

  if (tenantId === "oasse") {
    return {
      userStore:
        oasseServices.userStore,

      authenticationService:
        oasseAuthenticationService,

      authentication:
        oasseAuthentication,

      authorization:
        oasseAuthorization,
    };
  }

  return {
    userStore,
    authenticationService,
    authentication,
    authorization,
  };
}

app.get(
  "/health",
  (req, res) => {
    res.status(200).json({
      status:
        "ok",
    });
  },
);

const minimalismAuthenticationRouter =
  createAuthenticationRouter({
    authenticationService,
  });

const oasseAuthenticationRouter =
  createAuthenticationRouter({
    authenticationService:
      oasseAuthenticationService,
  });

app.use(
  "/auth",
  (req, res, next) => {
    const { authenticationService: requestAuthenticationService } =
      getRequestAuthentication(req);

    const router =
      requestAuthenticationService
        === oasseAuthenticationService
        ? oasseAuthenticationRouter
        : minimalismAuthenticationRouter;

    return router(req, res, next);
  },
);

const minimalismExecutiveDashboardRouter =
  createExecutiveDashboardRouter({
    executiveIntelligence,
    operationalReportingIntelligence,
    operationalAnalyticsIntelligence,
    forecastIntelligence,
  });

const oasseExecutiveDashboardRouter =
  createExecutiveDashboardRouter({
    executiveIntelligence:
      oasseServices.executiveIntelligence,

    operationalReportingIntelligence:
      oasseServices
        .operationalReportingIntelligence,

    operationalAnalyticsIntelligence:
      oasseServices
        .operationalAnalyticsIntelligence,

    forecastIntelligence:
      oasseServices.forecastIntelligence,
  });

app.use(
  "/api/executive-dashboard",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const {
      authorization:
        requestAuthorization,
    } =
      getRequestAuthentication(req);

    return requestAuthorization
      .requirePermission(
        "executive:read",
      )(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const tenantId =
      requireRequestTenantId(req);

    const router =
      tenantId === "oasse"
        ? oasseExecutiveDashboardRouter
        : minimalismExecutiveDashboardRouter;

    return router(
      req,
      res,
      next,
    );
  },
);

const minimalismSignalInterpreterRouter =
  createSignalInterpreterRouter({
    signalHistory,
    connectionStore,
    investigationStore,
    operationalMemoryStore,
    processGrafanaSignal,
    processDatadogSignal,
    authorization,
  });

const oasseSignalInterpreterRouter =
  createSignalInterpreterRouter({
    signalHistory:
      oasseServices.signalHistory,

    connectionStore:
      oasseServices.connectionStore,

    investigationStore:
      oasseServices.investigationStore,

    operationalMemoryStore:
      oasseServices.operationalMemoryStore,

    processGrafanaSignal:
      oasseServices.processGrafanaSignal,

    processDatadogSignal:
      oasseServices.processDatadogSignal,

    authorization:
      oasseAuthorization,
  });

app.use(
  "/api/signal-interpreter",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const tenantId =
      requireRequestTenantId(req);

    const router =
      tenantId === "oasse"
        ? oasseSignalInterpreterRouter
        : minimalismSignalInterpreterRouter;

    return router(
      req,
      res,
      next,
    );
  },
);

const minimalismUsersRouter =
  createUsersRouter({
    userStore,
    authorizationService,
  });

const oasseUsersRouter =
  createUsersRouter({
    userStore:
      oasseServices.userStore,

    authorizationService,
  });

app.use(
  "/api/users",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const {
      authorization:
        requestAuthorization,
    } =
      getRequestAuthentication(req);

    return requestAuthorization
      .requirePermission(
        "users:read",
      )(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const tenantId =
      requireRequestTenantId(req);

    const router =
      tenantId === "oasse"
        ? oasseUsersRouter
        : minimalismUsersRouter;

    return router(
      req,
      res,
      next,
    );
  },
);

app.get(
  "/api/signals",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const {
      authorization:
        requestAuthorization,
    } =
      getRequestAuthentication(req);

    return requestAuthorization
      .requirePermission(
        "signals:read",
      )(
        req,
        res,
        next,
      );
  },

  (req, res) => {
    const {
      signalHistory:
        requestSignalHistory,
    } =
      getRequestServices(req);

    const signals =
      requestSignalHistory.listSignals({
        limit:
          Number.parseInt(
            req.query.limit,
            10,
          ) || 50,
      });

    res.status(200).json({
      count:
        signals.length,

      signals,
    });
  },
);

app.get(
  "/api/signals/:id",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const {
      authorization:
        requestAuthorization,
    } =
      getRequestAuthentication(req);

    return requestAuthorization
      .requirePermission(
        "signals:read",
      )(
        req,
        res,
        next,
      );
  },

  (req, res) => {
    const {
      signalHistory:
        requestSignalHistory,
    } =
      getRequestServices(req);

    const signal =
      requestSignalHistory.getSignal(
        req.params.id,
      );

    if (!signal) {
      return res.status(404).json({
        error:
          "Signal not found.",
      });
    }

    return res.status(200).json({
      signal,
    });
  },
);

app.get(
  "/api/integrations",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const {
      authorization:
        requestAuthorization,
    } =
      getRequestAuthentication(req);

    return requestAuthorization
      .requirePermission(
        "integrations:read",
      )(
        req,
        res,
        next,
      );
  },

  (req, res) => {
    const {
      connectionStore:
        requestConnectionStore,
    } =
      getRequestServices(req);

    const integrations =
      requestConnectionStore
        .listConnections();

    res.status(200).json({
      count:
        integrations.length,

      integrations,
    });
  },
);

app.post(
  "/integrations/grafana/webhook/:connectionId",
  (req, res, next) => {
    const {
      grafanaWebhookHandler:
        requestGrafanaWebhookHandler,
    } =
      getRequestServices(req);

    return requestGrafanaWebhookHandler(
      req,
      res,
      next,
    );
  },
);

app.post(
  "/integrations/datadog/webhook/:connectionId",
  (req, res, next) => {
    const {
      datadogWebhookHandler:
        requestDatadogWebhookHandler,
    } =
      getRequestServices(req);

    return requestDatadogWebhookHandler(
      req,
      res,
      next,
    );
  },
);

app.get(
  "/",
  (req, res) => {
    const {
      authenticationService:
        requestAuthenticationService,
    } =
      getRequestAuthentication(req);

    if (
      requestAuthenticationService
        .isAuthenticated(req)
    ) {
      return res.redirect(
        "/signal-interpreter/",
      );
    }

    return res.redirect(
      "/login",
    );
  },
);

app.post(
  "/api/admin/data-purge/:connectionId",

  (req, res, next) => {
    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        next,
      );
  },

  (req, res, next) => {
    const {
      authorization:
        requestAuthorization,
    } =
      getRequestAuthentication(req);

    return requestAuthorization
      .requirePermission(
        "data:purge",
      )(
        req,
        res,
        next,
      );
  },

  (req, res) => {
    const {
      customerDataPurgeService:
        requestCustomerDataPurgeService,
    } =
      getRequestServices(req);

    const receipt =
      requestCustomerDataPurgeService
        .purgeConnection(
          req.params.connectionId,
        );

    res.status(200).json({
      purge: receipt,
    });
  },
);

app.use(
  (error, req, res, next) => {
    logger.error(
      "http_request_error",
      {
        status:
          error.status || 500,

        method:
          req.method,

        path:
          req.path,

        errorName:
          error.name || "Error",

        errorCode:
          error.code || null,
      },
    );

    const status =
      error.status || 500;

    const message =
      status >= 500
        ? "Internal server error."
        : error.message
          || "Request failed.";

    res.status(
      status,
    ).json({
      error: {
        status,
        message,
      },
    });
  },
);

app.listen(
  PORT,
  () => {
    logger.info(
      "service_started",
      {
        port: PORT,
      },
    );
  },
);
