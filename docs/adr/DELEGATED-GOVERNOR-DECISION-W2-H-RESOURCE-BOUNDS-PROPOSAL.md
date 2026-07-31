# Delegated Governor Decision — Gate W2-H resource-bounds proposal lane

- **Decision date:** 2026-07-31 (`Asia/Ho_Chi_Minh`)
- **Decider:** Codex Governor under
  `docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`
- **Base:** `2da9649206b5f0cabf3921e9ab74efa976a7a104`
- **Lane:** `W0-T11/RB`
- **Gate:** `W2-H`
- **Decision:** `OPEN FOR BOUNDED PROPOSAL WRITING AND STATIC CONFORMANCE ONLY`
- **Contract lifecycle ceiling:** `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`
- **Runtime / UAT / deployment / production:** `NOT AUTHORIZED`
- **Release dates:** unchanged

## 1. Why this decision is now possible

The dated T11 instrument decision at
`FOUNDER-DECISION-PACKET-W0-T11-RESOURCE-BUDGET.md` parked the resource-bounds
contract lane until all of the following became true:

1. W1-C1 and W1-C2 co-reside in one canonical tree;
2. the ADR register can be read from that integrated tree;
3. the adopted `res-bounds-*` / `resource-bounds/` names are rechecked against
   that integrated tree; and
4. a separate decision opens a bounded proposal-writing gate and authorizes a
   writer.

Those prerequisites are now re-evaluated against the exact base above:

- W1-C1 and corrected W1-C2 are canonically integrated through PR #1 merge
  `28c564eb9b6853b73a18a59a2e84ba58fd67816a`.
- ADR-0011 now co-resides in the canonical tree through PR #9 merge
  `2da9649206b5f0cabf3921e9ab74efa976a7a104`. It remains
  `PROPOSED — NOT DECIDED — NOT APPLIED`; this decision does not change it.
- The integrated ADR register contains ADR-0001 through ADR-0011. Therefore
  ADR-0012 is assigned now, at write time, to the resource-bounds contract
  profile. Assignment is a document identity only and is not acceptance.
- `Gate W2-H` has no existing committed use in the integrated tree. Existing
  committed W2 gate identifiers include W2-B, W2-C1, W2-D, W2-F, W2-G, and
  W2-I.
- The integrated-tree collision recheck finds no schema, manifest, example
  directory, architecture directory, payload key, or object named
  `res-bounds`, `resource-bounds`, or `res_bounds`. Those strings occur only
  in the dated T11 decision/control documentation that selected the names.
  This is “free outside the decision record”, not a claim of zero textual
  occurrences.

The old `PARKED` prerequisite has therefore been discharged. This record is the
separate decision required to open a single bounded proposal lane. It does not
retroactively rewrite the dated evidence in the earlier packet.

## 2. Decisions

### G-W2H-1 — exact purpose

**Yes.** Gate W2-H authorizes exactly one Suite-owned, contract-first
resource-bounds packet under the existing `W0-T11/RB` sub-lane. It mints no
task 49 and changes no W0-T11 measurement status. W0-T11 remains
`HOLD until real vertical exists`.

### G-W2H-2 — lifecycle ceiling

**Yes.** Every new contract artifact stays
`PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`, pre-v1 `0.1.0`, and not a bundle
tag. A green validator is static conformance evidence only. This gate does not
accept ADR-0012, authorize a product implementation, or satisfy T10/T11.

### G-W2H-3 — identity and naming

**Yes.** ADR-0012 is assigned to the proposed resource-bounds contract profile
only now that ADR-0011 is co-resident. The wire prefix is `cybrik.res-*`; the
family noun is `res-bounds-*`; directories and the packet manifest use
`resource-bounds`. The superseded `res-budget-*` and `res-envelope-*` names
remain forbidden.

### G-W2H-4 — static evidence

**Yes.** The packet must carry a focused validator and tests, be registered in
the canonical contract orchestrator, and prove:

- official JSON Schema 2020-12 compilation and fixture conformance;
- conserved-parent accounting over deterministic synthetic trees;
- no minting on spawn and monotone drawdown at reservation time;
- finite admitted fanout under finite root bounds;
- deterministic replay under a fixture-supplied virtual clock;
- fail-closed tenant, org-scope, idempotency, lifecycle, cancellation,
  release, and no-remint invariants; and
- packet-member integrity plus status honesty.

No wall clock, network, concurrency, service, container, database, broker, or
product runtime may be used as evidence.

### G-W2H-5 — boundary and authority

**Yes.** The packet is JSON Schema, examples, compatibility metadata,
architecture documentation, and validation tooling only. OpenAPI, AsyncAPI,
MCP, product code, runtime adapters, deployment, UAT, stack execution, and
production are out of scope.

Tenant truth is derived from the authenticated caller credential. Org scope is
advisory and must match authenticated policy. A grant, reservation identifier,
request identifier, or release record is accounting state only and never a
credential, capability, permission, delegation, or approval.

### G-W2H-6 — review and stop conditions

**Yes.** Commit, push, and canonical merge require:

- exact bounded scope;
- focused and aggregate tests green;
- dependency audit and required hosted checks green;
- independent review with no open P0, P1, or P2; and
- a clean base relationship to canonical `main`.

