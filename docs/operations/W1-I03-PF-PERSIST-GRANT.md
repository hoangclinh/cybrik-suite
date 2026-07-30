# W1-I03 / PF-PERSIST — PF worker `label_unresolved` persistence: prospective bounded grant

- **Prepared:** 2026-07-29
- **Status:** `DECIDED — PROSPECTIVE BOUNDED GRANT — NOT EXECUTED — NOT INTEGRATED`
- **Revision:** **fourth round — post-`r1`-execution restart grant.** Rounds 1–3 were
  pre-execution remediations of this grant's own bytes. **Round 4 is different in kind:** the
  round-3 grant **was** handed to a product writer, an `r1` execution attempt **occurred**, and an
  independent post-writer verdict returned **`NO-GO` / non-promotable** on a **`P1` authority
  breach** (§10A.4). Round 4 therefore (a) records that `r1` outcome truthfully, (b) freezes `r1`
  **byte-unchanged as READ-ONLY REFERENCE ONLY**, and (c) **re-points every operative target of
  this grant at a fresh `r2`** — worktree
  `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`, branch
  `codex/w1-i03-pf-persist-r2`, **same** base `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`. It adds
  the §5A RED-gate discipline (frozen-test-before-RED, test bytes immutable after RED, no
  same-authority restart), the §5 case-10 exhaustive scope, and the §7A format-drift budget.
  Round 1 resolved the three `P2` findings and the seven actionable `P3` findings raised against
  `5d03bc814058de0e45a44c696f8d9f837190963f28a66d9dca70326b3108a427`. Round 2 resolved the blocking
  test-classification correction and the five non-blocking `P3`s raised by a fresh independent
  review against
  `2a24761d6e4a51910c3ae24bc798af31d4186568fbd0c9d91b1315f13458a4da`: §5 cases **3** and **5** are
  reclassified from RED-required to **regression-lock**, and the RED-first requirement is restated
  **exactly** — only cases **1, 2, 4, 6, 7, 8** are RED-required. Round 3 resolved the blocking
  `P1` raised against
  `91c75b93da12cac2ed8e54252477b40f71b5361d6aa3464e60ade8ef24d158d7` — the previous absolute
  "**zero residue hits in both trees**" end-of-run requirement was **unsatisfiable**, because
  `services/api/.coverage` is a **tracked blob at the base commit** and the reviewed source
  worktree already carries `.ruff_cache` — replacing it with an executable **baseline-delta** rule
  (§7), and closed four non-blocking `P3`s (editable-install wording, basis-hint characterisation,
  explicit `PYTHONPATH` in every command prelude, and provenance enumeration of the round-1 `P3`
  repairs). **No decision and no authority ceiling was widened in any of the four rounds** — the
  round-1–3 edits are clarifications, corrections of classification, and tightenings only, and the
  round-4 edits are a target re-point plus **further tightenings**. All round-1, round-2 and
  round-3 repairs are preserved intact. See §10.
- **Execution status:** `r1` **attempted and rejected — not promotable, not a basis for landing**.
  `r2` is the **sole prospective operative execution target** of this grant. **No `r2` writer
  authority is open at the moment of writing:** this round-4 file has **not** itself been reviewed,
  and a **fresh independent `PASS` with `P0 = P1 = P2 = 0` against these round-4 bytes is a
  precondition** for opening any `r2` writer (§10A.6).
- **Grant author:** logical task **W0-D04** (prospective-grant author), acting under
  coordinator-delegated Founder authority.
- **Grantee:** the **existing immutable task `W1-I03`**, named sub-lane **`PF-PERSIST`**. The fixed
  roster of 48 is unchanged: **no task 49 is created**, and no replacement identity is minted.
- **Subject:** the PF worker correlation-state persistence gap recorded as **P3 finding 1** and
  carried into the named `HOLD` / `PROPOSED` sub-lane **`W1-I03/PF-PERSIST`** by
  `docs/operations/W1-I03-MARKING-FLOOR-R2-DECISION-PACKET.md` §13.8 / §13.9.
- **What this file is:** it **records a coordinator decision and prospective authority only**. It
  performs **no product work**. Nothing in `ops/pf-workers/` — or anywhere else in
  `cybrik-soc-command-center` — is edited, staged, committed, pushed, merged or released by this
  record. This grant **opens no writer at the moment of writing**; a future product writer acts on
  it, or it lapses unused.

## 1. Preserved constraints — unchanged by this grant

- **Fixed dates are unchanged.** W1 `2026-08-01` → `2026-08-23` is unchanged. The release window
  `2026-12-21` → `2026-12-31` is unchanged. W0–W6 dates are unchanged. **This grant has no date
  authority.**
- **Runtime, live shadow, local stack, UAT and CI remain `HOLD` / `NO-GO`.** No stack before
  `G-C stable-v1.0`. No Valkey, no Kafka, no PostgreSQL, no broker, no network.
- **No commit, no stage, no push, no merge, no release** — in either repository, by the grant author
  or by the granted writer. The granted writer **stops before staging** (§8).
- The `W1-I03` six-path lane itself remains **`COMPLETE` / `ADMITTED` for the bounded local six-path
  lane only** — **not accepted, not integrated, not canonical, not pushed, not merged, not
  released**. This grant does not change that status and does not advance it.

## 2. Defect evidence — exact symbols and source worktrees

**Reviewed SOC worktree (read-only, must remain read-only):**
`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-marking-floor-r2-phase1-r1`,
branch `codex/w1-i03-marking-floor-r2-phase1-r1`, `HEAD =`
`d3aaf6fb29c57f145de8f131ad1588aae57d57c9`, dirty set exactly the **six** I03 paths, **zero
staged**, **zero untracked**.

**The monotonic guarantee that exists in the reviewed tree.**
`services/api/src/cybrik_soc/modules/siem/correlation.py`:

- `_GroupState.label_unresolved: bool = False` — declared at **line 421**, with the committed
  invariant prose above it stating the flag is a lifetime-scoped **OR**: "chi BAT, khong bao gio tu
  tat" (it only turns on, it never turns itself off).
- `_GroupState.raise_label_floor` — **line 430**:
  `self.label_unresolved = self.label_unresolved or reading.unresolved`. This is the monotonic OR.
- `_GroupState.effective_label_floor` — **lines 451 and 453** propagate that flag into
  `LabelFloor(..., unresolved=self.label_unresolved)` on **both** the no-floor default branch and
  the has-floor branch.
- The flag reaches the emitted tag through `services/api/src/cybrik_soc/modules/siem/engine.py`
  **lines 129–136** (`unresolved=reading.unresolved` carried into `LabelFloor`), and
  `services/api/src/cybrik_soc/modules/ingest/source_labels.py` **line 52**
  (`UNRESOLVED_FLOOR_TAG = "label:unresolved-floor"`), emitted at **lines 244–248** — the
  `if eff.floor_unresolved:` guard at **line 244** and the
  `_append_tag(canonical, UNRESOLVED_FLOOR_TAG)` call at **line 248**, separated by the three-line
  Q4 coexistence comment at **lines 245–247** — when the effective floor carries
  `floor_unresolved`.

**Where the guarantee is dropped.**
`ops/pf-workers/pf_workers/correlation_processor.py` (**unmodified** at
`d3aaf6fb29c57f145de8f131ad1588aae57d57c9`; it is on no I03 allowlist and was touched by neither
Phase 1 nor Phase 2):

- `dump_group_state(state, group=None) -> dict[str, str]` — **lines 113–135**. It serializes `e`,
  `m`, `s`, and the three QD-13 floor fields `lf` (`label_floor`), `ls` (`label_system`), `lm`
  (`label_system_mixed`, written as `"1"` only when true), plus optional `g`. **It never writes
  `label_unresolved`.**
- `load_group_state(hraw) -> _GroupState` — **lines 138–170**. It rehydrates `entries`, `max_ts`,
  `suppressed_until`, then validates `lf` against `_LABEL_RANK` (invalid ⇒ `label_floor = None` and
  `label_system` / `label_system_mixed` cleared), and derives `lm` / `ls`. **It never reads
  `label_unresolved`, so the returned `_GroupState` always carries the dataclass default `False`.**

**Precise consequence.** The **classification floor persists** across a Valkey rehydrate; the
**`label:unresolved-floor` provenance does not**. A group whose floor was **inferred** by the
Q1/Q2 fail-closed rule can, after a rehydrate, present as though its floor were **source-asserted**.
The floor is never weakened — what degrades is **the distinction between an inferred floor and an
asserted one**, which is exactly what `label:unresolved-floor` exists to carry. The §6/Q6 monotonic
OR holds **within** a live group state; it does not survive a serialization round-trip that drops
the field. This restates §13.8 of the imported packet; the line-level symbol citations above were
re-derived from the reviewed worktree for this grant.

## 3. Coordinator decisions — binding on the granted writer

These supersede the §13.8 "proposal only" text, which explicitly left field name, encoding and
validation semantics **open** for this lane to decide. They are now decided:

1. **Storage key is `lu`.** `dump_group_state` writes `lu = "1"` **only when `label_unresolved` is
   true**; when false the key is **absent** from the hash. This matches the existing `lm` idiom
   **on the dump side only** — conditional emission of a `"1"`-when-true marker — and keeps hashes
   for the overwhelmingly common resolved case byte-identical to today's. **The `lm` analogy stops
   at the dumper.** `lu`'s **load** semantics deliberately differ from `lm`'s: `lm` is derived
   permissively and is cleared by the invalid-`lf` fail-safe, whereas `lu` is membership-tested,
   fail-closed on malformed input (decision 2), and explicitly survives that fail-safe
   (decision 3). A writer that copies `lm`'s load path wholesale will implement the wrong
   semantics.
2. **Load semantics, fail-closed on ambiguity.** The reader **must branch on key membership**
   (`"lu" in hraw`), **never on truthiness** of the fetched value. A truthiness test would collapse
   the empty string into the absent case; `lu == ""` is **present-and-malformed**, not absent, and
   must reach the fail-closed branch.
   - `lu` **absent from the hash** ⇒ `False`. This is the **legacy-compatibility** branch: a v1/v2
     hash written before this lane carries no `lu`, and must not be re-interpreted as unresolved.
   - `lu == "1"` ⇒ `True`.
   - `lu == "0"` ⇒ `False`.
   - **Any other present value, including `""`, or a present non-string value** ⇒ `True`,
     **fail-closed**. A field that is present but unparseable means the writer intended to record
     something and the reader cannot tell what; the safe reading of an unintelligible provenance
     marker is "provenance is not clean".
   - **Non-string reachability disclosure.** The PF Valkey client is configured
     `decode_responses=True`, so in production every hash value arrives as `str` and the
     **non-string** malformed inputs are **not reachable by the real client**. They are covered as
     **defensive, synthetic-only** cases — the reader is fed a dict directly in-process — to keep
     the branch total against a future client-configuration change or a non-Valkey caller. The
     writer must label them as such in its evidence and must **not** present them as observed
     production inputs.
   - **Deliberate, authorized divergence from the basis packet — disclosed, not silent.** §13.8 of
     the basis packet carries a **direct and specific conservative-value hint**: it names the
     **absent-or-unparseable** `lu` state explicitly and directs that such a state be read in the
     conservative direction. It is **not** a generic "be conservative" aside that merely happens to
     generalize onto the absent branch — it reaches that branch **by name**, and applied literally
     it would make a legacy hash load as `label_unresolved = True`. This lane's divergence is
     therefore a divergence from an **on-point** instruction, and is disclosed as such rather than
     minimised. **This lane decides otherwise: missing `lu` ⇒ `False`,
     and that decision intentionally supersedes the hint on the absent branch.** The hint was
     written while field name, encoding and validation semantics were still explicitly **open**
     (§13.8 is proposal-only); with those semantics now decided, absence is not ambiguity — it is
     the unambiguous signature of a v1/v2 dumper that never had the field, so treating every
     pre-existing group as unresolved would **over-tag** the entire installed state rather than
     record a real inference. Conservatism is therefore retained exactly where ambiguity is real —
     the *malformed-and-present* branch, which is fail-closed to `True` — and dropped where it is
     not. The divergence is **authorized by the §3 preamble**, which supersedes §13.8's
     proposal-only text on exactly these open questions; it is a disclosed divergence from an
     on-point hint, **not** an oversight, and it does **not** change the decided `lu` behaviour
     stated in the bullets above.
