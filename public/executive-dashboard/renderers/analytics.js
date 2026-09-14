import {
  escapeHtml,
  formatDate,
  formatLabel,
} from "../utils/formatting.js";

import {
  renderEmptyCard,
  renderEvidenceLine,
} from "../utils/rendering.js";

export function renderAnalytics(
  analytics,
  {
    leadershipBriefWorkspace,
    secondaryWorkspace,
    workspaceDefinitions,
  },
) {
  const definition =
    workspaceDefinitions.analytics;

  const metadata =
    analytics?.metadata ?? {};

  const analysisPeriod =
    metadata.analysisPeriod ?? {};

  const summary =
    analytics?.summary ?? {};

  const trend =
    analytics?.trendAnalysis ?? {};

  const servicePatterns =
    normalizeArray(
      analytics?.servicePatterns,
    );

  const environmentPatterns =
    normalizeArray(
      analytics?.environmentPatterns,
    );

  const severityPatterns =
    normalizeArray(
      analytics?.severityPatterns,
    );

  const categoryPatterns =
    normalizeArray(
      analytics?.categoryPatterns,
    );

  const recurringPatterns =
    normalizeArray(
      analytics?.recurringPatterns,
    );

  const correlations =
    normalizeArray(
      analytics?.correlations,
    );

  const concentrationRisks =
    normalizeArray(
      analytics?.concentrationRisks,
    );

  const leadershipInsights =
    normalizeArray(
      analytics?.leadershipInsights,
    );

  const conclusion =
    analytics?.conclusion ?? {};

  leadershipBriefWorkspace.hidden =
    false;

  secondaryWorkspace.hidden =
    true;

  leadershipBriefWorkspace.innerHTML = `
    <article class="leadership-brief-document">
      ${renderHeading({
        definition,
        analysisPeriod,
      })}

      ${renderSummary({
        summary,
        metadata,
      })}

      ${renderTrendAnalysis(
        trend,
      )}

      ${renderPatternSection({
        eyebrow:
          "Service intelligence",

        title:
          "Service Patterns",

        items:
          servicePatterns,

        emptyMessage:
          "No service patterns were identified.",

        renderer:
          renderServicePattern,
      })}

      ${renderPatternSection({
        eyebrow:
          "Environment intelligence",

        title:
          "Environment Patterns",

        items:
          environmentPatterns,

        emptyMessage:
          "No environment patterns were identified.",

        renderer:
          renderEnvironmentPattern,
      })}

      <div class="dashboard-columns">
        ${renderDistributionSection({
          eyebrow:
            "Severity distribution",

          title:
            "Findings by Severity",

          items:
            severityPatterns,

          emptyMessage:
            "No severity patterns were identified.",

          labelField:
            "severity",
        })}

        ${renderDistributionSection({
          eyebrow:
            "Category distribution",

          title:
            "Findings by Category",

          items:
            categoryPatterns,

          emptyMessage:
            "No category patterns were identified.",

          labelField:
            "category",
        })}
      </div>

      ${renderRecurringPatterns(
        recurringPatterns,
      )}

      ${renderCorrelations(
        correlations,
      )}

      ${renderNarrativeCards({
        eyebrow:
          "Risk concentration",

        title:
          "Concentration Risks",

        items:
          concentrationRisks,

        emptyMessage:
          "No material concentration risks were identified.",

        bodyField:
          "assessment",
      })}

      ${renderLeadershipInsights(
        leadershipInsights,
      )}

      ${renderConclusion(
        conclusion,
      )}
    </article>
  `;
}

