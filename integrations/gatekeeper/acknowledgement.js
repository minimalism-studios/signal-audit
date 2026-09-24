function createGatekeeperAcknowledgement({
  historyRecord,
} = {}) {
  if (
    !historyRecord
    || typeof historyRecord !== "object"
    || Array.isArray(historyRecord)
  ) {
    throw new TypeError(
      "historyRecord is required.",
    );
  }

  const signal =
    historyRecord.signal;

  if (
    !signal
    || typeof signal !== "object"
    || Array.isArray(signal)
  ) {
    throw new TypeError(
      "historyRecord.signal is required.",
    );
  }

  if (!signal.benchmarkCaseId) {
    throw new Error(
      "Gatekeeper acknowledgement requires benchmarkCaseId.",
    );
  }

  if (!historyRecord.id) {
    throw new Error(
      "Gatekeeper acknowledgement requires a Signal Audit event ID.",
    );
  }

  return {
    benchmark_case_id:
      signal.benchmarkCaseId,

    ingested_at:
      historyRecord.receivedAt,

    presented_gatekeeper_decision:
      signal.rawPayload?.decision
      || String(signal.decision || "")
        .toUpperCase(),

    presented_terminal_status:
      signal.terminalStatus,

    signal_audit_event_id:
      historyRecord.id,
  };
}

module.exports = {
  createGatekeeperAcknowledgement,
};