3. **`lu` is restored independently of `lf` validation and clearing.** The existing fail-safe that
   nulls `label_floor` (and consequently `label_system` / `label_system_mixed`) when `lf` is not in
   `_LABEL_RANK` **must not** clear `lu`. An invalid or absent floor and an unresolved contributor
   are independent facts; `effective_label_floor()` already returns the DEFAULT floor **with**
   `unresolved=self.label_unresolved` on the no-floor branch (`correlation.py:451`), and that branch
   is precisely the one this rule keeps honest.
4. **No wire-key change.** `LabelFloor.to_canonical` remains **exactly** `classification` and
   `monitored_system` (`correlation.py:133–139`). `lu` is **internal persisted state only**. There
   is **no envelope change, no JSON-Schema change, no contract change, no migration, and no version
   bump** of any kind. Q3 = A (wire separation) is preserved, not amended.

## 4. Base strategy — how the future product writer starts

1. Create a **fresh** worktree of `cybrik-soc-command-center` on a **new** branch
   **`codex/w1-i03-pf-persist-r2`** at the **exact base**
   `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`, via non-destructive `git worktree add -b`, at the
   **exact pinned path**
   **`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`**. That path is
   **pinned, not suggested**: creating the worktree anywhere else is scope drift and a hard stop
   (§8). If **either** the branch `codex/w1-i03-pf-persist-r2` **or** the path
   `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2` already exists,
   **stop without changes** — do not reuse, do not clean, do not force, do not pick a variant path
   or an `-r3` suffix. The base is **unchanged from the `r1` attempt**: still
   `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`, **not** any `r1` branch tip.
   - **`r1` existence is expected and must NOT trip this preflight.** The rejected `r1` worktree
     `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r1` and its branch
     `codex/w1-i03-pf-persist-r1` **still exist and are expected to exist** (§10A.4). The
     absence test above is scoped **exclusively to the `r2` path and the `r2` branch**. A writer
     that stops because `r1` exists has misread this preflight; a writer that deletes, cleans,
     branches from, resets, or otherwise touches `r1` has broken the read-only freeze and hard-stops
     (§8). **`r1` is never the base, never the target, and never writable.**
2. **Faithfully transplant** the existing **six-path I03 working-tree patch** from
   `w1-i03-marking-floor-r2-phase1-r1` into the fresh worktree — as a byte-faithful transplant of
   the reviewed dirty tree, **not** a re-implementation and **not** a re-review. The **original
   reviewed worktree remains read-only** and must not be written, staged, committed or cleaned.
   **Mechanism, fixed:** copy the **six exact paths of the §4.3 table**, one file at a time, from
   the reviewed worktree to the **same relative path** in the fresh worktree (a plain byte copy —
   `cp <reviewed-wt>/<path> <fresh-wt>/<path>` — is acceptable and is the expected form). Copy
   **only** those six paths; a seventh copied path is scope drift and a hard stop (§8).
   **No intermediate artefact is created anywhere**: no `git diff > …` patch file, no
   `git format-patch`, no `git stash` / `stash apply`, no tarball, no scratch copy — **neither
   inside either repository nor in any new temp directory**. The only ephemeral directories this
   run may create are the **four** named in §§6–7 (stub, `PYTHONPYCACHEPREFIX`, `RUFF_CACHE_DIR`,
   baseline-manifest); the transplant adds **none**. Byte fidelity is not assumed from the copy
   mechanism — it is **proved**
   by the six-hash re-measurement of §4.3, which runs against the transplanted files before any new
   edit.
   - **The six inherited paths come from the reviewed phase-1 worktree, NOT from `r1`.** `r1` also
     contains those six paths, and copying them from `r1` would be **shorter and is forbidden**.
     They are copied from `w1-i03-marking-floor-r2-phase1-r1` and **rehashed** against the §4.3
     table exactly as in the `r1` attempt. `r1`'s status as a read-only reference (§4.7) extends
     **only** to the two PF paths, never to these six.
3. **Re-verify the six full SHA-256 pins** from the imported I03 packet
   (`docs/operations/W1-I03-MARKING-FLOOR-R2-DECISION-PACKET.md`, §13.2 Phase-1 test digests and
   §13.4 Phase-2 source digests) against the transplanted files, before any new edit:

   | # | Path | SHA-256 |
   |---|---|---|
   | 1 | `services/api/src/cybrik_soc/modules/ingest/source_labels.py` | `15a2dc67dc1e3935b7cc73a04cdef7c6df4bf49c7d7697f5ba57ff38d00457ef` |
   | 2 | `services/api/src/cybrik_soc/modules/siem/correlation.py` | `c144b8bf7465dcbac1412aa6fceea319bc35b368d8c23cbcb479978b87bdeb45` |
   | 3 | `services/api/src/cybrik_soc/modules/siem/engine.py` | `e640f9dc0404103ef4a101adf2eddb9373325e8b67df2e067114cb7e3abfb542` |
   | 4 | `services/api/tests/unit/test_ingest_label_floor.py` | `b5db2162631620e8074b189088feabff9529b2e26f435d428fdbe4b028a8aadb` |
   | 5 | `services/api/tests/unit/test_siem_correlation.py` | `5d929f16f8cba1aa25344e21b9e542a18ca78a0598d928a2026971ebc0516491` |
   | 6 | `services/api/tests/unit/test_siem_engine.py` | `dae47bb6a96956f1ea022225072bf84df2bbb6528bb4bddc35087ad9468c55e8` |

   Digests 4–6 are published in §13.2 **without** a digest↔filename mapping; the mapping shown here
   was re-derived by direct measurement of the reviewed worktree for this grant and **is** asserted.
   Digests 1–3 are mapped in §13.4 itself. **Any mismatch is a hard stop** (§8).
4. **Exactly two writable product paths, and no third:**
   - `ops/pf-workers/pf_workers/correlation_processor.py`
   - `ops/pf-workers/tests/test_correlation_processor.py`
5. **Final expected dirty set: exactly 8 modified paths** — the 6 inherited I03 paths plus the 2
   writable paths — with **zero staged**, **zero untracked**, and **zero commits ahead of base**
   (the `r2` branch tip stays at `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`). The **six inherited
   hashes must be unchanged** at the end of the run, re-measured and reported. This ceiling is
   **unchanged from the `r1` attempt** — round 4 re-points the target, it does not widen the
   envelope.
6. **Baseline artefact inventory, taken before any other command.** Immediately after the fresh
   worktree exists and the six-file transplant and its §4.3 pin re-verification are complete, and
   **before any PF edit, any preflight probe, any test run and any implementation byte**, the writer
   takes the read-only baseline inventory of §7 over **both** trees. Nothing in §§5–8 may run before
   that baseline exists: an end-of-run comparison against a baseline captured *after* the run
   started would compare the run to itself and prove nothing.
7. **`r1` is a READ-ONLY REFERENCE, and only for the two PF paths.** The rejected `r1` worktree
   `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r1` is preserved
   **byte-unchanged** (§10A.4). Its **technical** content — the PF test design and the PF source
   design — was reviewed and found **semantically correct**; only its **process authority** failed.
   The `r2` writer may therefore **read** it, subject to all of the following, each a hard stop if
   broken (§8):
   - **Never write to `r1`.** No edit, stage, commit, clean, checkout, reset, branch-from, worktree
     removal, or any other mutation. `r1`'s dirty set, hashes and branch tip must be **identical
     before and after** the `r2` run, and this is measured and reported like the reviewed source
     worktree's is (§7 end-of-run `git status` exactness) — **three** trees are now checked, not two.
   - **Reference scope is the two PF paths only:** `ops/pf-workers/tests/test_correlation_processor.py`
     and `ops/pf-workers/pf_workers/correlation_processor.py`. The six inherited paths are **not**
     taken from `r1` (§4.2).
   - **Phase gating.** The PF **test** bytes of `r1` may be read and copy-referenced **before** RED,
     subject to the §5A.2 drift-correction duty. The PF **source** bytes of `r1` may be read and
     copy-referenced **only after a valid RED has been observed** (§5A.7). Reading `r1`'s source
     before RED is a hard stop — it is exactly the shortcut that makes a RED observation
     unfalsifiable.
   - **`r1` carries no authority.** It is not accepted, not promotable, not a baseline, not a pin,
     and its own run evidence is **not** reusable as `r2` evidence. Every `r2` measurement is taken
     fresh in `r2`.

## 5. Test-first cases — write RED before any implementation byte

All ten are **pure serializer / pure dataclass** tests. None may start a stack, open a socket, or
require Valkey. **The existing skip is fixture-scoped, not module-scoped:**
`test_correlation_processor.py` calls `pytest.skip(...)` **inside the `store` fixture** when it
cannot connect to Valkey (`PF_VALKEY_URL`, default `localhost:6380`), so the skip reaches **only
those nodes that request `store`** (directly or transitively) — nodes that do not request it, such
as the existing in-memory contrast tests, still execute normally. There is no module-level skip
guard. The new cases must therefore **not request the `store` fixture** (nor any fixture that
requests it), which is exactly what keeps them independent of that skip and makes them actually
execute.

