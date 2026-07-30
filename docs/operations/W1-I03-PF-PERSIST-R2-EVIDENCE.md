# W1-I03 / PF-PERSIST — `r2` product-evidence record

- **Prepared:** 2026-07-29
- **Status:** `REVIEWED LOCAL UNCOMMITTED EVIDENCE — NOT ACCEPTED — NOT INTEGRATED — NOT CANONICAL — NOT PUSHED/MERGED/RELEASED`
- **What that status is, exhaustively.** `r2` is **reviewed local uncommitted evidence and nothing
  more.** It opens **no commit authority, no acceptance, no integration, no canonicalization, no
  push/merge/release authority and no runtime authority.** The reviewed `PASS` is a verdict on a
  working-tree state, not a licence to land it; nothing in this record may be cited as permission to
  stage, commit, push, merge, deploy, release or run the described change. Any of those requires its
  own separate Founder decision, which does not exist.
- **Control base for this record:** `eedadc561700d3e1fa052322d44eb63151df0009`, branch
  `codex/w1-control-reconcile-l5-r1` — the base this record was authored on, never a claim about
  any current tip.
- **Subject worktree:** `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`,
  branch `codex/w1-i03-pf-persist-r2`, base/`HEAD` `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`.
- **Repository of the product bytes:** `cybrik-soc-command-center`. **None of those bytes live in
  this control repository**, and none is edited, staged, committed, pushed, merged or released by
  this record.
- **Companion records:** board `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §17 and register
  `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §29 state the same key figures.
- **Governing grant:** `docs/operations/W1-I03-PF-PERSIST-GRANT.md`, imported into this repository
  as an exact byte copy alongside this file.

## 0. What this file is, and what it is not

**It is** a control-side evidence record: a written, re-measurable account of a bounded product
change that exists **only as an uncommitted working-tree state in another repository**, together
with the independent review verdict returned against it.

**It is not**, and it does not become by existing:

- **not acceptance** — no contract gate accepts anything here;
- **not canonical integration** — nothing is integrated into any line;
- **not commit authority** — the product implementation described below remains **uncommitted**,
  and **recording it grants no authority to commit, stage, push, merge or release it**;
- **not a runtime, deployment or production-persistence claim.** Every figure below comes from
  serializer-level and dataclass-level unit tests run against in-process objects. **No Valkey, no
  Kafka, no PostgreSQL, no broker, no container and no network was reached at any point.** Nothing
  here observes, demonstrates or implies that correlation state persists in any deployed system;
- **not a gate movement** — no blocker closes, no gate opens, no date moves, no task identity is
  minted.

**Three distinct objects, kept distinct throughout.** *(a)* **Packet/grant import** — reviewed bytes
copied into this repository, which is publication and nothing more. *(b)* **Product evidence** — the
measured state of an uncommitted working tree in another repository, which is what §3–§8 record.
*(c)* **Acceptance** — a control act that **has not occurred** for any of this. Neither (a) nor (b)
is evidence for (c).

## 1. Exact control-side write allowlist for this record — five paths

| # | Path | Change |
|---|---|---|
| 1 | `docs/operations/W1-I03-PF-PERSIST-GRANT.md` | new file — exact byte copy of the reviewed round-4 grant |
| 2 | `docs/operations/W1-I03-PF-PERSIST-R2-EVIDENCE.md` | new file — this authored evidence record |
| 3 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | §17 appended; no earlier section rewritten |
| 4 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | §29 appended; no earlier section rewritten |
| 5 | `docs/operations/README.md` | exactly two catalog index rows added, for entries 1 and 2 |

**There is no sixth path for this record.** No validator, test, contract, strategy, ADR-catalog or
product file was edited, and no file in any other repository was written. In particular
`docs/adr/README.md` and the three decision packets imported by board §16 are **untouched** by this
record and were re-measured at their §16.2 hashes afterwards (§10).

## 2. Grant provenance — four rounds, one rejected execution

The governing grant reached its operative bytes through four authoring rounds and one failed
execution. **The grant is a decision-and-authority record only: it performs no product work.**

