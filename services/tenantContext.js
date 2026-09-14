const path = require("path");

const TENANTS = Object.freeze({
  minimalism: Object.freeze({
    id: "minimalism",
    hosts: Object.freeze([
      "app.signal-audit.com",
      "localhost",
      "127.0.0.1",
    ]),
  }),

  oasse: Object.freeze({
    id: "oasse",
    hosts: Object.freeze([
      "gatekeeper.signal-audit.com",
    ]),
  }),
});


function normalizeHostname(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function resolveTenantIdFromHostname(
  hostname,
) {
  const normalizedHostname =
    normalizeHostname(hostname);

  for (
    const tenant
    of Object.values(TENANTS)
  ) {
    if (
      tenant.hosts.includes(
        normalizedHostname,
      )
    ) {
      return tenant.id;
    }
  }
  return null;
}

function getTenantRuntimePaths(
  tenantId,
) {
  const normalizedTenantId =
    requireTenantId(tenantId);

  const runtimeRoot =
    process.env
      .RAILWAY_VOLUME_MOUNT_PATH
      || path.join(
        __dirname,
        "..",
        "runtime",
      );

  const tenantRoot =
    path.join(
      runtimeRoot,
      "tenants",
      normalizedTenantId,
    );

  return Object.freeze({
    root:
      tenantRoot,

    signalHistory:
      path.join(
        tenantRoot,
        "data",
        "signal-history.json",
      ),

    investigations:
      path.join(
        tenantRoot,
        "data",
        "investigations.json",
      ),

    operationalMemory:
      path.join(
        tenantRoot,
        "data",
        "operational-memory.json",
      ),

    users: path.join(tenantRoot, "data", "users.json"),
    connections:
      path.join(
        tenantRoot,
        "config",
        "connections.json",
      ),
  });
}

function requireTenantId(value) {
  if (
    typeof value !== "string"
    || value.trim() === ""
  ) {
    throw new TypeError(
      "tenantId is required.",
    );
  }

  const normalized =
    value.trim().toLowerCase();

  if (!TENANTS[normalized]) {
    throw new Error(
      `Unknown tenant: ${normalized}`,
    );
  }

  return normalized;
}

module.exports = {
  TENANTS,
  normalizeHostname,
  resolveTenantIdFromHostname,
  getTenantRuntimePaths,
};
