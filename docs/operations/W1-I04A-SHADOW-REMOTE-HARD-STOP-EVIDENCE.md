# W1-I04A SOC `shadow_remote` client core — hard-stop evidence record

- **Prepared:** 2026-07-27, fourteenth same-day control record
- **Status:** `RECORDED — HARD-STOP EVIDENCE — ATTEMPT PAUSED, UNCOMMITTED — REVIEWED NO-GO — LOCAL DOCS ONLY, NOT PUSHED`
- **Record author:** logical task **W0-D04** (hard-stop evidence reconciler), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.23
- **Subject:** the outcome of the one bounded W1-I04A writer attempt that
  `docs/operations/W1-I04A-SHADOW-REMOTE-GRANT.md` authorized: the granted writer ran on the new
  branch/worktree at exactly the grant base, produced exactly the four allowlisted untracked
  paths, stopped before staging as grant §10.1 requires, and the fresh independent **W0-R03F**
  pre-commit review returned **NO-GO** with one **P1** and two **P2** findings
- **Disposition recorded:** `PAUSED — UNCOMMITTED` — **not product evidence**. Grant §10 admits
  staging only after a pre-commit **GO with no P0–P2**; that GO does not exist, so **nothing may
  be staged and nothing may be committed** from this attempt
- **Authority boundary:** this document records evidence and one already-determined pause
  disposition. It opens no writer, grants nothing, decides no remediation, flips no gate, closes
  no residual and promotes nothing

## 1. Verified attempt state — re-verified read-only, 2026-07-27

Re-verified live and read-only from the SOC repository by the control session authoring this
record. No product byte was written, nothing was staged, and no product command other than
read-only inspection was run.

| Item | Measured state |
|---|---|
| Repository | `cybrik-soc-command-center` |
| Worktree | **new** — `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i04a-shadow-remote-r1` |
| Branch | **new** — `codex/w1-i04a-shadow-remote-r1` |
| `HEAD` | **`6464cfbfc99ecf2109988dff0e6164c8cac6b10a`** — exactly the grant §3 base |
| Commits above base | `git rev-list --count 6464cfb..HEAD` = **0** — **no commit was produced** |
| Upstream | **none** — nothing pushed, no tag, `origin` untouched |
| Staged paths | **zero** |
| Dirty paths (`git status --porcelain -uall`) | **exactly four**, all untracked (`??`) |
| Ignored/cache residue | **none** — `git status --ignored` reports no `!!` entry, and a
  filesystem sweep of `services/api` for `__pycache__`, `.pytest_cache` and `.mypy_cache`
  returns **nothing**. The grant §8.4 no-cache discipline held and the residue probe was run
  with a command that works on macOS/BSD |

### 1.1 The four paths — exactly the grant §4 allowlist, no fifth path

| # | Path | SHA-256 of current bytes | Lines |
|---|---|---|---:|
| 1 | `services/api/src/cybrik_soc/modules/copilot/shadow_remote.py` | `ca351c05190ab0b26ac7aedebd0bd35a44b2421303d669b233c4e8ccbe14c2b5` | 439 |
| 2 | `services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py` | `8df05e5fe041ef670bfc81f7c3ee8d6bfe27b65ca0436784fb2ffa582dec9bfc` | 729 |
| 3 | `services/api/tests/unit/copilot/test_shadow_remote.py` | `8645e7592c9822b276bbe1d3aa29645fb073588e5f6a44b1999296b1f06540d7` | 821 |
| 4 | `services/api/tests/unit/copilot/test_shadow_remote_contract.py` | `54c8b92db3e470757ae651f7dfdd927cbce6bd5e2f24f91d931e797c4404a565` | 419 |

Total **2408 lines**. **No existing file was edited**, no `__init__.py` and no `conftest.py` was
added, and no fifth path exists in the tree. The `w1-i03b-route-db-permanence-r1` worktree was
left exactly as found.

**Layout correction carried forward.** `services/api/tests/unit/` is **not** flat with `golden/`
as its only subdirectory: it contains **`golden/` and `vulnerability/`** in the base, plus the new
`copilot/` directory created by paths 3 and 4. The earlier "flat, only `golden/`" wording — grant
§4.1 and board §14.22.6 item 7 — is **inaccurate and is not repeated**. The prior records keep
that wording byte-unchanged as dated history; this record supersedes it prospectively. The
substantive constraint is unaffected: `copilot/` is still a new subdirectory, it still carries no
`__init__.py`, and collection still relies on the base's `pythonpath`/`testpaths` settings.

