# Founder Decision Packet — W0-IR01 controlled integration and hosted control gate

- **Prepared:** 2026-07-29
- **Status:** **`DECIDED — OPTION Z — FOUNDER-MANUAL`**, recorded **2026-07-29** (Asia/Ho_Chi_Minh)
  — see §13. *Superseded status, carried as authored: `PROPOSED — FOUNDER DECISION REQUIRED`.*
  **§0–§12 are unchanged by the decision**: every figure, label, provenance item, honest limit,
  NO-GO condition and the independent-review requirement stand exactly as authored.
- **Task:** `W0-D04` (Founder packet authoring), on the `W0-IR01` lane
  ("Re-audit enforceable hosted branch protection/review/check gates";
  board admission `ACTIVE READ-ONLY`; routine integration stays `NO-GO`)
- **Gate opened by this packet:** `G-IR01` — may routine integration stop being Founder-manual?
- **Gate answer:** **No.** `G-IR01` is answered **`NO-GO`** by the selection of Option Z (§13).
- **Decision:** **TAKEN — Option Z**, on **2026-07-29** (Asia/Ho_Chi_Minh), by the
  **Founder-delegated coordinator** under the Founder's delegated authority for this decision
  (§13, §14). The packet as authored asked and did not answer; §13 records the answer, and nothing
  else about the packet is altered by it.
- **Recommendation — historical, as authored; NOT the operative direction:** **Option A**,
  contingent on a Founder purchase decision that this packet does not make, does not price and does
  not authorize. It is preserved unaltered in §6 as this packet's own recommendation, and it was
  **considered and not selected**.
- **Operative selected direction:** **Option Z** — integration stays Founder-manual. No purchase,
  no hosted configuration, no bootstrap, no delegation (§6 Option Z; §13; §14).
- **Lane:** branch `codex/w1-d04-ir01-control-gate-r1`, base
  `eedadc561700d3e1fa052322d44eb63151df0009`, isolated worktree
  `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-d04-ir01-control-gate-r1`
- **Release impact:** none. W1 remains **2026-08-01 → 2026-08-23**, the stable go/no-go remains
  **2026-12-20**, and the release window remains **2026-12-21 → 2026-12-31**. The local
  stack/runtime demo remains **`NO-GO`**.

## 0. What this packet does and does not do

**This packet is documentation only.** It is one untracked Markdown file. It edits no existing
file, stages nothing and commits nothing.

**That remains true after the decision.** §13 and §14 record the `G-IR01` answer inside these same
bytes. Recording a decision is a documentation act: it changed one untracked file and nothing else,
and it enlarges the authorization list below by nothing. The option selected — **Option Z** — is
precisely the option whose execution consists of changing nothing hosted, so the decision's blast
radius is this file.

It authorizes **none** of the following, and nothing in it may be cited as authorization for any
of them:

- no purchase, plan change, billing action or subscription of any kind;
- no repository-settings change, branch-protection change, ruleset creation or bypass-actor change;
- no push, fetch, force-push, ref creation, ref deletion, merge, pull request, tag or release;
- no remote configuration change and no second remote;
- no workflow file authored, moved, merged onto `main`, or enabled;
- no account creation of any kind — human, machine, bot, GitHub App or collaborator invite;
- no dependency install, database migration, deployment, formatter or auto-fixer run;
- no product, runtime or integration writer in any repository.

It **closes no blocker and promotes no gate.** `W0-IR01` remains `ACTIVE READ-ONLY`. Routine
delegated integration remains `NO-GO`.

`G-IR01` (§7) **has now been answered** — **Option Z** (§13) — and that answer is itself a `NO-GO`.
It opens no phase of §8, grants no phase of §8, and leaves the per-action Founder-manual arrangement
in force exactly as before. The clause the packet carried as authored — *"until and unless the
Founder answers `G-IR01` and grants each phase of §8 separately"* — is satisfied only in its first
half: the gate is answered, and it is answered **no**. No §8 grant exists, and none may be inferred
from the answer.

It also does not decide the separate question of *whether specific branches should be pushed*.
That option space is held by the W1 blocker-4 canonical-integration packet
(`docs/operations/W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md`, itself
`PROPOSED — FOUNDER DECISION REQUIRED`). This packet asks the narrower and prior question:
**can a hosted control exist at all, and can integration therefore stop being Founder-manual?**

---

## 1. The one distinction this packet turns on

There are two different things that have both been called "our integration controls", and they are
not comparable in strength.

| | **Hosted enforcement** | **Local honor policy** |
|---|---|---|
| Where it lives | GitHub server side: branch protection, rulesets, required status checks | This repository's `CLAUDE.md`/`AGENTS.md` approval gates, lane discipline, worktree isolation, packet review |
| What it does on violation | **Rejects the operation.** A push to a protected ref fails at the server | **Records that the operation should not have happened.** Nothing is refused |
| Who it binds | Every client, every token, every agent, including an admin if `enforce_admins` is on | Only an actor that reads the rule and chooses to comply |
| Recoverability after violation | The violation never lands | An object that reaches GitHub is published; deletion does not unpublish |
| Current state in all four repositories | **Absent — measured** (§3) | **Present and, so far, honoured** (§4) |

**The governing consequence.** Today the suite has **zero hosted enforcement on any branch of any
of the four repositories, `main` included**. Every safety property of the current arrangement is
supplied by local honor policy and by the fact that integration is **Founder-manual**. Founder-manual
integration is not bureaucracy; on the current plan it is **the only control that exists**.

That is why delegated routine integration cannot be granted as a documentation decision. Delegating
integration removes the only live control while no replacement control exists. `G-IR01` is
therefore, in substance, a question about whether a hosted control can be **bought and configured**
first.

---

## 2. Measurement basis and provenance

All hosted figures in §3 come from the **2026-07-29 read-only audit**: `gh api` `GET` calls only.
No `POST`, `PATCH`, `PUT` or `DELETE` was issued against any GitHub endpoint. No token value was
displayed, logged or recorded. No `git fetch`, `git push` or ref mutation was performed.

Honest limits on that basis, binding on every reader:

1. **A 403 is a non-answer, not a negative answer.** Where an endpoint returned `403`, the honest
   status is **"not visible; inferred absent"**, never "verified absent" (§3.3).
2. **The figures are dated.** They describe hosted state as of **2026-07-29**. They are not a
   prediction about any later date, and any decision executed later must be preceded by a fresh
   read-only re-audit (§9).
3. **Nothing here is CI, runtime, integration or product evidence.** It is hosted configuration
   state and check-run history. Every W1 artifact remains `SCAFFOLD`-class, locally reviewed,
   unmerged and unpushed. **CI: NOT WIRED** for the suite's own gating purposes.
4. **This packet states no identity for itself.** A file cannot contain its own hash. Its hash is
   reported externally by the lane that wrote it (§12). Because the file cannot self-hash, **every
   independent reviewer of this packet must report the exact file blob identity and its SHA-256
   alongside the verdict** — a verdict without a pinned digest does not identify which bytes were
   reviewed (§12).

### 2.1 Durable audit provenance

Recorded so a later reader can re-run the same reads without re-deriving the method. **No token,
credential or secret value is recorded here, and none was displayed or logged during the audit.**

**Label convention, binding on §3 and used throughout.** Every figure in this packet carries one of
exactly two labels:

- **`MEASURED-HERE`** — produced by the 2026-07-29 read-only audit described in this section.
- **`CITED-CORPUS`** — taken from the `W0-IR01B` / W1 blocker-4 corpus, produced by an earlier pass
  under different conditions. A `CITED-CORPUS` figure is **not** current-`main` evidence and may
  never be promoted to one by restatement.

| Provenance item | Value | Label |
|---|---|---|
| Codex task transcript for this lane | `/Users/hoanglinh/.codex/sessions/2026/07/25/rollout-2026-07-25T15-03-27-019f984c-f299-73f0-a19e-64e1eb934ad8.jsonl` | `MEASURED-HERE` |
| Audit client | `gh` version **2.96.0**, dated **2026-07-02** | `MEASURED-HERE` |
| Authenticated account | `hoangclinh` | `MEASURED-HERE` |
| Protocol | `https` | `MEASURED-HERE` |
| Token scopes | `gist`, `read:org`, `repo`, `workflow` | `MEASURED-HERE` |
| Token value | **not recorded, not displayed, not logged — deliberately absent** | — |

**Why the transcript locator reads `2026-07-25` while the audit is dated `2026-07-29`.** The two are
not in conflict and neither is a typo. A Codex rollout filename is stamped at **session start**, not
at the time of any individual task inside it: this lane's session opened on **2026-07-25**, and the
file name is fixed from that moment onward. The **continued task** within that same session — the
one that issued the `GET` calls recorded above and wrote this packet — ran on **2026-07-29**, which
is the date every §3 figure carries. Read the locator as *"where the transcript lives"*, never as
*"when the audit ran"*. If a later reader needs the audit itself, it is the continued task inside
that transcript, not the transcript's opening.

**Read-only GitHub endpoint classes used.** Every call was a `GET`. Each class below was issued
against **each of the four repositories** (`hoangclinh/cybrik-suite`,
`hoangclinh/cybrik-soc-command-center`, `hoangclinh/cybrik-cyber-ai-platform`,
`hoangclinh/cybrik-security-tool-fabric`):

```
GET /repos/{owner}/{repo}
GET /repos/{owner}/{repo}/branches/main
GET /repos/{owner}/{repo}/branches/main/protection
GET /repos/{owner}/{repo}/rules/branches/main
GET /repos/{owner}/{repo}/rulesets
GET /repos/{owner}/{repo}/commits/main/check-runs?per_page=100
```

One account-level read-only call was also issued, once, not per repository:

```
GET /user
```

It returned **`plan: null`** — see §3.1, where that null is the reason no plan name is claimed.

**Local read-only git read.** Workflow presence on the remote default branch (§3.4) was read from
the already-fetched remote-tracking ref, with no network mutation and no `fetch`:

```
git ls-tree -r --name-only origin/main -- .github/workflows
```

