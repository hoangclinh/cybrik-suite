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

## 7. R3 amendment — bounded C1–C4 replay-truth hardening

- **Amendment date:** 2026-08-01 (`Asia/Ho_Chi_Minh`)
- **Decider:** Codex Governor under
  `docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`
- **Amendment identity:** `W2-H/R3`
- **Base:** `848af23` — the canonical tip after the R2 hardening write, at which
  the packet carries seven `cybrik.res-*` schemas, 31 fixtures (9 positive, 10
  negative-schema, 12 negative-semantic), and `member_count: 40`.
- **Basis:** a read-only acceptance-readiness audit of the R2 packet, a
  session-local governance instrument rather than a repository artifact. Its
  controlling conclusions are adopted below as findings C1–C4. Every design
  fact stated in §7.2 was additionally checked against the packet bytes at the
  base above; §7.7 records that independent byte evidence.
- **Precedent:** this follows the same bounded-amendment mechanism already
  recorded in §3.2 and §6.

C1–C4 are replay-truth findings. Each names a place where the packet's replay
model accepts a ledger it should refuse, so that a green validator overstates
what the fixtures prove. R3 closes exactly those four and nothing else. It also
**discloses, without closing**, one adjacent limit it cannot reach: the
`RES_ACTIVE_CHILDREN` retriability claim, recorded in §7.2 C3. Disclosure is
not closure, and §7.6 still grants no acceptance.

### 7.1 Preserved invariants (unchanged by this amendment)

- The contract lifecycle ceiling remains
  `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`, pre-v1 `0.1.0`, not a bundle
  tag. This amendment accepts nothing, and `0.1.0` does not move.
- W0-T11 measurement remains `HOLD until real vertical exists`. Nothing in
  C1–C4 is runtime, integration, UAT, release, deployment, production, T10, or
  T11 evidence; a green validator after this hardening remains static L1/L2
  conformance only.
- G-W2H-1 through G-W2H-6, §4 vocabulary boundary, and §5 release/production
  boundary remain in force verbatim. The stop conditions of G-W2H-6 apply to
  this amendment's work.
- §6.1 through §6.7 remain in force. R3 supersedes no R2 decision: the
  `res-root-closure` record, the `rootRef` shape without `expected_version`,
  the two-code retriability mapping, the standalone-failure-document
  declaration, the dense sequence, and the single serialization point per root
  all stand exactly as recorded. R3 constrains replay further; it relaxes
  nothing.
- The four `ACCEPTED_DEPENDENCY_PINS` and every accepted-member byte remain
  untouchable; any drift there is a hard stop.
- The `resourceVector` remains **exactly six** nonnegative integer credit
  dimensions — `cpu_millis`, `memory_byte_millis`, `model_tokens`,
  `tool_calls`, `retrieved_bytes`, `egress_bytes`. R3 adds no dimension.
- The `res-bounds-error` `code` enum and the validator's `REPLAY_ERROR_CODES`
  keep identical membership at **fifteen** codes, and the packet keeps
  **seven** schemas. **C1–C4 mint no new `RES_*` code and no new schema.**

### 7.2 Authorized hardening content

Exactly the following design deltas are authorized, and no others. Each is
expressed in terms of codes that already exist:
`RES_RELEASE_ACCOUNTING_MISMATCH`, `RES_SEQUENCE_VIOLATION`,
`RES_VIRTUAL_TIME_ROLLBACK`, `RES_RESULT_MISMATCH`, and
`RES_IDEMPOTENCY_CONFLICT`. C3 and C4 additionally **restate, without
changing**, the existing pre-admission checks and the codes they already carry
— among them `RES_VERSION_CONFLICT`, `RES_PARENT_NOT_FOUND`,
`RES_PARENT_CLOSED`, and `RES_ROOT_CLOSED`. Restating an existing check is not
a delta; no restated check moves, is reordered, or changes its code.

**C1 — closure settlement bound to the replay ledger.** R2 reconciles a root
closure only against the sum: `final_consumed + final_unused` must equal the
closing grant's original `bounds`. That leaves the *split* free. A ledger that
consumed nothing may declare any consumed/unused pair summing to `bounds` and
replay accepts it, so the packet's closure record proves an arithmetic
identity rather than a settlement.

The replay model must instead derive both halves from the ledger it has
already validated, and compare, dimension by dimension, before the closure is
applied:

- `final_consumed[d]` equals the accumulated `consumed[d]` of every release
  the replay has already validated in this tree — the running consumption
  total, zero if no release has occurred;
- `final_unused[d]` equals the closing root's `remaining[d]` **plus** the
  `remaining[d]` of every still-open reservation in the tree, taken at the
  state immediately before closure; and
- `final_consumed[d] + final_unused[d]` equals the closing grant's original
  `bounds[d]`.

Only then is the closure applied: the root's remaining becomes the zero vector,
the root closes, and every still-open descendant is closed with zero remaining
— the R2 behaviour, unchanged. Any of the three comparisons failing is
`RES_RELEASE_ACCOUNTING_MISMATCH`, fail-closed, the same code the release path
and the R2 closure reconciliation already use for this class of conservation
failure.

A **cancelled** closure derives its split by exactly this rule; the closure
reason is not an input to the arithmetic. Credit still held by a reservation
that is open at the moment of cancellation was never spent, so it belongs to
`final_unused` and never to `final_consumed`, and closure extinguishes it —
returned to nobody, banked nowhere, re-minted never, exactly as §6 and the
existing `Root closure` wording already record for the root's own remainder.
The packet's worked instance is `replay.root-cancel-remint.json`, a
negative-semantic ledger whose failing event is the post-closure re-mint: its
`cancelled` closure event is validated before that failure, declares zero
consumed, and declares a `final_unused` that is the root's remainder plus the
still-open reservation's remainder. It settles exactly under the split above
and must not be edited.

Under C1 the sum equality becomes a **corollary** of the two split equalities
rather than an independent rule, because credit in a tree is either consumed by
a validated release, still held as root remainder, or still held by an open
reservation, and those three are disjoint and exhaustive. It is retained as an
explicit third comparison so the invariant stays legible in the model and in
the wording, not because it adds strength.

**This is deterministic contract-credit accounting, not physical runtime
measurement.** `final_consumed` is the sum of credits that ledger records
declared consumed; it is not CPU sampled from a scheduler, memory sampled from
an allocator, bytes counted on a socket, or tokens counted by a model runtime.
`final_unused` is the credit the ledger never spent, not idle capacity observed
anywhere. Nothing in C1 measures, meters, samples, or observes a running
system, and nothing in it may be cited as T10 or T11 evidence, as a latency or
resource baseline, or as a claim that the accounting has ever been compared
against a physical quantity. That comparison would be runtime work and is
`NOT AUTHORIZED` here.

**C2 — envelope and nested-record ordering must agree.** Today the replay
model checks `event.sequence` against a dense counter and `event.virtual_time_ms`
against the previous event's, and never looks at the `sequence` or
`virtual_time_ms` carried *inside* the payloads. A public record may therefore
name a ledger position it does not occupy, and the packet's own claim that
these are replay/accounting fields is unproved for every nested record.

The replay model must require, for every event, that each nested public record
carries exactly the envelope's `sequence` and exactly the envelope's
`virtual_time_ms`:

- `grant` — the grant payload;
- `reserve` — **both** the request and the result. A reserve event is one
  **atomic admission result group**: the request and the result it produced are
  a single admission outcome recorded at a single ledger position, exactly as
  R2 §6.2 B3 records that admission is all-or-nothing. They therefore share one
  `sequence` and one `virtual_time_ms`, and a disagreement *between* them is a
  violation as much as a disagreement with the envelope;
- `release` — the release payload;
- `root-closure` — the closure payload.

