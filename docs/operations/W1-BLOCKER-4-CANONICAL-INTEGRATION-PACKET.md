# W1 blocker-4 — canonical integration and CI activation Founder decision packet

Status: `PROPOSED — FOUNDER DECISION REQUIRED`.

Task: **W0-D04**, sub-lane **W1-D04B**. Authored 2026-07-27 in control worktree
`/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-d04-founder-gate-repair-r1` at control
`HEAD` `a3e8cba906a1a25298e991954778cb06d4e03e18`, on the **W0-IR14** lane decision.

**This packet is documentation only.** It opens no product, integration, push or CI writer. It
authorizes no push, fetch, ref mutation, merge, pull request, release, remote configuration change,
repository-settings change, plan or purchase change, dependency install or formatter run. It closes
**no** blocker and promotes **no** gate. It asks the Founder for a decision; it does not take one.

Every local topology figure below was **re-measured live and read-only in this session** before any
prose was written. Hosted figures are **cited from the W0-IR01B audit** and labelled as such; one
hosted ref was independently re-confirmed by a read-only `GET` because this session's local
measurement surfaced a fact W0-IR01B's per-repo summary does not state (§3.6).

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
| `cybrik-suite` | `/Users/hoanglinh/Claude/Projects/cybrik-suite` | `codex/w2i-ai-inference-transport` | `55e94c2` | **68** |
| `cybrik-soc-command-center` | `/Users/hoanglinh/Claude/Projects/cybrik-soc-command-center` | `codex/w2j-org-assets-vertical` | `1b6671c` | **24** |
| `cybrik-cyber-ai-platform` | `/Users/hoanglinh/Claude/Projects/cybrik-cyber-ai-platform` | `codex/w2h-service-delegation-ai` | `281b252` | **22** |
| `cybrik-security-tool-fabric` | `/Users/hoanglinh/Claude/Projects/cybrik-security-tool-fabric` | `codex/w2h-auth-org-conformance` | `3292a65` | **26** |

Control work happens in a **separate worktree**, not in the Suite canonical root. This packet's
own control worktree is `codex/w1-d04-founder-gate-repair-r1` at `a3e8cba`, with exactly one dirty
path — `docs/strategy/06-ROADMAP-2026-2029.md`, quarantined at `git hash-object`
`4ed13159a7afc104694dea8b2f2773003cdf8831`, never read for content, never edited, never staged.

`cybrik-suite` "dirty = 68" counts `git status --porcelain` entries after de-duplication; **6 of
those 68 are untracked directory entries** (`.claude/worktrees/`, `contracts/examples/transport/`,
`docs/evaluation/aisoc-baseline/`, `docs/evaluation/aisoc-comparator/`, `tools/evaluation/`,
`tools/operations/`) which git collapses rather than expanding to files. The true file count behind
those six is larger and was not enumerated; **68 is a lower bound on files, an exact count of
porcelain entries.**

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
                      └─ 74f9774  codex/w1-i04a-shadow-remote-r1   main+48   ← tip
```

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
       └─ d38f910  codex/w1-i07-fabric-r0-domain-r1  main+13  ← tip
```

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
            ├─ LINE 1  a3e8cba  codex/w1-d04-founder-gate-repair-r1        fork+22, main+37
            ├─ LINE 2  3a2c715  codex/w1-i01-alert-context-proposal-r1     fork+1,  main+16
            │            └─ 4d5fb4b  codex/w1-i01-alert-context-transport-binding-r1  fork+2, main+17
            │                 └─ a976a20  codex/w1-c1-transport-acceptance-r1          fork+3, main+18  ← LINE 2 tip
            └─ LINE 3  ed95e51  codex/w1-i02-investigation-lifecycle-proposal-r1  fork+1, main+16  ← LINE 3 tip
