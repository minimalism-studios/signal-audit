const fs = require("fs");

const path = require("path");

const DEFAULT_FILE_PATH =
  process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(
        process.env.RAILWAY_VOLUME_MOUNT_PATH,
        "data",
        "operational-memory.json",
      )
    : path.join(
        __dirname,
        "../data/operational-memory.json",
      );

function createOperationalMemoryStore({
  filePath = DEFAULT_FILE_PATH,
} = {}) {
  function listDocuments({
    type = null,
    service = null,
  } = {}) {
    const normalizedType =
      normalizeOptionalString(
        type,
      )?.toLowerCase()
      ?? null;

    const normalizedService =
      normalizeOptionalString(
        service,
      )?.toLowerCase()
      ?? null;

    return loadDocuments()
      .filter(
        (document) =>
          (
            !normalizedType
            || document.type
              === normalizedType
          )
          && (
            !normalizedService
            || document.service
              ?.toLowerCase()
              === normalizedService
          ),
      )
      .sort(
        (left, right) =>
          Date.parse(
            right.updatedAt,
          )
          - Date.parse(
            left.updatedAt,
          ),
      );
  }

  function getDocument(
    documentId,
  ) {
    const normalizedId =
      requireString(
        documentId,
        "documentId",
      );

    return (
      loadDocuments()
        .find(
          (document) =>
            document.id
            === normalizedId,
        )
      ?? null
    );
  }

  function upsertInvestigation(
    investigation,
  ) {
    assertPlainObject(
      investigation,
      "investigation",
    );

    const investigationId =
      requireString(
        investigation.id,
        "investigation.id",
      );

    const documents =
      loadDocuments();

    const existingIndex =
      documents.findIndex(
        (document) =>
          document.investigationId
          === investigationId,
      );

    const now =
      new Date().toISOString();

    const document =
      createInvestigationDocument({
        investigation,
        existing:
          existingIndex >= 0
            ? documents[
                existingIndex
              ]
            : null,
        now,
      });

    if (
      existingIndex >= 0
    ) {
      documents[
        existingIndex
      ] = document;
    } else {
      documents.unshift(
        document,
      );
    }

    saveDocuments(
      documents,
    );

    return document;
  }

  function upsertInvestigations(
    investigations,
  ) {
    if (
      !Array.isArray(
        investigations,
      )
    ) {
      throw new TypeError(
        "investigations must be an array.",
      );
    }

    return investigations
      .filter(
        (investigation) =>
          investigation
          && typeof investigation
            === "object",
      )
      .map(
        upsertInvestigation,
      );
  }

  function loadDocuments() {
    ensureFile();

    const contents =
      fs.readFileSync(
        filePath,
        "utf8",
      );

    try {
      const documents =
        JSON.parse(
          contents,
        );

      if (
        !Array.isArray(
          documents,
        )
      ) {
        throw new TypeError(
          "Operational Memory data must be an array.",
        );
      }

      return documents;
    } catch (error) {
      throw new Error(
        `Unable to load Operational Memory: ${error.message}`,
      );
    }
  }

  function saveDocuments(
    documents,
  ) {
    fs.mkdirSync(
      path.dirname(
        filePath,
      ),
      {
        recursive: true,
      },
    );

    const temporaryPath =
      `${filePath}.tmp`;

    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(
        documents,
        null,
        2,
      )}\n`,
      "utf8",
    );

    fs.renameSync(
      temporaryPath,
      filePath,
    );
  }

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
        recursive: true,
      },
    );

    fs.writeFileSync(
      filePath,
      "[]\n",
      "utf8",
    );
  }

  return {
    listDocuments,
    getDocument,
    upsertInvestigation,
    upsertInvestigations,
  };
}

function deriveMemoryState(
  investigation,
) {
  const status =
    normalizeOptionalString(
      investigation.status,
    )?.toLowerCase()
    ?? "investigating";

  if (status === "archived") {
    return "archived";
  }

  if (status === "resolved") {
    return "finalized";
  }

  return "provisional";
}

function createInvestigationDocument({
  investigation,
  existing,
  now,
}) {
  const resolution =
    investigation.resolution
    ?? {};

  const evidence =
    investigation.evidence
    ?? {};

  const memoryState =
    deriveMemoryState(
      investigation,
    );

  const resolvedAt =
    normalizeOptionalString(
      resolution.resolvedAt,
    );

  const finalizedAt =
    memoryState === "finalized"
    || memoryState === "archived"
      ? (
          existing?.finalizedAt
          ?? resolvedAt
          ?? now
        )
      : null;

  const archivedAt =
    memoryState === "archived"
      ? (
          existing?.archivedAt
          ?? now
        )
      : null;

  return {
    id:
      existing?.id
      ?? `memory_${investigation.id}`,

    type:
      "investigation",

    investigationId:
      investigation.id,

    title:
      normalizeOptionalString(
        investigation.title,
      )
      || "Untitled Investigation",

    status:
      normalizeOptionalString(
        investigation.status,
      )
      || "investigating",

    severity:
      normalizeOptionalString(
        investigation.severity,
      ),

    source:
      normalizeOptionalString(
        investigation.source,
      ),

    service:
      normalizeOptionalString(
        investigation.service,
      ),

    environment:
      normalizeOptionalString(
        investigation.environment,
      ),

    owner:
      normalizeOptionalString(
        investigation.owner,
      ),

    summary:
      normalizeOptionalString(
        resolution.summary,
      )
      || normalizeOptionalString(
        investigation.summary,
      )
      || "",

    rootCause:
      normalizeOptionalString(
        resolution.rootCause,
      )
      || "",

    lessonsLearned:
      normalizeStringArray(
        resolution.lessonsLearned,
      ),

    correctiveActions:
      normalizeStringArray(
        resolution
          .correctiveActions,
      ),

    preventiveActions:
      normalizeStringArray(
        resolution
          .preventiveActions,
      ),

    resolvedBy:
      normalizeOptionalString(
        resolution.resolvedBy,
      )
      || "",

    supportingSignals:
      normalizeStringArray(
        evidence.signals,
      ),

    supportingFindings:
      normalizeStringArray(
        investigation.findings
          ?.map(
            (finding) =>
              finding?.id,
          ),
      ),

    timeline:
      Array.isArray(
        investigation.timeline,
      )
        ? investigation.timeline
        : [],

    investigationCreatedAt:
      normalizeOptionalString(
        investigation.createdAt,
      ),

    memoryState,

    resolvedAt,

    finalizedAt,

    archivedAt,

    updatedAt:
      now,

    tags:
      normalizeStringArray([
        investigation.service,
        investigation.environment,
        investigation.severity,
        investigation.source,
      ]),
  };
}

function normalizeStringArray(
  value,
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(
          normalizeOptionalString,
        )
        .filter(Boolean),
    ),
  ];
}

function requireString(
  value,
  fieldName,
) {
  const normalized =
    normalizeOptionalString(
      value,
    );

  if (!normalized) {
    throw new TypeError(
      `${fieldName} must be a non-empty string.`,
    );
  }

  return normalized;
}

function normalizeOptionalString(
  value,
) {
  if (
    typeof value
    !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

function assertPlainObject(
  value,
  fieldName,
) {
  if (
    !value
    || typeof value
      !== "object"
    || Array.isArray(value)
  ) {
    throw new TypeError(
      `${fieldName} must be an object.`,
    );
  }
}

module.exports = {
  createOperationalMemoryStore,
};
