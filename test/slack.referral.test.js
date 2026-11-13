"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSignalReferral } = require("../services/intelligence/investigative/referral");

test("links directly to the correlated signal for detailed questions", () => {
  const result = buildSignalReferral({signalId:"gh59-parity-123", question:"What evidence and confidence support this?"});
  assert.match(result, /https:\/\/app\.signal-audit\.com\/signal-interpreter\?signalId=gh59-parity-123/);
  assert.match(result, /#\/live-signals/);
  assert.match(result, /authorization/);
});
test("does not add repetitive referrals for simple questions", () => {
  assert.equal(buildSignalReferral({signalId:"signal-1", question:"What service?"}), null);
});
test("does not fabricate links for invalid identifiers", () => {
  for (const signalId of [null, "", "a".repeat(257), "\n"])
    assert.equal(buildSignalReferral({signalId, question:"full evidence"}), null);
});
test("encodes signal identifiers instead of allowing URL injection", () => {
  const result = buildSignalReferral({signalId:"id?next=https://evil.example", question:"full evidence"});
  assert.match(result, /signalId=id%3Fnext%3Dhttps%3A%2F%2Fevil\.example/);
  assert.doesNotMatch(result, /<https:\/\/evil\.example/);
});
