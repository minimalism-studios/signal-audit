const DEFAULT_RETENTION_DAYS = 30;

function resolveRetentionDays(
  value =
    process.env.OPERATIONAL_DATA_RETENTION_DAYS,
) {
  if (
    value === undefined
    || value === null
    || value === ""
  ) {
    return DEFAULT_RETENTION_DAYS;
  }

  const parsed =
    Number.parseInt(value, 10);

  if (
    !Number.isInteger(parsed)
    || parsed < 1
  ) {
    throw new Error(
      "OPERATIONAL_DATA_RETENTION_DAYS must be a positive integer.",
    );
  }

  return parsed;
}

function isWithinRetention(
  timestamp,
  retentionDays,
  now = Date.now(),
) {
  if (
    typeof timestamp !== "string"
    || !timestamp.trim()
  ) {
    /*
     * Missing timestamps are retained.
     *
     * Retention must fail safely rather
     * than deleting records whose age
     * cannot be established.
     */
    return true;
  }

  const timestampMs =
    Date.parse(timestamp);

  if (
    Number.isNaN(timestampMs)
  ) {
    return true;
  }

  const retentionMs =
    retentionDays
    * 24
    * 60
    * 60
    * 1000;

  return timestampMs
    >= now - retentionMs;
}

module.exports = {
  DEFAULT_RETENTION_DAYS,
  resolveRetentionDays,
  isWithinRetention,
};