| Stage | 1DevTool run | Category | Outcome |
|---|---|---|---|
| Initial grant review | `9c5a4f9a-7237-44c1-bac6-ca0dbb049854` | `review` | `NO-GO` |
| Round-2 correction writer | `43bc2165-74a4-4c90-96d0-7b3d89c77c92` | `docs` | corrected bytes |
| Round-2 review | `5bd4f425-6cd9-4b48-9d27-c1c72ab9cc94` | `review` | `NO-GO` |
| Round-3 correction writer | `4e0ebcd0-3ace-4634-a6c0-b726ef2bf703` | `docs` | corrected bytes |
| `r1` grant review | `f13c9989-1b8a-485d-9128-0a7ead99ce4d` | `review` | `PASS` — opened the `r1` writer |
| `r1` product writer | `640db9a0-0160-4cd8-aa23-ac9836ff9443` | `implementation` | `r1` execution attempt |
| `r1` post-review | `da59995f-3743-4eaa-94b8-3e1fa674a1a4` | `review` | **`NO-GO` / non-promotable** |
| Round-4 restart-grant writer | `432bc186-ceae-4cf6-833a-5cd16c469be0` | `docs` | re-pointed the grant at `r2` |
| `r2` grant review | `16f76bc8-25b8-4340-8144-49a075119b66` | `review` | `PASS` — opened the `r2` writer |
| `r2` product writer | `cded7eea-555d-4521-a839-2b162b749e81` | `implementation` | `r2` execution |
| `r2` post-review | `03f6a4a2-a9bd-4cd1-b81d-7b8d6486ec24` | `review` | **`PASS`** |

Full per-run measured metadata is in §9. The grant's own round-4 bytes are pinned at
`1a2a5624bad133b5ff5a65c0a5fc641b341a2cc28836c7811c388f7f31abfd72`, 1180 lines, 99455 bytes, and
were copied here byte-for-byte and re-measured equal (§10).

### 2.1 The rejected `r1` execution — recorded, not buried

`r1` lives at `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r1`, branch
`codex/w1-i03-pf-persist-r1`, same base `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`, with **exactly
eight** modified tracked paths and **zero** staged, untracked or ahead-of-base entries. Its two
PF-worker files measure:

| `r1` path | SHA-256 | Size |
|---|---|---|
| `ops/pf-workers/pf_workers/correlation_processor.py` | `98fee142fe8df98477f339751aac9281173f141648f1bf518c6ce2314d5bd18c` | 763 lines, 34193 bytes |
| `ops/pf-workers/tests/test_correlation_processor.py` | `4f78105a655b7d64495729fcbbe7f4d667d65b58877957fc8488dbd706c0b1db` | 828 lines, 36717 bytes |

**Why `r1` was rejected.** The independent post-writer review found the **technical design
correct** and nevertheless returned **`NO-GO` / non-promotable** on a **`P1` authority breach**: the
`r1` writer observed a **first RED that was invalid — a 7-fail/3-pass split against a grant that
classifies exactly six cases as RED-required and four as regression-locks** — and that invalid RED
was a **hard stop** under the grant's own RED-gate discipline. The writer **continued past it**
instead of stopping. A correct design produced by an execution that broke its authority ceiling is
**still not promotable**; correctness of the artefact does not retroactively authorize the process
that produced it.

**No retroactive authorization is granted here, and none is available.** `r1` is **frozen
byte-unchanged as READ-ONLY REFERENCE ONLY**. It is not a basis for landing and not a fallback. It
is recorded so the failure is legible, not so it can be recovered.

**What `r1` did and did not contribute — stated precisely, 2026-07-29 correction.** An earlier
draft of this record said `r1` was "not a source of bytes for `r2`". That was **overbroad and is
withdrawn.** The reviewed round-4 grant **§4.7 explicitly ALLOWED** the `r2` writer to read and
copy-reference `r1`'s two PF paths, under phase gating: the PF **test** bytes **before** RED
(subject to the §5A.2 drift-correction duty), and the PF **source** bytes **only after a valid RED
had been observed** (§5A.7). §5B.2 goes further and calls reading and copying `r1`'s test bytes
"explicitly ALLOWED … and expected". The `r2` writer **used that permitted reference**. The correct
and narrower statements are:

- **`r1`'s status and evidence were not reused or promoted.** Its `NO-GO` verdict stands, its run
  evidence is not `r2` evidence, and every `r2` measurement was taken fresh in `r2` (grant §4.7
  final bullet).
- **`r2` produced its own valid RED/GREEN/review chain** — a first *valid* 6/4 RED, a GREEN against
  frozen test bytes, and its own independent post-review `03f6a4a2-…` (§5, §9.1).
- **The six inherited I03 paths were taken only from the reviewed phase-1 source worktree, never
  from `r1`** — grant §4.2 and §4.7 put the six paths outside the `r1` reference scope, which is the
  two PF paths only.
- **`r1` remained byte-unchanged** across the `r2` run, as the grant's three-tree end-of-run check
  requires; its PF pair is re-measured at its recorded hashes above in §11.
