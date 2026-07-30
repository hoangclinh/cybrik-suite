# W1-C2 investigation lifecycle contract acceptance application

- **Prepared:** 2026-07-26
- **Applied:** 2026-07-26
- **Status:** `APPLIED 2026-07-26 — W1-C2 CONTRACT ACCEPTANCE RECORDED — LOCAL COMMIT ONLY — NO PUSH, MERGE OR RELEASE AUTHORITY`
- **Applies to:** the W1-C2 investigation create/status/checkpoint/cancel/bundle-read packet
- **Applied under:** W1-C1/C2 Option A **accepted 2026-07-26** under Founder-delegated
  current-thread authority (`C2-1..C2-10=yes`)
- **Resulting contract status:** `ACCEPTED FOR IMPLEMENTATION v0.1.0` — not stable
  v1/GA; contract-first implementation basis only; no runtime, dependency, database,
  container, endpoint, server, transport, CI-wiring, push, merge, deployment or release
  authority follows
- **Release impact:** none. W0–W6 dates and the 2026-12-21 → 2026-12-31 release window remain
  unchanged. No release claim is made or implied.

This document records an applied contract acceptance. It moved the W1-C2 packet to
`ACCEPTED FOR IMPLEMENTATION v0.1.0` and recorded it as a path-limited **local commit** on its own
branch. It does **not** push or merge that branch, adopt Bundle v0.1.1, supersede Bundle v0.1.0,
migrate any consumer, install a dependency, start a database or container, or open SOC, Cyber AI,
Fabric, integration, deployment or release work.

## 1. Exact accepted identity

| Field | Exact value |
|---|---|
| Repository | `cybrik-suite` |
| Worktree | `w1-i02-investigation-lifecycle-proposal-r1` |
| Branch | `codex/w1-i02-investigation-lifecycle-proposal-r1` |
| Accepted local commit | `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4` |
| Parent commit | `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619` |
| Pushed / merged / released | no / no / no |
| Accepted paths | exactly 32, all added by the accepted commit |
| Lane | W0-I02 / W0-R05 |
| Final independent review | W0-T01 `PASS` (cross-lane reviewer; the authoring lane did not review itself) |

## 2. Exact path allowlist — 32 paths

The recorded acceptance applies to exactly these 32 paths and to no other path. They are exactly the
paths added by the accepted commit `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`. Any additional,
renamed or removed path voids this acceptance and requires a fresh application.

| # | Path |
|---|---|
| 1 | `contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml` |
| 2 | `contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json` |
| 3 | `contracts/examples/investigation-lifecycle/examples-manifest.json` |
| 4 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-cancel-request.missing-version.json` |
| 5 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-checkpoint.sequence-zero.json` |
| 6 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-create-request.short-idempotency.json` |
| 7 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-create-request.tool-authority.json` |
| 8 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-lifecycle-error.existence-leak.json` |
| 9 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-bundle-read-result.marking-downgrade.json` |
| 10 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-cancel-request.stale-version.json` |
| 11 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-cancel-request.terminal-race.json` |
| 12 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-checkpoint.retry-mutates-terminal-attempt.json` |
| 13 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-create-request.cross-tenant.json` |
| 14 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-create-request.idempotency-conflict.json` |
| 15 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-status.org-mismatch.json` |
| 16 | `contracts/examples/investigation-lifecycle/positive/investigation-bundle-read-result.json` |
| 17 | `contracts/examples/investigation-lifecycle/positive/investigation-cancel-request.json` |
| 18 | `contracts/examples/investigation-lifecycle/positive/investigation-checkpoint.json` |
| 19 | `contracts/examples/investigation-lifecycle/positive/investigation-create-request.json` |
| 20 | `contracts/examples/investigation-lifecycle/positive/investigation-lifecycle-error.not-found.json` |
| 21 | `contracts/examples/investigation-lifecycle/positive/investigation-status.cancelled.json` |
| 22 | `contracts/json-schema/cybrik.investigation-bundle-read-result.v1.schema.json` |
| 23 | `contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json` |
| 24 | `contracts/json-schema/cybrik.investigation-cancel-request.v1.schema.json` |
| 25 | `contracts/json-schema/cybrik.investigation-checkpoint.v1.schema.json` |
| 26 | `contracts/json-schema/cybrik.investigation-create-request.v1.schema.json` |
| 27 | `contracts/json-schema/cybrik.investigation-lifecycle-common-defs.v1.schema.json` |
| 28 | `contracts/json-schema/cybrik.investigation-lifecycle-error.v1.schema.json` |
| 29 | `contracts/json-schema/cybrik.investigation-status.v1.schema.json` |
| 30 | `contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml` |
| 31 | `tools/contract-validation/tests/validate-investigation-lifecycle-proposal.test.mjs` |
| 32 | `tools/contract-validation/validate-investigation-lifecycle-proposal.mjs` |

