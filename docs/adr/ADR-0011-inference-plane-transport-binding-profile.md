# ADR-0011 — Inference-plane transport-binding profile

- Status: `PROPOSED — NOT DECIDED` (candidate v0.2.0 revision; **not** accepted, **not** applied,
  **not** a stable v1/GA version, **not** an ADR-0001 immutable bundle tag)
- Date raised: 2026-07-28
- Date decided: — (none; Gate W2-I is `NOT OPENED`)
- Decider: Founder (Gate W2-I; **no delegation of this gate has been granted or exercised**)
- Acceptance record: none. The in-tree validator and test are conformance evidence only; neither
  is an acceptance record.
- Governing prior decision: the Founder path-ownership arbitration
  [FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md](FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md)
  — **Option A, single-owner compatible revision**, G-W2I-1..G-W2I-5 all answered `Yes` by the
  Founder on 2026-07-26. That packet is `DECIDED`; **this** ADR is not.
- Scope: the cross-product **transport and authorization binding** of the four `ACCEPTED FOR
  IMPLEMENTATION` W2-D inference operations onto the `ACCEPTED FOR IMPLEMENTATION` W2-F two-layer
  trust seam ([ADR-0008](ADR-0008-internal-service-delegation-and-workload-identity.md), realizing
  [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md) E2/E3). It is a **contract-shape**
  decision only. It selects no substrate, authorizes no implementation, and declares no endpoint.
- Filename note: this record's filename carries the legacy word `profile` from the W2-I proposal
  that preceded the Founder arbitration. The filename is **not** the decision. The decision below
  selects a **single W2-D-owned successor revision of the W2-D-owned OpenAPI member**, not a
  standalone "transport profile" document, not a paths-less sidecar, and not a second plane. Where
  the filename and the Decision section disagree, the Decision section governs.
- ADR-number note: this record takes the number **ADR-0011**. The immediately preceding ADR number
  is reserved for the W0-I07B capability-name canonicalization decision
  (`cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-W0-I07B.md` — present in the canonical repository,
  **not** on this branch, so it is cited repository-qualified rather than as a relative link) and is
  deliberately never cited by this record or by any W2-I candidate artifact.

## Context

### What is already accepted, and stays accepted

Gate W2-D accepted the provider-neutral AI model-inference + alert-summarization packet at v0.1.0
([GATE-W2-D-INFERENCE-ACCEPTANCE-2026-07-24.md](../releases/GATE-W2-D-INFERENCE-ACCEPTANCE-2026-07-24.md)).
Its OpenAPI member `contracts/openapi/cybrik-ai-inference-plane.v1.openapi.yaml` is the **sole
current owner** of exactly four path+method pairs:

| # | Pair | operationId |
|---|---|---|
| 1 | `GET /api/v1/model-classes` | `listModelClasses` |
| 2 | `GET /api/v1/model-classes/{model_class}/health` | `getModelClassHealth` |
| 3 | `POST /api/v1/inferences` | `createInference` |
| 4 | `POST /api/v1/summarizations` | `createAlertSummarization` |

Gate W2-F accepted the internal service-delegation + workload-identity packet at v0.1.0
([GATE-W2-F-SERVICE-DELEGATION-ACCEPTANCE-2026-07-24.md](../releases/GATE-W2-F-SERVICE-DELEGATION-ACCEPTANCE-2026-07-24.md)),
recorded as [ADR-0008](ADR-0008-internal-service-delegation-and-workload-identity.md): a transport
layer of mutually-authenticated mTLS workload identity (ADR-0008 D1) **and** an application layer
of short-lived, asymmetric, certificate-bound RFC 9068 `at+jwt` delegation tokens (ADR-0008 D2),
with the relying party validating **and re-authorizing** the named operation (ADR-0008 D3), and
tool/agent/approval authority explicitly excluded (ADR-0008 D4).

Neither accepted packet binds the other. The accepted W2-D OpenAPI declares **no** `security`
requirement at all: an accepted inference operation currently carries no machine-readable statement
that it is reachable only under mTLS plus a certificate-bound delegation token. That gap is what
this record exists to close — and only in contract shape.

### What the Founder already arbitrated

