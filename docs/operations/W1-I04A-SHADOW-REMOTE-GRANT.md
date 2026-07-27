# W1-I04A SOC `shadow_remote` client core — prospective bounded grant

- **Prepared:** 2026-07-27, thirteenth same-day control record
- **Status:** `PROSPECTIVE GRANT — RECORDED, NOT EXERCISED — NO WRITER OPENED BY THIS RECORD — NOT PUSHED, NOT MERGED, NOT INTEGRATED`
- **Record author:** logical task **W0-D04** (prospective-grant document implementer), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.22
- **Decision basis:** the **W0-IR12** read-only architecture decision recorded in §1 below
- **Grantee:** the existing immutable task **W0-I04** (SOC `shadow_remote` client/flag,
  correlation and rollback-compatible embedded path), sub-lane **W1-I04A**. **No task identity
  is created**; the roster stays at exactly 48 and **no task 49 exists**
- **Authority ceiling:** at most **one** local `SCAFFOLD` commit of **exactly four new product
  paths** in `cybrik-soc-command-center`, after two fresh independent reviews. **No push, no
  merge, no remote action, no release, no dependency install, no formatter, no date change**
- **Release impact:** none. W1 formal dates **2026-08-01 → 2026-08-23** and the
  **2026-12-21 → 2026-12-31** release window are unchanged

This document **records a grant**; it does not exercise one. **No product writer is opened by
the session authoring it.** Every SOC, Cyber AI and Fabric fact below was obtained **read-only**
— live Git reads, `git cat-file`/`git ls-tree`/`git grep` against commit objects, and
`shasum` over a blob streamed from a commit. **No product byte was written and nothing was
staged in any product repository.**

---

## 1. The recorded W0-IR12 decision — read-only, no assumption needed

**Decision: GO on exactly one lane — W1-I04A, the SOC `shadow_remote` client core.** It is the
fastest next bounded critical-path lane whose inputs are all already accepted, verified and
sitting at a clean reviewed base.

### 1.1 Verified inputs — measured 2026-07-27, read-only

| Input | Measured state |
|---|---|
| W1-C2 investigation lifecycle acceptance | commit **`ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`** exists as a reachable commit object in `cybrik-suite`; `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY` |
| W1-G1 alert-context transport-binding acceptance | commit **`a976a205601de22dae59e5112e37ae29707fda0e`** exists as a reachable commit object in `cybrik-suite`; `ACCEPTED — CLOSED 2026-07-27`, static contract decision only |
| Accepted OpenAPI artifact digest | `contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml` **at `ed95e51…`** re-hashes live to exactly **`22cd7d71f89bd5c287b79e87015a28dd27fdbd124fd3a073e56346a4de3c318d`** — the pin already carried in board §14.16/§14.17 and in the W1-C2 application §4 row 30 |
| Five-path lifecycle surface | read from that blob: `/api/v1/investigations`, `/api/v1/investigations/{investigation_id}`, `/api/v1/investigations/{investigation_id}/checkpoints`, `/api/v1/investigations/{investigation_id}:cancel`, `/api/v1/investigations/{investigation_id}/bundle` — **exactly five paths** |
| Cyber AI HTTP producer scaffold | commit **`2baba72534297fc67130983e5bd21b5730f50c31`** exists as a reachable commit object in `cybrik-cyber-ai-platform` — local, reviewed, unmerged, in-process only (board §1.9) |
| SOC base | **`6464cfbfc99ecf2109988dff0e6164c8cac6b10a`** — the clean, independently reviewed (`W0-R02D PASS`) commit of board §1.13; worktree `cybrik-worktrees/w1-48/w1-i03b-route-db-permanence-r1` measures `HEAD = 6464cfb…`, branch tip `codex/w1-i03b-route-db-permanence-r1` = `6464cfb…`, `git status --porcelain -uall` **0 lines** |
| `shadow_remote` in the SOC base | **zero occurrences** — `git grep -l shadow_remote 6464cfb…` over `services/api/src` returns nothing, and over the **whole committed tree** returns nothing. The lane starts from a genuine blank surface |

### 1.2 Ranking recorded