- **No claim of literal zero byte influence or zero derivation is made.** `r2`'s PF bytes are its
  own authored bytes and differ from `r1`'s at every hash and size measured here, but they were
  authored **with** a grant-permitted read of `r1`'s reviewed design, and this record does not
  pretend otherwise.

## 3. `r2` tree identity — measured

| Property | Measured |
|---|---|
| Worktree | `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2` |
| Branch | `codex/w1-i03-pf-persist-r2` |
| Base / `HEAD` | `d3aaf6fb29c57f145de8f131ad1588aae57d57c9` |
| Working tree | exactly **8** modified tracked paths |
| Staged | **0** |
| Untracked | **0** |
| Commits ahead of base | **0** — the branch has **no upstream configured**, so nothing is pushed and no remote state exists for it |

The eight paths are the **six inherited** W1-I03 marking-floor paths plus the **two writable**
PF-worker paths. **The six inherited paths were not edited by this lane** — they are byte-identical
to the reviewed source worktree (§4).

## 4. Exact hashes — all eight paths

**Two writable PF-worker paths (`r2`, the only bytes this lane authored):**

| Path | SHA-256 | Size |
|---|---|---|
| `ops/pf-workers/pf_workers/correlation_processor.py` | `a346c88e20fc76a2474ef3e9053a7a14071f2857d26767825cde262b142825eb` | 762 lines, 34154 bytes |
| `ops/pf-workers/tests/test_correlation_processor.py` | `c88158baec153ae1a2a365cfa4998f913965882a0b6bac950151b954f9cd04f6` | 804 lines, 35194 bytes |

The test hash `c88158ba…` is the **frozen test hash**: the bytes were frozen before the valid RED
observation and are **byte-unchanged** from that freeze through GREEN to this record (§5).

**Six inherited paths — equal in the reviewed source worktree and in `r2`:**

| Path | SHA-256 |
|---|---|
| `services/api/src/cybrik_soc/modules/ingest/source_labels.py` | `15a2dc67dc1e3935b7cc73a04cdef7c6df4bf49c7d7697f5ba57ff38d00457ef` |
| `services/api/src/cybrik_soc/modules/siem/correlation.py` | `c144b8bf7465dcbac1412aa6fceea319bc35b368d8c23cbcb479978b87bdeb45` |
| `services/api/src/cybrik_soc/modules/siem/engine.py` | `e640f9dc0404103ef4a101adf2eddb9373325e8b67df2e067114cb7e3abfb542` |
| `services/api/tests/unit/test_ingest_label_floor.py` | `b5db2162631620e8074b189088feabff9529b2e26f435d428fdbe4b028a8aadb` |
| `services/api/tests/unit/test_siem_correlation.py` | `5d929f16f8cba1aa25344e21b9e542a18ca78a0598d928a2026971ebc0516491` |
| `services/api/tests/unit/test_siem_engine.py` | `dae47bb6a96956f1ea022225072bf84df2bbb6528bb4bddc35087ad9468c55e8` |

**Reviewed source worktree**
`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-marking-floor-r2-phase1-r1`, branch
`codex/w1-i03-marking-floor-r2-phase1-r1`, branch
`codex/w1-i03-marking-floor-r2-phase1-r1`, `HEAD` `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`, dirty
set exactly the **six** paths above with **zero** staged and **zero** untracked — six pins, all six
re-measured equal in `r2`. The rejected `r1` tree carries the same six values, unchanged.

**Provenance of the six, stated at the strength the measurement actually supports.** All three trees
— reviewed phase-1 source, `r1` and `r2` — hold **identical** bytes at these six paths, so hash
equality **alone cannot discriminate** which tree `r2`'s copies were taken from. The claim that they
came from the **reviewed phase-1 source and not from `r1`** rests on the **grant's rule**, not on a
distinguishing measurement: grant §4.2 designates the reviewed source worktree as the transplant
origin, and §4.7 confines the `r1` reference scope to the **two PF paths only**, stating explicitly
that "the six inherited paths are **not** taken from `r1`". What the measurement independently
establishes is the weaker and still-material fact that **this lane edited none of the six**, in any
direction, from any origin.

**What that equality means, and what it does not.** It means this lane did **not** touch the
six-path marking-floor lane. It does **not** promote that lane: `W1-I03`'s six-path status stays
`COMPLETE` / `ADMITTED` **for the bounded local six-path lane only** — not accepted, not integrated,
not canonical, not pushed, not merged, not released.

