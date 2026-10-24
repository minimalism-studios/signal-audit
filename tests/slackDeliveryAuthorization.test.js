const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSlackDeliveryService,
} = require("../integrations/slack/delivery");

const TOKEN = "xoxb-test-secret-do-not-log";

test("legacy Slack delivery remains functional", async () => {
  const requests = [];

  const service = createSlackDeliveryService({
    botToken: TOKEN,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });

      return {
        ok: true,
        json: async () => ({
          ok: true,
          channel: "C_ALLOWED",
          ts: "123.456",
        }),
      };
    },
  });

  const result = await service.postMessage({
    channelId: "C_ALLOWED",
    text: "Test alert",
  });

  assert.equal(result.channelId, "C_ALLOWED");
  assert.equal(result.timestamp, "123.456");
  assert.equal(requests.length, 1);
});

test("Slack delivery rejects missing authorization when enforced", async () => {
  let requests = 0;

  const service = createSlackDeliveryService({
    botToken: TOKEN,
    requireAuthorization: true,
    fetchImpl: async () => {
      requests += 1;
      throw new Error("Slack must not be called");
    },
  });

  await assert.rejects(
    service.postMessage({
      channelId: "C_ALLOWED",
      text: "Test alert",
    }),
    /authorization/i,
  );

  assert.equal(requests, 0);
});

test("Slack authorization errors never disclose credentials", async () => {
  const service = createSlackDeliveryService({
    botToken: TOKEN,
    requireAuthorization: true,
    fetchImpl: async () => {
      throw new Error("Slack must not be called");
    },
  });

  try {
    await service.postMessage({
      channelId: "C_ALLOWED",
      text: "Test alert",
    });

    assert.fail("Expected authorization failure");
  } catch (error) {
    assert.doesNotMatch(error.message, /xoxb-test-secret-do-not-log/);
  }
});

test("authorized delivery reaches Slack", async () => {
  const requests = [];

  const service = createSlackDeliveryService({
    botToken: TOKEN,
    requireAuthorization: true,
    authorizeDelivery: async ({ channelId }) => {
      assert.equal(channelId, "C_ALLOWED");
      return true;
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          channel: "C_ALLOWED",
          ts: "456.789",
        }),
      };
    },
  });

  const result = await service.postMessage({
    channelId: "C_ALLOWED",
    text: "Authorized alert",
  });

  assert.equal(result.timestamp, "456.789");
  assert.equal(requests.length, 1);
});

test("unauthorized delivery never reaches Slack", async () => {
  let requests = 0;

  const service = createSlackDeliveryService({
    botToken: TOKEN,
    requireAuthorization: true,
    authorizeDelivery: async () => false,
    fetchImpl: async () => {
      requests += 1;
      throw new Error("Slack must not be called");
    },
  });

  await assert.rejects(
    service.postMessage({
      channelId: "C_OTHER_TENANT",
      text: "Unauthorized alert",
    }),
    /authorization denied/i,
  );

  assert.equal(requests, 0);
});

test("authorization callback errors prevent Slack delivery", async () => {
  let requests = 0;

  const service = createSlackDeliveryService({
    botToken: TOKEN,
    requireAuthorization: true,
    authorizeDelivery: async () => {
      throw new Error(`Workspace verification failed: ${TOKEN}`);
    },
    fetchImpl: async () => {
      requests += 1;
      throw new Error("Slack must not be called");
    },
  });

  await assert.rejects(
    service.postMessage({
      channelId: "C_ALLOWED",
      text: "Test alert",
    }),
    (error) => {
      assert.equal(
        error.message,
        "Slack delivery authorization denied.",
      );
      assert.doesNotMatch(error.message, /xoxb-test-secret-do-not-log/);
      return true;
    },
  );

  assert.equal(requests, 0);
});
