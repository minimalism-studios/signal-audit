# Signal Audit — Slack Agent Operations Runbook

**Scope:** Existing Slack Native Agent, OAuth installations, investigative replies, and legacy telemetry-to-Slack delivery.  
**Status:** Operational reference; based on repository audit supplied November 14, 2026.  
**Change policy:** Documentation only. No application code, Railway configuration, tenant status, or credentials changed.

## 1. Architecture and feature controls

The application includes three independent environment controls:

| Variable | Observed behavior | Caution |
|---|---|---|
| `SLACK_AGENT_ENABLED` | When exactly `true`, starts the agent event scheduler at its startup hook. | Does not by itself prove all agent routes are disabled when false. |
| `SLACK_OAUTH_ENABLED` | Enables OAuth-related workspace registry initialization. | Full route registration and prerequisite configuration must be verified before changing. |
| `SLACK_WORKSPACE_AUTHORIZATION_ENABLED` | Enables workspace authorization and causes legacy Slack delivery to require authorization. | Do not disable to work around authorization failures. |

The legacy telemetry delivery service uses `SLACK_BOT_TOKEN` when configured. Grafana and Datadog processors receive this service. OAuth-backed agent delivery uses the installation store and workspace registry. **Do not assume OAuth installations are already used for Grafana/Datadog telemetry delivery**; that work remains deferred under issue #57.

## 2. Slack OAuth installation

The application mounts the Slack OAuth router at `/api/integrations/slack`. Observed routes include:

- `GET /api/integrations/slack/oauth/start`
- `GET /api/integrations/slack/oauth/callback`
- `GET /api/integrations/slack/installation`

The OAuth controller requires the exact callback URL `https://app.signal-audit.com/api/integrations/slack/oauth/callback`. The start route checks for same-origin request context. Installation listing is tenant-scoped by the request authentication context.

**Installation checklist:** Confirm the tenant is active and authorized; confirm the registered Slack redirect URL and required environment configuration; initiate installation through the authenticated application flow (not by manually fabricating a request); confirm the installed workspace is associated with the intended tenant using the authenticated installation listing; test an authorized Slack investigative question in the intended channel/thread. Do not copy tokens into tickets, logs, or chat.

**Unverified:** The full end-user installation UI, all required OAuth scopes, and exact tenant-administrator permissions were not included in the audit output. Confirm against implementation before publishing customer instructions.

## 3. Runtime verification

- Application-level availability: `GET https://app.signal-audit.com/health` should return HTTP 200 and `{"status":"ok"}`.
- Agent scheduler: when enabled and successfully started, application logs include `slack_agent_scheduler_started`.
- Functional validation: use an authorized tenant and Slack workspace to send a read-only investigative question in a correlated signal thread; confirm a substantive reply and, when applicable, the signal-specific Standalone App deep link.
- Verify browser deep links when signed in and signed out, including redirect to login and return to the intended signal.
- Check event processing outcomes, which include `already_claimed`, `ignored`, `investigation_failed`, `not_answered`, `delivery_failed`, `delivery_unconfirmed`, and `completed`.

**Important:** `/health` is not a Slack end-to-end readiness probe. A passing health response alone does not establish OAuth, agent scheduler, investigative reasoning, or Slack delivery success.

## 4. Troubleshooting

| Symptom | Check | Safe response |
|---|---|---|
| OAuth installation fails | Exact callback URL, authenticated tenant context, Slack app configuration, server errors | Correct configuration only after identifying cause; do not expose credentials |
| Agent does not respond | `SLACK_AGENT_ENABLED`, scheduler startup log, event intake and processing outcomes | Determine whether intake, investigation, or delivery failed before intervening |
| Duplicate or missing reply | Event inbox claim/deduplication state and processor status | Do not blindly replay events or bypass idempotency |
| Delivery fails | Installation status, workspace ownership, channel authorization, Slack API response | Preserve tenant boundaries; never substitute another tenant's token |
| Telemetry alert missing from Slack | Legacy `SLACK_BOT_TOKEN` path, channel configuration, authorization, telemetry processor logs | Do not assume OAuth agent token handles telemetry; #57 is deferred |
| Deep link prompts login | Authentication/session status | Expected when signed out; verify return to the original signal after login |

