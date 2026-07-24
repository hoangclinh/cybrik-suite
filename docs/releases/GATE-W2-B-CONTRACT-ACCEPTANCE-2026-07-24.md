# Gate W2-B — Wave 2 contract-packet acceptance review (2026-07-24)

- Status: `DECISION RECORD` — **Gate W2-B outcome: ACCEPTED FOR IMPLEMENTATION** (packet
  v0.1.0; **not** stable v1/GA, **not** an ADR-0001 immutable bundle tag). Every packet member
  is flipped from `PROPOSED — NOT ACCEPTED` to `ACCEPTED FOR IMPLEMENTATION` at v0.1.0. This
  authorizes products to implement contract-first against v0.1.0; it does **not** promote to a
  stable version, create a bundle tag, or close any release blocker.
- Date: 2026-07-24
- Branch / reviewed tree: `codex/overnight-wave2-contracts` (status-flip commit; see §2 for the
  validator run recorded at the flip head). The prior baseline was `d176f4f`
  (`tooling: add isolated contract standards-validation toolchain + CI + secret scan`), which
  the initial Gate W2-B blocked on two High trust defects.
- Authority: Founder-delegated **technical** Gate W2-B (delegation of the technical accept/-hold
  decision to Codex; executed and recorded by the suite Claude lead). Delegation covers the
  technical gate decision and the acceptance-for-implementation flip only. It does **not**
  authorize promotion to stable v1/GA, creating an immutable bundle tag, closing RB-001/MARK-001,
  or merging to `main`.
- Reviewed packet: the 10 JSON Schemas (`contracts/json-schema/`), all positive + negative
  examples (`contracts/examples/`), OpenAPI 3.1.1 (`contracts/openapi/…`), AsyncAPI 3.0.0
  (`contracts/asyncapi/…`), MCP 2025-11-25 mapping notes (`contracts/mcp/…`), and both manifests
  (`contracts/compatibility/…`, `contracts/examples/examples-manifest.json`).

## 1. Decision

**ACCEPTED FOR IMPLEMENTATION — v0.1.0, not stable v1/GA.** The gate rule is: accept for
implementation only if the post-validator security/trust and standards review surfaces **no
Critical or High** trust defect. The initial review (recorded on `d176f4f`) surfaced **two
High-severity trust defects (0 Critical)** — W2B-H1 (non-human approver) and W2B-H2 (undefined
delegation-chain composition / co-grant privilege escalation). Both have now been **resolved
contract-first** (see §3), each with schema/manifest enforcement, worked examples, a dedicated
negative fixture, and a brittle validator assertion. The re-gate security/trust and standards
review surfaces **0 Critical and 0 High** trust defects. Under the rule, the packet is therefore
**ACCEPTED FOR IMPLEMENTATION** at v0.1.0.

This is an implementation-authorization acceptance only. It is **not** a stable v1/GA promotion,
**not** an immutable bundle tag (`x-cybrik-is-bundle-tag` stays `false`), and does **not** close
any release blocker. Runtime-only invariants recorded in the manifest
(`monotonicity_invariants`, `cross_ref_integrity`) remain explicit and REQUIRED of every
implementation — a green validator run proves standards conformance and fixture coverage, not a
running enforcement.

## 2. Evidence — validators, negative tests, secret scan (re-run at the status-flip head)

Reproducible from the committed lockfile: `cd tools/contract-validation && npm ci && npm run validate`.

- **JSON Schema 2020-12 / packet / invariants** — PASS. counts:
  `schemas_loaded=10, schemas_compiled=10, positive_total=10, positive_pass=10,
  negative_schema_total=7, negative_schema_reject=7, negative_semantic_total=7,
  negative_semantic_structurally_valid=7, manifest_members=13, wire_refs_total=47,
  wire_refs_external_resolved=18, hardenings_checked=25, hardenings_ok=25`.
  The 21 pre-existing hardenings are unchanged and still pass; the count rose to 25 because the
  two blocker fixes added four new brittle assertions (H1, H2a, H2b, H2c) — no hardening was
  removed or weakened.
- **Lifecycle consistency** — PASS. The compatibility manifest is the single source of truth for
  lifecycle state; `validate-schemas.mjs` now accepts exactly two consistent whole-packet states
  (`PROPOSED`/not-accepted or `ACCEPTED FOR IMPLEMENTATION`/accepted) and fails a half-flipped
  packet. All 10 schemas, both manifests, the OpenAPI/AsyncAPI `info` blocks, and the MCP notes
  header agree on `ACCEPTED FOR IMPLEMENTATION` at v0.1.0; `x-cybrik-is-bundle-tag` remains
  `false`; accepted-state acceptance metadata (gate, decided_by, decided_on, evidence[]) is
  present.
- **OpenAPI 3.1.1 (Spectral `oas`, fail-severity=error)** — PASS. 0 errors; 13 intentional style
  warnings (no `servers`/`tags`/`contact`, some operation descriptions) for a non-deployable
  mapping-notes document.
- **AsyncAPI 3.0.0 (`@asyncapi/parser`)** — PASS. version=3.0.0, 0 errors, 0 warnings.
- **Secret scan (gitleaks 8.30.1, pinned; matches CI)** — CLEAN. Working tree (~673 KB) and full
  git history (9 commits) both report no leaks.

