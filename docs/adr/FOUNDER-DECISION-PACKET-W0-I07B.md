# Founder Decision Packet — W0-I07b capability-name canonicalization

- Status: `DECIDED — OPTION A — SUITE APPLICATION REVIEWED — FABRIC REFRESH PENDING`
- Prepared: 2026-07-26
- Suite member at A3: `cybrik.capability.v1` v0.1.1
  `ACCEPTED FOR IMPLEMENTATION — APPLIED`
- Fabric vendor snapshot: v0.1.0 retained until the ordered A4 refresh
- Release impact: none; no W0–W6 date changes
- Review source snapshot:
  `cybrik-worktrees/w0-48/w0-i07b-capability-name-contract-r1`

This packet records the lexical rule, pre-GA version classification and reviewed Suite
application. It does not itself refresh the Fabric vendor snapshot, authorize a runtime or
certify a release.

## 1. Confirmed defect

The accepted capability-name pattern ends with `$`. Python regular-expression semantics allow
`$` to match immediately before one final LF, so Python jsonschema accepts
`"fabric.isolate_host\n"` while ECMAScript/Ajv reject it.

The accepted Fabric pure validator delegates to that schema and reproduces the same acceptance.
A strict RED regression is pinned in the I07 bounded worktree. The canonical Fabric root has no
landed counterpart yet. Fabric currently has no accepted registration/discovery store or network
surface, so this is a latent accepted-code trust-boundary defect rather than a proven deployed
exploit.

## 2. Candidate and evidence

The candidate retains the existing structural dotted-name pattern and adds:

```json
{ "not": { "pattern": "[^a-z0-9_.]" } }
```

The unanchored guard rejects any control character, whitespace, case drift, or other
non-canonical character without relying on host-specific end anchors.

Current proposal evidence:

- scoped-delta proof: no accepted field other than the proposed `name` guard/version metadata
  changes;
- native ECMAScript, Ajv 8.20.0, and Python jsonschema 4.26.0 matrix green;
- 4 canonical positives accepted and 13 non-canonical negatives rejected in every candidate
  runtime;
- 11 proposal/inventory Node tests pass;
- deterministic bounded inventory of canonical suite plus accepted Fabric vendored fixtures:
  4 documents, 4 candidate-valid, 0 candidate-invalid, per-document SHA-256 recorded;
- inventory fails closed on missing roots, empty roots, malformed matching JSON, or missing names.

The inventory is fixture/snapshot evidence only. There is no live Fabric registry/store to scan,
and no live-registry claim is made.

## 3. Decision requested

| Option | Meaning |
|---|---|
| **A — Approve rule as pre-GA patch v0.1.1 (recommended)** | Approve ADR-0010 rule/version classification and authorize preparation of a separate coordinated application/status-flip packet after product RED tests and zero-invalid inventory evidence. |
| B — Approve rule as pre-GA minor v0.2.0 | Same lexical rule and migration, but revise all candidate artifacts/versioning before application. |
| C — Reject/defer | Keep accepted v0.1.0 behavior and carry the cross-runtime defect as an explicit open risk. |

Patch v0.1.1 is recommended because the accepted lexical intent is already lowercase dotted form,
Ajv already rejects the disputed value, and the candidate changes no object shape or operation.
The validation tightening remains explicitly recorded because Python-admitted invalid values would
be rejected.

## 4. Gate answers for Option A

| Gate item | Recommended answer | Decision |
|---|---|---|
| G-W0I07B-1 — add the unanchored disallowed-character guard while retaining the structural pattern | Yes | **Yes — Founder, 2026-07-26** |
| G-W0I07B-2 — classify as pre-GA patch v0.1.1, not stable v1/GA | Yes | **Yes — Founder, 2026-07-26** |
| G-W0I07B-3 — never auto-trim/lowercase; invalid names require owner-reviewed rename and regenerated digest/signature/references/policies | Yes | **Yes — Founder, 2026-07-26** |
| G-W0I07B-4 — application must coordinate suite manifest/schema, Fabric snapshot/validator, strict regression, rollback v0.1.0, and cross-runtime evidence | Yes | **Yes — Founder, 2026-07-26** |
| G-W0I07B-5 — current decision does not itself apply/accept bytes, authorize runtime, or change release dates | Yes | **Yes — Founder, 2026-07-26** |

## 5. Required application packet after approval

Before a status flip:

1. land a strict trailing-LF product RED test against the accepted Fabric validator;
2. prove all discoverable registered/static capability names are candidate-valid; if a future
   registry exists, prove zero active invalid registrations or quarantine every offender;
3. update canonical schema version/description and compatibility manifest with per-member hashes;
4. refresh product snapshots atomically while retaining accepted v0.1.0 rollback evidence;
5. run suite and product validators across Python and Ajv/ECMAScript;
6. obtain a separate explicit application/status-flip decision.

No auto-rewrite or silent replay of rejected registrations is permitted.

## 6. Recorded Founder decision

- Option: **A — pre-GA patch v0.1.1**
- G-W0I07B-1..5: **yes**
- Conditions: first execute only the one-file strict Fabric RED defined in
  `cybrik-suite:docs/operations/W0-I07B-POST-DECISION-STRICT-RED-BRIEF.md`; the coordinated
  candidate application/status flip remains separately gated.
- Decided by: **Founder**
- Decided on: **2026-07-26**
- Decision evidence: exact W0 Bundle A response recorded in
  `cybrik-suite:docs/adr/FOUNDER-DECISION-QUEUE-W0.md`.

Bundle B Option A was explicitly approved by the Founder on 2026-07-26 with G-W0BB-1..10=yes,
followed by the narrow correction from pre-guard SHA `278c...` to guarded SHA `7858...`. The exact
Suite A2 application now passes 13/13 member-hash verification, 25/25 hardenings and independent
review with no remaining P0–P3. In the A3 Suite provenance commit containing this record,
capability v0.1.1 is `ACCEPTED FOR IMPLEMENTATION — APPLIED`, not stable v1/GA.

Fabric remains on its retained v0.1.0 vendor snapshot until A4 pins the exact A3 Suite commit,
replays the existing strict RED to GREEN and passes its own path audit, validators and independent
review. No push, merge or release is authorized.