Stop immediately on an accepted-byte mutation, a namespace collision, a
parallel authority axis, nondeterministic replay, a runtime claim, or scope
expansion beyond this record.

## 3. Bounded write scope

### 3.1 New contract and evidence paths

Exactly these six public schemas:

1. `contracts/json-schema/cybrik.res-common-defs.v1.schema.json`
2. `contracts/json-schema/cybrik.res-bounds-grant.v1.schema.json`
3. `contracts/json-schema/cybrik.res-reservation-request.v1.schema.json`
4. `contracts/json-schema/cybrik.res-reservation-result.v1.schema.json`
5. `contracts/json-schema/cybrik.res-release.v1.schema.json`
6. `contracts/json-schema/cybrik.res-bounds-error.v1.schema.json`

Exactly one examples manifest and these fixture paths:

1. `contracts/examples/resource-bounds/examples-manifest.json`
2. `contracts/examples/resource-bounds/positive/bounds-grant.root.json`
3. `contracts/examples/resource-bounds/positive/reservation-request.child.json`
4. `contracts/examples/resource-bounds/positive/reservation-result.admitted.json`
5. `contracts/examples/resource-bounds/positive/reservation-result.denied.json`
6. `contracts/examples/resource-bounds/positive/release.completed.json`
7. `contracts/examples/resource-bounds/positive/replay.conserved-tree.json`
8. `contracts/examples/resource-bounds/negative-schema/bounds-grant.authority-token.json`
9. `contracts/examples/resource-bounds/negative-schema/bounds-grant.empty-vector.json`
10. `contracts/examples/resource-bounds/negative-schema/reservation-request.zero-vector.json`
11. `contracts/examples/resource-bounds/negative-schema/reservation-request.short-idempotency-key.json`
12. `contracts/examples/resource-bounds/negative-schema/reservation-result.admitted-with-error.json`
13. `contracts/examples/resource-bounds/negative-schema/reservation-result.denied-with-reservation.json`
14. `contracts/examples/resource-bounds/negative-schema/release.missing-accounting.json`
15. `contracts/examples/resource-bounds/negative-semantic/replay.parent-overdraw.json`
16. `contracts/examples/resource-bounds/negative-semantic/replay.no-mint-spawn.json`
17. `contracts/examples/resource-bounds/negative-semantic/replay.tenant-mismatch.json`
18. `contracts/examples/resource-bounds/negative-semantic/replay.org-scope-mismatch.json`
19. `contracts/examples/resource-bounds/negative-semantic/replay.idempotency-conflict.json`
20. `contracts/examples/resource-bounds/negative-semantic/replay.double-release.json`
21. `contracts/examples/resource-bounds/negative-semantic/replay.over-return.json`
22. `contracts/examples/resource-bounds/negative-semantic/replay.parent-closed.json`
23. `contracts/examples/resource-bounds/negative-semantic/replay.root-cancel-remint.json`

And:

- `contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`
- `docs/adr/ADR-0012-resource-bounds-contract-profile.md`
- `docs/architecture/resource-bounds/README.md`
- `docs/architecture/resource-bounds/01-contract-semantics.md`
- `docs/architecture/resource-bounds/02-deterministic-replay-and-evidence.md`
- `tools/contract-validation/validate-resource-bounds.mjs`
- `tools/contract-validation/tests/validate-resource-bounds.test.mjs`

### 3.2 Existing catalog and wiring paths

Only these existing files may be edited:

- `docs/adr/README.md`
- `docs/architecture/README.md`
- `contracts/README.md`
- `contracts/json-schema/README.md`
- `contracts/examples/README.md`
- `contracts/compatibility/README.md`
- `tools/contract-validation/README.md`
- `tools/contract-validation/package.json`
- `tools/contract-validation/validate.mjs`
- `tools/contract-validation/tests/validate-transport.test.mjs`

This decision record itself is the only additional path.

The final path above is a bounded integration-compatibility amendment recorded
after aggregate validation found that W2-I's exact additive-byte test rejected
every later ADR catalog entry and that its existing success-banner test
required the literal validator name. It may change only the additive-byte
normalization and add the W2-H companion assertion; the orchestrator banner may
be updated to satisfy the unchanged W2-I banner test. All other catalog bytes
and all W2-I lifecycle assertions remain pinned. This grants no authority to
weaken transport semantics, coverage, ownership, or accepted-byte protections.

## 4. Corrected vocabulary boundary

The old T11 packet accurately recorded the state at its base, where the bare
investigation `budget` object was strategy prose only. That fact has since
changed: canonical W1-C2 now includes the accepted
`cybrik.investigation-create-request.v1` schema with
`budget.{deadline_seconds,max_model_calls,max_tool_calls,max_retrieved_bytes}`.

The distinction remains:

- the accepted investigation `budget` is one request’s cap declaration;
- the proposed `res-*` family accounts for conserved quantities across a call
  tree;
- this packet does not rename, extend, replace, deprecate, or silently map the
  accepted `budget` object;
- it also does not rename or remap `budget_exceeded`, `BUDGET_*`,
  `over_input_budget`, `over_output_budget`, or
  `fallbackInfo.reason = "budget"`.

