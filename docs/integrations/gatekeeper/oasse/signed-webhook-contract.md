# Gatekeeper × Signal Audit Signed Webhook Contract

**Version:** `oasse.signal_audit.webhook.v1`
**Event type:** `gatekeeper.decision.finalized`
**Pilot:** `oasse-signal-audit-vanguard-2026-09-21`

## Authority Boundary

Gatekeeper commits the authoritative governance decision and durable receipt before the webhook event is created or delivered.

Webhook transport is downstream notification only. A webhook delivery failure cannot modify, soften, replace, or re-evaluate the Gatekeeper decision and cannot create an unauthorized fail-open result.

## Signature Algorithm

Webhook requests are authenticated with **HMAC-SHA256** using the shared webhook signing secret.

The exact signing input is:

```text
<unix_timestamp>.<canonical_json_body>
```

The signature header is:

```text
X-OASSE-Webhook-Signature: v1=<lowercase-hex-hmac>
```

Equivalent signing logic:

```text
HMAC-SHA256(
    key = shared_signing_secret,
    message = ASCII(unix_timestamp) + "." + raw_canonical_json_body
)
```

The receiver MUST verify the signature against the exact raw HTTP request body received from Gatekeeper. The body must not be parsed and reserialized before signature verification.

## Canonical JSON Format

Gatekeeper serializes the webhook payload as UTF-8 JSON using the equivalent of:

```python
json.dumps(
    payload,
    sort_keys=True,
    separators=(",", ":"),
    ensure_ascii=False,
).encode("utf-8")
```

Therefore:

- Object keys are sorted.
- No insignificant whitespace is inserted.
- Separators are exactly `,` and `:`.
- Unicode remains unescaped where JSON permits it.
- The resulting JSON is encoded as UTF-8.

## Required Request Headers

Gatekeeper sends:

```text
Content-Type: application/json
Accept: application/json
User-Agent: OASSE-Gatekeeper-Signal-Audit-Webhook/1.0
Idempotency-Key: <event_id>
X-OASSE-Webhook-Id: <event_id>
X-OASSE-Webhook-Timestamp: <unix-seconds>
X-OASSE-Webhook-Signature: v1=<lowercase-hex-hmac>
```

Receiver validation depends on:

- `X-OASSE-Webhook-Id`
- `X-OASSE-Webhook-Timestamp`
- `X-OASSE-Webhook-Signature`
- `Idempotency-Key`

`Idempotency-Key` and `X-OASSE-Webhook-Id` carry the same deterministic `event_id`.

## Payload Schema

The outbound payload contains:

```json
{
  "schema_version": "oasse.signal_audit.webhook.v1",
  "event_type": "gatekeeper.decision.finalized",
  "event_id": "gkwh-<24 lowercase hex characters>",
  "pilot_id": "oasse-signal-audit-vanguard-2026-09-21",
  "tenant_id": "<tenant>",
  "benchmark_case_id": "<case id or null>",
  "request_id": "<Gatekeeper request id>",
  "idempotency_key": "<Gatekeeper request idempotency key>",
  "decision": "ALLOW | HOLD | ESCALATE | BLOCK",
  "internal_outcome": "<native Gatekeeper outcome>",
  "policy": {},
  "authority": {},
  "context": {},
  "trace": {},
  "receipt": {
    "receipt_id": "<durable receipt id>",
    "created_at": "<ISO-8601 UTC timestamp>"
  },
  "created_at": "<ISO-8601 UTC timestamp>"
}
```

### Required fields

The current JSON Schema requires:

```text
schema_version
event_type
event_id
pilot_id
tenant_id
request_id
idempotency_key
decision
internal_outcome
policy
authority
context
trace
receipt
created_at
```

`benchmark_case_id` may be a string or `null`.

### External decision vocabulary

```text
ALLOW
HOLD
ESCALATE
BLOCK
```

### Native outcome preservation

`internal_outcome` preserves Gatekeeper's native result rather than collapsing it into the external presentation vocabulary.

For the current sealed family-governance pilot corpus, native values include:

```text
ALLOW
BLOCK
REVIEW
REDIRECT
ABSTAIN
```

For example, native `REVIEW` and `ABSTAIN` may both present externally as `HOLD`, while `internal_outcome` preserves the distinction.

## Excluded Material

The webhook does **not** include:

- The governed request body.
- Native evaluator artifact internals.
- Raw journal material.
- Credentials or signing secrets.
- Oracle fields.
- Third-party runtime material.
- Raw metrics.
- LLM prompts or responses.

## Event Identity

Each webhook receives a deterministic `event_id`.

Gatekeeper computes the ID from:

```text
pilot_id
tenant_id
request_id
receipt_id
```

These values are canonicalized as JSON and SHA-256 hashed.

The identifier is:

```text
gkwh-<first 24 lowercase hex characters of sha256>
```

Because the event ID is derived from the sealed Gatekeeper result, retries of the same event preserve the same `event_id`.

## Timestamp Validation

