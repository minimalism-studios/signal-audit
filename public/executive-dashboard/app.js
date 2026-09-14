import {
  escapeHtml,
} from "./utils/formatting.js";

import {
  renderLoadingState as renderDashboardLoadingState,
} from "../shared/components/loading-state/loadingState.js";

import {
  getSupportingFindingCount,
  renderEvidenceLine,
  renderEmptyCard,
} from "./utils/rendering.js";

import {
  renderLeadershipBrief,
} from "./renderers/leadershipBrief.js";

import {
  renderReporting,
} from "./renderers/reporting.js";

import {
  renderAnalytics,
} from "./renderers/analytics.js";

import {
  renderForecasting,
} from "./renderers/forecasting.js?v=2";

const state = {
  activeWorkspace: "leadership-brief",
  reportingDays: 7,
  leadershipBrief: null,
  operationalReport: null,
  operationalAnalytics: null,
  operationalForecast: null,
  isLoading: false,
  error: null,
};

const leadershipBriefWorkspace =
  document.querySelector(
    "#leadership-brief-workspace",
  );

const secondaryWorkspace =
  document.querySelector(
    "#secondary-workspace",
  );

const reportingPeriod =
  document.querySelector(
    "#reporting-period",
  );

const refreshButton =
  document.querySelector(
    "#refresh-button",
  );

const workspaceButtons = [
  ...document.querySelectorAll(
    "[data-workspace]",
  ),
];

const workspaceTitle =
  document.querySelector(
    "#workspace-title",
  );

const dashboard =
  document.querySelector(
    ".dashboard",
  );

const workspaceDefinitions = {
  "leadership-brief": {
    title: "Leadership Brief",
    eyebrow: "Executive intelligence",
    description:
      "Review the current leadership-level assessment of operational health, material risks, and recommended priorities.",
  },

  reporting: {
    title: "Reporting",
    eyebrow: "Executive intelligence",
    description:
      "Review leadership reporting across the selected reporting period.",
  },

  analytics: {
    title: "Analytics",
    eyebrow: "Executive intelligence",
    description:
      "Review operational trends, recurring risks, and service-level patterns.",
  },

  forecasting: {
    title: "Forecasting",
    eyebrow: "Executive intelligence",
    description:
      "Review developing operational conditions and projected risk.",
  },
};

function getRendererContext() {
  return {
    leadershipBriefWorkspace,
    secondaryWorkspace,
    workspaceDefinitions,
    reportingDays: state.reportingDays,
    activeWorkspace: state.activeWorkspace,
  };
}

function getWorkspaceFromHash() {
  const workspace =
    window.location.hash
      .replace(/^#\/?/, "")
      .trim();

  return workspaceDefinitions[workspace]
    ? workspace
    : "leadership-brief";
}

function renderLoadingState() {
  leadershipBriefWorkspace.innerHTML =
    renderDashboardLoadingState({
      eyebrow:
        "Signal Audit",

      title:
        "Operational Intelligence Engine",

      description:
        "Analyzing telemetry and preparing your executive dashboard.",

      activeStep:
        2,
    });

  secondaryWorkspace.innerHTML =
    "";
}

function renderErrorState(message) {

  leadershipBriefWorkspace.hidden = false;
  secondaryWorkspace.hidden = true;

  leadershipBriefWorkspace.innerHTML = `
    <div
      class="dashboard-state"
      role="alert"
    >
      <p class="eyebrow">
        Leadership Brief unavailable
      </p>

      <h2>
        Unable to load the brief
      </h2>

      <p>
        ${escapeHtml(message)}
      </p>

      <button
        id="retry-button"
        class="secondary-button"
        type="button"
      >
        Try Again
      </button>
    </div>
  `;

  document
    .querySelector("#retry-button")
    ?.addEventListener(
      "click",
      loadLeadershipBrief,
    );
}

async function loadLeadershipBrief() {
  if (state.isLoading) {
    return;
  }

  leadershipBriefWorkspace.hidden = false;
  secondaryWorkspace.hidden = true;

  state.isLoading = true;
  state.error = null;
  reportingPeriod.disabled = true;

  refreshButton.disabled = true;
  refreshButton.textContent =
    "Refreshing...";

  renderLoadingState();

  try {
    const response = await fetch(
      `/api/executive-dashboard/leadership-brief?days=${state.reportingDays}`,
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
        ?? `Request failed with status ${response.status}.`,
      );
    }

    state.leadershipBrief =
      body;

    if (
      state.activeWorkspace
      === "leadership-brief"
    ) {
      renderLeadershipBrief(
        body,
        getRendererContext(),
      );
    }
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    renderErrorState(
      state.error,
    );
  } finally {
    state.isLoading = false;
    reportingPeriod.disabled = false;
    refreshButton.disabled = false;
    refreshButton.textContent =
      "Refresh";
  }
}

async function loadOperationalReport() {
  if (state.isLoading) {
    return;
  }

  leadershipBriefWorkspace.hidden =
    false;

  secondaryWorkspace.hidden =
    true;

  state.isLoading = true;
  state.error = null;

  reportingPeriod.disabled =
    true;

  renderLoadingState();

  try {
    const response = await fetch(
      `/api/executive-dashboard/reporting?days=${state.reportingDays}`,
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
        ?? `Request failed with status ${response.status}.`,
      );
    }

    state.operationalReport =
      body;

    if (
      state.activeWorkspace
      === "reporting"
    ) {
      renderReporting(
        body,
        getRendererContext(),
      );
    }
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    renderErrorState(
      state.error,
    );
  } finally {
    state.isLoading = false;

    reportingPeriod.disabled =
      false;
  }
}

