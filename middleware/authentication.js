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
      const normalizedPath = "/" + (req.originalUrl || req.path).split("?")[0].split("/").filter(Boolean).join("/");
      const signalId = typeof req.query?.signalId === "string"
        ? req.query.signalId : null;
      if (normalizedPath === "/signal-interpreter"
          && signalId && signalId.length <= 256
          && !/[\x00-\x1f\x7f]/.test(signalId)) {
        const next = new URLSearchParams({
          next: `/signal-interpreter?${new URLSearchParams({signalId})}#/live-signals`,
        });
        res.redirect(`/login?${next}`);
      } else {
        res.redirect("/login");
      }
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