"use strict";

const APP_ORIGIN = "https://app.signal-audit.com";
const DETAILED_QUESTION = /\b(evidence|confidence|impact|owner|recommend(?:ation|ations|ed)?|action(?:s)?|immediate|short.term|long.term|full|complete|detail(?:ed|s)?|investigat(?:ion|e|ing)|analysis|root cause|caus(?:e|ed))\b/i;

function buildSignalReferral({ signalId, question } = {}) {
  if (typeof signalId !== "string" || !signalId.trim()
      || signalId.length > 256 || /[\x00-\x1f\x7f]/.test(signalId)
      || typeof question !== "string" || !DETAILED_QUESTION.test(question)) {
    return null;
  }
  const url = new URL("/signal-interpreter", APP_ORIGIN);
  url.searchParams.set("signalId", signalId);
  url.hash = "/live-signals";
  return `For the full available signal findings and supporting details, open <${url.toString()}|Signal Audit Standalone App>. Access requires authorization; additional evidence or a verified root cause is not guaranteed.`;
}

module.exports = { buildSignalReferral };