**What is deliberately not claimed.** No plan *name* was read from any API field (§3.1). No value in
this section was inferred, rounded or reconstructed from memory; anything not obtained by the calls
above is either labelled `CITED-CORPUS` or is absent from this packet.

---

## 3. Hosted evidence — audited read-only 2026-07-29

### 3.1 Ownership, account type and plan

All four repositories are **private**, on the **personal account `hoangclinh`** — not an
organization (`MEASURED-HERE`, via `GET /repos/{owner}/{repo}` and
`GET /repos/{owner}/{repo}/branches/main`):

| Repository | Visibility | Owner type | Default branch |
|---|---|---|---|
| `hoangclinh/cybrik-suite` | private | personal user account | `main` |
| `hoangclinh/cybrik-soc-command-center` | private | personal user account | `main` |
| `hoangclinh/cybrik-cyber-ai-platform` | private | personal user account | `main` |
| `hoangclinh/cybrik-security-tool-fabric` | private | personal user account | `main` |

Two consequences follow from "personal account, not organization", and both are load-bearing:

- **No org-level rulesets, no org policy, no teams, no CODEOWNERS-by-team.** Every control must be
  configured **per repository**. Four repositories means four configurations, four drift surfaces
  and four re-audits.
- **The review pool is one person.** See §5.

**Plan — deliberately conservative.** `GET /user` returned **`plan: null`** (`MEASURED-HERE`): the
plan object was not populated for this token, so **no plan name was directly measured**. What *is*
measured is the error body GitHub itself returns on the protection endpoints (§3.3), which names the
required upgrade: `"Upgrade to GitHub Pro or make this repository public to enable this feature."`

Exactly two conclusions are licensed by that message, and no third:

1. these private repositories are on a plan **below** the tier at which protection becomes
   available; and
2. the gate is a **plan limitation, not an access gap**.

**This packet does not claim to have measured the current plan name.** Any record stating the
repositories "are on the Free plan" as a measured fact overstates the evidence; the honest form is
*"plan name not directly measured; the protection endpoint names the upgrade required."*

### 3.2 Branch protection on `main` — one measured field, and what follows from it

Exactly **one** row of this table is a directly read field. Every other row is a **conservative
consequence** of that field. The distinction is load-bearing and is stated per row:

| Control | Status | Attribution |
|---|---|---|
| Branch protection on `main` | **`protected = false`** on all four repositories | **`MEASURED-HERE`** — positively readable field on `GET /repos/{owner}/{repo}/branches/main` |
| Required pull-request reviews | **not configured** — presupposes protection | Conservative consequence of `protected = false` |
| **Required status checks** | **no enforceable required-check gate exists** | **Conservative consequence / inference**, *not* a separately enumerated measured list — see the paragraph below |
| `enforce_admins` (include administrators) | **not configured** — presupposes protection | Conservative consequence of `protected = false` |
| Force-push restriction | **not configured** — presupposes protection | Conservative consequence of `protected = false` |
| Deletion restriction | **not configured** — presupposes protection | Conservative consequence of `protected = false` |
| Required linear history | **not configured** — presupposes protection | Conservative consequence of `protected = false` |
| Required signed commits | **not configured** — presupposes protection | Conservative consequence of `protected = false` |

`protected = false` on `main` is a **positively readable field**, not an inference from a 403. It
is the strongest single fact in this packet: **`main` is directly pushable, in all four
repositories, by any client holding a write token, with nothing server-side able to refuse it.**

**Exact attribution for required status checks — do not overclaim.** This packet did **not** obtain
an enumerated list of required status-check contexts and did **not** read a required-contexts array
returning zero entries. The list of required contexts lives on the branch-protection endpoint, and
that endpoint returned **`403`** (§3.3) because it is plan-gated. What is available is:

- **`MEASURED-HERE`:** `protected = false` on `main` in all four repositories.
- **Conservative consequence / inference:** because protection is `false`, and because required
  status checks are a property *of* branch protection, **no required-check gate is in force** — there
  is nothing for a required context to be attached to. This is an inference from a measured field
  plus GitHub's own model, **not** a directly enumerated measured list.

The honest form, binding on every later restatement in this packet and elsewhere:
**"required status checks: no enforceable required-check gate exists — inferred from measured
`protected = false`; the enumeration endpoint is plan-gated (403) and was not read."** The form
*"required checks measured as zero configured"* is **not** licensed and must not be used. The
operational conclusion is unaffected — with no enforceable gate, **every check that reports is
informational** — but the *strength of the evidence* for it must be stated as inference, not as
direct enumeration.

### 3.3 Rulesets — HTTP 403, plan-gated, NOT VISIBLE

The ruleset and protection endpoints return **HTTP 403** with GitHub's own upgrade message:

```
403  {"message":"Upgrade to GitHub Pro or make this repository public to enable this feature."}
```

| Control | Honest status | Why |
|---|---|---|
| Legacy branch protection | **not configured** | 403 on the endpoint **and** `protected=false` on `main` |
| **Rulesets** | **NOT VISIBLE (403). Inferred absent — NOT verified absent** | The endpoint is plan-gated. The `protected=false` signal covers legacy protection, **not** rulesets specifically. Residual uncertainty is low but **non-zero** |
| Ruleset bypass actors | **not visible (403)** | same endpoint class |
| Org-level rulesets | **N/A** | repositories are user-owned, not org-owned (§3.1) |

**This packet does not assert that rulesets are verified absent.** That distinction is repeated as
a binding NO-GO condition (§10, NO-GO 3).

Note also what the 403 message offers as the alternative to purchase: *make this repository
public*. **That alternative is refused.** The `CLAUDE.md` data-handling boundary forbids it, and no
option in §6 contemplates it.

### 3.4 Workflow presence on `origin/main` — asymmetric

Workflow bytes present on the **remote default branch**, read locally and read-only from the
remote-tracking ref with `git ls-tree -r --name-only origin/main -- .github/workflows` — no `fetch`,
no network mutation (`MEASURED-HERE`, §2.1):

| Repository | `.github/workflows/` on `origin/main` |
|---|---|
| `cybrik-soc-command-center` | **present** |
| `cybrik-suite` | **absent** |
| `cybrik-cyber-ai-platform` | **absent** |
| `cybrik-security-tool-fabric` | **absent** |

Only SOC's `main` carries a workflow. The other three carry none. This is not a cosmetic gap; it
is the reason §6 Option A has a bootstrapping phase that must precede enforcement (§4.2).

### 3.5 Check runs at the current `main` SHA

Check runs reported **at the current `main` SHA of each repository**, as at 2026-07-29
(`MEASURED-HERE`, via `GET /repos/{owner}/{repo}/commits/main/check-runs?per_page=100`):

| Repository | Check runs at current `main` SHA | Conclusion |
|---|---|---|
| `cybrik-soc-command-center` | **7** | all `success` |
| `cybrik-suite` | **0** | — no check reports at this ref |
| `cybrik-cyber-ai-platform` | **0** | — no check reports at this ref |
| `cybrik-security-tool-fabric` | **0** | — no check reports at this ref |

The current-`main`-SHA measurement is therefore **7 / 0 / 0 / 0** (`MEASURED-HERE`).

Two readings of this table:

1. It is consistent with §3.4: the only `main` that carries a workflow is the only `main` that
   produces check runs.
2. **`success` here is not a gate.** With no enforceable required-check gate (§3.2 — inferred from
   measured `protected = false`), SOC's seven successes are **informational**. They blocked nothing,
   and a red result would equally have blocked nothing. No record may describe any current check as
   "gating". Note the two claims are separable and must stay separable: *these checks are
   informational* follows from the absence of an enforceable gate; it does **not** rest on, and must
   not be restated as, a directly enumerated "zero required contexts" reading.

#### 3.5.1 The separate corpus figure — `CITED-CORPUS`, not current-`main` evidence

A different, larger check figure exists in the `W0-IR01B` / W1 blocker-4 corpus. It is recorded here
so that a reader who meets it elsewhere does not mistake it for the table above:

| Scope | Figure | Label |
|---|---|---|
| Actual check **instances** over the most recent run per repository | **22** | `CITED-CORPUS` |
| Collapsing to **distinct rendered names** | **19** | `CITED-CORPUS` |
| Per-repository instance breakdown | SOC **8**, Cyber AI **7**, Fabric **5**, Suite **2** | `CITED-CORPUS` |

Binding conditions on that figure:

- It is **`codex/*`-ref run evidence**, measured over the most recent workflow run *per repository*
  on whatever ref last pushed. It is **not** current-`main` evidence, and it is not a refinement of
  the 7 / 0 / 0 / 0 measurement above.
- The two figures answer different questions. **They must not be reconciled**, netted, summed or
  presented as one series.
- **The 19 distinct rendered names must never be used as Phase 3 required-check names.** They were
  rendered on a different ref, under a different run, at a different date. Phase 3 names come only
  from a fresh §9.3 measurement at the `main` SHA that will actually be protected (§4.2, §4.4).
- The instance-to-name collapse (22 → 19) is **as recorded in that corpus**; this packet does not
  recompute it and does not assert which names collapsed.

---

## 4. What the evidence means

### 4.1 There is nothing to delegate integration *to*

Delegated routine integration presupposes a mechanism that can refuse a bad integration. §3.2
establishes that no such mechanism exists at any layer:

- a wrong refspec landing on `main` is accepted, not rejected;
- a red check does not block, because no enforceable required-check gate exists (§3.2);
- an unreviewed change is not stopped, because no review is required;
- a force-push or a branch deletion on `main` is permitted;
- an admin — the only account — is bound by nothing, because `enforce_admins` presupposes
  protection.

Consequently the honest description of today's arrangement is: **integration safety is one
person's manual care, backed by written policy.** That is a real control and it has held. It is
not a hosted control, it does not survive delegation, and it cannot be strengthened by writing
another document — including this one.

### 4.2 Required checks cannot be configured first — the ordering is not stylistic

There is an ordering constraint that survives any plan purchase, and getting it wrong produces a
repository that cannot be merged into at all.

A required status check binds **by rendered check name on the protected ref**. If a check name is
marked required on `main` but **nothing ever reports a check of that name on `main`**, GitHub does
not treat it as passed and does not treat it as failed — the pull request sits indefinitely at
*expected / waiting for status to be reported*, and **merge is blocked forever**.