function renderHeading({
  definition,
  analysisPeriod,
}) {
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
          Reporting period
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
      </div>
    </div>
  `;
}

function renderSummary({
  summary,
  metadata,
}) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Analytical position
        </p>

        <h3>
          ${escapeHtml(
            summary.headline
            ?? "No analytical headline available.",
          )}
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(
          summary.overview
          ?? "No analytical overview was generated.",
        )}
      </p>

      <div class="dashboard-columns">
        ${renderMetricCard({
          label:
            "Operational pattern",

          value:
            formatLabel(
              summary.operationalPattern
              ?? "indeterminate",
            ),

          description:
            summary.materialInsight
            ?? "No material analytical insight was generated.",
        })}

        ${renderMetricCard({
          label:
            "Primary concentration",

          value:
            summary.primaryConcentration
            ?? "Not identified",

          description:
            metadata.confidenceReason
            ?? "No confidence explanation was provided.",
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
            `${metadata.services ?? 0} services and ${metadata.environments ?? 0} environments represented.`,
        })}

        ${renderMetricCard({
          label:
            "Evidence confidence",

          value:
            formatLabel(
              metadata.evidenceConfidence
              ?? "unknown",
            ),

          description:
            metadata.confidenceReason
            ?? "Confidence was not available.",
        })}
      </div>
    </section>
  `;
}

function renderTrendAnalysis(
  trend,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Operational trend
        </p>

        <h3>
          ${escapeHtml(
            formatLabel(
              trend.direction
              ?? "indeterminate",
            ),
          )}
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(
          trend.summary
          ?? "No trend analysis was generated.",
        )}
      </p>

      <div class="dashboard-columns">
        ${renderChangeCard({
          label:
            "Signal volume",

          value:
            trend.signalVolumeChange,
        })}

        ${renderChangeCard({
          label:
            "Material signals",

          value:
            trend.materialSignalChange,
        })}
      </div>

      <div class="dashboard-columns">
        ${renderChangeCard({
          label:
            "Open exposure",

          value:
            trend.openExposureChange,
        })}

        ${renderMetricCard({
          label:
            "Direction",

          value:
            formatLabel(
              trend.direction
              ?? "indeterminate",
            ),

          description:
            "Comparative direction across the selected reporting period.",
        })}
      </div>
    </section>
  `;
}

function renderPatternSection({
  eyebrow,
  title,
  items,
  emptyMessage,
  renderer,
}) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          ${escapeHtml(eyebrow)}
        </p>

        <h3>
          ${escapeHtml(title)}
        </h3>
      </div>

      <div class="card-list">
        ${
          items.length > 0
            ? items
                .map(renderer)
                .join("")
            : renderEmptyCard(
                emptyMessage,
              )
        }
      </div>
    </section>
  `;
}

function renderServicePattern(
  pattern,
) {
  return `
    <article class="intelligence-card">
      <div class="intelligence-card__heading">
        <div>
          <p class="eyebrow">
            ${escapeHtml(
              formatLabel(
                pattern.direction
                ?? "indeterminate",
              ),
            )}
          </p>

          <h4>
            ${escapeHtml(
              pattern.service
              ?? "Unknown service",
            )}
          </h4>
        </div>

        <strong>
          ${escapeHtml(
            pattern.openExposure
            ?? 0,
          )}
          open exposure
        </strong>
      </div>

      <p>
        ${escapeHtml(
          pattern.signals
          ?? 0,
        )}
        signals produced
        ${escapeHtml(
          pattern.findings
          ?? 0,
        )}
        findings, including
        ${escapeHtml(
          pattern.materialFindings
          ?? 0,
        )}
        material findings.
      </p>

      <p>
        Earlier:
        ${escapeHtml(
          pattern.earlierSignals
          ?? 0,
        )}
        signals · Later:
        ${escapeHtml(
          pattern.laterSignals
          ?? 0,
        )}
        signals · Change:
        ${formatSignedNumber(
          pattern.change,
        )}
      </p>

      ${renderEvidenceLine(
        pattern,
      )}
    </article>
  `;
}

