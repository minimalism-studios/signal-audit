function createSlackWorkspaceAuthorizer({
  tenantId,
  botToken,
  workspaceRegistry,
  fetchImpl = fetch,
}) {
  if (typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("Slack authorization tenantId is required.");
  }

  if (typeof botToken !== "string" || !botToken.trim()) {
    throw new Error("Slack authorization bot token is required.");
  }

  if (
    !workspaceRegistry ||
    typeof workspaceRegistry.getWorkspace !== "function"
  ) {
    throw new Error("Slack workspace registry is required.");
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("Slack authorization fetchImpl must be a function.");
  }

  async function authorizeDelivery({ channelId }) {
    if (typeof channelId !== "string" || !channelId.trim()) {
      return false;
    }

    try {
      const response = await fetchImpl(
        "https://slack.com/api/auth.test",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${botToken}`,
          },
        },
      );

      if (!response.ok) {
        return false;
      }

      const result = await response.json();

      if (
        result.ok !== true ||
        typeof result.team_id !== "string" ||
        !result.team_id.trim()
      ) {
        return false;
      }

      const ownership = workspaceRegistry.getWorkspace(
        result.team_id,
      );

      if (ownership?.tenantId !== tenantId) {
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

      return (
        channelResult.ok === true &&
        channelResult.channel?.id === channelId &&
        channelResult.channel?.context_team_id === result.team_id &&
        channelResult.channel?.is_shared === false &&
        channelResult.channel?.is_ext_shared === false
      );
    } catch {
      return false;
    }
  }

  return {
    authorizeDelivery,
  };
}

module.exports = {
  createSlackWorkspaceAuthorizer,
};
