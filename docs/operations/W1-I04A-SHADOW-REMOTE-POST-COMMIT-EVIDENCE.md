# W1-I04A SOC `shadow_remote` remediation — post-commit evidence record

- **Prepared:** 2026-07-27, nineteenth same-day control record
- **Status:** `RECORDED — POST-COMMIT EVIDENCE — LOCAL SCAFFOLD COMMIT, INDEPENDENTLY REVIEWED — NOT PUSHED, NOT MERGED, NOT INTEGRATED`
- **Record author:** logical task **W0-D04** (post-commit evidence reconciler), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.28
- **Subject:** the completed outcome of the remediation grant
  `docs/operations/W1-I04A-SHADOW-REMOTE-REMEDIATION-GRANT.md` (as amended/corrected/authorized
  by board §1.17–§1.19/§14.25–§14.27, register §20–§22): the granted writer produced **exactly
  one local commit** at the four already-dirty, grant-pinned paths, with an independent
  **W0-R03G** pre-commit review returning **GO** and an independent **W0-R03H** post-commit
  review returning **PASS**, both with no P0–P2
- **Classification recorded:** `SCAFFOLD` — **local, independently reviewed, unmerged and
  unpushed evidence toward the `shadow_remote` portion of live-shadow blocker 3 only**. It is
  **not** runtime, integration, CI, live-shadow, deployment or release evidence
- **Authority boundary:** this document records already-taken outcomes; it opens no writer,
  grants nothing, authorizes no next lane, flips no gate and closes no residual or blocker

All SOC facts below were obtained **read-only** from the product repository by the control
session authoring this record — live Git inspection, `git rev-parse`/`git status`/`git log`
measurement, independent `shasum -a 256` re-computation of the four committed blobs, and
read-only reading of the two review transcripts. **No product byte was written, nothing was
staged in the product repository, and no product command other than read-only inspection or
independent hashing was run by this record.**

## 1. The commit — re-verified live and read-only, 2026-07-27

| Item | Measured value |
|---|---|
| Repository / worktree | `cybrik-soc-command-center`, existing worktree `cybrik-worktrees/w1-48/w1-i04a-shadow-remote-r1` |
| Branch | `codex/w1-i04a-shadow-remote-r1` |
| Commit | `74f9774bfb5a6816cd9f0ddc230673a181a4cfd6` |
| Parent | `6464cfbfc99ecf2109988dff0e6164c8cac6b10a` — exactly the grant §3 base |
| Subject, byte-exact | `feat(copilot): add reviewed shadow remote scaffold` |
| Commits above base | **1** — `git rev-list --count 6464cfb..HEAD` = 1; no amend, no second commit |
| Working tree | **clean** — `git status --porcelain` empty; **zero staged**; no stash |
| Upstream / push / tag | **none** — `fatal: no upstream configured for branch 'codex/w1-i04a-shadow-remote-r1'`; nothing pushed |

The `origin` remote configured elsewhere in that repository is **pre-existing and was not
touched**; no fetch, push or remote configuration was performed by the lane or by this record.
The repository's default checkout (`cybrik-soc-command-center`, branch
`codex/w2j-org-assets-vertical`) carries substantial **unrelated, pre-existing dirty state** from
other in-progress work; this record only inspects the separate `w1-i04a-shadow-remote-r1`
worktree/branch and touches none of that unrelated state.

### 1.1 Landed bytes — exactly the four pinned paths, independently re-hashed

`git diff-tree --no-commit-id --name-only -r` on the commit returns **exactly four paths, all
mode `100644`, all added (`A`)**, no fifth path and no rename/delete:

| # | Path | Independently re-computed SHA-256 (this record) | W0-R03G / W0-R03H pin |
|---|---|---|---|
| 1 | `services/api/src/cybrik_soc/modules/copilot/shadow_remote.py` | `718175e83c05f33eb8dca7d08cc99af06843352682661f28bef2dd0e0e72a84a` | matches |
| 2 | `services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py` | `e71d79ce5890d275859830a933a3f745a90cc26066e6b73436fc37ff6809a014` | matches |
| 3 | `services/api/tests/unit/copilot/test_shadow_remote.py` | `e37377484f59da10f9be6b316e944a2994020c91b08e6f8aa67c9c9874bc2c07` | matches |
| 4 | `services/api/tests/unit/copilot/test_shadow_remote_contract.py` | `28f0d03e36f2ef2909595536fdeeecac63d3470326477d7f483c522424e391d6` | matches |

