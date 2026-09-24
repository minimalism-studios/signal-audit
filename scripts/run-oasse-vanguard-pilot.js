const fs = require("fs");
const path = require("path");

require("dotenv").config();

const OpenAI = require("openai");
const Ajv2020 = require("ajv/dist/2020");

const {
  createSignalAuditService,
} = require("../services/signalAudit");

const {
  createTenantServices,
} = require("../services/tenantServices");

const {
  normalizeGatekeeperSignal,
} = require("../integrations/gatekeeper/normalizer");

const TENANT_ID = "oasse";
const CONNECTION_ID = "oasse-gatekeeper";
const EXPECTED_CASE_COUNT = 1000;

const PILOT_ROOT = path.join(
  __dirname,
  "..",
  "runtime",
  "tenants",
  TENANT_ID,
  "pilot",
  "vanguard-09212026",
);

const INPUT_PATH = path.join(
  PILOT_ROOT,
  "input",
  "signal_audit_events.jsonl",
);

const ACK_SCHEMA_PATH = path.join(
  PILOT_ROOT,
  "contract",
  "signal_audit_ack.schema.json",
);

const OUTPUT_DIR = path.join(
  PILOT_ROOT,
  "output",
);

const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "signal_audit_acknowledgements.jsonl",
);

function readJson(pathname) {
  return JSON.parse(
    fs.readFileSync(pathname, "utf8"),
  );
}

function readJsonLines(pathname) {
  return fs
    .readFileSync(pathname, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `Invalid JSON on line ${index + 1}: ${error.message}`,
        );
      }
    });
}

function assertInputPopulation(events) {
  if (events.length !== EXPECTED_CASE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_CASE_COUNT} events; found ${events.length}.`,
    );
  }

  const caseIds = events.map(
    (event) => event.benchmark_case_id,
  );

  const uniqueCaseIds = new Set(caseIds);

  if (uniqueCaseIds.size !== EXPECTED_CASE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_CASE_COUNT} unique benchmark_case_id values; found ${uniqueCaseIds.size}.`,
    );
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required.",
    );
  }

  const events =
    readJsonLines(INPUT_PATH);

  assertInputPopulation(events);

  const schema =
    readJson(ACK_SCHEMA_PATH);

  const ajv =
    new Ajv2020({
      allErrors: true,
      strict: true,
    });

  const validateAcknowledgement =
    ajv.compile(schema);

  const openai =
    new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY,
    });

  const signalAuditService =
    createSignalAuditService({
      openai,
    });

  const oasseServices =
    createTenantServices({
      tenantId:
        TENANT_ID,
      openai,
      signalAuditService,
      grafanaWebhookSecret:
        process.env.GRAFANA_WEBHOOK_SECRET,
      datadogWebhookSecret:
        process.env.DATADOG_WEBHOOK_SECRET,
      gatekeeperWebhookSecret:
        process.env.GATEKEEPER_WEBHOOK_SECRET,
      slackBotToken:
        process.env.SLACK_BOT_TOKEN,
    });

  const connection =
    oasseServices.connectionStore
      .getConnection(CONNECTION_ID);

  if (connection.source !== "gatekeeper") {
    throw new Error(
      `Connection "${CONNECTION_ID}" is not a Gatekeeper connection.`,
    );
  }

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    },
  );

  /*
   * Do not leave a previous acknowledgement artifact in place
   * when beginning a new benchmark execution.
   */
  if (fs.existsSync(OUTPUT_PATH)) {
    throw new Error(
      `Output already exists: ${OUTPUT_PATH}. Remove or archive it before starting a new run.`,
    );
  }

  const acknowledgements = [];

  console.log(
    `Starting OASSE Vanguard pilot ingestion: ${events.length} cases.`,
  );

  for (
    let index = 0;
    index < events.length;
    index += 1
  ) {
    const event = events[index];

    const signal =
      normalizeGatekeeperSignal(
        event,
        CONNECTION_ID,
      );

    const result =
      await oasseServices
        .processGatekeeperSignal(
          signal,
        );

    const acknowledgement =
      result.acknowledgement;

    if (
      !validateAcknowledgement(
        acknowledgement,
      )
    ) {
      throw new Error(
        [
          `Acknowledgement schema validation failed for ${event.benchmark_case_id}.`,
          JSON.stringify(
            validateAcknowledgement.errors,
          ),
        ].join(" "),
      );
    }

    if (
      acknowledgement
        .benchmark_case_id
      !== event.benchmark_case_id
    ) {
      throw new Error(
        `Acknowledgement case mismatch for ${event.benchmark_case_id}.`,
      );
    }

    if (
      acknowledgement
        .presented_gatekeeper_decision
      !== event.decision
    ) {
      throw new Error(
        `Gatekeeper decision mismatch for ${event.benchmark_case_id}.`,
      );
    }

    acknowledgements.push(
      acknowledgement,
    );

    const completed = index + 1;

    if (
      completed === 1
      || completed % 50 === 0
      || completed === events.length
    ) {
      console.log(
        `Processed ${completed}/${events.length}`,
      );
    }
  }

  if (
    acknowledgements.length
    !== EXPECTED_CASE_COUNT
  ) {
    throw new Error(
      `Expected ${EXPECTED_CASE_COUNT} acknowledgements; generated ${acknowledgements.length}.`,
    );
  }

  const acknowledgementCaseIds =
    new Set(
      acknowledgements.map(
        (acknowledgement) =>
          acknowledgement
            .benchmark_case_id,
      ),
    );

  if (
    acknowledgementCaseIds.size
    !== EXPECTED_CASE_COUNT
  ) {
    throw new Error(
      `Expected ${EXPECTED_CASE_COUNT} unique acknowledgement case IDs; found ${acknowledgementCaseIds.size}.`,
    );
  }

  const output =
    `${acknowledgements
      .map(
        (acknowledgement) =>
          JSON.stringify(
            acknowledgement,
          ),
      )
      .join("\n")}\n`;

  fs.writeFileSync(
    OUTPUT_PATH,
    output,
    {
      encoding: "utf8",
      flag: "wx",
    },
  );

  console.log("");
  console.log(
    "=== OASSE VANGUARD INGESTION COMPLETE ===",
  );
  console.log(
    `Input cases: ${events.length}`,
  );
  console.log(
    `Acknowledgements: ${acknowledgements.length}`,
  );
  console.log(
    `Output: ${OUTPUT_PATH}`,
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "OASSE Vanguard ingestion failed:",
  );
  console.error(
    error.stack || error.message,
  );
  process.exitCode = 1;
});