| # | Lane | Disposition |
|---|---:|---|
| **1** | **W1-I04A — SOC `shadow_remote` client core** | **GO** as this grant. All contract inputs accepted; base clean and reviewed; surface empty; pure domain slice with no runtime, DB or network dependency |
| 2 | **Blocker-4 Founder canonical integration/CI packet** | prepared **in parallel**, and it is **not a product grant** — it opens no writer and touches no product repository. It is a Founder decision packet about the unintegrated canonical roots (§1.4) |
| 3 | **Cyber AI W0-I10 `DurableExecutionPort` domain slice** | queued behind #1. Its **real-PostgreSQL dependency portion is separately gated** and is not authorized by anything recorded here |
| — | **Fabric W0-I08** | stays **NO-GO / `HOLD`**, pending the ADR-0005 / W0-B05 receipt-envelope and runtime decision. Unchanged by this record |

### 1.3 W0-IR12 P1 — the pre-existing dirty roadmap file

`docs/strategy/06-ROADMAP-2026-2029.md` in **this control worktree** carries a **pre-existing,
unrelated dirty working-copy edit**, hash-pinned at
**`4ed13159a7afc104694dea8b2f2773003cdf8831`**, **unstaged**. That edit contains
**decision-level content that has never been committed** — a changed update date, a
`Release target: 2026-12-21` line, an activation-gate decision dated 2026-07-25, a
capacity/admission-control model and an evidence-compression table.

**This grant does not edit, stage, accept or reject it.** It is **quarantined and preserved
byte-for-byte**. Disposing of it requires either an **explicit Founder disposition** or a
**separately scoped bounded docs grant**; neither exists. **Its dirtiness is not evidence and
confers no release authority** — nothing in that working copy may be cited as a decision, and
the fixed dates in §Release impact above are the committed ones.

### 1.4 W0-IR12 P2s — the four canonical roots and the sibling accepted commits

Measured read-only on 2026-07-27:

| Canonical root | Branch | `HEAD` | Dirty paths (`-uall`) |
|---|---|---|---:|
| `cybrik-suite` | `codex/w2i-ai-inference-transport` | `55e94c2` | **99** |
| `cybrik-soc-command-center` | `codex/w2j-org-assets-vertical` | `1b6671c` | **24** |
| `cybrik-cyber-ai-platform` | `codex/w2h-service-delegation-ai` | `281b252` | **23** |
| `cybrik-security-tool-fabric` | `codex/w2h-auth-org-conformance` | `3292a65` | **100** |

**All four canonical roots remain dirty**, and every suite-accepted contract commit
(`3a2c715…`, `ed95e51…`, `a976a20…`) plus every reviewed product commit (`d38f910…`,
`2baba72…`, `6464cfb…`) remains a **sibling, unintegrated local commit** on its own branch —
none pushed, none merged. Together these form **blocker 4**. They go into the **separate Founder
packet** named in §1.2 row 2. **No claim is made here that any of them is resolved**, and this
grant does not touch, clean, integrate or dispose of any of them.

---

## 2. Grantee, writer identity and runtime

| Field | Exact value |
|---|---|
| Immutable task | **W0-I04** — existing roster identity, no task 49 |
| Sub-lane | **W1-I04A** |
| Writer model | **Opus 5** |
| Writer session | a **brand-new session**. **No exhausted session may ever be resumed** — not `ee417d7b-9f89-46ca-85a9-a06d86e55f4e`, `2aa3bab1-bf56-4161-ac04-b4f67810691c`, `06a2c154-50c7-4525-851c-ee9ecfd47219` or any other |
| Session ID | **recorded downstream** by the dispatching wrapper and the post-commit evidence record; the writer is not required to guess its own UUID (see the §14.21.3 item-7 P3 precedent) |
| Initial runtime | **600 s** |
| Extension | **at most one**, capped at **600 s**, and only on evidenced process progress under board §15. **No third cycle.** Quota exhaustion, permission loops, deadlock and scope drift are **never** grounds |
| Replacement identity | **forbidden** — a retry keeps the immutable task ID `W0-I04` |

**If the runtime is exhausted with the tree uncommitted**, the lane is **`PAUSED — UNCOMMITTED`**.
Any future action then requires a **fresh prospective grant**, and **only if it is a genuinely
different remediation scope**. Re-issuing this same scope under a new name, splitting it to
dodge the cycle cap, or resuming the exhausted session are all **evasion and are forbidden**.

