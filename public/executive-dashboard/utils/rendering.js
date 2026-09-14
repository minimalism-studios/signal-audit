import {
  escapeHtml,
  formatDate,
  formatLabel,
} from "../utils/formatting.js";

export function getSupportingFindingCount(item) {
  return Array.isArray(
    item?.supportingFindingIds,
  )
    ? item.supportingFindingIds.length
    : 0;
}

export function renderEvidenceLine(item) {
  const count =
    getSupportingFindingCount(item);

  const label =
    count === 1
      ? "supporting finding"
      : "supporting findings";

  return `
    <div class="evidence-line">
      ${count} ${label}
    </div>
  `;
}

export function renderEmptyCard(message) {
  return `
    <div class="empty-card">
      <p>
        ${escapeHtml(message)}
      </p>
    </div>
  `;
}

export function renderRiskCard(risk) {
  const severity =
    String(risk.severity ?? "unknown")
      .toLowerCase();

  const services =
    Array.isArray(risk.affectedServices)
      ? risk.affectedServices
      : [];

  const serviceLine =
    services.length > 0
      ? `
        <div class="service-line">
          ${escapeHtml(
            services.join(" · "),
          )}
        </div>
      `
      : "";

  const owner =
    risk.recommendedOwner
      ? `
        <span class="owner">
          Owner:
          ${escapeHtml(
            formatLabel(
              risk.recommendedOwner,
            ),
          )}
        </span>
      `
      : "";

  return `
    <article class="intelligence-card">
      <div class="intelligence-card__heading">
        <div>
          <span
            class="
              badge
              badge--${escapeHtml(severity)}
            "
          >
            ${escapeHtml(
              formatLabel(severity),
            )}
          </span>

          <h4>
            ${escapeHtml(risk.title)}
          </h4>
        </div>

        ${owner}
      </div>

      <p>
        ${escapeHtml(risk.summary)}
      </p>

      ${serviceLine}

      ${renderEvidenceLine(risk)}
    </article>
  `;
}

export function renderWatchItem(item) {
  return `
    <article class="intelligence-card">
      <h4>
        ${escapeHtml(item.title)}
      </h4>

      <p>
        ${escapeHtml(item.summary)}
      </p>

      ${renderEvidenceLine(item)}
    </article>
  `;
}

export function renderWinItem(item) {
  return `
    <article class="intelligence-card">
      <h4>
        ${escapeHtml(item.title)}
      </h4>

      <p>
        ${escapeHtml(item.summary)}
      </p>

      ${renderEvidenceLine(item)}
    </article>
  `;
}

export function renderActionCard(
  action,
  index,
) {
  const owner =
    action.recommendedOwner
      ? `
        <span>
          Owner:
          ${escapeHtml(
            formatLabel(
              action.recommendedOwner,
            ),
          )}
        </span>
      `
      : "";

  const count =
    getSupportingFindingCount(action);

  const findingLabel =
    count === 1
      ? "supporting finding"
      : "supporting findings";

  return `
    <article class="action-card">
      <div class="action-card__priority">
        <span>
          ${String(index + 1).padStart(
            2,
            "0",
          )}
        </span>

        <strong>
          ${escapeHtml(
            formatLabel(action.priority),
          )}
        </strong>
      </div>

      <div>
        <h4>
          ${escapeHtml(action.action)}
        </h4>

        <p>
          ${escapeHtml(action.reason)}
        </p>

        <div class="action-card__footer">
          ${owner}

          <span>
            ${count} ${findingLabel}
          </span>
        </div>
      </div>
    </article>
  `;
}