"use strict";

const crypto = require("node:crypto");

const SLACK_AUTHORIZE_URL =
  "https://slack.com/oauth/v2/authorize";

const SLACK_TOKEN_URL =
  "https://slack.com/api/oauth.v2.access";

const DEFAULT_STATE_TTL_MS = 5 * 60 * 1000;

function createSlackOAuthController({
  clientId,
  clientSecret,
  redirectUri,
  scopes,
  stateRegistry,
  workspaceRegistry,
  installationStore,
  fetchImpl = fetch,
  now = () => Date.now(),
}) {
  if (
    typeof clientId !== "string" ||
    !clientId.trim() ||
    typeof clientSecret !== "string" ||
    !clientSecret.trim()
  ) {
    throw new Error("Slack OAuth client credentials are required.");
  }

  const expectedRedirectUri =
    "https://app.signal-audit.com/api/integrations/slack/oauth/callback";

  let parsedRedirectUri;

  try {
    if (
      typeof redirectUri !== "string" ||
      redirectUri !== redirectUri.trim()
    ) {
      throw new Error();
    }

    parsedRedirectUri = new URL(redirectUri);
  } catch {
    throw new Error("Slack OAuth redirect URI is invalid.");
  }

  if (
    parsedRedirectUri.protocol !== "https:" ||
    parsedRedirectUri.origin !== "https://app.signal-audit.com" ||
    parsedRedirectUri.pathname !==
      "/api/integrations/slack/oauth/callback" ||
    parsedRedirectUri.username ||
    parsedRedirectUri.password ||
    parsedRedirectUri.search ||
    parsedRedirectUri.hash ||
    parsedRedirectUri.toString() !== redirectUri ||
    redirectUri !== expectedRedirectUri
  ) {
    throw new Error(
      "Slack OAuth redirect URI must match the registered HTTPS callback.",
    );
  }

  if (
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    !scopes.every(
      (scope) =>
        typeof scope === "string" &&
        Boolean(scope.trim()),
    )
  ) {
    throw new Error("Slack OAuth scopes are required.");
  }

  if (
    !stateRegistry ||
    typeof stateRegistry.create !== "function" ||
    typeof stateRegistry.consume !== "function"
  ) {
    throw new Error("Slack OAuth state registry is required.");
  }

  if (
    !workspaceRegistry ||
    typeof workspaceRegistry.claimWorkspace !== "function"
  ) {
    throw new Error("Slack workspace registry is required.");
  }

  if (
    !installationStore ||
    typeof installationStore.saveInstallation !== "function"
  ) {
    throw new Error("Slack installation store is required.");
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("Slack OAuth fetch implementation is required.");
  }

  function createAuthorizationAttempt({
    tenantId,
    userId,
    sessionId,
  }) {
    if (tenantId !== "minimalism") {
      throw new Error("Slack OAuth is unavailable for this tenant.");
    }

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      typeof sessionId !== "string" ||
      !sessionId.trim()
    ) {
      throw new Error("Invalid Slack OAuth session context.");
    }

    const state = crypto.randomBytes(32).toString("base64url");

    stateRegistry.create({
      state,
      tenantId,
      userId,
      sessionId,
      expiresAt: now() + DEFAULT_STATE_TTL_MS,
    });

    const url = new URL(SLACK_AUTHORIZE_URL);

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return url.toString();
  }


  async function completeAuthorizationAttempt({
    state,
    code,
    tenantId,
    userId,
    sessionId,
  }) {
    if (tenantId !== "minimalism") {
      throw new Error("Slack OAuth is unavailable for this tenant.");
    }

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      typeof sessionId !== "string" ||
      !sessionId.trim()
    ) {
      throw new Error("Invalid Slack OAuth session context.");
    }

    // Consume before any network request. A failed attempt cannot be replayed.
    stateRegistry.consume({
      state,
      tenantId,
      userId,
      sessionId,
    });

    if (typeof code !== "string" || !code.trim()) {
      throw new Error("Invalid Slack OAuth authorization code.");
    }

    const tokenResponse = await fetchImpl(SLACK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error("Slack OAuth token exchange failed.");
    }

    const tokenData = await tokenResponse.json();

    if (
      tokenData.ok !== true ||
      typeof tokenData.access_token !== "string" ||
      !tokenData.access_token.trim() ||
      tokenData.token_type !== "bot" ||
      typeof tokenData.team?.id !== "string" ||
      !tokenData.team.id.trim() ||
      typeof tokenData.bot_user_id !== "string" ||
      !tokenData.bot_user_id.trim()
    ) {
      throw new Error("Invalid Slack OAuth token response.");
    }

    const workspaceId = tokenData.team.id;
    const botToken = tokenData.access_token;

    // Independently verify the token's workspace before claiming ownership.
    const identityResponse = await fetchImpl(
      "https://slack.com/api/auth.test",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      },
    );

    if (!identityResponse.ok) {
      throw new Error("Slack workspace identity verification failed.");
    }

    const identity = await identityResponse.json();

    if (
      identity.ok !== true ||
      identity.team_id !== workspaceId ||
      identity.user_id !== tokenData.bot_user_id
    ) {
      throw new Error("Slack workspace identity mismatch.");
    }

    const grantedScopes = typeof tokenData.scope === "string"
      ? tokenData.scope.split(",").map((scope) => scope.trim()).filter(Boolean)
      : [];

    if (!scopes.every((scope) => grantedScopes.includes(scope))) {
      throw new Error("Slack OAuth required scopes were not granted.");
    }

    workspaceRegistry.claimWorkspace({
      workspaceId,
      tenantId,
    });

    installationStore.saveInstallation({
      workspaceId,
      tenantId,
      botToken,
      botUserId: tokenData.bot_user_id,
      scopes: grantedScopes,
    });

    return Object.freeze({
      workspaceId,
      tenantId,
      botUserId: tokenData.bot_user_id,
      scopes: grantedScopes,
    });
  }

  return Object.freeze({
    createAuthorizationAttempt,
    completeAuthorizationAttempt,
  });
}

module.exports = {
  createSlackOAuthController,
};