function renderEnvironmentPattern(
  pattern,
) {
  return `
    <article class="intelligence-card">
      <div class="intelligence-card__heading">
        <div>
          <p class="eyebrow">
            ${escapeHtml(
              formatLabel(
                pattern.direction
                ?? "indeterminate",
              ),
            )}
          </p>

          <h4>
            ${escapeHtml(
              formatLabel(
                pattern.environment
                ?? "unknown",
              ),
            )}
          </h4>
        </div>

        <strong>
          ${escapeHtml(
            pattern.openExposure
            ?? 0,
          )}
          open exposure
        </strong>
      </div>

      <p>
        ${escapeHtml(
          pattern.signals
          ?? 0,
        )}
        signals produced
        ${escapeHtml(
          pattern.findings
          ?? 0,
        )}
        findings, including
        ${escapeHtml(
          pattern.materialFindings
          ?? 0,
        )}
        material findings.
      </p>

      <p>
        Earlier:
        ${escapeHtml(
          pattern.earlierSignals
          ?? 0,
        )}
        signals · Later:
        ${escapeHtml(
          pattern.laterSignals
          ?? 0,
        )}
        signals · Change:
        ${formatSignedNumber(
          pattern.change,
        )}
      </p>

      ${renderEvidenceLine(
        pattern,
      )}
    </article>
  `;
}

function renderDistributionSection({
  eyebrow,
  title,
  items,
  emptyMessage,
  labelField,
}) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          ${escapeHtml(eyebrow)}
        </p>

        <h3>
          ${escapeHtml(title)}
        </h3>
      </div>

      <div class="card-list">
        ${
          items.length > 0
            ? items
                .map(
                  (item) =>
                    renderDistributionCard({
                      item,
                      labelField,
                    }),
                )
                .join("")
            : renderEmptyCard(
                emptyMessage,
              )
        }
      </div>
    </section>
  `;
}

function renderDistributionCard({
  item,
  labelField,
}) {
  return `
    <article class="empty-card">
      <strong>
        ${escapeHtml(
          formatLabel(
            item[labelField]
            ?? "unknown",
          ),
        )}
      </strong>

      <p>
        ${escapeHtml(
          item.count
          ?? 0,
        )}
        findings
      </p>

      <p>
        Earlier:
        ${escapeHtml(
          item.earlierCount
          ?? 0,
        )}
        · Later:
        ${escapeHtml(
          item.laterCount
          ?? 0,
        )}
        · Change:
        ${formatSignedNumber(
          item.change,
        )}
      </p>

      <p>
        ${escapeHtml(
          formatLabel(
            item.direction
            ?? "indeterminate",
          ),
        )}
      </p>

      ${renderEvidenceLine(
        item,
      )}
    </article>
  `;
}

function renderRecurringPatterns(
  items,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Recurrence
        </p>

        <h3>
          Recurring Conditions
        </h3>
      </div>

      <div class="card-list">
        ${
          items.length > 0
            ? items
                .map(
                  (item) => `
                    <article class="intelligence-card">
                      <div class="intelligence-card__heading">
                        <div>
                          <p class="eyebrow">
                            ${escapeHtml(
                              formatLabel(
                                item.status
                                ?? "unknown",
                              ),
                            )}
                          </p>

                          <h4>
                            ${escapeHtml(
                              item.title
                              ?? "Recurring condition",
                            )}
                          </h4>
                        </div>

                        <strong>
                          ${escapeHtml(
                            item.occurrences
                            ?? 0,
                          )}
                          occurrences
                        </strong>
                      </div>

                      <p>
                        ${escapeHtml(
                          item.implication
                          ?? "No implication was provided.",
                        )}
                      </p>

                      <p>
                        ${escapeHtml(
                          normalizeArray(
                            item.affectedServices,
                          ).join(" · ")
                          || "No affected services recorded.",
                        )}
                      </p>

                      <p>
                        ${escapeHtml(
                          formatDate(
                            item.firstObserved,
                          ),
                        )}
                        –
                        ${escapeHtml(
                          formatDate(
                            item.lastObserved,
                          ),
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
                "No recurring conditions were identified.",
              )
        }
      </div>
    </section>
  `;
}

function renderCorrelations(
  items,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Relationships
        </p>

        <h3>
          Operational Correlations
        </h3>
      </div>

      <div class="card-list">
        ${
          items.length > 0
            ? items
                .map(
                  (item) => `
                    <article class="empty-card">
                      <strong>
                        ${escapeHtml(
                          formatLabel(
                            item.type
                            ?? "correlation",
                          ),
                        )}
                      </strong>

                      <p>
                        ${escapeHtml(
                          formatDimensions(
                            item.dimensions,
                          ),
                        )}
                      </p>

                      <p>
                        ${escapeHtml(
                          item.occurrences
                          ?? 0,
                        )}
                        occurrences
                      </p>

                      ${renderEvidenceLine(
                        item,
                      )}
                    </article>
                  `,
                )
                .join("")
            : renderEmptyCard(
                "No operational correlations were identified.",
              )
        }
      </div>
    </section>
  `;
}

