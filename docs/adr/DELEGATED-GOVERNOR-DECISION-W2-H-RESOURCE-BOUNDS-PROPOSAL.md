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

This decision record itself is the only additional path.

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
