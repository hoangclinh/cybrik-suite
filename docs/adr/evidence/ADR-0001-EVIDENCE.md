# ADR-0001 Evidence Packet — Suite contract/versioning policy

- Status: `DRAFT` — recommendation only. *Status note 2026-07-24:* the backed ADR was
  since `ACCEPTED` by the Founder ([ADR-0001](../ADR-0001-suite-contract-versioning-policy.md));
  this packet is retained unmodified as decision provenance.
- Date: 2026-07-23
- Backs: [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md)
- Scope: versioning scheme, breaking-change rules, acceptance workflow, and conformance
  policy for everything under `cybrik-suite:contracts/` (OpenAPI, AsyncAPI, JSON Schema,
  MCP capability contracts, compatibility matrices)

## 1. Decision criteria

Stated before scoring; drawn from `../../strategy/03-REFERENCE-ARCHITECTURE.md` §1 and
`../../strategy/05-CONTRACTS-AND-INTEGRATION.md` §9:

| # | Criterion | Why it matters |
|---|---|---|
| C1 | Compatibility discipline | Products ship on independent cadences; SOC V2 must never break because AI/Fabric moved |
| C2 | 24-month LTS viability | Strategy document 05 §9 targets 24-month LTS for GA releases; the scheme must make "what is supported" answerable for 24 months |
| C3 | Solo-founder operability | One person must be able to reason about, review, and release versions without a release-engineering team |
| C4 | Offline/on-prem (T2) fit | Air-gapped customers pin exact versions; verification must work without network access |
| C5 | Conformance automation | `tests/contract/` must be able to pin versions and diff for breaking changes mechanically |
| C6 | Migration burden per product | Cost each product pays when a contract changes |

## 2. External research

All URLs accessed 2026-07-23.

### 2.1 Semantic Versioning

- FACT — SemVer is at specification version **2.0.0**. Rules: MAJOR for incompatible API
  changes, MINOR for backward-compatible functionality, PATCH for backward-compatible bug
  fixes. Pre-release identifiers (`-alpha.1`) have lower precedence than the associated
  normal version. <https://semver.org/>
- FACT — SemVer **requires a declared public API**: "Software using Semantic Versioning
  MUST declare a public API", precisely and comprehensively. <https://semver.org/>
- INFERENCE — For contracts, "public API" declaration is the contract file itself, which is
  why per-file SemVer is coherent: each file is its own declared API surface. A suite-wide
  version has no single declared API surface unless the bundle is defined as one.

### 2.2 OpenAPI

- FACT — Current published OpenAPI Specification is **v3.2.0** (2025-09-19). The OAS itself
  is versioned `major.minor.patch`, where `major.minor` designates the feature set.
  <https://spec.openapis.org/oas/latest.html>
- FACT — OAS does **not** prescribe how API authors version their own APIs: the `openapi`
  field is the spec version of the document, and `info.version` is "distinct from the
  OpenAPI Specification version or the version of the API being described".
  <https://spec.openapis.org/oas/latest.html>
- INFERENCE — Therefore CYBRIK must define its own API versioning policy; adopting OpenAPI
  does not give us one for free.

### 2.3 JSON Schema

- FACT — The current stable JSON Schema dialect is **2020-12** (superseding 2019-09);
  dialects use date-based identifiers, and migration guides exist between drafts.
  <https://json-schema.org/specification>
- RESEARCH — JSON Schema evolves by dated dialect, not SemVer; schema authors identify the
  dialect via `$schema`. Versioning of *our* schemas is again our own policy decision.
  <https://json-schema.org/specification>

### 2.4 AsyncAPI

- FACT — Current AsyncAPI specification is **3.0.0**, versioned `major.minor.patch`; tooling
  is expected to be compatible within a `major.minor` line. <https://www.asyncapi.com/docs/reference/specification/v3.0.0>
- FACT — AsyncAPI does not define message/schema versioning guidance for API authors; it
  versions only the spec itself. <https://www.asyncapi.com/docs/reference/specification/v3.0.0>

