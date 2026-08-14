(function initializePermissionHelpers(
  global,
) {
  "use strict";

  function getSessionService() {
    const session =
      global.SignalAuditSession;

    if (!session) {
      throw new Error(
        "Signal Audit Session Service is unavailable.",
      );
    }

    return session;
  }

  function normalizeValue(
    value,
  ) {
    return typeof value === "string"
      ? value.trim().toLowerCase()
      : "";
  }

  function getUser() {
    return (
      getSessionService()
        .getUser()
      ?? null
    );
  }

  function getRole() {
    return normalizeValue(
      getSessionService()
        .getRole(),
    );
  }

  function getPermissions() {
    return getSessionService()
      .getPermissions()
      .map(
        normalizeValue,
      )
      .filter(Boolean);
  }

  function hasPermission(
    permission,
  ) {
    const normalizedPermission =
      normalizeValue(
        permission,
      );

    if (!normalizedPermission) {
      return false;
    }

    const permissions =
      getPermissions();

    if (
      permissions.includes("*")
      || permissions.includes(
        normalizedPermission,
      )
    ) {
      return true;
    }

    const namespace =
      normalizedPermission
        .split(":")[0];

    if (!namespace) {
      return false;
    }

    return permissions.includes(
      `${namespace}:*`,
    );
  }

  function hasAnyPermission(
    permissions,
  ) {
    if (
      !Array.isArray(
        permissions,
      )
    ) {
      return false;
    }

    return permissions.some(
      hasPermission,
    );
  }

  function hasAllPermissions(
    permissions,
  ) {
    if (
      !Array.isArray(
        permissions,
      )
    ) {
      return false;
    }

    return permissions.every(
      hasPermission,
    );
  }

  function hasRole(
    role,
  ) {
    const normalizedRole =
      normalizeValue(
        role,
      );

    if (!normalizedRole) {
      return false;
    }

    return (
      getRole()
      === normalizedRole
    );
  }

  function isAdministrator() {
    return hasRole(
      "administrator",
    );
  }

  function isOperator() {
    return hasRole(
      "operator",
    );
  }

  function isExecutive() {
    return hasRole(
      "executive",
    );
  }

  function isViewer() {
    return hasRole(
      "viewer",
    );
  }

  global.SignalAuditPermissions =
    Object.freeze({
      getUser,
      getRole,
      getPermissions,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasRole,
      isAdministrator,
      isOperator,
      isExecutive,
      isViewer,
    });
})(
  window,
);
