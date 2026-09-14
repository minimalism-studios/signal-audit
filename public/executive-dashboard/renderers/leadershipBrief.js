import {
  escapeHtml,
  formatDate,
  formatLabel,
} from "../utils/formatting.js";

import {
  getSupportingFindingCount,
  renderActionCard,
  renderEmptyCard,
  renderRiskCard,
  renderWatchItem,
  renderWinItem,
} from "../utils/rendering.js";

function normalizeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function normalizeStatus(value) {
  return String(
    value ?? "unknown",
  )
    .trim()
    .toLowerCase();
}

function getMetricValue(
  value,
  fallback = "—",
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return fallback;
  }

  return String(value);
}

function getConfidencePercentage(
  confidence,
) {
  const candidates = [
    confidence?.percentage,
    confidence?.score,
    confidence?.value,
  ];

  const value = candidates.find(
    (candidate) =>
      typeof candidate === "number"
      && Number.isFinite(candidate),
  );

  if (value === undefined) {
    return null;
  }

  const normalizedValue =
    value <= 1
      ? value * 100
      : value;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(normalizedValue),
    ),
  );
}

function getEvidenceCoverage(
  brief,
) {
  const candidates = [
    brief.evidenceCoverage,
    brief.evidence?.coverage,
    brief.confidence?.coverage,
  ];

  const value = candidates.find(
    (candidate) =>
      typeof candidate === "number"
      && Number.isFinite(candidate),
  );

  if (value === undefined) {
    return null;
  }

  const normalizedValue =
    value <= 1
      ? value * 100
      : value;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(normalizedValue),
    ),
  );
}

function getAffectedServiceCount(
  brief,
  risks,
  watchItems,
) {
  const directCount =
    brief.servicesImpacted
    ?? brief.affectedServicesCount
    ?? brief.operationalHealth
      ?.servicesImpacted;

  if (
    typeof directCount === "number"
    && Number.isFinite(directCount)
  ) {
    return directCount;
  }

  const services = new Set();

  [
    ...risks,
    ...watchItems,
  ].forEach((item) => {
    const candidateValues = [
      item?.service,
      item?.serviceName,
      item?.recommendedOwner,
      item?.owner,
    ];

    candidateValues
      .filter(Boolean)
      .forEach((value) => {
        services.add(
          String(value)
            .trim()
            .toLowerCase(),
        );
      });
  });

  return services.size > 0
    ? services.size
    : null;
}

function getTelemetrySourceCount(
  brief,
) {
  const directCount =
    brief.telemetrySourceCount
    ?? brief.evidence
      ?.telemetrySourceCount
    ?? brief.dataSourceCount;

  if (
    typeof directCount === "number"
    && Number.isFinite(directCount)
  ) {
    return directCount;
  }

  const sources =
    normalizeArray(
      brief.dataSources
      ?? brief.evidence?.dataSources,
    );

  return sources.length > 0
    ? sources.length
    : null;
}

function getIncidentCount(
  brief,
) {
  const value =
    brief.productionIncidentCount
    ?? brief.incidentCount
    ?? brief.evidence
      ?.productionIncidentCount;

  return (
    typeof value === "number"
    && Number.isFinite(value)
  )
    ? value
    : null;
}

function renderMetadataItem(
  label,
  value,
) {
  return `
    <div class="brief-metadata__item">
      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value)}
      </strong>
    </div>
  `;
}

function renderPositionMetric({
  label,
  value,
  detail = "",
  modifier = "",
  prominence = "",
}) {
  const modifierClass =
    modifier
      ? ` executive-position-metric--${escapeHtml(
          modifier,
        )}`
      : "";

  const prominenceClass =
    prominence
      ? ` executive-position-metric--${escapeHtml(
          prominence,
        )}`
      : "";

  return `
    <article
      class="
        executive-position-metric
        ${modifierClass}
        ${prominenceClass}
      "
    >
      <p class="executive-position-metric__label">
        ${escapeHtml(label)}
      </p>

      <p class="executive-position-metric__value">
        ${escapeHtml(value)}
      </p>

      ${
        detail
          ? `
            <p class="executive-position-metric__detail">
              ${escapeHtml(detail)}
            </p>
          `
          : ""
      }
    </article>
  `;
}

function renderEvidenceMetric(
  label,
  value,
) {
  return `
    <div class="evidence-metric">
      <span class="evidence-metric__value">
        ${escapeHtml(value)}
      </span>

      <span class="evidence-metric__label">
        ${escapeHtml(label)}
      </span>
    </div>
  `;
}