The original W2-I proposal expressed the binding as a **separate OpenAPI document that redeclared
the same four pairs**. That shape made two documents claim the same operations. The Founder
resolved this on 2026-07-26 with **Option A**, answering `Yes` to all five gate items: W2-D is the
sole current owner (G-W2I-1); W2-I may **not** be accepted as an independent second OpenAPI path
owner (G-W2I-2); the binding must enter through a separately reviewed compatible W2-D
revision/supersession (G-W2I-3); accepted W2-D bytes stay unchanged until a later status flip
(G-W2I-4); everything stays `NO SERVER / NO ENDPOINT` (G-W2I-5).

This ADR is the contract-shape record required by G-W2I-3. It does **not** re-open G-W2I-1..5.

### Why the shape is a security decision, not bookkeeping

1. **Two owners of one operation is an authorization ambiguity, not a documentation duplicate.** If
   two accepted documents describe `POST /api/v1/inferences` and only one AND-requires mTLS plus a
   certificate-bound token, a generated client or a relying party can conform to the weaker one and
   still claim conformance. Single-current-owner is a fail-closed property.
2. **An additive-looking security bind is a break for existing consumers.** Adding a global
   AND-required security requirement narrows what a conformant caller may do. Under ADR-0001 D2
   that must be disclosed as a break, not smuggled in as "additive".
3. **A narrowed error surface silently drops accepted vocabulary.** The accepted W2-D plane binds
   `ModelInferenceError` on the create `422`/`503`. Replacing it with a transport error would remove
   accepted response vocabulary from consumers that already generate against it.

## Decision

**PROPOSED — NOT DECIDED.** Subject to a Founder decision at Gate W2-I, the suite adopts the
following contract shape.

### Selected option — a single W2-D-owned successor revision

The transport/authorization binding enters as **one proposed compatible successor revision of the
W2-D-owned inference OpenAPI member**, published at the immutable, version-stamped filename:

> `contracts/openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml`
> — `info.version: 0.2.0`, `info.x-cybrik-status: PROPOSED`,
> `info.x-cybrik-not-accepted: true`, `info.x-cybrik-lifecycle-role: PROPOSED-SUCCESSOR`,
> `info.x-cybrik-supersedes: cybrik-ai-inference-plane.v1.openapi.yaml`.

This is explicitly **the selected shape**, and it is explicitly **not**:

- **not a second plane** — it introduces no new operation, no new resource, and no parallel API;
- **not a second path owner** — it declares the same four pairs under the same four `operationId`s
  precisely so that the ownership rule below can be checked mechanically;
- **not a paths-less sidecar** — it does **not** express the binding as an overlay, a
  `paths`-less security document, an OpenAPI Overlay `actions` file, or any artifact that leaves the
  binding un-generated by ordinary OpenAPI tooling. A sidecar was rejected (Option B below);
- **not a mutation of accepted bytes** — the accepted predecessor is untouched.

The file is an **immutable successor artifact**: the version is stamped into the filename, so a
later revision is a new file, never a rewrite of a reviewed one. Its bytes are digest-pinned in the
companion delta record

> `contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json`
> — `x-cybrik-artifact-kind: proposed-delta`, `x-cybrik-is-manifest: false`,
> `x-cybrik-applied: false`.

and any edit is detectable as a pin drift. That record is **not** a compatibility manifest and is
**not applied**: it denies manifest identity structurally (it carries no `members`, no packet id,
and no bundle-tag field), it names the current owner and the proposed successor, and it is the single
declaration site for this ADR's identifier. Option A permits **no** second compatibility manifest for
these operations, and none exists.

The two artifacts the withdrawn shape would have required —
`contracts/openapi/cybrik-ai-inference-transport-plane.v1.openapi.yaml` and
`contracts/compatibility/cybrik-suite-inference-transport-packet.v1.manifest.json` — are **absent**,
and their absence is asserted mechanically on every conformance run rather than left to review.

### Single-current-owner lifecycle (the invariant this shape exists to enforce)

For every `(method, path)` pair across **every** OpenAPI document in `contracts/openapi/`:

- there is **exactly one** document with lifecycle role `CURRENT`; and
- there is **at most one** document with lifecycle role `PROPOSED-SUCCESSOR`; and
- a `PROPOSED-SUCCESSOR` is admissible **only** when it is delta-linked — i.e. named by the
  companion delta record as the proposed successor of the named current owner.

