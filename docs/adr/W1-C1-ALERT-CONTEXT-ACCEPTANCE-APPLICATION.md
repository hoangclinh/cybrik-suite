# W1-C1 alert-context contract acceptance application

- **Prepared:** 2026-07-26
- **Applied:** 2026-07-26
- **Status:** `APPLIED 2026-07-26 — W1-C1 CONTRACT ACCEPTANCE RECORDED — LOCAL COMMIT ONLY — NO PUSH, MERGE OR RELEASE AUTHORITY`
- **Applies to:** the W1-C1 `soc.get_alert_context@0.1.0` capability packet
- **Applied under:** W1-C1/C2 Option A **accepted 2026-07-26** under Founder-delegated
  current-thread authority (`C1-1..C1-10=yes`)
- **Resulting contract status:** `ACCEPTED FOR IMPLEMENTATION v0.1.0` — not stable
  v1/GA; contract-first implementation basis only; no runtime, dependency, database,
  container, endpoint, transport, CI-wiring, push, merge, deployment or release authority
  follows
- **Release impact:** none. W0–W6 dates and the 2026-12-21 → 2026-12-31 release window remain
  unchanged. No release claim is made or implied.

This document records an applied contract acceptance. It moved the W1-C1 packet to
`ACCEPTED FOR IMPLEMENTATION v0.1.0` and recorded it as a path-limited **local commit** on its own
branch. It does **not** push or merge that branch, supersede any other accepted contract, install a
dependency, start a database or container, or open SOC, Cyber AI, Fabric, integration, deployment or
release work.

## 1. Exact accepted identity

| Field | Exact value |
|---|---|
| Repository | `cybrik-suite` |
| Worktree | `w1-i01-alert-context-proposal-r1` |
| Branch | `codex/w1-i01-alert-context-proposal-r1` |
| Accepted local commit | `3a2c71555a423465855ffaddcb663c8b704dbfbd` |
| Parent commit | `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619` |
| Pushed / merged / released | no / no / no |
| Accepted paths | exactly 16, all added by the accepted commit |
| Lane | W0-I01 / W0-T01 |
| Final independent review | W0-R05 `PASS` (cross-lane reviewer; the authoring lane did not review itself) |

## 2. Exact path allowlist — 16 paths

The recorded acceptance applies to exactly these 16 paths and to no other path. They are exactly the
paths added by the accepted commit `3a2c71555a423465855ffaddcb663c8b704dbfbd`. Any additional,
renamed or removed path voids this acceptance and requires a fresh application.

| # | Path |
|---|---|
| 1 | `contracts/compatibility/cybrik-suite-alert-context-packet.v1.manifest.json` |
| 2 | `contracts/examples/alert-context/examples-manifest.json` |
| 3 | `contracts/examples/alert-context/negative-schema/request.alert-ref-missing-digest.json` |
| 4 | `contracts/examples/alert-context/negative-schema/request.execution-grant-in-body.json` |
| 5 | `contracts/examples/alert-context/negative-schema/request.w2f-delegation-as-tool-grant.json` |
| 6 | `contracts/examples/alert-context/negative-schema/result.existence-leak.json` |
| 7 | `contracts/examples/alert-context/negative-semantic/request.cross-tenant-actor.json` |
| 8 | `contracts/examples/alert-context/negative-semantic/result.clearance-exceeded.json` |
| 9 | `contracts/examples/alert-context/negative-semantic/result.cross-org.json` |
| 10 | `contracts/examples/alert-context/negative-semantic/result.digest-mismatch.json` |
| 11 | `contracts/examples/alert-context/positive/request.json` |
| 12 | `contracts/examples/alert-context/positive/result.available.json` |
| 13 | `contracts/examples/alert-context/positive/result.unavailable.json` |
| 14 | `contracts/json-schema/cybrik.soc-get-alert-context.v1.schema.json` |
| 15 | `tools/contract-validation/tests/validate-alert-context.test.mjs` |
| 16 | `tools/contract-validation/validate-alert-context.mjs` |

Paths 15 and 16 are standalone validation tooling. They are **not** packet members and are **not**
inputs to the member-set digest below; they are covered by the allowlist because they are part of
the candidate byte set.

## 3. Digest algorithm

The packet declares `MEMBER-SET-SHA256/v1` in
`contracts/compatibility/cybrik-suite-alert-context-packet.v1.manifest.json`
(`member_set_integrity.algorithm`), quoted exactly:

> Reduce every entry of `members[]` to exactly `{file, kind, contract_version, sha256}`, sort the
> reduced entries by `file` in Unicode code point order, serialize that array as RFC 8785 (JCS)
> canonical JSON, and render `member_set_digest` as `sha256:<lowercase hex SHA-256 over those
> UTF-8 bytes>`. The digest input is derived from `members[]` only: `member_set_integrity` itself
> and every other manifest key are excluded, so the aggregate is non-circular and is recomputed
> without reading its own declared value.

Per-member digests are the lowercase hex SHA-256 of the exact on-disk UTF-8 bytes of
`contracts/<file>`.

## 4. Per-member hash evidence — 13 members

Declared `member_count`: **13**. The table below is the **pre-acceptance** verification round,
retained as history: each row was independently recomputed from the then-current on-disk candidate
bytes and matched the manifest-declared value, 0 mismatches of 13.

The **post-acceptance** verification against the committed bytes of
`3a2c71555a423465855ffaddcb663c8b704dbfbd` is recorded in §4.1 and §5; it also matched 13/13 with 0
mismatches. The individual post-acceptance member digests are carried by the packet manifest inside
that commit and are not reproduced here, because this document is written outside that worktree.

| # | Member path | Kind | SHA-256 (verified) |
|---|---|---|---|
| 1 | `contracts/examples/alert-context/examples-manifest.json` | example-manifest | `b1f56049ef6a6e05a2e0ec370dfe49e327db597ff3302b9fc9269593c7db818d` |
| 2 | `contracts/examples/alert-context/negative-schema/request.alert-ref-missing-digest.json` | negative-schema | `dc65aa8d454c9d4c611a28e06d4c023b10661cd7262d8a545cbcf131e1b75a6d` |
| 3 | `contracts/examples/alert-context/negative-schema/request.execution-grant-in-body.json` | negative-schema | `c3a9896ef6a6c2a535afa77f1169d08374facef172b976e4f6f38105daca977b` |
| 4 | `contracts/examples/alert-context/negative-schema/request.w2f-delegation-as-tool-grant.json` | negative-schema | `6577be20085e5e86e5d63f0edbe96d282b791347f2df1944ae18516480e89bfb` |
| 5 | `contracts/examples/alert-context/negative-schema/result.existence-leak.json` | negative-schema | `d6187663a0641f4ff69300afff8d4021b8b03fc9912e4a6e0ce4e0d6aaf6b6c3` |
| 6 | `contracts/examples/alert-context/negative-semantic/request.cross-tenant-actor.json` | negative-semantic | `c2311e6a5ac6f7a107bbc87a42d89fe633e625d49db9cb5e7c9c0543576c609f` |
| 7 | `contracts/examples/alert-context/negative-semantic/result.clearance-exceeded.json` | negative-semantic | `32c21a9f2e25c984226acdb53e2af23bdd7c981fe76a8f0c4e68b548c0e9f38a` |
| 8 | `contracts/examples/alert-context/negative-semantic/result.cross-org.json` | negative-semantic | `3f27b2ccc9d037cc48909af4742cf9e06edbcfc4c6316376373e1d87cbcc06b7` |
| 9 | `contracts/examples/alert-context/negative-semantic/result.digest-mismatch.json` | negative-semantic | `06bea22c9e6610363abc49583f845bcddb2976c2dc4378d36585ef670d21c3b0` |
| 10 | `contracts/examples/alert-context/positive/request.json` | positive | `d2734f9fb9ad71d177a5365e2b711c09de8d7c5e95373242c6ee18f87b9158b1` |
| 11 | `contracts/examples/alert-context/positive/result.available.json` | positive | `c79a437a3ff1608aa06021c8fc08063e3f8c18168dc6e0fcdf210d61a2f7a031` |
| 12 | `contracts/examples/alert-context/positive/result.unavailable.json` | positive | `a1cabf3ecfb7fde87b15cd2a439a22c51716d1890ed97b512a247c5b3ca30233` |
| 13 | `contracts/json-schema/cybrik.soc-get-alert-context.v1.schema.json` | json-schema | `a5c5c471bdd70b6bc46c18628171ca5a696f2a207b3850c06256d816aabb0f4b` |