---

## 3. Base, branch and isolation

| Field | Exact value |
|---|---|
| Repository | `cybrik-soc-command-center` |
| Base commit | **`6464cfbfc99ecf2109988dff0e6164c8cac6b10a`** |
| New branch | **`codex/w1-i04a-shadow-remote-r1`** |
| New worktree | **`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i04a-shadow-remote-r1`** |

### 3.1 Writer start gate — all must hold, else **STOP**

1. The worktree path **does not exist** before creation. *Measured 2026-07-27: it does not exist.*
2. The branch `codex/w1-i04a-shadow-remote-r1` **does not exist** before creation. *Measured
   2026-07-27: `git branch --list` returns empty.*
3. The worktree is created **at exactly `6464cfb…`**, and `git rev-parse HEAD` in it returns
   exactly that SHA.
4. The new branch tip equals the base; `git rev-list --count 6464cfb..HEAD` = **0** at start.
5. `git status --porcelain -uall` is **empty** and **zero paths are staged** at start.
6. No other worktree or branch is created, moved, deleted or checked out; **no existing worktree
   is entered for writing**, and `w1-i03b-route-db-permanence-r1` is left exactly as found
   (`6464cfb…`, clean, zero staged).

Any mismatch on 1–6 is a **hard STOP** with nothing written.

---

## 4. Exact product path allowlist — four paths, all NEW

| # | Path | Kind |
|---|---|---|
| 1 | `services/api/src/cybrik_soc/modules/copilot/shadow_remote.py` | **new** — typed shadow client core |
| 2 | `services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py` | **new** — pinned contract/response-schema surface |
| 3 | `services/api/tests/unit/copilot/test_shadow_remote.py` | **new** — lifecycle/failback/no-side-effect tests |
| 4 | `services/api/tests/unit/copilot/test_shadow_remote_contract.py` | **new** — contract-pin and schema-validation tests |

**No existing file may be edited. There is no fifth path.** Explicitly forbidden, without
exception: `pyproject.toml`, `uv.lock`, any lockfile, any `__init__.py` (including a new one),
`config.py` or any settings module, `api.py`, `gateway.py`, `llm.py`, `models.py`, `tools.py`,
`shadow_suggest_worker.py`, `main.py`, any route/router/gateway module, any Alembic migration,
any `.github/` file, any `docs/` file, any `README.md`, and every other tracked or untracked
path in the repository.

### 4.1 Verified layout constraints the writer must respect

Measured read-only at `6464cfb…`:

- `services/api/src/cybrik_soc/modules/copilot/` exists with 8 files (`README.md`,
  `__init__.py`, `api.py`, `gateway.py`, `llm.py`, `models.py`, `shadow_suggest_worker.py`,
  `tools.py`). Paths 1 and 2 are **additions into that existing package**; its `__init__.py`
  is **not** edited, so the two new modules must be importable by their **fully qualified module
  path** and must not rely on package re-export.
- `services/api/tests/unit/` is **flat** — no test package uses `__init__.py` anywhere under
  `services/api/tests/`, and the only existing subdirectory is `golden/`. Paths 3 and 4 therefore
  create the **new directory `services/api/tests/unit/copilot/`**. Creating that directory is
  inherent to writing paths 3 and 4 and is **not** a fifth path; adding an `__init__.py` to it
  **is** a fifth path and is **forbidden**.
- Collection works without `__init__.py` because `[tool.pytest.ini_options]` sets
  `pythonpath = ["src", "."]`, `testpaths = ["tests"]`, and the two new test basenames
  (`test_shadow_remote.py`, `test_shadow_remote_contract.py`) are **unique repo-wide** — verified
  by the zero-occurrence `shadow_remote` grep in §1.1. **If a basename collision or a collection
  error appears, that is a STOP**, not a licence to add a fifth path.
- `services/api/tests/unit/conftest.py` exists and applies to the new subdirectory. It **may not
  be edited**.