export function renderLeadershipBrief(
  brief,
  {
    leadershipBriefWorkspace,
    secondaryWorkspace,
    workspaceDefinitions,
    activeWorkspace,
    reportingDays,
  },
) {
  const definition =
    workspaceDefinitions[
      activeWorkspace
    ];

  leadershipBriefWorkspace.hidden =
    false;

  secondaryWorkspace.hidden =
    true;

  const risks =
    normalizeArray(
      brief.topOperationalRisks,
    );

  const wins =
    normalizeArray(
      brief.keyWins,
    );

  const watchItems =
    normalizeArray(
      brief.watchItems,
    );

  const actions =
    normalizeArray(
      brief.recommendedActions,
    );

  const healthStatus =
    normalizeStatus(
      brief.operationalHealth
        ?.status,
    );

  const confidenceLevel =
    normalizeStatus(
      brief.confidence?.level,
    );

  const confidencePercentage =
    getConfidencePercentage(
      brief.confidence,
    );

  const evidenceCoverage =
    getEvidenceCoverage(brief);

  const supportingFindingCount =
    getSupportingFindingCount(
      brief,
    );

  const affectedServiceCount =
    getAffectedServiceCount(
      brief,
      risks,
      watchItems,
    );

  const telemetrySourceCount =
    getTelemetrySourceCount(
      brief,
    );

  const productionIncidentCount =
    getIncidentCount(brief);

  const reportingStart =
    formatDate(
      brief.reportingPeriod?.start,
    );

  const reportingEnd =
    formatDate(
      brief.reportingPeriod?.end,
    );

  const reportingWindow =
    reportingStart
    && reportingEnd
      ? `${reportingStart} – ${reportingEnd}`
      : `Last ${reportingDays} days`;

  const generatedAt =
    brief.generatedAt
    || brief.createdAt
      ? formatDate(
          brief.generatedAt
          ?? brief.createdAt,
        )
      : "Current brief";

  const dataSources =
    normalizeArray(
      brief.dataSources
      ?? brief.evidence?.dataSources,
    );

  const dataSourceLabel =
    dataSources.length > 0
      ? dataSources
          .map(formatLabel)
          .join(" + ")
      : "Connected telemetry";

  const executiveAssessment =
    brief.executiveAssessment
    ?? brief.executiveSummary
    ?? "No executive assessment was generated for this reporting period.";

  const operationalReason =
    brief.operationalHealth?.reason
    ?? "No operational-health explanation was provided.";

  leadershipBriefWorkspace.innerHTML = `
    <article class="leadership-brief-document">
      <header class="brief-heading">
        <div class="brief-heading__content">
          <p class="eyebrow">
            ${escapeHtml(
              definition.eyebrow,
            )}
          </p>

          <h2>
            ${escapeHtml(
              definition.title,
            )}
          </h2>

          <p class="brief-heading__description">
            ${escapeHtml(
              definition.description,
            )}
          </p>
        </div>

        <div
          class="brief-metadata"
          aria-label="Leadership Brief metadata"
        >
          ${renderMetadataItem(
            "Report",
            "Leadership Brief",
          )}

          ${renderMetadataItem(
            "Reporting window",
            reportingWindow,
          )}

          ${renderMetadataItem(
            "Sources",
            dataSourceLabel,
          )}

          ${renderMetadataItem(
            "Generated",
            generatedAt,
          )}
        </div>
      </header>

      <section
        class="
          executive-assessment
          executive-assessment--${escapeHtml(
            healthStatus,
          )}
        "
        aria-labelledby="executive-assessment-title"
      >
        <div class="executive-assessment__heading">
          <p class="eyebrow">
            Current position
          </p>

          <h3 id="executive-assessment-title">
            Executive Assessment
          </h3>
        </div>

        <div class="executive-assessment__body">
          <p class="executive-assessment__summary">
            ${escapeHtml(
              executiveAssessment,
            )}
          </p>

          <div class="executive-assessment__conclusion">
            <span>
              Overall operational risk
            </span>

            <strong>
              ${escapeHtml(
                formatLabel(
                  healthStatus,
                ),
              )}
            </strong>
          </div>
        </div>
      </section>

      <section
        class="executive-position"
        aria-labelledby="executive-position-title"
      >
        <div class="section-heading">
          <p class="eyebrow">
            At a glance
          </p>

          <h3 id="executive-position-title">
            Executive Operational Position
          </h3>

        </div>

        <div class="executive-position__metrics">
          ${renderPositionMetric({
            label:
              "Operational Health",
            value:
              formatLabel(
                healthStatus,
              ),
            detail:
              operationalReason,
            modifier:
              healthStatus,
            prominence:
              "primary",
          })}

          ${renderPositionMetric({
            label:
              "Material Risks",
            value:
              getMetricValue(
                risks.length,
                "0",
              ),
            detail:
              risks.length === 1
                ? "Evidence-supported risk"
                : "Evidence-supported risks",
            prominence:
              "priority",
          })}

          ${renderPositionMetric({
            label:
              "Services Impacted",
            value:
              getMetricValue(
                affectedServiceCount,
              ),
            detail:
              affectedServiceCount === null
                ? "Not reported"
                : "Across the current brief",
            prominence:
              "supporting",
          })}

          ${renderPositionMetric({
            label:
              "Leadership Actions",
            value:
              getMetricValue(
                actions.length,
                "0",
              ),
            detail:
              actions.length === 1
                ? "Recommended priority"
                : "Recommended priorities",
            prominence:
              "priority",
          })}

          ${renderPositionMetric({
            label:
              "Engineering Confidence",
            value:
              confidencePercentage === null
                ? formatLabel(
                    confidenceLevel,
                  )
                : `${confidencePercentage}%`,
            detail:
              brief.confidence?.reason
              ?? "Confidence in the current assessment",
            modifier:
              confidenceLevel,
            prominence:
              "supporting",
          })}

          ${renderPositionMetric({
            label:
              "Evidence Coverage",
            value:
              evidenceCoverage === null
                ? getMetricValue(
                    supportingFindingCount,
                  )
                : `${evidenceCoverage}%`,
            detail:
              evidenceCoverage === null
                ? "Supporting findings"
                : "Available evidence represented",
            prominence:
              "supporting",
          })}
        </div>
      </section>

      <section
        class="dashboard-section material-risks"
        aria-labelledby="material-risks-title"
      >
        <div class="section-heading">
          <p class="eyebrow">
            Material exposure
          </p>

          <h3 id="material-risks-title">
            Material Operational Risks
          </h3>

        </div>

        <div class="card-list risk-list">
          ${
            risks.length > 0
              ? risks
                  .map(renderRiskCard)
                  .join("")
              : renderEmptyCard(
                  "No evidence-supported operational risks were identified during this reporting period.",
                )
          }
        </div>
      </section>

      <section
        class="dashboard-section leadership-priorities"
        aria-labelledby="leadership-priorities-title"
      >
        <div class="section-heading">
          <p class="eyebrow">
            Decision support
          </p>

          <h3 id="leadership-priorities-title">
            Leadership Priorities
          </h3>

        </div>

        <div class="action-list">
          ${
            actions.length > 0
              ? actions
                  .map(renderActionCard)
                  .join("")
              : renderEmptyCard(
                  "No evidence-supported leadership actions were identified during this reporting period.",
                )
          }
        </div>
      </section>

      ${
        watchItems.length > 0
        || wins.length > 0
          ? `
            <div class="dashboard-columns supporting-context">
              <section
                class="dashboard-section"
                aria-labelledby="watch-items-title"
              >
                <div class="section-heading">
                  <p class="eyebrow">
                    Monitor
                  </p>

                  <h3 id="watch-items-title">
                    Watch Items
                  </h3>
                </div>

                <div class="card-list">
                  ${
                    watchItems.length > 0
                      ? watchItems
                          .map(
                            renderWatchItem,
                          )
                          .join("")
                      : renderEmptyCard(
                          "No evidence-supported watch items were identified during this reporting period.",
                        )
                  }
                </div>
              </section>

              <section
                class="dashboard-section"
                aria-labelledby="key-wins-title"
              >
                <div class="section-heading">
                  <p class="eyebrow">
                    Positive outcomes
                  </p>

                  <h3 id="key-wins-title">
                    Key Wins
                  </h3>
                </div>

                <div class="card-list">
                  ${
                    wins.length > 0
                      ? wins
                          .map(
                            renderWinItem,
                          )
                          .join("")
                      : renderEmptyCard(
                          "No evidence-supported operational wins were identified during this reporting period.",
                        )
                  }
                </div>
              </section>
            </div>
          `
          : ""
      }

      <section
        class="
          evidence-summary
          evidence-summary--${escapeHtml(
            confidenceLevel,
          )}
        "
        aria-labelledby="evidence-summary-title"
      >
        <div class="evidence-summary__heading">
          <p class="eyebrow">
            Trust and traceability
          </p>

          <h3 id="evidence-summary-title">
            Executive Confidence
          </h3>
        </div>

        <div class="evidence-summary__metrics">
          ${renderEvidenceMetric(
            "Confidence",
            confidencePercentage === null
              ? formatLabel(
                  confidenceLevel,
                )
              : `${confidencePercentage}%`,
          )}

          ${renderEvidenceMetric(
            "Supporting Findings",
            getMetricValue(
              supportingFindingCount,
              "0",
            ),
          )}

          ${renderEvidenceMetric(
            "Telemetry Sources",
            getMetricValue(
              telemetrySourceCount,
            ),
          )}

          ${renderEvidenceMetric(
            "Production Incidents",
            getMetricValue(
              productionIncidentCount,
            ),
          )}
        </div>

        <p class="evidence-summary__reason">
          ${escapeHtml(
            brief.confidence?.reason
            ?? "No confidence explanation was provided.",
          )}
        </p>
      </section>
    </article>
  `;
}