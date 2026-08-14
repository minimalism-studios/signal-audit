const state = {
  session:
    null,

  currentUser:
    null,

  signals: [],
  historySignals: [],
  historyPagination: null,

  operationalMemoryDocuments: [],
  selectedOperationalMemoryId: null,

  integrations: [],
  environments: [],
  selectedEnvironmentId: null,
  liveSignalsFilters: {
    source: "",
    environment: "",
    state: "",
    severity: "",
  },

  selectedSignalId: null,
  selectedSignalDetail: null,

  investigations: [],
  selectedInvestigationId: null,

  integrationDetails: {},
  integrationDetailLoadingId: null,
  integrationMode: "view",
  dashboard: null,

  activeDetailView: "overview",
  activeWorkspace: "live-signals",

  historyFilters: {
    query: "",
    source: "",
    environment: "",
    severity: "",
    state: "",
    startDate: "",
    endDate: "",
    page: 1,
    pageSize: 20,
  },
};

const signalList =
  document.querySelector(
    "#signal-list",
  );

const detailPanel =
  document.querySelector(
    "#detail-panel",
  );

const sourceFilter =
  document.querySelector(
    "#source-filter",
  );

const stateFilter =
  document.querySelector(
    "#state-filter",
  );

const severityFilter =
  document.querySelector(
    "#severity-filter",
  );

const refreshButton =
  document.querySelector(
    "#refresh-button",
  );

const addIntegrationButton =
  document.querySelector(
    "#add-integration-button",
  );

const workspaceTitle =
  document.querySelector(
    "#workspace-title",
  );

const liveSignalsWorkspace =
  document.querySelector(
    "#live-signals-workspace",
  );

const secondaryWorkspace =
  document.querySelector(
    "#secondary-workspace",
  );

const applicationContent =
  document.querySelector(
    ".application-content",
  );

const workspaceButtons = [
  ...document.querySelectorAll(
    "[data-workspace]",
  ),
];

function applyWorkspaceVisibility() {
  if (
    !window
      .SignalAuditWorkspaces
  ) {
    return;
  }

  const visibleWorkspaces =
    new Set(
      window
        .SignalAuditWorkspaces
        .getVisibleWorkspaces(),
    );

  workspaceButtons.forEach(
    (button) => {
      const workspace =
        button.dataset
          .workspace;

      button.hidden =
        !visibleWorkspaces.has(
          workspace,
        );

      button.setAttribute(
        "aria-hidden",
        String(
          button.hidden,
        ),
      );

      if (
        button.hidden
        && button.getAttribute(
          "aria-current",
        ) === "page"
      ) {
        button.removeAttribute(
          "aria-current",
        );
      }
    },
  );
}

const productShell =
  document.querySelector(
    ".product-shell",
  );

const sidebarToggle =
  document.querySelector(
    "#sidebar-toggle",
  );

const sidebarStorageKey =
  "signal-audit-sidebar-state";

const settingsStorageKeys = {
  theme:
    "signal-audit-theme",

  defaultWorkspace:
    "signal-audit-default-workspace",

  defaultSidebar:
    "signal-audit-default-sidebar",

  autoRefresh:
    "signal-audit-auto-refresh",
};

const defaultSettings = {
  theme:
    "dark",

  defaultWorkspace:
    "live-signals",

  defaultSidebar:
    "expanded",

  autoRefresh:
    false,
};

const LIVE_SIGNALS_REFRESH_INTERVAL_MS =
  5000;

let liveSignalsRefreshTimer =
  null;

let liveSignalsRequestInFlight =
  false;

function updateSidebarToggle(
  sidebarState,
) {
  if (!sidebarToggle) {
    return;
  }

  const isExpanded =
    sidebarState === "expanded";

  sidebarToggle.setAttribute(
    "aria-expanded",
    String(isExpanded),
  );

  sidebarToggle.setAttribute(
    "aria-label",
    isExpanded
      ? "Collapse navigation"
      : "Expand navigation",
  );
}

function setSidebarState(
  sidebarState,
  {
    persist = true,
  } = {},
) {
  if (!productShell) {
    return;
  }

  const resolvedState =
    sidebarState === "collapsed"
      ? "collapsed"
      : "expanded";

  productShell.dataset.sidebarState =
    resolvedState;

  updateSidebarToggle(
    resolvedState,
  );

  if (persist) {
    window.localStorage.setItem(
      sidebarStorageKey,
      resolvedState,
    );
  }
}

function initializeSidebar() {
  if (
    !productShell
    || !sidebarToggle
  ) {
    return;
  }

  const savedState =
    window.localStorage.getItem(
      sidebarStorageKey,
    );

  const defaultSidebar =
    getStoredSetting(
      settingsStorageKeys
        .defaultSidebar,
      defaultSettings
        .defaultSidebar,
    );

  setSidebarState(
    savedState
    || defaultSidebar,
    {
      persist: false,
    },
  );

  sidebarToggle.addEventListener(
    "click",
    () => {
      const nextState =
        productShell.dataset.sidebarState
          === "collapsed"
          ? "expanded"
          : "collapsed";

      setSidebarState(
        nextState,
      );
    },
  );
}

function getStoredSetting(
  key,
  fallbackValue,
) {
  const storedValue =
    window.localStorage.getItem(
      key,
    );

  return storedValue === null
    ? fallbackValue
    : storedValue;
}

function getBooleanSetting(
  key,
  fallbackValue = false,
) {
  const storedValue =
    window.localStorage.getItem(
      key,
    );

  if (storedValue === null) {
    return fallbackValue;
  }

  return storedValue === "true";
}

function getResolvedTheme(
  preference,
) {
  if (preference === "system") {
    return window.matchMedia(
      "(prefers-color-scheme: light)",
    ).matches
      ? "light"
      : "dark";
  }

  return preference === "light"
    ? "light"
    : "dark";
}

function applyTheme(
  preference,
  {
    persist = true,
  } = {},
) {
  const allowedThemes = [
    "dark",
    "light",
    "system",
  ];

  const resolvedPreference =
    allowedThemes.includes(
      preference,
    )
      ? preference
      : defaultSettings.theme;

  const resolvedTheme =
    getResolvedTheme(
      resolvedPreference,
    );

  document.documentElement.dataset.theme =
    resolvedTheme;

  document.documentElement.dataset.themePreference =
    resolvedPreference;

  if (persist) {
    window.localStorage.setItem(
      settingsStorageKeys.theme,
      resolvedPreference,
    );
  }
}

function initializeTheme() {
  const savedTheme =
    getStoredSetting(
      settingsStorageKeys.theme,
      defaultSettings.theme,
    );

  applyTheme(
    savedTheme,
    {
      persist: false,
    },
  );

  const systemTheme =
    window.matchMedia(
      "(prefers-color-scheme: light)",
    );

  systemTheme.addEventListener(
    "change",
    () => {
      const preference =
        getStoredSetting(
          settingsStorageKeys.theme,
          defaultSettings.theme,
        );

      if (preference === "system") {
        applyTheme(
          "system",
          {
            persist: false,
          },
        );
      }
    },
  );
}

function getApplicationSettings() {
  return {
    theme:
      getStoredSetting(
        settingsStorageKeys.theme,
        defaultSettings.theme,
      ),

    defaultWorkspace:
      getStoredSetting(
        settingsStorageKeys
          .defaultWorkspace,
        defaultSettings
          .defaultWorkspace,
      ),

    defaultSidebar:
      getStoredSetting(
        settingsStorageKeys
          .defaultSidebar,
        defaultSettings
          .defaultSidebar,
      ),

    autoRefresh:
      getBooleanSetting(
        settingsStorageKeys.autoRefresh,
        defaultSettings.autoRefresh,
      ),
  };
}


const workspaceDefinitions = {
    dashboard: {
    title: "SIGNAL INTERPRETER",
    eyebrow: "Operational intelligence",
    heading: "Dashboard",
    description:
      "Review the operational status of your environment, recent activity, and connected telemetry.",
  },
  "live-signals": {
    title: "SIGNAL INTERPRETER",
    eyebrow: "Operational intelligence",
    heading: "Live Signals",
    description:
      "Review active telemetry signals and their structured operational findings.",
  },
  investigations: {
    title: "INVESTIGATIONS",
    eyebrow: "Operational intelligence",
    heading: "Investigations",
    description:
      "Review active operational investigations, ownership, and resolution progress.",
  },
  history: {
    title: "OPERATIONAL MEMORY",
    eyebrow: "Organizational Intelligence",
    heading: "Signal History",
    description:
      "Search historical signals and investigations, identify recurring operational patterns, and reopen previous incidents.",
  },
  integrations: {
    title: "INTEGRATIONS",
    eyebrow: "Telemetry connections",
    heading: "Integrations",
    description:
      "Manage the systems that send telemetry into Signal Audit.",
  },
  environments: {
    title: "ENVIRONMENTS",
    eyebrow: "Platform environments",
    heading: "Environments",
    description:
      "Review and manage Signal Audit environments, deployment health, and connected telemetry.",
  },
  settings: {
    title: "SETTINGS",
    eyebrow: "Platform configuration",
    heading: "Settings",
    description:
      "Manage platform preferences and future organizational settings.",
  },
};

function getWorkspaceFromHash() {
  return window
    .SignalAuditWorkspaces
    .resolveWorkspace(
      window.location.hash,
    );
}

function debounce(
  callback,
  delay = 250,
) {
  let timeoutId;

  return (...args) => {
    window.clearTimeout(
      timeoutId,
    );

    timeoutId = window.setTimeout(
      () => {
        callback(...args);
      },
      delay,
    );
  };
}

function bindHistoryControls() {
  const historySearch =
    document.getElementById(
      "history-search",
    );

  const historySource =
    document.getElementById(
      "history-source",
    );

  const historySeverity =
    document.getElementById(
      "history-severity",
    );

  const historyState =
    document.getElementById(
      "history-state",
    );

  const historyStartDate =
    document.getElementById(
      "history-start-date",
    );

  const historyEndDate =
    document.getElementById(
      "history-end-date",
    );

  const historyClear =
    document.getElementById(
      "history-clear",
    );

  if (
    !historySearch
    || !historySource
    || !historySeverity
    || !historyState
  ) {
    return;
  }

  historySearch.value =
    state.historyFilters.query;

  historySource.value =
    state.historyFilters.source;

  historySeverity.value =
    state.historyFilters.severity;

  historyState.value =
    state.historyFilters.state;

  historyStartDate.value =
    state.historyFilters.startDate;

  historyEndDate.value =
    state.historyFilters.endDate;

  const handleHistorySearch =
    debounce(
      () => {
        state.historyFilters.query =
          historySearch.value.trim();

        state.historyFilters.page = 1;

        loadHistoryWorkspace();
      },
      300,
    );

  historySearch.addEventListener(
    "input",
    handleHistorySearch,
  );

  historySource.addEventListener(
    "change",
    () => {
      state.historyFilters.source =
        historySource.value;

      state.historyFilters.page = 1;

      loadHistoryWorkspace();
    },
  );

  historySeverity.addEventListener(
    "change",
    () => {
      state.historyFilters.severity =
        historySeverity.value;

      state.historyFilters.page = 1;

      loadHistoryWorkspace();
    },
  );

  historyState.addEventListener(
    "change",
    () => {
      state.historyFilters.state =
        historyState.value;

      state.historyFilters.page = 1;

      loadHistoryWorkspace();
    },
  );

  historyStartDate.addEventListener(
    "change",
    () => {
      state.historyFilters.startDate =
        historyStartDate.value;

      state.historyFilters.page = 1;

      loadHistoryWorkspace();
    },
  );

  historyEndDate.addEventListener(
    "change",
    () => {
      state.historyFilters.endDate =
        historyEndDate.value;

      state.historyFilters.page = 1;

      loadHistoryWorkspace();
    },
  );

  historyClear.addEventListener(
    "click",
    () => {
      Object.assign(
        state.historyFilters,
        {
          query: "",
          source: "",
          severity: "",
          state: "",
          startDate: "",
          endDate: "",
          page: 1,
        },
      );

      historySearch.value = "";

      historySource.value = "";

      historySeverity.value = "";

      historyState.value = "";

      historyStartDate.value = "";

      historyEndDate.value = "";

      loadHistoryWorkspace();
    },
  );

}

async function loadHistoryFilters() {
  const response =
    await fetch(
      "/api/signal-interpreter/filters",
    );

  if (!response.ok) {
    throw new Error(
      "Unable to load history filters.",
    );
  }

  const filters =
    await response.json();

  populateHistorySelect(
    "history-source",
    "All Sources",
    filters.sources,
    state.historyFilters.source,
  );

  populateHistorySelect(
    "history-severity",
    "All Severities",
    filters.severities,
    state.historyFilters.severity,
  );

  populateHistorySelect(
    "history-state",
    "All States",
    filters.states,
    state.historyFilters.state,
  );
}

function populateHistorySelect(
  id,
  placeholder,
  values,
  selectedValue,
) {
  const select =
    document.getElementById(id);

  if (!select) {
    return;
  }

  select.innerHTML =
    [
      `
        <option value="">
          ${placeholder}
        </option>
      `,
      ...values.map(
        (value) => `
          <option
            value="${escapeHtml(value)}"
          >
            ${escapeHtml(value)}
          </option>
        `,
      ),
    ].join("");

  select.value =
    selectedValue || "";
}

function getSignalRecordById(
  signalId,
) {
  if (!signalId) {
    return null;
  }

  if (
    state.selectedSignalDetail?.id
    === signalId
  ) {
    return state.selectedSignalDetail;
  }

  const liveSignal =
    state.signals.find(
      (signal) =>
        signal.id === signalId,
    );

  if (liveSignal) {
    return liveSignal;
  }

  const historySignal =
    state.historySignals.find(
      (signal) =>
        signal.id === signalId,
    );

  return historySignal || null;
}

function getInvestigationSignals(
    investigation,
) {

    const signalIds =
        investigation?.evidence?.signals;

    if (
        !Array.isArray(signalIds)
    ) {
        return [];
    }

    return signalIds
        .map(getSignalRecordById)
        .filter(Boolean);

}

function getPrimaryInvestigationSignal(
  investigation,
) {
  return (
    getInvestigationSignals(
      investigation,
    )[0] || null
  );
}

/* ==========================================================
   Operational Assessment
   ========================================================== */

function buildOperationalAssessment(
  investigation,
) {
  const findings =
    Array.isArray(
      investigation?.findings,
    )
      ? investigation.findings
      : [];

  const evidence =
    investigation?.evidence ?? {};

  const recommendations =
    investigation?.recommendations ?? {};

  let score = 50;

  const reasons = [];

  if (findings.length > 0) {
    score += 20;

    reasons.push(
      "Structured findings available",
    );
  }

  if (
    (evidence.signals ?? []).length > 0
  ) {
    score += 10;

    reasons.push(
      "Supporting operational evidence collected",
    );
  }

  if (
    (investigation.assessment?.confidence ?? 0)
    >= 90
  ) {
    score += 10;

    reasons.push(
      "High-confidence assessment",
    );
  }

  const recommendationCount =
    (recommendations.immediate ?? []).length
    + (recommendations.shortTerm ?? []).length
    + (recommendations.longTerm ?? []).length;

  if (recommendationCount > 0) {
    score += 5;

    reasons.push(
      "Recommendations generated",
    );
  }

  if (
    investigation.service
  ) {
    score += 5;

    reasons.push(
      "Single affected service",
    );
  }

  if (
    (evidence.environments ?? []).length
    > 1
  ) {
    score -= 10;

    reasons.push(
      "Multiple environments involved",
    );
  }

  score = Math.max(
    0,
    Math.min(
      100,
      score,
    ),
  );

  let level = "Low";

  if (score >= 90) {
    level = "High";
  } else if (score >= 70) {
    level = "Medium";
  }

  let summary =
  "Signal Audit recommends gathering additional operational evidence before confirming the current assessment.";

  if (score >= 90) {
    summary =
      "Signal Audit has high confidence because multiple independent sources corroborate the current operational assessment.";
  }
  else if (score >= 70) {
    summary =
      "Signal Audit has moderate confidence. Additional evidence may strengthen this investigation.";
  }

  return {
    score,
    level,
    summary,
    reasons,
  };
}

function renderOperationalAssessment(
  investigation,
) {
  const assessment =
    buildOperationalAssessment(
      investigation,
    );

  return `
    <section
      class="
        signal-section
        shared-detail-section
        investigation-operational-assessment
      "
      aria-labelledby="investigation-operational-assessment-title"
    >
      <header
        class="signal-section__header"
      >
        <p class="eyebrow">
          Operational reasoning
        </p>

        <h2
          id="investigation-operational-assessment-title"
        >
          Operational Assessment
        </h2>

        <p class="signal-section__lead">
          Signal Audit’s current evaluation of
          the strength and completeness of this
          investigation.
        </p>
      </header>

      <div
        class="investigation-operational-assessment__summary"
      >
        <div
          class="investigation-operational-assessment__score"
        >
          <span>
            ${assessment.score}%
          </span>

          <strong>
            ${escapeHtml(
              assessment.level.toUpperCase(),
            )}
            CONFIDENCE
          </strong>

          <p
            class="
              investigation-operational-assessment__summary-copy
            "
          >
            ${escapeHtml(
              assessment.summary,
            )}
          </p>
        </div>

        <div
          class="investigation-operational-assessment__reasons"
        >
          <p class="eyebrow">
            Why this score
          </p>

          <ul
            class="
              investigation-operational-assessment__checklist
            "
          >
            ${assessment.reasons
              .map(
                (reason) => `
                  <li>
                    <span
                      class="
                        investigation-operational-assessment__check
                      "
                    >
                      ✓
                    </span>
                    ${escapeHtml(
                      reason,
                    )}
                  </li>
                `,
              )
              .join("")}
          </ul>
        </div>
      </div>
    </section>
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
      <div
        class="
          empty-state
          shared-detail-empty
        "
      >

        <p class="eyebrow">
          Investigation
        </p>

        <h2>
          Select an investigation
        </h2>

        <p>
          Choose an investigation to review
          its operational assessment,
          evidence, findings, timeline,
          and recommendations.
        </p>

      </div>
    `;

    return;
  }

  panel.innerHTML = `
    <article
      class="
        investigation-detail
        signal-document
        split-workspace__document
        shared-detail-panel
      "
      aria-labelledby="investigation-detail-title"
    >

      <header
        class="
          signal-document__hero
          investigation-detail__header
          detail-header
          shared-detail-header
        "
      >

        <div
          class="
            signal-document__hero-content
            shared-detail-header-content
          "
        >

          <p class="eyebrow">
            Investigation
          </p>

          <h1
            id="investigation-detail-title"
          >
            ${escapeHtml(
              investigation.title,
            )}
          </h1>

          <p
            class="
              signal-document__summary
              investigation-question
              detail-summary
              shared-detail-summary
            "
          >
            ${escapeHtml(
              investigation.question,
            )}
          </p>

        </div>

        <div
          class="
            investigation-detail__header-actions
            shared-detail-actions
          "
        >
          <div
            class="
              signal-document__badges
              detail-meta
              shared-detail-meta
            "
          >

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

          ${(() => {
            const action =
              getInvestigationPrimaryAction(
                investigation.status,
              );

            if (!action) {
              return "";
            }

            return `
              <button
                class="secondary-button investigation-detail__resolve-button ${action.className}"
                type="button"
                ${action.scroll ? "data-scroll-resolution" : ""}
              >
                ${action.label}
              </button>
            `;
          })()}

          <button
            type="button"
            class="secondary-button"
            data-open-memory="${escapeHtml(
              investigation.id,
            )}"
          >
            Open Operational Memory →
          </button>
        </div>

        ${renderInvestigationControls(
          investigation,
        )}

      </header>

      <div
        class="
          signal-document__content
          investigation-detail__sections
        "
      >

        ${renderOperationalAssessment(
          investigation,
        )}

        ${renderInvestigationOverview(
          investigation,
        )}

        ${renderInvestigationAssessment(
          investigation,
        )}

        ${renderInvestigationEvidence(
          investigation,
        )}

        ${renderInvestigationFindings(
          investigation,
        )}

        ${renderInvestigationTimeline(
          investigation,
        )}

        ${renderInvestigationRecommendations(
          investigation,
        )}

        ${renderInvestigationResolution(
          investigation,
        )}

      </div>

    </article>
  `;
}