## 5. `r2` TDD chronology — as executed

0. **Grant-permitted `r1` reference, at the gated phases.** Before RED the writer was allowed — and
   by §5B.2 expected — to read and copy-reference `r1`'s PF **test** bytes, correcting `r1`'s two
   known format-drift hunks by hand; `r1`'s PF **source** bytes became readable **only after** the
   valid RED of step 2. This reference was used. It is authorized by grant §4.7 and is recorded here
   rather than elided (§2.1). It transferred no status, no evidence and no authority.
1. **Test bytes written and frozen** at `c88158baec153ae1a2a365cfa4998f913965882a0b6bac950151b954f9cd04f6`
   **before** the RED observation, and **immutable from that point on**. The same hash is the one
   measured at GREEN and the one measured for this record.
2. **First valid RED: 6 fail / 4 pass.** The failing set is **exactly cases 1, 2, 4, 6, 7, 8** — the
   six the grant classifies as RED-required. The passing set is **exactly cases 3, 5, 9, 10** — the
   four regression-locks, which lock behaviour that already held and are required **not** to fail.
   This is the split the grant demands, and it is the split `r1` failed to obtain before proceeding.
3. **Implementation written** against the frozen tests. Measured diff against base: **+47 lines** in
   `correlation_processor.py` and **+163 lines** in `test_correlation_processor.py`, 210 insertions
   and **0 deletions** across the two PF paths.
4. **GREEN across the ten new nodes: 10 pass, 0 fail**, with the test bytes still at the frozen
   hash — no test was edited to obtain the pass.

The ten nodes correspond one-to-one with the ten grant cases:
`test_lu_persist_dump_conditional_emission_both_halves`,
`test_lu_persist_true_survives_dump_load_roundtrip`,
`test_lu_persist_legacy_hash_without_lu_loads_false`,
`test_lu_persist_malformed_present_lu_fails_closed_true`,
`test_lu_persist_explicit_zero_loads_false`,
`test_lu_persist_survives_invalid_lf_clearing`,
`test_lu_persist_monotonic_or_across_reload`,
`test_lu_persist_effective_label_floor_carries_unresolved_after_reload`,
`test_lu_persist_wire_lock_to_canonical_exactly_two_keys`,
`test_lu_persist_classification_no_downgrade_with_lu`.

## 6. Technical semantics — what the `r2` bytes decide

The change adds one persisted marker, `lu`, to the PF worker's correlation-group hash serializer, so
that a group's `label_unresolved` state survives a dump/load cycle instead of being silently lost.

- **Dump, conditional emission.** `dump_group_state` writes `lu = "1"` **only when
  `label_unresolved` is true**; when false the key is **absent**. The dumper **never emits `"0"`**,
  so hashes for the common resolved case stay byte-identical to the pre-lane shape. This mirrors the
  existing `lm` idiom **on the dump side only**.
- **Load, membership-tested and fail-closed.** `_load_unresolved` branches on **key membership**
  (`"lu" in hraw`), **never on truthiness**: absent ⇒ `False`; `"1"` ⇒ `True`; `"0"` ⇒ `False`; any
  other present value, **including the empty string**, ⇒ `True`, fail-closed. A truthiness test
  would collapse `lu == ""` — which is *present-and-malformed* — into the absent branch, and that is
  precisely the confusion the membership test exists to prevent.
- **The `lm` analogy stops at the dumper.** `lm` is derived permissively and is cleared by the
  invalid-`lf` fail-safe; `lu` is membership-tested, fail-closed, and **survives** that fail-safe.
- **`lu` restores independently of `lf` validation.** The existing fail-safe that nulls
  `label_floor`, `label_system` and `label_system_mixed` on an `lf` outside `_LABEL_RANK` **must not**
  clear `lu`: an invalid floor and an unresolved contributor are independent facts. The restore is
  placed outside both branches of that fail-safe so the invariant is visible in the code.
- **Disclosed divergence from the basis packet, on the absent branch.** §13.8 of the basis packet
  carries an **on-point** conservative-value hint naming the absent-or-unparseable state directly;
  applied literally it would load a legacy hash as unresolved. This lane decides **otherwise on the
  absent branch only** — missing `lu` ⇒ `False` — because absence is the unambiguous signature of a
  v1/v2 dumper that never had the field, and treating every pre-existing group as unresolved would
  **over-tag the entire installed state** rather than record a real inference. Conservatism is
  retained exactly where ambiguity is real: the *present-and-malformed* branch, fail-closed to
  `True`. The divergence is **authorized by the grant's §3 preamble and disclosed here, not silent**.