§3.4 and §3.5 say exactly this risk is live for three of four repositories: Suite, Cyber AI and
Fabric have **no workflow on `main`** and **zero check runs at the current `main` SHA**. Marking
any check required on those three today would deadlock them.

Hence the ordering in Option A, and the reason **workflow-on-main bootstrapping is a separately
authorized phase** rather than a detail of the enforcement phase:

1. plan first (else no protection endpoint accepts a write at all);
2. **workflow on `main` next, under its own grant** — for **Suite, Cyber AI and Fabric only**, since
   SOC's `main` already carries one (§3.4) — because getting a workflow onto `main` requires an
   operation *into* `main`, which is far cheaper before protection exists than after;
3. enforcement only once checks are **observed actually executing and reporting `success` at the
   `main` SHA** in **all four** repositories (§3.5 re-measured under §9.3; a non-zero *count* is not
   sufficient — see §4.4). Those observations come from the **pre-existing SOC workflow together
   with the step-2 bootstrap**: step 2 covers three repositories and produces nothing on SOC;
4. verification last, including a deliberate direct-push rejection test (§9.5).

A second trap, carried forward and re-stated because it is cheap to get wrong: **required-check
names are rendered check names, not workflow job IDs.** A `name:` override changes what must be
configured. Configuring a job ID produces a required check that never matches and never reports —
i.e. the same permanent deadlock, arrived at from a different direction. Every name used in a
future enforcement phase must be taken from a **measured** check-run listing at the ref that will
actually be protected, never from reading a workflow file.

A third trap lives in the *content* of a rendered name rather than its source: a name that embeds a
**mutable tool or version token** is a fragile binding that a routine tool upgrade silently breaks.
It gets its own binding stop condition in **§4.6**.

### 4.3 What a purchase does and does not buy

**Buys:** the protection and ruleset endpoints stop returning 403, so `enforce_admins`, required
checks, no-force-push, no-deletion and linear history become configurable; and the ruleset
endpoints become readable, which retires the §3.3 "inferred absent" residual **by measurement
instead of inference**.

**Does not buy:** a second human reviewer (§5); any workflow on any `main` (§3.4); any check
result; correctness of any W1 artifact; closure of any existing blocker held by any other lane. A
plan upgrade is a *precondition* for hosted enforcement. It is not itself enforcement, and on its
own it changes nothing observable.

### 4.4 A non-zero check count is not the Phase 3 gate — execution and `success` are

§4.2 step 3 is stated in terms of checks *reporting*, and that must not be softened into a count.
The Phase 3 entry condition is:

> For each repository, at the **current `main` SHA**, one or more checks that **actually executed**
> and reported **`conclusion: success`**, whose **rendered names** were captured in the same pass.

**Excluded from that count, without exception:**

- **Jobs suppressed by `if: false`** (or by any always-false condition, `workflow_dispatch`-only
  gating, or a job-level guard that never evaluates true on `main`). A suppressed job may still
  surface as a check entry, but it executed nothing and asserted nothing. Counting it would mark a
  check required that will never report `success` on a real push — the §4.2 permanent deadlock,
  reached through a fourth route.
- Any check whose conclusion is `skipped`, `neutral`, `cancelled`, `stale` or `action_required`.
- Any check reported at a ref other than the `main` SHA being protected.

**The general rule is measurement-based, not name-based.** Exclusion is decided by what the fresh
§9.3 pass observes at the current `main` SHA — did this check *actually execute*, and did it report
`conclusion: success`? — and by nothing else. No name is permanently blessed and no name is
permanently banned.

**Two corpus-ref examples, `CITED-CORPUS`.** Two `cybrik-soc-command-center` job names are recorded
below purely as **worked examples of the shape** the §9.3 pass must catch. Their suppression is a
**`CITED-CORPUS`** fact taken from the W1 blocker-4 canonical-integration packet, **§3.8**
(`docs/operations/W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md`), produced by an earlier pass under
different conditions. It is **not** `MEASURED-HERE`, and this packet makes **no claim about the state
of these jobs on the current `main` SHA**:

| Corpus-ref SOC job name | Corpus fact (blocker-4 §3.8) | Label | Consequence |
|---|---|---|---|
| **`e2e-org`** | recorded `if: false` — authored bytes that never execute | `CITED-CORPUS` | Example only. Not evidence of a pass; not a required-check candidate on this basis |
| **`alert-context-route-db`** | recorded `if: false` — authored bytes that never execute | `CITED-CORPUS` | Example only. Not evidence of a pass; not a required-check candidate on this basis |

Neither name may be counted toward the Phase 3 gate, cited as a passing check, or configured as a
required check **unless the fresh §9.3 pass observes it actually executing and reporting `success` at
the `main` SHA being protected** — at which point it is an ordinary §9.3 candidate on its measured
rendered name, on equal terms with every other, and the corpus fact above is simply superseded
(§4.5). Conversely, a job **not** named here is not thereby cleared: any job the fresh pass finds
suppressed is excluded on the same rule.

### 4.5 Supersession of corpus check names

If **both** this packet and the W1 blocker-4 canonical-integration packet are accepted, their check
figures do not merge. The rule is one-directional:

> **Fresh current-`main` rendered names, captured in the §9.3 pass that immediately precedes Phase 3
> — after the Phase 2 bootstrap has landed, but measured by §9.3 rather than produced by Phase 2 —
> supersede the blocker-4 `codex/*`-ref `CITED-CORPUS` names for all required-check configuration
> purposes.**

Consequences, binding:

- Required-check configuration is **per repository** and uses **fresh rendered names only** —
  measured at that repository's own current `main` SHA, in the §9.3 pass that immediately precedes
  Phase 3.
- The `CITED-CORPUS` names (§3.5.1) retain their value as *history* for the blocker-4 decision. They
  have **no configuration authority** here.
- Supersession is not reconciliation. Nothing is merged, mapped or diffed between the two sets; the
  corpus set is simply not consulted when Phase 3 runs.

### 4.6 Version-bearing rendered check names — a binding pre-Phase-3 stop condition

A rendered check name is an **exact string match** on the protected ref. That makes any name
carrying a **mutable tool or version token** a fragile required-context binding, and it fails in
both directions:

- **Upgrade the tool → the rendered name changes.** The configured required context is now a name
  nothing reports. The pull request sits at *expected / waiting for status to be reported* and
  **merge is blocked forever** — the §4.2 permanent deadlock, reached through a fifth route, and
  reached by a routine maintenance action nobody thought of as a protection change.
- **Or the new name is simply not required.** If the old context is removed to unblock merging, the
  new name is unrequired, and **enforcement silently lapses** while the configuration still *looks*
  configured. That is the worse failure, because nothing surfaces it.

**The known example — `CITED-CORPUS`, illustration only.** The W1 blocker-4 canonical-integration
packet records, as a Suite rendered check name on a `codex/*` ref, **`secret-scan (gitleaks
8.30.1)`** (`docs/operations/W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md` §3.7, which flags the
embedded version as a trap in its own right). That name embeds the tool version **inside the
rendered name itself**. It is cited here **only to show the shape**: it is `CITED-CORPUS`, it is not
current-`main` evidence, it carries no configuration authority (§4.5), and this packet makes no
claim about what Suite renders on its current `main` SHA.

**The stop condition, binding, fail-closed:**

> **No rendered check name containing a mutable tool or version token may be configured as a
> required status check.**

If the **fresh §9.3 measurement** at the `main` SHA that will actually be protected yields such a
name, then for that repository **Phase 3 is `NO-GO`** — not "configure it and watch it", not
"configure it with a note". Phase 3 for that repository may open only after **all** of the
following, in order:

1. A **separately authorized** Phase-2-class workflow change gives that check a **stable rendered
   name** — one that does not move when the tool is upgraded — with the **tool version remaining
   pinned elsewhere** (in the workflow file, a lockfile, an action ref or a checksum), so that
   pinning strength is preserved and only the *name* stops encoding it. Version pinning is not
   relaxed by this; it is **relocated out of the rendered name**.
2. That stable name **actually executes and reports `conclusion: success` on the current `main`
   SHA** — authored bytes, a green run on some other ref, or a name merely *expected* to render are
   all insufficient.
3. A **fresh §9.3 pass** captures the new stable rendered name at that same current `main` SHA.

**Only the newly measured stable rendered name may then be required.** Not the old version-bearing
name, not the name as written in the changed workflow file, and not a name predicted from the
change — the §4.2 job-ID trap and the §4.5 supersession rule both apply to it unchanged.

**Recognition rule, fail-closed.** Treat a rendered name as version-bearing if it contains a
semantic version, a `v`-prefixed version, a date stamp, a build or run number, a digest fragment, or
any other token that would change when the underlying tool is upgraded. **If it is unclear whether a
token is mutable, treat the name as disqualified** and take the remediation path above. A wrongly
disqualified name costs one workflow-naming change; a wrongly accepted one costs a deadlocked
repository or a silently lapsed gate.

**This packet does not authorize that workflow change.** Authoring, changing or landing any workflow
is Phase 2 authority (`G-IR01-6`) and requires its own separate Founder grant; §0 forbids it
outright on this packet's authority, and the *content* of any such change is out of scope here.
Nothing in this subsection may be read as approving a workflow edit — it states only what must have
happened, and been measured, before Phase 3 may open.

---

## 5. The solo-reviewer problem, stated exactly

Required pull-request review is the control most people mean by "reviewed before merge". **On a
single-person account it does not work as a merge gate**, for a structural reason:

- GitHub does not let the author of a pull request satisfy that pull request's own required
  approval. Self-approval is not counted.
- The account is the only account with access to these four private repositories (§3.1: personal
  account, no organization, no teams).
- Therefore configuring `required_approving_review_count ≥ 1` makes every pull request
  **unmergeable by construction** — the same permanent-block failure mode as §4.2, from a third
  direction.

Three honest ways forward, and what each costs. **This packet selects none of them and invents no
account.**

