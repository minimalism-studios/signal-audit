const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  createSignalHistory,
} = require(
  "../services/signalHistory",
);

const {
  createGatekeeperProcessor,
} = require(
  "../integrations/gatekeeper/processor",
);

test(
  "acknowledges persisted Gatekeeper ingestion when analysis fails",
  async () => {
    const tempDirectory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "gatekeeper-failure-ack-",
        ),
      );

    try {
      const signalHistory =
        createSignalHistory({
          filePath:
            path.join(
              tempDirectory,
              "signal-history.json",
            ),
        });

      const connectionStore = {
        getConnection() {
          return {
            source:
              "gatekeeper",
            outputs: {},
          };
        },
      };

      let analysisAttempts = 0;

      const signalAuditService = {
        async runStructuredAudit() {
          analysisAttempts += 1;

          throw new Error(
            "Synthetic Gatekeeper analysis failure",
          );
        },
      };

      const processGatekeeperSignal =
        createGatekeeperProcessor({
          signalAuditService,
          signalHistory,
          connectionStore,
        });

      const signal = {
        source:
          "gatekeeper",
        connectionId:
          "oasse-gatekeeper",
        receiptId:
          "receipt-failure-ack-001",
        benchmarkCaseId:
          "SA-FAILURE-ACK-001",
        decision:
          "block",
        internalOutcome:
          "BLOCK",
        terminalStatus:
          "DECIDED",
        service:
          "failure-ack-test",
        rawPayload: {
          decision:
            "BLOCK",
        },
      };

      const first =
        await processGatekeeperSignal(
          signal,
        );

      const firstRecord =
        signalHistory.getSignal(
          first.historyId,
        );

      assert.equal(
        first.state,
        "failed",
      );

      assert.equal(
        first.analysisFailed,
        true,
      );

      assert.equal(
        first.processingError.message,
        "Synthetic Gatekeeper analysis failure",
      );

      assert.equal(
        firstRecord.state,
        "failed",
      );

      assert.equal(
        firstRecord.failureReason,
        "Synthetic Gatekeeper analysis failure",
      );

      assert.ok(
        first.acknowledgement,
      );

      assert.equal(
        first.acknowledgement
          .signal_audit_event_id,
        firstRecord.id,
      );

      assert.equal(
        first.acknowledgement
          .presented_gatekeeper_decision,
        "BLOCK",
      );

      assert.equal(
        first.acknowledgement
          .presented_terminal_status,
        "DECIDED",
      );

      /*
       * A retry of the same external receipt
       * may retry analysis, but it must reuse
       * the original durable history record.
       */
      const replay =
        await processGatekeeperSignal(
          signal,
        );

      assert.equal(
        replay.historyId,
        first.historyId,
      );

      assert.equal(
        replay.state,
        "failed",
      );

      assert.equal(
        replay.analysisFailed,
        true,
      );

      assert.equal(
        signalHistory
          .listAllSignals()
          .length,
        1,
      );

      assert.equal(
        analysisAttempts,
        2,
      );
    } finally {
      fs.rmSync(
        tempDirectory,
        {
          recursive:
            true,
          force:
            true,
        },
      );
    }
  },
);
