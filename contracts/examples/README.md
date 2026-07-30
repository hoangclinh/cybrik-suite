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

## Additive packet fixtures (disjoint namespaces)

- `inference/` — W2-D AI model-inference + alert-summarization fixtures, driven by
  `inference/examples-manifest.json` (validated by `validate-inference.mjs`).
- `svc/` — W2-F internal service-delegation fixtures, driven by `svc/examples-manifest.json`
  (validated by `validate-svc.mjs`): **3 positive**, **7 negative-schema** (asymmetric-only alg,
  required `jti`/`cnf`, thumbprint pattern, no static bearer / forwarded user token), and **9
  negative-semantic** (time window, over-TTL, audience, cross-tenant, org-scope, operation binding,
  marking non-escalation, `jti` replay) — the negative-semantic cases are structurally valid and
  rejected only by a relying-party trust invariant, against a fixed test clock.
- `org/` — W2-G organizational-hierarchy fixtures, driven by `org/examples-manifest.json`
  (validated by `validate-org.mjs`): **21 positive**, **10 negative-schema** (string tier,
  external-with-parent, external membership, external-as-ancestor edge, ancestor-raw escalation,
  empty raw-scope, sub-k=5 cell, raw `object_refs` in an aggregate, internal token on the external
  boundary, hard-`delete` lifecycle), and **6 negative-semantic** (cross-tenant edge, cycle,
  sibling access, marking downgrade, expiry, revocation) — the negative-semantic cases are
  structurally valid and rejected only by a relying-party invariant (tree walk / wall-clock /
  marking-vs-source), against a fixed test clock (NOW=1899635200 = 2030-03-13T12:26:40Z).
- `investigation/` — W0-I01 Investigation/Claim/Evidence/Bundle fixtures, driven by
  `investigation/examples-manifest.json` (validated by the standalone
  `validate-investigation.mjs`, not wired into the shared orchestrator): **9 positive**, **8
  negative-schema** (asserted claim with empty evidence_refs, abstained claim missing
  abstention_reason, abstained claim carrying confidence, abstained investigation missing
  abstention_reason, bundle with an empty claims array, a claim with an `approval_id` field,
  evidence missing investigation_id, an evidence source_ref missing its digest), and **9
  negative-semantic** (bundle marking downgrade below its referenced evidence — including a
  mixed-axis case where classification rises while TLP falls, a claim asserted under a
  mismatched tenant, an evidence entry collected under a mismatched tenant, a claim citing a
  digest matching no real evidence entry anywhere, a claim citing a REAL evidence digest that
  belongs to a different investigation, a bundle whose claims[]/evidence[] are REAL digests that
  belong to a different investigation, evidence collected after its investigation closed, and a
  claim created after its investigation closed) — the negative-semantic cases are structurally
  valid and rejected only by a relying-party invariant (marking lattice per-axis / credential
  tenant / citation dereference and investigation partition / lifecycle ordering) the schema
  alone cannot express. This packet is `ACCEPTED FOR IMPLEMENTATION` at v0.1.0 (not stable v1/GA)
  by explicit Founder Option A with G-W0I01-1..5 `yes` on 2026-07-26. Its validator remains
  standalone and proves fixture/contract conformance, not product runtime enforcement.
