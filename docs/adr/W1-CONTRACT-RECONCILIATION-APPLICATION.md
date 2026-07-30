# W1 C1/G1 + corrected C2 contract reconciliation application

- **Prepared:** 2026-07-30
- **Authority:** Founder ballot `W1-C1C2-AR-REVISION=R1`
- **Lifecycle:** `ACCEPTED-AND-LOCALLY-INTEGRATED — REHEARSAL ONLY — NONCANONICAL`
- **Release impact:** none; every published W0–W6 date and release milestone is unchanged
- **Runtime impact:** none; local stack, demo, UAT, POC and RC remain `NO-GO`
- **External impact:** none; no canonical commit, push, PR, merge-to-branch, publication or release

This application records the exact state proven inside the disposable local shared-object clone
`/tmp/cybrik-w1-c1c2-ar-r1.TzFznl/repo`. “Locally integrated” in this document always means the two
noncanonical rehearsal merge objects below. It does not mean that any canonical branch moved, and
neither rehearsal object may be pushed.

## 1. Authoritative contract states

| Lane | Authoritative state | Packet evidence | Registered tests |
|---|---|---|---|
| W1-C1 | correction `20cfa36c503e5a95341c80653d25d2000d65c9fe`; carried by C1/G1 tip `71857395332fabe041896ca0700fbf7a2bf612d3` | exactly 16 correction paths; `MEMBER-SET-SHA256/v1` `27a6bdeb168599dc4fd05e27f06785315a3b763647826559efe9d721bc0292c8` | 21 |
| W1-G1 | transport repin `71857395332fabe041896ca0700fbf7a2bf612d3` | exactly 9 repin paths; `MEMBER-SET-SHA256/v1` `a285fa8e4850999dc013b03506ed1e62f5c7bb4209d198a4e16fa02c446b43f4` | 37 |
| corrected W1-C2/BSR1 | `5a1ed0001a5714b7f099aeaff3f5a74cb67c068a` | exactly 7 lifecycle-reconciliation paths; full packet exactly 32 paths and 30 members; aggregate `d741f22470a59bde5f0761dd6f3309acb9bb9b851970bc95c5228efd135a5449` | 40 |

Immutable Bundle v0.1.0 remains pinned by SHA-256
`501cb160f2fe7035c824d5b0ab37b74d5624cf99a7c25c7adffa72dff9c53bb1` as supported legacy
read/replay input. Corrected Bundle v0.1.1 is authoritative for new production and bundle-read
responses. This static contract acceptance is not runtime proof and does not migrate a consumer.

## 2. Immutable historical provenance

The following identities remain historical facts and are not rewritten or erased:

- W1-C1 accepted baseline `3a2c71555a423465855ffaddcb663c8b704dbfbd`;
- pre-correction transport line `a976a205601de22dae59e5112e37ae29707fda0e`;
- pre-BSR1 W1-C2 accepted line `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`;
- pre-BSR1 rehearsal merge `d6e53221…` and tree `4ecc9658…` as dated, superseded evidence from a
  prior disposable clone only; those old objects are not required or asserted to exist here.

The corrected identities in §1 supersede these only for current implementation. Historical
acceptance records retain the status they had when written.

## 3. Deterministic two-merge rehearsal

| Step | Exact commit | Exact parents, in order | Exact tree |
|---|---|---|---|
| control base | `b2caf77c3cd96beb7383cc3d93844d771262ea5f` | historical parent not repinned here | `594c42d9749fe81d3ffdf9b71763b8efac80c9c5` |
| merge 1 | `87efae7898bd14e9aa9a2866380a9973d8b3e5bc` | `b2caf77c3cd96beb7383cc3d93844d771262ea5f`, `71857395332fabe041896ca0700fbf7a2bf612d3` | `abb4d16d1c6038ccc33931c009628a47b2b0bd68` |
| merge 2 | `900d83a61515f37ae117e04763da1881cba90b7b` | `87efae7898bd14e9aa9a2866380a9973d8b3e5bc`, `5a1ed0001a5714b7f099aeaff3f5a74cb67c068a` | `a297646ec6d4901c8861d28b5ec8736f65902b70` |

