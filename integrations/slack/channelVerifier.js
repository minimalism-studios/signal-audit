"use strict";

function createSlackChannelVerifier({
  installationStore,
  fetchImpl = fetch,
}) {
  if (
    typeof installationStore?.getInstallationCredentials !== "function"
    || typeof fetchImpl !== "function"
  ) {
    throw new Error("Slack channel verifier dependencies are required.");
  }

  async function verifyChannel({ workspaceId, tenantId, channelId } = {}) {
    if (
      typeof workspaceId !== "string" || !workspaceId.trim()
      || tenantId !== "minimalism"
      || typeof channelId !== "string" || !channelId.trim()
    ) {
      return false;
    }

    try {
      const credentials = installationStore.getInstallationCredentials({
        workspaceId,
        tenantId,
      });

      const botToken = credentials?.botToken;

      if (typeof botToken !== "string" || !botToken.trim()) {
        return false;
      }

      const authResponse = await fetchImpl(
        "https://slack.com/api/auth.test",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${botToken}`,
          },
        },
      );

      if (!authResponse.ok) {
        return false;
      }

      const authResult = await authResponse.json();

      if (
        authResult.ok !== true
        || authResult.team_id !== workspaceId
      ) {
        return false;
      }

      const channelResponse = await fetchImpl(
        "https://slack.com/api/conversations.info",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${botToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            channel: channelId,
          }).toString(),
        },
      );

      if (!channelResponse.ok) {
        return false;
      }

      const channelResult = await channelResponse.json();
      const channel = channelResult.channel;

      return (
        channelResult.ok === true
        && channel?.id === channelId
        && channel?.context_team_id === workspaceId
        && channel?.is_shared === false
        && channel?.is_ext_shared === false
      );
    } catch {
      return false;
    }
  }

  return Object.freeze({ verifyChannel });
}

module.exports = { createSlackChannelVerifier };
