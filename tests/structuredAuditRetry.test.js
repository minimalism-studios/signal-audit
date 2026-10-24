const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSignalAuditService,
} = require("../services/signalAudit");

function auditResponse(severity) {
  return JSON.stringify({
    auditId: "datadog-test-001",
    generatedAt: "2026-10-23T12:00:00.000Z",
    summary: "Synthetic Datadog alert.",
    findings: [{
      id: "finding-001",
      severity,
      confidence: 90,
      category: "performance",
      title: "Elevated API latency",
      executiveSummary: "Latency exceeded the threshold.",
      technicalAnalysis: "A synthetic latency alert fired.",
      evidence: ["Synthetic monitor alert"],
      businessImpact: "Requests may be delayed.",
      affectedServices: ["payments-api"],
      recommendedOwner: "platform",
      actions: {
        immediate: ["Inspect latency metrics"],
        shortTerm: [],
        longTerm: [],
      },
      relatedSignalIds: [],
    }],
  });
}

function setup(responses) {
  const calls = [];
  const openai = {
    chat: {
      completions: {
        async create(request) {
          calls.push(request);
          return {
            choices: [{
              message: {
                content: responses[calls.length - 1],
              },
            }],
          };
        },
      },
    },
  };

  return {
    service: createSignalAuditService({ openai }),
    calls,
  };
}

const signal = {
  source: "datadog",
  title: "Synthetic latency alert",
  severity: "warning",
  service: "payments-api",
};

test("valid structured audit requires one request", async () => {
  const { service, calls } = setup([
    auditResponse("medium"),
  ]);

  const result = await service.runDatadogFindingAudit(signal);

  assert.equal(result.findings[0].severity, "medium");
  assert.equal(calls.length, 1);
});

test("invalid severity is corrected on one retry", async () => {
  const { service, calls } = setup([
    auditResponse("warning"),
    auditResponse("medium"),
  ]);

  const result = await service.runDatadogFindingAudit(signal);

  assert.equal(result.findings[0].severity, "medium");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].messages.length, 3);
  assert.match(
    calls[1].messages[2].content,
    /severity.*critical.*high.*medium.*low.*informational/i
  );
});

test("second invalid response still fails", async () => {
  const { service, calls } = setup([
    auditResponse("warning"),
    auditResponse("warning"),
  ]);

  await assert.rejects(
    service.runDatadogFindingAudit(signal),
    /Invalid finding at index 0/
  );

  assert.equal(calls.length, 2);
});