Line counts, independently re-measured: `shadow_remote.py` **537**, `shadow_remote_contract.py`
**762**, `test_shadow_remote.py` **1217**, `test_shadow_remote_contract.py` **585** — 3101 lines
total (`+3101 / −0`), matching the commit's own `--stat`. All four hashes are **byte-identical**
to the W0-R03G pre-commit pins and to the W0-R03H post-commit re-measurement; no byte changed
between pre-commit review and commit.

## 2. Writer session and runtime — corroborated through reviewer transcripts, not read directly

- **Writer session, as named by the commit body and both reviews:** Opus 5, session
  `2ceadba6-e72e-4ae6-b201-8d213d2425ea`, cited transcript path
  `~/.claude/projects/-Users-hoanglinh-Claude-Projects-cybrik-worktrees-w1-48-w1-i04a-shadow-remote-r1/2ceadba6-e72e-4ae6-b201-8d213d2425ea.jsonl`.
- **Disclosed gap, not papered over.** At the time this record was authored, that transcript
  file **does not exist** at the cited path, nor anywhere else this record searched under
  `~/.claude/projects`. The only files present in that project directory are the two **review**
  transcripts, `ff4de3ce-596c-42e9-9a5d-5bd10b06e28b.jsonl` (W0-R03G) and
  `2cd8f307-b798-4edf-b1b3-93ad91172e49.jsonl` (W0-R03H). Both reviews quote specific writer
  transcript lines (e.g. L42, L57, L60–86, L91–92, L101–102, L108, L140, L144, L157–158, L160,
  L163–164, L180, L203) and both independently re-derive the writer's session UUID from those
  quotations, so the writer session's **existence and content are corroborated through two
  independent reviewer readings of it**, not through this record reading the writer's transcript
  itself. This record does not claim to have read `2ceadba6…` directly, and flags its current
  absence from disk as an open provenance gap.
- **Runtime discipline, as corroborated by W0-R03G (session `ff4de3ce…`).** Grant §3.3 permits
  **one initial 600 s cycle plus at most one healthy 600 s extension**, no third cycle. W0-R03G's
  own review — issued mid-lane, before the commit existed — states the writer had stopped **before
  staging**, with the initial cycle's test-first work (81-test baseline, edits, RED, source fix,
  full green, lint/format/ast/mypy sweep) captured and reported, and explicitly finds "the
  extension is unused" at that point, granting **explicit YES** for the same session to draw on
  its **single** extension "to stage exactly four paths and make one local SCAFFOLD commit" and
  nothing else — no second commit, no third cycle, no push/fetch/merge/rebase/tag/remote action.
  The commit `74f9774b…` exists, is the writer's only commit above the base, and W0-R03H's
  post-commit audit found no evidence of any further edit, staging attempt or session beyond
  that single extension. **On that basis**, this record accepts that the writer's initial 600 s
  cycle ended at its designed stop-before-stage point and that the single permitted extension was
  used only to stage the reviewed hashes and commit — but, per the gap above, this conclusion
  rests on the two reviewers' quotations and findings, not on this record's own reading of the
  writer's transcript, because that transcript is not present on disk to re-verify directly.
  No third cycle is claimed or evidenced anywhere.
- **The grant is now terminal and consumed.** It authorized exactly one commit, that commit
  exists, and its authority ends there. No further W0-D04 prospective grant exists or may be
  issued for this remediation scope.

## 3. Independent reviews — two fresh Opus sessions, both distinct

| Review | Session | Outcome |
|---|---|---|
| **W0-R03G** — fresh independent Opus **pre-commit** review, against the four pinned hashes | `ff4de3ce-596c-42e9-9a5d-5bd10b06e28b` | **GO — no P0, no P1, no P2**, seven P3 observations |
| **W0-R03H** — fresh independent Opus **post-commit** review, against the committed bytes | `2cd8f307-b798-4edf-b1b3-93ad91172e49` | **Commit audit PASS; post-commit verdict PASS — no P0, no P1, no P2**, three new P3s (H1–H3) |