Today, for the four inference pairs: `CURRENT` = the accepted v0.1.0 predecessor;
`PROPOSED-SUCCESSOR` = the v0.2.0 file above. Any third document declaring any of the four pairs is
a defect, whatever its status.

### The predecessor stays CURRENT and byte-frozen

`contracts/openapi/cybrik-ai-inference-plane.v1.openapi.yaml` remains the **sole current owner** of
the four operations and remains **byte-frozen**: zero diff against `HEAD`, and no change of its
`x-cybrik-status` from `ACCEPTED FOR IMPLEMENTATION`. Until a separately recorded Founder status
flip, **a consumer implements the predecessor**, not the successor. Nothing in this record
supersedes the predecessor in effect, retires it, or authorizes a product to prefer the successor.

### What the successor adds, and nothing else

1. **Both layers of the accepted W2-F seam, AND-required.** A single top-level `security`
   requirement object containing both `mutualTLS` and `delegationToken`. One requirement object is
   load-bearing: a second object would degrade the bind to mTLS **OR** token.
2. **A typed, fail-closed transport/authorization error surface** shaped per RFC 9457 over the
   closed status set `{400, 401, 403, 409, 422, 429, 503}`. **No 500 or other 5xx is exposed.**
3. **Retention of the accepted error branch.** On the two statuses the predecessor already binds
   (`422`, `503` on the creates) the accepted `ModelInferenceError` is **retained** alongside the
   proposed transport branch as an exactly-two-branch `oneOf` — never replaced, never dropped. The
   same retention is applied to the reads' `503`, so the transport surface is added **without**
   narrowing the accepted plane's error vocabulary.
4. **Two optional headers** — the predecessor's `traceparent` extended to the reads, and an optional
   caller deadline `X-Cybrik-Deadline-Seconds` — declared at **path-item** level so every
   operation's own `parameters` list stays byte-identical to the predecessor's.
5. **A neutral operation token per operation** (`x-cybrik-operation-token`), so the operation the
   relying party must re-authorize (ADR-0008 D3) is machine-readable rather than inferred.

Equivalence obligations against the byte-frozen predecessor: identical pair set, identical four
`operationId`s (no `Bound` suffix or rename), verbatim `requestBody`, verbatim operation
`parameters`, verbatim `200` bindings, and a status floor covering every status the predecessor
binds.

### Authority boundaries (fail-closed disjointness)

This record and its successor artifact grant **no**:

- **runtime authority** — no `servers` block, no host, no URL, no deployment, no credential, key,
  or secret is declared anywhere. Path templates are internal versioned tokens only. Selecting or
  operating a model runtime remains out of scope
  ([ADR-0002](ADR-0002-cyber-ai-implementation-stack.md) owns the stack;
  [ADR-0005](ADR-0005-sandbox-substrate.md) owns the sandbox substrate);
- **server authority** — this is mapping notes, not a deployable API description, and it decides no
  deployment for any product;
- **tool or agent authority** — tool execution, capability registry, and execution receipts stay
  governed by [ADR-0004](ADR-0004-tool-fabric-control-plane-executor-split.md). MCP is a Tool/Agent
  gateway adapter and is **not** this trust boundary; agent orchestration stays with
  [ADR-0003](ADR-0003-durable-agent-orchestration.md);
- **model authority** — no vendor, product, endpoint, or weights identifier appears on the wire;
  `model_class` stays a policy-selected token resolved server-side. **Model output remains untrusted
  data and is never an authorization, approval, or action trigger**;
- **approval authority** — no approval, escalation, or human-decision object is created or bound;
- **hierarchy authority** — `org_scope` stays opaque and advisory on this seam
  ([ADR-0007](ADR-0007-org-hierarchy-and-external-authority-boundary.md) /
  [ADR-0009](ADR-0009-org-hierarchy-and-external-authority-contract-profile.md) own the org model).

### ADR-0001 reasoning, item by item

- **D1 — versioning unit.** The successor is a per-file SemVer step `0.1.0 → 0.2.0` on the W2-D
  OpenAPI member. It is **not** a suite bundle tag; `x-cybrik-is-bundle-tag` stays `false` in every
  record touching it. Under D1 the bundle level is untouched by this proposal.
