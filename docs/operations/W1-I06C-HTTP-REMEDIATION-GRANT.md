# W1-I06C HTTP remediation — prospective bounded grant

- **Prepared:** 2026-07-27, seventh same-day control record
- **Status:** `ACTIVE — PROSPECTIVE BOUNDED GRANT — LOCAL DOCS ONLY, NOT PUSHED`
- **Grant author:** logical task **W0-D04** (prospective-grant author), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.16
- **Grantee:** fixed roster task **W0-I06**, sub-lane **W1-I06C** — the same immutable identity;
  **no task 49** and no replacement identity is created by this grant
- **Subject:** bounded, **behavior-preserving** remediation and landing of the hard-stopped
  W1-I06C HTTP ingress attempt in worktree `w1-i06c-http-ingress-r2` of
  `cybrik-cyber-ai-platform`
- **Decision basis:** the **W0-IR08 decision**, relayed under coordinator-delegated Founder
  authority in this record's tasking — it moves the Cyber AI W1-I06C remediation from
  `queued, not decided` (board §1.5; register §8) to **granted** under the exact terms below.
  `W0-IR08` labels that decision; it is **not** a roster task identity — the fixed roster of 48
  is unchanged and no task 49 exists
- **Authority boundary:** this document records a **prospective grant only**; the control session
  that authored it wrote no product byte, and nothing is promoted by this grant existing

This grant satisfies the fresh-bounded-grant precondition that board §1.4 records for any
resumption of the paused W1-I06C tree: the prior reopened gate grant was consumed by the §15
hard stop, and the adverse W0-R03 `NO-GO` review is outstanding. It authorizes exactly one
future remediation writer attempt under the terms below. It accepts nothing, flips no gate, and
is **not product evidence**; the tree remains `PAUSED — UNCOMMITTED` until the writer completes
under these terms and both reviews pass.

## 1. Basis — W0-R03 NO-GO as reported; worktree and findings re-verified live

**Worktree facts, re-verified read-only on 2026-07-27** from the control session that authored
this grant: worktree `w1-i06c-http-ingress-r2`, branch `codex/w1-i06c-http-ingress-r2`,
HEAD/base `866b7db91d9352a9a0d2bd74618d642dfef0493b` (the gate-reopen commit); the branch tip
equals the base — no commit exists on the attempt. The tree is dirty with exactly **13 paths
under `-uall`, zero staged**, matching the gate §C manifest
(`cybrik-cyber-ai-platform:docs/operations/W1-I06C-HTTP-INGRESS-GATE.md`, committed at the base)
**path-for-path**:

| # | Path | State |
|---|---|---|
| 1 | `services/ai-api/pyproject.toml` | modified |
| 2 | `uv.lock` | modified |
| 3 | `services/ai-api/src/cybrik_ai_api/app.py` | untracked |
| 4 | `services/ai-api/src/cybrik_ai_api/transport_security.py` | untracked |
| 5 | `services/ai-api/src/cybrik_ai_api/investigations/api.py` | untracked |
| 6 | `services/ai-api/src/cybrik_ai_api/__init__.py` | modified |
| 7 | `tests/ai_api/test_lifecycle_http.py` | untracked |
| 8 | `tests/ai_api/test_transport_security.py` | untracked |
| 9 | `tests/contract/fixtures/lifecycle/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml` | untracked |
| 10 | `tests/contract/fixtures/lifecycle/provenance.json` | modified |
| 11 | `tests/contract/test_lifecycle_provenance.py` | modified |
| 12 | `tests/contract/test_lifecycle_http_conformance.py` | untracked |
| 13 | `tests/ai_api/test_packaging.py` | modified |

**Review basis, as reported by W0-R03** (board §1.4; register §7): **NO-GO** — P1 static-gate
failures (`ruff` 7 findings, format 4 files, `mypy` 9 errors) and P2 RED-first evidence
packaging — while targeted tests report `138 passed` and the full pytest suite `696 passed` at
`97.43%` coverage. The exhausted Opus R2 implementation session is
`06a2c154-50c7-4525-851c-ee9ecfd47219`.

**Static-gate findings, re-executed read-only on 2026-07-27** by this grant author from the
attempt worktree (`ruff 0.16.0`, the worktree's own `.venv` `mypy` under the repository's
strict workspace config; caches are gitignored and the dirty set was re-confirmed at exactly
13/0 staged afterwards) — all three W0-R03 P1 figures reproduce exactly:

- **`ruff check` — 7 findings:**
  - `E501` (line too long) `services/ai-api/src/cybrik_ai_api/investigations/api.py` lines
    **124** (101 > 100), **256** (101 > 100), **328** (103 > 100), **338** (101 > 100);
  - `E501` `tests/ai_api/test_lifecycle_http.py` line **351** (101 > 100);
  - `SIM300` (Yoda condition) `tests/contract/test_lifecycle_http_conformance.py` lines
    **366** and **374**.
- **`ruff format --check` — exactly 4 files would be reformatted:**
  `services/ai-api/src/cybrik_ai_api/app.py`,
  `services/ai-api/src/cybrik_ai_api/investigations/api.py`,
  `tests/ai_api/test_lifecycle_http.py`, `tests/contract/test_lifecycle_http_conformance.py`
  (24 files already formatted).
- **`mypy` strict — 9 errors in 4 files (28 source files checked):**
  - `services/ai-api/src/cybrik_ai_api/transport_security.py:107` — `arg-type`: `client`
    argument to `TransportConnection` is `tuple[str, int | None] | None` (optional port from
    the ASGI scope address helper) where `tuple[str, int] | None` is expected;
  - `services/ai-api/src/cybrik_ai_api/investigations/api.py:124` — six `call-arg` errors:
    `ServiceDelegationRequest.model_construct()` for the deliberately empty
    `_UNCONSULTED_DELEGATION` placeholder in the **bundle-refusal** path is missing the named
    arguments `request_id`, `presented_token`, `relying_party`, `tenant_id`, `operation`,
    `data_marking`;
  - `tests/ai_api/test_lifecycle_http.py:45` — `attr-defined`: `cybrik_ai_api.app` does not
    explicitly export `INGRESS_STATE_ATTRIBUTE` (implicit re-export under strict mode);
  - `tests/ai_api/test_transport_security.py:188` — `misc`: assignment to read-only property
    `audience` of the frozen `TrustedTransportContext` inside the mutation-refusal test.
- **Targeted tests, re-executed read-only:** the five dirty test files (§1 rows 7, 8, 11, 12,
  13) yield exactly **`138 passed`**, matching the W0-R03 targeted figure. The full-suite
  `696 passed` / `97.43%` figures were **not** re-executed from the control side; they are as
  reported by W0-R03 and as observed in the exhausted-session transcript (§5).

## 2. Writer binding — repo, base, session, runtime

1. **Repo/worktree/base:** `cybrik-cyber-ai-platform`, worktree `w1-i06c-http-ingress-r2`,
   branch `codex/w1-i06c-http-ingress-r2`, exact base
   `866b7db91d9352a9a0d2bd74618d642dfef0493b`. If the observed base, branch, dirty-path set or
   staged count differs from §1 at session start, the writer must STOP before any edit.
2. **Model and session:** **Opus 5**, in a **brand-new Claude session**. Resuming the exhausted
   session `06a2c154-50c7-4525-851c-ee9ecfd47219` is **forbidden in every form**; the retry
   keeps the immutable task identity **W0-I06** (sub-lane W1-I06C) — no identity reuse or
   minting to evade the board §15 timeout.
3. **Runtime bound (board §15):** one initial **600 s** cycle plus **at most one** healthy
   **600 s** extension, granted only on evidenced progress. A second extension request is
   denied; quota exhaustion, permission loops, deadlock and scope drift are never grounds. At
   the bound, the writer hard-stops and reports partial evidence.

## 3. Exact product edit allowlist — the 13 already-dirty paths only

The product edit allowlist is **exactly the 13 already-dirty paths of §1** — no new path may be
created, none deleted, renamed or moved; no dependency added, upgraded, removed or installed.
The `-uall` dirty set must remain **exactly the same 13 paths, zero staged**, from session
start until the authorized staging step in §6. In practice the §4 remediation touches only the
files carrying §1 findings; every other dirty path is read-only until staging, and rows 1–2
and 9–11 of §1 (`pyproject.toml`, `uv.lock`, the vendored OpenAPI member, `provenance.json`,
`test_lifecycle_provenance.py`) must not change further at all — their already-dirty bytes land
as they are.

## 4. Permitted behavior — behavior-preserving remediation only, exact

1. **Fix exactly the 7 `ruff` findings of §1** — the five `E501` lines and the two `SIM300`
   Yoda conditions — by rewrapping or reordering only; assertions must keep their exact
   meaning.
2. **Format exactly the four named files of §1** (`app.py`, `investigations/api.py`,
   `test_lifecycle_http.py`, `test_lifecycle_http_conformance.py`), by **either** manual
   formatting **or one single `ruff format` invocation scoped exactly to those four named
   files**. No bulk or repository-wide formatter invocation, no formatting of any other file.