## 5. Credential revocation and tenant access

`integrations/slack/installationStore.js` exposes an internal `revokeInstallation({ workspaceId, tenantId })` operation. It validates workspace/tenant identity, marks the record `revoked`, and removes encrypted credentials. A revoked installation requires a fresh authorized OAuth flow rather than silent restoration.

**No customer-facing revocation API was established by the audit.** Do not publish an endpoint or run an ad hoc production script without reviewing the supported administrative procedure, access controls, persistence, and backup implications. Slack-side uninstall/revocation and application-side installation revocation are distinct actions; verify both when offboarding.

For expired, unpaid, or sunset tenants: revoke organization access; redirect unauthorized **browser navigation** from every app URL path (with and without trailing slash) to login; preserve access only for the Minimalism owner/administrator; return appropriate secure 401/403 responses for APIs and webhooks rather than browser redirects. Do not reactivate suspended tenants as part of testing.

**OASSE:** The OASSE Vanguard pilot has concluded. Existing expiration enforcement rejects its integration webhook traffic with `pilot_expired` and fails closed if expiration enforcement itself fails. Keep OASSE suspended.

## 6. Rollback and incident response

1. Identify the exact failed release, affected tenants, and whether the problem is agent-only, OAuth-related, or affects legacy telemetry delivery.
2. Preserve relevant deployment IDs, logs, and failure timestamps without exposing tokens or tenant-sensitive signal content.
3. For an agent-only incident, assess whether disabling `SLACK_AGENT_ENABLED` is an appropriate temporary containment action. **This controls scheduler startup; it is not proven to disable all agent routes or already-running work.** Restart behavior and impact must be evaluated before use.
4. If reverting a deployment, use the team's approved Railway rollback/redeploy procedure for a previously validated release. Do not assume a CLI command or exact rollback mechanism without checking the current environment.
5. Do not disable `SLACK_WORKSPACE_AUTHORIZATION_ENABLED`, replace another tenant's credentials, restore OASSE access, or remove the legacy `SLACK_BOT_TOKEN` to work around failures.
6. Re-run focused tests and an authorized end-to-end Slack investigation after containment or rollback; verify legacy Grafana/Datadog delivery remains unaffected.

## 7. Release acceptance checklist

- [ ] All automated tests pass; record commit SHA and test counts.
- [ ] Slack request signature, duplicate-event, tenant isolation, OAuth, and authorization tests pass.
- [ ] Confirm prompt-injection and unauthorized-action test assertions directly; keyword search alone is insufficient.
- [ ] Confirm existing telemetry-to-Slack regression tests directly; filenames/keyword counts alone are insufficient.
- [ ] Verify active-tenant OAuth installation and Slack investigative thread behavior.
- [ ] Verify contextual signal-specific Standalone App referral and login continuation.
- [ ] Confirm no unauthorized cross-tenant access or credential fallback.
- [ ] Confirm OASSE remains expired/suspended.
- [ ] Confirm rollback owner and recovery procedure are known before rollout.
- [ ] Record deployment success and operational evidence in the relevant GitHub issue.

## 8. Evidence and limitations

This runbook was prepared from the read-only output supplied for `app.js`, `integrations/slack/oauthRouter.js`, `integrations/slack/oauthController.js`, `integrations/slack/installationStore.js`, `integrations/slack/eventProcessor.js`, and repository documentation inventory, together with previously reported production validation of issue #60 and 250 passing tests. It does **not** constitute a full source-code audit, independent production check, or proof that every acceptance criterion of GitHub issue #40 is satisfied.

**Deferred work:** #38 AgentOps evaluation/tracing; #57 OAuth-backed telemetry delivery; #56 separate corporate chatbot discovery. None is silently implemented by this document.
