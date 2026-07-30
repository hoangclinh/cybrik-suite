# W1-I03 QD-13 marking-floor restart (R2) — Founder decision packet

- **Prepared:** 2026-07-29
- **Revision:** R2 remediation pass, 2026-07-29 — corrects the runtime-truth overgeneralization
  (§5), redesigns Q2, revises Q4 against the accepted marking contract, reclassifies the Phase-1
  evidence plan, closes the Phase-2 auto-open, and **rewrites the §11 decision text to match**
  (the earlier §11 ballot still carried the withdrawn `missing/corrupt` Q2 framing and offered
  `marking:` / `handling:` as live Q4 candidates after §Q4.2/§Q4.3 had rejected both). Same day,
  same base, same allowlist.
- **Revision:** R2 focused remediation, 2026-07-29, after an independent read-only review of the
  revision above. It (a) corrects every reference to the correlation symbol — the real name is
  **`_label_of_event`**, not `_label_reading_of_event`; (b) adds **Q6**, the internal carrier shape
  for the unresolved signal, which Q3 does **not** cover — Q3 governs the *wire* representation
  only, and leaving the in-process return shape unspecified would have let the writer improvise a
  positional tuple that the committed tests then have to be bent around; (c) extends §8.2's
  authorized committed-test edits **by content** to the collateral that Q6 mechanically forces
  (the `test_siem_correlation.py` import line, the valid-label tuple-equality assertions, and the
  block's closing brace); (d) records **O-1/O-2/O-3 as discharged SAFE from source** by that same
  review, which removes the underscore fallback from the ballot entirely; and (e) fixes the §8.2
  range that stopped one line short of its closing brace. Same day, same base, same allowlist.
- **Revision:** R2 collateral-and-vocabulary remediation, 2026-07-29, after a **final independent
  read-only review returned NO-GO** on the revision above. That review found three defects, all of
  which are corrected here and none of which changes an answer:
  **(1) missing committed collateral.** §8.2 asserted that
  `services/api/tests/unit/test_ingest_label_floor.py` carried *no* authorized edit and that its
  Phase-1 work was *additive only*. That was **false at `d3aaf6f`**: the file already commits
  assertions — docstring invariants at ≈12–13 and a parametrized case group at ≈134–148 — that
  encode the **superseded** pre-decision policy and would fail the instant Phase 2 implements
  Q1 = A / Q2 = A. The new §8.2 row **P5** authorizes those two ranges by content; every
  additive-only claim about entry 5 is withdrawn.
  **(2) unstated occupied vocabulary.** Q4 chose `label:unresolved-floor` without enumerating what
  the `label:`/`system:`/`handling:` space already contains at `source_labels.py:207–217`, and
  without deciding how the new token relates to the existing `label:floor-invalid`. §Q4.4.1 now
  enumerates the occupied vocabulary and §Q4.4.2 records **COEXISTENCE** — not supersession, not
  mutual exclusion — as the decided semantic relationship. O-2 stays SAFE and now says *why*
  collision-freedom and semantic overlap are different questions (§Q4.6).
  **(3) two counting/scope defects.** The "five rows / five ranges" accounting was internally
  inconsistent even before P5 (P2b names two ranges), and §8.3 test 6b asserted **disjointness of
  the whole emitted tag set** against `forbidden_label_tags`, which is wrong: `label:toi_mat` is
  legitimately forbidden at lower clearances, so the old 6b would fail for a correct
  implementation. 6b is narrowed to the unresolved token only, and that pass made the accounting
  uniformly **six rows / eight ranges** — a figure **since superseded**: the fourth remediation
  below withdraws row P1 from the edit accounting and recomputes it to **five rows / seven
  ranges**, which is the operative count.
  Same day, same base, same allowlist. **Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`,
  Q5 = B, Q6 = A are preserved unchanged**; no phase is opened; the packet stays `PROPOSED`.
- **Revision:** R2 classification-and-carrier remediation, 2026-07-29, after a **third independent
  read-only review returned NO-GO** on the revision above. That review found four defect classes,
  all corrected here, **none of which changes an answer**:
  **(1) test-class errors — a test marked RED that must pass on arrival.** §8.3 test **6b** was
  classified `RED-required`. It cannot be: `datalake/search.py::forbidden_label_tags` is already a
  **closed** QD-13 enumeration at `d3aaf6f` (O-3, §Q4.6), and the exact token
  `label:unresolved-floor` is absent from every clearance's set *at the base*, so 6b **passes on
  arrival** — which §8.1 makes a **mandatory stop** for a RED-required test. 6b is reclassified
  **regression-lock**: passing *is* the point, and the fail-if-regression semantics are unchanged.
  The same class error ran through the `handling:restricted` expectations in §8.2 row **P5** and
  §8.3 test **6**, in the opposite direction: at `d3aaf6f` a malformed or present-unmappable floor
  **keeps the connector-supplied label** and emits **no** `handling:restricted`, so that
  expectation is **RED-required, tracing to Q1/Q2** — the fail-closed `toi_mat` outcome is what
  creates it. Only the retained `label:floor-invalid` is regression-lock. §8.1 now also states the
  general rule the packet had been applying inconsistently: an assertion about the **absence** of
  the new token is **regression-lock**, never RED-required.
  **(2) an undecided ingest-carrier question — now decided against changing anything.** Proposed
  tests **1, 2, 3b and 3c** were written as if `resolve_payload_floor` / `PayloadFloor` would grow
  an `unresolved` field. **§6.1 records the coordinator decision that it does not:** `PayloadFloor`
  stays the existing **three-field** parser carrier (`classification`, `system`, `invalid`); the
  committed equality at `test_ingest_label_floor.py` **≈355** stays **unchanged and passing** as a
  **pin**, not an authorized edit; **no §8.2 row `P6` is created**; and those tests are retargeted
  onto the **policy-layer** observable (`effective_labels` / `apply_label`). §6.1 also states the
  **derivation boundary** that makes a fourth parser field unnecessary, and fixes that a defective
  *auxiliary* field on an otherwise valid, mappable classification is a `label:floor-invalid`
  diagnostic but **not** classification-unresolved.
  **(3) an over-claimed collateral row, and an accounting that followed from it.** Row **P1**
  authorized a "compatibility edit" to the `test_siem_correlation.py` import at ≈17 — but that
  import **already** binds `_label_of_event` correctly, so there is nothing to edit. P1 becomes a
  **verification-only, no-edit preflight** (§8.2.1), is removed from the authorized-edit
  accounting, and the accounting is recomputed to **five rows (P2, P2b, P3, P4, P5) across seven
  approximate ranges in three files**. The Phase-1 prohibition on importing the nonexistent
  `_EventLabelReading` is preserved verbatim as part of the preflight.
  **(4) two under-specified expectations.** The `label:floor-invalid` gloss implied it fires only
  on a classification parse failure; it is widened throughout to **raw parse/shape failure *or* a
  defective auxiliary field**. And §8.3 test **6c** carried a parenthetical that would have let a
  token-agnostic prefix-tuple check satisfy it; the parenthetical is **struck**, and 6c now
  requires genuine **emitted-then-collected** end-to-end behaviour for the exact token.
  Same day, same base, same allowlist. **Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`,
  Q5 = B, Q6 = A are preserved unchanged**; no phase is opened; the packet stays `PROPOSED`.
- **Revision:** R2 prose-collateral-and-path-distinction remediation, 2026-07-29, after a **fourth
  independent read-only review returned NO-GO** on the revision above. That review found four
  defects, all corrected here, **none of which changes an answer**:
  **(1) committed invariant prose left out of an authorized range.** §8.2 row **P2** anchored
  `test_siem_correlation.py` at ≈412–422 and so stopped short of `TestLabelFloorHelper`'s
  committed **docstring at ≈408–410**, which states in prose that junk or absent labels resolve to
  the `DEFAULT` `khong_mat`. That docstring is **superseded invariant prose, not decoration** —
  Q1 = A / Q2 = A contradict it directly — and with the old anchor a writer re-expressing the
  assertions beneath it would have had to leave the prose asserting the withdrawn rule, or hit a
  §8.2 condition-4 stop on a line the packet never authorized. **P2's single contiguous range is
  widened to ≈408–422**, the docstring is named explicitly as requiring rewrite *with the same
  precision* and with **verbatim pre/post evidence**, §8.3 group B's anchor is updated to match,
  and §8.6 items **8** and **10b** are widened from "assertion" to "assertion **or committed
  invariant prose/docstring**" so a future collateral prose drift has an explicit stop. **The
  accounting is unchanged at five rows / seven ranges / three files** — P2 remains **one** range;
  only its start line moves.
  **(2) an ingest branch that cannot exist, presented as if it could.** §6.1's ingest derivation
  bullets carried a state "`classification` is not `None` but does not map onto the QD-13 scale".
  On the **ingest** path that state is **unreachable**: after `resolve_payload_floor`, a
  Q1 (iii) out-of-scale/unmappable asserted classification and a Q2 (ii) malformed classification
  are **intentionally parser-indistinguishable** — both come back `invalid=True`,
  `classification=None`, and route through the **same** policy branch. §6.1 is corrected to say
  so, and the "present but unmappable" branch is labelled **CORRELATION-path-only**, because
  `_label_of_event` reads `event['labels']` **directly, before** any policy resolution. §6.1 also
  now records that `source_labels.label_rank` **raises `ValueError`** on out-of-scale input, so
  `resolve_payload_floor`'s `label not in LABELS` guard is a **correctness / crash-prevention**
  constraint and **must not be weakened** merely to make a conceptual branch reachable.
  **(3) a path-blind coexistence claim.** Every statement that a present-unmappable value may emit
  `label:unresolved-floor` **without** `label:floor-invalid` is now qualified
  **CORRELATION-path-only**. On **ingest**, the parser marks such a payload `invalid=True`, so
  `label:floor-invalid` **coexists** there. The qualification is applied in §Q4.4.2, §8.3 test 6,
  the §11 legend, and the verification log.
  **(4) a Phase-1 scope statement that leaked entry 8 in.** §7 Phase 1 read "allowlist entries 5–7,
  plus 8 only if Q5 = A". **Phase 1 is entries 5–7 only, under every answer.** Under Q5 = A entry 8
  stays in the lane but its tests are the **Phase 3 / §8.3 group D** integration group; under
  Q5 = B it is outside R2 entirely. **No Phase-1 integration test exists under any answer**, which
  is what §8.1 and §8.5 already said.
  Outcomes are unchanged throughout: **no parser arity change, no §8.2 row P6**, and no §8.3
  expectation is weakened. Same day, same base, same allowlist. **Q1 = A, Q2 = A, Q3 = A,
  Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A are preserved unchanged**; no phase is opened; the
  packet stays `PROPOSED`.
- **Revision:** R2 driver-taxonomy-and-carrier-chain remediation, 2026-07-29, after a **fifth
  independent read-only review returned NO-GO** on the revision above. That review found three
  defect classes, all corrected here, **none of which changes an answer**:
  **(1) two authorized rows attributed to the wrong driver.** §8.2 presented rows **P3** and **P4**
  as *compatibility updates mechanically forced by Q6* — shape edits over unchanged policy. Both
  are **policy re-expressions**. **P3** (`test_siem_correlation.py` ≈484–491) exercises a window
  that mixes an **absent** contributor with a **non-string invalid** contributor; under **Q2 = A**
  the accepted invalid contributor **fails closed**, so the derived classification becomes
  **`toi_mat`** and the unresolved tag/state is **present**. That is an outcome change —
  **RED-required, tracing to Q2** (and to **Q4** for the exact token), not a mechanical re-shape.
  The closing-delimiter authorization at ≈491 is **preserved**. **P4** (`test_siem_engine.py`
  ≈227–236) is a **MIXED policy row**: the absent-label test at ≈227–230 **remains** `khong_mat`
  with no unresolved signal (**regression-lock**), while the `top_secret` present-unmappable test
  at ≈232–236 becomes **`toi_mat` plus the unresolved tag** (**RED-required, Q1** and **Q4**).
  **P4 is not tuple-shaped, and Q6 forces no mechanical shape edit on it.** Every operative claim
  that P3/P4 policy is unchanged, that they are Q6-forced compatibility edits, or that P4 carries a
  tuple-shaped expectation is **withdrawn** — from §8.2, §8.3, §8.6 and the §11 block. **P2 remains
  the mixed row; `P2b` alone is the pure Q6 shape-compatibility row.**
  **(2) the correlation window-state carrier was left undecided inside Q6 = A.** Q6 = A decided
  only what `_label_of_event` **returns**. It said nothing about how the fact enters the
  correlation **window state**, how it reaches the **internal** floor value, or how it becomes the
  tag — which is exactly what §8.3 tests **8** and **9** assert against, so leaving it open handed
  the shape to the writer by default, the precise failure Q6 exists to prevent. §6/Q6 now decides
  the **full internal carrier chain** in five steps: `_EventLabelReading` →
  `_GroupState.label_unresolved` (**monotonic OR**, never self-clearing) → internal
  `LabelFloor.unresolved` (**defaulted `False`**) → `to_canonical()` / `DerivedAlert.canonical()`
  → the direct-engine construction. **Q3 stays wire-separate:** `to_canonical()` still emits
  exactly the two current keys, and the signal leaves only as the tag.
  **(3) a mis-named anchor and one unpinned committed equality.** §8.2 row **P2** described
  ≈408–410 as "the docstring". It is not: **≈408 is the `TestLabelFloorHelper` class declaration**
  and the committed **docstring itself is ≈409–410**. The authorized contiguous range stays
  **≈408–422**; only the naming of its content is made precise. And the committed
  `LabelFloor("khong_mat", None)` equality at `test_siem_correlation.py` **≈509–512** was never
  pinned: it must stay **unchanged and passing**, which it does **only** because the new internal
  field defaults to `False`. It is recorded as the verification-only no-edit pin **N2** (§8.2.1),
  contributes **no** range to the accounting, and §8.6 gains the stop that fires if it would need
  an edit or if the `False` default is lost.
  Same day, same base, same allowlist. **The §8.2 accounting is unchanged at five rows / seven
  ranges / three files**, and P1/N1/N2 are no-edit preflight pins outside it. **Q1 = A, Q2 = A,
  Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A are preserved unchanged**; no phase is
  opened; the packet stays `PROPOSED`.
- **Revision:** R2 runtime-topology remediation, 2026-07-29, after a **sixth independent read-only
  review returned NO-GO** on the revision above. **⚠ HISTORICAL — WRONG IN PART — SUPERSEDED BY THE
  EIGHTH REMEDIATION (the `measured-topology` entry immediately below). This entry is retained as
  provenance of a failed correction and is NOT current guidance. Specifically superseded as false at
  `d3aaf6f`: the three-surface A/B/C topology; the `NOT RUNTIME-WIRED` classification of the
  correlation/engine path; `no in-process production caller, no worker wiring`; `no producer
  populates event labels`; and the unqualified `nothing in source sets that flag` — which is true
  only of *automatic* assignment and was wrongly read as meaning there is no authorized setter.
  Item (3) of this entry (pin N3) survives.** That review found three defect classes, all
  corrected in this entry, **none of which changes an answer**:
  **(1) a runtime overgeneralization replacing an earlier one.** §5's first correction had grouped
  connector-config label application, the feature-gated payload `label_floor` path, and the
  correlation/engine label reader into one **LIVE** mechanism called **"M1"** that "takes effect on
  the next deploy". At `d3aaf6f` those are **three distinct surfaces with three distinct statuses**
  (class **R**, sixth review): **A** connector-config label application is **live and ungated**;
  **B** the payload `label_floor` path has **live call sites** whose *effect* is gated on the
  **exact boolean `True`** for `label_floor_enforce` — **nothing in source sets that flag**, absent
  or default is off, and no in-process caller turns it on; **C** the correlation/engine reader is
  **SOURCE IMPLEMENTED · DIRECT-TESTABLE · NOT RUNTIME-WIRED** — no in-process production caller, no
  worker wiring, correlation excluded from the mounted `siem` API. **The "M1" label is withdrawn**,
  and with it every operative claim that the correlation/engine path is live, runtime-wired, or
  takes effect on deploy. §5.1's caller inventory is restated **by actual call arguments**, which
  also corrects `ingest/source_health_worker.py`: it calls **`apply_label(fields, config)` with no
  `payload_floor` argument at all** — it is **surface A only** and **never reads the payload
  `label_floor` block**, flag on or off. The earlier row describing it as a background path that
  "resolves outside any request context" is withdrawn. §8.7 gains the explicit permission that a
  reviewer **may** state surface C is not runtime-wired; no instruction here forbids saying so.
  **(2) Q2's ground rested on the withdrawn liveness claim.** Q2's decision text and Candidate B's
  NO-GO were argued from "the correlation/engine path is live, so absence-fail-closed would fire
  immediately and for every tenant on the first deploy". That reasoning is **withdrawn**: surface C
  fires on no deploy at all. Both are **re-grounded on the live feature-gated ingest path (surface
  B) only** — under **B**, the moment a tenant's connector carries the exact boolean `True`, every
  inbound record on that tenant lacking a `label_floor` block (the ordinary shape of a legacy or
  non-correlated payload) is raised to `toi_mat`, which is **systematic overclassification created
  by enabling the feature**; under **A**, a flag-enabled floor-absent event stays rank-0 `khong_mat`
  with no unresolved signal, exactly as the base produces. **The answer is unchanged — Q2 = A, B
  still NO-GO and still on the ballot.** No auto-set claim and no all-ingest claim survives: nothing
  in source sets the flag, and with the flag off neither answer changes anything.
  **(3) one unpinned committed assertion, and one mis-described test.** The **exact-key-set
  assertion on the canonical `label_floor` block** at `test_siem_correlation.py` **≈533–535** (class
  **R**, sixth review) was never pinned; it is the committed executable form of **Q3 = A** and
  **§6/Q6 step 4** and stays unchanged and passing because the Q6 field never reaches the wire. It
  is recorded as the no-edit pin **N3** (§8.2.1), with the stop at §8.6 item **10d(d)**. And §8.3
  test **3d** was described as "**Test 3d is new**", which mis-states it: the base **already**
  exercises the valid-mappable-classification-with-defective-auxiliary-field case and **already**
  pins `label:floor-invalid` with **no** fail-closed escalation, so 3d **re-locks** those committed
  facts and adds exactly **one** genuinely new assertion — the **negative** one that
  `label:unresolved-floor` is absent. **The whole test stays regression-lock.**
  Same day, same base, same allowlist. **The §8.2 accounting is unchanged at five rows / seven
  ranges / three files**, and **P1/N1/N2/N3 are four no-edit preflight pins outside it**. **Q1 = A,
  Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A are preserved unchanged**; no phase
  is opened; the packet stays `PROPOSED`.
- **Revision:** R2 measured-topology remediation, 2026-07-29, after a **seventh independent
  read-only review returned NO-GO** (**P0 = 3, P1 = 1, P2 = 1, P3 = 2**) on the revision above. This
  is the **first remediation pass that held read access to the SOC source worktree** and measured it
  directly; every fact it states below is therefore class **S**, with exact files and symbols, and is
  **not** carried from a review. It found that the three-surface **A/B/C** topology the seventh pass
  installed was itself **false**, and corrects it. **No answer changes**:
  **(1) the A/B/C partition is replaced by a truthful FOUR-surface model (§5.0).** The prior model
  had exactly one defect that mattered and several that followed from it: it asserted that the
  correlation/engine path is **NOT RUNTIME-WIRED** and that **no producer populates event `labels`**.
  Both are **false at `d3aaf6f`**. `ops/pf-workers/pf_workers/normalizer.py::resolve_label_floor`
  **always** returns a `labels` block with a `classification` defaulting to **`khong_mat`**, and
  `normalize_envelope` writes it onto **every** normalized document; `siem_matcher.py::project_event`
  and `build_detection` **forward** `event['labels']` into the detection; and
  `correlation_processor.py` **constructs `CorrelationEngine` and calls `_ingest_one`**, is packaged
  as the console script **`pf-correlation`** in `ops/pf-workers/pyproject.toml`, and is **declared as
  a service** in `deploy/pf/docker-compose.pf-workers.yml` and `docker-compose.pf-demo.yml`. The
  correct classification is **deployable / deployment-wired worker path** — **not** *NOT-RUNTIME-WIRED*
  and **not** *observed-live*. The new partition is **A** (connector-config label application,
  code-reachable/live-call-path, ungated), **B** (payload `label_floor` application, code-reachable
  from `service.py` / `pf_bridge.py`, gated on the exact boolean `True`), **C** (PF event-label
  production and forwarding, **deployment-wired**), **D** (correlation/engine, **source-implemented
  and deployment-wired** through the PF worker, still **excluded from the mounted SIEM HTTP API**).
  **(2) Q2's re-grounding rested on a false universal-absence claim, and on a reopen condition that
  has already fired.** The prior Q2 said absence is "the universal state" on the correlation path and
  attached a **deferral/reopen condition** keyed to "an accepted producer actually populates event
  `labels`". On the deployed PF path a producer **already does**, unconditionally. That deferral and
  reopen condition are **removed**, not merely re-worded, and the claim that no producer populates
  `labels` is **withdrawn**. Candidate B's NO-GO is re-argued on **semantic conflation plus unknown
  compatibility blast radius** — **not** on a false claim of bulk floor-absent traffic. The actual
  Alert Writer guarantee is stated: `ops/pf-workers/pf_workers/alert_writer.py::validate_envelope`
  **requires** `label_floor` and **rejects** a missing block or an out-of-scale `classification`, so
  **absence is unreachable for that producer** and the "bulk / ordinary shape" claim for the internal
  connector is withdrawn. **Q2 = A is unchanged**, re-grounded normatively and at the actual boundary:
  **absent means no asserted source floor**, not evidence of a malformed or unmappable assertion.
  **(3) the flag-provenance and M2 claims were wrong in both directions.**
  `services/api/src/cybrik_soc/modules/connector/api.py::validate_lc_config` **allowlists**
  `label_floor_enforce` (line 95) and **boolean-validates** it (lines 110–112), and both
  `ConnectorIn._config` (≈178–181) and `ConnectorUpdate._config` (≈198–201) invoke it — so **ordinary
  authorized connector create/update through the control plane can set the flag**, and every
  "CLI-only" / "human-bootstrap-only" activation claim is **withdrawn**. In the other direction, at
  `d3aaf6f` **`connector/bootstrap.py` contains no `label_floor_enforce` and no `FLOOR_ENFORCE_FLAG`
  at all**; its `ensure_internal_alert_writer_connector` (line **67**) writes
  `config={"description": _INTERNAL_CONFIG_DESCRIPTION}` (line **98**). The §5.0 claim that current
  M2 **writes `True`** is **removed**. The current base has **no automatic and no bootstrap
  convergence implementation**. **Q5 = B is unchanged**: any convergence or automatic activation is a
  separate lane, and manual/API configuration remains possible and **is not convergence**.
  **(4) stale document evidence and a stray revision.** The `siem/api.py` docstring
  ("`khong worker wire`", ≈26) is **no longer usable as current truth** — it predates the T17+ worker
  tier and is contradicted by the packaged and declared `pf-correlation` service; it is retained only
  as a dated module-scope note. The §5.2 `87e95cd` references are **reconciled to `d3aaf6f`**, which
  is the sole base for every SOC source decision in this packet; the old `bootstrap.py:104` anchor is
  corrected to **line 67**.
  Same day, same base, same allowlist. **Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`,
  Q5 = B, Q6 = A are preserved unchanged**; the **§8.2 accounting is unchanged at five rows / seven
  ranges / three files** with **P1/N1/N2/N3** as four no-edit pins outside it; no phase is opened;
  the packet stays `PROPOSED` and **Phase 1 stays HELD pending a fresh independent PASS and a
  separate coordinator grant**.
- **Revision:** R2 document-closure remediation (**ninth**), 2026-07-29, after an **eighth
  independent read-only review of the exact bytes produced by the eighth remediation returned
  NO-GO** with **P0 = 1, P1 = 1, P2 = 1, P3 = 1**. That review **confirmed as substantively correct**
  the four-surface architecture, every Q1–Q6 answer, the F1–F7 source facts, the test anchors, the
  five-row / seven-range / three-file accounting, the four no-edit pins, and the Phase-1 scope and
  provenance — and **this pass changes none of them.** It is a **documentary closure pass only**,
  held **no `cybrik-soc-command-center` read access**, **read no SOC byte**, and **upgraded nothing
  to class S**. The four findings, all corrected here:
  **(P0) §10 re-asserted the withdrawn three-surface disclaimer.** The §10 bullet still said, in the
  present tense and as an operative claim *of this packet*, that it "does not claim … that the
  correlation/engine label path is live, runtime-wired, or takes effect on deploy" — which
  contradicts the measured four-surface model the eighth pass installed. That bullet is **withdrawn
  as wrong** and replaced by an explicit **negative-claim boundary**: no instance is claimed to be
  currently running or production-observed; no test is offered as runtime evidence; surfaces
  **C**/**D** **are** source-implemented and **deployment-wired**, so a Phase-2 change to
  `correlation.py` / `engine.py` **can affect the packaged `pf-correlation` worker on a deployment
  that runs it**; correlation stays **excluded from the mounted SIEM HTTP API**; and **no operative
  NOT-RUNTIME-WIRED / no-worker / no-deploy-effect claim survives** anywhere. The two disclaimers
  that were always true — no *automatic* setter for `label_floor_enforce`, and
  `source_health_worker.py` not reading the payload block — are preserved verbatim.
  **(P1) §12.2 was cited but did not exist.** §12 and §12.1 both pointed at "§12.2" as the operative
  closure checklist and no such section was in the file, leaving a dangling pointer and no current
  closure record. **§12.2 is created** with **14 checkable rows** covering F1–F7, the §8.7/§11
  disclosures, the unchanged answers and accounting, status and phase holds, source-control state,
  external identity reporting, and the standing no-self-review / fresh-independent-PASS requirement.
  The §12 pointer that read "rows 11 and 12" is corrected to the rows that actually carry those
  claims.
  **(P2) the provenance posture read as if no pass had SOC access.** The class-**R** table cell and
  the §10 re-measurement bullet both generalized "no remediation pass had SOC read access" in the
  present tense. Both are **scoped to passes one through seven**, with the **eighth** named
  explicitly as the direct-measurement exception whose class-**S** findings **govern** over
  contradicted carried claims, and the **ninth** recorded as holding no SOC access either.
  **(P3) the §11 Q6 legend paired the wrong rows.** It named "rows P2b and P4 in particular" as the
  edits Q6 fixes, contradicting the sixth remediation's own row-driver taxonomy. Corrected to
  **P2b = the pure Q6 shape row** and **P2 = mixed, carrying the Q6 completeness rule**, with **P4
  stated as mixed Q1/Q4 policy on which Q6 forces no mechanical shape edit**. All other Q6
  consequences are unchanged.
  Same day, same base, same allowlist. **Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`,
  Q5 = B, Q6 = A are preserved unchanged** for an **eighth** consecutive pass; the **§8.2 accounting
  is unchanged at five rows / seven ranges / three files** with **P1/N1/N2/N3** as four no-edit pins
  outside it; no phase is opened; the packet stays `PROPOSED` and **Phase 1 stays HELD pending a
  fresh independent PASS and a separate coordinator grant**. **This pass did not review its own
  output and offers no PASS.**
- **Record (not a remediation pass):** executed-evidence and coordinator-decision addendum, recorded
  **2026-07-29** as **§13**. The Q1–Q6 answers stop being *recommendations* and become **issued
  coordinator decisions**; **Phase 1 is executed and complete**; the **§7.1 Phase-2 grant was issued**;
  and **Phase 2 is executed and COMPLETE/ADMITTED for one bounded local six-path lane and nothing
  else**. **Every earlier statement — in this header, in §7, §10, §11, §12, §12.1 and §12.2 — that the
  packet "stays `PROPOSED`", that "no phase is opened", or that "Phase 1 stays HELD" is HISTORICAL as
  of this record**: true of the pass that wrote it, not current truth. **No prior provenance, class
  label, count, anchor, withdrawal or revision entry is rewritten or deleted.** This record measured
  no SOC source of its own and **promotes no claim beyond bounded local GREEN** — nothing is accepted,
  integrated, canonical, pushed, merged or released, and **no runtime or deployment observation is
  made anywhere**. See **§13**.
- **Status:** `DECIDED (Q1–Q6) — PHASE 1 EXECUTED — PHASE 2 COMPLETE/ADMITTED FOR THE BOUNDED LOCAL
  SIX-PATH LANE ONLY — NOT ACCEPTED, NOT INTEGRATED, NOT CANONICAL, NOT PUSHED, NOT MERGED, NOT
  RELEASED`
  - **⚠ Superseded status line, retained verbatim as history:**
    `PROPOSED — CONTROL DOCS ONLY — NOT ACCEPTED, NOT IMPLEMENTED, NOT PUSHED`. It was accurate
    through the ninth (document-closure) remediation and until the decisions and lane evidence
    recorded in **§13** were issued and executed. **`COMPLETE` is bounded by §13.6 and means nothing
    beyond it.**
- **Packet author:** logical task **W1-D04** (control/decision-packet author), docs-only session
- **Subject task:** fixed roster task **W0-I03**, sub-lane **W1-I03** (QD-13 marking floor).
  The roster of 48 is unchanged; **no task 49** and no replacement identity is created here.
- **Repository written:** `cybrik-suite` only, branch `codex/w1-d04-i03-marking-r2-gate-r1`,
  isolated worktree off the clean base `eedadc561700d3e1fa052322d44eb63151df0009`
- **Bytes written:** exactly one new file — this file. No existing file in any repository was
  edited. Nothing was staged, committed, pushed, merged, or released.

**What this packet is.** A read-only ground-truth record of the stalled W1-I03 R1 attempt, plus
the minimum exact Founder decision text needed to open a **future** bounded SOC writer. It
accepts nothing, flips no status, closes no residual, authorizes no runtime work, and is **not
product evidence**. No test was run, no stack was started, no dependency was installed, nothing
was staged or committed.

**Provenance of the claims below — read this before citing any of them.** Claims in this packet
come from three distinct sources and are *not* interchangeable:

| Class | Meaning | Where it appears |
|---|---|---|
| **S — session-verified** | Measured read-only from live git state on 2026-07-29 by a session that held read access to the repository in question. | §1, §2, §3, §4, and the original §5 caller inventory; the `cybrik-suite` contract facts in §6/Q4 (§Q4.1, re-measured by the remediation pass in this worktree). **And — new in the eighth (measured-topology) remediation, which is the first pass to hold read access to the SOC source worktree `w1-soc-secret-scan-remediation-r1` at `d3aaf6f` and which read it directly — the whole of the corrected FOUR-surface topology in §5.0/§5.1/§5.1.2/§5.2, the Alert Writer envelope guarantee in §6/Q2, and the flag-provenance facts in §6/Q5.** Those are recorded with exact files and symbols in §12 and are class **S**, not carried **R**: `ingest/service.py:432–434`; `ingest/pf_bridge.py:191–192`; `ingest/source_health_worker.py:121`; `ingest/source_labels.py:39–40, 123–128, 158–164, 191–218`; `connector/api.py:77–139` (allowlist entry at **95**, boolean check at **110–112**) with `ConnectorIn._config` ≈178–181 and `ConnectorUpdate._config` ≈198–201; `connector/bootstrap.py:67, 98` (and the measured **absence** of `label_floor_enforce`/`FLOOR_ENFORCE_FLAG` anywhere in that file); `ops/pf-workers/pf_workers/normalizer.py:188–232, 306–307, 326`; `ops/pf-workers/pf_workers/siem_matcher.py:660–662, 680`; `ops/pf-workers/pf_workers/alert_writer.py:73, 229, 264–274`; `ops/pf-workers/pf_workers/correlation_processor.py:334, 483`; `ops/pf-workers/pyproject.toml:40`; `deploy/pf/docker-compose.pf-workers.yml` service `pf-correlation` ≈99–119 and `deploy/pf/docker-compose.pf-demo.yml` ≈109–114; `siem/correlation.py:61–79, 324, 345, 496, 529`; `siem/api.py:26`. |
| **R — review-carried** | Established from source by an independent read-only review of `cybrik-soc-command-center` and carried here verbatim; **not** re-measured by any of the **first seven** remediation passes, none of which held SOC read access — **nor by the ninth, which held none either.** **The eighth (measured-topology) pass is the exception: it held SOC read access and measured directly, and wherever its class-S measurement contradicts a carried class-R claim below, the measurement governs and the carried claim is withdrawn** (items (l), (n), (o)). | The corrected live-call-path inventory in §5; the real correlation symbol name `_label_of_event` and its current return shape (§5.1.1, §6/Q6); the `datalake/es_adapter.py` collected-prefix tuple (§Q4.2/§Q4.3); and the three former obligations **O-1/O-2/O-3**, now **discharged SAFE** (§Q4.6); the committed-assertion content and line anchors in §8.2 — **including the `test_ingest_label_floor.py` collateral in row P5 (docstring invariants ≈12–13, parametrized case group ≈134–148) and the occupied tag vocabulary at `ingest/source_labels.py:207–217` (§Q4.4.1), both measured from source by the independent review that returned NO-GO on the second revision and carried here verbatim.** Added by the **third** independent read-only review (also NO-GO, also carried verbatim, also not re-measured here): **(a)** the `test_siem_correlation.py` import at ≈17 **already** binds `_label_of_event` and requires no edit (§8.2.1 row P1); **(b)** `resolve_payload_floor` returns the committed **three-field** `PayloadFloor` (`classification`, `system`, `invalid`), and `test_ingest_label_floor.py` **≈355** commits an equality against that exact three-field shape (§6.1, §8.2.1 row N1); **(c)** at `d3aaf6f` a malformed or present-unmappable floor **keeps the connector-supplied label** and emits **no** `handling:restricted`, which is why that expectation is RED-required rather than regression-lock (§8.2 P5, §8.3 test 6). Added by the **fourth** independent read-only review (also NO-GO, also carried verbatim, also not re-measured here): **(d)** `test_siem_correlation.py` commits a **`TestLabelFloorHelper` docstring at ≈408–410** stating that junk or absent labels resolve to the `DEFAULT` `khong_mat` — superseded invariant prose, now inside the widened §8.2 row **P2** range ≈408–422; **(e)** on the ingest path `resolve_payload_floor` collapses an out-of-scale/unmappable asserted classification and a malformed one into the **same** `(invalid=True, classification=None)` state, so **no ingest state with `classification` non-`None` and outside `LABELS` is reachable**; **(f)** `ingest/source_labels.py::label_rank` **raises `ValueError`** on out-of-scale input, which is what makes `resolve_payload_floor`'s `label not in LABELS` guard a correctness / crash-prevention constraint (§6.1). Added by the **fifth** independent read-only review (also NO-GO, also carried verbatim, also not re-measured here): **(g)** `test_siem_correlation.py` **≈484–491** exercises a window mixing an **absent** contributor with a **non-string invalid** contributor, so what the block asserts is decided by **Q2**, not by the carrier shape (§8.2 row **P3**); **(h)** `test_siem_engine.py` **≈227–236** holds **two** tests — an **absent-label** case at ≈227–230 and a **`top_secret` present-unmappable** case at ≈232–236 — and **neither carries a tuple-shaped expectation** (§8.2 row **P4**); **(i)** `test_siem_correlation.py` **≈509–512** commits an equality against **`LabelFloor("khong_mat", None)`** (§8.2.1 pin **N2**); **(j)** the ≈408–410 anchor resolves as the **`TestLabelFloorHelper` class declaration at ≈408** plus the committed **docstring at ≈409–410** — the earlier **(d)** phrasing naming the whole ≈408–410 span "the docstring" is imprecise and is corrected wherever it is operative, with the authorized range unchanged at ≈408–422; **(k)** the correlation window state is a **`_GroupState`**, the internal floor value is a frozen **`LabelFloor`** with a **`to_canonical()`** serializer, and the effective floor is computed by **`effective_label_floor()`** — the four hops §6/Q6 now decides the carrier chain across. Added by the **sixth** independent read-only review (also NO-GO, also carried verbatim, also not re-measured by the seventh pass) — **⚠ items (l), (n) and (o) below are HISTORICAL, WRONG, SUPERSEDED BY THE EIGHTH REMEDIATION, which measured the SOC source directly and found them false at `d3aaf6f`; they are printed here as retracted provenance and may not be cited as current truth. Items (m), (p) and (q) survive:** **(l)** ~~at `d3aaf6f` the label mechanism is **three distinct surfaces with three distinct runtime statuses**, not the single "M1" the prior revision named — **A** connector-config label application **live and ungated**, **B** the payload `label_floor` path **live call sites / feature-gated effect**, **C** the correlation/engine reader **NOT RUNTIME-WIRED**~~ — **SUPERSEDED: the correct model is FOUR surfaces, with C = PF event-label production/forwarding (deployment-wired) and D = correlation/engine (source-implemented and deployment-wired)** (§5.0); **(m)** the caller inventory read **by actual call arguments**: `ingest/service.py` and `ingest/pf_bridge.py` compute `payload_floor_for(config, parsed)` and pass it through (**A + B**), while **`ingest/source_health_worker.py` calls `apply_label(fields, config)` with no `payload_floor` argument at all** — **surface A only**, and it **never reads the payload `label_floor` block** (§5.1); **(n)** `payload_floor_for` returns `None` unless the server-held connector config carries the **exact boolean `True`** for `label_floor_enforce`, absent or default is **off** — **that much survives** — but the accompanying ~~**nothing in source sets that flag** … **no in-process caller auto-sets it**~~ phrasing is **SUPERSEDED: the accurate statement is that no *automatic* assignment exists, while an authorized connector create/update API call can set it** (`connector/api.py::validate_lc_config`, allowlist 95, boolean check 110–112) (§5.0, §5.2); **(o)** ~~`SiemEngine` / `CorrelationEngine` have **no in-process production caller and no worker wiring**~~ — **SUPERSEDED AS FALSE: `correlation_processor.py` constructs `CorrelationEngine` (334) and calls `_ingest_one` (483), is packaged as `pf-correlation` and is compose-declared**; the **mounted `siem` API excludes correlation** **survives**; and the committed SOC documentation phrase *"no worker wire exists"* is **stale document evidence, not current truth** (§5.1.2); **(p)** `test_siem_correlation.py` **≈533–535** commits an **exact-key-set assertion on the canonical `label_floor` block** — exactly `classification` and `monitored_system` (§8.2.1 pin **N3**); **(q)** the base **already** exercises the valid-mappable-classification-with-defective-auxiliary-field case and **already** pins `label:floor-invalid` with **no** fail-closed escalation, so §8.3 test **3d** re-locks committed facts and adds only the **negative** new-token assertion — the earlier "Test 3d is new" phrasing is withdrawn as a mis-description (§8.3 group A). |
| **O — open obligation** | Explicitly **not** established. Stated as a task the R2 writer must discharge from source, with a stop condition if it cannot. | **None remain.** O-1, O-2 and O-3 were the only entries in this class; all three were discharged from source by the R2 final review and are now class **R** (§Q4.6). The class is kept in this table so a later reader can see it was emptied by measurement, not by deletion. |

**The first seven** remediation passes ran in the `cybrik-suite` docs worktree only and had **no read
access to the SOC source**. They therefore re-measured nothing on the SOC side. **The eighth
(measured-topology) pass is the exception, and the difference is material:** it held read access to
the SOC source worktree `cybrik-worktrees/w1-48/w1-soc-secret-scan-remediation-r1` at
`d3aaf6fb29c57f145de8f131ad1588aae57d57c9` and **measured that source directly**. Everything it
states about the label topology, the Alert Writer envelope contract and the flag provenance is
therefore class **S** with exact files and symbols — **it did not rely on the prior review alone**,
and where its measurement contradicts a carried class-**R** claim, **the measurement governs and the
carried claim is withdrawn**. Every other SOC-side statement here is class **S** (from the original
pass) or class **R** (established from source by an independent read-only review that did hold SOC
read access, and carried here verbatim). Nothing SOC-side is guessed. The class **O** items that the first remediation pass
could not discharge — O-1/O-2/O-3 — were subsequently measured from source by the R2 final review
and are now class **R**; no open obligation remains, and no §6 answer is conditional on one.

**Specifically for this third pass:** the two source facts it acts on — the committed assertions
in `services/api/tests/unit/test_ingest_label_floor.py` (≈12–13, ≈134–148) and the occupied tag
vocabulary at `services/api/src/cybrik_soc/modules/ingest/source_labels.py:207–217` — are class
**R**, measured from SOC source by the independent review that returned NO-GO on the second
revision and carried here verbatim. **That pass re-measured neither.** They are recorded with that
class, not upgraded to **S**, and §8.2 condition 1 (stop-on-content-drift) governs them exactly as
it governs every other class **R** anchor in this packet.

**Specifically for this fourth pass:** it too wrote docs only, in this `cybrik-suite` worktree,
with **no read access to `cybrik-soc-command-center`**. The three SOC-side facts it acts on — the
already-correct `_label_of_event` import at `test_siem_correlation.py` ≈17, the committed
three-field `PayloadFloor` equality at `test_ingest_label_floor.py` ≈355, and the absence of
`handling:restricted` on the base's malformed / present-unmappable floor path — are class **R**,
measured from SOC source by the third independent review that returned NO-GO and carried here
verbatim. **This pass re-measured none of them**, none is upgraded to **S**, and §8.2 condition 1
plus §8.6 items 7 / 10b / 10c are the stop-on-drift mechanism that protects them. The one
*derived* fact this pass adds — that a defective auxiliary field is distinguishable from a
malformed classification using the parser's existing `(invalid, classification)` pair (§6.1) — is
a **decision** about how the policy layer reads that measured shape, not a new measurement.

**Specifically for this fifth pass:** same posture again — docs only, in this `cybrik-suite`
worktree, with **no read access to `cybrik-soc-command-center`**. The three SOC-side facts it acts
on — the committed `TestLabelFloorHelper` docstring at `test_siem_correlation.py` ≈408–410, the
parser-indistinguishability of Q1 (iii) and Q2 (ii) on the ingest path after
`resolve_payload_floor`, and the `ValueError` that `label_rank` raises on out-of-scale input — are
class **R**, measured from SOC source by the **fourth** independent review that returned NO-GO and
carried here verbatim. **This pass re-measured none of them**, none is upgraded to **S**, and §8.2
condition 1 plus §8.6 items 7 / 8 / 10b are the stop-on-drift mechanism that protects them. What
this pass adds on top of them is **derivation and scoping** — that the ingest derivation table has
no reachable "present but unmappable" row, that the present-unmappable-without-`floor-invalid`
claim is **correlation-path-only**, and that Phase 1 is allowlist entries **5–7** under every Q5
answer. Those are readings of measured shape plus this packet's own decided answers, **not** new
measurements.

**Specifically for this sixth pass:** same posture a fourth time — docs only, in this
`cybrik-suite` worktree, with **no read access to `cybrik-soc-command-center`**. The five SOC-side
facts it acts on — the mixed absent / non-string-invalid contributor content at
`test_siem_correlation.py` ≈484–491; the two separate tests at `test_siem_engine.py` ≈227–230 and
≈232–236 and the absence of any tuple-shaped expectation there; the committed
`LabelFloor("khong_mat", None)` equality at `test_siem_correlation.py` ≈509–512; the ≈408 class
declaration / ≈409–410 docstring split; and the `_GroupState` / `LabelFloor` / `to_canonical()` /
`effective_label_floor()` shape of the correlation window state — are class **R**, measured from
SOC source by the **fifth** independent review that returned NO-GO and carried here verbatim.
**This pass re-measured none of them**, none is upgraded to **S**, and §8.2 condition 1 plus §8.6
items 7 / 8 / 10b / 10d are the stop-on-drift mechanism that protects them. What this pass adds on
top of them is **taxonomy and decision** — that P3 and P4 are **policy** re-expressions driven by
Q1/Q2 rather than Q6-forced shape edits, and that Q6 = A extends to the **full internal carrier
chain** with a monotonic-OR group bool and a defaulted-`False` internal floor field. Those are a
reclassification of measured content and a coordinator decision about how the fact travels, **not**
new measurements.

**Specifically for this seventh pass — ⚠ HISTORICAL, WRONG IN PART, SUPERSEDED BY THE EIGHTH
REMEDIATION (next paragraph). Facts (l), (n) and (o) as stated below are false at `d3aaf6f`; they
are retained here only to show what was carried and retracted, and no current decision may be
anchored on them.** Same posture a fifth time — docs only, in this
`cybrik-suite` worktree, with **no read access to `cybrik-soc-command-center`**. The six SOC-side
facts it acts on are class **R**, measured from SOC source by the **sixth** independent review that
returned NO-GO and carried here verbatim: **(l)** the **three-way A/B/C surface topology** at
`d3aaf6f`; **(m)** the caller inventory read by **actual call arguments**, including that
`ingest/source_health_worker.py` calls `apply_label(fields, config)` with **no `payload_floor`
argument** and is **surface A only**; **(n)** that the payload floor is applied **only** on the
**exact boolean `True`** for `label_floor_enforce`, that **nothing in source sets that flag**, that
absent or default is **off**, and that **no in-process caller auto-sets it**; **(o)** that
`SiemEngine` / `CorrelationEngine` have **no in-process production caller and no worker wiring**,
that the mounted `siem` API **excludes correlation**, and that the committed SOC documentation says
**no worker wire exists**; **(p)** the committed **exact-key-set assertion** on the canonical
`label_floor` block at `test_siem_correlation.py` **≈533–535**; and **(q)** that the base **already**
carries §8.3 test 3d's case and **already** pins `label:floor-invalid` with **no** fail-closed
escalation. **This pass re-measured none of them**, held no SOC read access with which to do so, and
**none is upgraded to S**; §8.2 condition 1 plus §8.6 items 7 / 8 / 10b / 10d are the stop-on-drift
mechanism that protects them. What this pass adds on top of them is **withdrawal, re-grounding and
counting**: withdrawing the "M1 is live" grouping and every operative deploy-effect claim about
surface C, re-grounding Q2 and Candidate B's NO-GO on the **live feature-gated ingest path** alone,
recording **N3** as a fourth no-edit pin, correcting test 3d's description to
regression-lock-under-the-absence-rule, and re-checking that the accounting did not move. Those are
readings of measured shape plus this packet's own decided answers — decided, counted and
cross-checked **in this document** — **not** new measurements, and **no runtime, date or stack
authority is claimed by any of them**.

**Specifically for this eighth pass — the posture changes here, and the change is the point.** The
eighth (measured-topology) remediation still wrote docs only, still wrote exactly one file, and
still claims **no runtime, date or stack authority**. What is different is that it **held read access
to the SOC source worktree** `cybrik-worktrees/w1-48/w1-soc-secret-scan-remediation-r1` at
`d3aaf6fb29c57f145de8f131ad1588aae57d57c9` and **read that source itself**, rather than carrying a
review's reading of it. The consequence is stated plainly because it inverts the standing rule of the
seven passes before it:

- **Newly measured facts are class `S`**, with exact files and symbols, and are listed in the
  provenance table above and again in §12. They are **not** class **R** and must not be cited as
  review-carried.
- **Where the measurement contradicts a carried class-`R` claim, the measurement governs.** Three
  carried claims are contradicted and are **withdrawn as false at `d3aaf6f`**: **(o)** that
  `SiemEngine` / `CorrelationEngine` have no worker wiring; the seventh pass's derived claim that
  **no producer populates event `labels`**; and the §5.0 claim that connector bootstrap **writes
  `label_floor_enforce: True`**. Each survives below only as explicitly labelled withdrawn history.
- **The prior review was not taken at face value.** The seventh independent review returned **NO-GO
  with P0 = 3, P1 = 1, P2 = 1, P3 = 2**, and its finding that the A/B/C topology was false is
  **confirmed by measurement here**, not merely adopted. Its direction is upheld; the corrected model
  below is this pass's own measurement.
- **What is *not* claimed.** No instance is asserted to be **currently running** or
  **production-observed**. "Deployment-wired" means *packaged, declared and constructed in source*,
  which is what was measured. Liveness of any actual cluster is outside this packet's authority and
  is not asserted anywhere in it.
- **Everything else this pass contributes** — the re-grounding of Q2 on semantic conflation and
  unknown compatibility blast radius, the removal of the fired deferral/reopen condition, the
  narrowing of Q5's provenance language, and the recount confirming the accounting did not move — is
  **decision and counting in this document**, class **S** in that narrow sense only.

**Specifically for this ninth pass — the posture reverts, and that is stated so it cannot be
misread.** The ninth (document-closure) remediation held **no read access to
`cybrik-soc-command-center`** and **read no byte of it**. It is **not** a measurement pass: it
**re-measured nothing**, **upgraded nothing to class S**, and **added no new SOC-side fact**. Every
class-**S** SOC fact in this packet remains the **eighth** pass's measurement, cited at its own
location with exact files, symbols and line numbers; the ninth neither confirms nor extends it and
must not be read as a second reading of the source. What this pass read is **this file** and the
**live `cybrik-suite` git state of this worktree** (branch, HEAD, status, untracked/staged sets),
and nothing else. What it contributes is **document closure**, class **S** only in the narrow sense
that it was decided and cross-checked in this document: the corrected §10 **negative-claim
boundary** and its explicit provenance-posture bullet; the **created §12.2** closure checklist that
§12 and §12.1 had been pointing at while it did not exist; the scoping of the "no SOC read access"
statements to **passes one through seven**; and the corrected **§11 Q6 row pairing** (P2b/P2, not
P2b/P4). **No answer, range, class, count, source decision or topology changed**, and **no runtime,
date or stack authority is claimed** — nothing was run, started, installed, staged, committed,
fetched, pushed, merged or rebased, and no coverage was produced. The prompting review returned
**NO-GO with P0 = 1, P1 = 1, P2 = 1, P3 = 1**; its findings are corrected here, and **this pass did
not review its own output** — nothing in this revision is offered as an independent PASS, and a
**fresh independent review is still required**.

**Release impact: none.** The W1 dates **2026-08-01 → 2026-08-23** and the
**2026-12-21 → 2026-12-31** release window are unchanged by this packet. W0–W6 dates are
unchanged.

---

## 1. Ground truth — the dirty R1 worktree, preserved untouched

Verified read-only on 2026-07-29 in `cybrik-soc-command-center`:

| Fact | Measured value |
|---|---|
| Worktree | `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03-marking-floor-r1` |
| Branch | `codex/w1-i03-marking-floor-r1` |
| Tip commit | `87e95cd2add7233176ca442bb5870b5913fdd0eb` — subject `fix(alert): enforce idempotency binding`, dated 2026-07-26 |
| Dirty paths | **exactly 9**, all `M` (modified, tracked). No untracked paths. |
| Staged | **zero** |

The nine dirty paths, verbatim from `git status --porcelain=v1`:

```
 M services/api/.coverage
 M services/api/src/cybrik_soc/modules/connector/bootstrap.py
 M services/api/src/cybrik_soc/modules/ingest/source_labels.py
 M services/api/src/cybrik_soc/modules/siem/correlation.py
 M services/api/src/cybrik_soc/modules/siem/engine.py
 M services/api/tests/integration/test_alert_writer_bootstrap.py
 M services/api/tests/unit/test_ingest_label_floor.py
 M services/api/tests/unit/test_siem_correlation.py
 M services/api/tests/unit/test_siem_engine.py
```

Diffstat of the eight source/test paths (the `.coverage` binary excluded):
**925 insertions, 55 deletions across 8 files.**

### 1.1 `services/api/.coverage` is the disqualifying path

`services/api/.coverage` is a **tracked** file in `cybrik-soc-command-center`
(`git ls-files --error-unmatch` succeeds; it is present in the tree at both `87e95cd` and
`d3aaf6f`) and it is **not** covered by any `.gitignore` rule (`git check-ignore -v` returns
nothing). It is therefore a tracked binary coverage artifact that a naive `git add -A` or
`git commit -a` **would** carry into a commit. This is the single mechanical reason the R1
working tree cannot be committed as-is under a path-exact discipline, and the reason §2 denies
it explicitly rather than relying on ignore rules that do not exist.

### 1.2 Preservation instruction

The R1 worktree is **preserved untouched**. This packet's session did not write, stage, revert,
stash, clean, or check out anything in `cybrik-soc-command-center`. The nine dirty paths remain
exactly as measured. **No future step in this packet authorizes mutating the R1 worktree**; the
R2 lane (§2) is a *new* worktree, and R1 stays as the read-only provenance of the R2 content
until the Founder retires it separately.

---

## 2. Recommended future SOC lane — base, branch, exact allowlist

**Recommended clean base:** `d3aaf6fb29c57f145de8f131ad1588aae57d57c9` —
subject `test(fixtures): lower entropy without weakening intent`, dated 2026-07-28. Verified
read-only: the worktree currently holding it
(`.../w1-48/w1-soc-secret-scan-remediation-r1`, branch `codex/w1-soc-secret-scan-remediation-r1`)
is **clean, zero staged**.

**Why this base, and why the transplant is safe.** Verified read-only:

- `87e95cd` **is an ancestor of** `d3aaf6f`; `git merge-base 87e95cd d3aaf6f` = `87e95cd`;
  `git rev-list --count 87e95cd..d3aaf6f` = **7**. The recommended base is strictly ahead of R1.
- `git diff 87e95cd d3aaf6f` restricted to the **eight** source/test paths below is **empty** —
  the eight files are byte-identical at both commits. The R1 uncommitted diff therefore
  transplants onto `d3aaf6f` with **no content drift on the allowlisted paths**. This is a
  measured property of the two trees, not a prediction about whether the transplant *should*
  happen; §7 still holds the source edits behind Founder answers.

**Recommended branch:** `codex/w1-i03-marking-floor-r2`. Verified read-only:
`git rev-parse --verify codex/w1-i03-marking-floor-r2` fails — the branch **does not exist**, so
no existing lane is displaced.

**Recommended worktree:** a **new** worktree under `.../cybrik-worktrees/w1-48/`, distinct from
`w1-i03-marking-floor-r1`.

### 2.1 Exact eight-path write allowlist (proposed)

| # | Path | Kind |
|---|---|---|
| 1 | `services/api/src/cybrik_soc/modules/ingest/source_labels.py` | source |
| 2 | `services/api/src/cybrik_soc/modules/siem/correlation.py` | source |
| 3 | `services/api/src/cybrik_soc/modules/siem/engine.py` | source |
| 4 | `services/api/src/cybrik_soc/modules/connector/bootstrap.py` | source |
| 5 | `services/api/tests/unit/test_ingest_label_floor.py` | test |
| 6 | `services/api/tests/unit/test_siem_correlation.py` | test |
| 7 | `services/api/tests/unit/test_siem_engine.py` | test |
| 8 | `services/api/tests/integration/test_alert_writer_bootstrap.py` | test |

### 2.2 Explicit denial

- **`services/api/.coverage` is DENIED.** It must not be modified, staged, committed, reverted,
  or regenerated-into-the-index by the R2 writer. The denial is unconditional and is not
  satisfied by "produced and then left unstaged": the tracked path must show **no** `M` at any
  point, not merely at commit time. Phase 1 produces no coverage at all, and any later coverage
  run must be redirected to an external temporary path outside the repository — the exact
  mechanism, and the byte-clean re-check obligation, are in **§8.4**.
- **Anything outside the eight paths is a hard stop.** Not "reviewed later" — the writer stops
  and reports.
- **Zero staged** at all times except in the instant of an explicitly Founder-approved commit.
- No new migration, no Alembic head change, no dependency install, no formatter/auto-fixer run.

---

## 3. MARK-001 — approved sequencing, still-open decision, and an uncommitted gate definition

### 3.1 What the committed Suite queue actually says

Verified read-only at `eedadc5:docs/adr/FOUNDER-DECISION-QUEUE-W0.md`:

- Line 20 / line 64 (the approval text, recorded twice):
  `Duyệt W0 Bundle A: … MARK-001=A (G-MARK-1..8=yes).`
- Line 100–108: `MARK-001: Option A`, then `G-MARK-1: yes` through `G-MARK-8: yes` — **all eight
  gates recorded `yes`**.
- Line 41 (queue table, row 5): Option **A**; G-MARK-1..8 = **yes**; effect — *"Opens proposal
  packets and later parallel SOURCE/PROFILE prerequisites; **does not itself close MARK-001 or
  authorize migrations**."*
- Line 31: *"MARK-001 remains open; only its preparation sequence is authorized."*
- Line 55: *"MARK-001 approval opens preparation/implementation sequencing only. Exact QD-13
  mapping values …"* remain outside that approval.

**Recorded consequence.** MARK-001 Option A with G-MARK-1..8 = yes is **committed and real**.
It authorizes **preparation and proposal sequencing only**. **MARK-001 itself remains open.**
It does not authorize a migration, does not settle the exact QD-13 mapping values, and does not
by itself make any marking behaviour canonical.

### 3.2 The full MARK-001 packet exists only as an untracked file

Verified read-only in the `cybrik-suite` canonical root
(`/Users/hoanglinh/Claude/Projects/cybrik-suite`):

| Fact | Measured value |
|---|---|
| Path | `docs/adr/FOUNDER-DECISION-PACKET-MARK-001.md` |
| Git tracking | **untracked** — `git ls-files --error-unmatch` fails with *"did not match any file(s) known to git"* |
| Present in base commit? | **No** — `git cat-file -t eedadc5:docs/adr/FOUNDER-DECISION-PACKET-MARK-001.md` fails |
| Size / mtime | 6823 bytes, 2026-07-26 09:01 |
| `git hash-object` (blob SHA-1) | `0670f6e20be63cc77dafe8e49ba7675e4049f23a` |
| `shasum -a 256` | `7de53c01f1676ac2586885c5bcd822fe12f205a984eac00b4379f5923ee8edcb` |

Both hashes were taken **read-only**; the file was not staged, added, moved, or edited.

**Recorded consequence — stated plainly.** The committed queue at line 41 links to
`FOUNDER-DECISION-PACKET-MARK-001.md` as the definition of what G-MARK-1..8 *mean*, but that
target is **not in the repository**. **Uncommitted bytes cannot be a canonical gate definition.**
A file that is untracked can be edited, replaced, or deleted with no history, no review trail,
and no way for a later reviewer to prove which bytes the eight `yes` answers were given against.
Therefore:

- The **approval record** (queue, committed) is citable. G-MARK-1..8 = yes is real.
- The **gate semantics** (packet, untracked) are **not** citable as canonical. Any future
  statement of the form "this satisfies G-MARK-N" is unverifiable until the packet is committed.
- Committing that packet is a **separate** Founder-gated act. This packet does not do it, does
  not stage it, and does not propose doing it as part of the R2 writer's eight-path allowlist.

---

## 4. Corrected C1/G1 candidate chain — what it blocks, and what it does not

Verified read-only in `cybrik-suite`:

| Node | SHA | Subject | Branch(es) containing it |
|---|---|---|---|
| W1-C1 correction | `20cfa36c503e5a95341c80653d25d2000d65c9fe` | `contracts(w1): narrow alert-context org scope` | `codex/w1-c1-correction-a2-r1`, `codex/w1-g1-c1-repin-r1`, `codex/w3-contract-hygiene-local-r1` |
| W1-G1 correction | `71857395332fabe041896ca0700fbf7a2bf612d3` | `contracts(w1): repin alert-context transport source` | `codex/w1-g1-c1-repin-r1`, `codex/w3-contract-hygiene-local-r1` |

- `git branch -a --contains` for both SHAs returns **local branches only** — **no**
  `remotes/origin/*` entry. The `origin` remote exists
  (`https://github.com/hoangclinh/cybrik-suite.git`); neither commit has been pushed to it.
- `git merge-base --is-ancestor 20cfa36 main` → **NO**. `main` is at
  `5a4823f06ce9b12083e13cf9b1031f46130d90a8`; neither correction is an ancestor of it.
- The committed local-only provenance table records both as
  `LOCAL-ONLY · INDEPENDENT REVIEW PASS · NOT INTEGRATED · NOT PUSHED/MERGED/RELEASED`, and
  states explicitly that the accepted W1-C1 baseline `3a2c715…` / `e4cfbf8c…` and the accepted
  W1-G1 baseline are **unchanged** — the corrections are **not** contract-reacceptances.
  That table is carried byte-identically in three committed documents, verified read-only at
  `eedadc5`:

  | Document | Section |
  |---|---|
  | `eedadc5:docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | **§14.35** — *W1 Lane 5 local-only reviewed provenance* (the board has **no** §2.10; §2 is *Capacity and ownership*) |
  | `eedadc5:docs/operations/W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md` | **§2.10** — *Local-only reviewed provenance* |
  | `eedadc5:docs/operations/W1-E2-EVIDENCE-REGISTER.md` | **§27** matching rows, plus the W0-I01C row in §1 |

**Recorded status:** `CORRECTION COMMITTED — LOCAL-ONLY — NOT INTEGRATED — NOT ACCEPTED`.

### 4.1 Scoping — what the unaccepted chain actually blocks

The corrected C1/G1 chain governs the **alert-context contract surface**: org-scope narrowing
and the transport-source repin. Until it is accepted and integrated, it blocks:

- **re-vendoring** the corrected alert-context contract into any product repository;
- **alert-context binding** work — wiring SOC to the corrected contract, endpoint or capability
  registry entries, Fabric invocation, or Bundle adoption against it.

### 4.2 Scoping — what it does **not** block

It does **not** block **independent QD-13 marking-floor hardening** inside SOC. The QD-13 floor
touches `ingest/source_labels.py`, `siem/correlation.py`, `siem/engine.py` and
`connector/bootstrap.py` — internal SOC label resolution and the internal correlated envelope.
None of the eight allowlisted paths is a contract artifact, a vendored contract copy, or an
alert-context binding surface. The R2 lane is therefore **not** gated on C1/G1 acceptance; it is
gated on the Founder answers in §6.

**Corollary:** the R2 writer must not touch, cite as authority, or "align with" the corrected
contract chain. Doing so would silently import an unaccepted contract into product code.

---

## 5. Current-state truth — **four** label surfaces, measured directly at `d3aaf6f`

> **This section has now been corrected three times, and this correction is the first one made from
> measurement rather than from a carried review.** The R2 remediation pass withdrew a blanket "the R1
> mechanism is unwired" claim and replaced it with a single **LIVE** mechanism called "M1". The R2
> runtime-topology (seventh) pass withdrew "M1" and installed a **three-surface A/B/C** model in
> which the correlation/engine path was **NOT RUNTIME-WIRED** and **no producer populated event
> `labels`**. **That model is also withdrawn: it is false at `d3aaf6f`.** The eighth
> (measured-topology) pass read the SOC source worktree directly and found a **PF worker tier that
> produces the `labels` block unconditionally, forwards it into detections, and constructs and drives
> `CorrelationEngine` from a packaged, compose-declared service.** The partition below is a
> **four-surface current-state model**, class **S**, with exact files and symbols. Every earlier
> claim of a no-worker state is **withdrawn as an operative claim** and retained only as labelled
> history.
>
> **One boundary is held deliberately.** "Deployment-wired" here means **packaged, declared and
> constructed in source** — that is what was measured. It is **not** a claim that any instance is
> currently running or has been observed in production. This packet has no runtime authority and
> asserts no such thing.

### 5.0 Four label surfaces plus the bootstrap question — do not conflate them

| # | Surface | Files and symbols measured at `d3aaf6f` (class **S**) | Current state |
|---|---|---|---|
| **A** | **API ingest connector-config label application** — applying the labels held in the *server-side connector config* to an inbound record. | `services/api/.../ingest/service.py:432–434`; `.../ingest/pf_bridge.py:191–192`; `.../ingest/source_health_worker.py:121`; all via `.../ingest/source_labels.py::apply_label` (≈191–218) / `effective_labels` (≈167–188) | **CODE-REACHABLE / LIVE-CALL-PATH · UNGATED.** Reached in-process by all three callers with no flag in front of it. `source_health_worker.py` calls **`apply_label(fields, config)` with no `payload_floor`** — surface **A** only. |
| **B** | **API ingest payload `label_floor` application** — reading the sensitivity block the *payload* asserts and resolving it to a QD-13 level. | `.../ingest/service.py:433` and `.../ingest/pf_bridge.py:192`, both via `.../ingest/source_labels.py::payload_floor_for` (158–164) → `resolve_payload_floor` (131–155); gate at `floor_enforcement_enabled` (123–128), flag key `FLOOR_ENFORCE_FLAG = "label_floor_enforce"` (40) | **CODE-REACHABLE FROM `service.py` AND `pf_bridge.py` ONLY · GATED ON THE EXACT BOOLEAN `True`.** `floor_enforcement_enabled` is literally `(config or {}).get(FLOOR_ENFORCE_FLAG) is True`, so **absent / `False` / `1` / `"true"` all remain off**. **Nothing automatically assigns the flag** — but see the control-plane fact in the row note below; do **not** describe activation as CLI-only or human-bootstrap-only. |
| **C** | **PF event-label production and forwarding** — synthesizing the `labels` block on normalized events and carrying it into detections. | `ops/pf-workers/pf_workers/normalizer.py::resolve_label_floor` (188–232) and `normalize_envelope` (306–307, 326); `ops/pf-workers/pf_workers/siem_matcher.py::project_event` (660–662) and `build_detection` (680); services `normalizer` and `siem-matcher` in `deploy/pf/docker-compose.pf-workers.yml` | **DEPLOYMENT-WIRED.** `resolve_label_floor` **always** returns a block whose `classification` defaults to **`khong_mat`** (line 215, default at 44/77) — it never returns "no labels" — and `normalize_envelope` writes `doc["labels"] = labels` on **every** normalized document. `siem_matcher` then forwards `event['labels']` into the projection and carries it on the detection. **Absence of `labels` is therefore NOT universal on the deployed PF path.** |
| **D** | **Correlation / engine label reading and floor accumulation** — reading each event's `labels` block and raising the correlated floor. | `services/api/.../siem/correlation.py::_label_of_event` (61–79), `raise_label_floor` (370–377), `effective_label_floor` (388–393), use at 496 and 529, canonical at 324/345; driven by `ops/pf-workers/pf_workers/correlation_processor.py` — `CorrelationEngine(...)` at **334**, `eng._ingest_one(...)` at **483**; packaged as `pf-correlation` in `ops/pf-workers/pyproject.toml:40`; declared as service `pf-correlation` in `deploy/pf/docker-compose.pf-workers.yml` ≈99–119 and `deploy/pf/docker-compose.pf-demo.yml` ≈109–114 | **SOURCE-IMPLEMENTED **AND** DEPLOYMENT-WIRED through the PF worker path**, while **still excluded from the mounted SIEM HTTP API** (`services/api/.../siem/api.py:25–27`). The correct wording is **deployable / deployment-wired worker path** — **not** *NOT-RUNTIME-WIRED*, and **not** *observed-live*. **No claim is made that an instance is currently running or production-observed.** |
| **M2** | **Connector bootstrap convergence** — the *hypothetical* step that would write `label_floor_enforce: True` into an already-persisted internal Alert Writer connector's `config`. | `services/api/.../connector/bootstrap.py` — `ensure_internal_alert_writer_connector` at **67**, writing `config={"description": _INTERNAL_CONFIG_DESCRIPTION}` at **98** | **NOT IMPLEMENTED AT THIS BASE.** Measured directly: at `d3aaf6f` the file contains **no `label_floor_enforce` and no `FLOOR_ENFORCE_FLAG` occurrence at all**. **The prior §5.0 claim that current M2 writes `True` is removed as false.** The current base has **no automatic and no bootstrap convergence implementation** (§5.2). |

**Row-B note — how the flag can actually be set, stated because the prior revisions got it wrong in
both directions (class `S`).** `services/api/src/cybrik_soc/modules/connector/api.py::validate_lc_config`
(77–139) **allowlists** `label_floor_enforce` (line **95**) and **boolean-validates** it (lines
**110–112**, `must be a boolean`), and it is invoked by **both** `ConnectorIn._config` (≈178–181, on
create) and `ConnectorUpdate._config` (≈198–201, on update). **Therefore ordinary authorized
connector control-plane create/update operations accept and validate the flag and can set it.**
Two symmetric claims are withdrawn: the packet may **not** say activation is *CLI-only* or
*human-bootstrap-only*, and it may **not** say anything in source *automatically* sets it —
**nothing in source does**. Both statements have to be made together or neither is accurate.

**The labels "M1" and the A/B/C partition are both withdrawn.** "M1" grouped what are really four
surfaces into one status. The A/B/C model then split them three ways but got the fourth badly wrong,
declaring the correlation path unwired and the `labels` block unproduced. Wherever an earlier
revision said **"M1 is live"**, or **"surface C is NOT RUNTIME-WIRED"**, or **"no producer populates
event `labels`"**, read instead: **A is code-reachable and ungated; B is code-reachable from two
callers and gated on the exact boolean `True`; C produces and forwards a `labels` block on every
normalized event and is deployment-wired; D is source-implemented and deployment-wired through the PF
worker while remaining excluded from the mounted SIEM HTTP API.** `M2` keeps its name but changes
status: it is **not implemented at this base**.

### 5.1 The caller inventory, audited by actual arguments (class **S**, measured 2026-07-29 at `d3aaf6f`)

Every row below is stated by its **call shape**, read from source in this pass. The seventh pass's
version of this table was carried from a review and classified the correlation rows as reaching no
deployed path; that classification is corrected here from measurement.

| Caller | Call shape at `d3aaf6f` | Surface(s) | Do Q1/Q2 change what it produces? |
|---|---|---|---|
| `services/api/.../ingest/service.py` **:432–434** | primary ingest path — `source_labels.apply_label(fields, config, payload_floor=source_labels.payload_floor_for(config, ctx.parsed))` | **A + B** | **Only when the flag is on.** With `label_floor_enforce` absent or not exactly `True`, `payload_floor_for` returns `None` and the produced labels are unchanged. |
| `services/api/.../ingest/pf_bridge.py` **:191–192** | the **dual-write** bridge — `source_labels.effective_labels(config, source_labels.payload_floor_for(config, ctx.parsed))`, feeding the envelope's `labels_floor` block (200–205) | **A + B** | **Only when the flag is on**, exactly as `service.py`. |
| `services/api/.../ingest/source_health_worker.py` **:121** | `source_labels.apply_label(fields, config)` — **no `payload_floor` argument at all** | **A only** | **No.** It applies **connector config labels only**; it never reads the payload `label_floor` block, so neither Q1 nor Q2 changes its behaviour, flag on or off. |
| `ops/pf-workers/pf_workers/normalizer.py` **:306–307, 326** | `resolve_label_floor(env.labels_floor)` → `_apply_label_tags(...)` → `doc["labels"] = labels`, **unconditionally, on every normalized document** | **C** | **Not directly** — C is the *producer* of the block Q1/Q2 later read. What it fixes is that the block is **always present** with at least a defaulted `classification`. |
| `ops/pf-workers/pf_workers/siem_matcher.py` **:660–662, 680** | `project_event` copies `event["labels"]` into the projection when it is a mapping; `build_detection` carries `"labels": event.get("labels")` onto the detection | **C** | **Not directly** — it is the forwarder that makes the block reach surface **D**. |
| `services/api/.../siem/correlation.py` **:61–79, 496, 529** | `_label_of_event` reads each event's `labels` block; `state.raise_label_floor(*_label_of_event(event))` accumulates the window floor; `effective_label_floor()` produces the derived `LabelFloor` | **D** | **Yes**, and on a **deployment-wired** path — driven by `correlation_processor.py:483`. |
| `services/api/.../siem/engine.py` | threads the reading through to the derived alert | **D** | **Same as `correlation.py`.** |
| `ops/pf-workers/pf_workers/correlation_processor.py` **:334, 483** | constructs `CorrelationEngine(rules, field_map=..., ...)` and calls `eng._ingest_one(rule, tenant, ref, event, when, event_ref)` | **D** (driver) | **Yes** — this is the caller whose existence the prior revision denied. |

**Three descriptions from earlier tables are withdrawn by this audit.** The `source_health_worker.py`
row that read "background worker path — resolves outside any request context" implied payload-floor
coverage the caller does not have (withdrawn by the seventh pass, and **confirmed correct** here by
measurement — line 121 passes no `payload_floor`). The `correlation.py` / `engine.py` rows once
presented under a "**Live** call path" heading were then **over-corrected** to "reaching no deployed
path"; **that over-correction is withdrawn** — they are reached by a packaged, compose-declared
worker.

**Consequence, stated at its true scope.** A change to Q1/Q2/Q3/Q4 semantics changes what a deployed
SOC + PF stack produces **where a reachable caller actually reaches the changed behaviour**:

- on surface **A**, nothing Q1–Q4 decides changes connector-config label application;
- on surface **B**, the ingest call sites execute on every inbound record, but the payload-floor
  result is `None` — so behaviour stays legacy — unless that tenant's connector config carries the
  exact boolean `True`. **Nothing in source sets it automatically**, so no tenant flips on merely by
  deploying; **but an authorized connector create/update may set it** (§5.0 row-B note), so "off"
  is a default, not an inaccessible state;
- on surface **C**, the `labels` block is produced on **every** normalized event with a defaulted
  `classification` and forwarded onto detections. **Absence is not the universal state**, and any
  argument that depends on it being universal is unsound;
- on surface **D**, a Phase-2 change to `correlation.py` / `engine.py` is carried by a
  **deployment-wired** worker path. **It is not inert**, and it must not be described as such.
  Equally, **no claim is made here that any such worker instance is currently running or has been
  production-observed** — the measured fact is packaging, declaration and construction in source.

That is the honest blast radius, and it is the ground §6/Q2 is decided on.

### 5.1.1 The two keys are **not** the same key

The packet distinguishes them everywhere, and so must the writer and the tests:

| Path | Key read | Shape | Gate / runtime status |
|---|---|---|---|
| **API ingest** (`source_labels.py`, via `service.py` / `pf_bridge.py`) | payload key **`label_floor`** | mapping with exactly two keys, `classification` and `monitored_system` | **Code-reachable call sites, gated effect** (surface **B**) — `payload_floor_for` returns `None` unless the server-held connector config carries the exact boolean `True` for `label_floor_enforce`. **`source_health_worker.py` does not read this key at all** — it is surface **A** only. |
| **PF normalized event → correlation / engine** (`normalizer.py` produces it; `siem_matcher.py` forwards it; `correlation.py::_label_of_event`, `engine.py` read it) | event key **`labels`** | mapping carrying `classification`, `monitored_system` and `handling` (`normalizer.py:227–231`) | **Not flag-gated, and deployment-wired** (surfaces **C** → **D**) — **produced unconditionally** by `resolve_label_floor` with a defaulted `classification`, forwarded by `siem_matcher`, and read on every accepted contributor by a worker that is packaged and compose-declared. |

Conflating `label_floor` with `labels` is a real error, and the packet keeps the two keys apart
everywhere. **Two successive conclusions drawn from that distinction are now both withdrawn.** The
first said the payload-declared floor "is indeed inert without the connector flag, but the
*correlation/engine* reading of event `labels` is not, and it is the correlation path that
determines what an analyst sees on a derived alert." The second — the seventh pass's correction —
said the reverse: that the correlation reader "determines what an analyst sees on **no** derived
alert until it is wired." **Measured at `d3aaf6f`, the second is the false one.** The reader is
ungated within its own module *and* is reached by a packaged, compose-declared worker
(`correlation_processor.py:334, 483`), fed by a producer that emits the block on every normalized
document (`normalizer.py:306–307, 326`). The accurate statement is the first one's structure with
the fourth surface named correctly: the two keys are distinct, and the `labels` key is on a
**deployment-wired** path — without any assertion that a particular instance is running today.

**Symbol name, corrected (class R).** The correlation-side reader is
`siem/correlation.py::_label_of_event`. Earlier revisions of this packet called it
`_label_reading_of_event`; **no such symbol exists** at `d3aaf6f`, and every occurrence has been
corrected. The R2 writer must target `_label_of_event` by that exact name — a test written
against the invented name fails on import, which §8.1 would then have to disqualify as a
non-genuine RED. What that function *returns* is a separate question the packet did not previously
ask; it is now **Q6** (§6).

### 5.1.2 Surfaces **C** and **D** are source-implemented **and deployment-wired** (class **S**, measured 2026-07-29 at `d3aaf6f`)

**This subsection replaces one that asserted the opposite.** The seventh pass carried, from the sixth
independent review, the claim that *"`SiemEngine` / `CorrelationEngine` have no in-process production
caller and no worker wiring"*, that *"the mounted `siem` API excludes correlation"*, and that *"the
committed SOC documentation states that no worker wire exists"*. **The eighth pass measured the SOC
source itself.** The middle claim survives; the first is **false**; the third is **stale document
evidence, not current truth**. Exact findings, all class **S**:

- **A production-shaped caller exists and is packaged.**
  `ops/pf-workers/pf_workers/correlation_processor.py` constructs the real engine —
  `self._engine = CorrelationEngine(rules, field_map=self._fm, ...)` at **334** — and drives it —
  `alert = eng._ingest_one(rule, tenant, ref, event, when, event_ref)` at **483**. It is exposed as a
  console script, `pf-correlation = "pf_workers.correlation_processor:main"`
  (`ops/pf-workers/pyproject.toml:40`).
- **It is declared as a deployable service.** `deploy/pf/docker-compose.pf-workers.yml` declares a
  `pf-correlation` service (≈99–119, consumer group `cg.correlation`), and
  `deploy/pf/docker-compose.pf-demo.yml` declares the same service for the demo topology (≈109–114,
  group `cg.correlation.demo`).
- **Its input is produced unconditionally upstream.**
  `ops/pf-workers/pf_workers/normalizer.py::resolve_label_floor` (188–232) **always** returns a block
  — `classification` defaults to `khong_mat` when absent or out-of-scale (215–219) — and
  `normalize_envelope` assigns `doc["labels"] = labels` (326) on every normalized document.
  `ops/pf-workers/pf_workers/siem_matcher.py` then forwards it: `project_event` copies
  `event["labels"]` into the projection (660–662) and `build_detection` carries it on the detection
  (680), which is what `correlation.py::_label_of_event` reads.
- **What survives from the old subsection:** correlation **is** excluded from the mounted SIEM HTTP
  API. `services/api/src/cybrik_soc/modules/siem/api.py:25–27` states there is no correlation
  endpoint. That remains true and is unaffected by the worker path.
- **What does not survive:** the same docstring's phrase *"khong worker wire"* (line 26) is **stale**.
  It is a module-scope note written for the S12 API wiring checklist and it is contradicted by the
  packaged and compose-declared `pf-correlation` service above. **It may not be cited as current
  truth about worker wiring**; cite the worker and manifest files instead.

**What that makes surfaces C and D — the exact classification, to be used verbatim:**
**SOURCE-IMPLEMENTED · DIRECT-TESTABLE · DEPLOYMENT-WIRED WORKER PATH · EXCLUDED FROM THE MOUNTED SIEM HTTP API.**
The phrase **NOT RUNTIME-WIRED is withdrawn** and may not be used for either surface.

**What that licenses, and what it forbids:**

- **Forbidden — the claim the seventh pass mandated.** Stating that the correlation/engine label path
  is **not runtime-wired**, that it reaches no deployed path, that merging a Phase-2 change to it
  produces **no deploy effect**, or that no producer populates event `labels`. All four are **false
  at `d3aaf6f`**, and the prior instruction that a reviewer **may** say the first of them is
  **rescinded**. Nothing in this packet mandates the no-worker state any more.
- **Also forbidden — the opposite overreach.** Claiming that any `pf-correlation` instance is
  **currently running**, has been **production-observed**, or that a Phase-2 change "takes effect on
  the next deploy" as an observed fact. The measured fact is **packaging, declaration and
  construction in source**. Deployability is not observation, and this packet has no runtime
  authority with which to close that gap.
- **Also forbidden.** Describing the **whole** R2 lane as inert. `ingest/service.py`,
  `ingest/pf_bridge.py` and `ingest/source_health_worker.py` are reachable callers today, and the PF
  tier produces and forwards the `labels` block on every normalized event.
- **Accurate, and the wording to use:** a Phase-2 change to `correlation.py` / `engine.py` lands on a
  **deployable, deployment-wired worker path** whose input is **already produced**. That is a real
  blast radius — larger than the withdrawn "no deploy effect", smaller than "observed live".

**Correlation semantics are still worth deciding, and now for a stronger reason.** Q1–Q4 and Q6
govern what the correlation module does when it is reached — by direct import, by its own unit tests,
**and by the packaged `pf-correlation` worker**. That is implementation policy for a wired path plus
a direct-test contract. It is still **not** an observed-runtime claim, and nothing in this packet
turns it into one.

### 5.2 Flag provenance — no convergence implementation at this base, but the control plane can set the flag (class **S**, measured 2026-07-29 at `d3aaf6f`)

**Two prior claims in this subsection are withdrawn as false, and they failed in opposite
directions.** The first was that `connector/bootstrap.py` *"sets `label_floor_enforce: True` in the
internal Alert Writer connector's `config`"*. The second was that the flag is set *"only by a human
running the bootstrap CLI"*. Measured directly at `d3aaf6f`:

**(1) There is no bootstrap convergence implementation at this base.**
`services/api/src/cybrik_soc/modules/connector/bootstrap.py` contains **no occurrence of
`label_floor_enforce` and no occurrence of `FLOOR_ENFORCE_FLAG`** — the file was searched in full.
`ensure_internal_alert_writer_connector` is defined at line **67** and writes
`config={"description": _INTERNAL_CONFIG_DESCRIPTION}` at line **98**. **Nothing in it touches the
flag.** Any description of R1's `_converge_label_floor_enforce` behaviour is a statement about a
**different, historical or proposed revision** — it is recorded that way in §6/Q5 and it may **never**
be placed under current runtime status. **The correct statement of the current base is: there is no
automatic and no bootstrap convergence implementation.**

**(2) Ordinary authorized connector control-plane operations can set the flag.**
`services/api/src/cybrik_soc/modules/connector/api.py::validate_lc_config` (77–139) puts
`label_floor_enforce` in its `allowed` key set (line **95**) and enforces
`f"{flag} must be a boolean"` for it (lines **110–112**). That validator is invoked by
`ConnectorIn._config` on **create** (≈178–181) and by `ConnectorUpdate._config` on **update**
(≈198–201). **So an authorized connector create or update through the API accepts and validates the
flag, and can set it to `True`.** Every claim in this packet that activation is *CLI-only* or
*human-bootstrap-only* is **withdrawn**.

**(3) What remains true, and must be stated alongside (2).** **Nothing in source automatically
assigns the flag.** There is no startup convergence, no worker that writes it, no CI path that sets
it, and no default that is `True` — `floor_enforcement_enabled` is
`(config or {}).get(FLOOR_ENFORCE_FLAG) is True` (`source_labels.py:128`), so absent, `False`, `1` and
`"true"` are all off. Statements (2) and (3) are only accurate **together**: the flag is
**operator-settable through the ordinary control plane and never self-setting**.

**Referrer inventory, re-measured at `d3aaf6f` (the prior table cited `87e95cd` and is reconciled).**
The packet base for **every** SOC source decision is `d3aaf6f`; the stray `87e95cd` anchors are
removed, and the old `bootstrap.py:104` definition anchor is corrected to **line 67**.

| Referrer to `ensure_internal_alert_writer_connector` at `d3aaf6f` | Kind |
|---|---|
| `services/api/src/cybrik_soc/modules/connector/bootstrap.py:67` | the definition |
| `services/api/tests/integration/test_alert_writer_bootstrap.py` (10 measured references) | tests |
| `services/api/scripts/bootstrap_alert_writer.py:31, 54` (import + 1 call site) | **manual operator CLI** |

That function still has **no application or runtime caller** — no module under
`services/api/src/cybrik_soc/` imports `connector.bootstrap`, and it is invoked from no startup path
and no CI job. **But that fact no longer carries the weight the prior revision gave it,** because the
function does not touch the flag at all at this base, and because the flag has a control-plane
setter that does not go through it.

**Recorded consequence, at its true scope.** Surface **B** is **off by default and stays off until
someone sets the flag** — through an authorized connector create/update, or through some future
convergence step that **does not exist here**. Existing deployments carry connectors without
`label_floor_enforce`, and `payload_floor_for` keeps returning `None` on those tenants. **Surface B's
call sites still run** — `service.py:433` and `pf_bridge.py:192` compute and pass the payload floor on
every record — but what they pass is `None`, so the produced labels are the legacy ones. The
committed SOC record says as much for the adjacent seed work —
`cybrik-soc-command-center:docs/operations/PR-SPEC-ALERT-WRITER.md` §9.3, in its connector-seed bullet
(the one cross-referencing §3.1), ends *"CHƯA provision secret thật theo tenant, CHƯA kích hoạt trên
cụm"* (no real per-tenant secret provisioned, not activated on any cluster).

**What this does *not* license anyone to say.** It does not license "the QD-13 floor is unwired *as a
whole*", "the R2 lane touches no reachable call path", or "the label logic is dead code" — surface
**A** is ungated and reachable, surface **B**'s call sites are reachable, and surfaces **C**/**D** are
deployment-wired. It equally does not license the seventh pass's opposite overreach — treating the
correlation/engine path as unwired. **Both of those framings are now closed.**

The precise, citable form of the disclosure is now **four-way**, and it is used verbatim rather
than paraphrased in any direction:

> *At `d3aaf6f` there are four label surfaces. **(A)** API ingest connector-config label
> application is **code-reachable / live-call-path and ungated** — `ingest/service.py`,
> `ingest/pf_bridge.py` and `ingest/source_health_worker.py` all apply connector config labels on
> inbound records; `source_health_worker.py` passes no `payload_floor` and is surface A only.
> **(B)** API ingest payload `label_floor` application is **code-reachable only from
> `ingest/service.py` and `ingest/pf_bridge.py`** and is **gated on the exact boolean `True`** for
> `label_floor_enforce`; absent, `False`, `1` and `"true"` all remain off. **Nothing in source
> automatically assigns the flag**, but **authorized connector create/update through
> `connector/api.py::validate_lc_config` accepts and validates it**, so activation is neither
> automatic nor CLI-only.
> **(C)** PF event-label production and forwarding is **deployment-wired**:
> `ops/pf-workers/pf_workers/normalizer.py::resolve_label_floor` **always** creates a `labels` block
> with `classification` defaulting to `khong_mat`, `normalize_envelope` emits it on every normalized
> document, and `ops/pf-workers/pf_workers/siem_matcher.py` forwards `event['labels']` into the
> detection event for correlation.
> **(D)** The correlation/engine reading of event `labels` is **source-implemented and
> deployment-wired** through `ops/pf-workers/pf_workers/correlation_processor.py`, which constructs
> `CorrelationEngine` and calls `_ingest_one`, is packaged as `pf-correlation` in
> `ops/pf-workers/pyproject.toml` and is declared in `deploy/pf/docker-compose.pf-workers.yml` and
> `docker-compose.pf-demo.yml`. It **remains excluded from the mounted SIEM HTTP API**. It is a
> **deployable / deployment-wired worker path** — **not** *NOT-RUNTIME-WIRED*, and **no claim is made
> that an instance is currently running or production-observed**.*

This is the substance of **Q5** (§6) — and note what Q5 therefore *is not* about: it is a question
about **M2 only**, i.e. about whether a convergence step (which does not exist at this base) belongs
in this lane. Neither Q5 answer changes surface **A**, neither changes surfaces **C**/**D**, and
neither is required to make surface **B** settable — the control plane already can.

---

## 6. Founder questions — the exact decisions the R2 writer needs

These six are the **minimum** blocking set. Each is stated with the concrete alternatives
measured out of the R1 diff, so the answer can be a short literal string (§11). Each carries a
**recommended candidate, preselected for coordinator review**; the recommendation is a default to
accept or override, never a decision already taken.

**Q3 and Q6 are different questions and must be answered separately.** Q3 governs the **wire**
representation of `unresolved` — what leaves the correlated envelope. Q6 governs the **in-process
carrier** — what `_label_of_event` returns and what correlation/engine pass between themselves.
Answering Q3 does not answer Q6: Q3 = A (tag-only on the wire) is compatible with several
different internal shapes, and picking none of them is not a neutral act — it hands the shape to
the writer by default, and the committed tests then have to be bent around whatever it improvises.

### Q1 — Present, genuinely unmappable assertion: top-of-scale, or quarantine? — **recommended: A**

**Situation.** A record carries a `classification` that is **present, a string, non-empty, and
outside** the QD-13 scale `("khong_mat", "mat", "toi_mat")` — e.g. `tuyet_mat`, `top_secret`, a
case or whitespace variant. On the ingest path this is `label_floor.classification`; on the
correlation/engine path it is `labels.classification` (§5.1.1). The source *is asserting a
sensitivity*; we merely cannot map it. Collapsing it to `khong_mat` would be a silent downgrade,
which QD-13 forbids.

**Scope boundary, stated so Q1 and Q2 cannot overlap.** Q1 governs **presence + well-formedness +
unmappable value**, and nothing else. Absence of the block, a block that is not a mapping, and a
`classification` that is a non-string or empty string are **all** Q2, not Q1. The redesigned Q2
depends on this boundary holding exactly.

**The boundary is conceptual, and on one of the two paths it is not mechanically observable.**
On the **correlation** path it is: `_label_of_event` reads `event['labels']` directly, so an
unmappable value arrives non-`None` and is distinguishable from a malformed one. On the **ingest**
path it is not: `resolve_payload_floor` collapses both into `invalid = True` /
`classification = None` before any policy code runs (§6.1.1). That collapse is deliberate and
costs nothing here, because Q1 = A and Q2 = A prescribe the **same** ingest outcome for the two
cases. It matters for two things only — what a Phase-1 ingest test may assert (§8.3 group A), and
what would have to change if the coordinator answered Q1 and Q2 differently from each other.

**Option A — top-of-scale fail-closed (what R1 implemented).** Set the effective label to
`FAIL_CLOSED_LABEL = LABELS[-1]` = **`toi_mat`**, and mark the path explicitly with an
`unresolved` flag surfaced as a tag.
*Cost:* unmapped vocabulary from a noisy source floods the workbench with real-looking `toi_mat`,
degrading analyst triage and over-restricting retention/RBAC on data that may be routine.

**Option B — quarantine without classification.** Do not assign any QD-13 level. Route the
record to a quarantine disposition that is neither readable under normal clearance nor labelled
`toi_mat`, pending operator resolution.
*Cost:* a new disposition state that ingest, correlation, the datalake search gate, retention and
the UI must all understand — materially larger surface than Option A, and it does not exist
today.

**Why this must be a Founder answer.** These differ in what an analyst *sees* and what retention
*keeps*, and Option A knowingly creates a false-`toi_mat` amplification channel. R1 chose A in
code with a written rationale; that choice was never approved.

**Recommendation: A, preselected.** A present assertion is a positive signal from a source; the
QD-13 no-silent-downgrade rule binds hardest exactly there, and A is the only option implementable
without a new disposition state. The amplification cost is real and must be disclosed, but it is
bounded twice over: by how many records actually carry an unmappable non-empty value — which,
unlike Q2's absent case, is **not** the ordinary shape of a payload — and, on the ingest side, by
the `label_floor_enforce` gate, since a tenant without the exact boolean `True` never reaches this
branch at all (§5.0 surface **B**). **On the correlation side the earlier bound is withdrawn.** The
seventh pass wrote that Q1's cost there is "bounded by surface C not being runtime-wired"; measured
at `d3aaf6f` that bound does not exist — surfaces **C** and **D** are **deployment-wired** (§5.1.2),
so Q1 fixes what a packaged, compose-declared worker path does. **That strengthens the case for
deciding Q1 carefully; it does not change the answer.** The amplification is still bounded by how
rarely a `classification` is present, well-formed and out-of-scale: on the PF path the block is
synthesized by `normalizer.py::resolve_label_floor`, which **normalizes an out-of-scale value to the
default rather than passing it through** (215–219), so the unmappable-value branch is reached by
*non-PF-normalized* contributors and direct engine/helper inputs, not by the synthesized stream.
**Q1 = A is preserved unchanged by every remediation pass;** neither the Q2 redesign below nor the
corrected topology in §5 weakens it.

### Q2 — Absent block vs present-but-malformed block — **recommended: A (redesigned)**

> **Redesigned in the R2 remediation pass.** The previous Q2 lumped "missing" and "corrupt"
> together as one case ("missing/corrupt") and offered a keep-the-split / uniform-fail-closed
> pair. That framing is withdrawn: it hid the only distinction that matters at this base, and its
> Option B was undeliverable for a reason the packet did not state. The candidates below replace
> it.

**Situation — three cases, and Q2 owns two of them.** Distinct from Q1, which owns only a
*present, well-formed, unmappable* value:

| Case | Ingest path (`label_floor`) | Correlation/engine path (`labels`) | Owner |
|---|---|---|---|
| **(i) Absent** | payload carries **no** `label_floor` block | event carries **no** `labels` block | **Q2** |
| **(ii) Present but malformed** | `label_floor` exists but is not a mapping; or `label_floor.classification` is a non-string, or an empty/whitespace-only string | `labels` exists but is not a mapping; or `labels.classification` is a non-string, or an empty/whitespace-only string | **Q2** |
| **(iii) Present, well-formed, unmappable value** | `label_floor.classification = "tuyet_mat"` etc. | `labels.classification = "tuyet_mat"` etc. | **Q1** |

**The facts that decide Q2 — re-grounded a second time, now on measured source (class `S`).** Two
successive grounds are withdrawn. The **first** decided Q2 on the claim that the correlation/engine
path is live and a fail-closed absence rule would "fire immediately and for every tenant" on the
first deploy. The **second** — the seventh pass's correction — withdrew that and decided Q2 on the
claim that surface C is not runtime-wired and that **absence is the universal state** because *"no
accepted producer populates event `labels` today"*. **That second ground is false at `d3aaf6f` and is
withdrawn in full.** The decisive facts, measured directly:

1. **Absence is NOT universal on the deployed PF path, and the packet's own reopen condition has
   already fired.** `ops/pf-workers/pf_workers/normalizer.py::resolve_label_floor` (188–232)
   **always synthesizes** a `labels` block — `classification` defaults to `khong_mat` when absent or
   out-of-scale (215–219) — and `normalize_envelope` writes it onto **every** normalized document
   (326). `ops/pf-workers/pf_workers/siem_matcher.py` then **forwards** it: `project_event`
   (660–662) and `build_detection` (680). A producer therefore **does** populate event `labels`,
   unconditionally. Candidate A's old deferral, and the reopen condition keyed to *"until an accepted
   producer actually populates event `labels`"*, are **removed** below — not re-worded — because the
   condition they were waiting on is already satisfied at this base. **Every claim that no producer
   populates `labels` is withdrawn.**
2. **For the internal Alert Writer producer, absence is not merely uncommon — it is unreachable.**
   `ops/pf-workers/pf_workers/alert_writer.py::validate_envelope` (229; note the **public** name —
   the `normalizer.py` docstring's `_validate_envelope` spelling is the private form and is not the
   symbol) **rejects** an envelope whose `label_floor` is missing or not a mapping
   (`EnvelopeRejected("label_floor", "thieu label_floor (QD-13)")`, 264–266), **rejects** a
   `classification` outside `LABELS` (267–271, *"khong doan, khong ha"*), and **rejects** a
   non-string, non-null `monitored_system` (272–274). **The "bulk / ordinary shape" claim for the
   internal connector is therefore withdrawn:** that producer cannot emit a floor-absent envelope at
   all.
3. **Surface B remains the API-ingest scope, and the gate is unchanged.** The payload `label_floor`
   path in `ingest/service.py:433` and `ingest/pf_bridge.py:192` is reachable on every inbound
   record, and its *effect* is gated on the exact boolean `label_floor_enforce = True` (§5.0, §5.2).
   `source_health_worker.py` is not in scope for Q2 at all — it applies connector labels only
   (line 121) and never reads the payload block. **With the flag off — the default — neither Q2
   answer alters what ingest produces.** This packet makes **no all-ingest claim** and no measured
   population claim, and none may be derived from it.
4. **With the flag set to the exact boolean `True` — by an authorized connector create/update
   (§5.2), not automatically and not only by a CLI — the answer becomes operative for that tenant.**
   At `d3aaf6f` an **absent** `label_floor` block comes back from `resolve_payload_floor` as
   `invalid = False` / `classification = None`, i.e. rank-0 `khong_mat` with **no** unresolved signal
   (§6.1). Under Candidate A it must stay exactly that.
5. **What still genuinely needs a defined safe behaviour on absence.** Not "all producers", and not a
   claimed volume. Specifically: **direct engine/helper inputs** (`correlation.py::_label_of_event`
   is called with whatever mapping it is given, and defaults to `DEFAULT_LABEL` when `labels` is
   absent — 70–75); **any producer outside the normalized contract**, including backward-compatible,
   direct, manual and third-party writers; and **envelope v1 shapes**, which `correlation.py:51–53`
   explicitly distinguishes from v2 by the presence of `label_floor`. The absence branch must be
   defined for those. It is **not** a claim that any named producer currently omits `labels`.

**Current R1 behaviour, for reference.** R1 does not distinguish (i) from (ii): both take
`DEFAULT_LABEL` = `khong_mat` (rank 0), which under MAX-monotonic floor semantics can never
*lower* a higher contributor. Only (iii) fails closed. So R1 is *safe on absence but silent on
corruption* — a present-but-corrupt block is indistinguishable, downstream, from a clean
`khong_mat`.

---

**Candidate A — split by presence. `RECOMMENDED · PRESELECTED FOR COORDINATOR REVIEW`**

- **(i) Absent** → the record stays at rank-0 `khong_mat`, with **no** unresolved signal.
  **Grounded normatively, and at the actual boundary — this is the eighth pass's re-grounding, and
  the old scoped-deferral framing is removed.** *Absent means no asserted source floor.* It is
  **not** evidence of a malformed or unmappable assertion, and it must not be treated as one: there
  is nothing to fail closed *about*. Fail-close applies **only** to a **present** malformed or
  unmappable assertion, where a producer did assert something and the assertion cannot be trusted.
  That is a statement about **meaning**, not about volume, and it does not depend on how often
  absence occurs.
- **What the deployed shape adds, stated without over-claiming.** On **PF-normalized** input the
  synthesized default (`normalizer.py:215–219`) means the absence branch is **uncommon to unreached**
  — the block is always there. On the **internal Alert Writer** producer it is **unreachable**, since
  `alert_writer.py::validate_envelope` rejects a missing `label_floor` outright (264–266). What still
  needs the branch defined is **direct engine/helper inputs and any producer outside the normalized
  contract** — backward-compatible, direct, manual, envelope-v1 and third-party writers. **Backward,
  direct, manual and other-producer compatibility is preserved by Candidate A**, and that is the
  reason to keep the branch defined rather than to fail it closed.
- **The prior deferral and its reopen condition are removed, not re-worded.** Candidate A previously
  held "until an accepted producer actually populates event `labels` … or the payload `label_floor`
  block", with a §8.6 stop that would reopen Q2 when that happened. **A producer already does
  populate `labels`, unconditionally** (fact 1 above), so the condition has fired and the deferral it
  guarded is spent. **Q2 = A is now held on the normative ground above** — which does not expire —
  rather than on a temporary state of the producer population.
- **(ii) Present but malformed** — the block exists but is not a mapping, **or** the
  `classification` within a present block is malformed (non-string, empty, whitespace-only) →
  **fails closed to top-of-scale `toi_mat`**, with the **explicit unresolved signal** set, exactly
  as Q1's unmappable case does.
- **Rationale.** Presence is the discriminator that carries information. A producer that emitted
  a block and got it wrong has a defect or has been tampered with; that is the same threat shape
  Q1 fail-closes on, and it must not be laundered into a clean rank-0. A producer that emitted
  **nothing** has asserted nothing — and an absent assertion is not a corrupted one.
- **Cost, disclosed rather than closed.** The omission attack survives: the cheapest way to defeat
  the floor remains sending *less*, not more. A malicious or broken producer that **strips** the
  block entirely still lands at rank 0. This packet does **not** claim that risk is mitigated.
  **It is now disclosed as a standing, accepted residual of the normative rule**, rather than as a
  deferral awaiting a condition — because the condition it awaited has already occurred and the
  residual remained. Mitigating omission requires a *provenance* control (an authenticated
  producer-must-assert contract), not a re-reading of absence, and that is out of scope here.
- **Also disclosed:** A creates a behavioural cliff. On a **flag-enabled** tenant, the instant a
  producer starts emitting a block, that producer's malformed records flip from rank-0 to `toi_mat`.
  That is intended and it is the point of (ii).

**Candidate B — uniform fail-closed, including absence. `NO-GO AT THE CURRENT BASE`**

- Absent **and** malformed are both treated as unresolved and raised to `toi_mat`.
- **Why NO-GO — re-argued from scratch, because both prior grounds are withdrawn.** The **first**
  ground was *"absence is universal on the correlation/engine path, and M1 is live, so B would raise
  substantially every derived alert to top-of-scale on the first deploy"*. The **second** — the
  seventh pass's — kept the volume argument and moved it to ingest: *"floor-absent is the ordinary
  shape of a legacy or non-correlated payload … it is the bulk of what the flag-enabled tenant
  ingests"*. **That second ground is withdrawn too: it is a claim about traffic volume that this
  packet never measured and cannot make.** Nothing here counts records, samples a tenant, or observes
  a producer population. The verdict does not need it. The two sufficient grounds are:
  - **(1) Semantic conflation.** B collapses *"the source asserted nothing"* into *"the source
    asserted something we could not trust"*. Those are different facts with different remedies: the
    first is answered by a **provenance** control (require and authenticate an assertion), the second
    by a **fail-closed** control. Marking both `toi_mat` with the same unresolved signal destroys the
    distinction at the exact point an analyst would need it — the tag no longer tells them whether a
    producer is *broken* or merely *silent*, and the audit trail cannot separate the two afterwards.
    Q1's rationale depends on that distinction being real: a **present** assertion is a positive
    signal from a source, which is precisely why it binds hardest. B removes the premise Q1 = A rests
    on.
  - **(2) Unknown compatibility blast radius.** B changes the meaning of the **default, silent** case
    — the one every backward-compatible, direct, manual, envelope-v1 and third-party producer lands
    in by doing nothing (§5.1.1, `correlation.py:51–53`). The set of such producers is **not
    enumerated at this base**, and this packet has neither the authority nor the measurement to
    enumerate it. Shipping a rule whose blast radius is *unknown* — rather than known-and-large or
    known-and-small — is not a risk the coordinator can price. **That is the honest form of the
    objection**, and it does not depend on any traffic estimate.
  - **Candidate A does not have either failure mode.** Under A, an absent floor stays at rank-0
    `khong_mat` with no unresolved signal — exactly what the base already produces — so the silent
    default keeps its current meaning and enabling the flag re-marks only records that actually
    assert something. That is the decisive **compatibility and semantic** reason for **A**, and the
    reason **B is NO-GO**.
- **The actual Alert Writer guarantee, stated because it bears directly on B.** For the internal
  Alert Writer producer, B's absence branch is **unreachable**:
  `ops/pf-workers/pf_workers/alert_writer.py::validate_envelope` requires `label_floor` and rejects a
  missing block (264–266) or an out-of-scale `classification` (267–271). **So B buys nothing at all
  on that producer** — the envelope contract already guarantees a present, in-scale floor — while
  paying the full conflation and compatibility cost on every producer outside that contract. That
  asymmetry is the practical form of grounds (1) and (2).
- **Stated precisely, so nothing here is over-claimed.** This packet does **not** claim that B would
  affect every currently ingested alert — with the flag off, neither answer changes anything. It does
  **not** claim any volume, rate or population of floor-absent traffic. It does **not** claim that
  anything in source auto-sets `label_floor_enforce` — though an authorized connector create/update
  **can** set it (§5.2), so the "CLI-only" claim is withdrawn. And it does **not** claim that any
  `pf-correlation` instance is currently running; surfaces **C**/**D** are **deployment-wired**
  (§5.1.2), which raises the stakes of the correlation semantics without asserting an observed
  runtime.
- **What would make B reconsiderable.** An **enumerated** producer population — so the compatibility
  blast radius is known rather than unknown — together with a **separate** carrier that preserves the
  asserted-nothing / asserted-badly distinction B otherwise collapses (for example, distinct tokens
  rather than one shared unresolved signal). Until both hold, B is not a risk-appetite choice the
  coordinator can price: the base does not supply the information it would need.
- **B is listed, not hidden.** It remains on the ballot so the coordinator can override; the
  NO-GO is this packet's assessment, not a removal of the option.

**Why this must still be a Founder/coordinator answer.** A knowingly leaves the omission attack
open and creates a behavioural cliff; both are accepted risks, and accepting a risk is not the
writer's call. The engineering question ("can B ship?") is answered here — it cannot, at this
base. The risk question ("is A's residual acceptable meanwhile?") is not.

**P3 / P5 / test-mapping recheck under the corrected topology (eighth pass).** The mapping was
re-derived, not assumed. **Nothing moves.** Row **P3** (`test_siem_correlation.py` ≈484–491) mixes an
**absent** contributor with a **non-string invalid** contributor; under Q2 = A the invalid one still
fails closed and the absent one still contributes rank-0, so the derived classification is still
`toi_mat` with the unresolved state present — **RED-required (Q2; Q4 for the token)**, and the
closing-delimiter authorization at ≈491 is preserved. Row **P4** (`test_siem_engine.py` ≈227–236) is
still the mixed row: ≈227–230 absent-label stays `khong_mat` with no unresolved signal
(**regression-lock**), ≈232–236 `top_secret` still becomes `toi_mat` plus the token
(**RED-required, Q1/Q4**). Row **P5** (`test_ingest_label_floor.py` ≈12–13, ≈134–148) is still a
Q1/Q2 policy re-expression with `label:floor-invalid` regression-lock and `handling:restricted`
RED-required. **The corrected topology changes *why the decision matters*, not *what any assertion
must say*:** every one of these rows is about the **semantics** of the resolution functions, which the
measurement did not touch — what it changed is that those semantics now sit on a deployment-wired
path rather than an allegedly unwired one. **No range, class or pin is altered by this pass**, and
none is altered *unless* source demands it, which it does not. The accounting stays **five rows /
seven ranges / three files**, with **P1/N1/N2/N3** outside it.

### Q3 — Wire representation of `unresolved` — **recommended: A**

**Situation.** When the floor is fail-closed — under Q1 (iii) or the redesigned Q2 (ii) —
downstream consumers must be able to tell a *derived* `toi_mat` from a *source-declared*
`toi_mat`.

**Current R1 behaviour.** `LabelFloor.unresolved` is carried **in memory only**. The canonical
wire shape of the emitted **`label_floor`** block stays **exactly two keys** (`classification`,
`monitored_system`) — note this is the *outbound* `label_floor`, which shares its name with the
inbound ingest payload key but is a different position in the flow; the *inbound* correlation
input key is `labels` (§5.1.1). The signal leaves as a **tag** on the alert. R1's stated reason:
`pf-workers` / Alert Writer read those two keys, and adding a third key is a contract change.

**Option A — tag-only (R1).** Wire shape frozen; signal travels as a tag.
*Cost:* any consumer that reads `label_floor` but ignores tags silently loses the distinction.

**Option B — third key on `label_floor`.** Explicit, self-describing, survives tag truncation and
tag-namespace policy — but it **is** a change to the internal correlated envelope
(`CORRELATED_ENVELOPE_VERSION = "cybrik-correlated-2"`) and needs its own compatibility handling
for every downstream reader.

**Why this must be a Founder answer.** Option B touches an envelope contract; that is above the
R2 writer's authority under contract-first rules.

**Scope boundary — Q3 is the wire only.** Q3 says nothing about how `unresolved` is carried
**inside** the process, between `_label_of_event`, the correlation window state, and
`engine.py`. That is **Q6**, and it is a genuinely separate decision: under Q3 = A the internal
carrier is invisible to every contract reader, which is exactly why it can be chosen on
maintainability grounds — and exactly why nobody outside this packet will catch a bad choice.

**Recommendation: A, preselected.** Q3 = A keeps the R2 lane out of the envelope contract
entirely, which is the only shape compatible with contract-first. Q3 = A is **only viable if Q4
delivers a tag that actually survives to the reader** — a tag-only signal that is dropped in the
searchable projection is not a signal. That dependency is why Q4 changes below.

### Q4 — Tag namespace **and exact token** — **recommended: `label:` / `label:unresolved-floor`**

> **Revised in the R2 remediation pass.** The previous Q4 presented `marking:` (R1's choice) as a
> live candidate and `handling:` as the alternative. Both are now rejected on the record, for
> reasons the earlier text did not surface: a suite contract named `marking` has been **accepted**,
> and the `marking:` prefix is **dropped** by the adapter rather than merely "outside" it.

**Situation.** R1 introduced the literal tag **`marking:floor-unresolved`** for the fail-closed
path, used identically on the ingest path (`source_labels.py::apply_label`) and the correlation
path (`correlation.py::DerivedAlert.canonical()`).

#### Q4.1 Disclosure — a `marking` contract is already **accepted** at suite level

Verified read-only in this worktree (class **S**), at
`contracts/json-schema/cybrik.data-marking.v1.schema.json`:

| Property | Value |
|---|---|
| Contract | `cybrik.data-marking.v1` — *"CYBRIK data marking v1"* |
| `x-cybrik-status` | **`ACCEPTED FOR IMPLEMENTATION`** (`x-cybrik-not-accepted: false`) |
| `x-cybrik-contract-version` | `0.1.0` — accepted, **not** stable v1/GA |
| Required fields | `classification`, `tlp` |
| All fields | `classification`, `tlp`, `handling[]`, **`origin_marking`** |
| `classification` enum | `public` · `internal` · `confidential` · `restricted` (`cybrik.common-defs.v1.schema.json`) |
| `tlp` enum | `TLP:CLEAR` · `TLP:GREEN` · `TLP:AMBER` · `TLP:AMBER+STRICT` · `TLP:RED` |
| `handling[]` | *"Additional handling caveats (vendor-neutral tokens), e.g. `no-export`, `pii`, `legal-hold`."* |
| `origin_marking` | *"Optional opaque source-native marking preserved for provenance (e.g. a product-local sensitivity label), **carried without reinterpretation**."* |
| `additionalProperties` | **`false`** — the accepted object is closed. QD-13 cannot ride along as an extra property; `origin_marking` is the only opening. |
| Compatibility note in the description | *"the SOC canonical Alert/Case/Audit tables do not yet carry a TLP/classification field; a three-level sensitivity marking exists only in the SOC UEBA module. Mapping SOC objects into this marking is a forward requirement recorded in the compatibility manifest."* |

Three consequences the R2 writer must internalise:

1. **QD-13 is a different axis.** The accepted contract's `classification` enum
   (`public`/`internal`/`confidential`/`restricted`) is **disjoint** from the QD-13 scale
   (`khong_mat`/`mat`/`toi_mat`). They are not two spellings of one thing and must never be
   cross-mapped by the R2 writer. QD-13 is, in the accepted contract's own terms, precisely *"a
   product-local sensitivity label"* — i.e. the thing `origin_marking` exists to carry.
2. **`origin_marking` is the accepted forward path, and it is out of scope here.** Should QD-13
   ever need to travel across a contract boundary, `origin_marking` is where it belongs, *carried
   without reinterpretation* — and because the object is `additionalProperties: false`, it is the
   **only** opening; there is no legal way to bolt QD-13 on as an extra field. The contract's own
   compatibility note already frames this as a *forward* requirement ("mapping SOC objects into
   this marking"), i.e. not yet done. The R2 lane does **not** populate it, does not touch the
   contract, and must not be read as a step toward doing so. Recording the field here is
   disclosure, not authorization; that work is Phase 5 territory and needs its own grant.
3. **The word `marking` is spoken for.** The contract description also notes the envelope
   `marking` scalar is *"only a filtering copy of this"*. `marking` is therefore an
   accepted, contract-owned term at suite level.

#### Q4.2 `marking:` is REJECTED — two independent grounds

- **Mechanical — the tag is dropped, not merely uncollected.** `datalake/es_adapter.py` collects
  tags with prefixes `("label:", "system:", "handling:")` into the searchable `labels` field —
  a SOC-side measurement first taken by the **original** pass and **re-measured from source by the
  R2 final read-only review** (class **R**), which also confirmed that `label:unresolved-floor` is
  in fact collected by it (§Q4.6, O-1). A
  `marking:`-prefixed tag matches none of them and is therefore **dropped from the searchable
  projection**. Under Q3 = A the tag *is* the entire signal, so `marking:` produces a fail-closed
  path whose unresolved marker cannot be retrieved in datalake search — the signal is emitted and
  then discarded. The earlier packet framed this as a safety property ("outside all three
  collected prefixes"); it is equally a **retrieval defect**, and under Q3 = A the defect
  dominates.
- **Semantic — it squats an accepted contract's namespace on the wrong axis.** Minting
  `marking:*` inside SOC for a QD-13 resolution state collides with `cybrik.data-marking.v1`. A
  later integrator reading `marking:floor-unresolved` would reasonably take it as a statement
  about the accepted marking (classification × TLP) when it is a statement about QD-13. The R2
  writer has no authority to reserve a namespace whose name the suite has already accepted for a
  different contract.

**Therefore: `marking:` must not be reserved and must not be used.** This is a change from R1.

#### Q4.3 `handling:` is REJECTED

`handling` is a **first-class field of the accepted contract** — an array of vendor-neutral
handling *caveats* (`no-export`, `pii`, `legal-hold`). Using `handling:` as the tag prefix for an
internal QD-13 resolution state would (a) conflate an accepted caveat vocabulary with a SOC-local
processing state, and (b) do so *inside* the searchable projection, since `handling:` **is**
collected by the adapter — i.e. it imports the conflation into search results under a
contract-owned name. Rejected.

#### Q4.4 `label:` is RECOMMENDED, with one exact token

**Namespace: `label:`.** It is already collected by `es_adapter.py`, so the tag survives into the
searchable `labels` field and Q3 = A remains a real signal rather than a discarded one. It is
already the SOC-internal QD-13 sensitivity namespace, so the tag sits with the axis it actually
describes. And it is **not** a name the accepted marking contract owns, so nothing is conflated
with `cybrik.data-marking.v1`.

**Exact proposed token: `label:unresolved-floor`.**

Rationale for this exact string rather than R1's `floor-unresolved` suffix: `unresolved-` first
groups this token with any future `label:unresolved-*` resolution states under one sortable,
greppable prefix, and reads as a state (*the floor is unresolved*) rather than as an object. One
token, used **identically** on both emit sites (`apply_label` and `DerivedAlert.canonical()`) —
divergence between the two is the defect class this slice exists to close.

##### Q4.4.1 The vocabulary that is **already occupied** (class **R**, source-derived at `d3aaf6f`)

> **Added in the R2 collateral-and-vocabulary remediation.** Q4 previously chose a token without
> ever stating what the namespace already contains. Choosing a name in a space you have not
> enumerated is how a "new" token turns out to be a second spelling of an existing one.

Measured from source at `services/api/src/cybrik_soc/modules/ingest/source_labels.py:207–217` —
the tag-emitting body of `apply_label` — the relevant occupied vocabulary at `d3aaf6f` is:

| Existing token | Meaning at `d3aaf6f` |
|---|---|
| **`label:config-invalid`** | the **connector-side** label configuration could not be parsed or is not a legal QD-13 value — a defect in server-held config, not in the inbound payload |
| **`label:floor-invalid`** | the **inbound raw payload floor is defective** — either it could not be parsed or shaped, **or** it parsed to a valid classification but carried a **defective auxiliary field** (e.g. a junk `monitored_system`). A *payload-layer defect* diagnostic, emitted where the raw `label_floor` block is read. It is **not** limited to classification parse failure, and it fires in cases where `label:unresolved-floor` does **not** (§6.1) |
| **`label:{level}`** | the effective QD-13 level, one of the scale values (`khong_mat` / `mat` / `toi_mat`) |
| **`system:{…}`** | monitored-system provenance for that level |
| **`handling:restricted`** | the handling caveat that the existing `apply_label` contract already emits on the restricted paths |

This enumeration is **class R** — read from SOC source by the final independent review and carried
here verbatim. It is the measured occupancy of the space Q4 is choosing in, and it is the reason
§Q4.4.2 exists at all: `label:floor-invalid` is close enough in subject matter to
`label:unresolved-floor` that their relationship must be **decided**, not left to the writer.

##### Q4.4.2 Decided relationship: **COEXISTENCE** — not supersession, not mutual exclusion

> **Path-qualified in the R2 prose-collateral-and-path-distinction remediation.** The "may appear
> without `label:floor-invalid`" bullet below was written path-blind. It is true on the
> **correlation** path and **false on the ingest** path, where the parser marks a present-unmappable
> payload `invalid` and the two tokens coexist (§6.1.1). The qualification is added below and
> mirrored in §8.3 test 6, the §11 legend and the §12 verification log. **COEXISTENCE itself is
> unchanged**, and no emitted-tag outcome changes anywhere.

`label:unresolved-floor` does **not** replace, deprecate, or exclude `label:floor-invalid`. The
two are deliberately distinct and are **not** duplicate spellings of one fact:

| Token | What it asserts | Layer |
|---|---|---|
| **`label:floor-invalid`** | the **raw payload floor is defective** — it could not be parsed or shaped, **or** a valid classification arrived with a **defective auxiliary field**. A backward-compatible *payload-layer defect diagnostic* about the bytes that arrived | **payload/parse** |
| **`label:unresolved-floor`** | the **present asserted floor/label could not be mapped and the record was therefore fail-closed** — a *policy/audit marker* about what the system decided to do | **policy/decision** |

Binding consequences:

- **For a malformed raw ingest floor, both are emitted — each exactly once — together with the
  fail-closed QD-13 level `label:toi_mat` and `handling:restricted`** where the existing
  `apply_label` contract entails it. Four facts, four tokens, no deduplication of one into the
  other and no duplication of either.
- **For present-unmappable paths on the CORRELATION path only** — a label that is present,
  well-formed and simply outside the QD-13 scale, read by `_label_of_event` off `event['labels']`
  **directly, before any policy resolution**, where **no payload-layer defect diagnostic exists** —
  `label:unresolved-floor` may appear **without** `label:floor-invalid`. The absence of the defect
  diagnostic there is correct, not a defect in itself: nothing failed to parse and no auxiliary
  field was defective.
  **This does NOT hold on the INGEST path, and the qualification is binding.** On ingest, a
  present, well-formed, out-of-scale value never reaches policy as itself:
  `resolve_payload_floor`'s `label not in LABELS` guard marks the payload `invalid = True` and
  returns `classification = None` (§6.1, §6.1.1), so the payload-layer defect diagnostic **does**
  exist and **`label:floor-invalid` coexists** with `label:unresolved-floor` there — exactly as it
  does for a malformed block. **On ingest the two tokens are emitted together for both Q1 (iii) and
  Q2 (ii); the without-`floor-invalid` shape is correlation-only.** Any unqualified statement
  elsewhere that present-unmappable emits the new token alone is to be read with this
  path-qualification attached.
- **The converse also holds, and is the case the packet previously left unstated.** A payload whose
  `classification` is present, well-formed **and mappable**, but whose **auxiliary** field is
  defective, emits `label:floor-invalid` **without** `label:unresolved-floor` and **without** any
  fail-closed escalation. A defective auxiliary field is a payload-layer defect, not a failure to
  resolve the classification. The derivation boundary that makes this precise is **§6.1**.
- **Backward compatibility is preserved.** Any existing consumer, dashboard or query keyed on
  `label:floor-invalid` keeps working unchanged. Q4 adds a token; it removes none.
- **Neither implies the other, and neither may be derived from the other.** A writer that emits
  only one of the pair on the malformed-raw-ingest path, or that treats `label:floor-invalid` as
  superseded and stops emitting it, has changed committed behaviour outside its authority — that
  is a stop, not a cleanup.
- **`label:config-invalid` is untouched.** It describes server-held connector config, a different
  subject from both tokens above, and no Q1–Q6 answer changes when it is emitted.

This relationship is what §8.3 test 6 pins executably.

#### Q4.5 The clearance-gate hazard — measured, and resolved SAFE

`label:` is the recommended namespace precisely *because* it is collected — and that is also its
one hazard, which must be stated rather than glossed:
`datalake/search.py::forbidden_label_tags(clearance)` compiles `label:*` tags into the clearance
`must_not` gate. Putting the unresolved signal under `label:` hands it to that gate. Exactly one
of two behaviours holds, and only one is safe:

- **(i) Closed enumeration — SAFE. This is what the source does** (class **R**, measured from
  `datalake/search.py` by the R2 final read-only review; see O-3 below).
  `forbidden_label_tags` enumerates a *known, closed* set of QD-13 sensitivity tokens per
  clearance and emits only those into `must_not`. An unknown token such as `unresolved-floor`
  appears in no clearance's forbidden list, so it is **never** a `must_not` term: the tag is
  indexed, is searchable, and **changes clearance for nobody**. The record's visibility continues
  to be governed solely by its actual QD-13 `label:` level.
- **(ii) Open/negated derivation — UNSAFE. This is *not* what the source does.**
  `forbidden_label_tags` would derive forbidden terms by negation (e.g. "every `label:` token not
  permitted at this clearance"). An unknown
  `label:unresolved-floor` would then land in `must_not` for some or all clearances and would
  **hide exactly the records the signal exists to surface** — a silent retrieval loss and an
  unannounced clearance change, which is the worst possible failure for a fail-closed marker.
  It is recorded here because it is the failure mode the executable check in §8.3 test 6b exists
  to catch if the function ever changes, not because it describes the base.

**Resolution.** Case **(i)** holds at `d3aaf6f`. `label:unresolved-floor` is not part of any
clearance's `must_not` enumeration and therefore changes visibility for no clearance. The
hazard is real in principle and is now **closed by measurement**, not by assumption — and it stays
closed only as long as the enumeration stays closed, which is precisely what test 6b (§8.3) pins
executably rather than by hard-coding a prefix string.

#### Q4.6 Token legality, collision and clearance — **discharged SAFE** (class **R**)

> **Changed in the R2 focused remediation.** This subsection previously recorded three **open
> obligations** (class **O**) that the R2 writer would have had to discharge from source, together
> with a pre-authorized underscore substitution held in reserve against O-1. The independent R2
> final read-only review — which, unlike either remediation pass, held read access to
> `cybrik-soc-command-center` — measured all three from source. **All three came back SAFE for the
> exact token `label:unresolved-floor`.** The obligations are therefore discharged, the class **O**
> list is empty (header provenance table), and **the underscore fallback is withdrawn** — see the
> paragraph below for why keeping it would now be harmful rather than merely redundant.

| # | Check | Source read | Result |
|---|---|---|---|
| **O-1** | Hyphens are legal in a tag body at `d3aaf6f` — at both emit sites (`ingest/source_labels.py::apply_label`, `siem/correlation.py::DerivedAlert.canonical()`), through any tag validation/normalisation, and through collection in `datalake/es_adapter.py`. Truncation, precisely: the token is **22 characters** (`label:` = 6 + a 16-character body), well inside the 64-character limit, so the bare token cannot be truncated; the live question was whether the 64-character rule is applied to some *composed* or prefixed form at either emit site. | `ingest/source_labels.py`, `siem/correlation.py`, `datalake/es_adapter.py` | **SAFE.** The hyphen is legal at both emit sites and survives normalisation; the token is collected into the searchable `labels` projection by `es_adapter.py`; no composed form brings it near the 64-character truncation. `label:unresolved-floor` is emitted and retrievable **as written**. |
| **O-2** | Collision check: no existing tag anywhere in SOC uses the literal `label:unresolved-floor`, nor any `label:unresolved*` prefix, nor any token that `forbidden_label_tags` would confuse with it. | SOC source | **SAFE — and now stated against the measured occupancy.** No collision. The occupied vocabulary at `ingest/source_labels.py:207–217` is `label:config-invalid`, `label:floor-invalid`, `label:{level}`, `system:{…}`, `handling:restricted` (§Q4.4.1); the `label:unresolved*` prefix space is **unused** at `d3aaf6f`, so the token is free and the `unresolved-` grouping rationale in §Q4.4 holds. **Collision-freedom is not the same claim as absence of semantic overlap, and O-2 makes only the first.** `label:floor-invalid` is adjacent in subject matter — it is not a collision (different literal, different prefix body, no `forbidden_label_tags` confusion), but the two tokens do describe related facts at different layers. That overlap is not a defect to be eliminated; it is **resolved by decision** in §Q4.4.2 as **COEXISTENCE**, which O-2 neither establishes nor is weakened by. |
| **O-3** | `forbidden_label_tags` behaviour on an unknown `label:` token is case **(i)** per §Q4.5 — closed enumeration. | `datalake/search.py` | **SAFE.** Closed enumeration. `label:unresolved-floor` is in no clearance's forbidden list and is therefore never a `must_not` term; it changes clearance for nobody. |

**The exact stable token is `label:unresolved-floor`, unconditionally.** There is no second
spelling, no conditional form, and **no pre-authorized substitution**. The underscore variant
`label:unresolved_floor` is **withdrawn from this packet** — from the §11 ballot, from the §8.3
test expectations, and from every pre-authorization. Its only purpose was to give the writer a
mechanical answer to an O-1 failure that has now been measured not to occur; leaving it in place
would offer a live alternative spelling for a question that is closed, which is exactly how two
spellings of one token end up in a codebase.

**The writer does not re-litigate these three, but it does check for drift.** If the base it
actually opens is not `d3aaf6f`, or if any of the three measured properties above fails to hold
at the base it opens, that is a **stop** (§8.6 item 9) — the coordinator re-scopes. Stop-on-drift
is not the same as an open obligation: nothing here is unanswered, and no §6 answer is
conditional.

**Why this must still be a Founder/coordinator answer.** Tag namespaces are cross-cutting — the
datalake clearance gate, retention, RBAC and the UI all pattern-match on prefixes — and this
answer additionally records that `marking:` is *not* reserved for SOC use, which is a suite-level
statement about an accepted contract's name. The writer cannot make that call.

### Q5 — Bootstrap convergence now, or a separate Alert Writer lane? — **recommended: B**

**Situation, with the revision boundary made explicit (corrected by the eighth pass).**
`_converge_label_floor_enforce` is an **R1 / historical-proposed** behaviour, described here as
such: it **mutates the `config` of an already-existing** internal Alert Writer connector —
absent-or-`null` flag → set to `True`; already `True` → no-op; any other value (including `False`,
`1`, `"true"`) → `ValueError` — and adds `label_floor_enforce_converged` to the audit meta.

> **Revision reconciliation, and it is load-bearing.** That description belongs to the **R1 attempt's
> revision of `connector/bootstrap.py`, not to the packet base.** Measured directly at
> **`d3aaf6f`** — the sole base for every SOC source decision in this packet — the file
> `services/api/src/cybrik_soc/modules/connector/bootstrap.py` contains **no `label_floor_enforce`
> and no `FLOOR_ENFORCE_FLAG` occurrence at all**; `ensure_internal_alert_writer_connector` (line
> **67**) writes only `config={"description": _INTERNAL_CONFIG_DESCRIPTION}` (line **98**). **So the
> current base has no automatic and no bootstrap convergence implementation**, and the §5.0 claim
> that current M2 *writes `True`* is **removed as false**. Every statement about
> `_converge_label_floor_enforce` in this section is **historical / proposed**, tied to the R1
> revision, and is **never** current runtime status.

**What is true at the base instead.** The flag is settable — but through the **control plane**, not
through convergence: `connector/api.py::validate_lc_config` allowlists `label_floor_enforce` (95) and
boolean-validates it (110–112), and both create (≈178–181) and update (≈198–201) validators invoke
it. **Manual/API configuration remains possible, and it is not convergence.** Convergence means
*automatic reconciliation of persisted rows toward a desired state*; an operator setting a field
through an authorized API call is ordinary configuration. Q5 governs the former only.

**Q5 is a question about M2 only.** Neither answer touches surfaces **A**, **B**, **C** or **D**
(§5.0), and neither is needed to make surface **B** settable. What Q5 decides is whether a
convergence implementation — which **does not exist at this base** and would have to be written —
belongs in this lane.

**Option A — include convergence in the R2 lane** (as R1 did).
*Cost:* the QD-13 lane now owns a data-mutating operational behaviour and a fail-closed
`ValueError` on existing rows, with real-PG evidence obligations (§8.5) that are wider than the
pure label logic — and it mixes an operational step **that does not exist at this base** into a lane
that already spans **four** surfaces with distinct statuses (§5.0), so a single evidence run has to
speak to all of them at once.
It also means the lane that decides the fail-closed policy is the same lane that turns it on,
which is precisely the pairing Q2's NO-GO on Candidate B says must be looked at carefully.

**Option B — split it into a separate Alert Writer lane. `RECOMMENDED`**
R2 ships **only** the label-resolution logic (`source_labels.py`, `correlation.py`, `engine.py`
+ their tests); connector convergence, its audit trail, and its runtime wiring become their own
bounded lane with their own grant.

*Cost — corrected three times, and now stated at the measured **four**-surface topology.* The
original text said B leaves the floor *"unenforced in any deployment"*; that blanket claim was
withdrawn. Its replacement said B still ships *"a live behaviour change"* across all five files
including `correlation.py` and `engine.py`, and that the correlation reading *"takes effect on
deploy"*; that was withdrawn in turn as resting on the retired M1 grouping. **The seventh pass's
third version — "on surface C the correlation/engine reading is *not runtime-wired* and takes effect
on *no* deployment until a separate lane wires it — a reviewer may say exactly that" — is
HISTORICAL, WRONG, SUPERSEDED BY THE EIGHTH REMEDIATION.** It is false at `d3aaf6f`. Precisely:

- **What Q5 = B removes:** connector bootstrap convergence, and nothing else. Allowlist entries
  4 and 8 drop; entries 1–3 and 5–7 remain.
- **What Q5 = B does *not* remove:** the label-resolution logic on **any** surface. Under B the
  R2 lane still edits `ingest/source_labels.py`, `siem/correlation.py` and `siem/engine.py`; the
  ingest edits sit behind **code-reachable callers** — `ingest/service.py`, `ingest/pf_bridge.py`
  and `ingest/source_health_worker.py` (§5.1) — and the correlation edits sit on a
  **deployment-wired worker path** whose input is already produced (§5.1.2). **B is not a no-op lane
  and must not be presented to reviewers as one.**
- **But the deploy effect is not uniform, and B must not be oversold either.** On surface **A**
  connector-label application is code-reachable and ungated, and Q1–Q4 do not change it. On surface
  **B** the call sites are reachable but the payload floor is `None` until a tenant's connector
  carries the exact boolean `True` — **nothing automatically assigns that flag, though an authorized
  connector create/update API call can set it** (§5.2). On surface **C** the PF normalizer
  synthesizes a `labels` block on every normalized document and the matcher forwards it. On surface
  **D** the correlation/engine reading is **source-implemented and deployment-wired** through the
  packaged, compose-declared `pf-correlation` worker (§5.1.2), so a Phase-2 change to it **can affect
  that worker on a deployment that runs the service** — while remaining **excluded from the mounted
  SIEM HTTP API**. **What a reviewer may *not* say is that it is unwired or produces no deploy
  effect; what a reviewer may equally not say is that any instance is currently running or
  production-observed.**
- **The residual B actually leaves,** stated at its true scope: the payload `label_floor`
  enforcement stays **operator-driven** — `payload_floor_for` returns `None` until
  `label_floor_enforce` is the exact boolean `True` on the connector, and **no automatic assignment
  exists**, though the control plane can set it. That gap must keep being disclosed until the
  separate Alert Writer lane lands — using the **four-way** citable wording in §5.2, not any
  withdrawn blanket claim in either direction.

**Recommendation: B, preselected.** A persisted-data mutation with a `ValueError` on existing
tenant rows does not belong in a lane scoped as label hardening, and B keeps the R2 evidence
burden matched to what R2 actually changes. The cost of B is a disclosure obligation, not an
enforcement gap — and, with surface B feature-gated off by default, keeping the enabling step in its
own lane is also what stops the R2 lane from being read as switching enforcement on. **That argument
no longer leans on any claim that the correlation path is unwired** — it is not.

**Why this must be a Founder answer.** Option A puts a persisted-data mutation inside a lane
scoped as label hardening; Option B is honest about scope but leaves a disclosed gap. Either way
the answer determines whether allowlist entries 4 and 8 (§2.1) stay in the R2 lane at all.

### Q6 — Internal carrier for the unresolved signal — **recommended: A**

> **Added in the R2 focused remediation.** The independent review found that this packet decided
> the *wire* shape (Q3) and the *tag token* (Q4) but never decided what
> `correlation.py::_label_of_event` **returns in process** once it has to carry `unresolved`
> alongside `classification` and `monitored_system`. That is not a detail the writer may settle by
> itself: it fixes what the §8.2 committed-test edits must look like, and an unspecified shape is
> in practice a decision in favour of whatever is cheapest to type.

**Situation.** At `d3aaf6f`, `_label_of_event` returns the two label facts it reads off the event
`labels` block, and correlation/engine unpack them positionally; the committed tests in
`test_siem_correlation.py` assert against that shape by **tuple equality** (§8.2). Under Q1 and
the redesigned Q2 the function must additionally carry a third fact — **whether the level was
fail-closed rather than source-declared**. Something must carry it from `_label_of_event` into the
correlation window state, and from there into `engine.py`. Q3 = A says that fact does **not** get
a wire key; it says nothing about how the fact travels internally, and the internal hop is where
it can be silently lost.

**Why the shape is a decision and not an implementation detail.** `unresolved` is a *safety* fact:
it is the only thing distinguishing a derived `toi_mat` from a source-declared one. A carrier that
lets it be dropped by a positional mistake — an unpack that takes two of three elements, a
call site not updated, a `_` placeholder — fails silently and in the safe-looking direction, since
the level still looks correct. The choice also propagates: it is what tests 7–9 (§8.3) assert
against, and what the §8.2 edits to committed assertions have to be rewritten into.

**Option A — an immutable typed value object, carried end-to-end. `RECOMMENDED · PRESELECTED FOR COORDINATOR REVIEW`**

> **Expanded in the R2 driver-taxonomy-and-carrier-chain remediation — from a reader-only answer to
> the full internal chain.** Q6 = A previously fixed only what `_label_of_event` **returns**. That
> left the rest of the hop undecided: how the fact enters the correlation **window state**, how it
> reaches the **internal** floor value, and how it becomes the tag. Those are exactly what §8.3
> tests **8** and **9** assert against, so leaving them open handed the shape to the writer by
> default — the precise failure Q6 was added to prevent. The five steps below are now part of the
> answer, and the carrier shape is **not** left undecided anywhere along the chain. **Q3 is
> untouched by this expansion:** step 4 keeps the wire at exactly two keys.

`_label_of_event` returns a single **immutable typed carrier** — a frozen dataclass (or the
codebase's equivalent value-object idiom) named **`_EventLabelReading`**, module-private to
`siem/correlation.py`, with exactly three named fields:

| Field | Meaning |
|---|---|
| `classification` | the resolved QD-13 level (`khong_mat` / `mat` / `toi_mat`), per Q1 and Q2 |
| `monitored_system` | the monitored-system provenance of that level, or absent — never fabricated (§8.3 test 4) |
| `unresolved` | whether the level was **fail-closed** (Q1 (iii) or Q2 (ii)) rather than source-declared |

Correlation and engine consume it **by attribute name, explicitly** — `reading.unresolved`, not
`reading[2]` and not `_, _, unresolved = ...`. Immutability is part of the choice, not decoration:
the window's accumulated unresolved state must never self-clear (§8.3 test 9), and a carrier that
cannot be mutated in place cannot be cleared by accident on a later contributor.

**The decided carrier chain — five steps, all inside Q6 = A.** The unresolved fact travels from the
reader to the tag through exactly these hops and no others. This is the answer, not a sketch of one:

| # | Hop | Decision |
|---|---|---|
| **1** | **`_label_of_event` → its return value** | the immutable typed **`_EventLabelReading`** above — `classification`, `monitored_system`, `unresolved` — consumed **by attribute name**, never positionally. |
| **2** | **reading → correlation window state** | the correlation group state (**`_GroupState`**) gains **`label_unresolved: bool = False`**. It accumulates by **monotonic OR** over **every accepted contributor** — conceptually `state.label_unresolved = state.label_unresolved or reading.unresolved`. It **never self-clears**: not on a later well-formed or valid contributor, and not on eviction of the entry that set it. This is the same lifecycle-wide monotonic discipline the floor **level** already follows, and it is precisely what §8.3 tests **8** and **9** assert. |
| **3** | **window state → internal floor value** | the internal frozen **`LabelFloor`** gains **`unresolved: bool = False`** as a **DEFAULTED internal field**, and **`effective_label_floor()`** carries the group's accumulated bool into it. **The `False` default is binding, not incidental:** every existing 2- and 3-argument construction of `LabelFloor`, and every committed equality against one — including the pin **N2** at `test_siem_correlation.py` ≈509–512 (§8.2.1) — stays valid and passing **because** the field defaults. A writer that makes it required has broken a committed equality it has no authority to edit (§8.6 item **10d**). |
| **4** | **internal floor → the wire, and the tag** | **`LabelFloor.to_canonical()` under Q3 = A continues emitting EXACTLY the two current keys** — `classification` and `monitored_system`. It does **not** expose `unresolved` on the wire; that is the entire content of Q3 = A, and step 3 must not leak into it. **`DerivedAlert.canonical()` emits the exact tag `label:unresolved-floor` when the internal `floor.unresolved` is true**, and only then. The tag is the signal; the wire shape stays frozen. |
| **5** | **the direct-engine path** | where a `LabelFloor` is constructed from a **single reading** rather than from an accumulated window, it is constructed with **`reading.unresolved`**. Absent and valid readings therefore carry `unresolved = False` **by the value they actually hold**, not by omission. |

**Naming latitude, bounded — and it does not reopen the shape.** The field and helper names above
(`_GroupState.label_unresolved`, `LabelFloor.unresolved`, `effective_label_floor()`,
`to_canonical()`) may be replaced by **codebase-equivalent private names** at the base actually
opened, **only if the semantics, the `False` default, the monotonic-OR accumulation and the wire
behaviour are identical**. What is **not** available is leaving the carrier shape undecided at any
step: a writer that reaches step 2 or step 3 without one of them has hit a stop (§8.6 item **10d**),
not a design choice.

*Cost, stated plainly:* it is a mechanical but non-trivial edit surface. Every unpack site moves
to attribute access, and the committed **tuple-equality** assertions in `test_siem_correlation.py`
stop compiling against the new return value — which is exactly the collateral §8.2 row **P2b**
pre-authorizes by content. **That Q6-forced collateral is narrower than earlier revisions of this
packet claimed:** rows **P3** and **P4** are **policy** re-expressions driven by Q1 = A / Q2 = A,
not shape edits driven by Q6, and **P4 carries no tuple-shaped expectation at all** (§8.2).

**Option B — a positional 3-tuple. `DOCUMENTED ALTERNATIVE — NOT RECOMMENDED`**

Extend the existing return to a third positional element. Nothing new is defined and the committed
tests need the smallest possible edit.

*Why it is not recommended:* the third element is the safety fact, and a positional third element
is the single easiest thing in the language to drop. Every unpack site must be updated in lockstep,
a two-element unpack of a three-element tuple raises only where it happens to be unpacked, and a
`_` placeholder discards the signal with no error at all. The saving is a few lines of test churn;
the exposure is the silent loss of the only marker that distinguishes derived from declared
`toi_mat`. **B is documented as a real alternative the coordinator may select, not as a straw
option** — but the shape must be *selected*, either way.

**Steps 2–5 of the chain bind under B as well.** Only step 1 changes: the reader returns a
positional 3-tuple instead of a named carrier. The group state still accumulates by **monotonic
OR** and still never self-clears; the internal `LabelFloor` still gains a **defaulted-`False`**
`unresolved` field so the ≈509–512 equality (**N2**) keeps passing; `to_canonical()` still emits
exactly two keys; `DerivedAlert.canonical()` still emits the exact token off the internal flag; and
the direct-engine path still passes the reading's third element. Selecting B buys a smaller test
edit at step 1 and changes nothing downstream — which is why B's exposure is the silent drop at the
unpack site, not a different architecture.

**Why this must be a Founder/coordinator answer.** The shape is not visible at any contract
boundary (Q3 = A keeps it off the wire), so no contract review will ever catch a bad choice; it
determines the content of the pre-authorized edits to committed tests (§8.2); and it is the
carrier of the fail-closed marker, which makes it a safety decision rather than a style one.

**Recommendation: A, preselected.** Named fields on an immutable carrier make dropping the
`unresolved` fact a visible error rather than a silent one, and make the accumulate-never-clear
rule (test 9) structurally supported instead of merely tested. **What Q6 = A now fixes** is the
whole chain: the three-field immutable reading consumed by name; a `_GroupState` bool accumulated
by monotonic OR that never self-clears; a defaulted-`False` `unresolved` field on the internal
`LabelFloor` fed by `effective_label_floor()`; a `to_canonical()` that still emits exactly two
keys and a `DerivedAlert.canonical()` that emits the exact token off the internal flag; and a
direct-engine construction that passes `reading.unresolved`. **What is explicitly not decided
here:** the carrier's exact decorators, field ordering, whether it gains convenience helpers, and
the private *names* of the group bool and the internal field — codebase-equivalent private names
are allowed where semantics, default, accumulation and wire behaviour are identical. Those are
writer choices *within* Q6 = A; the shape itself is not one of them.

### 6.1 Coordinator decision — the **ingest-side parser carrier does not change** (no `PayloadFloor` arity change, no §8.2 row P6)

> **Added in the R2 classification-and-carrier remediation.** Proposed tests 1, 2, 3b and 3c were
> written as if `ingest/source_labels.py::resolve_payload_floor` would grow an `unresolved` field —
> i.e. as if the **ingest** side needed the same carrier change Q6 decides for the **correlation**
> side. It does not, and the two sides are not symmetric: Q6 exists because the correlation
> reader's return value is the *only* hop on which the fail-closed fact can travel, whereas on the
> ingest side the fact is **derivable** from what the parser already returns. This subsection
> records the decision so the writer cannot improvise an arity change, and so no reviewer reads the
> retargeted tests as a weakening.
>
> **Corrected in the R2 prose-collateral-and-path-distinction remediation.** The derivation table
> below previously listed a "`classification` is not `None` but does not map onto the QD-13 scale"
> state as if it were an **ingest** state. It is not: `resolve_payload_floor` collapses Q1 (iii)
> and Q2 (ii) into one `(invalid = True, classification = None)` state, so that branch is
> **unreachable on ingest** and exists **only on the correlation path** (§6.1.1). The table, the
> policy-rule bullets and the reachability claim are corrected below, and the `LABELS` guard is
> recorded as a **crash-prevention** constraint rather than a normalization choice. **No outcome
> changes**, the parser arity is still unchanged, and there is still no row **P6**.

**Decided: `PayloadFloor` stays exactly as committed — a three-field parser carrier.** Its fields
remain `classification`, `system`, `invalid`. **No `unresolved` field is added to it**, its arity
does not change, and the committed integration equality at
`services/api/tests/unit/test_ingest_label_floor.py` **≈ line 355**, which asserts against that
exact three-field shape, **stays unchanged and stays passing**. That equality is a **pin** — a
regression-lock obligation, recorded as row **N1** in §8.2.1 — **not** an authorized collateral
edit, and it contributes **no** range to the §8.2 accounting. Consequently **no §8.2 row `P6`
exists**: a writer that finds itself wanting one has hit a stop (§8.6 item 10c), not a task.

**Why no fourth parser field is needed — the derivation boundary, stated explicitly.** The raw
parser already distinguishes the payload-layer states the policy layer has to tell apart, using the
pair `(invalid, classification)`. **This table is the INGEST path only** — the correlation path
does not go through `resolve_payload_floor` at all (see the subsection below):

| Ingest payload-layer state | `invalid` | `classification` |
|---|---|---|
| **Absent** — no `label_floor` block at all | `False` | `None` |
| **Present, but the asserted classification could not be resolved** — covers **both** Q2 (ii) *malformed* (block not a mapping, or `classification` non-string / empty / whitespace-only) **and** Q1 (iii) *present, well-formed, out-of-scale/unmappable* (e.g. `"tuyet_mat"`). These two are **intentionally parser-indistinguishable** after `resolve_payload_floor`. | `True` | `None` |
| **Valid, in-scale classification, but a defective auxiliary field** (e.g. a junk `monitored_system`) | `True` | **not** `None` |

**There is no fourth ingest row, and specifically no reachable state with `classification`
non-`None` and outside `LABELS`** (class **R**, fourth review). `resolve_payload_floor` guards with
`label not in LABELS` and, on that branch, returns `invalid = True` with `classification = None` —
so an out-of-scale asserted value lands in the **same** row as a malformed one and routes through
the **same** policy branch. Earlier revisions of this subsection listed a separate
"`classification is not None` but does not map onto the QD-13 scale" bullet as if it were an ingest
state; **that bullet is withdrawn from the ingest derivation** and re-sited below as a
correlation-path fact.

**Why the guard must not be weakened to make that branch reachable** (class **R**, fourth review).
`ingest/source_labels.py::label_rank` **raises `ValueError`** on an out-of-scale input. The
`label not in LABELS` guard in `resolve_payload_floor` is therefore a **correctness /
crash-prevention constraint**, not a stylistic normalization step: removing or loosening it to let
an unmappable string travel onward as a non-`None` `classification` would push that string into
`label_rank` and turn a marked, fail-closed record into an **unhandled exception** on the ingest
call path — **surface B**, whose call sites in `service.py` and `pf_bridge.py` are live and whose
guarded code executes as soon as a tenant carries `label_floor_enforce = True` (§5.0, §5.1).
**Weakening that guard to make a conceptual branch reachable is a stop, not a refactor**
(§8.6 item 10c). The conceptual distinction between Q1 (iii) and Q2 (ii) is preserved
where it belongs — in the *questions* and in the *correlation* path — not by degrading the parser.

**This costs nothing in outcome.** Q1 = A and Q2 = A give both cases the *same* ingest result:
fail closed to `toi_mat`, emit `label:unresolved-floor`, retain `label:floor-invalid`. The two
questions remain separately answerable — a coordinator who answered Q1 = A and Q2 = B, or the
reverse, would force the ingest parser to distinguish them, and **that** is when this collapse
would have to be revisited. Under the recommended answers it does not.

The policy layer consumes that context. Its rule follows from Q1 and Q2 with no new parser field:

- `invalid = True` **and** `classification is None` → the asserted classification could not be
  resolved — **either** Q2 case (ii) *malformed* **or** Q1 case (iii) *out-of-scale/unmappable*,
  and on this path the two are not told apart → fail closed to `toi_mat`, emit
  `label:unresolved-floor`, and retain `label:floor-invalid`. **Both questions route here, and the
  outcome each mandates is the same one.**
- `classification is not None`, is **in scale**, and `invalid = True` only because an **auxiliary**
  field is defective → **not** classification-unresolved. This case is a `label:floor-invalid`
  **diagnostic and nothing more**: **no** fail-closed escalation and **no**
  `label:unresolved-floor`. A defective auxiliary field is a payload-layer defect, not a failure to
  resolve the classification; conflating the two would inflate marking on a class of records
  neither Q1 nor Q2 decided about.
- `invalid = False` **and** `classification is None` → **absent** → **Q2 case (i)**: rank-0
  `khong_mat`, **no** unresolved signal.

This is why the `label:floor-invalid` gloss reads *raw parse/shape failure **or** defective
auxiliary field* throughout this packet (§Q4.4.1, §Q4.4.2, §11): it is a payload-layer defect
marker with a **wider** trigger than classification parse failure alone, and it fires in cases
where `label:unresolved-floor` must **not**.

#### 6.1.1 The "present but unmappable" branch is **CORRELATION-path-only**

The state *"`classification` is present and non-`None` but does not map onto the QD-13 scale"* is
real — but it exists **only on the correlation path**, and the reason is structural:
`siem/correlation.py::_label_of_event` reads `event['labels']` **directly**, before any policy
resolution. Nothing normalizes, validates, or nulls the value first, so the unmappable string
arrives at the policy decision **intact and non-`None`**. On the ingest path the equivalent value
has already been collapsed to `classification = None` by `resolve_payload_floor`'s
`label not in LABELS` guard before any policy code sees it. Hence:

| Path | Present, well-formed, out-of-scale value (Q1 (iii)) reaches policy as | Distinguishable from Q2 (ii) malformed? |
|---|---|---|
| **Ingest** (`resolve_payload_floor` → `effective_labels` / `apply_label`) | `invalid = True`, `classification = None` — the original string is gone | **No.** Intentionally collapsed; same policy branch, same outcome |
| **Correlation** (`_label_of_event`, reading `event['labels']` directly) | the **original unmappable string**, non-`None` | **Yes.** The reader still holds the value it could not map |

**Binding consequences for the writer:**

- A Phase-1 **ingest** test (§8.3 group A) must not assert that the ingest layer distinguishes
  Q1 (iii) from Q2 (ii) at the parser, and must not require the original unmappable string to be
  recoverable downstream. Tests 1 and 2 assert the Q1 **outcome** at the policy layer, which is
  reachable; asserting the *provenance* of that outcome is not.
- §8.3 test **3c** — the (i)/(ii) discrimination — is a discrimination between **absent** and
  **present-and-unresolvable**, i.e. between the first and second rows of the ingest table above.
  It is **not** a discrimination between malformed and unmappable, which the ingest path does not
  make.
- A writer that concludes the ingest path *must* tell Q1 (iii) from Q2 (ii) has hit **§8.6 item
  10c**: it stops and reports rather than weakening the `LABELS` guard or adding a parser field.

**Where the unresolved fact is observable on the ingest side.** Not on the parser return value —
at the **policy layer**: the effective label produced by `effective_labels` / `apply_label`, and
the emitted tag set. That is where §8.3 tests 1, 2, 3b, 3c and 3d assert, and it is the correct
target independently of this decision: the parser's shape is a private implementation detail no
consumer reads, whereas the effective label and the tags are what ingest actually produces.

**Deliberately not specified here.** The exact Phase-2 layout inside the policy layer — helper
names, whether the derivation lives in one function or several, intermediate locals, ordering,
field naming beyond the three committed parser fields — is a **writer choice within this
decision**. This packet fixes three things and no more: (a) `PayloadFloor` keeps its committed
three fields and the ≈355 equality keeps passing; (b) the derivation boundary in the table above;
(c) the assertion target is the policy-layer observable. Anything beyond that is
over-specification and is **not** decided here.

**Parser shape stays regression-compatible, and that is a Phase-2 obligation.** Because nothing
about the parser's shape changes, **Phase 2 can pass without any edit to
`test_ingest_label_floor.py` outside row P5's two ranges** (§8.2). If that turns out not to hold at
the base actually opened, it is base drift and a **stop** (§8.6 items 10b and 10c) — never a
licence for the writer to widen the authorization on its own.

---

## 7. Phase split — what is authorized now, and what is held

| Phase | Content | Gate |
|---|---|---|
| **Phase 0** | **This packet. Docs-only, now.** Ground-truth record + the §6 questions, in `cybrik-suite` only. | **Authorized and complete** — the only phase this session performs. |
| **Phase 1** | **Evidence phase** in the R2 lane — **test files only, allowlist entries 5–7 ONLY, under every Q5 answer.** **Entry 8 (`test_alert_writer_bootstrap.py`) is never a Phase-1 path.** Under **Q5 = A** entry 8 stays in the lane, but its tests are the **Phase 3** integration group (§8.3 group **D**, tests 15–22) and are written in Phase 3, not here; under **Q5 = B** entry 8 leaves the lane entirely (§6/Q5). **There is no Phase-1 integration test under either answer** — which is also what §8.1 (no RED-required test traces to Q5) and §8.5 (real-PG evidence is Phase 2 onward only) say. The earlier "entries 5–7, plus 8 only if Q5 = A" wording is **withdrawn**. Adds new tests **and edits existing committed assertions and committed invariant prose** at the **seven** ranges named in §8.2 (rows **P2, P2b, P3, P4, P5**), **in all three of entries 5, 6 and 7** — entry 5 is *additive plus row P5*, not additive-only. Rows **P1**, **N1**, **N2** and **N3** are **not** edits: they are verification-only no-edit preflight pins (§8.2.1). Each test is classified **RED-required** or **regression-lock** (§8.1). Focused unit runs, **no `--cov`** (§8.4). | **EXECUTED AND COMPLETE (§13.2).** The gate discharged: Q1–Q6 were **answered** by the coordinator (§13.1), Phase 1 was written against those answers at SOC base `d3aaf6f`, and the run reported **242 collected / 95 RED-required failed / 44 of 44 regression-lock nodes passed / 103 pre-existing nodes passed / 0 errors**, with the exact **95-node manifest** and **44-node lock roster** published and an **independent semantic review returning PASS (P0 = P1 = P2 = 0)**. ⚠ **Historical gate text below, retained verbatim and NO LONGER current truth:** **HELD on Q1–Q4 and Q6.** The test names and assertions *are* the policy; writing them before the answers would silently ratify R1's choices. **Q6 is a Phase-1 gate specifically because the §8.2 committed-test edits cannot be written without it** — the authorized **tuple-equality** re-expression in row **P2b** is a direct consequence of the carrier shape, the whole Q6 completeness rule on **P2** depends on it, the **N2** pin at ≈509–512 holds only because Q6 = A's internal field defaults to `False`, the **N3** pin at ≈533–535 holds only because that same field never reaches `to_canonical()` (Q3 = A, Q6 step 4), and the **P1** import preflight is checked *against* that shape. **Q1/Q2/Q4 gate the three policy rows P3, P4 and P5:** the `test_ingest_label_floor.py` bytes at ≈12–13 / ≈134–148 (**P5**), the mixed absent / non-string-invalid window block at `test_siem_correlation.py` ≈484–491 (**P3**), and the `top_secret` present-unmappable half of `test_siem_engine.py` ≈232–236 (**P4**) all encode the *superseded* policy, and re-expressing any of them requires knowing the decided outcome and the decided tag vocabulary (§Q4.4.2). **Q1/Q2 additionally gate the committed `TestLabelFloorHelper` docstring at `test_siem_correlation.py` ≈409–410 inside row P2's ≈408–422 range** — it states the superseded junk/absent → `DEFAULT` `khong_mat` rule in prose and cannot be rewritten without the decided outcome. |
| **Phase 2** | **GREEN source** — `ingest/source_labels.py` (path 1) + `siem/correlation.py` (path 2) + `siem/engine.py` (path 3), minimal to pass Phase 1. | **GRANTED, EXECUTED, and COMPLETE/ADMITTED for the bounded local six-path lane ONLY (§13.3–§13.6).** The §7.1 grant was **issued explicitly**, naming exactly source paths **1–3**, after the independent semantic review of the published RED bytes. Phase 2 then ran: **242/242 focused PASS**, **ruff PASS**, and an **independent GREEN review returning PASS (P0 = P1 = P2 = 0, P3 = 3 nonblocking)**. **`COMPLETE` is bounded by §13.6:** it is **NOT** accepted, integrated, canonical, pushed, merged or released, and it makes **no runtime or deployment observation**. ⚠ **Historical gate text below, retained verbatim and NO LONGER current truth:** **HELD. Does NOT auto-open on Phase-1 RED.** Requires a **separate explicit coordinator decision and grant**, issued after an **independent review of the exact RED bytes** — see §7.1. |
| **Phase 3** | **Bootstrap convergence** — `connector/bootstrap.py` (path 4) + `test_alert_writer_bootstrap.py` (path 8). **This is the only phase in which §8.3 group D (tests 15–22) is written**, and only under Q5 = A. | **OUT OF THE R2 LANE — Q5 is ANSWERED `B` (§13.1, §13.7).** Bootstrap convergence is **not** in this R2 lane and was **not** performed: it requires a **separate Alert Writer lane with its own grant**, and allowlist entries **4** and **8** are dropped from R2. Nothing in §13 opens it. ⚠ **Historical gate text below, retained verbatim and NO LONGER current truth:** **HELD on Q5.** Under the recommended **Q5 = B** this phase **leaves the R2 lane entirely** and allowlist entries 4 and 8 are dropped; it becomes a separate Alert Writer lane with its own grant. Under **Q5 = A** it stays in the lane but stays **behind the §7.1 grant and strict phase ordering** — entry 8 is never touched in Phase 1. |
| **Phase 4** | **Re-vendoring / alert-context binding.** | **HELD on acceptance and integration of the corrected C1/G1 chain** (`20cfa36` → `7185739`). Not reachable today (§4). |
| **Phase 5** | **Real canonical marking** — authoritative marking model, marking **profile**, **PostgreSQL migration**, **RLS** policy changes; and any population of the accepted contract's `origin_marking` (§Q4.1). | **SEPARATE lane, separately gated.** Explicitly **out of scope** for R2. MARK-001 Option A does **not** authorize migrations (§3.1), and the gate definitions are not yet citable (§3.2). |

**Phase ordering is strict.** No phase may be started to "get ahead" while an earlier one is
held. In particular: no Phase-2 source byte before the §7.1 grant exists, and no Phase-3 byte
before Q5 is answered. **Including test bytes:** writing a §8.3 group D integration test during
Phase 1 is a Phase-3 byte written early, and is a §8.6 item 1 stop under Q5 = B (entry 8 is off
the allowlist) and a §8.6 item 4 stop under Q5 = A (Phase 3 is held behind the same grant).

**Ordering as executed (§13):** Phase 1 completed and reported first; the §7.1 grant was issued
**after** the independent review of the published RED bytes; only then were source paths 1–3
touched. **Q5 = B**, so **no Phase-3 byte was written at all** and entries 4 and 8 were never
opened. Phases 4 and 5 remain untouched and behind their own separate gates.

### 7.1 Phase 2 does **not** auto-open — the separate grant

> **Changed in the R2 remediation pass.** Phase 2 previously read *"Opens only after Phase 1 is
> written and observed RED"* — i.e. it opened on a condition the writer evaluated about its own
> work. That is withdrawn. A writer that both authors the RED and judges the RED is unreviewed.

Observing Phase-1 RED is **necessary and not sufficient**. Source paths **1–3**
(`ingest/source_labels.py`, `siem/correlation.py`, `siem/engine.py`) stay closed until **all** of
the following hold:

1. Phase 1 is complete and the writer has **stopped**, reported, and made no source edit.
2. The writer has published the **exact RED bytes**: for every RED-required test, the verbatim
   failing output — test node id, assertion line, expected vs actual — plus the exact `pytest`
   invocation and the commit the run was made at. Summaries, counts, and paraphrases are not the
   bytes and do not satisfy this.
3. Regression-lock tests are reported separately, with their pass status, so the two classes are
   never merged into one number (§8.1).
4. An **independent review** of those bytes has been performed — by a reviewer who did not author
   them — confirming each RED-required failure is genuine (the assertion is non-vacuous and the
   failure is the *intended* failure, not an import error, fixture error, collection error, or
   typo).
5. The **coordinator issues an explicit written grant** naming Phase 2 and the source paths it
   opens. The grant is a distinct decision from the Q1–Q6 answers; answering Q1–Q6 opens Phase 1
   and nothing further. **This is unchanged by Q6**: Q6 = A names an internal source construct
   (`_EventLabelReading`), and naming it in this packet does **not** authorize creating it. It is
   defined in `siem/correlation.py`, which is source path 2, and stays behind this grant.

Absent item 5, the writer stops after Phase 1 and reports. It does not begin Phase 2, does not
prepare Phase-2 edits "ready to apply", and does not treat a green review comment as a grant.

> **DISCHARGED — see §13.2/§13.3.** All five conditions were satisfied in order: the writer stopped
> after Phase 1 with no source edit (1); the exact **95-node RED manifest** was published (2); the
> **44-node regression-lock roster** was reported separately with its pass status (3); an
> **independent semantic review** of those bytes returned **PASS (P0 = P1 = P2 = 0)** (4); and the
> **coordinator issued an explicit §7.1 grant naming exactly source paths 1, 2 and 3** (5). The
> conditions above are retained unchanged as the standing rule for any future grant; **this
> discharge is specific to that one grant and extends to no other path, phase or lane.**

---

## 8. Future evidence requirements (for the writer that R2 eventually opens)

**None of this is a claim. Nothing below has been run.** This session executed no test, started
no stack, and touched no database. This section specifies what a future writer must produce
*before* any status may move.

### 8.1 Test classification — RED-required vs regression-lock

> **Changed in the R2 remediation pass.** The previous §8.1 applied a blanket rule: everything in
> Phase 1 had to fail on arrival, and *"a test that passes on arrival is not evidence"*. That is
> withdrawn. It is wrong for the substantial part of Phase 1 whose job is to **pin behaviour that
> already exists and must not drift** — MAX-monotonicity, the literal-`True`-only flag rule, tag
> budget and truncation. Forcing those into RED would mean deliberately writing them against
> semantics nobody intends to ship.

Every Phase-1 test — new **or edited** — carries exactly one class, declared in the test's own
docstring and repeated in the Phase-1 report:

| Class | Meaning | Expected on arrival, against the **unmodified** `d3aaf6f` tree | If it does the opposite |
|---|---|---|---|
| **RED-required** | Encodes behaviour that does **not** exist at the base — a Q1–Q4 or Q6 decision being newly implemented. | **FAILS.** | **STOP** (§8.6). A RED-required test that passes on arrival means the behaviour already existed, the assertion is vacuous, or the test is mis-targeted. None of the three is evidence. |
| **Regression-lock** | Encodes behaviour that **already** exists at the base and must survive the Phase-2 change unchanged. | **PASSES.** Passing *is* the point. | **STOP.** A regression-lock that fails on arrival means the base is not what this packet describes; the writer reports the discrepancy rather than "fixing" the test to match. |

Rules:

- **There is no blanket "every added or changed test must fail" rule.** The only failure
  obligation is on tests the writer has classified **RED-required**.
- **The stop is one-directional per class.** Stop if a RED-required test passes on arrival; stop
  if a regression-lock test fails on arrival. Both are reported, neither is worked around.
- **Classification is declared before the run, not after.** A test may not be reclassified once
  its arrival result is known — that would let any surprise be relabelled into compliance. If the
  writer believes a classification was wrong, it stops and reports the disagreement.
- **The two classes are reported separately** — counts, node ids and outcomes never merged into a
  single pass/fail number.
- **An assertion about the *absence* of the new token is regression-lock, never RED-required.**
  `label:unresolved-floor` does not exist at `d3aaf6f`, so any assertion of the form "this path
  does **not** emit it", "it is **not** in `forbidden_label_tags`", or "the absent-block case
  carries **no** unresolved signal" **passes on arrival** — trivially at the base, meaningfully
  after Phase 2. Classifying such an assertion RED-required guarantees a §8.6 item 3 stop for a
  test that is behaving correctly. These assertions are still worth writing: their value is that
  they **keep** passing once the token exists, which is exactly the regression-lock contract.
  This rule is what reclassifies §8.3 test **6b**, and it governs the negative halves of tests 3a,
  3c, 3d, 10b and 14b — **and, in §8.2, row P2's `unresolved is False` assertion on the absent
  case**, which is an absence assertion about the new signal and is therefore regression-lock,
  while every `unresolved is True` assertion in that same range is RED-required.
  **It equally governs the split inside row P4:** the absent-label test at ≈227–230 keeps
  `khong_mat` with **no** unresolved signal and is **regression-lock**, while the `top_secret`
  present-unmappable test at ≈232–236 in the same range flips to fail-closed `toi_mat` **plus** the
  unresolved tag and is **RED-required (Q1, Q4)**. A row may therefore carry both classes, and the
  Phase-1 report keeps them separate per test rather than per row.
- **A class follows the outcome, not the mechanism.** An edit forced by a *shape* change over
  unchanged policy is regression-lock for every fact it re-expresses; an edit whose *outcome*
  changes is RED-required and must name the question that changed it. This is the rule the packet
  mis-applied to rows **P3** and **P4**, which were described as Q6-forced shape edits when their
  outcomes are decided by **Q2** and **Q1** respectively (§8.2). `P2b` is the only row whose edit is
  purely a shape change over unchanged policy.
  The mirror of it also binds: an expectation that the base does **not** produce today — including
  `handling:restricted` on the malformed / present-unmappable floor path, which the base does not
  emit because it keeps the connector-supplied label — is **RED-required**, and mislabelling it
  regression-lock produces the opposite stop.
- **Every RED-required test must trace to a specific answered question** (Q1, Q2, Q3, Q4 or Q6).
  A RED-required test that traces to no answered question is out of scope for Phase 1. Q5 is
  deliberately absent from that list: under the recommended Q5 = B there is no test in the R2 lane
  that traces to it, and under Q5 = A its tests are the Phase-3 integration group (§8.3 group D),
  not Phase 1.
- **A collection or import error is never a RED.** §7.1 item 4 disqualifies it explicitly. This
  matters for Q6: the carrier type is a **Phase-2 source construct**, so a Phase-1 test that
  imports it by name at module level would turn the whole file into a collection error and destroy
  the evidence value of every other test in it, including the regression-locks. §8.2.1 row **P1**
  carries that prohibition as a standing no-edit invariant.

### 8.2 Authorized edits to **existing committed assertions**

> **Added in the R2 remediation pass.** Phase 1 was previously described as if it only added
> tests. It cannot be: assertions already committed at `d3aaf6f` currently lock the
> **pre-decision** behaviour. Left intact, they would fail the moment Phase 2 implements Q1/Q2 —
> and a writer with no authority to touch them would be forced either to stop or to quietly work
> around them.
>
> **Extended in the R2 focused remediation.** The table below previously listed three assertion
> ranges and stopped there. The independent review established (class **R**) that those three are
> not the whole collateral: **Q6 = A additionally forces edits that are not assertion edits at
> all** — the module-level import, the valid-label **tuple-equality** assertions, and the closing
> brace of the block that the second range stops one line short of. A writer given the old table
> would hit a §8.2 condition-4 stop on mechanically necessary collateral, or — worse — would
> conclude the packet meant it to weaken the assertions instead. Both are now closed by naming the
> collateral explicitly and **by content**.
>
> **Extended again in the R2 collateral-and-vocabulary remediation.** The table below covered only
> `test_siem_correlation.py` and `test_siem_engine.py`, and condition 4 stated positively that
> `test_ingest_label_floor.py` carried **no** authorized edit and was **additive only**. The final
> independent review measured that file from source and found the claim **false at `d3aaf6f`**: it
> already commits assertions encoding the *superseded* pre-decision floor policy, which Q1 = A /
> Q2 = A directly contradict. Row **P5** below authorizes them by content, and every additive-only
> statement about entry 5 is withdrawn throughout this packet. **Phase 1 on path 5 is additive
> *plus* the exact authorized collateral in P5** — not additive only.
>
> **Corrected in the R2 classification-and-carrier remediation.** The table below previously opened
> with a row **P1** authorizing a "compatibility edit" to the `test_siem_correlation.py` import at
> ≈17. The third independent review measured that import from source: it **already** binds
> `_label_of_event` correctly, so there is **nothing to edit**. An authorization for an edit that
> does not exist is not harmless — it inflates the accounting, and it invites a writer to touch a
> correct line to justify the row. **P1 is withdrawn from the authorized-edit table** and recorded
> instead in **§8.2.1** as a verification-only, no-edit preflight, with its binding
> `_EventLabelReading` prohibition preserved verbatim. §8.2.1 also records the new pin **N1** —
> the committed three-field `PayloadFloor` equality at `test_ingest_label_floor.py` ≈355, which
> §6.1 decides must remain unchanged and passing. **Neither P1 nor N1 is an authorized edit and
> neither contributes a range to the accounting**, which is recomputed accordingly.
>
> **Widened in the R2 prose-collateral-and-path-distinction remediation — without changing the
> count.** Row **P2**'s range started at ≈412 and so excluded `TestLabelFloorHelper`'s committed
> **docstring at ≈408–410** (class **R**, fourth review), which states the superseded junk/absent →
> `DEFAULT` `khong_mat` rule in prose. That is committed invariant prose in exactly the sense P5's
> ≈12–13 docstring is, and leaving it outside the authorization would have forced the writer either
> to leave the file self-contradictory or to hit a condition-4 stop on a line the packet never
> named. **P2's single contiguous range is widened to ≈408–422.** It is still **one** range, so the
> accounting stays **five rows / seven ranges / three files** — nothing is added to or removed from
> the count. The same pass also gives **P2** the explicit **Q6 completeness rule** that P2b already
> carried, so the `unresolved` fact cannot be left unasserted on any edited case.
>
> **Re-driven in the R2 driver-taxonomy-and-carrier-chain remediation — again without changing the
> count.** The table below described rows **P3** and **P4** as *compatibility updates mechanically
> forced by Q6*. Both descriptions are **withdrawn as wrong about the driver**, and with them every
> operative claim that P3/P4 policy is unchanged or that P4 carries a tuple-shaped expectation.
> **P3** (`test_siem_correlation.py` ≈484–491) covers a window mixing an **absent** contributor with
> a **non-string invalid** contributor (class **R**, fifth review): under **Q2 = A** the accepted
> invalid contributor fails closed, so the block's derived classification becomes **`toi_mat`** and
> the unresolved tag/state is **present** — a **policy re-expression**, RED-required on the changed
> outcome. Its **closing-delimiter authorization at ≈491 is preserved verbatim**, now as the
> syntactic consequence of a policy edit rather than of a shape edit. **P4** (`test_siem_engine.py`
> ≈227–236) is a **MIXED policy row** holding two tests: the absent-label case at ≈227–230 is
> **unchanged and regression-lock**, and the `top_secret` present-unmappable case at ≈232–236 flips
> to fail-closed `toi_mat` plus the unresolved tag and is **RED-required (Q1, Q4)**. **P4 is not
> tuple-shaped and Q6 forces no mechanical shape edit on it.** **`P2b` is now the only pure Q6
> shape-compatibility row**; P2 stays mixed. The same pass makes P2's anchor precise — **≈408 is the
> class declaration, ≈409–410 the committed docstring**, range unchanged at ≈408–422 — and records
> the committed `LabelFloor("khong_mat", None)` equality at **≈509–512** as the no-edit pin **N2**
> (§8.2.1). **The accounting is again unchanged at five rows / seven ranges / three files.**

**Phase 1 is explicitly authorized to edit the existing committed assertions and the collateral
listed below**, in files already on the allowlist (§2.1). The authorization stays inside allowlist
entries **5–7** (`test_ingest_label_floor.py`, `test_siem_correlation.py`, `test_siem_engine.py`)
and **adds no path**; entry 8 is unaffected and, under **either** Q5 answer, is **not a Phase-1
path at all** (§7). This authorization is bounded to these files, ranges and contents — **five rows
(P2, P2b, P3, P4, P5) across seven approximate ranges in three files** (P2b names two ranges, P5
names two; P2, P3 and P4 name one each — **P2's single range is ≈408–422**, widened at its start by
the fifth remediation and still exactly one range). **Rows P1, N1, N2 and N3 are not in this
count** — they are no-edit invariants (§8.2.1) — and **there is no row P6** (§6.1). Where a range contains
**committed invariant prose** — P2's docstring at **≈409–410** (under the class declaration at
≈408) and P5's at ≈12–13 — that prose is inside the authorization and carries the same
rewrite-in-full and verbatim-evidence obligations as an assertion:

| # | File | Approximate range at `d3aaf6f` | What is there | Authorized action |
|---|---|---|---|---|
| **P2** | `services/api/tests/unit/test_siem_correlation.py` | **≈ lines 408–422** — **one contiguous range** (widened from ≈412–422 by the fifth remediation; still a single range, so the accounting is unchanged) | Two things, and the range covers both — **named precisely by the sixth remediation** (class **R**, fifth review): **≈408 is the `TestLabelFloorHelper` class declaration** and the committed **docstring itself is ≈409–410**; the earlier phrasing calling the whole ≈408–410 span "the docstring" is withdrawn as imprecise, and **the authorized range is unchanged at ≈408–422**. **(a) ≈408–410 — the class declaration plus its committed docstring** (class **R**, fourth review), the docstring stating in prose that **junk or absent labels resolve to the `DEFAULT` `khong_mat`**. **(b) ≈412–422 — the committed assertions** over the correlation path's handling of event **`labels`**, encoding that same pre-decision rank-0 collapse. | Edit in place to the Q1/Q2 outcome. **The docstring at ≈409–410 is superseded invariant prose, not decoration** — it states the rule Q1 = A / Q2 = A withdraw, in the same binding sense as the assertions beneath it, and Q1 = A also breaks it for the *junk* half while Q2 = A preserves it for the *absent* half. It **must be rewritten to state the decided invariants with the same precision** — naming which inputs now fail closed to `toi_mat` with the unresolved signal and which stay at rank-0 `khong_mat` without it — and its **pre-edit and post-edit text must be reported verbatim** (condition 2), exactly as for P5's ≈12–13 docstring. The class declaration at ≈408 is inside the range as the anchor that resolves the docstring by content; **nothing about the class declaration itself is authorized to change** — renaming or re-scoping `TestLabelFloorHelper` is outside this row and a stop (condition 4). Leaving it stating the withdrawn rule while the assertions below it assert the decided one is a **stop**, not a cosmetic residue. **Q6 completeness rule — the same rule P2b carries, and it binds here too:** where these assertions read the label reader's return value, they are re-expressed **in full** against the Q6 carrier — every `classification` and `monitored_system` fact currently asserted is still asserted after the edit, none may be dropped, narrowed to one field, or softened to a truthiness/subset check — **and the `unresolved` fact is asserted explicitly in every case:** `unresolved is False` for the **absent** case (Q2 (i)), and `unresolved is True` for **each** present malformed / present-unmappable fail-closed case (Q2 (ii), Q1 (iii)). An edited case that asserts the new level but leaves `unresolved` unexamined is an incomplete re-expression and a **stop** (condition 3). Under **Q6 = B** the same completeness rule binds against the third positional element instead of a named field. Classify the edited assertion **RED-required** if it now encodes new behaviour — including every `unresolved is True` assertion and the fail-closed levels that accompany them (Q1, Q2, Q6); **regression-lock** if the edit is only a rename/key-precision change with unchanged semantics, and for the `unresolved is False` absent case, which is an absence assertion about the new signal (§8.1). |
| **P2b** | `services/api/tests/unit/test_siem_correlation.py` | **≈ lines 424–427** and **≈ lines 429–432** | the **valid-label tuple-equality** assertions — two adjacent blocks asserting that the label reader's return value equals a literal tuple for well-formed, mappable input | **Shape-compatibility edit required by Q6, not an assertion weakening.** Under Q6 = A the reader no longer returns a tuple, so `== (…, …)` compares a typed carrier against a tuple and fails on *type*, telling nobody anything about labelling. The authorized edit re-expresses **the same expectations, in full**, against the carrier's named fields (`reading.classification`, `reading.monitored_system`, and — newly — `reading.unresolved is False` for these valid cases). **Every fact currently asserted must still be asserted after the edit**, and the previously-implicit fact that a valid label is *not* unresolved becomes explicit. Dropping a field, replacing equality with a truthiness check, or narrowing to a single field is a **stop**, not a simplification. Classify **regression-lock** for the unchanged label facts, **RED-required** for the new `unresolved is False` assertion (it traces to Q6, and to Q1/Q2 for what `unresolved` means). Under **Q6 = B** this row still applies — the tuple grows a third element and the same completeness rule binds — but the edit is an arity change rather than a field-access change. |
| **P3** | `services/api/tests/unit/test_siem_correlation.py` | **≈ lines 484–491** | committed assertions over the **derived-alert emission path for a window that mixes an *absent* contributor with a *non-string invalid* contributor** (class **R**, fifth review), **through and including the closing brace/paren that terminates the block at ≈491** | **POLICY re-expression forced by Q2 = A — NOT a Q6 shape-compatibility edit.** The earlier description of this row as a "compatibility update mechanically forced by Q6" is **withdrawn**, as is every claim that its policy is unchanged. Under **Q2 = A** the **non-string invalid** contributor is an accepted contributor that **fails closed**: the block's derived classification therefore becomes the fail-closed **`toi_mat`**, and the **unresolved tag/state is present** on the emitted alert. The **absent** contributor in the same window continues to contribute rank-0 `khong_mat` with no unresolved signal (Q2 (i)), and under MAX-monotonic semantics does not lower the raised floor. **Classify by outcome, per test/assertion (§8.1):** **RED-required (Q2)** for the fail-closed `toi_mat` classification and for the presence of the unresolved state, **RED-required (Q4)** for the exact emitted token `label:unresolved-floor`, **regression-lock** for whatever the block asserts that the change does not touch — including the absent contributor's own rank-0 contribution and the MAX-monotonic ordering. Completeness binds as in P2: every fact currently asserted is still asserted after the edit; nothing is dropped, narrowed, or softened. **The closing-delimiter authorization is preserved verbatim:** the range deliberately includes the terminator at ≈491 — the earlier `≈484–490` stopped one line short of it, so an edit that changes the block's contents could not legally re-balance it, and the writer would face a condition-4 stop on a syntactic necessity. Editing the delimiter is authorized **only** to keep the block well-formed after an authorized content edit — never to enlarge, truncate, or re-scope the block. That authorization now follows from a **policy** edit rather than a shape edit; its scope is identical either way. |
| **P4** | `services/api/tests/unit/test_siem_engine.py` | **≈ lines 227–236** — **one contiguous range holding two committed tests** | **Two tests, and the range covers both** (class **R**, fifth review): **(a) ≈227–230 — the absent-label test**, asserting the engine threads an event with no `labels` block through to `khong_mat` with no unresolved signal; **(b) ≈232–236 — the `top_secret` present-unmappable test**, asserting the pre-decision handling of a present, well-formed, out-of-scale classification. **Neither is tuple-shaped.** | **MIXED POLICY row — NOT a Q6 shape-compatibility edit, and Q6 forces no mechanical shape edit here at all.** The earlier description of this row as a "compatibility update mechanically forced by Q6", and the claim that it carries a tuple-shaped expectation subject to P2b's completeness rule, are both **withdrawn as wrong at `d3aaf6f`**. The two halves are re-expressed differently: **(a) ≈227–230 is UNCHANGED in outcome** — under **Q2 = A** an absent `labels` block still resolves to rank-0 **`khong_mat`** with **no** unresolved signal. It is a **regression-lock** whose job is to prove Phase 2 did not inflate the absent path; if the writer finds no edit is needed there at all, **that is the correct result**, not an under-delivery. **(b) ≈232–236 CHANGES** — under **Q1 = A** the `top_secret` present-unmappable classification fails closed to **`toi_mat`** and the derived alert carries the **`label:unresolved-floor`** tag. **RED-required (Q1)** for the fail-closed level, **RED-required (Q4)** for the exact token. Completeness binds as in P2: every fact currently asserted in either test is still asserted after the edit. Where the engine reads the label reader's value it does so **by attribute** under Q6 = A — but that is a consequence of the Q6 = A carrier chain (§6/Q6 step 5), **not** a tuple-to-attribute conversion of a committed expectation in this range, because there is no tuple-shaped expectation here to convert. **If the writer finds a tuple-shaped expectation at ≈227–236, that is base drift and a stop** (§8.6 item 7), not a licence to apply P2b's rule here. |
| **P5** | `services/api/tests/unit/test_ingest_label_floor.py` | **≈ lines 12–13** (module/test **docstring invariants**) and **≈ lines 134–148** (the **parametrized** malformed/present-unmappable case group) | Committed bytes encoding the **superseded** pre-decision floor policy. Stated exactly: on a malformed or present-but-unmappable floor the current assertions require that the record **keeps the connector-supplied label** (no fail-closed escalation), that **`label:floor-invalid` is retained**, and that **every other `label:` tag is forbidden**. The docstring at ≈12–13 states those same invariants in prose, so it is committed policy text, not decoration. | **Full re-expression to the decided policy — authorized, and required.** Under **Q1 = A / Q2 = A** these exact cases must instead assert the **fail-closed classification `label:toi_mat`** plus **`label:unresolved-floor`**, **while retaining `label:floor-invalid`** as the payload-layer defect diagnostic — raw parse/shape failure **or** a defective auxiliary field (§Q4.4.1, §6.1) — under §Q4.4.2 COEXISTENCE, since the new token does **not** supersede it; and **`handling:restricted`** wherever the existing `apply_label` contract entails it for the resulting level. The forbid-every-other-`label:`-tag invariant is **re-expressed, not deleted**: it narrows to forbidding tags outside the decided emitted set, and the docstring at ≈12–13 is rewritten to state the new invariants with the same precision. **Completeness is binding:** every assertion currently present must be re-expressed in full — none may be deleted, commented out, `xfail`-ed, skipped, or softened to a truthiness/subset check (condition 3). **Preserve the parametrization and every case**: the parametrized structure stays parametrized, and no case is dropped, merged, or added unless an **exact coordinator decision** later says so. **The assertions target the policy-layer observable** — the effective label and the emitted tag set from `effective_labels` / `apply_label` — **not** the `PayloadFloor` return shape, which §6.1 decides does not change. **Classes, split by what the base actually does** (class **R**, third review): **RED-required (Q1, Q2, Q4)** for every assertion encoding the fail-closed `label:toi_mat` outcome or the new `label:unresolved-floor` token; **RED-required (Q1, Q2)** for the **`handling:restricted`** expectation on these malformed / present-unmappable cases — at `d3aaf6f` the record keeps the connector-supplied label and `handling:restricted` is **not** emitted on this path, so the new fail-closed `toi_mat` outcome is precisely what creates it, and classifying it regression-lock would produce a §8.6 item 3 stop; **regression-lock** for the **retained `label:floor-invalid`** expectation alone, which is existing behaviour being pinned across the change. |

**The row taxonomy, stated so no reviewer has to infer it — and corrected by the sixth
remediation.** Exactly one row is a pure shape edit; the other four change policy:

| Row | What drives the edit | What it is |
|---|---|---|
| **P2b** | **Q6 only** | **The one pure shape-compatibility row.** The reader stops returning a tuple, so `== (…, …)` compares a typed carrier against a tuple and fails on *type*. The policy those two blocks encode is **unchanged**: valid, mappable input still resolves to the label it declares. |
| **P2** | **Q1 / Q2 policy + committed prose + the Q6 completeness rule** | **Mixed, and the only row carrying all three obligations at once.** The assertions at ≈412–422 are a *policy* re-expression forced by Q1 = A / Q2 = A (like P5); the docstring at ≈409–410 is *committed invariant prose* stating that same superseded policy (like P5's ≈12–13); and wherever those assertions read the label reader's return value they are additionally subject to the *Q6 completeness rule* (like P2b). All three bind inside the one range. |
| **P3** | **Q2 policy** (Q4 for the token) | **Policy re-expression.** The block's non-string invalid contributor fails closed under Q2 = A, so the derived classification becomes `toi_mat` and the unresolved state is present. Q6 does not drive this row; the ≈491 delimiter authorization is the syntactic consequence of the policy edit. |
| **P4** | **Q1 policy** (Q4 for the token) | **Mixed-class policy row.** ≈227–230 (absent) is unchanged and regression-lock; ≈232–236 (`top_secret` present-unmappable) flips to fail-closed `toi_mat` plus the tag and is RED-required. **Not tuple-shaped; Q6 forces no shape edit here.** |
| **P5** | **Q1 / Q2 policy + Q4 vocabulary** | **Policy re-expression** of the ingest cases and their prose, in the direction Q1 = A / Q2 = A decide. |

**What every one of the five rows is *not*:** authorization to weaken, relax, delete, or soften
any assertion, or a licence to "simplify" a test that becomes awkward. Condition 3 below applies
to all of them in full: after the edit, every fact the committed assertion established must still
be established. For **P2b** the only sanctioned direction of change is *same expectations, new
shape* — plus one **added** expectation (`unresolved is False` on valid input) that the old tuple
shape could not express. For **P2, P3, P4 and P5** the direction is *same cases, same structure,
same completeness, decided outcome*: left intact, those assertions would not merely fail to
compile — they would **assert the superseded rule**, and a Phase-2 implementation of the
recommended answers would be reported as breaking them. In **P5** specifically,
`label:floor-invalid` is **retained** (regression-lock) and `handling:restricted` is **newly
asserted** (RED-required, Q1/Q2 — the base emits none on these cases), neither traded away for the
new token; condition 3 applies to P5 hardest. (The import at ≈17 was once listed as a
compatibility edit; it is not one — it is already correct, and it is the no-edit preflight **P1**
in §8.2.1, alongside the pins **N1**, **N2** and **N3**.)

Conditions on every such edit:

1. **Line ranges are approximate and are a locator, not a licence.** The writer resolves the
   actual assertion by content at `d3aaf6f`. If the content at a range is not what this table
   describes, that is a **stop** — the base has drifted from the packet and the coordinator
   re-scopes. This applies to **P2b, P3, P4 and P5** exactly as to P2, and to the §8.2.1 no-edit
   pins **P1, N1, N2 and N3** exactly as to the edit rows: all are recorded as class **R** from an
   independent review, and **none of these test-file anchors** was re-measured by any remediation
   pass — **including the eighth, which held SOC read access but measured topology, flag provenance,
   the PF producer chain and the Alert Writer envelope, not these committed test ranges.** This is a
   statement about **these anchors**, not a general claim that no pass held SOC access (§10
   provenance-posture bullet). **Content drift includes drift in
   what a range *is*:** if ≈484–491 does not mix an absent contributor with a non-string invalid
   one (**P3**), if ≈227–236 is not the absent-label and `top_secret` present-unmappable pair
   (**P4**), or if either turns out to carry a tuple-shaped expectation, the writer stops rather
   than re-deriving the driver on its own authority.
2. **Record before/after verbatim.** Every edited assertion **and every edited committed invariant
   prose/docstring** is reported with its exact text at `d3aaf6f` and its exact replacement text,
   plus one sentence naming the question (Q1/Q2/Q3/Q4/Q6) that forced the change. **This includes
   both docstrings:** P5's at ≈12–13 and **P2's `TestLabelFloorHelper` docstring at ≈409–410**
   (under the class declaration at ≈408, inside P2's ≈408–422).
   Both are committed invariants and are evidenced exactly like any assertion — a Phase-1 report
   that shows an assertion diff but summarizes a docstring change in prose has not met this
   condition.
3. **No deletion of coverage.** An assertion — **or a committed invariant stated in prose** — may
   be *changed* to encode the decided behaviour; it
   may not be deleted, commented out, `xfail`-ed, or skipped to make a run green. Removing a case
   entirely requires a coordinator decision. **For the Q6-forced collateral — row `P2b`, the one
   pure shape row, plus the Q6 completeness rule inside `P2` — this is the operative constraint:**
   a shape change that also drops an expectation is a coverage deletion wearing a compatibility
   edit's clothes, and is a stop. **For the policy rows `P3`, `P4` and `P5` the operative
   constraint is the same sentence read the other way:** re-shaping the assertions while leaving
   the superseded outcome in place is not a re-expression either (§8.6 item 8).
4. **No edits outside the five authorized rows P2, P2b, P3, P4, P5** — **seven approximate
   ranges**, since P2b and P5 each name two — in the **three** named files
   (`test_ingest_label_floor.py`, `test_siem_correlation.py`, `test_siem_engine.py`), and no
   edits to an existing assertion **or to committed invariant prose/docstring** in any other file,
   without a separate grant. Editing an existing assertion **or committed invariant docstring**
   anywhere else is a stop. **The §8.2.1 invariants P1, N1, N2 and N3 are not edit authorizations**
   and must not be read as extending this count; touching any of those four lines is a stop.
   **`test_ingest_label_floor.py` (entry 5) does carry authorized edits to committed assertions —
   row P5.** Its Phase-1 work is **additive plus P5**, and the earlier "additive only" description
   of it is withdrawn as factually wrong at `d3aaf6f`. The authorization on entry 5 is bounded to
   P5's two ranges; any other committed assertion in that file remains untouchable.
5. **Test files only.** This authorization does not open a single source byte; Phase 2 remains
   gated on §7.1.

### 8.2.1 No-edit invariants — verification-only preflight (**P1**, **N1**, **N2**, **N3**)

> **Added in the R2 classification-and-carrier remediation.** Two committed lines matter to this
> lane and **neither is an authorized edit**. Recording them here rather than in the §8.2 table
> keeps the accounting honest — an authorization for an edit nobody needs both inflates the count
> and tempts a writer to touch a correct line to justify its row.
>
> **Extended by the R2 driver-taxonomy-and-carrier-chain remediation.** A **third** committed line
> belongs in this class and was never pinned: the `LabelFloor("khong_mat", None)` equality at
> `test_siem_correlation.py` **≈509–512** (class **R**, fifth review). It sits **outside** every
> §8.2 range, and it stays unchanged and passing **only because** the internal `unresolved` field
> Q6 = A adds to `LabelFloor` **defaults to `False`** (§6/Q6 step 3). Left unpinned, a writer could
> make the field required, break this equality, and then find itself editing a line no row
> authorizes. It is recorded as **N2**, and §8.6 item **10d** is the stop that fires if the line
> would need an edit or the default is lost. **The accounting is unchanged: N2 contributes no
> range, and the count stays five rows / seven ranges / three files.**
>
> **Extended again by the R2 runtime-topology remediation.** A **fourth** committed line belongs in
> this class and was likewise never pinned: the **exact-key-set assertion on the canonical
> `label_floor` block** at `test_siem_correlation.py` **≈533–535** (class **R**, sixth review). It
> is the committed executable form of **Q3 = A** and of **§6/Q6 step 4** — the guarantee that
> `to_canonical()` emits exactly `classification` and `monitored_system` and nothing else. It
> **remains unchanged and passing** under the decided answers, precisely because Q6's `unresolved`
> field is internal and never reaches the wire. Left unpinned, a writer that leaked the field into
> `to_canonical()` would break it and then find itself editing a line no row authorizes. It is
> recorded as **N3**, and §8.6 item **10d(d)** is the stop that fires if it would need an edit.
> **N3 is not an authorized edit**, contributes **no** range, and **does not change the five-row /
> seven-range / three-file accounting.**

All four rows below are **verified, not edited**. The writer confirms each against the base it
opens, reports the result in the Phase-1 report, and **makes no change to any of those lines**.
None contributes a range to the §8.2 count of **five rows / seven ranges / three files**.

| # | File · locator | What is there | Obligation |
|---|---|---|---|
| **P1** | `services/api/tests/unit/test_siem_correlation.py` · **≈ line 17** | the module-level **import** binding the `siem.correlation` symbols this file exercises. Class **R**, third review: it **already** binds the label reader under its real name **`_label_of_event`** (§5.1.1) — the name is correct at `d3aaf6f` and there is nothing to correct. | **Verification only — no edit.** Confirm the import binds `_label_of_event` and that the module imports cleanly against the **unmodified** base. If it does, the writer changes nothing and records the confirmation. If it does not, that is base drift and a **stop** (§8.6 item 7), not a licence to edit. **Binding prohibition, preserved verbatim from the withdrawn P1 edit row:** the Q6 carrier type **`_EventLabelReading` does not exist at `d3aaf6f`** — it is a Phase-2 source construct. Adding it to this import in Phase 1 turns the entire file into a **collection error**, which §8.1 and §7.1 item 4 disqualify as evidence and §8.6 item 20 makes a stop. The carrier name is added to this import in **Phase 2 only**, under the §7.1 grant, as part of the GREEN change. |
| **N1** | `services/api/tests/unit/test_ingest_label_floor.py` · **≈ line 355** | the committed integration **equality against the three-field `PayloadFloor`** (`classification`, `system`, `invalid`). Class **R**, third review. | **Regression-lock pin — unchanged and passing, in both phases.** §6.1 decides that `PayloadFloor` keeps exactly these three fields and that **no `unresolved` field is added**, so this equality must survive Phase 1 and Phase 2 **untouched** and **green**. It is a **pin, not an authorized collateral edit**: it is outside P5's two ranges, and §8.2 condition 4 therefore forbids editing it. A writer that concludes Phase 2 requires changing this equality, or the parser's arity, has hit **§8.6 item 10c** — it stops and the coordinator re-scopes; it does **not** create a row P6. |
| **N2** | `services/api/tests/unit/test_siem_correlation.py` · **≈ lines 509–512** | the committed equality against **`LabelFloor("khong_mat", None)`** — a **two-argument** construction of the internal floor value. Class **R**, fifth review. | **Regression-lock pin — unchanged and passing, in both phases.** §6/Q6 step 3 adds `unresolved: bool = False` to `LabelFloor` as a **DEFAULTED** internal field, so this two-argument construction stays legal and this equality stays true **without any edit**: the constructed value and the expected value both carry `unresolved = False`. **The default is what makes the pin hold**, and that is why it is stated as binding rather than as a style preference. It is a **pin, not an authorized collateral edit**: ≈509–512 lies outside P2's ≈408–422, P2b's two ranges and P3's ≈484–491, so §8.2 condition 4 forbids editing it. **Two stops attach.** (a) If the writer concludes this equality must be edited — to add a third argument, to change the expected value, or to accommodate a required field — it has hit **§8.6 item 10d**: it stops and the coordinator re-scopes; it does **not** widen §8.2 and does **not** create a new row. (b) If the decided `False` default is dropped anywhere in the carrier chain, so that existing 2- or 3-argument constructions of `LabelFloor` stop being valid, that is the same stop even if this particular line still happens to pass. **N2 changes neither the five-row nor the seven-range accounting.** |
| **N3** | `services/api/tests/unit/test_siem_correlation.py` · **≈ lines 533–535** | the committed **exact-key-set assertion on the canonical `label_floor` block** — that what `to_canonical()` / `DerivedAlert.canonical()` emits has **exactly** the keys `classification` and `monitored_system`. Class **R**, sixth review. | **Regression-lock pin — unchanged and passing, in both phases.** This is the committed executable form of **Q3 = A** and of the wire boundary in **§6/Q6 step 4**: the `unresolved` fact is carried internally and **never** becomes a wire key, so an exact-key-set assertion over the canonical block stays true without any edit. **It protects Q3 = A and Q6 step 4 together** — a writer that leaked `unresolved` (or any third key) out of `to_canonical()` would fail here first, which is the point of pinning it. It is a **pin, not an authorized collateral edit**: ≈533–535 lies outside P2's ≈408–422, P2b's two ranges and P3's ≈484–491, so §8.2 condition 4 forbids editing it. **The stop is §8.6 item 10d(d):** if the writer concludes this assertion must be edited — to admit a third key, to relax the exactness, or to accommodate the carrier — it stops and the coordinator re-scopes; it does **not** widen §8.2 and does **not** create a new row. **N3 changes neither the five-row nor the seven-range accounting**, and it does not overlap §8.3 test 12: test 12 is the *added* Phase-1 assertion of the same property, N3 is the *committed* one that must keep passing untouched. |

**Consequence for Phase 2, stated so it is checkable.** Because the parser shape is unchanged and
the unresolved fact is derived at the policy layer (§6.1), **Phase 2 can reach GREEN without
editing `test_ingest_label_floor.py` anywhere outside P5's two ranges.** That is a testable claim
about the design, not an aspiration: if it fails, the design assumption failed and the coordinator
re-scopes.

### 8.3 Exact future Phase-1 tests, with class

Each is written **only after** the Founder answer that fixes its expected value. Expected values
below are written as `<per Q…>` precisely because they are not yet decided. **Class** is the
§8.1 classification; where a test's class depends on an answer, that dependency is stated rather
than guessed.

Throughout: the ingest path reads the payload key **`label_floor`**; the correlation/engine path
reads the event key **`labels`** (§5.1.1). Tests must use the correct key for the path under test
and must not copy one into the other.

**A. `services/api/tests/unit/test_ingest_label_floor.py` (unit) — ingest path, payload key
`label_floor`. This group is *additive plus* the authorized committed-collateral edit **P5**
(≈12–13 docstring invariants, ≈134–148 parametrized case group) (§8.2), and it carries the no-edit
pin **N1** (the three-field `PayloadFloor` equality at ≈355, §8.2.1) — which stays untouched and
green throughout. The tests below are the
added ones; P5 is the re-expression of what is already committed, and the two must agree — a
Phase-1 report that shows an added test and its P5 counterpart asserting different outcomes for
the same case is a stop, not a discrepancy to reconcile in Phase 2.**

> **Retargeted in the R2 classification-and-carrier remediation.** Tests **1, 2, 3b and 3c**
> previously read as if `resolve_payload_floor` / `PayloadFloor` carried an `unresolved` field.
> **§6.1 decides that it does not** — the parser keeps its committed three fields
> (`classification`, `system`, `invalid`), the ≈355 equality stays pinned (§8.2.1 **N1**), and no
> §8.2 row **P6** exists. The four tests are therefore retargeted onto the **policy-layer
> observable** — the effective label and the emitted tag set from `effective_labels` /
> `apply_label`, or whichever is the true downstream observable at the base opened. **No test in
> this group asserts an `unresolved` attribute, field, or extra tuple element on the ingest parser
> carrier**, and any claim elsewhere in this packet that they did is withdrawn. **Test 3d pins the
> derivation boundary in §6.1 executably.**
>
> **Corrected in the R2 runtime-topology remediation.** That last sentence previously read
> "**Test 3d is new**", which mis-describes it (class **R**, sixth review): the base **already**
> carries the valid-classification-with-defective-auxiliary-field case, and it **already** pins
> `label:floor-invalid` with **no** fail-closed escalation. **Test 3d does not invent that case.**
> What is genuinely new in 3d is exactly one thing — the **negative** assertion that
> `label:unresolved-floor` is **absent** from the emitted tag set. The existing facts are
> regression-lock because they already hold; the new-token absence is regression-lock too, under the
> §8.1 rule that an assertion about the **absence** of the new token is never RED-required. **The
> class of the whole test is unchanged at regression-lock**; only the description of what is new is
> corrected.
>
> **Path-qualified in the R2 prose-collateral-and-path-distinction remediation.** Two constraints
> now bind this whole group, both following from §6.1.1: **(a)** the ingest path does **not**
> distinguish Q1 (iii) *out-of-scale/unmappable* from Q2 (ii) *malformed* — `resolve_payload_floor`
> collapses both to `invalid = True` / `classification = None` — so no test here may assert that
> discrimination, require the original unmappable string to be recoverable, or read the *provenance*
> of the fail-closed outcome; the **outcome** is what is assertable, and Q1 = A and Q2 = A make it
> the same outcome for both. Test **3c**'s discrimination is therefore **absent vs
> present-and-unresolvable**, not malformed vs unmappable. **(b)** the
> `label:unresolved-floor`-without-`label:floor-invalid` case is **correlation-path-only**; on
> ingest the parser marks the payload `invalid`, so `label:floor-invalid` coexists. Asserting its
> absence in this group is a stop (see test 6).

| # | Test | Class |
|---|---|---|
| 1 | `label_floor.classification="tuyet_mat"` (present, string, non-empty, unmappable) → asserts the Q1 outcome `<per Q1>` **at the policy layer**: under Q1 = A the effective label is the fail-closed **`toi_mat`** and the emitted tag set contains **`label:unresolved-floor`**. **Asserts nothing about the parser's return shape** — `PayloadFloor` is unchanged (§6.1) and this test must not reference an `unresolved` field on it. | **RED-required** (Q1) |
| 2 | `label_floor.classification="TOI_MAT"` (case variant) and `" toi_mat "` (whitespace variant) → the same Q1 policy-layer outcome as test 1; proves the unmappable branch is not accidentally case/whitespace-lenient in one direction only. Same shape constraint as test 1. | **RED-required** (Q1) |
| 3a | **Absent** `label_floor` block on the payload → asserts the Q2 **case (i)** outcome `<per Q2>` at the policy layer. Under the recommended Q2 = A this is rank-0 `khong_mat` and **`label:unresolved-floor` is absent from the emitted tag set** — which is already the base behaviour. | **Regression-lock** if Q2 = A (an absence assertion about the new token — §8.1); **RED-required** if Q2 = B |
| 3b | **Present but malformed**: `label_floor` present but not a mapping; `label_floor.classification` non-string; empty string; whitespace-only → each asserts the Q2 **case (ii)** outcome `<per Q2>` at the policy layer. Under Q2 = A this is fail-closed **`toi_mat`** plus **`label:unresolved-floor`**, with **`label:floor-invalid` retained**, which is **not** base behaviour. Parser-shape-agnostic, per test 1. | **RED-required** (Q2) for the fail-closed level and the new token; **regression-lock** for the retained `label:floor-invalid` |
| 3c | **The (i)/(ii) discrimination itself**: absent and present-but-malformed produce *different* policy-layer outcomes under Q2 = A — different effective label, and the unresolved token present in exactly one of them. Asserted as one test so a future refactor cannot silently re-merge the two cases. It reads the discrimination off the **outcome**, not off any parser field. | **RED-required** (Q2) for the malformed side; the absent side's negative assertion is **regression-lock** (§8.1) |
| 3d | **The derivation boundary of §6.1, pinned executably — over a case the base already covers.** A payload whose `classification` is present, well-formed **and mappable**, but whose **auxiliary** field is defective (e.g. a junk `monitored_system`) → asserts **`label:floor-invalid` is emitted**, **no fail-closed escalation occurs**, and **`label:unresolved-floor` is not emitted**. **Stated honestly about what is new here** (class **R**, sixth review): the base **already** exercises this case and **already** pins the `floor-invalid` diagnostic and the absence of escalation, so **3d does not invent the case** — it **re-locks** those committed facts and adds **one** genuinely new assertion, the **negative** one about the new token. This is the case §6.1 separates from Q1/Q2: a defective auxiliary field is a payload-layer defect, not a failure to resolve the classification, and merging the two would inflate marking on records neither question decided about. | **Regression-lock, in both of its parts and for two different reasons.** The `label:floor-invalid` diagnostic and the no-escalation outcome are **existing committed facts** — regression-lock because they already hold and must survive Phase 2. The `label:unresolved-floor` **absence** assertion is regression-lock under the §8.1 rule that an assertion about the **absence** of the new token is **never** RED-required: it passes trivially at the base and meaningfully after Phase 2. Nothing in 3d is RED-required, and classifying any part of it so would force a §8.6 item 3 stop |
| 4 | Unmappable label **with** a valid `label_floor.monitored_system` → asserts the system is preserved (provenance of the effective level); with junk/absent system → asserts the system is dropped, not fabricated. Asserted at the same policy-layer observable as tests 1–3d, not on the parser carrier (§6.1). | **RED-required** (Q1) for the unmappable pairing; the system-drop rule alone is **regression-lock** |
| 5 | `payload_floor_for` returns `None` when `label_floor_enforce` is absent, `False`, `1`, or `"true"` — i.e. **only literal `True`** enables the ingest payload floor. Locks the "no silent flag" rule. | **Regression-lock** — existing behaviour (§5.2), pinned so Phase 2 cannot loosen it |
| 6 | **Exact token, and the coexistence/dedup semantics decided in §Q4.4.2.** `apply_label` emits the unresolved tag as the **exact token fixed by Q4** — the literal `label:unresolved-floor`, with no alternative spelling (O-1 discharged SAFE, §Q4.6) — **exactly once, never duplicated**. Additionally, for the **malformed raw-ingest** cases the emitted tag set is asserted to contain **all** of: `label:unresolved-floor` (once), **`label:floor-invalid` (once — retained, *not* removed)**, the fail-closed level tag `label:toi_mat`, and `handling:restricted` where the existing `apply_label` contract entails it. **This test must not imply, assert, or permit the removal of `label:floor-invalid`:** an assertion that the tag set *excludes* it, or that the two tokens are alternatives, contradicts §Q4.4.2 and is a stop. **The converse — `label:unresolved-floor` emitted *without* `label:floor-invalid` — is CORRELATION-path-only and must not be asserted in this ingest group.** On ingest, a present, well-formed, out-of-scale value is collapsed by `resolve_payload_floor` to `invalid = True` / `classification = None` (§6.1, §6.1.1), so `label:floor-invalid` **coexists** there; a group-A test asserting its absence on a present-unmappable payload asserts something the ingest path does not do and is a **stop**. The without-`floor-invalid` case belongs to the correlation reader, where `_label_of_event` holds the unmappable value non-`None` and no payload-parse diagnostic exists — assert it in group **B** (test 7), not here. | **RED-required** (Q4) for the new token, its exactly-once emission, and the coexistence pairing; **RED-required** (Q1, Q2) for the **`handling:restricted`** expectation on the malformed / present-unmappable cases — the base keeps the connector-supplied label and does **not** emit it there, so the fail-closed `toi_mat` outcome is what creates it (class **R**, third review; §8.1); **regression-lock** for the **retained `label:floor-invalid`** expectation alone. The exactly-once semantics of the coexistence pair are unchanged by this split |
| 6b | **Clearance non-interference — narrowed.** `datalake.search.forbidden_label_tags` is called for **each** clearance and the **unresolved token alone** (`label:unresolved-floor`) is asserted **absent** from every returned set — **not** by hard-coding a prefix string. **Scope is deliberately the one token, not the whole emitted tag set:** disjointness against the full set would be **wrong**, because `label:toi_mat` is *legitimately* forbidden at lower clearances — that is the QD-13 gate working as designed — so a full-set disjointness assertion would fail against a correct implementation and would pressure the writer to weaken the gate. This test says nothing about which QD-13 level tags are forbidden where; it pins only that the unresolved marker itself never becomes a `must_not` term. This is the executable form of the §Q4.5 hazard. O-3 discharged it SAFE at `d3aaf6f` (closed enumeration); this test converts that one-time measurement into a standing pin, so a later change to `forbidden_label_tags` cannot silently re-open it. If it fails, the writer stops rather than renaming the tag. | **Regression-lock** — **corrected from RED-required.** `forbidden_label_tags` is *already* a closed enumeration and the exact token is *already* absent from every clearance's set at `d3aaf6f`, so this test **passes on arrival**, and passing is the point (§8.1: an absence assertion about the new token is never RED-required — as RED-required it would have forced a §8.6 item 3 stop for a correct base). The fail-if-regression semantics are unchanged: a failure means `forbidden_label_tags` has stopped being a closed enumeration, and the writer **stops** rather than renaming the tag |
| 6c | **Retrieval survives the adapter — end to end, for the exact token.** The tag is **actually emitted** by the code under test for a fail-closed case, and that emitted tag is then **actually collected** into the searchable `labels` projection by `datalake/es_adapter.py`. The assertion is on the **collected projection containing the literal `label:unresolved-floor`**, i.e. emitted-then-collected behaviour composed in one test. Locks the property that motivated rejecting `marking:` (§Q4.2). **A token-agnostic prefix check does not satisfy this test.** Asserting only that `"label:"` is a member of the adapter's collected-prefix tuple — the parenthetical the earlier revision of this row carried, now **struck** — proves nothing about this token: it would pass unchanged if the token were never emitted, were emitted under a different spelling, or were dropped between emission and collection, which are exactly the failure modes 6c exists to exclude. A writer that finds only the prefix tuple reachable in a unit context **stops and reports** rather than substituting the weaker check. | **RED-required** (Q4) — the token does not exist at the base, so nothing can emit it and nothing can collect it |

**B. `services/api/tests/unit/test_siem_correlation.py` (unit) — correlation path, event key
`labels`. Includes the authorized edits P2 (**≈408–422** — one contiguous range whose first line
≈408 is the `TestLabelFloorHelper` **class declaration** and whose ≈409–410 is its committed
**docstring**, superseded invariant prose that is rewritten and evidenced verbatim like any
assertion), P2b (≈424–427, ≈429–432) and P3 (≈484–491) (§8.2) — four ranges, three rows — plus
**three no-edit pins**: the import preflight **P1** at ≈17, the `LabelFloor("khong_mat", None)`
equality **N2** at ≈509–512, and the canonical **exact-key-set** assertion **N3** at ≈533–535
(§8.2.1), all verified and left untouched. **Driver taxonomy inside
this file:** P2b is the pure **Q6** shape row; **P3 is a Q2 policy re-expression**, not a Q6-forced
compatibility edit; P2 is mixed.**

> **Tests 7–9 were rewritten in the R2 focused remediation.** They previously named a
> non-existent symbol (`_label_reading_of_event`) and described the unresolved fact only as a
> loose property, leaving the writer to infer a carrier shape the packet had never decided. They
> now target the real symbol `_label_of_event` and trace explicitly to **Q6**. They are written to
> assert the carrier's **observable behaviour** — that the three facts are reachable by name and
> that unresolved accumulates — and deliberately **do not** pre-commit any detail Q6 leaves to the
> writer (decorators, field order, defaults, helpers) or any detail a Q6 = B answer would change
> (attribute access vs. positional index). The `<per Q6>` markers below are unresolved in exactly
> the same sense as `<per Q1>` elsewhere: they are filled from the answer, not guessed.

| # | Test | Class |
|---|---|---|
| 7 | `_label_of_event` (the **real** symbol name — §5.1.1) over the Q1 branch and both Q2 branches, mirroring tests 1/3a/3b but reading the event **`labels`** key, asserting the ingest and correlation paths agree on **outcome**. A divergence between them is the defect class this whole slice exists to close. **Agreement is on the effective level and the unresolved fact, not on tag composition:** per §6.1.1 the correlation reader still holds the unmappable value non-`None` and no payload-parse diagnostic exists there, so this is the group in which `label:unresolved-floor` **without** `label:floor-invalid` is asserted — the ingest counterpart emits both, and that difference is correct, not a divergence. The return value is read **`<per Q6>`** — by named field under Q6 = A, by position under Q6 = B — and the assertion covers all three facts (`classification`, `monitored_system`, `unresolved`) in every branch, so no branch can leave one of them unexamined. | **RED-required** (Q1, Q2, Q6) |
| 7b | **Carrier integrity, Q6's own test.** For one well-formed mappable event and one fail-closed event, the value returned by `_label_of_event` exposes exactly the three decided facts and no fewer, and the two events differ **only** in `unresolved`. Under Q6 = A the test additionally asserts the carrier is **immutable** — an attempt to rebind `unresolved` on a returned instance raises rather than succeeding silently. Under Q6 = B the immutability assertion is inapplicable and the test asserts the arity instead. Written against the decided answer; **not** written at all until Q6 is answered. | **RED-required** (Q6) |
| 8 | `raise_label_floor` called directly (the wiring/persistence entry point) with a present unmappable label → asserts the Q1 outcome rather than a `.get(cls, 0)` collapse to rank 0, **and** that the unresolved fact reaches the window state intact — i.e. the value `_label_of_event` produced is consumed `<per Q6>` and not silently discarded at the hand-off. That hand-off is the exact place a positional carrier loses the fact (§6/Q6), so the assertion is on the group state, not on the return value alone. **Asserted through the decided carrier chain (§6/Q6 steps 2–4), not around it:** the group state's **`_GroupState.label_unresolved`** (or its codebase-equivalent private bool) is **true**; the **effective internal `LabelFloor`** returned by `effective_label_floor()` carries **`unresolved` true**; and the **wire is still exactly the two keys** `classification` / `monitored_system` from `to_canonical()`, with the signal present **only** as the `label:unresolved-floor` tag. All three are asserted in the one test so no hop can be satisfied while another silently drops the fact. | **RED-required** (Q1, Q6); the two-key wire shape alone is **regression-lock** (Q3 = A, existing behaviour) |
| 9 | `unresolved` **accumulates and never self-clears** in the correlation **group state**: a window that once admitted an unmappable contributor still reports unresolved after later well-formed contributors, and after eviction of the offending entry. Asserted against the group's accumulated state rather than any single reading, so the property holds regardless of how Q6 shapes an individual reading. Under Q6 = A this is the behavioural counterpart of the carrier's immutability (7b); under Q6 = B it is the property that has to hold *despite* a mutable positional shape, which is why it is asserted separately from 7b rather than folded into it. **Asserted as the decided monotonic OR (§6/Q6 step 2):** `_GroupState.label_unresolved` (or its codebase-equivalent) is set by the first fail-closed contributor and is **still true** after (a) a later well-formed, mappable contributor, (b) a later **absent**-`labels` contributor, and (c) **eviction** of the entry that set it — and the **effective internal `LabelFloor`** built from that state still carries `unresolved` true in each case, with the wire still two keys plus the tag. The test asserts the OR **never clears**, not merely that it was once set. | **RED-required** (Q1, Q6) |
| 10 | MAX-monotonicity is preserved: a rank-0 contributor never lowers an established higher floor; equal-level contributors from different systems set `mixed_system` and drop the system. | **Regression-lock** — existing semantics, pinned |
| 10b | **Absence does not disturb an established floor** (the Q2 = A safety property): a contributor with **no** `labels` block arriving into a window already at `mat`/`toi_mat` leaves the floor and the unresolved flag unchanged. | **Regression-lock** if Q2 = A |
| 11 | Late events and `value_count` events that return early do **not** contribute to the floor (they are not accepted contributors). | **Regression-lock** |
| 12 | `DerivedAlert.canonical()` — asserts the Q3 outcome `<per Q3>`: if Q3 = A, the emitted `label_floor` block has **exactly** the two keys (`classification`, `monitored_system`) and the tag carries the signal; if Q3 = B, the third key is present and its envelope-version/compat handling is asserted. **Under Q3 = A this is also the wire boundary of the Q6 carrier chain (§6/Q6 step 4):** the internal `LabelFloor.unresolved` is true for the fail-closed case, `to_canonical()` still emits **only** the two keys — asserted as an exact key set, so a leaked third key fails — and the exact token `label:unresolved-floor` appears in the tags **only when that internal flag is true**. | **Regression-lock** for the two-key shape under Q3 = A; **RED-required** for the tag carrying the signal, and for the whole test under Q3 = B |
| 13 | Tag budget: the unresolved tag does not displace `correlation`, `rule:…`, or `rule-version:…`, and each tag respects the 64-character truncation already in the code — including the Q4 token `label:unresolved-floor` at its full 22 characters (the length and composed-form question O-1 resolved, §Q4.6). | **Regression-lock** for the existing budget/truncation rules; **RED-required** for the new token's participation |

**C. `services/api/tests/unit/test_siem_engine.py` (unit) — includes the authorized assertion edit
P4 (≈227–236) (§8.2), which is a **MIXED POLICY** row, not a Q6-forced compatibility edit: the
absent-label test at ≈227–230 is unchanged and **regression-lock**, the `top_secret`
present-unmappable test at ≈232–236 flips to fail-closed `toi_mat` plus `label:unresolved-floor`
and is **RED-required (Q1, Q4)**. **Nothing in this file is tuple-shaped**, so P2b's shape rule does
not reach it; a tuple-shaped expectation found here is drift and a stop (§8.6 item 7).**

| # | Test | Class |
|---|---|---|
| 14 | End-to-end through the engine: an event whose **`labels`** block carries a present unmappable classification flows to a derived alert carrying the Q1 level and the Q3 representation — the two module-level behaviours actually compose. The engine consumes the reading `<per Q6>`; the test asserts the derived alert's outcome, not the carrier's internals, so it stays valid under either Q6 answer. | **RED-required** (Q1, Q3) |
| 14b | End-to-end absence case: an event with **no** `labels` block flows to a derived alert at rank-0 `khong_mat` with no unresolved signal (Q2 = A case (i)) — the module's default path is pinned so Phase 2 cannot inflate it. **This is surface D** (§5.0 — the earlier "surface C … not runtime-wired" attribution is **HISTORICAL, WRONG, SUPERSEDED BY THE EIGHTH REMEDIATION**): the assertion is about what the engine module produces **when exercised directly**, which is what a unit test can establish. It is **not** an observation of a running deployment — and equally **not** a claim that the path is unwired: surfaces **C**/**D** are **deployment-wired** (§5.1.2), so what this test pins is the behaviour of a **deployable** worker path. **Tests are not runtime evidence** (§8.7). | **Regression-lock** if Q2 = A |

**D. `services/api/tests/integration/test_alert_writer_bootstrap.py` (integration, real PG) —
only if Q5 = A, and then as **Phase 3** work — **never Phase 1**, under any answer (§7). Under the
recommended Q5 = B this entire group leaves the R2 lane with allowlist entries 4 and 8, and none of
tests 15–22 is written in R2.**

15. Fresh create → `label_floor_enforce` is literal `True` in the persisted `config`.
16. Pre-existing connector with the key **absent** → converged to `True`; audit meta records
    `label_floor_enforce_converged: true`.
17. Pre-existing connector with the key **`null`** → same convergence (the pre-W0-I03 seed shape).
18. Pre-existing `True` → **no-op**; no spurious convergence flag in the audit meta.
19. Pre-existing `False` → `ValueError`, **nothing written** (row unchanged after rollback) — an
    explicit operational decision is never silently reversed.
20. Look-alike truthy values `1` and `"true"` → `ValueError`. These are the dangerous case: they
    read as "enabled" to a human but `payload_floor_for` treats them as disabled, so the floor
    would be silently inert.
21. Idempotency: two consecutive runs converge identically and do not rotate `key_version`.
22. Tenant isolation under RLS: convergence for tenant A leaves tenant B's connector untouched.

### 8.4 Coverage discipline — none in Phase 1, external file thereafter

> **Added in the R2 remediation pass.** The packet previously required a branch-coverage figure
> alongside the evidence without saying *when* coverage runs, which left the Phase-1 writer free
> to run `--cov` — the one action that writes the denied `services/api/.coverage` path.

#### 8.4.1 Phase 1 runs **no coverage at all**

- Phase 1 runs **focused unit tests only**, addressed by file or node id — not the whole suite.
- **`--cov`, `--cov-branch`, `--cov-report` and any coverage plugin activation are prohibited in
  Phase 1.** So is `coverage run` in any form.
- Shape of the authorized Phase-1 invocation (node ids illustrative):

  ```
  pytest -q \
    services/api/tests/unit/test_ingest_label_floor.py \
    services/api/tests/unit/test_siem_correlation.py \
    services/api/tests/unit/test_siem_engine.py
  ```

- **Rationale.** Coverage in the RED phase measures nothing: the implementation does not exist
  yet, so the figure is meaningless. Its only real effect is to write a coverage data file —
  which, at the repository default, is the tracked and **denied** `services/api/.coverage`
  (§1.1, §2.2). The cheapest way to protect that path is not to produce coverage in this phase.
- **Coverage is therefore not evidence in Phase 1, and no coverage figure is required, requested,
  or accepted as part of the Phase-1 report.** A Phase-1 report containing a coverage number
  indicates the prohibition was breached.

#### 8.4.2 GREEN-phase coverage must write **outside the repository**

For any later coverage-producing run (Phase 2 onward, under a §7.1 grant):

- The coverage data file must be redirected to an **external temporary path outside the
  repository working tree** — e.g. `COVERAGE_FILE=/tmp/<run-id>/.coverage`, or the exact
  equivalent for whichever coverage front-end is used, set in the environment of that single
  invocation. The target directory must be outside every suite repository, not merely outside
  `services/api/`.
- **No configuration file may be edited to achieve this.** This packet authorizes **no** change
  to `.gitignore`, `pyproject.toml`, `setup.cfg`, `.coveragerc`, `pytest.ini`, `tox.ini`, or any
  CI file. Redirection is by **environment variable / command-line only**, per invocation. A
  writer that finds itself wanting to edit config to make coverage safe has hit a stop, not a
  task.
- **Byte-clean re-check, after every coverage-producing run**, both must be empty:

  ```
  git status --porcelain -- services/api/.coverage
  git diff --stat -- services/api/.coverage
  ```

  Any output — any `M`, any changed byte count — is an **immediate stop** (§8.6). The writer
  reports the breach; it does **not** `git checkout` or `git restore` the path to clean up,
  because reverting is itself a prohibited modification of a denied path (§2.2) and destroys the
  evidence of what happened.
- The check is run **after every** coverage-producing invocation, not once at the end of the
  phase — a mid-phase write that a later run overwrites must still be caught.

### 8.5 Real-PostgreSQL / RLS evidence requirements

- Integration tests run against **real local PostgreSQL 16**, not a stub or SQLite. The
  repository already gates `services/api/tests/integration/` with `pytest.mark.skipif` on
  `CYBRIK_TEST_DB != "1"`; a run where these tests **skip** is **not** evidence, and a summary
  that hides skips is a reporting defect. Skip counts must be reported explicitly.
- RLS must be exercised through the real tenant-scoped session path (`tenant_session`), with the
  cross-tenant negative assertion (test 22) failing closed.
- Evidence must include: the exact commit the run was made at, the full pytest summary line
  (passed/failed/skipped/errors), the branch-coverage figure against the **80% branch floor this
  packet proposes for the R2 lane** (§8.5.1), and the `CYBRIK_TEST_DB` value in effect.
- Coverage must **not** be produced into the tracked `services/api/.coverage` path — see §8.4.2
  for the exact redirection and byte-clean re-check (§1.1, §2.2).
- **This subsection applies to Phase 2 onward only.** Under the recommended Q5 = B there is no
  integration group in the R2 lane at all (§8.3 group D), and under any answer Phase 1 runs no
  integration test and no coverage. This follows structurally, not by convention: **Phase 1 is
  allowlist entries 5–7 only** (§7), and every integration test in this packet lives in entry 8.

#### 8.5.1 The 80% branch floor is **proposed here**, not inherited from SOC

**This packet declares an 80% branch-coverage floor as a prospective gate on the future R2 lane.**
It is a lane condition proposed by this document, not a restatement of an existing SOC standard,
and **not** current evidence about anything.

Verified read-only at the recommended base `d3aaf6f` in `cybrik-soc-command-center`:
`cybrik-soc-command-center:.github/workflows/ci.yml:66` runs
`pytest -q --cov=cybrik_soc --cov-report=term-missing`. There is **no** `--cov-branch` flag and
**no** `fail_under` in `services/api/pyproject.toml`, `setup.cfg`, or a `.coveragerc`. Therefore:

- **SOC CI does not measure branch coverage today**, and **SOC declares no 80% branch floor.**
  Any prose elsewhere reading "the declared 80% branch floor" as if it were a SOC-side standard
  is describing a suite-side convention, not something `cybrik-soc-command-center` enforces.
- The floor becomes binding on R2 **only if the Founder opens the lane on these terms**. Until
  then it is a proposal. The R2 writer must therefore **enable branch measurement explicitly**
  (`--cov-branch`) to produce the §8.5 figure at all; it will not appear from the existing CI
  invocation, and this packet creates **no** CI job and changes **no** CI configuration. When it
  does so, §8.4.2's external-`COVERAGE_FILE` rule and byte-clean re-check apply in full.

### 8.6 Stop conditions (writer halts and reports; does not improvise)

1. Any modification appears outside the allowlisted paths — eight under Q5 = A, six under the
   recommended Q5 = B — **including** `services/api/.coverage` under either.
2. Anything is staged that the Founder did not explicitly approve in that instant.
3. A test the writer classified **RED-required** *passes* on arrival, **or** a test classified
   **regression-lock** *fails* on arrival (§8.1). Reclassifying a test after seeing its arrival
   result is itself a stop.
4. A source byte would be written in Phase 2 without the separate coordinator grant required by
   **§7.1** — including "preparing" Phase-2 edits before the grant exists.
5. `services/api/.coverage` shows any modification at any point, per the §8.4.2 byte-clean
   re-check. The writer reports and does **not** revert the path.
6. Coverage is about to be produced in **Phase 1**, or a coverage run would write inside any
   repository working tree, or making coverage safe would require editing `.gitignore` or any
   coverage/pytest/CI configuration file (§8.4).
7. The content at an authorized range (§8.2, rows **P2, P2b, P3, P4, P5** — **seven** ranges) is
   not what the packet describes — the base has drifted; the coordinator re-scopes. **This includes
   P5:** if `test_ingest_label_floor.py` at ≈12–13 / ≈134–148 does not encode the superseded policy
   the packet describes (keep the connector label, retain `label:floor-invalid`, forbid every other
   `label:` tag), the writer stops rather than editing whatever it finds. **It equally includes
   P2's anchor:** if `test_siem_correlation.py` at ≈408 is not the `TestLabelFloorHelper` class
   declaration, or ≈409–410 is not its committed docstring stating that junk or absent labels
   resolve to the `DEFAULT` `khong_mat`, that is drift and a stop — the writer does not hunt for the
   prose elsewhere and re-anchor the range on its own authority (§8.6 item 10b). **It equally
   includes the content that decides P3's and P4's driver:** if ≈484–491 is not the block mixing an
   **absent** contributor with a **non-string invalid** contributor (**P3**), or ≈227–236 is not the
   **absent-label** test at ≈227–230 plus the **`top_secret` present-unmappable** test at ≈232–236
   (**P4**), or if either range turns out to carry a **tuple-shaped expectation**, that is drift and
   a stop — the writer does not re-derive which question drives the row on its own authority. **It
   equally includes the §8.2.1 no-edit invariants:** if the import at ≈17 does **not** already bind
   `_label_of_event` (P1), the equality at ≈355 is **not** against the committed three-field
   `PayloadFloor` (N1), the equality at ≈509–512 is **not** against
   `LabelFloor("khong_mat", None)` (N2), or ≈533–535 is **not** the committed **exact-key-set
   assertion on the canonical `label_floor` block** (N3), that is drift and a stop — not a
   newly-discovered edit the writer may perform.
8. An existing **assertion or committed invariant prose/docstring** outside the authorized rows
   **P2–P5** (§8.2) would need to be edited, deleted, commented out, `xfail`-ed, or skipped (§8.2
   conditions 3–4) — **including the §8.2.1 lines P1 (≈17), N1 (≈355), N2 (≈509–512) and N3
   (≈533–535), which are verification-only and carry no edit authorization**. **Committed invariant prose counts as
   coverage**, not as decoration: a module, class or test docstring that states a floor invariant
   is governed by exactly the same rules as an assertion, and a Phase-1 edit to one outside an
   authorized range is a stop even though nothing fails as a result.
   Equally a stop: an edit **inside** an authorized range that drops, weakens, or narrows an
   expectation rather than re-expressing it in full (§8.2, P2/P2b/P5 and condition 3) — including,
   for P5, dropping a parametrized case, de-parametrizing the group, or removing the retained
   `label:floor-invalid` or the `handling:restricted` expectations; and, for **P2**, leaving the
   `TestLabelFloorHelper` docstring at ≈409–410 stating the superseded junk/absent → `DEFAULT`
   `khong_mat` rule while the assertions beneath it assert the decided one, or editing any case in
   that range without asserting the `unresolved` fact (`False` for the absent case, `True` for each
   fail-closed case); and, for **P3** and **P4**, treating a **policy** re-expression as a
   mechanical shape edit — re-shaping the assertions while leaving the superseded outcome in place
   (P3's rank-0 collapse where Q2 = A now fails closed, P4's `top_secret` handling where Q1 = A now
   fails closed), or conversely "modernizing" **P4's absent-label test at ≈227–230**, whose outcome
   does **not** change and which must stay a passing regression-lock.
9. **Q4 drift.** Any of the three properties discharged SAFE by the R2 final review (§Q4.6)
   fails to hold at the base the writer actually opens: the hyphen is not legal or not collected
   (O-1), the token collides (O-2), or `forbidden_label_tags` is not a closed enumeration (O-3).
   These are **no longer open obligations** — they are measured facts, and a stop here means the
   base drifted from the packet, not that a question went unanswered. No fallback to `marking:` or
   `handling:` is authorized, **and there is no underscore substitution**: that pre-authorization
   is withdrawn (§Q4.6). Q4 returns to the coordinator with the drift attached.
10. **Q6 shape drift:** the committed test collateral cannot be brought to the decided Q6 shape
    within the **seven** §8.2 ranges — e.g. a tuple-equality assertion on the label reader exists
    outside them. The writer stops rather than widening the authorization itself. **Scope note:**
    the Q6-forced shape collateral is **row P2b**, plus the Q6 completeness rule inside **P2**.
    **P3 and P4 are policy rows** (§8.2); finding no shape edit to make in them is the expected
    result, not a shortfall, and inventing one to fit the withdrawn description is itself a stop
    under item 8.
10b. **Collateral drift beyond the authorized ranges.** A committed **assertion or committed
    invariant prose/docstring** encoding the superseded floor policy is found in
    `test_ingest_label_floor.py` **outside** P5's two ranges, in `test_siem_correlation.py`
    **outside** P2's ≈408–422 / P2b's two ranges / P3's range, in `test_siem_engine.py` outside
    P4's range, or in any test file P2–P5 does not name. **Prose is explicitly in scope for this
    stop:** this item is what the fifth remediation widened P2's range to ≈408–422 to satisfy for
    the one docstring the packet now knows about, and a *second* superseded docstring found
    elsewhere is drift, not a task. The authorization is bounded to the seven named ranges; the
    writer stops and the coordinator re-scopes rather than the writer extending §8.2 on its own
    authority.
10c. **`PayloadFloor` arity drift.** Phase 1 or Phase 2 appears to require **adding a field to
    `PayloadFloor`**, changing `resolve_payload_floor`'s return arity, editing the committed
    three-field equality at `test_ingest_label_floor.py` ≈355 (§8.2.1 **N1**), or creating a §8.2
    row **P6** to authorize any of those. **§6.1 decided against all of it**: the parser carrier is
    unchanged and the unresolved fact is derived at the policy layer from the existing
    `(invalid, classification)` pair. A writer that believes the decision is unworkable at the base
    it opened **stops and reports the disagreement** — it does not change the carrier, does not
    edit the ≈355 equality, and does not extend §8.2 on its own authority. Equally a stop in the
    other direction: a Phase-1 test that asserts an `unresolved` attribute, field, or extra tuple
    element on the **ingest** parser carrier (§8.3 group A) contradicts §6.1 and must not be
    written. **Also a stop under this item — weakening the `LABELS` guard to make an unreachable
    branch reachable.** Phase 1 or Phase 2 appears to require removing or loosening
    `resolve_payload_floor`'s `label not in LABELS` check so that an out-of-scale value survives as
    a non-`None` `classification`, or appears to require the **ingest** path to distinguish
    Q1 (iii) from Q2 (ii). **§6.1.1 decided against both**: the collapse is intentional, the guard
    is crash-prevention (`label_rank` raises `ValueError` on out-of-scale input, class **R**), and
    the two questions mandate the same ingest outcome under Q1 = A / Q2 = A. The writer stops and
    reports rather than degrading the parser to make a conceptual branch observable.
10d. **Correlation carrier-chain drift** (§6/Q6 steps 2–5). Any of the following is a stop, and the
    writer reports rather than improvising the shape or widening §8.2:
    **(a)** the committed equality at `test_siem_correlation.py` **≈509–512** (§8.2.1 pin **N2**)
    would need to be edited — a third argument added, the expected value changed, or the
    construction adjusted for a now-required field. It lies outside every authorized range and
    §8.2 condition 4 forbids touching it.
    **(b)** the internal `LabelFloor`'s new `unresolved` field would have to be **required rather
    than defaulted `False`**, or the `False` default is otherwise lost, so that existing 2- or
    3-argument constructions or equalities stop being valid. The default is a **decided, binding**
    part of Q6 = A (§6/Q6 step 3), not a writer preference — this is a stop even if ≈509–512 still
    happens to pass.
    **(c)** the group-state bool would have to **self-clear** — on a later valid or absent
    contributor, on eviction, or on window re-computation — rather than accumulating by monotonic
    OR. That contradicts §6/Q6 step 2 and §8.3 tests 8/9.
    **(d)** `LabelFloor.to_canonical()` would have to emit **`unresolved`** or any third key under
    **Q3 = A**. That is an envelope-contract change and is above the writer's authority (§6/Q3);
    the signal leaves as the tag only. **This is also the stop that attaches to pin `N3`** — the
    committed **exact-key-set assertion on the canonical `label_floor` block** at
    `test_siem_correlation.py` **≈533–535** (§8.2.1). If the writer concludes ≈533–535 must be
    edited — to admit a third key, to relax the exactness, or to accommodate the carrier — it has
    hit this stop: the line lies outside every §8.2 range, §8.2 condition 4 forbids touching it, and
    the coordinator re-scopes rather than the writer widening the authorization.
    **(e)** the chain cannot be realised at the base actually opened — there is no group state to
    carry the bool, no `effective_label_floor()`-equivalent to feed the internal value, or the
    direct-engine path cannot pass `reading.unresolved`. Codebase-equivalent **private names** are
    allowed (§6/Q6); a **different chain** is not, and neither is leaving a hop undecided.
11. Integration tests **skip** rather than run, or `CYBRIK_TEST_DB` is unset — Phase 2+ only, and
    only under Q5 = A.
12. Branch coverage falls below the 80% branch floor **proposed by this packet for the R2 lane**
    (§8.5.1) — a prospective stop condition applying to the GREEN phase only, conditional on the
    Founder opening the lane on these terms, and not a claim that SOC declares or measures such a
    floor today.
13. Any Alembic head change, new migration, or schema/RLS policy edit becomes necessary — that is
    Phase 5, a different lane.
14. The work appears to require reading, citing, or aligning to the unaccepted C1/G1 corrections.
15. The work appears to require touching, populating, or "aligning to" the accepted
    `cybrik.data-marking.v1` contract, including its `origin_marking` field (§Q4.1) — that is
    Phase 5.
16. A `<per Q…>` value is still unanswered when the code that depends on it must be written.
17. **Q2 ground drift — the old reopen trigger is REMOVED, not re-worded.** The former item 17 read:
    *"an accepted producer is found to populate event `labels` or the payload `label_floor` block,
    such that absence is no longer the universal state. Q2 = A was decided on that condition."*
    That text is **HISTORICAL, WRONG, SUPERSEDED BY THE EIGHTH REMEDIATION** and is retained only so
    a reader can see what was retracted: measured at `d3aaf6f`, the deployed PF normalizer
    **already** populates event `labels` unconditionally (`normalizer.py:188–232, 326`) and the
    matcher forwards them, so **the condition has already fired** and **absence was never the
    universal state**. Q2 = A is **not** a deferral awaiting it; it rests on the normative ground in
    §6/Q2 (*absent means no asserted source floor*), which does not expire. **The replacement stop:**
    the writer stops and returns Q2 to the coordinator if it finds, at the base actually opened,
    that **`normalizer.py::resolve_label_floor` no longer always synthesizes a `labels` block with a
    defaulted `classification`**, that **`siem_matcher.py` no longer forwards `event['labels']`**, or
    that **`alert_writer.py::validate_envelope` no longer requires `label_floor` and rejects a
    missing or out-of-scale one** — because those three facts are what the §6/Q2 boundary argument is
    stated against (§5.0 surfaces **C**/**D**, §6/Q2 facts 1–2).
18. The R1 worktree would need to be modified for any reason.
19. Any contract artifact, OpenAPI file, JSON Schema, or vendored contract copy would need to
    change.
20. **Phase-1 collection breakage.** A Phase-1 edit would make
    `services/api/tests/unit/test_siem_correlation.py` (or either other unit file) fail to
    **collect** against the unmodified base — most likely by importing the Q6 carrier type, which
    does not exist until Phase 2 (§8.2.1 no-edit preflight **P1**). A collection error is not a RED (§8.1, §7.1
    item 4); it destroys the arrival evidence for every test in the file. The writer stops and
    reports rather than accepting the error as a failing run.

### 8.7 What may **not** be claimed

Even on a fully green run: **no CI claim, and no *enforcement* claim.** The words `VERIFIED`,
`PILOTED`, `ACTIVATED`, and `GA` remain unavailable, and no CI job is created or claimed by this
lane. Status may reach `IMPLEMENTED (local, unmerged)` at most.

**Stated at the corrected scope (§5), which is now FOUR-way.** Three earlier wordings of this
subsection are withdrawn, and the third of them is the one a reader is most likely to still be
carrying. **(1)** The original — *"the mechanism has no in-process caller; a passing test suite proves
the logic, not that any deployment enforces the floor"* — was withdrawn as an overgeneralization.
**(2)** Its replacement, which asserted that **"M1 is live"** and that merged label-resolution changes
"take effect on ingest **and correlation** for every tenant on the next deploy", was withdrawn in
turn. **(3)** The **seventh** pass's replacement for that — which declared the correlation/engine path
**NOT RUNTIME-WIRED**, **forbade every deploy-effect claim** about it, asserted **no worker wiring**,
and asserted that **nothing sets** `label_floor_enforce` — is **HISTORICAL, WRONG, SUPERSEDED BY THE
EIGHTH REMEDIATION**: it is false at `d3aaf6f` (§5.0, §5.1.2, §5.2). The operative list is below.

- **May not be claimed:** that any deployment enforces the **payload `label_floor`** floor
  (surface **B**). That path is gated on `label_floor_enforce` being the exact boolean `True`.
  **The exact distinction, and both halves are required:** **no automatic assignment of that flag was
  found in source** — no startup convergence, no worker that writes it, no CI path, and no `True`
  default — **but `connector/api.py::validate_lc_config` allowlists the field (line 95) and
  boolean-validates it (110–112), and both `ConnectorIn._config` (≈178–181) and
  `ConnectorUpdate._config` (≈198–201) invoke it, so an authorized connector create/update API call
  accepts and can set it** (§5.2). Under the recommended Q5 = B, nothing in the R2 lane changes
  either half. **"Nothing in source sets the flag" may never be stated, or read, as meaning there is
  no authorized setter** — it means only that nothing assigns it *automatically*.
- **May not be claimed:** that a change to `siem/correlation.py` or `siem/engine.py` reaches **no**
  deployed path, produces **no deploy effect**, or is inert. **Surfaces C and D are
  SOURCE-IMPLEMENTED · DIRECT-TESTABLE · DEPLOYMENT-WIRED WORKER PATH · EXCLUDED FROM THE MOUNTED
  SIEM HTTP API** (§5.1.2). The PF **normalizer → matcher → correlation** chain is **deployable and
  deployment-wired**: `normalizer.py::resolve_label_floor` synthesizes a `labels` block on every
  normalized document, `siem_matcher.py` forwards it, and `correlation_processor.py` constructs
  `CorrelationEngine` and calls `_ingest_one` from a service packaged as `pf-correlation` and
  declared in `deploy/pf/docker-compose.pf-workers.yml` / `docker-compose.pf-demo.yml`. **A change to
  the correlation source can therefore affect the packaged `pf-correlation` worker on a deployment
  that runs that service.** The phrase **NOT RUNTIME-WIRED is withdrawn and may not be used for
  either surface**, and the seventh pass's instruction that a reviewer **may** state it is
  **rescinded**.
- **May not be claimed — the opposite overreach, which is equally forbidden:** that any
  `pf-correlation` instance is **currently running**, has been **production-observed**, or that a
  Phase-2 change "takes effect on the next deploy" as an observed fact. The measured fact is
  **packaging, declaration and construction in source** — **deployment-wired, not observed-running**.
  This packet holds no runtime authority and closes no part of that gap.
- **May not be claimed:** that the mounted SIEM HTTP API exposes correlation. It does **not**
  (`siem/api.py:25–27`), and that exclusion survives the corrected topology intact. Symmetrically,
  the same docstring's *"khong worker wire"* phrase (line 26) is **stale document evidence** and may
  **not** be cited as current truth about worker wiring; cite the worker and manifest files.
- **May not be claimed:** that a passing test suite is runtime evidence of anything. **Tests are not
  runtime evidence.** A fully green Phase-1/Phase-2 run proves logic, and proves it for a
  deployment-wired path — which raises the stakes of getting the logic right without converting any
  test result into an observation of a running system.
- **May not be claimed — the inertness error, now narrower still:** that the **whole** lane is inert
  or that **all** the label logic is dead code. **Surface A is code-reachable and ungated, surface
  B's call sites are reachable** (§5.1) — `ingest/service.py`, `ingest/pf_bridge.py` and
  `ingest/source_health_worker.py` all reach the ingest label code on inbound records — and
  **surface C produces and forwards a `labels` block on every normalized event**.
- **For surface B specifically, the flag statement to use verbatim:** *nothing automatically assigns
  `label_floor_enforce`; an authorized connector create/update API call can set it.* Either half
  alone is a misstatement.
- **The citable disclosure text** is the **four-way** block in §5.2; use it verbatim rather than
  paraphrasing it in any direction.

---

## 9. External-authority (A05) boundary — preserved, untouched

This packet makes **no** change to the external-authority boundary and asserts nothing new about
it. Restating the committed invariants so the R2 lane cannot erode them:

- An external national authority (the Vietnamese **A05** reference peer) is an **external trust
  boundary and a liaison endpoint only** — per `ADR-0007` §54 and `ADR-0009` §43.
- It is **never** an org-tree **ancestor** or the tree root (`ADR-0007` rejected alternative,
  §134); an `external` boundary node MUST have a null governance parent (`ADR-0009` §68).
- It is **never** a tenant **member** and **never** a **super-admin** — `ADR-0007` §98 (INV-2
  reinforcement), `ADR-0009` §43.
- Its exchange uses a **distinct** auth context and **never auto-executes** (`ADR-0009` §D6);
  the internal delegation trust domain is INTERNAL only (`ADR-0008` §116).
- Any UI wave surfacing hierarchy or A05 exchange must clear the UAT Gate Standard persona
  matrix including the **A05 liaison** persona (`ADR-0007` §81, `ADR-0009` §155–156).

**Binding on the R2 lane:** QD-13 marking must not be used, in code or in prose, to introduce
any ancestor, membership, or super-admin relationship for an external authority. Marking level
is a property of *data*; it confers no *identity* and no *authority*.

---

## 10. What this packet does not do

- Does **not** flip any status. W1-C1 / W1-G1 / W1-I03 / MARK-001 / RB-001 statuses are unchanged.
- Does **not** accept any contract, and is not a contract or product writer.
- Does **not** create, delete, move, or rename any repository or top-level directory.
- Does **not** commit, stage, push, fetch, merge, rebase, tag, or release anything.
- Does **not** install a dependency, run a migration, start a local stack, run a formatter, or
  read any secret.
- Does **not** run or demonstrate anything at runtime, and makes no CI claim.
- Does **not** edit any existing file — including `docs/operations/README.md`, whose index row
  for this document must be added by a **separate** Founder-approved change, since this session's
  allowlist is exactly one new file.
- Does **not** modify the R1 worktree or any other worktree.
- Does **not** change W dates or the release window (§ header).
- Does **not** accept, mark accepted, or pre-commit any Q1–Q6 answer. The recommendations in §6
  and §11 are **preselected defaults for coordinator review**, not decisions. This packet's own
  status stays `PROPOSED`. **Q6 is a question, not a design already adopted:** naming
  `_EventLabelReading` records the recommended shape precisely enough to be reviewed and
  overridden, and creating it remains a Phase-2 source act behind the §7.1 grant.
- Does **not** re-measure anything in `cybrik-soc-command-center` in **the first seven** remediation
  passes — **none of those seven** held read access to it (see the provenance table in the header).
  **Scope of this bullet: passes one through seven only.** The **eighth** (measured-topology) pass
  **did** hold SOC read access and **did** measure directly — see the provenance-posture bullet
  below — and the **ninth** (document-closure) pass again held none. The Q4
  token-legality, collision and clearance-gate results in §Q4.6, the §8.2 committed-collateral
  anchors **including row P5**, the occupied tag vocabulary in §Q4.4.1, and the three facts the
  fourth pass acts on (the already-correct `_label_of_event` import at ≈17, the committed
  three-field `PayloadFloor` equality at ≈355, and the base's non-emission of `handling:restricted`
  on the malformed / present-unmappable floor path), and the three the **fifth** pass acts on (the
  committed `TestLabelFloorHelper` docstring at `test_siem_correlation.py` ≈408–410, the
  parser-indistinguishability of Q1 (iii) and Q2 (ii) after `resolve_payload_floor`, and the
  `ValueError` `label_rank` raises on out-of-scale input) are all class **R**: measured from source by an
  independent read-only review and carried here verbatim, **not** re-measured by any pass. They are
  recorded as measured because a review measured them, not because this session checked.
- Does **not** change any Q1–Q6 answer in the third remediation pass. Q1 = A, Q2 = A, Q3 = A,
  Q4 = `label:unresolved-floor`, Q5 = B and Q6 = A are preserved verbatim. That pass corrects what
  those answers **entail** — the missing `test_ingest_label_floor.py` collateral (§8.2 row P5), the
  unstated occupied vocabulary and the coexistence relationship (§Q4.4.1/§Q4.4.2), the
  rows-and-ranges accounting, and the over-broad §8.3 test 6b — and opens **neither Phase 1 nor
  Phase 2**.
- Does **not** change any Q1–Q6 answer in the **fourth** remediation pass either. Q1 = A, Q2 = A,
  Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B and Q6 = A are again preserved verbatim, and the
  packet stays `PROPOSED` with no grant attached. That pass corrects **test classes** (§8.3 test 6b
  to regression-lock; `handling:restricted` in P5 and test 6 to RED-required), records the **§6.1**
  decision that the ingest parser carrier does **not** change, converts row **P1** into a no-edit
  preflight and recomputes the accounting to **five rows / seven ranges / three files**, widens the
  `label:floor-invalid` gloss, and strikes the prefix-only escape from test 6c. It opens **neither
  Phase 1 nor Phase 2**.
- Does **not** change any Q1–Q6 answer in the **fifth** remediation pass either. Q1 = A, Q2 = A,
  Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B and Q6 = A are preserved verbatim once more, the
  packet stays `PROPOSED` with no grant attached, and **the §8.2 accounting is unchanged at five
  rows / seven ranges / three files**. That pass widens row **P2**'s single range to ≈408–422 to
  take in a committed docstring, gives P2 the explicit **Q6 completeness rule**, widens §8.6 items
  8 and 10b to cover **committed invariant prose**, corrects §6.1 with the **ingest/correlation
  path distinction** (§6.1.1) and the `LABELS`-guard crash-prevention constraint, path-qualifies
  the `unresolved-floor`-without-`floor-invalid` claim as **correlation-only**, and corrects §7
  Phase 1 to **allowlist entries 5–7 only**. It opens **neither Phase 1 nor Phase 2**.
- Does **not** change any Q1–Q6 answer in the **sixth** remediation pass either. Q1 = A, Q2 = A,
  Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A are preserved verbatim a fifth consecutive
  time, the packet stays `PROPOSED` with no grant attached, and **the §8.2 accounting is again
  unchanged at five rows / seven ranges / three files**. That pass re-attributes rows **P3** and
  **P4** from Q6-forced compatibility edits to **policy re-expressions** (P3 → Q2/Q4, P4 → a mixed
  Q1/Q4 and regression-lock row), records that **P4 is not tuple-shaped**, expands **Q6 = A** from
  a reader-only answer to the **full internal carrier chain**, makes P2's anchor precise (**≈408**
  class declaration, **≈409–410** docstring), adds the no-edit pin **N2** at ≈509–512, and widens
  §8.6 with item **10d**. It opens **neither Phase 1 nor Phase 2**.
- Does **not** change any Q1–Q6 answer in the **seventh** remediation pass either. Q1 = A, Q2 = A,
  Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A are preserved verbatim a sixth consecutive
  time, the packet stays `PROPOSED` with no grant attached, and **the §8.2 accounting is again
  unchanged at five rows / seven ranges / three files** — with **P1/N1/N2/N3 as four no-edit pins
  outside it**. That pass withdraws the **"M1 is live"** grouping in favour of the **three-surface
  topology** of §5.0, corrects the caller inventory **by actual arguments** (including that
  `source_health_worker.py` is **surface A only** and never reads the payload `label_floor` block),
  re-grounds **Q2** and Candidate **B**'s NO-GO on the **live feature-gated ingest path** rather than
  on correlation liveness, adds the no-edit pin **N3** at ≈533–535 with its stop at §8.6 item
  **10d(d)**, and corrects §8.3 test **3d**'s description from "new" to a **regression-lock**
  re-lock of committed facts plus one negative new-token assertion. It opens **neither Phase 1 nor
  Phase 2**.
- **Provenance posture — the eighth pass is the exception to the seven before it, and the ninth is
  not.** The first seven remediation passes ran in this `cybrik-suite` docs worktree with **no read
  access to the SOC source**; every SOC-side fact they act on is class **R**, carried verbatim from
  an independent review. **The eighth (measured-topology) remediation broke that pattern: it held
  read access to the SOC source worktree
  `cybrik-worktrees/w1-48/w1-soc-secret-scan-remediation-r1` at
  `d3aaf6fb29c57f145de8f131ad1588aae57d57c9` and read that source directly**, recording the
  four-surface topology, the flag provenance, the PF producer/forwarding chain and the Alert Writer
  envelope guarantee as class **S** measurements with exact files, symbols and line numbers — and
  where those measurements contradicted a carried class-**R** claim, **the measurement governs and
  the carried claim is withdrawn**. No statement in this packet may be read as asserting that *all*
  remediation passes lacked SOC read access; that is true of passes one through seven only.
  **The ninth (document-closure) remediation read no `cybrik-soc-command-center` byte.** It held no
  SOC read access, re-measured nothing, and **upgraded nothing to class S**. It corrects **document
  closure only** — the §10 negative-claim boundary, the missing §12.2 checklist, the provenance
  wording above, and the §11 Q6 row pairing — all of which are decisions and cross-checks made **in
  this document** against the eighth pass's already-recorded class-**S** evidence. **A later pass
  may upgrade a claim to class S only if it actually reads the source itself**; the ninth did not,
  and claims nothing on that basis.
- **Negative-claim boundary, stated exactly — corrected by the ninth remediation.** This packet does
  **not** claim that any instance of the correlation/engine path is **currently running** or
  **production-observed**, and does **not** offer any test — committed or proposed — as **runtime
  evidence**. What it **does** state, and what a reader may rely on, is the measured four-surface
  model of §5.0 / §5.1.2: surfaces **C** and **D** are **source-implemented and deployment-wired**
  — packaged as the console script `pf-correlation` (`ops/pf-workers/pyproject.toml:40`) and
  declared as a compose service (`deploy/pf/docker-compose.pf-workers.yml` ≈99–119,
  `docker-compose.pf-demo.yml` ≈109–114), constructed and driven by
  `ops/pf-workers/pf_workers/correlation_processor.py` (334, 483) — so **a Phase-2 source change to
  `siem/correlation.py` / `siem/engine.py` can affect the packaged `pf-correlation` worker on a
  deployment that runs that service.** Correlation remains **excluded from the mounted SIEM HTTP
  API** (`siem/api.py:25–27`); exclusion from the HTTP surface is **not** absence of a worker path.
  **No operative NOT-RUNTIME-WIRED, no-worker-wiring or no-deploy-effect claim survives anywhere in
  this packet** — every such sentence is a **historical quotation immediately and unmistakably
  labelled HISTORICAL, WRONG or SUPERSEDED BY THE EIGHTH REMEDIATION at the point of use** (§5,
  §5.1, §5.1.2, §5.2, §6/Q1, §6/Q2, §6/Q5, §8.3 test 14b, §8.6 item 17, §8.7, §11 and §12), kept so
  a reader can see what was retracted and why. **The earlier form of this bullet is itself WITHDRAWN
  AS WRONG by the ninth remediation:** it read *"does not claim, in any operative statement, that the
  correlation/engine label path is live, runtime-wired, or takes effect on deploy"* — which
  re-asserted, as a present-tense disclaimer of this packet, the very three-surface finding the
  eighth remediation measured to be **false at `d3aaf6f`**. Two disclaimers from that earlier form
  **do** survive and remain fully operative: **nothing in source *automatically* sets
  `label_floor_enforce`** — absent, `False`, `1` and `"true"` are all off, while an **authorized**
  connector create/update API call **can** set it (§5.2, §12); **Q1–Q4 do not affect every ingested
  alert**, because surface **B**'s effect is gated on the exact boolean `True`; and
  **`ingest/source_health_worker.py` does not read the payload `label_floor` block** at all (§5.1,
  line 121, no `payload_floor` argument).
- Does **not** create, rename, or authorize creating `_GroupState.label_unresolved`, the internal
  `LabelFloor.unresolved` field, or any other construct in the Q6 = A carrier chain. Those live in
  `siem/correlation.py` and `siem/engine.py` — source paths 2 and 3 — and stay behind the §7.1
  grant. Deciding a shape is not implementing it: nothing here writes a source or test byte.
- Does **not** add a key to the emitted `label_floor` wire block. Under Q3 = A
  `LabelFloor.to_canonical()` keeps **exactly** its two current keys; the Q6 = A carrier chain is
  internal end to end, and §8.6 item **10d(d)** makes an attempt to surface `unresolved` on the
  wire a stop.
- Does **not** authorize editing the committed `LabelFloor("khong_mat", None)` equality at
  `test_siem_correlation.py` ≈509–512. §8.2.1 records it as the pin **N2**: unchanged and passing
  in both phases, held true by the decided `False` default rather than by an edit.
- Does **not** weaken, remove, or authorize weakening `resolve_payload_floor`'s
  `label not in LABELS` guard, and does **not** make the ingest path distinguish Q1 (iii) from
  Q2 (ii). §6.1.1 decides the collapse is intentional and the guard is crash-prevention;
  §8.6 item 10c makes an attempt at either a stop. Recording that is not changing code — nothing
  here writes a source or test byte.
- Does **not** put allowlist entry 8 (`test_alert_writer_bootstrap.py`) into **Phase 1** under any
  answer. Under Q5 = A it is Phase-3 work behind the §7.1 grant; under Q5 = B it is outside the R2
  lane. There is no Phase-1 integration test in this packet.
- Does **not** add a field to `PayloadFloor`, change `resolve_payload_floor`'s arity, edit the
  committed equality at `test_ingest_label_floor.py` ≈355, or create a §8.2 row **P6**. §6.1
  decides the opposite of all four, and §8.2.1 records the ≈355 equality as a **pin**. Recording a
  decision is not implementing it: nothing here writes a source or test byte.
- Does **not** deprecate, remove, or supersede the existing `label:floor-invalid` tag, and does
  not authorize a writer to stop emitting it. §Q4.4.2 decides **coexistence**; §8.3 test 6 pins it.
- Does **not** reserve the `marking:` tag namespace, and does **not** touch the accepted
  `cybrik.data-marking.v1` contract or its `origin_marking` field. §Q4.1 discloses that contract;
  disclosure is not authorization.

---

## 11. Minimum Founder decision text

> **Rewritten in the R2 remediation pass.** The earlier §11 was left behind by the §6 rework and
> had drifted into direct contradiction with it: its Q2 line still read `missing/corrupt` — the
> lumped framing §6/Q2 explicitly withdrew — and its Q4 line still offered `marking:` and
> `handling:` as live candidates after §Q4.2 and §Q4.3 had rejected both on the record. A Founder
> answering the old block would have selected an option the body of this packet says must not be
> used. The block below replaces it and is now the only decision text in this packet.
>
> **Amended in the R2 focused remediation.** The block gains **Q6** (internal carrier shape, §6/Q6)
> and loses the conditional Q4 spelling: O-1/O-2/O-3 were discharged SAFE from source (§Q4.6), so
> `label:unresolved-floor` is now unconditional and the underscore alternative
> `label:unresolved_floor` is **removed from the ballot entirely** — it is not a selectable answer,
> not a fallback, and not pre-authorized anywhere in this packet.
>
> **Amended again in the R2 collateral-and-vocabulary remediation.** The **answers are unchanged** —
> Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A all stand exactly as
> balloted. What changed is the scope statement attached to them: the committed-test-edit line was
> rewritten **at that revision** to read **rows P1–P5, six rows / eight ranges / three files**
> instead of the inconsistent "P1–P4 … five rows" — **a count since superseded by the paragraph
> below**, which withdraws P1 — and the Q4 legend now carries the **coexistence** relationship to the
> already-occupied `label:floor-invalid`. Both are corrections to what the answers *entail*, not to
> the answers. No option was added to or removed from any ballot line.
>
> **Amended again in the R2 classification-and-carrier remediation.** The **answers are once more
> unchanged** — Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A. **No option
> was added to or removed from any ballot line, and no new question was added to the ballot.** What
> changed is again the scope statement: the committed-test-edit line now reads **rows P2–P5, five
> rows / seven ranges / three files** (row P1 is withdrawn from the count as a no-edit preflight),
> and the block gains an explicit line recording the **§6.1** decision that the ingest parser
> carrier `PayloadFloor` does **not** change — a decision the coordinator is being asked to note,
> not to select between. Both are corrections to what the answers *entail*.
>
> **Amended again in the R2 prose-collateral-and-path-distinction remediation. The answers are
> unchanged for a fourth time** — Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B,
> Q6 = A. **No option was added to or removed from any ballot line, and no new question was added.**
> The **count is also unchanged — still five rows / seven ranges / three files.** What changed is
> again the scope statement: row **P2**'s single range now reads **≈408–422** (widened at its start
> to take in `TestLabelFloorHelper`'s committed docstring, still one range); the Phase-1 scope line
> is corrected to **allowlist entries 5–7 only, under every Q5 answer**; and the ingest-carrier line
> gains the **path distinction** — on ingest, Q1 (iii) and Q2 (ii) are parser-indistinguishable and
> `label:floor-invalid` coexists, while the `unresolved-floor`-alone shape is **correlation-only**.
> All three are corrections to what the answers *entail*.
>
> **Amended again in the R2 driver-taxonomy-and-carrier-chain remediation. The answers are
> unchanged for a fifth time** — Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B,
> Q6 = A. **No option was added to or removed from any ballot line, and no new question was added.**
> The **count is also unchanged — still five rows / seven ranges / three files.** What changed is
> again the scope statement, in four places. **(1) Driver taxonomy:** the line reading
> "P2/P2b/P3/P4 = compatibility updates forced by Q6" is **withdrawn as wrong**. `P2b` alone is the
> pure Q6 compatibility row; **P2** is a mixed policy + committed-prose + Q6-carrier re-expression;
> **P3** is a **Q2** policy re-expression (Q4 for the token) and **P4** a **mixed Q1/Q4 policy row**
> that is **not tuple-shaped**. **(2) Carrier chain:** the block now records the five decided hops
> inside Q6 = A, with the wire still at two keys. **(3) Anchor precision:** P2's ≈408 is the class
> declaration and ≈409–410 the committed docstring; the range is unchanged at ≈408–422. **(4) A
> third no-edit pin:** **N2**, the `LabelFloor("khong_mat", None)` equality at ≈509–512, unchanged
> and passing because the new internal field defaults to `False`. All four are corrections to what
> the answers *entail*, not to the answers.
>
> **Amended again in the R2 runtime-topology remediation. The answers are unchanged for a sixth
> time** — Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A. **No option was
> added to or removed from any ballot line, and no new question was added.** The **count is also
> unchanged — still five rows / seven ranges / three files.** What changed is the **factual ground
> the ballot is read against**, in three places. **(1) Runtime topology:** the block now states the
> **three surfaces** of §5.0 — A live and ungated, B live-call-sites/feature-gated, C source
> implemented but **NOT RUNTIME-WIRED** — replacing the withdrawn single "M1 is live" claim.
> **(2) Q2's ground:** the Q2 legend is re-grounded on the **live feature-gated ingest path**
> instead of on correlation runtime liveness; **the answer, A, is unchanged**, and so is the NO-GO
> on B. **(3) A fourth no-edit pin:** **N3**, the committed **exact-key-set** assertion on the
> canonical `label_floor` block at ≈533–535, unchanged and passing because the Q6 field never
> reaches the wire. All three are corrections to what the answers rest on and entail, **not** to the
> answers.
> **↑ HISTORICAL — WRONG IN PART — SUPERSEDED BY THE EIGHTH REMEDIATION (amendment below).** Its
> item **(1)** (three surfaces; C *NOT RUNTIME-WIRED*) and its item **(2)** (Q2 re-grounding) are
> **false at `d3aaf6f`** and are corrected by the eighth amendment. Item **(3)** (pin **N3**) stands.
> This paragraph is retained as provenance of a failed correction and is **not current guidance**.
>
> **Amended again in the R2 measured-topology remediation — the EIGHTH amendment, and it EXPLICITLY
> SUPERSEDES the seventh amendment immediately above in both its topology and its Q2 items. The
> answers are unchanged for a seventh time** — Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`,
> Q5 = B, Q6 = A. **No option was added to or removed from any ballot line, and no new question was
> added.** The **count is also unchanged — still five rows / seven ranges / three files**, with
> **P1/N1/N2/N3** as four no-edit pins outside it. What changed is the **factual ground the ballot is
> read against**, and this is the first amendment written from **direct measurement of the SOC source
> worktree** rather than from a carried review — so where it contradicts the seventh amendment, **it
> governs**. In four places:
> **(1) Runtime topology — THREE SURFACES becomes FOUR.** The block below now states the **four**
> surfaces of §5.0: **A** connector-config label application (code-reachable, ungated); **B** payload
> `label_floor` application (code-reachable from `service.py` / `pf_bridge.py`, gated on the exact
> boolean `True`); **C** **PF event-label production and forwarding — DEPLOYMENT-WIRED**; **D**
> **correlation/engine — SOURCE-IMPLEMENTED AND DEPLOYMENT-WIRED** through the PF worker, still
> **excluded from the mounted SIEM HTTP API**. The seventh amendment's **NOT-RUNTIME-WIRED**
> classification, its **no-worker** claim and its **NO DEPLOY-EFFECT CLAIM** instruction are
> **removed as false**, not softened.
> **(2) Q2's legend is re-grounded normatively, at the actual boundary.** The seventh amendment's
> ground — correlation liveness withdrawn, absence "universal", floor-absent the "bulk / ordinary"
> shape — is **withdrawn in full**: the deployed PF normalizer **synthesizes** a `labels` block on
> every normalized document, the SIEM matcher **forwards** it, and the Alert Writer **requires**
> `label_floor` and rejects a missing or out-of-scale one. **Absence is neither universal nor bulk
> nor ordinary.** The replacement ground is stated in the Q2 legend below and is normative, not
> volumetric. **Q2 = A is unchanged, and the Q2 = A / Q2 = B NO-GO assessment on B is unchanged.**
> **(3) The flag is API-settable but never auto-assigned.** *Nothing automatically assigns*
> `label_floor_enforce`; **an authorized connector create/update API call can set it**
> (`connector/api.py::validate_lc_config` — allowlist 95, boolean check 110–112, invoked by
> `ConnectorIn._config` ≈178–181 and `ConnectorUpdate._config` ≈198–201). Every *CLI-only* /
> *human-bootstrap-only* wording is **withdrawn**, and so is any reading of "nothing in source sets
> the flag" as "there is no authorized setter". **M2 is NOT IMPLEMENTED at this base** — at `d3aaf6f`
> `connector/bootstrap.py` contains no `label_floor_enforce` occurrence at all.
> **(4) No observation is claimed.** "Deployment-wired" means **packaged, declared and constructed in
> source**. **No `pf-correlation` instance is asserted to be currently running or
> production-observed**, and **tests are not runtime evidence** (§8.7). All four are corrections to
> what the answers rest on and entail, **not** to the answers.

The R2 lane opens on the following, and nothing more. **Answering Q1–Q4 and Q6 opens Phase 1 and
nothing further** — Phase 2 requires the *separate* coordinator grant specified in **§7.1**, which
is not granted by any answer here. Answering Q5 additionally settles whether Phase 3 stays in the
lane and therefore how many paths the allowlist has.

```
W1-I03 R2 = MO (open), lane:
  base     d3aaf6fb29c57f145de8f131ad1588aae57d57c9
  branch   codex/w1-i03-marking-floor-r2
  worktree new, under cybrik-worktrees/w1-48/, NOT w1-i03-marking-floor-r1
  allowlist per packet §2.1 = 8 paths if Q5=A; 6 paths (entries 1-3, 5-7) if Q5=B
  services/api/.coverage    = TU CHOI (denied, unconditional, §2.2)
  runtime topology          = FOUR SURFACES (§5.0), measured directly at d3aaf6f by
                              the EIGHTH remediation. The single "M1 is live"
                              framing is WITHDRAWN, and so is the seventh
                              amendment's THREE-SURFACE A/B/C model: it declared the
                              correlation path NOT RUNTIME-WIRED with no worker and
                              no producer of event labels, and ALL OF THAT IS FALSE
                              AT THIS BASE. NOT-RUNTIME-WIRED, the no-worker claim
                              and the NO-DEPLOY-EFFECT instruction are REMOVED.
                              A = connector-config label application: CODE-REACHABLE
                                  / LIVE-CALL-PATH, UNGATED. service.py,
                                  pf_bridge.py AND source_health_worker.py all apply
                                  connector config labels on inbound records. Q1-Q4
                                  do not change this surface.
                              B = payload label_floor application: CODE-REACHABLE
                                  FROM service.py AND pf_bridge.py ONLY, GATED ON
                                  THE EXACT BOOLEAN True for label_floor_enforce;
                                  absent / False / 1 / "true" are all OFF.
                                  FLAG PROVENANCE, BOTH HALVES REQUIRED: NOTHING
                                  AUTOMATICALLY ASSIGNS THE FLAG - no startup
                                  convergence, no worker, no CI path, no True
                                  default - BUT AN AUTHORIZED CONNECTOR
                                  CREATE/UPDATE API CALL CAN SET IT
                                  (connector/api.py::validate_lc_config allowlists
                                  it at 95, boolean-validates at 110-112, invoked by
                                  ConnectorIn._config ~178-181 and
                                  ConnectorUpdate._config ~198-201). "Nothing in
                                  source sets the flag" means NO AUTOMATIC
                                  ASSIGNMENT - it does NOT mean there is no
                                  authorized setter. CLI-only / human-bootstrap-only
                                  wordings are WITHDRAWN.
                                  source_health_worker.py calls
                                  apply_label(fields, config) with NO payload_floor
                                  and is NOT on this surface.
                              C = PF event-label PRODUCTION AND FORWARDING:
                                  DEPLOYMENT-WIRED. normalizer.py::
                                  resolve_label_floor (188-232) ALWAYS returns a
                                  labels block with classification defaulting to
                                  khong_mat, and normalize_envelope writes
                                  doc["labels"] on EVERY normalized document (326);
                                  siem_matcher.py forwards event['labels'] into
                                  project_event (660-662) and build_detection (680).
                                  A PRODUCER DOES POPULATE event labels,
                                  unconditionally. ABSENCE IS NOT UNIVERSAL, NOT
                                  BULK AND NOT THE ORDINARY SHAPE on this path.
                              D = correlation/engine label reading
                                  (_label_of_event, engine.py): SOURCE-IMPLEMENTED
                                  AND DEPLOYMENT-WIRED through the PF worker.
                                  correlation_processor.py constructs
                                  CorrelationEngine (334) and calls _ingest_one
                                  (483); packaged as the console script
                                  pf-correlation (ops/pf-workers/pyproject.toml:40);
                                  declared as a service in
                                  deploy/pf/docker-compose.pf-workers.yml ~99-119
                                  and docker-compose.pf-demo.yml ~109-114. A CHANGE
                                  TO THE CORRELATION SOURCE CAN AFFECT THE PACKAGED
                                  pf-correlation WORKER ON A DEPLOYMENT THAT RUNS
                                  THAT SERVICE. The mounted SIEM HTTP API STILL
                                  EXCLUDES correlation (siem/api.py:25-27) - that
                                  exclusion survives. The same docstring's "khong
                                  worker wire" (line 26) is STALE DOCUMENT EVIDENCE
                                  and may NOT be cited as current truth.
                                  NOT CLAIMED, AND MAY NOT BE: that any
                                  pf-correlation instance is currently RUNNING or
                                  PRODUCTION-OBSERVED. Deployment-wired means
                                  PACKAGED, DECLARED AND CONSTRUCTED IN SOURCE.
                                  TESTS ARE NOT RUNTIME EVIDENCE (§8.7).
                              M2 = connector bootstrap convergence: NOT IMPLEMENTED
                                  AT THIS BASE. At d3aaf6f connector/bootstrap.py
                                  contains NO label_floor_enforce and NO
                                  FLOOR_ENFORCE_FLAG occurrence at all;
                                  ensure_internal_alert_writer_connector (67) writes
                                  only config={"description": ...} (98). The claim
                                  that current M2 writes True is REMOVED AS FALSE.
                                  There is NO automatic and NO bootstrap convergence
                                  implementation at this base.
  grant scope               = Phase 1 only. Phase 2 needs the separate §7.1 grant.
                              Q5=A retains Phase 3 in the lane but does not start it:
                              strict phase ordering (§7) keeps it behind that same grant.
  Phase 1 paths             = allowlist entries 5-7 ONLY, under EVERY Q5 answer.
                              Entry 8 (test_alert_writer_bootstrap.py) is NEVER a
                              Phase-1 path: under Q5=A its tests are §8.3 group D
                              and are Phase 3 work; under Q5=B it leaves the lane.
                              NO Phase-1 integration test exists under any answer
                              (§7, §8.1, §8.5). The earlier "entries 5-7 plus 8 only
                              if Q5=A" Phase-1 wording is WITHDRAWN.
  committed-test edits      = §8.2 rows P2, P2b, P3, P4, P5 only = FIVE rows across
                              SEVEN approximate ranges in THREE files, inside
                              allowlist entries 5-7.
                              (P2b names two ranges; P5 names two; P2/P3/P4 one each.)
                              P2 = test_siem_correlation.py ~408-422, ONE contiguous
                              range. ~408 is TestLabelFloorHelper's CLASS
                              DECLARATION; the COMMITTED DOCSTRING itself is
                              ~409-410, stating the superseded junk/absent ->
                              DEFAULT khong_mat rule. That prose is superseded
                              INVARIANT TEXT, not decoration: it is rewritten to the
                              decided invariants with the same precision and
                              evidenced VERBATIM pre/post, exactly like P5's ~12-13
                              docstring. The class declaration itself does NOT
                              change. P2 also carries P2b's Q6 COMPLETENESS rule:
                              every classification and monitored_system fact stays
                              asserted, and `unresolved` is asserted explicitly -
                              False for the ABSENT case, True for EACH present
                              malformed / present-unmappable fail-closed case.
                              DRIVER TAXONOMY (corrected - the earlier
                              "P2/P2b/P3/P4 = compatibility updates forced by Q6"
                              line is WITHDRAWN as wrong):
                                P2b = the ONLY pure Q6 shape-compatibility row
                                      (~424-427, ~429-432): the reader stops
                                      returning a tuple; the POLICY those blocks
                                      encode is unchanged.
                                P2  = MIXED policy + committed prose + Q6 carrier
                                      re-expression.
                                P3  = test_siem_correlation.py ~484-491: a POLICY
                                      re-expression forced by Q2=A, NOT a Q6
                                      compatibility edit. The block mixes an ABSENT
                                      contributor with a NON-STRING INVALID
                                      contributor; under Q2=A the accepted invalid
                                      contributor FAILS CLOSED, so the derived
                                      classification becomes toi_mat and the
                                      unresolved tag/state is PRESENT. Changed
                                      outcome = RED-REQUIRED (Q2; Q4 for the exact
                                      token); the absent contributor's rank-0
                                      contribution and MAX-monotonic ordering stay
                                      regression-lock. The closing-delimiter
                                      authorization at ~491 is PRESERVED, now as the
                                      syntactic consequence of a POLICY edit.
                                P4  = test_siem_engine.py ~227-236: a MIXED POLICY
                                      row holding TWO tests, NOT tuple-shaped, and
                                      Q6 forces NO mechanical shape edit on it.
                                      ~227-230 absent-label test: UNCHANGED outcome,
                                      khong_mat, no unresolved -> REGRESSION-LOCK.
                                      ~232-236 top_secret present-unmappable test:
                                      becomes toi_mat + the unresolved tag ->
                                      RED-REQUIRED (Q1; Q4 for the token).
                                P5  = test_ingest_label_floor.py, docstring
                                      invariants ~12-13 and the parametrized case
                                      group ~134-148: a POLICY re-expression forced
                                      by Q1=A/Q2=A, not a compatibility edit. Path 5
                                      is additive PLUS P5, not additive-only.
                              Every claim that P3/P4 policy is unchanged, that they
                              are Q6-forced compatibility edits, or that P4 carries a
                              tuple-shaped expectation is WITHDRAWN.
                              No assertion weakening in any row. label:floor-invalid
                              is RETAINED alongside label:unresolved-floor
                              (coexistence, §Q4.4.2) and is REGRESSION-LOCK.
                              handling:restricted is NOT retained base behaviour on
                              the malformed / present-unmappable cases - the base
                              emits none there - so it is a NEW, RED-REQUIRED
                              (Q1/Q2) expectation created by the fail-closed
                              toi_mat outcome. Different classes, not a pair.
  no-edit invariants        = §8.2.1. P1 = test_siem_correlation.py ~17: the import
                              ALREADY binds _label_of_event; VERIFY ONLY, no edit,
                              not counted above. _EventLabelReading must NOT be
                              imported in Phase 1 (collection error, §8.6 item 20).
                              N1 = test_ingest_label_floor.py ~355: the committed
                              three-field PayloadFloor equality stays UNCHANGED and
                              PASSING. A pin, not an authorized edit.
                              N2 = test_siem_correlation.py ~509-512: the committed
                              LabelFloor("khong_mat", None) equality stays UNCHANGED
                              and PASSING - it holds ONLY because the internal
                              unresolved field DEFAULTS to False (Q6=A step 3). A
                              pin, not an authorized edit; NOT counted above. If it
                              would need an edit, or the False default is lost, the
                              writer STOPS (§8.6 item 10d).
                              N3 = test_siem_correlation.py ~533-535: the committed
                              EXACT-KEY-SET assertion on the canonical label_floor
                              block stays UNCHANGED and PASSING. It is the committed
                              executable form of Q3=A and Q6 step 4 - the internal
                              unresolved field NEVER reaches the wire, so an exact
                              two-key assertion stays true with no edit. It PROTECTS
                              Q3=A and Q6 step 4. A pin, NOT an authorized edit; NOT
                              counted above - it changes NEITHER the five-row NOR
                              the seven-range accounting. If it would need an edit -
                              a third key admitted, the exactness relaxed - the
                              writer STOPS (§8.6 item 10d(d)).
  correlation carrier chain = Q6=A, INTERNAL end to end, five decided hops (§6/Q6):
                              1 _label_of_event returns the immutable typed
                                _EventLabelReading (classification,
                                monitored_system, unresolved), consumed BY NAME.
                              2 _GroupState gains label_unresolved: bool = False,
                                accumulated by MONOTONIC OR over EVERY accepted
                                contributor; it NEVER self-clears - not on a later
                                valid contributor, not on entry eviction.
                              3 the internal frozen LabelFloor gains
                                unresolved: bool = False as a DEFAULTED field, and
                                effective_label_floor() carries the group bool into
                                it. The False DEFAULT IS BINDING so every existing
                                2-/3-argument construction and equality stays valid
                                (pin N2).
                              4 LabelFloor.to_canonical() under Q3=A keeps EXACTLY
                                the two current keys (classification,
                                monitored_system) and does NOT expose unresolved on
                                the wire. DerivedAlert.canonical() emits the exact
                                tag label:unresolved-floor when the internal
                                floor.unresolved is true.
                              5 the direct-engine path constructs LabelFloor with
                                reading.unresolved; absent and valid readings keep
                                false.
                              Codebase-equivalent PRIVATE names are allowed ONLY if
                              semantics, the False default, the OR accumulation and
                              the wire behaviour are identical. The carrier shape is
                              NOT left undecided at any hop (§8.6 item 10d).
                              Tests 8/9 assert THROUGH this chain: group bool true,
                              effective internal LabelFloor unresolved true, the OR
                              never clearing, wire still two keys plus the tag.
  ingest parser carrier     = UNCHANGED (§6.1). PayloadFloor keeps its three fields
                              (classification, system, invalid). NO unresolved field
                              is added, NO arity change, NO §8.2 row P6. The
                              unresolved fact is derived at the POLICY layer from the
                              existing (invalid, classification) pair, and tests
                              1/2/3b/3c/3d assert at effective_labels / apply_label.
                              A defective AUXILIARY field on a valid mappable
                              classification is label:floor-invalid only - NOT
                              classification-unresolved, NO fail-closed escalation.
  ingest vs correlation     = §6.1.1. On INGEST, Q1(iii) out-of-scale/unmappable and
                              Q2(ii) malformed are INTENTIONALLY parser-
                              indistinguishable after resolve_payload_floor: both
                              return invalid=True / classification=None and route
                              through the SAME policy branch to the SAME outcome. No
                              ingest state with classification non-None and outside
                              LABELS is reachable. label_rank RAISES ValueError on
                              out-of-scale input, so the `label not in LABELS` guard
                              is CRASH PREVENTION and MUST NOT be weakened to make a
                              conceptual branch reachable (§8.6 item 10c).
                              The "present but unmappable, classification non-None"
                              branch is CORRELATION-ONLY, because _label_of_event
                              reads event['labels'] directly, before policy
                              resolution. Consequently label:unresolved-floor WITHOUT
                              label:floor-invalid is a CORRELATION-path shape only;
                              on INGEST the parser marks the payload invalid and
                              label:floor-invalid COEXISTS. Outcomes are unchanged.

Q1 present + well-formed + unmappable value = A | B          [recommended: A]
Q2 absent  vs  present-but-malformed        = A | B          [recommended: A]
Q3 wire representation of `unresolved`      = A | B          [recommended: A]
Q4 tag namespace + exact token              = label:unresolved-floor
                                            | <other exact token>
                                                             [recommended: label:unresolved-floor]
Q5 bootstrap convergence                    = A | B          [recommended: B]
Q6 internal carrier for `unresolved`        = A | B          [recommended: A]
```

Every `[recommended: …]` is a **preselected default for coordinator review**, not a decision
already taken (§10). Leaving one unanswered is not consent to it.

Legend, for the record:

- **Q1** — *present, well-formed, unmappable value only* (§6/Q1; absence and malformation are Q2).
  `A` = fail-closed to top-of-scale `toi_mat` + explicit unresolved signal (R1's choice);
  `B` = quarantine with no QD-13 classification assigned (needs a new disposition state that does
  not exist today).
  **Q1 and Q2 stay separately answerable, but their cases are not separately *observable* on
  ingest.** After `resolve_payload_floor`, Q1 (iii) and Q2 (ii) are collapsed into one
  `(invalid = True, classification = None)` state and route through the same policy branch; under
  Q1 = A / Q2 = A they mandate the same ingest outcome, so nothing is lost. The distinction is
  observable only on the **correlation** path (§6.1.1). Answering the two questions *differently*
  is what would force the parser to tell them apart — and that is a re-scope, not a writer task.
- **Q2** — the **absent vs present-but-malformed split** (§6/Q2).
  `A` = split by presence: **absent** block stays rank-0 `khong_mat` with **no** unresolved signal;
  **present but malformed** (block not a mapping, or `classification` non-string / empty /
  whitespace-only) **fails closed to `toi_mat`** with the unresolved signal set.
  `B` = uniform fail-closed, absence included — assessed **NO-GO at base `d3aaf6f`**. **That
  Q2 = A / Q2 = B NO-GO assessment is unchanged by the eighth remediation.**
  **↓ THE GROUND IS REPLACED — the seventh amendment's legend is HISTORICAL, WRONG, SUPERSEDED BY
  THE EIGHTH REMEDIATION.** Two successive grounds are withdrawn: the first argued from *"absence is
  the universal state on the **live** correlation/engine path, so B raises substantially every
  derived alert on first deploy"*; the second (seventh amendment) kept the volume argument, moved it
  to ingest, and rested on *"surface C is **not runtime-wired** and raises nothing on deploy"* plus
  *"floor-absent is the **bulk / ordinary** shape of a flag-enabled tenant's traffic"*. **Both are
  withdrawn** — the correlation path **is** deployment-wired, and this packet has never measured any
  traffic volume and may not claim one.
  **The operative ground, normative and stated at the actual boundary:**
  - **The deployed PF normalizer *synthesizes* labels.** `normalizer.py::resolve_label_floor`
    (188–232) always returns a `labels` block whose `classification` defaults to `khong_mat`
    (215–219), and `normalize_envelope` writes it onto **every** normalized document (326).
  - **The SIEM matcher *forwards* them.** `siem_matcher.py::project_event` (660–662) and
    `build_detection` (680) carry `event['labels']` onward to surface **D**.
  - **The Alert Writer *requires* `label_floor`.** `alert_writer.py::validate_envelope` (229)
    **rejects** a missing or non-mapping `label_floor` (264–266) and an out-of-scale
    `classification` (267–271), so for that producer **absence is unreachable**.
  - **Therefore absence is NOT universal, NOT bulk and NOT the ordinary shape.** Every claim to the
    contrary is withdrawn, and no answer here rests on one.
  - **`A` preserves missing-metadata compatibility** for the inputs where absence genuinely occurs —
    **direct engine/helper inputs** (`correlation.py::_label_of_event` defaults to `DEFAULT_LABEL`
    when `labels` is absent, 70–75), **envelope-v1 shapes** (`correlation.py:51–53`), and **any
    producer outside the normalized contract** (backward-compatible, direct, manual, third-party).
    Under **A**, *absent means no asserted source floor* — not evidence of a malformed or unmappable
    assertion — so those records stay rank-0 `khong_mat` with no unresolved signal, exactly what the
    base already produces.
  - **`B` fails on two grounds, neither volumetric.** **(1) Semantic conflation:** it collapses
    *"the source asserted nothing"* into *"the source asserted something present but malformed or
    unmappable"*, destroying at the analyst's decision point the distinction Q1 = A depends on.
    **(2) Unmeasured compatibility blast radius:** it changes the meaning of the silent default that
    every unenumerated producer lands in by doing nothing; that producer set is **not enumerated at
    this base** and this packet has neither the authority nor the measurement to enumerate it. A
    blast radius that is *unknown* — rather than known-large or known-small — is not a risk the
    coordinator can price.
  **Precision, so nothing is over-read:** with the flag off — the default — neither answer changes
  what ingest produces, so this is **not** a claim that every currently ingested alert is affected;
  **nothing automatically assigns `label_floor_enforce`, though an authorized connector
  create/update API call can set it** (§5.2); and **no claim is made that any `pf-correlation`
  instance is currently running or production-observed** — surfaces **C**/**D** are
  **deployment-wired**, which raises the stakes of the correlation semantics without asserting an
  observed runtime (§5.1.2, §8.7).
  B stays on the ballot for override; the NO-GO is this packet's assessment, not a removal of the
  option.
  **Q2 = A is held on the normative ground above, which does not expire.** The earlier framing —
  *"a scoped deferral … it **reopens automatically** the moment an accepted producer starts
  populating event `labels`"* — is **withdrawn**: a producer **already does**, unconditionally, so
  that condition has **already fired** and the deferral it guarded is spent. What remains is a
  **standing, accepted residual**: the omission attack survives (stripping the block still lands at
  rank 0) and A creates a behavioural cliff on a flag-enabled tenant. Mitigating omission needs a
  **provenance** control, not a re-reading of absence (§6/Q2).
- **Q3** — `A` = tag-only, the emitted `label_floor` wire shape stays **exactly two keys**
  (`classification`, `monitored_system`) — R1's choice, and the only shape that keeps the R2 lane
  out of the `cybrik-correlated-2` envelope contract;
  `B` = add an explicit third key to `label_floor` (an envelope-contract change, above the R2
  writer's authority under contract-first). **Q3 = A is only viable if Q4 delivers a retrievable
  token** — under A the tag *is* the entire signal. **Q3 is the wire only; the in-process carrier
  is Q6** and is not settled by answering this.
- **Q4** — the tag namespace **and the exact token** for the unresolved-floor signal.
  Recommended: **`label:unresolved-floor`**. `label:` is collected by `datalake/es_adapter.py` —
  measured from source by the R2 final read-only review (class **R**) — so the tag survives into
  the searchable `labels` projection and Q3 = A stays a real signal; it is the SOC-internal QD-13
  axis; and it is not a name the accepted marking contract owns.
  - **`marking:` — REJECTED** (§Q4.2), on two independent grounds: it is **dropped** from the
    searchable projection (matching none of the collected prefixes), which under Q3 = A discards
    the whole signal; and it squats the name of the **accepted** `cybrik.data-marking.v1` contract
    on a different axis. This is a change from R1, whose token was `marking:floor-unresolved`.
  - **`handling:` — REJECTED** (§Q4.3): `handling[]` is a first-class field of that accepted
    contract, and `handling:` **is** collected — so the conflation would be imported into search
    results under a contract-owned name.
  - **The occupied vocabulary, and the decided relationship to it** (§Q4.4.1/§Q4.4.2, class **R**,
    source-derived at `ingest/source_labels.py:207–217`). The space already contains
    `label:config-invalid`, `label:floor-invalid`, `label:{level}` (the QD-13 values),
    `system:{…}` and `handling:restricted`. The decided relationship is **COEXISTENCE**, not
    supersession and not mutual exclusion: **`label:floor-invalid` stays** as the
    backward-compatible **payload-layer defect diagnostic** — it fires on a raw parse/shape failure
    **or** on a **defective auxiliary field** (e.g. a junk `monitored_system`) accompanying an
    otherwise valid classification, and is **not** limited to classification parse failure (§6.1) —
    and **`label:unresolved-floor` is the policy/audit marker** that the present asserted
    floor/label could not be mapped and was fail-closed. On a **malformed raw ingest floor both are
    emitted, each exactly once**, together with `label:toi_mat` and `handling:restricted`.
    **`unresolved-floor` may appear *without* `floor-invalid` on the CORRELATION path only** —
    where `_label_of_event` reads `event['labels']` directly, before policy resolution, so a
    present, well-formed, out-of-scale value reaches the decision **non-`None`** and no
    payload-layer defect diagnostic exists. **On the INGEST path that shape does not occur:**
    `resolve_payload_floor`'s `label not in LABELS` guard marks such a payload `invalid = True` /
    `classification = None`, so **`floor-invalid` coexists there for Q1 (iii) exactly as it does
    for Q2 (ii)** (§6.1.1). Any unqualified "present-unmappable emits the new token alone" reading
    is correlation-only. **And in the converse case — a valid,
    mappable classification with only a defective auxiliary field — `floor-invalid` appears
    *without* `unresolved-floor` and with no fail-closed escalation** (§6.1, pinned by §8.3 test
    3d). They are deliberately distinct tokens at different layers, **not duplicate spellings** —
    answering Q4 does **not** deprecate or remove `label:floor-invalid`, and a writer that stops
    emitting it has exceeded this answer.
  - **The token is unconditional.** O-1, O-2 and O-3 were **discharged SAFE** from source by the
    independent R2 final read-only review (§Q4.6): the hyphen is legal at both emit sites and the
    token is collected into the searchable projection; nothing in SOC collides with
    `label:unresolved-floor` or the `label:unresolved*` prefix; and `forbidden_label_tags` is a
    closed enumeration, so the token is in no clearance's `must_not` and changes clearance for
    nobody. **The underscore form `label:unresolved_floor` is withdrawn** — it is not a selectable
    answer, not a fallback, and not pre-authorized. `label:unresolved-floor` is the sole selected
    token. If any of the three properties fails to hold at the base actually opened, that is
    base drift and a **stop** (§8.6 item 9): the writer does not revert to
    `marking:`/`handling:`, does not invent a fourth prefix, and does not rename on its own
    authority.
- **Q5** — `A` = bootstrap convergence stays in the R2 lane (allowlist entries 4 and 8 retained,
  8 paths); `B` = convergence moves to a separate Alert Writer lane (allowlist reduces to entries
  1–3 and 5–7, six paths). **Q5 is about M2 only** (§5.0, §5.2) — an *automatic* convergence step
  that **does not exist at this base**. Neither answer changes surfaces **A**, **C** or **D**, and
  **neither is required to make surface B settable**: an authorized connector create/update API call
  already can set `label_floor_enforce`, and that is ordinary configuration, **not** convergence.
  Under B the R2 lane still edits code behind **code-reachable** ingest callers **and** behind a
  **deployment-wired** PF worker path, so it **must not be presented to reviewers as a no-op lane**.
  **The seventh amendment's qualifier — "it must not be presented as taking effect on correlation on
  deploy, because surface C is not runtime-wired" — is HISTORICAL, WRONG and SUPERSEDED BY THE
  EIGHTH REMEDIATION:** surfaces **C**/**D** are **deployment-wired**, and a Phase-2 change to
  `correlation.py` / `engine.py` **can affect the packaged `pf-correlation` worker on a deployment
  that runs that service** (§5.1.2, §8.7). The only overreach still forbidden in that direction is
  claiming an instance is **currently running** or **production-observed**. The older legend
  sentence — "under B the R2 lane still ships a **live** label-resolution behaviour change on ingest
  **and correlation**" — was withdrawn as to correlation by the seventh amendment; **that withdrawal
  is itself now withdrawn**, and the accurate wording is **deployment-wired, not observed-live**.
- **Q6** — the **internal carrier** for the unresolved fact: what
  `siem/correlation.py::_label_of_event` returns and what correlation/engine pass between
  themselves (§6/Q6). **Separate from Q3**, which governs only the wire.
  `A` = a single **immutable typed value object** — a frozen dataclass (or the codebase's
  equivalent value-object idiom) named **`_EventLabelReading`**, module-private to
  `siem/correlation.py`, with exactly three named fields `classification`, `monitored_system`,
  `unresolved`, returned by `_label_of_event` and consumed **by attribute name** in correlation and
  engine — never positionally;
  `B` = a **positional 3-tuple**, the third element carrying `unresolved`. B is a documented,
  selectable alternative, **not** recommended: the third positional element is the safety fact, and
  it is the single easiest thing to drop silently (a two-element unpack, a `_` placeholder), which
  fails in the safe-looking direction because the level still reads correctly.
  **Not decided by Q6 = A, and left to the writer:** decorators, field ordering, defaults, and any
  convenience helpers. **Decided by it:** one immutable carrier, those three named fields, consumed
  by name.
  **Consequences of answering Q6, so they are visible on the ballot:** it fixes the content of the
  §8.2 committed-test edits — specifically **row P2b**, the **one pure Q6 shape-compatibility row**,
  and **row P2**, which is **mixed** (Q1/Q2 policy plus committed invariant prose) and additionally
  carries the **Q6 completeness rule**. **Row P4 is not one of them.** P4 is a **mixed Q1/Q4 policy**
  re-expression, it is **not tuple-shaped**, and **Q6 forces no mechanical shape edit there** — see
  the §8.2 row-driver taxonomy corrected by the sixth remediation (P2b = Q6 only; P2 = mixed;
  P3 = Q2 policy with Q4 for the token; P4 = mixed Q1/Q4 policy; P5 = Q1/Q2 policy plus Q4
  vocabulary). **The earlier pairing *"rows P2b and P4 in particular"* is WITHDRAWN AS WRONG by the
  ninth remediation**, which contradicted that taxonomy by re-attaching a Q6 driver to P4. **No
  other consequence of answering Q6 changes.** It is a **Phase-1 gate** (§7) —
  Phase 1 cannot be written without it. It does **not** authorize creating the carrier;
  `_EventLabelReading` lives in source path 2 and stays behind the §7.1 grant. **Q6 governs the
  correlation side only.** The **ingest** parser carrier `PayloadFloor` is decided separately and
  is **not changed** — see the `ingest parser carrier` line in the block above and **§6.1**. That
  is a recorded coordinator decision, not a ballot line: there is nothing to select, and a writer
  that treats Q6 = A as licence to add an `unresolved` field on the ingest side has exceeded both.

**What this text does not grant.** It does not open Phase 2 (§7.1), does not authorize a single
source byte, does not accept any contract, does not authorize a migration, and does not commit,
stage or push anything. Anything not on this list stays **held**. In particular, Phase 4
(re-vendoring / alert-context binding) additionally requires acceptance **and** integration of the
corrected C1/G1 chain, and Phase 5 (canonical marking, marking profile, PostgreSQL migration, RLS,
and any population of the accepted contract's `origin_marking`) requires its own grant —
MARK-001 Option A does not authorize it, and its gate definitions are not yet citable (§3.2).

---

## 12. Verification log for this packet

All commands below were read-only. Rows carrying a measured value were measured on 2026-07-29.
The log deliberately also records what **this session** did not measure itself — a verification
log that lists only its own successes reads as completeness it does not have. Each row carries its
provenance class from the header table: **S** (session-verified by a pass with read access to the
repository named), or **R** (measured from source by an independent read-only review and carried
verbatim). **No row is class O.** The former O-1/O-2/O-3 rows were open obligations in an earlier
revision; the R2 final review measured all three from source and they are now recorded as
**R — SAFE**, with the measured result rather than the obligation. A reader auditing this packet
should treat class **R** rows as review-derived, not as anything this session re-ran.

**Exact source-measurement class for the third (collateral-and-vocabulary) remediation.** That
pass wrote docs only, in this `cybrik-suite` worktree, with **no read access to
`cybrik-soc-command-center`**. The two SOC-side facts it acts on are therefore recorded **class
R**, measured from source by the independent review that returned NO-GO on the second revision and
carried here verbatim: (a) the committed assertions and docstring invariants in
`services/api/tests/unit/test_ingest_label_floor.py` at ≈12–13 and ≈134–148, and (b) the occupied
tag vocabulary emitted at `services/api/src/cybrik_soc/modules/ingest/source_labels.py:207–217`.
**Neither was re-measured by that pass**, and neither is upgraded to class **S**. The two rows it
added below carry class **R** accordingly; §8.2 condition 1 and §8.6 items 7/10b are the
stop-on-drift mechanism that protects them.

**Exact source-measurement class for the fourth (classification-and-carrier) remediation.** Same
posture: docs only, this `cybrik-suite` worktree, **no read access to
`cybrik-soc-command-center`**. The three SOC-side facts it acts on are class **R**, measured from
source by the **third** independent review that returned NO-GO and carried here verbatim: (a) the
`test_siem_correlation.py` import at ≈17 already binds `_label_of_event`; (b) `resolve_payload_floor`
returns the three-field `PayloadFloor` and `test_ingest_label_floor.py` ≈355 commits an equality
against that shape; (c) at `d3aaf6f` the malformed / present-unmappable floor path keeps the
connector-supplied label and emits **no** `handling:restricted`. **None was re-measured by this
pass** and none is upgraded to **S**. Everything else this pass changed — the two test-class
corrections, the §6.1 decision, the accounting, the widened `floor-invalid` gloss, the 6c
tightening — is **derived from those class-R facts plus this packet's own decided answers**, and
is therefore class **S** in the narrow sense that it was counted, cross-checked and reasoned in
this document, **not** that anything SOC-side was re-read. §8.2 condition 1 and §8.6 items
7 / 10b / 10c protect the class-R anchors.

**Exact source-measurement class for the fifth (prose-collateral-and-path-distinction)
remediation.** Same posture a third time: docs only, this `cybrik-suite` worktree, **no read access
to `cybrik-soc-command-center`**. The three SOC-side facts it acts on are class **R**, measured
from source by the **fourth** independent review that returned NO-GO and carried here verbatim:
(a) `test_siem_correlation.py` commits a `TestLabelFloorHelper` **docstring at ≈408–410** stating
that junk or absent labels resolve to the `DEFAULT` `khong_mat`; (b) `resolve_payload_floor`
collapses an out-of-scale/unmappable asserted classification and a malformed one into the same
`(invalid = True, classification = None)` state, so no ingest state with `classification` non-`None`
and outside `LABELS` is reachable; (c) `ingest/source_labels.py::label_rank` **raises `ValueError`**
on out-of-scale input. **None was re-measured by this pass** and none is upgraded to **S**.
Everything else this pass changed — the widened P2 range and its Q6 completeness rule, §6.1.1's
correlation-only scoping, the path-qualification of the coexistence claims, the widened §8.6 items
8 and 10b, and the §7 Phase-1 entries-5–7 correction — is **derived from those class-R facts plus
this packet's own decided answers**, and is class **S** only in the narrow sense that it was
reasoned and cross-checked in this document. §8.2 condition 1 and §8.6 items 7 / 8 / 10b / 10c
protect the new class-R anchors.

**Exact source-measurement class for the sixth (driver-taxonomy-and-carrier-chain) remediation.**
Same posture a fourth time: docs only, this `cybrik-suite` worktree, **no read access to
`cybrik-soc-command-center`**. The five SOC-side facts it acts on are class **R**, measured from
source by the **fifth** independent review that returned NO-GO and carried here verbatim:
**(g)** `test_siem_correlation.py` ≈484–491 exercises a window mixing an **absent** contributor
with a **non-string invalid** contributor; **(h)** `test_siem_engine.py` ≈227–236 holds **two**
tests — absent-label at ≈227–230 and `top_secret` present-unmappable at ≈232–236 — and **neither
carries a tuple-shaped expectation**; **(i)** `test_siem_correlation.py` ≈509–512 commits an
equality against **`LabelFloor("khong_mat", None)`**; **(j)** the ≈408–410 anchor resolves as the
class declaration at ≈408 plus the committed docstring at ≈409–410; **(k)** the correlation window
state is a **`_GroupState`**, the internal floor value is a frozen **`LabelFloor`** with a
**`to_canonical()`** serializer, and the effective floor is computed by **`effective_label_floor()`**.
**None was re-measured by this pass** and none is upgraded to **S**. Everything else this pass
changed — the corrected **P3/P4 drivers** and the §8.2 row-taxonomy table, the **five-step Q6 = A
carrier chain**, the **N2** pin and §8.6 item **10d**, the anchor-precision wording, and the
re-check that the accounting did not move — is **derived from those class-R facts plus this
packet's own decided answers**, and is class **S** only in the narrow sense that it was decided,
counted and cross-checked in this document, **not** that anything SOC-side was re-read. §8.2
condition 1 and §8.6 items 7 / 8 / 10b / 10d protect the new class-R anchors.

**Exact source-measurement class for the seventh (runtime-topology) remediation. ⚠ HISTORICAL —
WRONG IN PART — SUPERSEDED BY THE EIGHTH REMEDIATION.** This paragraph and the one after it record a
**failed** correction. Carried facts **(l)**, **(n)** and **(o)** below are **false at `d3aaf6f`**,
as is every conclusion the seventh pass drew from them — the *NOT RUNTIME-WIRED* classification of
surface C, the withdrawal of deploy-effect claims for the correlation path, the Q2/Candidate-B
re-grounding, and the unqualified *nothing in source sets that flag*. They are retained as evidence
of what was carried and retracted. **No current decision in this packet anchors on them**; the
operative record is the eighth-remediation paragraph and the class-**S** rows that follow. Same
posture a fifth time: docs only, this `cybrik-suite` worktree, **no read access to
`cybrik-soc-command-center`**, and **no runtime, stack, test, coverage or date authority of any
kind**. The **six** SOC-side facts it acts on are class **R**, measured from source by the **sixth**
independent review that returned NO-GO and carried here verbatim: **(l)** the **three-way A/B/C
surface topology** at `d3aaf6f`, replacing the withdrawn single "M1" grouping; **(m)** the caller
inventory stated **by actual call arguments** — `service.py` and `pf_bridge.py` compute and pass
`payload_floor_for(config, parsed)` (**A + B**), while **`source_health_worker.py` calls
`apply_label(fields, config)` with no `payload_floor` argument at all** and is **surface A only**,
**never reading the payload `label_floor` block**; **(n)** that surface B's effect turns on the
**exact boolean `True`** for `label_floor_enforce`, that **nothing in source sets that flag**, that
absent or default is **off**, and that **no in-process caller auto-sets it**; **(o)** that
`SiemEngine` / `CorrelationEngine` have **no in-process production caller and no worker wiring**,
that the **mounted `siem` API excludes correlation**, and that the committed SOC documentation
states **no worker wire exists** — which is what makes surface **C** *SOURCE IMPLEMENTED ·
DIRECT-TESTABLE · NOT RUNTIME-WIRED*; **(p)** the committed **exact-key-set assertion on the
canonical `label_floor` block** at `test_siem_correlation.py` **≈533–535** (pin **N3**); and
**(q)** that the base **already** exercises §8.3 test 3d's valid-mappable-classification-with-
defective-auxiliary-field case and **already** pins `label:floor-invalid` with **no** fail-closed
escalation. **None of the six was re-measured by this writer** — this pass read no
`cybrik-soc-command-center` byte in this cycle, and **could not have**, having no read access to
that repository — and **none is upgraded to S**.

**What the seventh writer read in that cycle, and what it therefore recorded as class S. ⚠
HISTORICAL — SUPERSEDED BY THE EIGHTH REMEDIATION: every conclusion listed in this paragraph that
depends on carried facts (l)/(n)/(o) is withdrawn as false at `d3aaf6f`.** It read
**this file** and the **live `cybrik-suite` git state of that worktree** (branch, HEAD, status,
untracked/staged sets, and this file's own size and hashes), and nothing else. Everything the
seventh pass contributes on top of the class-**R** facts is **document decision and counting**, and
is class **S** only in that narrow sense — decided, counted and cross-checked **in this document**:
the withdrawal of the **"M1 is live"** grouping and of every operative deploy-effect claim about
surface **C**; the re-grounding of **Q2** and of Candidate **B**'s NO-GO onto the **live
feature-gated ingest path** alone (flag off → legacy; exact `True` + floor-absent → rank-0 under
**A**; **B** would overclassify flag-enabled floor-absent events); the recording of **N3** as a
**fourth** no-edit pin with its §8.6 item **10d(d)** stop; the correction of §8.3 test **3d**'s
description to a **regression-lock** re-lock of committed facts plus one negative new-token
assertion; and the re-check that the accounting did **not** move. **No answer, range, class or count
changed**, and §8.2 condition 1 plus §8.6 items 7 / 8 / 10b / 10d protect the new class-**R**
anchors exactly as they protect the older ones.

**Exact source-measurement class for the eighth (measured-topology) remediation — THE OPERATIVE
RECORD, and the posture differs from all seven passes before it.** This pass **held read access to
the SOC source worktree** `cybrik-worktrees/w1-48/w1-soc-secret-scan-remediation-r1` at
`d3aaf6fb29c57f145de8f131ad1588aae57d57c9` and **read that source directly**. Its topology, flag-
provenance and Alert Writer findings are therefore class **S** with exact files and symbols — **not**
class **R**, and **not** carried from the seventh review. **Where the measurement contradicts a
carried class-`R` claim, the measurement governs and the carried claim is withdrawn**; that is what
happened to facts **(l)**, **(n)** and **(o)**. It still wrote **docs only**, still wrote **exactly
one file**, and claims **no runtime, date or stack authority**: *deployment-wired* means **packaged,
declared and constructed in source**, and **no instance is asserted to be running or
production-observed**. **Tests are not runtime evidence.** The seventh independent review returned
**NO-GO (P0 = 3, P1 = 1, P2 = 1, P3 = 2)**; its direction was **confirmed by measurement here**, not
adopted on trust. **This remediation cycle is a continuation of the eighth pass, not a ninth:** the
first cycle installed the four-surface topology and the class-**S** provenance but timed out with
operative seventh-remediation text still standing in §8.7, §11, §6/Q5, §8.3 test 14b and §8.6
item 17; this cycle finished that sweep. **No answer, range, class or count changed in either
cycle.** **This writer did not review its own output**, and nothing in §12 or §12.2 is offered as an
independent PASS.

| Check | Class | Result |
|---|---|---|
| Suite base `eedadc5…` resolves to a commit | **S** | `docs(control): reconcile reviewed local W1 provenance` |
| Branch `codex/w1-d04-i03-marking-r2-gate-r1` pre-existed | **S** | No — `git rev-parse --verify` failed before creation |
| Target worktree path pre-existed | **S** | No |
| New worktree HEAD after creation | **S** | `eedadc561700d3e1fa052322d44eb63151df0009`, branch `codex/w1-d04-i03-marking-r2-gate-r1` |
| New worktree status before writing | **S** | clean, zero staged; target file absent |
| SOC R1 worktree tip | **S** | `87e95cd2add7233176ca442bb5870b5913fdd0eb`, 9 dirty paths, zero staged |
| `services/api/.coverage` tracked | **S** | Yes; not matched by any `.gitignore` rule |
| SOC recommended base `d3aaf6f…` | **S** | clean worktree, zero staged; `87e95cd` is its ancestor, 7 commits behind |
| Eight allowlisted paths, `87e95cd` vs `d3aaf6f` | **S** | byte-identical (empty diff) |
| Branch `codex/w1-i03-marking-floor-r2` pre-existed | **S** | No |
| MARK-001 packet tracked in Suite | **S** | No — untracked; SHA-1 `0670f6e2…`, SHA-256 `7de53c01…` |
| `20cfa36` / `7185739` on any remote | **S** | No — local branches only; `20cfa36` is not an ancestor of `main` (`5a4823f…`) |
| `ensure_internal_alert_writer_connector` in-process callers | **S** | none (tests + one manual CLI only; no `src/` import, no startup, no CI) |
| Local-only provenance table location (§4) | **S** | board **§14.35**; blocker-4 packet **§2.10**; register **§27** — the board has no §2.10 |
| SOC branch-coverage measurement at `d3aaf6f` | **S** | none — CI line 66 is `pytest -q --cov=cybrik_soc --cov-report=term-missing`; no `--cov-branch`, no `fail_under` |
| `contracts/json-schema/cybrik.data-marking.v1.schema.json` (§Q4.1) — re-measured read-only in **this** worktree by the remediation pass | **S** | tracked; `x-cybrik-status: ACCEPTED FOR IMPLEMENTATION`, `x-cybrik-not-accepted: false`, `x-cybrik-contract-version: 0.1.0`; `required: ["classification","tlp"]`; properties `classification`, `tlp`, `handling[]`, `origin_marking`; **`additionalProperties: false`** |
| Correlation label-reader symbol name at `d3aaf6f` (§5.1.1) | **R** | **`siem/correlation.py::_label_of_event`.** The name `_label_reading_of_event` used by earlier revisions of this packet **does not exist**; every occurrence has been corrected |
| `datalake/es_adapter.py` collected-prefix tuple `("label:", "system:", "handling:")` (§Q4.2/§Q4.3) | **R** | Confirmed from source by the final review. `label:`-prefixed tags are collected into the searchable `labels` projection; `marking:` is not |
| **O-1** — tag-body hyphen legality at both emit sites, normalisation, adapter collection, and the 64-character truncation interaction (§Q4.6) | **R** | **SAFE — discharged.** `label:unresolved-floor` (22 chars) is legal, survives normalisation, is collected, and is nowhere near truncation in any composed form. **No underscore substitution is needed or authorized** |
| **O-2** — collision check on `label:unresolved-floor` and the `label:unresolved*` prefix (§Q4.6) | **R** | **SAFE — discharged.** No collision; the `label:unresolved*` prefix space is unused at `d3aaf6f` |
| **O-3** — `datalake/search.py::forbidden_label_tags` behaviour on an unknown `label:` token (§Q4.5) | **R** | **SAFE — discharged.** Case **(i)**, closed enumeration. `label:unresolved-floor` is in no clearance's `must_not` and changes clearance for nobody |
| Committed-test collateral in `test_siem_correlation.py` — the valid-label **tuple-equality** assertions at ≈424–427 and ≈429–432 (§8.2 row **P2b**) | **R** | Present as described. Authorized in §8.2 as a **Q6 shape-compatibility edit** — under the sixth remediation's corrected taxonomy, **the one pure shape row** — not assertion weakening: the same expectations are re-expressed against the carrier's named fields, plus the newly-explicit `unresolved is False` on valid input. **The policy these two blocks encode is unchanged.** Line numbers are locators — §8.2 condition 1 stops on content drift |
| Committed-test collateral in `test_siem_correlation.py` — the **mixed absent / non-string-invalid** window block at ≈484–491, **through and including the closing delimiter at ≈491** (§8.2 row **P3**) | **R** (block terminator: earlier review; window composition: fifth review) | Present as described. **NOT a Q6 shape-compatibility edit.** Authorized in §8.2 as a **Q2/Q4 policy re-expression**: under **Q2 = A** the accepted **non-string invalid** contributor fails closed, so the block's derived classification becomes **`toi_mat`** and the unresolved state/tag is **present** — **RED-required (Q2)**, and **RED-required (Q4)** for the exact token; the **absent** contributor's rank-0 `khong_mat` contribution and the MAX-monotonic ordering stay **regression-lock**. **The closing-delimiter authorization at ≈491 is preserved verbatim**, now as the syntactic consequence of a **policy** edit rather than of a shape edit; its scope is identical either way. **The earlier row of this log grouping P2b and P3 together as "Q6-forced compatibility edits" is withdrawn as wrong about P3's driver**, and with it every claim that P3's policy is unchanged. Line numbers are locators — §8.2 condition 1 and §8.6 item 7 stop on content drift |
| Committed-test collateral in `test_siem_engine.py` at ≈227–236 (§8.2 row **P4**) | **R** (fifth review) | **Two committed tests in one contiguous range, and neither is tuple-shaped:** the **absent-label** test at **≈227–230** and the **`top_secret` present-unmappable** test at **≈232–236**. Authorized in §8.2 as a **MIXED policy row**, **not** a Q6 shape edit: ≈227–230 is **unchanged in outcome** under Q2 = A (rank-0 `khong_mat`, no unresolved signal) and is **regression-lock** — finding no edit needed there is the correct result; ≈232–236 flips under **Q1 = A** to fail-closed **`toi_mat`** plus **`label:unresolved-floor`** and is **RED-required (Q1**, and **Q4** for the exact token**)**. **Q6 forces no mechanical shape edit on this row.** If the writer finds a tuple-shaped expectation in this range, that is base drift and a stop (§8.6 item 7), not a licence to apply P2b's rule here. Line numbers are locators — §8.2 condition 1 stops on content drift |
| `test_siem_correlation.py` import at ≈17 — the former §8.2 row **P1** | **R** (third review) | **Already binds `_label_of_event` correctly at `d3aaf6f` — there is nothing to edit.** The prior revision's authorization of a "compatibility edit" here is **withdrawn as unnecessary**; P1 is now a **verification-only no-edit preflight** (§8.2.1) and is **excluded from the authorized-edit accounting**. Its binding prohibition on importing the nonexistent `_EventLabelReading` in Phase 1 is preserved verbatim (§8.1, §8.6 item 20) |
| `resolve_payload_floor` / `PayloadFloor` shape, and the committed equality at `test_ingest_label_floor.py` ≈355 | **R** (third review) | **Three fields — `classification`, `system`, `invalid`** — and ≈355 commits an equality against exactly that shape. **§6.1 decides the carrier does not change:** no `unresolved` field, no arity change, no §8.2 row **P6**; the ≈355 equality is a **pin** (§8.2.1 row **N1**) that stays unchanged and passing through Phase 1 and Phase 2, **not** an authorized collateral edit. Every claim that §8.3 tests 1/2/3b/3c require an ingest-carrier `unresolved` field is **withdrawn**; they are retargeted onto the policy-layer observable (`effective_labels` / `apply_label`) |
| Derivation boundary for the unresolved fact on the ingest side (§6.1) | **S** (derived in this document from the class-**R** parser shape above) | Absent = `invalid False` / `classification None`; malformed asserted classification = `invalid True` / `classification None`; valid classification with a **defective auxiliary field** = `classification` not `None` / `invalid True`. The policy layer discriminates on that pair, so **no fourth parser field is needed**. A junk auxiliary field alongside a valid mappable classification is a **`label:floor-invalid` diagnostic only** — not classification-unresolved, no fail-closed escalation, no `label:unresolved-floor` (pinned by §8.3 test 3d). Phase-2 helper/field layout beyond this is **deliberately not specified** |
| `handling:restricted` on the base's malformed / present-unmappable floor path | **R** (third review) | **Not emitted at `d3aaf6f`** — the base keeps the connector-supplied label, so the fail-closed `toi_mat` outcome is what creates `handling:restricted`. The expectation is therefore **RED-required (Q1/Q2)** in §8.2 row **P5** and §8.3 test 6; only the **retained `label:floor-invalid`** is regression-lock. The prior revision classified both regression-lock, which would have forced a §8.6 item 3 stop |
| Committed-test collateral in `test_ingest_label_floor.py` — docstring invariants ≈12–13 and the parametrized malformed/present-unmappable case group ≈134–148 (§8.2 row **P5**) | **R** | **Present, and encoding the superseded policy:** the committed bytes require that a malformed / present-unmappable floor **keeps the connector label**, **retains `label:floor-invalid`**, and **forbids every other `label:` tag**. Q1 = A / Q2 = A contradict that outcome directly. Authorized in §8.2 as a **policy re-expression**, not a compatibility edit; parametrization and every case preserved. **The two expectations do not share a class, and must not be described as a retained pair:** `label:floor-invalid` **is retained base behaviour — regression-lock**; `handling:restricted` **is not retained** on these malformed / present-unmappable cases — the base emits none there, so it is a **new, RED-required (Q1/Q2)** expectation created by the fail-closed `toi_mat` outcome. **The previous revision's claim that this file was "additive only" with "no authorized edit to a committed assertion" is withdrawn as false at `d3aaf6f`.** Line numbers are locators — §8.2 condition 1 and §8.6 items 7/10b stop on content drift |
| Occupied tag vocabulary emitted by `ingest/source_labels.py:207–217` (§Q4.4.1) | **R** | `label:config-invalid`, `label:floor-invalid`, `label:{level}` (QD-13 values), `system:{…}`, `handling:restricted`. The `label:unresolved*` prefix space is **unused**, so O-2 (no collision) stands. Relationship to `label:floor-invalid` **decided as COEXISTENCE** in §Q4.4.2 — distinct layers (payload parse/shape vs. policy/audit), both emitted exactly once on a malformed raw ingest floor, **and `unresolved-floor` alone only on the CORRELATION path** — on ingest a present-unmappable value is marked `invalid` by `resolve_payload_floor`, so `floor-invalid` coexists there too (§6.1.1; the earlier unqualified "present-unmappable normalized-label paths" phrasing is withdrawn). Not duplicate spellings; the new token supersedes nothing |
| Committed `TestLabelFloorHelper` docstring in `test_siem_correlation.py` at ≈408–410 — **anchor made precise by the sixth remediation: ≈408 is the class declaration, the docstring itself is ≈409–410** (class **R**, fifth review); the authorized range is unchanged at ≈408–422 (§8.2 row **P2**) | **R** (fourth review; anchor refined by the fifth) | **Present, and encoding the superseded policy in prose:** it states that **junk or absent labels resolve to the `DEFAULT` `khong_mat`**. Q1 = A withdraws the *junk* half (it now fails closed to `toi_mat` with the unresolved signal); Q2 = A preserves the *absent* half. **This is committed invariant prose, not decoration**, in exactly the sense P5's ≈12–13 docstring is. Row **P2**'s single contiguous range is therefore **widened from ≈412–422 to ≈408–422** — still **one** range, so the accounting is unchanged — and the docstring must be **rewritten to state the decided invariants with the same precision**, with **verbatim pre/post evidence** (§8.2 condition 2). §8.6 items **8** and **10b** are widened from "assertion" to "assertion **or committed invariant prose/docstring**" so a second such drift is an explicit stop. Line numbers are locators — §8.2 condition 1 and §8.6 item 7 stop on content drift |
| Ingest-path reachability of a non-`None`, out-of-scale `classification` after `resolve_payload_floor` (§6.1, §6.1.1) | **R** (fourth review) | **Unreachable.** Q1 (iii) *out-of-scale/unmappable* and Q2 (ii) *malformed* are **intentionally parser-indistinguishable** on ingest: both return `invalid = True` / `classification = None` and route through the **same** policy branch to the **same** outcome under Q1 = A / Q2 = A. **No ingest state with `classification` non-`None` and outside `LABELS` exists.** The earlier §6.1 bullet listing that state as an ingest state is **withdrawn**; the branch is re-sited as **CORRELATION-path-only** (§6.1.1), because `_label_of_event` reads `event['labels']` **directly, before** policy resolution and so still holds the unmappable value non-`None`. **Consequence, applied throughout:** `label:unresolved-floor` **without** `label:floor-invalid` is a **correlation-path shape only** — on ingest the parser marks the payload `invalid` and `label:floor-invalid` **coexists** (§Q4.4.2, §8.3 test 6, §11 legend). No emitted-tag outcome changes; COEXISTENCE is unchanged |
| `ingest/source_labels.py::label_rank` behaviour on out-of-scale input (§6.1) | **R** (fourth review) | **Raises `ValueError`.** `resolve_payload_floor`'s `label not in LABELS` guard is therefore a **correctness / crash-prevention constraint**, not a normalization style choice: loosening it so an unmappable string travels onward as a non-`None` `classification` would push that string into `label_rank` and turn a fail-closed record into an **unhandled exception on the ingest call path** — **surface B**, live call sites in `service.py` / `pf_bridge.py` whose guarded code runs once a tenant carries `label_floor_enforce = True` (§5.0, §5.1). **Weakening it to make the conceptual Q1 (iii) branch reachable is a stop** (§8.6 item 10c), not a refactor. No parser arity change and no §8.2 row **P6** follows from this |
| §7 Phase-1 path scope | **S** | **Corrected to allowlist entries 5–7 only, under every Q5 answer.** The prior "entries 5–7, plus 8 only if Q5 = A" wording is **withdrawn**: under Q5 = A entry 8 stays in the lane but its tests are §8.3 group **D**, written in **Phase 3** behind the §7.1 grant and strict phase ordering; under Q5 = B entry 8 leaves the lane entirely. **No Phase-1 integration test exists under any answer** — consistent with §8.1 (no RED-required test traces to Q5) and §8.5 (real-PG evidence is Phase 2 onward only). Counted and cross-checked in this document |
| §8.2 authorized-collateral accounting — **current** | **S** | **Five authorized edit rows — P2, P2b, P3, P4, P5** — across **seven approximate ranges** (P2b names two, P5 names two; P2, P3 and P4 name one each — **P2's single range is ≈408–422**, widened at its start by the fifth remediation and still exactly one range, so the count did **not** move) in **three files**. **All FOUR §8.2.1 no-edit preflights are excluded from this count — `P1` (the ≈17 import), `N1` (the ≈355 three-field `PayloadFloor` equality), `N2` (the ≈509–512 `LabelFloor("khong_mat", None)` equality) and `N3` (the ≈533–535 exact-key-set assertion on the canonical `label_floor` block).** **None of the four is an edit row and none contributes a range.** Two earlier phrasings of this row are superseded: the one naming only **P1** and **N1**, and the one naming **P1/N1/N2** as "all three" — **N2** was added by the sixth remediation and **N3** by the seventh, each excluded on exactly the same ground, and neither moves the five-row / seven-range / three-file count. Counted in this document. **Both earlier accounting phrasings are also superseded:** the "five rows / five ranges" phrasing was internally inconsistent (P2b already named two ranges), and the third remediation's "six rows / eight ranges" counted P1 as an authorized edit it is not |
| §8.3 test 6b — scope **and class** | **S** | **Narrowed, and reclassified.** *Scope:* narrowed to asserting that `label:unresolved-floor` **alone** is absent from `forbidden_label_tags` at every clearance; the prior full-emitted-tag-set disjointness formulation was wrong, because `label:toi_mat` is legitimately forbidden at lower clearances and that assertion would fail against a correct implementation. *Class:* **corrected from RED-required to REGRESSION-LOCK.** `forbidden_label_tags` is already a **closed enumeration** at `d3aaf6f` and the exact token is already absent from every clearance's set (O-3, class **R**), so **6b passes at the base on arrival — and passing is the point.** Nothing in this packet requires 6b to fail first; classified RED-required it would have forced a §8.6 item 3 stop against a correct base. The fail-if-regression semantics are unchanged |
| Answers unchanged by the **fourth (classification-and-carrier)** remediation pass | **S** | Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A — all preserved verbatim, exactly as they were preserved through the third (collateral-and-vocabulary) pass before it. No ballot option added or removed, no question added. No phase opened; Phase 1 and Phase 2 remain held exactly as before; packet status remains `PROPOSED` |
| Answers **and accounting** unchanged by the **fifth (prose-collateral-and-path-distinction)** remediation pass | **S** | Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A — all preserved verbatim for a fourth consecutive pass. No ballot option added or removed, no question added. **The §8.2 accounting is also unchanged: five rows / seven ranges / three files**, P2 still one contiguous range (≈408–422). No emitted-tag outcome changes; no parser arity change; no §8.2 row **P6**; no §8.3 expectation weakened. No phase opened; Phase 1 and Phase 2 remain held; packet status remains `PROPOSED` |
| §8.2 row **P2** — Q6 completeness rule | **S** | **Added, matching P2b.** Edited cases in ≈408–422 re-express every `classification` and `monitored_system` fact **in full** via the Q6 carrier — none dropped, narrowed to one field, or softened to a truthiness/subset check — **and assert `unresolved` explicitly: `False` for the absent case (Q2 (i), regression-lock as an absence assertion about the new signal, §8.1) and `True` for each present malformed / present-unmappable fail-closed case (Q2 (ii) / Q1 (iii), RED-required, tracing to Q1/Q2/Q6)**. An edited case that asserts the new level but leaves `unresolved` unexamined is an incomplete re-expression and a §8.6 item 8 stop. Under Q6 = B the same rule binds against the third positional element. Counted and cross-checked in this document |
| §8.2 **row-driver taxonomy** — corrected by the sixth remediation | **S** (decided and cross-checked in this document from the class-**R** facts (g), (h) above) | **Corrected, and stated explicitly rather than left to inference.** The earlier description of **P3** and **P4** as *compatibility updates mechanically forced by Q6* is **withdrawn as wrong about the driver**, and with it **every operative claim that P3/P4 policy is unchanged, that P3/P4 are Q6-forced compatibility edits, or that P4 carries a tuple-shaped expectation**. Decided taxonomy: **P2b = Q6 only**, the **one** pure shape-compatibility row; **P2 = mixed** — Q1/Q2 policy **plus** committed prose **plus** the Q6 completeness rule; **P3 = Q2 policy** (Q4 for the token); **P4 = mixed Q1/Q4 policy**, not tuple-shaped; **P5 = Q1/Q2 policy plus Q4 vocabulary**. The withdrawal is applied wherever the old grouping was operative — §8.2 (table and taxonomy table), §8.3, §8.6 items 8 and 10, the §11 block, and this log. **No answer, no range, no class of any assertion outside P3/P4 changes as a result** |
| §6/Q6 = A — the **full internal carrier chain**, five hops | **S** (decided in this document; the four structural names are class **R**, fact (k) above) | **Expanded from a reader-only answer to the whole chain, and consistent everywhere it is stated** (§6/Q6, §7 Phase-1 gate line, §8.2.1 **N2**, §8.6 item **10d**, §11): **1** `_label_of_event` returns the immutable typed **`_EventLabelReading`** (`classification`, `monitored_system`, `unresolved`), consumed **by attribute name**; **2** **`_GroupState`** gains `label_unresolved: bool = False`, accumulated by **monotonic OR** over every accepted contributor and **never self-clearing**; **3** the internal frozen **`LabelFloor`** gains `unresolved: bool = False` as a **DEFAULTED** field, fed by **`effective_label_floor()`**; **4** **`to_canonical()` still emits exactly the two current keys** under Q3 = A and `DerivedAlert.canonical()` emits `label:unresolved-floor` off the internal flag; **5** the direct-engine path constructs from **`reading.unresolved`**. **Q3 is untouched — the wire stays at two keys**, and **steps 2–5 bind identically under Q6 = B**; only step 1 changes shape. Codebase-equivalent **private names** are allowed where semantics, the `False` default, the accumulation and the wire behaviour are identical; leaving a hop undecided is a stop (§8.6 item 10d(e)) |
| §8.2.1 pin **N2** — committed `LabelFloor("khong_mat", None)` equality at `test_siem_correlation.py` ≈509–512 | **R** (fifth review; pin decision **S**, derived in this document) | **Present as described, and newly pinned.** It sits **outside** every §8.2 range — outside P2's ≈408–422, P2b's two ranges and P3's ≈484–491 — so §8.2 condition 4 forbids editing it. It stays **unchanged and passing** in both phases **only because** the `unresolved` field Q6 = A adds to the internal `LabelFloor` **defaults to `False`** (§6/Q6 step 3): the constructed and expected values both carry `unresolved = False`, so the two-argument construction stays legal. **The `False` default is therefore binding, not incidental.** Two stops attach (§8.6 item **10d** (a) and (b)): concluding the equality must be edited, or losing the `False` default anywhere in the carrier chain — the latter is a stop **even if this line still happens to pass**. **N2 contributes no range and does not move the accounting** |
| Answers **and accounting** unchanged by the **sixth (driver-taxonomy-and-carrier-chain)** remediation pass | **S** | Q1 = A, Q2 = A, Q3 = A, Q4 = `label:unresolved-floor`, Q5 = B, Q6 = A — all preserved verbatim for a **fifth** consecutive pass. No ballot option added or removed, no question added. **The §8.2 accounting is also unchanged: five rows / seven ranges / three files**, P2 still one contiguous range (≈408–422); the corrected drivers re-describe existing rows and add none, and **N2** is a no-edit pin outside the count. No emitted-tag outcome changes; no parser arity change; no §8.2 row **P6**; no §8.3 expectation weakened; **no runtime, date or stack authority is claimed**. **No phase opened: Phase 1 and Phase 2 remain held exactly as before** — Phase 1 stays held on the Q1–Q4 / Q6 answers, and **Phase 2 stays behind the separate §7.1 grant** (published RED bytes, an **independent review** by someone who did not author them, and an explicit written coordinator grant); packet status remains `PROPOSED` |
| Location of the *"CHƯA provision secret thật theo tenant…"* quote (§5) | **S** | `cybrik-soc-command-center:docs/operations/PR-SPEC-ALERT-WRITER.md` **§9.3**, line 97 — the connector-seed bullet that cross-references §3.1; **not** §3.1 itself (§3.1 is item 1 of §3 "Điểm cắm & interface", a design item that contains no such sentence). Last commit touching that file: `1e08bd44…` |
| ⚠ **SUPERSEDED / FAILED — Runtime topology at `d3aaf6f` — three surfaces, three statuses** (seventh remediation). **HISTORICAL, WRONG, SUPERSEDED BY THE EIGHTH REMEDIATION**; retained as evidence of a prior failed review cycle. **The correct model is FOUR surfaces — see the class-S row "Runtime topology at `d3aaf6f` — FOUR surfaces" below.** No current claim anchors here | **R** (sixth review) — **WITHDRAWN AS FALSE AT `d3aaf6f`** | **`A` = connector-config label application — LIVE AND UNGATED** (`service.py`, `pf_bridge.py`, `source_health_worker.py`, all via `apply_label`). **`B` = payload `label_floor` application — LIVE CALL SITES · FEATURE-GATED EFFECT** (`service.py`, `pf_bridge.py`): `payload_floor_for` returns `None` unless the server-held connector config carries the **exact boolean `True`** for `label_floor_enforce`; **nothing in source sets that flag**, absent or default is **off**, and **no in-process caller auto-sets it**. **`C` = correlation/engine label reading — SOURCE IMPLEMENTED · DIRECT-TESTABLE · NOT RUNTIME-WIRED**: no in-process production caller, no worker wiring, correlation **excluded** from the mounted `siem` API, and the committed SOC documentation states there is no worker wire. **The single "M1 is live … takes effect on the next deploy" grouping is withdrawn**, and with it **every operative claim that the correlation/engine path is live, runtime-wired, or takes effect on deploy**. Stating that surface C is **not** runtime-wired is **permitted, accurate and required wherever deploy effect is at issue** (§8.7). **Not re-measured by this writer** — it held no `cybrik-soc-command-center` read access in this cycle |
| Caller inventory **by actual call arguments**, and `source_health_worker.py` in particular (§5.1) | **R** (sixth review) | **`service.py` and `pf_bridge.py`** compute **`payload_floor_for(config, parsed)`** and pass the result through — **surfaces A + B**, and Q1/Q2 change what they produce **only when the flag is on**. **`source_health_worker.py` calls `apply_label(fields, config)` — with NO `payload_floor` argument at all** — so it is **surface A only** and **never reads the payload `label_floor` block**, flag on or off; **no operative claim that it reads a payload `label_floor` label floor survives anywhere in this packet.** The earlier row describing it as a "background worker path — resolves outside any request context", which implied payload-floor coverage it does not have, is **withdrawn**; so is the presentation of the `correlation.py` / `engine.py` rows under a "**Live** call path" heading. **Not re-measured by the seventh writer.** **Eighth-remediation status: the `source_health_worker.py` finding was RE-MEASURED DIRECTLY at `d3aaf6f` (line 121, no `payload_floor` argument) and is CONFIRMED — it is upgraded to class S in the row below. The clause withdrawing the `correlation.py` / `engine.py` "Live call path" heading is SUPERSEDED: those rows are reached by a packaged, compose-declared worker, so the over-correction to "reaching no deployed path" is itself withdrawn (§5.1)** |
| ⚠ **SUPERSEDED / FAILED — Feature-flag setter provenance for `label_floor_enforce`** (seventh remediation). **HISTORICAL, WRONG, SUPERSEDED BY THE EIGHTH REMEDIATION**: the "only setter is a human running the bootstrap CLI" clause is **false at `d3aaf6f`**, and `bootstrap.py` does not touch the flag at all. The **gate semantics** clause (exact boolean `True`) survives and is re-recorded class **S** below. Retained as evidence of a prior failed review cycle; no current claim anchors here | **R** (sixth review) — **setter clause WITHDRAWN AS FALSE** | **Exact boolean `True` only.** Absent, `False`, `1` and `"true"` all leave `payload_floor_for` returning `None`. ~~**Nothing in source sets the flag**, and its only setter at `d3aaf6f` is a **human running the bootstrap CLI** against a tenant (M2 is unwired, class **S**, §5.2).~~ — **SUPERSEDED: no *automatic* assignment exists, and an authorized connector create/update API call can set it; `connector/bootstrap.py` contains no `label_floor_enforce` occurrence at all.** **Consequences carried through every operative statement:** with the flag **off** — the default — **neither Q2 answer changes what ingest produces**, so **this packet makes no all-ingest claim** and none may be derived from it; and **no auto-set claim** is made anywhere |
| ⚠ **SUPERSEDED / FAILED — §6/Q2 and §11: the ground Candidate B's NO-GO rested on** (seventh remediation). **HISTORICAL, WRONG, SUPERSEDED BY THE EIGHTH REMEDIATION.** Two clauses are false at `d3aaf6f` — *"surface C is not runtime-wired and would raise nothing at all on deploy"* and *"floor-absent is the ordinary shape of a legacy or non-correlated payload"* (an unmeasured volume claim). **The operative ground is the class-S row "§6/Q2 and §11 — the ground Candidate B's NO-GO rests on (eighth)" below.** Retained as evidence of a prior failed review cycle | **S** (decided by the seventh pass from class-**R** facts since withdrawn) — **GROUND WITHDRAWN; the answer Q2 = A and the NO-GO on B are unchanged** | **Re-grounded on the LIVE FEATURE-GATED INGEST path (surface B) alone.** The earlier ground — *"absence is universal on the correlation/engine path, and M1 is live, so B would raise substantially every derived alert to top-of-scale on the first deploy, for every tenant"* — is **withdrawn**: surface C is not runtime-wired and would raise nothing at all on deploy. The operative reasoning is now exactly three steps, and both §6/Q2 and the §11 legend state it identically: **(1) flag off → legacy**, neither answer changes anything; **(2) exact `True` + a floor-**absent** event → rank-0 `khong_mat` with no unresolved signal under **A**, which is what the base already produces; **(3)** under **B** that same flag-enabled floor-absent event is raised to `toi_mat` — and at `d3aaf6f` floor-absent is the ordinary shape of a legacy or non-correlated payload — so **B would overclassify flag-enabled floor-absent events systematically**, which is overclassification created by *enabling* the feature. **The answer is unchanged: Q2 = A, B remains NO-GO at this base and remains on the ballot for coordinator override.** No auto-set claim, no all-ingest claim, and no correlation deploy-effect claim is used at any step |
| §8.2.1 pin **N3** — committed exact-key-set assertion on the canonical `label_floor` block at `test_siem_correlation.py` ≈533–535 | **R** (sixth review; pin decision **S**, derived in this document) | **Present as described, and newly pinned as the fourth no-edit preflight.** It is the committed executable form of **Q3 = A** and of **§6/Q6 step 4** — `to_canonical()` / `DerivedAlert.canonical()` emit **exactly** `classification` and `monitored_system` — and it stays **unchanged and passing** in both phases precisely because Q6's `unresolved` field is **internal and never reaches the wire**. It sits **outside** every §8.2 range (P2's ≈408–422, P2b's two ranges, P3's ≈484–491), so §8.2 condition 4 forbids editing it. **The stop is §8.6 item 10d(d)**: concluding the assertion must be edited — a third key admitted, the exactness relaxed, the carrier accommodated — stops and returns to the coordinator. **N3 is not an authorized edit, contributes no range, and does not move the five-row / seven-range / three-file accounting.** It is recorded in every relevant no-edit list and stop — §7 Phase-1 row, §8.2 preamble and condition 1/condition 4, §8.2.1, §8.3 group B, §8.6 items 7 / 8 / 10d(d), and the §11 block — and **nowhere as an edit row**. It does not overlap §8.3 test 12: test 12 is the *added* Phase-1 assertion of the same property; N3 is the *committed* one that must keep passing untouched |
| §8.3 test **3d** — what is actually new in it | **R** (sixth review; classification **S**, derived in this document) | **Corrected, without changing its class.** The base **already** exercises the valid, mappable classification with a **defective auxiliary field**, and **already** pins both committed facts: `label:floor-invalid` **is** emitted and **no** fail-closed escalation occurs. **The quoted phrase "Test 3d is new" is withdrawn as a mis-description** and survives only as an explicitly labelled withdrawn quotation; **no operative claim that the whole case is new remains anywhere in this packet.** What 3d adds is exactly **one** assertion — the **negative** one that `label:unresolved-floor` is **absent** from the emitted tag set. **Both parts are regression-lock:** the base floor-invalid and no-escalation facts because they already hold and must survive Phase 2, and the new-token absence under the §8.1 rule that an assertion about the **absence** of the new token is **never** RED-required. **Nothing in 3d is RED-required**, and classifying any part of it so would force a §8.6 item 3 stop |
| ⚠ **SUPERSEDED / FAILED — Stale-wording audit across the whole packet, seventh remediation.** **HISTORICAL, SUPERSEDED BY THE EIGHTH REMEDIATION**: this audit certified as "no operative stale claim survives" a set of claims that were **themselves false** (correlation not runtime-wired; nothing sets the flag). A clean audit against a wrong baseline is not evidence of accuracy. **The operative audit is the class-S row "Stale-wording sweep — eighth remediation" below.** Retained as evidence of a prior failed review cycle | **S** (seventh pass) — **AUDIT BASELINE WITHDRAWN** | **Performed over every operative occurrence.** No operative sentence states that the correlation/engine path is live, runtime-wired, or takes effect on deploy; that anything in source auto-sets `label_floor_enforce`; that Q1–Q4 affect all ingest; or that `source_health_worker.py` reads the payload `label_floor` block. Surviving sentences to any of those effects are **historical quotations, each immediately and unmistakably labelled withdrawn or corrected** at the point of use — §5 (the M1 grouping), §5.1 (the two withdrawn caller rows), §5.1.2 and §8.7 (the forbidden-claims lists), §6/Q2 and §11 (the withdrawn Q2/B ground), §6/Q5 (the withdrawn "live … on ingest **and correlation**" legend sentence), and §8.3 group A (the withdrawn "Test 3d is new" phrase). They are retained so a reader can see what was retracted and why. **Audited in this document; no SOC-side byte was read to perform it** |
| Answers **and accounting** unchanged by the **seventh (runtime-topology)** remediation pass — **the answer/accounting content of this row still holds; its *factual ground* is SUPERSEDED BY THE EIGHTH REMEDIATION** | **S** | **Q1 = A, Q2 = A, Q3 = A, Q4 = the exact label `label:unresolved-floor`, Q5 = B, Q6 = A** — all preserved verbatim for a **sixth** consecutive pass. No ballot option added or removed, no question added, no recommendation changed. **The §8.2 accounting is also unchanged: five authorized edit rows (P2, P2b, P3, P4, P5) / seven approximate ranges / three files**, P2 still one contiguous range (≈408–422); **P1, N1, N2 and N3 are four no-edit pins outside that count**, and the fourth pin **N3** adds no row and no range. No emitted-tag outcome changes; no parser arity change; no §8.2 row **P6**; no §8.3 expectation weakened or reclassified. **Packet status remains `PROPOSED`.** **No phase opened: Phase 1 remains HELD on the Q1–Q4 / Q6 answers and additionally pending an independent PASS and a separate written grant; Phase 2 remains behind the separate §7.1 grant** (published RED bytes, an **independent review** by someone who did not author them, and an explicit written coordinator grant). **No runtime, date or stack authority is claimed** — nothing was run, started, installed, staged, committed or pushed, and the W1 dates and the release window are unchanged |

**Rows below this line are the EIGHTH (measured-topology) remediation's own measurements and
decisions.** They are the **operative** record. Every row marked class **S** here was read directly
from the SOC source worktree `cybrik-worktrees/w1-48/w1-soc-secret-scan-remediation-r1` at
`d3aaf6fb29c57f145de8f131ad1588aae57d57c9`. Where any of them contradicts a row above, **these
govern** and the row above is marked SUPERSEDED / FAILED at its own location.

| Check (eighth remediation) | Class | Result |
|---|---|---|
| **Runtime topology at `d3aaf6f` — FOUR surfaces** (§5.0, §5.1, §5.1.2) — **supersedes the three-surface row above** | **S** (measured directly in the SOC source worktree) | **`A` = connector-config label application — CODE-REACHABLE / LIVE-CALL-PATH · UNGATED**: `ingest/service.py:432–434`, `ingest/pf_bridge.py:191–192`, `ingest/source_health_worker.py:121`, all via `source_labels.apply_label` (≈191–218) / `effective_labels` (≈167–188). **`B` = payload `label_floor` application — CODE-REACHABLE FROM `service.py` AND `pf_bridge.py` ONLY · GATED ON THE EXACT BOOLEAN `True`**: `payload_floor_for` (158–164) → `resolve_payload_floor` (131–155), gate `floor_enforcement_enabled` (123–128), flag key at 40. **`C` = PF EVENT-LABEL PRODUCTION AND FORWARDING — DEPLOYMENT-WIRED**: `ops/pf-workers/pf_workers/normalizer.py::resolve_label_floor` (188–232) **always** returns a `labels` block with `classification` defaulting to `khong_mat` (215–219); `normalize_envelope` writes `doc["labels"]` on **every** normalized document (306–307, 326); `siem_matcher.py::project_event` (660–662) and `build_detection` (680) forward it. **`D` = correlation/engine label reading — SOURCE-IMPLEMENTED **AND** DEPLOYMENT-WIRED**: `siem/correlation.py::_label_of_event` (61–79), `raise_label_floor` (370–377), `effective_label_floor` (388–393), used at 496/529, canonical at 324/345; driven by `ops/pf-workers/pf_workers/correlation_processor.py` — `CorrelationEngine(...)` at **334**, `eng._ingest_one(...)` at **483** — packaged as the console script `pf-correlation` (`ops/pf-workers/pyproject.toml:40`) and declared as a service in `deploy/pf/docker-compose.pf-workers.yml` ≈99–119 and `docker-compose.pf-demo.yml` ≈109–114; **still excluded from the mounted SIEM HTTP API** (`siem/api.py:25–27`). **The phrase NOT RUNTIME-WIRED is withdrawn and may not be used for either surface.** **`M2` = connector bootstrap convergence — NOT IMPLEMENTED AT THIS BASE.** **Boundary held: "deployment-wired" means packaged, declared and constructed in source. NO instance is asserted to be currently running or production-observed** |
| **Flag provenance for `label_floor_enforce` — no automatic assignment, but an authorized API setter exists** (§5.0 row-B note, §5.2, §8.7) — **supersedes the "CLI-only" row above** | **S** (measured directly) | **Both halves, and neither is accurate alone.** **(1) No automatic assignment found in source:** no startup convergence, no worker that writes it, no CI path, and no `True` default — `floor_enforcement_enabled` is literally `(config or {}).get(FLOOR_ENFORCE_FLAG) is True` (`source_labels.py:128`), so absent, `False`, `1` and `"true"` are all **off**. **(2) An authorized connector create/update API call can set it:** `connector/api.py::validate_lc_config` (77–139) **allowlists** `label_floor_enforce` at line **95** and **boolean-validates** it at **110–112** (`must be a boolean`), and it is invoked by **`ConnectorIn._config`** on create (≈178–181) and **`ConnectorUpdate._config`** on update (≈198–201). **Every *CLI-only* / *human-bootstrap-only* claim is WITHDRAWN, and "nothing in source sets the flag" may not be read as "there is no authorized setter" — it means no *automatic* assignment.** **(3) M2 at this base:** `connector/bootstrap.py` contains **no `label_floor_enforce` and no `FLOOR_ENFORCE_FLAG` occurrence at all** (file searched in full); `ensure_internal_alert_writer_connector` is at line **67** and writes `config={"description": _INTERNAL_CONFIG_DESCRIPTION}` at **98**. **The claim that current M2 writes `True` is REMOVED AS FALSE.** No runtime instance or production observation is claimed |
| **PF producer and forwarding — a producer DOES populate event `labels`** (§5.0 surface **C**, §5.1.1, §6/Q2 fact 1) | **S** (measured directly) | **`normalizer.py::resolve_label_floor` (188–232) always synthesizes the block** — `classification` defaults to `khong_mat` when absent or out-of-scale (215–219) — and **`normalize_envelope` assigns `doc["labels"] = labels` on every normalized document (326)**. **`siem_matcher.py` forwards it** — `project_event` copies `event["labels"]` into the projection (660–662) and `build_detection` carries `"labels": event.get("labels")` onto the detection (680) — which is what `correlation.py::_label_of_event` reads. **Consequence: the seventh pass's derived claim that NO PRODUCER POPULATES EVENT `labels` is WITHDRAWN AS FALSE, and absence is NOT the universal state on the deployed PF path** |
| **Alert Writer envelope guarantee — absence is unreachable for that producer** (§6/Q2 fact 2, §11 Q2 legend) | **S** (measured directly) | **`ops/pf-workers/pf_workers/alert_writer.py::validate_envelope` (229; the public name — the `normalizer.py` docstring's `_validate_envelope` spelling is the private form) REQUIRES `label_floor`**: it **rejects** a missing or non-mapping block (`EnvelopeRejected("label_floor", "thieu label_floor (QD-13)")`, 264–266), **rejects** a `classification` outside `LABELS` (267–271), and **rejects** a non-string, non-null `monitored_system` (272–274). Symbol also present at **73**. **Consequence: for the internal Alert Writer producer, Q2's absence branch is UNREACHABLE, so Candidate B buys nothing there; and the "bulk / ordinary shape" claim for the internal connector is WITHDRAWN** |
| **§6/Q2 and §11 — the ground Candidate B's NO-GO rests on (eighth)** — **supersedes the seventh-pass ground row above** | **S** (decided in this document at the measured boundary) | **Normative, at the actual boundary — not volumetric, and not dependent on any runtime-liveness claim.** **(1) Absent means no asserted source floor**; it is **not** evidence of a malformed or unmappable assertion, and there is nothing to fail closed *about*. Fail-close applies only to a **present** malformed or unmappable assertion. **(2) `A` preserves missing-metadata compatibility** for direct engine/helper inputs (`correlation.py` 70–75), envelope-v1 shapes (51–53), and any producer outside the normalized contract — backward-compatible, direct, manual and third-party writers. **(3) `B` fails on two grounds, neither volumetric:** *semantic conflation* — it collapses "asserted nothing" into "asserted something present but untrustworthy", destroying the distinction Q1 = A depends on; and *unmeasured compatibility blast radius* — the producer set landing in the silent default is **not enumerated at this base** and this packet cannot enumerate it, so the radius is **unknown**, which is not a risk the coordinator can price. **(4) Withdrawn grounds, both:** "absence is universal on the live correlation path" and "floor-absent is the bulk / ordinary shape of flag-enabled traffic" — **this packet has never measured traffic volume and makes no such claim**. **The Q2 = A answer and the Q2 = B NO-GO assessment are UNCHANGED**; B remains on the ballot for coordinator override |
| **`source_health_worker.py` call shape — re-measured, CONFIRMED** (§5.1) | **S** (measured directly; previously class **R**, sixth review) | **`ingest/source_health_worker.py:121` calls `source_labels.apply_label(fields, config)` with NO `payload_floor` argument at all.** It is **surface A only** and **never reads the payload `label_floor` block**, flag on or off. The seventh pass carried this as class **R**; the eighth measured it and it **holds** — it is one of the carried claims the measurement **confirms** rather than contradicts, and it is recorded class **S** accordingly |
| **`87e95cd` reconciliation — no current-source decision anchors there** (§5.2, §6/Q5) | **S** | **The sole base for every current SOC source decision in this packet is `d3aaf6f`.** The `87e95cd` references that survive are confined to **history and ancestry** — the R1 worktree tip (§1), the ancestry/`merge-base`/empty-diff comparison establishing that `d3aaf6f` is 7 commits ahead (§2), and the corresponding historical rows in this log. **§5.2's referrer inventory was re-measured at `d3aaf6f`, the stray `87e95cd` anchors were removed, and the old `bootstrap.py:104` definition anchor was corrected to line 67.** No current-state claim, surface classification, flag-provenance statement, test anchor or answer is anchored on `87e95cd` |
| **`siem/api.py` docstring — stale document evidence, demoted** (§5.1.2) | **S** (measured directly) | **What survives:** `services/api/src/cybrik_soc/modules/siem/api.py:25–27` states there is **no correlation endpoint**, and correlation **is** excluded from the mounted SIEM HTTP API. That remains true and is unaffected by the worker path. **What does not survive:** the same docstring's phrase *"khong worker wire"* (line **26**) is **stale** — a module-scope note predating the T17+ worker tier, contradicted by the packaged and compose-declared `pf-correlation` service. **It is retained only as a dated module-scope note and may NOT be cited as current truth about worker wiring**; the worker and manifest files are the citation |
| **F1–F7 closure — the seventh independent review's findings** (§12.2) | **S** (decided and cross-checked in this document) | **All seven addressed, with the exact S evidence recorded in §12.2 and in the rows above.** F1 four-surface topology; F2 PF producer/forwarding; F3 correlation worker wiring and packaging; F4 flag provenance in both directions; F5 M2 not implemented at this base; F6 Q2 ground replaced normatively and the fired deferral/reopen condition removed; F7 stale-evidence demotion and `87e95cd` reconciliation. **Closure is claimed only where class-S evidence is cited.** **This is not an independent PASS** — see **§12.2 rows 13 and 14**, which are the rows that carry the external-identity and no-self-review claims. **§12.2 was cited by the eighth remediation but not written by it; it was created by the NINTH (document-closure) remediation, which fixed that dangling pointer** |
| **Stale-wording sweep — eighth remediation** — **supersedes the seventh-remediation audit row above** | **S** | **Performed over every operative occurrence of:** *NOT RUNTIME-WIRED* / *NOT-RUNTIME-WIRED*, *no in-process production caller*, *no worker wiring* / *no worker wire*, *no producer populates*, *absence universal*, *CLI-only* / *human-only setter*, *bulk / ordinary floor-absent*, *correlation no deploy effect*, and *three-way / three surfaces*. **No operative sentence now states any of them.** Every surviving occurrence is a **historical quotation immediately labelled HISTORICAL, WRONG or SUPERSEDED BY THE EIGHTH REMEDIATION at the point of use** — the header's seventh revision entry, the class-**R** provenance cell items (l)/(n)/(o), the *"Specifically for this seventh pass"* paragraph, §5 (the M1 and A/B/C withdrawals), §5.1/§5.1.2/§5.2 (the forbidden-claims lists), §6/Q1, §6/Q2, §6/Q5, §8.3 test 14b, §8.6 item 17, §8.7, the §11 seventh amendment and its Q2/Q5 legends, and the SUPERSEDED/FAILED rows of this log. **Provenance was not deleted anywhere.** **Audited read-only in this document** |
| **Answers, accounting and status unchanged by the EIGHTH (measured-topology) remediation, both cycles** | **S** | **Q1 = A, Q2 = A, Q3 = A, Q4 = the exact label `label:unresolved-floor`, Q5 = B, Q6 = A** — preserved verbatim for a **seventh** consecutive pass. **No ballot option added or removed, no question added, no recommendation changed**, and the **Q2 = B NO-GO assessment is unchanged**. **The §8.2 accounting is unchanged: five authorized edit rows (P2, P2b, P3, P4, P5) / seven approximate ranges / three files**, P2 still one contiguous range (≈408–422); **P1, N1, N2 and N3 remain four no-edit preflight pins outside the count**. No emitted-tag outcome changes; no parser arity change; no §8.2 row **P6**; no §8.3 expectation weakened or reclassified. **Packet status remains `PROPOSED`.** **No phase opened: Phase 1 remains HELD pending a fresh independent PASS and a separate written coordinator grant; Phase 2 remains behind the separate §7.1 grant.** **No runtime, date or stack authority is claimed** — nothing was run, started, installed, staged, committed, fetched, pushed, merged or rebased, no coverage was produced, and the W1 dates and the release window are unchanged |

**Exact source-measurement class for the ninth (document-closure) remediation.** The posture
**reverts** to the pre-eighth one, and the reversion is stated so nothing here is mistaken for a
second measurement: this pass held **no read access to `cybrik-soc-command-center`**, **read no byte
of it**, **re-measured nothing** and **upgraded nothing to class S**. Every class-**S** SOC fact in
this log remains the **eighth** pass's direct measurement at
`d3aaf6fb29c57f145de8f131ad1588aae57d57c9`, unchanged and cited at its own row. This pass read
**this file** and the **live `cybrik-suite` git state of this worktree**, and nothing else. It was
prompted by an **eighth independent read-only review of the exact bytes the eighth remediation
produced**, which returned **NO-GO with P0 = 1, P1 = 1, P2 = 1, P3 = 1** while **confirming as
substantively correct** the four-surface architecture, Q1–Q6, the F1–F7 source facts, the test
anchors, the five-row / seven-range / three-file accounting, the four pins, and the Phase-1 scope
and provenance. Its four rows below are **document closure**, class **S** only in the narrow sense
that they were decided and cross-checked **in this document**.

| Check (ninth remediation — document closure only) | Class | Result |
|---|---|---|
| **P0 — §10 re-asserted the withdrawn three-surface disclaimer** | **S** (decided in this document against the eighth pass's class-**S** rows above) | **Fixed.** The §10 bullet reading *"does not claim, in any operative statement, that the correlation/engine label path is live, runtime-wired, or takes effect on deploy"* is **WITHDRAWN AS WRONG**: stated in the present tense as an operative claim *of this packet*, it re-asserted the three-surface finding measured false at `d3aaf6f`. The replacement states the actual **negative-claim boundary**: **(1)** no instance is claimed **currently running** or **production-observed**; **(2)** **tests are not runtime evidence**; **(3)** correlation **is source-implemented and deployment-wired**, and a Phase-2 source change **can affect the packaged `pf-correlation` worker on a deployment that runs that service**; **(4)** the **mounted SIEM HTTP API excludes correlation**, and exclusion from HTTP is not absence of a worker path; **(5)** **no operative NOT-RUNTIME-WIRED / no-worker-wiring / no-deploy-effect claim survives** anywhere — every occurrence is a historical quotation labelled at the point of use. **The two always-true disclaimers are preserved verbatim:** no ***automatic*** setter for `label_floor_enforce` (an authorized connector create/update API call can set it), and `source_health_worker.py` **does not read** the payload `label_floor` block. **No answer, range, class, source decision or topology changed** |
| **P1 — §12.2 was cited from two places and did not exist** | **S** (written in this document) | **Fixed.** The eighth remediation's F1–F7 row and the §12.1 header both pointed at **§12.2** as the operative closure checklist while no such section existed — a dangling pointer and no current closure record. **§12.2 is created below §12.1 with 14 checkable rows**: F1 four-surface topology; F2 PF producer/forwarding; F3 correlation worker, packaging and compose manifests; F4 flag provenance in **both** halves; F5 M2 absent at `d3aaf6f`; F6 Q2 ground normative with the fired deferral/reopen removed; F7 stale `siem/api.py` doc demoted and current `87e95cd` anchors removed; §8.7 and §11 current disclosures; Q1–Q6 unchanged; five rows / seven ranges / three files plus four pins unchanged; status/phase holds; source-control state; external identity reporting; and no self-review with a **fresh independent PASS still required**. **The "rows 11 and 12" pointer is corrected to rows 13 and 14**, which is where those claims actually sit |
| **P2 — provenance posture generalized "no pass had SOC access"** | **S** (decided in this document) | **Fixed.** Both the class-**R** table cell in the header and the §10 re-measurement bullet stated in the present tense that **no** remediation pass had SOC read access. Both are now **scoped to passes one through seven**, with the **eighth** named explicitly as the direct-measurement exception whose class-**S** findings **govern** wherever they contradict a carried class-**R** claim, and the **ninth** recorded as holding no SOC access either. A new §10 **provenance-posture bullet** states the three-way distinction — seven **R**-only passes, one direct-**S** measuring pass, one document-closure pass — and states that a later pass may upgrade a claim to class **S** **only if it actually reads the source itself**. **No class label on any existing fact changed** |
| **P3 — §11 Q6 legend paired the wrong §8.2 rows** | **S** (decided in this document from the sixth remediation's row-driver taxonomy) | **Fixed.** The legend read *"rows P2b and P4 in particular"*, contradicting the taxonomy recorded above (P2b = Q6 only; P2 = mixed; P3 = Q2/Q4; P4 = mixed Q1/Q4, **not tuple-shaped**; P5 = Q1/Q2 plus Q4). The corrected pairing is **P2b — the one pure Q6 shape row — and P2 — mixed, carrying the Q6 completeness rule**, with **P4 stated explicitly as Q1/Q4 policy on which Q6 forces no mechanical shape edit**. The old pairing is retained only as an explicitly withdrawn quotation. **Every other consequence of answering Q6 is unchanged**, including that it is a Phase-1 gate, that it authorizes no carrier creation, and that it governs the correlation side only |
| **Answers, accounting, status and topology unchanged by the NINTH (document-closure) remediation** | **S** | **Q1 = A, Q2 = A, Q3 = A, Q4 = the exact label `label:unresolved-floor`, Q5 = B, Q6 = A** — preserved verbatim for an **eighth** consecutive pass. **No ballot option added or removed, no question added, no recommendation changed**, and the **Q2 = B NO-GO assessment is unchanged**. **The four-surface topology, every F1–F7 source fact, every test anchor and every line number are untouched.** **The §8.2 accounting is unchanged: five authorized edit rows (P2, P2b, P3, P4, P5) / seven approximate ranges / three files**, with **P1, N1, N2 and N3** as four no-edit preflight pins outside the count. **Packet status remains `PROPOSED`.** **No phase opened: Phase 1 remains HELD pending a fresh independent PASS and a separate written coordinator grant; Phase 2 remains behind the separate §7.1 grant.** **No runtime, date or stack authority is claimed** — nothing was run, started, installed, staged, committed, fetched, pushed, merged or rebased, no coverage was produced, and the W1 dates and the release window are unchanged |

**Source-control state of the session that produced this packet:** one new worktree, one new
branch, one new untracked file (this one), **zero staged**, zero commits.

### 12.1 Closure checklist for the seventh (runtime-topology) remediation — ⚠ HISTORICAL, SUPERSEDED BY §12.2

> **⚠ HISTORICAL — SUPERSEDED BY THE EIGHTH REMEDIATION (§12.2). This checklist is NOT the current
> closure record.** It is retained as evidence of a prior failed remediation cycle, because deleting
> it would delete provenance. **Rows 1, 7 and 8 are FALSE as written:** row 1's carried facts (l),
> (n) and (o) are false at `d3aaf6f`; row 7 certified "no operative stale claim survives" against a
> **wrong baseline** — the claims it protected (correlation not runtime-wired; nothing sets the flag)
> were themselves the stale ones; and row 8's Q2 ground has been replaced. **Rows 3, 4, 5, 6, 10, 11
> and 12 still hold.** The operative checklist is **§12.2**.

Stated as claims a reader can check against this file, not as a self-assessment of quality. Each
line is either true of the bytes above or it is not.

| # | Claim | State |
|---|---|---|
| 1 | **Seventh-remediation provenance is explicit.** The header carries a revision entry and a *"Specifically for this seventh pass"* paragraph; §12 carries the matching *"Exact source-measurement class"* paragraph and a *"what this writer did read"* paragraph. The six SOC-side facts **(l)–(q)** are recorded **class R**, carried verbatim from the sixth independent review. | **Done** |
| 2 | **Nothing SOC-side was remeasured by this writer.** This pass held **no read access** to `cybrik-soc-command-center` and read no byte of it. It read **this file** and the **live `cybrik-suite` git state of this worktree**, and nothing else. Everything it adds on top of the class-**R** facts is **document decision and counting**, recorded class **S** in that narrow sense only. | **Done** |
| 3 | **The accounting names four no-edit pins.** The current §12 accounting row excludes **P1, N1, N2 and N3** — four, not three — from the count. The count itself is unchanged: **five authorized edit rows / seven approximate ranges / three files.** | **Done** |
| 4 | **N3 is a pin everywhere and an edit row nowhere.** It appears in §7's Phase-1 row, §8.2's preamble and conditions 1 and 4, §8.2.1 (heading, extension note and table), §8.3 group B, §8.6 items 7 / 8 / 10d(d), the §11 decision block, and §12. It contributes **no** range and changes **no** count. | **Done** |
| 5 | **Answers unchanged.** Q1 = A, Q2 = A, Q3 = A, Q4 = the exact label **`label:unresolved-floor`**, Q5 = B, Q6 = A — preserved verbatim for a sixth consecutive pass. No ballot option added or removed; no question added. | **Done** |
| 6 | **Status and phases unchanged.** Packet status stays **`PROPOSED`**. **Phase 1 stays held** on the Q1–Q4 / Q6 answers and, additionally, pending an **independent PASS** and a **separate written grant**. **Phase 2 stays behind the separate §7.1 grant.** **No runtime, date or stack authority is claimed.** | **Done** |
| 7 | **No operative stale claim survives.** No operative sentence says the correlation/engine path is live, runtime-wired, or takes effect on deploy; that anything in source auto-sets `label_floor_enforce`; that Q1–Q4 affect all ingest; or that `source_health_worker.py` reads the payload `label_floor` block. Historical quotes to those effects remain **only** where immediately and unmistakably labelled **withdrawn** or **corrected**. | **Done** |
| 8 | **Q2 Candidate B and §11 rest on the live feature-gated ingest path only.** Flag off → legacy, neither answer changes anything; exact `True` + floor-absent → rank-0 `khong_mat` under **A**; **B** would overclassify flag-enabled floor-absent events. No auto-set claim, no all-ingest claim, no correlation deploy-effect claim is used. | **Done** |
| 9 | **Test 3d prose is truthful.** The base case **exists**; the base `floor-invalid` and no-escalation facts **and** the added negative unresolved-token assertion are all **regression-lock**, the last under the §8.1 absence rule. The phrase *"Test 3d is new"* survives only as an explicitly withdrawn quotation; **no operative whole-case-new claim remains.** | **Done** |
| 10 | **Source control untouched.** This cycle wrote exactly **one** file — this one — in the `cybrik-suite` worktree at `codex/w1-d04-i03-marking-r2-gate-r1`. **Nothing staged, committed, fetched, pushed, merged or rebased**; no dependency installed, no test, coverage run or stack started. It remains the **sole untracked path**, with **zero staged** and **zero commits ahead** of base `eedadc561700d3e1fa052322d44eb63151df0009`. | **Done** |
| 11 | **Identity is reported, not embedded.** This file's post-cycle blob SHA-1, SHA-256, line count and byte count are **deliberately not written into the file** — embedding a digest of the bytes inside those same bytes is self-referential and cannot be made true. They are computed read-only after the last edit and **reported in the delivering response**, which is the only place they can be stated accurately. | **By design** |
| 12 | **No self-review.** This writer did **not** review its own output as an independent reviewer, and nothing above is offered as an independent PASS. §7.1's requirement stands unchanged: the review that gates Phase 2 must be performed by someone who did not author the bytes under review. | **Done** |

**One remaining gate, stated plainly.** This is the last authorized remediation cycle for this
packet; no further extension exists. What the packet still needs is **not** another writer pass but
an **independent review** and, separately, a **Founder/coordinator answer** to Q1–Q6. Neither is
granted here, and this checklist does not substitute for either.

---

### 12.2 Closure checklist for the eighth measured-topology remediation

> **This is the CURRENT closure record**, superseding the historical §12.1 above. It was **cited by
> the eighth remediation but not written by it**; the **ninth (document-closure) remediation**
> created it, closing a dangling `§12.2` pointer that appeared in two places while no such section
> existed. Rows **1–7** close the seventh independent review's findings **F1–F7** against the
> eighth pass's class-**S** measurements; rows **8–12** state what did **not** change; rows **13–14**
> state the two standing limits on this document. The ninth remediation's own four corrections are
> recorded in the ninth-remediation table in §12 above, not here.

Stated as claims a reader can check against this file, not as a self-assessment of quality. Each
line is either true of the bytes above or it is not. **Class-S evidence below was measured by the
eighth pass in the SOC source worktree `cybrik-worktrees/w1-48/w1-soc-secret-scan-remediation-r1`
at `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`; the ninth pass re-measured none of it.**

| # | Claim | State |
|---|---|---|
| 1 | **F1 — the four-surface topology is installed and consistent.** §5.0/§5.1/§5.1.2 state **A** connector-config label application (code-reachable, ungated: `ingest/service.py:432–434`, `ingest/pf_bridge.py:191–192`, `ingest/source_health_worker.py:121`); **B** payload `label_floor` application (code-reachable from `service.py` and `pf_bridge.py` **only**, gated on the exact boolean `True`: `payload_floor_for` 158–164, `resolve_payload_floor` 131–155, `floor_enforcement_enabled` 123–128, flag key 40); **C** PF event-label production and forwarding (**deployment-wired**); **D** correlation/engine label reading (**source-implemented and deployment-wired**, still **excluded from the mounted SIEM HTTP API**, `siem/api.py:25–27`). **The three-surface A/B/C model and the phrase `NOT RUNTIME-WIRED` are withdrawn and survive only as labelled history.** | **Done** |
| 2 | **F2 — the PF producer and the forwarding chain are stated, not assumed.** `ops/pf-workers/pf_workers/normalizer.py::resolve_label_floor` (188–232) **always** synthesizes a `labels` block, `classification` defaulting to `khong_mat` (215–219); `normalize_envelope` writes `doc["labels"]` on **every** normalized document (306–307, 326); `siem_matcher.py::project_event` (660–662) and `build_detection` (680) **forward** it into the detection that `correlation.py::_label_of_event` reads. **The claim that no producer populates event `labels` is withdrawn as false**, and **absence is not the universal state on the deployed PF path**. | **Done** |
| 3 | **F3 — the correlation worker, its packaging and its deployment manifests are all cited.** `ops/pf-workers/pf_workers/correlation_processor.py` constructs `CorrelationEngine(...)` at **334** and calls `eng._ingest_one(...)` at **483**; it is packaged as the console script **`pf-correlation`** at `ops/pf-workers/pyproject.toml:40`; and it is **declared as a service** in `deploy/pf/docker-compose.pf-workers.yml` ≈99–119 and `deploy/pf/docker-compose.pf-demo.yml` ≈109–114. **"Deployment-wired" is defined at the point of use as packaged, declared and constructed in source — and nowhere as running.** | **Done** |
| 4 | **F4 — flag provenance is stated in BOTH halves, and neither half is accurate alone.** **(a)** **No automatic assignment** exists in source — no startup convergence, no worker writer, no CI path, no `True` default; `floor_enforcement_enabled` is literally `(config or {}).get(FLOOR_ENFORCE_FLAG) is True` (`source_labels.py:128`), so absent, `False`, `1` and `"true"` are all **off**. **(b)** **An authorized connector create/update API call CAN set it** — `connector/api.py::validate_lc_config` (77–139) **allowlists** `label_floor_enforce` at **95** and **boolean-validates** it at **110–112**, invoked by `ConnectorIn._config` (≈178–181) and `ConnectorUpdate._config` (≈198–201). **Every CLI-only / human-bootstrap-only claim is withdrawn**, and *"nothing in source sets the flag"* may **not** be read as *"there is no authorized setter"*. | **Done** |
| 5 | **F5 — M2 is recorded as absent at this base, and the false claim is removed, not softened.** `connector/bootstrap.py` contains **no `label_floor_enforce` and no `FLOOR_ENFORCE_FLAG` occurrence at all** (file searched in full); `ensure_internal_alert_writer_connector` is at line **67** and writes `config={"description": _INTERNAL_CONFIG_DESCRIPTION}` at **98**. **The §5.0 claim that current M2 writes `True` is REMOVED AS FALSE**, and the old `bootstrap.py:104` anchor is corrected to **67**. **Q5 = B is unchanged**: convergence is a separate lane, and ordinary authorized API configuration **is not convergence**. | **Done** |
| 6 | **F6 — Q2's ground is normative, and the old deferral/reopen condition is REMOVED, not re-worded.** §6/Q2 and the §11 legend both argue at the boundary and identically: **absent means no asserted source floor** — not evidence of a malformed or unmappable assertion; **A** preserves missing-metadata compatibility for direct engine/helper inputs, envelope-v1 shapes and producers outside the normalized contract; **B** fails on **semantic conflation** plus **unmeasured compatibility blast radius**. The deferral keyed to *"an accepted producer actually populates event `labels`"* **has fired and is deleted**, and the volumetric grounds — *"absence is universal on the live correlation path"* and *"floor-absent is the bulk / ordinary shape"* — are **withdrawn**: **this packet has never measured traffic volume**. The `alert_writer.py::validate_envelope` guarantee (229; rejects at 264–266, 267–271, 272–274) is stated: **absence is unreachable for that producer**. **Q2 = A and the Q2 = B NO-GO are unchanged**, and B remains on the ballot for coordinator override. | **Done** |
| 7 | **F7 — stale document evidence is demoted, and no current decision anchors on `87e95cd`.** The `siem/api.py` docstring phrase *"khong worker wire"* (line **26**) is **stale** — a module-scope note predating the T17+ worker tier, contradicted by the packaged and compose-declared `pf-correlation` service — and is retained **only as a dated module-scope note that may NOT be cited as current truth about worker wiring**; what survives from that docstring is the still-true exclusion of correlation from the **mounted HTTP API** (25–27). **`d3aaf6f` is the sole base for every current SOC source decision**; the surviving `87e95cd` references are confined to **history and ancestry** (§1 R1 worktree tip, §2 ancestry/`merge-base`, and the historical rows of §12), and §5.2's referrer inventory was re-measured at `d3aaf6f` with the stray current anchors removed. | **Done** |
| 8 | **§8.7 and §11 carry the CURRENT disclosures, not the superseded ones.** §8.7's forbidden-claims list and the §11 decision block both state the **deployment-wired** boundary: a Phase-2 change **can** affect the packaged `pf-correlation` worker on a deployment that runs it, while **no instance is claimed running or production-observed** and **tests are not runtime evidence**. The seventh amendment's qualifier — *"must not be presented as taking effect on correlation on deploy, because surface C is not runtime-wired"* — is **labelled HISTORICAL, WRONG and SUPERSEDED** at its own location in the §11 Q5 legend, and the withdrawal of the older *"live … on ingest and correlation"* sentence is **itself withdrawn** in favour of **deployment-wired, not observed-live**. **No operative sentence anywhere states NOT-RUNTIME-WIRED, no worker wiring, no producer populates, absence universal, CLI-only setter, bulk floor-absent, or three surfaces**; every occurrence is a labelled historical quotation. | **Done** |
| 9 | **Q1–Q6 are unchanged.** **Q1 = A**, **Q2 = A**, **Q3 = A**, **Q4 = the exact label `label:unresolved-floor`**, **Q5 = B**, **Q6 = A** — preserved verbatim. **No ballot option was added or removed, no question was added, and no recommendation changed**, including the **Q2 = B NO-GO assessment**, which is re-grounded but not reversed. The underscore form `label:unresolved_floor` remains withdrawn and is not a selectable answer or a fallback. | **Done** |
| 10 | **The accounting and the pins are unchanged.** **Five authorized edit rows (P2, P2b, P3, P4, P5) across seven approximate ranges in three files**, with **P2 still one contiguous range (≈408–422)**. **P1, N1, N2 and N3 are four no-edit verification-only preflight pins OUTSIDE that count**, contributing no range and moving no figure. No `PayloadFloor` arity change, **no §8.2 row P6**, no emitted-tag outcome change, and no §8.3 expectation weakened or reclassified. The row-driver taxonomy is likewise unchanged: **P2b = pure Q6 shape**, **P2 = mixed with the Q6 completeness rule**, **P3 = Q2 policy (Q4 for the token)**, **P4 = mixed Q1/Q4 policy and not tuple-shaped**, **P5 = Q1/Q2 policy plus Q4 vocabulary**. | **Done** |
| 11 | **Status and phases are unchanged, and no authority is claimed.** Packet status stays **`PROPOSED`**. **Phase 1 stays HELD** — on the Q1–Q4 / Q6 answers and, additionally, pending a **fresh independent PASS** and a **separate written coordinator grant**; Phase 1 is **allowlist entries 5–7 only**, under every answer, with **no Phase-1 integration test**. **Phase 2 stays behind the separate §7.1 grant** (published RED bytes, an **independent review** by someone who did not author them, and an explicit written coordinator grant), and Phases 4 and 5 require their own further gates. **No runtime, date or stack authority is claimed**: nothing was run, started or installed, no coverage was produced, and the W1 dates **2026-08-01 → 2026-08-23** and the **2026-12-21 → 2026-12-31** release window are unchanged. | **Done** |
| 12 | **Source control is untouched.** This work wrote exactly **one** file — this one — in the `cybrik-suite` worktree at `codex/w1-d04-i03-marking-r2-gate-r1`. It remains the **sole untracked path**, with **zero staged** and **zero commits** ahead of base `eedadc561700d3e1fa052322d44eb63151df0009`. **Nothing was staged, committed, fetched, pushed, merged or rebased**; no dependency was installed, no test or coverage run was executed, and no stack was started. No file in `cybrik-soc-command-center` or any other repository was written. | **Done** |
| 13 | **Identity is reported externally, not embedded.** This file's post-cycle blob SHA-1, SHA-256, line count and byte count are **deliberately not written into the file** — embedding a digest of the bytes inside those same bytes is self-referential and cannot be made true. They are computed read-only after the last edit and **reported in the delivering response**, which is the only place they can be stated accurately. | **By design** |
| 14 | **No self-review, and a NEW fresh independent PASS is still required.** Neither the eighth writer nor the ninth reviewed its own output as an independent reviewer, and **nothing in §12, §12.1 or §12.2 is offered as an independent PASS**. The eighth independent review of the eighth pass's bytes returned **NO-GO (P0 = 1, P1 = 1, P2 = 1, P3 = 1)**; those four findings are corrected in the ninth-remediation table in §12, **and correcting a finding is not passing a review**. What this packet still needs is a **fresh independent review by someone who did not author these bytes** and, separately, a **Founder/coordinator answer to Q1–Q6**; §7.1's grant requirement stands unchanged, and this checklist substitutes for neither. | **Done** |

---

## 13. Executed evidence and coordinator decisions — recorded 2026-07-29

> **This section is the current truth about decisions and phase state. It is an addendum, not a
> rewrite.** Every section above it stands exactly as written and is **historical** — true of the
> pass that wrote it. Where this section and an earlier one disagree about **current decision or
> phase state, this section governs**. Where they disagree about **provenance, class, count, anchor,
> line number or withdrawal, the earlier section governs and is unchanged**: this record **read no
> SOC source of its own**, re-measured nothing, and **upgrades nothing to class S**. It is a
> **transcription of issued decisions and reported lane evidence**, and it **promotes no claim**.

### 13.1 Coordinator decisions — issued, no longer recommendations

| Question | **Issued decision** | Prior status in this packet |
|---|---|---|
| **Q1** | **A** | recommended A (§6/Q1) |
| **Q2** | **A** | recommended A; Candidate B NO-GO, retained on the ballot (§6/Q2) |
| **Q3** | **A** | recommended A (§6/Q3) |
| **Q4** | exact label **`label:unresolved-floor`** | recommended (§6/Q4); the underscore form `label:unresolved_floor` stays withdrawn and is not a fallback |
| **Q5** | **B** | recommended B (§6/Q5) |
| **Q6** | **A** | recommended A, extended to the full internal carrier chain (§6/Q6) |

**No answer moved on issuance.** Every recommendation in §6 was adopted verbatim, which is why no
range, class, count, anchor or taxonomy in §8.2/§8.2.1/§8.3 required revision. The §8.2 accounting
stands as recorded: **five authorized edit rows (P2, P2b, P3, P4, P5) across seven approximate
ranges in three files**, with **P1, N1, N2, N3** as four no-edit preflight pins outside the count.

### 13.2 Phase 1 — executed evidence

**Exact Phase-1 test-file digests (SHA-256), recorded in the order published by the lane:**

1. `b5db2162631620e8074b189088feabff9529b2e26f435d428fdbe4b028a8aadb`
2. `5d929f16f8cba1aa25344e21b9e542a18ca78a0598d928a2026971ebc0516491`
3. `dae47bb6a96956f1ea022225072bf84df2bbb6528bb4bddc35087ad9468c55e8`

> **Digest↔file mapping is deliberately not asserted.** The three digests correspond to the three
> Phase-1 test paths (allowlist entries **5–7**), but the published mapping of digest to filename was
> not supplied to this writer, and this packet does not guess it. The digests are recorded exactly as
> issued so a later reader can verify them directly against the files.

**Exact Phase-1 run, at SOC base `d3aaf6fb29c57f145de8f131ad1588aae57d57c9`:**

| Measure | Reported value |
|---|---|
| Collected | **242** |
| **RED-required** nodes **failed** | **95** |
| **Phase-1 regression-lock** nodes **passed** | **44 of 44** |
| Pre-existing nodes passed | **103** |
| Errors | **0** |

The three classes account for the collection exactly — **95 + 44 + 103 = 242** — so no node is
unclassified and no count is a summary of another. **The two classes were reported separately**, as
§8.1 requires, and never merged into a single pass/fail number.

**Published artefacts:** the **exact 95-node RED-required manifest** and the **exact 44-node
regression-lock roster** were published as node-id rosters, not as counts or paraphrases, which is
what §7.1 item 2 requires and what item 3 keeps separate.

**Independent review of the Phase-1 bytes:** an independent semantic review returned **PASS** with
**P0 = 0, P1 = 0, P2 = 0** — the first PASS this packet has recorded, against nine consecutive
NO-GO returns above. It was performed by a reviewer who did not author the bytes (§7.1 item 4).

### 13.3 The §7.1 Phase-2 grant

The **coordinator issued an explicit written §7.1 grant** naming **exactly source paths 1, 2 and 3**
— `ingest/source_labels.py`, `siem/correlation.py`, `siem/engine.py`. It named no fourth path, no
`connector/bootstrap.py`, no allowlist entry 4 or 8, and no phase beyond Phase 2. **§7.1 items 1–5
are discharged for that grant and for nothing else**; the conditions themselves stand unchanged for
any future grant.

### 13.4 Phase 2 — executed evidence

**Exact Phase-2 source-file digests (SHA-256):**

| Source path | SHA-256 |
|---|---|
| `source_labels.py` (path 1) | `15a2dc67dc1e3935b7cc73a04cdef7c6df4bf49c7d7697f5ba57ff38d00457ef` |
| `correlation.py` (path 2) | `c144b8bf7465dcbac1412aa6fceea319bc35b368d8c23cbcb479978b87bdeb45` |
| `engine.py` (path 3) | `e640f9dc0404103ef4a101adf2eddb9373325e8b67df2e067114cb7e3abfb542` |

**The three Phase-1 test digests in §13.2 are unchanged across Phase 2.** The tests written to
express the decisions were not adjusted to fit the implementation — which is the whole point of the
phase split, and is independently checkable from the digests.

**Phase-2 results:**

| Measure | Reported value |
|---|---|
| Focused unit run | **242 / 242 PASS** |
| Full collectible unit suite — **independent review's environment** | **2606 / 2606 PASS** |
| Full collectible unit suite — **writer's environment** | **2616 / 2616 PASS** |
| `ruff` | **PASS** |
| Stack / database / broker / network / coverage | **none — nothing started, nothing connected, no `--cov`** |

> **The two full-suite totals differ by 10 and both are recorded, not reconciled.** `2606` is what
> the independent review collected; `2616` is what the writer collected in its own environment. Both
> are **all-pass over what each environment collected**, so neither reports a failure — but the
> collection sets are demonstrably not identical, and **this packet does not know which nodes
> account for the difference** and does not assert that either total is the correct one. Recording
> both is the honest form; **a later reader must not cite either as "the" suite size.** Collection
> differences of this kind are ordinary (optional dependencies, environment-gated markers), but that
> is an explanation of the *class* of cause, **not a measurement of this instance**.

**Independent review of the GREEN bytes:** returned **PASS** with **P0 = 0, P1 = 0, P2 = 0**, and
**P3 = 3 nonblocking** findings, all three recorded in §13.9.

### 13.5 Source-control state of the implementation worktree

| Fact | State |
|---|---|
| Location | **local-only** — the implementation worktree exists on this machine and nowhere else |
| HEAD | **`d3aaf6f`, unchanged** — the base was never moved |
| Modified paths | **six** — the three Phase-1 test paths and the three Phase-2 source paths, and nothing else |
| Staged | **zero** |
| Untracked | **zero** |
| Cache / coverage artefacts | **zero** — no `.coverage`, no stray build or cache path (§1.1 is what makes this worth stating) |
| Commit / push / merge / release | **none of any kind** |

### 13.6 What `COMPLETE` means here — and the boundary it does not cross

**Phase 2 is `COMPLETE` / `ADMITTED` for this bounded local six-path lane, and for nothing else.**
Stated as explicit negatives, because the word invites over-reading:

- **NOT accepted.** No acceptance decision was made; nothing in `contracts/` moved.
- **NOT integrated.** The six paths are not merged into any integration branch or lane.
- **NOT canonical.** This is not the canonical state of `cybrik-soc-command-center` at any ref.
- **NOT pushed, NOT merged, NOT released.** No remote was contacted; the release window is untouched.
- **NO runtime or deployment observation is made.** Nothing was run against a deployed instance,
  no worker was started, no cluster was inspected. **Tests are not runtime evidence** (§8.7), and the
  fact that surfaces **C**/**D** are *deployment-wired* (§5.0, §12.2 rows 1–3) remains a statement
  about **source packaging and declaration**, never about anything observed running. The Phase-2
  change **can** affect the packaged `pf-correlation` worker **on a deployment that runs it** — that
  boundary is unchanged from §10, and **no such deployment is claimed to exist or to have been seen.**
- **The scope is six paths.** Nothing outside them was edited in any repository.

**What is genuinely established:** on one local worktree at base `d3aaf6f`, the decisions in §13.1
are expressed in tests that failed before the implementation and pass after it, the pre-existing
suite that each environment collected still passes, lint is clean, and two independent reviews — one
of the RED bytes, one of the GREEN bytes — returned PASS. That is a bounded local GREEN. It is real
evidence and it is the *only* thing claimed.

### 13.7 Q5 = B — Phase 3 stays outside this lane

**Q5 = B** means bootstrap convergence is **not** part of R2 and **was not performed**. Allowlist
entries **4** (`connector/bootstrap.py`) and **8** (`test_alert_writer_bootstrap.py`) are **dropped
from the R2 lane**, and §8.3 group **D** (tests 15–22) was **not written**. Convergence requires a
**separate Alert Writer lane with its own separate grant**; nothing in §13 opens it, requests it, or
prepares it. The §12.2 row 5 finding stands unchanged: the base has **no automatic and no bootstrap
convergence implementation**, and ordinary authorized connector create/update API configuration of
`label_floor_enforce` **is not convergence**.

### 13.8 Named follow-on sub-lane — `W1-I03/PF-PERSIST` (**HOLD / PROPOSED**)

**Identity.** This is a **named sub-lane under the existing `W1-I03` identity**. The fixed roster of
48 is unchanged: **no task 49 is created**, and no replacement identity is minted.

**Subject.** PF worker correlation-state persistence:
`ops/pf-workers/pf_workers/correlation_processor.py` — `dump_group_state` / `load_group_state`.

**Observation.** Those two functions **currently omit `label_unresolved`** from the group state they
serialize and rehydrate through Valkey.

**Precise risk.** The **classification floor persists** across a rehydrate — but the **provenance
token can be lost between detections**. The consequence is specific and is the reason this is worth
naming: a group whose `toi_mat` was **inferred** by the Q1/Q2 fail-closed rule can, after a rehydrate,
present as though its `toi_mat` were **source-asserted**. The floor is not weakened; **the
distinction between an inferred floor and an asserted one is what degrades**, and that distinction is
exactly what `label:unresolved-floor` exists to carry (§6/Q4, §6/Q6). The monotonic-OR guarantee
decided in §6/Q6 holds **within** a live group state; it does not survive a serialization round-trip
that drops the field.

**Status: `HOLD` / `PROPOSED`. No edit authority is granted or implied by this record.** No path in
`ops/pf-workers/` was touched by Phase 1 or Phase 2, none is on the R2 allowlist, and this sub-lane
opens no phase. Acting on it requires its own grant.

**Proposal only — not a decision.** A suggested persisted field **`lu`** carrying the unresolved
flag, with **fail-safe validation** on load (a state that lacks the field, or carries it
unparseably, resolves to the conservative value rather than to a silent `False`). **This is a
proposal recorded for the future lane to evaluate; it is not decided, not ratified, and the field
name, encoding and validation semantics are all open.** In particular it has **not** been checked
against the wire-separation rule in Q3 = A, against existing persisted-state compatibility, or
against any migration concern — the future lane must do that work.

### 13.9 The three nonblocking (P3) findings from the GREEN review

Recorded because they are real and because **no authority exists in this record to repair them.**
None blocks anything; none changes an answer, a range, a class or a count.

| # | Finding | Disposition |
|---|---|---|
| 1 | **PF worker persistence gap** — `dump_group_state` / `load_group_state` omit `label_unresolved`. | Carried into the named sub-lane **`W1-I03/PF-PERSIST`** (§13.8). **HOLD / PROPOSED.** |
| 2 | **One added test docstring makes an inaccurate equivalence claim.** A docstring in the Phase-1 additions asserts an equivalence that does not hold as stated. The **assertion the test executes is correct and is not affected**; the defect is in the prose describing it. | **Not repaired here — no edit authority.** Recorded so a future authorized pass fixes the prose rather than discovering it as drift. Note that §8.6 items 8 and 10b treat committed invariant **prose/docstrings** as first-class, which is why this is worth naming rather than waving through. |
| 3 | **Local variable floor-type reuse in `engine.py`.** A local variable is reused across floor types within the Phase-2 implementation — a readability/clarity concern, **not** a correctness or outcome concern. | **Not repaired here — no edit authority.** The six-path lane is closed; touching `engine.py` again requires a fresh grant. |

**Why they are left alone.** The §7.1 grant named exactly source paths 1–3 for the Phase-2
implementation and is discharged. Reopening a file to make a nonblocking improvement after the
review that cleared it is an unreviewed edit, which is the precise failure mode §7.1 exists to
prevent. **Findings 2 and 3 are therefore recorded, not fixed**, and neither is a defect the
Phase-1/Phase-2 evidence depends on.

### 13.10 Preserved constraints — unchanged by this record

- **W1 dates `2026-08-01` → `2026-08-23` are unchanged.** The release window
  **`2026-12-21` → `2026-12-31`** is unchanged. **W0–W6 dates are unchanged.** Nothing in §13 has
  date authority, and no phase completion moves a date.
- **No local stack before `G-C stable-v1.0`.** This constraint stands and was **honoured**: Phase 1
  and Phase 2 ran focused and full **unit** tests only — **no stack was started, no database, broker
  or network dependency was used, and no coverage was produced** (§8.4, §8.5). Real-PostgreSQL / RLS
  evidence remains a **separate, later** requirement and **none is claimed here**.
- **Nothing in `cybrik-suite` moved.** This file remains the **sole untracked path** in the
  `cybrik-suite` worktree at `codex/w1-d04-i03-marking-r2-gate-r1`, **zero staged**, **zero commits**
  ahead of base `eedadc561700d3e1fa052322d44eb63151df0009`. **§12.2 row 13 continues to govern
  identity reporting:** this file's post-edit SHA-256, line count and byte count are **not embedded
  in it** and are reported in the delivering response.
- **§12.2 row 14 is partly discharged and partly standing.** The requirement for a **fresh
  independent review** is discharged **twice over** for the *lane bytes* — the RED review and the
  GREEN review, both PASS, both by reviewers who did not author what they reviewed (§13.2, §13.4).
  The requirement for a **Founder/coordinator answer to Q1–Q6** is discharged by §13.1. **What is
  NOT discharged: this addendum itself has not been independently reviewed**, and **acceptance,
  integration and canonicalization of the six-path lane remain ungranted** and require their own
  separate decisions.
