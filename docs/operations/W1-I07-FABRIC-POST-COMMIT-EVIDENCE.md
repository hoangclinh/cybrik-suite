# W1-I07 Fabric R0 post-commit evidence — reviewed local scaffold commit

- **Prepared:** 2026-07-27, sixth same-day control record
- **Status:** `ACTIVE — POST-COMMIT EVIDENCE RECORD — LOCAL DOCS ONLY, NOT PUSHED`
- **Owner:** logical task **W0-D04** (evidence reconciler), under the coordinator-delegated
  Founder authority recorded in `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.15
- **Subject:** the outcome of the Fabric **W0-I07** R0 remediation granted in
  `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md` — the local commit
  `d38f910a44d6454285b393cb89df4a6ade4eb855` in worktree `w1-i07-fabric-r0-domain-r1` of
  `cybrik-security-tool-fabric` — and its fresh post-commit **W0-R04C** review
- **Authority boundary:** documentation and exactly one bounded local commit in the control
  worktree; **no** product-repository write, no push, no merge, no release, no dependency
  install, no status promotion beyond recording the evidence classification in §5

This record closes the loop that the disposition packet §5 and the remediation grant §5 opened:
the granted writer completed, exactly one status-honest local product commit exists, and the
mandated fresh post-commit review has reported. This record verifies the commit facts live and
records the review and execution figures **as reported**. It promotes no runtime, transport,
release or GA claim, opens no gate, and creates no task identity.

## 1. Verified facts — re-read live, read-only, 2026-07-27

Every fact in this section was re-verified from live Git on 2026-07-27 from the control session
that authored this record, with **read-only** commands; the Fabric repository was not written to.

- **Commit:** `d38f910a44d6454285b393cb89df4a6ade4eb855`, subject
  `feat(control-plane): scaffold W1 R0 invocation domain` — status-honest scaffold wording, no
  `IMPLEMENTED`/`VERIFIED`/`PILOTED`/`GA` claim.
- **Parent:** `87b4cf388038c6dd2e1a74e13f4131306a80ba92` — exactly the base the grant §2.1
  bound; the commit is the base's sole child on this branch.
- **Branch:** `codex/w1-i07-fabric-r0-domain-r1`; the branch tip equals the commit.
- **Paths:** exactly **30 paths** (30 files changed, 4865 insertions, 15 deletions) — the same
  30 paths enumerated path-for-path in
  `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md` §1: the 3 previously tracked modified
  files and the 27 previously untracked files, now all committed. No path outside that set was
  touched; none was added, deleted, renamed or moved.
- **Working tree:** clean — zero dirty, zero staged, zero untracked. The
  `PAUSED — UNCOMMITTED` dirty-tree state recorded since board §1.3 no longer exists; it landed
  as this commit.
- **Not pushed:** the branch has **no upstream configured** and no push occurred; no remote was
  created or changed.

## 2. Review outcome — W0-R04C, as reported

The **fresh post-commit W0-R04C review** — the review the grant §5.4 mandates, distinct from
the W0-R04 audit and the W0-R04A reassessment, neither of which carried over — reports, as lane
evidence not re-executed from this control worktree:

- **PASS — no P0–P2 findings.**
- **Five P3 findings**, enumerated in full in §4; none blocks the evidence classification in §5.

The pre-commit steps of the grant §5 protocol (writer stop, independent pre-commit review GO
with no P0–P2, staging of exactly the 30 paths) are **as reported by the remediation lane**;
this control record verifies the resulting commit facts in §1 and records the post-commit
review outcome above.

## 3. Executed evidence — as reported, with one discrepancy recorded honestly

| Check | Reported result |
|---|---|
| Full pytest suite | **391 passed** |
| Targeted test selection | **Discrepancy, recorded honestly:** the writer reported `120` targeted tests over **six** files; the post-commit review's re-run of the **five changed test files** in the commit yielded `116`. The two figures cover different file selections and neither is re-executed here; the wording defect is P3-1 in §4 |
| `mypy` strict | **success — 16 source files** |
| Contract provenance | **39 vendored hashes** verified and the pinned Suite blobs **exact** |
| `bandit` | **zero findings** |
| Go toolchain | `go vet`, `gofmt`, `go build`, `go test` **green** |
| `ruff` | **pre-existing debt outside the commit's diff** — not introduced by this commit and not remediated by it |

## 4. The five P3 findings — enumerated in full

| P3 | Finding |
|---|---|
| 1 | **Targeted-count wording:** the writer's `120 targeted over six files` claim does not match the post-commit re-run of the five changed test files (`116`); a wording/selection-attribution defect, not a test failure |
| 2 | **`dataclasses.replace` factory-guard bypass:** `dataclasses.replace` can construct model instances without passing through the guarded factory, bypassing its validation |
| 3 | **TR-4/5/7 runtime-proof wording:** wording in the tree can be read as satisfying TR-4/TR-5/TR-7, which remain runtime-only obligations with no runtime proof |
| 4 | **`request_id` excluded from binding:** the idempotency binding excludes `request_id`, so a replayed result carries the **original** request's correlation rather than the replaying request's |
| 5 | **Validator recompilation performance:** schema validators are recompiled per invocation instead of being compiled once and reused |

All five are recorded open against the committed tree; their resolution is not scheduled by
this record and requires its own bounded authority.

## 5. Evidence classification — exactly what this may count as

The commit `d38f910…`, with its W0-R04C `PASS`/no-P0–P2 review, may count **only** as:

- **local, independently reviewed product evidence** toward live-shadow **blocker 1** (board
  §1.3: "a committed, independently reviewed R0 domain") — and nothing more;
- strictly **unmerged and unpushed**: a local commit on a local branch with no upstream;
- strictly **`SCAFFOLD`/in-process**: a domain scaffold exercised by in-process tests only.

It is **not** and must never be cited as: runtime evidence, transport evidence, an endpoint, a
live capability-registry entry, an invocation grant, integration evidence, release evidence, or
anything `IMPLEMENTED`/`VERIFIED`/`PILOTED`/`GA`.

## 6. Residual obligations — open, unchanged by this commit

- **TR-6:** a signed **emitted** receipt — the receipt is not emitted/signed by any runtime.
- **TR-8:** timing and audit equivalence evidence.
- **TR-4/TR-5/TR-7:** runtime proof — static/in-process evidence does not satisfy them (P3-3).
- **Durable idempotency and true concurrency:** the store is in-process; durable put-if-absent
  and multi-connection contention evidence remain open.
- **No HTTP surface, no MCP, no live capability-registry entry, no sandbox, no
  credential/egress broker, no database** exists in or is claimed by this commit.

## 7. Effect on the four live-shadow blockers

1. **Fabric (blocker 1)** — **locally resolved only**: a committed, independently reviewed R0
   domain now exists as local unmerged/unpushed evidence at `d38f910…`. The blocker's later
   elements — an authenticated HTTP surface and a live registry entry — remain open.
2. **Cyber AI (blocker 2)** — HTTP transport, durability and bundle delivery (G2): **open,
   unchanged**; the W1-I06C remediation stays queued behind its own fresh bounded grant.
3. **SOC (blocker 3)** — `shadow_remote` route, permanent route-against-DB CI job, real org
   mapping: **open, unchanged**.
4. **Canonical integration (blocker 4)** — integration authority on one canonical root with CI
   wiring: **open, unchanged**.

**W1 integration/live shadow therefore remains `HOLD`/`NO-GO`** — blockers 2–4 stand.

## 8. What this record does not change

- **No push, no merge, no remote change, no release, no dependency install.** The Fabric
  commit stays local on its unpushed branch; the control commit stays local.
- **G2/G3 stay closed**; W1 integration/live shadow stays `HOLD`/`NO-GO`; `W0 COMPLETE=0` and
  W0 closure stays `NO-GO`; the board §11 exit criteria remain unmet.
- The task roster is exactly the 48 immutable identities — no task 49 and no replacement
  identity; category counts stay I 12 · T 12 · R 6 · S 5 · B 5 · IR 4 · D 4.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31
  release window are unchanged.
- No status is promoted beyond the §5 evidence classification; no writer is opened; the five
  P3 findings and the §6 residuals stay open with no remediation scheduled.

## 9. Provenance

- Bounded authority and measured control-side evidence: board §14.15 (allowlist §14.15.1;
  measured evidence §14.15.4); board summary §1.7.
- Matching register entries: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §4.2 row 13 and §10.
- The grant this outcome completed under:
  `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md` (board §1.6/§14.14; register §9).
- The disposition that required the grant:
  `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md` (board §1.5/§14.13; register §8).
- Prior dated records of the pause and audits: board §1.3/§14.11; register §6.
