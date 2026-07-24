# contracts/examples — conformance examples for the v1 contract packet

Status: `PROPOSED` — **NOT ACCEPTED**. Contract version 0.1.0.

These examples exercise the PROPOSED cross-product contract packet under
`contracts/json-schema/`. They are illustrative fixtures with synthetic identifiers and
placeholder digests — **no secrets, no operational endpoints, no customer data**.

## Two classes of negative example

A JSON Schema is **necessary but not sufficient** for the suite's security posture. The
examples make that explicit:

- **`negative-schema`** — structurally invalid. The JSON Schema itself rejects it (bad event
  type, model-injected attribute, missing required bounds, missing approval correlation, short
  idempotency key). These prove the schema's own guardrails.
- **`negative-semantic`** — structurally **valid** yet MUST be rejected by a **control-plane
  invariant a schema cannot express**: cross-tenant mismatch, confused-deputy audience,
  approval-bypass / separation-of-duties, digest re-binding, replay after expiry, risk
  downgrade. These document where authority is enforced *below* the contract — in the Tool
  Fabric control plane — not in the wire schema.

The security story is precisely that the `negative-semantic` cases pass schema validation:
identity, tenant, audience, freshness, and digest binding are enforced by authenticated
service code, never by the payload shape (ADR-0006; ADR-0004 F5/F7).

## Expected outcomes

`examples-manifest.json` maps every fixture to its schema, its `kind`, and the invariant it
demonstrates. A `positive` example MUST validate; a `negative-schema` example MUST fail
validation; a `negative-semantic` example MUST validate structurally and carries the
control-plane rule that rejects it.

Validation is performed with no-install, standard-library tooling only (see the packet
validation notes). Nothing here is executable product code.