### 4.1 Post-acceptance member verification

| Field | Value |
|---|---|
| Verified against | committed bytes of `3a2c71555a423465855ffaddcb663c8b704dbfbd` |
| Declared `member_count` | 13 |
| Member hashes matched | 13/13 |
| Mismatches | 0 |

## 5. Aggregate digest

| Field | Value |
|---|---|
| Declared `member_set_digest` | `sha256:e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35` |
| Independently recomputed from the accepted commit | `sha256:e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35` |
| Result | match |
| Superseded pre-acceptance values, retained as history | `ce9921d3…`, then `cd872a0e…` |

The recomputation consumed only the 13 reduced member entries, so it does not read its own
declared value.

## 6. Verification evidence

| Check | Exact result |
|---|---|
| Standalone validator `node tools/contract-validation/validate-alert-context.mjs` | `PASS` |
| Adversarial + positive test suite | `21/21` |
| Branch coverage of `tools/contract-validation/validate-alert-context.mjs` | `87.27%` against the declared `80%` floor |
| Member-hash verification | 13/13 match, 0 mismatches |
| Member-set digest | recomputes to the declared value |
| Path count | exactly 16, all added by the accepted commit |
| Full accepted-contract regression | green; no other accepted packet bytes or `$id` values change |
| Final independent review | W0-R05 `PASS`, no open P0–P2 |
| Pushed / merged / released | no / no / no |

**CI: NOT WIRED.** The packet declares `ci_wiring: "NOT WIRED"`. These commands are for
reproducible manual and reviewer execution only. Registering them in
`tools/contract-validation/package.json` scripts and in a pipeline is a later integration gate that
is deliberately out of scope. **No CI result is claimed by this application.**

## 7. Static-only boundaries

This application records **static evidence only**. It proves packet, schema, fixture, member-hash
and member-set integrity, and nothing beyond that.

- Runtime authorization is **not** proven.
- No-existence-leak **timing** and audit equivalence are **not** proven; static fixtures prove
  response *shape* only.
- No endpoint, transport binding, queue, MCP surface or service discovery is proposed, implemented
  or accepted.
- No Capability Registry entry, Fabric invocation grant or tool-execution authority follows.
- W2-F inference delegation remains the SOC→Cyber AI inference seam only and is never a Fabric
  tool grant.
- Durability, live SOC→AI→Fabric execution and a returned Bundle are **not** demonstrated.
- Release certification is **not** demonstrated.
- W1-C1 evidence supports the request-clearance ceiling on result marking only; it does **not**
  prove an authoritative source-marking floor.

## 8. Evidence reconciliation — history retained, not current status

### 8.1 Second repair — re-pinned to the accepted commit, 2026-07-26

Acceptance moved the authoritative byte set from the uncommitted worktree to the local commit
`3a2c71555a423465855ffaddcb663c8b704dbfbd`, and the final review round added test cases. §5 and §6
above carry the values recomputed from those committed bytes; the pre-acceptance values below are
retained as history.

| Attribute | Superseded pre-acceptance value | Current value |
|---|---|---|
| Aggregate | `cd872a0e…` | `sha256:e4cfbf8c…` |
| Test count | `18/18` | `21/21` |
| Coverage | `87.87%` branch coverage | `87.27%` branch coverage against the declared 80% branch floor |
| Path count | 16 | 16 (never superseded) |

That re-pinning was carried out under the nineteen-path authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.7. It changed documentation and validator bytes
only: nothing was pushed, merged or released.

### 8.2 First repair — pre-acceptance pinned gate rows, 2026-07-26

`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` §1 and
`docs/operations/W1-E2-EVIDENCE-REGISTER.md` §1 previously carried a W1-C1 aggregate value and a
line-coverage figure that did **not** reproduce from the current candidate bytes under the packet's
declared `MEMBER-SET-SHA256/v1` algorithm or under any other tried aggregation.

| Attribute | Superseded value formerly pinned in the decision-gate/register rows | Value now pinned there, re-verified in §4–§6 |
|---|---|---|
| Aggregate | an earlier `ce9921d3…` value | `sha256:cd872a0e8d25c8de6224bf5f9aecaeba795836cee77355d416690ee47524502c` |
| Coverage | `90.39%` line coverage | `87.87%` branch coverage against the declared 80% branch floor |
| Test count | `18/18` | `18/18` (never superseded) |
| Path count | 16 | 16 (never superseded) |

