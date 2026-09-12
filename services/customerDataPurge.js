function createCustomerDataPurgeService({
  signalHistory,
  investigationStore,
  operationalMemoryStore,
} = {}) {
  if (
    !signalHistory
    || typeof signalHistory.purgeConnection
      !== "function"
  ) {
    throw new Error(
      "Customer Data Purge requires Signal History.",
    );
  }

  if (
    !investigationStore
    || typeof investigationStore.purgeConnection
      !== "function"
  ) {
    throw new Error(
      "Customer Data Purge requires Investigation Store.",
    );
  }

  if (
    !operationalMemoryStore
    || typeof operationalMemoryStore
      .purgeConnection !== "function"
  ) {
    throw new Error(
      "Customer Data Purge requires Operational Memory Store.",
    );
  }

  function purgeConnection(
    connectionId,
  ) {
    const normalizedConnectionId =
      typeof connectionId === "string"
        ? connectionId.trim()
        : "";

    if (!normalizedConnectionId) {
      throw new TypeError(
        "connectionId must be a non-empty string.",
      );
    }

    /*
     * ORDER IS SECURITY-SIGNIFICANT.
     *
     * Investigations must be purged first while
     * Signal History still exists so legacy
     * investigations without connectionId can
     * be identified from attached signal IDs.
     *
     * Operational Memory follows using the
     * deleted investigation IDs.
     *
     * Signal History is removed last.
     */

    const investigationResult =
      investigationStore
        .purgeConnection(
          normalizedConnectionId,
        );

    const memoryResult =
      operationalMemoryStore
        .purgeConnection(
          normalizedConnectionId,
          {
            investigationIds:
              investigationResult
                .investigationIds,
          },
        );

    const signalResult =
      signalHistory
        .purgeConnection(
          normalizedConnectionId,
        );

    return {
      connectionId:
        normalizedConnectionId,

      purgedAt:
        new Date().toISOString(),

      deleted: {
        signals:
          signalResult.deletedCount,

        investigations:
          investigationResult
            .deletedCount,

        memoryDocuments:
          memoryResult.deletedCount,
      },
    };
  }

  return {
    purgeConnection,
  };
}

module.exports = {
  createCustomerDataPurgeService,
};