The dense per-root envelope order is unchanged and restated: within one root
tree the order starts at `1` and increases by exactly `1`, with no gap, no
repeat, and no reordering, and there is exactly one serialization point per
root tree. The dense envelope check runs first, so a ledger that both skips a
position and misreports it inside a payload still fails on the dense rule.

The exact code rule, in evaluation order, is:

1. envelope `sequence` not equal to the expected dense counter →
   `RES_SEQUENCE_VIOLATION` (unchanged);
2. envelope `virtual_time_ms` not an integer, or earlier than the previous
   event's → `RES_VIRTUAL_TIME_ROLLBACK` (unchanged);
3. any nested `sequence` not equal to the envelope `sequence` →
   `RES_SEQUENCE_VIOLATION`;
4. any nested `virtual_time_ms` **earlier than** the envelope
   `virtual_time_ms` → `RES_VIRTUAL_TIME_ROLLBACK`;
5. any nested `virtual_time_ms` **later than** the envelope
   `virtual_time_ms` → `RES_RESULT_MISMATCH`.

Rules 4 and 5 split one inequality across two codes, and the justification is
exact rather than stylistic. `RES_VIRTUAL_TIME_ROLLBACK` is this packet's code
for virtual time running **backwards** relative to a position replay has
already established. A nested record stamped earlier than the envelope that
admits it asserts that time went backwards inside a single ledger position;
that is the same failure the envelope-level check names, observed one level
down, and it takes the same code. A nested record stamped **later** than its
envelope is not time running backwards — nothing is being un-ordered. It is a
record field that fails to equal the replayed state that produced it, which is
precisely the class `RES_RESULT_MISMATCH` already covers for `request_id`,
`parent_version_before`, `parent_version_after`, and `parent_remaining_after`.
Sequence takes no such split: `sequence` is a pure ordering field whose only
failure mode is ordering, in either direction, so both directions are
`RES_SEQUENCE_VIOLATION`.

This **intra-position** reading of `RES_VIRTUAL_TIME_ROLLBACK` — virtual time
running backwards *inside* a single ledger position, not only between two
consecutive positions — widens what the code means for anyone reading the
packet. That is contract meaning, not a note about one validator, so it must be
written into the authorized documents named in §7.3.3 and must not be left
standing only in this decision record. A code whose enforced meaning is wider
than the packet's own wording states is a status-honesty failure of the same
kind C4 repairs.

**C3 — a denial must be justified by the replay state.** R2 made a denied
admission representable, which was correct, but the model accepts *any*
`denied` result carrying *any* `RES_*` code. A ledger may therefore deny a
request the state would have admitted, or deny an inadmissible request under
the wrong code, and replay still goes green. The denial path proves the shape
of a denial and not its truth.

The replay model must derive the denial from the state it holds at the
admission point, after the tenant, org-scope, root-binding, idempotency,
parent-existence, parent-open, and expected-version checks have passed:

- the request is **inadmissible** exactly when its `requested` vector exceeds
  the parent's `remaining` in at least one dimension;
- a `denied` result for an **admissible** request is `RES_RESULT_MISMATCH` —
  the ledger claims a refusal the state does not justify;
- a `denied` result for an inadmissible request must carry exactly the code the
  state implies, which at this evaluation point is exactly
  `RES_INSUFFICIENT_REMAINDER`; any other code is `RES_RESULT_MISMATCH`;
- the R2 requirements are preserved unchanged: exactly one `RES_*` error, no
  reservation, `parent_version_before` and `parent_version_after` both equal to
  the parent's current version, `parent_remaining_after` equal to the parent's
  current remainder, matching `request_id`, the denial recorded in the trace,
  and the tree continuing from the untouched state.

`RES_INSUFFICIENT_REMAINDER` is the only denial code derivable at this point
**by construction**, and that is a deliberate v0.1 boundary, not an omission.
A record presented against a missing parent, a closed parent, a closed root, a
foreign root, or a stale expected version does not describe an admission
outcome — it falsifies the ledger, and replay refuses the whole case at those
earlier checks with the code each already carries.

`RES_ACTIVE_CHILDREN` is a release refusal and is not a reserve outcome at all,
so no reserve path can derive it and C3 does not make it derivable. It
therefore stays a **declared but unproved** v0.1 retriability claim, and this
amendment must not be read as closing it. The reason is structural: the release
record carries no idempotency key and has no result document, so the packet
offers no carrier in which a retried release could be presented, matched
against a prior refusal, and replayed. The canonical reserve identity C4
introduces proves R2 §6.2 B3's retriability rationale for
`RES_INSUFFICIENT_REMAINDER` **only**. For `RES_ACTIVE_CHILDREN` the schema's
`if`/`then` mapping, the `01-contract-semantics.md` sentence, and the
compatibility manifest's `error_retriability` note continue to assert
retriability that no fixture and no replay case demonstrates. Supplying the
missing carrier — a release idempotency key, a release result document, or a
retried-release replay path — is a record-shape and schema change, rejected in
§7.5 and already rejected in §6.5, and left to separately authorized work. R3
records this gap; it does not close it, and no wording written under R3 in any
schema, fixture, manifest, document, or comment may imply that it has been
closed.

Widening the denial-code derivation is rejected in §7.5.

**C4 — denial idempotency, and what "the same request" means.** Today the
idempotency map is written **only on admission**. A denied request binds
nothing, so its key is free: the same key may return later carrying entirely
different content and replay accepts it, and R2's own justification for
`RES_INSUFFICIENT_REMAINDER` being retriable — that a sibling release lets the
same request succeed — is asserted by no fixture.

The replay model must bind the key on denial as well as on admission, over a
**canonical idempotent request identity**. That identity is the request with
exactly three fields excluded:

- `sequence` and `virtual_time_ms` — ledger-position fields. C2 already pins
  both to the envelope, so they describe *where* the request was recorded, not
  *what* was requested; and
- `parent.expected_version` — the optimistic-concurrency assertion, re-read at
  issue time.

Everything else is bound exactly: `idempotency_key`, `request_id`,
`tenant_id`, `org_scope_ref`, `root`, `parent.kind`, `parent.id`, the
`requested` vector, and `confers_authority`. The rules are:

- **Exclusion from the identity is not exemption from validation.** A re-issued
  event is an ordinary ledger event and every existing check still applies to
  it. Its envelope and nested `sequence` and `virtual_time_ms` must agree under
  C2, and its `parent.expected_version` must equal the parent's **current**
  version at that point in the replay. Where that check runs must be stated
  exactly, because C4 does not merely preserve the placement R2 gave it. Under
  R2 an already-bound key **short-circuits**: replay compares the request and
  result digests against the binding and continues to the next event, so an
  identity-matching re-issue never reaches the version check at all. C4 removes
  that bypass for every identity-matching re-issue, so the check becomes a
  **new guard on a path R2 did not route through it**. Its order relative to
  the other reserve-path checks is unchanged — after the tenant, org-scope,
  root-binding, and idempotency-lookup steps, after parent existence and
  parent-open, and **before** any admissibility, denial, or result
  comparison — which is exactly the order R2 already applies to a first
  presentation. What changes is coverage, not order: a retry asserting a stale
  version now fails `RES_VERSION_CONFLICT` and never reaches the denial,
  admission, or result rules below, where R2 would have accepted it as an
  idempotent replay. A writer must not record this as an unchanged check.
  Excluding `parent.expected_version` from the identity is what lets replay
  recognize the *same request* across a version change; it is not permission to
  re-present a stale assertion.
- **Mutation is refused.** An event whose key is already bound but whose
  canonical identity differs in any bound field is `RES_IDEMPOTENCY_CONFLICT`,
  whether the prior binding was denied or admitted. This is R2's rule, extended
  to denials.