- The base has **zero** `correlation_id` symbols in `services/api/src` (`request_id` appears in
  14 files, `X-Request-ID` in 1, `trace_id` in 0). The correlation ID in this slice is therefore
  **module-local** — a typed parameter/field owned by `shadow_remote.py` — and **no existing
  module may be edited to adopt or supply it**.
- Because `config.py` is outside the allowlist, the feature flag must be resolved **inside
  `shadow_remote.py`** (environment read with an **OFF default**), **not** by extending the
  shared settings object.

---

## 5. Scope — what the slice is, and what it is not

**In scope: a typed lifecycle shadow client core, and nothing else.**

1. **Typed lifecycle client core** covering the accepted five-path investigation lifecycle
   surface (create / status / checkpoint / cancel / bundle-read) as a **pure, injectable client
   object**. No module-level singleton performing I/O at import time.
2. **Feature flag, default OFF.** When the flag is off the client performs **zero** outbound
   calls of any kind. Off is the only default; there is no "on in tests" convenience default.
3. **Fail-closed error taxonomy.** A closed, typed set of shadow-failure categories — transport
   error, timeout, HTTP 5xx, HTTP 4xx, malformed body, schema-invalid body, contract-pin
   mismatch. Every one of them resolves to *shadow failed, quarantined, embedded result
   untouched*. No category may propagate as an exception into the caller's embedded path.
4. **Correlation-ID propagation.** Every shadow request carries a correlation ID; every
   quarantined failure record carries the same ID.
5. **Rollback-compatible embedded result.** The existing embedded copilot result is **entirely
   unaffected** by anything this client does or fails to do, in every flag state.
6. **Pinned contract validation by digest reference only** (§6).

**Out of scope — writing any of these is a STOP:**

- **No runtime wiring.** Nothing is registered into the gateway, the router, the app factory,
  lifespan, or any existing call path. The client is **constructed by tests only**.
- **No real remote endpoint and no endpoint configuration.** No base URL, host, port, DNS name
  or credential is committed; no `.env`, no config file, no secret.
- **No SOC database access** — no session, no model, no migration, no query.
- **No vendored contract bytes.** The accepted OpenAPI/JSON-Schema artifacts are **not** copied
  into `cybrik-soc-command-center`; see §6.
- **No new dependency**, no import of a package not already in the base's resolved environment.
- **No retry/backoff engine, no queue, no worker, no scheduler.**

---

## 6. Contract pins — reference by digest, never by copy

| Pin | Exact value |
|---|---|
| Accepted OpenAPI artifact digest | `22cd7d71f89bd5c287b79e87015a28dd27fdbd124fd3a073e56346a4de3c318d` |
| W1-C2 acceptance commit | `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4` |
| W1-G1 acceptance commit | `a976a205601de22dae59e5112e37ae29707fda0e` |
| Accepted route surface | exactly the **five** paths enumerated in §1.1 |

`shadow_remote_contract.py` records these values as **literal string constants plus the five
route templates**, and validates responses against a **locally declared, hand-written typed
shape** that matches the accepted surface. It **references the artifact by digest**; it does
**not** read, fetch, vendor, copy or embed the artifact bytes, and it does not reach into the
`cybrik-suite` repository at runtime (no cross-repo path, no relative import, no submodule —
board `CLAUDE.md` cross-repository rule 3).

**If the writer concludes the slice cannot be built without vendoring or copying contract bytes,
that is a STOP.** If any pinned value above cannot be reproduced exactly, that is a **contract
pin mismatch** and a **STOP**.

---

## 7. Test-first, transcript-preserved RED → GREEN

The writer runs **test-first**: write the failing test, **run it and capture the observed
failure**, then implement. The **failing run and its output must be preserved verbatim in the
session transcript**, with the test names and the failure text. The chronology is cited **as
reported and as preserved in-transcript**; it is never reconstructed after the fact.

*Precedent note:* the W1-I03B lane's RED chronology was **permanently unverifiable** and had to
be carried as a P3 (board §14.21.3 item 1). This grant requires the transcript evidence up front
precisely so that gap is not repeated. A **fabricated or after-the-fact reconstructed** RED
chronology is a **P0**.

### 7.1 Test harness constraints

- **In-process ASGI stub only.** The shadow "remote" under test is a local ASGI application (or
  an equivalent in-process transport) constructed inside the test module. **No socket is opened,
  no port is bound, no DNS is resolved, no egress occurs.**