function renderInvestigationFindings(
  investigation,
) {
  const persistedFindings =
    Array.isArray(
      investigation?.findings,
    )
      ? investigation.findings
      : [];

  const linkedSignalFindings =
    getInvestigationSignals(
      investigation,
    ).flatMap(
      signal =>
        signal.analysis?.findings || [],
    );

  const findings =
    persistedFindings.length > 0
      ? persistedFindings
      : linkedSignalFindings;

  if (
    !Array.isArray(findings)
    || findings.length === 0
  ) {
    return `
      <section
        class="
          signal-section
          shared-detail-section
          investigation-findings
        "
      >

        <header
          class="signal-section__header"
        >

          <p class="eyebrow">
            Findings
          </p>

          <h2>
            Operational Findings
          </h2>

        </header>

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
      class="
        signal-section
        shared-detail-section
        investigation-findings
      "
      aria-labelledby="investigation-findings-title"
    >

      <header
        class="signal-section__header"
      >

        <div>

          <p class="eyebrow">
            Findings
          </p>

          <h2
            id="investigation-findings-title"
          >
            Operational Findings
          </h2>

        </div>

        ${createBadge(
          `${findings.length} finding${
            findings.length === 1
              ? ""
              : "s"
          }`,
          "finding-count",
        )}

      </header>

      <div
        class="
          findings
          findings-grid
        "
      >

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
      (
        investigation.recommendations
          ?.immediate
          ?.length
        ?? 0
      )
      + (
        investigation.recommendations
          ?.shortTerm
          ?.length
        ?? 0
      )
      + (
        investigation.recommendations
          ?.longTerm
          ?.length
        ?? 0
      );

    return `
        <section
            class="
                signal-section
        shared-detail-section
                investigation-overview
            "
            aria-labelledby="investigation-overview-title"
        >

            <header
                class="signal-section__header"
            >

                <p class="eyebrow">
                    Executive Summary
                </p>

                <h2
                    id="investigation-overview-title"
                >
                    Investigation Overview
                </h2>

                <p
                    class="signal-section__lead"
                >
                    ${escapeHtml(
                        investigation.summary ??
                        "Operational investigation in progress.",
                    )}
                </p>

            </header>

            <dl class="signal-facts">

                ${renderFact(
                    "Status",
                    formatIntegrationName(
                        investigation.status
                        ?? "Investigating",
                    ),
                )}

                ${renderFact(
                    "Severity",
                    formatIntegrationName(
                        investigation.severity
                        ?? "Unknown",
                    ),
                )}

                ${renderFact(
                    "Confidence",
                    investigation.assessment?.confidence != null
                        ? `${investigation.assessment.confidence}%`
                        : "Pending",
                )}

                ${renderFact(
                    "Signals",
                    String(
                        signalCount,
                    ),
                )}

                ${renderFact(
                    "Metrics",
                    String(
                        metricCount,
                    ),
                )}

                ${renderFact(
                    "Deployments",
                    String(
                        deploymentCount,
                    ),
                )}

                ${renderFact(
                    "Incidents",
                    String(
                        incidentCount,
                    ),
                )}

                ${renderFact(
                    "Recommendations",
                    String(
                        recommendationCount,
                    ),
                )}

                ${renderIntegrationTimeFact(
                    "Last updated",
                    investigation.updatedAt,
                )}

            </dl>

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
            class="
                signal-section
        shared-detail-section
                investigation-assessment
            "
            aria-labelledby="investigation-assessment-title"
        >

            <header
                class="signal-section__header"
            >

                <p class="eyebrow">
                    Operational Assessment
                </p>

                <h2
                    id="investigation-assessment-title"
                >
                    Current Assessment
                </h2>

            </header>

            <article
                class="
                    assessment-card
                    executive-card
                "
            >

                ${
                    assessment.summary
                        ? `
                            <p
                                class="assessment-summary"
                            >
                                ${escapeHtml(
                                    assessment.summary,
                                )}
                            </p>
                        `
                        : `
                            <p class="empty-state">
                                Signal Audit has not yet produced an operational assessment.
                            </p>
                        `
                }

                <div
                    class="
                        assessment-meta
                        executive-card__meta
                    "
                >

                    <span>

                        <strong>
                            Confidence
                        </strong>

                        ${
                            assessment.confidence != null
                                ? `${assessment.confidence}%`
                                : "Pending"
                        }

                    </span>

                    <span>

                        <strong>
                            Updated
                        </strong>

                        ${
                            assessment.updatedAt
                                ? formatDate(
                                      assessment.updatedAt,
                                  )
                                : "—"
                        }

                    </span>

                </div>

            </article>

        </section>
    `;
}

/* ==========================================================
   Evidence Intelligence
   ========================================================== */

function buildEvidenceIntelligence(
  investigation,
) {
  const evidence =
    investigation?.evidence
    ?? {};

  const persistedFindings =
    Array.isArray(
      investigation?.findings,
    )
      ? investigation.findings
      : [];

  const linkedSignalFindings =
    getInvestigationSignals(
      investigation,
    ).flatMap(
      (signal) =>
        Array.isArray(
          signal.analysis?.findings,
        )
          ? signal.analysis.findings
          : [],
    );

  const findings =
    persistedFindings.length > 0
      ? persistedFindings
      : linkedSignalFindings;

  function uniqueStrings(
    values,
  ) {
    const results = [];

    const seen =
      new Set();

    for (
      const value
      of Array.isArray(values)
        ? values.flat(Infinity)
        : []
    ) {
      if (
        typeof value
        !== "string"
      ) {
        continue;
      }

      const normalized =
        value.trim();

      const identity =
        normalized.toLowerCase();

      if (
        !normalized
        || seen.has(identity)
      ) {
        continue;
      }

      seen.add(identity);

      results.push(
        normalized,
      );
    }

    return results;
  }

  const supporting =
    uniqueStrings(
      findings.map(
        (finding) =>
          finding?.evidence
          ?? [],
      ),
    );

  const conflicting =
    uniqueStrings([
      evidence.conflicting
      ?? [],

      findings.map(
        (finding) =>
          finding?.conflictingEvidence
          ?? [],
      ),
    ]);

  const signalCount =
    Array.isArray(
      evidence.signals,
    )
      ? evidence.signals.length
      : 0;

  if (
    supporting.length === 0
    && signalCount > 0
  ) {
    supporting.push(
      `${signalCount} linked telemetry signal${
        signalCount === 1
          ? ""
          : "s"
      } support this investigation.`,
    );
  }

  const missing = [];

  const evidenceCategories = [
    {
      key:
        "metrics",

      label:
        "Correlated metrics",
    },

    {
      key:
        "logs",

      label:
        "Supporting logs",
    },

    {
      key:
        "deployments",

      label:
        "Deployment history",
    },

    {
      key:
        "incidents",

      label:
        "Related incidents",
    },
  ];

  evidenceCategories.forEach(
    ({
      key,
      label,
    }) => {
      if (
        !Array.isArray(
          evidence[key],
        )
        || evidence[key].length === 0
      ) {
        missing.push(
          label,
        );
      }
    },
  );

  let quality =
    "Limited";

  if (
    supporting.length >= 4
  ) {
    quality =
      "Strong";
  } else if (
    supporting.length >= 2
  ) {
    quality =
      "Moderate";
  }

  let summary =
    "Evidence is currently limited. Additional operational context would strengthen this investigation.";

  if (
    quality === "Strong"
  ) {
    summary =
      missing.length > 0
        ? "The available evidence strongly supports the current assessment, with additional context still available to collect."
        : "Multiple observations strongly support the current operational assessment.";
  } else if (
    quality === "Moderate"
  ) {
    summary =
      "The available evidence supports the current assessment, but additional corroboration would improve confidence.";
  }

  return {
    quality,
    summary,

    counts: {
      supporting:
        supporting.length,

      conflicting:
        conflicting.length,

      missing:
        missing.length,
    },

    supporting,
    conflicting,
    missing,
  };
}

function renderEvidenceIntelligence(
  investigation,
) {
  const intelligence =
    buildEvidenceIntelligence(
      investigation,
    );

  return `
    <div
      class="
        investigation-evidence-intelligence
        investigation-intelligence-report
      "
    >
      <header
        class="
          investigation-evidence-intelligence__heading
          investigation-intelligence-report__header
        "
      >
        <div>
          <p class="eyebrow">
            Evidence reasoning
          </p>

          <h3>
            Evidence Intelligence
          </h3>
        </div>

        ${createBadge(
          `${intelligence.quality} evidence`,
          "evidence-quality",
        )}
      </header>

      <p
        class="
          investigation-evidence-intelligence__summary
          investigation-intelligence-report__summary
        "
      >
        ${escapeHtml(
          intelligence.summary,
        )}
      </p>

      <dl
        class="
          signal-facts
          investigation-evidence-intelligence__facts
        "
      >
        ${renderFact(
          "Evidence quality",
          intelligence.quality,
        )}

        ${renderFact(
          "Supporting evidence",
          String(
            intelligence.counts.supporting,
          ),
        )}

        ${renderFact(
          "Conflicting evidence",
          String(
            intelligence.counts.conflicting,
          ),
        )}

        ${renderFact(
          "Missing evidence",
          String(
            intelligence.counts.missing,
          ),
        )}
      </dl>

      <div
        class="investigation-evidence-intelligence__groups"
      >
        ${renderEvidenceIntelligenceGroup({
          title:
            "Supporting Evidence",

          items:
            intelligence.supporting,

          type:
            "supporting",

          emptyMessage:
            "No supporting observations have been recorded.",
        })}

        ${renderEvidenceIntelligenceGroup({
          title:
            "Missing Evidence",

          items:
            intelligence.missing,

          type:
            "missing",

          emptyMessage:
            "No major evidence gaps detected.",
        })}

        ${
          intelligence.conflicting.length > 0
            ? renderEvidenceIntelligenceGroup({
                title:
                  "Conflicting Evidence",

                items:
                  intelligence.conflicting,

                type:
                  "conflicting",

                emptyMessage:
                  "No conflicting evidence detected.",
              })
            : `
              <section
                class="
                  investigation-evidence-intelligence__group
                  investigation-evidence-intelligence__group--conflicting
                  investigation-evidence-intelligence__group--empty
                "
              >
                <h4>
                  Conflicting Evidence
                </h4>

                <p>
                  No conflicting evidence detected.
                </p>
              </section>
            `
        }
      </div>
    </div>
  `;
}

function renderEvidenceIntelligenceGroup({
  title,
  items,
  type,
  emptyMessage,
}) {
  const normalizedItems =
    Array.isArray(items)
      ? items
      : [];

  return `
    <section
      class="
        investigation-evidence-intelligence__group
        investigation-evidence-intelligence__group--${escapeHtml(
          type,
        )}
      "
    >
      <h4>
        ${escapeHtml(
          title,
        )}
      </h4>

      ${
        normalizedItems.length > 0
          ? `
            <ul>
              ${normalizedItems
                .map(
                  (item) => `
                    <li>
                      <span
                        aria-hidden="true"
                      >
                        ${
                          type === "supporting"
                            ? "✓"
                            : type === "conflicting"
                              ? "!"
                              : "○"
                        }
                      </span>

                      ${escapeHtml(
                        item,
                      )}
                    </li>
                  `,
                )
                .join("")}
            </ul>
          `
          : `
            <p>
              ${escapeHtml(
                emptyMessage,
              )}
            </p>
          `
      }
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
            class="
                signal-section
        shared-detail-section
                investigation-evidence
            "
            aria-labelledby="investigation-evidence-title"
        >

            <header
                class="signal-section__header"
            >

                <p class="eyebrow">
                    Evidence
                </p>

                <h2
                    id="investigation-evidence-title"
                >
                    Supporting Evidence
                </h2>

            </header>

            <div
                class="
                    evidence-grid
                    executive-evidence-grid
                "
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

            ${renderEvidenceIntelligence(
                investigation,
            )}

        </section>
    `;
}

function closeInvestigation(
    investigation,
    resolution,
) {

    investigation.resolution = {

        ...investigation.resolution,

        ...resolution,

        status: "resolved",

        resolvedAt:
            resolution.resolvedAt
            ?? new Date().toISOString(),

    };

    investigation.status = "resolved";

    investigation.updatedAt =
        new Date().toISOString();

    addTimelineEvent(
        investigation,
        {

            type:
                "investigation-resolved",

            label:
                "Investigation resolved",

            description:
                investigation.resolution.summary,

        },
    );

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

function getInvestigationTimelinePresentation(
  event,
) {
  const type =
    String(
      event?.type
      ?? "",
    ).toLowerCase();

  const presentations = {
    "investigation-created": {
      label:
        "Created",

      symbol:
        "01",

      state:
        "complete",
    },

    "signal-analysis-imported": {
      label:
        "Assessment",

      symbol:
        "02",

      state:
        "complete",
    },

    "legacy-signal-analysis-imported": {
      label:
        "Assessment",

      symbol:
        "02",

      state:
        "complete",
    },

    "signal-attached": {
      label:
        "Evidence",

      symbol:
        "03",

      state:
        "complete",
    },

    "recommendations-updated": {
      label:
        "Recommendations",

      symbol:
        "04",

      state:
        "complete",
    },

    "investigation-resolved": {
      label:
        "Resolved",

      symbol:
        "05",

      state:
        "complete",
    },
  };

  return (
    presentations[type]
    ?? {
      label:
        "Milestone",

      symbol:
        "•",

      state:
        "complete",
    }
  );
}

function renderInvestigationTimelineEvent(
  event,
  index,
  total,
) {
  const presentation =
    getInvestigationTimelinePresentation(
      event,
    );

  const isLast =
    index === total - 1;

  return `
    <article
      class="
        investigation-timeline-milestone
        investigation-timeline-milestone--${escapeHtml(
          presentation.state,
        )}
        ${isLast
          ? "investigation-timeline-milestone--current"
          : ""}
      "
    >
      <div
        class="investigation-timeline-milestone__track"
        aria-hidden="true"
      >
        <span
          class="investigation-timeline-milestone__marker"
        >
          ${String(
            index + 1,
          ).padStart(
            2,
            "0",
          )}
        </span>

        ${
          !isLast
            ? `
              <span
                class="
                  investigation-timeline-milestone__connector
                "
              ></span>
            `
            : ""
        }
      </div>

      <div
        class="investigation-timeline-milestone__content"
      >
        <p
          class="
            investigation-timeline-milestone__type
          "
        >
          ${escapeHtml(
            presentation.label,
          )}
        </p>

        <strong>
          ${escapeHtml(
            event.label,
          )}
        </strong>

        ${
          event.description
            ? `
              <p
                class="
                  investigation-timeline-milestone__description
                "
              >
                ${escapeHtml(
                  event.description,
                )}
              </p>
            `
            : ""
        }

        <time
          datetime="${escapeHtml(
            event.timestamp,
          )}"
        >
          ${escapeHtml(
            formatDate(
              event.timestamp,
            ),
          )}
        </time>
      </div>
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
            class="
                signal-section
        shared-detail-section
                investigation-timeline-section
            "
            aria-labelledby="investigation-timeline-title"
        >

            <header
                class="signal-section__header"
            >

                <p class="eyebrow">
                    Timeline
                </p>

                <h2
                    id="investigation-timeline-title"
                >
                    Investigation Timeline
                </h2>

            </header>

            ${
                events.length === 0
                    ? `
                        <div class="list-message">

                            <p class="list-message__title">
                                No timeline events
                            </p>

                            <p>
                                No timeline events have been recorded.
                            </p>

                        </div>
                    `
                    : `
                        <div
                          class="investigation-timeline-milestones"
                          role="list"
                          aria-label="Investigation milestones"
                        >
                          ${events
                            .map(
                              (
                                event,
                                index,
                              ) =>
                                renderInvestigationTimelineEvent(
                                  event,
                                  index,
                                  events.length,
                                ),
                            )
                            .join("")}
                        </div>
                    `
            }

        </section>
    `;

}

function renderInvestigationControls(
  investigation,
) {
  const status =
    String(
      investigation.status
      ?? "investigating",
    ).toLowerCase();

  const isReadOnly =
    status === "resolved"
    || status === "archived";

  return `
    <form
      class="investigation-controls"
      data-investigation-controls
      data-investigation-id="${escapeHtml(
        investigation.id,
      )}"
    >
      <div class="investigation-controls__field">
        <label
          for="investigation-status"
        >
          Status
        </label>

        <select
          id="investigation-status"
          name="status"
          data-investigation-status
          ${isReadOnly
            ? "disabled"
            : ""}
        >
          ${renderInvestigationStatusOption({
            value:
              "new",

            label:
              "New",

            currentStatus:
              status,
          })}

          ${renderInvestigationStatusOption({
            value:
              "investigating",

            label:
              "Investigating",

            currentStatus:
              status,
          })}

          ${renderInvestigationStatusOption({
            value:
              "monitoring",

            label:
              "Monitoring",

            currentStatus:
              status,
          })}

          ${renderInvestigationStatusOption({
            value:
              "archived",

            label:
              "Archived",

            currentStatus:
              status,
          })}
        </select>
      </div>

      <div class="investigation-controls__field investigation-controls__field--owner">
        <label
          for="investigation-owner"
        >
          Owner
        </label>

        <input
          id="investigation-owner"
          name="owner"
          type="text"
          value="${escapeHtml(
            investigation.owner
            ?? "",
          )}"
          placeholder="Unassigned"
          autocomplete="off"
          data-investigation-owner
          ${isReadOnly
            ? "disabled"
            : ""}
        >
      </div>

      <button
        class="secondary-button investigation-controls__save"
        type="submit"
        ${isReadOnly
          ? "disabled"
          : ""}
      >
        Save Changes
      </button>

      <p
        class="investigation-controls__status"
        data-investigation-save-status
        aria-live="polite"
      >
        ${
          isReadOnly
            ? "This investigation is read-only."
            : ""
        }
      </p>
    </form>
  `;
}

function renderInvestigationStatusOption({
  value,
  label,
  currentStatus,
}) {
  return `
    <option
      value="${escapeHtml(value)}"
      ${
        value === currentStatus
          ? "selected"
          : ""
      }
    >
      ${escapeHtml(label)}
    </option>
  `;
}

function renderInvestigationResolution(
  investigation,
) {
  const resolution =
    investigation.resolution
    ?? {};

  const isResolved =
    String(
      investigation.status
      ?? "",
    ).toLowerCase()
    === "resolved";

  const isArchived =
    String(
      investigation.status
      ?? "",
    ).toLowerCase()
    === "archived";

  if (
    isResolved
    || isArchived
  ) {
    return renderResolvedInvestigation(
      investigation,
    );
  }

  return `
    <section
      class="
        signal-section
        shared-detail-section
        investigation-resolution
      "
      aria-labelledby="investigation-resolution-title"
    >
      <header
        class="signal-section__header"
      >
        <p class="eyebrow">
          Investigation closure
        </p>

        <h2
          id="investigation-resolution-title"
        >
          Resolution
        </h2>

        <p
          class="signal-section__lead"
        >
          Record the confirmed cause,
          corrective work, and preventive
          actions before resolving this
          investigation.
        </p>
      </header>

      <form
        class="investigation-resolution-form"
        data-investigation-resolution-form
        data-investigation-id="${escapeHtml(
          investigation.id,
        )}"
      >
        <div
          class="
            investigation-resolution-form__field
            investigation-resolution-form__field--full
          "
        >
          <label
            for="resolution-summary"
          >
            Resolution Summary
          </label>

          <textarea
            id="resolution-summary"
            name="summary"
            rows="5"
            required
            data-resolution-summary
            placeholder="Summarize how the operational condition was resolved."
          >${escapeHtml(
            resolution.summary
            ?? "",
          )}</textarea>
        </div>

        <div
          class="
            investigation-resolution-form__field
            investigation-resolution-form__field--full
          "
        >
          <label
            for="resolution-root-cause"
          >
            Root Cause
          </label>

          <textarea
            id="resolution-root-cause"
            name="rootCause"
            rows="5"
            required
            data-resolution-root-cause
            placeholder="Describe the confirmed underlying cause."
          >${escapeHtml(
            resolution.rootCause
            ?? "",
          )}</textarea>
        </div>

        <div
          class="
            investigation-resolution-form__field
            investigation-resolution-form__field--full
          "
        >
          <label
            for="resolution-lessons-learned"
          >
            Lessons Learned
          </label>

          <textarea
            id="resolution-lessons-learned"
            name="lessonsLearned"
            rows="7"
            data-resolution-lessons-learned
            placeholder="Enter one organizational lesson per line."
          >${escapeHtml(
            normalizeResolutionActions(
              resolution.lessonsLearned,
            ).join("\n"),
          )}</textarea>

          <p
            class="investigation-resolution-form__hint"
          >
            One organizational lesson per line.
          </p>
        </div>

        <div
          class="investigation-resolution-form__field"
        >
          <label
            for="resolution-corrective-actions"
          >
            Corrective Actions
          </label>

          <textarea
            id="resolution-corrective-actions"
            name="correctiveActions"
            rows="7"
            data-resolution-corrective-actions
            placeholder="Enter one action per line."
          >${escapeHtml(
            normalizeResolutionActions(
              resolution.correctiveActions,
            ).join("\n"),
          )}</textarea>

          <p
            class="investigation-resolution-form__hint"
          >
            One completed action per line.
          </p>
        </div>

        <div
          class="investigation-resolution-form__field"
        >
          <label
            for="resolution-preventive-actions"
          >
            Preventive Actions
          </label>

          <textarea
            id="resolution-preventive-actions"
            name="preventiveActions"
            rows="7"
            data-resolution-preventive-actions
            placeholder="Enter one action per line."
          >${escapeHtml(
            normalizeResolutionActions(
              resolution.preventiveActions,
            ).join("\n"),
          )}</textarea>

          <p
            class="investigation-resolution-form__hint"
          >
            One preventive action per line.
          </p>
        </div>

        <div
          class="investigation-resolution-form__field"
        >
          <label
            for="resolution-resolved-by"
          >
            Resolved By
          </label>

          <input
            id="resolution-resolved-by"
            name="resolvedBy"
            type="text"
            required
            autocomplete="off"
            data-resolution-resolved-by
            value="${escapeHtml(
              resolution.resolvedBy
              || investigation.owner
              || "",
            )}"
            placeholder="Team or responsible owner"
          >
        </div>

        <div
          class="
            investigation-resolution-form__actions
            shared-detail-actions
          "
        >
          <button
            class="secondary-button investigation-resolution-form__submit"
            type="submit"
          >
            Resolve Investigation
          </button>

          <p
            class="investigation-resolution-form__status"
            data-resolution-submit-status
            aria-live="polite"
          ></p>
        </div>
      </form>
    </section>
  `;
}

function renderResolvedInvestigation(
  investigation,
) {
  const resolution =
    investigation.resolution
    ?? {};

  return `
    <section
      class="
        signal-section
        shared-detail-section
        investigation-resolution
        investigation-resolution--complete
      "
      aria-labelledby="investigation-resolution-title"
    >
      <header
        class="signal-section__header"
      >
        <p class="eyebrow">
          Investigation closure
        </p>

        <h2
          id="investigation-resolution-title"
        >
          Resolution
        </h2>

        <p
          class="signal-section__lead"
        >
          ${escapeHtml(
            resolution.summary
            || "This investigation has been resolved.",
          )}
        </p>
      </header>

      <div
        class="investigation-resolution-document"
      >
        ${renderResolutionDocumentField({
          label:
            "Root Cause",

          value:
            resolution.rootCause
            || "No root cause was recorded.",
        })}

        ${renderResolutionActionList({
          label:
            "Lessons Learned",

          actions:
            resolution.lessonsLearned,

          emptyMessage:
            "No lessons learned were recorded.",
        })}

        ${renderResolutionActionList({
          label:
            "Corrective Actions",

          actions:
            resolution.correctiveActions,

          emptyMessage:
            "No corrective actions were recorded.",
        })}

        ${renderResolutionActionList({
          label:
            "Preventive Actions",

          actions:
            resolution.preventiveActions,

          emptyMessage:
            "No preventive actions were recorded.",
        })}

        <div
          class="investigation-resolution-document__metadata"
        >
          ${renderResolutionDocumentField({
            label:
              "Resolved By",

            value:
              resolution.resolvedBy
              || "Not recorded",
          })}

          ${renderResolutionDocumentField({
            label:
              "Resolved At",

            value:
              resolution.resolvedAt
                ? formatDate(
                    resolution.resolvedAt,
                  )
                : "Not recorded",
          })}
        </div>
      </div>
    </section>
  `;
}

function renderResolutionDocumentField({
  label,
  value,
}) {
  return `
    <section
      class="investigation-resolution-document__field"
    >
      <p class="eyebrow">
        ${escapeHtml(label)}
      </p>

      <p>
        ${escapeHtml(value)}
      </p>
    </section>
  `;
}

function renderResolutionActionList({
  label,
  actions,
  emptyMessage,
}) {
  const normalizedActions =
    normalizeResolutionActions(
      actions,
    );

  return `
    <section
      class="investigation-resolution-document__field"
    >
      <p class="eyebrow">
        ${escapeHtml(label)}
      </p>

      ${
        normalizedActions.length > 0
          ? `
            <ul>
              ${normalizedActions
                .map(
                  (action) => `
                    <li>
                      ${escapeHtml(action)}
                    </li>
                  `,
                )
                .join("")}
            </ul>
          `
          : `
            <p>
              ${escapeHtml(
                emptyMessage,
              )}
            </p>
          `
      }
    </section>
  `;
}

function normalizeResolutionActions(
  value,
) {
  return Array.isArray(value)
    ? value
        .filter(
          (item) =>
            typeof item
            === "string",
        )
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean)
    : [];
}

function parseResolutionActions(
  value,
) {
  if (
    typeof value !== "string"
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

function renderInvestigationRecommendations(
    investigation,
) {

    const recommendations =
        investigation.recommendations ?? {};

    return `
        <section
            class="
                signal-section
        shared-detail-section
                investigation-recommendations
            "
            aria-labelledby="investigation-recommendations-title"
        >

            <header
                class="signal-section__header"
            >

                <p class="eyebrow">
                    Recommendations
                </p>

                <h2
                    id="investigation-recommendations-title"
                >
                    Recommended Actions
                </h2>

            </header>

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