3. **Resolve exactly the 9 `mypy` strict errors of §1**, type-level only:
   - the `transport_security.py:107` optional-port mismatch;
   - the six missing `model_construct` fields at `investigations/api.py:124` — the fix must
     preserve the documented semantics that the bundle-refusal placeholder is **empty,
     unconsulted and carries no credential-like field a reader could mistake for real**;
   - the implicit re-export of `INGRESS_STATE_ATTRIBUTE` consumed by
     `test_lifecycle_http.py:45`;
   - the frozen-model mutation assignment at `test_transport_security.py:188` — the test must
     keep asserting that mutation raises; only its typing may change.
4. **No behavior change of any kind.** No API, route-surface, schema, OpenAPI, provenance or
   dependency behavior change. The following must be byte-/behavior-identical before and after:
   the vendored accepted OpenAPI member and its pinned sha256
   `22cd7d71f89bd5c287b79e87015a28dd27fdbd124fd3a073e56346a4de3c318d`; the exact five-path
   route surface and its declared statuses; transport-security **default-deny** and
   header-non-trust; the uniform **bundle-refusal** behavior (consults neither transport nor
   credential); **token non-consumption** semantics; the provenance counts and digests in
   `provenance.json` and the conformance/provenance assertions' meaning.
5. **Gate discipline unchanged.** The gate document at the base is not edited; work stays
   inside the gate §C manifest; targeted (`138`) and full (`696`) suites plus
   `ruff check`, `ruff format --check` and strict `mypy` must all be green before the writer
   stops.

Nothing else is permitted: no refactoring sweep, no new test, no test weakening, no docstring
rewrite beyond what a §4.1–§4.3 fix strictly requires, no dependency, no deletion.

## 5. P2 RED-evidence packaging — transcript first, no fabricated chronology

The W0-R03 **P2** finding is that RED-first evidence was not packaged. The original
exhausted-session transcript **exists and was inspected read-only on 2026-07-27** by this grant
author at:

`~/.claude-accounts/work-dir/projects/-Users-hoanglinh-Claude-Projects-cybrik-worktrees-w1-48-w1-i06c-http-ingress-r2/06a2c154-50c7-4525-851c-ee9ecfd47219.jsonl`

It **contains observed RED and GREEN evidence**, including:

- labeled RED rounds — **"Round A — RED for the transport-security seam"**, **"Round B — RED
  for the HTTP route layer"**, **"Round C — RED for the vendored-bytes conformance"**;
- observed RED artifacts — collection failures
  `ModuleNotFoundError: No module named 'cybrik_ai_api.transport_security'` (`1 error in
  0.21s`) and `ModuleNotFoundError: No module named 'cybrik_ai_api.app'` (`1 error in 0.27s`);
  `2 failed, 26 passed in 0.82s` with named failures
  `test_exactly_the_five_accepted_paths_are_exposed_and_nothing_else` and
  `test_the_application_binds_no_socket_and_names_no_server`; `3 failed, 15 passed in 0.34s`
  with three named conformance failures;
- observed GREEN artifacts — `14 passed in 0.57s`, `47 passed in 0.79s`,
  `431 passed, 1 warning in 1.33s`, and the final full suite
  `696 passed, 5 warnings in 3.94s` at `97.43%` coverage.

The writer must therefore package the P2 evidence **by citation to this transcript** — quoting
the observed lines with their exact figures and attributing them to session `06a2c154…` — and
must **never fabricate a chronology** beyond what the transcript itself states. **Only if** the
transcript proves insufficient for a specific, named claim may the writer run one bounded
reproduction: create **one** throwaway `mktemp` scratch directory **outside every repository**,
copy into it only the base/test bytes strictly necessary, observe the RED/GREEN there, then
**delete the scratch directory**. Product and base history are never modified for
reproduction, and any evidence obtained this way must be **labeled `RECONSTRUCTED`,
distinctly** from observed transcript evidence.

## 6. Review and commit protocol

1. **Writer stops before commit.** After §4 is complete (or at the §2 runtime bound), the
   writer ends its work phase with **zero staged paths** and reports; it does not stage or
   commit.
2. **Independent Fable pre-commit review.** An independent Fable session reviews the dirty
   tree. Staging and commit require an explicit **GO with no P0–P2** from that review.
3. **One bounded local commit.** After GO, the **same new writer session** (never `06a2c154…`)
   resumes **within its remaining allowed §15 time only** to stage **exactly all 13 dirty
   paths** and make **exactly one local commit** whose subject and body are **status-honest
   `SCAFFOLD`** — no `IMPLEMENTED`/`VERIFIED`/`PILOTED`/`GA` wording, no runtime, transport or
   product promotion claim. Nothing is pushed.