- **Non-string reachability, stated honestly.** The PF Valkey client runs `decode_responses=True`,
  so in production every hash value arrives as `str` and the **non-string** malformed inputs are
  **not reachable by the real client**. They are covered as **defensive, synthetic-only** cases —
  the reader is fed a dict directly, in-process — to keep the branch total against a future
  client-configuration change or a non-Valkey caller. They are **not** observed production inputs
  and are not presented as such.
- **No wire change.** `LabelFloor.to_canonical()` remains **exactly** `classification` and
  `monitored_system`. `lu` is **internal persisted state only**: no envelope change, no JSON-Schema
  change, no contract change, no migration and no version bump. The wire separation decided as
  `Q3 = A` is preserved, not amended.

## 7. Test and check results — all local, all static, all writer-reported

**Provenance of every figure in this section, stated before the figures themselves.** None of the
results below was executed or re-executed by this control record. Each is **reported by the `r2`
writer run `cded7eea-…` and confirmed by the independent post-review `03f6a4a2-…`**, which
reproduced them inside the `r2` lane's own environment. They are therefore **writer-reported /
reviewer-confirmed**, not control-measured, and — because no run transcript was retained (§9) —
**they are not re-derivable from any stored artefact outside that lane**. They are re-verifiable
only by re-running the suites inside `r2` with the borrowed interpreter and the serializer stub of
§8 (§11). The hashes, sizes, tree identities and run metadata in §3, §4, §9 and §10 are of a
different and stronger kind: those **were** re-measured live for this record.

| Check | Reported result (writer-reported, reviewer-confirmed) |
|---|---|
| First valid RED | **6 fail / 4 pass** — failing exactly cases 1, 2, 4, 6, 7, 8; passing exactly locks 3, 5, 9, 10 |
| GREEN, ten new nodes | **10 pass**, 0 fail |
| Full PF module | **23 pass**, **14 skipped** — every skip **fixture-scoped**, from the `store` fixture's Valkey-unreachable `pytest.skip`, not a module-level guard. The ten new nodes request no such fixture and therefore actually execute |
| SIEM engine regression | **242 pass** |
| `ruff check` | **pass** |
| `ruff-format` drift budget | base → final **unchanged**: processor **22 → 22**, test **24 → 24** |
| `py_compile` | **pass** |
| Residue | **no baseline delta** — no new residue path beyond what the base already carries |

**The 14 skips are disclosed, not hidden.** They are pre-existing nodes that require a live Valkey
connection through the `store` fixture. They did not run, nothing was inferred from them, and **no
result below or above is derived from a skipped node**.

## 8. Environment and evidence boundary

- **Borrowed CPython 3.12.13.** No interpreter was installed, no virtualenv created, no dependency
  installed, no lockfile touched.
- **Two-name `aiokafka` stub, serializer-level only.** A minimal stub satisfied the import so the
  serializer tests could execute in-process. **No Kafka client was constructed, no broker was
  contacted, and no message was produced or consumed.**
- **No runtime, no service, no I/O.** No Valkey, no Kafka, no PostgreSQL, no container, no socket,
  no network. Every assertion is against in-process Python objects and plain dicts.
- **No CI.** **CI: NOT WIRED.** Every figure in §7 is a manual, static, local measurement. No CI run
  exists and none is claimed.
- **No integration, no acceptance, no commit.** Nothing was staged, committed, pushed, merged,
  deployed, released or put through UAT, in either repository.
- **What this cannot show.** These are serializer and dataclass unit tests. They demonstrate that
  the serializer round-trips the marker correctly **in memory**. They demonstrate **nothing** about
  persistence in any deployed system, about durability, about behaviour under a real Valkey, or
  about production data. **No production-persistence claim is made anywhere in this record.**

## 9. Run ledger — measured 1DevTool metadata

Every field below was read from each run's `meta.json` in the local run store. All eleven runs
recorded `model = opus`, `status = done`, `exitCode = 0`, `target = claude`,
`timeoutSeconds = 600`, and **`contentCaptured = false`**.

