function writeLog(
  level,
  event,
  fields = {},
) {
  const entry = {
    timestamp:
      new Date().toISOString(),

    level,

    event,

    ...fields,
  };

  const output =
    JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

function info(
  event,
  fields,
) {
  writeLog(
    "info",
    event,
    fields,
  );
}

function warn(
  event,
  fields,
) {
  writeLog(
    "warn",
    event,
    fields,
  );
}

function error(
  event,
  fields,
) {
  writeLog(
    "error",
    event,
    fields,
  );
}

module.exports = {
  info,
  warn,
  error,
};