Paths 31 and 32 are standalone validation tooling under `tools/`. They fall outside the packet's
declared `path_root` of `contracts/`, so they are **not** packet members and are **not** inputs to
the aggregate below; they are covered by the allowlist because they are part of the accepted byte
set. 32 accepted paths minus these 2 tooling paths equals the 30 packet members.

## 3. Digest algorithm

Declared in `contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json`
under `x-cybrik-packet-integrity`. Algorithm: `sha256`. Path root: `contracts/`.

**Per-member file digest rule (quoted exactly):**

> Every member except this manifest is digested as the lowercase hex SHA-256 of the exact on-disk
> UTF-8 bytes of `<path_root><file>`.

**Self-digest rule for the manifest member (quoted exactly):**

> This manifest's own member digest is deliberately NOT taken over its on-disk bytes. It is the
> lowercase hex SHA-256 of the UTF-8 encoding of `JSON.stringify(this manifest parsed as JSON with
> the top-level 'x-cybrik-packet-integrity' key removed)`. Because the hashed input excludes the
> integrity block, no digest input ever contains a digest, which is what makes the self entry and
> the aggregate below non-circular and independently reproducible. Consequence, stated
> deliberately: for this one member the digest pins the JSON value, not the on-disk byte
> formatting.

**Aggregate rule (quoted exactly):**

> Sort all 30 member entries ascending by `file` using JavaScript default string comparison, render
> each entry as the line `<sha256>  <file>` (two spaces), join the lines with a single `\n` and no
> trailing newline, then take the lowercase hex SHA-256 of the UTF-8 encoding of that string. The
> aggregate consumes only the 30 member digests, so it never depends on its own value.

## 4. Per-member digest evidence — 30 members, verified from the accepted commit

Declared `member_count`: **30**. Each row below was independently recomputed from the **committed
bytes of `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`** — including the manifest member under its
declared self-digest rule — and matched the manifest-declared value. Mismatches: **0 of 30**. Rows
are in the aggregate's declared sort order.

