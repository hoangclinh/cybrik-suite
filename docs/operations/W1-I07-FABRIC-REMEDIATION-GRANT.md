# W1-I07 Fabric R0 remediation — prospective bounded grant

- **Prepared:** 2026-07-27, fifth same-day control record
- **Status:** `ACTIVE — PROSPECTIVE BOUNDED GRANT — LOCAL DOCS ONLY, NOT PUSHED`
- **Grant author:** logical task **W0-D04** (prospective-grant author), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.14
- **Grantee:** fixed roster task **W0-I07** — the same immutable identity; **no task 49** and no
  replacement identity is created by this grant
- **Subject:** bounded remediation and landing of the paused Fabric R0 domain attempt in worktree
  `w1-i07-fabric-r0-domain-r1` of `cybrik-security-tool-fabric`
- **Authority boundary:** this document records a **prospective grant only**; the control session
  that authored it wrote no product byte, and nothing is promoted by this grant existing

This grant satisfies precondition 1 of
`docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md` §5: a fresh, prospective, bounded grant
recorded **before** work begins — exact worktree, base, path allowlist, test obligations,
reviewer and runtime bound. It authorizes exactly one future remediation writer attempt under the
terms below. It accepts nothing, flips no gate, and is **not product evidence**; the tree remains
`PAUSED — UNCOMMITTED` until the writer completes under these terms and both reviews pass.

## 1. Basis — W0-R04A reassessment, as reported; worktree re-verified live

**Worktree facts, re-verified read-only on 2026-07-27** from the control session that authored
this grant: worktree `w1-i07-fabric-r0-domain-r1`, branch `codex/w1-i07-fabric-r0-domain-r1`,
HEAD/base `87b4cf388038c6dd2e1a74e13f4131306a80ba92` (parent `1789480be4774d014a94227bc4436357d2e4b674`);
the branch tip equals the base — no commit exists on the attempt. The tree is dirty with exactly
**30 paths under `-uall`, zero staged**, matching the disposition-packet §1 enumeration
path-for-path — no drift since board §14.13.2.

**Audit basis, as reported by the W0-R04A reassessment** — the W0-R04 review lane's fresh
read-only reassessment of the same paused dirty tree; figures were **not re-executed** from this
control worktree:

- **no P0–P2** findings;
- **117 targeted tests green** — this supersedes the earlier `113` targeted figure as the current
  targeted count; the `113` figure stays readable in the dated §14.11/§14.13 history;
- the three W0-R04 P3 findings are re-characterized as follows:

| P3 | Reassessed class | Content |
|---|---|---|
| 1 | **Blocking** | Idempotency ordering: `store.record` runs before the outcome post-condition is validated, so a failed post-condition can leave a recorded entry behind a no-longer-reusable key — compounded by nested aliasing of the returned document, through which caller-side mutation can reach stored/replayed state |
| 2 | Cosmetic | S105 rename of the W2F TOKEN DIGEST constant |
| 3 | Optional | Shallow-freeze caveat — documentation-only; a one-sentence docstring caveat suffices |

This table is the explicit disposition of all three P3 findings required by packet §5 item 3:
P3-1 **must be resolved in the tree** under §4 before any commit; P3-2 is resolved by the §4
rename; P3-3 is **dispositioned as optional** — it may be satisfied by the §4 docstring caveats
or deferred with no further obligation.

## 2. Writer binding — repo, base, session, runtime

1. **Repo/worktree/base:** `cybrik-security-tool-fabric`, worktree `w1-i07-fabric-r0-domain-r1`,
   branch `codex/w1-i07-fabric-r0-domain-r1`, exact base
   `87b4cf388038c6dd2e1a74e13f4131306a80ba92`. If the observed base, branch, dirty-path set or
   staged count differs from §1 at session start, the writer must STOP before any edit.
2. **Model and session:** **Opus 5**, in a **brand-new Claude session**. Resuming the exhausted
   session `5da9e0a9` is **forbidden** in every form, satisfying packet §5 item 2; the retry
   keeps the immutable task identity **W0-I07** — no identity reuse or minting to evade the
   board §15 timeout.
3. **Runtime bound (board §15):** one initial **600 s** cycle plus **at most one** healthy
   **600 s** extension, granted only on evidenced progress. A second extension request is denied;
   quota exhaustion, permission loops, deadlock and scope drift are never grounds. At the bound,
   the writer hard-stops and reports partial evidence.

## 3. Exact product edit allowlist — five already-dirty paths only

| # | Path | Edit scope |
|---|---|---|
| 1 | `src/control-plane/cybrik_fabric_control/invocation/service.py` | remediation edits within §4 only |
| 2 | `tests/control-plane/test_r0_invocation_service.py` | RED-first tests within §4 only |
| 3 | `tests/control-plane/test_r0_invocation_security.py` | RED-first tests within §4 only |
| 4 | `src/control-plane/cybrik_fabric_control/invocation/models.py` | **optional, docstring-only** — one-sentence shallow-freeze caveat |
| 5 | `src/control-plane/cybrik_fabric_control/invocation/ports.py` | **optional, docstring-only** — one-sentence shallow-freeze caveat |

