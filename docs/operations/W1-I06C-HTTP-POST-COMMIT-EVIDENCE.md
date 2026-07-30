# W1-I06C Cyber AI HTTP post-commit evidence — reviewed local scaffold commit

- **Prepared:** 2026-07-27, eighth same-day control record
- **Status:** `ACTIVE — POST-COMMIT EVIDENCE RECORD — LOCAL DOCS ONLY, NOT PUSHED`
- **Owner:** logical task **W0-D04** (evidence reconciler), under the coordinator-delegated
  Founder authority recorded in `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.17
- **Subject:** the outcome of the Cyber AI **W0-I06** (sub-lane **W1-I06C**) HTTP remediation
  granted in `docs/operations/W1-I06C-HTTP-REMEDIATION-GRANT.md` — the local commit
  `2baba72534297fc67130983e5bd21b5730f50c31` in worktree `w1-i06c-http-ingress-r2` of
  `cybrik-cyber-ai-platform` — and its fresh post-commit **W0-R03E** review
- **Authority boundary:** documentation and exactly one bounded local commit in the control
  worktree; **no** product-repository write, no push, no merge, no release, no dependency
  install, no status promotion beyond recording the evidence classification in §5

This record closes the loop the remediation grant §6 opened: the granted writer completed, the
independent pre-commit review returned GO, exactly one status-honest local product commit
exists, and the mandated fresh post-commit review has reported. This record verifies the commit
facts live and records the review and execution figures **as reported**. It promotes no
transport-security, runtime, durability, delivery, release or GA claim, opens no gate, and
creates no task identity.

## 1. Verified facts — re-read live, read-only, 2026-07-27

Every fact in this section was re-verified from live Git on 2026-07-27 from the control session
that authored this record, with **read-only** commands; the Cyber AI repository was not written
to.

- **Commit:** `2baba72534297fc67130983e5bd21b5730f50c31`, subject
  `feat(investigations): expose lifecycle HTTP ingress`, with a body that opens
  `SCAFFOLD, local, unmerged, in-process only` — status-honest scaffold wording, no
  `IMPLEMENTED`/`VERIFIED`/`PILOTED`/`GA` claim, explicit "no TLS termination and no
  peer-certificate verification exists anywhere in this repository", "Not pushed".
- **Parent:** `866b7db91d9352a9a0d2bd74618d642dfef0493b` — exactly the gate-reopen commit the
  grant §2.1 bound as base; the commit is the base's sole child on this branch.
- **Branch:** `codex/w1-i06c-http-ingress-r2`; the branch tip equals the commit.
- **Paths:** exactly **13 paths** (13 files changed, 2857 insertions, 30 deletions) — the same
  13 paths enumerated path-for-path in the grant §1 table and the gate §C manifest: the six
  previously tracked modified files and the seven previously untracked files, now all
  committed. No path outside that set was touched; none was added, deleted, renamed or moved.
- **OpenAPI pin, re-hashed live:** the vendored accepted OpenAPI member at the commit hashes to
  exactly `22cd7d71f89bd5c287b79e87015a28dd27fdbd124fd3a073e56346a4de3c318d` — the pinned
  accepted-contract digest, unchanged.
- **Working tree:** clean — zero dirty, zero staged, zero untracked. The
  `PAUSED — UNCOMMITTED` 13-path dirty-tree state recorded since board §1.4 no longer exists;
  it landed as this commit.
- **Not pushed:** the branch has **no upstream configured** and no push occurred; no remote was
  created or changed.

## 2. Review outcome — W0-R03D and W0-R03E, as reported

The grant §6 protocol completed in order, as reported by the remediation lane:

- **Pre-commit:** the independent Fable **W0-R03D** pre-commit review of the remediated dirty
  tree returned **GO with no P0–P2** before staging; the writer then staged exactly the 13
  paths and made exactly one local commit.
- **Post-commit:** the **fresh post-commit W0-R03E review** — the review the grant §6.4
  mandates, distinct from the adverse W0-R03 `NO-GO` review and from W0-R03D, neither of which
  carried over — reports **PASS — no P0–P2 findings**, with **two P3 findings**, enumerated in
  full in §4; neither blocks the evidence classification in §5.

Neither the W0-R03 `NO-GO` review (whose P1/P2 findings the remediation resolved) nor the
grant's control-side re-verification counted as either required review; both required reviews
ran fresh, as the grant demanded.

## 3. Executed evidence — as reported

Not re-executed from this control worktree; figures are as reported by the remediation lane and
its reviewers, consistent with the committed evidence text:

| Check | Reported result |
|---|---|
| Full pytest suite | **`696 passed, 5 warnings`** at **`97.43%`** coverage |
| Targeted tests (the five committed test files) | **`138 passed`** |
| `ruff check` | **green** — the seven W0-R03 findings resolved (`7 → 0`) |
| `ruff format --check` | **green** — `4 → 0`, via one invocation scoped to exactly the four named files |
| `mypy` strict | **green** — the nine W0-R03 errors resolved (`9 → 0`), type-level only |
| OpenAPI pin | vendored accepted member unchanged at sha256 `22cd7d71…` (re-hashed live in §1) |
| Provenance | `provenance.json` counts and digests intact; conformance/provenance assertion meaning unchanged |
| Dependency closure | no dependency added, upgraded, removed or installed by the remediation; `pyproject.toml` and `uv.lock` landed byte-as-is from the pre-remediation dirty set — seven frozen paths reported byte-identical before/after remediation (sha256 prefixes `1cd12a29`, `deaeebcb`, `22cd7d71`, `94898302`, `f6e12c38`, `ebd26c0e`, `6f382789`) |
| Security semantics | exact five-path route surface with declared statuses, transport **default-deny**, non-trust of client headers, uniform **bundle refusal** (consults neither transport nor credential), and **token non-consumption** all unchanged |

## 4. The two P3 findings — enumerated in full

| P3 | Finding |
|---|---|
| 1 | **Transposed RED durations in the commit message:** the commit message attributes `1 error in 0.21s` to the `cybrik_ai_api.transport_security` `ModuleNotFoundError` collection failure and `1 error in 0.27s` to the `cybrik_ai_api.app` one. This record's own read-only re-inspection of the transcript `06a2c154-50c7-4525-851c-ee9ecfd47219.jsonl` confirms the transcript pairs them the other way — `transport_security` with `0.27s`, `app` with `0.21s` — so the two durations are **transposed** between the two errors (the grant §5 quotation carries the same transposed attribution, which the commit message inherited). Both collection failures and both durations are real, and the RED→GREEN chronology and artifacts remain valid; this is an attribution wording defect, not an evidence defect |
| 2 | **Type-ignore accounting:** the committed diff contains **four** narrow `# type: ignore[...]` comments — `call-arg` on the `model_construct` bundle-refusal placeholder in `investigations/api.py`, and `misc` × 2 plus `call-arg` in `tests/ai_api/test_transport_security.py` — while the commit message's remediation enumeration names only the **two** that were remediation-added (the `model_construct` `call-arg` and the frozen-model-mutation `misc`). The other two pre-existed in the untracked files from the original session. All four are narrow and code-scoped; this is a disclosure-completeness wording defect, not a behavior defect |