- **D2 — N-1 bundle compatibility and no silent breakage.** The suite is pre-GA, so no hard N-1
  obligation binds yet — but D2's "every incompatibility must be explicit" binds **now**. This
  proposal therefore **refuses to claim a pure-additive change**. A compatibility disclosure MUST
  accompany it, listing the breaks honestly — at minimum: (a) the newly AND-required mTLS +
  certificate-bound token, which makes an unauthenticated or bearer-only caller non-conformant; (b)
  the `oneOf` widening on statuses that previously bound a single error shape, which changes
  generated response types; (c) the newly bound statuses on operations that previously bound fewer —
  plus a consumer compatibility matrix. A break disclosed is compliant with D2; a break called
  "additive" is a D2 violation.
- **D3 — deprecation window.** The predecessor is **not** retired by this proposal. Its proposed
  disposition after any future flip is `SUPERSEDED-SUPPORTED` while staying byte-frozen, and its
  earliest retirement floor is `max(two subsequent minor releases, 180 days)` from the flip, except
  in a documented security emergency. Those dates are **PROPOSED and non-binding**; they bind no
  release date and create no schedule commitment.
- **D4 — format pins.** OpenAPI **3.1.1** within the pinned 3.1.x profile; JSON Schema **2020-12**
  for every referenced schema. No pin is moved, and no format upgrade is requested.
- **D5 — acceptance mechanics.** The `PROPOSED → CURRENT` transition requires **explicit Founder
  authorization recorded with evidence links in a status-flip commit**. No agent may infer approval.
  A green validator or test run is a **conformance signal only** and is never acceptance. This ADR
  is written by an AI agent and is `PROPOSED — NOT DECIDED` precisely because D5 forbids anything
  else.
- **D6 — no `PROPOSED` references from accepted records.** Until the flip, the **accepted** W2-D
  compatibility manifest MUST NOT reference the successor file, the delta record, or any other
  candidate member — not in its member list and not anywhere in its bytes. The candidate is
  referenced only by candidate-owned records.

### Operation token registry — and its accepted-vocabulary gap

The successor declares a **closed** four-entry registry mapping each `x-cybrik-operation-token` to
its pair and `operationId`. Vocabulary provenance is **not** uniform, and this record refuses to
paper over it:

| Operation | Token | Vocabulary status |
|---|---|---|
| `createInference` | `ai.inference.create` | **ACCEPTED** — W2-F vocabulary |
| `createAlertSummarization` | `ai.summarization.create` | **ACCEPTED** — W2-F vocabulary |
| `listModelClasses` | `ai.model_classes.list` | **W2-I PROPOSED — NOT ACCEPTED** |
| `getModelClassHealth` | `ai.model_class_health.read` | **W2-I PROPOSED — NOT ACCEPTED** |

The two create tokens appear verbatim in the accepted W2-F vocabulary
(`contracts/json-schema/cybrik.svc-common-defs.v1.schema.json` `$defs.operationRef.name`, and
`contracts/adapters/cybrik-svc-delegation-mapping-notes.v1.md`). **The two read tokens do not.** The
accepted W2-F `operationRef.name` is a free-form dotted string with no closed enum, so the read
tokens are not *rejected* by the accepted contract — they are simply **not accepted vocabulary**.

This is an open gap, not a resolved detail. The consequence: a relying party cannot today
re-authorize a GET under an accepted operation name, so the two reads' authorization semantics are
proposal-only. Closing it requires either (a) a W2-F vocabulary extension accepted at its own gate,
or (b) a Founder decision that the read tokens are accepted as part of Gate W2-I. This ADR proposes
neither; it records the choice as open (OD-W2I-2 below).

## Alternatives considered