function resetDetailPanelScroll(
  selector,
) {
  const panel =
    document.querySelector(
      selector,
    );

  if (!panel) {
    return;
  }

  panel.scrollTo({
    top: 0,
    behavior: "auto",
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

  const investigations =
    Array.isArray(state.investigations)
      ? state.investigations
      : [];

  const statusFilter =
    document.querySelector(
      "#investigation-status-filter",
    );

  const severityFilter =
    document.querySelector(
      "#investigation-severity-filter",
    );

  const searchInput =
    document.querySelector(
      "#investigations-search",
    );

  const count =
    document.querySelector(
      "#investigation-count",
    );

  const selectedStatus =
    statusFilter?.value
      ?.trim()
      .toLowerCase() || "";

  const selectedSeverity =
    severityFilter?.value
      ?.trim()
      .toLowerCase() || "";

  const searchTerm =
    searchInput?.value
      ?.trim()
      .toLowerCase() || "";

  statusFilter &&
    (statusFilter.onchange =
      renderInvestigationsWorkspace);

  severityFilter &&
    (severityFilter.onchange =
      renderInvestigationsWorkspace);

  searchInput &&
    (searchInput.oninput =
      renderInvestigationsWorkspace);

  const filteredInvestigations =
    investigations.filter(
      (investigation) => {
        const investigationStatus =
          String(
            investigation.status || "",
          ).toLowerCase();

        const investigationSeverity =
          String(
            investigation.severity || "",
          ).toLowerCase();

        const searchableContent = [
          investigation.title,
          investigation.summary,
          investigation.service,
          investigation.environment,
          investigation.source,
          investigation.status,
          investigation.severity,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesStatus =
          !selectedStatus ||
          investigationStatus ===
            selectedStatus;

        const matchesSeverity =
          !selectedSeverity ||
          investigationSeverity ===
            selectedSeverity;

        const matchesSearch =
          !searchTerm ||
          searchableContent.includes(
            searchTerm,
          );

        return (
          matchesStatus &&
          matchesSeverity &&
          matchesSearch
        );
      },
    );

  if (count) {
    const visibleCount =
      filteredInvestigations.length;

    count.textContent =
      visibleCount === 1
        ? "1 investigation"
        : `${visibleCount} investigations`;
  }

  if (investigations.length === 0) {
    state.selectedInvestigationId = null;

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

    renderInvestigationDetail(null);

    return;
  }

  if (
    filteredInvestigations.length === 0
  ) {
    container.innerHTML = `
      <div class="list-message">

        <p class="list-message__title">
          No matching investigations
        </p>

        <p>
          Adjust the state, severity,
          or search filters.
        </p>

      </div>
    `;

    renderInvestigationDetail(null);

    return;
  }

  const selectedIsVisible =
    filteredInvestigations.some(
      (investigation) =>
        String(investigation.id) ===
        String(
          state.selectedInvestigationId,
        ),
    );

  if (!selectedIsVisible) {
    state.selectedInvestigationId =
      filteredInvestigations[0].id;
  }

  container.innerHTML =
    filteredInvestigations
      .map((investigation) => {
        const isSelected =
          String(investigation.id) ===
          String(
            state.selectedInvestigationId,
          );

        const context = [
          investigation.service,
          investigation.environment,
        ]
          .filter(Boolean)
          .join(" · ");

        return `
          <button
            class="
              signal-card
              investigation-card
              ${
                isSelected
                  ? "is-active"
                  : ""
              }
            "
            type="button"
            data-investigation-id="${escapeHtml(
              investigation.id,
            )}"
            aria-pressed="${isSelected}"
          >

            <header
              class="signal-card__header"
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

            </header>

            <div
              class="signal-card__body"
            >

              <h3 class="signal-card__title">
                ${escapeHtml(
                  investigation.title,
                )}
              </h3>

              ${
                context
                  ? `
                    <p
                      class="signal-card__context"
                    >
                      ${escapeHtml(
                        context,
                      )}
                    </p>
                  `
                  : ""
              }

              <p
                class="signal-card__summary"
              >
                ${escapeHtml(
                  investigation.summary || "",
                )}
              </p>

            </div>

            <footer
              class="signal-card__footer"
            >

              <time>
                ${escapeHtml(
                  formatCompactDate(
                    investigation.createdAt,
                  ),
                )}
              </time>

              <span
                class="signal-card__chevron"
                aria-hidden="true"
              >
                →
              </span>

            </footer>

          </button>
        `;
      })
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

          resetDetailPanelScroll(
            "#investigation-detail-panel",
          );

          renderInvestigationsWorkspace();
        },
      );
    });

  const selected =
    filteredInvestigations.find(
      (investigation) =>
        String(investigation.id) ===
        String(
          state.selectedInvestigationId,
        ),
    );

  renderInvestigationDetail(
    selected || null,
  );
}

function renderSecondaryWorkspace(
  workspace,
) {
  if (workspace === "dashboard") {
    secondaryWorkspace.innerHTML = `
      <div
        id="dashboard-workspace"
        class="
          dashboard-workspace
          secondary-workspace--document
          secondary-workspace--dashboard
        "
      >
    `;

    loadDashboard();

    return;
  }

  if (workspace === "investigations") {
    secondaryWorkspace.innerHTML = `
      <main
        id="investigations-workspace"
        class="
          app-layout
          live-signals-layout
          investigations-layout
          split-workspace
        "
      >
        <aside
          class="
            sidebar
            investigations-sidebar
            split-workspace__sidebar
          "
          aria-label="Investigation queue"
        >
          <section class="filter-panel">
            <div class="signal-queue-heading">
              <div>
                <p class="eyebrow">
                  Current activity
                </p>

                <h2>
                  Investigations
                </h2>
              </div>

              <span
                id="investigation-count"
                class="signal-count"
              >
                0 active
              </span>
            </div>

            <div class="filter-panel__controls">
              <label>
                <span class="filter-label">
                  Status
                </span>

                <select
                  id="investigation-status-filter"
                >
                  <option value="">
                    All statuses
                  </option>

                  <option value="new">
                    New
                  </option>

                  <option value="investigating">
                    Investigating
                  </option>

                  <option value="monitoring">
                    Monitoring
                  </option>

                  <option value="resolved">
                    Resolved
                  </option>

                  <option value="archived">
                    Archived
                  </option>
                </select>
              </label>

              <label>
                <span class="filter-label">
                  Severity
                </span>

                <select
                  id="investigation-severity-filter"
                >
                  <option value="">
                    All severities
                  </option>

                  <option value="critical">
                    Critical
                  </option>

                  <option value="high">
                    High
                  </option>

                  <option value="medium">
                    Medium
                  </option>

                  <option value="low">
                    Low
                  </option>
                </select>
              </label>

              <label
                class="investigation-search-field"
              >
                <span class="filter-label">
                  Search
                </span>

                <input
                  id="investigations-search"
                  type="search"
                  placeholder="Search investigations..."
                  autocomplete="off"
                >
              </label>
            </div>
          </section>

          <div
            id="investigations-results"
            class="
              signal-list
              investigations-list
              split-workspace__list
            "
            aria-label="Investigations"
          ></div>
        </aside>

        <section
          id="investigation-detail-panel"
          class="
            detail-panel
            investigation-detail-panel
            split-workspace__detail
          "
          aria-live="polite"
        >
          <div
            class="
              empty-state
              shared-detail-empty
            "
          >
            <p class="eyebrow">
              Investigation
            </p>

            <h2>
              Select an investigation
            </h2>

            <p>
              Choose an investigation to review its
              operational assessment, evidence,
              findings, timeline, and recommended
              actions.
            </p>
          </div>
        </section>
      </main>
    `;

    renderInvestigationsWorkspace();

    loadInvestigations()
      .catch(
        (error) => {
          console.error(
            "Unable to load investigations.",
            error,
          );

          const results =
            document.querySelector(
              "#investigations-results",
            );

          if (results) {
            results.innerHTML = `
              <div class="list-message">
                <p class="list-message__title">
                  Unable to load investigations
                </p>

                <p>
                  ${
                    escapeHtml(
                      error instanceof Error
                        ? error.message
                        : "Please try again.",
                    )
                  }
                </p>
              </div>
            `;
          }
        },
      );

    return;
  }

  if (
    workspace === "history"
    || workspace === "operational-memory"
  ) {
    secondaryWorkspace.innerHTML = `
      <div
        class="
          operational-memory-workspace
          secondary-workspace--split
          secondary-workspace--history
        "
      >

        <main
          class="
            operational-memory-layout
            split-workspace
          "
        >
          <aside
            class="
              operational-memory-list-panel
              split-workspace__sidebar
            "
          >
            <div
              id="operational-memory-results"
              class="
                operational-memory-list
                split-workspace__list
              "
              aria-label="Operational Memory documents"
            >
              <div class="list-message">
                <p class="list-message__title">
                  Loading Operational Memory
                </p>

                <p>
                  Operational Memory documents
                  will appear here.
                </p>
              </div>
            </div>
          </aside>

          <section
            id="operational-memory-detail-panel"
            class="
              operational-memory-detail-panel
              split-workspace__detail
            "
            aria-live="polite"
          >
            <div
              class="
                empty-state
                shared-detail-empty
              "
            >
              <p class="eyebrow">
                Operational Memory
              </p>

              <h2>
                Select a memory document
              </h2>

              <p>
                Choose an Operational Memory document
                to review its organizational knowledge,
                root cause, actions, and supporting evidence.
              </p>
            </div>
          </section>
        </main>
      </div>
    `;

    renderOperationalMemoryWorkspace();

    loadOperationalMemory();

    return;
  }

  if (workspace === "integrations") {
    secondaryWorkspace.innerHTML = `
      <div
        class="
          integrations-workspace
          secondary-workspace--split
          secondary-workspace--integrations
        "
      >

        <div
          class="
            integrations-layout
            split-workspace
          "
        >

          <div
            id="integrations-results"
            class="
              integrations-list
              split-workspace__sidebar
              split-workspace__list
            "
            aria-label="Configured integrations"
          ></div>

          <aside
            id="integration-detail-panel"
            class="
              integrations-detail-panel
              split-workspace__detail
            "
            aria-live="polite"
          >
            <div class="empty-state">

              <h2>
                Loading integrations
              </h2>

              <p>
                Connection information will appear here.
              </p>

            </div>
          </aside>

        </div>

      </div>
    `;

    renderIntegrationsWorkspace();

    loadIntegrations();

    return;
  }

  if (workspace === "environments") {
      secondaryWorkspace.innerHTML = `
        <div
          class="
            environments-workspace
            secondary-workspace--split
            secondary-workspace--environments
          "
        >
          <div
            class="
              environments-layout
              split-workspace
            "
          >
            <aside
              class="
                environments-list-panel
                split-workspace__sidebar
              "
            >
              <div
                id="environments-results"
                class="
                  environments-list
                  split-workspace__list
                "
                aria-label="Signal Audit environments"
              ></div>
            </aside>

            <aside
              id="environment-detail-panel"
              class="
                environments-detail-panel
                split-workspace__detail
              "
              aria-live="polite"
            >
              <div class="empty-state">
                <h2>
                  Loading environments
                </h2>

                <p>
                  Environment health and activity will appear here.
                </p>
              </div>
            </aside>
          </div>
        </div>
      `;

      renderEnvironmentsWorkspace();

      loadEnvironments();

      return;
    }

    if (workspace === "settings") {
      const settings =
        getApplicationSettings();

      secondaryWorkspace.innerHTML = `
        <div
          class="
            settings-workspace
            secondary-workspace--document
            secondary-workspace--settings
          "
        >

          <div class="settings-sections">

            <section
              class="settings-section"
              aria-labelledby="appearance-settings-title"
            >

              <header class="settings-section__header">

                <div>

                  <p class="eyebrow">
                    Appearance
                  </p>

                  <h3
                    id="appearance-settings-title"
                  >
                    Interface Theme
                  </h3>

                  <p>
                    Choose how Signal Audit appears in this browser.
                  </p>

                </div>

              </header>

              <div class="settings-control">

                <label
                  for="settings-theme"
                  class="settings-control__copy"
                >

                  <strong>
                    Theme
                  </strong>

                  <span>
                    Use the dark interface, light interface, or your system preference.
                  </span>

                </label>

                <select
                  id="settings-theme"
                  class="settings-select"
                >
                  <option
                    value="dark"
                    ${
                      settings.theme === "dark"
                        ? "selected"
                        : ""
                    }
                  >
                    Dark
                  </option>

                  <option
                    value="light"
                    ${
                      settings.theme === "light"
                        ? "selected"
                        : ""
                    }
                  >
                    Light
                  </option>

                  <option
                    value="system"
                    ${
                      settings.theme === "system"
                        ? "selected"
                        : ""
                    }
                  >
                    System
                  </option>
                </select>

              </div>

            </section>

            <section
              class="settings-section"
              aria-labelledby="workspace-settings-title"
            >

              <header class="settings-section__header">

                <div>

                  <p class="eyebrow">
                    Workspace preferences
                  </p>

                  <h3
                    id="workspace-settings-title"
                  >
                    Application Behavior
                  </h3>

                  <p>
                    Set the initial workspace and navigation behavior.
                  </p>

                </div>

              </header>

              <div class="settings-control">

                <label
                  for="settings-default-workspace"
                  class="settings-control__copy"
                >

                  <strong>
                    Default workspace
                  </strong>

                  <span>
                    The workspace shown when no workspace is specified in the URL.
                  </span>

                </label>

                <select
                  id="settings-default-workspace"
                  class="settings-select"
                >
                  <option
                    value="dashboard"
                    ${
                      settings.defaultWorkspace
                      === "dashboard"
                        ? "selected"
                        : ""
                    }
                  >
                    Dashboard
                  </option>

                  <option
                    value="live-signals"
                    ${
                      settings.defaultWorkspace
                      === "live-signals"
                        ? "selected"
                        : ""
                    }
                  >
                    Live Signals
                  </option>

                  <option
                    value="investigations"
                    ${
                      settings.defaultWorkspace
                      === "investigations"
                        ? "selected"
                        : ""
                    }
                  >
                    Investigations
                  </option>

                  <option
                    value="history"
                    ${
                      settings.defaultWorkspace
                      === "history"
                        ? "selected"
                        : ""
                    }
                  >
                    Operational Memory
                  </option>
                </select>

              </div>

              <div class="settings-control">

                <label
                  for="settings-default-sidebar"
                  class="settings-control__copy"
                >

                  <strong>
                    Default navigation state
                  </strong>

                  <span>
                    Choose whether the navigation rail starts expanded or collapsed.
                  </span>

                </label>

                <select
                  id="settings-default-sidebar"
                  class="settings-select"
                >
                  <option
                    value="expanded"
                    ${
                      settings.defaultSidebar
                      === "expanded"
                        ? "selected"
                        : ""
                    }
                  >
                    Expanded
                  </option>

                  <option
                    value="collapsed"
                    ${
                      settings.defaultSidebar
                      === "collapsed"
                        ? "selected"
                        : ""
                    }
                  >
                    Collapsed
                  </option>
                </select>

              </div>

              <div class="settings-control">

                <div class="settings-control__copy">

                  <strong>
                    Live Signals auto-refresh
                  </strong>

                  <span>
                    Automatically refresh the Live Signals queue while the workspace is open.
                  </span>

                </div>

                <label
                  class="settings-toggle"
                >

                  <input
                    id="settings-auto-refresh"
                    type="checkbox"
                    ${
                      settings.autoRefresh
                        ? "checked"
                        : ""
                    }
                  >

                  <span
                    class="settings-toggle__track"
                    aria-hidden="true"
                  >
                    <span
                      class="settings-toggle__thumb"
                    ></span>
                  </span>

                  <span class="sr-only">
                    Toggle Live Signals auto-refresh
                  </span>

                </label>

              </div>

            </section>

            <section
              class="settings-section"
              aria-labelledby="organization-settings-title"
            >

              <header class="settings-section__header">

                <div>

                  <p class="eyebrow">
                    Organization
                  </p>

                  <h3
                    id="organization-settings-title"
                  >
                    Identity and Access
                  </h3>

                  <p>
                    Organization identity, users, roles, and access policies will be managed here.
                  </p>

                </div>

                <span class="settings-status">
                  Foundation
                </span>

              </header>

              <div
                class="
                  settings-foundation
                  settings-foundation--disabled
                "
              >

                <div>

                  <strong>
                    Organization profile
                  </strong>

                  <p>
                    Organization name, ownership, and deployment identity.
                  </p>

                </div>

                <span>
                  Not configured
                </span>

              </div>

              <div
                id="settings-user-management"
                class="settings-user-management"
                aria-live="polite"
              >
                <div class="user-management-message">
                  Loading users…
                </div>
              </div>

            </section>

          </div>

          <div
            id="settings-message"
            class="settings-message"
            role="status"
            aria-live="polite"
          ></div>

        </div>
      `;

      bindSettingsControls();

      if (
        window
          .SignalAuditSettingsUsers
      ) {
        window
          .SignalAuditSettingsUsers
          .mount({
            container:
              "#settings-user-management",

            currentUser:
              state.currentUser,

            onMessage:
              showSettingsMessage,
          });
      }

      return;
    }

  const definition =
    workspaceDefinitions[workspace];

  secondaryWorkspace.innerHTML = `
    <div class="workspace-placeholder">
      <p class="eyebrow">
        ${escapeHtml(definition.eyebrow)}
      </p>

      <h2>
        ${escapeHtml(definition.heading)}
      </h2>

      <p class="workspace-placeholder__description">
        ${escapeHtml(definition.description)}
      </p>

      <div class="workspace-placeholder__status">
        <span>Product shell</span>
        <strong>Workspace foundation ready</strong>
      </div>
    </div>
  `;
}

function showSettingsMessage(
  message,
) {
  const container =
    document.querySelector(
      "#settings-message",
    );

  if (!container) {
    return;
  }

  container.textContent =
    message;

  container.classList.add(
    "is-visible",
  );

  window.clearTimeout(
    showSettingsMessage.timeoutId,
  );

  showSettingsMessage.timeoutId =
    window.setTimeout(
      () => {
        container.classList.remove(
          "is-visible",
        );
      },
      2400,
    );
}