- **A repeat denial must still be true.** When the binding is `denied` and the
  identity matches, the request is re-evaluated against the *current* state
  under C3. A repeated `denied` result is permitted only when the state still
  makes it inadmissible **and** its code equals the code that current state
  implies; a stale denial re-presented after the state has changed is
  `RES_RESULT_MISMATCH`.
- **Peer state may clear a denial.** When the binding is `denied`, the identity
  matches, and the state now admits the request — because a sibling release
  returned credit to the parent — the event must present a correct `admitted`
  result and is admitted normally, drawing the parent down exactly as a first
  admission would. The binding is replaced by an admitted binding.
- **Admitted is final.** Once the binding is `admitted`, a later
  identity-matching event is an idempotent replay: it changes no state and
  re-draws nothing, and its result must reproduce the recorded original
  admitted result under the **admitted result projection**. That projection is
  the original `reservation-result` with exactly two fields removed —
  `sequence` and `virtual_time_ms` — and every remaining field reproduced
  literally: `request_id`, `status`, `root`, the whole `reservation` object
  (`reservation_id`, `reserved`, `remaining`, `state_version`, `status`),
  `parent_version_before`, `parent_version_after`, `parent_remaining_after`,
  and `confers_authority`; `error` is absent on an admitted result and must
  stay absent. The comparison is against the **recorded original**, not against
  a recomputation from current state: `parent_version_after` and
  `parent_remaining_after` restate what the first admission produced and are
  not re-derived, and that is precisely what makes the replay idempotent rather
  than a second admission. Any field of the projection differing, and any
  regression from `admitted` back to `denied`, is `RES_RESULT_MISMATCH`.
  Excluding `sequence` and `virtual_time_ms` from the projection leaves neither
  field unchecked and relaxes no authority or integrity claim: C2 binds both
  **independently**, requiring each nested record's `sequence` and
  `virtual_time_ms` to equal its own envelope's. They are excluded here only
  because the re-issue occupies a *different* ledger position from the original
  admission, so comparing them against the recorded original would demand that
  two distinct positions carry identical position fields — a contradiction of
  the dense sequence rule, not a check. Every field the projection excludes is
  therefore still constrained, by the envelope it belongs to rather than by the
  record it replays, and the two rules together leave no field of an
  identity-matching admitted result unconstrained.

The three exclusions are forced, and the writer must record why rather than
quietly widening them. A release that returns credit to a parent increments
that parent's version. A re-issue that is identical in *every literal byte*
therefore asserts a stale `parent.expected_version` and can only ever fail
`RES_VERSION_CONFLICT` — which would make the denied-to-admitted transition
unrepresentable and would leave R2 §6.2 B3's retriability rationale for
`RES_INSUFFICIENT_REMAINDER` permanently unprovable. Excluding the positional
and concurrency fields is what makes that rationale true, and it is consistent
with R2's own distinction: for `RES_INSUFFICIENT_REMAINDER` the **cause** is
the remainder, which peer state clears without the caller changing the
substance of the request, whereas for `RES_VERSION_CONFLICT` the cause **is**
the version field, so correcting it changes the assertion itself and no peer
state can make the original assertion true.

This is a wording reconciliation, not a change to the mapping. The retriability
mapping stays at exactly two `true` codes, `fail_closed` stays
`{"const": true}` for all fifteen, the `if`/`then`/`else` composition is
untouched, and no enum member moves. The only **schema** byte that changes is
the `retriable` **description** sentence in
`cybrik.res-bounds-error.v1.schema.json`. But the "byte-identical re-issue"
phrasing is a canonical-intent claim the packet makes at **three** sites, and
all three must move together to the canonical identity above:

1. the `retriable` `description` in
   `contracts/json-schema/cybrik.res-bounds-error.v1.schema.json`;
2. the **Error reporting** sentence in
   `docs/architecture/resource-bounds/01-contract-semantics.md`; and
3. `authority_model.error_retriability` in
   `contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`,
   which repeats the same phrase and is itself a pinned packet member.

Leaving any of the three as it stands would make the packet contradict itself
once C4 lands, which is a status-honesty failure, not a cosmetic one. Missing
the third would additionally leave the packet's own compatibility declaration —
the artifact a consumer reads first — stating a rule the schema no longer
states.

One occurrence of the phrase is deliberately **retained**.
`contracts/examples/resource-bounds/negative-schema/bounds-error.retriable-mismatch.json`
carries the message "A byte-identical re-issue asserts the same stale version
and can never succeed." That sentence is about `RES_VERSION_CONFLICT`, where a
literal-byte re-issue genuinely can never succeed because the cause **is** the
version field — it is the same reasoning C4 relies on above, not the superseded
canonical-intent claim, and the fixture's purpose is its `retriable: true`
mismatch rather than its message. It stays true after C4. That fixture stays
byte-identical and digest-unmoved, and a writer who "reconciles" it has edited
an unauthorized fixture and drifted scope under G-W2H-6.

### 7.3 Authorized path inventory

Exactly the paths below, and no others. Any path not listed here is outside
this amendment; touching one is a stop condition under G-W2H-6.

This inventory **supersedes** §3.1, §3.2, and §6.3 **only to the explicit
extent of §7.3**. §3.1, §3.2, and §6.3 remain the governing record of R1 and R2
scope; every part of them §7.3 does not restate is unchanged and unreopened. In
particular, the spent §3.2 integration-compatibility authorization is not
reopened, and every R1/R2 path §7.3 does not name keeps its bytes at the base
above.

**7.3.1 New schemas — exactly none.**

R3 authorizes **no new schema**. The packet stays at seven `cybrik.res-*`
schemas. C1–C4 are cross-record replay rules that a single-record schema cannot
express, exactly as R2 recorded for sequence density.

**7.3.2 New fixtures — exactly five.**

1. `contracts/examples/resource-bounds/positive/replay.denied-then-admitted.json`
2. `contracts/examples/resource-bounds/negative-semantic/replay.closure-settlement-split-mismatch.json`
3. `contracts/examples/resource-bounds/negative-semantic/replay.record-sequence-mismatch.json`
4. `contracts/examples/resource-bounds/negative-semantic/replay.denial-unjustified.json`
5. `contracts/examples/resource-bounds/negative-semantic/replay.denial-idempotency-conflict.json`

Fixture 1 is the single new positive ledger and carries the whole positive path
of C1–C4 in one deterministic tree: an admission; a denial that the state
justifies; a sibling release that returns credit; the same canonical request
re-issued — carrying the parent's **current** `expected_version`, as C4
requires — and now **admitted**; one further identity-matching event whose
result reproduces the admitted result projection exactly, proving admission is
final under idempotent replay; and a terminal root closure
whose `final_consumed` is nonzero and whose `final_unused` is the sum of the
root's remainder **and** a still-open reservation's remainder, so both terms of
the C1 split are exercised rather than one. Its envelope and nested `sequence`
and `virtual_time_ms` agree at every event, so it is also the positive proof of
C2. Carrying all four in one fixture is forced by the findings themselves, not
by the fixture count: C1's split needs a validated release and a still-open
reservation in the same tree that later closes, C4's denied-to-admitted
transition needs a denial that a *sibling* release in that same tree clears,
C3's justified denial is the first half of that transition, and C2 holds at
every event of whatever ledger carries them. That is one causal chain in one
root tree, and the dense sequence rule and single serialization point per root
mean it cannot be split across ledgers without duplicating the tree and proving
strictly less. The positive count is one because the proof is one tree, not the
other way round.

Fixtures 2–5 are one negative per finding, each structurally valid and failing
exactly one named invariant, matching the packet's existing negative-semantic
discipline:

- fixture 2 — a ledger whose closure sum equals `bounds` but whose split
  contradicts the validated releases and the pre-closure remainders;
  `RES_RELEASE_ACCOUNTING_MISMATCH`;
