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
const {
  buildGatekeeperFindingPrompt,
} = require("../prompts/gatekeeperFinding");

const structuredPromptBuilders = {
  grafana: buildGrafanaFindingPrompt,
  datadog: buildDatadogFindingPrompt,
  gatekeeper: buildGatekeeperFindingPrompt,
};

function createSignalAuditService({ openai }) {
  async function runAudit({
    prompt,
    maxTokens,
    maxCharacters = 2700,
    messages,
  }) {
    const result = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: maxTokens,
      messages: messages || [
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

    const prompt = buildPrompt(signal);

    const response = await runAudit({
      prompt,
      maxTokens: 1800,
      maxCharacters: null,
    });

    try {
      return parseAuditResult(response);
    } catch (validationError) {
      const correctedResponse = await runAudit({
        maxTokens: 1800,
        maxCharacters: null,
        messages: [
          {
            role: "user",
            content: prompt,
          },
          {
            role: "assistant",
            content: response,
          },
          {
            role: "user",
            content: [
              "Your previous JSON response failed schema validation.",
              `Validation error: ${validationError.message}`,
              "Correct the JSON to satisfy the original schema.",
              "Preserve evidence and do not invent information.",
              "Return only the complete corrected JSON object.",
            ].join("\n"),
          },
        ],
      });

      return parseAuditResult(correctedResponse);
    }
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