## 2. Session and runtime — hard stop, authority consumed

| Item | Value |
|---|---|
| Writer model | **Opus 5** |
| Writer session | **`c173b76f-25b5-4bbc-8660-d5fe9a9792c8`** — brand-new; no exhausted session was resumed |
| Transcript | `/Users/hoanglinh/.claude-accounts/work-dir/projects/-Users-hoanglinh-Claude-Projects-cybrik-soc-command-center/c173b76f-25b5-4bbc-8660-d5fe9a9792c8.jsonl` — **191 lines, a single uniform internal `sessionId`** |
| Runtime consumed | the **600 s initial cycle** plus **exactly one** authorized extension under board §15, whose execution measured **325 s**. **No third cycle** was taken or is available |

**The writer's authority is fully consumed, and nominal remaining extension wall time does not
revive it.** Grant §9 item 7 makes **any P0, P1 or P2 finding an immediate STOP**, and grant §10.1
holds staging until a pre-commit **GO with no P0–P2**. The W0-R03F review returned a **P1 and two
P2s**, so the STOP fired on its own terms: every remaining second of writer authority was consumed
by the finding itself, independently of the clock. **The session `c173b76f-…` must never be
resumed**, under grant §2 and board §15.

## 3. Test-first RED — genuine, transcript-citable, not reconstructed

Unlike the W1-I03B lane, whose RED chronology was permanently unverifiable and had to be carried
as a P3, this lane's chronology is **preserved in the writer transcript and is citable by line
and timestamp**. The order measured directly from the transcript:

| Transcript line | Timestamp (UTC) | Event |
|---:|---|---|
| 61 | `01:21:05` | **test** module `test_shadow_remote_contract.py` written |
| 66 | `01:22:56` | **test** module `test_shadow_remote.py` written |
| 72–73 | `01:23:02` | target-source environment probe — resolved `cybrik_soc.__file__` printed for the attempt worktree |
| 76 | `01:23:08` | **RED run 1 — `ModuleNotFoundError`** |
| 78 | `01:23:30` | **RED run 2 — `ModuleNotFoundError`** |
| 82 | `01:25:34` | **source** module `shadow_remote_contract.py` written |
| 102 | `01:29:11` | **source** module `shadow_remote.py` written |

Both failing runs occurred **after** the target-source environment probe and **before** any source
file existed, so the failures are genuine absence-of-implementation failures rather than
misconfigured imports. This is recorded **as reported and as preserved in-transcript**; **nothing
was reconstructed after the fact**. Grant §7's evidence requirement is satisfied on this point,
and the §7 P0 for a fabricated chronology does **not** apply.

## 4. Executed local results — as reported, mandatory borrowed-venv caveat

Every figure below is **as reported by the writer and re-readable in its transcript**. It was not
re-executed from this control worktree.

| Check | Reported result |
|---|---|
| Targeted unit tests — the two new modules | **81 passed** |
| Bounded copilot regression | **39 passed** |
| `ruff check` (no cache, 4 files) | clean |
| `ruff format --check` | clean — **check mode only**, no writer/`--fix` run |
| `ast.parse` on the four new files | clean, no repo cache written |
| `.venv/bin/mypy`, targeted at the four new paths | **`Success: no issues found in 4 source files`**, `mypy 2.3.0 (compiled: yes)` |

**Mandatory caveat, travelling with every citation.** These ran against the **pre-existing
borrowed venv** at `cybrik-soc-command-center:services/api/.venv`, used read-only with **no
install, upgrade or download**. Its **interpreter is CPython 3.12.13** and its **third-party
dependency versions do not come from this base's pins**, while `[tool.mypy]` declares
`python_version = "3.11"`. `PYTHONPATH` was forced and probe-verified to the attempt worktree's
source. **These are local runs, not CI — CI: NOT WIRED**, and no CI result is claimed.

**These results do not overcome the NO-GO and are not product evidence.** A green local suite says
nothing about the P1: the leaking behaviour is *asserted-around*, not caught, by the very tests
that pass.