async function loadOperationalAnalytics() {
  if (state.isLoading) {
    return;
  }

  leadershipBriefWorkspace.hidden =
    false;

  secondaryWorkspace.hidden =
    true;

  state.isLoading = true;
  state.error = null;

  reportingPeriod.disabled =
    true;

  renderLoadingState();

  try {
    const response = await fetch(
      `/api/executive-dashboard/analytics?days=${state.reportingDays}`,
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
        ?? `Request failed with status ${response.status}.`,
      );
    }

    state.operationalAnalytics =
      body;

    if (
      state.activeWorkspace
      === "analytics"
    ) {
      renderAnalytics(
        body,
        getRendererContext(),
      );
    }
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    renderErrorState(
      state.error,
    );
  } finally {
    state.isLoading = false;

    reportingPeriod.disabled =
      false;
  }
}

async function loadOperationalForecast() {
  if (state.isLoading) {
    return;
  }

  leadershipBriefWorkspace.hidden =
    false;

  secondaryWorkspace.hidden =
    true;

  state.isLoading = true;
  state.error = null;

  reportingPeriod.disabled =
    true;

  renderLoadingState();

  try {
    const response = await fetch(
      `/api/executive-dashboard/forecasting?days=${state.reportingDays}`,
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
        ?? `Request failed with status ${response.status}.`,
      );
    }

    state.operationalForecast =
      body;

    if (
      state.activeWorkspace
      === "forecasting"
    ) {
      renderForecasting(
        body,
        getRendererContext(),
      );
    }
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    renderErrorState(
      state.error,
    );
  } finally {
    state.isLoading = false;

    reportingPeriod.disabled =
      false;
  }
}

function renderWorkspace(
  workspace,
  options = {},
) {
  const {
    updateHash = true,
  } = options;

  const resolvedWorkspace =
    workspaceDefinitions[workspace]
      ? workspace
      : "leadership-brief";

  const definition =
    workspaceDefinitions[
      resolvedWorkspace
    ];

  const isLeadershipBrief =
    resolvedWorkspace
    === "leadership-brief";

  const workspaceChanged =
    state.activeWorkspace
    !== resolvedWorkspace;

  state.activeWorkspace =
    resolvedWorkspace;

  if (workspaceTitle) {
    workspaceTitle.textContent =
      definition.title;
  }

  leadershipBriefWorkspace.hidden =
    false;

  secondaryWorkspace.hidden =
    true;

  refreshButton.hidden =
    !isLeadershipBrief;

  workspaceButtons.forEach(
    (button) => {
      const isActive =
        button.dataset.workspace
        === resolvedWorkspace;

      button.classList.toggle(
        "is-active",
        isActive,
      );

      button.setAttribute(
        "aria-current",
        isActive
          ? "page"
          : "false",
      );
    },
  );

  switch (resolvedWorkspace) {
    case "reporting":
      if (state.operationalReport) {
        renderReporting(
          state.operationalReport,
          getRendererContext(),
        );
      } else if (!state.isLoading) {
        loadOperationalReport();
      }

      break;

    case "analytics":
      if (state.operationalAnalytics) {
        renderAnalytics(
          state.operationalAnalytics,
          getRendererContext(),
        );
      } else if (!state.isLoading) {
        loadOperationalAnalytics();
      }

      break;

    case "forecasting":
      if (state.operationalForecast) {
        renderForecasting(
          state.operationalForecast,
          getRendererContext(),
        );
      } else if (!state.isLoading) {
        loadOperationalForecast();
      }

      break;

    default:
      if (state.leadershipBrief) {
        renderLeadershipBrief(
          state.leadershipBrief,
          getRendererContext(),
        );
      } else if (!state.isLoading) {
        loadLeadershipBrief();
      }

      break;
  }

  if (
    updateHash
    && window.location.hash
      !== `#${resolvedWorkspace}`
  ) {
    window.location.hash =
      resolvedWorkspace;
  }

  if (workspaceChanged) {
    dashboard?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
}

workspaceButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        renderWorkspace(
          button.dataset.workspace,
        );
      },
    );
  },
);

reportingPeriod.addEventListener(
  "change",
  () => {
    const days =
      Number.parseInt(
        reportingPeriod.value,
        10,
      );

    state.reportingDays =
      Number.isInteger(days)
        ? days
        : 7;

    state.leadershipBrief =
      null;

    state.operationalReport =
      null;

    state.operationalAnalytics =
      null;

    state.operationalForecast =
      null;

    switch (
      state.activeWorkspace
    ) {
      case "reporting":
        loadOperationalReport();
        break;

      case "analytics":
        loadOperationalAnalytics();
        break;

      case "forecasting":
        loadOperationalForecast();
        break;

      default:
        loadLeadershipBrief();
        break;
    }
  },
);

refreshButton.addEventListener(
  "click",
  loadLeadershipBrief,
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

renderWorkspace(
  getWorkspaceFromHash(),
  {
    updateHash: false,
  },
);
