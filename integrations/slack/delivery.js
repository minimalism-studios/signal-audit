function createSlackDeliveryService({
  botToken,
  fetchImpl = fetch,
}) {
  if (
    typeof botToken !== "string"
    || !botToken.trim()
  ) {
    throw new Error(
      "Slack bot token is required.",
    );
  }

  if (
    typeof fetchImpl !== "function"
  ) {
    throw new Error(
      "fetchImpl must be a function.",
    );
  }

  async function postMessage({
    channelId,
    text,
  }) {
    if (
      typeof channelId !== "string"
      || !channelId.trim()
    ) {
      throw new Error(
        "Slack channel ID is required.",
      );
    }

    if (
      typeof text !== "string"
      || !text.trim()
    ) {
      throw new Error(
        "Slack message text is required.",
      );
    }

    const response =
      await fetchImpl(
        "https://slack.com/api/chat.postMessage",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${botToken}`,
            "Content-Type":
              "application/json; charset=utf-8",
          },

          body:
            JSON.stringify({
              channel:
                channelId,
              text,
            }),
        },
      );

    if (!response.ok) {
      throw new Error(
        `Slack API HTTP error ${response.status}.`,
      );
    }

    const result =
      await response.json();

    if (!result.ok) {
      throw new Error(
        `Slack delivery failed: ${
          result.error || "unknown_error"
        }`,
      );
    }

    return {
      channelId:
        result.channel || channelId,

      timestamp:
        result.ts || null,

      message:
        result.message || null,
    };
  }

  return {
    postMessage,
  };
}

module.exports = {
  createSlackDeliveryService,
};
