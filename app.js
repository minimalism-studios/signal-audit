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
  createSlackDeliveryService,
} = require("./integrations/slack/delivery");

const {
  createSlackWorkspaceAuthorizer,
} = require("./integrations/slack/authorization");

const {
  createWorkspaceRegistry,
} = require("./integrations/slack/workspaceRegistry");

const {
  createInstallationStore,
} = require("./integrations/slack/installationStore");

const {
  createOAuthStateRegistry,
} = require("./integrations/slack/oauthStateRegistry");

const {
  createSlackOAuthController,
} = require("./integrations/slack/oauthController");

const {
  createSlackOAuthRouter,
} = require("./integrations/slack/oauthRouter");

const {
  createEventInbox,
} = require("./integrations/slack/eventInbox");

const {
  createSlackEventsHandler,
} = require("./integrations/slack/eventsHandler");

const {
  createSlackEventsRouter,
} = require("./integrations/slack/eventsRouter");

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
  requireTenantId,
  getTenantRuntimePaths,
} = require("./services/tenantContext");


if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is required.",
  );
}

const MARKETING_HOSTS =
  new Set([
    "signal-audit.com",
    "www.signal-audit.com",
    "signal-audit.localhost",
  ]);

function isMarketingHost(req) {
  return MARKETING_HOSTS.has(
    req.hostname
      .trim()
      .toLowerCase(),
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

// Application hosts are product surfaces, not public search content.
// Keep signal-audit.com indexable while explicitly preventing
// app and tenant application surfaces from search-engine indexing.
app.use(
  (req, res, next) => {
    if (!isMarketingHost(req)) {
      res.set(
        "X-Robots-Tag",
        "noindex, nofollow",
      );
    }

    return next();
  },
);

app.get(
  "/robots.txt",
  (req, res, next) => {
    if (isMarketingHost(req)) {
      return next();
    }

    res
      .type("text/plain")
      .send(
        "User-agent: *\n"
        + "Disallow: /\n",
      );
  },
);

app.use(
  (req, res, next) => {
    if (
      req.originalUrl
        ?.startsWith(
          "/integrations/gatekeeper/webhook/",
        )
      || req.path === "/api/integrations/slack/events"
    ) {
      /*
       * Gatekeeper webhook bodies must remain
       * unparsed until transport authentication
       * has completed.
       */
      return next();
    }

    return express.json({
      limit:
        "1mb",
    })(
      req,
      res,
      next,
    );
  },
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

// OASSE Vanguard Pilot — automatic expiration.
// October 21, 2026, midnight Pacific (07:00 UTC).
// Preserves Minimalism administrator access and pilot records.
const OASSE_PILOT_EXPIRES_AT =
  Date.parse("2026-10-21T07:00:00Z");

const OASSE_OWNER_USERNAME =
  "iam@minimalism.agency";

function enforceOassePilotExpiration() {
  if (Date.now() < OASSE_PILOT_EXPIRES_AT) {
    return;
  }

  const users =
    oasseServices.userStore.listUsers();

  const owner = users.find(
    (user) =>
      user.username?.toLowerCase() === OASSE_OWNER_USERNAME
      && user.role === "administrator"
      && user.active === true,
  );

  if (!owner) {
    throw new Error(
      "OASSE pilot expiration: active Minimalism administrator not found.",
    );
  }

  for (const user of users) {
    if (!user.active || user.id === owner.id) {
      continue;
    }

    oasseServices.userStore.deactivateUser({
      userId: user.id,
      actorUserId: owner.id,
    });
  }
}

app.use((req, res, next) => {
  if (
    resolveTenantIdFromHostname(req.hostname) !== "oasse"
    || Date.now() < OASSE_PILOT_EXPIRES_AT
  ) {
    return next();
  }

  res.set("Cache-Control", "no-store");

  if (req.path === "/health") {
    return next();
  }

  // Block every integration webhook, including Gatekeeper.
  if (req.path.startsWith("/integrations/")) {
    return res.status(403).json({
      error: "pilot_expired",
      message: "The OASSE Vanguard Pilot has concluded.",
    });
  }

  try {
    enforceOassePilotExpiration();
  } catch (error) {
    console.error(
      "OASSE pilot expiration enforcement failed:",
      error,
    );

    return res.status(503).json({
      error: "pilot_expiration_enforcement_failed",
    });
  }

  // Keep authentication and login resources available
  // so the Minimalism administrator can sign in.
  if (
    req.path === "/login"
    || req.path.startsWith("/login-assets/")
    || req.path.startsWith("/shared/")
    || req.path === "/auth/login"
    || req.path === "/auth/google"
    || req.path === "/auth/google/config"
    || req.path === "/auth/logout"
    || req.path === "/auth/session"
  ) {
    return next();
  }

  const currentUser =
    oasseAuthenticationService.getCurrentUser(req);

  if (
    currentUser?.username?.toLowerCase() ===
      OASSE_OWNER_USERNAME
    && currentUser.role === "administrator"
  ) {
    return next();
  }

  return res.status(403).json({
    error: "pilot_expired",
    message:
      "The OASSE Vanguard Pilot has concluded. " +
      "Access requires a new written agreement.",
  });
});

app.use(
  "/signal-interpreter",
  (req, res, next) => {
    if (isMarketingHost(req)) {
      return next();
    }

    const {
      authentication:
        requestAuthentication,
    } =
      getRequestAuthentication(req);

    return requestAuthentication
      .requireAuthentication(
        req,
        res,
        (error) => {
          if (error) {
            return next(error);
          }

          return express.static(
            path.join(
              __dirname,
              "public",
              "signal-interpreter",
            ),
          )(
            req,
            res,
            next,
          );
        },
      );
  },
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

const slackAuthorizationEnabled =
  process.env.SLACK_WORKSPACE_AUTHORIZATION_ENABLED === "true";

const slackOAuthEnabled =
  process.env.SLACK_OAUTH_ENABLED === "true";

const slackWorkspaceRegistry =
  (slackAuthorizationEnabled || slackOAuthEnabled)
    ? createWorkspaceRegistry({
        filePath: path.join(
          process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname,
          "config",
          "slack-workspace-ownership.json",
        ),
        validateTenantId: requireTenantId,
      })
    : null;

const slackWorkspaceAuthorizer =
  slackAuthorizationEnabled
  && typeof process.env.SLACK_BOT_TOKEN === "string"
  && process.env.SLACK_BOT_TOKEN.trim()
    ? createSlackWorkspaceAuthorizer({
        tenantId: "minimalism",
        botToken: process.env.SLACK_BOT_TOKEN,
        workspaceRegistry: slackWorkspaceRegistry,
      })
    : null;

const slackDeliveryService =
  typeof process.env.SLACK_BOT_TOKEN === "string"
  && process.env.SLACK_BOT_TOKEN.trim()
    ? createSlackDeliveryService({
        botToken: process.env.SLACK_BOT_TOKEN,
        requireAuthorization: slackAuthorizationEnabled,
        authorizeDelivery:
          slackWorkspaceAuthorizer?.authorizeDelivery || null,
      })
    : null;

const processGrafanaSignal =
  createGrafanaProcessor({
    signalAuditService,
    signalHistory,
    connectionStore,
    slackDeliveryService,
  });

const processDatadogSignal =
  createDatadogProcessor({
    signalAuditService,
    signalHistory,
    connectionStore,
    slackDeliveryService,
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

    gatekeeperWebhookSecret:
      process.env
        .GATEKEEPER_WEBHOOK_SECRET,

    gatekeeperWebhookSigningSecret:
      process.env
        .GATEKEEPER_WEBHOOK_SIGNING_SECRET,

    // The expired OASSE pilot must not use Minimalism's Slack credential.
    slackBotToken: null,
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

// Slack OAuth is opt-in and remains separate from legacy delivery authorization.
if (slackOAuthEnabled) {
  const requiredVariables = [
    "SLACK_CLIENT_ID",
    "SLACK_CLIENT_SECRET",
    "SLACK_OAUTH_REDIRECT_URI",
    "SLACK_OAUTH_ENCRYPTION_KEY",
    "SLACK_OAUTH_SCOPES",
  ];

  const missingVariables = requiredVariables.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Slack OAuth configuration is incomplete: ${missingVariables.join(", ")}`,
    );
  }

  if (!slackWorkspaceRegistry) {
    throw new Error("Slack OAuth workspace registry is unavailable.");
  }

  const encryptionKey = Buffer.from(
    process.env.SLACK_OAUTH_ENCRYPTION_KEY,
    "base64",
  );

  if (
    encryptionKey.length !== 32 ||
    encryptionKey.toString("base64") !==
      process.env.SLACK_OAUTH_ENCRYPTION_KEY
  ) {
    throw new Error(
      "SLACK_OAUTH_ENCRYPTION_KEY must be canonical Base64 encoding of 32 bytes.",
    );
  }

  const slackOAuthPaths = getTenantRuntimePaths("minimalism");
  const slackOAuthRoot = path.join(
    slackOAuthPaths.root,
    "integrations",
    "slack",
  );

  const installationDirectory = path.join(
    slackOAuthRoot,
    "installations",
  );

  const stateDirectory = path.join(
    slackOAuthRoot,
    "oauth-state",
  );

  for (const directory of [
    slackOAuthRoot,
    installationDirectory,
    stateDirectory,
  ]) {
    fs.mkdirSync(directory, {
      recursive: true,
      mode: 0o700,
    });
  }

  const installationStore = createInstallationStore({
    directory: installationDirectory,
    encryptionKey,
    workspaceRegistry: slackWorkspaceRegistry,
    validateTenantId: requireTenantId,
  });

  const stateRegistry = createOAuthStateRegistry({
    directory: stateDirectory,
    encryptionKey,
  });

  const scopes = process.env.SLACK_OAUTH_SCOPES
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  const controller = createSlackOAuthController({
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    redirectUri: process.env.SLACK_OAUTH_REDIRECT_URI,
    scopes,
    stateRegistry,
    workspaceRegistry: slackWorkspaceRegistry,
    installationStore,
  });

  if (process.env.SLACK_SIGNING_SECRET?.trim()) {
    const eventInbox = createEventInbox({
      directory: path.join(slackOAuthRoot, "events"),
    });

    const eventsHandler = createSlackEventsHandler({
      workspaceRegistry: slackWorkspaceRegistry,
      installationStore,
      eventInbox,
    });

    app.use(
      "/api/integrations/slack/events",
      createSlackEventsRouter({
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        eventsHandler,
      }),
    );
  }

  app.use(
    "/api/integrations/slack",
    createSlackOAuthRouter({
      controller,
      installationStore,
      getRequestAuthentication: (req) => ({
        ...getRequestAuthentication(req),
        authorization: authorizationService,
      }),
      requireRequestTenantId,
    }),
  );
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
    googleSignInEnabled: false,
  });

const oasseAuthenticationRouter =
  createAuthenticationRouter({
    authenticationService:
      oasseAuthenticationService,
    googleSignInEnabled: true,
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

app.post(
  "/integrations/gatekeeper/webhook/:connectionId",

  express.raw({
    type:
      "application/json",
    limit:
      "1mb",
  }),

  (req, res, next) => {
    /*
     * Gatekeeper transport authentication uses
     * the exact HTTP request body bytes.
     * Parsing occurs inside the webhook handler
     * only after transport verification.
     */
    req.rawBody =
      req.body;

    const {
      gatekeeperWebhookHandler:
        requestGatekeeperWebhookHandler,
    } =
      getRequestServices(req);

    return requestGatekeeperWebhookHandler(
      req,
      res,
      next,
    );
  },
);

// Signal Audit marketing website.
// This host boundary keeps the public website isolated from the
// authenticated application and tenant-specific Gatekeeper runtime.
const marketingSiteRoot =
  path.join(
    __dirname,
    "website",
  );

const marketingPages =
  new Map([
    ["/", "index.html"],
    ["/why-signal-audits-work", "pages/how-it-works.html"],
    ["/signal-interpreter", "pages/signal-interpreter.html"],
    ["/audit-submitted", "pages/audit-submitted.html"],
    ["/inside-a-signal-audit", "pages/inside-a-signal-audit.html"],
    ["/pricing", "pages/pricing.html"],
    ["/case-studies", "pages/case-studies.html"],
    ["/whitepapers", "pages/whitepapers.html"],
    ["/whitepapers/from-observability-to-operational-intelligence", "pages/whitepapers/from-observability-to-operational-intelligence.html"],
    ["/partners", "pages/partners.html"],
    ["/case-studies/splunk-mltk-birch-signal-audit", "pages/case-studies/splunk-mltk-birch-algorithm.html"],
    ["/case-studies/production-throttling-detection-during-ocp-migration", "pages/case-studies/production-throttling-detection-during-ocp-migration.html"],
    ["/case-studies/ocp-migration-dark-mode-testing", "pages/case-studies/ocp-migration-dark-mode-testing.html"],
    ["/case-studies/incident-response-and-operational-ownership", "pages/case-studies/incident-response-and-operational-ownership.html"],
    ["/case-studies/alert-fatigue-reduction-through-signal-classification", "pages/case-studies/alert-fatigue-reduction-through-signal-classification.html"],
    ["/case-studies/ai-fails-silently-a-systems-perspective", "pages/case-studies/ai-fails-silently-a-systems-perspective.html"],
    ["/case-studies/oasse-vanguard-pilot", "pages/case-studies/oasse-vanguard-pilot.html"],
    ["/faq", "pages/faq.html"],
    ["/signal-audit-slack", "pages/signal-audit-slack.html"],
    ["/enterprise-operational-review", "pages/enterprise-operational-review.html"],
    ["/product-walkthrough/grafana-alert-to-slack", "pages/product-walkthrough/grafana-alert-to-slack.html"],
    ["/integrations", "pages/integrations/index.html"],
    ["/integrations/grafana", "pages/integrations/grafana.html"],
    ["/integrations/datadog", "pages/integrations/datadog.html"],
    ["/product-walkthrough/datadog-monitor-to-slack", "pages/product-walkthrough/datadog-monitor-to-slack.html"],
    ["/security", "pages/security.html"],
  ]);

app.use(
  (req, res, next) => {
    if (!isMarketingHost(req)) {
      return next();
    }

    if (req.path.startsWith("/assets/")) {
      const originalUrl =
        req.url;

      req.url =
        req.url.replace(
          /^\/assets/,
          "",
        );

      return express.static(
        path.join(
          marketingSiteRoot,
          "assets",
        ),
      )(
        req,
        res,
        (error) => {
          req.url =
            originalUrl;

          if (error) {
            return next(error);
          }

          return next();
        },
      );
    }

    if (
      req.method !== "GET"
      && req.method !== "HEAD"
    ) {
      return next();
    }

    const normalizedPath =
      req.path.length > 1
        ? req.path.replace(/\/+$/, "")
        : req.path;

    const marketingRedirects =
      new Map([
        ["/signal-audit", "/"],
        ["/integrations/index", "/integrations"],
        ["/how-it-works", "/why-signal-audits-work"],
    ["/signal-over-noise-understand-whats-happening-in-your-system-1", "/"],
      ]);

    const redirectTarget =
      marketingRedirects.get(
        normalizedPath,
      );

    if (redirectTarget) {
      return res.redirect(
        301,
        redirectTarget,
      );
    }

    const page =
      marketingPages.get(
        normalizedPath,
      );

    if (page) {
      return res.sendFile(
        path.join(
          marketingSiteRoot,
          page,
        ),
      );
    }

    return res
      .status(404)
      .sendFile(
        path.join(
          marketingSiteRoot,
          "404.html",
        ),
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

// Enforce OASSE expiration at startup and at the cutoff.
// Request-time enforcement remains the fallback.
function scheduleOassePilotExpiration() {
  const retryDelayMs = 60 * 1000;

  function enforceWithRetry() {
    try {
      enforceOassePilotExpiration();
      logger.info("oasse_pilot_expiration_enforced");
    } catch (error) {
      logger.error(
        "oasse_pilot_expiration_failed",
        {
          message: error.message,
          retryInMs: retryDelayMs,
        },
      );

      setTimeout(enforceWithRetry, retryDelayMs);
    }
  }

  const remainingMs =
    OASSE_PILOT_EXPIRES_AT - Date.now();

  if (remainingMs <= 0) {
    enforceWithRetry();
    return;
  }

  setTimeout(enforceWithRetry, remainingMs);
}

app.listen(
  PORT,
  () => {
    try {
      scheduleOassePilotExpiration();
    } catch (error) {
      logger.error(
        "oasse_pilot_expiration_startup_failed",
        {
          message: error.message,
        },
      );
    }

    logger.info(
      "service_started",
      {
        port: PORT,
      },
    );
  },
);
