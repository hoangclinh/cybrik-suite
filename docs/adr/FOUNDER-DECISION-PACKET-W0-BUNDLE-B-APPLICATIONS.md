# Founder Decision Packet — W0 Bundle B canonical applications

- Status: `DECIDED — A1/A2 REVIEWED — A3 LOCAL SUITE COMMIT AUTHORIZED`
- Prepared: 2026-07-26
- Depends on: recorded and independently reviewed W0 Bundle A
- Release impact: none; W0–W6 dates remain unchanged
- External effect: none unless explicitly approved; no push, merge, publish, deploy or release
- Recommended option: **A**

This packet converts the reviewed Bundle A worktree evidence into two bounded application changes:

1. integrate the accepted-for-implementation W0-I01 Investigation packet into the canonical Suite
   repository and independently revalidate it before opening I02;
2. apply the W0-I07B capability-name patch as a coordinated, provenance-pinned Suite-to-Fabric
   update.

It does not authorize a runtime, live registry, endpoint, migration, deployment, stable v1/GA
promotion or release-date change.

## 1. Evidence already complete

### W0-I01

- The isolated application worktree and canonical Suite root share base
  `55e94c2815ee68ef49a6e10cdc41a76c227b7bd7`.
- The reviewed application owns exactly 12 allowlist entries: 34 new packet files plus four
  hunk-only catalog files.
- Standalone evidence is green: 5 schemas loaded, 4 compiled, 9/9 positive, 8/8
  negative-schema, 9/9 structurally-valid negative-semantic, 45/45 invariants and 4/4
  derivation self-checks.
- TR-5 remains explicitly `declared_runtime_only`.
- Independent re-review reports no P0–P3.

### W0-I07B

- The one-file strict Fabric RED reproduces the accepted defect against the real validator:
  `"fabric.isolate_host\n"` is accepted and the strict test fails as intended.
- The revision-bound canonical-root inventory reports 4 documents, 4 candidate-valid and
  0 candidate-invalid; this is fixture/snapshot evidence, not a live-registry claim.
- Candidate schema and cross-runtime matrix are reviewed; the final inventory re-review reports
  no P0–P3.
- Accepted v0.1.0 rollback bytes and their hashes remain available.

## 2. Option A — recommended bounded application

### A1. W0-I01 canonical integration

Create one fresh Suite application worktree/branch named `codex/w0-bundle-b-contracts`, bound to
exact Suite base `55e94c2815ee68ef49a6e10cdc41a76c227b7bd7`. Apply I01 there; do not edit or
replace files in the current dirty Suite worktree.

Apply only these 12 allowlist entries:

1. `contracts/json-schema/cybrik.investigation-common-defs.v1.schema.json`
2. `contracts/json-schema/cybrik.investigation.v1.schema.json`
3. `contracts/json-schema/cybrik.claim.v1.schema.json`
4. `contracts/json-schema/cybrik.evidence.v1.schema.json`
5. `contracts/json-schema/cybrik.investigation-bundle.v1.schema.json`
6. `contracts/compatibility/cybrik-suite-investigation-packet.v1.manifest.json`
7. `contracts/examples/investigation/**`
8. `tools/contract-validation/validate-investigation.mjs`
9. `contracts/compatibility/README.md` — I01 hunk only
10. `contracts/examples/README.md` — I01 hunk only
11. `contracts/json-schema/README.md` — I01 hunk only
12. `tools/contract-validation/README.md` — I01 hunk only

Hard denylist:

- `contracts/README.md`;
- `tools/contract-validation/validate.mjs`, `package.json` and `validate-openapi.mjs`;
- every OpenAPI, AsyncAPI, MCP and W2-I transport path;
- all product repositories.

The four catalogs must be patched against their current canonical bytes. They must never be
replaced wholesale from the older I01 worktree. `validate-investigation.mjs` remains standalone
in this step and is not wired into the aggregate validator.

Required post-application proof:

- standalone I01 validator green from the canonical Suite root;
- aggregate Suite validator still green, without treating it as I01 evidence;
- exact path audit shows only the 12 allowlist entries;
- `git diff --check` clean;
- independent review confirms coherent lifecycle/Founder evidence, unchanged TR-5
  `declared_runtime_only`, no transport/runtime/consumer claim and no P0–P3.

That reviewed result plus the exact Suite provenance commit in A3 satisfies the existing
W0-I02/I03 condition and permits I02 RED to start. I03 remains sequentially gated behind
independent acceptance of the I02 RED.

### A2. W0-I07B Suite application semantics

Apply in the same `codex/w0-bundle-b-contracts` Suite application worktree after A1 has passed its
bounded review. Do not use the historical I07B proposal worktree.