function renderNarrativeCards({
  eyebrow,
  title,
  items,
  emptyMessage,
  bodyField,
}) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          ${escapeHtml(eyebrow)}
        </p>

        <h3>
          ${escapeHtml(title)}
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
                          ?? title,
                        )}
                      </h4>

                      <p>
                        ${escapeHtml(
                          item[bodyField]
                          ?? "No assessment was provided.",
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
                emptyMessage,
              )
        }
      </div>
    </section>
  `;
}

function renderLeadershipInsights(
  items,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Leadership interpretation
        </p>

        <h3>
          Leadership Insights
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
                          ?? "Leadership insight",
                        )}
                      </h4>

                      <p>
                        ${escapeHtml(
                          item.insight
                          ?? "No insight was provided.",
                        )}
                      </p>

                      <p>
                        <strong>
                          Implication:
                        </strong>

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
                "No leadership insights were generated.",
              )
        }
      </div>
    </section>
  `;
}

function renderConclusion(
  conclusion,
) {
  return `
    <section class="dashboard-section">
      <div class="section-heading">
        <p class="eyebrow">
          Analytical conclusion
        </p>

        <h3>
          ${escapeHtml(
            conclusion.primaryRisk
            ?? "Operational Assessment",
          )}
        </h3>
      </div>

      <p class="executive-summary">
        ${escapeHtml(
          conclusion.assessment
          ?? "No analytical conclusion was generated.",
        )}
      </p>

      <div class="dashboard-columns">
        ${renderMetricCard({
          label:
            "Next analytical priority",

          value:
            conclusion.nextAnalyticalPriority
            ?? "Not identified",

          description:
            "The next evidence-based question for operational analysis.",
        })}

        ${renderMetricCard({
          label:
            "Confidence",

          value:
            formatLabel(
              conclusion.confidence
              ?? "unknown",
            ),

          description:
            conclusion.confidenceReason
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

function renderChangeCard({
  label,
  value,
}) {
  return renderMetricCard({
    label,

    value:
      formatSignedNumber(
        value,
      ),

    description:
      "Change between the earlier and later portions of the reporting period.",
  });
}

function formatSignedNumber(
  value,
) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "Not available";
  }

  if (number > 0) {
    return `+${number}`;
  }

  return String(number);
}

function formatDimensions(
  dimensions,
) {
  if (
    !dimensions
    || typeof dimensions
      !== "object"
    || Array.isArray(dimensions)
  ) {
    return "No correlation dimensions available.";
  }

  const values =
    Object.values(
      dimensions,
    )
      .filter(
        (value) =>
          value !== null
          && value !== undefined
          && String(value).trim() !== "",
      )
      .map(
        (value) =>
          formatLabel(
            String(value),
          ),
      );

  return values.length > 0
    ? values.join(" ↔ ")
    : "No correlation dimensions available.";
}

function normalizeArray(
  value,
) {
  return Array.isArray(value)
    ? value
    : [];
}