Any future mapping between the accepted request cap and a root resource-bounds
grant is a separate contract decision and is absent here.

## 5. Release and production boundary

This decision changes no W0-W6 milestone and no release date. In particular,
the `2026-12-20` Founder stable-v1.0 go/no-go and the
`2026-12-21 → 2026-12-31` release window are unchanged.

Gate W2-H is not `G-C` and creates no substitute for that dated checkpoint.
Production deployment, rollout, data, configuration, credentials, secrets,
keys, and identity-provider changes remain Founder-only.

## 6. R2 amendment — bounded B1–B4 hardening authorization

- **Amendment date:** 2026-07-31 (`Asia/Ho_Chi_Minh`)
- **Decider:** Codex Governor under
  `docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`
- **Amendment identity:** `W2-H/R2`
- **Basis:** the read-only skeptical adjudication of the prior external W2-H /
  T11 review (verdict `REVISE`), a session-local governance instrument rather
  than a repository artifact. Its controlling conclusions are supplied to this
  amendment and are transcribed below: its findings B1–B4 are adopted as
  bounded hardening scope, and its rejected alternatives are adopted as
  explicit rejections in §6.5. Every design fact stated in §6.2 is
  additionally checked against the packet bytes at the base above.
- **Precedent:** this follows the same bounded-amendment mechanism already
  recorded in §3.2 for the integration-compatibility change.

### 6.1 Preserved invariants (unchanged by this amendment)

- The contract lifecycle ceiling remains
  `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`, pre-v1 `0.1.0`, not a bundle
  tag. This amendment accepts nothing.
- W0-T11 measurement remains `HOLD until real vertical exists`. Nothing in
  B1–B4 is runtime, integration, UAT, release, deployment, production, T10,
  or T11 evidence; a green validator after this hardening remains static
  L1/L2 conformance only.
- G-W2H-1 through G-W2H-6, §4 vocabulary boundary, and §5
  release/production boundary remain in force verbatim. The stop conditions
  of G-W2H-6 apply to this amendment's work.
- The four `ACCEPTED_DEPENDENCY_PINS` and every accepted-member byte remain
  untouchable; any drift there is a hard stop.

### 6.2 Authorized hardening content

Exactly the following design deltas are authorized, and no others.

**B1 — root closure record.** One new public schema,
`cybrik.res-root-closure.v1`, is authorized as the packet's seventh schema: a
single terminal root record covering both normal completion and cancellation
via a shared `closureReason` enum (`completed`, `cancelled`, `failed`,
`expired`) hoisted into `res-common-defs` so it cannot drift from the
`res-release` reason enum. Required content:
`closure_id` (new `closureId` def, `^rcl_[a-z0-9]{16,64}$`), `root`,
`tenant_id`, `org_scope_ref`, `reason`, `final_consumed`, `final_unused`
(resource vectors; a root's unused credit is extinguished, returned to
nobody), `closes_descendants` fixed `{"const": true}` so partial or selective
closure is structurally unrepresentable, `state_version_before`,
`state_version_after`, `sequence`, `virtual_time_ms`, and
`confers_authority: false`. The replay event kind `cancel-root` is renamed
`root-closure`, its payload is validated against the new schema before replay
(closing the truth gap in `02-deterministic-replay-and-evidence.md`), and the
replay model must reconcile the record's final accounting against the
replayed root state, fail-closed.

That reconciliation is exact, and it takes no new error code. At closure,
`final_consumed` plus `final_unused` must equal the closing grant's original
`bounds` vector, dimension by dimension; the root's remaining credit becomes
zero; and every descendant is closed with zero remaining. A root closure
returns credit to nobody — the root has no parent — and mints nothing; the
unused remainder is extinguished, not banked, forwarded, or re-minted. Any
mismatch fails closed under the existing `RES_RELEASE_ACCOUNTING_MISMATCH`
code, which the release path already uses for exactly this class of
conservation failure. **B1 mints no new `RES_*` code**: the
`res-bounds-error` `code` enum and the validator's `REPLAY_ERROR_CODES` keep
identical membership at fifteen codes.
`negative-semantic/replay.root-closure-accounting-mismatch.json` (§6.3.2
fixture 8) is the fixture that pins this rule.

**B2 — root binding on every non-grant record.** Today no non-grant record
names the tree it belongs to, so a record minted under one root grant is
structurally indistinguishable from a record minted under another.

One new `rootRef` def is added to `res-common-defs`. Its exact shape is an
object, deliberately parallel to the existing `parentRef` def:

- `"type": "object"` with `"additionalProperties": false`;
- `"required": ["kind", "id"]` — exactly those two, and no others;
- `kind` is `{"const": "grant"}`, because the root of a resource-bounds tree
  is always a root grant and never a reservation; and
- `id` is `{"$ref": "#/$defs/grantId"}`.

`rootRef` deliberately has **no `expected_version`**. `parentRef` carries
`expected_version` because a reservation draws down a specific parent version
under optimistic concurrency; a root binding is an identity statement about
which tree a record belongs to, not a compare-and-set against root state.
Adding `expected_version` here would make every record in a tree a serialized
writer of the root and would silently create a second concurrency axis. Its
absence is a design decision, recorded here so a writer does not "complete"
the def by adding it.

