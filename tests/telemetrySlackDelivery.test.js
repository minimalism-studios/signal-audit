const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createGrafanaProcessor,
} = require("../integrations/grafana/processor");

const {
  createDatadogProcessor,
} = require("../integrations/datadog/processor");

const {
  SIGNAL_STATES,
} = require("../constants/signalStates");

const SANDBOX_CHANNEL = "C0B4K8J59PA";

const findingResult = {
  findings: [{
    severity: "high",
    title: "Elevated API latency",
    executiveSummary: "Latency exceeded the expected threshold.",
    businessImpact: "Requests may be delayed.",
    recommendedOwner: "Platform Engineering",
    actions: ["Investigate recent deployments"],
  }],
};

for (const [source, createProcessor, auditMethod] of [
  ["grafana", createGrafanaProcessor, "runGrafanaFindingAudit"],
  ["datadog", createDatadogProcessor, "runDatadogFindingAudit"],
]) {
  function setup({
    enabled = true,
    deliveryError = null,
    analysisError = null,
  } = {}) {
    const records = new Map();
    const posts = [];

    const signalHistory = {
      saveSignal(signal) {
        const record = {
          ...signal,
          id: "history-1",
          state: SIGNAL_STATES.RECEIVED,
        };
        records.set(record.id, record);
        return record;
      },

      updateSignal(id, patch) {
        const updated = {
          ...records.get(id),
          ...patch,
        };
        records.set(id, updated);
        return updated;
      },
    };

    const connectionStore = {
      getConnection() {
        return {
          outputs: {
            slack: {
              enabled,
              channelId: SANDBOX_CHANNEL,
            },
          },
        };
      },
    };

    const slackDeliveryService = {
      async postMessage(message) {
        posts.push(message);

        if (deliveryError) {
          throw deliveryError;
        }

        return {
          channelId: message.channelId,
          timestamp: "1234567890.123456",
        };
      },
    };

    const signalAuditService = {
      async [auditMethod]() {
        if (analysisError) {
          throw analysisError;
        }
        return findingResult;
      },
    };

    const processSignal = createProcessor({
      signalAuditService,
      signalHistory,
      connectionStore,
      slackDeliveryService,
    });

    const signal = {
      source,
      connectionId: `${source}-dev`,
      title: "Elevated API latency",
      service: "payments-api",
      environment: "production",
    };

    return {
      processSignal,
      signal,
      records,
      posts,
    };
  }

  test(`${source}: successful Slack delivery`, async () => {
    const context = setup();
    const result = await context.processSignal(context.signal);

    assert.equal(result.state, SIGNAL_STATES.DELIVERED);
    assert.equal(result.signal.delivery.status, "delivered");
    assert.equal(result.signal.delivery.channelId, SANDBOX_CHANNEL);
    assert.equal(result.signal.delivery.timestamp, "1234567890.123456");
    assert.equal(context.posts.length, 1);
    assert.equal(context.posts[0].channelId, SANDBOX_CHANNEL);
    assert.match(context.posts[0].text, /Elevated API latency/);
  });

  test(`${source}: Slack failure preserves analysis`, async () => {
    const context = setup({
      deliveryError: new Error("Slack unavailable"),
    });

    const result = await context.processSignal(context.signal);

    assert.equal(result.state, SIGNAL_STATES.ANALYZED);
    assert.equal(result.signal.delivery.status, "failed");
    assert.match(result.signal.delivery.error, /Slack unavailable/);
    assert.deepEqual(result.signal.analysis, findingResult);
  });

  test(`${source}: connection lookup failure`, async () => {
    const context = setup();

    // Replace the processor with a failing connection lookup.
    const signalHistory = {
      saveSignal(signal) {
        const record = {
          ...signal,
          id: "lookup-failure-1",
          state: SIGNAL_STATES.RECEIVED,
        };
        context.records.set(record.id, record);
        return record;
      },

      updateSignal(id, patch) {
        const updated = {
          ...context.records.get(id),
          ...patch,
        };
        context.records.set(id, updated);
        return updated;
      },
    };

    const processSignal = createProcessor({
      signalAuditService: {
        [auditMethod]: async () => findingResult,
      },
      signalHistory,
      connectionStore: {
        getConnection() {
          throw new Error("Connection store unavailable");
        },
      },
      slackDeliveryService: {
        async postMessage() {
          assert.fail("Slack must not be called");
        },
      },
    });

    const result = await processSignal(context.signal);

    assert.equal(result.state, SIGNAL_STATES.ANALYZED);
    assert.equal(result.signal.delivery.status, "failed");
    assert.match(
      result.signal.delivery.error,
      /Connection lookup failed: Connection store unavailable/,
    );
  });

  test(`${source}: missing Slack service fails closed`, async () => {
    const context = setup();

    const processSignal = createProcessor({
      signalAuditService: {
        [auditMethod]: async () => findingResult,
      },
      signalHistory: {
        saveSignal(signal) {
          const record = {
            ...signal,
            id: "missing-slack-service-1",
            state: SIGNAL_STATES.RECEIVED,
          };
          context.records.set(record.id, record);
          return record;
        },

        updateSignal(id, patch) {
          const updated = {
            ...context.records.get(id),
            ...patch,
          };
          context.records.set(id, updated);
          return updated;
        },
      },
      connectionStore: {
        getConnection() {
          return {
            outputs: {
              slack: {
                enabled: true,
                channelId: SANDBOX_CHANNEL,
              },
            },
          };
        },
      },
      slackDeliveryService: null,
    });

    const result = await processSignal(context.signal);

    assert.equal(result.state, SIGNAL_STATES.ANALYZED);
    assert.equal(result.signal.delivery.status, "failed");
    assert.match(
      result.signal.delivery.error,
      /Slack delivery service is unavailable/,
    );
    assert.deepEqual(result.signal.analysis, findingResult);
    assert.equal(context.posts.length, 0);
  });

  test(`${source}: disabled Slack output`, async () => {
    const context = setup({ enabled: false });
    const result = await context.processSignal(context.signal);

    assert.equal(result.state, SIGNAL_STATES.ANALYZED);
    assert.equal(context.posts.length, 0);
  });

  test(`${source}: analysis failure remains FAILED`, async () => {
    const context = setup({
      analysisError: new Error("Analysis unavailable"),
    });

    await assert.rejects(
      context.processSignal(context.signal),
      /Analysis unavailable/,
    );

    assert.equal(
      context.records.get("history-1").state,
      SIGNAL_STATES.FAILED,
    );
    assert.equal(context.posts.length, 0);
  });
}