```

The pairwise matrix confirms exactly three lines, all meeting at `3ef8e05`:

| Pair | `merge-base` | `L/R` (ahead each side) |
|---|---|---|
| LINE 1 `a3e8cba` ↔ LINE 2 `a976a20` | `3ef8e05` | 22 / 3 |
| LINE 1 `a3e8cba` ↔ LINE 3 `ed95e51` | `3ef8e05` | 22 / 1 |
| LINE 2 `a976a20` ↔ LINE 3 `ed95e51` | `3ef8e05` | 3 / 1 |

Within LINE 2 the three branches are totally ordered (`merge-base(3a2c715, 4d5fb4b)` = `3a2c715`,
`L/R = 0/1`; `merge-base(4d5fb4b, a976a20)` = `4d5fb4b`, `L/R = 0/1`). `55e94c2` and `3ef8e05` are
ancestors of all three lines and are therefore **not** a fourth line.

The two contract commits recorded by the validator match this exactly: `w1C1` `3a2c715…` and
`w1C2` `ed95e51…`, **both parented on `3ef8e05…`** — that shared parent *is* the fork point.

**Path-collision measurement between the three lines — the decisive figure:**

| Line | Paths vs fork `3ef8e05` |
|---|---|
| LINE 1 (`a3e8cba`, control/docs) | 32 |
| LINE 2 (`a976a20`, C1 / alert-context transport) | 35 |
| LINE 3 (`ed95e51`, C2 / investigation lifecycle) | 32 |

| Overlap | Count |
|---|---|
| LINE 1 ∩ LINE 2 | **0** |
| LINE 1 ∩ LINE 3 | **0** |
| LINE 2 ∩ LINE 3 | **0** |

**The three lines are completely path-disjoint** across all 99 changed paths. A three-way
integration of them is therefore expected to be **textually conflict-free**. That is a measured
property of the current tips, and it is the single strongest argument that the Suite integration is
tractable. It is **not** a claim that the integration is semantically trivial — see §4.3.

**Dirty-path intersection with the Suite canonical root (68 entries):**

| Line | ∩ canonical-root dirty |
|---|---|
| LINE 1 (`a3e8cba`) | **9** |
| LINE 2 (`a976a20`) | **0** |
| LINE 3 (`ed95e51`) | **0** |

LINE 1's nine: `README.md`, `docs/README.md`, `docs/adr/ADR-DECISION-SPRINT-2026-07.md`,
`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md`, `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md`,
`docs/adr/README.md`, `docs/operations/README.md`,
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md`, `docs/operations/W1-E2-EVIDENCE-REGISTER.md`.
The last two are **tracked on LINE 1 but untracked in the canonical root** — a checkout onto LINE 1
in the canonical root would refuse or clobber. Again: this constrains *checkout*, not *push*.

### 2.7 W1 lane worktrees — where the work actually is

Seventeen W1 worktrees exist under `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/`.
**Thirteen are completely clean; four are not:**

| Worktree | Branch | `HEAD` | Dirty |
|---|---|---|---|
| `w1-b05-w2i-adr-correction-r1` | `codex/w1-b05-w2i-adr-correction-r1` | `55e94c2` | **8** |
| `w1-d02-soc-pg-evidence-r1` | `codex/w1-d02-soc-pg-evidence-r1` | `6fe0c46` | **3** |
| `w1-fab-c0-provenance-r1` | `codex/w1-fab-c0-provenance-r1` | `6f72616` | **2** |
| `w1-d04-founder-gate-repair-r1` | `codex/w1-d04-founder-gate-repair-r1` | `a3e8cba` | **1** (quarantined roadmap) |
| the other 13 | — | — | **0** |

Critically, **every branch tip this packet would propose publishing sits in a clean worktree**:
`w1-i04a-shadow-remote-r1` (0), `w1-i06c-http-ingress-r2` (0), `w1-i07-fabric-r0-domain-r1` (0),
`w1-c1-transport-acceptance-r1` (0), `w1-i02-investigation-lifecycle-proposal-r1` (0). LINE 1's
worktree carries only the quarantined roadmap file, which is unstaged and would not be pushed.

Note: `codex/w1-i05-orchestration-foundation-r1` exists as a branch but has **no** worktree under
`w1-48`; it is an interior commit of the Cyber AI chain and needs no separate publication.

### 2.8 What a push would actually add — new objects, not total ahead-counts

"Ahead of `main`" overstates blast radius, because some of this history is **already hosted**.
Measured with `git rev-list --count <tip> --not --remotes`:

| Repository | Proposed tip | Ahead of `main` | **Commits not on any remote-tracking ref** |
|---|---|---|---|
| SOC | `74f9774` | 48 | **10** |
| Cyber AI | `2baba72` | 23 | **12** |
| Fabric | `d38f910` | 13 | **4** |
| Suite LINE 1 | `a3e8cba` | 37 | **24** |
| Suite LINE 2 | `a976a20` | 18 | **5** |
| Suite LINE 3 | `ed95e51` | 16 | **3** |

Total genuinely-new commits across all six candidate refs: **58**, against a naive ahead-count sum
of 155. The SOC case is the most striking and is explained in §3.6.

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

- **38 of SOC's 48 W1 commits are already on GitHub.** Only **10** are new (§2.8).
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

### 3.9 Secret-scan posture, and the one quantified untested risk

| Repository | Tool + pin | Scope | Fail mode | Config |
|---|---|---|---|---|
| SOC | gitleaks `v8.24.3` via `go install` | `detect --source .`, full history, `fetch-depth: 0` | `--exit-code 2`, fail-closed | `--config .gitleaks.toml` |
| Suite | gitleaks `8.30.1` tarball, **sha256 verified** (`551f6fc8…`) | **two** steps: `gitleaks dir .` **and** `gitleaks git .` | `--exit-code 1`, fail-closed | `--config .gitleaks.toml` |
| Cyber AI | gitleaks `v8.24.3` via `go install` | full history | fail-closed | no `--config`; auto-loads root `.gitleaks.toml` |
| Fabric | gitleaks `v8.24.3` via `go install` | full history | fail-closed | **default ruleset, no repo-local config — by design** (`ci.yml:126`) |

Config presence matches each repository's design in all 17 worktrees; **no missing-config failure
is staged.** Suite is the strictest gate (working-tree **and** full-history scan).