- fixture 3 — a nested public record whose `sequence` disagrees with its
  envelope while the dense envelope order is intact, so the failure is the C2
  nested rule and not the pre-existing dense rule;
  `RES_SEQUENCE_VIOLATION`. It is distinct from
  `replay.sequence-gap.json`, which fails the envelope counter;
- fixture 4 — a `denied` result for a request the state would have admitted;
  `RES_RESULT_MISMATCH`;
- fixture 5 — a key bound by a denial and then reused with a mutated canonical
  identity; `RES_IDEMPOTENCY_CONFLICT`.

Several C2/C3/C4 branches are deliberately **not** given fixtures of their own:
a nested `virtual_time_ms` on the wrong side of its envelope, in each
direction; a denial carrying a code the state does not imply; a stale denial
re-presented after the state has changed; a retry asserting a stale
`parent.expected_version`; and an identity-matching event whose result breaks
the admitted result projection. Each is proved by an in-memory case in the
focused test file, which already builds inline replay cases for exactly this
purpose. That is a deliberate minimum-scope choice — recorded here so it is not
later read as an oversight — and it is why the fixture count is five rather
than one fixture per branch.

**7.3.3 Existing paths that may be edited.**

Schema — the C4 wording reconciliation only:

- `contracts/json-schema/cybrik.res-bounds-error.v1.schema.json` — the
  `retriable` **description** sentence only. The `code` enum, the fifteen
  members, the `if`/`then`/`else` retriability composition, the two `true`
  codes, `fail_closed: {"const": true}`, the standalone-binding declaration in
  the schema `description`, and every other byte stay.

The other six schemas are **not** authorized and are not needed: C1–C4 are all
cross-record rules.

Existing fixture whose R2 free split must change:

- `contracts/examples/resource-bounds/positive/root-closure.completed.json` —
  this is the one existing closure fixture whose split is free under R2. It
  declares `final_consumed` and `final_unused` that sum to a root's bounds but
  settle no ledger in the packet: its vectors coincide with
  `replay.conserved-tree.json` while its `state_version_before` /
  `state_version_after` are reachable from no replayed state, and it names that
  ledger's root grant identifier. Under C1 a settlement that settles nothing is
  exactly the gap being closed. It must become **byte-identical to the payload
  of the terminal `root-closure` event of
  `positive/replay.denied-then-admitted.json`**, so the packet holds one
  settlement rather than two that disagree, and the focused test must assert
  that byte identity. Its `reason` stays `completed`.

Fixture inventory:

- `contracts/examples/resource-bounds/examples-manifest.json` — the five new
  fixture registrations and every fixture `sha256`.

No other existing fixture is authorized, and none is needed. Every existing
replay fixture was checked against C1–C4 at the base above and already
conforms: each nested `sequence` and `virtual_time_ms` already equals its
envelope; `replay.denied-admission.json`'s denial is already justified by its
state and already carries `RES_INSUFFICIENT_REMAINDER`;
`replay.idempotency-conflict.json`'s two requests already differ in bound
identity fields (`request_id` and `requested`) and so still conflict under the
canonical identity; `replay.root-cancel-remint.json` — a negative-semantic
ledger whose declared failure is its post-closure re-mint — carries a closure
event that replay validates before that failure and that already settles its
ledger exactly under the C1 split, including the open reservation's remainder;
and `replay.root-closure-accounting-mismatch.json` still fails, with the same
declared code, under the C1 split as it did under the R2 sum, now refused at
the derived-consumed comparison. No fixture may be deleted or renamed.

Manifest, documentation, and tooling:

- `contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`
- `docs/adr/ADR-0012-resource-bounds-contract-profile.md`
- `docs/architecture/resource-bounds/01-contract-semantics.md`
- `docs/architecture/resource-bounds/02-deterministic-replay-and-evidence.md`
- `tools/contract-validation/validate-resource-bounds.mjs`
- `tools/contract-validation/tests/validate-resource-bounds.test.mjs`

Within
`contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`
the authorized sites are three groups and no others.

The first group is `authority_model.error_retriability`, the third
canonical-intent site of C4: it repeats the superseded "byte-identical
re-issue" phrase and must state the canonical identity instead, while keeping
its two `true` codes, its "grants no capacity, admission, queue position,
priority, or authority" clause, and its `fail_closed` statement.

The second group is `resource_model.closure` and `resource_model.sequence`.
Each is a **bounded wording update** that makes an existing field state the
rule the packet will actually enforce, and nothing more:

- `resource_model.closure` today states that at closure `final_consumed` plus
  `final_unused` equals the closing grant's original bounds. C1 keeps that
  equality true as a corollary, but leaving the field there would have the
  packet's own compatibility declaration state the weaker of the two rules
  replay enforces — underclaiming by silence, the failure §7.2 exists to
  prevent. It must additionally state that both halves are derived from the
  validated ledger: `final_consumed` from the accumulated `consumed` of every
  release the replay has already validated in the tree, and `final_unused` from
  the closing root's remainder plus the remainder of every still-open
  reservation taken immediately before closure. It must also carry the §7.2 C1
  disclaimer that this is declared contract-credit accounting and not physical
  runtime measurement. Its closure-reason vocabulary, the zeroing of the root's
  remaining credit, the closing of still-open descendants with zero remaining,
  the extinguishment of the unused remainder, and the no-reopen / no-re-mint
  statements all stay.
- `resource_model.sequence` today states the dense per-root order only. It must
  additionally state the C2 envelope / nested-record agreement — that every
  nested public record carries exactly its envelope's `sequence` and
  `virtual_time_ms` — and the intra-position reading of
  `RES_VIRTUAL_TIME_ROLLBACK`, because §7.2 C2 requires that widened code
  meaning to be written into the packet's own artifacts rather than left
  standing only in this decision record. Its dense rule, its
  one-serialization-point-per-root-tree statement, and its "deliberate v0.1
  contract limit" and "no throughput, scaling, or runtime-concurrency claim"
  disclaimers stay.

Both updates are descriptions of rules C1 and C2 already impose; neither adds a
rule. Neither may change status, disposition, lifecycle ceiling, packet
version, bundle-tag flag, evidence level, or any authority, capacity, or
approval statement anywhere in the manifest. A wording update that moves any of
those is scope drift and a stop condition under G-W2H-6.

The third group is the inventory and integrity fields §7.4 requires
recomputing — `members`, `member_digests`, `member_count`, the self digest, and
`aggregate_sha256`. Everything else stays byte-identical, including
`resource_model.dimensions`, `resource_model.admission`,
`resource_model.release`, `resource_model.no_mint`,
`resource_model.root_binding`, the rest of `authority_model`, and all four
`dependencies_reused_unmodified` pins. `resource_model.dimensions` in
particular stays at exactly the six credit dimensions of §7.1; R3 adds none.

Within `docs/adr/ADR-0012-resource-bounds-contract-profile.md` the sites that
change are exactly three: the sentence stating that every event carries a
"strictly monotone sequence and fixture-supplied virtual time", which must
state the dense per-root order and the envelope/nested agreement of C2; one
added sentence under **Release and closure** stating that closure settlement is
derived from the ledger under C1; and the manifest-pin sentence carrying the
fixture count, whose **31 fixtures** becomes 36.

That third site must not be confused with the adoption sentence, because the
document states "seven" in two different sentences and only one of them also
carries a fixture count:

- the **adoption** sentence under **Proposed decision** — "Adopt, subject to a
  later acceptance decision, seven JSON Schema 2020-12 documents under
  `cybrik.res-*`, a fixed deterministic fixture corpus, one compatibility
  manifest, and static architecture guidance" — states no fixture count at all
  and is **preserved byte-identical**; and
- the **manifest-pin** sentence under **Contract members** — "The compatibility
  manifest pins the seven schemas, the examples manifest, all 31 fixtures, and
  itself using a non-circular self-digest algorithm" — which names both counts
  in one sentence. Only its fixture count moves, `31` to `36`. Its "seven
  schemas" clause, its examples-manifest and self-pin clauses, and its
  non-circular self-digest clause stay exactly as written.

