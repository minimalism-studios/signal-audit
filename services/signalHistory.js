const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  SIGNAL_STATES,
} = require("../constants/signalStates");

function createSignalHistory({
  filePath = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(
        process.env.RAILWAY_VOLUME_MOUNT_PATH,
        "data",
        "signal-history.json",
      )
    : path.join(
        __dirname,
        "../data/signal-history.json",
      ),
} = {}) {
  function loadRecords() {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(
        path.dirname(filePath),
        {
          recursive: true,
        }
      );

      fs.writeFileSync(
        filePath,
        "[]\n",
        "utf8"
      );
    }

    const contents = fs.readFileSync(
      filePath,
      "utf8"
    );

    try {
      return JSON.parse(contents);
    } catch (error) {
      throw new Error(
        `Signal history file is invalid JSON: ${filePath}`
      );
    }
  }

  function saveRecords(records) {
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(records, null, 2)}\n`,
      "utf8"
    );
  }

  function createId() {
    return `sig_${crypto.randomUUID()}`;
  }

  function saveSignal(signal) {
    const records = loadRecords();

    const record = {
      id: createId(),
      state: SIGNAL_STATES.RECEIVED,
      receivedAt: new Date().toISOString(),
      connectionId: signal.connectionId || null,
      source: signal.source || null,
      service: signal.service || null,
      status: signal.status || null,
      severity: signal.severity || null,
      fingerprint: signal.fingerprint || null,
      signal,
      analysis: null,
      delivery: null,
      failureReason: null,
      operationalState: "active",
      resolvedAt: null,
    };

    records.push(record);
    saveRecords(records);

    return record;
  }

  function getSignal(id) {
    const records = loadRecords();

    return (
      records.find((record) => record.id === id) ||
      null
    );
  }

  function resolveSignal(
    id,
    {
      resolvedAt =
        new Date().toISOString(),
    } = {},
  ) {
    const records =
      loadRecords();

    const record =
      records.find(
        (item) =>
          item.id === id,
      );

    if (!record) {
      return null;
    }

    record.operationalState =
      "resolved";

    record.resolvedAt =
      resolvedAt;

    saveRecords(records);

    return record;
  }

  function updateSignal(id, patch) {
    const records = loadRecords();

    const record = records.find(
      (item) => item.id === id
    );

    if (!record) {
      throw new Error(
        `Signal history record "${id}" was not found.`
      );
    }

    Object.assign(record, patch);

    saveRecords(records);

    return record;
  }

  function normalizeSearchValue(value) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized =
      value.trim().toLowerCase();

    return normalized === ""
      || normalized === "all"
        ? null
        : normalized;
  }

  function parsePositiveInteger(
    value,
    fallback,
    maximum = null,
  ) {
    const parsed =
      Number.parseInt(value, 10);

    if (
      !Number.isInteger(parsed)
      || parsed < 1
    ) {
      return fallback;
    }

    return maximum
      ? Math.min(parsed, maximum)
      : parsed;
  }

  function parseDateBoundary(
    value,
    boundary,
  ) {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (
      Number.isNaN(date.getTime())
    ) {
      return null;
    }

    if (
      typeof value === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(
        value,
      )
    ) {
      if (boundary === "start") {
        date.setUTCHours(
          0,
          0,
          0,
          0,
        );
      }

      if (boundary === "end") {
        date.setUTCHours(
          23,
          59,
          59,
          999,
        );
      }
    }

    return date;
  }

  function createSearchText(record) {
    const signal =
      record.signal || {};

    const analysis =
      record.analysis
      && typeof record.analysis === "object"
        ? record.analysis
        : {};

    const findings =
      Array.isArray(analysis.findings)
        ? analysis.findings
        : [];

    const findingText =
      findings
        .flatMap((finding) => [
          finding.title,
          finding.category,
          finding.executiveSummary,
          finding.technicalAnalysis,
          finding.businessImpact,
          finding.recommendedOwner,
          ...(finding.evidence || []),
          ...(finding.affectedServices || []),
          ...(finding.actions?.immediate || []),
          ...(finding.actions?.shortTerm || []),
          ...(finding.actions?.longTerm || []),
        ])
        .filter(Boolean)
        .join(" ");

    return [
      record.id,
      record.connectionId,
      record.source,
      record.service,
      record.status,
      record.severity,
      record.state,
      record.operationalState,
      record.fingerprint,
      signal.title,
      signal.environment,
      signal.team,
      signal.metric,
      signal.hostname,
      signal.scope,
      signal.monitorId,
      signal.monitorType,
      analysis.summary,
      findingText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function searchSignals({
    query = null,
    source = null,
    service = null,
    severity = null,
    state = null,
    status = null,
    operationalState = null,
    startDate = null,
    endDate = null,
    page = 1,
    pageSize = 50,
  } = {}) {
    const records =
      loadRecords()
        .slice()
        .reverse();

    const normalizedQuery =
      normalizeSearchValue(query);

    const normalizedSource =
      normalizeSearchValue(source);

    const normalizedService =
      normalizeSearchValue(service);

    const normalizedSeverity =
      normalizeSearchValue(severity);

    const normalizedState =
      normalizeSearchValue(state);

    const normalizedStatus =
      normalizeSearchValue(status);

    const normalizedOperationalState =
      normalizeSearchValue(
        operationalState,
      );

    const resolvedPage =
      parsePositiveInteger(
        page,
        1,
      );

    const resolvedPageSize =
      parsePositiveInteger(
        pageSize,
        50,
        200,
      );

    const resolvedStartDate =
      parseDateBoundary(
        startDate,
        "start",
      );

    const resolvedEndDate =
      parseDateBoundary(
        endDate,
        "end",
      );

    const filtered =
      records.filter((record) => {
        if (
          normalizedSource
          && record.source?.toLowerCase()
            !== normalizedSource
        ) {
          return false;
        }

        if (
          normalizedService
          && record.service?.toLowerCase()
            !== normalizedService
        ) {
          return false;
        }

        if (
          normalizedSeverity
          && record.severity?.toLowerCase()
            !== normalizedSeverity
        ) {
          return false;
        }

        if (
          normalizedState
          && record.state?.toLowerCase()
            !== normalizedState
        ) {
          return false;
        }

        if (
          normalizedStatus
          && record.status?.toLowerCase()
            !== normalizedStatus
        ) {
          return false;
        }

        if (
          normalizedOperationalState
          && (
            record.operationalState
            || "active"
          ).toLowerCase()
            !== normalizedOperationalState
        ) {
          return false;
        }

        const receivedAt =
          record.receivedAt
            ? new Date(
                record.receivedAt,
              )
            : null;

        if (
          resolvedStartDate
          && (
            !receivedAt
            || Number.isNaN(
              receivedAt.getTime(),
            )
            || receivedAt
              < resolvedStartDate
          )
        ) {
          return false;
        }

        if (
          resolvedEndDate
          && (
            !receivedAt
            || Number.isNaN(
              receivedAt.getTime(),
            )
            || receivedAt
              > resolvedEndDate
          )
        ) {
          return false;
        }

        if (
          normalizedQuery
          && !createSearchText(
            record,
          ).includes(
            normalizedQuery,
          )
        ) {
          return false;
        }

        return true;
      });

    const total =
      filtered.length;

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total
            / resolvedPageSize,
          );

    const safePage =
      totalPages === 0
        ? 1
        : Math.min(
            resolvedPage,
            totalPages,
          );

    const offset =
      (
        safePage - 1
      ) * resolvedPageSize;

    const signals =
      filtered.slice(
        offset,
        offset + resolvedPageSize,
      );

    return {
      signals,
      pagination: {
        page: safePage,
        pageSize: resolvedPageSize,
        total,
        totalPages,
        hasPreviousPage:
          safePage > 1,
        hasNextPage:
          safePage < totalPages,
      },
    };
  }

  function listSignals({
    limit = 50,
  } = {}) {
    return searchSignals({
      page: 1,
      pageSize: limit,
    }).signals;
  }

  function listAllSignals() {
    return loadRecords()
      .slice()
      .reverse();
  }

  function getAvailableFilters() {
    const records =
      loadRecords();

    const collect = (field) =>
      [
        ...new Set(
          records
            .map(
              (record) =>
                record[field],
            )
            .filter(Boolean)
            .sort(),
        ),
      ];

    return {
      sources:
        collect("source"),

      severities:
        collect("severity"),

      states:
        collect("state"),

      services:
        collect("service"),

      statuses:
        collect("status"),
    };
  }

  return {
    saveSignal,
    getSignal,
    resolveSignal,
    updateSignal,
    listSignals,
    listAllSignals,
    searchSignals,
    getAvailableFilters,
  };
}

module.exports = {
  createSignalHistory,
};