function bindSettingsControls() {
  const themeSelect =
    document.querySelector(
      "#settings-theme",
    );

  const workspaceSelect =
    document.querySelector(
      "#settings-default-workspace",
    );

  const sidebarSelect =
    document.querySelector(
      "#settings-default-sidebar",
    );

  const autoRefreshToggle =
    document.querySelector(
      "#settings-auto-refresh",
    );

  themeSelect?.addEventListener(
    "change",
    () => {
      applyTheme(
        themeSelect.value,
      );

      showSettingsMessage(
        "Theme preference saved.",
      );
    },
  );

  workspaceSelect?.addEventListener(
    "change",
    () => {
      window.localStorage.setItem(
        settingsStorageKeys
          .defaultWorkspace,
        workspaceSelect.value,
      );

      showSettingsMessage(
        "Default workspace saved.",
      );
    },
  );

  sidebarSelect?.addEventListener(
    "change",
    () => {
      window.localStorage.setItem(
        settingsStorageKeys
          .defaultSidebar,
        sidebarSelect.value,
      );

      setSidebarState(
        sidebarSelect.value,
      );

      showSettingsMessage(
        "Navigation preference saved.",
      );
    },
  );

  autoRefreshToggle?.addEventListener(
    "change",
    () => {
      window.localStorage.setItem(
        settingsStorageKeys
          .autoRefresh,
        String(
          autoRefreshToggle.checked,
        ),
      );

      syncLiveSignalsAutoRefresh();

      showSettingsMessage(
        autoRefreshToggle.checked
          ? "Live Signals auto-refresh enabled."
          : "Live Signals auto-refresh disabled.",
      );
    },
  );
}

async function loadOperationalMemory() {
  const results =
    document.querySelector(
      "#operational-memory-results",
    );

  const detailPanel =
    document.querySelector(
      "#operational-memory-detail-panel",
    );

  const count =
    document.querySelector(
      "#operational-memory-count",
    );

  if (
    !results
    || !detailPanel
  ) {
    return;
  }

  results.innerHTML = `
    <div class="list-message">
      <p class="list-message__title">
        Loading Operational Memory
      </p>

      <p>
        Loading operational knowledge...
      </p>
    </div>
  `;

  try {
    const response =
      await fetch(
        "/api/signal-interpreter/operational-memory",
        {
          headers: {
            Accept:
              "application/json",
          },
        },
      );

    const body =
      await response.json();

    if (!response.ok) {
      throw new Error(
        body?.error?.message
        ?? body?.error
        ?? `Unable to load Operational Memory: ${response.status}.`,
      );
    }

    state.operationalMemoryDocuments =
      Array.isArray(
        body.documents,
      )
        ? body.documents
        : [];

    if (
      !state.selectedOperationalMemoryId
      || !state.operationalMemoryDocuments
        .some(
          (document) =>
            document.id
            === state
              .selectedOperationalMemoryId,
        )
    ) {
      state.selectedOperationalMemoryId =
        state.operationalMemoryDocuments
          [0]?.id
        ?? null;
    }

    if (count) {
      const total =
        state.operationalMemoryDocuments
          .length;

      count.textContent =
        total === 1
          ? "1 memory document"
          : `${total} memory documents`;
    }

    renderOperationalMemoryWorkspace();
  } catch (error) {
    console.error(
      "Unable to load Operational Memory.",
      error,
    );

    results.innerHTML = `
      <div class="list-message">
        <p class="list-message__title">
          Unable to load Operational Memory
        </p>

        <p>
          ${escapeHtml(
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
          )}
        </p>
      </div>
    `;

    detailPanel.innerHTML = `
      <div class="empty-state">
        <h2>
          Operational Memory unavailable
        </h2>

        <p>
          Refresh the workspace or verify the
          application connection.
        </p>
      </div>
    `;
  }
}

function renderOperationalMemoryWorkspace() {
  const results =
    document.querySelector(
      "#operational-memory-results",
    );

  if (!results) {
    return;
  }

  const documents =
    Array.isArray(
      state.operationalMemoryDocuments,
    )
      ? state.operationalMemoryDocuments
      : [];

  if (documents.length === 0) {
    state.selectedOperationalMemoryId =
      null;

    results.innerHTML = `
      <div class="list-message">
        <p class="list-message__title">
          No memory documents yet
        </p>

        <p>
          Operational Memory documents will
          appear here automatically.
        </p>
      </div>
    `;

    renderOperationalMemoryDetail(
      null,
    );

    return;
  }

  results.innerHTML =
    documents
      .map(
        (document) => {
          const isSelected =
            document.id
            === state
              .selectedOperationalMemoryId;

          const context = [
            document.service,
            document.environment,
            document.owner,
          ]
            .filter(Boolean)
            .join(" · ");

          return `
            <button
              class="
                operational-memory-card
                ${
                  isSelected
                    ? "is-active"
                    : ""
                }
              "
              type="button"
              data-operational-memory-id="${escapeHtml(
                document.id,
              )}"
              aria-pressed="${isSelected}"
            >
              <header
                class="operational-memory-card__header"
              >
                <div class="detail-meta">
                  ${createBadge(
                    document.memoryState
                    || "provisional",
                    "state",
                  )}

                  ${createBadge(
                    document.status,
                    "state",
                  )}

                  ${createBadge(
                    document.severity,
                    "severity",
                  )}

                  ${createBadge(
                    document.source,
                    "source",
                  )}
                </div>
              </header>

              <div
                class="operational-memory-card__body"
              >
                <h3>
                  ${escapeHtml(
                    document.title
                    || "Untitled Memory",
                  )}
                </h3>

                ${
                  context
                    ? `
                      <p>
                        ${escapeHtml(
                          context,
                        )}
                      </p>
                    `
                    : ""
                }
              </div>

              <footer
                class="operational-memory-card__footer"
              >
                <time>
                  ${escapeHtml(
                    formatCompactDate(
                      document.resolvedAt
                      || document.updatedAt,
                    ),
                  )}
                </time>

                <span aria-hidden="true">
                  →
                </span>
              </footer>
            </button>
          `;
        },
      )
      .join("");

  results
    .querySelectorAll(
      "[data-operational-memory-id]",
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            state.selectedOperationalMemoryId =
              button.dataset
                .operationalMemoryId;

            resetDetailPanelScroll(
              "#operational-memory-detail-panel",
            );

            renderOperationalMemoryWorkspace();
          },
        );
      },
    );

  const selected =
    documents.find(
      (document) =>
        document.id
        === state
          .selectedOperationalMemoryId,
    )
    ?? null;

  renderOperationalMemoryDetail(
    selected,
  );
}

function renderOperationalMemoryDetail(
  memoryDocument,
) {
  const panel =
    window.document.querySelector(
      "#operational-memory-detail-panel",
    );

  if (!panel) {
    return;
  }

  if (!memoryDocument) {
    panel.innerHTML = `
      <div
        class="
          empty-state
          shared-detail-empty
        "
      >
        <p class="eyebrow">
          Operational Memory
        </p>

        <h2>
          Select a memory document
        </h2>

        <p>
          Choose an Operational Memory document
          to review its organizational knowledge,
          root cause, actions, and supporting evidence.
        </p>
      </div>
    `;

    return;
  }

  panel.innerHTML = `
    <div
      class="
        operational-memory-detail
        shared-detail-panel
      "
    >
      <header
        class="
          detail-header
          shared-detail-header
        "
      >
        <div
          class="
            detail-meta
            shared-detail-meta
          "
        >
          ${createBadge(
            memoryDocument.memoryState
            || "provisional",
            "state",
          )}

          ${createBadge(
            memoryDocument.source,
            "source",
          )}

          ${createBadge(
            memoryDocument.severity,
            "severity",
          )}

          ${createBadge(
            memoryDocument.status,
            "state",
          )}
        </div>

        <h2>
          ${escapeHtml(
            memoryDocument.title
            || "Untitled Memory",
          )}
        </h2>

        <p
          class="
            detail-summary
            shared-detail-summary
          "
        >
          ${escapeHtml(
            memoryDocument.summary
            || "No operational summary has been recorded.",
          )}
        </p>
      </header>

      ${renderOperationalMemoryOverview(
        memoryDocument,
      )}

      ${renderOperationalMemoryTextSection({
        eyebrow:
          "Confirmed cause",

        title:
          "Root Cause",

        value:
          memoryDocument.rootCause,

        emptyMessage:
          "The root cause has not yet been confirmed.",
      })}

      ${renderOperationalMemoryListSection({
        eyebrow:
          "Organizational learning",

        title:
          "Lessons Learned",

        items:
          memoryDocument.lessonsLearned,

        emptyMessage:
          "Lessons learned have not yet been recorded.",
      })}

      ${renderOperationalMemoryListSection({
        eyebrow:
          "Resolution work",

        title:
          "Corrective Actions",

        items:
          memoryDocument.correctiveActions,

        emptyMessage:
          "No corrective actions have been recorded.",
      })}

      ${renderOperationalMemoryListSection({
        eyebrow:
          "Future prevention",

        title:
          "Preventive Actions",

        items:
          memoryDocument.preventiveActions,

        emptyMessage:
          "No preventive actions have been recorded.",
      })}

      ${renderOperationalMemoryEvidenceSection(
        memoryDocument,
      )}

      ${renderOperationalMemoryInvestigationReference(
        memoryDocument,
      )}
    </div>
  `;
}

function renderOperationalMemoryOverview(
  memoryDocument,
) {
  return `
    <section
      class="
        integration-detail-section
        shared-detail-section
        operational-memory-overview
      "
    >
      <p class="eyebrow">
        Knowledge context
      </p>

      <h3>
        Operational Summary
      </h3>

      <dl class="signal-facts">
        ${renderFact(
          "Knowledge state",
          formatIntegrationName(
            memoryDocument.memoryState
            || "provisional",
          ),
        )}

        ${renderFact(
          "Service",
          memoryDocument.service
          || "Unknown",
        )}

        ${renderFact(
          "Environment",
          memoryDocument.environment
          || "Unknown",
        )}

        ${renderFact(
          "Signal source",
          formatIntegrationName(
            memoryDocument.source
            || "Unknown",
          ),
        )}

        ${renderFact(
          "Severity",
          formatIntegrationName(
            memoryDocument.severity
            || "Unknown",
          ),
        )}

        ${renderFact(
          "Created from",
          memoryDocument.investigationId
          || "Unknown",
          {
            code: true,
          },
        )}

        ${
          memoryDocument.finalizedAt
            ? renderIntegrationTimeFact(
                "Finalized",
                memoryDocument.finalizedAt,
              )
            : ""
        }

        ${
          memoryDocument.archivedAt
            ? renderIntegrationTimeFact(
                "Archived",
                memoryDocument.archivedAt,
              )
            : ""
        }

        ${renderIntegrationTimeFact(
          "Document updated",
          memoryDocument.updatedAt,
        )}
      </dl>
    </section>
  `;
}

function renderOperationalMemoryTextSection({
  eyebrow,
  title,
  value,
  emptyMessage,
}) {
  const hasValue =
    typeof value === "string"
    && value.trim();

  return `
    <section
      class="
        integration-detail-section
        shared-detail-section
        operational-memory-knowledge-section
      "
    >
      <p class="eyebrow">
        ${escapeHtml(
          eyebrow,
        )}
      </p>

      <h3>
        ${escapeHtml(
          title,
        )}
      </h3>

      <p
        class="
          integration-health-description
          ${
            hasValue
              ? ""
              : "operational-memory-empty-copy"
          }
        "
      >
        ${escapeHtml(
          hasValue
            ? value
            : emptyMessage,
        )}
      </p>
    </section>
  `;
}

function renderOperationalMemoryListSection({
  eyebrow,
  title,
  items,
  emptyMessage,
}) {
  const normalizedItems =
    Array.isArray(items)
      ? items
          .filter(
            (item) =>
              typeof item === "string"
              && item.trim(),
          )
          .map(
            (item) =>
              item.trim(),
          )
      : [];

  return `
    <section
      class="
        integration-detail-section
        shared-detail-section
        operational-memory-knowledge-section
      "
    >
      <p class="eyebrow">
        ${escapeHtml(
          eyebrow,
        )}
      </p>

      <h3>
        ${escapeHtml(
          title,
        )}
      </h3>

      ${
        normalizedItems.length > 0
          ? `
            <ul
              class="
                evidence-list
                operational-memory-action-list
              "
            >
              ${normalizedItems
                .map(
                  (item) => `
                    <li>
                      ${escapeHtml(
                        item,
                      )}
                    </li>
                  `,
                )
                .join("")}
            </ul>
          `
          : `
            <p
              class="
                integration-health-description
                operational-memory-empty-copy
              "
            >
              ${escapeHtml(
                emptyMessage,
              )}
            </p>
          `
      }
    </section>
  `;
}

function renderOperationalMemoryEvidenceSection(
  memoryDocument,
) {
  const signals =
    Array.isArray(
      memoryDocument.supportingSignals,
    )
      ? memoryDocument.supportingSignals
      : [];

  const findings =
    Array.isArray(
      memoryDocument.supportingFindings,
    )
      ? memoryDocument.supportingFindings
      : [];

  return `
    <section
      class="
        integration-detail-section
        shared-detail-section
        operational-memory-evidence
      "
    >
      <p class="eyebrow">
        Source material
      </p>

      <h3>
        Supporting Evidence
      </h3>

      <dl class="signal-facts">
        ${renderFact(
          "Supporting signals",
          String(
            signals.length,
          ),
        )}

        ${renderFact(
          "Supporting findings",
          String(
            findings.length,
          ),
        )}
      </dl>

      ${
        signals.length > 0
          ? `
            <div
              class="
                operational-memory-reference-list
                recommendation-group
              "
            >
              <h4>
                Signal References
              </h4>

              <ul class="evidence-list">
                ${signals
                  .map(
                    (signalId) => `
                      <li>
                        <code>
                          ${escapeHtml(
                            signalId,
                          )}
                        </code>
                      </li>
                    `,
                  )
                  .join("")}
              </ul>
            </div>
          `
          : `
            <p
              class="
                integration-health-description
                operational-memory-empty-copy
              "
            >
              No supporting signals are linked.
            </p>
          `
      }
    </section>
  `;
}

function renderOperationalMemoryInvestigationReference(
  memoryDocument,
) {
  if (!memoryDocument.investigationId) {
    return "";
  }

  return `
    <section
      class="
        integration-detail-section
        shared-detail-section
        operational-memory-investigation-reference
      "
    >
      <p class="eyebrow">
        Source investigation
      </p>

      <h3>
        Related Investigation
      </h3>

      <p class="integration-health-description">
        Review the active operational record,
        evidence workflow, ownership, and
        investigation timeline.
      </p>

      <div
        class="
          integration-actions
          shared-detail-actions
        "
      >
        <button
          type="button"
          class="secondary-button"
          data-open-investigation="${escapeHtml(
            memoryDocument.investigationId,
          )}"
        >
          Open Investigation
        </button>
      </div>
    </section>
  `;
}

function renderOperationalMemoryTimeline(
  timeline,
) {
  const events =
    Array.isArray(timeline)
      ? [...timeline]
          .sort(
            (left, right) =>
              Date.parse(
                left.timestamp,
              )
              - Date.parse(
                right.timestamp,
              ),
          )
      : [];

  return `
    <section
      class="
        signal-section
        operational-memory-timeline
      "
    >
      <header
        class="signal-section__header"
      >
        <p class="eyebrow">
          Investigation history
        </p>

        <h2>
          Timeline
        </h2>
      </header>

      ${
        events.length > 0
          ? `
            <ol
              class="operational-memory-timeline__list"
            >
              ${events
                .map(
                  (event) => `
                    <li>
                      <time>
                        ${escapeHtml(
                          formatDate(
                            event.timestamp,
                          ),
                        )}
                      </time>

                      <strong>
                        ${escapeHtml(
                          event.label
                          || event.type
                          || "Activity",
                        )}
                      </strong>

                      ${
                        event.description
                          ? `
                            <p>
                              ${escapeHtml(
                                event.description,
                              )}
                            </p>
                          `
                          : ""
                      }
                    </li>
                  `,
                )
                .join("")}
            </ol>
          `
          : `
            <p
              class="signal-section__lead"
            >
              No investigation timeline was recorded.
            </p>
          `
      }
    </section>
  `;
}

/*
 * Temporary compatibility alias.
 * Existing internal callers may still use the historical name.
 */
async function loadHistoryWorkspace() {
  return loadOperationalMemory();
}