| # | Alternative | Disposition |
|---|---|---|
| **A** | **Single W2-D-owned successor revision at `contract-0.2.0`** | **SELECTED (proposed).** Preserves one canonical owner; keeps the binding in the same governed member that owns the operations; generated clients see the security requirement without extra tooling; the version transition is reviewable as bytes and pinnable as a digest. Cost: the successor duplicates the four pairs textually, so single-current-owner must be enforced mechanically rather than by convention. |
| **B** | **Paths-less sidecar / OpenAPI Overlay profile** | **REJECTED.** This was the arbitration packet's Option B. It keeps the binding out of the artifact ordinary tooling reads, so a client generated from the accepted plane silently omits the security requirement — the exact fail-open the binding exists to prevent. It also introduces a new standard and a new toolchain as a hard dependency, requiring its own format-pin gate under ADR-0001 D4 before any evidence could count. Rejected as fail-open and as unnecessary new surface. |
| **C** | **Second independent OpenAPI plane redeclaring the four pairs** | **REJECTED — foreclosed by the Founder.** G-W2I-2 answers `Yes` that W2-I may not be accepted as an independent second path owner. Two owners of one operation is an authorization ambiguity (Context §3.1). This is the shape the original W2-I proposal had; it is **withdrawn**, and both artifacts it would have required are absent from the tree. |
| **D** | **Modify the accepted v0.1.0 predecessor in place** | **REJECTED — foreclosed by the Founder.** G-W2I-4 answers `Yes` that accepted W2-D bytes remain unchanged until a later status-flip change. In-place mutation would also destroy the reviewed baseline that every accepted digest pins. |
| **E** | **Reject/defer W2-I entirely; leave transport enforcement product-local** | **NOT SELECTED, remains available.** This was the arbitration packet's Option C. It is the correct outcome if the Founder judges the open decisions below unready. Cost: the accepted inference seam keeps **no** machine-readable statement that it requires mTLS plus a certificate-bound token, and each product re-derives the binding independently. Deferring is safe today only because **no consumer implements the seam at all** (see the gate proposal's consumer audit). |
| **F** | **Bind transport at the AsyncAPI/event layer instead** | **REJECTED as non-responsive.** The four operations are request/response REST; the event layer neither carries them nor authorizes them. Out of scope here and owned by ADR-0003/ADR-0006. |

## Consequences

### If this ADR is later accepted

- The suite gains a reviewable, machine-readable statement that every inference operation is
  authorized only under mTLS **and** a certificate-bound delegation token — as a **proposal**, still
  requiring the separate status flip described under ADR-0001 D5 before any product may implement
  against it.
- Structural properties (AND-required security, closed error status set, retained accepted error
  branch, preserved operationIds/bodies/parameters/200 bindings, closed operation registry) become
  checkable from bytes.
- **Runtime-only properties are not proven by any of this** and remain REQUIRED of every
  implementation: proof-of-possession (observed mTLS peer-certificate thumbprint equals the token
  `cnf`/`x5t#S256`), audience binding, issuer pinning, tenant binding, operation binding,
  data-marking non-escalation, org-scope binding, feature-flag default-off, and replay rejection.
  A green validator run is a conformance signal, never running enforcement.

### `NOT IMPLEMENTED`

Accepting this ADR would build no client, no server, no route, no middleware, no certificate
authority, no JWKS resolver, and no deployment. There is today **no HTTP client and no HTTP server**
implementing any of the four operations in any suite repository. Implementation is owned and
separately gated by `cybrik-cyber-ai-platform` (relying party) and `cybrik-soc-command-center`
(caller), each under its own repository's rules.

### Rollback

Because nothing accepted is mutated, rollback is bounded and total at every stage:

1. **While `PROPOSED` (today).** Delete the candidate artifacts — the successor
   `contract-0.2.0` file, the companion delta record, the `cybrik.transport-*` schemas, the
   transport fixtures, and the transport validator/tests. The accepted W2-D and W2-F packets are
   byte-identical before and after; no accepted manifest references any of them (ADR-0001 D6), so
   nothing accepted dangles.
2. **After a future status flip, if one is ever granted.** Revert the flip commit. The predecessor
   is byte-frozen and stays on disk as `CURRENT`, so reverting restores the exact reviewed bytes
   rather than reconstructing them; consumers that never migrated are unaffected because migration
   was never mandatory during the `SUPERSEDED-SUPPORTED` window.
3. **After any product implementation** (none exists). Product-side rollback is a feature flag that
   defaults **OFF**, owned by the implementing repository, and is **not** decided here.

No rollback path at any stage requires editing an accepted byte or deleting audit history.

