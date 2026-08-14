function renderInvestigationFindings(
  investigation,
) {
  const findings =
    getInvestigationSignals(
      investigation,
    ).flatMap(
      signal =>
        signal.analysis?.findings || [],
    );

  if (
    !Array.isArray(findings)
    || findings.length === 0
  ) {
    return `
      <section
        class="integration-detail-section"
      >
        <p class="eyebrow">
          Findings
        </p>

        <div class="list-message">
          <p class="list-message__title">
            No findings available
          </p>

          <p>
            This investigation does not
            contain structured findings.
          </p>
        </div>
      </section>
    `;
  }

  return `
    <section
      class="integration-detail-section"
      aria-labelledby="investigation-findings-title"
    >
      <div class="section-heading">

        <div>
          <p class="eyebrow">
            Operational conclusions
          </p>

          <h3
            id="investigation-findings-title"
          >
            Findings
          </h3>
        </div>

        ${createBadge(
          `${findings.length} finding${
            findings.length === 1
              ? ""
              : "s"
          }`,
          "finding-count",
        )}

      </div>

      <div class="findings">

        ${findings
          .map(
            (
              finding,
              index,
            ) =>
              renderFinding(
                finding,
                index,
                findings.length,
              ),
          )
          .join("")}

      </div>
    </section>
  `;
}

function renderInvestigationOverview(
    investigation,
) {

    const evidence =
        investigation.evidence ?? {};

    const signalCount =
        evidence.signals?.length ?? 0;

    const metricCount =
        evidence.metrics?.length ?? 0;

    const deploymentCount =
        evidence.deployments?.length ?? 0;

    const incidentCount =
        evidence.incidents?.length ?? 0;

    const recommendationCount =
        investigation.recommendations
            ?.length ?? 0;

    return `
        <section
            class="investigation-section"
            aria-labelledby="investigation-overview-title"
        >

            <div class="section-heading">

                <div>

                    <p class="eyebrow">
                        Overview
                    </p>

                    <h2
                        id="investigation-overview-title"
                    >
                        Investigation Overview
                    </h2>

                </div>

            </div>

            <div
                class="investigation-overview-grid"
            >

                ${renderOverviewMetric(
                    "Status",
                    investigation.status ??
                    "Investigating",
                )}

                ${renderOverviewMetric(
                    "Confidence",
                    investigation.assessment?.confidence != null
                        ? `${investigation.assessment.confidence}%`
                        : "Pending",
                )}

                ${renderOverviewMetric(
                    "Signals",
                    signalCount,
                )}

                ${renderOverviewMetric(
                    "Metrics",
                    metricCount,
                )}

                ${renderOverviewMetric(
                    "Deployments",
                    deploymentCount,
                )}

                ${renderOverviewMetric(
                    "Incidents",
                    incidentCount,
                )}

                ${renderOverviewMetric(
                    "Recommendations",
                    recommendationCount,
                )}

                ${renderOverviewMetric(
                    "Last Updated",
                    formatDate(
                        investigation.updatedAt,
                    ),
                )}

            </div>

        </section>
    `;
}

function renderOverviewMetric(
    label,
    value,
) {

    return `
        <article
            class="overview-metric-card"
        >

            <span
                class="overview-metric-card__label"
            >
                ${escapeHtml(label)}
            </span>

            <span
                class="overview-metric-card__value"
            >
                ${escapeHtml(
                    String(value),
                )}
            </span>

        </article>
    `;
}

function renderInvestigationAssessment(
    investigation,
) {

    const assessment =
        investigation.assessment ?? {};

    return `
        <section
            class="investigation-section"
            aria-labelledby="investigation-assessment-title"
        >

            <div class="section-heading">

                <div>

                    <p class="eyebrow">
                        Assessment
                    </p>

                    <h2
                        id="investigation-assessment-title"
                    >
                        Current Assessment
                    </h2>

                </div>

            </div>

            <div class="assessment-card">

                ${
                    assessment.summary
                        ? `
                            <p>
                                ${escapeHtml(
                                    assessment.summary,
                                )}
                            </p>
                        `
                        : `
                            <p class="empty-state">
                                Signal Audit has not yet produced an operational assessment for this investigation.
                            </p>
                        `
                }

                <div class="assessment-meta">

                    <span>
                        Confidence:
                        ${
                            assessment.confidence != null
                                ? `${assessment.confidence}%`
                                : "Pending"
                        }
                    </span>

                    <span>
                        Updated:
                        ${
                            assessment.updatedAt
                                ? formatDate(
                                      assessment.updatedAt,
                                  )
                                : "—"
                        }
                    </span>

                </div>

            </div>

        </section>
    `;
}

