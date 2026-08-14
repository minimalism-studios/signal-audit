require("dotenv").config();

const express = require("express");
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

if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is required.",
  );
}

const PORT =
  process.env.PORT || 3000;

const app =
  express();

app.set(
  "trust proxy",
  1,
);

app.use(
  express.json({
    limit: "1mb",
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
          path.join(
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
  authentication
    .requireGuest,

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

app.get(
  "/health",
  (req, res) => {
    res.status(200).json({
      status:
        "ok",

      service:
        "signal-audit",

      version:
        require("./package.json")
          .version,

      timestamp:
        new Date()
          .toISOString(),
    });
  },
);

app.use(
  "/auth",
  createAuthenticationRouter({
    authenticationService,
  }),
);

app.use(
  "/api/signal-interpreter",
  authentication
    .requireAuthentication,

  createSignalInterpreterRouter({
    signalHistory,
    connectionStore,
    investigationStore,
    operationalMemoryStore,
    processGrafanaSignal,
    processDatadogSignal,
    authorization,
  }),
);

app.use(
  "/api/users",
  authentication
    .requireAuthentication,

  authorization
    .requirePermission(
      "users:read",
    ),

  createUsersRouter({
    userStore,
    authorizationService,
  }),
);

app.get(
  "/api/signals",
  authentication
    .requireAuthentication,

  authorization
    .requirePermission(
      "signals:read",
    ),

  (req, res) => {
    const signals =
      signalHistory.listSignals({
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
  authentication
    .requireAuthentication,

  authorization
    .requirePermission(
      "signals:read",
    ),

  (req, res) => {
    const signal =
      signalHistory.getSignal(
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
  authentication
    .requireAuthentication,

  authorization
    .requirePermission(
      "integrations:read",
    ),

  (req, res) => {
    const integrations =
      connectionStore
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
  grafanaWebhookHandler,
);

app.post(
  "/integrations/datadog/webhook/:connectionId",
  datadogWebhookHandler,
);

app.get(
  "/",
  (req, res) => {
    if (
      authenticationService
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

app.use(
  (error, req, res, next) => {
    console.error(
      "Signal Audit error:",
      error,
    );

    res.status(
      error.status || 500,
    ).json({
      error: {
        status:
          error.status || 500,

        message:
          error.message
          || "Internal server error.",
      },
    });
  },
);

app.listen(
  PORT,
  () => {
    console.log(
      `Signal Audit listening on http://localhost:${PORT}`,
    );
  },
);