| # | Case | Class |
|---|---|---|
| 1 | `dump_group_state` writes **no** `lu` key when `label_unresolved` is false, and `lu == "1"` when true — conditional dump. | **RED-required** |
| 2 | `label_unresolved=True` survives a `dump` → `load` round-trip. | **RED-required** |
| 3 | A legacy hash with **no** `lu` key loads to `False` (legacy compatibility). **This is a regression-lock, not a RED case:** the pre-lane reader never reads `lu` at all, so a `lu`-less hash already loads to the dataclass default `False` and this assertion **passes before implementation**. What it locks is that the §3 decision-2 reader **keeps** that answer on the absent branch (the disclosed, authorized divergence from the basis packet's on-point conservative-value hint, which names the absent-or-unparseable case directly) instead of flipping legacy state to unresolved. | **Regression-lock** |
| 4 | A **present but malformed** `lu` (e.g. `"yes"`, `""`, `"2"`, or a non-string) loads to `True`, fail-closed. `""` must be asserted **present-and-malformed**, proving the reader membership-tests the key rather than testing truthiness (§3 decision 2). The **non-string** variants must be labelled in the test and in the evidence as **synthetic-only / defensive**: `decode_responses=True` means the real client yields `str`, so a non-string value is **not reachable in production** and this case fixes the branch against a future client-config change, nothing more. | **RED-required** |
| 5 | An explicit `lu == "0"` loads to `False`. This case exists for **forward- and foreign-hash compatibility** — reading a hash written by a future or third-party dumper that chose to emit `"0"` explicitly — **not** as a round-trip of this lane's own output: **the dumper specified in §3 decision 1 must never emit `lu = "0"`**, and case 1 asserts that absence. A writer that "fixes" case 5 by making the dumper emit `"0"` has broken decision 1 and case 1. **This is a regression-lock, not a RED case:** the pre-lane reader ignores `lu` entirely, so `lu == "0"` already loads to `False` and this assertion **passes before implementation**. What it locks is that the new membership-tested, fail-closed reader (§3 decision 2) does **not** sweep `"0"` into the malformed⇒`True` branch. | **Regression-lock** |
| 6 | `lu` survives the **invalid-`lf` clearing** path: an `lf` outside `_LABEL_RANK` nulls floor/system/mixed while `label_unresolved` stays `True`. | **RED-required** |
| 7 | **Monotonic OR across reload**: dump a `True` state, load it, then `raise_label_floor` with a **resolved** reading — the flag stays `True`. | **RED-required** |
| 8 | After reload, `effective_label_floor()` carries `unresolved=True`, i.e. the input the `label:unresolved-floor` tag rule consumes is restored. **Assert the restored `LabelFloor` field only** — do **not** assert tag emission at runtime, and do not re-implement the tag; the tag itself is emitted by `source_labels.py:52` and by its `if eff.floor_unresolved:` guard at **line 244** / `_append_tag` call at **line 248**, which are **not** writable in this lane. | **RED-required** |
| 9 | **Exact two-key wire lock**: `LabelFloor.to_canonical()` returns exactly `{"classification", "monitored_system"}` — `lu`/`unresolved` never appears on the wire. | **Regression-lock** |
| 10 | **Classification no-downgrade**: a valid `lf` (including `toi_mat`) round-trips unchanged, and adding `lu` changes no floor, system or mixed outcome. **Its comparison set is exhaustive and verbatim — see the case-10 scope block below.** | **Regression-lock** |

**Case 10 — exhaustive, verbatim comparison scope.** Case 10 compares a with-`lu` load against a
without-`lu` load. The set of properties compared is **closed and complete**, and consists of
**exactly these four and no others**:

1. `label_floor`
2. `label_system`
3. `label_system_mixed`
4. `effective_label_floor().classification`

**No fifth property may be compared, asserted, or incidentally locked in case 10.** In particular:

- **`label_unresolved` must NOT be asserted in case 10, in any form** — not equal, not unequal, not
  `True`, not `False`, not via a whole-object/`dataclasses.asdict`/`==`-on-`_GroupState` comparison
  that would sweep it in, and not via `effective_label_floor().unresolved` or
  `.floor_unresolved`. This is an **explicit prohibition**, not a silence. Case 10 exists to prove
  that adding `lu` **does not disturb the classification axis**; the `lu` axis itself is owned by
  **cases 2 and 3** (round-trip `True`, legacy-absent `False`), and duplicating it here would make
  case 10 fail for a reason that has nothing to do with what it locks.
- Comparing `_GroupState` instances **wholesale** is therefore forbidden in case 10: the two states
  under comparison **legitimately differ** in `label_unresolved`, which is the whole point.
  Compare the four named properties **individually**.
- **All other cases are unchanged** by this block. Cases 1–9 keep exactly the scope stated in the
  table above.
- A case-10 assertion outside the four-item set is an **out-of-grant, self-authored assertion** and
  an unconditional hard stop (§5A.5, §8) — including when it "passes".

**Exact classification — six RED-required cases, four regression-locks.**

- **RED-required: cases 1, 2, 4, 6, 7, 8 — and only these six.** Each must be observed **failing
  before any implementation byte is written**, and the observed failure mode of each must be
  reported **verbatim**. These are the six behaviour-changing cases: nothing in the pre-lane
  serializer writes or reads `lu`, so none of them can pass until the change exists. A RED-required
  case that passes before implementation is a hard stop (§8) — it means the test does not actually
  exercise the new behaviour.
  - **Case 1 stays one combined node.** It asserts both halves of the conditional dump — no `lu`
    key when the flag is false, `lu == "1"` when it is true — in a **single** test node, because
    the two halves are one decision and asserting them apart would let a dumper that always emits
    `lu` satisfy one half. Its false-branch half would pass on its own against the pre-lane dumper;
    the **node as a whole** still fails first, on the true-branch half, which is what the RED
    observation records. Do **not** split case 1 into two nodes to make the RED evidence tidier.
- **Regression-locks: cases 3, 5, 9, 10.** All four are expected to be **GREEN at first write** —
  they lock behaviour that **already holds** and must keep holding, so **they are not RED-required
  and must not be made to fail**. Cases 9 and 10 lock the wire shape and the classification
  no-downgrade guarantee; cases 3 and 5 lock the two answers the pre-lane reader already gives for
  absent `lu` and for `lu == "0"`, against a new reader that could regress either one (absence
  flipped to unresolved, or `"0"` swept into the fail-closed branch). A regression-lock that fails —
  before or after implementation — is a hard stop (§8).
- **No case may assert a runtime, deployment, throughput, latency or persistence-in-production
  claim.** These are serializer unit tests and nothing more.

## 5A. `r2` TDD sequence and RED-gate discipline — ordered, and each step a boundary

**Why this section exists.** The `r1` attempt produced technically-correct code and was still
rejected. Its first RED came out **7 failed / 3 passed** with a **regression-lock failing**, which
§8 already made an unconditional hard stop; the writer instead **self-corrected its own test and
continued**, converting a stop into a retry inside the same authority. That is the `P1` authority
breach of §10A.4. The steps below are numbered because **their order is the control**; a step
performed out of order is a stop even if every step is eventually performed.

1. **Create `r2` and transplant.** Per §4.1 (fresh `r2` worktree and branch at the unchanged base,
   `r1`-existence explicitly not a blocker) and §4.2 (the **same six** pinned phase-1 files, copied
   from the **reviewed phase-1 worktree**, byte-exact) and §4.3 (six-hash re-verification). The
   §4.6 / §7 **baseline-delta hygiene** discipline is **retained in full and unchanged** — baseline
   taken after transplant and before any probe, test, edit or implementation byte.
2. **Author the PF TEST path first — and only it.**
   `ops/pf-workers/tests/test_correlation_processor.py` is the **only** file that may be edited at
   this step. **Not one byte** of `ops/pf-workers/pf_workers/correlation_processor.py` may change
   before the RED gate of §5A.4 has passed.
   - **Reading and copying `r1`'s test bytes as a reference is explicitly ALLOWED** (§4.7), and is
     expected — `r1`'s test design was reviewed as semantically correct.
   - **But `r1`'s test additions carry two known format-drift hunks that `r1` introduced** (§7A).
     **Before the first RED, the `r2` writer must correct those two hunks BY HAND** in the new test
     additions, so that the `r2` additions carry them **not at all**. This is a manual edit of the
     writer's own new lines. **No formatter and no auto-fixer is authorized** — not
     `ruff format`, not `ruff --fix`, not `black`, not an editor-on-save formatter, not on the file
     and not on a fragment of it (§7, §8). Correcting the drift **after** RED is impossible, because
     the test bytes are frozen at §5A.6; correcting it **by formatter** at any time is a hard stop.
3. **Case 10 scope is exhaustive and verbatim** as specified in the §5 case-10 scope block: compare
   with-`lu` against without-`lu` for **`label_floor`, `label_system`, `label_system_mixed`, and
   `effective_label_floor().classification`, and nothing else**; **any** assertion about
   `label_unresolved` in case 10 is **explicitly forbidden** (cases 2 and 3 own that behaviour).
   **All other cases are unchanged.**
4. **Freeze the test, pin both bytes, then run the RED gate.** In this order:
   1. The test file is **frozen**. Record its **SHA-256**, line count and byte count and report them.
   2. `ops/pf-workers/pf_workers/correlation_processor.py` must still be the **exact, unmodified
      base bytes**. Record and report **its** SHA-256 as well, and state explicitly that it equals
      the base blob. A processor that differs by even one byte at this instant means the RED is not
      a RED, and is a hard stop.
   3. Run the **exact ten nodes** (the §5 selector), under the full §7 prelude.
   4. **Required first result — stated exactly, and this is the only accepted RED:**
      **cases 1, 2, 4, 6, 7, 8 FAIL; cases 3, 5, 9, 10 PASS; 6 failed / 4 passed.** Report the
      verbatim failure mode of each of the six.
5. **ANY mismatch at the RED gate is an UNCONDITIONAL STOP.** This includes — non-exhaustively — a
   different split (e.g. `r1`'s **7/3**), a **regression-lock failing**, a RED-required case
   passing, an error/collection failure, and a failure traced to a **self-authored or out-of-grant
   assertion** (such as a `label_unresolved` assertion smuggled into case 10). At that instant:
   - the writer **may not repair, rewrite, relabel, reclassify, re-scope, or re-run** the tests, and
     **may not** restart the RED, **in the same authority**. There is no "fix it and try again"
     branch. The self-correct-and-continue move is precisely what disqualified `r1`.
   - the writer **reports the partial evidence** for the coordinator — the frozen test SHA-256, the
     processor SHA-256, the full observed node-by-node result, and the verbatim failure modes — and
     **stops**.
   - **no implementation byte is written**, then or later, under this authority.
   - reopening requires a **new, separately authorized round** (`r3`), which is a coordinator
     decision that does not exist in advance and is **not** granted by this file.
6. **After a valid RED, the PF test file bytes are IMMUTABLE for the remainder of the writer
   session.** **Any** edit to that file after RED — including a **cosmetic** one, a **comment**, a
   **docstring**, a **whitespace or format** change, a rename, or a re-order — **invalidates the
   RED gate** and is an **unconditional stop**. The **same writer may not restart RED** after such
   an edit. The frozen SHA-256 recorded at §5A.4.1 is **re-measured at end of run and must be
   identical**; both values are reported.
7. **Only after a valid RED:** implement the PF source. The reviewed `r1` PF **source** design may
   now be read and copy-referenced (§4.7 phase gating) into the **one** writable source path
   `ops/pf-workers/pf_workers/correlation_processor.py`. The **six inherited paths are not changed**
   — not at this step and not at any step; their hashes are re-measured and must equal §4.3.
8. **GREEN, then regressions, then lint, then syntax** — per §7, with **no test bytes changed after
   RED**. All ten nodes pass at GREEN; the full-module and engine-regression runs report as
   specified; `ruff check` must pass; `ruff format --check` behaves as §7A specifies; `py_compile`
   passes. A GREEN reached by editing the test is not a GREEN — it is the §5A.6 stop.

## 6. Evidence class — `NO INSTALL`, `NO NETWORK`, borrowed interpreter

- **Interpreter (borrowed, read-only):**
  `/Users/hoanglinh/Claude/Projects/cybrik-soc-command-center/services/api/.venv/bin/python`
  — **CPython 3.12.13**. The venv is **used, never written**: no `pip`, no `uv`, no
  `pip install -e`, no `.pth` file, no package added or removed, no cache written inside it.
- **`PYTHONPATH` is forced to the fresh worktree source**, so that the engine under test is the
  transplanted `cybrik_soc` and never the borrowed venv's own copy. With
  `<fresh-wt>` = **`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`**
  (the pinned path of §4.1):
  `PYTHONPATH=<fresh-wt>/services/api/src:<fresh-wt>/ops/pf-workers:<stub-dir>`.
  `correlation_processor.py` imports `redis` and `cybrik_soc.modules.siem.correlation` inside a
  `try/except` that degrades to `PROCESSOR_MODE = "unavailable"` — if that guard trips, `_GroupState`
  and `_LABEL_RANK` are simply absent and the tests fail confusingly. The writer must **assert
  `REUSE_REAL is True` in preflight** rather than discover this from a `NameError`.
- **Module-origin assertion — the borrowed venv must not win the import. This is a measured hazard,
  not a hypothetical one.** `PYTHONPATH` alone does **not** guarantee the right origin, and in this
  specific venv it demonstrably does not: the borrowed venv **carries an editable-install `.pth`
  file, `_editable_impl_cybrik_soc_api.pth`, whose target is the main
  `/Users/hoanglinh/Claude/Projects/cybrik-soc-command-center` checkout** — not the fresh worktree.
  This was **measured**, and the wording here is a statement of fact, not of possibility: the
  competing `cybrik_soc` resolution **exists** and `.pth` entries are processed at interpreter
  start, before any test code runs. Resolving to that editable target, to the main checkout, or to a
  `site-packages` copy is **explicitly not accepted** — evidence gathered that way tests the wrong
  bytes and is void. The module-origin assertions of §7 are therefore **unconditional**: they run on
  every invocation of this lane regardless of what any later re-measurement of the venv shows, and
  they are **not** softened, skipped or made conditional on the `.pth` still being present. If a
  future measurement finds the `.pth` gone, the assertions still run unchanged.
- **Dependency reality, measured on the borrowed interpreter:** `redis 8.0.1`,
  `pydantic-settings 2.14.2`, `sqlalchemy 2.0.51`, `pytest 9.1.1`, `pytest-asyncio 1.4.0`,
  `ruff 0.15.22`, `pyyaml` — **all present**. **`aiokafka` alone is absent**, and it is imported
  **unconditionally** at module scope in `correlation_processor.py` (`from aiokafka import
  AIOKafkaConsumer, AIOKafkaProducer`), outside the `try/except` guard. That single missing import
  blocks even a pure-serializer import of the module.
- **Bounded remedy — one ephemeral import stub.** Because `aiokafka` **alone** is missing, the writer
  may create **one** ephemeral `mktemp -d` directory **outside all repositories**, containing
  **only** a minimal `aiokafka` import stub exporting the names `AIOKafkaConsumer` and
  `AIOKafkaProducer`. Conditions, all mandatory:
  - the stub is an **import seam only**; its classes must **never be instantiated, subclassed,
    patched-over, or called** — the tests are **pure serializer tests**;
  - **nothing is written inside either repository** — the stub directory lives only under the
    `mktemp` path and reaches the interpreter via `PYTHONPATH`;
  - **if imports still fail, or if any test touches the stub classes, STOP.** There is **no `pip`
    fallback and no network fallback** — not for `aiokafka`, not for anything else;
  - the temp directory is **removed before stopping**, and its removal is verified and reported.
    The same duty applies to **every** ephemeral `mktemp -d` directory the run creates. The
    **complete, closed enumeration of allowed out-of-tree ephemeral artefacts is four directories**:
    the **stub** dir (this bullet), the **`PYTHONPYCACHEPREFIX`** dir (§7), the **`RUFF_CACHE_DIR`**
    dir (§7), and the **baseline-manifest** dir (§7) that holds the pre-run and post-run artefact
    inventories. A fifth ephemeral directory is scope drift and a hard stop. **All four** are removed
    before stopping, and **each** removal is verified by a post-removal existence test and reported
    by path. An unverified removal of **any** of them is a hard stop (§8). The baseline manifests in
    particular are **never** written inside either repository — no repo-local manifest file, not even
    a `.gitignore`d one — and they are **not** carried out of the run as an artefact.
  - **Containment — every scratch byte lives inside one of those four directories.** The closed set
    is a set of **containers**, not merely a cap on directory count. **Every** scratch, bookkeeping,
    note, list, path-record, manifest, delta, log or intermediate file the run creates **must be
    written inside one of the four `mktemp -d` directories**. There is **no fifth directory**, and —
    stated separately because it is the gap `r1` actually fell through (§10A.4) — **no standalone
    out-of-tree file** either: a loose file such as `/tmp/<name>.txt` sitting beside the four
    directories rather than inside one of them is **out of the closed set**, even though it creates
    no fifth directory and even though it is outside both repositories. `r1` wrote exactly such a
    file (`/tmp/pfp-dirs.txt`) to track its own temp-directory paths; the correct form is a file
    **inside** the baseline-manifest directory. All four directories, and therefore everything the
    run wrote, are **removed and their removal verified and reported**.
- **Disclosure duty.** The writer's evidence must state plainly, in its own words and not by
  reference: **the interpreter was borrowed from another service's venv, and an ephemeral
  `aiokafka` import stub was on `PYTHONPATH`.** Any result produced under those conditions is
  **serializer-level unit evidence only**. It is **not** runtime evidence, **not** integration
  evidence, and **not** proof that the real worker imports, starts, or persists anything.

## 7. Commands — shape fixed, counts reported and never predicted

Every count below is written as `<report>`. The writer **reports the exact observed number**;
predicting, rounding, or copying a number from this grant is a hard stop (§8).

**Mandatory environment prelude — applies to every command in this section, with no exception.**
Set once, before any probe, and keep set for the whole run:

- **`PYTHONPATH`, enumerated explicitly and pinned to the fresh target — on every `python`,
  `python -m pytest` and `py_compile` invocation without exception.** The exact value, with
  `<fresh-wt>` = **`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`**
  (the pinned path of §4.1) and `<stub-dir>` the ephemeral `aiokafka` stub directory of §6:
  `PYTHONPATH=<fresh-wt>/services/api/src:<fresh-wt>/ops/pf-workers:<stub-dir>`.
  The first two entries are **pinned to the fresh target and to nothing else** — never the reviewed
  source worktree, never the main `cybrik-soc-command-center` checkout, never a relative path, never
  a bare `.`. Each command in this section is written and reported **with `PYTHONPATH` shown in its
  own prelude**, not inherited implicitly from an earlier shell; a `python`/`pytest`/`py_compile`
  invocation that does not carry this exact three-entry `PYTHONPATH` is a **hard stop** (§8), as is
  any invocation carrying an entry outside the enumeration above. **This does not replace or weaken
  the module-origin assertions**: `PYTHONPATH` is necessary and **not** sufficient — the borrowed
  venv's measured `_editable_impl_cybrik_soc_api.pth` (§6) can still win — so the three unconditional
  origin assertions below run in addition to it, never instead of it.
- `PYTHONDONTWRITEBYTECODE=1` **and** `PYTHONPYCACHEPREFIX=<tmp-pyc>`, where `<tmp-pyc>` is a
  dedicated `mktemp -d` directory **outside both repositories**. Both are set together — belt and
  braces — so that **no `__pycache__` can land in either tree** even if one is dropped by a nested
  invocation. **Every** `python` / `python -m pytest` / `py_compile` invocation below inherits them;
  an invocation that does not carry them is a hard stop.
- `RUFF_CACHE_DIR=<tmp-ruff>`, a second `mktemp -d` directory **outside both repositories**, **and**
  `--no-cache` passed explicitly on **every** `ruff` invocation. Again both, so a dropped variable
  cannot silently produce an in-tree `.ruff_cache`.
- `-p no:cacheprovider` on **every** pytest invocation (already shown per-command below), so no
  `.pytest_cache` is written.
- `COVERAGE_PROCESS_START` and `COVERAGE_PROCESS_CONFIG` must be **unset** — see the preflight
  assertion below.

All **four** ephemeral directories — `<tmp-pyc>`, `<tmp-ruff>`, the §6 stub dir and the
`<tmp-baseline>` manifest dir below — are removed and their removal verified before stopping (§6).

- **Baseline artefact inventory — first command of the run, before every probe, test and edit.**
  After the fresh worktree exists and the six-file transplant and §4.3 pin re-verification are
  complete (§4.6), and **before any other command in this section**, take a **read-only** inventory
  of both trees. This is the measurement the end-of-run check is compared against; taking it late
  invalidates the whole check.
  - **Scope — exactly these artefact names/patterns, no more and no fewer:** `__pycache__`,
    `.pytest_cache`, `.ruff_cache`, `.mypy_cache`, `.coverage`, `coverage.*`.
  - **Trees — both, inventoried independently:** the reviewed source worktree
    `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-marking-floor-r2-phase1-r1` and
    the fresh target `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`.
    Each tree gets **its own** baseline and is later compared **only against its own** baseline.
    **Do not assume the two trees' contents are equal** — they are not required to be, and asserting
    equality between them is not the check being asked for.
    **The `r1` tree is deliberately NOT in this artefact inventory**, and that is not an oversight:
    no command of this run executes with `r1` on `PYTHONPATH`, in `r1`'s `cwd`, or with `r1` as a
    pytest/ruff target, so this run cannot deposit an artefact there. `r1` is instead protected by
    the **read-only freeze** of §4.7 and verified by the end-of-run `git status` exactness check
    below, which covers **three** trees.
  - **Record shape — deterministic, sorted, content-identified.** Emit a **sorted** set of
    **tree-relative** paths. For every **file** matched (or contained in a matched directory)
    record its **SHA-256** alongside the relative path. For every matched **directory**, recurse and
    record **every** contained file's relative path and SHA-256. **Empty directories must remain
    detectable** — emit an explicit directory record (e.g. a `dir <relpath>` line) for each matched
    directory whether or not it contains files, so that an emptied-out or newly-created empty cache
    directory is visible in the delta. Sort the final record set with a fixed collation (`LC_ALL=C
    sort`) so the manifest is byte-reproducible for an unchanged tree. The manifest must be
    sufficient to detect, on its own, **added paths, removed paths, and byte mutation of any
    recorded file**.
  - **Storage — out-of-tree only.** The two manifests live **exclusively** in `<tmp-baseline>`, a
    `mktemp -d` directory **outside both repositories** and the fourth and last allowed ephemeral
    directory (§6). **No manifest, scratch file or delta output is written inside either
    repository**, ignored or not. `<tmp-baseline>` is removed at cleanup and its removal verified
    and reported like the other three.
  - **Measured pre-existing baseline — disclosed here, and re-measured, never assumed.** As
    measured for this grant: the **reviewed source worktree already carries** a root `.ruff_cache`
    **and** `services/api/.ruff_cache`, **and** `services/api/.coverage`, which at base
    `d3aaf6fb29c57f145de8f131ad1588aae57d57c9` is a **tracked blob**
    (`git blob 4684da92131d8d58c0c5bbf01f2760f2976ff3b9`; reviewed-tree file content SHA-256
    `5add686d730b2e7cad1b0cec189fabb41284ece843c0602842389df36ecb0d7d`). Because that `.coverage` is
    **tracked at the base commit**, the **fresh target necessarily contains it too** the moment
    `git worktree add` checks the base out — before this lane runs a single command. **These
    artefacts are therefore pre-existing state, not residue of this run, and their mere presence is
    not a finding.** The writer nonetheless **measures both trees independently** rather than
    trusting the paths and digests quoted here: this disclosure exists so a reviewer can recognise
    the expected shape, not so the writer can skip the measurement. A divergence between this
    disclosure and the measured baseline is **reported**, not silently accepted and not "corrected"
    by editing anything.
- **Preflight probes:**
  - `python -V`; per-module import probes for `aiokafka` (expected absent before the stub), `redis`,
    `pydantic_settings`, `sqlalchemy`, `pytest`, `yaml`.
  - **Coverage-environment assertion:** assert that **both** `COVERAGE_PROCESS_START` **and**
    `COVERAGE_PROCESS_CONFIG` are **unset** in the environment (absent from `os.environ` — an empty
    string still counts as set). Either one being set would cause `coverage` to attach to every
    subprocess and write new `.coverage` / `coverage.*` files into the tree — **or mutate the
    tracked `services/api/.coverage` in place** — which the baseline-delta rule below and §8's
    residue stop both prohibit. **If either is set, STOP** — do **not** unset it and
    proceed, do **not** work around it. **No coverage run of any kind is authorized under this
    grant**, deliberate or incidental.
  - **Module-origin assertions — all three, and all before any test runs:**
    1. `import cybrik_soc; assert cybrik_soc.__file__` resolves **under**
       `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`;
    2. `import pf_workers.correlation_processor as CP; assert CP.__file__` resolves **under** that
       same pinned fresh-worktree path;
    3. `assert CP.REUSE_REAL is True`.
    Report all three resolved paths verbatim. **A resolution under the borrowed venv's
    `site-packages`, under an editable-install `.pth` target, or under the main
    `/Users/hoanglinh/Claude/Projects/cybrik-soc-command-center` checkout is explicitly NOT
    accepted and is a hard stop** — not a warning, not something to note and continue past. Any
    evidence produced after such a resolution tests the wrong bytes and is void.
  - Re-measure the six pins of §4.3 (`shasum -a 256`) and confirm they equal the table;
    `git status --porcelain` on **all three** trees — the fresh `r2` target, the reviewed source
    worktree, and the read-only-frozen `r1` reference — plus the **pre-run** SHA-256 of `r1`'s two
    PF paths, so the end-of-run §4.7 freeze check has a same-run pre-value to compare against
    rather than trusting the §10A.4 pins alone. Report all of them.
- **RED:** run the **exact ten nodes** —
  `python -m pytest ops/pf-workers/tests/test_correlation_processor.py -k '<new-node-selector>' -p no:cacheprovider`
  — after the §5A.4 freeze (test SHA-256 recorded; processor proved to be **exact unmodified base
  bytes**, its SHA-256 recorded). Report failed / passed / errors as observed, plus the verbatim
  failure mode of **each** of the six RED-required cases. **The required first result is fixed by
  §5A.4.4, in both split and count: cases 1, 2, 4, 6, 7, 8 FAIL; cases 3, 5, 9, 10 PASS;
  6 failed / 4 passed.** **Any** other outcome — a different count, a RED-required node passing, a
  regression-lock node failing, an error, or a failure arising from a self-authored/out-of-grant
  assertion — is an **unconditional hard stop** under §5A.5 and §8, with **no repair, no rewrite,
  no relabel and no re-run in the same authority**.
  - **This is the one place a count is fixed in advance, and it is a gate, not a prediction.** It
    is derived from the §5 classification, which is itself fixed. **The "never predict a count"
    rule of this section's preamble continues to apply, unweakened, to every other `<report>`
    count in this grant** — GREEN, full-module passes and skips, engine regression, and the §7A
    hunk counts are all **observed and reported**, never copied from this file.
- **GREEN:** the same focused selector after implementation, with **all ten** nodes — the six
  formerly-RED and the four regression-locks — now passing → report `<report>` passed /
  `<report>` failed / `<report>` errors. **The test file's SHA-256 at GREEN must equal the frozen
  value recorded at §5A.4.1**; re-measure and report both. A GREEN produced with even a cosmetic
  test edit after RED is not a GREEN — it is the §5A.6 stop.
- **Full module, only if safe:** `python -m pytest ops/pf-workers/tests/test_correlation_processor.py
  -p no:cacheprovider` → report `<report>` passed / `<report>` skipped / `<report>` failed /
  `<report>` errors. **Skips are the expected outcome for the pre-existing Valkey-backed nodes** —
  every node that requests the `store` fixture skips when no live Valkey answers — while the
  pre-existing nodes that do **not** request `store`, and the ten new serializer nodes, execute
  normally. The skip is **fixture-scoped, not module-scoped** (§5), so do not describe or report
  this as the module skipping wholesale. **Report the skips as skips.** Do **not** start Valkey to
  convert them, and do **not** present a skip as a pass.
- **Engine regression:** the SOC correlation-engine unit tests that the transplanted patch owns —
  `python -m pytest services/api/tests/unit/test_siem_correlation.py services/api/tests/unit/test_siem_engine.py services/api/tests/unit/test_ingest_label_floor.py -p no:cacheprovider`
  → report `<report>` passed / `<report>` failed / `<report>` errors. **What this run confirms, and
  the only thing it confirms:** the transplanted six-path I03 implementation **remains test-intact
  in the fresh worktree** — it still passes its own owned unit tests after the transplant and
  alongside the two new PF paths. It is a **transplant-integrity check, not a proof of
  non-interference**: these tests do not import `pf_workers`, so they could not observe a PF-side
  disturbance even if one existed. **Byte-level integrity of the six inherited paths is proved by
  the §4.3 hash re-measurement, not by this test run**, and the two claims must be reported
  separately and never conflated.
- **Lint:** `ruff check --no-cache` and `ruff format --check --no-cache` scoped to the two writable
  paths, at the `ops/pf-workers` config (`line-length = 100`, `select = ["E","F","I","B","UP"]`),
  with `RUFF_CACHE_DIR=<tmp-ruff>` also set per the prelude. **`--check` only — never `--fix`,
  never `format` without `--check`.** A `ruff` invocation lacking **both** `--no-cache` and an
  out-of-tree `RUFF_CACHE_DIR` is a hard stop. **`ruff check` must pass. `ruff format --check` is
  expected to FAIL, at base and at the end, and is governed by the format-drift budget of §7A —
  read §7A before interpreting either result.**
- **Syntax:** `py_compile` / AST parse of the two writable paths, under the prelude's
  `PYTHONDONTWRITEBYTECODE=1` **and** `PYTHONPYCACHEPREFIX=<tmp-pyc>` (both **outside both
  repositories**), so no `__pycache__` lands in-tree.
- **End-of-run residue verification — baseline delta, not an absolute count.** After the last
  command and before stopping, repeat **the same deterministic inventory**, over the **same two
  trees**, for the **same six artefact names/patterns**, with the **same record shape and the same
  sort collation** as the baseline above. Then compare **each tree's post-run manifest against that
  tree's own baseline manifest**, byte-for-byte and set-for-set (a plain `diff` of the two sorted
  manifests is the expected form). Report the inventory command, the comparison command, and the
  **complete** output of both.
  - **`PASS` is defined as: the manifest is byte-identical to that tree's baseline, and nothing new
    appeared.** Concretely — **no added path, no removed path, no changed SHA-256, and no changed
    directory record**, in either tree. An empty `diff` in both trees is the required result.
  - **Any** added, removed or content-changed path or directory record, in either tree, is a **hard
    stop** (§8). This is the full residue rigor of the previous absolute rule: a `__pycache__` this
    run creates, a `.pytest_cache` it drops, a `.ruff_cache` entry it adds or rewrites, a new
    `coverage.*` file, or a mutated `services/api/.coverage` **all** appear in the delta and **all**
    stop the run. No new residue is tolerated anywhere.
  - **Pre-existing artefacts that are unchanged are a `PASS`, not a finding.** The measured baseline
    — root `.ruff_cache` and `services/api/.ruff_cache` in the reviewed source tree, and the
    **tracked** `services/api/.coverage` present in **both** trees — is expected to be there at the
    end exactly as it was at the start. **There is no "zero hits" requirement anywhere in this
    grant**; such a requirement would be **unsatisfiable**, because `services/api/.coverage` is a
    tracked blob at the base commit and is checked out into the fresh target before this lane runs.
    A hard stop is **never** triggered by an unchanged pre-existing artefact.
  - **No laundering.** The writer must **not** delete, clean, truncate, `git checkout`, `git clean`,
    move, or otherwise mutate any pre-existing artefact — before, during or after the run — to make
    the delta come out empty. Removing a baseline artefact is itself a **removed-path delta** and a
    hard stop, and doing it *before* the baseline is taken is a **falsified baseline** and a hard
    stop. The only artefacts this run may create and delete are the four out-of-tree ephemeral
    directories of §6.
  - **`git status --porcelain` is NOT a substitute for this inventory** and may not be used as one:
    these artefacts are routinely `.gitignore`d, so a tree carrying every one of them can still
    report a clean-looking `git status`. The inventory delta is the residue evidence. `git status`
    is reported **separately**, for the exactness assertion immediately below.
- **End-of-run `git status` exactness — reported separately, and required in addition.** This
  closes the laundering gap the ignored-artefact inventory cannot see on its own, and the tracked
  `.coverage` gap the inventory sees only as content:
  - **Reviewed source worktree** `w1-i03-marking-floor-r2-phase1-r1`: still **exactly** its six
    reviewed modified paths, **zero staged**, **zero untracked** — i.e. bit-for-bit the dirty set
    described in §2. Any seventh modified path, any staged entry, any untracked entry, or any
    *missing* one of the six is a hard stop and evidence the read-only guarantee was broken.
  - **Fresh target** `w1-i03-pf-persist-r2`: **exactly eight modified tracked paths** (the 6
    inherited plus the 2 writable of §4.4), **zero staged**, **zero untracked** (§4.5).
  - **Rejected reference worktree** `w1-i03-pf-persist-r1` — **third tree, checked because it is
    read-only-frozen (§4.7):** still **exactly** the eight modified tracked paths it ended the `r1`
    run with, **zero staged**, **zero untracked**, and its branch tip `codex/w1-i03-pf-persist-r1`
    unmoved. The `r1` PF source and PF test SHA-256s pinned in §10A.4 are **re-measured and must be
    unchanged**, and both values reported. Any difference is evidence the `r2` writer wrote to `r1`
    and is a hard stop. This check is **read-only**: it is `git status --porcelain`, `git rev-parse`
    and `shasum`, and nothing else.
  - **`services/api/.coverage` must NOT appear as modified in either tree.** It is tracked, so a
    coverage attach or any in-place rewrite surfaces here as a modified tracked path even though the
    file is invisible to a `.gitignore`-blind reading. Additionally, its **pre-run and post-run
    SHA-256 in the fresh target must be equal**, and both values reported. Inequality — or its
    appearance in the modified set — is a hard stop.
- **Forbidden throughout:** no coverage run of any kind — including incidental coverage attached via
  `COVERAGE_PROCESS_START` / `COVERAGE_PROCESS_CONFIG`, and no `--cov` flag, `pytest-cov` plugin or
  `coverage run` wrapper; no Valkey, Kafka, PostgreSQL or any database; no network; no `pip`; no
  formatter or auto-fixer; no stack.

## 7A. Formatting evidence — the two writable paths are already format-red at base

**The premise, stated plainly so no writer mistakes it for a defect it introduced.**
`ruff format --check` is **expected to FAIL at base** for **both** writable paths — the PF source
`ops/pf-workers/pf_workers/correlation_processor.py` and the PF test
`ops/pf-workers/tests/test_correlation_processor.py`. Those files were format-red before this lane
existed. **No formatter and no auto-fixer is authorized** to change that: not `ruff format`, not
`ruff check --fix`, not `black`, not an editor-on-save formatter, and not "just on the lines I
touched". The files **remain globally format-red at the end of the run**, and that is the
**expected, passing** outcome of this section.

**The rule is a drift budget, not a clean-file requirement.** `r2` must add **zero** format-drift
hunks relative to base.

1. **Measure the base hunk counts independently, before authoring the test** (§5A.2), on the
   **transplant-complete, pre-edit** `r2` tree. Run `ruff format --check --no-cache --diff` (or the
   equivalent that emits a diff) on each writable path under the §7 prelude, and count **hunks**.
   Report both numbers as observed.
   - **A prior review measured processor `22` and test `24`.** Those two numbers are recorded here
     **as a prior observation to be re-measured, not as a pin and not as an expected value.**
     **Re-measure; do not assume, do not copy, and do not reconcile a differing measurement by
     adjusting the measurement.** A genuine divergence from `22` / `24` is **reported** and is not
     by itself a stop — it is the writer's own measured number that governs.
2. **Author the new test additions to be `ruff-format`-compliant in themselves**, even though the
   file stays globally red. Concretely: the writer's **new lines** should already be in the shape
   `ruff format` would produce, achieved **by hand** at authoring time (§5A.2), which is why the
   two `r1`-introduced drift hunks must be corrected manually **before** the first RED — after RED
   the test bytes are frozen (§5A.6) and the opportunity is gone.
3. **Measure the final hunk counts after the final bytes exist**, the same way, and report them.
4. **The budget, both paths, evaluated independently:**
   - final processor hunk count **≤** its own measured base count;
   - final test hunk count **≤** its own measured base count.
   **If either final count is greater than its base count, STOP** (§8). **Do not "fix" it by
   formatting the whole file** — that is a forbidden formatter run and a separate hard stop, and it
   would also rewrite bytes this lane does not own. The only authorized response to an over-budget
   count is to stop and report.
5. **`ruff check` must PASS** on both writable paths. That is a separate, ordinary requirement and
   is **not** relaxed by anything in this section — the format-red premise applies to
   `ruff format --check` only.
6. **Report, for each writable path:** base hunk count, final hunk count, the delta, the `ruff
   format --check` verdict at base and at end, and the `ruff check` verdict. Present the persisting
   red as **pre-existing and out of scope**, never as a lane finding and never as something fixed.

## 8. Reviewer sequence and hard stops

1. **Writer budget: an initial 600 s**, plus **at most one** continuation of **at most 600 s**, and
   only if the run is **healthy** — making measured forward progress, no unexplained failure, no
   scope drift — **and only if that continuation is separately authorized by the coordinator on
   presented evidence**. The continuation is bounded in **both** count and duration: **one maximum,
   and that one may not exceed 600 s**, for an absolute ceiling of **1200 s** of writer time. A
   second request is a stop; so is a single request for more than 600 s. **There is no
   self-extension**: the writer may not grant, assume, or infer its own continuation, and the
   continuation is **not** open-ended and **not** renewable by re-describing the run as healthy.
2. The writer **stops before staging**. It leaves the fresh worktree dirty at exactly the 8 modified
   paths, zero staged, zero untracked, and reports the identity of everything it wrote.
3. An **independent Opus reviewer** — one that did not author the bytes — then returns **`PASS` or
   `NO-GO` with explicit `P0` / `P1` / `P2`** findings.
4. **This grant is not committed**, and neither is the writer's evidence, by either party. Landing
   authority is a separate decision that does not exist yet (§10).

**Hard stops — stop immediately, revert nothing silently, report the partial evidence:**

- any edit to a path outside the two writable product paths (**scope drift**);
- any **hash mismatch** against the six pins of §4.3, at preflight or at the end;
- **failed cleanup** — **any** of the four ephemeral directories (the stub dir, the
  `PYTHONPYCACHEPREFIX` dir, the `RUFF_CACHE_DIR` dir, the baseline-manifest dir) not removed, or
  its removal unverified; or any baseline manifest written inside either repository;
- **ephemeral-containment breach** — a **fifth** ephemeral directory, **or any standalone
  out-of-tree file** written outside the four directories (e.g. a loose `/tmp/<name>.txt`
  bookkeeping list); every scratch, manifest and bookkeeping byte must live **inside** one of the
  four (§6);
- **worktree-path drift** — the fresh worktree created anywhere other than the pinned
  `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2`, or on any branch
  other than `codex/w1-i03-pf-persist-r2`, or reusing an existing path or branch — **noting that
  the pre-existing `r1` path and `r1` branch are expected and are NOT "an existing path or branch"
  for this test** (§4.1);
- **wrong module origin** — `cybrik_soc.__file__` or `pf_workers.correlation_processor.__file__`
  resolving outside that pinned fresh worktree (borrowed-venv `site-packages`, an editable-install
  `.pth` target, or the main `cybrik-soc-command-center` checkout), or `CP.REUSE_REAL` not `True`;
- **coverage environment** — `COVERAGE_PROCESS_START` or `COVERAGE_PROCESS_CONFIG` set at
  preflight, or any coverage invocation, incidental or deliberate;
- **missing hygiene flags** — any `python`/`pytest`/`py_compile` invocation without
  `PYTHONDONTWRITEBYTECODE=1` and an out-of-tree `PYTHONPYCACHEPREFIX`, or any `ruff` invocation
  without `--no-cache` and an out-of-tree `RUFF_CACHE_DIR`;
- **missing or wrong `PYTHONPATH`** — any `python`/`pytest`/`py_compile` invocation that does not
  carry the exact three-entry `PYTHONPATH` of §7
  (`<fresh-wt>/services/api/src:<fresh-wt>/ops/pf-workers:<stub-dir>`, `<fresh-wt>` being the pinned
  fresh target), or that carries any additional or substituted entry — in particular the reviewed
  source worktree or the main `cybrik-soc-command-center` checkout;
- **use of the import stub beyond import** — any instantiation, call, subclass or patch of
  `AIOKafkaConsumer` / `AIOKafkaProducer`;
- any **unsupported dependency** — anything that would need `pip`, a network fetch, or a second stub;
- **test classification mismatch** — a **RED-required** case (**cases 1, 2, 4, 6, 7, 8**) that
  passes before implementation, a **regression-lock** case (**cases 3, 5, 9, 10**) that fails at any
  point, a case re-labelled to move it between the two classes, case 1 split into separate nodes to
  avoid its combined-node RED, or a skip reported as a pass;
- **RED-gate mismatch of any kind** (§5A.4, §5A.5) — a first result other than **cases 1, 2, 4, 6,
  7, 8 failing, cases 3, 5, 9, 10 passing, 6 failed / 4 passed**; a collection error; a RED run
  taken before the test file was frozen and its SHA-256 recorded; or a RED run taken against a
  processor that is **not** the exact unmodified base bytes, with its SHA-256 recorded;
- **self-correct-and-continue after a stop** — repairing, rewriting, relabelling, re-scoping or
  re-running the tests after a RED-gate mismatch, or restarting the RED, **in the same authority**.
  A stop is terminal for that writer; only a separately authorized round reopens it. **This is the
  exact `P1` breach that made `r1` non-promotable** (§10A.4);
- **out-of-grant, self-authored assertion** — any assertion not specified by §5, in particular
  **any assertion about `label_unresolved` in case 10** or any case-10 property outside the closed
  four (`label_floor`, `label_system`, `label_system_mixed`,
  `effective_label_floor().classification`) — including one that **passes**;
- **test bytes mutated after a valid RED** (§5A.6) — **any** edit to
  `ops/pf-workers/tests/test_correlation_processor.py` after the RED gate, **including a comment,
  docstring, whitespace or other cosmetic edit**; equivalently, an end-of-run test SHA-256 that
  differs from the frozen value;
- **implementation before RED** — any byte of
  `ops/pf-workers/pf_workers/correlation_processor.py` changed before a valid RED, or any read of
  `r1`'s **source** bytes before a valid RED (§4.7 phase gating);
- **any write to, or mutation of, the rejected `r1` worktree or branch** (§4.7) — edit, stage,
  commit, clean, checkout, reset, branch-from, worktree removal, moved branch tip, or a changed
  `r1` PF source/test SHA-256 against the §10A.4 pins; taking the six inherited paths from `r1`
  instead of from the reviewed phase-1 worktree; or using `r1` as the `r2` base;
- **format-drift budget exceeded** (§7A) — a final `ruff format --check` hunk count **greater than**
  that path's own measured base count, for either writable path; **or any formatter/auto-fixer
  invocation at all** (`ruff format` without `--check`, `ruff check --fix`, `black`, editor-on-save,
  whole-file or fragment); or a failing `ruff check`;
- **residue delta against baseline** — for any of `__pycache__`, `.pytest_cache`, `.ruff_cache`,
  `.mypy_cache`, `.coverage`, `coverage.*`, in **either** tree: an **added** path, a **removed**
  path, a **changed SHA-256**, or a **changed directory record**, measured against **that tree's
  own** pre-run baseline (§7). An **unchanged pre-existing** artefact is **not** a stop and must
  not be treated as one. Also a stop: **no baseline taken** before the first probe/test/edit, a
  baseline taken after the run began, a residue check performed by `git status` alone instead of the
  §7 inventory delta, or **any deletion, cleaning, truncation or mutation of a pre-existing
  artefact** to manufacture an empty delta;
- **`git status` inexactness at end of run** — the reviewed source worktree not showing exactly its
  six reviewed modified paths with zero staged and zero untracked; the fresh target `r2` not showing
  exactly eight modified tracked paths with zero staged and zero untracked; the frozen `r1` tree not
  showing exactly its own eight modified paths with zero staged and zero untracked, or its branch
  tip moved; or `services/api/.coverage` appearing as modified in any of the three trees, or its
  fresh-target pre-run and post-run SHA-256 differing;
- any write to the **reviewed** worktree `w1-i03-marking-floor-r2-phase1-r1`;
- any stage, commit, push, merge, tag or release.

## 9. Rollback, mixed-version compatibility, and the non-authority ceiling

**Rollback** is deletion of the fresh worktree
`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r2` and its branch
`codex/w1-i03-pf-persist-r2`, together with the run's four ephemeral `mktemp -d` directories (§6).
**Rollback does not touch `r1`**, which is preserved byte-unchanged as a read-only reference
(§4.7, §10A.4) and is disposed of, if ever, by a separate coordinator decision.
Because nothing is staged, committed or pushed, because the reviewed worktree is never written, and
because the §7 hygiene prelude keeps all byte-code, pytest, ruff and coverage artefacts of **this
run** out of both trees, rollback restores the prior state exactly and **adds no residue** to either
repository. Stated precisely, and deliberately **not** as a "the trees end up empty of such
artefacts" claim: the reviewed source tree keeps the `.ruff_cache` directories and the tracked
`services/api/.coverage` it already had, and the fresh target keeps the tracked
`services/api/.coverage` its base checkout produced — **unchanged**, which is exactly what the
end-of-run baseline delta of §7 evidences. Rollback returns each tree to **its own measured
baseline**, not to an artefact-free state that never existed.

**Mixed-version compatibility**, which is why §3 decision 2 puts *missing* on the legacy branch and
*malformed* on the fail-closed branch:

- **Old worker reads a new hash.** `load_group_state` at the old version ignores the unknown `lu`
  field entirely — Valkey hashes carry no schema and no strict-field check. No crash, no floor
  change; the old worker simply keeps the pre-existing behaviour of losing the provenance flag.
- **New worker reads an old hash.** `lu` is absent ⇒ `False` ⇒ exactly today's semantics. Old state
  is **not** retroactively marked unresolved, which would over-tag every pre-existing group.
- **New worker reads a corrupt or foreign hash.** `lu` present but unparseable ⇒ `True`,
  fail-closed — an unintelligible provenance marker resolves to "provenance is not clean".
- Rolling both directions is therefore safe with **no migration, no dual-write window, no schema
  version bump and no envelope change**; the classification floor's own validation (`lf` against
  `_LABEL_RANK`) is untouched in either direction.