| Path | What it is | Cost / condition |
|---|---|---|
| **5a — machine check as the reviewer (preferred within Option A)** | **Explicitly configure a required-pull-request rule/object** on `main` **and** set `required_approving_review_count = 0` inside it, putting the enforcement weight on **required status checks** plus `enforce_admins`. A pull request is then genuinely required, force-push and deletion are refused, and merge is blocked until named checks report `success`. The gate is a machine, not a person | Requires §4.2/§4.4 ordering to have completed. Gates only what the checks actually assert — a check suite is a real control, but it is not a substitute for human judgement on design |
| **5b — a second reviewing identity** | Any of: a second human collaborator; a machine/bot account; a GitHub App authorized to submit reviews | **Not proposed and not assumed here.** No such account exists today, and this packet neither creates one nor presumes one. It would be its own Founder decision with its own access, credential-custody, offboarding and data-boundary review — and `CLAUDE.md` credential rules bind it |
| **5c — no review gate; keep human review out-of-band** | Do not configure required reviews at all; keep review as the existing packet-review discipline, and let hosted enforcement cover only mechanical properties | Honest and cheap, but then **no hosted control asserts that anything was reviewed**. Records must say so plainly and must never claim "review-gated" |

**The count-`0` trap, stated so it is not repeated.** "Review count `0`" is **not** the same as "no
review rule". If no required-pull-request rule/object is configured at all, there is nothing
requiring a pull request, and a direct push to `main` is refused only by whatever other rule happens
to refuse it. Under 5a the required-pull-request object must be **present**, with its approval count
set to `0` — presence supplies the *pull-request-required* property; the `0` merely declines to
demand an approval that no second account could supply. Both facts are verified separately in §9.4.

**Binding wording rule.** Under 5a or 5c, no record — packet, board, register or commit message —
may describe a merge as "review-gated" or "peer-reviewed". The accurate phrasing is
**"check-gated, self-authored"**. Only 5b would license stronger wording, and 5b does not exist.

---

## 6. Option set — `G-IR01`

Exactly two options are put to the Founder. Neither is taken by this packet **as authored**; the
selection between them is recorded separately in **§13**, and the two texts below are preserved
unaltered as the material the selection was made on.

> **Selection made 2026-07-29 (§13): Option Z.** Option A below is retained as the packet's own
> historical recommendation. It is **not** the operative direction, and no step of it is authorized,
> begun, or scheduled.

### Option A — buy the control, bootstrap it, configure it, verify it (**RECOMMENDED BY THIS PACKET AS AUTHORED — CONSIDERED AND NOT SELECTED, §13**)

**Shape — each numbered step is a separate Founder action requiring its own explicit approval:**

1. **Explicit Founder approval for a GitHub Pro purchase** covering the four private repositories
   (or an equivalent plan that lifts the §3.3 gating). *This is a purchase decision.* This packet
   does not perform it, does not authorize it and does not price it. Making any repository public
   as an alternative is **refused** (§3.3, NO-GO 4).
2. **Separately authorize workflow-on-`main` bootstrapping** for the three repositories whose
   `main` carries no workflow — Suite, Cyber AI, Fabric (§3.4). This is a distinct grant with a
   distinct blast radius: it means an operation landing workflow bytes on `main`. It must happen
   **before** enforcement, for the §4.2 deadlock reason, and it is far cheaper before protection
   exists than after. **Nothing in this packet authorizes it**, and the content of any such
   workflow is out of scope here.
3. **Confirm checks actually execute and succeed at the `main` SHA.** Re-measure §3.5 read-only
   under §9.3. The gate to proceed is **one or more actually executed checks reporting
   `conclusion: success` at the current `main` SHA in all four repositories** — **not** a non-zero
   check count. Note the source of those checks differs by repository: SOC's `main` **already**
   carries a workflow (§3.4), so SOC's checks come from that pre-existing workflow, while Suite,
   Cyber AI and Fabric depend on step 2's bootstrap. **The pre-existing SOC workflow and the step-2
   bootstrap must, between them, produce fresh actually-executed successful checks on all four
   current `main` SHAs** — step 2 by itself produces nothing on SOC and is not claimed to.
   **Suppressed jobs are excluded by measurement**, on the §4.4 rule (the corpus-ref examples
   `e2e-org` and `alert-context-route-db` show the shape; they are `CITED-CORPUS` and are not a
   claim about current `main`). Capture the exact **rendered** names for step 4; they are **fresh
   current-`main` names** and they supersede any `CITED-CORPUS` name (§4.5).
   Then, **before step 4 and as part of step 3**, **screen every captured name for a mutable
   tool/version token (§4.6)**. This is a **stop condition**, not an advisory: if any captured name
   embeds a tool or version token, **step 4 is `NO-GO` for that repository** until a **separately
   authorized** Phase-2-class workflow change gives the check a **stable rendered name** (tool
   version still pinned, but pinned outside the name), that stable name **actually executes and
   reports `success` on the current `main` SHA**, and a **fresh §9.3 pass** captures it. Only the
   newly measured stable name may then be required. **This packet does not authorize that workflow
   change.**
4. **Configure enforcement on `main`, per repository, all four:**
   a **required-pull-request rule/object present** with `required_approving_review_count = 0` under
   §5a; `enforce_admins` on; **required status checks** bound to the fresh rendered names measured
   in step 3 **and cleared by the §4.6 version-token screen**; **force-push refused**; **deletion
   refused**; **linear history required**. The
   enforcement weight remains **machine checks plus `enforce_admins`** — the review object supplies
   the *pull-request-required* property, not a human gate. 5b is not assumed.
5. **Re-audit read-only and test the control by trying to break it** (§9), including an explicit
   **direct-push rejection test**: attempt a direct push to `main` and require that the **server
   rejects it**. That test is **executed by the Founder personally**, uses a **deliberately
   zero-content throwaway commit**, and requires **its own explicit authorization at execution
   time**, granted only after every read-only enforcement check in §9.4 has passed. It is **not
   inherently safe** — see §9.5. A control that has not refused anything has not been demonstrated
   to work.

**Buys.** A control that exists independently of anyone's care. A mistyped `main` refspec is
*rejected* rather than merely regretted. A red check can actually block. The §3.3 ruleset residual
closes by measurement. Only after step 5 passes does the question "may integration be delegated?"
have a defensible basis at all.

**Costs.** A paid plan, on four private repositories. Real elapsed time across five sequenced
Founder actions, each with its own approval latency. Every lane awaiting remote evidence stays
blocked meanwhile.

**Risks.** Cost, and schedule pressure if any step is slow. Three configuration traps: two produce a
**permanently unmergeable repository** if the ordering or the naming is wrong (§4.2, §5), and a third
— a required context bound to a **version-bearing rendered name** (§4.6) — either deadlocks the
repository on the next tool upgrade or lets **enforcement silently lapse**. All three are recoverable
by an admin edit; the first two look like a broken repository until diagnosed, and the third may not
look like anything at all, which is why §4.6 screens for it before Phase 3 rather than after. **No new
technical risk to any artifact is introduced**; Option A strictly increases control.

**What Option A still does not grant, even if fully executed.** **Option A is a precondition and
only a precondition.** Completing steps 1–5 does **not** by itself flip `W0-IR01`, does **not**
grant delegated integration, and does **not** authorize any push, merge or release. Delegation is a
further, separate Founder decision taken on the verified evidence of step 5 (§8, **Phase 5**), which
remains a distinct decision requiring its own packet.

**This packet grants no purchase, configuration, push, merge or release authority whatsoever** —
not by recommending Option A, not by describing any phase, and not by any answer in §7. Selecting
Option A selects a *direction*; each step is authorized separately or not at all (§8).

### Option Z — keep integration Founder-manual; `G-IR01` answered **NO-GO** (**SELECTED 2026-07-29 — §13**)

**Shape.** Change nothing hosted. No purchase, no settings change, no workflow onto `main`, no
account. `W0-IR01` stays `ACTIVE READ-ONLY`. Routine delegated integration stays **`NO-GO`**.
Every integration step continues to require an explicit, per-action Founder decision, executed
manually.

**Buys.** Zero cost. Zero new risk. Complete reversibility. It is also the **only honest option if
the purchase is not approved** — because with §3.2 measured as it is, delegating integration
without hosted enforcement would remove the sole live control and replace it with nothing.

**Costs.** The control surface stays at local honor policy indefinitely (§1). Manual integration
stays a per-action Founder bottleneck and does not scale with the number of lanes. The §3.3 ruleset
residual stays open, so no record can ever state that protections are *verified* absent. Any lane
whose evidence requires remote state stays blocked, and none of that changes by waiting.

**Risks.** No new technical risk. The standing risk is unchanged and simply persists: a single
mistyped refspec against an unprotected `main` is accepted by the server and is not recoverable
server-side.

**Option Z is a legitimate outcome, not a failure state.** Choosing it is choosing to keep a
control that demonstrably works, rather than to buy one that has not yet been demonstrated.

**This is the selected option (§13).** Selecting it is a positive, controlled posture, not a
deferral and not an absence of a decision: it holds every integration action at an **explicit
per-action Founder or coordinator grant, executed manually**. The costs and risks stated immediately
above are accepted as stated — including the persisting standing risk of an unprotected `main`, and
including the fact that the §3.3 ruleset residual stays open and unmeasured.

---

## 7. Exact `G-IR01` decision questions

Each question is answered **yes** or **no**. A `yes` grants only what its own row states and
nothing adjacent. A `no` is a complete answer and needs no justification.