Reviewer separation holds per grant §10.2/§14.27.3: the writer (`2ceadba6…`), the exhausted
original writer (`c173b76f…`), the exhausted W0-R03F pre-commit reviewer (`e650bda1…`), W0-R03G
(`ff4de3ce…`) and W0-R03H (`2cd8f307…`) are **five distinct sessions**. W0-R03G's GO was issued
before the commit existed; W0-R03H's PASS independently re-measured the committed bytes rather
than trusting the writer's or W0-R03G's report.

### 3.1 W0-R03H's independent re-verification of grant conformance

W0-R03H enumerated every `ContractValidationError` raise site (28 total) in
`shadow_remote_contract.py` and confirmed no remote-controlled value reaches any `reason` string;
confirmed `_UNSAFE_TEXT_RE` strips all C0 controls, DEL and the U+2028/U+2029 separators before the 200-character cap at
the single `_quarantined` choke point; confirmed `Idempotency-Key` extraction/validation and that
all three GET bindings structurally cannot send it; confirmed `MAX_ORG_PATH_LENGTH = 512`,
`len(response.content)` measured after status checks and before `response.json()` with zero
occurrences of `content-length` in the module, the strict RFC3339 pattern applied before the
retained `fromisoformat` calendar check, and `from None` at both re-raise sites; and confirmed no
`traceparent`, no new dependency, no retry/backoff, and `http_client` remaining caller-injected.

## 4. Executed evidence — test-first chronology and static checks

Independently corroborated by W0-R03H against the writer transcript's own captured output (not
reconstructed): **baseline 81 tests collected** in `tests/unit/copilot/` before any edit; both
test modules edited first; the two source modules re-hashed immediately before the RED run and
confirmed still at pinned pre-fix bytes (`ca351c05…`, `8df05e5f…`); **one** pytest invocation
against those pinned bytes returned **43 failed, 88 passed** (88 = 81 pre-existing + exactly 7
new `PRE-EXISTING GREEN — REGRESSION GUARD, NO RED EXPECTED` guards, each separately measured
green pre-fix and re-run green post-fix); source edits began only after that RED was captured;
**final 131 passed** (81 pre-existing + 50 new) over `tests/unit/copilot/`; **bounded regression
39 passed** over the five grant-named files; `ruff check` all checks passed; `ruff format --check`
4 files already formatted (check modes only, no write, no `--fix`); `ast.parse` OK on all four
paths; targeted `mypy 2.3.0` (compiled) on the four paths: Success, no issues found.

W0-R03H independently re-ran these same checks against the committed bytes in a fresh, cache-free
invocation of the same borrowed venv and obtained identical figures (131 passed, 39 passed, `ruff`
clean, `ast.parse` OK ×4, `mypy` success), plus seven mutation probes proving each fixed assertion
is load-bearing (only the sanitizer-stripping probe left the suite green, recorded as open P3
item 1 below, carried from W0-R03G).

## 5. `ECC_SKIP_PRECOMMIT=1` bypass — disclosed, independently re-audited, not a blocker

The commit was created with `ECC_SKIP_PRECOMMIT=1`. The local ECC pre-commit hook's generic
credential-assignment heuristic flagged synthetic SOSIM negative-test fixtures in
`test_shadow_remote_contract.py` — string literals of the form
a local variable holding the literal text `Bearer …-must-never-appear`, whose entire purpose is
asserting that text never appears in error text, logs or quarantine records. The commit body
names three: line 395 (value `Bearer sosim-token-must-never-appear`), line 523 (value
`Bearer-sosim-enum-value-must-never-appear`) and line 536 (value
`Bearer-sosim-timestamp-value-must-never-appearZ`).

**W0-R03H independently re-applied the hook's own regex to the committed bytes and found a
fourth match, undisclosed by the writer's count:** line 559
(`"Bearer-sosim-stage-value-must-never-appear"`, inside
`test_checkpoint_enum_cause_chain_is_also_suppressed`). This record independently re-read lines
393–397, 521–525, 534–538 and 557–561 of the committed file and confirms all four fixtures
verbatim, exactly as W0-R03H quoted them. **Cause of the undercount:** the hook truncates its own
displayed matches with `head -n 3` (`pre-commit:40`); the writer's "three" is an accurate
transcription of what the hook *displayed*, not of how many lines actually matched — an
incomplete disclosure, not a false one (**P3-H1**, carried below).