- **Synthetic data only.** No real tenant, org, alert, case, analyst, identity, token or secret.
- **No database, no container, no image pull, no external service.**

### 7.2 Required properties — every one must be asserted

| # | Property |
|---|---|
| 1 | **Flag default OFF ⇒ zero calls.** With no flag set, the shadow path issues **zero** requests to the stub — asserted on a call counter, not merely on a return value |
| 2 | **5xx ⇒ quarantined.** Flag on, stub returns HTTP 5xx: nothing raises into the embedded result and the embedded result is byte-equal to the no-shadow result; the failure is recorded/audited as quarantined |
| 3 | **Timeout ⇒ quarantined.** Same, for a transport timeout |
| 4 | **Malformed body ⇒ quarantined.** Same, for a non-decodable/garbage body |
| 5 | **Schema-invalid body ⇒ quarantined.** Same, for a well-formed body that violates the accepted lifecycle shape |
| 6 | **No retry storm.** A failing shadow request produces a **bounded, asserted** number of attempts (a single attempt unless the code declares otherwise, and then the declared bound is asserted). No unbounded loop, no exponential fan-out |
| 7 | **Correlation ID on every request.** Every shadow request observed by the stub carries a correlation ID, and the quarantined failure record carries the same ID |
| 8 | **No SOC DB write, no side effect.** No session, engine, model or migration is touched; the embedded path's observable state is unchanged in every flag state |
| 9 | **No token or secret logged.** Captured log records contain no credential, token, cookie or authorization header value — asserted, not assumed |
| 10 | **Contract-pin mismatch ⇒ STOP semantics.** A response whose declared contract identity does not match the §6 pins is rejected fail-closed and quarantined; the pin constants themselves are asserted byte-exact |
| 11 | **Response validation matches the accepted five-path lifecycle surface** — all five, by name |

---

## 8. Allowed validation — and the corrected tool availability record

### 8.1 Permitted commands

| Command class | Permitted form |
|---|---|
| Targeted unit tests | the two new test modules |
| Relevant regression | the existing **copilot** unit tests (`test_copilot_disposition.py`, `test_hunt_copilot_suggest.py`, `test_soar_copilot_draft.py`, `test_soar_copilot_tool.py`, `test_forensics_copilot_summary.py`) |
| Lint | **`ruff check`** and **`ruff format --check`** — **check modes only**. `ruff format` (write mode) and `--fix` are **forbidden** |
| Syntax | AST parse / byte-compile of the four new files, **with no repo cache** |
| Types | **targeted `mypy`** via the borrowed pre-existing venv — see §8.2 |

**Forbidden:** any formatter or auto-fixer in write mode, any install/upgrade/download, any
network fetch, any container or database, any run of the full repository suite as a substitute
for the targeted evidence.

### 8.2 W0-R06B mandatory correction — `mypy` is available, `actionlint` is not

**The claim carried in the `e07e70f` records — that `mypy` *and* `actionlint` were "unavailable
without a forbidden install" and absent from the venv — is retired as to `mypy`.** It was
factually wrong for `mypy`.

**Re-verified 2026-07-27, read-only:**

| Probe | Result |
|---|---|
| `ls -la .../cybrik-soc-command-center/services/api/.venv/bin/mypy` | present, **executable** (`-rwxr-xr-x`, 385 bytes) |
| `.venv/bin/mypy --version` | **`mypy 2.3.0 (compiled: yes)`** |
| `which mypy` | **`mypy not found`** — not on shell `PATH` |
| `which actionlint` | **`actionlint not found`** |
| `actionlint` in the venv `bin/` | **absent** |

**Root cause of the misreading.** W0-R02C's probe was a **silent `import mypy`** whose success
was misread as a failure; the import in fact **succeeded**. W0-R02D independently confirmed only
`PATH` absence, which is a narrower fact than unavailability, and the two were conflated into
"unavailable without install".

**Corrected standing:**

- **`mypy` is available without any install** — it is an executable already present in the
  **pre-existing** borrowed venv. It is simply **not on `PATH`**, so it must be invoked by its
  **absolute path** `.venv/bin/mypy`.