| Gate | Question | If `yes` |
|---|---|---|
| **G-IR01-1** | Do you accept §1 as the governing frame — that hosted enforcement and local honor policy are **not** interchangeable, and that today only the latter exists? | The frame is accepted as the basis for every later row. Nothing operational follows |
| **G-IR01-2** | Do you accept the §3 evidence as recorded, on the §2.1 provenance and its `MEASURED-HERE` / `CITED-CORPUS` labels — private personal-account repositories; plan name **not** directly measured (`plan: null`); `main` `protected=false` (**`MEASURED-HERE`**); **no enforceable required-check gate — a conservative consequence of that measured field, not a separately enumerated measured list**, since the enumeration endpoint is plan-gated (§3.2, §3.3); ruleset endpoints 403 and therefore **NOT VISIBLE / inferred absent**; workflow on `origin/main` in SOC only; check runs at current `main` SHA of **7 / 0 / 0 / 0** (`MEASURED-HERE`), kept separate from the §3.5.1 corpus figure (`CITED-CORPUS`)? | The evidence stands as the decision basis, with the §2 limits, the §3.2 measured-vs-inferred attribution, the §3.3 "not verified absent" reservation and the §3.5.1 non-reconciliation rule intact |
| **G-IR01-3** | Do you accept that, with no enforceable required-check gate (§3.2), **no** current or past check result may be described as gating anything (§3.5)? | The wording rule binds every record, retroactively and going forward — and records state the absence as **inferred from measured `protected = false`**, never as a directly enumerated "zero required contexts" reading |
| **G-IR01-4** | Do you choose **Option A** (buy, bootstrap, configure, verify) or **Option Z** (keep integration Founder-manual, `G-IR01` `NO-GO`)? | The selected option becomes the lane's direction. **Selecting A grants no step of A** — each step is granted separately per §8 |
| **G-IR01-5** | *(Option A only)* Do you give **explicit approval to purchase GitHub Pro** for the four private repositories, as a purchase decision made by you, outside this packet? | Phase 1 (§8) opens. No configuration authority follows |
| **G-IR01-6** | *(Option A only)* Do you **separately authorize workflow-on-`main` bootstrapping** for Suite, Cyber AI and Fabric, ahead of any enforcement, for the §4.2 deadlock reason? | Phase 2 (§8) opens, as its own grant, with its own scope and its own review of what those workflows contain |
| **G-IR01-7** | *(Option A only)* Do you authorize configuring, on `main` in all four repositories: a **required-pull-request rule/object**, `enforce_admins`, required status checks bound to **fresh measured rendered names**, force-push refused, deletion refused, linear history required? | Phase 3 (§8) opens — **only** after a fresh §9.3 pass observes **actually executed checks reporting `success` at all four current `main` SHAs**. Phase 2 bootstraps workflows on `main` in **Suite, Cyber AI and Fabric only**; SOC's `main` already carries a workflow (§3.4), and Phase 2 produces no checks there. The **pre-existing SOC workflow together with Phase 2** must yield those fresh successful checks across all four. Suppressed jobs are excluded **by measurement** (§9.3, §4.4), and every captured name must clear the **§4.6 version-token screen** — a version-bearing name makes Phase 3 `NO-GO` for that repository |
| **G-IR01-8** | *(Option A only)* Do you adopt **§5a** — a required-pull-request object **present** with `required_approving_review_count = 0`, with required status checks plus `enforce_admins` carrying the enforcement weight, and **no** new account created? | 5a is the configured shape; **5b is explicitly not assumed**, and every record uses "check-gated, self-authored" rather than "review-gated" |
| **G-IR01-9** | *(Option A only)* Do you require that the control be **demonstrated by rejection** — a deliberate direct-push-to-`main` attempt that the server must refuse — before any record calls `main` protected, on the terms of §9.5 (**Founder personally the only executor; zero-content throwaway commit; a further explicit authorization at execution time**)? | The §9.5 rejection test becomes mandatory but **not yet authorized** — §9.5 still requires its own grant once §9.4 passes. Absent a refusal, protection is `CONFIGURED — NOT DEMONSTRATED` |
| **G-IR01-10** | Do you confirm that answering these questions **does not** flip `W0-IR01`, **does not** grant delegated routine integration, and **does not** authorize any push, fetch, merge, PR, release, dependency install or product writer — and that delegation remains a separate future decision on §9 evidence? | The scope limit is recorded. `W0-IR01` stays `ACTIVE READ-ONLY` and routine delegated integration stays `NO-GO` regardless of every other answer above |

**Sequencing rule.** G-IR01-5 through G-IR01-9 are answerable only if G-IR01-4 selects Option A. If
G-IR01-4 selects Option Z, rows 5–9 are recorded as `N/A — Option Z`, and rows 1, 2, 3 and 10 still
stand as answered.

**Answered 2026-07-29.** The questions above are the questions as put; **§13.1 carries the recorded
answers** and is the authoritative record of what was answered. G-IR01-4 selected **Option Z**, so
the sequencing rule applies in its second branch: rows 5–9 are `N/A — Option Z`, and rows 1, 2, 3
and 10 stand answered. The wording of the questions themselves is unchanged.

---

## 8. Phased authority ladder

Authority is granted **one phase at a time**. Completing a phase never opens the next; only an
explicit Founder grant does. No phase may be started on the strength of this packet.

| Phase | Content | Authority source | Reversible? |
|---|---|---|---|
| **Phase 0 — now** | This packet exists as a docs-only record. Read-only audit only | Already in effect; nothing granted | Fully — it is one untracked file |
| **Phase 1 — purchase** | Founder purchases GitHub Pro (or an equivalent plan lifting §3.3 gating) for the four private repositories | **G-IR01-5**, executed by the Founder personally | Yes — a plan may be downgraded; cost already spent |
| **Phase 2 — bootstrap** | Land a workflow on `main` in **Suite, Cyber AI, Fabric** — the three whose `main` carries none (§3.4). **SOC is out of Phase 2 scope**: its `main` already carries a workflow, and Phase 2 produces no checks there. Scope, content and mechanism reviewed on their own merits, not assumed here | **G-IR01-6**, a distinct grant | Partly — bytes on `main` are published; revert is a further change, not an erasure |
| **Phase 3 — configure** | Per repository on `main`: a **required-pull-request object present** with `required_approving_review_count = 0` (§5a), `enforce_admins`, required checks by **fresh measured rendered name**, no force-push, no deletion, linear history | **G-IR01-7**, and only after **all three** prerequisites hold: (i) a fresh §9.3 pass observes **actually executed checks reporting `success` at all four current `main` SHAs** — produced by the **pre-existing SOC workflow together with the Phase 2 bootstrap**, since Phase 2 covers only Suite/Cyber AI/Fabric — and a non-zero count is not the gate; (ii) suppressed jobs are excluded **by measurement** on the §4.4 rule (`e2e-org` and `alert-context-route-db` are `CITED-CORPUS` examples of the shape, not a current-`main` claim); (iii) **every captured name clears the §4.6 version-token screen** — a name carrying a mutable tool/version token makes Phase 3 **`NO-GO`** for that repository until a separately authorized Phase-2-class workflow change yields a **stable rendered name** that then actually executes successfully on the current `main` SHA and is re-measured | Yes — settings are editable by the admin |
| **Phase 4 — verify** | Full §9 read-only checklist; then, and only if §9.4 passes, the §9.5 rejection test under its own further authorization | **G-IR01-9** for the requirement; §9.5 needs a **separate execution-time grant**. Read-only except the deliberate push attempt | Read-only portion fully. The push attempt is reversible **only if the server refuses it** — see §9.5 |
| **Phase 5 — reconsider delegation** | A **new** Founder decision, on Phase 4 evidence, on whether routine integration may stop being Founder-manual | **Not granted by this packet, not granted by Option A, and not pre-approved by any answer in §7.** Requires its own packet and its own decision | — |

**Phase-skipping is a NO-GO** (§10, NO-GO 6). In particular Phase 3 before Phase 2 produces the
§4.2 permanent deadlock, and Phase 5 without Phase 4 is delegation on an undemonstrated control.

**Ladder state after the §13 decision.** Phases 1–5 are an Option A ladder. Option Z was selected,
so **the arrangement stands at Phase 0 and no phase above it is open, granted, begun or scheduled.**
The ladder is retained because it is the shape any future Option A reconsideration would have to
follow — and such a reconsideration is itself a new decision on fresh measurement (§13.4), never a
resumption of this one.

---

## 9. Read-only verification checklist

To be executed as a **fresh** read-only pass at the time of any future decision — not now, and
never as a substitute for re-measurement. Every item below is a `GET`. §9.5 is the sole exception
and is discussed there.

**9.1 — Ownership, visibility, account type.** For each of the four repositories, confirm:
private; owner is the personal account `hoangclinh` and **not** an organization; default branch
`main`; not a fork; not archived. *Expected today (§3.1): all four private, personal-account.*
*Expected after Phase 1: unchanged — a plan change does not alter ownership.*

**9.2 — Protection and ruleset visibility.** For each repository, `GET` the branch-protection,
branch-rules and rulesets endpoints for `main`. *Expected today (§3.3): `403` with the upgrade
message on all twelve calls.* *Expected after Phase 1: **`200`, not `403`** — this is the single
sharpest test that the plan gate actually lifted. A continuing `403` after purchase means Phase 1
did not achieve its purpose and Phase 3 must not start.* Additionally confirm rulesets are now
**readable**, retiring the §3.3 "inferred absent" residual by measurement.

**9.3 — Checks at the `main` SHA: execution and conclusion, not count.** For each repository,
resolve the current `main` SHA and list check runs **at that SHA**. Record, per check: whether it
**actually executed**, its **conclusion**, and its **exact rendered name**.
*Expected today (§3.5): 7 / 0 / 0 / 0 — `MEASURED-HERE`.*

*Required before Phase 3, in **all four** repositories:* **at least one check that actually executed
and reported `conclusion: success`** at that SHA. A non-zero check *count* does **not** satisfy this
item.

*Where those checks come from — do not misattribute.* Phase 2 bootstraps workflows on `main` in
**Suite, Cyber AI and Fabric only**. **SOC's `main` already carries a workflow (§3.4), and Phase 2
produces no checks on SOC.** The requirement is therefore joint: **the pre-existing SOC workflow and
the Phase 2 bootstrap must, between them, yield fresh actually-executed successful checks at all
four current `main` SHAs.** No record may state that Phase 2 itself produces checks on SOC.

Exclude, and record as excluded:

- **`if: false`-suppressed jobs and any always-false-guarded job.** Exclusion is decided **by what
  this pass measures at the current `main` SHA**, not by a name list. As worked examples of the
  shape, the W1 blocker-4 packet §3.8 records **`e2e-org`** and **`alert-context-route-db`** in
  `cybrik-soc-command-center` as `if: false` (`CITED-CORPUS` — **not** a claim about the current
  `main` SHA). Neither is a required-check candidate on that basis; either becomes an ordinary
  candidate if and only if **this pass** observes it actually executing and reporting `success` at
  the `main` SHA (§4.4). A job absent from that pair is not thereby cleared — the same measurement
  rule excludes it if this pass finds it suppressed.
