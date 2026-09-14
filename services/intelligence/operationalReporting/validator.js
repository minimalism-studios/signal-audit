function validateOperationalReport(report) {
  if (
    report === null
    || typeof report !== "object"
    || Array.isArray(report)
  ) {
    throw new TypeError(
      "Operational report must be an object.",
    );
  }

  return report;
}

module.exports = {
  validateOperationalReport,
};
