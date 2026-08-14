const fs = require("fs");
const path = require("path");

const SUPPORTED_SOURCES =
  new Set([
    "grafana",
    "datadog",
  ]);

function createConnectionStore({
  filePath = path.join(
    __dirname,
    "../config/connections.json",
  ),
} = {}) {
  function ensureFile() {
    if (
      fs.existsSync(
        filePath,
      )
    ) {
      return;
    }

    fs.mkdirSync(
      path.dirname(
        filePath,
      ),
      {
        recursive:
          true,
      },
    );

    fs.writeFileSync(
      filePath,
      "{}\n",
      "utf8",
    );
  }

  function loadConnections() {
    ensureFile();

    const contents =
      fs.readFileSync(
        filePath,
        "utf8",
      );

    let parsed;

    try {
      parsed =
        JSON.parse(
          contents,
        );
    } catch (error) {
      throw new Error(
        `Connections configuration is invalid JSON: ${filePath}`,
      );
    }

    if (
      !parsed
      || typeof parsed
        !== "object"
      || Array.isArray(
        parsed,
      )
    ) {
      throw new Error(
        "Connections configuration must be an object.",
      );
    }

    return parsed;
  }

  function saveConnections(
    connections,
  ) {
    fs.mkdirSync(
      path.dirname(
        filePath,
      ),
      {
        recursive:
          true,
      },
    );

    const temporaryPath =
      `${filePath}.tmp`;

    fs.writeFileSync(
      temporaryPath,
      `${
        JSON.stringify(
          connections,
          null,
          2,
        )
      }\n`,
      "utf8",
    );

    fs.renameSync(
      temporaryPath,
      filePath,
    );
  }

  function listConnections() {
    const connections =
      loadConnections();

    return Object.entries(
      connections,
    ).map(
      ([
        connectionId,
        connection,
      ]) => ({
        connectionId,
        ...connection,
      }),
    );
  }

  function getConnection(
    connectionId,
    {
      requireActive = true,
    } = {},
  ) {
    const normalizedId =
      normalizeConnectionId(
        connectionId,
      );

    const connections =
      loadConnections();

    const connection =
      connections[
        normalizedId
      ];

    if (!connection) {
      const error =
        new Error(
          `Connection "${normalizedId}" was not found.`,
        );

      error.status =
        404;

      throw error;
    }

    if (
      requireActive
      && connection.status
        !== "active"
    ) {
      const error =
        new Error(
          `Connection "${normalizedId}" is not active.`,
        );

      error.status =
        409;

      throw error;
    }

    return {
      connectionId:
        normalizedId,

      ...connection,
    };
  }

  function createConnection({
    connectionId,
    source,
    status = "active",
    metadata = {},
    outputs = {},
  }) {
    const normalizedId =
      normalizeConnectionId(
        connectionId,
      );

    const normalizedSource =
      normalizeSource(
        source,
      );

    const normalizedStatus =
      normalizeStatus(
        status,
      );

    const connections =
      loadConnections();

    if (
      connections[
        normalizedId
      ]
    ) {
      const error =
        new Error(
          `Connection "${normalizedId}" already exists.`,
        );

      error.status =
        409;

      throw error;
    }

    const now =
      new Date()
        .toISOString();

    connections[
      normalizedId
    ] = {
      source:
        normalizedSource,

      status:
        normalizedStatus,

      metadata:
        normalizeObject(
          metadata,
          "metadata",
        ),

      /*
       * Optional downstream integrations
       * belong here. The core connection
       * does not require any output.
       */
      outputs:
        normalizeObject(
          outputs,
          "outputs",
        ),

      createdAt:
        now,

      updatedAt:
        now,
    };

    saveConnections(
      connections,
    );

    return {
      connectionId:
        normalizedId,

      ...connections[
        normalizedId
      ],
    };
  }

  function updateConnection({
    connectionId,
    changes = {},
  }) {
    const normalizedId =
      normalizeConnectionId(
        connectionId,
      );

    if (
      !changes
      || typeof changes
        !== "object"
      || Array.isArray(
        changes,
      )
    ) {
      const error =
        new TypeError(
          "changes must be an object.",
        );

      error.status =
        400;

      throw error;
    }

    const connections =
      loadConnections();

    const existing =
      connections[
        normalizedId
      ];

    if (!existing) {
      const error =
        new Error(
          `Connection "${normalizedId}" was not found.`,
        );

      error.status =
        404;

      throw error;
    }

    const updated = {
      ...existing,
    };

    if (
      changes.source
      !== undefined
    ) {
      updated.source =
        normalizeSource(
          changes.source,
        );
    }

    if (
      changes.status
      !== undefined
    ) {
      updated.status =
        normalizeStatus(
          changes.status,
        );
    }

    if (
      changes.metadata
      !== undefined
    ) {
      updated.metadata =
        normalizeObject(
          changes.metadata,
          "metadata",
        );
    }

    if (
      changes.outputs
      !== undefined
    ) {
      updated.outputs =
        normalizeObject(
          changes.outputs,
          "outputs",
        );
    }

    updated.updatedAt =
      new Date()
        .toISOString();

    connections[
      normalizedId
    ] = updated;

    saveConnections(
      connections,
    );

    return {
      connectionId:
        normalizedId,

      ...updated,
    };
  }

  function deleteConnection(
    connectionId,
  ) {
    const normalizedId =
      normalizeConnectionId(
        connectionId,
      );

    const connections =
      loadConnections();

    const existing =
      connections[
        normalizedId
      ];

    if (!existing) {
      const error =
        new Error(
          `Connection "${normalizedId}" was not found.`,
        );

      error.status =
        404;

      throw error;
    }

    delete connections[
      normalizedId
    ];

    saveConnections(
      connections,
    );

    return {
      connectionId:
        normalizedId,

      ...existing,
    };
  }

  return {
    getConnection,
    listConnections,
    createConnection,
    updateConnection,
    deleteConnection,
  };
}