`rootRef` **confers no authority**. Like every other reference in this packet
it is accounting lineage only: naming a root grant is not possession of it,
and never carries permission, capability, delegation, approval, or capacity.
The `res-bounds-grant` authority-token prohibition applies to `rootRef`
unchanged.

A required `root` property carrying `rootRef` is added to exactly the four
non-grant records: `res-reservation-request`, `res-reservation-result`,
`res-release`, and the B1 `res-root-closure`. `root` is required, not
optional, on all four — an optional binding would leave the unbound record
representable and close nothing. The grant itself gains no `root` property; it
is the root, and a self-reference would be redundant.

Replay must fail closed when a record's `root` is not the replayed tree's
root grant identifier. That failure reuses the existing
`RES_PARENT_NOT_FOUND` code, which the current root-cancel handler already
uses for exactly this condition (`validate-resource-bounds.mjs`, the
`grant_id !== root.grantId` branch). **B2 mints no new `RES_*` code**: the
`res-bounds-error` `code` enum and the validator's `REPLAY_ERROR_CODES` keep
identical membership at fifteen codes.

`res-bounds-error` is deliberately excluded from the four, because it is a
failure document about an operation rather than a ledger record of one — see
B3.

**B3 — error record: code-derived retriability and an explicit binding
declaration.** Two truth gaps are closed.

First, `retriable` is `{"const": false}` for all fifteen `RES_*` codes, so the
field carries no information and cannot be checked against `code`. It is
replaced by an explicit **code-derived** mapping expressed in schema — a
closed `if`/`then`/`else` composition over `code`, so that `retriable` is a
derived function of `code` and a contradicting pair is structurally invalid.
The mapping must be exhaustive over the existing fifteen codes and must add
none and remove none.

A `retriable: true` value is permitted for exactly two codes, and for no
others:

- **`RES_INSUFFICIENT_REMAINDER`** — the open parent lacked remaining
  conserved credit at admission time. Peer state can clear this: a sibling
  release returns credit to that parent, after which the identical request can
  succeed.
- **`RES_ACTIVE_CHILDREN`** — release was refused because the target still
  has an open child. Peer state can clear this too: the child releases, after
  which the identical request can succeed.

Every other code is `retriable: false`, without exception. That explicitly
and deliberately includes the two conflict codes:

- **`RES_VERSION_CONFLICT` is `false`.** The request carries
  `parent.expected_version`. A byte-identical re-issue asserts the same stale
  version against a parent that has already moved, so it cannot succeed no
  matter how many times or how long after it is retried. What can succeed is a
  *different* request carrying a re-read version — that is re-derivation by
  the caller, not retry of this request, and the field must not advertise it.
- **`RES_IDEMPOTENCY_CONFLICT` is `false`.** The idempotency key was already
  bound to different request content. A byte-identical re-issue reproduces
  exactly the conflicting content and is refused identically and permanently.

The governing test is therefore narrow and mechanical: `retriable: true` is
permitted only where a **byte-identical re-issue of the same request** could
later succeed because *peer* state changed. Where a byte-identical re-issue
can never succeed — because the caller must change the bytes, or because the
condition is a permanent truth violation — the value is `false`.

`fail_closed` stays `{"const": true}` for every code without exception,
including the two retriable ones. `retriable` is **advisory only**. It is a
caller hint about whether re-issuing the same bytes is meaningful, and it
grants nothing: no capacity, no reservation, no admission, no queue position
or priority, no authority, capability, permission, delegation, or approval,
and no relaxation of fail-closed handling. A `retriable: true` error is a
refusal exactly as complete as a `retriable: false` one.

This mapping changes existing fixture bytes and the writer must carry that
through: `positive/reservation-result.denied.json` carries
`RES_INSUFFICIENT_REMAINDER` with `retriable: false` today and **must become
`retriable: true`**, or the packet's own positive denial fixture contradicts
the mapping. `negative-schema/reservation-result.denied-with-reservation.json`
carries the same code and must also become `retriable: true`, so that it
remains invalid for its single intended reason — a denied result carrying a
reservation — rather than becoming invalid for two reasons at once.
`negative-schema/reservation-result.admitted-with-error.json` carries
`RES_RESULT_MISMATCH` with `retriable: false`, which the mapping already
agrees with, and its `error` object is unchanged.

Second, `cybrik.res-bounds-error.v1` is a public packet member whose binding
status is undeclared. The schema must carry an explicit standalone binding
declaration in its own `description`:

`cybrik.res-bounds-error.v1` **is the standalone failure document for every
`res-*` operation that has no dedicated result schema.** A refused
`res-release`, a refused `res-root-closure`, and a refused
`res-reservation-request` are all reported by binding this schema directly —
there is no
`res-release-result`, no `res-cancel-result`, and no per-operation error
schema, and §6.5 rejects creating any. `res-reservation-result` embeds this
schema by `$ref` **only because admission is all-or-nothing**: the admit/deny
outcome and its accounting deltas are one atomic result record, so the failure
travels inside that record instead of beside it. That embedding is the
exception, not the definition, and it must not be read as this schema's only
carrier.

