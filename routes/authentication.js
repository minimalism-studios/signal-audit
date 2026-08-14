const express = require("express");

function createAuthenticationRouter({
  authenticationService,
}) {
  if (!authenticationService) {
    throw new Error(
      "authenticationService is required.",
    );
  }

  const router = express.Router();

  router.post(
    "/login",
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

        authenticationService.login(
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