The adoption sentence, the "seven schemas" clause of the manifest-pin sentence,
the **Contract members** list itself, and the six-dimension `resourceVector`
enumeration are **explicitly preserved and must not change** — R3 adds neither
a schema nor a dimension, and raising either count is a stop condition under
G-W2H-6, not a count reconciliation.

Within `docs/architecture/resource-bounds/01-contract-semantics.md` the sites
that change are exactly four.

- The **State model** section. It currently says only that "Replay accepts a
  denial as a real outcome: it is recorded, and the tree continues from the
  untouched state" — the R2 truth that C3 and C4 supersede. It must state that
  a recorded denial is accepted only when the replayed state makes the request
  inadmissible and the error carries the code that state implies, that the
  idempotency key binds on denial as well as on admission over the canonical
  identity of C4, that a retry must assert the parent's current
  `expected_version`, and that a denial may later clear into an admission when
  peer state returns credit. Without this site C3 and C4 would live only in the
  replay model and in this decision record while the packet's own semantics
  document still tells a reader that any recorded denial is accepted, which is
  the underclaiming-by-silence failure §7.2 exists to prevent.
- The **Ledger sequence** section, which gains the envelope / nested-record
  agreement and the two-code time rule of C2, including the intra-position
  meaning of `RES_VIRTUAL_TIME_ROLLBACK` — that the code covers virtual time
  running backwards inside one ledger position and not only between two
  positions.
- The **Root closure** section, whose settlement formula gains the two
  ledger-derived halves of C1, the statement that credit held by a still-open
  reservation at a cancelled closure is `final_unused` and is extinguished, and
  the explicit statement that this is contract-credit accounting and not
  physical measurement.
- The **Error reporting** section's "byte-identical re-issue" sentence, which
  must state the canonical idempotent identity of C4. It must not be rewritten
  to suggest that `RES_ACTIVE_CHILDREN` retriability is now demonstrated; per
  §7.2 C3 that claim stays declared and unproved.

The retriability mapping itself, `fail_closed`, the conserved-dimension list,
the release formula, and the identity/authority and vocabulary sections stay.

Within `docs/architecture/resource-bounds/02-deterministic-replay-and-evidence.md`
the sites that change are the **Replay record** section (envelope/nested
agreement, the code rule, and the intra-position reading of
`RES_VIRTUAL_TIME_ROLLBACK`), the **Positive proof** section (the
denied-then-admitted ledger, the admitted result projection, and the
ledger-derived settlement), and the **Negative proof** section (the four new
named invariants). The evidence-level paragraph and its `NOT ACCEPTED`
disclaimers stay.

Catalog and validator documentation whose stated counts become false:

- `contracts/examples/README.md` — in the `resource-bounds/` entry, the
  `9 positive, 10 negative-schema, and 12 negative-semantic` counts become
  `10 positive, 10 negative-schema, and 16 negative-semantic`. Nothing else in
  that entry changes; its exercised-invariant list is not a completeness claim.
- `tools/contract-validation/README.md` — in the
  `Gate W2-H resource-bounds proposal` paragraph, "validates 9 positive"
  becomes 10 and "each of 12 negative-semantic replay cases" becomes 16. The
  "seven JSON Schema 2020-12 documents" and "rejects 10 negative-schema"
  statements stay true and must not change, as must the
  `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED` status line, the static-L1/L2-only
  disclaimer, the `npm run` script names, and every other byte.

**Inventory arithmetic, verified against repository bytes at the base above.**
The compatibility manifest declares `member_count: 40`, its `members` and
`member_digests` arrays each hold exactly 40 entries, and the examples manifest
holds exactly 31 fixture entries. Those 40 decompose as:

| Class | Current (R2) |
|---|---|
| `cybrik.res-*` schemas | 7 |
| positive fixtures | 9 |
| negative-schema fixtures | 10 |
| negative-semantic fixtures | 12 |
| `examples-manifest.json` | 1 |
| compatibility manifest (self-member) | 1 |
| **total** | **40** |

R3 adds exactly 0 schemas and exactly 5 fixtures — 1 positive, 0
negative-schema, 4 negative-semantic — and adds nothing else: no new schema, no
new manifest, no new document member. So `40 + 5 = 45`.

| Class | After (R3) |
|---|---|
| `cybrik.res-*` schemas | 7 |
| positive fixtures | 10 |
| negative-schema fixtures | 10 |
| negative-semantic fixtures | 16 |
| `examples-manifest.json` | 1 |
| compatibility manifest (self-member) | 1 |
| **total** | **45** |

Both columns are checked: `7 + 9 + 10 + 12 + 1 + 1 = 40` and
`7 + 10 + 10 + 16 + 1 + 1 = 45`, with 36 fixtures and two manifests. If a
writer's recomputed `member_count` is not exactly forty-five, or the fixture
split is not exactly 10/10/16, or the schema count is not exactly seven, the
scope has drifted and that is a stop condition under G-W2H-6 — not a number to
adjust.

Within `tools/contract-validation/tests/validate-resource-bounds.test.mjs`,
three kinds of edit are authorized and no others: the inventory assertions that
C1–C4 make false; the one existing case whose inline ledger C1 makes
unreplayable; and new cases — the in-memory cases for the C1–C4 branches
§7.3.2 leaves without fixtures, plus the assertion this section already
requires that `positive/root-closure.completed.json` is byte-identical to the
terminal `root-closure` payload of `positive/replay.denied-then-admitted.json`.
No existing assertion may be weakened or removed to accommodate any of them.

**Assertions that must move to the R3 totals** — moved, not deleted, each named
by its test and its assertion:

| Test | Assertion | R2 | R3 |
|---|---|---|---|
| `every semantic replay is structurally valid and rejected by exactly its named rule` | `NEGATIVE_REPLAY_PATHS.length` | 12 | 16 |
| `B1-B4: the examples manifest registers exactly the nine authorized new fixtures` | `manifest.fixtures.length` | 31 | 36 |
| `the authorized R2 packet totals exactly 40 members with a 9/10/12 fixture split and 7 schemas` | `expectedPacketPaths.length` | 40 | 45 |
| the same totals test | `positiveCount` | 9 | 10 |
| the same totals test | `negativeSemanticCount` | 12 | 16 |
| `the compatibility manifest recomputes to member_count 40 while the accepted dependency pins stay untouched` | `member_count`, `member_digests.length`, `members.length` | 40 | 45 |

The two test **titles** that state their own totals move with their bodies: the
totals test states 45 members with a 10/10/16 fixture split and 7 schemas, and
the manifest test states `member_count` 45. A title left at an R2 number while
its body asserts the R3 number is a false claim in the suite's own output, not
a cosmetic mismatch.

**Assertions in those same tests that must NOT move**, because R3 changes
neither quantity:

- `negativeSchemaCount` stays **10** and `schemaCount` stays **7** in the
  totals test — R3 adds no negative-schema fixture and no schema;
- `NEW_FIXTURE_REGISTRATIONS.length` stays **9** in the examples-manifest test,
  because it pins R2's authorized new-fixture set and is not a packet-size
  assertion;
- `REPLAY_ERROR_CODES.length` stays **15** and the retriable-code set stays
  **2** in
  `B3: res-bounds-error retriable becomes a code-derived mapping, true only for RES_INSUFFICIENT_REMAINDER and RES_ACTIVE_CHILDREN`;
  and
- `dependencies_reused_unmodified.length` stays **4**, with
  `declaredDependencyPinsMatch(manifest)` still true.

If any of those moves, the scope has drifted and G-W2H-6 stops the work.