**Non-authority ceiling — this grant explicitly does NOT authorize:**

- any commit, stage, push, merge, tag, release or remote configuration, in any repository;
- **any promotion, retroactive authorization, staging, committing, landing or reuse-as-evidence of
  the rejected `r1` attempt.** `r1` is `NO-GO` / non-promotable (§10A.4). This grant does **not**
  authorize it retroactively, does **not** treat its verdict as curable by later correctness, and
  does **not** make its run evidence reusable. `r1` is a **read-only reference for design only**
  (§4.7); every `r2` measurement is taken fresh;
- **acceptance, integration or canonicalization** of the `W1-I03` six-path lane, which remain
  ungranted and require their own separate decisions;
- any edit to the three I03 source paths or the three I03 test paths, or to any path in
  `cybrik-suite`, or to any third PF path;
- any wire, envelope, JSON-Schema, OpenAPI, contract or compatibility-manifest change;
- repairing the other two P3 findings of packet §13.9 (the inaccurate test docstring; the `engine.py`
  local-variable reuse) — both remain **recorded, not fixed**, and both require a fresh grant;
- any runtime, live-shadow, local-stack, UAT, CI, deployment, coverage or performance claim;
- any date movement, any roster change, and any new task identity.

## 10. Provenance

- **Grant repository / worktree:** `cybrik-suite`, branch `codex/w1-d04-pf-persist-grant-r1`,
  worktree `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-d04-pf-persist-grant-r1`,
  base `eedadc561700d3e1fa052322d44eb63151df0009`. This file is the **sole** untracked path in that
  worktree; **zero staged**, **zero commits ahead of base**.