A green validator run is a standards-conformance signal; it now also exercises the two
previously-uncovered authorization-semantics gaps through the H1/H2 fixtures and assertions, but
it remains a conformance signal, not a proof of runtime enforcement.

## 3. Resolved blockers (both fixed contract-first)

| ID | Sev | Resolution (verified against source) |
|---|---|---|
| W2B-H1 | High → **RESOLVED** | `contracts/json-schema/cybrik.approval-decision.v1.schema.json` now constrains `decided_by.type` to `const:"user"` via `allOf` (schema-enforced human-in-the-loop). A `type:"agent"` or `type:"service"` approver of the R3 destructive `fabric.isolate_host` is rejected at the schema, not just at runtime — SoD alone would miss a different non-human actor. New negative-schema fixtures `negative/approval-decision.agent-approver.json` and `negative/approval-decision.service-approver.json` both fail validation; assertion `HARDENING#H1` verifies the `const "user"` constraint. |
| W2B-H2 | High → **RESOLVED** | `contracts/compatibility/cybrik-suite-contract-packet.v1.manifest.json` `monotonicity_invariants.chain_evaluation` now defines the deterministic algorithm: effective risk ceiling = MIN of every grant's `scope.max_risk_class`; no re-delegation or approver co-grant may raise it (attenuate-only); an R2/R3 action additionally requires a human `approval-decision` (`decided_by.type=="user"`) and an original grant at/above the chain minimum — a later co-grant can never be the source of elevation. Grant kinds (`re_delegation`, `approver_co_grant`) are defined so two products implement identical outcomes. The flagship positive fixture is now non-escalating (`grant[0]=R3` standing containment authority, `grant[1]=R3` approver co-grant, `min(R3,R3)=R3` authorizes the R3 action). New negative-semantic fixture `negative/delegation-chain.privilege-escalation.json` (`grant[0]=R2`, `grant[1]=R3` co-grant; `min(R2,R3)=R2 < R3`) MUST be denied. Assertions `HARDENING#H2a/H2b/H2c` verify the manifest wording, the non-escalating positive, and the actually-escalating negative. |

## 4. Non-blocking findings (record; do not block; still open as follow-ups)

- **M-1 (Medium)** — `approval-request.v1` allows `minimum_approvers > 1` but `approval-decision.v1`
  has no N-of-M aggregation/binding construct. Four-eyes counting is out-of-contract. Partially
  covered by manifest forward gap RB-001 (SOC approval-ingress). Fold in contract-first before the
  four-eyes flow is implemented. Acceptance-for-implementation does not resolve M-1.
- **M-2 (Medium)** — `execution-receipt.v1` leaves `side_effect`/`approval_id` optional at the top
  level, so a `completed` receipt for a destructive capability can omit `side_effect.target_digest`
  and break the manifest `cross_ref_integrity` target-digest binding. Rests on the documented
  runtime obligation. Consider requiring `side_effect` (and `approval_id`) for write/destructive
  capabilities in a follow-up.
- **L-1 (Low)** — `cybrik.fabric.kill_switch.changed.v1` payload is envelope-only and unbound;
  explicitly deferred and fail-closed. Bind its `data` in a later packet.
- **L-2 (Low)** — envelope `delegationref`/`traceparent` optional on authority-bearing events; the
  authoritative `delegation_ref` lives in the required payload, so no bypass. Noted only.

## 5. What did NOT change with this acceptance

- No promotion to stable v1/GA and no immutable bundle tag: packet stays v0.1.0,
  `x-cybrik-is-bundle-tag=false`. No wire semantics, no versions, no format pins changed.
- No security invariant/hardening was relaxed: the 21 original hardening assertions remain and
  pass; four new assertions (H1, H2a, H2b, H2c) were added for the blocker fixes.
- Contract manifest forward gaps **RB-001** (SOC approval-ingress) and **MARK-001** (SOC
  data-marking backfill) remain OPEN and untouched; acceptance-for-implementation does **not**
  close them. Release register **RB-001** (responsible-disclosure channel) remains
  `BLOCKING — OPEN` and continues to block any external release.
- No merge to `main`; no secrets, product dependencies, migrations, deployments, or remote
  configuration changed. The only install performed is the isolated, pinned validation toolchain
  (`npm ci`, `ignore-scripts=true`), whose `node_modules` is gitignored.

## 6. Path to stable v1/GA (separate, still-required gates)

Acceptance-for-implementation authorizes contract-first implementation only. Promotion to a
stable v1/GA version or an ADR-0001 immutable bundle tag remains a **separate Founder gate** and
requires, at minimum: resolving M-1/M-2 or explicitly deferring them with rationale; closing the
SOC-side RB-001 approval-ingress mapping and MARK-001 data-marking backfill contract-first; and
clearing the release register RB-001 responsible-disclosure blocker. Until such a bundle tag
exists, no release manifest may reference any member as GA (ADR-0001 D6).

## 7. Do not claim

- The packet is accepted **for implementation at v0.1.0 only**. It is **not** stable, **not** GA,
  **not** a bundle tag, and confers no release authorization.
- A green validator/secret-scan run is a conformance and fixture-coverage signal, not a proof of
  runtime enforcement of the monotonicity/cross-ref invariants.
- Nothing here is implemented, verified against a running system, piloted, or GA.