**The one existing case C1 invalidates.**
`B1: replay recognizes the renamed root-closure event kind and reconciles exact
accounting` builds an inline ledger of a grant of 10 per dimension followed
immediately by a closure declaring `final_consumed` 4 and `final_unused` 6. It
replays no reservation and no release, so under C1 the ledger-derived consumed
total is the zero vector and the case must fail
`RES_RELEASE_ACCOUNTING_MISMATCH`: it is itself an instance of the free split C1
closes. **Rebasing it is authorized and required.** The case must reserve from
the root and release with `consumed` 4 before the closure, so the declared split
is the one the ledger produces, and its existing assertions — `accepted` true,
empty `errors`, zero `finalRootRemaining`, and a terminal `root-closure` trace
entry with `rootClosed` true — stay. Turning it into a negative case, deleting
it, weakening its assertions, or relaxing C1 to keep it green is rejected.

The three neighbouring closure cases were checked against C1 at the base above
and already conform, so they stay as they are:
`B1: a root closure whose final_consumed+final_unused misses the grant bounds
fails closed on RES_RELEASE_ACCOUNTING_MISMATCH` still fails with its declared
code, now refused at the derived-consumed comparison;
`B1: root closure closes and zeroes exactly the still-open descendants, and the
ledger stays shut afterwards` already declares consumed 1 and unused 9, which
is the root's 6 plus the open child's 3; and
`B4: seeded synthetic trees replay admission, release, and terminal root
closure with conserved accounting` already builds `final_consumed` from the
releases it generated and `final_unused` from the replayed root remainder.

This decision record is the only additional path.

**7.3.4 Explicitly not authorized, and not needed.**

- `contracts/json-schema/cybrik.res-common-defs.v1.schema.json`,
  `cybrik.res-bounds-grant.v1.schema.json`,
  `cybrik.res-reservation-request.v1.schema.json`,
  `cybrik.res-reservation-result.v1.schema.json`,
  `cybrik.res-release.v1.schema.json`, and
  `cybrik.res-root-closure.v1.schema.json` — C1–C4 are cross-record rules that
  no single-record schema can express, and the C4 wording reconciliation
  touches only the error schema. These six keep their bytes and digests.
- Every existing fixture except
  `positive/root-closure.completed.json` — that is, the **eight** other
  positive fixtures, all ten negative-schema fixtures, and all twelve
  negative-semantic fixtures, thirty of the thirty-one. Each was checked
  against C1–C4 and conforms unchanged; their bytes and digests stay. The
  retained "byte-identical re-issue" message in
  `negative-schema/bounds-error.retriable-mismatch.json` is covered by this
  bullet and is correct as it stands — see §7.2 C4.
- `contracts/README.md`, `contracts/json-schema/README.md`, and
  `contracts/compatibility/README.md` — the first and third state seven schemas,
  while the JSON Schema catalog enumerates the same seven schema bullets; none
  states a fixture or member count, so all three stay true and byte-identical
  after C1–C4.
- `docs/adr/README.md`, `docs/architecture/README.md`, and
  `docs/architecture/resource-bounds/README.md` — the ADR-0012 row, the W2-H
  catalog paragraph, and both `resource-bounds/` overview entries state no
  count and remain true. W2-I's additive-byte test pins the former file's added
  hunks exactly, and R3 has no reason to disturb them.
- `tools/contract-validation/validate.mjs`,
  `tools/contract-validation/package.json`,
  `tools/contract-validation/tests/validate-transport.test.mjs`, and
  `.github/workflows/contracts.yml` — the validator is already registered, the
  orchestrator banner already names W2-H as `PROPOSED / NOT ACCEPTED`, the step
  count is unchanged, and the required-check allowlist is unchanged. The §3.2
  integration-compatibility authorization remains spent and is not reopened.
- Every accepted member and every `ACCEPTED_DEPENDENCY_PINS` file. Drift there
  is a hard stop, not a rebase.
- Every path in every other repository.

### 7.4 Mandatory integrity recomputation

Digests are part of the contract, not decoration. Because C1 and C4 change
fixture, schema, and compatibility-manifest bytes and §7.3.2 adds five
fixtures, the writer must recompute, in this order and by the rules already
recorded in the manifest:

1. every fixture `sha256` in
   `contracts/examples/resource-bounds/examples-manifest.json`, including the
   five new entries and the changed
   `positive/root-closure.completed.json`;
2. every non-manifest `member_digests[].sha256` in the compatibility manifest,
   from the exact on-disk UTF-8 bytes — the changed
   `cybrik.res-bounds-error.v1.schema.json` and the changed examples manifest
   included;
3. `member_count`, raised to forty-five, and the `members` inventory;
4. the compatibility-manifest self digest, by the recorded `self_digest_rule`
   over the parsed manifest with the complete top-level
   `x-cybrik-packet-integrity` key deleted — this necessarily moves, because
   the C4 edit to `authority_model.error_retriability` and the §7.3.3 bounded
   wording updates to `resource_model.closure` and `resource_model.sequence`
   are all inside the digested region; and
5. `aggregate_sha256`, by the recorded `aggregate_rule`.

No digest may be hand-edited to make a check pass, and no digest rule may be
weakened, reordered, or made circular. A digest that cannot be reproduced from
the on-disk bytes is a stop condition.

### 7.5 Explicit rejections

The following were considered and are rejected. They are not deferred, not
partially authorized, and not to be reintroduced by a writer under a different
name.

- **Any new schema.** The packet stays at seven `cybrik.res-*` schemas. A
  settlement schema, a denial-record schema, an idempotency-ledger schema, and
  any per-operation result schema are all rejected, as §6.5 already rejected
  `res-release-result` and `res-cancel-result`.
- **Any new `RES_*` error code.** C1 reuses `RES_RELEASE_ACCOUNTING_MISMATCH`,
  C2 reuses `RES_SEQUENCE_VIOLATION`, `RES_VIRTUAL_TIME_ROLLBACK`, and
  `RES_RESULT_MISMATCH`, C3 reuses `RES_RESULT_MISMATCH`, and C4 reuses
  `RES_IDEMPOTENCY_CONFLICT` and `RES_RESULT_MISMATCH`. The enum stays at
  fifteen. A `RES_SETTLEMENT_*`, `RES_DENIAL_*`, or `RES_ORDERING_*` code is
  rejected outright.
- **Any additional conserved dimension.** `resourceVector` stays at exactly
  six.
- **Any carrier for a retried release.** A release idempotency key, a release
  result document, a retried-release replay path, or any other record-shape
  change that would make `RES_ACTIVE_CHILDREN` retriability demonstrable is
  rejected here. §7.2 C3 records that claim as declared and unproved; closing
  it belongs to separately authorized work, and no R3 wording may present it as
  closed.
- **Widening the derivable denial codes.** A ledger presenting a record against
  a missing parent, a closed parent, a closed root, a foreign root, or a stale
  expected version falsifies the ledger and is refused at the existing checks;
  re-expressing any of those as an admissible `denied` outcome is rejected, as
  is any denial carrying `RES_ACTIVE_CHILDREN`.
- **Changing the R2 retriability mapping.** Exactly two codes stay `true`,
  `fail_closed` stays `{"const": true}` for all fifteen, and the
  `if`/`then`/`else` composition is untouched. C4 changes only the sentence
  that defines what re-issuing "the same request" means.
- **Widening the canonical idempotent identity.** Exactly three fields are
  excluded — `sequence`, `virtual_time_ms`, and `parent.expected_version`.
  Excluding `requested`, `request_id`, `tenant_id`, `org_scope_ref`, `root`, or
  `parent.kind`/`parent.id` is rejected: that would let a key be reused for a
  materially different draw. Reading the `parent.expected_version` exclusion as
  a licence to skip the version check on a retry is rejected with it: the check
  stays where R2 put it, and a stale assertion is still
  `RES_VERSION_CONFLICT`.
