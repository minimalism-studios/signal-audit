import {
  escapeHtml,
  formatDate,
  formatLabel,
} from "../utils/formatting.js";

import {
  renderEmptyCard,
  renderEvidenceLine,
} from "../utils/rendering.js";

export function renderForecasting(
  forecast,
  {
    leadershipBriefWorkspace,
    secondaryWorkspace,
    workspaceDefinitions,
  },
) {
  const definition =
    workspaceDefinitions.forecasting;

  const metadata =
    forecast?.metadata ?? {};

  const outlook =
    forecast?.executiveOutlook ?? {};

  const priorityRisks =
    normalizeArray(
      forecast?.priorityRisks,
    );

  const watchItems =
    normalizeArray(
      forecast?.watchItems,
    );

  const recommendedFocus =
    normalizeArray(
      forecast?.recommendedFocus,
    );

  const positiveIndicators =
    normalizeArray(
      forecast?.positiveIndicators,
    );

  const assumptions =
    normalizeArray(
      forecast?.assumptions,
    );

  leadershipBriefWorkspace.hidden =
    false;

  secondaryWorkspace.hidden =
    true;

  leadershipBriefWorkspace.innerHTML = `
    <article class="leadership-brief-document">
      ${renderHeading({
        definition,
        metadata,
      })}

      ${renderExecutiveOutlook({
        outlook,
        metadata,
      })}

      ${renderPriorityRisks(
        priorityRisks,
      )}

      ${renderWatchItems(
        watchItems,
      )}

      ${renderRecommendedFocus(
        recommendedFocus,
      )}

      ${renderPositiveIndicators(
        positiveIndicators,
      )}

      ${renderAssumptions(
        assumptions,
      )}

      ${renderConclusion({
        forecast,
        outlook,
        metadata,
      })}
    </article>
  `;
}

function renderHeading({
  definition,
  metadata,
}) {
  const analysisPeriod =
    parseAnalysisPeriod(
      metadata.analysisPeriod,
    );

  return `
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
          Analysis period
        </span>

        <strong>
          ${escapeHtml(
            formatDate(
              analysisPeriod.start,
            ),
          )}
          –
          ${escapeHtml(
            formatDate(
              analysisPeriod.end,
            ),
          )}
        </strong>

        <span>
          ${escapeHtml(
            metadata.forecastWindow
            ?? "Next reporting period",
          )}
        </span>
      </div>
    </div>
  `;
}

function renderExecutiveOutlook({
  outlook,
  metadata,
}) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Executive outlook
        </p>

        <h3>
          ${escapeHtml(
            outlook.headline
            ?? "No operational outlook available.",
          )}
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(
          outlook.summary
          ?? "No forecast summary was generated.",
        )}
      </p>

      <div class="dashboard-columns">
        ${renderMetricCard({
          label:
            "Overall risk",

          value:
            formatLabel(
              outlook.overallRisk
              ?? "unknown",
            ),

          description:
            outlook.materialConcern
            ?? "No material concern was identified.",
        })}

        ${renderMetricCard({
          label:
            "Operational trajectory",

          value:
            formatLabel(
              outlook.operationalTrajectory
              ?? "indeterminate",
            ),

          description:
            "Projected direction based on the comparative operational evidence.",
        })}
      </div>

      <div class="dashboard-columns">
        ${renderMetricCard({
          label:
            "Signals analyzed",

          value:
            metadata.signalsAnalyzed
            ?? 0,

          description:
            `${metadata.findingsAnalyzed ?? 0} findings contributed to this forecast.`,
        })}

        ${renderMetricCard({
          label:
            "Forecast confidence",

          value:
            formatLabel(
              metadata.confidence
              ?? "unknown",
            ),

          description:
            metadata.confidenceReason
            ?? "No confidence explanation was provided.",
        })}
      </div>
    </section>
  `;
}

function renderPriorityRisks(
  items,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Projected exposure
        </p>

        <h3>
          Priority Risks
        </h3>
      </div>

      <div class="card-list">
        ${
          items.length > 0
            ? items
                .map(
                  renderPriorityRisk,
                )
                .join("")
            : renderEmptyCard(
                "No priority risks were identified for the forecast period.",
              )
        }
      </div>
    </section>
  `;
}

function renderPriorityRisk(
  risk,
) {
  return `
    <article class="intelligence-card">
      <div class="intelligence-card__heading">
        <div>
          <p class="eyebrow">
            ${escapeHtml(
              formatLabel(
                risk.likelihood
                ?? "unknown",
              ),
            )}
            likelihood
          </p>

          <h4>
            ${escapeHtml(
              risk.title
              ?? "Operational risk",
            )}
          </h4>
        </div>

        <strong>
          ${escapeHtml(
            formatLabel(
              risk.riskLevel
              ?? "unknown",
            ),
          )}
          risk
        </strong>
      </div>

      <p>
        ${escapeHtml(
          risk.forecast
          ?? "No forecast was provided.",
        )}
      </p>

      <p>
        <strong>
          Service:
        </strong>

        ${escapeHtml(
          risk.service
          ?? "Not identified",
        )}
      </p>

      <p>
        <strong>
          Operational impact:
        </strong>

        ${escapeHtml(
          risk.businessImpact
          ?? "No impact assessment was provided.",
        )}
      </p>

      ${renderEvidenceLine(
        risk,
      )}
    </article>
  `;
}