The declaration must state the same boundary from the other side: this schema
is **never a ledger record**. It carries no `root`, no `sequence`, no
`virtual_time_ms`, and no `confers_authority`, and it is never admissible as a
replay event payload in its own right — a failure is reported about the ledger,
never entered into it. The declaration is proved by one positive fixture bound
directly to the schema and one negative-schema fixture whose `code` and
`retriable` contradict under the mapping above.

**B4 — dense sequence wording, denial evidence, and property coverage.**
Three closures, in wording, replay, and property proof respectively.

First, dense sequence wording. The `ledgerSequence` def describes the field
as a "Monotone accounting sequence within one root tree", but the replay
model compares `event.sequence` against a counter that starts at `1` and
increments by exactly `1`. The enforced rule is dense, not merely monotone.
The `ledgerSequence` description and `01-contract-semantics.md` must state
the rule the code actually enforces: within one root tree, sequences start at
`1` and increase by exactly `1`, with no gap, no repeat, and no reordering,
and a violation is `RES_SEQUENCE_VIOLATION`. This is wording only. The
numeric constraint stays `integer, minimum 1`, because density is a
cross-record property that a single-record schema cannot express, and that
limit must be stated in the wording rather than left implied.

The wording must also name what the dense rule implies rather than leaving a
reader to infer it: a dense sequence from `1` means **exactly one
serialization point per root tree**. Every record in a tree is ordered by a
single counter, so the v0.1 model admits no concurrent independent writers
within one root and no partitioned or per-branch sub-sequences. This is a
deliberate v0.1 limit, chosen because it makes replay total and reproducible
from fixture bytes alone, and it is recorded here so it is read as a bounded
choice rather than as an oversight or as a claim of concurrency support. It
is a contract-level statement only; no throughput, scaling, or runtime
concurrency claim is made or authorized anywhere in this amendment.

Second, denial evidence. The replay model treats every non-`admitted` result
inside a `reserve` event as `RES_RESULT_MISMATCH`, so a denied admission —
the outcome `01-contract-semantics.md` says leaves the parent version and
remainder unchanged — is unrepresentable in replay, and
`positive/reservation-result.denied.json` is schema-only. The replay model
must accept a `reserve` event whose result is `denied`, require that it
carries exactly one `RES_*` error and no reservation, assert that the
parent's version and remainder are unchanged across it, record the denial in
the trace, and continue the tree. `RES_SEQUENCE_VIOLATION` is likewise in the
enum but exercised by no fixture; a dense-sequence negative fixture closes
that.

Third, property coverage. The seeded synthetic-tree property test proves
conservation over admissions only, while the manifest's `evidence.L2` claims
a "synthetic-tree property proof". Under the same seeded deterministic
generator — no wall clock, no platform RNG, no network, no concurrency — the
property proof must be extended to cover release return-and-consume and
terminal root closure, so that the manifest claim is earned rather than
asserted.

### 6.3 Authorized path inventory

Exactly the paths below, and no others. Any path not listed here is outside
this amendment; touching one is a stop condition under G-W2H-6.

This inventory **supersedes** the exact scope recorded in §3.1 and §3.2 — the
six-schema and twenty-three-path new-artifact enumeration of §3.1, and the
ten-file existing-path list of §3.2 — but **only to the explicit extent of
§6.3**. §3.1 and §3.2 remain the governing record of R1 scope; every part of
them that §6.3 does not restate is unchanged and unreopened. In particular,
§6.3 adds one schema and nine fixtures to §3.1's enumeration and re-scopes
§3.2's existing-path list to exactly §6.3.3, and it grants nothing further:
the spent §3.2 integration-compatibility authorization is not reopened, and
the §3.1 paths §6.3 does not name keep their R1 bytes.

**6.3.1 New schema — exactly one.**

1. `contracts/json-schema/cybrik.res-root-closure.v1.schema.json`

**6.3.2 New fixtures — exactly nine.**

1. `contracts/examples/resource-bounds/positive/root-closure.completed.json`
2. `contracts/examples/resource-bounds/positive/bounds-error.standalone.json`
3. `contracts/examples/resource-bounds/positive/replay.denied-admission.json`
4. `contracts/examples/resource-bounds/negative-schema/root-closure.partial-closure.json`
5. `contracts/examples/resource-bounds/negative-schema/release.missing-root.json`
6. `contracts/examples/resource-bounds/negative-schema/bounds-error.retriable-mismatch.json`
7. `contracts/examples/resource-bounds/negative-semantic/replay.root-binding-mismatch.json`
8. `contracts/examples/resource-bounds/negative-semantic/replay.root-closure-accounting-mismatch.json`
9. `contracts/examples/resource-bounds/negative-semantic/replay.sequence-gap.json`

Fixture 1 is the single root closure record covering completion and
cancellation through the shared `closureReason` enum; fixture 4 proves that
`closes_descendants` cannot express partial or selective closure. Fixture 5
is one representative proof that an omitted `root` is rejected. The required
`root` on the other three non-grant records is proved positively by their own
fixtures and by manifest inventory rather than by three further omission
fixtures. That is a deliberate minimum-scope choice, recorded here so it is
not later mistaken for an oversight.

