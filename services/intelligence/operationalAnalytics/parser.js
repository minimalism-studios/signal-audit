function parseAnalyticsResult(content) {
  if (
    typeof content !== "string"
    || content.trim() === ""
  ) {
    throw new TypeError(
      "Operational Analytics response must be a non-empty string.",
    );
  }

  const normalized =
    content
      .trim()
      .replace(
        /^```(?:json)?\s*/i,
        "",
      )
      .replace(
        /\s*```$/,
        "",
      )
      .trim();

  const objectStart =
    normalized.indexOf("{");

  const objectEnd =
    normalized.lastIndexOf("}");

  if (
    objectStart === -1
    || objectEnd === -1
    || objectEnd < objectStart
  ) {
    throw new SyntaxError(
      "Operational Analytics response did not contain a JSON object.",
    );
  }

  const json =
    normalized.slice(
      objectStart,
      objectEnd + 1,
    );

  try {
    return JSON.parse(json);
  } catch (error) {
    throw new SyntaxError(
      `Operational Analytics response was invalid JSON: ${error.message}`,
    );
  }
}

module.exports = {
  parseAnalyticsResult,
};
