function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const DEFAULT_STEPS = [
  "Telemetry received",
  "Correlating operational signals",
  "Evaluating business impact",
  "Generating leadership brief",
  "Preparing executive dashboard",
];

const DEFAULT_MESSAGES = [
  "Receiving telemetry...",
  "Correlating operational signals...",
  "Evaluating operational risk...",
  "Generating executive recommendations...",
  "Preparing dashboard...",
];

function renderPipelineStep(step, index, activeStep) {
  let status = "pending";
  let symbol = "○";

  if (index < activeStep) {
    status = "complete";
    symbol = "✓";
  } else if (index === activeStep) {
    status = "active";
    symbol = "⟳";
  }

  return `
    <li class="loading-pipeline__step loading-pipeline__step--${status}">
      <span
        class="loading-pipeline__symbol"
        aria-hidden="true"
      >
        ${symbol}
      </span>

      <span class="loading-pipeline__label">
        ${escapeHtml(step)}
      </span>
    </li>
  `;
}

function renderSkeletonLine(width = "100%") {
  return `
    <span
      class="skeleton skeleton--line"
      style="--skeleton-width: ${escapeHtml(width)};"
      aria-hidden="true"
    ></span>
  `;
}

function renderSkeletonCard({
  titleWidth = "38%",
  lines = ["100%", "88%", "64%"],
  modifier = "",
} = {}) {
  const modifierClass = modifier
    ? ` loading-skeleton-card--${escapeHtml(modifier)}`
    : "";

  return `
    <article class="loading-skeleton-card${modifierClass}">
      <div class="loading-skeleton-card__heading">
        ${renderSkeletonLine(titleWidth)}
      </div>

      <div class="loading-skeleton-card__body">
        ${lines.map((width) => renderSkeletonLine(width)).join("")}
      </div>
    </article>
  `;
}

function renderMetricSkeletons() {
  return `
    <div class="loading-metric-grid" aria-hidden="true">
      ${Array.from({ length: 3 }, () => `
        <article class="loading-metric">
          <span class="skeleton skeleton--eyebrow"></span>
          <span class="skeleton skeleton--metric"></span>
          <span class="skeleton skeleton--caption"></span>
        </article>
      `).join("")}
    </div>
  `;
}

export function renderLoadingState({
  eyebrow = "Signal Audit",
  title = "Operational Intelligence Engine",
  description = "Analyzing telemetry and preparing your executive dashboard.",
  steps = DEFAULT_STEPS,
  activeStep = 1,
  message = DEFAULT_MESSAGES[activeStep] || DEFAULT_MESSAGES[0],
} = {}) {
  const safeActiveStep = Math.max(
    0,
    Math.min(Number(activeStep) || 0, steps.length - 1),
  );

  return `
    <section
      class="dashboard-loading-state"
      aria-busy="true"
      aria-live="polite"
      aria-label="Executive dashboard loading"
    >
      <header class="dashboard-loading-state__header">
        <p class="dashboard-loading-state__eyebrow">
          ${escapeHtml(eyebrow)}
        </p>

        <h1 class="dashboard-loading-state__title">
          ${escapeHtml(title)}
        </h1>

        <p class="dashboard-loading-state__description">
          ${escapeHtml(description)}
        </p>
      </header>

      <div class="dashboard-loading-state__pipeline">
        <ol class="loading-pipeline">
          ${steps
            .map((step, index) => renderPipelineStep(
              step,
              index,
              safeActiveStep,
            ))
            .join("")}
        </ol>

        <p class="loading-pipeline__message">
          <span
            class="loading-pipeline__activity"
            aria-hidden="true"
          ></span>

          <span data-loading-message>
            ${escapeHtml(message)}
          </span>
        </p>
      </div>

      <div class="dashboard-loading-state__preview">
        ${renderSkeletonCard({
          titleWidth: "32%",
          lines: ["100%", "92%", "74%", "86%"],
          modifier: "leadership",
        })}

        ${renderMetricSkeletons()}

        <div class="loading-skeleton-grid">
          ${renderSkeletonCard({
            titleWidth: "46%",
            lines: ["100%", "78%", "62%"],
          })}

          ${renderSkeletonCard({
            titleWidth: "40%",
            lines: ["92%", "100%", "68%"],
          })}
        </div>
      </div>
    </section>
  `;
}

export const loadingStateDefaults = {
  steps: [...DEFAULT_STEPS],
  messages: [...DEFAULT_MESSAGES],
};