All five are already inside the existing 30-path dirty set. The remaining **25 dirty paths are
read-only until staging**. No new path may be created, none deleted, renamed or moved; no
dependency added, upgraded or installed; no formatter or auto-fixer run. The `-uall` dirty set
must remain **exactly the same 30 paths, zero staged**, from session start until the authorized
staging step in §5.

## 4. Permitted behavior — exact, RED-first

1. **RED first.** Add failing tests (paths 2–3 of §3) proving both properties before any
   `service.py` change:
   - a failed outcome post-condition leaves the idempotency store **empty** and the key
     **reusable**;
   - mutation of the returned document **cannot affect replay**.
2. **Then GREEN.** Move `store.record` so it executes only **after** a successful
   complete/validated outcome, and apply a **deterministic deep copy at record and at replay**,
   turning the §1 RED tests green.
3. **Cosmetic.** Rename the W2F TOKEN DIGEST constant (S105).
4. **Optional.** One-sentence shallow-freeze caveats only, **docstring-only**, in `models.py`
   and/or `ports.py` (paths 4–5 of §3).

Nothing else is permitted: no behavior change beyond items 1–4, no API/schema change, no new
test file, no refactoring sweep, no dependency, no deletion.

## 5. Review and commit protocol

1. **Writer stops before commit.** After §4 is complete (or at the §2 runtime bound), the writer
   ends its work phase with **zero staged paths** and reports; it does not stage or commit.
2. **Independent Fable pre-commit review.** An independent Fable session reviews the dirty tree.
   Staging and commit require an explicit **GO with no P0–P2** from that review.
3. **One bounded local commit.** After GO, the **same new writer session** (never `5da9e0a9`)
   resumes **within its remaining allowed §15 time only** to stage **exactly all 30 dirty
   paths** and make **exactly one local commit** whose subject and body are **status-honest
   `SCAFFOLD`** — no `IMPLEMENTED`/`VERIFIED`/`PILOTED`/`GA` wording, no runtime or product
   promotion claim. Nothing is pushed.
4. **Fresh post-commit Fable review.** A fresh, independent Fable post-commit review follows,
   satisfying packet §5 item 4. Neither the W0-R04 audit nor the W0-R04A reassessment carries
   over as that review, and the commit is **not product evidence** until it passes.

## 6. STOP conditions — immediate hard stop, report partial evidence

The writer (and the resumed commit step) must STOP immediately, with no further edit, on any of:

1. observed base ≠ `87b4cf3…`, branch tip ≠ base at start, any staged path before the §5.3
   staging step, or any drift of the `-uall` dirty set from the exact 30 paths;
2. any edit outside the five §3 paths, or any non-docstring edit to `models.py` or `ports.py`;
3. any need for a new path, a deletion, a rename, a dependency, a formatter/auto-fixer, or any
   behavior outside §4 items 1–4;
4. the RED tests of §4.1 failing to go RED for the expected reason, or failing to go GREEN under
   the §4.2 change without exceeding this grant's scope;
5. the §2.3 runtime bound reached, or any prompt to request a second extension;
6. any prompt or temptation to resume session `5da9e0a9`, reuse another task identity, or mint a
   new one;
7. a pre-commit review outcome other than GO with no P0–P2, or any instruction to stage fewer or
   more than the exact 30 paths;
8. any push, merge, remote, release, install, G2/G3, date-change or status-promotion action.

A STOP consumes the attempt's remaining authority for that step; it never widens the allowlist
and never creates a replacement identity.

## 7. Evidence attribution

- The base, branch, 30-path dirty enumeration and zero-staged state in §1 were **re-verified
  live, read-only** from the Fabric repository on 2026-07-27 by the control session authoring
  this grant; no product byte was written.
- The `no P0–P2`, `117 targeted green` and P3 re-characterization figures in §1 are **as
  reported by the W0-R04A reassessment lane** and were not re-executed from this control
  worktree.
- The earlier `388` full / `113` targeted figures and the original three-P3 record remain
  attributed to the **W0-R04** audit as dated history (board §1.3/§14.13.2; register §6.1/§8.1).

## 8. What this grant does not authorize

- **No push, no merge, no remote change, no release, no dependency install.**
- **G2/G3 stay closed**; W1 integration/live shadow stays `HOLD`/`NO-GO`; `W0 COMPLETE=0` and W0
  closure stays `NO-GO`; the board §11 exit criteria remain unmet.
- **No date change:** W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the
  2026-12-21 → 2026-12-31 release window are unchanged.
- **No status promotion:** the resulting commit, if any, carries `SCAFFOLD` status honesty and
  becomes product evidence only after the §5.4 post-commit review passes; no gate in board §1
  moves on this grant alone.
- The separate Cyber AI W1-I06C remediation (packet §6) remains **queued, not decided**; nothing
  here touches it.

## 9. Provenance

- Bounded grant-authoring authority and measured control-side evidence: board §14.14
  (allowlist §14.14.1; measured evidence §14.14.4); board summary §1.6.
- Matching register entries: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §4.2 row 12 and §9.
- Preconditions satisfied against: `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md` §5
  (item 1 — this grant; item 2 — §2.2; item 3 — §1 disposition table; item 4 — §5.4).
- Prior dated records of the pause and disposition: board §1.3/§1.5/§14.11/§14.13; register
  §6/§8.