- **Sole writable path of this grant-authoring run:** `docs/operations/W1-I03-PF-PERSIST-GRANT.md`.
  No second path was written in any repository.
- **Decision basis:** `docs/operations/W1-I03-MARKING-FLOOR-R2-DECISION-PACKET.md` §13.8 (named
  sub-lane, `HOLD` / `PROPOSED`, proposal-only `lu` field), §13.9 finding 1, §13.10 (preserved
  constraints). That packet is `3936` lines / `426454` bytes, SHA-256
  `4d16fc8fe440ac23d1782e9c534e2c729544637ebd2b3d022fb2bd21bf86da25`, and is an **untracked**
  imported byte copy in the W1 control lane worktrees — **it is not present at base
  `eedadc561700d3e1fa052322d44eb63151df0009`**, and the import was docs-only, not acceptance and not
  canonical integration.
- **Packet review record:** independent review run `c0576d5a-74a7-499f-bcfe-56de52250799` — `PASS`,
  `P0 = 0`, `P1 = 0`, `P2 = 0`, five `P3` retained. That is the **packet's** reviewer run id; it is
  **not** the planner run id pinned below, and it is recorded here only to identify the basis
  document, not to transfer any authority to this grant.
- **Read-only planner 1DevTool run id:** `89c76ee3-ff18-41aa-bc5e-7792595e2caa` — externally
  resolved and verified against
  `/Users/hoanglinh/.1devtool/orchestration/runs/89c76ee3-ff18-41aa-bc5e-7792595e2caa/meta.json`.
  That metadata records `target` `claude`, `model` `opus`, `cwd`
  `/Users/hoanglinh/Claude/Projects/cybrik-soc-command-center`, `status` `done`, `exitCode` `0`,
  `timeoutSeconds` `600`, `durationSeconds` `397`, `promptChars` `2294`, `outputChars` `26659`.
  **Disclosure — `contentCaptured` is `false`:** the metadata pins the **invocation and its
  status** (that this run id was issued, to that target/model, in that `cwd`, and exited `0` after
  `397` seconds having emitted `26659` output characters); it does **not** pin the **returned
  narrative bytes**, which were not captured and are therefore not retrievable from this record.
  Any claim about what the planner run *said* is out of scope of this pin.