- **`actionlint` remains genuinely absent** from both `PATH` and the venv, and stays an
  **open-ended deferral to a CI that is NOT WIRED**.

**Scope of this correction.** It is a **factual P2 correction of wording only**. It does **not**
change a gate, a status, a hash, a commit, a review conclusion or a classification, and it
**invalidates nothing**. The **CI-NOT-WIRED deferral stays open**. What changes is that **no
future record may describe `mypy` as unavailable**; future wording must say *available in the
borrowed venv, off `PATH`, dependency-version-caveated*.

**Prior dated evidence records are not rewritten.** Board §1.13, §14.21.2, §14.21.3 item 2,
register §16.1/§16.2 and `docs/operations/W1-I03B-ROUTE-DB-POST-COMMIT-EVIDENCE.md` keep their
original — inaccurate — `mypy` wording **byte-unchanged as dated history**. This section
**supersedes** that wording prospectively; it does not edit it.

### 8.3 Borrowed-venv rules for this lane

- The venv at
  `/Users/hoanglinh/Claude/Projects/cybrik-soc-command-center/services/api/.venv` is
  **pre-existing**. It may be used **read-only**: **no install, no upgrade, no download, no
  `pip`, no `uv sync`, no lockfile touch, no venv creation**.
- `PYTHONPATH` must be **forced to the new worktree's `services/api/src`**, and the writer must
  **probe-verify** that `cybrik_soc` resolves to that worktree — printing the resolved
  `cybrik_soc.__file__` — before citing any run.
- **Dependency-version caveat, mandatory on every citation:** the venv's third-party versions
  **do not come from this base's pins**, and its interpreter is **CPython 3.12.13** while
  `[tool.mypy]` declares `python_version = "3.11"`. Every executed figure from this lane carries
  that caveat. It taints the **evidentiary weight of local runs only**, never hash-pinned bytes.
- `mypy` is invoked as **`.venv/bin/mypy` on the four new paths specifically** — the base config
  sets `strict = true`, `mypy_path = "src"`, `packages = ["cybrik_soc"]`, so a targeted
  invocation must not be allowed to widen into a whole-package run that reports pre-existing
  findings as this lane's.
- **If dependency or source skew makes the tool error out**, the writer **reports it as caveated
  evidence** and moves on. It is a **STOP only if it reveals a P0–P2 product issue**. It is
  **never** grounds to install, upgrade, vendor or "fix" the environment.

### 8.4 Transient cache rules

- Run with **`PYTHONDONTWRITEBYTECODE=1`** and **`-p no:cacheprovider`** / `--no-header`-style
  no-cache invocation; prefer `python -c "import ast; ast.parse(...)"` over
  `python -m py_compile`.
- **Recorded precedent:** `py_compile` writes a `.pyc` **regardless of
  `PYTHONDONTWRITEBYTECODE`**, and the W1-I03B writer's residue probe **failed silently on BSD
  `find`** (board §14.21.3 item 6). The writer must therefore probe residue with a command
  verified to work on macOS/BSD and **report any residue honestly**.
- Any `__pycache__`, `.pytest_cache` or `.mypy_cache` residue is **recorded, not staged, and not
  deleted from outside the allowlist**. Claiming "no cache was written" without a working probe
  is a **P2 reporting defect**.

---

## 9. STOP conditions — hard, no exceptions

The writer **stops immediately, commits nothing and reports** on any of:

1. Any edit to a path outside the **four** in §4 — including a fifth path, an `__init__.py`, or
   a `conftest.py`.
2. Any edit to an **existing** file, of any size, for any reason.
3. Any **dependency install**, upgrade, download, image pull, container start, database start,
   **real network egress**, real data, secret or `.env` access.
4. A **contract pin mismatch**, or any need to **vendor or copy** contract bytes into the SOC
   repository.
5. Any need to touch the **gateway, routes, router, app factory, lifespan, `__init__`, config or
   settings** to make the slice work.
6. **Source or dependency skew** that undermines the evidence being cited.
7. Any **P0, P1 or P2** finding, in this lane's code or discovered in the base.
8. **Timeout** — the initial cycle plus at most one 600 s extension elapsed.
9. **Any staging attempt before the pre-commit review returns GO.**
10. Any **remote action** whatsoever — push, fetch, merge, rebase, tag, remote add/set-url. The
    pre-existing `origin` remote is **not to be touched**.