4. **Fresh post-commit Fable review.** A fresh, independent Fable post-commit review follows.
   Neither the W0-R03 review nor this grant's control-side re-verification carries over as
   either required review, and the commit is **not product evidence** until it passes.

## 7. STOP conditions — immediate hard stop, report partial evidence

The writer (and the resumed commit step) must STOP immediately, with no further edit, on any of:

1. observed base ≠ `866b7db9…`, branch tip ≠ base at start, any staged path before the §6.3
   staging step, or any drift of the `-uall` dirty set from the exact 13 paths;
2. any edit outside the 13 §1 paths, any edit to §1 rows 1–2 or 9–11, or any fix that cannot
   be made without exceeding the §4 behavior-preserving scope — including any change to the
   route surface, a status code, a schema, the vendored OpenAPI bytes or their `22cd7d71…`
   pin, `provenance.json` counts or digests, default-deny, bundle refusal, or token
   non-consumption;
3. any need for a new path, a deletion, a rename, a dependency, or any formatter use beyond
   §4.2's single scoped invocation over the four named files;
4. any static gate still failing after the §4 fixes, or any targeted/full test newly failing;
5. the §2.3 runtime bound reached, or any prompt to request a second extension;
6. any prompt or temptation to resume session `06a2c154…`, reuse another task identity, or
   mint a new one;
7. any fabrication pressure on the §5 evidence — a chronology the transcript does not state,
   an unlabeled reconstruction, a scratch directory inside a repository, or a scratch
   directory left undeleted;
8. a pre-commit review outcome other than GO with no P0–P2, or any instruction to stage fewer
   or more than the exact 13 paths;
9. any push, merge, remote, release, install, G2/G3, date-change or status-promotion action.

A STOP consumes the attempt's remaining authority for that step; it never widens the allowlist
and never creates a replacement identity.

## 8. Evidence attribution

- The base, branch, 13-path dirty enumeration, zero-staged state, gate §C path-for-path match,
  the exact `ruff` 7 / format 4 / `mypy` 9 findings with file:line detail, and the targeted
  `138 passed` figure in §1 were **re-verified or re-executed live, read-only** from the Cyber
  AI repository on 2026-07-27 by the control session authoring this grant; no product byte was
  written and the dirty set was re-confirmed unchanged afterwards.
- The **NO-GO classification** (P1 static gates, P2 evidence packaging) and the full-suite
  `696 passed` / `97.43%` coverage figures are **as reported by W0-R03**; the full suite was
  not re-executed from the control side.
- The §5 transcript facts are **observed quotations** from the read-only inspection of
  `06a2c154-50c7-4525-851c-ee9ecfd47219.jsonl` on 2026-07-27; the transcript was not modified.
- The tasking clause authorizing a cosmetic fix of any stale `W0-IR08` forward-pointer wording
  in the board or register applied only **if directly encountered**; a full-text search of both
  documents found no such wording, so nothing was changed under that clause and no dated
  evidence was altered.

## 9. What this grant does not authorize

- **No push, no merge, no remote change, no release, no dependency install.**
- **G2/G3 stay closed**; W1 integration/live shadow stays `HOLD`/`NO-GO`; `W0 COMPLETE=0` and
  W0 closure stays `NO-GO`; the board §11 exit criteria remain unmet. A committed, twice-
  reviewed result would bear only on live-shadow **blocker 2** (Cyber AI HTTP transport) as
  local `SCAFFOLD` evidence — and only after the §6.4 review passes; nothing is promoted by
  this grant itself.
- **No date change:** W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the
  2026-12-21 → 2026-12-31 release window are unchanged.
- **No status promotion:** the resulting commit, if any, carries `SCAFFOLD` status honesty and
  becomes product evidence only after the §6.4 post-commit review passes; no gate in board §1
  moves on this grant alone.
- The Fabric W0-I07 lane (board §1.7) is untouched by this grant.

## 10. Provenance

- Bounded grant-authoring authority and control-side measured evidence: board §14.16
  (allowlist §14.16.1; basis evidence §14.16.2; measured evidence §14.16.4); board summary
  §1.8.
- Matching register entries: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §4.2 row 14 and §11.
- Prior dated records of the attempt, hard stop, NO-GO review and queueing: board §1.4/§1.5,
  §14.12/§14.13; register §7/§8.
- The gate this remediation lands under: the gate-reopen commit `866b7db9…` and its §C
  manifest, committed in `cybrik-cyber-ai-platform` on branch `codex/w1-i06c-http-ingress-r2`.