| # | Member path | SHA-256 (verified) |
|---|---|---|
| 1 | `contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml` | `c55ca124a193e2406b875af139e463e0e02e8b807c2a6baef616b63fe2f20fe4` |
| 2 | `contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json` | `5aaa272ca3e5facdaa8292f972d63d3113aa17366aea235354b46b49b26cbd03` |
| 3 | `contracts/examples/investigation-lifecycle/examples-manifest.json` | `9928bca0c79c91007cd864706348ccf7ddfb6c10bce3adf1d85e4a671f6be5bf` |
| 4 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-cancel-request.missing-version.json` | `80094dc8472767d4cf258a1d7fbf4c656cd9bd56a21d4bf027cec110b99376df` |
| 5 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-checkpoint.sequence-zero.json` | `22162a4c399f271a1406a217160d4052018d1bbf258e31fd9197aa3932756083` |
| 6 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-create-request.short-idempotency.json` | `50b6f19424c09fe3e7719266f292b630cdaa586732eb8174e60c317213441ca7` |
| 7 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-create-request.tool-authority.json` | `6fa4d527e7c58006d1d11e27868ff73a60d51dd31314ce6c045f9464ea3838fc` |
| 8 | `contracts/examples/investigation-lifecycle/negative-schema/investigation-lifecycle-error.existence-leak.json` | `1fc323c02fb5412b654669ddaaa6ee423eecb1e60808874347ef3f27ef8a1fda` |
| 9 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-bundle-read-result.marking-downgrade.json` | `667371ba664dcfc3bebb4555cfe3e2e2e94dd29ae7cc22a4b80086297ad9f659` |
| 10 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-cancel-request.stale-version.json` | `00e998d08b040ae959054ba9a1e629baabd2b2528e323bba8d07d58eba2b9e7c` |
| 11 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-cancel-request.terminal-race.json` | `ec1369bd959a169efb404a71883fe3913eba43b00384b1f3b15dbd33590acd4b` |
| 12 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-checkpoint.retry-mutates-terminal-attempt.json` | `54614a6e3e266e7d5607d24a862f03340064e07fb97f1f677040cbf9e6e94416` |
| 13 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-create-request.cross-tenant.json` | `0dd06dabe62f30687547e5df5f7b614f7d831572737424e6f5d30831dbe1909d` |
| 14 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-create-request.idempotency-conflict.json` | `a366cd94786e02d0239c62065b83ed1c2491e6785a7a01e1932cf29c2626f2dd` |
| 15 | `contracts/examples/investigation-lifecycle/negative-semantic/investigation-status.org-mismatch.json` | `ed5421987652dc89a4207e07d3512a0a0ade996951df2182a5cc7c94cd519017` |
| 16 | `contracts/examples/investigation-lifecycle/positive/investigation-bundle-read-result.json` | `d49df5e0c611f767ba79de036e2362d9762ed89b9380226973ba97065cd2366f` |
| 17 | `contracts/examples/investigation-lifecycle/positive/investigation-cancel-request.json` | `9a485fcc2274985ac575bf63b805fe2addebf7fd04af00f338b4238c1191f172` |
| 18 | `contracts/examples/investigation-lifecycle/positive/investigation-checkpoint.json` | `60005580ac7866aea88ef4df851d566a8f28d5db1e3d9e12c69839bb43a4d085` |
| 19 | `contracts/examples/investigation-lifecycle/positive/investigation-create-request.json` | `1c5f7861c019a894ff911239cf7f96eb25946bd2718876c8d294b990bd5e851a` |
| 20 | `contracts/examples/investigation-lifecycle/positive/investigation-lifecycle-error.not-found.json` | `ec7443e18b33b52765881dac6494f2b8d6b9957fd168a4fd607b45357343e9a5` |
| 21 | `contracts/examples/investigation-lifecycle/positive/investigation-status.cancelled.json` | `9dea079f3f2d0a2c572e1ccbfa1f154e1c5cc57b10970b8fb1a65efd26aa45fe` |
| 22 | `contracts/json-schema/cybrik.investigation-bundle-read-result.v1.schema.json` | `64d6600feda4f0bf6dfefc01ddeda38d324404eda616fe2b5183a3a7c1fb7246` |
| 23 | `contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json` | `ce2e255eb52e3f5122d304ec9162fe02b2d35012b4bf0a92747989281f32eea9` |
| 24 | `contracts/json-schema/cybrik.investigation-cancel-request.v1.schema.json` | `a236c0d819d9b6e97b88802ebc805483544554c90982f53960ad3d8f1abc7e70` |
| 25 | `contracts/json-schema/cybrik.investigation-checkpoint.v1.schema.json` | `ee226b9f4c1ff47a8e0a5a2514aa831504de5ee195ac5538de18085889615414` |
| 26 | `contracts/json-schema/cybrik.investigation-create-request.v1.schema.json` | `4cfe118bb2b2e7c8e51a70ce86e8f9cbc06cbe1621105efcd7400fd2bfbe46fd` |
| 27 | `contracts/json-schema/cybrik.investigation-lifecycle-common-defs.v1.schema.json` | `faca466b76d3df84a4b745d592fbb4c4f0f41cfe42a4d4f339710ba713412628` |
| 28 | `contracts/json-schema/cybrik.investigation-lifecycle-error.v1.schema.json` | `1d1a467e70c7e9824d0bd615b1fad7797b1c03f4a6e64ba18c0c77297fc8b31f` |
| 29 | `contracts/json-schema/cybrik.investigation-status.v1.schema.json` | `83e2ea1f74bc12333d7a954bfd9ede18b22386be16dee339b31bbeb149b86ca1` |
| 30 | `contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml` | `22cd7d71f89bd5c287b79e87015a28dd27fdbd124fd3a073e56346a4de3c318d` |