**Tool-availability standing, unchanged and correctly worded.** `mypy` is **available in the
borrowed venv, off `PATH`, dependency-version-caveated** — never "unavailable". `actionlint`
**remains genuinely absent** from both `PATH` and the venv, an open-ended deferral to a CI that is
**NOT WIRED**.

## 5. Independent pre-commit review — W0-R03F: **NO-GO**

| Item | Value |
|---|---|
| Reviewer | **W0-R03F**, a fresh **Fable** session, distinct from the writer and from every prior reviewer in the W0-R02/W0-R03 series |
| Session | **`e650bda1-abfd-4b0e-ac79-69138716e4c6`** |
| Transcript | `/Users/hoanglinh/.claude/projects/-Users-hoanglinh-Claude-Projects-cybrik-worktrees-w1-48-w1-i04a-shadow-remote-r1/e650bda1-abfd-4b0e-ac79-69138716e4c6.jsonl` — **122 lines, a single uniform internal `sessionId`** |
| Verdict | **PRE-COMMIT NO-GO** — one **P1**, two **P2**, several **P3** |

### 5.1 P1 — remote-controlled key names echoed into the quarantine record and the log

`_reject_unknown` echoes **remote-controlled JSON key names verbatim** into the validation reason
string. That reason then flows into the quarantine record's `message_safe` field **and into a
`WARNING` log line**. The reviewer reproduced it twice against the code as written:

- a **credential-shaped key name** was carried through into `message_safe` and the log; and
- an **unbounded injection** produced a **10,962-character `message_safe` containing embedded
  newlines**, which render as forged additional log lines.