async function loadDashboard() {
  const container =
    document.querySelector(
      "#dashboard-workspace",
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <p class="loading-message">
      Loading dashboard...
    </p>
  `;

  try {
    const response =
      await fetch(
        "/api/signal-interpreter/dashboard",
      );

    if (!response.ok) {
      throw new Error(
        "Unable to load dashboard.",
      );
    }

    state.dashboard =
      await response.json();

    renderDashboard();
  } catch (error) {
    container.innerHTML = `
      <p class="error-message">
        ${escapeHtml(error.message)}
      </p>
    `;
  }
}

function renderDashboard() {
  const container =
    document.querySelector(
      "#dashboard-workspace",
    );

  if (
    !container
    || !state.dashboard
  ) {
    return;
  }

  const {
    summary,
    recentSignals,
    integrations,
  } = state.dashboard;

  container.innerHTML = `
    <div class="dashboard-platform-health">
      <div class="dashboard-platform-health__content">

        <p class="eyebrow">
          Operational Intelligence
        </p>

        <h2>
          Platform Health
        </h2>

        <p class="dashboard-platform-health__summary">
          ${
            summary.overallHealth === "healthy"
              ? "All monitored systems are operating normally."
              : "Operational issues require attention."
          }
        </p>

      </div>

      <div class="dashboard-platform-health__status">

        ${createBadge(
          summary.overallHealth,
          "state",
        )}

      </div>
    </div>

    <div class="dashboard-metrics">

      ${renderDashboardMetric(
        "Signals",
        summary.totalSignals,
      )}

      ${renderDashboardMetric(
        "Today's Signals",
        summary.signalsToday,
      )}

      ${renderDashboardMetric(
        "Integrations",
        summary.integrations,
      )}

      ${renderDashboardMetric(
        "Environments",
        summary.environments,
      )}

      ${renderDashboardMetric(
        "Failed Analyses",
        summary.failedAnalyses,
      )}

    </div>

    <section class="dashboard-section">

      <header class="dashboard-section__header">

        <div>
          <p class="eyebrow">
            Operational Timeline
          </p>

          <h2>
            Recent Operational Events
          </h2>
        </div>

        <button
          type="button"
          class="secondary-button dashboard-section__action"
          data-dashboard-action="history"
        >
          View Operational Memory
        </button>

      </header>

      <div class="dashboard-timeline">

        ${
          recentSignals.length > 0
            ? recentSignals
                .map(
                  (signal) => `
                    <article class="dashboard-event">

                      <div class="dashboard-event__content">

                        <div class="dashboard-event__meta">

                          ${createBadge(
                            signal.source,
                            "source",
                          )}

                          ${createBadge(
                            signal.severity,
                            "severity",
                          )}

                          ${createBadge(
                            signal.state,
                            "state",
                          )}

                        </div>

                        <h3 class="dashboard-event__title">
                          ${escapeHtml(
                            signal.signal?.title
                            || signal.service
                            || "Untitled signal",
                          )}
                        </h3>

                        <p class="dashboard-event__context">
                          ${escapeHtml(
                            [
                              signal.service,
                              signal.signal?.environment,
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          )}
                        </p>

                      </div>

                      <time
                        class="dashboard-event__time"
                        datetime="${escapeHtml(
                          signal.receivedAt || "",
                        )}"
                      >
                        ${escapeHtml(
                          formatRelativeTime(
                            signal.receivedAt,
                          )
                          || formatCompactDate(
                            signal.receivedAt,
                          ),
                        )}
                      </time>

                    </article>
                  `,
                )
                .join("")
            : `
                <div class="list-message">

                  <p class="list-message__title">
                    No recent operational events
                  </p>

                  <p>
                    New telemetry signals will appear
                    here as they are received.
                  </p>

                </div>
              `
        }

      </div>

    </section>

    <section class="dashboard-section">

      <header>

        <p class="eyebrow">
          Telemetry Health
        </p>

        <h2>
          Connected Telemetry Sources
        </h2>

      </header>

      <div class="dashboard-list">

        ${integrations
          .map(
            (integration) => `
              <article class="dashboard-list-item">

                <div>

                  <strong>
                    ${escapeHtml(
                      formatIntegrationName(
                        integration.source,
                      ),
                    )}
                  </strong>

                  <p>
                    ${
                      integration.status === "active"
                        ? "Receiving telemetry"
                        : "Connection inactive"
                    }
                  </p>

                </div>

                <div class="detail-meta">

                  ${createBadge(
                    integration.status,
                    "state",
                  )}

                </div>

              </article>
            `,
          )
          .join("")}

      </div>
      <div class="dashboard-section__footer">

        <button
          class="secondary-button"
          type="button"
          data-dashboard-action="integrations"
        >
          Manage Integrations
        </button>

      </div>

    </section>
  `;
  container
  .querySelectorAll("[data-dashboard-action]")
  .forEach((card) => {
    card.addEventListener("click", () => {
      switch (card.dataset.dashboardAction) {
        case "history":
          renderWorkspace("history");
          break;

        case "integrations":
          renderWorkspace("integrations");
          break;
      }
    });
  });
}

async function loadIntegrations() {
  const container =
    document.querySelector(
      "#integrations-results",
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <p class="loading-message">
      Loading integrations...
    </p>
  `;

  try {
    const response =
      await fetch(
        "/api/signal-interpreter/integrations",
      );

    if (!response.ok) {
      throw new Error(
        "Unable to load integrations.",
      );
    }

    const payload =
      await response.json();

    state.integrations =
      payload.integrations || [];

    renderIntegrationsWorkspace();
  } catch (error) {
    container.innerHTML = `
      <p class="error-message">
        ${escapeHtml(error.message)}
      </p>
    `;
  }
}

async function loadEnvironments() {
  const container =
    document.querySelector(
      "#environments-results",
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <p class="loading-message">
      Loading environments...
    </p>
  `;

  try {
    const response =
      await fetch(
        "/api/signal-interpreter/environments",
      );

    if (!response.ok) {
      throw new Error(
        "Unable to load environments.",
      );
    }

    const payload =
      await response.json();

    state.environments =
      payload.environments || [];

    renderEnvironmentsWorkspace();
  } catch (error) {
    container.innerHTML = `
      <p class="error-message">
        ${escapeHtml(error.message)}
      </p>
    `;
  }
}

function renderEnvironmentsWorkspace() {
  const container =
    document.querySelector(
      "#environments-results",
    );

  if (!container) {
    return;
  }

  if (
    state.environments.length === 0
  ) {
    container.innerHTML = `
      <div class="list-message">
        <p class="list-message__title">
          No environments found
        </p>

        <p>
          Environments will appear after
          signals begin arriving.
        </p>
      </div>
    `;

    renderEnvironmentDetail(null);

    return;
  }

  if (
    !state.selectedEnvironmentId
    || !state.environments.some(
      (environment) =>
        environment.id
        === state.selectedEnvironmentId,
    )
  ) {
    state.selectedEnvironmentId =
      state.environments[0].id;
  }

  container.innerHTML =
    state.environments
      .map((environment) => {

        const isSelected =
          environment.id ===
          state.selectedEnvironmentId;

        const health =
          getEnvironmentHealth(
            environment,
          );

        return `
          <button
            class="
              environment-card
              ${
                isSelected
                  ? "is-active"
                  : ""
              }
            "
            type="button"
            data-environment-id="${escapeHtml(
              environment.id,
            )}"
            aria-pressed="${isSelected}"
          >
            <header class="environment-card__header">
              <div>
                <p class="eyebrow">
                  Environment
                </p>

                <h3>
                  ${escapeHtml(
                    environment.name,
                  )}
                </h3>
              </div>

              <span
                class="
                  integration-health-badge
                  integration-health-badge--${escapeHtml(
                    health.tone,
                  )}
                "
              >
                <span
                  class="integration-health-badge__indicator"
                  aria-hidden="true"
                ></span>

                ${escapeHtml(
                  health.label,
                )}
              </span>
            </header>

            <dl class="environment-card__facts">
              <div>
                <dt>
                  Integrations
                </dt>

                <dd>
                  ${environment.integrations}
                </dd>
              </div>

              <div>
                <dt>
                  Total signals
                </dt>

                <dd>
                  ${environment.totalSignals}
                </dd>
              </div>

              <div>
                <dt>
                  Signals today
                </dt>

                <dd>
                  ${environment.signalsToday}
                </dd>
              </div>
            </dl>

            <footer class="environment-card__footer">
              <span>
                ${
                  formatRelativeTime(
                    environment.lastSignalReceived,
                  )
                  || "No recent activity"
                }
              </span>

              <span aria-hidden="true">
                →
              </span>
            </footer>
          </button>
        `;
      })
      .join("");

  bindEnvironmentCards();

  const selectedEnvironment =
    state.environments.find(
      (environment) =>
        environment.id
        === state.selectedEnvironmentId,
    );

  renderEnvironmentDetail(
    selectedEnvironment || null,
  );
}

function renderDashboardMetric(
  label,
  value,
) {
  return `
    <article class="dashboard-metric">
      <p class="dashboard-metric__label">
        ${escapeHtml(label)}
      </p>

      <p class="dashboard-metric__value">
        ${escapeHtml(String(value))}
      </p>
    </article>
  `;
}

function bindEnvironmentDetailActions(
  environment,
) {
  const container =
    document.querySelector(
      "#environment-detail-panel",
    );

  if (
    !container
    || !environment
  ) {
    return;
  }

  container
    .querySelectorAll(
      "[data-environment-action]",
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          switch (
            button.dataset.environmentAction
          ) {

            case "history":

              state.historyFilters.source = "";

              state.historyFilters.page = 1;

              state.historyFilters.environment =
                environment.id;

              renderWorkspace(
                "history",
              );

              break;

            case "live-signals":

              renderWorkspace(
                "live-signals",
              );

              loadSignalsForEnvironment(
                environment.id,
              );

              break;

            case "investigations":

              renderWorkspace(
                "investigations",
              );

              break;

          }

        },
      );

    });
}

function bindEnvironmentCards() {
  const container =
    document.querySelector(
      "#environments-results",
    );

  if (!container) {
    return;
  }

  container
    .querySelectorAll(
      "[data-environment-id]",
    )
    .forEach((card) => {
      card.addEventListener(
        "click",
        () => {
          const environmentId =
            card.dataset.environmentId;

          if (!environmentId) {
            return;
          }

          state.selectedEnvironmentId =
            environmentId;

          resetDetailPanelScroll(
            "#environment-detail-panel",
          );

          renderEnvironmentsWorkspace();
        },
      );
    });
}

function renderEnvironmentDetail(
  environment,
) {
  const container =
    document.querySelector(
      "#environment-detail-panel",
    );

  if (!container) {
    return;
  }

  if (!environment) {
    container.innerHTML = `
      <div
        class="
          empty-state
          shared-detail-empty
        "
      >
        <p class="eyebrow">
          Environment
        </p>

        <h2>
          Select an environment
        </h2>

        <p>
          Choose an environment to review
          its operational activity.
        </p>
      </div>
    `;

    return;
  }

  const health =
    getEnvironmentHealth(
      environment,
    );

  container.innerHTML = `
    <header class="detail-header">
      <div class="detail-meta">
        ${createBadge(
          environment.id,
          "environment",
        )}
      </div>

      <h2>
        ${escapeHtml(
          environment.name,
        )}
      </h2>

      <p class="detail-summary">
        Review signal volume, telemetry sources,
        and recent activity for this environment.
      </p>
    </header>

    <section class="integration-detail-section">
      <div class="integration-health-heading">
        <div>
          <p class="eyebrow">
            Operational health
          </p>

          <h3>
            Environment status
          </h3>
        </div>

        <span
          class="
            integration-health-badge
            integration-health-badge--${escapeHtml(
              health.tone,
            )}
          "
        >
          <span
            class="integration-health-badge__indicator"
            aria-hidden="true"
          ></span>

          ${escapeHtml(
            health.label,
          )}
        </span>
      </div>

      <p class="integration-health-description">
        ${escapeHtml(
          health.description,
        )}
      </p>
    </section>

    <section class="integration-detail-section">
      <p class="eyebrow">
        Operational summary
      </p>

      <dl class="signal-facts">
        ${renderFact(
          "Total signals",
          String(
            environment.totalSignals,
          ),
        )}

        ${renderFact(
          "Signals today",
          String(
            environment.signalsToday,
          ),
        )}

        ${renderFact(
          "Connected integrations",
          String(
            environment.integrations,
          ),
        )}

        ${renderIntegrationTimeFact(
          "Last signal received",
          environment.lastSignalReceived,
        )}
      </dl>
    </section>

    <section class="integration-detail-section">
      <p class="eyebrow">
        Telemetry sources
      </p>

      <div class="environment-source-list">
        ${
          environment.sources.length > 0
            ? environment.sources
                .map(
                  (source) => `
                    <div class="environment-source">
                      <div>
                        <strong>
                          ${escapeHtml(
                            formatIntegrationName(
                              source,
                            ),
                          )}
                        </strong>

                        <p>
                          Connected telemetry source
                        </p>
                      </div>

                      <span
                        class="
                          integration-health-badge
                          integration-health-badge--healthy
                        "
                      >
                        <span
                          class="integration-health-badge__indicator"
                          aria-hidden="true"
                        ></span>

                        Receiving
                      </span>
                    </div>
                  `,
                )
                .join("")
            : `
                <p class="list-message">
                  No telemetry sources recorded.
                </p>
              `
        }
      </div>
    </section>

    <section class="integration-detail-section">

      <p class="eyebrow">
        Environment actions
      </p>

      <h3>
        Investigate Environment
      </h3>

      <div class="integration-actions">

        <button
          type="button"
          class="secondary-button"
          data-environment-action="history"
        >
          View Operational Memory
        </button>

        <button
          type="button"
          class="secondary-button"
          data-environment-action="live-signals"
        >
          View Live Signals
        </button>

        <button
          type="button"
          class="secondary-button"
          data-environment-action="investigations"
        >
          View Investigations
        </button>

      </div>

    </section>
  `;

  bindEnvironmentDetailActions(
    environment,
  );
}


function formatIntegrationTimestamp(value) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "medium",
    },
  ).format(date);
}

function formatRelativeTime(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  const differenceInSeconds =
    Math.round(
      (
        date.getTime()
        - Date.now()
      )
      / 1000,
    );

  const ranges = [
    {
      limit: 60,
      divisor: 1,
      unit: "second",
    },
    {
      limit: 3600,
      divisor: 60,
      unit: "minute",
    },
    {
      limit: 86400,
      divisor: 3600,
      unit: "hour",
    },
    {
      limit: 604800,
      divisor: 86400,
      unit: "day",
    },
    {
      limit: 2629800,
      divisor: 604800,
      unit: "week",
    },
    {
      limit: 31557600,
      divisor: 2629800,
      unit: "month",
    },
    {
      limit: Infinity,
      divisor: 31557600,
      unit: "year",
    },
  ];

  const absoluteDifference =
    Math.abs(
      differenceInSeconds,
    );

  const range =
    ranges.find(
      (item) =>
        absoluteDifference
        < item.limit,
    );

  const valueForRange =
    Math.round(
      differenceInSeconds
      / range.divisor,
    );

  return new Intl.RelativeTimeFormat(
    undefined,
    {
      numeric: "auto",
    },
  ).format(
    valueForRange,
    range.unit,
  );
}

function getEnvironmentHealth(
  environment,
) {
  const status =
    String(
      environment?.status || "",
    ).toLowerCase();

  if (status === "warning") {
    return {
      label: "Warning",
      tone: "warning",
      description:
        "One or more failed signals have been recorded in this environment.",
    };
  }

  if (
    !environment.lastSignalReceived
    || environment.totalSignals === 0
  ) {
    return {
      label: "Awaiting data",
      tone: "warning",
      description:
        "This environment is configured, but no telemetry has been received.",
    };
  }

  return {
    label: "Healthy",
    tone: "healthy",
    description:
      "Telemetry is being received and analyzed successfully.",
  };
}

function getIntegrationHealth(
  integration,
) {
  const status =
    String(
      integration?.status || "",
    ).toLowerCase();

  const statistics =
    integration?.statistics || {};

  if (status !== "active") {
    return {
      label: "Unhealthy",
      tone: "unhealthy",
      description:
        "This integration is not currently active.",
    };
  }

  if (
    statistics.signalsProcessed === 0
    || !statistics.lastSignalReceived
  ) {
    return {
      label: "Awaiting data",
      tone: "warning",
      description:
        "The connection is active, but no signals have been received.",
    };
  }

  if (
    statistics.failedAnalyses > 0
  ) {
    return {
      label: "Warning",
      tone: "warning",
      description:
        "The integration is active, but analysis failures have been recorded.",
    };
  }

  if (
    !statistics.lastSignalAnalyzed
  ) {
    return {
      label: "Warning",
      tone: "warning",
      description:
        "Signals have been received, but no successful analysis is recorded.",
    };
  }

  return {
    label: "Healthy",
    tone: "healthy",
    description:
      "Signals are being received and analyzed successfully.",
  };
}

function renderIntegrationTimeFact(
  label,
  value,
) {
  const relativeTime =
    formatRelativeTime(value);

  return `
    <div class="signal-fact">
      <dt>
        ${escapeHtml(label)}
      </dt>

      <dd>
        <span>
          ${escapeHtml(
            formatIntegrationTimestamp(
              value,
            ),
          )}
        </span>

        ${
          relativeTime
            ? `
              <span
                class="integration-time__relative"
              >
                ${escapeHtml(
                  relativeTime,
                )}
              </span>
            `
            : ""
        }
      </dd>
    </div>
  `;
}

function formatIntegrationName(value) {
  const normalized =
    String(value ?? "")
      .trim();

  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .split(/[-_\s]+/)
    .map(
      (word) =>
        word.charAt(0).toUpperCase()
        + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

async function loadIntegrationDetail(
  connectionId,
) {
  const integration =
    state.integrations.find(
      (item) =>
        item.connectionId
        === connectionId,
    );

  if (!integration) {

    if (
      state.integrationMode
      === "create"
    ) {
      renderCreateIntegrationForm();
    } else {
      renderIntegrationDetail(null);
    }

    return;
  }

  state.integrationDetailLoadingId =
    connectionId;

  renderIntegrationDetail(
    integration,
    {
      isLoading: true,
    },
  );

  try {
    const response =
      await fetch(
        `/api/signal-interpreter/integrations/${
          encodeURIComponent(
            connectionId,
          )
        }`,
      );

    if (!response.ok) {
      throw new Error(
        "Unable to load integration health.",
      );
    }

    const detail =
      await response.json();

    state.integrationDetails[
      connectionId
    ] = detail;

    if (
      state.selectedIntegrationId
      !== connectionId
    ) {
      return;
    }

    renderIntegrationDetail(
      detail,
    );
  } catch (error) {
    if (
      state.selectedIntegrationId
      !== connectionId
    ) {
      return;
    }

    renderIntegrationDetail(
      integration,
      {
        error:
          error.message,
      },
    );
  } finally {
    if (
      state.integrationDetailLoadingId
      === connectionId
    ) {
      state.integrationDetailLoadingId =
        null;
    }
  }
}

function renderCreateIntegrationForm(
  options = {},
) {
  return renderIntegrationForm({
    ...options,
    mode:
      "create",
  });
}

function renderEditIntegrationForm(
  integration,
  options = {},
) {
  return renderIntegrationForm({
    ...options,
    mode:
      "edit",
    integration,
  });
}

function renderIntegrationForm({
  mode = "create",
  integration = null,
  error = null,
  values = {},
  isSubmitting = false,
} = {}) {
  const container =
    document.querySelector(
      "#integration-detail-panel",
    );

  if (!container) {
    return;
  }

  const isEdit =
    mode === "edit";

  const source =
    values.source
    || integration?.source
    || "grafana";

  const connectionId =
    values.connectionId
    || integration?.connectionId
    || "";

  const status =
    values.status
    || integration?.status
    || "active";

  container.innerHTML = `
    <div
      class="integration-create"
    >
      <div
        class="integration-create__heading"
      >
        <p class="eyebrow">
          ${
            isEdit
              ? "Connection management"
              : "New connection"
          }
        </p>

        <h2>
          ${
            isEdit
              ? "Edit Integration"
              : "Add Integration"
          }
        </h2>

        <p>
          ${
            isEdit
              ? "Update this telemetry connection and its availability."
              : "Connect Grafana or Datadog directly to Signal Audit."
          }
        </p>
      </div>

      ${
        error
          ? `
            <div
              class="
                integration-detail-message
                integration-detail-message--error
              "
              role="alert"
            >
              ${escapeHtml(error)}
            </div>
          `
          : ""
      }

      <form
        id="integration-form"
        class="integration-create-form"
        data-integration-form-mode="${
          isEdit
            ? "edit"
            : "create"
        }"
      >
        <label>
          <span class="filter-label">
            Telemetry source
          </span>

          <select
            id="integration-source"
            name="source"
            required
          >
            <option
              value="grafana"
              ${
                source === "grafana"
                  ? "selected"
                  : ""
              }
            >
              Grafana
            </option>

            <option
              value="datadog"
              ${
                source === "datadog"
                  ? "selected"
                  : ""
              }
            >
              Datadog
            </option>
          </select>
        </label>

        <label>
          <span class="filter-label">
            Connection ID
          </span>

          <input
            id="integration-connection-id"
            name="connectionId"
            type="text"
            value="${escapeHtml(
              connectionId,
            )}"
            placeholder="grafana-production"
            pattern="[a-z0-9][a-z0-9_\\-]{2,63}"
            minlength="3"
            maxlength="64"
            autocomplete="off"
            required
            ${
              isEdit
                ? "readonly"
                : ""
            }
          >

          <small>
            ${
              isEdit
                ? "The connection ID is permanent because it forms part of the webhook URL."
                : "Use lowercase letters, numbers, hyphens, or underscores."
            }
          </small>
        </label>

        <label>
          <span class="filter-label">
            Status
          </span>

          <select
            id="integration-status"
            name="status"
            required
          >
            <option
              value="active"
              ${
                status === "active"
                  ? "selected"
                  : ""
              }
            >
              Active
            </option>

            <option
              value="inactive"
              ${
                status === "inactive"
                  ? "selected"
                  : ""
              }
            >
              Inactive
            </option>
          </select>
        </label>

        <div
          class="
            integration-detail-message
          "
        >
          Optional outputs can be configured
          separately. Signal Audit does not
          require an external output.
        </div>

        <div
          class="integration-create-form__actions"
        >
          <button
            class="secondary-button"
            type="button"
            data-cancel-integration-form
            ${
              isSubmitting
                ? "disabled"
                : ""
            }
          >
            Cancel
          </button>

          <button
            class="primary-button"
            type="submit"
            ${
              isSubmitting
                ? "disabled"
                : ""
            }
          >
            ${
              isSubmitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save Changes"
                  : "Create Integration"
            }
          </button>
        </div>
      </form>
    </div>
  `;

  bindIntegrationForm({
    mode,
    integration,
  });
}

function bindIntegrationForm({
  mode,
  integration,
}) {
  const form =
    document.querySelector(
      "#integration-form",
    );

  if (!form) {
    return;
  }

  const isEdit =
    mode === "edit";

  form
    .querySelector(
      "[data-cancel-integration-form]",
    )
    ?.addEventListener(
      "click",
      () => {
        state.integrationMode =
          "view";

        if (
          isEdit
          && integration
        ) {
          renderIntegrationDetail(
            integration,
          );
        } else {
          renderIntegrationsWorkspace();
        }
      },
    );

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const formData =
        new FormData(form);

      const values = {
        source:
          String(
            formData.get(
              "source",
            )
            || "",
          ),

        connectionId:
          String(
            formData.get(
              "connectionId",
            )
            || "",
          )
            .trim()
            .toLowerCase(),

        status:
          String(
            formData.get(
              "status",
            )
            || "active",
          ),

      };

      const activeIntegration =
        isEdit
          ? {
              ...integration,

              source:
                values.source,

              status:
                values.status,

              outputs:
                integration?.outputs
                || {},
            }
          : null;

      renderIntegrationForm({
        mode,
        integration:
          activeIntegration,
        values,
        isSubmitting:
          true,
      });

      try {
        const endpoint =
          isEdit
            ? `/api/signal-interpreter/integrations/${
                encodeURIComponent(
                  integration
                    .connectionId,
                )
              }`
            : "/api/signal-interpreter/integrations";

        const response =
          await fetch(
            endpoint,
            {
              method:
                isEdit
                  ? "PATCH"
                  : "POST",

              credentials:
                "same-origin",

              headers: {
                "Content-Type":
                  "application/json",

                "Accept":
                  "application/json",
              },

              body:
                JSON.stringify(
                  isEdit
                    ? {
                        source:
                          values.source,

                        status:
                          values.status,

                        outputs:
                          integration?.outputs
                          || {},
                      }
                    : {
                        connectionId:
                          values.connectionId,

                        source:
                          values.source,

                        status:
                          values.status,

                        outputs:
                          integration?.outputs
                          || {},
                      },
                ),
            },
          );

        const contentType =
          response.headers.get(
            "content-type",
          )
          || "";

        const responseText =
          await response.text();

        let payload = null;

        if (
          contentType.includes(
            "application/json",
          )
          && responseText
        ) {
          payload =
            JSON.parse(
              responseText,
            );
        }

        if (!response.ok) {
          throw new Error(
            payload?.error?.message
            || payload?.error
            || responseText
            || (
              isEdit
                ? "Unable to update integration."
                : "Unable to create integration."
            ),
          );
        }

        const savedIntegration =
          payload?.integration;

        if (!savedIntegration) {
          throw new Error(
            "The Integration API returned no integration record.",
          );
        }

        state.integrationMode =
          "view";

        state.selectedIntegrationId =
          savedIntegration
            .connectionId;

        state.integrationDetails[
          savedIntegration
            .connectionId
        ] = savedIntegration;

        await loadIntegrations();
      } catch (error) {
        renderIntegrationForm({
          mode,
          integration:
            activeIntegration
            || integration,

          values,

          error:
            error instanceof Error
              ? error.message
              : (
                  isEdit
                    ? "Unable to update integration."
                    : "Unable to create integration."
                ),
        });
      }
    },
  );
}

async function testIntegration(
  connectionId,
) {
  const integration =
    state.integrations.find(
      (item) =>
        item.connectionId
        === connectionId,
    );

  if (!integration) {
    return;
  }

  const button =
    document.querySelector(
      `[data-integration-action="test"][data-integration-id="${CSS.escape(
        connectionId,
      )}"]`,
    );

  const originalText =
    button?.textContent
      ?.trim()
    || "Test Connection";

  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Testing…";
  }

  try {
    const response =
      await fetch(
        `/api/signal-interpreter/integrations/${
          encodeURIComponent(
            connectionId,
          )
        }/test`,
        {
          method:
            "POST",

          credentials:
            "same-origin",

          headers: {
            "Accept":
              "application/json",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({}),
        },
      );

    const contentType =
      response.headers.get(
        "content-type",
      )
      || "";

    const responseText =
      await response.text();

    let payload = null;

    if (
      contentType.includes(
        "application/json",
      )
      && responseText
    ) {
      payload =
        JSON.parse(
          responseText,
        );
    }

    if (!response.ok) {
      throw new Error(
        payload?.error?.message
        || payload?.error
        || responseText
        || `Connection test failed (${response.status}).`,
      );
    }

    if (
      !payload?.success
      || !payload?.result
    ) {
      throw new Error(
        "The Integration API returned no test result.",
      );
    }

    delete state.integrationDetails[
      connectionId
    ];

    window.alert(
      [
        "Connection test successful.",
        "",
        `Source: ${formatIntegrationName(
          payload.source,
        )}`,
        `Signal History: ${
          payload.result.historyId
            ? "Recorded"
            : "Not recorded"
        }`,
        `AI analysis: ${
          payload.result.analyzed
            ? "Completed"
            : "Not completed"
        }`,
      ].join("\n"),
    );

    await loadIntegrationDetail(
      connectionId,
    );
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : "Unable to test integration.",
    );

    if (button) {
      button.disabled =
        integration.status
        !== "active";

      button.textContent =
        originalText;
    }
  }
}