- Any check concluding `skipped`, `neutral`, `cancelled`, `stale` or `action_required`.

**Then screen the surviving names for mutable tool/version tokens (§4.6) — a stop condition.** Record
the screen result per name. **A rendered name containing a semantic version, a `v`-prefixed version,
a date stamp, a build/run number, a digest fragment, or any token that would change on a tool
upgrade is disqualified from required-check configuration**, and where the token's mutability is
unclear the name is **treated as disqualified** (fail-closed). If any surviving name is disqualified,
**Phase 3 is `NO-GO` for that repository** until a **separately authorized** Phase-2-class workflow
change gives the check a **stable rendered name** with the tool version pinned outside the name, that
stable name **actually executes and reports `success` on the current `main` SHA**, and **this §9.3
pass is re-run** to capture it. Only the newly measured stable name may then be required. **This
packet authorizes no such workflow change.**

The rendered names captured here — not job IDs, not names read from a workflow file, and **not** the
`CITED-CORPUS` names of §3.5.1 — are, **once they have cleared the §4.6 screen**, the only legitimate
input to the Phase 3 required-check configuration. These fresh names **supersede** any corpus name
(§4.5), and configuration is **per repository** using that repository's own fresh names.

**9.4 — Enforcement state after Phase 3.** For each repository, confirm on `main`:

- `protected = true`;
- **a required-pull-request rule/object is present** — verify the object itself exists, not merely
  that a count field reads `0` (§5a);
- **`required_approving_review_count = 0`** inside that object, matching the **G-IR01-8** answer;
- `enforce_admins` enabled;
- required status-check contexts **exactly** the fresh rendered names from §9.3 **that cleared the
  §4.6 version-token screen** — and **no configured context carrying a mutable tool/version token**;
- force-push disallowed; deletion disallowed; linear history required.

A **missing** required-pull-request object is a stop condition even if every other row passes: with
no such object there is no pull-request requirement to enforce, and the §5a shape has not been
achieved. So is any mismatch between a configured context and a §9.3 rendered name. So is **any
configured context carrying a mutable tool or version token** — it must not have been configured at
all (§4.6), and finding one here means the §9.3 screen was skipped or overridden: remove it and
return to §9.3 rather than filing it as a warning. All three are **stop conditions**, not warnings.
The enforcement weight remains **machine checks plus `enforce_admins`**;
the `0` count means this configuration is **"check-gated, self-authored"** and must never be
recorded as review-gated (§5).

**9.5 — Rejection test (the one non-`GET` item) — not inherently safe**

Attempt a direct push to `main` and require the **server to reject it**.

**This step is not inherently safe, and this packet does not describe it as safe.** Its safety is
entirely contingent on a protection that has not yet been demonstrated — that is the whole point of
running it. **A broken, misconfigured or bypassable protection can allow the push to land.** The
test must therefore be constructed so that landing is survivable, and authorized as if landing were
a real possibility, because it is.

Binding conditions on execution:

1. **Executor: the Founder personally, and no one else.** No agent, no delegate, no automation, no
   CI job and no lane may perform this push or any part of it. There is no exception.
2. **Payload: a deliberately zero-content throwaway commit, and nothing else.** It must contain **no
   file content change** — an empty, disposable commit whose only purpose is to be refused. Never
   use real work, a real branch tip, a merge, a tag, a force-push, or any commit anyone would want
   to keep.
3. **Authorization: its own explicit grant, at execution time.** The **G-IR01-9** answer records
   that the test is *required*; it does **not** authorize running it. A **further explicit Founder
   authorization** is needed, granted **only after every read-only enforcement check in §9.4 has
   passed**. Running it before §9.4 passes is a NO-GO (§10, NO-GO 13).
4. **Scope: one repository at a time**, each with its own authorization. Anything touching
   `cybrik-soc-command-center` remains its own approval gate (§10, item 11).

**Incident procedure if the push lands.** If the server accepts it, this is **not** a test result to
be filed; it is an **incident**:

1. **Stop.** Perform no further pushes, no clean-up push, no force-push and no deletion. Do not
   attempt to "undo" the commit by pushing again — the object is already published, and a second
   write compounds the exposure without unpublishing the first.
2. **Record the incident immediately**: repository, `main` SHA before and after, the landed commit
   SHA, timestamp, the exact protection configuration read in §9.4, and the push output.
3. **Declare the protection non-functional.** Status becomes
   **`CONFIGURED — DEMONSTRATED NON-FUNCTIONAL`**. No record may call that `main` protected. Phase 4
   has **failed**, and **Phase 5 must not be opened** on it.
4. **Re-audit §9.2 and §9.4 read-only** to establish which control was absent or bypassable, before
   any remediation is proposed.
5. **Remediation, including removing the landed commit, is a separate Founder decision** with its
   own grant. It is not covered by the §9.5 authorization, which authorized exactly one refused
   push and nothing else.

Until a **refusal** is observed, the honest status of protection is
**`CONFIGURED — NOT DEMONSTRATED`**, and no record may call `main` protected.

**9.6 — Reconciliation.** Record, per repository, the before/after of §9.1–§9.5 with the audit
date, the `gh` version and the authenticated account, in the §2.1 shape — and **never a token
value**. Label every figure **`MEASURED-HERE`** or **`CITED-CORPUS`** per §2.1; a figure without a
label is not usable. Do not carry any 2026-07-29 figure forward as current, and do not reconcile the
§3.5 current-`main` measurement with the §3.5.1 corpus figure — they are separate axes (§3.5.1) and
the fresh names simply supersede for configuration purposes (§4.5).

---

## 10. Explicit NO-GO conditions

Binding under **both** options, and under every phase:

1. **NO-GO** on any claim that the four repositories currently have branch protection, required
   reviews or required status checks. §3.2 measures **`protected = false`** directly; the absence of
   an enforceable required-check gate follows from it as a conservative consequence.
   **Also NO-GO on the converse overclaim:** no record may state that required status checks were
   **measured as zero configured** or that a required-contexts list was enumerated and found empty.
   The enumeration endpoint is plan-gated and returned `403` (§3.3); it was **not** read. The
   licensed form is *"no enforceable required-check gate — inferred from measured `protected =
   false`; enumeration endpoint plan-gated and not read"* (§3.2).
2. **NO-GO** on describing any check result — including SOC's seven successes at the current `main`
   SHA — as gating, blocking or required. With no enforceable required-check gate, every check is
   informational (§3.5). That conclusion rests on the §3.2 inference and must be stated as such —
   *checks are informational* and *a required-contexts list was directly enumerated as empty* are
   different claims, and only the first is licensed.
3. **NO-GO** on any assertion that protections **or rulesets** are *verified* absent. The ruleset
   endpoints returned `403`; the honest status is **"not visible; inferred absent"** (§3.3).
4. **NO-GO** on making any repository public to obtain protections. The `CLAUDE.md` data-handling
   boundary forbids it, and it is not an option in §6 even though GitHub's own error body offers it.
5. **NO-GO** on inventing, assuming, creating or planning around a second reviewing account —
   human, machine, bot, GitHub App or collaborator. §5b does not exist; §5a and §5c are the only
   configurable shapes today, and both require "check-gated, self-authored" wording (§5).
6. **NO-GO** on executing any §8 phase without its own explicit Founder grant, and **NO-GO** on
   phase-skipping — in particular Phase 3 before Phase 2 (permanent deadlock, §4.2) and Phase 5
   without Phase 4 (delegation on an undemonstrated control).
7. **NO-GO** on configuring a required check from a **workflow job ID** or from any name read out
   of a workflow file. Only **fresh measured rendered names** from §9.3 are legitimate (§4.2), and
   they supersede any `CITED-CORPUS` name (§4.5).
8. **NO-GO** — **scoped** — on configuring `required_approving_review_count ≥ 1` **in the current
   solo-owner shape: Option A under §5a, single personal account, `enforce_admins` on, no second
   reviewing identity.** In that shape it makes every pull request unmergeable by construction (§5).
   The NO-GO is a consequence of the shape, not a permanent property of review requirements: if the
   shape changes — for example if §5b ever becomes real by its own separate Founder decision — this
   item must be re-evaluated on the new facts rather than cited as standing.
9. **NO-GO** on treating a completed Option A as delegated integration. Option A is a **precondition
   and only a precondition**. Delegation is Phase 5 and requires its own packet and its own decision
   (§8). No purchase, configuration, push, merge or release authority is granted by this packet.
10. **NO-GO** on any step requiring a second remote. `CLAUDE.md` forbids it without separate
    approval, and only `origin` exists.
11. **Separate gate:** anything touching `cybrik-soc-command-center` — including any Phase 2, 3 or
    5 action there — is its own approval gate, distinct from any suite-level decision (`CLAUDE.md`).
12. **NO-GO** on citing any §3 figure as current at any later date without a fresh §9 re-audit. The
    figures are dated **2026-07-29** and predict nothing (§2).
13. **NO-GO** on running the §9.5 rejection test by any executor other than the **Founder
    personally**, with any payload other than a **deliberately zero-content throwaway commit**,
    without a **further explicit execution-time authorization**, or before **every** §9.4 read-only
    enforcement check has passed. **NO-GO** on describing that test as inherently safe: a broken
    protection can allow the push to land, and the §9.5 incident procedure exists for that case.
14. **NO-GO** on opening Phase 3 on a **non-zero check count**. The gate is **actually executed
    checks reporting `success`** at the current `main` SHA in **all four** repositories, with
    suppressed jobs excluded **by measurement in the fresh §9.3 pass**, not by a name list (§4.4,
    §9.3). The blocker-4 §3.8 `CITED-CORPUS` examples **`e2e-org`** and **`alert-context-route-db`**
    illustrate the shape and are **not evidence of a pass**; neither is a current-`main` claim, and
    either becomes an ordinary candidate only if the fresh pass observes it executing and reporting
    `success`.
    **Also NO-GO** on attributing those checks wrongly: Phase 2 bootstraps **Suite, Cyber AI and
    Fabric only** and **produces no checks on SOC**, whose `main` already carries a workflow (§3.4).
    No record may say Phase 2 produces checks on SOC; the requirement is that the **pre-existing SOC
    workflow and Phase 2 together** yield fresh actually-executed successful checks on **all four**
    `main` SHAs.
15. **NO-GO** on configuring the §5a shape **without a required-pull-request rule/object present**.
    A `required_approving_review_count` of `0` with no such object is not §5a; it is no
    pull-request requirement at all (§5, §9.4).
16. **NO-GO** on using the §3.5.1 `CITED-CORPUS` figures — 22 instances, 19 distinct rendered names,
    SOC 8 / Cyber AI 7 / Fabric 5 / Suite 2 — as current-`main` evidence, as Phase 3 required-check
    names, or as something to be reconciled with the 7 / 0 / 0 / 0 measurement (§3.5.1, §4.5).
17. **NO-GO** on stating a **measured plan name** for these repositories. `GET /user` returned
    `plan: null`; only the protection-endpoint upgrade message is measured (§3.1).
18. **NO-GO** on accepting an independent review verdict on this packet that does not report the
    **exact file blob identity and SHA-256** of the bytes reviewed (§2, item 4, and §12).
19. **NO-GO** on configuring as a required status check **any rendered check name containing a
    mutable tool or version token** — a semantic version, a `v`-prefixed version, a date stamp, a
    build/run number, a digest fragment, or any token that changes on a tool upgrade; and **NO-GO**
    on treating an unclear token as safe, since §4.6 is **fail-closed**. If the fresh §9.3
    measurement yields such a name, **Phase 3 is `NO-GO` for that repository** until a **separately
    authorized** Phase-2-class workflow change gives the check a **stable rendered name** whose tool
    version stays pinned **elsewhere**, that stable name **actually executes and reports `success`
    on the current `main` SHA**, and a **fresh §9.3 pass** captures it — after which **only the newly
    measured stable name** may be required (§4.6, §9.3, §9.4).
    **NO-GO on reading this item as authorization for that workflow change.** It is Phase 2 authority
    (`G-IR01-6`) and needs its own grant; this packet authorizes no workflow change of any kind (§0).
    The version-bearing Suite name recorded at blocker-4 §3.7 is a **`CITED-CORPUS`** illustration of
    the shape, **not** a current-`main` finding and **not** a configuration input (§4.5, §4.6).

---

## 11. Current gates — unchanged by this packet

Cited from the board (`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §1 and §8) as at the lane
base `eedadc561700d3e1fa052322d44eb63151df0009`. **This packet changes none of them.**