This **violates the no-response-data invariant** and **grant §7.2 property 9** ("no token or secret
logged"). The property is asserted by the test suite only in the **value position**, which is safe,
so the suite passes while the defect stands (see §5.3).

### 5.2 P2 — `Idempotency-Key` header omitted on the mutating calls

The **create** and **cancel** operations **omit the `Idempotency-Key` header** that the accepted
contract requires and that must match the request body. The tests assert **path and verb** for
these operations but **do not assert the header**, so the omission is invisible to the suite.

### 5.3 P2 — the secret-leak tests never reach the leaking branch

The secret-leak tests **do not exercise the key-position branch** that actually leaks:

- the **500 case short-circuits** before JSON handling, so the JSON path is never entered; and
- the **value-position token case is safe by construction**.

A **key-position test is required** and is absent. This is why §5.1 survives a fully green run.

### 5.4 P3 findings — recorded, open, undispositioned

| # | P3 |
|---|---|
| 1 | `org_path` `maxLength` of **512 is declared but not enforced** |
| 2 | **No response-body size cap** is applied before JSON decoding |
| 3 | `fromisoformat` **accepts non-RFC3339 basic-format** timestamps |
| 4 | A **custom correlation header** is used while the contract's **optional `traceparent`** is left unused |

### 5.5 What the review found sound

Recorded so the NO-GO is not read as a wholesale rejection:

- **exact scope and isolation** — four paths, no existing-file edit, no fifth path, nothing wired
  into gateway, router, app factory or lifespan;
- **genuine RED** chronology and **clean cache discipline**;
- the **five paths and verbs** and the client's conditional logic are **mostly sound**;
- **bundle opacity** is deliberately justified rather than accidental;
- the **injected contract-pin mismatch** correctly produced a **zero-call** outcome; and
- the **W0-R06C riders were honoured**.

## 6. Disposition — `PAUSED — UNCOMMITTED`, not product evidence

- The attempt is **`PAUSED — UNCOMMITTED`**. Its four paths are **untracked, unstaged and
  uncommitted**, and **must stay that way**.
- **No staging and no commit is permitted from this attempt.** Grant §10.1 conditions staging on a
  pre-commit **GO with no P0–P2**; the review returned **NO-GO with a P1 and two P2s**, and grant
  §9 item 7 independently makes any such finding a STOP.
- **This is not product evidence.** It is not runtime, integration, CI, live-shadow, deployment or
  release evidence, and nothing here is `IMPLEMENTED`, `VERIFIED`, `PILOTED` or `GA`.
- The **latest committed SOC lane state remains `6464cfbfc99ecf2109988dff0e6164c8cac6b10a`** with
  W0-R02D `PASS`, exactly as board §1.13 records it.
- The **W1-I04A grant is consumed**. It authorized one attempt; that attempt ran and stopped. No
  second attempt exists under it, and it may not be re-read as authorizing one.

## 7. Future action — queued, not granted and not decided by this record

The reviewer observed that the fixes **appear to fit within the same four paths**. That
observation is **recorded, not acted on, and confers no authority.**

A **brand-new writer** may act **only after a fresh prospective bounded grant** that:

1. is **recorded before any work begins**;
2. is scoped to **genuinely distinct security/conformance/test fixes** — not a re-issue of the
   consumed authoring scope under a new name, and not a split contrived to dodge the board §15
   cycle cap, both of which are **evasion and forbidden**;
3. carries an **exact, explicit disposition of the P1, both P2s and all four P3s**;
4. runs its **own independent pre-commit and post-commit reviews** — **neither the W0-R03F review
   nor this record's control-side re-verification carries over as either review**; and
5. keeps the **immutable task identity `W0-I04`**. **No replacement identity, no task 49.**

**The exhausted session `c173b76f-25b5-4bbc-8660-d5fe9a9792c8` is never resumed.** **This record
neither grants nor decides that remediation**; it states the conditions any future grant must
satisfy.

## 8. Classification duties — unchanged

- **Live-shadow blocker 3 stands open as a whole.** The `shadow_remote` client core is
  **uncommitted and reviewed NO-GO**; **real org mapping, TTL enforcement, the live bundle path
  and gateway wiring** are untouched. Blockers 1, 2 and 4 stand exactly as previously recorded.
- **The route-DB permanence residual is untouched:** permanence still requires **push plus observed
  remote green**, and push remains **`NO-GO`**; the appended CI job stays **`if: false`, strictly
  static, CI: NOT WIRED**.
- **No gate moves.** GATE A4 and the W1-C1/C2 contract gate stay `ACCEPTED — CLOSED 2026-07-26`;
  W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`; **G2 and G3 stay closed**.
- **W1 product implementation and integration/live shadow stay `HOLD`**; W1 runtime writers,
  delegated routine integration, push and external release stay **`NO-GO`**; **`W0 COMPLETE=0`**
  with W0 closure **`NO-GO`**; the board §11 exit criteria remain unmet.
- **No UAT milestone is reached and no instance is authorized.**
- The roster stays at exactly **48** immutable task identities — I 12 · T 12 · R 6 · S 5 · B 5 ·
  IR 4 · D 4. **No task 49 exists**; `W1-I04A`, `W0-IR12`, `W0-R03F` and `W0-R06B`/`W0-R06C` name
  a sub-lane, a decision, a review and corrections — **not tasks**.
- **Dates unchanged:** W1 formal dates **2026-08-01 → 2026-08-23**; release window
  **2026-12-21 → 2026-12-31**.

## 9. Open items this record does not close

- The **W0-IR12 P1 dirty roadmap file** — `docs/strategy/06-ROADMAP-2026-2029.md` carries
  pre-existing, unrelated, uncommitted decision-level content, **quarantined byte-for-byte and
  unstaged**, hash-pinned in board §14.23.4. This record **does not edit, stage, accept or reject
  it**; disposition needs an **explicit Founder decision** or a separately scoped bounded docs
  grant, and **its dirtiness is neither evidence nor release authority**.
- The **W0-IR12 P2s — blocker 4** — all four canonical roots remain dirty and every
  suite-accepted contract commit remains a **sibling, unintegrated** local commit. **No claim of
  resolution is made.**
- **Validator non-enforcement** — the control validator does **not** machine-enforce this record,
  board §1.15/§14.23, register §18, board §15 or the grant terms; its `PASS` is a documentary
  consistency check only.
- **`docs/operations/README.md` index omission** — outside the §14.23.1 allowlist, so it persists
  and now also omits this record. **Not silently fixed outside a grant.**
- **Placeholder Git author identity** in this control repository (`Your Name <your@email.com>`) —
  an unchanged provenance weakness of the control record.

## 10. Provenance

Every SOC fact in §1 was measured **live and read-only** from the attempt worktree by the control
session authoring this record — Git inspection, `shasum`, `wc -l` and a filesystem residue sweep.
The attempt worktree was left **exactly as found**: `HEAD = 6464cfb…`, zero commits above base,
zero staged, four untracked paths, no upstream. The session, runtime, execution and review figures
in §2–§5 are **as reported by the writer and the W0-R03F review** and were **re-read from both
transcripts**, not re-executed. **No product byte was written by this record.**