async function deleteIntegration(
  connectionId,
) {
  const integration =
    state.integrations.find(
      (item) =>
        item.connectionId
        === connectionId,
    );

  if (!integration) {
    return;
  }

  const confirmed =
    window.confirm(
      `Delete integration "${connectionId}"?\n\n`
      + "New signals sent through this connection will no longer be accepted. Existing Signal History and Operational Memory records will remain available.",
    );

  if (!confirmed) {
    return;
  }

  const button =
    document.querySelector(
      `[data-integration-action="delete"][data-integration-id="${CSS.escape(
        connectionId,
      )}"]`,
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      "Deleting…";
  }

  try {
    const response =
      await fetch(
        `/api/signal-interpreter/integrations/${
          encodeURIComponent(
            connectionId,
          )
        }`,
        {
          method:
            "DELETE",

          credentials:
            "same-origin",

          headers: {
            "Accept":
              "application/json",
          },
        },
      );

    const contentType =
      response.headers.get(
        "content-type",
      )
      || "";

    const responseText =
      await response.text();

    let payload = null;

    if (
      contentType.includes(
        "application/json",
      )
      && responseText
    ) {
      payload =
        JSON.parse(
          responseText,
        );
    }

    if (!response.ok) {
      throw new Error(
        payload?.error?.message
        || payload?.error
        || responseText
        || `Unable to delete integration (${response.status}).`,
      );
    }

    delete state.integrationDetails[
      connectionId
    ];

    state.selectedIntegrationId =
      null;

    state.integrationMode =
      "view";

    await loadIntegrations();
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : "Unable to delete integration.",
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        "Delete Integration";
    }
  }
}

function renderIntegrationDetail(
  integration,
  {
    isLoading = false,
    error = null,
  } = {},
) {
  const container =
    document.querySelector(
      "#integration-detail-panel",
    );

  if (!container) {
    return;
  }

  container.classList.add(
    "shared-detail-panel",
  );

  if (!integration) {
    container.innerHTML = `
      <div
        class="
          empty-state
          shared-detail-empty
        "
      >
        <p class="eyebrow">
          Integration details
        </p>

        <h2>
          Select an integration
        </h2>

        <p>
          Choose a connected telemetry source
          to inspect its configuration and
          operational health.
        </p>
      </div>
    `;

    return;
  }

  const sourceName =
    formatIntegrationName(
      integration.source,
    );

  const outputCount =
    integration.outputs
    && typeof integration.outputs
      === "object"
      ? Object.keys(
          integration.outputs,
        ).length
      : 0;

  const statistics =
    integration.statistics || null;

  const canManageIntegrations =
    window
      .SignalAuditPermissions
      .hasPermission(
        "integrations:write",
      );

  const health =
    statistics
      ? getIntegrationHealth(
          integration,
        )
      : null;

  container.innerHTML = `
    <header
      class="
        detail-header
        shared-detail-header
      "
    >
      <div
        class="
          detail-meta
          shared-detail-meta
        "
      >
        ${createBadge(
          integration.source,
          "source",
        )}

        ${createBadge(
          integration.status,
          "state",
        )}
      </div>

      <h2>
        ${escapeHtml(sourceName)}
      </h2>

      <p
        class="
          detail-summary
          shared-detail-summary
        "
      >
        Review this telemetry source,
        connection activity, and current
        operational health.
      </p>
    </header>

    ${
      error
        ? `
          <div
            class="integration-detail-message
              integration-detail-message--error"
            role="alert"
          >
            ${escapeHtml(error)}
          </div>
        `
        : ""
    }

    <section
      class="
        integration-detail-section
        shared-detail-section
      "
    >
      <p class="eyebrow">
        Connection configuration
      </p>

      <dl class="signal-facts">
        ${renderFact(
          "Connection ID",
          integration.connectionId,
          {
            code: true,
          },
        )}

        ${renderFact(
          "Source",
          sourceName,
        )}

        ${renderFact(
          "Status",
          formatIntegrationName(
            integration.status,
          ),
        )}

        ${renderFact(
          "Optional outputs",
          outputCount > 0
            ? `${outputCount} configured`
            : "None configured",
        )}
      </dl>
    </section>

    <section
      class="
        integration-detail-section
        shared-detail-section
      "
    >
      <div class="integration-health-heading">
        <div>
          <p class="eyebrow">
            Operational health
          </p>

          <h3>
            Connection activity
          </h3>
        </div>

        ${
          health
            ? `
              <span
                class="
                  integration-health-badge
                  integration-health-badge--${
                    escapeHtml(
                      health.tone,
                    )
                  }
                "
              >
                <span
                  class="integration-health-badge__indicator"
                  aria-hidden="true"
                ></span>

                ${escapeHtml(
                  health.label,
                )}
              </span>
            `
            : ""
        }
      </div>

      ${
        isLoading
          ? `
            <div
              class="integration-health-loading"
            >
              Loading operational health...
            </div>
          `
          : statistics
            ? `
              <p
                class="integration-health-description"
              >
                ${escapeHtml(
                  health.description,
                )}
              </p>

              <dl class="signal-facts">
                ${renderFact(
                  "Signals processed",
                  String(
                    statistics
                      .signalsProcessed
                    ?? 0,
                  ),
                )}

                ${renderIntegrationTimeFact(
                  "Last signal received",
                  statistics
                    .lastSignalReceived,
                )}

                ${renderIntegrationTimeFact(
                  "Last signal analyzed",
                  statistics
                    .lastSignalAnalyzed,
                )}

                ${renderFact(
                  "Failed analyses",
                  String(
                    statistics
                      .failedAnalyses
                    ?? 0,
                  ),
                )}
              </dl>
            `
            : `
              <p
                class="integration-health-description"
              >
                Operational health data is
                currently unavailable.
              </p>
            `
      }
        </section>

        <section
      class="
        integration-detail-section
        shared-detail-section
      "
    >

          <p class="eyebrow">
            Integration actions
          </p>

          <h3>
            Manage Connection
          </h3>

          <div
            class="
              integration-actions
              shared-detail-actions
            "
          >

            <button
              type="button"
              class="secondary-button"
              data-integration-action="history"
            >
              View Operational Memory
            </button>

            <button
              type="button"
              class="secondary-button"
              data-integration-action="live-signals"
            >
              View Live Signals
            </button>

            ${
              canManageIntegrations
                ? `
                  <button
                    type="button"
                    class="secondary-button"
                    data-integration-action="test"
                    data-integration-id="${escapeHtml(
                      integration.connectionId,
                    )}"
                    ${
                      integration.status
                        !== "active"
                        ? "disabled"
                        : ""
                    }
                    title="${
                      integration.status
                        === "active"
                        ? "Run an end-to-end integration test"
                        : "Activate this integration before testing it"
                    }"
                  >
                    Test Connection
                  </button>

                  <button
                    type="button"
                    class="secondary-button"
                    data-integration-action="edit"
                  >
                    Edit Integration
                  </button>

                  <button
                    type="button"
                    class="
                      secondary-button
                      destructive-button
                    "
                    data-integration-action="delete"
                    data-integration-id="${escapeHtml(
                      integration.connectionId,
                    )}"
                  >
                    Delete Integration
                  </button>
                `
                : ""
            }

          </div>

        </section>
      `;

      bindIntegrationDetailActions(
        integration,
      );
}

function bindIntegrationDetailActions(integration) {
  const container = document.querySelector(
    "#integration-detail-panel",
  );

  if (!container || !integration) {
    return;
  }

  container
    .querySelectorAll("[data-integration-action]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        switch (button.dataset.integrationAction) {

          case "history":
            state.historyFilters.source = integration.source;
            state.historyFilters.page = 1;

            renderWorkspace("history");

            const historySource =
              document.querySelector("#history-source");

            if (historySource) {
              historySource.value = integration.source;
            }

            break;

          case "live-signals":
            state.liveSignalsFilters = {
              source:
                integration.source,

              environment:
                "",

              state:
                "",

              severity:
                "",
            };

            state.selectedSignalId =
              null;

            renderWorkspace(
              "live-signals",
            );

            syncLiveSignalFilters();

            loadSignals();

            break;

          case "test":
            testIntegration(
              integration.connectionId,
            );

            break;

          case "edit":
            state.integrationMode =
              "edit";

            renderEditIntegrationForm(
              integration,
            );

            break;

          case "delete":
            deleteIntegration(
              integration.connectionId,
            );

            break;
        }
      });
    });
}



function bindIntegrationCards() {
  const container =
    document.querySelector(
      "#integrations-results",
    );

  if (!container) {
    return;
  }

  container
    .querySelectorAll(
      "[data-integration-id]",
    )
    .forEach((card) => {
      card.addEventListener(
        "click",
        () => {
          const integrationId =
            card.dataset.integrationId;

          if (!integrationId) {
            return;
          }

          state.integrationMode =
            "view";

          state.selectedIntegrationId =
            integrationId;

          resetDetailPanelScroll(
            "#integration-detail-panel",
          );

          renderIntegrationsWorkspace();
        },
      );
    });
}

function renderIntegrationsWorkspace() {
  const container =
    document.querySelector(
      "#integrations-results",
    );

  if (!container) {
    return;
  }

  if (
    state.integrations.length === 0
  ) {
    container.innerHTML = `
      <div class="list-message">
        <p class="list-message__title">
          No integrations configured
        </p>

        <p>
          Connect a telemetry source to begin
          receiving operational signals.
        </p>
      </div>
    `;

    renderIntegrationDetail(null);

    return;
  }

  if (
    !state.selectedIntegrationId
    || !state.integrations.some(
      (integration) =>
        integration.connectionId
        === state.selectedIntegrationId,
    )
  ) {
    state.selectedIntegrationId =
      state.integrations[0].connectionId;
  }

  container.innerHTML =
    state.integrations
      .map((integration) => {
        const isSelected =
          integration.connectionId
          === state.selectedIntegrationId;

        const sourceName =
          formatIntegrationName(
            integration.source,
          );

        return `
          <button
            class="
              integration-card
              ${
                isSelected
                  ? "is-active"
                  : ""
              }
            "
            type="button"
            data-integration-id="${escapeHtml(
              integration.connectionId,
            )}"
            aria-pressed="${isSelected}"
          >
            <div class="detail-meta">
              ${createBadge(
                integration.source,
                "source",
              )}

              ${createBadge(
                integration.status,
                "state",
              )}
            </div>

            <h3>
              ${escapeHtml(sourceName)}
            </h3>

            <p class="integration-card__connection">
              ${escapeHtml(
                integration.connectionId,
              )}
            </p>

            <footer class="signal-card__footer">
              <span>
                ${
                  integration.outputs
                  && Object.keys(
                    integration.outputs,
                  ).length > 0
                    ? `${
                        Object.keys(
                          integration.outputs,
                        ).length
                      } optional output${
                        Object.keys(
                          integration.outputs,
                        ).length === 1
                          ? ""
                          : "s"
                      }`
                    : "No optional outputs"
                }
              </span>

              <span aria-hidden="true">
                →
              </span>
            </footer>
          </button>
        `;
      })
      .join("");

  bindIntegrationCards();

  if (
    state.integrationMode
    === "create"
  ) {
    renderCreateIntegrationForm();

    return;
  }

  if (
    state.integrationMode
    === "edit"
  ) {
    const integration =
      state.integrations.find(
        (item) =>
          item.connectionId
          === state
            .selectedIntegrationId,
      );

    if (integration) {
      renderEditIntegrationForm(
        integration,
      );

      return;
    }

    state.integrationMode =
      "view";
  }

  const selectedIntegration =
    state.integrations.find(
      (integration) =>
        integration.connectionId
        === state.selectedIntegrationId,
    );

  if (!selectedIntegration) {
    renderIntegrationDetail(null);

    return;
  }

  const cachedDetail =
    state.integrationDetails[
      selectedIntegration.connectionId
    ];

  if (cachedDetail) {
    renderIntegrationDetail(
      cachedDetail,
    );
  }

  loadIntegrationDetail(
    selectedIntegration.connectionId,
  );
}

function renderWorkspace(
  workspace,
  options = {},
) {
  const {
    updateHash = true,
  } = options;

  const resolvedWorkspace =
    window
      .SignalAuditWorkspaces
      .resolveWorkspace(
        workspace,
        {
          includeStoredPreference:
            false,
        },
      );

  const definition =
    workspaceDefinitions[
      resolvedWorkspace
    ];

  state.activeWorkspace =
    resolvedWorkspace;

  workspaceTitle.textContent =
    definition.title;

  const isLiveSignals =
    resolvedWorkspace
    === "live-signals";

  const isPaneWorkspace = [
    "live-signals",
    "investigations",
    "history",
    "integrations",
  ].includes(
    resolvedWorkspace,
  );

  applicationContent?.classList.toggle(
    "application-content--pane",
    isPaneWorkspace,
  );

  applicationContent?.classList.toggle(
    "application-content--document",
    !isPaneWorkspace,
  );

  liveSignalsWorkspace.hidden =
    !isLiveSignals;

  secondaryWorkspace.hidden =
    isLiveSignals;

  refreshButton.hidden =
    !isLiveSignals;

  syncLiveSignalsAutoRefresh();

  addIntegrationButton.hidden =
    resolvedWorkspace
      !== "integrations"
    || !window
      .SignalAuditPermissions
      .hasPermission(
        "integrations:write",
      );

  workspaceButtons.forEach(
    (button) => {
      const isActive =
        button.dataset.workspace
        === resolvedWorkspace;

      button.classList.toggle(
        "is-active",
        isActive,
      );

      if (isActive) {
        button.setAttribute(
          "aria-current",
          "page",
        );
      } else {
        button.removeAttribute(
          "aria-current",
        );
      }
    },
  );

  if (isLiveSignals) {
    syncLiveSignalFilters();

    renderSignalList();

    if (state.selectedSignalDetail) {
      renderSignalDetail(
        state.selectedSignalDetail,
      );
    }
  } else {
    renderSecondaryWorkspace(
      resolvedWorkspace,
    );
  }

  if (
    updateHash
    && getWorkspaceFromHash()
      !== resolvedWorkspace
  ) {
    window.location.hash =
      `/${resolvedWorkspace}`;
  }
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function formatCompactDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}

function createContextLine(record) {
  const values = [
    record.service,
    record.signal?.environment,
    record.signal?.team,
  ].filter(Boolean);

  if (values.length === 0) {
    return "No service context";
  }

  return values.join(" · ");
}

function hasDisplayValue(value) {
  return !(
    value === null
    || value === undefined
    || value === ""
  );
}

function renderFact(
  label,
  value,
  options = {},
) {
  if (!hasDisplayValue(value)) {
    return "";
  }

  const {
    href = null,
    code = false,
  } = options;

  let renderedValue;

  if (href) {
    renderedValue = `
      <a
        href="${escapeHtml(href)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeHtml(value)}
      </a>
    `;
  } else if (code) {
    renderedValue = `
      <code>
        ${escapeHtml(value)}
      </code>
    `;
  } else {
    renderedValue =
      escapeHtml(value);
  }

  return `
    <div class="signal-fact">
      <dt>${escapeHtml(label)}</dt>

      <dd>
        ${renderedValue}
      </dd>
    </div>
  `;
}

function renderSignalFacts(record) {
  const signal =
    record.signal || {};

  const sourceUrl =
    signal.alertUrl
    || signal.generatorUrl
    || signal.dashboardUrl
    || signal.panelUrl
    || null;

  const sourceUrlLabel =
    signal.alertUrl
      ? "Open Datadog monitor"
      : signal.generatorUrl
        ? "Open Grafana alert"
        : signal.dashboardUrl
          ? "Open Grafana dashboard"
          : signal.panelUrl
            ? "Open Grafana panel"
            : null;

  const values =
    signal.values
    && typeof signal.values === "object"
      ? Object.entries(signal.values)
          .map(
            ([key, value]) =>
              `${key}: ${value}`,
          )
          .join(", ")
      : null;

  return `
    <dl class="signal-facts">
      ${renderFact(
        "Service",
        record.service
        || signal.service,
      )}

      ${renderFact(
        "Environment",
        signal.environment,
      )}

      ${renderFact(
        "Team",
        signal.team,
      )}

      ${renderFact(
        "Alert status",
        record.status
        || signal.status,
      )}

      ${renderFact(
        "Processing state",
        record.state,
      )}

      ${renderFact(
        "Received",
        formatDate(
          record.receivedAt,
        ),
      )}

      ${renderFact(
        "Started",
        formatDate(
          signal.startsAt,
        ),
      )}

      ${renderFact(
        "Analyzed",
        formatDate(
          record.analyzedAt,
        ),
      )}

      ${renderFact(
        "Delivered",
        formatDate(
          record.deliveredAt,
        ),
      )}

      ${renderFact(
        "Connection",
        record.connectionId
        || signal.connectionId,
        {
          code: true,
        },
      )}

      ${renderFact(
        "Fingerprint",
        record.fingerprint
        || signal.fingerprint,
        {
          code: true,
        },
      )}

      ${renderFact(
        "Monitor ID",
        signal.monitorId,
        {
          code: true,
        },
      )}

      ${renderFact(
        "Monitor type",
        signal.monitorType,
      )}

      ${renderFact(
        "Metric",
        signal.metric,
        {
          code: true,
        },
      )}

      ${renderFact(
        "Current value",
        signal.value,
      )}

      ${renderFact(
        "Threshold",
        signal.threshold,
      )}

      ${renderFact(
        "Grafana values",
        values,
        {
          code: true,
        },
      )}

      ${renderFact(
        "Host",
        signal.hostname,
        {
          code: true,
        },
      )}

      ${renderFact(
        "Scope",
        signal.scope,
        {
          code: true,
        },
      )}

      ${renderFact(
        "Source link",
        sourceUrlLabel,
        {
          href: sourceUrl,
        },
      )}
    </dl>
  `;
}

function renderTimeline(record) {
  const events = [
    {
      label: "Signal received",
      timestamp: record.receivedAt,
      complete: Boolean(record.receivedAt),
    },
    {
      label: "Analysis completed",
      timestamp: record.analyzedAt,
      complete: Boolean(record.analyzedAt),
    },
    {
      label:
        record.state === "failed"
          ? "Delivery failed"
          : "Delivered",
      timestamp:
        record.state === "failed"
          ? record.failedAt
          : record.deliveredAt,
      complete:
        record.state === "failed"
          ? true
          : Boolean(record.deliveredAt),
    },
  ];

  return `
    <section
      class="
        timeline
        shared-detail-section
      "
    >
      <h3 class="timeline__heading">
        Timeline
      </h3>

      ${events
        .map(
          (event, index) => `
            <div class="timeline__event">
              <div class="timeline__marker">
                ${
                  event.complete
                    ? "●"
                    : "○"
                }
              </div>

              <div class="timeline__content">
                <strong>
                  ${escapeHtml(event.label)}
                </strong>

                <p>
                  ${
                    event.timestamp
                      ? escapeHtml(
                          formatDate(
                            event.timestamp,
                          ),
                        )
                      : "Pending"
                  }
                </p>
              </div>

              ${
                index
                  < events.length - 1
                  ? '<div class="timeline__line"></div>'
                  : ""
              }
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderSectionNavigation(
  findingsCount,
) {
  const hasFindings =
    findingsCount > 0;

  return `
    <div
      class="section-navigation"
      role="tablist"
      aria-label="Signal detail views"
    >
      <button
        class="
          section-navigation__tab
          ${
            state.activeDetailView
              === "overview"
              ? "is-active"
              : ""
          }
        "
        type="button"
        role="tab"
        id="overview-tab"
        aria-selected="${
          state.activeDetailView
            === "overview"
        }"
        aria-controls="overview-panel"
        data-detail-view="overview"
      >
        Overview
      </button>

      ${
        hasFindings
          ? `
              <button
                class="
                  section-navigation__tab
                  ${
                    state.activeDetailView
                      === "findings"
                      ? "is-active"
                      : ""
                  }
                "
                type="button"
                role="tab"
                id="findings-tab"
                aria-selected="${
                  state.activeDetailView
                    === "findings"
                }"
                aria-controls="findings-panel"
                data-detail-view="findings"
              >
                Findings (${findingsCount})
              </button>
            `
          : ""
      }
    </div>
  `;
}