## Open Founder decisions

These are **open**. None is answered by this record, and each must be answered before Gate W2-I
could be decided.

| ID | Open decision |
|---|---|
| **OD-W2I-1** | Does the Founder accept this contract shape at all — a single W2-D-owned successor revision, as opposed to alternative **E** (defer, leave transport enforcement product-local)? |
| **OD-W2I-2** | **Operation-token registry gap.** Are `ai.model_classes.list` and `ai.model_class_health.read` accepted vocabulary as part of Gate W2-I, or must they enter through a separate W2-F vocabulary extension gate? Until answered, the two reads' authorization semantics are proposal-only. |
| **OD-W2I-3** | Is the D2 break disclosure (AND-required security; `oneOf` widening; newly bound statuses) accepted as the complete and honest break list, or is a further break identified in independent review? |
| **OD-W2I-4** | Is the D3 proposed disposition — predecessor `SUPERSEDED-SUPPORTED`, byte-frozen, retirement floor `max(two subsequent minor releases, 180 days)` — accepted as the shape, on the explicit understanding that the dates bind no release? |
| **OD-W2I-5** | Who performs the **independent** security and compatibility review of the final proposed bytes required before any acceptance, given that the candidate was authored with AI assistance and self-review is not independence? |
| **OD-W2I-6** | Does the Founder grant, withhold, or reserve technical delegation of Gate W2-I? (No delegation has been granted. Gates W2-D/W2-F/W2-G were delegated; that delegation does **not** extend here.) |
| **OD-W2I-7** | Does the Founder require a product-side conformance harness in `cybrik-cyber-ai-platform` **before** the status flip, or is contract-level evidence sufficient at the flip with runtime conformance gated separately? |

## Standards cited

OpenAPI **3.1.1** (within the ADR-0001 D4 3.1.x pin), JSON Schema **2020-12**, RFC **9068** (JWT
profile for OAuth 2.0 access tokens), RFC **8705** (mutual-TLS client authentication and
certificate-bound access tokens, `cnf`/`x5t#S256`), RFC **8693** (token exchange / delegation
semantics), RFC **9457** (problem details for HTTP APIs), RFC **7807** (superseded by 9457; cited
for lineage), W3C **Trace Context** (`traceparent`), and RFC **2606** (reserved `.example`
documentation domain used for `$id`s, which are identifiers and never endpoints). Suite ADRs cited:
ADR-0001 (versioning/format policy), ADR-0006 (cross-product event & identity model, E2/E3),
ADR-0008 (internal service-delegation & workload-identity profile — **the seam**). ADR-0002,
ADR-0003, ADR-0004, ADR-0005, ADR-0007, and ADR-0009 are cited only as **out-of-scope** boundaries.

## Decision history

- 2026-07-26 — the Founder arbitrated **path ownership** in
  [FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md](FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md):
  Option A, G-W2I-1..5 all `Yes`. That decision forecloses alternatives **C** and **D** above. It
  decided ownership only; it did not accept W2-I, did not open Gate W2-I, and changed no release
  date.
- 2026-07-28 — this record raised as `PROPOSED — NOT DECIDED`, replacing the withdrawn second-plane
  shape with the single W2-D-owned successor revision required by G-W2I-3. Gate W2-I remains
  `NOT OPENED`; the predecessor remains `CURRENT` and byte-frozen; OD-W2I-1..7 remain open.
- 2026-07-28 — the contract-shape candidate and its executable conformance validator/test were
  prepared. Their current results must be reproduced by canonical validation; no separate
  release-evidence record is part of this bounded proposal. Under ADR-0001 D5 that is a
  **conformance signal only**. It decides nothing here: this record stays
  `PROPOSED — NOT DECIDED — NOT APPLIED`, Gate W2-I stays `NOT OPENED`, no delegation of this gate
  has been granted, OD-W2I-1..7 stay open, and the independent security & compatibility review
  required before any acceptance **has not been performed**. In particular OD-W2I-2 is untouched by
  it: `ai.model_classes.list` and `ai.model_class_health.read` remain **not accepted W2-F
  vocabulary**, and the W2-F mapping-notes amendment that would carry them is a **blocking**
  prerequisite decided at its own gate, not here.