Suite application allowlist:

1. `contracts/json-schema/cybrik.capability.v1.schema.json`;
2. `contracts/compatibility/cybrik-suite-contract-packet.v1.manifest.json`;
3. `docs/adr/ADR-0010-capability-name-canonicalization.md`;
4. `tools/contract-validation/validate-schemas.mjs` — bounded packet-version/member-version/hash
   validation hunk only.

Required semantics:

- add only the reviewed unanchored disallowed-character guard while retaining the structural
  dotted-name pattern;
- set the capability member contract version and description to pre-GA patch `0.1.1`;
- pin the final schema bytes: keep `properties.name.description` unchanged, format the new guard
  as `"not": { "pattern": "[^a-z0-9_.]" }`, and use this exact top-level description:
  `A signed, digest-pinned capability descriptor in the Tool Fabric capability registry
  (strategy 05 §5.1; ADR-0004). Registration MUST be rejected if digest, signature, license,
  owner, risk_class, side_effects, schemas, or limits are missing (fail-closed). MCP is an adapter
  over these capabilities, not a trust boundary (ADR-0006). Status: ACCEPTED FOR IMPLEMENTATION
  (v0.1.1; not stable v1/GA). Validation tightening: capability names now reject any character
  outside [a-z0-9_.] across JSON Schema runtimes.` With no other schema byte changed, the expected
  final SHA-256 is `278c8837dcc5352c3b59bbebfa1214b8150169b14c1d4823b66941de229a71f7`;
- move ADR-0010 to `ACCEPTED FOR IMPLEMENTATION — APPLIED`, record Founder/date and preserve the
  live-registry limitation;
- treat `x-cybrik-packet-version: 0.1.1` as a mutable pre-GA packet-snapshot revision, not an
  immutable bundle tag and not stable v1/GA;
- keep every unchanged member's `contract_version` at `0.1.0`; only
  `cybrik.capability.v1` becomes `0.1.1`;
- add a lowercase unprefixed `sha256` field to all 13 manifest member rows, computed over the
  final canonical member bytes. This aligns the contract packet with the stronger per-member
  digest convention already used by newer Suite manifests and removes ambiguity about whether
  only the changed member is integrity-pinned;
- update only the bounded base-packet checks in `validate-schemas.mjs` so they require snapshot
  `0.1.1`, capability member `0.1.1`, all 12 unchanged members `0.1.0`, and recompute/verify all
  13 manifest hashes. Do not relax any fixture, schema, invariant or failure condition;
- record the validation tightening and v0.1.0 rollback in the compatibility record.

Do not edit `docs/adr/README.md`, `contracts/compatibility/README.md`, any proposal artifact or
`tools/contract-validation/validate.mjs`, `package.json`, `validate-openapi.mjs` or any other
shared-validator path in this application.

### A3. Suite provenance commit

After A1 and A2 both pass their own validation and independent review, authorize one local,
path-limited Suite commit containing only:

- the 12 W0-I01 allowlist entries from A1;
- the four W0-I07B Suite paths from A2;
- `docs/adr/FOUNDER-DECISION-PACKET-W0-BUNDLE-B-APPLICATIONS.md`;
- `docs/adr/FOUNDER-DECISION-PACKET-W0-I01.md`;
- `docs/adr/FOUNDER-DECISION-PACKET-W0-I07B.md`;
- `docs/adr/FOUNDER-DECISION-QUEUE-W0.md`.

The staged diff must be independently checked before commit. Dirty W2-I transport, unrelated
catalog hunks, worktree metadata and every denylisted path remain unstaged. The commit supplies
the exact immutable `suite_commit_sha` needed by Fabric. It grants no push, merge, branch
publication or release authority.

If an exact path-only index cannot be proven, stop before commit and return to the Founder; do not
stage a whole dirty catalog file.

### A4. W0-I07B Fabric snapshot and GREEN

Only after the Suite provenance commit exists, apply on a fresh Fabric application worktree/branch
named `codex/w0-i07b-apply-r1`, bound to exact Fabric base
`3292a65a089385b3c072de53d9da6ccdb7056109`.

Fabric allowlist:

1. `contracts-vendor/json-schema/cybrik.capability.v1.schema.json`;
2. `contracts-vendor/contracts.lock.json`;
3. `contracts-vendor/README.md`;
4. `tests/control-plane/test_capability_name_canonicalization_red.py`;
5. `tests/control-plane/test_contract_provenance.py`;
6. `tests/conformance/test_capability_conformance.py`;
7. `docs/operations/WAVE-1-CONTRACT-CONFORMANCE-PACKET.md` — truthfulness hunk only.

