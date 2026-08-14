function firstDefined(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function normalizeTags(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }

  if (
    rawTags &&
    typeof rawTags === "object"
  ) {
    return Object.entries(rawTags).map(
      ([key, value]) => `${key}:${value}`
    );
  }

  if (typeof rawTags === "string") {
    return rawTags
      .split(/[,\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function getTagValue(tags, keys) {
  for (const key of keys) {
    const prefix = `${key}:`;

    const match = tags.find((tag) =>
      tag.toLowerCase().startsWith(
        prefix.toLowerCase()
      )
    );

    if (match) {
      return match.slice(prefix.length);
    }
  }

  return undefined;
}

function normalizeStatus(status) {
  const normalized = String(
    status || "unknown"
  ).toLowerCase();

  if (
    normalized === "ok" ||
    normalized === "resolved" ||
    normalized === "recovered"
  ) {
    return "resolved";
  }

  if (
    normalized === "alert" ||
    normalized === "warning" ||
    normalized === "warn" ||
    normalized === "no data" ||
    normalized === "no_data"
  ) {
    return "firing";
  }

  return normalized;
}

function normalizeDatadogAlert(
  payload,
  connectionId
) {
  const tags = normalizeTags(
    firstDefined(
      payload.tags,
      payload.TAGS
    )
  );

  const monitorId = firstDefined(
    payload.monitorId,
    payload.monitor_id,
    payload.MONITOR_ID,
    payload.ALERT_ID,
    payload.ID
  );

  const alertCycleKey = firstDefined(
    payload.alertCycleKey,
    payload.alert_cycle_key,
    payload.ALERT_CYCLE_KEY
  );

  const service = firstDefined(
    payload.service,
    payload.SERVICE,
    getTagValue(tags, [
      "service",
      "app",
      "application",
    ]),
    "unknown-service"
  );

  const environment = firstDefined(
    payload.environment,
    payload.env,
    payload.ENVIRONMENT,
    getTagValue(tags, [
      "environment",
      "env",
      "stage",
    ]),
    "unknown"
  );

  const severity = firstDefined(
    payload.severity,
    payload.priority,
    payload.PRIORITY,
    getTagValue(tags, [
      "severity",
      "priority",
    ]),
    "unspecified"
  );

  const team = firstDefined(
    payload.team,
    payload.owner,
    getTagValue(tags, [
      "team",
      "owner",
    ]),
    "unspecified"
  );

  return {
    source: "datadog",
    connectionId,

    status: normalizeStatus(
      firstDefined(
        payload.status,
        payload.alertStatus,
        payload.alert_status,
        payload.ALERT_STATUS,
        payload.ALERT_TRANSITION
      )
    ),

    fingerprint:
      firstDefined(
        payload.fingerprint,
        alertCycleKey,
        monitorId
      ) || null,

    monitorId:
      monitorId !== undefined
        ? String(monitorId)
        : null,

    alertCycleKey:
      alertCycleKey || null,

    title: firstDefined(
      payload.title,
      payload.alertTitle,
      payload.alert_title,
      payload.ALERT_TITLE,
      payload.EVENT_TITLE,
      "Datadog alert"
    ),

    service,
    environment,
    severity,
    team,

    description: firstDefined(
      payload.description,
      payload.message,
      payload.text,
      payload.TEXT_ONLY_MSG,
      payload.EVENT_MSG,
      "No description provided."
    ),

    monitorType:
      firstDefined(
        payload.monitorType,
        payload.monitor_type,
        payload.ALERT_TYPE,
        payload.EVENT_TYPE
      ) || null,

    metric:
      firstDefined(
        payload.metric,
        payload.metricName,
        payload.metric_name,
        payload.ALERT_METRIC,
        payload.METRIC_NAMESPACE
      ) || null,

    value: firstDefined(
      payload.value,
      payload.alertValue,
      payload.alert_value,
      payload.ALERT_VALUE
    ),

    threshold: firstDefined(
      payload.threshold,
      payload.alertThreshold,
      payload.alert_threshold,
      payload.ALERT_THRESHOLD
    ),

    hostname:
      firstDefined(
        payload.hostname,
        payload.host,
        payload.HOSTNAME
      ) || null,

    scope:
      firstDefined(
        payload.scope,
        payload.alertScope,
        payload.alert_scope,
        payload.ALERT_SCOPE
      ) || null,

    query:
      firstDefined(
        payload.query,
        payload.alertQuery,
        payload.alert_query,
        payload.ALERT_QUERY
      ) || null,

    startsAt:
      firstDefined(
        payload.startsAt,
        payload.startedAt,
        payload.date,
        payload.DATE
      ) || null,

    updatedAt:
      firstDefined(
        payload.updatedAt,
        payload.lastUpdated,
        payload.LAST_UPDATED
      ) || null,

    tags,

    alertUrl:
      firstDefined(
        payload.alertUrl,
        payload.url,
        payload.link,
        payload.LINK
      ) || null,

    rawPayload: payload,
  };
}

module.exports = {
  normalizeDatadogAlert,
};
