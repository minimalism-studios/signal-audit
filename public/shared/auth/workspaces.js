(function initializeWorkspaceAuthorization(
  global,
) {
  "use strict";

  const WORKSPACE_ORDER =
    Object.freeze([
      "dashboard",
      "live-signals",
      "investigations",
      "history",
      "integrations",
      "environments",
      "settings",
    ]);

  const WORKSPACE_POLICIES =
    Object.freeze({
      dashboard: Object.freeze({
        anyPermissions: Object.freeze([
          "signals:read",
          "investigations:read",
          "memory:read",
        ]),
      }),

      "live-signals": Object.freeze({
        permission:
          "signals:read",
      }),

      investigations: Object.freeze({
        permission:
          "investigations:read",
      }),

      history: Object.freeze({
        permission:
          "memory:read",
      }),

      integrations: Object.freeze({
        permission:
          "integrations:read",
      }),

      environments: Object.freeze({
        permission:
          "environments:read",
      }),

      settings: Object.freeze({
        role:
          "administrator",
      }),
    });

  const ROLE_DEFAULTS =
    Object.freeze({
      administrator:
        "dashboard",

      operator:
        "live-signals",

      executive:
        "dashboard",

      viewer:
        "live-signals",
    });

  const DEFAULT_WORKSPACE_KEY =
    "signal-audit-default-workspace";

  function getPermissionService() {
    const permissions =
      global
        .SignalAuditPermissions;

    if (!permissions) {
      throw new Error(
        "Signal Audit Permission Helpers are unavailable.",
      );
    }

    return permissions;
  }

  function normalizeWorkspace(
    workspace,
  ) {
    if (
      typeof workspace
        !== "string"
    ) {
      return "";
    }

    return workspace
      .trim()
      .toLowerCase()
      .replace(
        /^#\/?/,
        "",
      );
  }

  function isKnownWorkspace(
    workspace,
  ) {
    const normalizedWorkspace =
      normalizeWorkspace(
        workspace,
      );

    return Object.prototype
      .hasOwnProperty
      .call(
        WORKSPACE_POLICIES,
        normalizedWorkspace,
      );
  }

  function canAccessWorkspace(
    workspace,
  ) {
    const normalizedWorkspace =
      normalizeWorkspace(
        workspace,
      );

    const policy =
      WORKSPACE_POLICIES[
        normalizedWorkspace
      ];

    if (!policy) {
      return false;
    }

    const permissions =
      getPermissionService();

    if (policy.role) {
      return permissions
        .hasRole(
          policy.role,
        );
    }

    if (policy.permission) {
      return permissions
        .hasPermission(
          policy.permission,
        );
    }

    if (
      Array.isArray(
        policy.anyPermissions,
      )
    ) {
      return permissions
        .hasAnyPermission(
          policy.anyPermissions,
        );
    }

    if (
      Array.isArray(
        policy.allPermissions,
      )
    ) {
      return permissions
        .hasAllPermissions(
          policy.allPermissions,
        );
    }

    return false;
  }

  function getVisibleWorkspaces() {
    return WORKSPACE_ORDER
      .filter(
        canAccessWorkspace,
      );
  }

  function getRoleDefaultWorkspace() {
    const role =
      getPermissionService()
        .getRole();

    const preferredDefault =
      ROLE_DEFAULTS[
        role
      ]
      || "live-signals";

    if (
      canAccessWorkspace(
        preferredDefault,
      )
    ) {
      return preferredDefault;
    }

    return (
      getVisibleWorkspaces()[0]
      || null
    );
  }

  function getStoredDefaultWorkspace() {
    try {
      return normalizeWorkspace(
        global.localStorage
          .getItem(
            DEFAULT_WORKSPACE_KEY,
          ),
      );
    } catch (_error) {
      return "";
    }
  }

  function getDefaultWorkspace({
    includeStoredPreference = true,
  } = {}) {
    if (includeStoredPreference) {
      const storedWorkspace =
        getStoredDefaultWorkspace();

      if (
        storedWorkspace
        && canAccessWorkspace(
          storedWorkspace,
        )
      ) {
        return storedWorkspace;
      }
    }

    return getRoleDefaultWorkspace();
  }

  function resolveWorkspace(
    requestedWorkspace,
    {
      includeStoredPreference = true,
    } = {},
  ) {
    const normalizedWorkspace =
      normalizeWorkspace(
        requestedWorkspace,
      );

    if (
      normalizedWorkspace
      && canAccessWorkspace(
        normalizedWorkspace,
      )
    ) {
      return normalizedWorkspace;
    }

    return getDefaultWorkspace({
      includeStoredPreference,
    });
  }

  function getPolicy(
    workspace,
  ) {
    const normalizedWorkspace =
      normalizeWorkspace(
        workspace,
      );

    const policy =
      WORKSPACE_POLICIES[
        normalizedWorkspace
      ];

    if (!policy) {
      return null;
    }

    return {
      ...policy,

      anyPermissions:
        Array.isArray(
          policy.anyPermissions,
        )
          ? [
              ...policy
                .anyPermissions,
            ]
          : undefined,

      allPermissions:
        Array.isArray(
          policy.allPermissions,
        )
          ? [
              ...policy
                .allPermissions,
            ]
          : undefined,
    };
  }

  global.SignalAuditWorkspaces =
    Object.freeze({
      canAccessWorkspace,
      getDefaultWorkspace,
      getRoleDefaultWorkspace,
      getStoredDefaultWorkspace,
      getVisibleWorkspaces,
      resolveWorkspace,
      isKnownWorkspace,
      getPolicy,
    });
})(
  window,
);