- **Widening the admitted result projection.** Exactly two fields are excluded
  — `sequence` and `virtual_time_ms`. Every other field of the recorded
  admitted result must be reproduced literally, and excusing
  `parent_version_after`, `parent_remaining_after`, `reservation.state_version`,
  or any part of the `reservation` object from that comparison is rejected:
  that would let an idempotent replay quietly restate a different admission.
- **Relaxing the dense sequence, or adding a second serialization point.**
  §6.5 stands. C2 tightens the ordering rule; it does not reopen it.
- **Treating `final_consumed` as a measurement.** Any claim, in code, fixture,
  comment, manifest, or prose, that closure accounting reflects observed CPU,
  memory, tokens, tool invocations, bytes retrieved, or bytes egressed by a
  running system is rejected. It is declared contract credit only.
- **Reading a denial, a retriable error, or a cleared denial as capacity.** A
  denial that later clears grants nothing at the moment of denial: no queue
  position, priority, reservation, admission, authority, capability,
  delegation, or approval.
- **Runtime, adapters, services, or product code** in any repository.
- **OpenAPI, AsyncAPI, or MCP surfaces** of any kind.
- **Work inside `cybrik-soc-command-center`, `cybrik-security-tool-fabric`, or
  `cybrik-cyber-ai-platform`.** This amendment is Suite-owned contract bytes
  only.
- **Any mapping, rename, extension, or deprecation** of the accepted
  investigation `budget` object, `budget_exceeded`, `BUDGET_*`,
  `over_input_budget`, `over_output_budget`, or
  `fallbackInfo.reason = "budget"`. §4 stands unchanged.
- **Wall clock, network, concurrency, service, container, database, broker, or
  product runtime as evidence.** G-W2H-4 stands unchanged.

### 7.6 Authority this amendment does not grant

This is a write-scope amendment. It is not an approval of the resulting bytes.

- **No acceptance.** ADR-0012 and every packet member remain
  `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED` at `0.1.0`, not a bundle tag.
  Closing C1–C4 makes the packet's static evidence honest **on those four
  points**; it does not make the packet accepted, does not close the
  `RES_ACTIVE_CHILDREN` retriability gap §7.2 C3 discloses, and is not an
  acceptance application.
- **No commit, no push, no branch merge, no canonical merge, no release, no
  tag.** R3 authorizes writing bytes in this worktree and nothing further.
- **No W0-T11 movement.** W0-T11 measurement remains
  `HOLD until real vertical exists`. C1–C4 produce no runtime, integration,
  UAT, release, deployment, production, T10, or T11 evidence, and a green
  validator after this hardening is static L1/L2 conformance only.
- **No release-date or milestone change.** §5 stands: the `2026-12-20` Founder
  stable-v1.0 go/no-go and the `2026-12-21 → 2026-12-31` release window are
  untouched, and Gate W2-H is still not `G-C`.
- **No Founder-only authority.** Repository/top-level-directory changes,
  production anything, credentials, secrets, keys, identity-provider changes,
  history rewriting, force-push, additional remotes, dependency installation,
  migrations, and formatters/auto-fixers are all still Founder-only.

### 7.7 Required review, checks, and independent byte evidence

Before any commit, push, or canonical merge of the R3 write, G-W2H-6 applies
unchanged and requires all of:

- exact bounded scope — the changed-path set equal to §7.3 and nothing else;
- the focused validator and test suite green, with the R3 count assertions at
  10/10/16 fixtures, 36 fixtures registered, and 45 members, and with the
  pinned R2 assertions unmoved at 15 codes, 2 retriable codes, 4 dependency
  pins, 9 R2-authorized new fixtures, and 7 schemas;
- the aggregate contract-validation suite green, with no W2-I, W2-K, or
  accepted-member assertion weakened, and every `ACCEPTED_DEPENDENCY_PINS`
  digest unmoved;
- reproducible integrity — every digest in §7.4 recomputed from on-disk bytes
  by an independent run;
- dependency audit and the required hosted checks green on the existing,
  unchanged required-check allowlist;
- **independent review with no open P0, P1, or P2**, explicitly covering the
  C2 time-code split and its intra-position reading, the C3
  single-derivable-denial-code boundary, the C3 disclosure that
  `RES_ACTIVE_CHILDREN` retriability stays declared and unproved, the C4
  three-field exclusion together with the current-`expected_version`
  requirement it does not relax, the C4 admitted result projection, the three
  canonical-intent wording sites, and the C1 measurement disclaimer; and
- a clean base relationship to canonical `main`.

Each finding is independently evidenced in the packet bytes at the base above,
so this amendment does not rest on the audit instrument alone:

- **C1** — the replay model's closure branch compares only
  `vectorAdd(final_consumed, final_unused)` against `root.bounds`; it reads no
  accumulated release consumption and no open-reservation remainder, so the
  split is unconstrained. Two artifacts exercise that freedom today:
  `positive/root-closure.completed.json` settles no replayed ledger, and the
  focused test's `inline.root-closure.completed` case declares a 4/6 split over
  a ledger holding no reservation and no release at all.
- **C2** — the model compares `event.sequence` and `event.virtual_time_ms`
  only, and reads no `sequence` or `virtual_time_ms` from any nested payload,
  while every public record carries both fields.
- **C3** — the denied branch accepts any `result.error.code` present in
  `REPLAY_ERROR_CODES` and performs no admissibility comparison of
  `request.requested` against `parent.remaining`.
- **C4** — the idempotency map is written only on the admitted path, so a
  denial binds no key; a literal-byte re-issue after a peer release necessarily
  carries a stale `parent.expected_version`; and the "byte-identical re-issue"
  phrase appears at three canonical-intent sites — the `retriable` description
  in `cybrik.res-bounds-error.v1.schema.json`, the **Error reporting** sentence
  in `01-contract-semantics.md`, and `authority_model.error_retriability` in
  the compatibility manifest — plus one retained negative-schema fixture
  message that is about `RES_VERSION_CONFLICT` and stays true.
- **`RES_ACTIVE_CHILDREN`** — the release record carries no idempotency key and
  the packet declares no release result document, so no packet member can carry
  a retried release; its declared retriability is therefore unproved at the
  base above and stays unproved after R3.
- **Inventory** — the compatibility manifest declares `member_count: 40` and
  the examples manifest holds 31 fixture entries, decomposing as verified in
  §7.3.3.

If the audit instrument's C1–C4 differ from what is written here, or if the
packet bytes at write time differ from the facts recorded above, **this section
governs the write** and the divergence is a stop condition under G-W2H-6, to be
raised before any further byte is written — not silently reconciled.

## 8. R3.1 amendment — rebase the admitted-idempotency regression case

**Disposition:** `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`

- **Amendment date:** 2026-08-01 (`Asia/Ho_Chi_Minh`)
- **Decider:** Codex Governor under
  `docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`
- **Amendment identity:** `W2-H/R3.1`
- **Base:** `c543ebe` — the R3 RED test pin at which the conflict was found
- **Basis:** the R3 RED review

The R3 RED review found one pre-existing R2 test case that conflicts with the
literal C2 and C4 rules in §7.2. In
`idempotent replay binds both the original request and its exact result`, the
second event clones the first request and result byte-for-byte. It therefore
carries the first event's nested `sequence` and `virtual_time_ms` at a later
envelope position and repeats the first event's now-stale
`parent.expected_version`. R2 accepted that case only because its admitted-key
short circuit bypassed both checks. C4 explicitly removes that bypass for every
identity-matching re-issue. Keeping the test unchanged would require an
exception to C2/C4 and would contradict the canonical identity and current
version rules this amendment exists to enforce.

R3.1 therefore adds exactly one authorized edit to the test-file inventory in
§7.3.3:

