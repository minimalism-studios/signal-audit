"use strict";

const crypto = require("node:crypto");

function verifySlackRequest({
  rawBody,
  timestamp,
  signature,
  signingSecret,
  now = Date.now(),
}) {
  if (
    !Buffer.isBuffer(rawBody)
    || typeof signingSecret !== "string"
    || !signingSecret
    || typeof timestamp !== "string"
    || !/^\d+$/.test(timestamp)
    || typeof signature !== "string"
    || !/^v0=[a-f0-9]{64}$/.test(signature)
  ) {
    return false;
  }

  const requestTime = Number(timestamp) * 1000;

  if (
    !Number.isSafeInteger(requestTime)
    || Math.abs(now - requestTime) > 5 * 60 * 1000
  ) {
    return false;
  }

  const baseString = Buffer.concat([
    Buffer.from(`v0:${timestamp}:`, "utf8"),
    rawBody,
  ]);

  const expected = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}

module.exports = {
  verifySlackRequest,
};
