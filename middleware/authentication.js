function createAuthenticationMiddleware({
  authenticationService,
}) {
  if (!authenticationService) {
    throw new Error(
      "authenticationService is required.",
    );
  }

  function requireAuthentication(
    req,
    res,
    next,
  ) {
    if (
      authenticationService
        .isAuthenticated(req)
    ) {
      next();
      return;
    }

    const acceptsHtml =
      req.accepts([
        "html",
        "json",
      ]) === "html";

    if (acceptsHtml) {
      res.redirect("/login");
      return;
    }

    res.status(401).json({
      error: {
        status: 401,
        message:
          "Authentication required.",
      },
    });
  }

  function requireGuest(
    req,
    res,
    next,
  ) {
    if (
      !authenticationService
        .isAuthenticated(req)
    ) {
      next();
      return;
    }

    const user =
      authenticationService
        .getCurrentUser(
          req,
        );

    const destination =
      user?.role
        === "executive"
        ? "/executive-dashboard"
        : "/signal-interpreter";

    res.redirect(
      destination,
    );
  }

  return {
    requireAuthentication,
    requireGuest,
  };
}

module.exports = {
  createAuthenticationMiddleware,
};