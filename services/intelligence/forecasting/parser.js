function parseForecastResult(content) {
  if (
    typeof content !== "string"
    || !content.trim()
  ) {
    throw new Error(
      "Forecast Intelligence returned an empty response.",
    );
  }

  const normalized =
    stripCodeFence(
      content.trim(),
    );

  const jsonContent =
    extractJsonObject(
      normalized,
    );

  try {
    return JSON.parse(
      jsonContent,
    );
  } catch (error) {
    throw new Error(
      `Forecast Intelligence returned invalid JSON: ${error.message}`,
    );
  }
}

function stripCodeFence(value) {
  return value
    .replace(
      /^```(?:json)?\s*/i,
      "",
    )
    .replace(
      /\s*```$/,
      "",
    )
    .trim();
}

function extractJsonObject(value) {
  const start =
    value.indexOf("{");

  const end =
    value.lastIndexOf("}");

  if (
    start === -1
    || end === -1
    || end < start
  ) {
    throw new Error(
      "Forecast Intelligence response did not contain a JSON object.",
    );
  }

  return value.slice(
    start,
    end + 1,
  );
}

module.exports = {
  parseForecastResult,
};
