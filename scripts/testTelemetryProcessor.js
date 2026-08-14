const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  createSignalHistory,
} = require(
  "../services/signalHistory",
);

const {
  createTelemetryProcessor,
} = require(
  "../services/telemetryProcessor",
);

async function main() {
  const tempDirectory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "signal-audit-",
      ),
    );

  const historyPath =
    path.join(
      tempDirectory,
      "signal-history.json",
    );

  const signalHistory =
    createSignalHistory({
      filePath:
        historyPath,
    });

  /*
   * TEST 1
   * Successful analysis.
   */
  const successfulProcessor =
    createTelemetryProcessor({
      source:
        "grafana",

      signalHistory,

      analyzeSignal:
        async (signal) => ({
          summary:
            `Analyzed ${signal.title}`,

          findings: [
            {
              title:
                "Synthetic finding",

              severity:
                "high",
            },
          ],
        }),
    });

  const successResult =
    await successfulProcessor({
      source:
        "grafana",

      title:
        "Payments latency",

      service:
        "payments-api",

      environment:
        "production",

      severity:
        "high",

      status:
        "firing",

      fingerprint:
        "test-success-001",
    });

  if (
    successResult.state
    !== "analyzed"
  ) {
    throw new Error(
      `Expected analyzed state, received ${successResult.state}`,
    );
  }

  const successfulRecord =
    signalHistory.getSignal(
      successResult.historyId,
    );

  if (
    successfulRecord.state
    !== "analyzed"
  ) {
    throw new Error(
      "Successful record was not persisted as analyzed.",
    );
  }

  if (
    !successfulRecord.analysis
  ) {
    throw new Error(
      "Successful record is missing analysis.",
    );
  }

  console.log(
    "PASS: successful telemetry is persisted as ANALYZED",
  );

  /*
   * TEST 2
   * Analysis failure.
   */
  const failingProcessor =
    createTelemetryProcessor({
      source:
        "datadog",

      signalHistory,

      analyzeSignal:
        async () => {
          throw new Error(
            "Synthetic analysis failure",
          );
        },
    });

  let failureHistoryId =
    null;

  try {
    await failingProcessor({
      source:
        "datadog",

      title:
        "Database saturation",

      service:
        "orders-api",

      environment:
        "production",

      severity:
        "critical",

      status:
        "firing",

      fingerprint:
        "test-failure-001",
    });

    throw new Error(
      "Expected processor to fail.",
    );
  } catch (error) {
    if (
      error.message
      !== "Synthetic analysis failure"
    ) {
      throw error;
    }
  }

  const records =
    signalHistory.listAllSignals();

  const failedRecord =
    records.find(
      (record) =>
        record.fingerprint
        === "test-failure-001",
    );

  if (!failedRecord) {
    throw new Error(
      "Failed telemetry record was not persisted.",
    );
  }

  failureHistoryId =
    failedRecord.id;

  if (
    failedRecord.state
    !== "failed"
  ) {
    throw new Error(
      `Expected failed state, received ${failedRecord.state}`,
    );
  }

  if (
    failedRecord.failureReason
    !== "Synthetic analysis failure"
  ) {
    throw new Error(
      "Failure reason was not persisted.",
    );
  }

  console.log(
    "PASS: analysis failure is persisted as FAILED",
  );

  /*
   * TEST 3
   * Source mismatch protection.
   */
  try {
    await successfulProcessor({
      source:
        "datadog",

      title:
        "Wrong source",
    });

    throw new Error(
      "Expected source mismatch to fail.",
    );
  } catch (error) {
    if (
      !error.message.includes(
        "Expected grafana signal",
      )
    ) {
      throw error;
    }
  }

  console.log(
    "PASS: processor rejects mismatched telemetry sources",
  );

  console.log("");
  console.log(
    "Standalone telemetry processor tests passed.",
  );

  console.log(
    `Success history ID: ${successResult.historyId}`,
  );

  console.log(
    `Failure history ID: ${failureHistoryId}`,
  );

  fs.rmSync(
    tempDirectory,
    {
      recursive: true,
      force: true,
    },
  );
}

main().catch(
  (error) => {
    console.error(
      "Telemetry processor test failed:",
      error,
    );

    process.exitCode = 1;
  },
);
