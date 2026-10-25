"use strict";

const express = require("express");

function createSlackOAuthRouter({
  controller,
  installationStore,
  getRequestAuthentication,
  requireRequestTenantId,
}) {
  if (
    !controller ||
    typeof controller.createAuthorizationAttempt !== "function" ||
    typeof controller.completeAuthorizationAttempt !== "function"
  ) {
    throw new Error("Slack OAuth controller is required.");
  }

  if (
    !installationStore ||
    typeof installationStore.listInstallations !== "function"
  ) {
    throw new Error("Slack installation store is required.");
  }

  const router = express.Router();

  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    return next();
  });

  router.use((req, res, next) => {
    try {
      const tenantId = requireRequestTenantId(req);

      if (tenantId !== "minimalism") {
        return res.sendStatus(403);
      }

      const {
        authenticationService,
        authorization,
      } = getRequestAuthentication(req);

      const user = authenticationService.getCurrentUser(req);

      if (!user) {
        return res.sendStatus(401);
      }

      if (!authorization.hasPermission(user, "integrations:manage")) {
        return res.sendStatus(403);
      }

      if (
        typeof req.sessionID !== "string" ||
        !req.sessionID
      ) {
        return res.sendStatus(401);
      }

      res.locals.slackOAuthContext = {
        tenantId,
        userId: user.id,
        sessionId: req.sessionID,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  });

  router.get("/oauth/start", (req, res, next) => {
    const fetchSite = req.get("Sec-Fetch-Site");

    if (fetchSite !== "same-origin") {
      return res.sendStatus(403);
    }

    try {
      const authorizationUrl =
        controller.createAuthorizationAttempt(
          res.locals.slackOAuthContext,
        );

      return res.redirect(302, authorizationUrl);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/oauth/callback", async (req, res) => {
    try {
      const result = await controller.completeAuthorizationAttempt({
        ...res.locals.slackOAuthContext,
        state: req.query.state,
        code: req.query.code,
      });

      return res.redirect(
        303,
        "/signal-interpreter/#/integrations",
      );
    } catch {
      // Do not expose tokens, Slack responses, or internal state details.
      return res.status(400).json({
        error: "Slack installation could not be completed.",
      });
    }
  });

  router.get("/installation", (req, res, next) => {
    try {
      const installations = installationStore.listInstallations({
        tenantId: res.locals.slackOAuthContext.tenantId,
      });

      return res.status(200).json({
        count: installations.length,
        installations,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createSlackOAuthRouter,
};
