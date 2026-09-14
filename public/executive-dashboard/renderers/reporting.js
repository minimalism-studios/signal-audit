import {
  escapeHtml,
  formatDate,
  formatLabel,
} from "../utils/formatting.js";

import {
  renderEmptyCard,
} from "../utils/rendering.js";

export function renderReporting(
  report,
  {
    leadershipBriefWorkspace,
    secondaryWorkspace,
    workspaceDefinitions,
  },
) {
  const definition =
    workspaceDefinitions.reporting;

  const metadata =
    report.metadata ?? {};

  const reportingPeriod =
    metadata.reportingPeriod ?? {};

  const summary =
    report.summary ?? {};

  const narrative =
    report.operationalNarrative ?? {};

  const performance =
    report.performance ?? {};

  const investigations =
    normalizeArray(
      report.investigations,
    );

  const serviceExposure =
    normalizeArray(
      report.serviceExposure,
    );

  const environmentExposure =
    normalizeArray(
      report.environmentExposure,
    );

  const recurringConditions =
    normalizeArray(
      report.recurringConditions,
    );

  const leadershipActions =
    report.leadershipActions ?? {};

  const completedActions =
    normalizeArray(
      leadershipActions.completed,
    );

  const carryForwardActions =
    normalizeArray(
      leadershipActions.carryForward,
    );

  const conclusion =
    report.conclusion ?? {};

  leadershipBriefWorkspace.hidden =
    false;

  secondaryWorkspace.hidden =
    true;

  leadershipBriefWorkspace.innerHTML = `
    <div class="brief-heading">
      <div>
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

      <div class="reporting-window">
        <span>
          Reporting period
        </span>

        <strong>
          ${escapeHtml(
            formatDate(
              reportingPeriod.start,
            ),
          )}
          –
          ${escapeHtml(
            formatDate(
              reportingPeriod.end,
            ),
          )}
        </strong>
      </div>
    </div>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Executive summary
        </p>

        <h3>
          ${escapeHtml(
            summary.headline
            ?? "Operational report",
          )}
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(
          summary.overview
          ?? "No executive summary was generated.",
        )}
      </p>

      ${renderSummaryDetails(
        summary,
      )}
    </section>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Operational narrative
        </p>

        <h3>
          ${escapeHtml(
            narrative.title
            ?? "What Changed",
          )}
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(
          narrative.summary
          ?? "No material operational changes were recorded.",
        )}
      </p>
    </section>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Performance scorecard
        </p>

        <h3>
          Reporting Period Performance
        </h3>
      </div>

      <div class="dashboard-columns">
        ${renderMetricCard(
          "Signals analyzed",
          performance.signalsAnalyzed
          ?? metadata.signalsAnalyzed
          ?? 0,
          "Operational signals included in this report.",
        )}

        ${renderMetricCard(
          "Material signals",
          performance.materialSignals
          ?? 0,
          "Signals determined to have material operational relevance.",
        )}
      </div>

      <div class="dashboard-columns">
        ${renderMetricCard(
          "Investigations opened",
          performance.investigationsOpened
          ?? 0,
          "Investigations initiated during the reporting period.",
        )}

        ${renderMetricCard(
          "Investigations resolved",
          performance.investigationsResolved
          ?? 0,
          "Investigations completed during the reporting period.",
        )}
      </div>

      <div class="dashboard-columns">
        ${renderMetricCard(
          "Resolution rate",
          formatPercentage(
            performance.resolutionRate,
          ),
          "Share of investigations resolved during the reporting period.",
        )}

        ${renderMetricCard(
          "Evidence confidence",
          formatLabel(
            metadata.evidenceConfidence
            ?? conclusion.confidence
            ?? "not available",
          ),
          metadata.evidenceConfidenceReason
          ?? conclusion.confidenceReason
          ?? "Confidence reflects the available operational evidence.",
        )}
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Investigations
        </p>

        <h3>
          Investigation Record
        </h3>
      </div>

      <div class="card-list">
        ${
          investigations.length > 0
            ? investigations
                .map(
                  renderInvestigation,
                )
                .join("")
            : renderEmptyCard(
                "No investigations were recorded during this reporting period.",
              )
        }
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Service exposure
        </p>

        <h3>
          Services Included in the Report
        </h3>
      </div>

      <div class="card-list">
        ${
          serviceExposure.length > 0
            ? serviceExposure
                .map(
                  (item) =>
                    renderExposureCard(
                      item,
                      "service",
                    ),
                )
                .join("")
            : renderEmptyCard(
                "No service exposure was recorded during this reporting period.",
              )
        }
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Environment exposure
        </p>

        <h3>
          Environments Included in the Report
        </h3>
      </div>

      <div class="card-list">
        ${
          environmentExposure.length > 0
            ? environmentExposure
                .map(
                  (item) =>
                    renderExposureCard(
                      item,
                      "environment",
                    ),
                )
                .join("")
            : renderEmptyCard(
                "No environment exposure was recorded during this reporting period.",
              )
        }
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Recurring conditions
        </p>

        <h3>
          Conditions Requiring Continued Attention
        </h3>
      </div>

      <div class="card-list">
        ${
          recurringConditions.length > 0
            ? recurringConditions
                .map(
                  renderRecurringCondition,
                )
                .join("")
            : renderEmptyCard(
                "No recurring operational conditions were identified.",
              )
        }
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Leadership actions
        </p>

        <h3>
          Completed and Carry-Forward Actions
        </h3>
      </div>

      <div class="dashboard-columns">
        ${renderActionSection(
          "Completed",
          completedActions,
          "No completed leadership actions were recorded.",
        )}

        ${renderActionSection(
          "Carry forward",
          carryForwardActions,
          "No leadership actions were carried forward.",
        )}
      </div>
    </section>

    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Conclusion
        </p>

        <h3>
          Operational Assessment
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(
          conclusion.assessment
          ?? "No concluding assessment was generated.",
        )}
      </p>

      <div class="card-list">
        ${renderConclusionItem(
          "Carry-forward risk",
          conclusion.carryForwardRisk,
          "No carry-forward risk was identified.",
        )}

        ${renderConclusionItem(
          "Next priority",
          conclusion.nextPriority,
          "No next priority was identified.",
        )}

        ${renderConclusionItem(
          "Confidence",
          formatLabel(
            conclusion.confidence
            ?? metadata.evidenceConfidence
            ?? "not available",
          ),
          conclusion.confidenceReason,
        )}
      </div>
    </section>
  `;
}

