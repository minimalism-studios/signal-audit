function normalizeGrafanaAlert(notification, alert, connectionId) {
  const labels = alert.labels || {};
  const annotations = alert.annotations || {};

  return {
    source: "grafana",
    connectionId,
    status: alert.status || notification.status || "unknown",
    fingerprint: alert.fingerprint || null,

    title:
      annotations.summary ||
      labels.alertname ||
      notification.title ||
      "Grafana alert",

    service:
      labels.service ||
      labels.app ||
      labels.application ||
      labels.job ||
      "unknown-service",

    environment:
      labels.environment ||
      labels.env ||
      labels.namespace ||
      "unknown",

    severity:
      labels.severity ||
      labels.priority ||
      "unspecified",

    team:
      labels.team ||
      labels.owner ||
      "unspecified",

    description:
      annotations.description ||
      annotations.summary ||
      notification.message ||
      "No description provided.",

    startsAt: alert.startsAt || null,
    endsAt: alert.endsAt || null,

    values: alert.values || {},
    valueString: alert.valueString || "",

    labels,
    annotations,

    dashboardUrl: alert.dashboardURL || null,
    panelUrl: alert.panelURL || null,
    generatorUrl: alert.generatorURL || null,
  };
}

module.exports = {
  normalizeGrafanaAlert,
};