`X-OASSE-Webhook-Timestamp` is an integer Unix timestamp in seconds.

The current reference receiver accepts timestamps within:

```text
±300 seconds
```

of receiver time.

A receiver should reject:

- Missing timestamps.
- Non-integer timestamps.
- Timestamps outside the allowed clock-skew window.

The timestamp is part of the signed material, so altering it invalidates the signature.

## Signature Verification Procedure

The receiver should perform validation in this order:

1. Read the exact raw HTTP request body.
2. Read `X-OASSE-Webhook-Timestamp`.
3. Confirm the timestamp is a valid integer and within the allowed clock-skew window.
4. Compute:

```text
HMAC-SHA256(
    shared_secret,
    ASCII(timestamp) + "." + raw_body
)
```

5. Encode the digest as lowercase hexadecimal.
6. Prefix it with `v1=`.
7. Compare it to `X-OASSE-Webhook-Signature` using constant-time comparison.
8. Parse the JSON only after signature validation.
9. Validate the event against the webhook schema.
10. Confirm payload `event_id` exactly equals `X-OASSE-Webhook-Id`.
11. Apply idempotency/replay handling using `event_id`.

## Replay and Idempotency Requirements

The receiver MUST deduplicate using `event_id`.

The same event may be delivered more than once because of retry behavior.

For a valid duplicate:

- Do not process the event a second time.
- Treat it as successfully acknowledged.
- Return a 2xx response.

The OASSE reference receiver returns:

```text
202 Accepted
```

for the first valid event and:

```text
200 OK
```

for a valid duplicate.

Gatekeeper treats any `2xx` response as successful delivery.

Each retry preserves:

- The exact event body.
- The same `event_id`.
- The same `Idempotency-Key`.
- The same Gatekeeper `request_id`.
- The same `receipt_id`.

Each delivery attempt generates a current timestamp and a corresponding new HMAC signature for that attempt.

## Delivery and Retry Behavior

Gatekeeper retries:

```text
Network errors
HTTP 408
HTTP 425
HTTP 429
HTTP 5xx
```

Other `4xx` responses are treated as permanent receiver rejection.

Retries use bounded exponential backoff.

The current transport defaults are:

```text
SIGNAL_AUDIT_WEBHOOK_TIMEOUT_S=3
SIGNAL_AUDIT_WEBHOOK_MAX_ATTEMPTS=3
SIGNAL_AUDIT_WEBHOOK_MAX_TOTAL_ATTEMPTS=9
SIGNAL_AUDIT_WEBHOOK_BACKOFF_S=0.25
```

Transport configuration requires both:

```text
SIGNAL_AUDIT_WEBHOOK_URL
SIGNAL_AUDIT_WEBHOOK_SIGNING_SECRET
```

to be configured together.

## Durable Outbox States

Webhook delivery state is stored in Gatekeeper's tenant-scoped durable outbox.

Possible states:

```text
PENDING
DELIVERED
DEAD_LETTER
```

A retryable failure remains `PENDING` until either delivery succeeds or the configured cumulative attempt ceiling is reached.

A permanent receiver rejection or exhaustion of cumulative attempts becomes `DEAD_LETTER`.

Successful delivery becomes `DELIVERED`.

The durable outbox stores only partner-safe event and transport metadata. It does not store the original governed request.

## Operator Endpoints

Authenticated Gatekeeper operators may inspect a delivery:

```text
GET /v1/gatekeeper/webhooks/<event_id>
```

Authenticated operators may retry pending deliveries:

```text
POST /v1/gatekeeper/webhooks/drain
```

The drain operation does not re-evaluate policy. It retries only previously sealed webhook events.

## Receiver Success Contract

The receiver should return a `2xx` response only after:

- Timestamp validation succeeds.
- Signature validation succeeds.
- JSON parses successfully.
- Schema validation succeeds.
- Header and payload event identities match.
- The event has either been accepted for processing or recognized as an already accepted duplicate.

## Current Validation Evidence

The OASSE bounded webhook checkpoint exercises the implemented contract using 20 frozen Vanguard cases:

- 5 native `ALLOW`
- 5 native `BLOCK`
- 5 native `REVIEW`
- 5 native `ABSTAIN`

The resulting external distribution is:

- 5 `ALLOW`
- 5 `BLOCK`
- 10 `HOLD`

The checkpoint validates:

- Signature generation and verification.
- Timestamp validation.
- Unique deterministic event identities.
- Request identity preservation.
- Receipt identity preservation.
- External decision fidelity.
- Native outcome preservation.
- Partner-boundary sanitization.
- Receiver deduplication.
- Idempotent replay.
- Retry behavior.
- Durable outbox delivery.
- The invariant that transport failure cannot alter Gatekeeper authority.

## Secret Coordination

The shared signing secret must be exchanged separately from the webhook contract and endpoint configuration.

It must not be:

- Committed to source control.
- Included in webhook payloads.
- Logged.
- Written into delivery receipts.
- Included in shared test reports.

The secret should be stored only in the respective staging secret-management/environment configuration on each side.
