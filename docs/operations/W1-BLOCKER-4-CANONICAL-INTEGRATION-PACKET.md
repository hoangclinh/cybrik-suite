# W1 blocker-4 — canonical integration and CI activation Founder decision packet

Status: `SUPERSEDED FOR SUITE W1 CONTRACT/CONTROL INTEGRATION — HISTORICAL PACKET`.

Current Suite W1 lifecycle:
`CANONICAL-INTEGRATED — STATIC CONTRACT AND CONTROL EVIDENCE ONLY`.
GitHub PR #1 merged the reviewed reconciliation and CI activation line at
`28c564eb9b6853b73a18a59a2e84ba58fd67816a`. Therefore no W1-C1, W1-C2, W1-G1, CONTROL9 or CI3
replay/cherry-pick remains. The packet below is retained as dated topology and decision provenance;
its forward-looking Founder-ballot, GitHub Free, no-protection, no-push and no-canonical-integration
claims are superseded. Product-runtime integration, G-C `stable-v1.0`, UAT and production remain
outside this correction.

Task: **W0-D04**, sub-lanes **W1-D04B** and **W1-D04C**. Originally authored 2026-07-27 in control
worktree `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-d04-founder-gate-repair-r1` at
control `HEAD` `a3e8cba906a1a25298e991954778cb06d4e03e18`, on the **W0-IR14** lane decision, and
committed at `8fe4cb02e0119224205a86631db7c481f7638c23`. **Immutable control base for every §2
figure below: `8fe4cb02e0119224205a86631db7c481f7638c23`** — that commit is the **base/parent of
this Lane 5 record, not its tip**. §2 was re-measured live and read-only at that base on 2026-07-28
(§2.8, §2.10, board §14.35).

**This packet is documentation only.** It opens no product, integration, push or CI writer. It
authorizes no push, fetch, ref mutation, merge, pull request, release, remote configuration change,
repository-settings change, plan or purchase change, dependency install or formatter run. It closes
**no** blocker and promotes **no** gate. It asks the Founder for a decision; it does not take one.

Every local topology figure below was **re-measured live and read-only in this session** before any
prose was written. Hosted figures are **cited from the W0-IR01B audit** and labelled as such; one
hosted ref was independently re-confirmed by a read-only `GET` because this session's local
measurement surfaced a fact W0-IR01B's per-repo summary does not state (§3.6).

**Correction status — read this before §3.9, §5, §6, §7 or §8.** This packet was committed at
`8fe4cb02e0119224205a86631db7c481f7638c23` and then independently reviewed (**W0-R06L**), which
returned **commit-audit integrity `PASS` but packet verdict `NO-GO` on a P1**. The original §3.9
called the gitleaks verdict on SOC tip `74f9774` *"unmeasurable without a push or a forbidden local
install"*. **That was false.** `gitleaks 8.30.1` had been on `PATH` at `/opt/homebrew/bin/gitleaks`
since long before this lane, so the repository's own RUN-IF-PRESENT / NO-INSTALL rule made the scan
available all along. A read-only local scan (**W0-S01B**) has since measured it: **exit 2, five
findings.** §3.9 is replaced below with that measurement, and the dependent statements in §5A, §5B,
§5C, §6, §7.2, §7.3 and §8 are corrected with it. **The packet remains
`PROPOSED — FOUNDER DECISION REQUIRED` and must not be used as the Founder's decision basis until a
fresh independent review of these corrected bytes returns PASS with no P0–P2 finding.** Provenance
for both the review and the scan: §10.

---

## 1. What this packet is for

Live-shadow **blocker 4** has been carried on the board as "dirty canonical roots / unintegrated
local work". That framing is **wrong in a way that has materially inflated the perceived cost of
the decision**, and correcting it is the first purpose of this packet (§4).

The second purpose is to put the **hosted reality** in front of the Founder: the four `origin`
repositories **structurally cannot carry branch protection or required status checks today**,
because they are private repositories on **GitHub Free** and every protection and ruleset endpoint
is plan-gated (§3). "Protect `main` first, then push" is therefore **not an available engineering
step**. It is a purchase decision. That is the fact the decision turns on.

The third purpose is to state, without deciding, the option space (§5), a recommendation (§6), and
a proposed execution sequence that would only become live **after** a future explicit Founder
decision (§7), together with the NO-GO conditions that survive any option (§8).

---

## 2. Measured local topology

### 2.1 Measurement basis

All figures in §2 come from read-only `git` inspection (`rev-parse`, `rev-list --left-right
--count`, `merge-base`, `merge-base --is-ancestor`, `diff --name-only`, `status --porcelain`,
`worktree list`, `for-each-ref`) executed in this session on 2026-07-27. **No `fetch` was
performed, the measurement mutated no ref in any repository, and no product repository ref was
mutated at any point.** Remote-tracking refs are therefore last-fetched state; where
that distinction matters it is called out explicitly (§2.6, §3.6).

Repository roots are distinct and were never conflated:

| Repository | Canonical root | Root `HEAD` branch | Root `HEAD` | Root dirty entries |
|---|---|---|---|---|
| `cybrik-suite` | `/Users/hoanglinh/Claude/Projects/cybrik-suite` | `codex/w2i-ai-inference-transport` | `55e94c2` | **70** |
| `cybrik-soc-command-center` | `/Users/hoanglinh/Claude/Projects/cybrik-soc-command-center` | `codex/w2j-org-assets-vertical` | `1b6671c` | **24** |
| `cybrik-cyber-ai-platform` | `/Users/hoanglinh/Claude/Projects/cybrik-cyber-ai-platform` | `codex/w2h-service-delegation-ai` | `281b252` | **22** |
| `cybrik-security-tool-fabric` | `/Users/hoanglinh/Claude/Projects/cybrik-security-tool-fabric` | `codex/w2h-auth-org-conformance` | `3292a65` | **26** |

Control work happens in a **separate worktree**, not in the Suite canonical root. This record is
authored in a **fresh** control worktree, `codex/w1-control-reconcile-l5-r1`, created on 2026-07-28
at the immutable base `8fe4cb0` and carrying **exactly the five allowlisted control paths, zero
staged, zero untracked, and no quarantined roadmap copy** — `docs/strategy/06-ROADMAP-2026-2029.md`
is byte-identical to its committed blob `1b81e225288b075e8ded993a9c7f548103a85e8f` there and was
never copied into it. The originating worktree `codex/w1-d04-founder-gate-repair-r1` remains at
`8fe4cb0` and, **re-measured at the W1-D04C hard stop, carries exactly six dirty paths**: the **five** paths of the W1-D04C write
allowlist (this packet, `docs/operations/W1-48-AGENT-ROLLING-BOARD.md`,
`docs/operations/W1-E2-EVIDENCE-REGISTER.md`, `tools/operations/validate-w1-control.mjs` and
`tools/operations/tests/validate-w1-control.test.mjs`) plus
`docs/strategy/06-ROADMAP-2026-2029.md`, quarantined at `git hash-object`
`4ed13159a7afc104694dea8b2f2773003cdf8831`, never read for content, never edited, never staged.
Zero staged, zero untracked, no seventh entry. The earlier "exactly one dirty path" figure was true
at `a3e8cba` and is dated history.

`cybrik-suite` "dirty = 70" counts `git status --porcelain` entries after de-duplication,
re-measured on 2026-07-28; **6 of those 70 are untracked directory entries** (`.claude/worktrees/`, `contracts/examples/transport/`,
`docs/evaluation/aisoc-baseline/`, `docs/evaluation/aisoc-comparator/`, `tools/evaluation/`,
`tools/operations/`) which git collapses rather than expanding to files. The true file count behind
those six is larger and was not enumerated; **70 is a lower bound on files, an exact count of
porcelain entries.** The earlier **68** is the 2026-07-27 reading and is dated history.

### 2.2 Local canonical `HEAD` vs live `origin/main` — the distinction that matters

Two different things are called "main" in casual discussion. They are separated here:

| Repository | Local `main` | Local `origin/main` (last-fetched) | Live `main` per W0-IR01B `GET /branches` | Agree? |
|---|---|---|---|---|
| `cybrik-suite` | `5a4823f06ce9b12083e13cf9b1031f46130d90a8` | `5a4823f0…` | `5a4823f0` | yes |
| `cybrik-soc-command-center` | `267c698ac583bd753d0c05edb0210c0e97492d1d` | `267c698a…` | `267c698a` | yes |
| `cybrik-cyber-ai-platform` | `2635485e8e39aaef0d38fd2adadf5503591b07d1` | `2635485e…` | `2635485e` | yes |
| `cybrik-security-tool-fabric` | `beb01d7f914e6649f23fe049c608ef2524413593` | `beb01d7f…` | `beb01d7f` | yes |

Separately, **no canonical root is checked out on `main` in any of the four repositories** (§2.1).
Each root sits on a W2-wave `codex/*` branch carrying substantial uncommitted work. "The canonical
root is dirty" is therefore true, but it is a statement about **W2-wave working state**, not about
the W1 lane branches — which live in their own clean worktrees (§2.7).

### 2.3 `cybrik-soc-command-center` — strict fast-forward chain, one line

Measured `merge-base main <tip>` = `267c698a` and `merge-base --is-ancestor main <tip>` = true for
every W1 branch; `rev-list --left-right --count main...<tip>` = `0/N` for every one, i.e. **zero
behind**. Full pairwise ancestry was computed and is totally ordered:

```
267c698 (main)
  └─ 6fe0c46  codex/w1-d02-soc-pg-evidence-r1          main+38
       └─ 87e95cd  codex/w1-i03-marking-floor-r1        main+44
            └─ f4d234b  codex/w1-i03-soc-context-runtime-r1   main+46
                 └─ 6464cfb  codex/w1-i03b-route-db-permanence-r1  main+47
                      └─ 74f9774  codex/w1-i04a-shadow-remote-r1   main+48
                           └─ 5da251d  codex/w1-soc-vendor-c1r-r1  main+49   ← tip
```

Re-measured 2026-07-28: the SOC lane extended by one commit, `5da251d` — the **vendor conformance
commit**, local-only, integrated nowhere (§2.10). The tip is now `5da251d` at `main+49`.

Every one of the ten ordered pairs satisfies `merge-base --is-ancestor`. **There is exactly one
line and no divergence.** Publishing the tip `74f9774` publishes all five branches' content.

- Paths changed `main..74f9774`: **236**.
- Canonical-root dirty entries: **24**. **Intersection: 10** —
  `README.md`, `docs/CONTINUITY-HANDOFF.md`,
  `docs/architecture/ARCHITECTURE-ASSESSMENT-2026-07.md`,
  `docs/architecture/ARCHITECTURE-OVERVIEW-2026-07.md`,
  `docs/architecture/CYBER-AI-ADAPTER-W2E.md`,
  `docs/operations/RUNBOOK-S16-LAKE-DUAL-WRITE.md`,
  `docs/operations/S16-2-ACTIVATION-READINESS-PACKET.md`,
  `docs/planning/MASTER-PLAN-V2.md`, `docs/planning/PRODUCT-ROADMAP-TO-FINAL.md`,
  `docs/planning/S16-PLAN.md`.

That intersection is a **checkout-collision** figure, not a push figure. Pushing a branch from its
own clean worktree does not touch the canonical root and is unaffected by those 24 dirty files. The
intersection matters only if someone tries to switch the canonical root onto a W1 branch — which
this packet does not propose and which §8 forbids.

### 2.4 `cybrik-cyber-ai-platform` — strict fast-forward chain, one line

Same method; the full pairwise merge-base matrix was computed:

```
2635485 (main)
  └─ c9530b9  codex/w1-i05-orchestration-foundation-r1   main+16
       └─ 42133a5  codex/w1-i06-relying-correlation-r1    main+18
            └─ de41faa  codex/w1-i06c-http-ingress-r1     main+21
                 └─ 866b7db  codex/w1-i06c-http-gate-r1   main+22
                      └─ 2baba72  codex/w1-i06c-http-ingress-r2  main+23  ← tip
```

Confirming pairs: `merge-base(de41faa, 866b7db)` = `de41faa` with `L/R = 0/1`;
`merge-base(866b7db, 2baba72)` = `866b7db` with `L/R = 0/1`. **One line, zero divergence, zero
behind.**

- Paths changed `main..2baba72`: **181**.
- Canonical-root dirty entries: **22**. **Intersection: 16**, including
  **`.github/workflows/ci.yml`** — the CI definition itself is dirty in the canonical root.
  Others: `AGENTS.md`, `README.md`, `docs/README.md`,
  `docs/adr/ADR-0002-local-model-runtime-abstraction.md`, `docs/adr/README.md`,
  `docs/architecture/MODEL-RUNTIME-PORT.md`, `docs/architecture/README.md`,
  `docs/architecture/SKELETON-SCOPE.md`, `docs/contracts/README.md`,
  `docs/operations/README.md`, `docs/operations/SLICE-1-MODEL-RUNTIME-EXECUTION-PACKET.md`,
  `packages/ai-core/src/cybrik_ai_core/__init__.py`,
  `services/ai-api/src/cybrik_ai_api/__init__.py`, `tests/ai_api/test_stub_adapter.py`,
  `tests/ai_core/test_resilience.py`.

### 2.5 `cybrik-security-tool-fabric` — strict fast-forward chain, one line

```
beb01d7 (main)
  └─ 6f72616  codex/w1-fab-c0-provenance-r1        main+10
       └─ d38f910  codex/w1-i07-fabric-r0-domain-r1  main+13
            └─ 37d9b329  codex/w1-fabric-vendor-c1g1-r1  main+14  ← tip
```

Re-measured 2026-07-28: the Fabric lane extended by one commit, `37d9b329` — the **vendor
conformance commit**, local-only, integrated nowhere (§2.10). The tip is now `37d9b329` at
`main+14`.

`merge-base(6f72616, d38f910)` = `6f72616`, `L/R = 0/3`. **One line, zero divergence, zero behind.**

- Paths changed `main..d38f910`: **118**.
- Canonical-root dirty entries: **26**. **Intersection: 10**, including
  **`.github/workflows/ci.yml`**; also `CLAUDE.md`, `README.md`, `docs/adr/README.md`,
  `docs/contracts/README.md`, `docs/operations/README.md`,
  `docs/operations/WAVE-1-CONTRACT-CONFORMANCE-PACKET.md`,
  `src/control-plane/cybrik_fabric_control/contracts/loader.py`, `tests/README.md`,
  `tests/conformance/README.md`.

### 2.6 `cybrik-suite` — **three genuinely divergent lines**, one shared fork point

This is the only repository in the suite where the W1 work is not a single line. Every W1 branch is
individually a clean fast-forward from `main` (`merge-base main <tip>` = `5a4823f`, `0` behind),
but **the branches diverge from each other.** The shared trunk and the fork point:

```
5a4823f (main = origin/main)
  └─ 55e94c2  codex/w1-b05-w2i-adr-correction-r1   main+13   (trunk, ancestor of all three lines)
       └─ 3ef8e05  codex/w0-t10-offline-harness-r1  main+15   ← FORK POINT
            ├─ LINE 1  8fe4cb0  codex/w1-d04-founder-gate-repair-r1        fork+23, main+38
            ├─ LINE 2  3a2c715  codex/w1-i01-alert-context-proposal-r1     fork+1,  main+16
            │            └─ 4d5fb4b  codex/w1-i01-alert-context-transport-binding-r1  fork+2, main+17
            │                 └─ a976a20  codex/w1-c1-transport-acceptance-r1          fork+3, main+18
            │                      └─ 20cfa36  codex/w1-c1-correction-a2-r1            fork+4, main+19
            │                           └─ 7185739  codex/w1-g1-c1-repin-r1            fork+5, main+20  ← LINE 2 tip
            └─ LINE 3  ed95e51  codex/w1-i02-investigation-lifecycle-proposal-r1  fork+1, main+16  ← LINE 3 tip
```

The pairwise matrix confirms exactly three lines, all meeting at `3ef8e05`:

| Pair | `merge-base` | `L/R` (ahead each side) |
|---|---|---|
| LINE 1 `8fe4cb0` ↔ LINE 2 `7185739` | `3ef8e05` | 23 / 5 |
| LINE 1 `8fe4cb0` ↔ LINE 3 `ed95e51` | `3ef8e05` | 23 / 1 |
| LINE 2 `7185739` ↔ LINE 3 `ed95e51` | `3ef8e05` | 5 / 1 |

**Delta against the W0-R06L audit, disclosed.** That review independently re-derived this matrix at
LINE 1 = `a3e8cba` and measured `22/3`, `22/1`, `3/1` with path counts `32/35/32` over 99. Both
readings are correct: LINE 1 advanced by exactly one commit — `8fe4cb0`, which added this packet —
so LINE 1 gains one commit and one path. The audit's figures are **not withdrawn**; they are the
same measurement one commit earlier.

Within LINE 2 the five commits are totally ordered `3a2c715` → `4d5fb4b` → `a976a20` → `20cfa36`
→ `7185739`; the two new nodes are the W1-C1 and W1-G1 corrections, both local-only and integrated
nowhere (§2.10). `55e94c2` and `3ef8e05` are
ancestors of all three lines and are therefore **not** a fourth line.

The two contract commits recorded by the validator match this exactly: `w1C1` `3a2c715…` and
`w1C2` `ed95e51…`, **both parented on `3ef8e05…`** — that shared parent *is* the fork point.

**Path-collision measurement between the three lines — the decisive figure:**

| Line | Paths vs fork `3ef8e05` |
|---|---|
| LINE 1 (`8fe4cb0`, control/docs) | 33 |
| LINE 2 (`a976a20`, C1 / alert-context transport) | 35 |
| LINE 3 (`ed95e51`, C2 / investigation lifecycle) | 32 |

| Overlap | Count |
|---|---|
| LINE 1 ∩ LINE 2 | **0** |
| LINE 1 ∩ LINE 3 | **0** |
| LINE 2 ∩ LINE 3 | **0** |

**The three lines are completely path-disjoint** across all 100 changed paths. A three-way
integration of them is therefore expected to be **textually conflict-free**. That is a measured
property of the current tips, and it is the single strongest argument that the Suite integration is
tractable. It is **not** a claim that the integration is semantically trivial — see §4.3.

**Dirty-path intersection with the Suite canonical root (68 entries):**

| Line | ∩ canonical-root dirty |
|---|---|
| LINE 1 (`8fe4cb0`) | **9** |
| LINE 2 (`a976a20`) | **0** |
| LINE 3 (`ed95e51`) | **0** |