Fixture 2 is the B3 standalone binding proof: one `res-bounds-error` bound
directly to its own schema, not embedded in any result record. Fixture 6 is
its counterpart, a `code`/`retriable` pair that the B3 mapping makes
structurally invalid. One retriability negative fixture is sufficient because
the mapping is a single closed `if`/`then`/`else` composition; enumerating a
negative per code would add fourteen fixtures and prove nothing further. That
too is a deliberate minimum, not an omission.

**6.3.3 Existing paths that may be edited.**

Schemas — B2 `root`, B3 error mapping and declaration, B4 wording:

- `contracts/json-schema/cybrik.res-common-defs.v1.schema.json`
- `contracts/json-schema/cybrik.res-reservation-request.v1.schema.json`
- `contracts/json-schema/cybrik.res-reservation-result.v1.schema.json`
- `contracts/json-schema/cybrik.res-release.v1.schema.json`
- `contracts/json-schema/cybrik.res-bounds-error.v1.schema.json`

Fixture inventory and existing fixtures that carry a non-grant record or a
replay event:

- `contracts/examples/resource-bounds/examples-manifest.json`
- `contracts/examples/resource-bounds/positive/reservation-request.child.json`
- `contracts/examples/resource-bounds/positive/reservation-result.admitted.json`
- `contracts/examples/resource-bounds/positive/reservation-result.denied.json`
- `contracts/examples/resource-bounds/positive/release.completed.json`
- `contracts/examples/resource-bounds/positive/replay.conserved-tree.json`
- `contracts/examples/resource-bounds/negative-schema/reservation-request.zero-vector.json`
- `contracts/examples/resource-bounds/negative-schema/reservation-request.short-idempotency-key.json`
- `contracts/examples/resource-bounds/negative-schema/reservation-result.admitted-with-error.json`
- `contracts/examples/resource-bounds/negative-schema/reservation-result.denied-with-reservation.json`
- `contracts/examples/resource-bounds/negative-schema/release.missing-accounting.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.parent-overdraw.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.no-mint-spawn.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.tenant-mismatch.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.org-scope-mismatch.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.idempotency-conflict.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.double-release.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.over-return.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.parent-closed.json`
- `contracts/examples/resource-bounds/negative-semantic/replay.root-cancel-remint.json`

No fixture in that list may be deleted or renamed. `replay.root-cancel-remint`
keeps its path; only its event kind and payload change under B1.

Manifest, documentation, and tooling:

- `contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`
- `docs/adr/ADR-0012-resource-bounds-contract-profile.md`
- `docs/architecture/resource-bounds/README.md`
- `docs/architecture/resource-bounds/01-contract-semantics.md`
- `docs/architecture/resource-bounds/02-deterministic-replay-and-evidence.md`
- `tools/contract-validation/validate-resource-bounds.mjs`
- `tools/contract-validation/tests/validate-resource-bounds.test.mjs`

Within `docs/adr/ADR-0012-resource-bounds-contract-profile.md` the sites that
change are exactly three: the proposed-decision sentence adopting **six** JSON
Schema 2020-12 documents under `cybrik.res-*`, which becomes seven; the
**Contract members** list, which gains one entry for
`cybrik.res-root-closure.v1.schema.json`; and the sentence stating that the
compatibility manifest pins **the six schemas, the examples manifest, all 22
fixtures**, which becomes seven schemas and 31 fixtures.

The ADR's statement that `resourceVector` **contains exactly six nonnegative
integer credit dimensions**, and its enumeration of `cpu_millis`,
`memory_byte_millis`, `model_tokens`, `tool_calls`, `retrieved_bytes`, and
`egress_bytes`, is **explicitly preserved and must not change**. This
amendment adds a schema, not a resource dimension. The two sixes are unrelated
numbers that happen to coincide; a writer who raises the dimension count to
seven has silently altered the conserved vector, and that is a stop condition
under G-W2H-6, not a count reconciliation.

Catalog files whose stated counts or stated member inventory become false:

- `contracts/README.md` — the count in "six `cybrik.res-*` JSON Schemas".
- `contracts/json-schema/README.md` — this file states **no** schema count.
  It carries a per-schema inventory bullet list, so what becomes false there
  is the inventory, not a number: it gains exactly one bullet for
  `cybrik.res-root-closure.v1` and its one-line description.
- `contracts/examples/README.md` — the `6 positive, 7 negative-schema, and 9
  negative-semantic` fixture counts.
- `contracts/compatibility/README.md` — the count in "six `cybrik.res-*`
  schemas".

Those four may change only the count, the one added inventory bullet, and the
one-line description of the new member; every other byte stays.

Validator documentation — counts and the property-coverage sentence only:

- `tools/contract-validation/README.md`

Its `Gate W2-H resource-bounds proposal` paragraph states that the validator
compiles **six** JSON Schema 2020-12 documents, validates **6** positive,
rejects **7** negative-schema, and requires **9** negative-semantic replay
cases. All four become false, and become seven, 9, 10, and 12 respectively.
The same paragraph says the validator "runs seeded conservation properties over
synthetic trees", which B4 extends to release return-and-consume and terminal
root closure. Only those four counts and that property-coverage sentence may
change. The `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED` status line, the
static-L1/L2-only evidence disclaimer, the `npm run` script names, and every
other byte of that file stay.