## 5. Aggregate digest

| Field | Value |
|---|---|
| Declared `aggregate_sha256` in the accepted commit | `0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e` |
| Independently recomputed from the accepted commit | `0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e` |
| Result | match |
| Superseded pre-acceptance values, retained as history | `f79702c6…`, then `16099c17…` |

The recomputation consumed only the 30 member digests, so it does not read its own declared value.

## 6. Verification evidence

| Check | Exact result |
|---|---|
| Standalone validator `node validate-investigation-lifecycle-proposal.mjs` | `PASS` |
| Test suite `node --test tests/validate-investigation-lifecycle-proposal.test.mjs` | `31/31` |
| Official Ajv 2020-12 strict mode | **8** strict-mode compilations, all clean |
| Spectral OpenAPI lint (`--fail-severity error`) | zero errors |
| AsyncAPI 3.0.0 parse | zero errors |
| Branch coverage of `validate-investigation-lifecycle-proposal.mjs` | `97.44%` |
| Member-digest verification | 30/30 match, 0 mismatches |
| Aggregate digest | recomputes to the declared value |
| Path count | exactly 32, all added by the accepted commit |
| Accepted-contract byte impact | none; no other accepted packet bytes or `$id` values change |
| Final independent review | W0-T01 `PASS`, no open P0–P3 |
| Pushed / merged / released | no / no / no |

The validator, Ajv, Spectral and AsyncAPI runs were executed in the authoring worktree with
`tools/contract-validation` as the working directory, in a checkout whose already-pinned validation
dependencies (`@asyncapi/parser` 3.6.0, `@stoplight/spectral-cli` 6.16.2, `ajv` 8.20.0,
`ajv-formats` 3.0.1) are installed. This packet installs nothing, adds no dependency and reaches no
network. The path count, the 30 member digests and the aggregate in §4–§5 were re-derived here
directly from the committed objects of `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`, without
installing anything and without touching the accepted bytes.

**CI: NOT WIRED.** The packet declares `ci_wiring: "NOT WIRED — these commands are declared for
reproducible manual and reviewer execution only."` Registering them in the canonical validation
orchestrator (`tools/contract-validation/validate.mjs`, `package.json` scripts) and in CI is a
later integration gate, deliberately out of scope. **No CI result is claimed by this application.**

## 7. Static-only boundaries

This application records **static evidence only**: schema, fixture, semantic-witness, member-digest
and aggregate integrity, plus offline OpenAPI/AsyncAPI/Ajv conformance.

- No server, endpoint, transport, queue or runtime binding is declared, implemented or accepted;
  the OpenAPI/AsyncAPI documents are contract artifacts, not a deployed surface.
- Runtime authorization, durability and restart survival are **not** proven.
- Timing equivalence for unknown vs unauthorized IDs remains a **runtime-only** obligation; the
  sanitized-error positive and existence-decoy negative fixtures prove response shape only.
- Compare-and-set cancel, monotonic checkpoint sequencing and immutability of terminal
  attempts/prior receipts are contract obligations, not demonstrated runtime behavior.
- Live SOC→AI→Fabric execution and a returned Bundle are **not** demonstrated.
- W2-D remains the sole inference-path owner; W2-F remains only the SOC→Cyber AI
  identity/delegation seam and grants no Fabric execution authority.
- Release certification is **not** demonstrated.

## 8. Bundle version guard

Bundle **v0.1.1 is only a proposed successor candidate**. Bundle **v0.1.0 remains the authoritative
Bundle contract** and its bytes stay unchanged. The strict-compatible v0.1.1 schema accepted inside
this packet remains `PROPOSED`; recording this acceptance did **not** adopt it. **Adopting v0.1.1,
superseding v0.1.0 and migrating any consumer each require their own separate future Founder
decision.**

## 9. Rider — W0-R01 Option B (Fable independent review)