**Pre-existence of line 395/394.** The commit body states line 395's fixture is pre-existing in
the original grant-pinned bytes (`54c8b92d…`), not added by this remediation. W0-R03H did not
accept this on the writer's say-so: the writer's own probe (`git stash list | head -2`, empty,
plus `sed` against the **already-edited** file) cannot establish pre-existence and W0-R03H rated
that probe inadequate (**P3-H3**). Instead, W0-R03H recovered the actual **pre-edit** file content
from the writer transcript's own pre-edit `Read` result and found the identical fixture text
present at **line 394** of the pre-edit 420-line file, shifting to line 395 only after the
remediation's insertions (**P3-H2** — the commit body's cited line number is the post-edit line,
not the pinned-bytes line). The underlying substantive claim — that this fixture pre-existed and
that the hook blocks the base attempt tree independently of this change — is **true**, but was
established by W0-R03H's own transcript-derived measurement, not by the writer's inadequate
probe.

**Severity, as independently determined by W0-R03H: P3, acceptable, not a P0–P2 blocker.** The
bypass short-circuits exactly one local hook (no gitleaks, lint, test or other guard invoked); all
four matches are the *generic* heuristic only, none matches a high-signal secret pattern; no
grant §11 STOP condition is tripped (no dependency/network/secret/`.env` access occurred, and a
heuristic false positive is not a new P0–P2 finding); renaming the fixtures was foreclosed because
it would have invalidated the four hashes the independent W0-R03G pre-commit review had already
returned GO against; and the bypass was disclosed in the commit body, not silent. **Residual, not
resolved here:** whether the repository's CI-side `gitleaks` guard (fail-closed over full history)
also flags these fixtures is untested and untestable locally, and **becomes a real gate the first
time this branch approaches CI or merge** — recorded as an open item, not closed by this record.

## 6. Caveats that travel with every citation of the above

1. **Borrowed-venv dependency caveat.** All executed figures come from the pre-existing, borrowed
   venv at `cybrik-soc-command-center/services/api/.venv` (CPython **3.12.13**), used read-only —
   no install, upgrade, download, `pip`, `uv sync` or lockfile touch. Its interpreter differs from
   the declared `python_version = "3.11"` in `[tool.mypy]`, and its third-party versions
   (`httpx 0.28.1`) do not come from this base's pins. `PYTHONPATH` was forced to this worktree's
   `services/api/src` and probe-verified before every cited run. This taints the evidentiary
   weight of local runs only, never the hash-pinned committed bytes.