- after cloning the original admitted request and result, rebase only the
  positional fields `sequence` and `virtual_time_ms` in both nested records to
  the second event's envelope, and set `request.parent.expected_version` to the
  parent's current version at that position; the literal values are
  `sequence: 3`, `virtual_time_ms: 1020`, and
  `parent.expected_version: 2`, restoring the three values the fixture's
  second event carried before the clone while leaving the fixture itself
  byte-identical;
- preserve the test title and every existing assertion: the conforming
  admitted replay remains accepted, and mutating
  `result.parent_version_after` remains rejected with
  `RES_RESULT_MISMATCH`; and
- do not change any other bound request field or admitted-result projection
  field. In particular, the result's recorded
  `parent_version_before`/`parent_version_after` and
  `parent_remaining_after` continue to reproduce the original admission; they
  are not recomputed from current state.

This makes the §7.3.3 test-file list four kinds of edit rather than three:
the second existing-case rebase is exactly this one C2/C4 case, and no other
existing case may be rebased. Every other limit in that list stays unchanged.

This is a test rebase, not a semantic exception. The implementation must still
apply C2 nested/envelope coherence and the current-`expected_version` guard to
**every** identity-matching re-issue, including an already-admitted binding.
No admitted-path short circuit may bypass either check. The idempotent
comparison relaxations remain exactly the two §7.2 C4 already defines and no
others: the canonical idempotent request identity's exclusion of `sequence`,
`virtual_time_ms`, and `parent.expected_version`, and the admitted result
projection's exclusion of `sequence` and `virtual_time_ms`. C2 independently
binds every excluded positional field to its own envelope, and the
current-version guard independently binds `parent.expected_version`.

All other R3 scope, counts, gates, disclaimers, and authority boundaries remain
unchanged. R3.1 authorizes no new path, fixture, schema, error code, dependency,
runtime proof, acceptance, commit, push, merge, release, production action, or
release-date change.

## 9. R4 amendment — make release refusal retriability derivable

**Disposition:** `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`

- **Amendment date:** 2026-08-01 (`Asia/Ho_Chi_Minh`)
- **Decider:** Codex Governor under
  `docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`
- **Amendment identity:** `W2-H/R4`
- **Base:** `1fc883fc9547ccc09a6d7b4201236903fa53796e`
- **Basis:** independent post-R3 acceptance-readiness audit

R3 deliberately left `RES_ACTIVE_CHILDREN` retriability declared but unproved.
The acceptance audit established the stronger fact: under the packet's own
canonical re-issue rule it is derivably false. `RES_ACTIVE_CHILDREN` refuses a
release. A release carries no idempotency key or result carrier, and its
optimistic-concurrency assertion is `target.expected_version`, not the
reservation request field `parent.expected_version` excluded by C4. When an
open child later releases, the target version moves; repeating the same release
therefore repeats a stale bound `target.expected_version` and fails
`RES_VERSION_CONFLICT`. Peer state cannot make that same release succeed.

R4 supersedes only the R2/R3 pin that made two codes retriable. The closed set
of retriable codes becomes exactly one: `RES_INSUFFICIENT_REMAINDER`.
`RES_ACTIVE_CHILDREN` remains one of the same fifteen error codes but maps to
`retriable: false`. `fail_closed` stays `true` for all fifteen, and the hint
remains advisory and grants no capacity, admission, queue position, priority,
authority, capability, permission, delegation, or approval.

The superseded clauses are exact. Section 6.5's seventh bullet is narrowed so no
code beyond `RES_INSUFFICIENT_REMAINDER` may be retriable, while its
`fail_closed: {"const": true}` requirement remains. Section 7.5's rejection of
changing the R2 mapping is superseded only for the true-code set; the closed
`if`/`then`/`else` composition remains required. Section 7.1's preserved
two-code-mapping pin is superseded by the one-code set. The open-gap statements
in §7.2 C3 and §7.6 are resolved by **withdrawal of the false claim**, not by
demonstration of retried-release behavior. Section 7.3.3's R3-scoped
stop-condition assertion is superseded only where it says the retriable-code
set stays `2`; `REPLAY_ERROR_CODES.length` stays `15` and every other
must-not-move assertion remains binding. Section 7.5's prohibition on
adding a release idempotency key, a release-result document or a retried-release
replay path remains fully in force, and R4 adds none. The R2 test title recorded
in §7.3.3 remains dated R2 history; this §9 pointer supersedes its two-code
meaning without rewriting historical evidence.

### 9.1 Exact authorized paths and edits

Exactly these paths may change:

1. `contracts/json-schema/cybrik.res-bounds-error.v1.schema.json` — remove
   `RES_ACTIVE_CHILDREN` from the `if` branch's retriable-true enum and reconcile
   only the `retriable` description with the single-code mapping and the release
   version rationale. The fifteen-code enum and every other schema byte stay.
2. `contracts/examples/resource-bounds/positive/bounds-error.standalone.json`
   — change exactly `retriable: true` to `retriable: false`. Its code remains
   `RES_ACTIVE_CHILDREN`; its message and `fail_closed: true` stay byte-identical.
3. `contracts/examples/resource-bounds/examples-manifest.json` — update only
   the changed positive fixture's `sha256`; entry count, order, kind, schema
   binding and every other fixture digest stay.
4. `contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`
   — reconcile only `authority_model.error_retriability`; the member digests for
   the error schema, changed positive fixture and examples manifest; the
   manifest self digest; and `aggregate_sha256`. Members, counts, dependency
   pins, status, lifecycle and every other field stay.
5. `docs/architecture/resource-bounds/01-contract-semantics.md` — reconcile
   only the **Error reporting** retriability paragraph: one true code and the
   release-version reason `RES_ACTIVE_CHILDREN` is false.
6. `tools/contract-validation/tests/validate-resource-bounds.test.mjs` — move
   the code-derived mapping test and title from two true codes to exactly one,
   remove `RES_ACTIVE_CHILDREN` from `RETRIABLE_CODES`, and move the literal
   `assert.equal(RETRIABLE_CODES.size, 2)` to `1`. Add assertions that the
   schema's retriable-true enum is exactly `['RES_INSUFFICIENT_REMAINDER']` and
   that `positive/bounds-error.standalone.json` remains
   `RES_ACTIVE_CHILDREN` with `retriable: false`. Update the stale R3 open-gap
   comment and the stale R3 comment claiming the mapping does not move. Pin all
   three wording sites — the schema `retriable` description,
   the semantics **Error reporting** paragraph and
   `authority_model.error_retriability` — to both the one-code mapping and the
   release-version rationale. No assertion may be deleted or weakened; the
   exhaustive loop must still prove both the valid and invalid `retriable`
   value for all fifteen codes.
7. This decision record.

No validator implementation change is needed: schema compilation and the
exhaustive mapping and fixture-witness tests enforce the declaration. Exactly
one existing fixture value changes; no fixture is added, removed, renamed or
re-kinded, and no other fixture byte changes. No new schema, error code,
dimension, manifest member, dependency or runtime surface is authorized.
Inventory remains 45 members, 36 fixtures split 10/10/16, seven schemas,
fifteen codes, six dimensions and four accepted dependency pins.

### 9.2 Integrity, review and lifecycle ceiling

Recompute exactly one fixture digest and exactly three non-self member digests:
the error schema, `positive/bounds-error.standalone.json`, and the examples
manifest. Then recompute the compatibility-manifest self digest and aggregate
digest by the existing non-circular rules. The other 35 fixture digests and 41
non-self member digests must remain byte-identical. Before any merge: focused
tests, standalone validator, dependency audit, gitleaks, required hosted checks
and an independent review must be green with no P0/P1/P2.

R4 grants no acceptance, runtime, UAT, T10/T11, deployment, release, production
or release-date change. It creates no bundle tag and does not change `0.1.0`.
An atomic acceptance decision remains a separate later action after a fresh
acceptance-readiness audit.