Required semantics:

- vendored schema is a byte-for-byte copy of the committed Suite v0.1.1 member;
- vendored capability row hash must be
  `sha256:278c8837dcc5352c3b59bbebfa1214b8150169b14c1d4823b66941de229a71f7`;
- lock top-level `packet_version` / `x-cybrik-packet-version` become `0.1.1`, meaning the mutable
  pre-GA snapshot revision;
- all six lock rows receive `packet_version: 0.1.1` because they belong to that snapshot, while a
  new per-row `contract_version` records the source member version: capability `0.1.1`, the five
  unchanged files `0.1.0`;
- every row pins the exact Suite provenance commit and recomputed `sha256:` digest;
- strict trailing-LF test changes from expected RED to GREEN without trimming, lowercasing or
  modifying `validate_capability()` logic;
- provenance and conformance tests assert the new snapshot/member-version semantics; per-row
  `contract_version` may be asserted directly from the raw lock JSON, so no provenance-parser
  source change is authorized;
- README and operations packet state the mixed per-contract versions and retained v0.1.0
  rollback snapshot truthfully. The WAVE-1 operations truthfulness hunk must update both its
  current-state reconciliation note and the stale lock-description table at lines 62–69; leaving
  either section as current v0.1.0 wording is a validation failure.

After full relevant Fabric validation and independent review, authorize one local, path-limited
Fabric commit containing only these seven allowlist entries. It grants no push, merge, publish,
deployment or release authority.

## 3. Rollback and stop conditions

Rollback is content-addressed and ordered:

1. stop Fabric consumption of the v0.1.1 snapshot;
2. select the retained v0.1.0 snapshot/lock and rerun provenance/conformance;
3. never rewrite rejected names, signatures, digests, policies or receipts automatically;
4. do not roll back unrelated Suite/Fabric dirty paths.

Stop immediately before staging/commit if:

- a base SHA differs;
- any allowlist path has an unreviewed collision;
- the 4/4/0 inventory changes or a live invalid name is discovered;
- any required standalone, aggregate, cross-runtime, provenance or product test fails;
- a diff includes a denylisted or unrelated path;
- the exact Suite source commit cannot be pinned truthfully.

## 4. Alternatives

| Option | Meaning |
|---|---|
| **A — approve bounded application and two local provenance commits (recommended)** | Executes A1–A4 in order; no push/merge/release. |
| B — approve I01 only | Canonically applies/reviews I01, then opens I02; I07B remains proposed and strict-RED-only. |
| C — preparation only | Keeps both applications frozen and permits only further read-only review. |

## 5. Gate answers for Option A

| Gate | Recommended answer |
|---|---|
| G-W0BB-1 — apply only the 12-entry I01 allowlist with four hunk-only catalogs | Yes |
| G-W0BB-2 — keep I01 standalone/denylist/TR-5 boundaries and require independent review | Yes |
| G-W0BB-3 — open I02 only after reviewed I01 plus exact Suite provenance commit; keep I03 sequential | Yes |
| G-W0BB-4 — apply the reviewed I07B guard as capability member v0.1.1 and accept/apply ADR-0010 | Yes |
| G-W0BB-5 — use packet snapshot 0.1.1, mixed per-contract versions, all 13 Suite hashes and the exact `validate-schemas.mjs` hunk | Yes |
| G-W0BB-6 — authorize the exact path-limited local Suite provenance commit, no push/merge | Yes |
| G-W0BB-7 — refresh only the seven Fabric allowlist entries after the Suite commit exists | Yes |
| G-W0BB-8 — use Fabric snapshot 0.1.1 plus explicit per-row contract versions and exact source SHA/digests | Yes |
| G-W0BB-9 — require strict RED→GREEN, full relevant validation, review and exact local Fabric commit only | Yes |
| G-W0BB-10 — preserve v0.1.0 rollback, no auto-rewrite/live-registry/runtime/GA/release claim | Yes |

## 6. Recorded Founder decision

- Option: **A — bounded canonical application**
- G-W0BB-1..10: **yes**
- Decided by: **Founder**
- Decided on: **2026-07-26**
- Authorized commits: exactly one local path-limited Suite provenance commit from A3 and exactly
  one local path-limited Fabric provenance commit from A4.
- Explicitly unauthorized: push, merge, publication, deployment, migration, credential access,
  release action and release-date change.
- Exact answer:

```text
Duyệt W0 Bundle B=A (G-W0BB-1..10=yes); cho phép 2 local path-limited provenance commits; không push/merge/release
```

This shorthand grants exactly Option A and every named gate above. Any other commit, push, merge,
publication, deployment, migration, credential or release action remains unauthorized.