### 2.5 MCP

- FACT — MCP uses **date-based version identifiers** (`YYYY-MM-DD`) marking the last
  backwards-incompatible change; the version is *not* incremented for backwards-compatible
  changes. Current protocol version: **2025-11-25**. Client and server negotiate a single
  version per session. Deprecated features stay in the spec at least twelve months (ninety
  days under an expedited exception) before removal.
  <https://modelcontextprotocol.io/specification/versioning>
- INFERENCE — MCP's protocol version is orthogonal to CYBRIK capability versions: we pin the
  MCP protocol revision per release (strategy document 02 §4 proposes pinning 2025-11-25),
  while capability contracts carry their own SemVer + digest. MCP is an adapter, not a
  trust boundary and not a versioning scheme for our contracts.

### 2.6 Precedent summary

- INFERENCE — Every ecosystem above versions *the specification format* but leaves
  *instance versioning* to the author. There is no external standard that decides ADR-0001
  for us; the real choice is the unit of versioning (per file vs. suite bundle) and the
  compatibility guarantee attached to it.

## 3. Option analysis

### Option A — SemVer per contract file + compatibility matrix

Each file in `contracts/` carries its own SemVer; `contracts/compatibility/` records which
product versions implement which contract versions.

| Criterion | Score | Notes |
|---|---|---|
| C1 Compatibility | Strong | Breaking change is visible per interface; unrelated contracts don't churn |
| C2 LTS | Weak-to-medium | "Supported for 24 months" must be computed across N independent files; no single supportable unit |
| C3 Solo-founder | Medium | Fine at small N; matrix maintenance grows quadratically with contracts × products |
| C4 Offline/T2 | Medium | Customers must pin many versions; verification needs the matrix shipped alongside |
| C5 Conformance | Strong | Per-file diffs are mechanical (schema diff against previous version) |
| C6 Migration | Strong | Products upgrade one contract at a time |

Trade-off: maximal flexibility, but the compatibility matrix becomes the de-facto release
artifact and nobody ever "releases the suite" — risky for LTS commitments and air-gapped
delivery, where the customer needs one tested set.

### Option B — Suite-wide contract bundle version, released as a unit

One version number for all of `contracts/`; products implement "contracts vX".

| Criterion | Score | Notes |
|---|---|---|
| C1 Compatibility | Medium | Any breaking change anywhere bumps the bundle major; products are forced into lockstep |
| C2 LTS | Strong | One number to support for 24 months |
| C3 Solo-founder | Strong at first | Simplest mental model; degrades when one product needs a fix and all must re-verify |
| C4 Offline/T2 | Strong | One pinned artifact, one offline verification |
| C5 Conformance | Medium | Diff granularity is coarse; a bundle diff can't tell which product is affected |
| C6 Migration | Weak | Release coupling: an AI-only contract change forces SOC/Fabric re-validation |

Trade-off: clean LTS story, but recreates the monolith at the contract layer and violates
driver "SOC must not be disturbed by AI/Fabric changes" (strategy document 03 §1.2) at the
process level.

### Option C — Hybrid: per-file SemVer + periodically tagged suite bundles

Files carry SemVer (as A); the suite periodically tags a **bundle** — a named, immutable
set of specific contract versions — which is what release manifests, LTS commitments, and
T2 deliveries reference.

| Criterion | Score | Notes |
|---|---|---|
| C1 Compatibility | Strong | Per-file discipline preserved |
| C2 LTS | Strong | LTS attaches to bundle tags, not to N floating files |
| C3 Solo-founder | Medium-strong | Two concepts instead of one, but each is simple; tagging a bundle is a periodic, scriptable act |
| C4 Offline/T2 | Strong | A bundle is exactly the "one tested set" an air-gapped install pins and verifies |
| C5 Conformance | Strong | Per-file diff for breaking-change detection + bundle-level compatibility run |
| C6 Migration | Strong | Products move per file day-to-day; bundles are alignment points, not lockstep gates |

