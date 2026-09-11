const express = require("express");

const {
  rateLimit,
} = require("express-rate-limit");

function createAuthenticationRouter({
  authenticationService,
}) {
  if (!authenticationService) {
    throw new Error(
      "authenticationService is required.",
    );
  }

  function getCookieValue(
    req,
    name,
  ) {
    const cookieHeader =
      req.headers
        ?.cookie;

    if (
      typeof cookieHeader
        !== "string"
      || !cookieHeader.trim()
    ) {
      return null;
    }

    const prefix =
      `${name}=`;

    const matchingCookie =
      cookieHeader
        .split(";")
        .map(
          (part) =>
            part.trim(),
        )
        .find(
          (part) =>
            part.startsWith(
              prefix,
            ),
        );

    if (!matchingCookie) {
      return null;
    }

    try {
      return decodeURIComponent(
        matchingCookie.slice(
          prefix.length,
        ),
      );
    } catch (_error) {
      return null;
    }
  }

  const router = express.Router();

  const loginRateLimiter =
    rateLimit({
      windowMs:
        15 * 60 * 1000,

      limit: 5,

      standardHeaders:
        "draft-8",

      legacyHeaders:
        false,

      skipSuccessfulRequests:
        true,

      message: {
        error: {
          status: 429,
          message:
            "Too many failed login attempts. Please try again later.",
        },
      },
    });

  router.post(
    "/google",

    loginRateLimiter,
    async (req, res, next) => {
      try {
        const {
          credential,
          g_csrf_token:
            bodyCsrfToken,
        } = req.body ?? {};

        const cookieCsrfToken =
          getCookieValue(
            req,
            "g_csrf_token",
          );

        if (
          typeof bodyCsrfToken
            !== "string"
          || !bodyCsrfToken
          || !cookieCsrfToken
          || bodyCsrfToken
            !== cookieCsrfToken
        ) {
          res.status(400).send(
            "Invalid Google sign-in request.",
          );

          return;
        }

        const authenticatedUser =
          await authenticationService
            .authenticateGoogle({
              credential,
            });

        if (!authenticatedUser) {
          res.redirect(
            303,
            "/login?error=google_auth",
          );

          return;
        }

        await authenticationService
          .login(
            req,
            authenticatedUser,
          );

        const currentUser =
          authenticationService
            .getCurrentUser(req);

        const destination =
          currentUser?.role
            === "executive"
            ? "/executive-dashboard"
            : "/signal-interpreter";

        res.redirect(
          303,
          destination,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/login",

    loginRateLimiter,
    async (req, res, next) => {
      try {
        const {
          username,
          password,
        } = req.body ?? {};

        const authenticatedUser =
          await authenticationService
            .authenticate({
              suppliedUsername: username,
              suppliedPassword: password,
            });

        if (!authenticatedUser) {
          res.status(401).json({
            error: {
              status: 401,
              message:
                "Invalid username or password.",
            },
          });

          return;
        }

        await authenticationService.login(
          req,
          authenticatedUser,
        );

        res.status(200).json({
          user:
            authenticationService
              .getCurrentUser(req),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/logout",
    async (req, res, next) => {
      try {
        await authenticationService
          .logout(req);

        res.clearCookie(
          "signal_audit_session",
        );

        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/google/config",
    (_req, res) => {
      res.status(200).json({
        clientId:
          process.env.GOOGLE_CLIENT_ID
          ?? null,
      });
    },
  );

  router.get(
    "/session",
    (req, res) => {
      const user =
        authenticationService
          .getCurrentUser(req);

      if (!user) {
        res.status(401).json({
          authenticated: false,
          user: null,
        });

        return;
      }

      res.status(200).json({
        authenticated: true,
        user,
      });
    },
  );

  return router;
}

module.exports = {
  createAuthenticationRouter,
};