Those rows and the matching pins in `tools/operations/validate-w1-control.mjs`
(`W1_C1_CANDIDATE_ROW`, `validateE2Register`) and its test suite were repaired **together** under a
separate bounded five-path authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.4. That repair changed documentation and
validator bytes only: it accepted nothing, flipped no status, and staged, committed and installed
nothing. The validator now additionally fails closed on reintroduction of the stale `ce9921d3…` or
`90.39%` line-coverage pins into a live candidate-evidence row.

The values in §5–§6 above are authoritative for this application and agree with the decision-gate
and register rows.

## 9. What the recorded acceptance did and did not do

The recorded acceptance moved exactly the 16 paths in §2 to `ACCEPTED FOR IMPLEMENTATION v0.1.0` and
recorded them as the local commit `3a2c71555a423465855ffaddcb663c8b704dbfbd`. It did **not**:

- push or merge that branch, or grant publication, merge, release or release-date authority;
- open any SOC, Cyber AI or Fabric product or runtime writer;
- select or install any dependency, or start any database or container;
- authorize an endpoint, transport, registry or consumer implementation;
- promote the contract beyond `v0.1.0` toward stable v1/GA;
- grant any integration or deployment authority.

## 10. Residual gates

1. **Publication gate** — the accepted branch has not been pushed; pushing needs its own decision.
2. **Pinned-row correction gate — closed 2026-07-26.** The pre-acceptance rows were first corrected
   under the bounded five-path authority recorded in
   `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.4, then re-pinned to the committed bytes of
   the accepted commit under the nineteen-path authority recorded in §14.7 of that board, as
   detailed in §8.1 and §8.2. Documentation and validator bytes only. No open gate remains from
   this item; gates 1 and 3–6 are unaffected.
3. **Merge gate** for the accepted 16-path commit.
4. **Separate transport/endpoint/registry gate** — C1-10 defers `include_descendants` permission,
   digest signing/attestation, timing/audit targets and transport binding to explicit follow-on
   gates.
5. **CI wiring gate** — validator/test registration and pipeline invocation remain unwired.
6. **Runtime obligations** TR-7/TR-8/TR-9 (timing equivalence, SOC-owned org-hierarchy resolution,
   audit digest recording) remain runtime-only and unproven.

This application is `APPLIED 2026-07-26` and the W1-C1 packet is
`ACCEPTED FOR IMPLEMENTATION v0.1.0` as a local commit only.

## 11. 2026-07-30 corrected-state reconciliation

Founder decisions `W1-REC-1=YES` and `W1-REC-2=YES` make correction
`20cfa36c503e5a95341c80653d25d2000d65c9fe` and its 16-path
`MEMBER-SET-SHA256/v1`
`27a6bdeb168599dc4fd05e27f06785315a3b763647826559efe9d721bc0292c8`
authoritative for new implementation. Descendant
`71857395332fabe041896ca0700fbf7a2bf612d3` is the authoritative 9-path transport repin with
`MEMBER-SET-SHA256/v1`
`a285fa8e4850999dc013b03506ed1e62f5c7bb4209d198a4e16fa02c446b43f4`.
The registered suites remain 21 W1-C1 tests and 37 W1-G1 tests.

The original `3a2c71555a423465855ffaddcb663c8b704dbfbd` acceptance and the
`a976a205601de22dae59e5112e37ae29707fda0e` transport generation remain immutable historical
provenance. The corrected state is `ACCEPTED-AND-LOCALLY-INTEGRATED — REHEARSAL ONLY —
NONCANONICAL` at the exact topology in `W1-CONTRACT-RECONCILIATION-APPLICATION.md` §3. This grants
no canonical commit, push, merge-to-branch, consumer migration, runtime, UAT or release authority.

## 12. Current canonical landing — 2026-07-30

The corrected W1-C1/W1-G1 state is now
`CANONICAL-INTEGRATED — STATIC CONTRACT AND CONTROL EVIDENCE ONLY` through GitHub PR #1 merge
`28c564eb9b6853b73a18a59a2e84ba58fd67816a`. This supersedes the forward-looking publication,
merge and CI-wiring residuals in §§9–11. It preserves their dated provenance and does not prove an
endpoint, consumer migration, runtime, UAT, stable-v1/GA or production deployment.
