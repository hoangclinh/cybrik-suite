# Founder Decision Packet — W0-T11 resource-budget contract instrument

- **Prepared:** 2026-07-29
- **Decided:** 2026-07-29 (`Asia/Ho_Chi_Minh`)
- **Decider:** Founder-delegated coordinator, acting under delegated authority
- **Status:** `DECIDED — PARKED — DOCS-ONLY — NO GATE OPENED — NOT INTEGRATED`
- **Lane:** `codex/w1-d04-t11-resource-budget-gate-r1`, worktree
  `cybrik-worktrees/w1-48/w1-d04-t11-resource-budget-gate-r1`
- **Base:** `eedadc561700d3e1fa052322d44eb63151df0009`
  (`docs(control): reconcile reviewed local W1 provenance`)
- **Paths written by this lane:** exactly 1 — this file. No existing file is edited.
- **Decisions recorded:** all eight answers, `T11-RB-1` … `T11-RB-8`, are **now decided** (§10, §14)
- **Decision summary:** `T11-RB-1` → **A** (sub-lane `W0-T11/RB`, no task 49); `T11-RB-2` → **A**
  (no gate opened, no gate identifier allocated); `T11-RB-3` → **yes** (one contract packet at a
  time; instrument **PARKED** until W1-C1 and W1-C2 are canonically integrated into one tree);
  `T11-RB-4` → **yes** for the `cybrik.res-*` prefix and all §4.2 disambiguation / no-rename
  boundaries, sub-answer **4b** — noun family is **`res-bounds-*`**, with
  `resource-bounds/` directories and manifest; `T11-RB-5` → **yes** (ADR-0012 conditional
  candidate only, never an allocation); `T11-RB-6` → **yes** (derived-only authority);
  `T11-RB-7` → **yes** (dependency wording only); `T11-RB-8` → **yes** (no `G-C` gate identifier;
  binding checkpoint is the dated `2026-12-20` go/no-go).
- **What the decision does not do:** no gate is opened, no ADR number is allocated, no task
  identity is minted, no contract writer or product writer is authorized, no file other than this
  one is created or edited, no status or date elsewhere is changed, and no runtime, demo, stack, or
  CI claim is made. **The naming answer is naming only** — it creates no schema, path, directory,
  manifest, or artifact now (§4.3, §9).
- **Release impact:** none. W1 `2026-08-01 → 2026-08-23`, the release window
  `2026-12-21 → 2026-12-31`, and the `2026-12-20` Founder go/no-go for stable v1.0 are unchanged
  by this packet.

This packet asked whether a **resource-budget contract instrument** should be scoped, named, and
sequenced. Those questions are now answered (§10, §14). Recording those answers accepts no
contract, flips no status on any other member, opens no gate, mints no task identity, allocates no
ADR number, authorizes no contract writer or product writer, creates no contract file, and
certifies no runtime. **This document is now a record of decisions**; every prohibition it carried
as a proposal it retains as a decision (§11).

---

## 1. What T11 is, and what the resource-budget contract is not

`W0-T11` is a **measurement/evaluation identity**. Its definition is unchanged and is quoted from
the base tree:

> `| W0-T11 | Walking-skeleton latency/resource baseline with exact environment tuple | HOLD until
> real vertical exists |`
> — `docs/operations/W1-48-AGENT-ROLLING-BOARD.md:1583` @ `eedadc5`

Its immediate neighbour is quoted for the same reason:

> `| W0-T10 | Real four-repo shadow vertical harness | HOLD; offline W0-T10 is not a substitute |`
> — `docs/operations/W1-48-AGENT-ROLLING-BOARD.md:1582` @ `eedadc5`

Three separations follow, and this packet depends on all three:

1. **T11 remains the measurement identity.** T11 is the act of *baselining latency and resource
   consumption against a real walking skeleton with an exact environment tuple*. That identity is
   `HOLD` and this packet does not move it. Nothing here produces a latency number, a resource
   number, an environment tuple, or a baseline.

2. **The resource-budget contract is an instrument, not a measurement.** A schema that lets a
   caller *declare, reserve, and account for* a resource budget is the ruler; T11 is the act of
   measuring. Publishing a ruler is not taking a measurement, and a ruler that has never been laid
   against a real vertical is not evidence about that vertical. Accepting a resource-budget
   contract would therefore **not** satisfy, advance, partially satisfy, or unblock T11, and must
   never be reported as T11 progress. T11 stays `HOLD until real vertical exists` regardless of
   what is decided here.

3. **This is not task 49.** The roster is exactly 48 identities and no task 49 exists
   (`docs/operations/W1-48-AGENT-ROLLING-BOARD.md:1683`, `:2208` @ `eedadc5`). This packet does not
   mint, propose, or imply a 49th identity. It asked (`T11-RB-1`) under which **existing** identity
   the instrument work should sit if it proceeds at all; that question is now **decided as A** —
   the instrument is a **sub-lane `W0-T11/RB` under the existing `W0-T11` identity**, and no task
   49 is minted. The sub-lane is an internal label of this packet: it does not add a roster row,
   does not alter `W0-T11`'s own `HOLD` status, and is not itself written into the board by this
   lane.

The reason the instrument is filed against T11's *name* is proximity of subject matter — both
concern resource consumption — not equivalence of work. That proximity is exactly the confusion
this section exists to prevent.

---

## 2. Verified control-line state

Every row below is re-read from the base tree `eedadc5` at preparation time. Statuses are quoted,
not summarized into stronger words.

| Member | Status at `eedadc5` | Authority actually granted | Verified from |
|---|---|---|---|
| ADR-0003 durable agent orchestration | `ACCEPTED` (GATE A4, 2026-07-26) | *"decision only; no implementation, dependency or runtime authority"* | `docs/adr/ADR-0003-durable-agent-orchestration.md:3-4` |
| ADR-0005 sandbox substrate | `ACCEPTED` (GATE A4, 2026-07-26) | *"decision only; no implementation, dependency or runtime authority"* | `docs/adr/ADR-0005-sandbox-substrate.md:3-4` |
| ADR-0009 org-hierarchy & external-authority contract profile (Gate W2-G) | `ACCEPTED FOR IMPLEMENTATION` v0.1.0 — *"not stable v1/GA"* | contract realization only | `docs/adr/ADR-0009-...md:3` |
| ADR-0010 capability-name canonicalization | `ACCEPTED FOR IMPLEMENTATION — APPLIED`, pre-GA patch `0.1.1` | applied contract patch | `docs/adr/ADR-0010-capability-name-canonicalization.md:3,12` |
| ADR-0011 | **absent from the base tree** — `git ls-tree eedadc5 docs/adr/` returns no `ADR-0011*`; a `PROPOSED`, untracked draft exists in a separate W2-I worktree (§2.2) | none | direct listing @ `eedadc5`, plus the §2.2 out-of-tree read |
| W1-C1 alert context | `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY` at `3a2c71555a423465855ffaddcb663c8b704dbfbd` | contract-first only | `docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md:29` |
| W1-C2 investigation lifecycle | `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY` at `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4` | contract-first only | `docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md:30` |

### 2.1 ACCEPTED is not implementation authority

ADR-0003 and ADR-0005 are **ACCEPTED decisions on the control line**. Their own status lines
restrict them to *"decision only; no implementation, dependency or runtime authority."* A
resource-budget instrument that touches orchestration (ADR-0003) or sandbox execution (ADR-0005)
therefore inherits **a settled decision to design against, and no permission to build**. Any
statement of the form "ADR-0003 is accepted, therefore we may implement reservations" is false and
must be rejected on sight.

### 2.2 ADR-0011 and the absence of a co-resident tree

The W2-I transport-binding work claims ADR-0011. That work is **proposed in a separate,
unintegrated W2-I lane and is untracked**. The draft is readable on this machine, so it is cited
rather than treated as invisible:

> `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-b05-w2i-adr-correction-r1/docs/adr/ADR-0011-inference-plane-transport-binding-profile.md`
> — branch `codex/w1-b05-w2i-adr-correction-r1`, worktree HEAD
> `55e94c2815ee68ef49a6e10cdc41a76c227b7bd7`

Three facts about it, each verified directly and none of them stronger than what was observed:

1. **It is untracked.** `git status --porcelain` in that worktree reports the file as `??`, and
   `git ls-tree HEAD docs/adr/` there returns no `ADR-0011*`. It is not committed on its own
   branch, let alone integrated anywhere.
2. **It is `PROPOSED`, not accepted.** Its own status line reads
   *"`PROPOSED — NOT DECIDED` (candidate v0.2.0 revision; **not** accepted, **not** applied,
   **not** a stable v1/GA version …)"*, its *Date decided* is *"— (none; Gate W2-I is `NOT
   OPENED`)"*, and its *Acceptance record* is *"none."*
   — `…/w1-b05-w2i-adr-correction-r1/docs/adr/ADR-0011-inference-plane-transport-binding-profile.md:2-9`