| Gate | Disposition — unchanged |
|---|---|
| W1-E0 — read-ahead, threat/eval design and proposal packets | `GO` |
| W1-C1 — alert-context capability contract | `ACCEPTED — CLOSED 2026-07-26` (local commit only) |
| W1-C2 — investigation lifecycle contract | `ACCEPTED — CLOSED 2026-07-26` (local commit only) |
| GATE A4 — ADR-0003 / ADR-0005 | `ACCEPTED — CLOSED 2026-07-26` (decisions only) |
| W1-G1 — alert-context transport-binding acceptance | `ACCEPTED — CLOSED 2026-07-27` (local commit only) |
| W1 product implementation | `HOLD` |
| W1 integration / live shadow | `HOLD` |
| **Routine delegated integration** | **`NO-GO`** — the subject of this packet; **still `NO-GO`** |
| External release | `NO-GO` — `RB-001(release-disclosure)` remains open |
| **W0-IR01** (board §8) | **`ACTIVE READ-ONLY`; routine integration stays `NO-GO`** |

Schedule and posture, restated because a control-plane packet is a common place for drift to enter:

- **W1: 2026-08-01 → 2026-08-23 — unchanged.**
- **Stable go/no-go: 2026-12-20 — unchanged.**
- **Release window: 2026-12-21 → 2026-12-31 — unchanged.**
- **Local stack / runtime demo: `NO-GO` — unchanged.**
- W0 closure `NO-GO`; roster of 48 with no task 49; **CI: NOT WIRED**; no UAT instance exists.

Nothing in §6, §7 or §8 — including full execution of Option A — moves any date above. The
questions in §7 are control-plane questions and carry **no release impact**.

**Confirmed after the §13 decision.** The selection of Option Z leaves this table exactly as it
stands, row for row: routine delegated integration is **still `NO-GO`**, `W0-IR01` is **still
`ACTIVE READ-ONLY`**, W1 product implementation and integration / live shadow remain on `HOLD`,
external release remains `NO-GO` with `RB-001(release-disclosure)` open, and W0 closure remains
`NO-GO`. **The fixed dates above are unchanged**, the runtime / UAT holds are unchanged, no UAT
instance exists, **CI remains `NOT WIRED`**, and the "no stack before `G-C` stable-v1.0" posture is
unchanged. A decision that changes nothing hosted changes no date and no gate.

---

## 12. What this lane wrote

- **Branch:** `codex/w1-d04-ir01-control-gate-r1`
- **Base:** `eedadc561700d3e1fa052322d44eb63151df0009`
- **Worktree:** `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-d04-ir01-control-gate-r1`
- **Paths written — exactly one, untracked:**
  `docs/adr/FOUNDER-DECISION-PACKET-W0-IR01-CONTROLLED-INTEGRATION.md`
- **Existing files edited: none.** No index row was added to `docs/adr/README.md`, no board row was
  written, and no evidence-register entry was made — each of those is an edit to an existing file
  and is outside this lane's authority. A future lane may link this packet in.
- **Staged: none. Committed: none. Fetched, pushed, merged: none.** No dependency install, no
  formatter, no validator write.

**Subsequent decision-recording edit — 2026-07-29, same lane, same worktree, same base.** The
`G-IR01` decision (§13, §14) was recorded by editing **this same untracked file** and no other. The
bullets above hold unchanged for that edit as well: still exactly one path written, still untracked,
still **no existing tracked file edited**, nothing staged, nothing committed, no fetch, no push, no
merge, no pull request, no release, no remote or hosted mutation of any kind, no dependency install,
no formatter and no validator write. The edit added §13 and §14, updated the status /
recommendation / current-decision statements in the front matter and in §0, §6, §7, §8, §11 and
§12, and **altered no figure, label, provenance item, limit, NO-GO condition or review requirement**
in §1–§10.

This packet states no hash for itself; a file cannot contain its own digest (§2, item 4). Its hash is
reported by the lane that wrote it, outside these bytes.

**Reviewer identity requirement — binding.** Precisely *because* the file cannot self-hash, a review
verdict is not attributable to any particular bytes unless the reviewer supplies the identity
themselves. **Every independent reviewer must report, alongside the verdict:**

- the **exact file blob identity** — the repository-relative path
  `docs/adr/FOUNDER-DECISION-PACKET-W0-IR01-CONTROLLED-INTEGRATION.md` and its Git blob object ID
  (`git hash-object` of the reviewed bytes); **and**
- the **SHA-256** of those same bytes.

A verdict without both is **not usable as a Founder decision basis** and must be treated as
unpinned (§10, NO-GO 18). Two reviewers reporting different digests have reviewed different files,
and neither verdict transfers to the other's bytes.

**Status on delivery, as authored: `PROPOSED — FOUNDER DECISION REQUIRED`.** As delivered it was not
to be cited as a decision, and not to be used as a Founder decision basis until an independent review
of those exact bytes — pinned by blob ID and SHA-256 as above — returned `PASS` with no open P0–P2
finding.

**Current status: `DECIDED — OPTION Z — FOUNDER-MANUAL` (§13).** Two things follow, and they must be
kept apart:

1. **The independent-review requirement is not retired and is not waived.** It stands in full, and
   §10 NO-GO 18 stands with it: a review verdict on this packet that does not report the exact file
   blob identity **and** the SHA-256 of the reviewed bytes is unpinned and unusable. The bytes have
   changed with the decision-recording edit, so any earlier verdict — if one exists — is pinned to
   the pre-decision bytes and does **not** transfer to these.
2. **The recorded decision was taken under delegated authority ahead of any such review, and its
   scope is bounded accordingly.** That is defensible only because of what was selected: **Option Z
   changes nothing hosted, authorizes nothing and executes nothing** (§14). Its correctness does not
   depend on the §3 figures being independently confirmed — an Option Z posture is the conservative
   result under both a confirmed and an unconfirmed reading of them. **The converse does not hold.**
   The §3 evidence may **not** be cited elsewhere as an independently reviewed basis on the strength
   of §13, and any future **Option A** reconsideration requires both a `PASS` review of the bytes it
   relies on and a **fresh read-only re-measurement** (§13.4, §9).

---

## 13. Decision record — `G-IR01`

**This section is the operative decision.** §1–§12 are the basis on which it was taken and are
unaltered by it. Where this section and any earlier "not taken / not answered" phrasing appear to
conflict, that phrasing describes the packet **as authored**; this section describes its **current**
state.

### 13.0 The decision

| Field | Value |
|---|---|
| Gate | `G-IR01` — may routine integration stop being Founder-manual? |
| **Answer** | **No** |
| **Selected option** | **Option Z** — keep integration Founder-manual (§6, Option Z) |
| **Recorded outcome** | **`DECIDED — OPTION Z — FOUNDER-MANUAL`** |
| **`G-IR01` disposition** | **`NO-GO`** |
| **Routine delegated integration** | **`NO-GO` — unchanged** |
| **`W0-IR01` lane** | **`ACTIVE READ-ONLY` — unchanged** |
| Decider | **Founder-delegated coordinator**, acting under the Founder's delegated authority for this decision |
| Decision date | **2026-07-29**, timezone **Asia/Ho_Chi_Minh** |
| Decision basis | These bytes: §1–§12 as authored, on the §2.1 provenance, under the `MEASURED-HERE` / `CITED-CORPUS` labels, with every §2 honest limit intact |
| Packet recommendation at decision time | **Option A** — recorded, considered, **not selected** |
| Lane / base | branch `codex/w1-d04-ir01-control-gate-r1`, base `eedadc561700d3e1fa052322d44eb63151df0009` |
| Recording act | Edit of this one untracked file. Nothing staged, committed, pushed, merged or configured (§12) |