function renderInvestigationEvidence(
    investigation,
) {

    const evidence =
        investigation.evidence ?? {};

    const signals =
      getInvestigationSignals(
          investigation,
      );

    return `
        <section
            class="investigation-section"
            aria-labelledby="investigation-evidence-title"
        >

            <div class="section-heading">

                <div>

                    <p class="eyebrow">
                        Evidence
                    </p>

                    <h2
                        id="investigation-evidence-title"
                    >
                        Supporting Evidence
                    </h2>

                </div>

            </div>

            <div
                class="evidence-grid"
            >

                ${renderSignalEvidenceCard(
                    signals,
                )}

                ${renderEvidenceCard(
                    "Metrics",
                    evidence.metrics?.length ?? 0,
                    "Correlated metric observations.",
                )}

                ${renderEvidenceCard(
                    "Deployments",
                    evidence.deployments?.length ?? 0,
                    "Related deployment events.",
                )}

                ${renderEvidenceCard(
                    "Logs",
                    evidence.logs?.length ?? 0,
                    "Collected log evidence.",
                )}

                ${renderEvidenceCard(
                    "Incidents",
                    evidence.incidents?.length ?? 0,
                    "Linked operational incidents.",
                )}

                ${renderEvidenceCard(
                    "Environments",
                    evidence.environments?.length ?? 0,
                    "Affected environments.",
                )}

            </div>

        </section>
    `;
}

function renderEvidenceCard(
    title,
    count,
    description,
) {

    return `
        <article
            class="evidence-card"
        >

            <div
                class="evidence-card__header"
            >

                <span
                    class="evidence-card__count"
                >
                    ${count}
                </span>

                <h3>
                    ${escapeHtml(title)}
                </h3>

            </div>

            <p
                class="evidence-card__description"
            >
                ${escapeHtml(description)}
            </p>

        </article>
    `;
}

function renderSignalEvidenceCard(
    signals,
) {

    return `
        <article
            class="evidence-card"
        >

            <div
                class="evidence-card__header"
            >

                <span
                    class="evidence-card__count"
                >
                    ${signals.length}
                </span>

                <h3>
                    Signals
                </h3>

            </div>

            ${
                signals.length === 0
                    ? `
                        <p
                            class="evidence-card__description"
                        >
                            No telemetry has been attached.
                        </p>
                    `
                    : `
                        <ul class="evidence-list">

                            ${signals
                                .map(
                                    (signal) => `
                                        <li>

                                            <strong>
                                                ${escapeHtml(
                                                    signal.signal?.title
                                                    ?? signal.service
                                                    ?? "Untitled Signal",
                                                )}
                                            </strong>

                                            <div class="detail-meta">

                                                ${createBadge(
                                                    signal.source,
                                                    "source",
                                                )}

                                                ${createBadge(
                                                    signal.severity,
                                                    "severity",
                                                )}

                                                ${createBadge(
                                                    signal.signal?.environment,
                                                    "environment",
                                                )}

                                            </div>

                                        </li>
                                    `,
                                )
                                .join("")}

                        </ul>
                    `
            }

        </article>
    `;

}