Trade-off: the compatibility matrix still exists (which product implements which file
version between bundle tags), and someone must resist letting bundles drift into "the only
real version" (that would collapse into B) or never tagging (collapse into A).

### Consistency check against existing strategy text

- RESEARCH — Strategy document 05 §9 already sketches: API major in path; schema version in
  object/event; capability SemVer with digest pin at execution; deprecation ≥ two minor
  releases and 180 days for stable APIs; 24-month LTS for GA. Option C is the only option
  that keeps all of those sentences true simultaneously. (Internal source:
  `../../strategy/05-CONTRACTS-AND-INTEGRATION.md` §9 — a PROPOSAL, not a decision.)

## 4. RECOMMENDATION (not a decision)

**Option C — per-file SemVer with periodically tagged suite bundles**, with these
mechanics proposed for the ADR's acceptance text (draft wording lives in the
[Wave 0 decision packet](../FOUNDER-DECISION-PACKET-WAVE-0.md)):

1. Every contract file: SemVer 2.0.0 + status header (`PROPOSED`/`ACCEPTED`/`DEPRECATED`)
   + content digest. Execution-time references pin version **and** digest.
2. Breaking-change definitions per contract type (PROPOSAL, to be enumerated in the
   accepted ADR): REST — removing/renaming fields or endpoints, tightening request
   validation, changing error semantics; events — removing/renaming payload fields,
   changing delivery semantics or `event_type` meaning; JSON Schema — any change that
   rejects a previously valid instance; MCP capability — any input/output schema, side
   effect, or risk-class change (risk/side-effect changes are always MAJOR per strategy
   document 05 §9).
3. Unknown fields: consumers tolerate additive unknown fields except in security decisions,
   which fail closed (strategy document 05 §1.8).
4. Deprecation window: two minor releases and ≥180 days, except security emergencies.
5. Bundle tags: immutable named sets of contract versions; release manifests and LTS
   commitments reference bundles only; a bundle may not include `PROPOSED` contracts.
6. Acceptance workflow: agent-drafted contracts enter as `PROPOSED`; only a Founder-recorded
   approval flips to `ACCEPTED`; the flip commit links the evidence used.
7. Conformance: `tests/contract/` pins bundle tags; CI diffs each changed contract file
   against its last accepted version for breaking-change classification. (Aspiration —
   `NOT IMPLEMENTED`; no such CI exists today.)

Consequences the Founder accepts if following this: two versioning concepts to govern;
periodic bundle-tagging becomes a recurring Founder-gated chore; the compatibility matrix
remains necessary between bundles.

## 5. Founder decisions required

| # | Question | Form |
|---|---|---|
| D1 | Versioning unit: A (per-file only), B (bundle only), or C (hybrid)? | A/B/C |
| D2 | Is N-1 bundle compatibility mandatory for every product at all times? | yes/no |
| D3 | Confirm deprecation window: two minor releases AND ≥180 days (security emergencies excepted)? | yes/no |
| D4 | Pin authoring formats now: OpenAPI 3.1.x vs 3.2.x, JSON Schema 2020-12, AsyncAPI 3.0.0, MCP 2025-11-25? | pick per format, or defer to first contract |
| D5 | Acceptance recording: is a Founder-authored commit flipping the status header (with evidence links) the sole acceptance mechanism? | yes/no |
| D6 | May a release manifest reference a `PROPOSED` (unaccepted) contract? (Proposed: no.) | yes/no |
| D7 | Does the 24-month LTS attach to bundle tags (not individual files)? | yes/no |

## 6. Evidence limitations

- No conformance tooling was evaluated or run; §4.7 is a design aspiration, `NOT IMPLEMENTED`.
- No measurement of real migration cost — there are zero contracts today, so C6 scoring is
  reasoning, not data.
- OpenAPI 3.1 vs 3.2 tooling maturity (validators, generators) was **not** surveyed; D4
  should not be finalized without a short tooling check. UNKNOWN.
- AsyncAPI/Kafka operational fit at T1/T2 is out of scope here (touches ADR-0006 §bus).