**Named residual, quantified and deliberately unresolved:** the gitleaks verdict on the four
**SOSIM fixtures** in `test_shadow_remote_contract.py` on SOC branch `74f9774` is
**unmeasurable without a push or a forbidden local install**. `.gitleaks.toml` disables no rule and
permits no regex or file exception; the only allowlist mechanism is exact fingerprints in
`.gitleaksignore` (34 entries, blob `ae460e1ae5b345758380984dec3c82a5ace160e0`). **That file is not
new at `74f9774`** — it is byte-identical to the copy on live/current `main`, it predates the SOSIM
fixtures, and it was **not** updated by `74f9774`. **It therefore carries no fingerprint for these
new fixtures.** A fail-closed `--exit-code 2` scan over full history is therefore a real,
untested gate that a SOC push would exercise for the first time.

**This packet states that as a risk. It does not predict the outcome.** The plausible failure is a
red SOC `secret-scan` on first push — which, per §3.2, blocks nothing server-side, but which would
be a genuine finding requiring a separate remediation lane.

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
| SOC | **1 line**, 5 branches totally ordered, tip `74f9774` | **none** | fast-forward; 38/48 commits already hosted (§3.6) |
| Cyber AI | **1 line**, 5 branches totally ordered, tip `2baba72` | **none** | fast-forward |
| Fabric | **1 line**, 2 branches ordered, tip `d38f910` | **none** | fast-forward |
| **Suite** | **3 divergent lines** from fork `3ef8e05` | **real** (22/3, 22/1, 3/1) | genuine 3-way integration |

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
   observe CI (§7).

**Buys.** Server-side enforcement exists before any object is published. A mistyped `main` refspec
is *rejected* rather than merely regretted. Red CI can actually block. The §3.2 ruleset residual
closes by measurement instead of inference.

**Costs.** A paid plan. Real elapsed time across five sequenced Founder actions. Every W1 lane
that depends on remote-green evidence — route-DB permanence above all — stays blocked meanwhile.

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

**Buys.** Speed and no purchase. CI runs for the first time on real W1 bytes, which is the only way
to answer the untested SOSIM/gitleaks question (§3.9) and the route-DB permanence question.

**Costs and risks — stated plainly:**

- **Red CI cannot enforce anything.** With zero required checks (§3.7), a red run blocks nothing.
  CI would be observation, not a gate. Any claim that a push is "gated by CI" would be false.
- **A mistyped `main` refspec is catastrophic and unrecoverable server-side.** With `main`
  unprotected in all four repositories (§3.2), `git push origin HEAD:main` would land directly on
  `main` with no check, no review, and nothing able to block it. **Refspec error is the entire risk
  surface**, and human verification is the only control.
- Objects reach GitHub **before** any secret scan runs (§3.10); if the SOSIM fixtures trip
  gitleaks, they will already be published when the red result appears.
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
- The untested SOSIM/gitleaks gate (§3.9) stays untested and keeps growing as a first-push risk.
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
| 2 | Suite | LINE 2 `codex/w1-c1-transport-acceptance-r1` | `a976a20` | 5 | subsumes `3a2c715`, `4d5fb4b` |
| 3 | Suite | LINE 1 `codex/w1-d04-founder-gate-repair-r1` | `a3e8cba` | 24 | control corpus |
| 4 | Fabric | `codex/w1-i07-fabric-r0-domain-r1` | `d38f910` | 4 | subsumes `6f72616`; 5 jobs, no services |
| 5 | Cyber AI | `codex/w1-i06c-http-ingress-r2` | `2baba72` | 12 | subsumes the whole AI chain; 7 jobs, no services |
| 6 | **SOC** | `codex/w1-i04a-shadow-remote-r1` | `74f9774` | 10 | subsumes all five SOC branches — **separate approval gate** |

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
2. **Local secret scan**, if and only if a scanner is already installed — **no install is
   permitted**. If unavailable, record that the scan was **not run** rather than implying it passed.
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
- A green `secret-scan` on the SOC push would be the **first** real measurement of the SOSIM
  fixture risk (§3.9). A red one is a finding requiring its own remediation lane, not a reason to
  retry the push.
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
10. **NO-GO** on treating the SOC push as 48 new commits or as touching no already-published
    history. 38 of 48 are already hosted via `codex/w2j-org-assets-vertical` (§3.6); the push adds
    **10**.

---

## 9. Status and ceiling

| Item | State |
|---|---|
| This packet | `PROPOSED — FOUNDER DECISION REQUIRED`; documentation only |
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
| CI | **NOT WIRED** — no workflow has ever executed the current W1 bytes |

Machine validation for the two W1 control documents (board §13) was run in this session:
`node tools/operations/validate-w1-control.mjs` → `PASS: tasks=48`; `node --test
tools/operations/tests/validate-w1-control.test.mjs` → `tests 77 · pass 77 · fail 0`. **The
validator does not machine-enforce this packet.** It is a static consistency check over the control
documents; it is not product, CI or integration evidence.

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
- Board record: §1.22 (current summary) and §14.30 (bounded detail).
  Register record: §25. Index: `docs/operations/README.md`.