| Run | Category | `cwd` recorded | Started (UTC) | Duration |
|---|---|---|---|---|
| `9c5a4f9a-7237-44c1-bac6-ca0dbb049854` | `review` | `w1-48/w1-d04-pf-persist-grant-r1` | 2026-07-29T03:09:23Z | 395 s |
| `43bc2165-74a4-4c90-96d0-7b3d89c77c92` | `docs` | `w1-48/w1-d04-pf-persist-grant-r1` | 2026-07-29T03:16:51Z | 243 s |
| `5bd4f425-6cd9-4b48-9d27-c1c72ab9cc94` | `review` | `w1-48/w1-d04-pf-persist-grant-r1` | 2026-07-29T03:21:37Z | 555 s |
| `4e0ebcd0-3ace-4634-a6c0-b726ef2bf703` | `docs` | `w1-48/w1-d04-pf-persist-grant-r1` | 2026-07-29T03:31:54Z | 319 s |
| `f13c9989-1b8a-485d-9128-0a7ead99ce4d` | `review` | `w1-48/w1-d04-pf-persist-grant-r1` | 2026-07-29T03:37:59Z | 498 s |
| `640db9a0-0160-4cd8-aa23-ac9836ff9443` | `implementation` | `cybrik-soc-command-center` | 2026-07-29T03:47:27Z | 582 s |
| `da59995f-3743-4eaa-94b8-3e1fa674a1a4` | `review` | `w1-48/w1-i03-pf-persist-r1` | 2026-07-29T03:58:17Z | 389 s |
| `432bc186-ceae-4cf6-833a-5cd16c469be0` | `docs` | `w1-48/w1-d04-pf-persist-grant-r1` | 2026-07-29T04:06:23Z | 486 s |
| `16f76bc8-25b8-4340-8144-49a075119b66` | `review` | `w1-48/w1-d04-pf-persist-grant-r1` | 2026-07-29T04:15:07Z | 409 s |
| `cded7eea-555d-4521-a839-2b162b749e81` | `implementation` | `cybrik-soc-command-center` | 2026-07-29T04:23:04Z | 544 s |
| `03f6a4a2-a9bd-4cd1-b81d-7b8d6486ec24` | `review` | `w1-48/w1-i03-pf-persist-r2` | 2026-07-29T04:33:06Z | 372 s |

Worktree paths are abbreviated from
`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/…`; the two `implementation` runs recorded the
`cybrik-soc-command-center` repository root as `cwd` while writing into their respective linked
worktrees. Total measured duration across the eleven runs: **4792 s**.

- **`contentCaptured` is present on all eleven and its value is literally `false`.** This was
  re-read field-by-field for this record: the key **exists** in every one of the eleven `meta.json`
  files and is the JSON literal `false` — it is **not absent, not `null`, and not some other
  value**. The two readings are kept apart deliberately: what is recorded is the **positive fact
  that 1DevTool did not capture output content**, which is stronger than the merely negative
  "no content-capture claim was recorded".
- **Output existed; its content was not retained.** Each run additionally records a **non-zero
  `outputChars`** (4944–13483) alongside `promptChars` (3224–6201), and each run directory contains
  **`meta.json` and nothing else** — no transcript file. So the runs did produce output and its
  **length** was measured, but the **content** was discarded. `contentCaptured = false` must
  therefore be read as *content not retained*, **not** as *no output was produced*.
- **Consequence for this record.** No run's reasoning is quoted here and none could be. The verdicts
  in §2 and §9.1, and every figure in §7, come from the reviews' and writer's **reported** findings,
  **not** from a stored transcript, and cannot be re-derived from the run store.
- **Model disclosure.** All eleven runs were `opus`. Fable was unavailable; no run used it, and no
  Fable-independence property is claimed for any verdict here.

### 9.1 `r2` independent post-review — `PASS`, three retained `P3`

Run `03f6a4a2-a9bd-4cd1-b81d-7b8d6486ec24`, `review`, `cwd`
`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`, 372 s, `exitCode = 0`.

**Verdict: `PASS` — `P0 = 0`, `P1 = 0`, `P2 = 0`.** Three **nonblocking `P3`** observations were
retained:

| `P3` | Observation |
|---|---|
| 1 | The first RED capture was **truncated**, and the re-capture that followed used a **duplicate identical selector** rather than widening it. The valid 6/4 split stands as reported; the capture hygiene does not. |
| 2 | The malformed variant `"1 "` — a `"1"` with trailing whitespace — is **not asserted**, though the implemented behaviour for it is **correct** (it is present-and-not-`"1"`, so it reaches the fail-closed `True` branch). This is a coverage gap in the test, not a defect in the reader. |
| 3 | Case 6's **no-floor effective branch** is not re-asserted in this lane; it is **covered by the inherited tests** in the six-path marking-floor lane. |

**These three stay open and stay in their reviewer's record.** They are nonblocking by that
reviewer's own grading. This record **does not close, waive, discharge or re-grade** any of them,
and carries no authority to do so.

