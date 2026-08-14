function createAuthorizationMiddleware({
  authenticationService,
  authorizationService,
}) {
  if (
    !authenticationService
    || typeof authenticationService
      .getCurrentUser
      !== "function"
  ) {
    throw new Error(
      "Authorization Middleware requires an Authentication Service.",
    );
  }

  if (
    !authorizationService
    || typeof authorizationService
      .hasPermission
      !== "function"
  ) {
    throw new Error(
      "Authorization Middleware requires an Authorization Service.",
    );
  }

  function requirePermission(
    permission,
  ) {
    if (
      typeof permission !== "string"
      || !permission.trim()
    ) {
      throw new Error(
        "A permission is required.",
      );
    }

    return (
      req,
      res,
      next,
    ) => {
      const user =
        authenticationService
          .getCurrentUser(
            req,
          );

      if (!user) {
        res.status(401).json({
          error: {
            status:
              401,

            message:
              "Authentication required.",
          },
        });

        return;
      }

      if (
        !authorizationService
          .hasPermission(
            user,
            permission,
          )
      ) {
        res.status(403).json({
          error: {
            status:
              403,

            message:
              "You do not have permission to perform this action.",

            permission,
          },
        });

        return;
      }

      req.currentUser =
        user;

      next();
    };
  }

  return {
    requirePermission,
  };
}

module.exports = {
  createAuthorizationMiddleware,
};