LINE 1's nine: `README.md`, `docs/README.md`, `docs/adr/ADR-DECISION-SPRINT-2026-07.md`,
`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md`, `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md`,
`docs/adr/README.md`, `docs/operations/README.md`,
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md`, `docs/operations/W1-E2-EVIDENCE-REGISTER.md`.
The last two are **tracked on LINE 1 but untracked in the canonical root** — a checkout onto LINE 1
in the canonical root would refuse or clobber. Again: this constrains *checkout*, not *push*.

### 2.7 W1 lane worktrees — where the work actually is

**Twenty-two** W1 worktrees exist under `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/`,
re-measured read-only on 2026-07-28 after this record's own worktree was created. **Fifteen are
completely clean; seven are not:**

| Worktree | Branch | `HEAD` | Dirty |
|---|---|---|---|
| `w1-i01-alert-context-proposal-r1` | `codex/w1-i01-alert-context-proposal-r1` | `3a2c715` | **16** — the **superseded** W0-I01C overlay; its content is now committed at `20cfa36` (§2.10) and this dirty tree is no longer the authoritative copy |
| `w1-i03-marking-floor-r1` | `codex/w1-i03-marking-floor-r1` | `87e95cd` | **9** |
| `w1-b05-w2i-adr-correction-r1` | `codex/w1-b05-w2i-adr-correction-r1` | `55e94c2` | **8** |
| `w1-d04-founder-gate-repair-r1` | `codex/w1-d04-founder-gate-repair-r1` | `8fe4cb0` | **6** (five W1-D04C paths + quarantined roadmap) |
| `w1-control-reconcile-l5-r1` | `codex/w1-control-reconcile-l5-r1` | `8fe4cb0` | **5** — this record's own worktree: the five allowlisted control paths only, **no quarantined roadmap copy**, zero staged, zero untracked |
| `w1-d02-soc-pg-evidence-r1` | `codex/w1-d02-soc-pg-evidence-r1` | `6fe0c46` | **3** |
| `w1-fab-c0-provenance-r1` | `codex/w1-fab-c0-provenance-r1` | `6f72616` | **2** |
| the other 15 | — | — | **0** |

**Authoritative versus superseded, stated once.** The authoritative W1-C1 correction is the **commit
`20cfa36`** in the clean worktree `w1-c1-correction-a2-r1`. The 16 dirty paths still sitting in
`w1-i01-alert-context-proposal-r1` are the **pre-commit overlay** those same bytes came from; they
are dated evidence, not a second live candidate, and nothing may be cited from them in preference to
the commit. The three worktrees holding the other Lane 5 commits — `w1-g1-c1-repin-r1` (`7185739`),
`w1-soc-vendor-c1r-r1` (`5da251d`) and `w1-fabric-vendor-c1g1-r1` (`37d9b329`) — are **all clean**.
The earlier "seventeen worktrees / twelve clean / five dirty" figures are the 2026-07-27 reading and
are dated history.

The `w1-i01-alert-context-proposal-r1` row was measured by `git status --porcelain`, `git diff
--cached --name-only` and `git ls-files --others` only — **16 modified tracked entries, zero staged,
zero untracked, `HEAD` equal to the base**. No file in that worktree was read, edited or staged.

Critically, **every branch tip this packet would propose publishing still sits in a clean worktree**:
`w1-i04a-shadow-remote-r1` (0), `w1-i06c-http-ingress-r2` (0), `w1-i07-fabric-r0-domain-r1` (0),
`w1-c1-transport-acceptance-r1` (0), `w1-i02-investigation-lifecycle-proposal-r1` (0). LINE 1's
worktree carries only unstaged control-document work, which would not be pushed. The earlier
"thirteen clean / four dirty / LINE 1 dirty = 1" figures were true at `a3e8cba` and are dated
history.

Note: `codex/w1-i05-orchestration-foundation-r1` exists as a branch but has **no** worktree under
`w1-48`; it is an interior commit of the Cyber AI chain and needs no separate publication.

### 2.8 What a push would actually add — new objects, not total ahead-counts

"Ahead of `main`" overstates blast radius, because some of this history is **already hosted**.
Measured with `git rev-list --count <tip> --not --remotes`:

| Repository | Proposed tip | Ahead of `main` | **Commits not on any remote-tracking ref** |
|---|---|---|---|
| SOC | `5da251d` | 49 | **11** |
| Cyber AI | `2baba72` | 23 | **12** |
| Fabric | `37d9b329` | 14 | **5** |
| Suite LINE 1 | `8fe4cb0` | 38 | **25** |
| Suite LINE 2 | `7185739` | 20 | **7** |
| Suite LINE 3 | `ed95e51` | 16 | **3** |

**63** is the **sum of the six per-line counts above**, not a unique union: it double-counts the
commits the three Suite lines share ahead of their common fork point. Independently measured this
session, read-only, the **unique union** across all six candidate refs is **59**.
`git rev-list --count 8fe4cb0 7185739 ed95e51 --not --remotes` returns **31** for the three Suite
lines taken together, against a per-line sum of 35; SOC, Cyber AI and Fabric are single-ref counts
in three separate repositories, so 11 + 12 + 5 + 31 = **59**.

Every figure above was re-measured live and read-only on 2026-07-28. Four local-only commits moved
these counts since the 2026-07-27 reading — the W1-C1 and W1-G1 corrections on Suite LINE 2 and the
SOC and Fabric vendor conformance commits — and each is recorded in §2.10. The earlier **59** /
**55** pair and the `a3e8cba` **24** / **58** pair are dated history, not withdrawals; **no
topology above changed shape**, only its counts.

**Base-plus-one disclosure — read with §7.1.** Every figure in the table above is measured at the
immutable base `8fe4cb0`, which is the **parent of this Lane 5 record, not its current tip**. The
measured Suite LINE 1 count at that base is **25**; this record adds exactly **+1** commit of its
own, so the live count after it is committed becomes **26**. That **26** is a
**prediction, not a measurement**.
**No commit SHA, tree or content aggregate for this record is stated or predicted anywhere in this
corpus** — a commit cannot contain its own identity. A fresh external `git rev-list --count`
re-confirmation is **mandatory before any push**.

Predicted after this record is committed, by the base-plus-one rule and by nothing measured:
per-line sum **64**, unique union **60**, Suite LINE 1 not-on-any-remote **26**. All three are
**derived, not measured**, and must be re-measured externally before any of them is used.

### 2.9 Dual-state W1-C1 provenance — the accepted baseline, and the correction committed on it

The W1-C1 lane carries **two disjoint states**, and conflating them is the failure mode this section
exists to prevent.

**State 1 — the accepted baseline, unchanged.** Commit
`3a2c71555a423465855ffaddcb663c8b704dbfbd` on `codex/w1-i01-alert-context-proposal-r1`, parent
`3ef8e05`, member set
`sha256:e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35`
(`MEMBER-SET-SHA256/v1`, 13/13), exactly 16 paths, lifecycle
`ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`. It is byte-for-byte what the W1-C1/C2
contract gate accepted on 2026-07-26, it is not reinterpreted here, and it remains the only accepted
W1-C1 artifact.

**State 2 — the W0-I01C correction, committed local-only.** A commit on that same base:
`CORRECTION COMMITTED — LOCAL-ONLY — NOT INTEGRATED — NOT ACCEPTED`, landed as `20cfa36` on
`codex/w1-c1-correction-a2-r1`, exactly 16 paths and zero staged, candidate `member_set`
`sha256:27a6bdeb…` (`MEMBER-SET-SHA256/v1`, 13/13, `member_count` 13), candidate suite 21/21, 86.99%
branch coverage against the declared 80% floor, independent review `PASS` with no open P0–P2. **It
is committed and it is still not accepted** — those are independent axes. It is integrated nowhere,
pushed nowhere, and this packet does not accept it. Full identity: §2.10.

The commit graph is **extended, not rewritten**: LINE 2 remains totally ordered
`3a2c715` → `4d5fb4b` → `a976a20` → `20cfa36` → `7185739`. The W1-C1 correction is the node
`20cfa36` and the W1-G1 correction the node `7185739`; both are **local-only and integrated
nowhere**, and neither is accepted by any contract gate.

**No successor SHA is predicted, reserved or placeholdered anywhere in this corpus.** Both
correction identities below were **measured after their commits existed**, never minted in advance,
and this record states no identity of its own.

**The separate 16-path aggregate, and exactly what it is.**
`76ef51d97dced58eda98b1144ca72f98cf81c7caff6cc51ffc3eab50114c940a` is the **pre-commit
working-tree aggregate** measured on 2026-07-27 and nothing else. It is **not** a member-set
digest, **not** a commit identity, and **not** part of the accepted C1 artifact recipe. The
coordinator reproduced it as SHA-256 over, for each of the 16 modified tracked paths in sorted
relative-path order, the relative path bytes, a NUL byte, the file bytes, and a NUL byte. Those
same 16 paths are now the content of commit `20cfa36`, so the figure is dated pre-commit
evidence that is reproducible from that commit rather than a superseded one.

That recipe is **different** from `MEMBER-SET-SHA256/v1`, which is what both the accepted
`e4cfbf8c…` and the candidate `27a6bdeb…` use. The two must never be compared, substituted or
presented as versions of one another.

**Downstream consequence.** The alert-context transport binding at `4d5fb4b` and its acceptance at
`a976a20` still record `source_member_set_digest` `e4cfbf8c…`, so the transport validator fails
closed against the corrected bytes. The W1-G1 correction `7185739` repins that lane's own record
and is likewise local-only; it does **not** clear this lock and grants no remediation authority. The fixture measurement below is read-only over
`contracts/examples/alert-context-transport/` at `a976a20`.

The transport examples manifest declares **13** fixtures; **11** of them carry
`include_descendants` across **17** occurrences, every one `false`. The `approval-required` and
`kill-switch-denied` fixtures omit the field and **no fixture sets it `true`** — so the pin is
**provenance-stale, not semantically broken**.

Board §14.32.3 carries the full disclosure and the limit on the distinct **W0-B05** lane. This
packet neither clears that lock nor grants any remediation authority over it.

### 2.10 Local-only reviewed provenance — four commits, none integrated

Four reviewed commits exist **locally and nowhere else**. Each was verified read-only against its
own repository on 2026-07-28: commit, parent, tree and exact path count. **None appears on any
remote-tracking ref** — `git branch -r --contains` returns nothing for all four. This section is the
only place in this packet where their full identities appear; §2.9, §4.4 and board §14.32.2 keep
their narrow allowlist and name none of them.

| Lane | Local-only commit | Scope and content evidence | Status |
|---|---|---|---|
| W1-C1 correction | `20cfa36c503e5a95341c80653d25d2000d65c9fe`, parent `a976a205601de22dae59e5112e37ae29707fda0e`, tree `380a8f77e65b0980d561a94e3615b49bc0e76921` | exactly 16 paths; manifest `403f7b0df42b9c0768f048bb71dedeebdd3f930d9a39dcf4ac935335b85b7d2e`; `MEMBER-SET-SHA256/v1` `27a6bdeb168599dc4fd05e27f06785315a3b763647826559efe9d721bc0292c8`, `member_count` 13; pre-commit working-tree aggregate `76ef51d9…`, full value and recipe in §2.9 | `LOCAL-ONLY` · `INDEPENDENT REVIEW PASS` · `NOT INTEGRATED` · `NOT PUSHED/MERGED/RELEASED`; not contract-reaccepted — the accepted W1-C1 baseline `3a2c715…` / `e4cfbf8c…` is unchanged |
| W1-G1 correction | `71857395332fabe041896ca0700fbf7a2bf612d3`, parent `20cfa36c503e5a95341c80653d25d2000d65c9fe`, tree `96a4ecceb054292b1272b7fd38adc6ce7c1ae7f3` | exactly 9 paths; manifest `35e767513267bb5ee88a933ab6faf4526162b34dff13460cd3c5a14e6825fbf0`; `MEMBER-SET-SHA256/v1` `a285fa8e4850999dc013b03506ed1e62f5c7bb4209d198a4e16fa02c446b43f4`, `member_count` 15; content aggregate `54e90e27b546e569156c13c3f7455bd99e1a5168e7e62b139422c5fed95e50cc` | `LOCAL-ONLY` · `INDEPENDENT REVIEW PASS` · `NOT INTEGRATED` · `NOT PUSHED/MERGED/RELEASED`; the accepted W1-G1 baseline is unchanged |
| SOC vendor conformance | `5da251d92e66968103db4df9d544e2a1f3597b58`, parent `74f9774bfb5a6816cd9f0ddc230673a181a4cfd6`, tree `2534201c823c5bde582d1595eea6e22622d6b910` | exactly 16 paths; content aggregate `be19bad6d1c6e14edb4e3a5a810806a3670124cb442808abe87a977cc612cfd3`; post-review `PASS` | `LOCAL-ONLY` · `INDEPENDENT REVIEW PASS` · `NOT INTEGRATED` · `NOT PUSHED/MERGED/RELEASED` · `CONFORMANCE-ONLY`; the inherited gitleaks red stands and the SOC push remains `NO-GO` |
| Fabric vendor conformance | `37d9b3293d26502fcd5be8144dbee78a98067043`, parent `d38f910a44d6454285b393cb89df4a6ade4eb855`, tree `6c118efd9f1dfc447eae1efb16194261850274e9` | exactly 32 paths; content aggregate `428a7a9b6cb06ed44469e148041ad56b58949a25cd01fb0ef617eb524ac0a44e`; 403 tests; post-review `PASS` | `LOCAL-ONLY` · `INDEPENDENT REVIEW PASS` · `NOT INTEGRATED` · `NOT PUSHED/MERGED/RELEASED` · `CONFORMANCE-ONLY`; no runtime and no vendor-parity claim |

**What this table does and does not say.**

- **Committed is not accepted, and committed is not integrated.** All four are real commits. None is
  accepted by any contract gate, none is integrated into any line other than its own, none is
  pushed, merged or released, and none is on GitHub.
- **The two vendor commits are conformance-only.** They record contract conformance against reviewed
  bytes. They are **not** runtime evidence, **not** a vendor-parity claim, and they close nothing.
  SOC additionally inherits the measured `secret-scan` red of §3.9, so its push stays `NO-GO` under
  every option (NO-GO 11).
- **No aggregate here is a member set and no member set here is a commit identity.** Each manifest,
  member set and content aggregate belongs to exactly one lane row and may never be read against
  another. The W1-C1 `member_set` is `27a6bdeb…` over 13 members; the W1-G1 `member_set` is
  `a285fa8e…` over 15. They are different recipes over different files and are never interchangeable.
- **No identity is stated for this record itself.** A commit cannot contain its own SHA, tree or
  content aggregate. This lane publishes its measurement recipe and re-measures externally after the
  commit exists; it predicts nothing about itself.

---

## 3. Hosted state

§3.1–§3.5 and §3.7–§3.9 are **cited from the W0-IR01B hosted audit** (read-only `gh api` GETs,
transcript
`/Users/hoanglinh/.claude/projects/-Users-hoanglinh-Claude-Projects-cybrik-worktrees-w1-48-w1-d04-founder-gate-repair-r1/4c95f825-f39d-48d9-9eef-2272b6ca0bb5.jsonl`).
They are reproduced here as **cited hosted findings, not re-verified in this session**, except
§3.6 which this session re-confirmed by an independent read-only `GET`. No token value was ever
displayed or recorded.

### 3.1 Ownership, plan, access

All four repositories are **private**, **user-owned** by `hoangclinh` (`gh api user` →
`"type":"User"`), default branch `main`, not forks, not archived, not disabled. The audit held
**`permissions.admin = true` on all four** — so every 403 below is a **plan limitation, not an
access gap**.

The plan is **GitHub Free**. The audit's `gh api user` returned `"plan": null` at the token's
scope, so the plan name is not read directly from that field; it is established by the **error body
GitHub itself returns** on the protection endpoints (§3.2), which names the required upgrade.

### 3.2 Branch protection and rulesets — plan-gated, and the honest status of each

Twelve calls, three per repository, **all HTTP 403 with an identical body**:

```
GET repos/hoangclinh/{repo}/branches/main/protection  → 403
GET repos/hoangclinh/{repo}/rules/branches/main       → 403
GET repos/hoangclinh/{repo}/rulesets                  → 403
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature."}
```

Independent corroboration through a field that **is** readable: `GET /branches?per_page=100`
returns **`"protected": false` on all 25 branches across all four repositories, including every
`main`.**

| Control | Status | Basis |
|---|---|---|
| Branch protection on `main` | **not configured** | 403 plan-gated **and** `protected=false` on every branch |
| Protection on `codex/**` | **not configured** | same |
| Required PR reviews | **not configured** | requires protection |
| Required status checks | **not configured — zero** | requires protection |
| Linear history / signed commits | **not configured** | requires protection |
| Force-push / deletion restrictions | **not configured** | requires protection |
| **Rulesets** | **NOT VISIBLE (403). Inferred absent — NOT verified absent** | endpoint plan-gated; rulesets on private repos also require Pro. Residual uncertainty low but **non-zero**; the `protected=false` signal covers legacy protection, **not** rulesets specifically |
| Ruleset bypass actors | **not visible** (403) | same |
| Org-level rulesets | **N/A** | repositories are user-owned, not org-owned |

**This packet does not assert that rulesets are verified absent.** That distinction is load-bearing
and is repeated as a NO-GO condition in §8.

**Governing consequence: there is no server-side control of any kind on any branch of any of the
four repositories — `main` included — and none can be created while they remain private on the
current plan.** Any push's safety rests entirely on operator discipline and refspec correctness.

### 3.3 Actions configuration

`GET actions/permissions` → 200, identical on all four: `{"enabled":true,
"allowed_actions":"all","sha_pinning_required":false}`. `GET actions/permissions/workflow` → 200,
identical: `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}`.

**Environments: 0. Actions secrets: 0. Actions variables: 0.** All four repositories.

### 3.4 Workflow triggers — and why a `codex` push is not inert

Workflow bytes present on the **remote default branch**: SOC `main` carries
`.github/workflows/ci.yml` (blob `f52802b0`, 11196 B); **Cyber AI, Fabric and Suite `main` carry no
`.github/` at all** (contents → 404).

That does not make a push inert: for `push` events GitHub evaluates the workflow file **on the
pushed ref**. Measured triggers on the W1 branch bytes:

| Repository | Workflow blob | `on: push` scope | Push to `codex/w1-*` runs CI? |
|---|---|---|---|
| Suite | `contracts.yml` `f1cf11fb` (3122 B) | bare `push:` → **all branches** | **Yes** |
| SOC | `ci.yml` `48196b4f` / `97724c6f` / `25e22c76` | `branches: [main, "codex/**"]` | **Yes** |
| Cyber AI | `ci.yml` `57595ae4` | `branches: [main, "codex/**"]` | **Yes** |
| Fabric | `ci.yml` `2047a389` | `branches: [main, "codex/**"]` | **Yes** |

For Cyber AI, Fabric and Suite, the first W1 push would also be what introduces CI to that
repository's `main` history **if it were ever merged** — merging is out of scope here.

### 3.5 No automation surface — measured absent

A grep across all 17 W1 worktrees' workflow files for
`workflow_dispatch|merge_group|schedule:|create-pull-request|gh pr |gh release|auto-merge|automerge|deploy|docker/login|docker push|ghcr\.io|npm publish|pypi|twine|packages: write|contents: write|pull-requests: write|id-token: write|secrets\.`
returned **zero hits**. Therefore: no `workflow_dispatch`, no `merge_group`, no `schedule`; no
workflow opens PRs, merges, tags, releases, publishes packages or deploys; no workflow references
any secret; `GITHUB_TOKEN` defaults to **read**; `allow_auto_merge = false` on all four
repositories.

**A push of a W1 `codex` branch triggers CI compute only. It cannot open a PR, merge anything,
mutate `main`, publish or deploy.** This is the principal compensating control against the §3.2
finding.

### 3.6 Remote W1 branches and PRs — with a correction this session measured

W0-IR01B reports **0 remote branches whose name contains `w1`, and 0 pull requests — open, closed
or merged — in any of the four repositories.** Run history (82 SOC / 7 AI / 6 Fabric / 8 Suite) is
`event=push` on `codex/*` branches exclusively; zero `pull_request`, `workflow_dispatch` or
`schedule` events have ever fired.

**That is true by branch name, and it is the right answer to "will a push collide with an existing
ref". It is not the whole picture on content, and this session measured the gap:**

```
git -C cybrik-soc-command-center rev-parse codex/w1-d02-soc-pg-evidence-r1 \
                                           origin/codex/w2j-org-assets-vertical
→ 6fe0c46b7b0d416d22c6cf2b681fe4a0e9b8bbf5   (both)

gh api repos/hoangclinh/cybrik-soc-command-center/git/ref/heads/codex/w2j-org-assets-vertical
→ refs/heads/codex/w2j-org-assets-vertical 6fe0c46b7b0d416d22c6cf2b681fe4a0e9b8bbf5   (live, read-only GET)
```

**The SOC `w1-d02` lane tip is byte-identical to a ref that is already hosted**, under the
W2-wave name `codex/w2j-org-assets-vertical`. Confirmed **live**, not from the possibly-stale
remote-tracking cache. Consequences:

- **38 of SOC's 49 W1 commits are already on GitHub.** Only **11** are new (§2.8).
- The `w1-d02` lane has committed **nothing** of its own yet — its branch tip is an alias for the
  hosted `w2j` tip, and its worktree holds 3 uncommitted files (§2.7).
- The entire SOC W1 chain (`i03-marking` → `i04a`) is built **on top of already-published
  content**, which is why the SOC push is far smaller than "48 commits" suggests.
- This does **not** contradict W0-IR01B; it refines it. No ref named `w1-*` exists remotely, and
  no proposed push would update or force-push an existing ref. Every W1 push still creates a
  **brand-new ref**.

### 3.7 Required checks vs actual check names

**Required checks: zero, all four repositories** (protection unavailable). Every check below is
informational; **none can block anything.** Actual rendered check names from the most recent run
per repository:

| Repository | Rendered check names |
|---|---|
| SOC | `api`, `backup-tool`, `pf-workers`, `web`, `e2e`, `secret-scan`, `dependency-scan`, `sbom` (8) |
| Cyber AI | `scaffold-integrity`, `lockfile-integrity`, `lint`, `type`, `test`, `build-offline`, `secret-scan` (7) |
| Fabric | `scaffold-integrity`, `secret-scan`, `detect`, `control-plane`, `executor` (5) |
| Suite | `secret-scan (gitleaks 8.30.1)`, `contract standards validation` (2) |

**Zero required status checks against 22 actual check instances** — SOC 8 + Cyber AI 7 + Fabric 5 +
Suite 2 — which collapse to **19 distinct rendered names** across the four repositories, because
`secret-scan` recurs in SOC, Cyber AI and Fabric and `scaffold-integrity` recurs in Cyber AI and
Fabric. **The mismatch is total, not partial.** Required checks are configured **per repository and
by rendered name**, so the binding decision uses the rendered names in the table above, not the
22-instance total. Three traps for any future required-check configuration:

1. **Suite check names are not job IDs.** The jobs are `secret-scan` and `contracts`; `name:`
   overrides render them as `secret-scan (gitleaks 8.30.1)` and `contract standards validation`.
   Configuring the job IDs would produce a check that **never matches and never reports**.
2. The Suite name **embeds the gitleaks version** — a gitleaks upgrade silently breaks the binding.
3. **Suppressed jobs must never be listed** — see §3.8.

### 3.8 Suppressed `if: false` jobs — work that produces no CI evidence

| Job | File / line | Present in |
|---|---|---|
| `e2e-org` | SOC `ci.yml:253` — `if: false  # W2-J UI wave RED` | canonical SOC root; blobs `97724c6f`, `25e22c76` |
| `alert-context-route-db` | SOC `ci.yml:418` — `if: false  # STATIC WIRING — NOT WIRED; no CI result claimed (W1-I03B)` | blob `25e22c76` only → worktrees `w1-i03b-route-db-permanence-r1`, `w1-i04a-shadow-remote-r1` |

**A green SOC CI run on `w1-i03b-route-db-permanence-r1` or `w1-i04a-shadow-remote-r1` is not
route-DB evidence.** The job is authored bytes that never execute. Neither name may ever appear in
a required-check list — it would hang forever as "expected but never reported". The job comment is
honest about this and is consistent with `CLAUDE.md` status honesty; the risk is purely that a
green check gets **cited** as evidence it is not.

### 3.9 Secret-scan posture, and the SOC finding this packet now measures

| Repository | Tool + pin | Scope | Fail mode | Config |
|---|---|---|---|---|
| SOC | gitleaks `v8.24.3` via `go install` | `detect --source .`, full history, `fetch-depth: 0` | `--exit-code 2`, fail-closed | `--config .gitleaks.toml` |
| Suite | gitleaks `8.30.1` tarball, **sha256 verified** (`551f6fc8…`) | **two** steps: `gitleaks dir .` **and** `gitleaks git .` | `--exit-code 1`, fail-closed | `--config .gitleaks.toml` |
| Cyber AI | gitleaks `v8.24.3` via `go install` | full history | fail-closed | no `--config`; auto-loads root `.gitleaks.toml` |
| Fabric | gitleaks `v8.24.3` via `go install` | full history | fail-closed | **default ruleset, no repo-local config — by design** (`ci.yml:126`) |

Config presence matches each repository's design in all 17 worktrees; **no missing-config failure
is staged.** Suite is the strictest gate (working-tree **and** full-history scan).

**Measured, not residual — local secret scan of the SOC tip (W0-S01B, 2026-07-27).** An earlier
draft of this section called the gitleaks verdict on `74f9774` *"unmeasurable without a push or a
forbidden local install"*. **That claim was false and is withdrawn** (W0-R06L P1-1, §10). `gitleaks
8.30.1` was already installed at `/opt/homebrew/bin/gitleaks`, so the RUN-IF-PRESENT / NO-INSTALL
rule made the scan available without any install. It has now been run read-only in the clean
`w1-i04a-shadow-remote-r1` worktree at `74f9774` — `git status --porcelain` empty before and after,
no `--report-path`, no ref mutated, nothing installed:

```
gitleaks detect --source . --redact -v --config .gitleaks.toml --exit-code 2 --no-banner
INF 451 commits scanned.
INF scanned ~12230012 bytes (12.23 MB) in 495ms
WRN leaks found: 5
EXIT_CODE=2
```

**Result: exit 2, five findings, every one `RuleID: generic-api-key`, every one under
`services/api/tests/`.** No secret value is reproduced here; the tool returned `Secret` and `Match`
as `REDACTED`.

| # | Commit | File:line | Shape (redacted) |
|---|---|---|---|
| 1 | `ff1aec3` | `services/api/tests/integration/test_alert_context_idempotency_rls.py:46` | module-level synthetic `KEY = "<literal>"` |
| 2 | `ff1aec3` | `services/api/tests/unit/test_alert_context_route.py:37` | same synthetic `KEY` literal (comment: `# >= 16 chars, the accepted packet bound`) |
| 3 | `74f9774` | `services/api/tests/unit/copilot/test_shadow_remote_contract.py:156` | `@pytest.mark.parametrize` **negative-test** `("openapi_sha256", "<64-hex>")` — a deliberately-wrong digest |
| 4 | `74f9774` | `services/api/tests/unit/copilot/test_shadow_remote.py:229` | `"idempotency_key": "<literal>"` in `_create_body()` |
| 5 | `74f9774` | `services/api/tests/unit/copilot/test_shadow_remote.py:248` | `"idempotency_key": "<literal>"` in `_cancel_body()` |

**The original framing of the risk was wrong on both file and mechanism.** The **four SOSIM
fixtures** in `test_shadow_remote_contract.py` — `_status_payload` (L56), `_checkpoint_payload`
(L75), `_bundle_payload` (L96), `_error_payload` (L111) — are **not detected at all.** That file's
single finding (#3) sits at L156, outside all four fixtures, inside
`test_declared_identity_mismatch_is_reported_per_field`; the byte-exact real digest pins at
L128/134/138 were **not** flagged, so the trigger is the `api`-keyword / high-entropy-value adjacency
form, not the digest itself. The two flagged SOSIM-marked builders live in the **sibling** file
`test_shadow_remote.py` and trip on their `idempotency_key` literal, **not** on SOSIM marking.
**Nothing under `services/api/src/` is flagged;** there are zero findings outside `tests/`.

**Push impact — a measured blocker now, not a risk.** All four flagged files are tracked at
`74f9774` and all five flagged lines are live in the working tree, not history-only stragglers.
`ff1aec3` is **not** an ancestor of `main` or `origin/main`, so all five sit inside the unpushed
48-commit range. `.gitleaksignore` — blob `ae460e1ae5b345758380984dec3c82a5ace160e0`, **34 lines /
33 non-empty / 8 actual fingerprint entries**, all of them for `reports/**` and
`apps/soc-portal/e2e/helpers/seedForensics.ts` — **matches none of the five.** That file is still
**not new at `74f9774`**: byte-identical to the copy on live/current `main`, predating these
fixtures, not updated by that commit. SOC `secret-scan` is fail-closed (`--exit-code 2`, no
`continue-on-error`) and rescans the **whole pushed history** each run, so the two `ff1aec3`
findings fail the job even if the push advertises only `74f9774`. **Splitting or reordering commits
does not evade it.** Consequence, and it survives the option choice: **the SOC push (§7.1 row 6) is
`NO-GO` under both Option A and Option B** until these findings are separately remediated or
fingerprint-allowlisted (§8 NO-GO 11).

**Version-skew caveat, load-bearing.** SOC CI pins **`v8.24.3`** (`ci.yml:356`); this measurement
used **`8.30.1`**. `.gitleaks.toml` is `[extend]` with `useDefault = true`, so the
`generic-api-key` regex, keyword list and entropy thresholds come from the **binary's** default
ruleset, which is version-bound and changed across the 8.24 → 8.30 range. **This packet therefore
does not state what `v8.24.3` will report.** The five findings are evidence for `8.30.1` only —
strong local evidence, and explicitly **not** a byte-exact CI reproduction. Settling the pinned
version needs a `v8.24.3` binary, which needs an install grant nobody holds. Command-form skew was
**nil**: `8.30.1` accepted `detect --source` verbatim with no deprecation error, so the local form
differs from CI's only by the deliberately-omitted `--report-format sarif --report-path` (writes)
and the cosmetic `--no-banner`. Incidentally, for **Suite** `8.30.1` is an **exact** match to the
version embedded in its rendered check name (§3.7); the skew is SOC-specific.

**Scope of the measurement.** W0-S01B scanned the **SOC** worktree only. Cyber AI, Fabric and Suite
were **not** locally scanned, and their secret-scan outcome is **unmeasured — not clean.**

**Two remediation routes, recorded and neither granted here.** Both require writes this packet does
not authorize and did not perform:

1. **Remediate in place** — reshape the flagged test literals so the rule stops matching. Cleanest,
   and it keeps `.gitleaksignore` honest. But the two `ff1aec3` findings **cannot** be fixed by
   editing `HEAD` alone: the full-history scan still sees the introducing commit's patch, so this
   route requires **rewriting an unpushed commit**. A history rewrite — *even of unpushed history* —
   is a **separate Founder-grade grant** on its own merits and is not implied by anything here.
2. **Fingerprint-allowlist** — append the five fingerprints to `.gitleaksignore` with written
   justification, matching the existing documented pattern. Faster, but the fingerprints are
   **commit-pinned**: any later rebase or amend of `ff1aec3` or `74f9774` invalidates them and the
   job fails again.

Care note carried from W0-S01B: findings #1, #2, #4 and #5 are arbitrary synthetic literals with no
assertion depending on their bytes, but **#3 sits inside a byte-exactness digest-pinning test**
whose entire purpose is exact bytes — its surrounding assertions must be read before any edit rather
than blind-swapped. Any such work is **test-fixture scope, not product source** (`services/api/src/`
is clean). **This packet grants no product remediation authority of any kind**, and none was
exercised.

### 3.10 Not measured — explicitly

- `security_and_analysis` returned **empty/null** on all four repositories (GitHub omits it for
  private repos without Advanced Security). **Push protection and secret-scanning alert state are
  therefore unknown, not "off".** This matters: CI gitleaks runs **after** objects are already on
  GitHub. It detects; it does not prevent.
- Dependabot alerts / security-update configuration.
- Whether CI would actually **pass** on the unpushed W1 bytes. SOC blobs `97724c6f` (18507 B) and
  `25e22c76` match no pushed blob, so **no run has ever executed these exact bytes.**
- One incidental observation carried forward from W0-IR01B, not resolved here: `cybrik-suite`
  `main` has a **committed `.claude/` directory**. `CLAUDE.md` requires
  `.claude/settings.local.json` to stay gitignored. Its contents were not inspected. Worth separate
  confirmation that only shareable config is tracked; **not** a blocker on this decision.

---

## 4. Correcting the blocker-4 framing

### 4.1 The old framing

Blocker 4 has been carried as "four dirty canonical roots requiring integration", which reads as
**four comparable merge problems**. On that reading the work looks large, uniformly risky, and
naturally deferred. That reading is not supported by measurement.

### 4.2 The measured framing

**It is three repository fast-forwards plus one genuine three-way integration — not four
equivalent merges.**

| Repository | Actual shape | Divergence | Integration cost |
|---|---|---|---|
| SOC | **1 line**, 6 branches totally ordered, tip `5da251d` | **none** | fast-forward; 38/49 commits already hosted (§3.6) |
| Cyber AI | **1 line**, 5 branches totally ordered, tip `2baba72` | **none** | fast-forward |
| Fabric | **1 line**, 3 branches ordered, tip `37d9b329` | **none** | fast-forward |
| **Suite** | **3 divergent lines** from fork `3ef8e05` | **real** (23/5, 23/1, 5/1) | genuine 3-way integration |

For the three product repositories there is **nothing to merge**. Each is a single chain whose tip
subsumes every other W1 branch in that repository, zero commits behind `main`. Publishing the tip
publishes the lane. No conflict resolution exists to perform, because no divergence exists.

Only `cybrik-suite` has a real integration problem, and even there the three lines are **completely
path-disjoint** (§2.6) — 0 overlap across all 99 paths — so the merge is expected to be textually
conflict-free.

### 4.3 What the corrected framing does *not* license

Three honest limits on the good news:

1. **Path-disjoint ≠ semantically independent.** LINE 1 is the control corpus (board, register,
   operations index); LINES 2 and 3 are accepted contract packets whose acceptance LINE 1 *records*.
   A 3-way integration will produce a tree where the control documents and the contracts they
   describe finally coexist — and that coexistence needs review, not just a clean `git merge`.
2. **"Dirty canonical root" is a real but different problem.** The four canonical roots hold 68 /
   24 / 22 / 26 uncommitted W2-wave entries (§2.1) that are **not** W1 work and are **not** part of
   any proposal here. They constrain *checkout*, not *push* (§2.3). Retiring that debt is a
   separate lane this packet does not open.
3. **Nothing above is CI, runtime, integration or product evidence.** All of it is local git
   topology. Every W1 artifact remains `SCAFFOLD`-class, locally reviewed, unmerged and unpushed.

---

## 5. Decision options

Each option states what it costs, what it buys, and what it risks. **None is taken by this packet.**

### Option A — quality-safe: upgrade plan, configure protection, then push (**RECOMMENDED**)

**Shape.** In order, each step a separate Founder action:

1. **Founder upgrades to GitHub Pro** for the four private repositories (or accepts an equivalent
   plan that lifts the §3.2 gating). *This is a purchase decision. This packet does not perform it,
   does not authorize it, and does not price it.* Making the repositories public is **not** an
   acceptable alternative — the `CLAUDE.md` data-handling boundary forbids it.
2. **Configure branch protection on `main`** in all four repositories: require a pull request,
   restrict force-push and deletion. *A repository-settings change — a Founder action.*
3. **Configure required status checks** using the **measured rendered check names** from §3.7 —
   for Suite that means `secret-scan (gitleaks 8.30.1)` and `contract standards validation`, **not**
   the job IDs — and **excluding** the suppressed `e2e-org` and `alert-context-route-db` (§3.8).
   **`secret-scan` first**: it is the one check that is fail-closed in all four repositories and is
   the natural minimum required check.
4. **Re-audit hosted state** read-only (a fresh W0-IR01-class pass), confirming protection is live,
   the required checks bind to real reported contexts, and rulesets are now **visible** rather than
   403 — retiring the §3.2 "inferred absent" residual.
5. **Only then**, under a separate explicit Founder grant, authorize explicit `codex`-ref pushes and
   observe CI (§7) — **excluding SOC**, whose push stays `NO-GO` under this option until the
   measured secret-scan findings of §3.9 are separately remediated or allowlisted under their own
   grant. A plan upgrade does not touch that blocker.

**Buys.** Server-side enforcement exists before any object is published. A mistyped `main` refspec
is *rejected* rather than merely regretted. Red CI can actually block. The §3.2 ruleset residual
closes by measurement instead of inference.

**Costs.** A paid plan. Real elapsed time across five sequenced Founder actions. Every W1 lane
that depends on remote-green evidence — route-DB permanence above all — stays blocked meanwhile.
Independently of the plan, the SOC branch carries an **already-measured** secret-scan blocker that
no upgrade fixes and that must be retired under its own grant before step 5 can include SOC (§3.9).

**Risks.** Cost, and schedule pressure if the upgrade is slow. **No new technical risk is
introduced**; this option strictly reduces risk relative to B.

### Option B — fastest, accepted-risk: explicit-refspec pushes on the current plan

**Shape.** Keep the current plan. Under a **later, separate** Founder approval, permit **only**
fully explicit source:destination refspec pushes of the form

```
git push origin codex/w1-<lane>:codex/w1-<lane>
```

— never `HEAD:`, never a bare `git push`, never a configured upstream — **one repository at a
time**, in ascending blast-radius order (Suite → Fabric → Cyber AI → **SOC last, under its own
separate approval gate**). Each push preceded by **manual two-person verification of the exact SHA
and the exact refspec string**. CI is observed as **advisory only**. **No merge. No push to
`main`. No PR.**

**Buys.** Speed and no purchase. CI runs for the first time on real W1 bytes — the only way to
answer the route-DB permanence question, and the only way to settle the **pinned-`v8.24.3`**
secret-scan result. It is **not** the only way to answer the secret-scan question in substance: that
has already been answered locally at `8.30.1`, and the answer is **exit 2, five findings** (§3.9).

**Costs and risks — stated plainly:**

- **Red CI cannot enforce anything.** With zero required checks (§3.7), a red run blocks nothing.
  CI would be observation, not a gate. Any claim that a push is "gated by CI" would be false.
- **A mistyped `main` refspec is catastrophic and unrecoverable server-side.** With `main`
  unprotected in all four repositories (§3.2), `git push origin HEAD:main` would land directly on
  `main` with no check, no review, and nothing able to block it. **Refspec error is the entire risk
  surface**, and human verification is the only control.
- Objects reach GitHub **before** any secret scan runs (§3.10), and this is no longer hypothetical:
  the SOC tip is **already measured red locally** (§3.9), so a SOC push under B would publish the
  five flagged test literals first and report the failure second. **B does not unblock SOC** — NO-GO
  11 binds under B exactly as it does under A.
- The §3.2 ruleset residual stays open — the packet would still be unable to state protections are
  verified absent.

**Compensating controls that were measured green** and that make B survivable if chosen: read-only
`GITHUB_TOKEN`; zero secrets, environments and variables; no dispatch/merge_group/schedule surface;
no auto-PR/merge/release/deploy workflow anywhere; `allow_auto_merge=false`; every candidate branch
a clean fast-forward from current `main`; no colliding remote ref or PR; every candidate tip in a
clean worktree (§2.7).

### Option C — hold: no remote action at all

**Shape.** Continue local work. No push, no plan change, no settings change.

**Buys.** Zero cost, zero new risk, complete reversibility.

**Costs.** The debt compounds, and specific things stay provably unreachable:

- **Route-DB permanence cannot close.** It requires push plus observed remote green; the
  `alert-context-route-db` job is `if: false` (§3.8). No amount of local work closes it.
- The secret-scan gate is **no longer untested**. It was measured locally at `8.30.1` and it is
  **red** — exit 2, five findings (§3.9). What C actually forfeits here is narrow: only the
  **pinned-`v8.24.3`** result stays unknown. The findings themselves are actionable today under a
  separate remediation grant, with or without a push, so this is no longer an argument against C.
- CI has never executed the current W1 bytes (§3.10); every additional local lane increases the
  size of the eventual first run and the number of findings that will arrive at once.
- Each new lane adds another unintegrated sibling scaffold — enlarging exactly the debt blocker 4
  exists to retire.
- The §11 exit criterion "product-local CI and independent review green" stays unreachable.

**Schedule impact, stated without changing any date.** The fixed dates are unchanged by this packet
and by this option: **W1 2026-08-01 → 2026-08-23**, release window **2026-12-21 → 2026-12-31**.
What C changes is not the dates but the **amount of work that must still fit inside them**: every
day held is a day the first-CI-run findings arrive later and in a larger batch, against a W1 window
that does not move. **No date is adjusted here and none may be adjusted without a separate Founder
decision.**

---

## 6. Recommendation

**Option A.**

The reasoning is one measured fact and one consequence. The fact: **no server-side control exists on
any branch of any of the four repositories, `main` included, and none can be created on the current
plan while they stay private** (§3.2). The consequence: under Option B, the *entire* safety of the
operation is a correctly-typed refspec, verified by humans, with no barrier behind it — and the one
irreversible failure mode (landing on unprotected `main`) is exactly the one with no server-side
recovery.

Option A converts that from a discipline problem into an enforced one **before** anything is
published, and it does so at the moment of lowest cost: nothing is pushed yet, no PR exists, no ref
collides, and every candidate branch is a clean fast-forward. Buying protection before the first
push is strictly cheaper than retrofitting it after.

Option A is also the only option that **closes the §3.2 measurement residual**. Today the honest
status of rulesets is "not visible, inferred absent". Upgrading makes the endpoint readable and lets
step 4 replace inference with measurement.

**Unchanged by the §3.9 correction — with one hard qualification.** Option A rests on the §3.2
plan-gating fact, which the secret-scan measurement does not touch, so **Option A remains the
recommendation**. But neither A nor B may reach a **SOC** push. The measured `secret-scan` result at
`74f9774` is red under a fail-closed full-history gate, and no plan upgrade, refspec discipline or
push ordering changes that. A separate, narrowly-scoped remediation grant must land first and its
result must be re-measured before §7.1 row 6 is even a candidate. The three non-SOC candidate
pushes were **not** locally scanned and are therefore **unmeasured, not cleared**.

**Phased fallback.** If — and only if — the Founder **explicitly accepts the unprotected-`main`
risk in writing**, Option B may run as a phased fallback under its own separate grant, in the
low-to-high blast-radius order of §5B, with SOC last and behind its own `CLAUDE.md` approval gate.
That acceptance must be explicit and recorded; it is not implied by approving this packet, and it
is **not** recommended.

**What this packet explicitly does not do:** it does not decide the purchase, does not decide the
push, does not perform or authorize either, and does not set a deadline for the Founder to choose.
Those are Founder actions. This packet supplies the measurement.

---

## 7. Proposed execution sequence — **NOT authority now**

Everything in §7 is **a proposal contingent on a future explicit Founder decision.** It grants
nothing. No step below may be performed on the strength of this document.

### 7.1 Candidate refs, per repository

| Order | Repository | Candidate branch | Tip | New commits | Rationale |
|---|---|---|---|---|---|
| 1 | Suite | LINE 3 `codex/w1-i02-investigation-lifecycle-proposal-r1` | `ed95e51` | 3 | smallest; 2-job workflow, read-only token, no services |
| 2 | Suite | LINE 2 `codex/w1-g1-c1-repin-r1` | `7185739` | 7 | subsumes `3a2c715`, `4d5fb4b`, `a976a20`, `20cfa36` |
| 3 | Suite | LINE 1 `codex/w1-d04-founder-gate-repair-r1` | `8fe4cb0` | 25 | control corpus, measured at the immutable base |
| 4 | Fabric | `codex/w1-fabric-vendor-c1g1-r1` | `37d9b329` | 5 | subsumes `6f72616`, `d38f910`; 5 jobs, no services |
| 5 | Cyber AI | `codex/w1-i06c-http-ingress-r2` | `2baba72` | 12 | subsumes the whole AI chain; 7 jobs, no services |
| 6 | **SOC** | `codex/w1-soc-vendor-c1r-r1` | `5da251d` | 11 | subsumes all SOC branches — **separate approval gate**, and **currently `NO-GO` under every option** (§3.9, NO-GO 11) |

Every tip and new-commit figure in this table is the §2.8 measurement re-taken on 2026-07-28 at the
immutable control base `8fe4cb02e0119224205a86631db7c481f7638c23` — not dated history. Row 3 reads
Suite LINE 1 at `8fe4cb0` with **25** commits not on any remote-tracking ref, matching the §2.8
push-delta table exactly. Rows 2, 4 and 6 moved this lane as the W1-G1, Fabric and SOC commits
landed (§2.10). `validate-w1-control.mjs` fails closed if §2.8 and §7.1 disagree on the LINE 1,
LINE 2 or SOC tip or count, so a partial refresh of one section cannot recur.

**Base-plus-one disclosure — read with §2.8.** Row 3 republishes the §2.8 measurement taken at the
immutable base `8fe4cb0` — the **parent of this Lane 5 record, not its current tip**: **25** commits
not on any remote-tracking ref. This record adds exactly **+1**, so the live count after it is
committed becomes **26**, a **prediction, not a measurement**.
**No self commit SHA, tree or content aggregate is stated or predicted here** — a commit cannot
contain its own identity. A fresh external `git rev-list --count`
re-confirmation is **mandatory before any push**.

**Row 6 is blocked, not merely gated.** The measured local `secret-scan` result at `74f9774` is exit
2 with five findings (§3.9). Row 6 may not be attempted under Option A or Option B until a separate
remediation grant retires those findings and a re-measurement records the new result. Rows 1–5 were
**not** locally scanned; their secret-scan status is **unmeasured, not cleared**, and §7.2 step 2
now requires each to be scanned before its own push.

**The three Suite lines are pushed as three separate branches and kept separate.** No integration
of them is proposed here. A three-way integration would require its **own dedicated integration
branch and its own dedicated Founder grant**, after all three are published and observed
independently. Nothing in §7 merges anything.

SOC is ordered last and is **its own approval gate** per `CLAUDE.md`: any change inside
`cybrik-soc-command-center` requires separate explicit Founder approval, distinct from a
suite-level decision. It also carries the highest CI cost (8 jobs, Postgres 16 + Redis, Alembic
up/down/up, Playwright/Chromium e2e) and a genuine historical failure rate (3 of the last 8
recorded runs failed).

### 7.2 Per-push preflight — every step required, in order

1. **Confirm the exact tip SHA** in its own worktree; confirm the worktree is clean
   (`git status --porcelain` empty). Any dirt → stop.
2. **Local secret scan — mandatory where a scanner is present; no install is permitted.** A scanner
   **is** present: `gitleaks 8.30.1` at `/opt/homebrew/bin/gitleaks`. Run it read-only, with no
   `--report-path`, and record the **exit code and finding count verbatim**, red results included.
   `command -v gitleaks` must be recorded alongside the other tool checks — omitting it is exactly
   what produced the original §3.9 error (§10). Where a scanner is genuinely absent, record that the
   scan was **not run** rather than implying it passed. A local pass is **not** a CI prediction
   wherever the pinned CI version differs from the local binary (§3.9).
3. **Local tests** for that repository, recording exact commands and results.
4. **Explicit-refspec dry proof**: `git push --dry-run origin <src>:<dst>` with both sides written
   out in full. Capture the output verbatim. **Two-person verification of the refspec string and
   the SHA** before the real push.
5. **Push the branch** — explicit refspec only. Never `HEAD:`, never bare `git push`, never a
   configured upstream, never `--force` in any form.
6. **Observe remote CI**: record the **actual run URL, the rendered check names, and the actual
   pass/fail per check.** Not a prediction — the recorded artifact.
7. **Record honestly**, including failures. A red run is evidence and gets written down as a red
   run.

### 7.3 Evidence rules that bind any recorded result

- **No route-DB evidence may be derived from a suppressed job.** `alert-context-route-db` is
  `if: false` (§3.8); a green SOC run on `w1-i03b` or `w1-i04a` says nothing about route-DB wiring
  and **must not** be recorded as if it did. Same for `e2e-org`.
- Under Option B, **no result may be described as "gated"** — with zero required checks, CI is
  advisory (§3.7).
- **The SOC `secret-scan` question is already measured locally, and it is red** — exit 2, five
  findings (§3.9). A CI run would be the first measurement at the **pinned `v8.24.3`**, not the
  first measurement at all. **No record may describe a future SOC run as "the first real
  measurement".** A red run, local or remote, is a finding requiring its own remediation lane; it is
  never a reason to retry the push.
- Publication is not integration. A pushed branch remains unmerged, `SCAFFOLD`-class, and closes no
  blocker by itself.

### 7.4 Deferred to separate grants

Integration and merge of any kind — including the Suite three-way integration branch, any merge to
`main`, any PR, and any release action — is **out of scope** and requires its own separate Founder
grant, with SOC always behind its own additional gate.

---

## 8. Explicit NO-GO conditions

Carried from W0-IR01B and binding under **every** option:

1. **NO-GO** if the intended refspec is anything other than an explicit `codex/w1-*:codex/w1-*`
   mapping. With `main` unprotected in all four repositories, refspec error is the entire risk
   surface and it is **unrecoverable server-side**.
2. **NO-GO** on `codex/w1-i03b-route-db-permanence-r1` or `codex/w1-i04a-shadow-remote-r1` if the
   purpose is route-DB CI evidence — `if: false` at `ci.yml:418` guarantees no such evidence is
   produced.
3. **NO-GO** while the dirty trees remain uncommitted, **if** the record claims the pushed bytes
   equal the reviewed bytes. SOC's canonical `ci.yml` (`97724c6f`, 18507 B) matches no pushed blob.
4. **NO-GO** on any push framed as "will be gated by CI". Zero required checks: a red run blocks
   nothing.
5. **NO-GO** on any assertion that protections **or rulesets** are *verified* absent. The ruleset
   endpoints returned 403; the honest status is **"not visible; inferred absent"** (§3.2).
6. **NO-GO** on any step requiring a second remote. `CLAUDE.md` forbids it without separate
   approval, and only `origin` exists today in all four canonical roots and all 17 W1 worktrees.
7. **NO-GO** on making any repository public to obtain protections — the data-handling boundary
   forbids it.
8. **Separate gate:** any push into `cybrik-soc-command-center` is its own approval gate, distinct
   from a suite-level decision (`CLAUDE.md`).

Added by this packet from its own measurement:

9. **NO-GO** on switching any canonical root onto a W1 branch to "integrate". The measured
   checkout collisions are 10 (SOC), 16 (Cyber AI), 10 (Fabric) and 9 (Suite LINE 1), and two Suite
   LINE 1 paths are tracked on the branch but untracked in the root (§2.6). Work from the existing
   clean per-lane worktrees instead.
10. **NO-GO** on treating the SOC push as 49 new commits or as touching no already-published
    history. 38 of 49 are already hosted via `codex/w2j-org-assets-vertical` (§3.6); the push adds
    **11**.

Added by the W0-S01B secret-scan measurement (§3.9):

11. **NO-GO on the SOC push (§7.1 row 6) under every option** while the five measured
    `generic-api-key` findings — `ff1aec3` ×2, `74f9774` ×3 — stand. SOC `secret-scan` is fail-closed
    over full history, `.gitleaksignore` matches none of the five, and splitting or reordering
    commits does not evade it. This clears **only** through a separate remediation grant:
    test-fixture edits plus either a `.gitleaksignore` append or a rewrite of the unpushed
    `ff1aec3`. **The history-rewrite route requires its own Founder-grade approval on its own
    merits, even though the history is unpushed.** Nothing in this packet grants either route, and
    no product remediation authority exists here.
12. **NO-GO on describing the local `8.30.1` result as a CI prediction, or the three unscanned
    repositories as clean.** SOC CI pins `v8.24.3` and the local evidence does not predict it
    (§3.9); Cyber AI, Fabric and Suite were never locally scanned, so their status is **unmeasured**,
    not green.
13. **NO-GO on any claim that a secret-scan verdict is unmeasurable locally, or that a future CI run
    would be its "first real measurement".** A scanner is installed; the measurement exists. This is
    the W0-R06L P1-1 error and it must not recur in any record.

Added by the W1-D04C dual-state provenance refresh (§2.9):

14. **NO-GO** on publishing, pushing or citing `a976a20` as the current corrected W1-C1
    bytes. The corrected bytes are the content of `20cfa36`, which is local-only and
    integrated nowhere; `a976a20` is its parent, carries the pre-correction bytes and a
    `source_member_set_digest` of `e4cfbf8c…`.
15. **NO-GO** on treating the W0-I01C correction as accepted, integrated, pushed, merged or
    release-bearing. It is committed local-only at `20cfa36` with `member_set`
    `sha256:27a6bdeb…` over exactly 16 paths; its lifecycle is `CORRECTION COMMITTED — LOCAL-ONLY
    — NOT INTEGRATED — NOT ACCEPTED`, and the accepted baseline `3a2c715…` / `sha256:e4cfbf8c…`
    is unchanged and remains the only accepted W1-C1 artifact. **Being committed is not being
    accepted.**
16. **NO-GO on a runtime demonstration of any W1 lane, and NO-GO on running any local stack before
    G-C `stable-v1.0`.** No endpoint, service, container, database or broker may be started to
    "show" this work, and the correction candidate is static evidence only.
17. **NO-GO on any release-date movement.** W1 stays **2026-08-01 → 2026-08-23** and the release
    window stays **2026-12-21 → 2026-12-31**. Nothing in §2.9 or in the W1-D04C record touches
    either, and no UAT milestone is reached.

---

## 9. Status and ceiling

| Item | State |
|---|---|
| This packet | `PROPOSED — FOUNDER DECISION REQUIRED`; documentation only |
| Independent review of this packet | **W0-R06L**: commit-audit integrity `PASS`, packet verdict **`NO-GO`** on P1-1 — corrected here; **not usable as a Founder decision basis until a fresh review of the corrected bytes returns PASS with no P0–P2** |
| SOC `secret-scan` at `74f9774` | **measured red locally** — gitleaks `8.30.1`, exit 2, **5** `generic-api-key` findings (§3.9); pinned-`v8.24.3` result **unknown** |
| Cyber AI / Fabric / Suite secret-scan | **unmeasured** — not scanned locally, not cleared |
| Secret-scan remediation authority | **none** — both routes in §3.9 need their own grant; the history-rewrite route needs a separate Founder-grade approval |
| Writers opened | **none** — no product, integration, push or CI writer |
| Push / merge / PR / release authority | **none** |
| Remote configuration / repository-settings authority | **none** |
| Plan or purchase authority | **none** — Option A step 1 is a Founder action, not authorized here |
| Blockers closed | **none**; live-shadow blocker 4 stays open |
| W0-I04 | `HOLD` |
| GATE A4, W1-C1, W1-C2 | `ACCEPTED — CLOSED 2026-07-26` |
| W1-G1 | `ACCEPTED — CLOSED 2026-07-27` |
| G2 / G3 | closed |
| `W0 COMPLETE` | **0**; W0 closure `NO-GO` |
| W1 product/integration writers | `HOLD` |
| W1 runtime writers, delegated routine integration, external release | `NO-GO` |
| Roster | **48** immutable task identities; **no task 49** |
| W1 window | **2026-08-01 → 2026-08-23**, unchanged |
| Release window | **2026-12-21 → 2026-12-31**, unchanged |
| UAT instance | **none exists** |
| CI | **CI3 PREPARED LOCALLY — NOT HOSTED-RUN** — workflow draft wires the three W1 validators and exact 98-test command; no hosted result exists |
| W1-C1 accepted baseline | `3a2c715…` / `sha256:e4cfbf8c…`, **unchanged**; the only accepted W1-C1 artifact |
| W0-I01C correction | `CORRECTION COMMITTED — LOCAL-ONLY — NOT INTEGRATED — NOT ACCEPTED` — committed at `20cfa36`, 16 paths, zero staged; integrated nowhere (§2.9, §2.10) |
| Lane 5 local-only reviewed commits | **four** — W1-C1 `20cfa36`, W1-G1 `7185739`, SOC `5da251d`, Fabric `37d9b329`; all `LOCAL-ONLY`, independently reviewed, **`NOT INTEGRATED`**, **`NOT PUSHED/MERGED/RELEASED`** (§2.10) |
| Candidate acceptance / promotion authority | **none** — needs its own Founder decision on its own bytes |
| Alert-context transport stale lock | **disclosed, not cleared**; no remediation authority granted (§2.9, board §14.32.3) |
| Runtime demonstration / local stack | **NO-GO** — and no local stack before G-C `stable-v1.0` (§8 NO-GO 16) |

Machine validation for the W1 control documents (board §13) is `node
tools/operations/validate-w1-control.mjs` → `PASS: tasks=48`, with a derived `W1_C1_CANDIDATE`
carrying `committed=true` and `accepted=false`, a derived `LINE1_PUBLICATION` carrying the §2.8
tip and count, and a derived `ENFORCEMENT_SURFACE` whose canonical file path carries
`readsLiveGit=true`. It validates exact rehearsal objects plus the control documents; it is not
product runtime, hosted-CI or release evidence.

**Verification history — dated, retained, not withdrawn.**

| Date | Lane / record | Validator | Test suite |
|---|---|---|---|
| 2026-07-27 | W1-D04B, re-run by the W0-R06L review | `PASS: tasks=48` | `tests 77 · pass 77 · fail 0` |
| 2026-07-27 | W1-D04C dual-state provenance refresh | `PASS: tasks=48` | RED `tests 100 · pass 78 · fail 22`, then `tests 100 · pass 100 · fail 0` |
| 2026-07-27 | W1-D04D W0-R06M bounded repair | `PASS: tasks=48` | RED `tests 115 · pass 101 · fail 14`, then `tests 115 · pass 115 · fail 0` |
| 2026-07-27 | W1-D04D-R2 enforcement-surface repair | `PASS: tasks=48` | RED `tests 131 · pass 115 · fail 16`, then `tests 131 · pass 131 · fail 0` |

Every row above is the result **on its date, against the bytes of that record**. The `77 · 77`,
`100 · 100`, `115 · 115` and `131 · 131` figures are **dated history, not the current count** —
only the paragraph below is current. None of them is withdrawn.

**Current — W1 Lane 5 control reconciliation, this record.** Test-first RED before any
implementation: `tests 172 · pass 95 · fail 77` — forty-one tests added over the 131-test baseline;
most of those failures cascaded from the first standalone-validator failure rather than being
independent defects. That first pass reached `tests 172 · pass 172 · fail 0`, and the independent
review of those bytes returned **NO-GO**. The bounded remediation that followed added seven
tests, three of them measured RED against the un-hardened exemption scanner — `tests 179 · pass
176 · fail 3` — before the fix landed. Final, against these bytes:
`node tools/operations/validate-w1-control.mjs` → **PASS**, `tasks=48`;
`node --test tools/operations/tests/validate-w1-control.test.mjs` → **`tests 179 · pass 179 · fail 0`**.
The `131 · 131` and `172 · 172` figures are earlier results, not the current count. CI3 is now
prepared locally; no hosted run is claimed.

### 9.1 Machine-enforcement surface — exactly what the validator checks

The withdrawn W1-D04C sentence said the validator enforced this packet's §2.9 and §8 NO-GO 14–15
and nothing else, and that §2–§7 were unenforced prose. Both halves were false: §2.8, §7.1 row 3
and a corpus-level scan of this whole file were already enforced. The inventory below replaces it
and is **itself machine-pinned** — the validator fails closed if it drifts in either direction.

**Enforced in this packet — the complete list.**

| # | Packet locus | Rule the validator fails closed on |
|---|---|---|
| 1 | §2.8 push-delta table | the `Suite LINE 1` row must exist and name a tip that is a prefix of the pinned immutable control **base**, carrying **25** as its bolded count of commits not on any remote-tracking ref |
| 2 | §2.8 push-delta table | the six bolded per-row counts must sum to the stated per-line total **63**, and the sum-versus-union sentence naming the measured unique union **59** and the Suite-only union **31** is pinned byte-exact |
| 3 | §2.8 ↔ §7.1 row 3 | the §7.1 Suite LINE 1 candidate-ref row must exist for `codex/w1-d04-founder-gate-repair-r1` and republish §2.8's tip and count exactly |
| 4 | §2.9 | the dual-state heading must exist, and the section may name no 40-hex commit identity other than the accepted base `3a2c715…` or its parent `3ef8e05…` |
| 5 | §2.9 | no affirmative promotion claim — the section may not say the W0-I01C candidate is accepted, integrated, superseding or replacing |
| 6 | §2.9 | the commit-graph block — LINE 2 extended, not rewritten, totally ordered `3a2c715` → `4d5fb4b` → `a976a20` → `20cfa36` → `7185739`, with both corrections local-only, integrated nowhere and accepted by no contract gate — is pinned byte-exact |
| 7 | §2.9 | the `76ef51d9…` pre-commit working-tree aggregate must appear **exactly once** in this whole file, and its label block, including the reproduction recipe and its dated pre-commit status, is pinned byte-exact |
| 8 | §2.9 | the measured alert-context transport fixture disclosure block is pinned byte-exact |
| 9 | whole file | corpus-level withdrawn-count guard: every surviving `<n> transport fixtures` claim anywhere in this file, quotation included, must read **13** |
| 10 | §8 | NO-GO **14** and NO-GO **15** are each pinned byte-exact |
| 11 | §9 | the dated verification-history table and the current-result paragraph above are each pinned byte-exact |
| 12 | §9.1 plus live repository | this table and the live-`git` paragraph are pinned byte-exact; the canonical file validator fails closed unless the exact two rehearsal merge commits, ordered parents, trees, required input objects and rehearsal-tip ancestry exist |
| 13 | §2.8 and §7.1 | both sections must carry the full two-sided base-plus-one disclosure — the base `8fe4cb0`, the measured **25**, this record's **+1**, the derived **26**, the prediction-not-measurement warning, the no-self-identity statement and the mandatory external re-confirmation before any push |
| 14 | whole file | no present-tense `current`/`live` control-tip claim may name the immutable base `8fe4cb0`; it is the base/parent of this record, never its tip |
| 15 | §2.10, board §14.35, register §27 | exactly four local-provenance rows, each pinned byte-exact and byte-identical across the three documents, each carrying `LOCAL-ONLY`, `INDEPENDENT REVIEW PASS`, `NOT INTEGRATED` and `NOT PUSHED/MERGED/RELEASED`, with `CONFORMANCE-ONLY` on both vendor rows; a missing or extra row fails closed |
| 16 | §2.10, board §14.35, register §27 | no affirmative claim that a Lane 5 commit is pushed, merged, released, integrated or contract-reaccepted |
| 17 | §2.9, §4.4, board §14.32.2 | none of the four Lane 5 full commit identities may appear inside the legacy guarded regions, whose allowlist stays the accepted base `3a2c715…` and its parent `3ef8e05…` |
| 18 | all three control documents | no withdrawn uncommitted-generation claim — `no commit object`, `no new commit`, `uncommitted working-tree overlay`, the retired lifecycle string — may survive outside a paragraph that dates itself or names itself superseded |
| 19 | all three control documents | every Lane 5 manifest, member set and content aggregate must appear exactly once and only on its own lane row; no aggregate or member set may be read against two lanes |
| 20 | §2.8 ↔ §7.1 | the Suite LINE 2 and SOC rows must agree on tip and count across both sections, exactly as Suite LINE 1 already must |
| 21 | whole corpus | no self identity for this record — no Lane 5 commit SHA, tree or `SCOPE-AGG-SHA256/v1` value may be stated or predicted anywhere; the predicted count is derived in the validator from base + offset and is never a literal |
| 22 | current canonical state | the reconciliation application, board, E2 register, blocker-4 packet and ADR catalog must all carry the canonical lifecycle and PR #1 merge; the E2 current-gate section must exclude superseded unpushed, unmerged and delegation-NO-GO claims |
| 23 | current delegated authority | the board must pin bounded product admission at `CONDITIONAL GO`, delegated technical integration at evidence-gated `GO`, runtime at `NO-GO` and production as Founder-controlled |
| 24 | canonical merge topology | live Git must contain PR #1 merge `28c564e…` with its exact ordered parents and tree, the rehearsal tip must be its ancestor, and repository `HEAD` must descend from it |

**Not enforced — equally complete, so no reader infers coverage that does not exist.**

- §1, §2.1–§2.7, §3, §4, §5 and §6 **in full** — every sentence, table and measured figure in them,
  including the whole hosted-state audit and the secret-scan findings.
- §2.8 beyond rules 1–2, 13 and 20: the Cyber AI, Fabric and Suite LINE 3 rows' tips and
  ahead-counts.
- §7 beyond rules 3, 13 and 20: §7.1 rows 1, 4 and 5 and all their figures, and all of §7.2, §7.3 and §7.4.
- §8 NO-GO **1–13**, **16** and **17** — including the runtime/local-stack NO-GO 16 and the
  release-date NO-GO 17, which stay **prose-only and unpinned**.
- §9 outside §9.1: the status-and-ceiling table above.
- §10 in full: every transcript path, byte count and record count.

**Live `git` topology is required and read fail-closed.** The canonical file validator invokes
read-only `git` commands in the repository root. It requires the exact objects
`b2caf77c3cd96beb7383cc3d93844d771262ea5f`,
`71857395332fabe041896ca0700fbf7a2bf612d3`,
`5a1ed0001a5714b7f099aeaff3f5a74cb67c068a`,
`87efae7898bd14e9aa9a2866380a9973d8b3e5bc` and
`900d83a61515f37ae117e04763da1881cba90b7b`, plus canonical PR #1 merge
`28c564eb9b6853b73a18a59a2e84ba58fd67816a`. It checks the exact ordered parents and trees of
all three merges, rehearsal-to-canonical ancestry and canonical-merge-to-`HEAD` ancestry. A
missing or shallow-history object is a hard failure. The pure
document-validation function remains injectable for negative fixtures, but it never substitutes
for the canonical file validator or degrades a missing Git object to document-only success.

---

## 10. Provenance

- Lane decision: **W0-IR14**, transcript
  `/Users/hoanglinh/.claude/projects/-Users-hoanglinh-Claude-Projects-cybrik-worktrees-w1-48-w1-d04-founder-gate-repair-r1/46bbbcb7-1cc5-42dc-9beb-9e3b4f681562.jsonl`
  (701703 bytes, 142 records) — `GO` to issue the `W1-D04B` docs-only grant, with the hosted state
  named as the one blocking fact to measure first.
- Hosted state: **W0-IR01B**, transcript
  `/Users/hoanglinh/.claude/projects/-Users-hoanglinh-Claude-Projects-cybrik-worktrees-w1-48-w1-d04-founder-gate-repair-r1/4c95f825-f39d-48d9-9eef-2272b6ca0bb5.jsonl`
  (298702 bytes) — read-only `gh api` GETs, `gh` 2.96.0, scopes `gist, read:org, repo, workflow`,
  **token value never displayed**.
- Local topology: re-measured read-only in this session, 2026-07-27, before any prose was written.
  One live read-only `GET` (§3.6) re-confirmed a single hosted ref.
- **Independent post-commit review: W0-R06L**, transcript
  `/Users/hoanglinh/.claude/projects/-Users-hoanglinh-Claude-Projects-cybrik-worktrees-w1-48-w1-d04-founder-gate-repair-r1/695fc343-d634-4feb-8a9b-d69d2f114188.jsonl`
  (430694 bytes, 100 records) — audited commit `8fe4cb02…`: integrity `PASS` on all ten checks
  (commit, parent `a3e8cba9…`, subject, exactly four paths, four blob SHAs, roadmap sole-dirty
  `4ed13159…`, no upstream/push/tag), packet verdict **`NO-GO`** on **P1-1** plus four P3s. Validator
  re-run by that review: `PASS tasks=48`, `tests 77 · pass 77 · fail 0`. No writes, stages, commits,
  pushes, fetches, installs or ref/settings changes were made in that audit.
- **Secret-scan measurement: W0-S01B**, transcript
  `/Users/hoanglinh/.claude/projects/-Users-hoanglinh-Claude-Projects-cybrik-worktrees-w1-48-w1-i04a-shadow-remote-r1/aff4c5dd-7cfd-4ea5-b682-6f1806e11855.jsonl`
  (171637 bytes, 69 records) — read-only `gitleaks 8.30.1` run in the clean SOC worktree at
  `74f9774`, `HEAD` and `git status --porcelain` identical before and after, no `--report-path`, no
  install, no ref mutated, no secret value displayed. Result recorded verbatim in §3.9.
- This correction: docs-only, prospective, authored 2026-07-27 at control `HEAD`
  `8fe4cb02e0119224205a86631db7c481f7638c23` under a fresh separate Opus 5 correction-writer
  authority (**W1-D04B-R2**) across exactly three control paths — this packet, the board and the
  register. It performs no commit and opens no writer.
- Board record: §1.22 and §14.30 (original, corrected in place where they carried the withdrawn
  claim); **§1.23 and §14.31 carry this correction.** Register record: §25 (original, likewise
  corrected in place); **§26 carries this correction.** Index: `docs/operations/README.md`.
- **W1-D04C dual-state provenance refresh**, 2026-07-27, docs-and-tool, prospective and
  uncommitted, across an exact **five**-path allowlist (this packet, the board, the register,
  `tools/operations/validate-w1-control.mjs` and its test suite — **no sixth path**, no ADR
  acceptance file, no byte written in the `w1-i01-alert-context-proposal-r1` worktree). §2 was
  re-measured read-only on 2026-07-27 at what was then the control tip
  `8fe4cb02e0119224205a86631db7c481f7638c23` — now the immutable base of this record — before §2.9
  was written; the earlier `a3e8cba` figures are dated history, not withdrawals. The
  W0-I01C candidate's `member_set`, coverage and review verdict are **attested by the candidate lane
  and its independent reviewer** and are **not** re-derived here — the 16-modified-tracked /
  zero-staged / no-new-commit measurement **is** this session's own read-only `git` measurement. The
  `76ef51d9…` working-tree aggregate is **coordinator-reproduced** by the recipe stated verbatim in
  §2.9. Board record: **§1.24 and §14.32**; register: **§1** row and **§4.4**. This refresh performs
  no commit, opens no writer, and clears no lock.

## 11. W1 C1/G1 + corrected C2 reconciliation rehearsal — 2026-07-30

This section supersedes only the current-state conclusions of older candidate sections. Their
measurements remain immutable dated provenance, including `3a2c715…`, `a976a20…`, `ed95e51…`,
`d6e53221…` and `4ecc9658…`.

The authoritative inputs are control base `b2caf77c3cd96beb7383cc3d93844d771262ea5f`,
corrected C1/G1 `71857395332fabe041896ca0700fbf7a2bf612d3` containing accepted C1
`20cfa36c503e5a95341c80653d25d2000d65c9fe`, and corrected C2/BSR1
`5a1ed0001a5714b7f099aeaff3f5a74cb67c068a`.

The exact noncanonical rehearsal topology is:

1. `87efae7898bd14e9aa9a2866380a9973d8b3e5bc`, parents
   `b2caf77c3cd96beb7383cc3d93844d771262ea5f` then
   `71857395332fabe041896ca0700fbf7a2bf612d3`, tree
   `abb4d16d1c6038ccc33931c009628a47b2b0bd68`;
2. `900d83a61515f37ae117e04763da1881cba90b7b`, parents
   `87efae7898bd14e9aa9a2866380a9973d8b3e5bc` then
   `5a1ed0001a5714b7f099aeaff3f5a74cb67c068a`, tree
   `a297646ec6d4901c8861d28b5ec8736f65902b70`.

Current state is `ACCEPTED-AND-LOCALLY-INTEGRATED — REHEARSAL ONLY — NONCANONICAL`. C1 pins
`27a6bdeb168599dc4fd05e27f06785315a3b763647826559efe9d721bc0292c8` / 16 paths / 21 tests;
G1 pins member set `a285fa8e…b43f4` / 9 paths / 37
tests; corrected C2 pins `d741f22470a59bde5f0761dd6f3309acb9bb9b851970bc95c5228efd135a5449`
/ 7 reconciliation paths / full packet 32 paths and 40 tests. Immutable Bundle v0.1.0 remains
`501cb160f2fe7035c824d5b0ab37b74d5624cf99a7c25c7adffa72dff9c53bb1`.

The canonical file validator now reads live Git topology and fails closed on missing objects,
wrong parent order, wrong trees or wrong tip ancestry. CI3 locally wires the three standalone
validators and their combined exact 98 tests. Governance disposition
`DELEGATED-GOVERNOR-ACCEPTED` authorizes one exact local-only commit of the combined CONTROL9 +
CI3 12-path scope. The post-remediation independent review remains incomplete and is not
represented as a pass. This is static contract conformance only; no hosted CI result, canonical
ref movement, push, merge-to-branch, runtime, UAT or release is claimed. The unchanged-lockfile
audit records 0 Critical / 13 High entries rooted in `GHSA-mh99-v99m-4gvg`; CI3 activation stays
blocked pending separate compatible dependency remediation.