2. **Cache honesty.** `__pycache__` directories created by the writer's own pytest runs were
   deleted repo-wide (14 directories; none pre-existed per the grant's start pin). `.pytest_cache`
   and `.mypy_cache` are absent (`-p no:cacheprovider`, `--cache-dir=/dev/null`). **However,
   `services/api/.ruff_cache/` was created by the writer's `ruff` invocations and remains on
   disk** — gitignored (`.gitignore:15`), so not committed, but the grant's original "no
   ignored/cache residue" start pin no longer holds, stated plainly rather than claimed clean.
   Independently re-confirmed present by this record: `services/api/.ruff_cache` and
   `services/api/src/cybrik_soc/__pycache__` both exist in the worktree today. **The latter is
   W0-R03H's own review-created residue** — its post-commit verification run created
   `cybrik_soc/__pycache__`, absent at that session's start, and W0-R03H did not delete it because
   its review is read-only. Both are disclosed here, not cleaned up by this record either — this
   record is likewise read-only toward the product repository.
3. **RED/test-first chronology is cited as reported and independently corroborated by W0-R03H
   against the writer transcript's own captured tool output; it was never reconstructed by this
   control-side record.**
4. **Fixed vs. deferred, exactly as the commit body states.** Fixed under this grant: the P1
   (bounded, count-only `_reject_unknown` reason plus a capped, control-stripped
   `sanitize_failure_message` as independent layer 2); both P2s (`Idempotency-Key`
   extraction/validation on create/cancel; a key-position secret-leak test reaching the HTTP 200
   path); all four P3s (`org_path` 512 enforcement; the `1_048_576`-byte response cap measured via
   `len(response.content)`; strict RFC3339 timestamps ahead of the retained calendar check; a
   `from None` cause-chain fix); and one grant-originated finding (§7.5) not itself a W0-R03F P3.
   **Deferred, named explicitly, not fixed:** grant §7.4 `traceparent` (no real W3C trace context
   exists in this unwired slice; synthesizing one from `correlation_id` is forbidden and was not
   done); grant §7.2 true streaming enforcement (the byte cap bounds what is parsed and retained
   downstream of `httpx`'s own buffering of the full response into `response.content`; it is not a
   bound on `httpx`'s peak memory allocation, and transport read-size configuration belongs to the
   layer owning the injected `AsyncClient`, which this pure-domain slice does not own). **Full
   request-body schema validation stays out of scope** — only `idempotency_key` is extracted from
   `request_body`. **No wiring:** no gateway, router, app factory or lifespan registration; CI does
   not run this code.

## 7. P3 findings — none blocking; all carried forward distinctly

No P0, P1 or P2 finding was raised at any point across W0-R03G or W0-R03H, or by this record.

| # | P3 | Standing |
|---|---|---|
| 1 | Sanitizer (layer 2) stripping lacks an independent regression guard — mutation-provable, removing it leaves 131/131 green | Carried from W0-R03G/commit body; open |
| 2 | `test_timestamp_cause_chain_never_leaks_the_offending_remote_value` is rejected by the new strict regex before reaching the `from None` branch it names; genuine `from None` coverage lives in the calendar-invalid test | Carried from W0-R03G/commit body; open |
| 3 | `correlation_id` is caller-controlled, not remote-controlled, and is not sanitized before entering the outbound header and log line | Carried from commit body; open, outside the P1 finding |
| 4 | Theoretical `httpx` `ResponseNotRead` seam at `len(response.content)` if a future caller injects a streaming transport; not reachable in this slice's own harness | Carried from commit body; open |
| 5 | Sanitization covers the grant's named minimum only — U+0085 (NEL) and bidirectional control characters are not stripped | Carried from commit body; open |
| 6 | `ECC_SKIP_PRECOMMIT=1` heuristic conflict with the SOSIM fixtures | Carried from commit body; disclosed, not silent; disposed **P3, acceptable** by W0-R03H (§5 above) |
| 7 | Grant-originated finding (§7.5): `_require_enum`/`_require_timestamp_utc` now `from None` | Fixed under this grant; not a W0-R03F P3, never folded into "four P3s" |
| **H1** | Pre-commit-bypass disclosure undercounts the heuristic's matches — three reported, **four** actual, due to the hook's own `head -n 3` truncation | Raised by W0-R03H; no security consequence (same fixture class); recorded distinctly, not folded into item 6 |
| **H2** | Commit body's "line 395" for the pre-existing fixture is the post-edit line number; the pinned-bytes line is 394 | Raised by W0-R03H; substantive pre-existence claim confirmed true by transcript-derived measurement; recorded distinctly |
| **H3** | Writer asserted the fixture's pre-existence without a probe capable of establishing it (empty `git stash list` plus `sed` on the already-edited file) | Raised by W0-R03H; conclusion happened to be correct but was reached without evidence at time of writing; recorded distinctly |
| 8 | Gitleaks CI-side behavior on these fixtures is untested | Raised by W0-R03H; becomes a real gate before this branch approaches CI or merge; not resolved here |
| 9 | Writer session transcript `2ceadba6-e72e-4ae6-b201-8d213d2425ea.jsonl` is absent from disk at the cited path at the time of this record | Raised by this record (§2 above); the writer's session and content are corroborated only through the two reviewers' quotations, not by this record's own direct reading |
| 10 | Review-side cache residue: `services/api/.ruff_cache` (writer-created, disclosed in the commit body) plus `services/api/src/cybrik_soc/__pycache__` (created by W0-R03H's own read-only verification run, not deleted) | Both disclosed here; neither cleaned by this record, which is read-only toward the product repository |
| 11 | Control validator does **not** machine-enforce this record, board §1.20/§14.28, register §23, the grant's terms, the hash pins or the reviewer-separation rule | Its `PASS` is a documentary consistency check only over pinned control rows — see §9 below |
| 12 | Placeholder Git author identity in this control repository (`Your Name <your@email.com>`) | Unchanged provenance weakness of the control record; the SOC commit `74f9774b…` does not share it (author/committer `Hoang Chi Linh <linhhc.eco@gmail.com>`) |

**Carry-forward discipline, exact.** The seven W0-R03G P3s (items 1–7 above, per §14.27's own
naming as the grant's carried findings) and the three new W0-R03H P3s (H1–H3) are recorded here as
**distinct** — they are not folded into each other, into the "four W0-R03F P3s" referenced by
earlier records, or into the §7.5 grant-originated finding. Every future record citing this lane's
P3 count must cite these as separate, named groups.

## 8. Classification after W0-R03H

With the post-commit **PASS**, commit `74f9774bfb5a6816cd9f0ddc230673a181a4cfd6` counts **only**
as:

> **local, independently reviewed, unmerged and unpushed `SCAFFOLD` evidence toward the
> `shadow_remote` portion of live-shadow blocker 3.**

It is explicitly **not** runtime evidence, **not** integration evidence, **not** CI evidence,
**not** live-shadow evidence, **not** deployment evidence and **not** release evidence. Nothing in
this lane is `IMPLEMENTED`, `VERIFIED`, `PILOTED` or `GA`.

## 9. Residual — what did not close

- **No blocker closes.** Live-shadow blocker 3 stands open as a whole — real org mapping, TTL
  enforcement and the live bundle path are all untouched and outside this lane; blocker 4 is
  unchanged.
- **The W0-I04 admission stays `HOLD`.** **G2 and G3 stay closed**; GATE A4 and W1-C1/C2 stay
  `ACCEPTED — CLOSED 2026-07-26`; W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`; **`W0 COMPLETE=0`**
  and W0 closure stays `NO-GO`; the board §11 exit criteria remain unmet.
- **No UAT milestone is reached and no instance is authorized.** The roster stands at exactly
  **48** with **no task 49** — `W1-I04A`, `W0-R03G`, `W0-R03H` name a sub-lane and reviews, not
  tasks.
- **The client remains unwired:** no gateway, router, app factory or lifespan registration
  references this code, and CI does not run it.
- W1 formal dates **2026-08-01 → 2026-08-23** and the release window **2026-12-21 → 2026-12-31**
  are unchanged. `docs/strategy/06-ROADMAP-2026-2029.md`'s pre-existing, unrelated dirty edit is
  preserved untouched and unstaged — hash-pinned before and after this record's writes in board
  §14.28.

## 10. What this record does not authorize

- **The next lane is NOT authorized by this evidence record.** Any follow-on — push, remote-green
  pursuit, real org mapping, TTL, the live bundle path, wiring this client into any gateway or
  router, resolving H1–H3 or any of the seven carried P3s, or folding this branch into the formal
  W1 window — is queued for a fresh decision and a prospective grant, several additionally
  requiring an explicit **Founder decision**. This record **opens no product authority**.
- No push, merge, remote configuration, tag, release, G2 or G3 action; no dependency install; no
  formatter or auto-fixer; no database, container, microVM, netns or broker started by this
  record; no secret read; no status promotion beyond §8.
- The fixed roster of **48** stands with **no task 49**; category counts stay
  I 12 · T 12 · R 6 · S 5 · B 5 · IR 4 · D 4.
- The Fabric W0-I07 lane, the Cyber AI W0-I06 lane and the SOC W1-I03B lane are untouched.

## 11. Provenance

- Bounded record-authoring authority and control-side measured evidence: board §14.28 (allowlist
  §14.28.1; verified evidence §14.28.2; measured evidence §14.28.4); board summary §1.20.
- Matching register entry: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §23.
- The remediation grant this lane ran under, standing **unedited** as dated history, plus its
  amendment/correction/authorization chain: `docs/operations/W1-I04A-SHADOW-REMOTE-REMEDIATION-GRANT.md`
  (board §1.16/§14.24; §1.17/§14.25; §1.18/§14.26; §1.19/§14.27; register §19–§22).
  The prior prospective grant and hard-stop evidence, standing **unedited**:
  `docs/operations/W1-I04A-SHADOW-REMOTE-GRANT.md` (board §1.14/§14.22; register §18) and
  `docs/operations/W1-I04A-SHADOW-REMOTE-HARD-STOP-EVIDENCE.md` (board §1.15/§14.23; register
  §18).
- Transcripts read read-only for this record: W0-R03G `ff4de3ce-596c-42e9-9a5d-5bd10b06e28b`,
  W0-R03H `2cd8f307-b798-4edf-b1b3-93ad91172e49`. The writer transcript
  `2ceadba6-e72e-4ae6-b201-8d213d2425ea` was **not** found on disk and was **not** read directly
  by this record (§2).
- The reviewed base this lane builds on: commit `6464cfbfc99ecf2109988dff0e6164c8cac6b10a`,
  parent `f4d234bba09ae1bea7a63b3348be3640a701065d`.