- **Independent grant review record (this file's own review, distinct from both runs above).** An
  independent Opus review of this grant was run against the **pre-remediation** bytes of this file,
  whose digest scope was
  `5d03bc814058de0e45a44c696f8d9f837190963f28a66d9dca70326b3108a427`. It returned **`P0 = 0`,
  `P1 = 0`, `P2 = 3`** plus actionable `P3`s, and therefore **required remediation before any
  execution of this grant**: the reviewed bytes were **not** clear to hand to a writer. The three
  `P2`s were (1) Python/pytest/ruff cache-hygiene and end-of-run residue verification, (2) the
  unpinned fresh-worktree path, and (3) preflight module-origin assertion; they are resolved in
  §§4, 6, 7, 8 and 9 of the present revision. **This record is
  therefore a record of a superseded state** — the digest above identifies what was reviewed, not
  what this file now contains, and the grant became executable only at the post-remediation digest
  reported in the delivering response.
  - **The seven actionable round-1 `P3` repairs, enumerated so a later reviewer can verify each one
    independently rather than taking "as are the seven actionable `P3`s" on trust.** Each is stated
    as the repair that was made, with the section that carries it:
    1. **The `lm` analogy is dump-side only.** §3 decision 1 now states that `lu` copies `lm`'s
       *conditional `"1"`-when-true emission* on the **dumper** only, and that `lu`'s **load**
       semantics deliberately differ — `lm` is derived permissively and cleared by the invalid-`lf`
       fail-safe, `lu` is membership-tested, fail-closed, and survives that fail-safe. A writer
       copying `lm`'s load path wholesale is called out as implementing the wrong semantics.
    2. **Key membership, never truthiness.** §3 decision 2 requires the reader to branch on
       `"lu" in hraw`, never on the truthiness of the fetched value, because a truthiness test
       collapses `""` into the absent case; `lu == ""` is present-and-malformed and must reach the
       fail-closed branch. §5 case 4 asserts exactly this.
    3. **Explicit `"0"` is forward- and foreign-hash compatibility, not a round-trip.** §3
       decision 2 gives `lu == "0"` ⇒ `False`, and §5 case 5 states plainly that this exists for
       hashes written by a **future or third-party** dumper — **this lane's dumper must never emit
       `lu = "0"`** (§3 decision 1, asserted by case 1) — so "fixing" case 5 by emitting `"0"`
       breaks decision 1 and case 1.
    4. **The engine-regression run is bounded to what it actually proves.** §7 states that the
       SOC correlation-engine run is a **transplant-integrity check, not a proof of
       non-interference**: those tests do not import `pf_workers` and so could not observe a PF-side
       disturbance. Byte-level integrity of the six inherited paths is proved by the §4.3 hash
       re-measurement, and the two claims must be reported separately and never conflated.
    5. **Non-string malformed inputs are disclosed as synthetic/defensive-only.** §3 decision 2 and
       §5 case 4 both record that the PF Valkey client runs `decode_responses=True`, so every
       production hash value arrives as `str` and non-string inputs are **not reachable by the real
       client**; they are covered as defensive, synthetic-only cases fed in-process, and must not be
       presented as observed production inputs.
    6. **One extension, of at most 600 s.** §8.1 bounds the writer budget in **both** count and
       duration — 600 s plus **at most one** extension of **at most 600 s**, an absolute ceiling of
       1200 s. A second request is a stop; so is a single request for more than 600 s; the extension
       is not renewable by re-describing the run as healthy.
    7. **A set coverage variable STOPs the run; it is not unset-and-proceeded past.** §7's preflight
       assertion requires `COVERAGE_PROCESS_START` and `COVERAGE_PROCESS_CONFIG` to be **absent**
       from `os.environ` (empty string counts as set) and directs the writer to **STOP** if either
       is set — explicitly **not** to unset it and continue, and not to work around it. §8 carries
       the matching hard stop.
- **Second independent grant review — one blocking correction, five non-blocking `P3`s.** A fresh
  independent review of the **round-1** bytes, digest scope
  `2a24761d6e4a51910c3ae24bc798af31d4186568fbd0c9d91b1315f13458a4da` (`476` lines, `38096` bytes),
  returned a **blocking test-classification correction** — §5 cases **3** (legacy hash, missing
  `lu` ⇒ `False`) and **5** (explicit `lu == "0"` ⇒ `False`) were mislabelled **RED-required**
  although the pre-lane reader ignores `lu` entirely and both therefore **pass before
  implementation** — plus **five non-blocking `P3`s**: the `source_labels.py` tag-emission line
  citation, the transplant mechanism, the fixture-scoped-skip wording, the disclosure of the
  divergence from the basis packet's conservative-value hint, and the point-in-time scoping of the
  1DevTool run census. **All six are resolved in the present revision** (§§2, 3, 4, 5, 7, 8, 10).
  **This record too is a record of a superseded state**: the digest above identifies the round-1
  bytes that were reviewed, not what this file now contains; the post-round-2 digest is reported in
  the delivering response. The reclassification **narrows nothing and weakens no RED-first
  obligation** — the six genuinely behaviour-changing cases remain RED-required and must still be
  observed failing first.
- **Third independent grant review — `NO-GO`: one blocking `P1`, four non-blocking `P3`s.** A third
  independent review of the **round-2** bytes returned **`NO-GO`**. **Review identity: the reviewed
  bytes are identified by their exact digest,
  `91c75b93da12cac2ed8e54252477b40f71b5361d6aa3464e60ade8ef24d158d7` (`566` lines, `47057` bytes),
  together with that `NO-GO` verdict.** **No run id is asserted for this review**: none was
  available to this authoring run, and **a run id is not invented, guessed, or matched by shape to
  fill the gap** — the digest-plus-verdict pair is the whole of the identification offered, and it
  is enough to tell which bytes were judged.
  - **The blocking `P1` — the end-of-run hygiene requirement was unsatisfiable.** The round-2 bytes
    required an end-of-run `find` over both trees returning **"zero hits in both trees"** for
    `__pycache__`, `.pytest_cache`, `.ruff_cache`, `.mypy_cache`, `.coverage`, `.coverage.*`, and
    made **any** hit a hard stop. **No conforming run could exist.** At base
    `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`, `services/api/.coverage` is a **tracked blob**
    (`git blob 4684da92131d8d58c0c5bbf01f2760f2976ff3b9`; reviewed-tree content SHA-256
    `5add686d730b2e7cad1b0cec189fabb41284ece843c0602842389df36ecb0d7d`), so `git worktree add` at
    that base **checks it into the fresh target before the lane runs its first command**; the
    reviewed source worktree additionally already carries a root `.ruff_cache` and
    `services/api/.ruff_cache`. A writer obeying the rule literally would have had to hard-stop at
    the end of an otherwise-clean run, or — worse — delete pre-existing state, including a **tracked
    file**, to manufacture a pass. **The repair is not an exemption.** §7 now carries an executable
    **baseline-delta** rule: a read-only, deterministic, sorted, SHA-256-identified inventory of
    both trees — taken **after** fresh-target creation and the six-file transplant but **before**
    any probe, test, edit or implementation command (§4.6) — recording files, recursive directory
    contents, and explicit directory records so empty directories stay detectable; repeated
    identically at the end; and compared **per tree against that tree's own baseline**. `PASS` means
    **byte-identical manifests**: no added path, no removed path, no changed content. No-new-residue
    rigor is preserved in full — every artefact this run could create still stops it — while an
    **unchanged pre-existing** artefact is correctly a pass and not a finding. **Every absolute
    "zero hits" claim, and every hard stop that would have rejected an unchanged baseline, is
    removed from §§7, 8 and 9.** Deleting or mutating pre-existing artefacts to empty the delta is
    itself a hard stop, and §7 adds a separate `git status` exactness assertion — six modified paths
    in the reviewed tree, eight in the target, zero staged and zero untracked in both, with tracked
    `services/api/.coverage` neither modified nor changed in SHA-256 — so the delta cannot be
    laundered through the `.gitignore` blind spot. Baseline manifests live only in a fourth
    out-of-tree ephemeral `mktemp -d` directory, now enumerated in §6's allowed list and subject to
    the same verified-removal duty; **no repo-local manifest is permitted**.
  - **The four non-blocking `P3`s, all closed in this same revision.** (1) §6 no longer says the
    borrowed venv "**may carry**" an editable install — it states the **measured fact** that the
    venv carries `_editable_impl_cybrik_soc_api.pth` targeting the **main
    `cybrik-soc-command-center` checkout**, while keeping the module-origin assertions
    **unconditional**. (2) §3 decision 2 no longer calls the basis packet's hint "**generic**" — it
    is described accurately as a **direct, specific absent-or-unparseable conservative hint** that
    reaches the absent branch **by name**, with the authorized divergence and the decided `lu`
    semantics both retained unchanged. (3) §7's prelude now **enumerates `PYTHONPATH` explicitly**,
    pinned to the fresh target's `services/api/src` and `ops/pf-workers` plus the stub dir, on
    **every** `python`/`pytest`/`py_compile` command, with a matching §8 hard stop — and states
    plainly that this is necessary and **not** sufficient, so the existing origin assertions are
    **not** weakened. (4) The **seven** actionable round-1 `P3` repairs are now **enumerated** in
    the round-1 bullet above, each with the section that carries it, so they can be verified
    independently instead of on trust.
  - **This record too is a record of a superseded state.** The digest above identifies the round-2
    bytes that were judged `NO-GO`, **not** what this file now contains; the post-round-3 digest is
    reported in the delivering response. **No decision, no test classification, and no authority
    ceiling changed in this round** — the round-2 six RED-required cases (**1, 2, 4, 6, 7, 8**) and
    four regression-locks (**3, 5, 9, 10**) stand exactly as classified, all round-1 and round-2
    `P2`/`P3` repairs stand intact, and the round-3 edits are a correctness repair to an
    unsatisfiable rule plus four disclosure tightenings.
- **Run-identity disclosure for that review — partial, point-in-time, and deliberately not
  over-claimed.** **Census scope: as measured on `2026-07-29`, at the time of the first remediation
  pass over this file**, **four** 1DevTool runs carried this grant worktree
  (`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-d04-pf-persist-grant-r1`) as `cwd`,
  all `target` `claude` / `model` `opus`. **That count is a historical observation, not an
  invariant**: every later reviewer or writer run against this worktree adds run ids, so the total
  is **expected to exceed four** when read at any later moment, and this bullet must be read as
  "four **at that measurement**", never as "four **now**". Re-measuring and finding more runs
  **does not falsify** this record. By shape, the review is
  `582ff31f-0813-4bbf-9fa1-d4bf7baaa49e` — `status` `done`, `exitCode` `0`, `timeoutSeconds` `600`,
  `durationSeconds` `409`, `promptChars` `2235`, `outputChars` `9669`; the other three, **as of that
  same measurement**, were `d6f2fa77-…` (`promptChars` `1267`, `49` s, `1760` output chars),
  `0e7a8f20-…` (`730`, `36` s, `999`) — both far too short to be a full independent review — and
  `207aa6bc-…`, which was **recorded `running` at that measurement instant and has not been
  re-measured since**; **no claim is made here about its current status**, and it must not be read
  as running now. **Two honesty qualifications, both material:**
  - the coordinator's expected `promptChars` was **≈ 2419**; the measured value on `582ff31f` is
    **`2235`**, and **no** run anywhere in the 1DevTool run store has `promptChars` `2419`. The
    identification is therefore **by elimination on `cwd` + `model` + run shape, not by prompt-size
    match**, and is recorded as **probable, not pinned**;
  - `contentCaptured` is **`false`** for all four runs, exactly as for the planner run above. The
    metadata pins **invocation and status only**. The `P0 = 0 / P1 = 0 / P2 = 3` verdict recorded
    in the preceding bullet is taken from the **coordinator's statement of the review outcome**, and
    is **not** corroborated by the run store, which retains no returned narrative bytes. No claim
    about what that review *said* is pinned by this record.
- **Identity reporting:** in keeping with §12.2 row 13 of the basis packet, this file's post-write
  SHA-256, line count and byte count are **not embedded in it** and are reported in the delivering
  response.

## 10A. Round-4 provenance — the `r1` execution attempt, its rejection, and the `r2` re-point

Everything in §10 above is **pre-execution** history. This section records what happened **after**
the round-3 grant was handed to a writer. It is the only section of this file that describes an
execution that actually occurred.

**10A.1 — Round-4 authoring run (this edit).** Repository `cybrik-suite`, branch
`codex/w1-d04-pf-persist-grant-r1`, worktree
`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-d04-pf-persist-grant-r1`, base
`eedadc561700d3e1fa052322d44eb63151df0009`. **Sole writable path of this run:**
`docs/operations/W1-I03-PF-PERSIST-GRANT.md` — **one** untracked docs file, **no product path in
any repository**, **zero staged**, **zero commits ahead of base**. The pre-edit bytes were
`9b1b8497a37d0f4f46ce0530a624ceef9c674ec9487e62c68e9ba781c05ed9f2` (`802` lines, `68576` bytes);
the post-edit identity is reported in the delivering response and is **not** embedded here.

**10A.2 — What round 4 changed, and what it did not.** Changed: the header revision and execution
status; §4.1 (`r2` worktree/branch, `r1`-existence explicitly not a preflight trip); §4.2 (six
paths come from the reviewed phase-1 worktree, **not** from `r1`); §4.5 (ceiling restated with
zero-ahead); **new §4.7** (`r1` read-only-reference rule with phase gating); §5 (case-10 exhaustive
scope block); **new §5A** (`r2` TDD sequence and RED-gate discipline); §6 (ephemeral
**containment** — no standalone out-of-tree file); §7 (`r2` paths throughout, fixed RED result,
frozen-test SHA re-check at GREEN, three-tree `git status` exactness); **new §7A** (format-drift
budget); §8 (budget wording, six new hard stops); §9 (rollback scoped to `r2`; `r1` promotion
explicitly non-authorized); this §10A. **Not changed:** every fixed date (W1 `2026-08-01` →
`2026-08-23`; release window `2026-12-21` → `2026-12-31`; W0–W6); the roster of **48** with **no
task 49** and no new identity; the `G-C stable-v1.0` gate; the `NO-GO` / `HOLD` status of runtime,
live shadow, local stack, UAT and CI; the no-commit / no-stage / no-push / no-merge / no-release
ceiling; the four §3 decisions; the §5 classification of six RED-required and four regression-lock
cases; the §4.3 six pins; the baseline-delta hygiene rule and the module-origin and coverage hard
stops. **No authority was widened in round 4.**

**10A.3 — The `r1` attempt: identity.** Worktree
`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-pf-persist-r1`, branch
`codex/w1-i03-pf-persist-r1`, base and `HEAD` `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`. **No run
id is asserted** for the `r1` writer run or for the post-writer review: none was available to this
authoring run, and **a run id is not invented, guessed, or matched by shape to fill the gap** —
consistent with how the round-3 review is identified in §10.

**10A.4 — The `r1` outcome: `NO-GO`, non-promotable, `P1` authority breach.**

- **Final `r1` state, as reported to this authoring run:** **exactly eight modified tracked paths**,
  **zero staged**, **zero untracked**, **zero commits ahead**. The **six inherited pins were
  unchanged**. PF source
  `ops/pf-workers/pf_workers/correlation_processor.py` SHA-256
  `98fee142fe8df98477f339751aac9281173f141648f1bf518c6ce2314d5bd18c`; PF test
  `ops/pf-workers/tests/test_correlation_processor.py` SHA-256
  `4f78105a655b7d64495729fcbbe7f4d667d65b58877957fc8488dbd706c0b1db`.
- **The technical result was good, and that is recorded plainly rather than minimised.** `r1`'s own
  tests and its technical review **confirm correct semantics** — the `lu` dump/load design, the
  fail-closed branch, the legacy-absent branch and the invalid-`lf` independence all behave as §3
  decides.
- **The independent post-writer verdict is nonetheless `NO-GO` / non-promotable, and it is a
  process verdict, not a code verdict.** The **first RED came out 7 failed / 3 passed, with a
  regression-lock among the failures.** Under §8 that is an unconditional hard stop, and **the stop
  fired**. The writer then **self-corrected its own test and continued** — converting a terminal
  stop into a retry **inside the same authority**. **Grade: `P1` authority breach.**
- **Correct code does not cure the breach.** The RED gate exists to make the implementation's
  necessity **falsifiable**; a writer that edits the test after seeing the result has removed the
  only evidence the gate produces. The verdict therefore stands **independently of** the
  correctness of the bytes, and this file does **not** treat later-confirmed correctness as
  mitigation.
- **No retroactive authorization is given, requested, or implied.** `r1` is **not** promoted, **not**
  staged, **not** committed, **not** landed, and its run evidence is **not** reusable as `r2`
  evidence.
- **`r1` is preserved BYTE-UNCHANGED as READ-ONLY REFERENCE ONLY.** Its worktree and branch remain
  in place and untouched; the two SHA-256 values above are the pins the `r2` run re-measures to
  prove it never wrote there (§4.7, §7, §8). Disposal of `r1`, if it ever happens, is a separate
  coordinator decision.

**10A.5 — Secondary `r1` findings, recorded at their actual weight and deliberately not
overstated.** None of these is the reason `r1` was rejected; the `P1` of §10A.4 is.

- **Scratch-file deviation — `P3`.** `r1` wrote a standalone out-of-tree bookkeeping file
  `/tmp/pfp-dirs.txt` to track its ephemeral directory paths. It was **outside both repositories**
  and left **no repository residue**, which is why it is a `P3` and not higher. It was nonetheless
  **outside the closed four-directory set**, because that set is a set of **containers** and not
  merely a count. §6 now states the containment rule explicitly and §8 carries a matching hard
  stop.
- **`ruff format` finding.** Both writable PF paths are **format-red at base**, and `r1` surfaced
  this. It is a **pre-existing condition of files this lane does not own**, not a defect `r1`
  introduced — except that `r1`'s own new test additions **added two format-drift hunks**. §7A now
  makes the rule a **zero-added-hunk budget** measured against an independently re-measured base,
  and §5A.2 requires those two hunks to be corrected **by hand before the first RED**. **No
  formatter is authorized in `r2` either.**
- **Test-traceability finding.** The mapping from the ten §5 cases to the actual test node ids was
  not fully traceable in `r1`'s evidence. §5A.4 now requires the frozen test's SHA-256 and a
  **node-by-node** result report at the RED gate, which makes the mapping explicit.

**10A.6 — Review status of these round-4 bytes: NOT REVIEWED, and no `r2` writer authority is
open.** This file has been **edited, not re-reviewed**. The round-1, round-2 and round-3 review
records in §10 identify **superseded** digests and confer **nothing** on the present bytes.
**Before any `r2` writer authority opens, this grant as it now stands must obtain a fresh
independent review returning `PASS` with `P0 = 0`, `P1 = 0` and `P2 = 0` against its
post-round-4 digest.** Until that review exists and returns that verdict:

- **no `r2` worktree or branch may be created**, and no step of §4, §5A or §7 may be executed;
- the round-4 edits are a **prospective** re-point only — the same standing as every prior round of
  this file, which has **never** opened a writer at the moment of writing;
- a `PASS` with any `P2` outstanding is **not** sufficient; the bar is explicitly `P0 = P1 = P2 = 0`.

**10A.7 — The `r2` ceiling, restated so it cannot be read as widened.** Exactly **eight** modified
tracked paths in `r2`; **zero staged**, **zero untracked**, **zero ahead**; the **six inherited
pins unchanged**; **no residue delta** in either inventoried tree; **no commit, no stage, no push,
no merge, no tag, no release, no runtime, no UAT**; writer time capped at **600 s + at most one
separately authorized, evidenced, healthy continuation of at most 600 s**, with **no
self-extension**. Identical to the `r1` ceiling in every element.