The final cross-agent review of the two candidates raised one non-blocking finding on this lane.
**Option B was selected:** the finding is disclosed as a **LOW advisory** and changed **no accepted
contract byte**. Option A of that rider — rewriting accepted packet bytes before acceptance — was
**not** selected, so the accepted commit
`ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4` carries exactly the reviewed bytes. The advisory is not a
P0–P3 defect and opens no gate. It is also carried in
`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` §8 and
`docs/operations/W1-E2-EVIDENCE-REGISTER.md` §1.

## 10. Evidence reconciliation — history retained, not current status

### 10.1 Second repair — re-pinned to the accepted commit, 2026-07-26

Acceptance moved the authoritative byte set from the uncommitted worktree to the local commit
`ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`, and the final review round added test cases. §4–§6
above carry the values recomputed from those committed bytes; the pre-acceptance values below are
retained as history.

| Attribute | Superseded pre-acceptance value | Current value |
|---|---|---|
| Aggregate | `16099c17…` | `0fcac6ede9b2c…` (30/30 member digests match) |
| Test count | `29/29` | `31/31` |
| Coverage | `97.39%` branch coverage | `97.44%` branch coverage |
| Path count | 32 | 32 (never superseded) |
| Ajv strict | 8 clean compilations | 8 clean compilations (never superseded) |
| Spectral / AsyncAPI | zero errors | zero errors (never superseded) |
| Final independent review | W0-T01 `PASS` | W0-T01 `PASS` (never superseded) |

That re-pinning was carried out under the nineteen-path authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.7. It changed **documentation** bytes only:
nothing was pushed, merged or released. Although `tools/operations/validate-w1-control.mjs` and its
test suite were inside that nineteen-path allowlist, the matching validator bytes were **not**
landed — measured 2026-07-26, the tool still pins the superseded W1-C2 aggregate `16099c17…` and
therefore fails against these correct documents. That is a tool-side residual, recorded as gate 8
in §12 and diagnosed in board §13.1; it changes nothing in §4–§6, which are derived directly from
the committed bytes of `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`.

### 10.2 First repair — pre-acceptance pinned gate rows, 2026-07-26

`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` §1 and
`docs/operations/W1-E2-EVIDENCE-REGISTER.md` §1 previously carried a W1-C2 aggregate value, a test
count and a coverage figure that did **not** reproduce from the then-current candidate bytes under
the packet's declared aggregate algorithm.

| Attribute | Superseded value formerly pinned in the decision-gate/register rows | Value pinned by the first repair |
|---|---|---|
| Aggregate | an earlier `f79702c6…` value | `16099c17…`, from 30/30 matching member digests |
| Test count | `10/10` | `29/29` |
| Coverage | `86.67%` line coverage | `97.39%` branch coverage |
| Ajv strict | `8/8` | 8 clean compilations (never superseded) |
| Spectral / AsyncAPI | zero errors | zero errors (never superseded) |
| Path count | 32 | 32 (never superseded) |

Those rows and the matching pins in `tools/operations/validate-w1-control.mjs`
(`W1_C2_CANDIDATE_ROW`, `validateE2Register`) and its test suite were repaired **together** under a
separate bounded five-path authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.4. That repair changed documentation and
validator bytes only: it accepted nothing, flipped no status, and staged, committed and installed
nothing.

The values in §4–§6 above are authoritative for this application and agree with the decision-gate
and register rows. `tools/operations/` remains outside this document's write allowlist; this
document records both reconciliations, it did not perform either pin repair.

## 11. What the recorded acceptance did and did not do

The recorded acceptance moved exactly the 32 paths in §2 to `ACCEPTED FOR IMPLEMENTATION v0.1.0` and
recorded them as the local commit `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`. It did **not**:

- adopt Bundle v0.1.1, supersede v0.1.0 or migrate any consumer;
- push or merge that branch, or grant publication, merge, release or release-date authority;
- open any SOC, Cyber AI or Fabric product or runtime writer;
- select or install any dependency, or start any database, broker or container;
- authorize a server, endpoint or transport implementation;
- promote the contract beyond `v0.1.0` toward stable v1/GA;
- grant any integration or deployment authority.

## 12. Residual gates