function normalizeConnectionId(
  value,
) {
  const normalized =
    normalizeRequiredString(
      value,
      "connectionId",
    ).toLowerCase();

  if (
    !/^[a-z0-9][a-z0-9_-]{2,63}$/
      .test(
        normalized,
      )
  ) {
    const error =
      new RangeError(
        "connectionId must contain 3–64 lowercase letters, numbers, hyphens, or underscores.",
      );

    error.status =
      400;

    throw error;
  }

  return normalized;
}

function normalizeSource(
  value,
) {
  const normalized =
    normalizeRequiredString(
      value,
      "source",
    ).toLowerCase();

  if (
    !SUPPORTED_SOURCES.has(
      normalized,
    )
  ) {
    const error =
      new RangeError(
        `Unsupported source: ${normalized}.`,
      );

    error.status =
      400;

    throw error;
  }

  return normalized;
}

function normalizeStatus(
  value,
) {
  const normalized =
    normalizeRequiredString(
      value,
      "status",
    ).toLowerCase();

  if (
    ![
      "active",
      "inactive",
    ].includes(
      normalized,
    )
  ) {
    const error =
      new RangeError(
        `Unsupported connection status: ${normalized}.`,
      );

    error.status =
      400;

    throw error;
  }

  return normalized;
}

function normalizeObject(
  value,
  field,
) {
  if (
    !value
    || typeof value
      !== "object"
    || Array.isArray(
      value,
    )
  ) {
    const error =
      new TypeError(
        `${field} must be an object.`,
      );

    error.status =
      400;

    throw error;
  }

  return {
    ...value,
  };
}

function normalizeRequiredString(
  value,
  field,
) {
  if (
    typeof value
      !== "string"
    || value.trim()
      === ""
  ) {
    const error =
      new TypeError(
        `${field} is required.`,
      );

    error.status =
      400;

    throw error;
  }

  return value.trim();
}

module.exports = {
  createConnectionStore,
};
