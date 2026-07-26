# W1-I07 Fabric R0 domain attempt — disposition packet

- **Prepared:** 2026-07-27, fourth same-day control record
- **Status:** `ACTIVE — DECISION RECORD — LOCAL DOCS ONLY, NOT PUSHED`
- **Owner:** logical task **W0-D04** (decision-packet author), under the coordinator-delegated
  Founder authority recorded in `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.13
- **Subject:** the paused Fabric **W0-I07** R0 domain implementation attempt in worktree
  `w1-i07-fabric-r0-domain-r1` of `cybrik-security-tool-fabric`
- **Authority boundary:** documentation and exactly one bounded local commit in the control
  worktree; **no** product-repository write, no push, no merge, no release, no dependency
  install, no status promotion, no implementation

This packet records a **delegated coordinator decision, already taken** under the Founder
delegation granted to the coordinator. It is not a request for a user decision. It disposes of
the paused attempt only; it accepts nothing, flips no gate, promotes no writer, and creates no
task identity.

## 1. Verified facts — re-read live, read-only, 2026-07-27

Every fact in this section was re-verified from live Git on 2026-07-27 from the control session
that authored this packet, with **read-only** commands; the Fabric repository was not written to.

- **Worktree:** `w1-i07-fabric-r0-domain-r1`, branch `codex/w1-i07-fabric-r0-domain-r1`, in
  `cybrik-security-tool-fabric`.
- **HEAD/base:** `87b4cf388038c6dd2e1a74e13f4131306a80ba92` — parent
  `1789480be4774d014a94227bc4436357d2e4b674`, subject `fix(contract): enforce W1 exchange
  binding`. The branch tip equals the base: **the attempt produced no commit**, and
  `87b4cf3…` remains the latest committed Fabric state (board §1.2/§1.3).
- **Dirty state:** exactly **30 paths**, **zero staged** — 3 tracked files modified and
  unstaged, 27 untracked files:

| # | State | Path |
|---|---|---|
| 1 | modified, unstaged | `contracts-vendor/contracts.lock.json` |
| 2 | modified, unstaged | `tests/conformance/test_alert_context_conformance.py` |
| 3 | modified, unstaged | `tests/control-plane/test_contract_provenance.py` |
| 4 | untracked | `contracts-vendor/compatibility/cybrik-suite-alert-context-transport-binding.v1.manifest.json` |
| 5 | untracked | `contracts-vendor/fixtures/alert-context-transport/examples-manifest.json` |
| 6 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-schema/bound-request.authorization-binding-asserted.json` |
| 7 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-schema/bound-request.capability-pin-mismatch.json` |
| 8 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-schema/bound-result.approval-required.json` |
| 9 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-schema/bound-result.completed-without-receipt.json` |
| 10 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-schema/bound-result.output-artifact-locator.json` |
| 11 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-schema/bound-result.unavailable-with-output.json` |
| 12 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-semantic/bound-request.idempotency-key-mismatch.json` |
| 13 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-semantic/bound-request.tenant-mismatch.json` |
| 14 | untracked | `contracts-vendor/fixtures/alert-context-transport/negative-semantic/bound-request.w2f-token-as-delegation-ref.json` |
| 15 | untracked | `contracts-vendor/fixtures/alert-context-transport/positive/bound-request.json` |
| 16 | untracked | `contracts-vendor/fixtures/alert-context-transport/positive/bound-result.available.json` |
| 17 | untracked | `contracts-vendor/fixtures/alert-context-transport/positive/bound-result.kill-switch-denied.json` |
| 18 | untracked | `contracts-vendor/fixtures/alert-context-transport/positive/bound-result.unavailable.json` |
| 19 | untracked | `contracts-vendor/json-schema/cybrik.execution-receipt.v1.schema.json` |
| 20 | untracked | `contracts-vendor/json-schema/cybrik.soc-alert-context-invocation-binding.v1.schema.json` |
| 21 | untracked | `contracts-vendor/json-schema/cybrik.tool-execution-request.v1.schema.json` |
| 22 | untracked | `contracts-vendor/json-schema/cybrik.tool-execution-result.v1.schema.json` |
| 23 | untracked | `src/control-plane/cybrik_fabric_control/contracts/invocation.py` |
| 24 | untracked | `src/control-plane/cybrik_fabric_control/invocation/__init__.py` |
| 25 | untracked | `src/control-plane/cybrik_fabric_control/invocation/models.py` |
| 26 | untracked | `src/control-plane/cybrik_fabric_control/invocation/ports.py` |
| 27 | untracked | `src/control-plane/cybrik_fabric_control/invocation/service.py` |
| 28 | untracked | `tests/conformance/test_transport_binding_conformance.py` |
| 29 | untracked | `tests/control-plane/test_r0_invocation_security.py` |
| 30 | untracked | `tests/control-plane/test_r0_invocation_service.py` |

The 30-path set matches the "exactly 30 authorized paths, zero staged" state recorded in board
§1.3/§14.11.2 and register §6.1 — the tree has not drifted since that record.

## 2. Audit evidence — as reported by W0-R04, not re-executed

The completed **W0-R04 read-only audit** of the dirty tree (board §1.3, §5; register §6.1)
reports, as lane evidence not re-executed from the control worktree:

- **Technically GREEN:** `388` full-suite tests plus `113` targeted tests passing; `ruff`,
  format, `mypy`, `bandit` and Go checks green.
- **Findings:** no P0–P2; **three P3** findings. The control repository records the three P3s by
  count and severity only; their itemized content is held by the W0-R04 lane report and is
  **not** reproduced here. They are **unresolved and undispositioned** as of this packet.

A technically GREEN dirty tree is an audit observation, **not product evidence** (board §1.3).

## 3. Timeout history — the runtime grant is exhausted

The bounded W0-I07 R0 domain writer attempt ran to the **hard 1200 s timeout** (board
§1.3/§14.11.2) — consistent with the board §15 runtime rule's ceiling of one initial 600 s
cycle plus **one and only one** 600 s extension, after which no third cycle may be requested or
granted. The logical attempt's runtime grant is therefore **consumed**: under §15, quota
exhaustion is never grounds for an extension and a retry never creates a replacement identity.

## 4. Disposition — delegated coordinator decision, recorded

Taken under the Founder delegation already granted to the coordinator; recorded here as a
decision, not proposed for one.

1. **HOLD.** The worktree `w1-i07-fabric-r0-domain-r1` remains `PAUSED — UNCOMMITTED` exactly
   as it stands: 30 dirty paths, zero staged, base `87b4cf3…`.
2. **REFUSE commit.** No commit of the dirty tree is authorized from within the current,
   exhausted logical attempt — by the original session, by this control session, or by anyone
   acting on the attempt's behalf.
3. **REFUSE replacement writer.** No replacement or successor writer may be opened inside the
   current exhausted logical attempt; spawning one to continue the timed-out work would evade
   the §15 hard stop and is refused.
4. **Not product evidence.** The tree promotes nothing. The latest committed Fabric state
   remains `87b4cf388038c6dd2e1a74e13f4131306a80ba92`, and every W1 gate, hold and NO-GO
   stands exactly as the board records it.

## 5. Preconditions for any future action on this tree

Any future work that touches, commits, discards or supersedes this dirty tree requires **all**
of the following, in order:

1. **A fresh, prospective, bounded grant recorded before work begins** — exact worktree, base,
   path allowlist, test obligations, reviewer and runtime bound, recorded in the control board
   the way §14.x records every bounded authority. Retroactive or implied authority is invalid.
2. **No resumption of the exhausted session.** The new work must not resume the timed-out
   Claude session, and must not reuse an existing task identity — or mint a new one — to evade
   the §15 timeout; the W0-I07 immutable task identity persists, but the retry runs only under
   the fresh grant of item 1 with its own full runtime bound.
3. **P3 resolution or explicit disposition.** Each of the three W0-R04 P3 findings must be
   resolved in the tree or explicitly dispositioned (accepted/deferred with reason) in the
   grant record before any commit lands.
4. **Fresh independent review after any commit.** A commit produced under the fresh grant is
   still not product evidence until it passes a fresh, independent post-commit review; the
   pre-commit W0-R04 audit of the dirty tree does not carry over as that review.

## 6. Queued, not decided

- **Cyber AI W1-I06C remediation.** The separate hard-stopped W1-I06C HTTP ingress attempt
  (board §1.4; register §7) remains `PAUSED — UNCOMMITTED` with the adverse W0-R03 `NO-GO`
  review (P1 static gates, P2 evidence packaging) outstanding. Its remediation is **queued**
  behind its own fresh bounded grant and is **not decided** by this packet.

## 7. What this packet does not change

- **G2/G3 stay closed.** No gate beyond the already-closed W1-G1 opens: the G2 blocker —
  Cyber AI HTTP transport, durability and bundle delivery — and every later gate remain closed
  and unpassed.
- W1 integration/live shadow stays `HOLD`/`NO-GO`; the board §11 W1 Investigation Spine
  outcome stays unmet; `W0 COMPLETE=0` and W0 closure stays `NO-GO`.
- The task roster is exactly the 48 immutable identities — no task 49 and no replacement
  identity; category counts stay I 12 · T 12 · R 6 · S 5 · B 5 · IR 4 · D 4.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31
  release window are unchanged.
- Nothing is pushed, merged, released or installed; no secret is read; no status is promoted;
  no implementation authority follows from this packet.

## 8. Provenance

- Bounded authority and measured control-side evidence: board §14.13 (allowlist §14.13.1;
  measured evidence §14.13.4).
- Matching register entries: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §4.2 row 11 and §8.
- Prior dated records of the pause: board §1.3/§14.11 and register §6 (2026-07-27,
  second same-day record).