function getDetailPanelClass(
  viewName,
) {
  return [
    "detail-view",
    state.activeDetailView
      === viewName
      ? "is-active"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeBadgeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function getInvestigationPrimaryAction(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "new":
      return {
        label: "Start Investigation",
        className: "primary",
        scroll: false,
      };

    case "investigating":
      return null;

    case "monitoring":
      return {
        label: "Resolve Investigation",
        className: "success",
        scroll: true,
      };

    case "resolved":
      return null;

    default:
      return null;
  }
}

function createBadge(
  value,
  type = "generic",
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return "";
  }

  const normalizedType =
    normalizeBadgeValue(type);

  const normalizedValue =
    normalizeBadgeValue(value);

  const classes = [
    "badge",
    `badge--${normalizedType}`,
    `badge--${normalizedType}-${normalizedValue}`,
  ].join(" ");

  return `
    <span class="${classes}">
      ${escapeHtml(value)}
    </span>
  `;
}

function getRecommendedActions(findings) {
  const actionGroups = [
    {
      key: "immediate",
      label: "Immediate",
    },
    {
      key: "shortTerm",
      label: "Short-term",
    },
    {
      key: "longTerm",
      label: "Long-term",
    },
  ];

  const actions = [];
  const seenActions = new Set();

  findings.forEach((finding) => {
    actionGroups.forEach(
      ({ key, label }) => {
        const values =
          finding.actions?.[key];

        if (!Array.isArray(values)) {
          return;
        }

        values.forEach((value) => {
          if (
            typeof value !== "string"
            || value.trim() === ""
          ) {
            return;
          }

          const normalizedValue =
            value.trim();

          const deduplicationKey =
            normalizedValue.toLowerCase();

          if (
            seenActions.has(
              deduplicationKey,
            )
          ) {
            return;
          }

          seenActions.add(
            deduplicationKey,
          );

          actions.push({
            priority: label,
            action: normalizedValue,
            owner:
              finding.recommendedOwner
              || null,
          });
        });
      },
    );
  });

  return actions;
}

function renderRecommendedActions(
  findings,
) {
  const actions =
    getRecommendedActions(findings);

  if (actions.length === 0) {
    return "";
  }

  return `
    <section
      class="
        recommended-actions
        shared-detail-section
      "
      aria-labelledby="recommended-actions-heading"
    >
      <div class="recommended-actions__heading">
        <p class="eyebrow">
          Operational response
        </p>

        <h3 id="recommended-actions-heading">
          Recommended Actions
        </h3>
      </div>

      <div class="recommended-actions__list">
        ${actions
          .map(
            (
              action,
              index,
            ) => `
              <article
                class="recommended-action"
              >
                <div
                  class="recommended-action__number"
                  aria-hidden="true"
                >
                  ${String(
                    index + 1,
                  ).padStart(2, "0")}
                </div>

                <div
                  class="recommended-action__content"
                >
                  <div
                    class="recommended-action__meta"
                  >
                    ${createBadge(
                      action.priority,
                      "priority",
                    )}

                    ${
                      action.owner
                        ? createBadge(
                            action.owner,
                            "owner",
                          )
                        : ""
                    }
                  </div>

                  <p>
                    ${escapeHtml(
                      action.action,
                    )}
                  </p>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function getRelatedSignals(record) {
  return state.signals
    .filter((candidate) => {
      if (candidate.id === record.id) {
        return false;
      }

      const sameService =
        candidate.service &&
        candidate.service === record.service;

      const sameEnvironment =
        candidate.signal?.environment &&
        candidate.signal?.environment ===
          record.signal?.environment;

      return sameService || sameEnvironment;
    })
    .sort((a, b) => {
      return (
        new Date(b.receivedAt) -
        new Date(a.receivedAt)
      );
    })
    .slice(0, 5);
}

function renderRelatedSignals(record) {
  const related =
    getRelatedSignals(record);

  if (related.length === 0) {
    return "";
  }

  return `
    <section
      class="
        related-signals
        shared-detail-section
      "
      aria-labelledby="related-signals-heading"
    >
      <div class="related-signals__heading">
        <p class="eyebrow">
          Operational context
        </p>

        <h3 id="related-signals-heading">
          Related Signals
        </h3>
      </div>

      <div class="related-signals__list">
        ${related
          .map((signal) => {
            const relationship =
              signal.service === record.service
                ? "Same service"
                : "Same environment";

            return `
              <button
                class="related-signal"
                type="button"
                data-signal-id="${escapeHtml(signal.id)}"
              >
                <div class="related-signal__meta">
                  ${createBadge(
                    relationship,
                    "relationship",
                  )}

                  ${createBadge(
                    signal.severity,
                    "severity",
                  )}
                </div>

                <h4>
                  ${escapeHtml(
                    signal.signal?.title ||
                    signal.service ||
                    "Untitled signal",
                  )}
                </h4>

                <p>
                  ${escapeHtml(
                    formatCompactDate(
                      signal.receivedAt,
                    ),
                  )}
                </p>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function getAuditSummary(record) {
  if (
    record.analysis
    && typeof record.analysis === "object"
  ) {
    return record.analysis.summary
      || "Structured audit available.";
  }

  if (
    typeof record.analysis === "string"
  ) {
    return "Legacy markdown audit.";
  }

  return "Awaiting analysis.";
}

function renderSignalList() {
  if (state.signals.length === 0) {
    signalList.innerHTML = `
      <div class="list-message">
        <p class="list-message__title">
          No matching signals
        </p>

        <p>
          Adjust the active filters or
          refresh the signal feed.
        </p>
      </div>
    `;

    return;
  }

  signalList.innerHTML =
    state.signals
      .map((record) => {
        const activeClass =
          record.id
            === state.selectedSignalId
            ? "is-active"
            : "";

        const title =
          record.signal?.title
          || record.service
          || "Untitled signal";

        const summary =
          getAuditSummary(record);

        return `
          <button
            class="signal-card ${activeClass}"
            type="button"
            data-signal-id="${escapeHtml(
              record.id,
            )}"
            aria-pressed="${
              record.id
                === state.selectedSignalId
            }"
          >
            <div class="signal-card__meta">
              ${createBadge(
                record.source,
                "source",
              )}

              ${createBadge(
                record.severity,
                "severity",
              )}

              ${createBadge(
                record.status,
                "status",
              )}

              ${createBadge(
                record.state,
                "state",
              )}
            </div>

            <h3 class="signal-card__title">
              ${escapeHtml(title)}
            </h3>

            <p class="signal-card__context">
              ${escapeHtml(
                createContextLine(record),
              )}
            </p>

            <p class="signal-card__summary">
              ${escapeHtml(summary)}
            </p>

            <footer class="signal-card__footer">
              <time
                datetime="${escapeHtml(
                  record.receivedAt || "",
                )}"
              >
                ${escapeHtml(
                  formatCompactDate(
                    record.receivedAt,
                  ),
                )}
              </time>

              <span aria-hidden="true">
                →
              </span>
            </footer>
          </button>
        `;
      })
      .join("");
}

function renderList(items) {
  if (!Array.isArray(items)
      || items.length === 0) {
    return "<p>None recorded.</p>";
  }

  return `
    <ul>
      ${items
        .map(
          (item) => `
            <li>
              ${escapeHtml(item)}
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderFinding(
  finding,
  index,
  count,
) {
  return `
    <article
      class="
        finding
        shared-detail-section
      "
    >
      <div
        class="
          detail-meta
          shared-detail-meta
        "
      >
        ${createBadge(
          `Finding ${index + 1} of ${count}`,
          "finding",
        )}
        ${createBadge(
          finding.severity,
          "severity",
        )}
        ${createBadge(
          `${finding.confidence}% confidence`,
          "confidence",
        )}
        ${createBadge(
          finding.category,
          "category",
        )}
      </div>

      <h3>
        ${escapeHtml(finding.title)}
      </h3>

      <section class="finding-section">
        <h4>What matters</h4>
        <p>
          ${escapeHtml(
            finding.executiveSummary,
          )}
        </p>
      </section>

      <section class="finding-section">
        <h4>Technical analysis</h4>
        <p>
          ${escapeHtml(
            finding.technicalAnalysis,
          )}
        </p>
      </section>

      <section class="finding-section">
        <h4>Evidence</h4>
        ${renderList(finding.evidence)}
      </section>

      <section class="finding-section">
        <h4>Business impact</h4>
        <p>
          ${escapeHtml(
            finding.businessImpact,
          )}
        </p>
      </section>

      <section class="finding-section">
        <h4>Affected services</h4>
        ${renderList(
          finding.affectedServices,
        )}
      </section>

      <section class="finding-section">
        <h4>Recommended owner</h4>
        <p>
          ${escapeHtml(
            finding.recommendedOwner
            || "Unassigned",
          )}
        </p>
      </section>

      <section class="finding-section">
        <h4>Immediate actions</h4>
        ${renderList(
          finding.actions?.immediate,
        )}
      </section>

      <section class="finding-section">
        <h4>Short-term actions</h4>
        ${renderList(
          finding.actions?.shortTerm,
        )}
      </section>

      <section class="finding-section">
        <h4>Long-term improvements</h4>
        ${renderList(
          finding.actions?.longTerm,
        )}
      </section>
    </article>
  `;
}

function createInvestigation(record) {
    const now =
        new Date().toISOString();

    const investigation = {
        id:
            crypto.randomUUID(),

        title:
            record.signal?.title
            ?? record.analysis?.summary
            ?? record.service
            ?? "Untitled Investigation",

        question:
            `Why is ${
                record.service
                ?? "this service"
            } experiencing this condition?`,

        summary:
            record.analysis?.summary
            ?? "",

        status:
            "Investigating",

        assessment: {
            summary:
                record.analysis?.summary
                ?? record.analysis?.findings?.[0]?.executiveSummary
                ?? "",

            confidence:
                record.analysis?.findings?.[0]?.confidence
                ?? null,

            updatedAt:
                now,
        },

        evidence: {
            signals: [
                record.id,
            ],

            metrics:
                [],

            deployments:
                [],

            logs:
                [],

            incidents:
                [],

            environments: [
                record.signal?.environment,
            ].filter(Boolean),
        },

        findings:
            [],

        timeline:
            [],

        recommendations: {

            immediate: [],

            shortTerm: [],

            longTerm: [],

        },

        resolution: {

            status: "open",

            summary: "",

            rootCause: "",

            lessonsLearned: [],

            correctiveActions: [],

            preventiveActions: [],

            resolvedBy: "",

            resolvedAt: null,

        },

        createdAt:
            now,

        updatedAt:
            now,
    };

    addTimelineEvent(
        investigation,
        {
            type:
                "investigation-created",

            label:
                "Investigation created",
        },
    );

    return investigation;
}


function createInvestigationFromSignal(
    record,
) {

    if (!record?.id) {
        return null;
    }

    const existing =
        state.investigations.find(
            (investigation) =>
                investigation.status !== "resolved"
                &&
                investigation
                    ?.evidence
                    ?.signals
                    ?.includes(record.id),
        );

    if (existing) {

        state.selectedInvestigationId =
            existing.id;

        return existing;

    }

    const investigation =
        createInvestigation(record);

    state.investigations.unshift(
        investigation,
    );

    state.selectedInvestigationId =
        investigation.id;

    return investigation;

}

function addSignalToInvestigation(
    investigationId,
    record,
) {

    if (
        !investigationId
        || !record?.id
    ) {
        return null;
    }

    const investigation =
        state.investigations.find(
            item =>
                item.id === investigationId,
        );

    if (
        !investigation
        || investigation.status === "resolved"
    ) {
        return null;
    }

    investigation.evidence ??= {};

    investigation.evidence.signals ??= [];

    if (
        !investigation
            .evidence
            .signals
            .includes(record.id)
    ) {

        investigation
            .evidence
            .signals
            .push(record.id);

        addTimelineEvent(
            investigation,
            {
                type:
                    "signal-attached",

                label:
                    "Signal attached",

                description:
                    record.signal?.title
                    ?? record.service
                    ?? "Signal",

                reference:
                    record.id,
            },
        );

    }

    state.selectedInvestigationId =
        investigation.id;

    return investigation;

}

function addTimelineEvent(
    investigation,
    {
        type,
        label,
        description = "",
        reference = null,
    },
) {

    investigation.timeline ??= [];

    investigation.timeline.push({

        id: crypto.randomUUID(),

        timestamp:
            new Date().toISOString(),

        type,

        label,

        description,

        reference,

    });

    investigation.updatedAt =
        new Date().toISOString();

}

function updateAssessment(
    investigation,
    {
        summary,
        confidence,
    },
) {

    investigation.assessment ??= {};

    if (summary) {

        investigation.assessment.summary =
            summary;

    }

    if (
        confidence != null
    ) {

        investigation.assessment.confidence =
            confidence;

    }

    investigation.assessment.updatedAt =
        new Date().toISOString();

    investigation.updatedAt =
        investigation.assessment.updatedAt;

}

function addFinding(
    investigation,
    finding,
) {

    investigation.findings ??= [];

    investigation.findings.push(
        finding,
    );

    addTimelineEvent(
        investigation,
        {
            type:
                "finding-created",

            label:
                "Finding added",

            description:
                finding.title,

            reference:
                finding.id ?? null,
        },
    );

    updateAssessment(
        investigation,
        {
            summary:
                finding.executiveSummary,

            confidence:
                finding.confidence,
        },
    );

    updateRecommendations(
        investigation,
        finding.actions ?? {},
    );
}

function updateRecommendations(
    investigation,
    recommendations,
) {

    investigation.recommendations = {

        immediate:
            recommendations.immediate ?? [],

        shortTerm:
            recommendations.shortTerm ?? [],

        longTerm:
            recommendations.longTerm ?? [],

    };

    addTimelineEvent(
        investigation,
        {
            type:
                "recommendations-updated",

            label:
                "Recommendations updated",
        },
    );

}

function renderSignalInvestigationActions(
  record,
) {
  const canModifyInvestigations =
    window
      .SignalAuditPermissions
      .hasPermission(
        "investigations:write",
      );

  if (!canModifyInvestigations) {
    return "";
  }

  const openInvestigations =
    state.investigations.filter(
      (investigation) =>
        investigation.status
        !== "resolved",
    );

  const currentInvestigations =
    openInvestigations.filter(
        (investigation) =>
            investigation
                ?.evidence
                ?.signals
                ?.includes(record.id),
    );

  const availableInvestigations =
    openInvestigations.filter(
        (investigation) =>
            !investigation
                ?.evidence
                ?.signals
                ?.includes(record.id),
    );

  return `
    <section
      class="
        signal-investigation-actions
        shared-detail-section
      "
      aria-labelledby="signal-investigation-actions-title"
    >
      <div
        class="signal-investigation-actions__heading"
      >
        <div>
          <p class="eyebrow">
            Investigation workflow
          </p>

          <h3
            id="signal-investigation-actions-title"
          >
            Investigation Actions
          </h3>
        </div>

        ${
          currentInvestigations.length > 0
            ? createBadge(
                `Included in ${
                  currentInvestigations.length
                } investigation${
                  currentInvestigations.length === 1
                    ? ""
                    : "s"
                }`,
                "investigation-membership",
              )
            : ""
        }
      </div>

      ${
        availableInvestigations.length > 0
          ? `
              <div
                class="signal-investigation-actions__assignment"
              >
                <div
                  class="signal-investigation-actions__field"
                >
                  <label
                    for="investigation-select"
                  >
                    Add to an existing investigation
                  </label>

                  <select
                    id="investigation-select"
                    data-investigation-select
                  >
                    <option value="">
                      Select an investigation
                    </option>

                    ${availableInvestigations
                      .map(
                        (investigation) => `
                          <option
                            value="${escapeHtml(
                              investigation.id,
                            )}"
                          >
                            ${escapeHtml(
                              investigation.title,
                            )}
                          </option>
                        `,
                      )
                      .join("")}
                  </select>
                </div>

                <button
                  type="button"
                  class="secondary-button"
                  data-add-signal-to-investigation
                  disabled
                >
                  Add Signal
                </button>
              </div>

              <div
                class="signal-investigation-actions__divider"
              >
                <span>
                  or
                </span>
              </div>
            `
          : ""
      }

      <button
        type="button"
        class="signal-investigation-actions__new"
        data-start-investigation
        data-signal-id="${escapeHtml(
          record.id,
        )}"
      >
        <span>
          ${
            currentInvestigations.length > 0
              ? "Create Another Investigation"
              : "Start Investigation"
          }
        </span>

        <span aria-hidden="true">
          →
        </span>
      </button>

      ${
        currentInvestigations.length > 0
          ? `
              <div
                class="signal-investigation-actions__memberships"
              >
                <p>
                  This signal currently belongs to:
                </p>

                <ul>
                  ${currentInvestigations
                    .map(
                      (investigation) => `
                        <li>
                          ${escapeHtml(
                            investigation.title,
                          )}
                        </li>
                      `,
                    )
                    .join("")}
                </ul>
              </div>
            `
          : ""
      }
    </section>
  `;
}

function renderSignalDetail(record) {
  const analysis = record.analysis;

  if (
    !analysis
    || typeof analysis !== "object"
  ) {
    detailPanel.innerHTML = `
      <div
        class="
          empty-state
          shared-detail-empty
        "
      >
        <p class="eyebrow">
          ${escapeHtml(record.source)}
        </p>

        <h2>
          ${escapeHtml(
            record.signal?.title
            || "Signal details",
          )}
        </h2>

        <p>
          This record does not contain a
          structured audit.
        </p>
      </div>
    `;

    return;
  }

  const findings =
    Array.isArray(analysis.findings)
      ? analysis.findings
      : [];

  const hasFindings =
    findings.length > 0;

  if (
    !hasFindings
    && state.activeDetailView === "findings"
  ) {
    state.activeDetailView = "overview";
  }

  detailPanel.innerHTML = `
    <div class="shared-detail-panel">

    <header
      class="
        detail-header
        shared-detail-header
      "
    >
      <div
        class="
          detail-meta
          shared-detail-meta
        "
      >
        ${createBadge(
          record.source,
          "source",
        )}

        ${createBadge(
          record.service,
          "service",
        )}

        ${createBadge(
          record.signal?.environment,
          "environment",
        )}

        ${createBadge(
          record.severity,
          "severity",
        )}

        ${createBadge(
          record.status,
          "status",
        )}

        ${createBadge(
          record.state,
          "state",
        )}
      </div>

      <h2>
        ${escapeHtml(
          record.signal?.title
          || analysis.summary
          || "Signal audit",
        )}
      </h2>

      <p
        class="
          detail-summary
          shared-detail-summary
        "
      >
        ${escapeHtml(
          analysis.summary,
        )}
      </p>

      ${renderSignalInvestigationActions(
        record,
      )}

      ${renderSectionNavigation(
        findings.length,
      )}
    </header>

    <div class="detail-view-container">
      <section
        id="overview-panel"
        class="${getDetailPanelClass(
          "overview",
        )}"
        role="tabpanel"
        aria-labelledby="overview-tab"
        ${
          state.activeDetailView
            === "overview"
            ? ""
            : "hidden"
        }
      >
        ${renderRecommendedActions(findings)}
        ${renderSignalFacts(record)}
        ${renderTimeline(record)}
        ${renderRelatedSignals(record)}

        ${
          !hasFindings
            ? `
                <section
                  class="operational-assessment"
                  aria-labelledby="operational-assessment-title"
                >
                  <div
                    class="operational-assessment__icon"
                    aria-hidden="true"
                  >
                    ✓
                  </div>

                  <div>
                    <h3
                      id="operational-assessment-title"
                    >
                      No actionable findings
                    </h3>

                    <p>
                      Signal Audit reviewed this
                      signal and did not identify
                      any conditions requiring
                      immediate action.
                    </p>
                  </div>
                </section>
              `
            : ""
        }

        <div class="detail-meta detail-meta--footer">
          ${
            hasFindings
              ? createBadge(
                  `${findings.length} finding${
                    findings.length === 1
                      ? ""
                      : "s"
                  }`,
                  "finding-count",
                )
              : ""
          }

          ${createBadge(
            formatDate(record.receivedAt),
            "timestamp",
          )}
        </div>
      </section>

      ${
        hasFindings
          ? `
              <section
                id="findings-panel"
                class="${getDetailPanelClass(
                  "findings",
                )}"
                role="tabpanel"
                aria-labelledby="findings-tab"
                ${
                  state.activeDetailView
                    === "findings"
                    ? ""
                    : "hidden"
                }
              >
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
            `
          : ""
      }
    </div>

    </div>
  `;
}

function loadSignalsForEnvironment(
  environmentId,
) {
  state.liveSignalsFilters = {
    source: "",
    environment:
      environmentId || "",
    state: "",
    severity: "",
  };

  state.selectedSignalId = null;

  syncLiveSignalFilters();

  loadSignals();
}

function syncLiveSignalFilters() {
  sourceFilter.value =
    state.liveSignalsFilters.source;

  stateFilter.value =
    state.liveSignalsFilters.state;

  severityFilter.value =
    state.liveSignalsFilters.severity;
}

async function loadSignals({
  silent = false,
} = {}) {
  if (liveSignalsRequestInFlight) {
    return;
  }

  liveSignalsRequestInFlight =
    true;

  if (!silent) {
    signalList.innerHTML = `
      <div class="list-message">
        <p class="list-message__title">
          Loading signals
        </p>

        <p>
          Fetching operational findings…
        </p>
      </div>
    `;
  }

  const query =
    new URLSearchParams();

  Object.entries(
    state.liveSignalsFilters,
  ).forEach(
    ([key, value]) => {
      if (
        value !== ""
        && value !== null
        && value !== undefined
      ) {
        query.set(
          key,
          value,
        );
      }
    },
  );

  try {
    const response = await fetch(
      `/api/signal-interpreter/signals?${query}`,
    );

    if (!response.ok) {
      throw new Error(
        `Request failed with ${response.status}`,
      );
    }

    const payload =
      await response.json();

    const previousSelectedSignalId =
      state.selectedSignalId;

    state.signals =
      payload.signals || [];

    const selectedStillExists =
      previousSelectedSignalId
      && state.signals.some(
        (record) =>
          record.id
          === previousSelectedSignalId,
      );

    if (selectedStillExists) {
      state.selectedSignalId =
        previousSelectedSignalId;

      const selectedRecord =
        state.signals.find(
          (record) =>
            record.id
            === previousSelectedSignalId,
        );

      const selectedDetailNeedsRefresh =
        !state.selectedSignalDetail
        || state.selectedSignalDetail.state
          !== selectedRecord.state
        || state.selectedSignalDetail.analyzedAt
          !== selectedRecord.analyzedAt
        || state.selectedSignalDetail.failedAt
          !== selectedRecord.failedAt;

      renderSignalList();

      if (selectedDetailNeedsRefresh) {
        state.selectedSignalDetail =
          selectedRecord;

        renderSignalDetail(
          selectedRecord,
        );
      }

      return;
    }

    state.selectedSignalId =
      null;

    state.selectedSignalDetail =
      null;

    if (state.signals.length > 0) {
      await loadSignalDetail(
        state.signals[0].id,
      );

      return;
    }

    renderSignalList();

    detailPanel.innerHTML = `
      <div
        class="
          empty-state
          shared-detail-empty
        "
      >
        <p class="eyebrow">
          Live Signal
        </p>

        <h2>
          No signal selected
        </h2>

        <p>
          Select a signal to review its
          operational analysis.
        </p>
      </div>
    `;
  } catch (error) {
    if (!silent) {
      signalList.innerHTML = `
        <div class="list-message">
          <p class="list-message__title">
            Unable to load signals
          </p>

          <p>
            Refresh the feed or check the
            application connection.
          </p>
        </div>
      `;
    }

    console.error(error);
  } finally {
    liveSignalsRequestInFlight =
      false;
  }
}

function isLiveSignalsAutoRefreshEnabled() {
  return getBooleanSetting(
    settingsStorageKeys.autoRefresh,
    defaultSettings.autoRefresh,
  );
}

function stopLiveSignalsAutoRefresh() {
  if (!liveSignalsRefreshTimer) {
    return;
  }

  window.clearInterval(
    liveSignalsRefreshTimer,
  );

  liveSignalsRefreshTimer =
    null;
}

function startLiveSignalsAutoRefresh() {
  stopLiveSignalsAutoRefresh();

  if (
    state.activeWorkspace
      !== "live-signals"
    || !isLiveSignalsAutoRefreshEnabled()
  ) {
    return;
  }

  liveSignalsRefreshTimer =
    window.setInterval(
      () => {
        if (
          state.activeWorkspace
            !== "live-signals"
        ) {
          stopLiveSignalsAutoRefresh();

          return;
        }

        loadSignals({
          silent: true,
        });
      },
      LIVE_SIGNALS_REFRESH_INTERVAL_MS,
    );
}

function syncLiveSignalsAutoRefresh() {
  if (
    state.activeWorkspace
      === "live-signals"
    && isLiveSignalsAutoRefreshEnabled()
  ) {
    startLiveSignalsAutoRefresh();

    return;
  }

  stopLiveSignalsAutoRefresh();
}

async function loadInvestigations() {
  const response = await fetch(
    "/api/signal-interpreter/investigations",
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  const body =
    await response.json();

  if (!response.ok) {
    throw new Error(
      body?.error?.message
      ?? body?.error
      ?? `Unable to load investigations: ${response.status}.`,
    );
  }

  state.investigations =
    Array.isArray(
      body.investigations,
    )
      ? body.investigations
      : [];

  const selectedStillExists =
    state.investigations.some(
      (investigation) =>
        String(investigation.id)
        === String(
          state.selectedInvestigationId,
        ),
    );

  if (!selectedStillExists) {
    state.selectedInvestigationId =
      state.investigations[0]?.id
      ?? null;
  }

  if (
    state.activeWorkspace
    === "investigations"
  ) {
    renderInvestigationsWorkspace();
  }

  return state.investigations;
}

async function createInvestigationFromSignalApi(
  record,
) {
  if (!record?.id) {
    return null;
  }

  const response = await fetch(
    "/api/signal-interpreter/investigations",
    {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify({
          signalId:
            record.id,
        }),
    },
  );

  const body =
    await response.json();

  if (!response.ok) {
    throw new Error(
      body?.error?.message
      ?? body?.error
      ?? `Unable to create investigation: ${response.status}.`,
    );
  }

  const investigation =
    body.investigation;

  if (!investigation) {
    throw new Error(
      "The Investigation API returned no investigation.",
    );
  }

  await loadInvestigations();

  state.selectedInvestigationId =
    investigation.id;

  state.activeInvestigationView =
    "overview";

  return investigation;
}

async function addSignalToInvestigationApi({
  investigationId,
  record,
}) {
  if (
    !investigationId
    || !record?.id
  ) {
    return null;
  }

  const response = await fetch(
    `/api/signal-interpreter/investigations/${encodeURIComponent(
      investigationId,
    )}/signals`,
    {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify({
          signalId:
            record.id,
        }),
    },
  );

  const body =
    await response.json();

  if (!response.ok) {
    throw new Error(
      body?.error?.message
      ?? body?.error
      ?? `Unable to attach signal: ${response.status}.`,
    );
  }

  const investigation =
    body.investigation;

  if (!investigation) {
    throw new Error(
      "The Investigation API returned no investigation.",
    );
  }

  await loadInvestigations();

  state.selectedInvestigationId =
    investigation.id;

  state.activeInvestigationView =
    "overview";

  return investigation;
}

async function updateInvestigationApi({
  investigationId,
  changes,
}) {
  if (!investigationId) {
    throw new Error(
      "An investigation ID is required.",
    );
  }

  const response = await fetch(
    `/api/signal-interpreter/investigations/${encodeURIComponent(
      investigationId,
    )}`,
    {
      method: "PATCH",

      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          changes ?? {},
        ),
    },
  );

  const body =
    await response.json();

  if (!response.ok) {
    throw new Error(
      body?.error?.message
      ?? body?.error
      ?? `Unable to update investigation: ${response.status}.`,
    );
  }

  const investigation =
    body.investigation;

  if (!investigation) {
    throw new Error(
      "The Investigation API returned no investigation.",
    );
  }

  await loadInvestigations();

  state.selectedInvestigationId =
    investigation.id;

  return investigation;
}

async function resolveInvestigationApi({
  investigationId,
  resolution,
}) {
  if (!investigationId) {
    throw new Error(
      "An investigation ID is required.",
    );
  }

  const response = await fetch(
    `/api/signal-interpreter/investigations/${encodeURIComponent(
      investigationId,
    )}/resolution`,
    {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          resolution ?? {},
        ),
    },
  );

  const body =
    await response.json();

  if (!response.ok) {
    throw new Error(
      body?.error?.message
      ?? body?.error
      ?? `Unable to resolve investigation: ${response.status}.`,
    );
  }

  const investigation =
    body.investigation;

  if (!investigation) {
    throw new Error(
      "The Investigation API returned no investigation.",
    );
  }

  await loadInvestigations();

  state.selectedInvestigationId =
    investigation.id;

  return investigation;
}

