const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../app.js"),
  "utf8",
);

const expirationStart = source.indexOf(
  "// OASSE Vanguard Pilot — automatic expiration.",
);

const expirationEnd = source.indexOf(
  '\napp.use(\n  "/signal-interpreter",',
  expirationStart,
);

assert.ok(expirationStart >= 0, "Expiration middleware must exist");
assert.ok(expirationEnd > expirationStart, "Expiration middleware boundary must exist");

const middleware = source.slice(expirationStart, expirationEnd);

test("preserves the October 21 pilot expiration", () => {
  assert.match(middleware, /2026-10-21T07:00:00Z/);
});

test("permits authentication session checks", () => {
  assert.match(middleware, /req\.path === "\/auth\/session"/);
});

test("preserves the Minimalism administrator exemption", () => {
  assert.match(middleware, /iam@minimalism\.agency/);
  assert.match(middleware, /currentUser\.role === "administrator"/);
});

test("blocks expired integration webhooks", () => {
  assert.match(middleware, /req\.path\.startsWith\("\/integrations\/"\)/);
  assert.match(middleware, /return res\.status\(403\)/);
});

test("preserves expired-user rejection", () => {
  assert.match(middleware, /error: "pilot_expired"/);
});