## 10. Verification performed for this control record

**Re-verified on 2026-07-29 in the accuracy-correction pass.** Every row below was re-executed after
the §2.1 / §4 / §5 / §7 / §9 corrections were written, not merely carried over from the first pass.
The corrections themselves were driven by a live audit that additionally re-measured: the `r1` PF
pair (confirmed **763 lines / 34193 bytes** and **828 lines / 36717 bytes** — the recorded figures
were already correct and needed no change); all eleven `meta.json` files field-by-field; and the six
inherited pins across all three worktrees.

| Check | Result |
|---|---|
| Grant copy source → destination | `cmp` **byte-identical**; destination re-measured `1a2a5624bad133b5ff5a65c0a5fc641b341a2cc28836c7811c388f7f31abfd72`, 1180 lines, 99455 bytes — equal to source |
| `docs/adr/FOUNDER-DECISION-PACKET-W0-IR01-CONTROLLED-INTEGRATION.md` | unchanged at `24dcf7e1207222eb146cfc8cf7d4ae2915f72676a03911ec671e88b5d993839b`, 1233 lines, 90471 bytes |
| `docs/operations/W1-I03-MARKING-FLOOR-R2-DECISION-PACKET.md` | unchanged at `4d16fc8fe440ac23d1782e9c534e2c729544637ebd2b3d022fb2bd21bf86da25`, 3936 lines, 426454 bytes |
| `docs/adr/FOUNDER-DECISION-PACKET-W0-T11-RESOURCE-BUDGET.md` | unchanged at `15cd434a473ebb593e844cdb1407f7359169bbd57b46ab574e5ffcdaa637927f`, 1009 lines, 74887 bytes |
| `git diff --check` | clean |
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 179 · pass 179 · fail 0`, 0 cancelled, 0 skipped, 0 todo |
| Control working tree at hard stop | exactly **9** `git status --porcelain` entries — the prior seven plus this record's two new files — with **zero staged** |
| Content aggregate over this record's five paths | **not stated here.** A record cannot contain an aggregate over its own bytes; any such value must be measured externally after this record exists |

**Disclosed validator limitation, mandatory.** `validate-w1-control.mjs` is a **documentary
consistency check only**. The imported grant, this evidence file and `docs/operations/README.md` are
**outside** the set of files it reads — **no rule inspects their bytes**. It spawns no `git`
process, opens no repository, reaches no other worktree and re-derives no digest. Every hash, line
count and byte count in this record was measured manually and is **static**. A `PASS` above is
evidence that the documents the validator *does* read stayed consistent; it is **not** evidence for
anything in §3–§8.

## 11. Reproduction — read-only commands

All commands are read-only. **None reads or prints a secret**, opens a network connection, installs
anything, or writes to any worktree. Run them from the control worktree unless stated otherwise.

```sh
# Grant copy — byte equality, hash and size
SRC=/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-d04-pf-persist-grant-r1/docs/operations/W1-I03-PF-PERSIST-GRANT.md
cmp "$SRC" docs/operations/W1-I03-PF-PERSIST-GRANT.md
shasum -a 256 docs/operations/W1-I03-PF-PERSIST-GRANT.md
wc -l -c docs/operations/W1-I03-PF-PERSIST-GRANT.md

# The three packets imported by board §16 — must be unchanged
shasum -a 256 docs/adr/FOUNDER-DECISION-PACKET-W0-IR01-CONTROLLED-INTEGRATION.md \
              docs/adr/FOUNDER-DECISION-PACKET-W0-T11-RESOURCE-BUDGET.md \
              docs/operations/W1-I03-MARKING-FLOOR-R2-DECISION-PACKET.md

# Control-side state and machine checks
git status --porcelain
git diff --check
node tools/operations/validate-w1-control.mjs
node --test tools/operations/tests/validate-w1-control.test.mjs

# r2 product tree — identity and the eight hashes (read-only, no checkout, no fetch)
R2=/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2
git -C "$R2" rev-parse HEAD
git -C "$R2" rev-parse --abbrev-ref HEAD
git -C "$R2" status --porcelain
shasum -a 256 \
  "$R2/ops/pf-workers/pf_workers/correlation_processor.py" \
  "$R2/ops/pf-workers/tests/test_correlation_processor.py" \
  "$R2/services/api/src/cybrik_soc/modules/ingest/source_labels.py" \
  "$R2/services/api/src/cybrik_soc/modules/siem/correlation.py" \
  "$R2/services/api/src/cybrik_soc/modules/siem/engine.py" \
  "$R2/services/api/tests/unit/test_ingest_label_floor.py" \
  "$R2/services/api/tests/unit/test_siem_correlation.py" \
  "$R2/services/api/tests/unit/test_siem_engine.py"