function renderSummaryDetails(
  summary,
) {
  const items = [
    {
      label: "Operational direction",
      value:
        formatLabel(
          summary.operationalDirection
          ?? "not available",
        ),
    },
    {
      label: "Material change",
      value:
        summary.materialChange
        ?? "No material change was identified.",
    },
    {
      label: "Carry-forward risk",
      value:
        summary.carryForwardRisk
        ?? "No carry-forward risk was identified.",
    },
  ];

  return `
    <div class="card-list">
      ${items
        .map(
          ({ label, value }) => `
            <article class="empty-card">
              <strong>
                ${escapeHtml(label)}
              </strong>

              <p>
                ${escapeHtml(value)}
              </p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderMetricCard(
  label,
  value,
  description,
) {
  return `
    <article class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          ${escapeHtml(label)}
        </p>

        <h3>
          ${escapeHtml(value)}
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(description)}
      </p>
    </article>
  `;
}

function renderInvestigation(
  investigation,
) {
  const title =
    investigation.title
    ?? investigation.name
    ?? investigation.summary
    ?? "Operational investigation";

  const status =
    formatLabel(
      investigation.status
      ?? investigation.state
      ?? "not available",
    );

  const priority =
    formatLabel(
      investigation.priority
      ?? investigation.severity
      ?? "not available",
    );

  const assessment =
    investigation.assessment
    ?? investigation.description
    ?? investigation.summary
    ?? "No investigation assessment was provided.";

  return `
    <article class="empty-card">
      <p class="eyebrow">
        ${escapeHtml(status)}
        ·
        ${escapeHtml(priority)}
      </p>

      <strong>
        ${escapeHtml(title)}
      </strong>

      <p>
        ${escapeHtml(assessment)}
      </p>
    </article>
  `;
}

function renderExposureCard(
  exposure,
  type,
) {
  const name =
    exposure[type]
    ?? exposure.name
    ?? exposure.label
    ?? `Unknown ${type}`;

  const direction =
    formatLabel(
      exposure.direction
      ?? exposure.trend
      ?? "stable",
    );

  const signalCount =
    exposure.signalCount
    ?? exposure.signals
    ?? exposure.materialSignals
    ?? 0;

  const assessment =
    exposure.assessment
    ?? exposure.summary
    ?? `No ${type} assessment was provided.`;

  return `
    <article class="empty-card">
      <p class="eyebrow">
        ${escapeHtml(direction)}
      </p>

      <strong>
        ${escapeHtml(name)}
      </strong>

      <p>
        ${escapeHtml(signalCount)}
        signal${
          Number(signalCount) === 1
            ? ""
            : "s"
        }
      </p>

      <p>
        ${escapeHtml(assessment)}
      </p>
    </article>
  `;
}

function renderRecurringCondition(
  condition,
) {
  const title =
    condition.title
    ?? condition.condition
    ?? "Recurring operational condition";

  const status =
    formatLabel(
      condition.status
      ?? "active",
    );

  const occurrenceCount =
    condition.occurrenceCount
    ?? condition.occurrences
    ?? 0;

  const implication =
    condition.implication
    ?? condition.assessment
    ?? condition.summary
    ?? "No operational implication was provided.";

  return `
    <article class="empty-card">
      <p class="eyebrow">
        ${escapeHtml(status)}
      </p>

      <strong>
        ${escapeHtml(title)}
      </strong>

      <p>
        ${escapeHtml(occurrenceCount)}
        occurrence${
          Number(occurrenceCount) === 1
            ? ""
            : "s"
        }
      </p>

      <p>
        ${escapeHtml(implication)}
      </p>
    </article>
  `;
}

function renderActionSection(
  title,
  actions,
  emptyMessage,
) {
  return `
    <article class="dashboard-section">
      <div class="section-heading">
        <h3>
          ${escapeHtml(title)}
        </h3>
      </div>

      <div class="card-list">
        ${
          actions.length > 0
            ? actions
                .map(
                  renderAction,
                )
                .join("")
            : renderEmptyCard(
                emptyMessage,
              )
        }
      </div>
    </article>
  `;
}

function renderAction(
  action,
) {
  if (
    typeof action === "string"
  ) {
    return `
      <article class="empty-card">
        <p>
          ${escapeHtml(action)}
        </p>
      </article>
    `;
  }

  const title =
    action.title
    ?? action.action
    ?? action.summary
    ?? "Leadership action";

  const description =
    action.description
    ?? action.rationale
    ?? action.owner
    ?? "";

  return `
    <article class="empty-card">
      <strong>
        ${escapeHtml(title)}
      </strong>

      ${
        description
          ? `
            <p>
              ${escapeHtml(description)}
            </p>
          `
          : ""
      }
    </article>
  `;
}

function renderConclusionItem(
  label,
  value,
  fallback,
) {
  return `
    <article class="empty-card">
      <strong>
        ${escapeHtml(label)}
      </strong>

      <p>
        ${escapeHtml(
          value
          ?? fallback
          ?? "Not available.",
        )}
      </p>
    </article>
  `;
}

function formatPercentage(
  value,
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return "Not available";
  }

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return `${number}%`;
}

function normalizeArray(
  value,
) {
  return Array.isArray(value)
    ? value
    : [];
}