async function loadSignalDetail(id) {
  state.selectedSignalId = id;
  state.selectedSignalDetail = null;

  state.activeDetailView =
  "overview";

  renderSignalList();

  detailPanel.innerHTML = `
    <p class="loading-message">
      Loading signal details…
    </p>
  `;

  try {
    const response = await fetch(
      `/api/signal-interpreter/signals/${encodeURIComponent(
        id,
      )}`,
    );

    if (!response.ok) {
      throw new Error(
        `Request failed with ${response.status}`,
      );
    }

    const payload =
      await response.json();

    state.selectedSignalDetail =
      payload.signal;

    renderSignalDetail(
      state.selectedSignalDetail,
    );
  } catch (error) {
    detailPanel.innerHTML = `
      <p class="error-message">
        Unable to load signal details.
      </p>
    `;

    console.error(error);
  }
}

signalList.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-signal-id]",
      );

    if (!button) {
      return;
    }

    loadSignalDetail(
      button.dataset.signalId,
    );
  },
);

detailPanel.addEventListener(
  "click",
  async (event) => {

    const addSignalButton =
      event.target.closest(
        "[data-add-signal-to-investigation]",
      );

    if (addSignalButton) {
      if (!state.selectedSignalDetail) {
        return;
      }

      const investigationSelect =
        detailPanel.querySelector(
          "[data-investigation-select]",
        );

      const investigationId =
        investigationSelect?.value;

      if (!investigationId) {
        return;
      }

      try {
        const investigation =
          await addSignalToInvestigationApi({
            investigationId,

            record:
              state.selectedSignalDetail,
          });

        if (!investigation) {
          return;
        }

        renderWorkspace(
          "investigations",
        );
      } catch (error) {
        console.error(
          "Unable to attach signal to investigation.",
          error,
        );
      }

      return;
    }

    const startInvestigationButton =
      event.target.closest(
        "[data-start-investigation]",
      );

    if (startInvestigationButton) {
      if (!state.selectedSignalDetail) {
        return;
      }

      try {
        const investigation =
          await createInvestigationFromSignalApi(
            state.selectedSignalDetail,
          );

        if (!investigation) {
          return;
        }

        renderWorkspace(
          "investigations",
        );
      } catch (error) {
        console.error(
          "Unable to create investigation.",
          error,
        );
      }

      return;
    }

    const relatedSignal =
      event.target.closest(
        ".related-signal",
      );

    if (relatedSignal) {
      await loadSignalDetail(
        relatedSignal.dataset.signalId,
      );

      const detailHeader =
        detailPanel.querySelector(
          ".detail-header",
        );

      if (detailHeader) {
        detailHeader.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }

      return;
    }

    const tab =
      event.target.closest(
        "[data-detail-view]",
      );

    if (!tab || tab.disabled) {
      return;
    }

    const nextView =
      tab.dataset.detailView;

    if (
      ![
        "overview",
        "findings",
      ].includes(nextView)
    ) {
      return;
    }

    if (
      nextView
      === state.activeDetailView
    ) {
      return;
    }

    const currentPanel =
      detailPanel.querySelector(
        ".detail-view.is-active",
      );

    const nextPanel =
      detailPanel.querySelector(
        `#${nextView}-panel`,
      );

    const tabs =
      detailPanel.querySelectorAll(
        "[data-detail-view]",
      );

    if (!nextPanel) {
      return;
    }

    tabs.forEach((item) => {
      const isSelected =
        item.dataset.detailView
        === nextView;

      item.classList.toggle(
        "is-active",
        isSelected,
      );

      item.setAttribute(
        "aria-selected",
        String(isSelected),
      );
    });

    state.activeDetailView =
      nextView;

    if (currentPanel) {
      currentPanel.classList.add(
        "is-leaving",
      );
    }

    window.setTimeout(() => {
      if (currentPanel) {
        currentPanel.hidden = true;

        currentPanel.classList.remove(
          "is-active",
          "is-leaving",
        );
      }

      nextPanel.hidden = false;

      requestAnimationFrame(() => {
        nextPanel.classList.add(
          "is-active",
        );

        const sectionNavigation =
          detailPanel.querySelector(
            ".section-navigation",
          );

        if (!sectionNavigation) {
          return;
        }

        const detailPanelRect =
          detailPanel.getBoundingClientRect();

        const navigationRect =
          sectionNavigation.getBoundingClientRect();

        const targetScrollTop =
          detailPanel.scrollTop
          + navigationRect.top
          - detailPanelRect.top;

        detailPanel.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth",
        });
      });
    }, 140);
  },
);

detailPanel.addEventListener(
  "change",
  (event) => {
    const investigationSelect =
      event.target.closest(
        "[data-investigation-select]",
      );

    if (!investigationSelect) {
      return;
    }

    const addSignalButton =
      detailPanel.querySelector(
        "[data-add-signal-to-investigation]",
      );

    if (!addSignalButton) {
      return;
    }

    addSignalButton.disabled =
      !investigationSelect.value;
  },
);

detailPanel.addEventListener(
  "keydown",
  (event) => {
    const currentTab =
      event.target.closest(
        "[data-detail-view]",
      );

    if (!currentTab) {
      return;
    }

    if (
      event.key !== "ArrowLeft"
      && event.key !== "ArrowRight"
    ) {
      return;
    }

    const tabs = [
      ...detailPanel.querySelectorAll(
        "[data-detail-view]:not(:disabled)",
      ),
    ];

    const currentIndex =
      tabs.indexOf(currentTab);

    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();

    const direction =
      event.key === "ArrowRight"
        ? 1
        : -1;

    const nextIndex =
      (
        currentIndex
        + direction
        + tabs.length
      ) % tabs.length;

    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  },
);

secondaryWorkspace.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-scroll-resolution]",
      );

    if (!button) {
      return;
    }

    event.preventDefault();

    const detailPanel =
      button.closest(
        "#investigation-detail-panel",
      )
      ?? secondaryWorkspace.querySelector(
        "#investigation-detail-panel",
      );

    const resolution =
      detailPanel?.querySelector(
        ".investigation-resolution",
      );

    if (
      !detailPanel
      || !resolution
    ) {
      console.error(
        "Unable to locate the investigation resolution section.",
      );

      return;
    }

    const panelBounds =
      detailPanel.getBoundingClientRect();

    const resolutionBounds =
      resolution.getBoundingClientRect();

    const targetTop =
      detailPanel.scrollTop
      + resolutionBounds.top
      - panelBounds.top
      - 24;

    detailPanel.scrollTo({
      top:
        Math.max(
          0,
          targetTop,
        ),

      behavior:
        "smooth",
    });
  },
);

secondaryWorkspace.addEventListener(
  "submit",
  async (event) => {
    const form =
      event.target.closest(
        "[data-investigation-resolution-form]",
      );

    if (!form) {
      return;
    }

    event.preventDefault();

    const investigationId =
      form.dataset
        .investigationId;

    const summaryField =
      form.querySelector(
        "[data-resolution-summary]",
      );

    const rootCauseField =
      form.querySelector(
        "[data-resolution-root-cause]",
      );

    const lessonsLearnedField =
      form.querySelector(
        "[data-resolution-lessons-learned]",
      );

    const correctiveActionsField =
      form.querySelector(
        "[data-resolution-corrective-actions]",
      );

    const preventiveActionsField =
      form.querySelector(
        "[data-resolution-preventive-actions]",
      );

    const resolvedByField =
      form.querySelector(
        "[data-resolution-resolved-by]",
      );

    const submitButton =
      form.querySelector(
        'button[type="submit"]',
      );

    const submitStatus =
      form.querySelector(
        "[data-resolution-submit-status]",
      );

    if (
      !investigationId
      || !summaryField
      || !rootCauseField
      || !resolvedByField
      || !submitButton
    ) {
      return;
    }

    const summary =
      summaryField.value.trim();

    const rootCause =
      rootCauseField.value.trim();

    const resolvedBy =
      resolvedByField.value.trim();

    if (
      !summary
      || !rootCause
      || !resolvedBy
    ) {
      if (submitStatus) {
        submitStatus.textContent =
          "Resolution summary, root cause, and resolved by are required.";
      }

      return;
    }

    const confirmed =
      window.confirm(
        "Resolve this investigation? The investigation will become read-only.",
      );

    if (!confirmed) {
      return;
    }

    submitButton.disabled =
      true;

    if (submitStatus) {
      submitStatus.textContent =
        "Resolving investigation…";
    }

    try {
      const investigation =
        await resolveInvestigationApi({
          investigationId,

          resolution: {
            summary,

            rootCause,

            lessonsLearned:
              parseResolutionActions(
                lessonsLearnedField
                  ?.value
                ?? "",
              ),

            correctiveActions:
              parseResolutionActions(
                correctiveActionsField
                  ?.value
                ?? "",
              ),

            preventiveActions:
              parseResolutionActions(
                preventiveActionsField
                  ?.value
                ?? "",
              ),

            resolvedBy,
          },
        });

      state.selectedInvestigationId =
        investigation.id;

      state.activeInvestigationView =
        "overview";

      renderInvestigationsWorkspace();
    } catch (error) {
      console.error(
        "Unable to resolve investigation.",
        error,
      );

      submitButton.disabled =
        false;

      if (submitStatus) {
        submitStatus.textContent =
          error instanceof Error
            ? error.message
            : "Unable to resolve investigation.";
      }
    }
  },
);

secondaryWorkspace.addEventListener(
  "click",
  (event) => {

    const openMemory =
      event.target.closest(
        "[data-open-memory]",
      );

    if (openMemory) {

      const id =
        openMemory.dataset.openMemory;

      state.selectedOperationalMemoryId =
        `memory_${id}`;

      renderWorkspace(
        "history",
      );

      return;
    }

    const openInvestigation =
      event.target.closest(
        "[data-open-investigation]",
      );

    if (openInvestigation) {

      state.selectedInvestigationId =
        openInvestigation.dataset
          .openInvestigation;

      renderWorkspace(
        "investigations",
      );

      return;
    }

  },
);


secondaryWorkspace.addEventListener(
  "submit",
  async (event) => {
    const form =
      event.target.closest(
        "[data-investigation-controls]",
      );

    if (!form) {
      return;
    }

    event.preventDefault();

    const investigationId =
      form.dataset
        .investigationId;

    const statusField =
      form.querySelector(
        "[data-investigation-status]",
      );

    const ownerField =
      form.querySelector(
        "[data-investigation-owner]",
      );

    const saveButton =
      form.querySelector(
        'button[type="submit"]',
      );

    const saveStatus =
      form.querySelector(
        "[data-investigation-save-status]",
      );

    if (
      !investigationId
      || !statusField
      || !ownerField
    ) {
      return;
    }

    saveButton.disabled =
      true;

    if (saveStatus) {
      saveStatus.textContent =
        "Saving…";
    }

    try {
      const investigation =
        await updateInvestigationApi({
          investigationId,

          changes: {
            status:
              statusField.value,

            owner:
              ownerField.value,
          },
        });

      state.selectedInvestigationId =
        investigation.id;

      if (saveStatus) {
        saveStatus.textContent =
          "Changes saved.";
      }

      renderInvestigationsWorkspace();
    } catch (error) {
      console.error(
        "Unable to update investigation.",
        error,
      );

      saveButton.disabled =
        false;

      if (saveStatus) {
        saveStatus.textContent =
          error instanceof Error
            ? error.message
            : "Unable to save changes.";
      }
    }
  },
);

sourceFilter.addEventListener(
  "change",
  () => {
    state.liveSignalsFilters.source =
      sourceFilter.value;

    state.liveSignalsFilters.environment =
      "";

    state.selectedSignalId = null;

    loadSignals();
  },
);

stateFilter.addEventListener(
  "change",
  () => {
    state.liveSignalsFilters.state =
      stateFilter.value;

    state.selectedSignalId = null;

    loadSignals();
  },
);

severityFilter.addEventListener(
  "change",
  () => {
    state.liveSignalsFilters.severity =
      severityFilter.value;

    state.selectedSignalId = null;

    loadSignals();
  },
);

refreshButton.addEventListener(
  "click",
  loadSignals,
);

addIntegrationButton.addEventListener(
  "click",
  () => {
    state.integrationMode =
      "create";

    renderCreateIntegrationForm();
  },
);

workspaceButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        renderWorkspace(
          window
            .SignalAuditWorkspaces
            .resolveWorkspace(
              button.dataset
                .workspace,
              {
                includeStoredPreference:
                  false,
              },
            ),
        );
      },
    );
  },
);

window.addEventListener(
  "hashchange",
  () => {
    renderWorkspace(
      getWorkspaceFromHash(),
      {
        updateHash: false,
      },
    );
  },
);

async function initializeApplication() {
  initializeTheme();

  initializeSidebar();

  try {
    await loadInvestigations();
  } catch (error) {
    console.error(
      "Unable to initialize investigations.",
      error,
    );
  }

  renderWorkspace(
    getWorkspaceFromHash(),
    {
      updateHash: false,
    },
  );

  await loadSignals();
}

async function bootstrapApplication() {
  if (
    !window
      .SignalAuditSession
  ) {
    throw new Error(
      "Signal Audit Session Service is unavailable.",
    );
  }

  try {
    state.session =
      await window
        .SignalAuditSession
        .load();

    state.currentUser =
      state.session
        ?.user
      ?? null;

    applyWorkspaceVisibility();

    if (
      !window
        .SignalAuditSession
        .isAuthenticated()
    ) {
      window.location
        .replace(
          "/login",
        );

      return;
    }

    if (
      window
        .SignalAuditPermissions
        .isExecutive()
    ) {
      window.location
        .replace(
          "/executive-dashboard",
        );

      return;
    }

    await initializeApplication();
  } catch (error) {
    console.error(
      "Unable to initialize the Signal Interpreter.",
      error,
    );

    document.body
      .setAttribute(
        "data-application-error",
        "true",
      );
  }
}

bootstrapApplication();