function renderInvestigationTimeline(
    investigation,
) {

    const events =
        investigation.timeline ?? [];

    return `
        <section
            class="investigation-section"
            aria-labelledby="investigation-timeline-title"
        >

            <div class="section-heading">

                <div>

                    <p class="eyebrow">
                        Timeline
                    </p>

                    <h2
                        id="investigation-timeline-title"
                    >
                        Investigation Timeline
                    </h2>

                </div>

            </div>

            ${
                events.length === 0
                    ? `
                        <p class="empty-state">
                            No timeline events have been recorded.
                        </p>
                    `
                    : `
                        <div class="investigation-timeline">

                            ${events
                                .map(
                                    (event) => `
                                        <article
                                            class="timeline-event"
                                        >

                                            <div
                                                class="timeline-event__marker"
                                            >
                                                ●
                                            </div>

                                            <div
                                                class="timeline-event__content"
                                            >

                                                <strong>
                                                    ${escapeHtml(
                                                        event.label,
                                                    )}
                                                </strong>

                                                <p>
                                                    ${escapeHtml(
                                                        formatDate(
                                                            event.timestamp,
                                                        ),
                                                    )}
                                                </p>

                                            </div>

                                        </article>
                                    `,
                                )
                                .join("")}

                        </div>
                    `
            }

        </section>
    `;

}

function renderInvestigationNavigation(
  investigation,
) {
  const signalCount =
    investigation.evidence?.signals?.length
    ?? 0;

  const findingsCount =
    getInvestigationSignals(
      investigation,
    ).flatMap(
      (signal) =>
        signal.analysis?.findings || [],
    ).length;

  const timelineCount =
    investigation.timeline?.length
    ?? 0;

  const recommendationCount =
    investigation.recommendations?.length
    ?? 0;

  return `
    <nav
      class="investigation-tabs"
      aria-label="Investigation sections"
      role="tablist"
    >
      <button
        id="investigation-overview-tab"
        class="${getInvestigationTabClass(
          "overview",
        )}"
        type="button"
        role="tab"
        data-investigation-view="overview"
        aria-controls="investigation-overview-panel"
        aria-selected="${
          state.activeInvestigationView
          === "overview"
        }"
      >
        Overview
      </button>

      <button
        id="investigation-findings-tab"
        class="${getInvestigationTabClass(
          "findings",
        )}"
        type="button"
        role="tab"
        data-investigation-view="findings"
        aria-controls="investigation-findings-panel"
        aria-selected="${
          state.activeInvestigationView
          === "findings"
        }"
      >
        Findings
        ${
          findingsCount > 0
            ? `<span>${findingsCount}</span>`
            : ""
        }
      </button>

      <button
        id="investigation-evidence-tab"
        class="${getInvestigationTabClass(
          "evidence",
        )}"
        type="button"
        role="tab"
        data-investigation-view="evidence"
        aria-controls="investigation-evidence-panel"
        aria-selected="${
          state.activeInvestigationView
          === "evidence"
        }"
      >
        Evidence
        ${
          signalCount > 0
            ? `<span>${signalCount}</span>`
            : ""
        }
      </button>

      <button
        id="investigation-timeline-tab"
        class="${getInvestigationTabClass(
          "timeline",
        )}"
        type="button"
        role="tab"
        data-investigation-view="timeline"
        aria-controls="investigation-timeline-panel"
        aria-selected="${
          state.activeInvestigationView
          === "timeline"
        }"
      >
        Timeline
        ${
          timelineCount > 0
            ? `<span>${timelineCount}</span>`
            : ""
        }
      </button>

      <button
        id="investigation-recommendations-tab"
        class="${getInvestigationTabClass(
          "recommendations",
        )}"
        type="button"
        role="tab"
        data-investigation-view="recommendations"
        aria-controls="investigation-recommendations-panel"
        aria-selected="${
          state.activeInvestigationView
          === "recommendations"
        }"
      >
        Recommendations
        ${
          recommendationCount > 0
            ? `<span>${recommendationCount}</span>`
            : ""
        }
      </button>
    </nav>
  `;
}

function renderInvestigationRecommendations(
    investigation,
) {

    const recommendations =
        investigation.recommendations ?? {};

    return `

        <section
            class="detail-section"
        >

            <h2>
                Recommendations
            </h2>

            ${renderRecommendationGroup(
                "Immediate",
                recommendations.immediate,
            )}

            ${renderRecommendationGroup(
                "Short-term",
                recommendations.shortTerm,
            )}

            ${renderRecommendationGroup(
                "Long-term",
                recommendations.longTerm,
            )}

        </section>

    `;

}