**Inventory arithmetic, verified against repository bytes at the base above.**
The current compatibility manifest declares `member_count: 30`, and its
`members` and `member_digests` arrays each hold exactly 30 entries. Those 30
decompose as:

| Class | Current |
|---|---|
| `cybrik.res-*` schemas | 6 |
| fixtures | 22 |
| `examples-manifest.json` | 1 |
| compatibility manifest (self-member) | 1 |
| **total** | **30** |

The 22 current fixtures are 6 positive, 7 negative-schema, and 9
negative-semantic, matching the on-disk contents of
`contracts/examples/resource-bounds/` exactly.

This amendment adds exactly 1 schema (§6.3.1) and exactly 9 fixtures
(§6.3.2), and adds nothing else — no new manifest, no new document member.
So `30 + 1 + 9 = 40`. The 9 new fixtures are 3 positive, 3 negative-schema,
and 3 negative-semantic, giving `6 + 3 = 9` positive, `7 + 3 = 10`
negative-schema, and `9 + 3 = 12` negative-semantic, for 31 fixtures.

| Class | After |
|---|---|
| `cybrik.res-*` schemas | 7 |
| positive fixtures | 9 |
| negative-schema fixtures | 10 |
| negative-semantic fixtures | 12 |
| `examples-manifest.json` | 1 |
| compatibility manifest (self-member) | 1 |
| **total** | **40** |

Both columns are checked: `6 + 22 + 1 + 1 = 30` and
`7 + 9 + 10 + 12 + 1 + 1 = 40`. After this amendment the packet therefore has
seven `cybrik.res-*` schemas and forty members. If a writer's recomputed
`member_count` is not exactly forty, or the fixture split is not exactly
9/10/12, the scope has drifted and that is a stop condition under G-W2H-6 —
not a number to adjust.

This decision record is the only additional path.

**6.3.4 Explicitly not authorized, and not needed.**

- `contracts/json-schema/cybrik.res-bounds-grant.v1.schema.json`,
  `contracts/examples/resource-bounds/positive/bounds-grant.root.json`,
  `contracts/examples/resource-bounds/negative-schema/bounds-grant.authority-token.json`,
  and
  `contracts/examples/resource-bounds/negative-schema/bounds-grant.empty-vector.json`
  — the grant is the root and takes no `root` property, so its bytes and
  digests are unchanged.
- `docs/adr/README.md` — the ADR-0012 row and the W2-H catalog paragraph stay
  true and byte-identical. W2-I's additive-byte test pins that file's added
  hunks exactly, and R2 has no reason to disturb them.
- `docs/architecture/README.md` — its `resource-bounds/` entry names the
  directory's subject and its `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`
  status and states no schema, member, or fixture count, so it stays true and
  byte-identical after B1–B4. R1 §3.2 permitted editing it; R2 neither needs
  nor authorizes it. The documents *inside*
  `docs/architecture/resource-bounds/` are authorized by §6.3.3; that
  authorization does not reach this catalog entry.
- `tools/contract-validation/validate.mjs`,
  `tools/contract-validation/package.json`,
  `tools/contract-validation/tests/validate-transport.test.mjs`, and
  `.github/workflows/contracts.yml` — the validator is already registered,
  the orchestrator banner already names W2-H as `PROPOSED / NOT ACCEPTED`,
  the step count is unchanged, and the required-check allowlist is unchanged.
  The §3.2 integration-compatibility authorization is spent and is not
  reopened here.
- Every accepted member and every `ACCEPTED_DEPENDENCY_PINS` file. Drift
  there is a hard stop, not a rebase.

### 6.4 Mandatory integrity recomputation

Digests are part of the contract, not decoration. Because B1–B4 change schema
and fixture bytes, the writer must recompute, in this order and by the rules
already recorded in the manifest:

1. every fixture `sha256` in
   `contracts/examples/resource-bounds/examples-manifest.json`;
2. every non-manifest `member_digests[].sha256` in the compatibility
   manifest, from the exact on-disk UTF-8 bytes;
3. `member_count`, raised to forty, and the `members` inventory;
4. the compatibility-manifest self digest, by the recorded
   `self_digest_rule` over the parsed manifest with the complete top-level
   `x-cybrik-packet-integrity` key deleted; and
5. `aggregate_sha256`, by the recorded `aggregate_rule`.

No digest may be hand-edited to make a check pass, and no digest rule may be
weakened, reordered, or made circular. A digest that cannot be reproduced
from the on-disk bytes is a stop condition.

### 6.5 Explicit rejections

The following were considered and are rejected. They are not deferred, not
partially authorized, and not to be reintroduced by a writer under a
different name.

- **A separate `cybrik.res-release-result.v1` schema.** Rejected. Release is
  already terminal and self-accounting; a result record would create a second
  place where release truth lives and a second thing to keep consistent.
- **A separate `cybrik.res-cancel-result.v1` schema.** Rejected. B1's single
  `cybrik.res-root-closure.v1` covers completion and cancellation through one
  shared `closureReason` enum precisely so that the two paths cannot drift.
  Splitting them re-opens the drift this amendment closes.