11. The §3.1 start gate failing on any of its six clauses.
12. A fabricated or reconstructed RED chronology (§7) — itself a **P0**.

---

## 10. Review, staging and commit protocol

1. The writer **stops before staging** with **zero paths staged** and a dirty tree of **exactly
   the four new paths**, and reports its evidence.
2. A **fresh, independent Fable** session performs the **pre-commit** review. It must return
   **GO with no P0–P2**. It must be a **distinct session** from the writer and from every prior
   reviewer in the W0-R02/W1-I03B lane.
3. **Only then**, the **same writer session** resumes **within its remaining runtime** and:
   - stages **exactly the four paths** — `git add` of those four paths only, never `git add -A`;
   - makes **exactly one local, status-honest `SCAFFOLD` commit**, whose body discloses the
     borrowed-venv dependency caveat, the RED chronology's evidentiary basis, any cache residue,
     and the fact that nothing is wired.
4. A **fresh, distinct Fable** session performs the **post-commit** review and must return
   **PASS with no P0–P2** **before anything counts as product evidence**.
5. **No push, no merge, no release, no tag, no date change** at any point. Nothing leaves the
   local worktree.

If the pre-commit review returns anything other than GO, **nothing is staged**. If the runtime
is exhausted between the GO and the commit, the lane is `PAUSED — UNCOMMITTED` under §2.

---

## 11. Classification ceiling — binding, even on success

**Even after a post-review PASS**, the resulting commit counts **only** as:

> **local, independently reviewed, unmerged and unpushed `SCAFFOLD` evidence toward the
> `shadow_remote` portion of live-shadow blocker 3.**

It is explicitly **not**: runtime evidence, integration evidence, CI evidence, live-shadow
evidence, deployment evidence, release evidence, or product completion. Nothing in this lane may
be labelled `IMPLEMENTED`, `VERIFIED`, `PILOTED` or `GA`.

**Nothing closes.** **No blocker is closed** — blocker 3 stays open as a whole, and **real org
mapping, TTL enforcement, the live bundle path, gateway wiring, the Cyber AI durability/delivery
portions, the Fabric runtime seam and blocker 4 all remain open and untouched**. **No UAT
milestone is reached and no instance is authorized.** W1 product implementation and
integration/live shadow stay **`HOLD`**; W1 runtime writers, delegated routine integration,
push and external release stay **`NO-GO`**; **G2 and G3 stay closed**; **`W0 COMPLETE=0`** with
W0 closure **`NO-GO`**; the board §11 exit criteria remain unmet.

**Dates unchanged:** W1 **2026-08-01 → 2026-08-23**; release window **2026-12-21 → 2026-12-31**.

**The roster stays at exactly 48 with no task 49** — `W1-I04A`, `W0-IR12` and `W0-R06B` name a
sub-lane, a decision and a correction, **not tasks**.

---

## 12. What this grant does not do

- It **opens no writer now.** No session was dispatched, no worktree created, no branch created,
  no product byte written by the session authoring this document.
- It **flips no status** and **promotes no gate**. GATE A4 and W1-C1/C2 stay
  `ACCEPTED — CLOSED 2026-07-26`; W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`.
- It **authorizes no follow-on lane**. Cyber AI W0-I10, Fabric W0-I08, the blocker-4 packet, any
  push, any un-gating of the W1-I03B static CI job, and any gateway wiring each need their own
  fresh decision and grant, several additionally requiring an explicit **Founder decision**.
- It **does not dispose of the dirty roadmap file** (§1.3) or of the four dirty canonical roots
  (§1.4).
- **P3 recorded — persistent omission.** `docs/operations/README.md` is **outside** the §14.22.1
  three-path allowlist, so its long-standing index residual (named in board §14.13.1–§14.21.1)
  **persists and now also omits this grant**. It is **not** silently fixed outside a grant.
- **P3 recorded.** The control validator **does not machine-enforce** this grant, board §14.22,
  register §17, board §15 or any pin above; its `PASS` is a documentary consistency check only.