function renderRecommendationGroup(
    title,
    items = [],
) {

    if (!items.length) {

        return `
            <div class="recommendation-group">

                <h3>
                    ${escapeHtml(title)}
                </h3>

                <p class="empty-state">
                    No recommendations.
                </p>

            </div>
        `;

    }

    return `

        <div class="recommendation-group">

            <h3>
                ${escapeHtml(title)}
            </h3>

            <ul>

                ${items.map(
                    item => `

                        <li>

                            ${escapeHtml(item)}

                        </li>

                    `,
                ).join("")}

            </ul>

        </div>

    `;

}

function renderInvestigationDetail(
  investigation,
) {
  const panel =
    document.querySelector(
      "#investigation-detail-panel",
    );

  if (!panel) {
    return;
  }

  if (!investigation) {
    panel.innerHTML = `
      <div class="investigation-empty-state">
        <p class="eyebrow">
          Investigation workspace
        </p>

        <h2>
          Select an investigation
        </h2>

        <p>
          Choose an investigation to review
          its assessment, evidence, findings,
          timeline, and recommendations.
        </p>
      </div>
    `;

    return;
  }

  const confidence =
    investigation.confidence
    ?? investigation.assessment?.confidence;

  panel.innerHTML = `
    <article
      class="investigation-detail"
      aria-labelledby="investigation-detail-title"
    >
      <header
        class="
          investigation-detail__header
          detail-header
        "
      >
        <div class="detail-meta">
          ${createBadge(
            investigation.status
            || "investigating",
            "state",
          )}

          ${createBadge(
            investigation.severity,
            "severity",
          )}

          ${createBadge(
            investigation.source,
            "source",
          )}

          ${
            confidence !== null
            && confidence !== undefined
              ? createBadge(
                  `${confidence}% confidence`,
                  "confidence",
                )
              : ""
          }
        </div>

        <div class="investigation-detail__heading">
          <div>
            <p class="eyebrow">
              Operational investigation
            </p>

            <h2
              id="investigation-detail-title"
            >
              ${escapeHtml(
                investigation.title
                || "Untitled investigation",
              )}
            </h2>

            ${
              investigation.question
                ? `
                    <p
                      class="
                        investigation-detail__question
                      "
                    >
                      ${escapeHtml(
                        investigation.question,
                      )}
                    </p>
                  `
                : ""
            }
          </div>
        </div>

        <div class="investigation-header-summary">
          <div>
            <span>Status</span>

            <strong>
              ${escapeHtml(
                investigation.status
                || "Investigating",
              )}
            </strong>
          </div>

          <div>
            <span>Owner</span>

            <strong>
              ${escapeHtml(
                investigation.owner
                || "Unassigned",
              )}
            </strong>
          </div>

          <div>
            <span>Updated</span>

            <strong>
              ${escapeHtml(
                formatCompactDate(
                  investigation.updatedAt
                  || investigation.createdAt,
                ),
              )}
            </strong>
          </div>
        </div>

        ${renderInvestigationNavigation(
          investigation,
        )}
      </header>

      <div class="investigation-detail__body">
        <section
          id="investigation-overview-panel"
          class="${getInvestigationPanelClass(
            "overview",
          )}"
          role="tabpanel"
          aria-labelledby="investigation-overview-tab"
          ${
            state.activeInvestigationView
            === "overview"
              ? ""
              : "hidden"
          }
        >
          ${renderInvestigationAssessment(
            investigation,
          )}

          ${renderInvestigationOverview(
            investigation,
          )}
        </section>

        <section
          id="investigation-findings-panel"
          class="${getInvestigationPanelClass(
            "findings",
          )}"
          role="tabpanel"
          aria-labelledby="investigation-findings-tab"
          ${
            state.activeInvestigationView
            === "findings"
              ? ""
              : "hidden"
          }
        >
          ${renderInvestigationFindings(
            investigation,
          )}
        </section>

        <section
          id="investigation-evidence-panel"
          class="${getInvestigationPanelClass(
            "evidence",
          )}"
          role="tabpanel"
          aria-labelledby="investigation-evidence-tab"
          ${
            state.activeInvestigationView
            === "evidence"
              ? ""
              : "hidden"
          }
        >
          ${renderInvestigationEvidence(
            investigation,
          )}
        </section>

        <section
          id="investigation-timeline-panel"
          class="${getInvestigationPanelClass(
            "timeline",
          )}"
          role="tabpanel"
          aria-labelledby="investigation-timeline-tab"
          ${
            state.activeInvestigationView
            === "timeline"
              ? ""
              : "hidden"
          }
        >
          ${renderInvestigationTimeline(
            investigation,
          )}
        </section>

        <section
          id="investigation-recommendations-panel"
          class="${getInvestigationPanelClass(
            "recommendations",
          )}"
          role="tabpanel"
          aria-labelledby="investigation-recommendations-tab"
          ${
            state.activeInvestigationView
            === "recommendations"
              ? ""
              : "hidden"
          }
        >
          ${renderInvestigationRecommendations(
            investigation,
          )}
        </section>
      </div>
    </article>
  `;

  panel
    .querySelectorAll(
      "[data-investigation-view]",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const nextView =
            button.dataset
              .investigationView;

          if (
            !nextView
            || nextView ===
              state.activeInvestigationView
          ) {
            return;
          }

          state.activeInvestigationView =
            nextView;

          renderInvestigationDetail(
            investigation,
          );
        },
      );
    });
}