Both merges used `Cybrik Codex Governor <codex-governor@local.invalid>`, no signing, no hooks and no
manual tree edit. Merge 1 used subject `rehearsal(w1): combine control and corrected C1/G1` and
time `2026-07-30T16:00:00+07:00`; merge 2 used subject
`rehearsal(w1): add corrected C2/BSR1 lifecycle` and time `2026-07-30T16:01:00+07:00`.

The control validator must read live Git objects and fail closed unless the exact commit objects,
trees, parent ordering, ancestry and rehearsal tip above are present.

## 4. Exact draft scope

### CONTROL9

1. `docs/adr/W1-CONTRACT-RECONCILIATION-APPLICATION.md`
2. `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md`
3. `docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md`
4. `docs/adr/README.md`
5. `docs/operations/W1-48-AGENT-ROLLING-BOARD.md`
6. `docs/operations/W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md`
7. `docs/operations/W1-E2-EVIDENCE-REGISTER.md`
8. `tools/operations/validate-w1-control.mjs`
9. `tools/operations/tests/validate-w1-control.test.mjs`

### CI3

1. `.github/workflows/contracts.yml`
2. `tools/contract-validation/package.json`
3. `tools/contract-validation/validate.mjs`

The reviewed pre-commit draft consists of exactly these 12 paths. No tenth CONTROL path, fourth CI
path, dependency or lockfile belongs to this gate. The delegated-governor disposition in §6
authorizes one local-only commit containing this exact combined scope.

## 5. Boundaries

- Static contract conformance only; no runtime, consumer migration, stable-v1/GA or release proof.
- Exactly one local-only commit of the combined CONTROL9 + CI3 scope is authorized; no source or
  canonical ref movement, push, PR or merge-to-branch is authorized.
- W0 remains `COMPLETE=0` / `NO-GO`.
- Release dates remain unchanged.
- Runtime/local stack/demo/UAT/POC/RC/deployment remain `NO-GO`.
- Any external integration or status promotion remains outside this disposition.

## 6. Delegated-governor disposition

**Decision:** `DELEGATED-GOVERNOR-ACCEPTED`.

The Founder delegated routine technical review and gate decisions to Codex Governor. The initial
independent Opus review returned `P0=0`, `P1=0`, `P2=2`, `P3=4`; every recorded finding was
remediated test-first. The post-remediation Opus re-review produced no verdict after the
600-second cycle and the single authorized 601-second extension. Codex then found and repaired two
additional CI enforcement gaps and completed a delegated self-review at
`P0=0`, `P1=0`, `P2=0`, `P3=0`.

The delegated governor accepts that self-review as the explicit risk disposition for this gate and
authorizes exactly one local-only commit of the 12 paths in §4. This decision does not claim a
completed post-remediation independent review and does not authorize canonical ref movement,
push, PR, merge-to-branch, runtime, UAT, deployment or release.

The unchanged lockfile was audited with `npm audit --audit-level=high` under Node.js 20.18.1. It
reported 0 Critical and 13 High dependency entries, all rooted in the Spectral/AsyncAPI validation
toolchain path to `brace-expansion` advisory `GHSA-mh99-v99m-4gvg`; the offered automatic fix is a
breaking major-version change. This pre-existing toolchain finding does not block the local
evidence commit, but it blocks CI3 activation or push until a separate dependency-remediation
packet proves compatibility and clears the audit. No dependency or lockfile byte is changed here.

## 7. Current canonical-integration supersession — 2026-07-30

Current lifecycle:
`CANONICAL-INTEGRATED — STATIC CONTRACT AND CONTROL EVIDENCE ONLY`.

The dependency remediation and exact CONTROL9 + CI3 tree landed through GitHub PR #1 at canonical
merge `28c564eb9b6853b73a18a59a2e84ba58fd67816a`, with tree
`f222fad6bc6d3682684a0975f47a5415f7f716dc`. Its parents, in order, are canonical base
`5a4823f06ce9b12083e13cf9b1031f46130d90a8` and reviewed implementation
`f82f45e8d56be27651c56e8d1510877f48563224`. The deterministic rehearsal tip
`900d83a61515f37ae117e04763da1881cba90b7b` is an ancestor of that canonical merge.

This section supersedes only the forward-looking noncanonical/local-only posture in §§4–6. Those
sections remain immutable dated provenance for the authority and evidence available before PR #1.
It does not turn static contract conformance into runtime proof, does not open G-C
`stable-v1.0`, and does not authorize production. Release dates remain unchanged.