- **Any additional schema beyond the one authorized in §6.3.1.** The packet
  goes from six schemas to seven, not eight, and from thirty members to
  forty, not more.
- **Any new `RES_*` error code.** B1 reuses
  `RES_RELEASE_ACCOUNTING_MISMATCH` and B2 reuses `RES_PARENT_NOT_FOUND`. The
  enum stays at the existing fifteen codes.
- **Relaxing the dense sequence, or adding a second serialization point.**
  Sparse, per-branch, partitioned, or concurrently-issued sequences within one
  root tree are rejected. One serialization point per root and a dense
  sequence from `1` are the deliberate v0.1 limit stated in B4; a writer may
  document that limit but may not widen it here.
- **`expected_version` on `rootRef`, or any other compare-and-set field on
  it.** Rejected under B2: it would create a second concurrency axis. `rootRef`
  is `kind` and `id` only.
- **Any third `retriable: true` code, and any `fail_closed: false` value.**
  Only `RES_INSUFFICIENT_REMAINDER` and `RES_ACTIVE_CHILDREN` may be
  retriable; `fail_closed` is `{"const": true}` for all fifteen codes.
  Reading `retriable` as capacity, priority, admission, or authority is
  rejected outright — it is advisory and grants nothing.
- **Runtime, adapters, services, or product code** in any repository.
- **OpenAPI, AsyncAPI, or MCP surfaces** of any kind.
- **Work inside `cybrik-soc-command-center`, `cybrik-security-tool-fabric`,
  or `cybrik-cyber-ai-platform`.** This amendment is Suite-owned contract
  bytes only.
- **Any mapping, rename, extension, or deprecation** of the accepted
  investigation `budget` object, `budget_exceeded`, `BUDGET_*`,
  `over_input_budget`, `over_output_budget`, or
  `fallbackInfo.reason = "budget"`. §4 stands unchanged.
- **Wall clock, network, concurrency, service, container, database, broker,
  or product runtime as evidence.** G-W2H-4 stands unchanged.

### 6.6 Authority this amendment does not grant

This is a write-scope amendment. It is not an approval of the resulting
bytes.

- **No acceptance.** ADR-0012 and every packet member remain
  `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED` at `0.1.0`, not a bundle tag.
  `cybrik.res-root-closure.v1` is born proposed and unaccepted like its six
  siblings.
- **No commit, no push, no branch merge, no canonical merge, no release, no
  tag.** Those remain governed by G-W2H-6 and require, unchanged, exact
  bounded scope, focused and aggregate tests green, dependency audit and
  required hosted checks green, independent review with no open P0/P1/P2, and
  a clean base relationship to canonical `main`.
- **No W0-T11 movement.** W0-T11 measurement remains
  `HOLD until real vertical exists`. B1–B4 produce no runtime, integration,
  UAT, release, deployment, production, T10, or T11 evidence, and a green
  validator after this hardening is static L1/L2 conformance only.
- **No release-date or milestone change.** §5 stands: the `2026-12-20`
  Founder stable-v1.0 go/no-go and the `2026-12-21 → 2026-12-31` window are
  untouched, and Gate W2-H is still not `G-C`.
- **No Founder-only authority.** Repository/top-level-directory changes,
  production anything, credentials, secrets, keys, identity-provider changes,
  history rewriting, force-push, additional remotes, dependency installation,
  migrations, and formatters/auto-fixers are all still Founder-only.

### 6.7 Basis provenance and independent byte evidence

The session-local adjudication instrument named in the §6 basis is a
governance instrument rather than a repository artifact, and it is not itself
committed here. Its controlling conclusions were supplied to this amendment
and are transcribed above: B1 as previously recorded, and B2, B3, and B4 as
stated in §6.2, including the `rootRef` shape, the two-code retriability
mapping, the standalone-failure-document declaration for `res-bounds-error`,
and the dense-sequence and single-serialization-point limit. §6.2 is the
controlling text of those conclusions for this write.

Each conclusion is additionally and independently evidenced in the packet
bytes at the base above, so this amendment does not rest on the instrument
alone:

- **B2** — none of `res-reservation-request`, `res-reservation-result`, or
  `res-release` has any root-naming property in its `required` list, and
  `res-common-defs` has a `parentRef` def but no `rootRef` def.
- **B3** — `res-bounds-error` declares `"retriable": { "const": false }`
  against a fifteen-value `code` enum, so the field is information-free, and
  the schema's `description` makes no binding statement; `res-bounds-error` is
  `$ref`-embedded by `res-reservation-result` and by no other schema.
- **B4** — `ledgerSequence` is described as a "Monotone accounting sequence
  within one root tree" while the replay model compares `event.sequence`
  against a counter starting at `1` and incrementing by exactly `1`.
- **Inventory** — the compatibility manifest declares `member_count: 30`,
  decomposing as verified in §6.3.3.

The design facts above were read from the packet at the stated base. If the
instrument's B1–B4 differ from what is written here, or if the packet bytes at
write time differ from the facts recorded above, **this section governs the
write** and the divergence is a stop condition under G-W2H-6, to be raised
before any further byte is written — not silently reconciled.