### 13.1 Recorded answers to the §7 questions

The §7 wording is authoritative for what was asked; this table is authoritative for what was
answered.

| Gate | Subject (abbreviated) | **Recorded answer** | What the answer does, and only this |
|---|---|---|---|
| **G-IR01-1** | §1 frame — hosted enforcement and local honor policy are not interchangeable, and today only the latter exists | **Yes** | The frame is accepted as the basis of every row below. Nothing operational follows |
| **G-IR01-2** | §3 evidence as recorded, on §2.1 provenance and labels | **Yes — accepted** | The evidence stands as the decision basis **with all of its stated limits intact and none softened**: the §3.2 measured-versus-inferred attribution (`protected = false` measured; the absent required-check gate a conservative consequence, **not** an enumerated list); the §3.3 `403` status of **not visible / inferred absent**, never verified absent; the §3.1 plan name **not** directly measured (`plan: null`); §3.4 workflow presence on SOC only; the §3.5 current-`main` figure of **7 / 0 / 0 / 0** held strictly apart from the §3.5.1 `CITED-CORPUS` figure, with the §3.5.1 non-reconciliation rule intact; and the §2 dating limit — the figures describe **2026-07-29** and predict nothing |
| **G-IR01-3** | No current or past check result may be described as gating | **Yes** | The wording rule binds every record, retroactively and going forward, and records state the absence as **inferred from measured `protected = false`**, never as a directly enumerated empty required-contexts list |
| **G-IR01-4** | Option A or Option Z | **Option Z** | Option Z becomes the lane's operative direction. `G-IR01` is answered `NO-GO`. **Option A is not selected**, and no step of it is granted, begun or scheduled |
| **G-IR01-5** | *(Option A only)* GitHub Pro purchase approval | **`N/A — Option Z`** | Not answered, not deferred to a default, and **not** to be read as any form of approval. No purchase, plan change, billing action or subscription is authorized |
| **G-IR01-6** | *(Option A only)* Workflow-on-`main` bootstrapping | **`N/A — Option Z`** | No workflow is authored, changed, landed or enabled on any branch of any repository |
| **G-IR01-7** | *(Option A only)* Configure enforcement on `main` | **`N/A — Option Z`** | No branch protection, ruleset, required-check, force-push, deletion or linear-history configuration is authorized anywhere |
| **G-IR01-8** | *(Option A only)* Adopt the §5a shape | **`N/A — Option Z`** | No review-object shape is adopted or configured. §5b remains non-existent and un-assumed (§10, NO-GO 5) |
| **G-IR01-9** | *(Option A only)* Require demonstration by rejection | **`N/A — Option Z`** | **The §9.5 rejection test is neither required nor authorized, and must not be run.** There is no protection to demonstrate, and the test's own NO-GO conditions (§10, NO-GO 13) stand regardless |
| **G-IR01-10** | The scope limit — answering flips nothing and grants nothing | **Yes** | The scope limit is recorded and binding: `W0-IR01` stays `ACTIVE READ-ONLY`, routine delegated integration stays `NO-GO`, and **no** push, fetch, merge, pull request, release, dependency install or product writer is authorized by any answer above |

**Sequencing conformance.** G-IR01-4 selected Option Z, so rows 5–9 take the §7 second branch and
are recorded as `N/A — Option Z`. Rows 1, 2, 3 and 10 stand answered. A row marked `N/A` is an
**unasked** question under this decision — it is not a `yes`, not a `no`, and not a partial grant.

### 13.2 What Option Z means as a posture

Option Z is **a legitimate controlled posture, positively chosen** (§6, Option Z). It is not a
deferral, not an omission, and not the residue of an unanswered question. Its content is:

- **Every integration action requires an explicit, per-action grant** from the Founder or from the
  Founder-delegated coordinator, and is **executed manually**. There is no standing authorization,
  no blanket grant and no class-based grant. An approval for one action does not extend to the next,
  the similar, or the repeat.
- **Nothing hosted changes.** No GitHub Pro purchase or plan change; no hosted configuration; no
  branch protection, ruleset or required-check change; no bypass-actor change; no remote-protection
  change of any kind.
- **No workflow bootstrap** — none authored, moved, landed on `main` or enabled.
- **No rejection test** (§9.5) — there is nothing configured to test, and it is not authorized.
- **No delegation.** Routine delegated integration stays `NO-GO`.
- **No push, fetch, force-push, ref creation or deletion, merge, pull request, tag or release.**
- **No account of any kind** — human, machine, bot, GitHub App or collaborator (§10, NO-GO 5).
- **No dependency install, database migration, deployment, formatter or auto-fixer run.**
- **No product, runtime or integration writer authority** in any repository.

The trade accepted is the one §6 states: the control surface stays at local honor policy, manual
integration stays a per-action bottleneck that does not scale with lanes, the §3.3 ruleset residual
stays open and unmeasured, and the standing risk of a mistyped refspec against an unprotected `main`
persists unchanged. Those are accepted as stated, not discounted.

### 13.3 W0 closure and canonical integration — a distinction this decision does not blur

Option Z is a control-plane posture. It is **not** an integration event, and it must not be recorded
as one.

- **This packet does not close `W0`.** It integrates no artifact, merges nothing, accepts nothing
  into any canonical line, and **does not make `W0 COMPLETE` non-zero**. `W0` closure remains
  `NO-GO` (§11).
- **This packet integrates no artifact anywhere.** Every W1 artifact remains `SCAFFOLD`-class,
  locally reviewed, unmerged and unpushed, exactly as §2 records.
- **Option Z can support a later manual canonical integration or acceptance path** — precisely
  because it keeps every such action under an explicit per-action grant with manual execution. That
  is a *capability of the posture*, not an event that has occurred and not a grant that now exists.
  Any such action needs its own decision, its own grant, and its own record.
- **The separate branch-push question stays where it is.** Whether specific branches should be
  pushed is held by the W1 blocker-4 canonical-integration packet
  (`docs/operations/W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md`), itself
  `PROPOSED — FOUNDER DECISION REQUIRED`. **§13 answers none of it**, and no answer here may be
  cited toward it.

**No record may state or imply, on the strength of this decision, that canonical integration has
occurred, been approved, been scheduled, or become routine.**

### 13.4 The evidence snapshot is historical and time-bounded

The §3 figures are a **2026-07-29 snapshot**, and this decision consumes them as such. It does not
convert them into standing facts, and their acceptance under G-IR01-2 gives them no currency beyond
that date.

Binding on any later reader:

- **No §3 figure may be cited as current at any later date** without a fresh read-only re-audit
  (§9; §10, NO-GO 12). The acceptance recorded here is acceptance *of a dated snapshot*, not of a
  present state.
- **Any reconsideration of Option A is a new decision**, not a resumption of this one. It requires,
  at minimum: a **fresh read-only re-measurement** under §9 at that later date, on the §2.1
  provenance shape, with every figure re-labelled `MEASURED-HERE` or `CITED-CORPUS`; and a **new,
  separately recorded decision**. Neither `G-IR01-4` as answered here nor any `N/A` row above may be
  reopened by assertion, restatement or inference.
- **Nothing in this decision expires into a grant.** The passage of time does not convert `N/A —
  Option Z` into approval, and silence is not authorization.

---

## 14. Authority ceiling of this decision

Stated separately so it cannot be read as a qualification buried in a longer row. **This is the
ceiling; there is nothing above it in this document.**

**What this decision is.** A recorded answer to `G-IR01`, taken on **2026-07-29**
(Asia/Ho_Chi_Minh) by the **Founder-delegated coordinator** under the Founder's delegated authority,
selecting **Option Z**, written into one untracked Markdown file.

**What it authorizes: nothing.** The §0 prohibitions apply to this decision in full and are not
narrowed by it. Specifically, and without exception, **this decision authorizes no**:

- purchase, plan change, billing action or subscription — GitHub Pro included;
- hosted or repository-settings change, branch-protection change, ruleset creation, bypass-actor
  change or any other remote-protection change;
- workflow authored, changed, moved, landed on `main` or enabled;
- rejection test or any other deliberate push attempt (§9.5 stays unauthorized);
- delegation of routine integration, or of any integration action;
- push, fetch, force-push, ref creation or deletion, merge, pull request, tag or release;
- remote configuration change, and no second remote (§10, NO-GO 10);
- account creation of any kind — human, machine, bot, GitHub App or collaborator;
- dependency install, database migration, deployment, formatter or auto-fixer run;
- product, runtime or integration writer authority in any repository.

**What it does not do.** It does not flip `W0-IR01`, which stays `ACTIVE READ-ONLY`. It does not
grant routine delegated integration, which stays `NO-GO`. It does not close `W0` or any blocker, and
does not make `W0 COMPLETE` non-zero. It does not integrate, merge or accept any artifact. It does
not open any §8 phase. It does not alter any date, hold or posture in §11. It does not retire the
independent-review requirement of §12, and it does not weaken any §10 NO-GO condition.

**Separate gates that remain separate.** Anything touching `cybrik-soc-command-center` remains its
own approval gate (§10, item 11; `CLAUDE.md`). Every `CLAUDE.md` approval gate — repository or
top-level-directory changes, contract acceptance, any commit, push or remote configuration,
dependency installation, migration, deployment, formatter runs — is untouched and fully in force.

**How to cite this decision.** The only licensed form is:

> **`G-IR01` — `DECIDED — OPTION Z — FOUNDER-MANUAL`**, 2026-07-29 (Asia/Ho_Chi_Minh), by the
> Founder-delegated coordinator. `G-IR01` is `NO-GO`. Routine delegated integration remains
> `NO-GO`. `W0-IR01` remains `ACTIVE READ-ONLY`. Each integration action continues to require its
> own explicit per-action grant and manual execution. Nothing hosted was purchased, configured or
> changed; nothing was integrated; `W0` is not closed.

Any citation asserting more than that — a purchase, a configuration, a delegation, an integration, a
closure, or a promotion of any gate — **misreports this decision**.