Both are recorded open against the committed tree; their resolution is not scheduled by this
record and requires its own bounded authority.

## 5. Evidence classification — exactly what this may count as

The commit `2baba72…`, with its W0-R03D `GO` pre-commit and W0-R03E `PASS`/no-P0–P2 post-commit
reviews, may count **only** as:

- **local, independently reviewed `SCAFFOLD` evidence toward the HTTP transport
  prerequisite of live-shadow blocker 2** (board §1.7: "Cyber AI HTTP transport, durability
  and bundle delivery (G2)") — the transport-prerequisite portion only, and nothing more;
- strictly **unmerged and unpushed**: a local commit on a local branch with no upstream;
- strictly **`SCAFFOLD`/in-process**: a FastAPI application exercised solely over in-process
  ASGI — it binds no socket, no port and no server process.

It is **not product evidence** and is **not** and must never be cited as: real transport
security, TLS termination, peer verification, runtime evidence, deployment evidence,
durability evidence, bundle-delivery evidence, release evidence, or anything
`IMPLEMENTED`/`VERIFIED`/`PILOTED`/`GA`.

## 6. Residual obligations — open, unchanged by this commit

- **Real TLS/peer resolver:** no TLS termination and no peer-certificate verification exists
  anywhere in the repository; the trusted-transport context is resolved in-process, not from a
  real TLS peer.
- **TR-8 timing half:** timing-equivalence evidence remains runtime-only and open; only the
  sanitized-error positive and existence-decoy negative fixture halves are exercised.
- **`DEV_TEST_ONLY` replay:** the replay/idempotency retention is process-local
  `DEV_TEST_ONLY` state — not durable, not shared, not crash-safe.
- **Process-local checkpoint store:** the checkpoint document store is in-memory
  `DEV_TEST_ONLY` process-local state that a restart loses.
- **ADR-0003 durability/delivery:** the durable-orchestration and delivery obligations remain
  open; nothing here is durable, delivered, dispatched or deployed.
- **Bundle refusal / v0.1.1:** the uniform bundle-refusal behavior stands — no bundle is
  delivered; Bundle v0.1.1 remains a **proposed** successor candidate only, with accepted
  v0.1.0 bytes unchanged.
- **Formatter pre-image gap:** the four reformatted files were untracked, so no pre-format
  byte pre-image exists and the formatter's exact hunks are not enumerable post-hoc — a
  disclosed, permanent evidence gap.
- **G2/G3 remain closed**; no gate moves on this commit.

## 7. Effect on the four live-shadow blockers

1. **Fabric (blocker 1)** — **unchanged**: locally resolved only, exactly as board §1.7 and
   register §10 record it.
2. **Cyber AI (blocker 2)** — the **HTTP transport prerequisite is locally resolved only**: a
   committed, twice-reviewed in-process HTTP ingress scaffold now exists as local
   unmerged/unpushed `SCAFFOLD` evidence at `2baba72…`. The blocker's **durability and bundle
   delivery portions remain open**, and G2 stays closed — the blocker as a whole is **not**
   resolved.
3. **SOC (blocker 3)** — `shadow_remote` route, permanent route-against-DB CI job, real org
   mapping: **open, unchanged**.
4. **Canonical integration (blocker 4)** — integration authority on one canonical root with CI
   wiring: **open, unchanged**.

**W1 integration/live shadow therefore remains `HOLD`/`NO-GO`** — blockers 2 (in part), 3
and 4 stand.

## 8. What this record does not change

- **No push, no merge, no remote change, no release, no dependency install.** The Cyber AI
  commit stays local on its unpushed branch; the control commit stays local.
- **G2/G3 stay closed**; W1 integration/live shadow stays `HOLD`/`NO-GO`; `W0 COMPLETE=0` and
  W0 closure stays `NO-GO`; the board §11 exit criteria remain unmet.
- The task roster is exactly the 48 immutable identities — no task 49 and no replacement
  identity; category counts stay I 12 · T 12 · R 6 · S 5 · B 5 · IR 4 · D 4.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31
  release window are unchanged.
- No status is promoted beyond the §5 evidence classification; no writer is opened; the two
  P3 findings and the §6 residuals stay open with no remediation scheduled.
- The Fabric W0-I07 lane and its five W0-R04C P3 findings are untouched.

## 9. Provenance

- Bounded authority and measured control-side evidence: board §14.17 (allowlist §14.17.1;
  measured evidence §14.17.4); board summary §1.9.
- Matching register entries: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §4.2 row 15 and §12.
- The grant this outcome completed under:
  `docs/operations/W1-I06C-HTTP-REMEDIATION-GRANT.md` (board §1.8/§14.16; register §11).
- Prior dated records of the attempt, hard stop, NO-GO review and queueing: board §1.4/§1.5,
  §14.12/§14.13; register §7/§8.
- The gate this scaffold landed under: the gate-reopen commit `866b7db9…` and its §C manifest,
  committed in `cybrik-cyber-ai-platform` on branch `codex/w1-i06c-http-ingress-r2`.