function renderInvestigationsWorkspace() {
  const container =
    document.querySelector(
      "#investigations-results",
    );

  if (!container) {
    return;
  }

  if (
    !state.selectedInvestigationId &&
    state.investigations.length
  ) {
    state.selectedInvestigationId =
      state.investigations[0].id;
  }

  if (
    state.investigations.length === 0
  ) {
    container.innerHTML = `
      <div class="list-message">

        <p class="list-message__title">
          No investigations yet
        </p>

        <p>
          Open a signal and select
          Start Investigation.
        </p>

      </div>
    `;

    return;
  }

  container.innerHTML =
    state.investigations
      .map(
        (investigation) => `
          <button
            class="
              investigation-list-card
              ${
                investigation.id ===
                state.selectedInvestigationId
                  ? "is-active"
                  : ""
              }
            "
            type="button"
            data-investigation-id="${escapeHtml(
              investigation.id,
            )}"
            aria-pressed="${
              investigation.id ===
              state.selectedInvestigationId
            }"
          >

            <div class="detail-meta">

              ${createBadge(
                investigation.status,
                "state",
              )}

              ${createBadge(
                investigation.severity,
                "severity",
              )}

              ${createBadge(
                investigation.source,
                "source",
              )}

            </div>

            <h3>
              ${escapeHtml(
                investigation.title,
              )}
            </h3>

            <p class="integration-card__connection">
              ${escapeHtml(
                [
                  investigation.service,
                  investigation.environment,
                ]
                  .filter(Boolean)
                  .join(" · "),
              )}
            </p>

            <p class="signal-card__summary">
              ${escapeHtml(
                investigation.summary,
              )}
            </p>

            <footer class="signal-card__footer">

              <span>
                ${escapeHtml(
                  formatCompactDate(
                    investigation.createdAt,
                  ),
                )}
              </span>

              <span aria-hidden="true">
                →
              </span>

            </footer>

          </button>
        `,
      )
      .join("");

      container
      .querySelectorAll(
        "[data-investigation-id]",
      )
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {
            state.selectedInvestigationId =
              button.dataset.investigationId;

            state.activeInvestigationView =
              "overview";

            renderInvestigationsWorkspace();
          },
        );;

      });

  const selected =
    state.investigations.find(
      (investigation) =>
        String(investigation.id) ===
        String(state.selectedInvestigationId),
    );

  renderInvestigationDetail(
    selected || null,
  );
}

export {
  renderInvestigationFindings,
  renderInvestigationOverview,
  renderOverviewMetric,
  renderInvestigationAssessment,
  renderInvestigationEvidence,
  renderEvidenceCard,
  renderSignalEvidenceCard,
  renderInvestigationTimeline,
  renderInvestigationNavigation,
  renderInvestigationRecommendations,
  renderRecommendationGroup,
  renderInvestigationDetail,
  renderInvestigationsWorkspace,
};