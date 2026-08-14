const ROLE_PERMISSIONS = Object.freeze({
  administrator: Object.freeze([
    "*",
  ]),

  operator: Object.freeze([
    "signals:read",
    "investigations:read",
    "investigations:write",
    "memory:read",
    "integrations:read",
    "environments:read",
  ]),

  executive: Object.freeze([
    "signals:read",
    "investigations:read",
    "memory:read",
    "environments:read",
    "executive:read",
  ]),

  viewer: Object.freeze([
    "signals:read",
    "investigations:read",
    "memory:read",
    "integrations:read",
    "environments:read",
  ]),
});

function createAuthorizationService({
  rolePermissions =
    ROLE_PERMISSIONS,
} = {}) {
  function getPermissions(
    userOrRole,
  ) {
    const role =
      typeof userOrRole === "string"
        ? userOrRole
        : userOrRole?.role;

    if (
      typeof role !== "string"
      || !role.trim()
    ) {
      return [];
    }

    const permissions =
      rolePermissions[
        role.trim().toLowerCase()
      ];

    return Array.isArray(
      permissions,
    )
      ? [...permissions]
      : [];
  }

  function hasPermission(
    userOrRole,
    permission,
  ) {
    if (
      typeof permission !== "string"
      || !permission.trim()
    ) {
      return false;
    }

    const normalizedPermission =
      permission
        .trim()
        .toLowerCase();

    const permissions =
      getPermissions(
        userOrRole,
      );

    if (
      permissions.includes("*")
      || permissions.includes(
        normalizedPermission,
      )
    ) {
      return true;
    }

    const [
      namespace,
    ] =
      normalizedPermission
        .split(":");

    return permissions.includes(
      `${namespace}:*`,
    );
  }

  function assertPermission(
    userOrRole,
    permission,
  ) {
    if (
      hasPermission(
        userOrRole,
        permission,
      )
    ) {
      return;
    }

    const error =
      new Error(
        "You do not have permission to perform this action.",
      );

    error.status = 403;
    error.code =
      "FORBIDDEN";

    throw error;
  }

  return {
    getPermissions,
    hasPermission,
    assertPermission,
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  createAuthorizationService,
};