function renderWatchItems(
  items,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Developing conditions
        </p>

        <h3>
          Watch Items
        </h3>
      </div>

      <div class="card-list">
        ${
          items.length > 0
            ? items
                .map(
                  (item) => `
                    <article class="intelligence-card">
                      <h4>
                        ${escapeHtml(
                          item.title
                          ?? "Watch item",
                        )}
                      </h4>

                      <p>
                        <strong>
                          Current condition:
                        </strong>

                        ${escapeHtml(
                          item.condition
                          ?? "No condition was provided.",
                        )}
                      </p>

                      <p>
                        <strong>
                          Monitor for:
                        </strong>

                        ${escapeHtml(
                          item.monitorFor
                          ?? "No monitoring criteria were provided.",
                        )}
                      </p>

                      ${renderEvidenceLine(
                        item,
                      )}
                    </article>
                  `,
                )
                .join("")
            : renderEmptyCard(
                "No developing conditions require additional monitoring.",
              )
        }
      </div>
    </section>
  `;
}

function renderRecommendedFocus(
  items,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Engineering priorities
        </p>

        <h3>
          Recommended Focus
        </h3>
      </div>

      <div class="card-list">
        ${
          items.length > 0
            ? items
                .map(
                  (item, index) =>
                    renderFocusCard(
                      item,
                      index,
                    ),
                )
                .join("")
            : renderEmptyCard(
                "No recommended focus areas were generated.",
              )
        }
      </div>
    </section>
  `;
}

function renderFocusCard(
  item,
  index,
) {
  return `
    <article class="action-card">
      <div class="action-card__priority">
        <span>
          ${String(
            index + 1,
          ).padStart(
            2,
            "0",
          )}
        </span>

        <strong>
          ${escapeHtml(
            formatLabel(
              item.priority
              ?? "priority",
            ),
          )}
        </strong>
      </div>

      <div>
        <h4>
          ${escapeHtml(
            item.rationale
            ?? "Recommended operational focus",
          )}
        </h4>

        <p>
          ${escapeHtml(
            item.expectedEffect
            ?? "No expected effect was provided.",
          )}
        </p>

        <div class="action-card__footer">
          ${renderEvidenceLine(
            item,
          )}
        </div>
      </div>
    </article>
  `;
}

function renderPositiveIndicators(
  items,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Stabilizing evidence
        </p>

        <h3>
          Positive Indicators
        </h3>
      </div>

      <div class="card-list">
        ${
          items.length > 0
            ? items
                .map(
                  (item) => `
                    <article class="intelligence-card">
                      <h4>
                        ${escapeHtml(
                          item.indicator
                          ?? "Positive indicator",
                        )}
                      </h4>

                      <p>
                        ${escapeHtml(
                          item.implication
                          ?? "No implication was provided.",
                        )}
                      </p>

                      ${renderEvidenceLine(
                        item,
                      )}
                    </article>
                  `,
                )
                .join("")
            : renderEmptyCard(
                "No material positive indicators were identified.",
              )
        }
      </div>
    </section>
  `;
}

function renderAssumptions(
  assumptions,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Forecast boundaries
        </p>

        <h3>
          Assumptions
        </h3>
      </div>

      ${
        assumptions.length > 0
          ? `
            <ul class="evidence-list">
              ${assumptions
                .map(
                  (assumption) => `
                    <li>
                      ${escapeHtml(
                        assumption,
                      )}
                    </li>
                  `,
                )
                .join("")}
            </ul>
          `
          : renderEmptyCard(
              "No forecast assumptions were recorded.",
            )
      }
    </section>
  `;
}

function renderConclusion({
  forecast,
  outlook,
  metadata,
}) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Forecast conclusion
        </p>

        <h3>
          ${escapeHtml(
            outlook.materialConcern
            ?? "Operational Outlook",
          )}
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(
          forecast?.conclusion
          ?? "No forecast conclusion was generated.",
        )}
      </p>

      <div class="dashboard-columns">
        ${renderMetricCard({
          label:
            "Projected direction",

          value:
            formatLabel(
              outlook.operationalTrajectory
              ?? "indeterminate",
            ),

          description:
            outlook.summary
            ?? "No trajectory explanation was provided.",
        })}

        ${renderMetricCard({
          label:
            "Confidence",

          value:
            formatLabel(
              metadata.confidence
              ?? "unknown",
            ),

          description:
            metadata.confidenceReason
            ?? "No confidence explanation was provided.",
        })}
      </div>
    </section>
  `;
}

function renderMetricCard({
  label,
  value,
  description,
}) {
  return `
    <section class="dashboard-section">
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
    </section>
  `;
}

function parseAnalysisPeriod(
  value,
) {
  if (
    value
    && typeof value === "object"
    && !Array.isArray(value)
  ) {
    return {
      start:
        value.start
        ?? null,

      end:
        value.end
        ?? null,
    };
  }

  if (
    typeof value !== "string"
    || value.trim() === ""
  ) {
    return {
      start: null,
      end: null,
    };
  }

  const separator =
    " to ";

  const separatorIndex =
    value.indexOf(
      separator,
    );

  if (
    separatorIndex === -1
  ) {
    return {
      start: value,
      end: value,
    };
  }

  return {
    start:
      value
        .slice(
          0,
          separatorIndex,
        )
        .trim(),

    end:
      value
        .slice(
          separatorIndex
          + separator.length,
        )
        .trim(),
  };
}

function normalizeArray(
  value,
) {
  return Array.isArray(value)
    ? value
    : [];
}