# Reviewed source six pins, and the frozen rejected r1 pair
P=/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-marking-floor-r2-phase1-r1
git -C "$P" status --porcelain
R1=/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r1
git -C "$R1" status --porcelain
shasum -a 256 "$R1/ops/pf-workers/pf_workers/correlation_processor.py" \
              "$R1/ops/pf-workers/tests/test_correlation_processor.py"

# Run metadata — re-read the eleven meta.json files (§9). Reads metadata only, never a transcript;
# no transcript exists to read. Confirms contentCaptured is PRESENT with the literal value false.
RUNS="$HOME/.1devtool/orchestration/runs"
for id in 9c5a4f9a-7237-44c1-bac6-ca0dbb049854 43bc2165-74a4-4c90-96d0-7b3d89c77c92 \
          5bd4f425-6cd9-4b48-9d27-c1c72ab9cc94 4e0ebcd0-3ace-4634-a6c0-b726ef2bf703 \
          f13c9989-1b8a-485d-9128-0a7ead99ce4d 640db9a0-0160-4cd8-aa23-ac9836ff9443 \
          da59995f-3743-4eaa-94b8-3e1fa674a1a4 432bc186-ceae-4cf6-833a-5cd16c469be0 \
          16f76bc8-25b8-4340-8144-49a075119b66 cded7eea-555d-4521-a839-2b162b749e81 \
          03f6a4a2-a9bd-4cd1-b81d-7b8d6486ec24; do
  ls "$RUNS/$id"          # expect: meta.json only — no transcript file
  python3 -c "import json,sys; m=json.load(open(sys.argv[1])); \
    print(sys.argv[1][-70:], m['model'], m['category'], m['status'], m['exitCode'], \
          m['durationSeconds'], 'cc_present=' + str('contentCaptured' in m), \
          'cc=' + repr(m.get('contentCaptured')), m.get('outputChars'))" "$RUNS/$id/meta.json"
done
```

**Re-running the product test suites is deliberately not scripted here.** Doing so would require the
borrowed interpreter and the serializer-level stub described in §8, and it would execute code in a
product repository from a control context. The §7 figures are reported as **measured by the `r2`
writer and confirmed by the `r2` post-review**, and are re-verifiable only inside that lane's own
environment.

## 12. Posture — what this record supersedes, and what it does not

**Supersedes, narrowly and only this:** the statement in board §16 and register §28 that
`W1-I03/PF-PERSIST` is **merely a proposed `HOLD` sub-lane with no edit authority**. That statement
was accurate when written and is now **superseded on that one point**: a bounded edit authority
**was** opened by the reviewed round-4 grant, **was** executed as `r2`, and **has** produced
independently reviewed local evidence.

**Does not supersede — and this list is exhaustive in the direction that matters:**

- **not** the six-path `W1-I03` decision packet, in whole or in any part;
- **not** `Q1`–`Q6`, which stay decided exactly as that packet decides them;
- **not** any wider gate, blocker, checkpoint or acceptance;
- **not** the six-path lane's status, which stays `COMPLETE` / `ADMITTED` for the bounded local
  six-path lane **only**;
- **not** the `P3` observations retained by any review, here or in board §16.

**Posture unchanged by this record:**

- `W0 COMPLETE = 0`; W0 closure stays **`NO-GO`**.
- W1 product implementation and W1 integration stay **`HOLD`**. **The product implementation
  described here has local reviewed evidence and remains uncommitted; no commit authority is
  granted by recording it.**
- W1 runtime writers stay **`NO-GO`**; delegated routine integration stays **`NO-GO`**; external
  release stays **`NO-GO`**.
- `G2` and `G3` stay **closed**.
- The local stack/runtime demo and UAT stay **`NO-GO`** ahead of the `G-C` stable-v1.0 checkpoint.
- **CI: NOT WIRED.**
- The roster stays **48** immutable task identities with **no task 49**; `PF-PERSIST` is a **named
  sub-lane of the existing `W1-I03`**, not a new identity, and this record mints none.
- W1 stays **2026-08-01 → 2026-08-23**, the stable go/no-go stays **2026-12-20** and the release
  window stays **2026-12-21 → 2026-12-31**. No date moves.
- Nothing was staged, committed, merged, pushed, deployed or released; no dependency was installed;
  no database, container, broker or network was reached.