## 7. Execution-discovered byte-pin contradiction

The A2 application stopped before manifest update, staging or commit because the approved
security semantics and the approved SHA-256 cannot identify the same file:

| Candidate | Guard present | Python jsonschema trailing-LF result | SHA-256 |
|---|---:|---|---|
| approved dry-run byte pin | no | incorrectly accepted | `278c8837dcc5352c3b59bbebfa1214b8150169b14c1d4823b66941de229a71f7` |
| required guarded apply-form | yes | rejected | `7858dc758e078a0507096cfa742eb61a1cdf1531de89e76b48e1e22649cc6155` |

The discrepancy is reproducible as a one-hunk diff: the `278c...` file contains the approved
version/description change but does not contain
`"not": { "pattern": "[^a-z0-9_.]" }`. Adding that exact guard to the exact Suite base produces
`7858...`. Python jsonschema 4.26.0 accepts `"fabric.isolate_host\n"` under `278c...` and rejects
it under `7858...`.

Because G-W0BB-4 requires the guard while A2 byte-pins `278c...`, no honest implementation can
satisfy both controls. A1 remains independently reviewed and green. The guarded A2 diff is
preserved uncommitted in the isolated application worktree, but A2 must not update the manifest,
stage or commit until the Founder confirms this narrow correction:

```text
Duyệt W0 Bundle B hash correction: thay SHA capability v0.1.1 từ 278c8837dcc5352c3b59bbebfa1214b8150169b14c1d4823b66941de229a71f7 sang 7858dc758e078a0507096cfa742eb61a1cdf1531de89e76b48e1e22649cc6155; giữ nguyên guard "not": { "pattern": "[^a-z0-9_.]" } và G-W0BB-1..10; không mở rộng scope/commit/push/merge/release.
```

This correction changes no contract intent, path allowlist, commit count, application order or
release date. It replaces only the impossible pre-guard digest with the digest of the already
approved guarded bytes.

### 7.1 Recorded Founder correction

- Correction: replace the impossible pre-guard digest
  `278c8837dcc5352c3b59bbebfa1214b8150169b14c1d4823b66941de229a71f7` with the guarded digest
  `7858dc758e078a0507096cfa742eb61a1cdf1531de89e76b48e1e22649cc6155`.
- Guard: unchanged — `"not": { "pattern": "[^a-z0-9_.]" }`.
- G-W0BB-1..10: unchanged at **yes**.
- Scope and authority: unchanged; exactly two local path-limited provenance commits, no
  push/merge/release.
- Decided by: **Founder**
- Decided on: **2026-07-26**
- Exact answer:

```text
Duyệt W0 Bundle B hash correction: thay SHA capability v0.1.1 từ 278c8837dcc5352c3b59bbebfa1214b8150169b14c1d4823b66941de229a71f7 sang 7858dc758e078a0507096cfa742eb61a1cdf1531de89e76b48e1e22649cc6155; giữ nguyên guard "not": { "pattern": "[^a-z0-9_.]" } và G-W0BB-1..10; không mở rộng scope/commit/push/merge/release
```

A2 may now continue with the guarded bytes. All original A1–A4 validators, reviews, path audits
and commit ordering remain mandatory.

## 8. A1/A2 application evidence

The isolated Suite application worktree is bound to exact base
`55e94c2815ee68ef49a6e10cdc41a76c227b7bd7`.

- A1 contains exactly 34 new investigation files plus the four authorized catalog hunks.
  Standalone validation is green: 5 schemas loaded, 4 compiled, 9/9 positive, 8/8
  negative-schema, 9/9 negative-semantic, 45/45 fixture-verifiable invariants and TR-5 retained
  as `declared_runtime_only`. Aggregate regression is green. Independent A1 review reports no
  P0–P3.
- A2 contains exactly the four authorized Suite paths. The capability schema has the exact guard
  and corrected SHA `7858dc758e078a0507096cfa742eb61a1cdf1531de89e76b48e1e22649cc6155`.
  The packet snapshot is mutable pre-GA `0.1.1`, capability member `0.1.1`, the other twelve
  members `0.1.0`, all 13 SHA-256 values verified, 25/25 hardenings green and v0.1.0 rollback
  retained. Independent A2 review reports no P0–P3.
- OpenAPI aggregate validation remains 0 errors with known warnings; AsyncAPI remains 0 errors.
- No live-registry, deployed-runtime, stable-v1/GA or release claim is made.

The conditions for A3 are satisfied. The only authorized next Git mutation is the exact
path-limited local Suite provenance commit after an independent staged-path review proves all and
only the 46 approved paths.