1. **Publication gate** — the accepted branch has not been pushed; pushing needs its own decision.
2. **Merge gate** for the accepted 32-path commit.
3. **Pinned-row correction gate — closed 2026-07-26.** The pre-acceptance rows were first corrected
   under the bounded five-path authority recorded in
   `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.4, then re-pinned to the committed bytes of
   the accepted commit under the nineteen-path authority recorded in §14.7 of that board, as
   detailed in §10.1 and §10.2. Documentation and validator bytes only. No open gate remains from
   this item; gates 1–2 and 4–8 are unaffected. The separate re-pin gate opened by §14.7's unlanded
   validator bytes is tracked as gate 8, not here.
4. **Bundle v0.1.1 adoption gate**, **v0.1.0 supersession gate** and **consumer migration gate** —
   three separate future decisions.
5. **Separate transport/server gate** — the packet declares no server or runtime binding.
6. **CI wiring gate** — validator/test/Spectral/AsyncAPI registration and pipeline invocation
   remain unwired.
7. **Runtime obligations** — timing equivalence, durability and state-transition enforcement remain
   runtime-only and unproven.
8. **Control-validator re-pin gate — CLOSED 2026-07-26.** Distinct from gate 3. The suite-level
   `tools/operations/validate-w1-control.mjs` and its test suite were repaired by **W0-R06** under
   the bounded write authority recorded in board §14.9 and now return validator `PASS` with
   `tests 77 · pass 77 · fail 0`, measured manually; details in board §13.1 and §14.9.
   *Superseded history:* until 2026-07-26 they still carried the pre-acceptance pins and were
   **RED** against the current documents (`tests 77 · pass 9 · fail 68`, one root cause), a tool
   defect and not a document defect, deferred because `tools/operations/` was outside the nine-path
   documentation allowlist recorded in board §14.8.1. This gate is separate from the packet's own
   standalone validator — that one is `PASS` with `31/31` per §6 — and closing it is
   static/documentary only: **CI: NOT WIRED**, no push, merge or release authority follows, and the
   W1-C2 packet's lifecycle is unchanged at `ACCEPTED FOR IMPLEMENTATION v0.1.0` as a local commit
   only.

This application is `APPLIED 2026-07-26` and the W1-C2 packet is
`ACCEPTED FOR IMPLEMENTATION v0.1.0` as a local commit only.

## 13. 2026-07-30 corrected Bundle reconciliation

Founder decisions `W1-REC-3=YES` and `W1-REC-4=YES`, followed by the accepted BSR1 correction,
make `5a1ed0001a5714b7f099aeaff3f5a74cb67c068a` the authoritative corrected W1-C2 tip. The
reconciliation changes exactly 7 paths; the full packet remains exactly 32 paths / 30 members,
has aggregate `d741f22470a59bde5f0761dd6f3309acb9bb9b851970bc95c5228efd135a5449`, and registers 40
tests. Bundle v0.1.1 is authoritative for new production and bundle-read responses. Immutable
Bundle v0.1.0 remains supported for legacy read/replay input at SHA-256
`501cb160f2fe7035c824d5b0ab37b74d5624cf99a7c25c7adffa72dff9c53bb1`.

The pre-BSR1 accepted line `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4` remains immutable
historical provenance. The corrected state is `ACCEPTED-AND-LOCALLY-INTEGRATED — REHEARSAL ONLY —
NONCANONICAL` at the exact topology in `W1-CONTRACT-RECONCILIATION-APPLICATION.md` §3.
`W1-REC-5=YES` permits only separately bounded, test-first preparation of consumer migrations;
none occurs here. No canonical commit, push, merge-to-branch, runtime, UAT or release is authorized.

## 14. Current canonical landing — 2026-07-30

The corrected W1-C2 state is now
`CANONICAL-INTEGRATED — STATIC CONTRACT AND CONTROL EVIDENCE ONLY` through GitHub PR #1 merge
`28c564eb9b6853b73a18a59a2e84ba58fd67816a`. This supersedes the forward-looking publication,
merge and CI-wiring residuals in §§12–13. Bundle consumer migration, runtime durability,
stable-v1/GA, UAT and production remain separately gated and unproven.
