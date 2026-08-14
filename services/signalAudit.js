const {
  buildManualAuditPrompt,
} = require("../prompts/manualAudit");

const {
  buildGrafanaAuditPrompt,
} = require("../prompts/grafanaAudit");

const {
  buildGrafanaFindingPrompt,
} = require("../prompts/grafanaFinding");

const {
  parseAuditResult,
} = require("./parsers/auditResult");

const {
  buildDatadogAuditPrompt,
} = require("../prompts/datadogAudit");

const {
  buildDatadogFindingPrompt,
} = require("../prompts/datadogFinding");

const structuredPromptBuilders = {
  grafana: buildGrafanaFindingPrompt,
  datadog: buildDatadogFindingPrompt,
};

function createSignalAuditService({ openai }) {
  async function runAudit({
    prompt,
    maxTokens,
    maxCharacters = 2700,
  }) {
    const result = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = result.choices[0].message.content;

    return maxCharacters === null
      ? content
      : content.slice(0, maxCharacters);
  }

  async function runStructuredAudit({
    source,
    signal,
  }) {
    if (
      typeof source !== "string"
      || source.trim() === ""
    ) {
      throw new Error(
        "Structured audit source is required.",
      );
    }

    if (!signal || typeof signal !== "object") {
      throw new Error(
        "Structured audit signal is required.",
      );
    }

    const normalizedSource =
      source.trim().toLowerCase();

    const buildPrompt =
      structuredPromptBuilders[
        normalizedSource
      ];

    if (!buildPrompt) {
      throw new Error(
        `Unsupported structured audit source: ${normalizedSource}`,
      );
    }

    const response = await runAudit({
      prompt: buildPrompt(signal),
      maxTokens: 1800,
      maxCharacters: null,
    });

    return parseAuditResult(response);
  }

  async function runManualAudit(input) {
    return runAudit({
      prompt: buildManualAuditPrompt(input),
      maxTokens: 1200,
    });
  }

  async function runGrafanaAudit(signal) {
    return runAudit({
      prompt: buildGrafanaAuditPrompt(signal),
      maxTokens: 900,
    });
  }

  async function runGrafanaFindingAudit(signal) {
    return runStructuredAudit({
      source: "grafana",
      signal,
    });
  }

  async function runDatadogAudit(signal) {
    return runAudit({
      prompt: buildDatadogAuditPrompt(signal),
      maxTokens: 900,
    });
  }

  async function runDatadogFindingAudit(signal) {
    return runStructuredAudit({
      source: "datadog",
      signal,
    });
  }

  return {
    runManualAudit,
    runGrafanaAudit,
    runDatadogAudit,
    runStructuredAudit,
    runGrafanaFindingAudit,
    runDatadogFindingAudit,
  };
}

module.exports = {
  createSignalAuditService,
};