3. **It is not co-resident with this packet's base tree.** It lives in a different worktree on a
   different branch, and `git ls-tree eedadc5 docs/adr/` here lists ADR-0001 … ADR-0010 and no
   ADR-0011. The same holds for the W2-I contract artifacts
   (`contracts/json-schema/cybrik.inference-transport-binding.v1.schema.json` and siblings), which
   Git reports as **untracked** in the source checkout; `git ls-files --error-unmatch` on them
   fails with *"did not match any file(s) known to git."*

So the number **ADR-0011 is observably claimed** by an untracked `PROPOSED` draft. What is *not*
observable is any accepted, committed, or integrated form of it. This packet makes no claim about
the technical contents or quality of that draft, and takes no position on whether it should be
accepted — only that the number is spoken for off-tree, and that ADR-0011 is neither an accepted
member nor a member of the base tree.

The consequence that matters:

> **No canonical tree currently co-resides ADR-0003, ADR-0005, ADR-0010, ADR-0011, W1-C1 and
> W1-C2 together.** ADR-0003/0005/0010 are in the base tree; W1-C1 and W1-C2 exist as accepted
> **local commits only** on their own branches; ADR-0011 exists only in an untracked lane. The
> accepted set is real but **distributed across branches that have never been integrated into one
> tree**.

Every downstream question in this packet — numbering, sequencing, gate opening — is gated by that
one fact. This is also why §10 asks for sequencing (`T11-RB-3`) before anything else proceeds.

---

## 3. ADR numbering — ADR-0012 is a candidate, not a fact

This packet **does not allocate ADR-0012** and no reader may treat it as allocated.

The arithmetic, stated conditionally:

- The highest ADR present in the base tree is **ADR-0010**.
- **ADR-0011 is spoken for by the untracked W2-I lane** but is not integrated, so the number is
  claimed off-tree and unconfirmed on-tree.
- **If and only if** the W2-I lane integrates into a canonical tree and ADR-0011 lands there, the
  next free number becomes **ADR-0012**.
- **If** W2-I is abandoned, superseded, renumbered, or never integrated, **ADR-0011 returns to the
  free pool** and ADR-0012 would be a gap — a numbering defect, not a decision.

So ADR-0012 is *the next arithmetic candidate conditional on registry co-residency and
integration*, and nothing stronger. Recording it as allocated today would create a claim that a
single unrelated lane decision could silently falsify. `T11-RB-5` is **decided `yes`**: ADR-0012 is
bound as a **conditional candidate only, and is not allocated**.

Corollary, now binding: **number assignment must be the last step before an ADR is written,
performed against a co-resident integrated tree** — never reserved in advance from a lane that
cannot see the register. No lane may cite ADR-0012 as this instrument's number until that
assignment happens against the integrated registry.

---

## 4. Wire prefix — `cybrik.res-*` **decided**, `res-bounds-*` noun family **decided**

**Decision (`T11-RB-4` = `yes`, sub-answer `4b`):** use `cybrik.res-*` as the wire/file prefix for
any resource-budget contract family, with the noun family **`res-bounds-*`** and
**`resource-bounds/`** directories and manifest, while continuing to write **"resource budget"**
in prose, headings, and documentation. The §4.2 disambiguation and the no-rename boundaries below
are bound as decided. See §4.3 for the noun-family decision and §9 for the renamed prospective
paths.

**Two noun forms are superseded and must not be used:** the prospective `res-budget-*` /
`resource-budget` forms (superseded by sub-answer `4b` itself), and the briefly selected
`res-envelope-*` / `resource-envelope/` forms (superseded on review for semantic overload against
the accepted `cybrik.envelope.v1.schema.json` carrier — §4.3.2, §4.3.3, §14.3).

Verified at preparation time: `cybrik.res-` has **no collision** in the base tree. A search for
`cybrik\.res-`, `"res_`, and `res-budget` across `eedadc5` returns zero hits. The prefix is free.

**Measurement scope, stated so it is not overread:** that first search measured the `cybrik.res-`
**prefix** and the `res-budget` string only. A **second, separate scan** — recorded in full in
§4.3.3 — was subsequently run at the same base for the decided `res-bounds` / `resource-bounds`
noun and for the bare token `bounds`. What neither scan does is establish uniqueness in all future
code: both are point-in-time reads of one tree, and the recheck against the canonically integrated
tree remains mandatory (§12.1, §14.3).

### 4.1 Why a distinct prefix is mandatory, not cosmetic

The word "budget" is **already used five different ways** — four in accepted contracts and one in a
`PROPOSAL`-status strategy document — across four layers, with five different meanings. Verified at
`eedadc5`:

| Existing token | Where | Layer / owner | What it actually means |
|---|---|---|---|
| `budget_exceeded` | `contracts/json-schema/cybrik.tool-execution-result.v1.schema.json:25`, and REST mapping `429 budget_exceeded` at `:5` and `docs/strategy/05-CONTRACTS-AND-INTEGRATION.md:309` | Tool Fabric control plane | a **terminal status** of one tool execution: this execution was refused/stopped because a budget was already exceeded |
| `BUDGET_*` | `contracts/json-schema/cybrik.tool-execution-result.v1.schema.json:88` (the `$defs.error` description), declared in `docs/strategy/05-CONTRACTS-AND-INTEGRATION.md:462` | suite-wide stable error-code namespace (strategy 05 §8), consumed by Tool Fabric's `error.code` | a **stable error-code family prefix** that an `error.code` value may belong to. The base tree declares the *prefix only*: **no `BUDGET_*` member code is enumerated anywhere at `eedadc5`**, so its concrete codes are unspecified rather than known |
| `over_input_budget`, `over_output_budget` | `contracts/json-schema/cybrik.model-common-defs.v1.schema.json:188-189` | Cyber AI inference | an **error class** on one inference call: the request's own token counts breached the resolved model-class ceiling |
| `reason: "budget"` | `contracts/json-schema/cybrik.model-common-defs.v1.schema.json:214`, inside `fallbackInfo.reason` | Cyber AI inference | a **fallback cause**: the platform *substituted a cheaper model class* for budget reasons — the call **succeeded**, degraded |
| `budget` (bare object key) | `docs/strategy/05-CONTRACTS-AND-INTEGRATION.md:102`, in the `POST /api/v1/investigations` request body (that document's §4.1) | Cyber AI investigation orchestration, on the SOC → Cyber AI request surface — **strategy document only**, whose own status is `[PROPOSAL — contract v0, chưa dùng production]`; not an accepted contract and realized by no schema at `eedadc5` | a **request-time cap declaration** on one investigation: an object carrying `deadline_seconds`, `max_model_calls`, `max_tool_calls`, `max_retrieved_bytes` — the ceilings the caller asks the platform to hold that single investigation to |

These five are not synonyms and are not a hierarchy. One is a refusal, one is an open error-code
namespace whose members are not enumerated in the base tree, one is a validation error, one is a
**successful** call with a substitution, and one is a declaration of per-request ceilings that no
accepted contract realizes. A sixth family reusing the bare word `budget` on the wire would be read
as a sixth sense of an already five-times-overloaded token, and the distinction between "refused",
"error-code family", "malformed", "silently degraded", "declared-but-unaccepted ceilings", and
"reservation accounting" would be lost precisely where it is most expensive to lose — in error
handling.

The fifth usage warrants a separate warning, because it is the **nearest neighbour** to the proposed
instrument and the only one that already occupies the bare token on a request body. It is still a
different thing: `budget.{deadline_seconds, max_model_calls, max_tool_calls, max_retrieved_bytes}`
declares ceilings for **one** investigation and says nothing about parent/child conservation,
drawdown at reservation time, release, or remainder (§5) — it is a cap list, not a reservation
ledger. Because it is `PROPOSAL`-status strategy prose rather than an accepted contract, this packet
does **not** treat it as settled, does **not** propose adopting, extending, replacing, or
deprecating it, and takes no position on whether it should ever be accepted. Whether a future
`res-*` bounds family and that object should be reconciled is downstream design work under the same
restraint as the rest of §4.2.

### 4.2 Explicit disambiguation — **decided and bound**

`cybrik.res-*` is adopted (`T11-RB-4` = `yes`), so the following disambiguation is **bound** as
normative prose to be carried in the contract family's own defs file **if and when that file is
ever authorized and created**. Binding the wording does not create the file, and none of the
restraint clauses below is relaxed by the decision:

- `cybrik.res-*` concerns **reservation and accounting over resource bounds across a call
  tree** — who holds how much, who may spend it, and what remains.
- It is **distinct from** `budget_exceeded`, which is a per-execution terminal status owned by
  Tool Fabric and mapped to HTTP 429. A `res-*` reservation failure is not a `budget_exceeded`
  status and must not be mapped onto it by default.
- It is **distinct from** the `BUDGET_*` stable error-code family (strategy 05 §8), which is a
  *code namespace* for `error.code` values, not a payload shape. This packet does **not** propose
  minting a `res-*` error code inside `BUDGET_*`, does not propose any new `BUDGET_*` member code,
  and does not propose re-scoping the family. Which family a `res-*` error code would belong to is
  downstream design work, under the same restraint stated below.
- It is **distinct from** `over_input_budget` / `over_output_budget`, which are per-call model
  token-ceiling error classes owned by Cyber AI. Those describe one request's shape; `res-*`
  describes bounds shared by many requests.
- It is **distinct from** `fallbackInfo.reason = "budget"`, which reports a **successful,
  degraded** call. A `res-*` denial is a refusal and never a success.
- It is **distinct from** the bare `budget` object on the strategy-05 `POST /api/v1/investigations`
  request body, which declares per-investigation ceilings (`deadline_seconds`, `max_model_calls`,
  `max_tool_calls`, `max_retrieved_bytes`) for a **single** request. That object is
  `[PROPOSAL — contract v0]` strategy prose, not an accepted contract, and is realized by no schema
  at `eedadc5`. `res-*` bounds are reservation and accounting across a call tree, not a
  per-request cap list. This packet does not adopt, extend, replace, or deprecate that object, does
  not depend on it, and does not assume it will survive into any accepted contract.
- Existing tokens are **not renamed, not deprecated, and not re-pointed** by this proposal. The
  four accepted usages above keep their exact current meaning and bytes, and the fifth,
  `PROPOSAL`-status usage is left exactly as it stands.

No mapping table between `res-*` outcomes and the five existing usages is proposed here. Whether
one is needed is downstream design work, and inventing it now would be exactly the kind of
speculative coupling this packet is meant to prevent.

### 4.3 The "budget" noun residue — **resolved as `4b`: `res-bounds-*`**

**Decision: sub-answer `4b`.** The overloaded word `budget` is **removed from the noun position**
of every prospective name. The decided noun family is **`res-bounds-*`**, with
**`resource-bounds/`** at directory and manifest level. This is **naming only**: it creates no
schema, no path, no directory, no manifest, and no artifact now, and it authorizes no writer.

**Two superseded generations, both retained only as history.** `4b` was first recorded with the
noun family `res-envelope-*` / `resource-envelope/`. That form is **superseded**: independent
review found material semantic overload, because `contracts/json-schema/cybrik.envelope.v1.schema.json`
already exists as an `ACCEPTED FOR IMPLEMENTATION` cross-product carrier object and the bare word
`envelope` is already heavily loaded in the base tree (§4.3.2, §4.3.3). The adopted noun is
**`res-bounds-*`** / **`resource-bounds/`**. Both the `res-budget-*` / `resource-budget` forms and
the `res-envelope-*` / `resource-envelope/` forms are **superseded and must not be used**.

#### 4.3.1 What was decided, concretely

Every prospective §9 name is renamed **before any file is ever created**. Both superseded
generations are listed so no draft can inherit either one as if it were current:

| Superseded — original proposal (`res-budget-*`) | Superseded — first `4b` selection (`res-envelope-*`) | **Adopted name (`res-bounds-*`)** |
|---|---|---|
| `contracts/json-schema/cybrik.res-budget-grant.v1.schema.json` | `contracts/json-schema/cybrik.res-envelope-grant.v1.schema.json` | `contracts/json-schema/cybrik.res-bounds-grant.v1.schema.json` |
| `contracts/json-schema/cybrik.res-budget-error.v1.schema.json` | `contracts/json-schema/cybrik.res-envelope-error.v1.schema.json` | `contracts/json-schema/cybrik.res-bounds-error.v1.schema.json` |
| `contracts/examples/resource-budget/` | `contracts/examples/resource-envelope/` | `contracts/examples/resource-bounds/` |
| `docs/architecture/resource-budget/` | `docs/architecture/resource-envelope/` | `docs/architecture/resource-bounds/` |
| `contracts/compatibility/cybrik-suite-resource-budget-packet.v1.manifest.json` | `contracts/compatibility/cybrik-suite-resource-envelope-packet.v1.manifest.json` | `contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json` |

Both left columns are **superseded and must not be used**. **No file was ever created under any of
the three generations**, so nothing is renamed on disk — the supersession is of *names on a
proposal*, not of artifacts. The four `res-*` names that never contained the word `budget`
(`res-common-defs`, `res-reservation-request`, `res-reservation-result`, `res-release`) are
unchanged across all three generations. §9 carries the adopted family in full.

#### 4.3.2 Why `res-bounds-*`, and why not the other candidates

The original candidate set was `res-grant-*` / `res-envelope-*` / `res-quota-*` /
`res-allowance-*`. The decision turns on §6 and on collision behaviour, not on taste:

- **`res-quota-*` and `res-allowance-*` are rejected.** Both nouns can be read as conferring an
  entitlement — a quota *granted to* a principal, an allowance *held by* a principal. That reading
  implies an **authority axis**, which is exactly what `T11-RB-6` and §6.3 forbid. A name that
  invites "the holder of the allowance may act" is a name that will eventually be implemented that
  way.
- **`res-envelope-*` was chosen first, then superseded on review.** The authority argument for it
  held — "envelope" says nothing about who may act — but it failed on a second axis that the first
  selection did not test. `envelope` is **already a carrier-object noun in the accepted contract
  set**: `contracts/json-schema/cybrik.envelope.v1.schema.json` is the *"CYBRIK CloudEvents-style
  cross-product envelope v1"*, `ACCEPTED FOR IMPLEMENTATION` v0.1.0, registered in
  `contracts/compatibility/cybrik-suite-contract-packet.v1.manifest.json:28` with
  `"kind": "envelope"`. Adopting `res-envelope-*` would have made "envelope" mean both *the
  cross-product message wrapper* and *a resource ceiling* — reintroducing, on a fresh noun, exactly
  the overload §4.1 exists to prevent. Superseded.
- **`res-bounds-*` is adopted.** "Bounds" denotes a **limit on quantity** — how much there is — and
  says nothing about who may act, so it keeps the §6.3 split that `envelope` also kept. What it
  adds is that `bounds` is **already used in the base tree in precisely this sense and no other**:
  ADR-0004 F7 *"mandatory execution bounds"* and the inference analogue TI-4 *"Mandatory bounds"*
  (§4.3.3). The word is therefore **semantically aligned rather than overloaded** — a `res-bounds-*`
  family names the same kind of thing the tree already calls bounds, instead of colliding with a
  distinct carrier object as `envelope` did.
- **`res-grant-*` as a family noun is not adopted**, for the same authority-adjacency reason as
  `quota`/`allowance`. The word survives only in the **leaf** position of
  `cybrik.res-bounds-grant.v1.schema.json`, where `bounds` is the family noun and `grant` names
  the payload that describes a bounded quantity — not a permission. If that leaf ever proves to read
  as authority-conferring in review, it is renamed then, at design time, under §12.

#### 4.3.3 The collision scan actually performed, and what it does **not** establish

A read-only collision scan **was** run for the adopted noun, at the exact base
`eedadc561700d3e1fa052322d44eb63151df0009`, over the whole tree (`git grep -I … eedadc5 -- .`).
Results, reported as measured:

| Token searched | Result at `eedadc5` |
|---|---|
| `res-bounds` (exact, adopted stem) | **0 occurrences** |
| `resource-bounds` (exact, adopted directory form) | **0 occurrences** |
| `res_bounds` (snake-case variant) | **0 occurrences** |
| bare `bounds` (word-boundary, case-insensitive) | **15 lines / 16 occurrences** — 13 of them lowercase `bounds` |
| bare `envelope` (word-boundary, case-insensitive), for comparison | **171 lines / 186 occurrences**, plus the accepted `cybrik.envelope.v1.schema.json` carrier |

So the adopted prefixed stems `res-bounds` and `resource-bounds` are **unused at this base**, and
the bare word `bounds` — while present — is used in a **semantically aligned** way rather than as a
competing carrier object. All 15 lines are the resource-ceiling sense the instrument is about:
*"Mandatory execution bounds (ADR-0004 F7): every invocation is time/CPU/RAM/output/egress
bounded"* (`contracts/json-schema/cybrik.capability.v1.schema.json:92`), *"Mandatory context/token
bounds (analogue of ADR-0004 F7 execution bounds, applied to inference)"*
(`contracts/json-schema/cybrik.model-common-defs.v1.schema.json:86`), TI-4 *"Mandatory bounds"*
(`contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json:61`), the ADR-0004 F7
manifest role line, adapter *"Bounds clamping"*, two negative-fixture invariants, and prose uses of
the verb *"bounds"*. **`bounds` names no object anywhere in the tree** — there is no
`cybrik.bounds.*` schema, no `bounds` payload key, and no `"kind": "bounds"`. This is the exact
contrast with `envelope`, which does name an accepted object.

Stated plainly so no reader infers more than was measured:

- The scan establishes only that **`res-bounds` and `resource-bounds` are unused at `eedadc5`**,
  and that the bare token `bounds` is aligned in sense with the instrument. It is a **point-in-time
  read of one tree**.
- **No claim of uniqueness in all future code is made.** This packet does not assert that
  `res-bounds` / `resource-bounds` will remain free, does not assert freedom in any other tree,
  branch, worktree, or product repository, and does not assert that no future member may introduce
  the token. The scan covered `eedadc5` and nothing else — notably **not** the unintegrated W1-C1,
  W1-C2, and W2-I lanes (§2.2), which were not searched for these tokens.
- The collision recheck for `res-bounds`, `resource-bounds`, and the bare token `bounds`
  **remains mandatory** and must be re-performed **against the canonically integrated tree**, not
  against `eedadc5` and not from an unintegrated lane, **before any file bearing these names is
  created**. If that recheck finds a collision, the noun is re-decided — it is not disambiguated by
  a writer downstream (§12.2).

#### 4.3.4 The argument the decision closes, retained

The tension is retained because it explains the choice rather than being smoothed away. §4.1 argues
that reusing the bare word `budget` on the wire is unsafe; the original §9 family **did not fully
honour that argument**, keeping `budget` as the noun under the `res-` prefix. The two readings put
to the decider were:

- **In favour of keeping `res-budget-*` (the `4a` reading, not chosen).** The prefix `res-` is what
  a parser, a router, and a grep discriminate on; `res-budget-grant` cannot be confused with the
  bare `budget_exceeded` status, the `BUDGET_*` error-code family, the `over_*_budget` error
  classes, `fallbackInfo.reason = "budget"`, or the bare `budget` object on the strategy-05
  investigation request, none of which carry a `res-` prefix.
- **Against keeping it (the `4b` reading, chosen).** It leaves the overloaded word in the
  identifier a human actually reads aloud in an incident, which is precisely where §4.1 says the
  distinction is most expensive to lose. A reader skimming for "budget" would hit six usages
  instead of five.

`4b` wins on the second reading: the discriminator should hold for a human under incident pressure,
not only for a grep. Prose still says "resource budget" (§4), so legibility is preserved without
putting the overloaded token in a file name. **No existing token is renamed, deprecated, or
re-pointed by this choice** — the four accepted usages and the fifth `PROPOSAL`-status usage keep
their exact current meaning and bytes (§4.2).

---

## 5. The conserved-parent invariant

The single load-bearing semantic of the proposed instrument, stated as an invariant:

> **A child reservation subtracts from its parent, and therefore from the root. Spawning never
> mints resources.**

Consequences, each stated so that it can be tested rather than admired:

1. **Conservation.** For any node, the sum of resources reserved by its children never exceeds the
   resource remaining to that node. Resource enters the tree at the root and only at the root.
2. **No minting on spawn.** Creating a child, a sub-agent, a sub-investigation, a nested tool call,
   or a retry does **not** create new resource. A spawn that cannot be covered by the parent's
   remainder is refused, not funded.
3. **Monotone drawdown.** A child's reservation reduces the parent's remainder at reservation time,
   not at completion time. Optimistic spawn-now-account-later reintroduces minting through the
   back door.
4. **Logical fanout may be unbounded; admitted fanout is finite.** Nothing here caps how many
   children a design may *describe*. The invariant caps how many can be **admitted and
   resourced**. An unbounded logical fanout against finite root bounds simply means that
   beyond some point, admission fails — which is the intended and safe behaviour. The distinction
   between *describable* fanout and *admitted* fanout is the whole point: it converts an unbounded
   design into a bounded execution without forbidding the design.
5. **Depth is not a substitute.** A depth limit does not imply conservation and conservation does
   not imply a depth limit. They are independent controls; this invariant is about the resource
   axis only.

This invariant is proposed as **schema-expressible and property-testable in the Suite** (§8). It is
not proposed as an enforcement mechanism, because enforcement lives in product runtimes that this
packet has no authority over.

---

## 6. Authority model — derived, never parallel

The instrument must not create a second way to be allowed to do something. Two rules, both derived
from already-accepted contracts:

**6.1 Authoritative tenant comes from the caller credential.** This is already normative and is
quoted:

> *"Opaque authoritative tenant identifier. The value carried in any payload is advisory only; the
> receiving service derives the authoritative tenant from the caller credential and MUST reject on
> mismatch (ADR-0006 E1; strategy 05 §3)."*
> — `contracts/json-schema/cybrik.common-defs.v1.schema.json:28` @ `eedadc5`

A `res-*` payload therefore **may carry an advisory tenant hint and must never be the source of
tenant truth**. A reservation whose payload tenant disagrees with the credential is rejected, in
exactly the same way and for exactly the same reason as every other contract site.

**6.2 Policy scope derives from the W2-G org-scope, which itself carries no authority.** Also
already normative:

> *"Opaque, advisory organizational-scope reference (ADR-0007 org-hierarchy model). It scopes
> policy/model-class selection to an org unit but carries NO authority: the authoritative org/tenant
> is derived from the caller credential, never from this hint. Kept intentionally opaque because
> ADR-0007's contract delta is PROPOSED — NOT APPLIED; this packet does not depend on that
> unapplied delta."*
> — `orgScopeRef.description`, `contracts/json-schema/cybrik.model-common-defs.v1.schema.json:129`
> (object at `:127-129`) @ `eedadc5`

The trailing clause is quoted in full deliberately: it records that **ADR-0007's contract delta is
itself `PROPOSED — NOT APPLIED`**. The `res-*` instrument may therefore scope selection by an
org-scope reference **only in the already-shipped opaque form**, and must not be designed against
the unapplied ADR-0007 delta.

Quota and ceiling **selection** may therefore be scoped by the W2-G org-scope reference
(`org_scope` / `org_path`, per ADR-0009, `ACCEPTED FOR IMPLEMENTATION` v0.1.0), exactly as
model-class selection already is. What is selected is a *policy*, and what authorizes is the
*credential*.

**6.3 The prohibition.** The instrument must **never introduce a parallel grant or authority
axis** — no budget token that confers permission, no reservation handle that acts as a capability,
no "holder of the reservation may act" semantics. A reservation answers *how much remains*; it never
answers *who may act*. If those two questions ever collapse into one field, the field is a
credential, and it will be forged. `T11-RB-6` is **decided `yes`**: quota and ceiling authority is
**derived only**, and **no `res-*` authority axis exists or may be introduced**. This is the
decision that drove the §4.3 noun choice away from `res-quota-*` and `res-allowance-*`.

---

## 7. Cancellation and no-remint are dependencies, not obligations on accepted members

Root cancellation ("cancelling the root releases the subtree") and no-remint ("released resource
does not reappear as new resource") are **required properties of the instrument**. They are
recorded here as **dependencies on W1-C2 and ADR-0003**, and explicitly **not** as obligations
that mutate those accepted members.

| Property | Depends on | What that dependency does and does not mean |
|---|---|---|
| Root cancel propagates to the subtree | **W1-C2** investigation lifecycle (`ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`), which already owns investigation cancel semantics | The instrument **consumes** W1-C2's existing cancel lifecycle. It does **not** add a cancel obligation to W1-C2, does not require a W1-C2 re-acceptance, and does not change one accepted W1-C2 byte. |
| Released resource is not re-minted | **ADR-0003** durable agent orchestration (`ACCEPTED`, decision-only), which owns durable execution state | The instrument **relies on** durable state to distinguish "released" from "available again". It does **not** impose a new obligation on ADR-0003, and cannot, since ADR-0003 grants no implementation authority to anyone. |

The direction of the arrow is the whole point. **The instrument depends on accepted members; the
accepted members acquire nothing.** Writing these as obligations would amount to editing an
accepted contract from an unaccepted lane, which is prohibited. If the dependency turns out to be
unsatisfiable against W1-C2 or ADR-0003 as accepted, the correct outcome is that **the instrument
is re-scoped or dropped** — never that an accepted member is amended to fit it. `T11-RB-7` is
**decided `yes`**: cancellation and no-remint are **dependency wording only**. Recording this
decision **mutates nothing in W1-C2 or ADR-0003, requires no re-acceptance of either, and changes
no accepted byte**; both keep their exact current statuses as quoted in §2.

---

## 8. Evidence separation — Suite proof is PROPOSED; runtime stays HOLD

Two distinct bodies of work, which must never be reported as one.

### 8.1 In scope to *propose* (Suite-only, docs/contract artifacts)

Achievable entirely within `cybrik-suite`, offline, with no product code and no running system:

- JSON Schema definitions for the `res-*` family;
- **property tests** of the §5 conserved-parent invariant over synthetic trees — conservation,
  no-mint-on-spawn, monotone drawdown, finite admitted fanout;
- **replay proof**: a fixed corpus of recorded reservation/release sequences replayed through the
  schema and invariant checks, producing a deterministic verdict;
- positive and negative example fixtures, and a compatibility manifest.

This is **static, documentary, offline** evidence. It proves the *instrument is internally
coherent*. It proves nothing about any running system. Even fully green, it remains `PROPOSED`
until a Founder gate accepts it, and a green validator run is a conformance signal only, never
acceptance by itself.

### 8.2 The local L1 … L5 labels, and what is out of scope — `HOLD`

This packet uses five evidence-level labels. All five are **defined here and only here**. `L1` and
`L2` are exactly the Suite-only, offline work described in §8.1; `L3` … `L5` are everything that
requires a running system and are all `HOLD`:

| Local label | In/out of scope here | Meaning **in this packet only** |
|---|---|---|
| **L1 — schema/structural conformance** | in scope to *propose* (§8.1) | Suite-only, offline. The `res-*` JSON Schema definitions validate, and the positive / negative-schema / negative-semantic example fixtures accept and reject exactly as specified. Static documents checked against static documents; nothing executes. |
| **L2 — property proof and deterministic replay** | in scope to *propose* (§8.1) | Suite-only, offline. Property tests of the §5 conserved-parent invariant over synthetic trees (conservation, no-mint-on-spawn, monotone drawdown, finite admitted fanout), plus replay of the fixed corpus of recorded reservation/release sequences through the schema and invariant checks. Replay is driven by a **deterministic virtual clock over fixtures** — no wall-clock time, no concurrency, no network, no running service — so the verdict is byte-reproducible on re-run. |
| **L3 — integrated multi-repo runtime, adversarial/crash** | out of scope — `HOLD` | Real cross-repo execution against running services, including adversarial input and crash/fault injection. |
| **L4 — bounded soak** | out of scope — `HOLD` | Sustained load over a bounded duration against a running system. |
| **L5 — restart / recovery, production-representative** | out of scope — `HOLD` | Restart, recovery, and durable-state behaviour in a production-representative deployment. |

Also out of scope under every answer in §10:

- **Product implementation** in `cybrik-cyber-ai-platform`, `cybrik-security-tool-fabric`, or
  `cybrik-soc-command-center` — not authorized by this packet.
- **W0-T10** (real four-repo shadow vertical) and **W0-T11** (walking-skeleton baseline) — both
  remain `HOLD` per the base tree.

`L1` and `L2` being achievable in the Suite does **not** make them runtime evidence. They prove
document-level coherence only; the ladder deliberately places every claim about behaviour of a
running system at `L3` and above.

**Honesty note on the L-ladder — and a disclosed token collision:** no canonical L1 … L5
evidence-level register exists in the base tree. A search of `docs/` at `eedadc5` finds source line
references (`L56`, `L75`, …) and **SOC analyst tiers**, not an evidence ladder. The analyst-tier
usage is not confined to `L1/L2`: `L3` is *already taken* in the base tree as an analyst tier —

> *"Persona chính là SOC L1/L2 analyst; L3/hunter và SOC manager là secondary."*
> — `docs/strategy/04-CORE-USE-CASES-AND-RELEASE-SCOPE.md:13` @ `eedadc5`

So `L3` in this packet (*integrated multi-repo runtime evidence*) and `L3` in strategy 04
(*hunter-tier SOC analyst*) are **different things wearing the same token**. To state the
consequence plainly:

- **All five** labels — `L1`, `L2`, `L3`, `L4`, `L5` — are **evidence levels defined locally in
  this document**, with the meanings given in the §8.2 table above and nowhere else. `L1` and `L2`
  are as local as `L3` … `L5`; being the achievable ones confers no external standing on them.
- They are **not gate identifiers**. They are unrelated to `Gate W2-*` and `GATE A<n>`, they do not
  name, imply, or substitute for any gate, and no gate may be opened or closed by reference to one.
- They are **not the SOC analyst tiers** of strategy 04, and must never be read as a persona,
  seniority, or staffing claim. Nothing in this packet renames, deprecates, or re-points that
  existing analyst-tier usage.
- They are **not a citation of an established register**, because no such register exists.

Because of that collision, any future document that needs a durable ladder should pick tokens that
do not collide with the analyst tiers. Defining a canonical ladder is separate work under a
separate identity, and this packet neither performs it nor asks for it.

The separation restated so it cannot be blurred: **a green Suite-only replay proof is not runtime
evidence, is not integration evidence, is not a T11 baseline, and may not be cited toward any of
them.**

---

## 9. Prospective contract path family — named, **not created**

If and only if a gate is later opened and a contract writer is authorized, the family below is the
prospective shape, carrying the adopted `res-bounds-*` / `resource-bounds/` naming (§4.3).
**None of these files exist, this lane creates none of them, and the decision recorded in this
packet creates none of them.** The only file this lane writes is the packet you are reading.

```
contracts/json-schema/cybrik.res-common-defs.v1.schema.json
contracts/json-schema/cybrik.res-bounds-grant.v1.schema.json
contracts/json-schema/cybrik.res-reservation-request.v1.schema.json
contracts/json-schema/cybrik.res-reservation-result.v1.schema.json
contracts/json-schema/cybrik.res-release.v1.schema.json
contracts/json-schema/cybrik.res-bounds-error.v1.schema.json
contracts/examples/resource-bounds/positive/
contracts/examples/resource-bounds/negative-schema/
contracts/examples/resource-bounds/negative-semantic/
contracts/examples/resource-bounds/examples-manifest.json
contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json
docs/architecture/resource-bounds/
```

The names follow the existing convention verified at `eedadc5` — `cybrik.<family>-<noun>.v1.schema.json`
with a `<family>-common-defs` sibling, matching the `model-*`, `org-*`, `svc-*`, and
`investigation-*` families.

**Superseded names — do not use.** Two earlier generations of these names exist in this packet's
history, and **both are superseded**:

1. The original proposal named `cybrik.res-budget-grant.v1.schema.json`,
   `cybrik.res-budget-error.v1.schema.json`, `contracts/examples/resource-budget/…`,
   `docs/architecture/resource-budget/`, and
   `contracts/compatibility/cybrik-suite-resource-budget-packet.v1.manifest.json` — superseded by
   `T11-RB-4` sub-answer `4b`.
2. The first `4b` selection named `cybrik.res-envelope-grant.v1.schema.json`,
   `cybrik.res-envelope-error.v1.schema.json`, `contracts/examples/resource-envelope/…`,
   `docs/architecture/resource-envelope/`, and
   `contracts/compatibility/cybrik-suite-resource-envelope-packet.v1.manifest.json` — superseded on
   review for semantic overload against the accepted `cybrik.envelope.v1.schema.json` carrier
   (§4.3.2).

Both sets are retained in §4.3.1 for traceability only and **must not be used**. Because no file was
ever created under any generation, nothing is renamed on disk; the supersession applies to names on
a proposal.

**Status of the paths above:** they are **decided names, not created paths, and not reserved
paths**. Creating any of them still requires, in order — canonical integration of W1-C1 and W1-C2
(`T11-RB-3`), a Founder-opened gate (`T11-RB-2` is currently `A`: **no gate**), an authorized
contract writer, and the mandatory `res-bounds` / `resource-bounds` / `bounds` collision
recheck against the integrated tree (§4.3.3). The `eedadc5` scan in §4.3.3 found the adopted stems
unused **at that base only**; **no claim of uniqueness in any other tree, or in future code, is made
for any path above.**

---

## 10. Decisions — requested, and now recorded

Eight answers. Each is `yes`/`no` or `A`/`B`; `T11-RB-4` additionally required one explicit
sub-answer (`4a`/`4b`). **All eight, including the sub-answer, are now decided.** They were decided
by the **Founder-delegated coordinator** under delegated authority on **2026-07-29
(`Asia/Ho_Chi_Minh`)**. No answer is inferred and none is left to a default. The consolidated
record, with the ceiling on what each answer authorizes, is §14.

Each subsection below retains the question and the options as they were put, then records the
answer. **Options not chosen are retained for traceability and are not in force.**

### T11-RB-1 — Identity (A/B) — **DECIDED: A**

The instrument is not T11 and is not task 49. Under which existing identity does it sit?

- **A (recommended, and DECIDED)** — assign it as a **sub-lane under an existing identity in the
  roster of 48**, recorded as a sub-lane of that identity and never as a new identity. The roster
  stays at exactly 48 and no task 49 is minted.
- **B (not chosen)** — **reassign** the work to a named existing identity outright, retiring the
  T11 filename association entirely and renaming this packet on any future revision.

**Decision: A.** The identity is the **sub-lane `W0-T11/RB` under the existing `W0-T11`**. The
roster remains exactly 48, **no task 49 is minted**, and W0-T11's own `HOLD until real vertical
exists` status is untouched (§1). The sub-lane label is internal to this packet: this lane adds no
board row and edits no board file.

### T11-RB-2 — Gate name and opening (A/B) — **DECIDED: A**

- **A (recommended, and DECIDED)** — **do not open a gate now.** Register the instrument as
  `PROPOSED` with no gate identifier assigned. A gate name is allocated only when a gate is
  actually opened.
- **B (not chosen)** — open a gate now under a name the Founder specifies, following the existing
  convention. Two verified naming forms exist at `eedadc5`: a `Gate W2-<letter>` form (`Gate W2-B`,
  `Gate W2-C1`, `Gate W2-D`, `Gate W2-F`, `Gate W2-G`) and a `GATE A<n>` form (`GATE A2`,
  `GATE A3`, `GATE A4`). **These lists are examples of each form, not a complete gate register** —
  this packet does not enumerate the register and does not assert that no other gate identifier
  exists at `eedadc5`. Had **B** been chosen, the register would have had to be re-read in full
  against the integrated tree before a name was assigned.

**Decision: A — no gate is opened and no gate identifier is allocated or reserved**, because §2.2
shows no co-resident integrated tree exists yet, and a gate opened against a distributed accepted
set cannot be evidenced cleanly. Opening a gate later is a **separate Founder decision**, not a
consequence of this one.

### T11-RB-3 — Sequencing (yes/no) — **DECIDED: yes**

Confirm: **one contract packet at a time, and only after W1-C1 and W1-C2 are canonically
integrated.** No new contract packet — including this instrument — starts while C1/C2 remain
accepted-as-local-commits-only on unintegrated branches.

**Decision: yes** — the direct remedy for §2.2. Consequently the instrument is **`PARKED`**: it
stays parked **until W1-C1 and W1-C2 are canonically integrated into one tree**, and while parked
there is **no contract lane, no writer, no further packet, and no file creation** (§12.1). Parked
is the packet's operative state, not a waiting-room for work already authorized — nothing is
authorized.

### T11-RB-4 — Wire prefix, and the noun family — **DECIDED: yes, sub-answer 4b**

Confirm **`cybrik.res-*`** as the wire/file prefix, with **"resource budget"** retained in prose,
and the §4.2 disambiguation from `budget_exceeded`, the `BUDGET_*` stable error-code family,
`over_input_budget` / `over_output_budget`, `fallbackInfo.reason = "budget"`, and the bare `budget`
object at `docs/strategy/05-CONTRACTS-AND-INTEGRATION.md:102` bound as normative — with **no rename
or deprecation** of the **four existing accepted usages, which are carried by five token strings**
(`budget_exceeded`; `BUDGET_*`; `over_input_budget` **and** `over_output_budget`, which are two
distinct token strings naming one usage — the single per-call model token-ceiling error class; and
`fallbackInfo.reason = "budget"`) — and **no adoption, extension, replacement, or deprecation** of
the fifth usage, the `PROPOSAL`-status bare `budget` object, which is counted and treated separately
from those four and is not one of the five accepted token strings.

**Decision: yes** for the prefix itself, and **yes** for every disambiguation and no-rename
boundary listed above, bound exactly as §4.2 states them.

**Sub-answer — the question as it was put (§4.3, §9):** the proposed file names kept the overloaded
word as their noun (`res-budget-grant`, `res-budget-error`, plus `resource-budget/` directories and
manifest). The two options were:

- **4a (not chosen) — accept the adjacency.** `res-budget-*` is acceptable; the `res-` prefix
  carries enough discrimination and the familiar noun is worth keeping.
- **4b (DECIDED) — choose a cleaner noun family.** Replace the `budget` noun with a different
  `res-*` noun (candidates put forward: `res-grant-*`, `res-envelope-*`, `res-quota-*`,
  `res-allowance-*` — **none checked for collisions beyond the `cybrik.res-` prefix search**) and
  rename the §9 paths accordingly **before any file is created**.

**Sub-answer decided: `4b`. The adopted noun family is `res-bounds-*`** for contract and artifact
stems, with **`resource-bounds/`** for directories and the manifest. All prospective §9 paths and
names carry that form **before any file is ever created** (§4.3.1, §9).

**Both earlier noun forms are superseded and must not be used:** the prospective `res-budget-*` /
`resource-budget` forms (superseded by `4b` itself), and the briefly selected `res-envelope-*` /
`resource-envelope/` forms. The latter was withdrawn on independent review: `envelope` is already
the noun of an accepted carrier object — `cybrik.envelope.v1.schema.json`, `ACCEPTED FOR
IMPLEMENTATION` v0.1.0, registered with `"kind": "envelope"` — and the bare word occurs on 171
lines at `eedadc5`, so `res-envelope-*` would have reintroduced on a fresh noun exactly the overload
§4.1 exists to prevent (§4.3.2).

`res-quota-*` and `res-allowance-*` were **rejected specifically because they can imply an
authority axis**, which `T11-RB-6` and §6.3 forbid; `res-bounds` denotes a **limit on quantity**,
while §6's derived-only authority remains controlling (§4.3.2).

**This is naming only.** It creates no schema, no path, no directory, no manifest, and no artifact
now, and it authorizes no writer. A collision scan for the adopted noun **was** performed at
`eedadc5` and found `res-bounds` and `resource-bounds` **unused there** (0 occurrences each), with
bare `bounds` present on 15 lines in the aligned ADR-0004 F7 / TI-4 *mandatory bounds* sense and
naming no object (§4.3.3). **That establishes freedom at one base, not uniqueness in future code**;
the collision recheck against the canonically integrated tree remains **mandatory** before any file
bearing these names is created.

### T11-RB-5 — Conditional ADR number (yes/no) — **DECIDED: yes**

Confirm that **ADR-0012 is recorded as a conditional candidate, not an allocation** — the next
arithmetic number *if and only if* ADR-0011 lands in a co-resident integrated registry, per §3, and
that number assignment happens **last**, against the integrated tree.

**Decision: yes.** ADR-0012 is a **conditional candidate only. No ADR number is allocated or
reserved by this packet**, and the number is to be assigned **last**, against the integrated
registry.

### T11-RB-6 — Derived quota authority (yes/no) — **DECIDED: yes**

Confirm that quota/ceiling authority is **derived only**: authoritative tenant from the caller
credential (`common-defs` `tenantId`), policy scope from the W2-G org-scope reference (advisory,
no authority), and **no parallel grant or authority axis** introduced by any `res-*` field, per §6.

**Decision: yes.** Quota and ceiling authority is **derived only**, and **there is no `res-*`
authority axis**. This is the constraint that governed the §4.3.2 noun choice.

### T11-RB-7 — Cancellation / no-remint wording (yes/no) — **DECIDED: yes**

Confirm that root-cancel propagation and no-remint are recorded as **dependencies on W1-C2 and
ADR-0003 only**, and explicitly **not** as obligations that mutate, extend, or require
re-acceptance of those accepted members, per §7.

**Decision: yes** — **dependency wording only. No mutation and no re-acceptance of W1-C2 or
ADR-0003**, and no accepted byte of either is changed.

### T11-RB-8 — `G-C` and the binding checkpoint (yes/no) — **DECIDED: yes**

Confirm that **`G-C` is not used as a gate identifier for this work**, and that the binding
checkpoint referenced by this packet is the **`2026-12-20` Founder go/no-go for stable v1.0**.

Verified basis: the token `G-C` appears in the base tree only in
`docs/operations/W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md:1082` and `:1121`, both times as
`G-C stable-v1.0`; it does **not** appear in either verified gate-naming form —
`Gate W2-B/W2-C1/W2-D/W2-F/W2-G` or `GATE A2/A3/A4` (examples of each form, not a complete
register; see `T11-RB-2`). The dated milestone is verified at `docs/strategy/06-ROADMAP-2026-2029.md:575` —
*"2026-12-20 | Founder go/no-go stable v1.0 based on evidence pack"*.

**Decision: yes** — **`G-C` is not a gate identifier for this work and is not used as one**, and
the binding checkpoint is the dated **`2026-12-20` Founder go/no-go for stable v1.0**. That date is
**referenced, not changed** (§11).

---

## 11. Boundaries retained

These boundaries were stated for every possible answer in §10, and they are **retained unchanged
now that the answers are recorded**. Deciding did not relax any of them. This packet, as decided:

- **Creates no file but this one.** The naming decision (`T11-RB-4` / `4b`) is naming only: it
  creates no schema, path, directory, manifest, example, or artifact, and reserves no path.
- **Opens no gate and allocates no gate identifier** (`T11-RB-2` = A).
- **Changes no date.** W1 `2026-08-01 → 2026-08-23`, the release window
  `2026-12-21 → 2026-12-31`, and the `2026-12-20` stable-v1.0 go/no-go are unchanged.
- **Flips no status anywhere else.** The **only** status that changed is this packet's own header
  line, from `PROPOSED — NOT DECIDED` to `DECIDED — PARKED`, which records that the eight questions
  were answered. **No contract, ADR, gate, task, or roadmap status is changed**: no `PROPOSED`
  becomes `ACCEPTED`; no `HOLD` is lifted; W0-T10 and W0-T11 stay `HOLD`; ADR-0003/0005/0009/0010,
  W1-C1 and W1-C2 keep their exact current statuses and bytes. `DECIDED` here means *the questions
  are answered*, never *the instrument is accepted* — the instrument remains `PROPOSED` and
  `PARKED`, and is `NOT INTEGRATED`.
- **Authorizes no contract writer and no product writer.** No schema, OpenAPI, example, manifest,
  or product source file is created or edited by this lane, in this repository or any other.
- **Authorizes no runtime, demo, or stack.** No endpoint, service, container, database, broker,
  or local stack is started; no dependency is installed; no migration is run; no formatter or
  auto-fixer is run.
- **Carries no commit, push, merge, integration, deployment, or release authority.** Nothing is
  staged; the index is left empty.
- **Mints no identity.** The roster stays at exactly 48 with no task 49.
- **Allocates no ADR number.**
- **Claims no CI.** CI is **NOT WIRED** and no CI result is claimed anywhere in this packet.
- **Reads no secrets** and writes to no other repository and no other worktree. **More than one
  read was taken outside `eedadc5`**, and each is read-only and recorded in §13:
  - the **W2-I draft worktree** — the untracked `PROPOSED` ADR-0011 draft and its `git status` /
    `git ls-tree` state, cited in §2.2, in another worktree of this same repository; and
  - the **dirty canonical/source checkout** — the working-tree state and the
    `git ls-files --error-unmatch` untracked check on the W2-I contract artifacts, cited in §2.2
    and §13, in the source checkout of this same repository.

  Both are observations only: nothing was written, staged, or modified in either location, and no
  file outside this packet was touched anywhere.

---

## 12. Next steps and stop conditions

### 12.1 Next steps, in order — and the ceiling while `PARKED`

Step 1 is **done**. Steps 2 onward are the forward path, and step 2 is where the instrument now
sits.

1. ~~**Founder answers `T11-RB-1` … `T11-RB-8`.**~~ **Complete** — all eight decided 2026-07-29 by
   the Founder-delegated coordinator (§10, §14).
2. **`T11-RB-3 = yes`, so the instrument is `PARKED` — this is the current state.** Parked until
   W1-C1 and W1-C2 are canonically integrated into one tree. **Parked means: no contract lane, no
   writer, no further packet, no file creation, no gate, no ADR number.**
3. **After C1/C2 canonical integration**, re-verify §2 against the integrated tree — statuses,
   member set, and the ADR register — and re-confirm §3's numbering condition. **Also perform the
   mandatory `res-bounds` / `resource-bounds` / `bounds` collision recheck against that
   integrated tree (§4.3.3). The `eedadc5` scan recorded in §4.3.3 does not discharge that
   recheck — it covers one base and none of the unintegrated lanes.** Any drift, or any collision
   found, invalidates this packet and requires a revision, not a patch — including re-deciding the
   noun if it collides.
4. **Only then**, and only if a gate is opened by a **separate** Founder decision (`T11-RB-2` is
   currently `A`: no gate), request authorization for a **single** contract lane to draft the §9
   family as `PROPOSED`, with the §8.1 Suite-only property and replay proof.
5. **Product implementation and the local `L3` / `L4` / `L5` levels — integrated runtime with
   adversarial/crash, bounded soak, restart/recovery (§8.2) — remain `HOLD`** throughout and require their
   own separate Founder decisions.

**Ceiling on the parked state — what the recorded decisions do *not* authorize.** Nothing in §10 or
§14 permits any of the following, and no reader, writer, or reviewer may treat a decided answer as
permission for it:

| Not authorized while `PARKED` | Why |
|---|---|
| Creating any `contracts/` file, example, manifest, or `docs/architecture/resource-bounds/` directory | `T11-RB-2` = A, no gate; no writer authorized; §9 names are decided, not created |
| Reserving, claiming, or pre-creating any §9 path | Names are naming only (§4.3, §9) |
| Writing an ADR, or citing ADR-0012 as this instrument's number | `T11-RB-5` — conditional candidate, not an allocation (§3) |
| Adding a roster row, a task 49, or a board edit for `W0-T11/RB` | `T11-RB-1` = A — sub-lane label only (§1) |
| Opening, naming, or implying a gate — including `G-C` | `T11-RB-2` = A; `T11-RB-8` (§10) |
| Starting a second contract packet in parallel | `T11-RB-3` — one at a time (§10) |
| Product implementation in any product repository | Out of scope under every answer (§8.2) |
| Any runtime, demo, stack, dependency install, migration, formatter, or CI claim | §11; **CI: NOT WIRED** |
| Any stage, commit, push, merge, integration, deploy, or release | §11 — this lane carries none of that authority |

### 12.2 Stop conditions — halt immediately and report

- Any recorded answer in §10 / §14 being treated as ambiguous, re-derived, silently revised, or
  extended beyond the ceiling in §12.1.
- Any instruction to edit an existing file from this lane.
- Any request to create a `contracts/` file, an ADR, or an ADR number from this lane.
- Any drift discovered between §2 and the tree at the time of the next step.
- Any suggestion that a green Suite-only proof satisfies T10, T11, integration, or runtime.
- Any proposal to rename, deprecate, or re-point `budget_exceeded`, the `BUDGET_*` stable
  error-code family, `over_input_budget`, `over_output_budget`, or
  `fallbackInfo.reason = "budget"`; or to mint a `BUDGET_*` member code from this lane.
- Any proposal to adopt, extend, replace, deprecate, or build on the bare `budget` object at
  `docs/strategy/05-CONTRACTS-AND-INTEGRATION.md:102`, or any citation of it as an accepted
  contract rather than as `PROPOSAL`-status strategy prose.
- Any use of either **superseded** noun generation from §4.3.1 — `res-budget-*` /
  `resource-budget`, or `res-envelope-*` / `resource-envelope` — or any attempt to re-open,
  re-litigate, or vary the adopted `res-bounds-*` / `resource-bounds/` noun family downstream — by
  a writer, by a reviewer, or by inheriting a superseded draft name as if it were current.
- Any claim that the §4.3.3 `eedadc5` scan establishes uniqueness in future code, in any other
  tree, or in the unintegrated W1-C1 / W1-C2 / W2-I lanes. It establishes freedom of `res-bounds`
  and `resource-bounds` **at that one base only**. Creating any file under the adopted names
  **before** the mandatory recheck against the canonically integrated tree is a stop condition.
- Any treatment of the decided §9 names as created paths, reserved paths, or writer authorization.
- Any use of this packet's local `L1` … `L5` evidence labels as gate identifiers, as SOC analyst
  tiers, or as a citation of a canonical register.
- Any proposal to add an obligation to W1-C2 or ADR-0003, or to amend an accepted member to fit
  the instrument.
- Any proposal that a `res-*` field confer permission rather than report remainder.
- Any request to stage, commit, push, merge, integrate, deploy, or release.
- Any request to start a runtime, stack, or demo, or to install a dependency.

---

## 13. Verification record

Performed from this lane at preparation time, read-only against `eedadc5` unless noted:

| Check | Result |
|---|---|
| Base commit `eedadc561700d3e1fa052322d44eb63151df0009` exists | `git cat-file -t` → `commit` |
| Branch `codex/w1-d04-t11-resource-budget-gate-r1` absent before creation | `git rev-parse --verify` → *"Needed a single revision"* |
| Worktree path absent before creation | `ls` → *"No such file or directory"* |
| This file absent at base | `git ls-tree eedadc5 docs/adr/` → not listed |
| Worktree HEAD after creation | `eedadc561700d3e1fa052322d44eb63151df0009` |
| Paths written by this lane | exactly 1 — this file |
| Staged entries in this lane | 0 |
| W2-I ADR-0011 draft, read **outside** `eedadc5` (§2.2) | read-only from worktree `cybrik-worktrees/w1-48/w1-b05-w2i-adr-correction-r1`, branch `codex/w1-b05-w2i-adr-correction-r1`, HEAD `55e94c2815ee68ef49a6e10cdc41a76c227b7bd7`; `git status --porcelain` → `??`; `git ls-tree HEAD docs/adr/` → no `ADR-0011*`. Same repository, different worktree; nothing written there. |
| W2-I contract artifacts, read **outside** `eedadc5` (§2.2) | read-only in the source checkout (`codex/w2i-ai-inference-transport`): `git ls-files --error-unmatch` on `contracts/json-schema/cybrik.inference-transport-binding.v1.schema.json` and siblings → *"did not match any file(s) known to git"*, i.e. untracked. Same repository, dirty checkout; nothing written, staged, or modified there. |
| `BUDGET_*` stable error-code family (§4.1) | `contracts/json-schema/cybrik.tool-execution-result.v1.schema.json:88` declares the family in `$defs.error.description`; `docs/strategy/05-CONTRACTS-AND-INTEGRATION.md:462` lists it under "Stable error families". A tree-wide grep for `BUDGET_` at `eedadc5` returns **only those two lines** — no member code is enumerated anywhere |
| Bare `budget` object, the fifth usage (§4.1) | `docs/strategy/05-CONTRACTS-AND-INTEGRATION.md:102` declares a `budget` object with `deadline_seconds`, `max_model_calls`, `max_tool_calls`, `max_retrieved_bytes` in the `POST /api/v1/investigations` body (that document's §4.1); the document's own status line at `:4` reads `[PROPOSAL — contract v0, chưa dùng production]`. A tree-wide `git grep -w budget` at `eedadc5` finds **no `budget` object key anywhere under `contracts/`** — only prose and the `fallbackInfo.reason` enum member — so this usage is realized by no accepted schema |
| `GATE A<n>` forms present at `eedadc5` | `GATE A2`, `GATE A3`, `GATE A4` all occur; the packet cites them as **examples**, not as a complete gate register |
| `L3` token collision (§8) | `docs/strategy/04-CORE-USE-CASES-AND-RELEASE-SCOPE.md:13` uses `L3/hunter` as a SOC analyst tier; disclosed rather than avoided |
| Decision recording revision (this revision) | Re-verified at recording time: worktree HEAD still `eedadc561700d3e1fa052322d44eb63151df0009`; `git status --porcelain` reports this file as the **sole** entry (`??`); staged entries **0**. No other path was created, edited, staged, or read for this revision. |
| `res-bounds` / `resource-bounds` / `bounds` collision scan (§4.3.3) | **PERFORMED**, read-only at `eedadc561700d3e1fa052322d44eb63151df0009`, whole tree (`git grep -I … eedadc5 -- .`): `res-bounds` → **0**; `resource-bounds` → **0**; `res_bounds` → **0**; bare `bounds` (word-boundary, case-insensitive) → **15 lines / 16 occurrences**, all the aligned ADR-0004 F7 / TI-4 *mandatory bounds* sense, naming no object. Scope limit: one base, point-in-time; the unintegrated W1-C1 / W1-C2 / W2-I lanes were **not** searched. **No uniqueness in future code is claimed.** The recheck against the canonically integrated tree remains **mandatory and outstanding** (§4.3.3, §12.1 step 3). |
| `envelope` overload, basis for superseding `res-envelope-*` (§4.3.2) | `contracts/json-schema/cybrik.envelope.v1.schema.json` exists at `eedadc5` — *"CYBRIK CloudEvents-style cross-product envelope v1"*, `x-cybrik-status: ACCEPTED FOR IMPLEMENTATION`, v0.1.0 — and is registered at `contracts/compatibility/cybrik-suite-contract-packet.v1.manifest.json:28` with `"kind": "envelope"`. Bare `envelope` (word-boundary, case-insensitive) occurs on **171 lines / 186 occurrences**. `res-envelope` and `resource-envelope` themselves → **0** at `eedadc5`; the supersession is for **semantic overload against an accepted carrier object**, not for a literal path collision. |
| Gate opened / gate identifier allocated by this revision | **none** — `T11-RB-2` decided `A` |
| ADR number allocated or reserved by this revision | **none** — `T11-RB-5` decided `yes`, conditional candidate only |
| Files created under any §9 name | **0** — the §9 family is decided names only; no path exists |
| Accepted members mutated by this revision (W1-C1, W1-C2, ADR-0003/0005/0009/0010) | **none** — 0 bytes changed; statuses as quoted in §2 |
| Source repository working tree | **not clean before this lane began** — **29 modified, 72 untracked, 0 staged**, all pre-existing on `codex/w2i-ai-inference-transport`. The untracked count is **mode-dependent, and the two modes are not mixed here**: the **72** is measured with `git status --porcelain -uall`, which enumerates untracked files individually (file-level). Default `git status --porcelain` reports whole untracked directories as one entry each instead of their contents, and collapses that same state to **41 entries** — a different unit, not a different tree. Every number in this row is the `-uall` file-level measurement; the 29 modified and 0 staged are unaffected by the mode. This lane touched none of it; the isolated worktree is checked out at the pinned base and is unaffected by that state. |

All quoted statuses, line references, and token locations in this packet were re-read from
`eedadc5` during preparation. Every result is **static and documentary**. **CI: NOT WIRED.**

---

## 14. Decision record

### 14.1 Provenance

| Field | Value |
|---|---|
| Decider | **Founder-delegated coordinator**, acting under delegated authority |
| Decision date | **2026-07-29**, timezone `Asia/Ho_Chi_Minh` |
| Decided against | base tree `eedadc561700d3e1fa052322d44eb63151df0009`, as read in §2 |
| Recorded in | this file only; **no other file, repository, or worktree was written** |
| Resulting status | `DECIDED — PARKED — DOCS-ONLY — NO GATE OPENED — NOT INTEGRATED` |
| Instrument status | still `PROPOSED`, and now `PARKED`. `DECIDED` describes the **questions**, never the instrument |

### 14.2 The eight answers

| ID | Answer | What it binds | What it explicitly does **not** do |
|---|---|---|---|
| `T11-RB-1` | **A** | Identity is the **sub-lane `W0-T11/RB` under the existing `W0-T11`** | Mints no task 49; adds no roster row; edits no board file; does not lift `W0-T11`'s `HOLD` |
| `T11-RB-2` | **A** | **No gate is opened**; instrument registered `PROPOSED` | Allocates and reserves **no gate identifier**; opening a gate later is a separate decision |
| `T11-RB-3` | **yes** | **One contract packet at a time**; instrument **PARKED until W1-C1 and W1-C2 are canonically integrated into one tree** | Authorizes no lane, writer, or packet; integration itself is not authorized here |
| `T11-RB-4` | **yes**, sub-answer **4b** | `cybrik.res-*` prefix; **all** §4.2 disambiguation and no-rename boundaries; noun family **`res-bounds-*`** for contract/artifact stems with **`resource-bounds/`** directories and manifest; all prospective §9 names carry that form **before any file is ever created**; both `res-budget-*` and `res-envelope-*` generations **superseded** | **Naming only** — creates no schema, path, directory, manifest, or artifact; reserves no path; renames/deprecates/re-points **no existing token**; the §4.3.3 scan establishes freedom **at `eedadc5` only** and claims **no uniqueness in future code** |
| `T11-RB-5` | **yes** | **ADR-0012 is a conditional candidate only**; number assigned **last**, against the integrated registry | **Allocates and reserves no ADR number**; no ADR is written |
| `T11-RB-6` | **yes** | Quota/ceiling authority **derived only** — tenant from caller credential, org-scope advisory; **no `res-*` authority axis** | Introduces no field, no schema, and no permission mechanism |
| `T11-RB-7` | **yes** | Cancellation and no-remint are **dependency wording only** on W1-C2 and ADR-0003 | **No mutation and no re-acceptance** of W1-C2 or ADR-0003; 0 accepted bytes changed |
| `T11-RB-8` | **yes** | **`G-C` is not a gate identifier** for this work; binding checkpoint is the dated **`2026-12-20` Founder go/no-go for stable v1.0** | Changes no date; creates no gate; that milestone is referenced, not moved |

### 14.3 Naming supersession, in one place

The **adopted** noun family is **`res-bounds-*`** for contract and artifact stems and
**`resource-bounds/`** for directories and the manifest.

**Two generations are superseded and must not be used**, in this order:

1. `res-budget-grant`, `res-budget-error`, `contracts/examples/resource-budget/`,
   `docs/architecture/resource-budget/`, `cybrik-suite-resource-budget-packet.v1.manifest.json` —
   superseded by `T11-RB-4` sub-answer `4b` (the overloaded `budget` noun, §4.1).
2. `res-envelope-grant`, `res-envelope-error`, `contracts/examples/resource-envelope/`,
   `docs/architecture/resource-envelope/`, `cybrik-suite-resource-envelope-packet.v1.manifest.json` —
   superseded on independent review for **semantic overload**: `cybrik.envelope.v1.schema.json` is
   an `ACCEPTED FOR IMPLEMENTATION` cross-product carrier object registered with `"kind": "envelope"`,
   and bare `envelope` occurs on 171 lines at `eedadc5` (§4.3.2, §13).

Mapping in §4.3.1; adopted family in §9. **No file was ever created under any of the three
generations**, so nothing is renamed on disk.

**Collision scan performed (§4.3.3):** at `eedadc561700d3e1fa052322d44eb63151df0009`, whole tree —
`res-bounds` **0**, `resource-bounds` **0**, `res_bounds` **0**; bare `bounds` **15 lines /
16 occurrences**, every one in the ADR-0004 F7 / TI-4 *mandatory execution and resource bounds*
sense, naming no object anywhere. `bounds` is therefore **semantically aligned** with the
instrument rather than a distinct carrier object — the property `envelope` lacked.

**Outstanding and mandatory:** that scan is a **point-in-time read of one base and claims no
uniqueness in all future code**, in any other tree, or in the unintegrated W1-C1 / W1-C2 / W2-I
lanes, which were not searched. The `res-bounds` / `resource-bounds` / `bounds` collision recheck
**against the canonically integrated tree** remains required. No file bearing an adopted name may be
created before that recheck passes; a collision re-opens the noun decision.

### 14.4 Authority ceiling of this record

This record is a **decision recorder only**. It authorizes **no contract writer and no product
writer**, opens **no gate**, allocates **no ADR number**, mints **no identity**, changes **no other
document's status or date**, makes **no runtime, demo, stack, or CI claim** (**CI: NOT WIRED**),
and carries **no commit, push, merge, integration, deployment, or release authority**. The index is
left empty. The operative next state is **`PARKED`** under the ceiling in §12.1.
