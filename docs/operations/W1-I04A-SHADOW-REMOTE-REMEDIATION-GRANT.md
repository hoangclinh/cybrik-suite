# W1-I04A `shadow_remote` remediation — prospective bounded grant

- **Prepared:** 2026-07-27, fifteenth same-day control record
- **Amended (first):** 2026-07-27, same-day, applying independent **W0-R06E** Opus NO-GO
  corrections before any product writer opened against this grant. Amendment record:
  board §1.17/§14.25, register §20. This amendment corrects wording, cross-references and
  test-first satisfiability only — it fixes no product byte, flips no gate, and **the four-path
  attempt tree stays exactly as re-verified in §1.5, untouched by this amendment**
- **Corrected (second):** 2026-07-27, same-day, applying an independent **W0-R06F** Opus review's
  mandatory P2 corrections and folded P3 hardening to the first amendment above, before any
  product writer opened against this grant. This is a **follow-on correction, not a history
  rewrite** — the first amendment's own text stands unedited as dated history (board §1.17/§14.25,
  register §20); this correction record is board §1.18/§14.26, register §21. It fixes no product
  byte, flips no gate, and **the four-path attempt tree stays exactly as re-verified in §1.5,
  untouched by this correction** — the tree pin is carried forward from §1.5/§14.24.2, not
  independently re-measured a second time by either amendment (board §14.26.2)
- **Status:** `ACTIVE — PROSPECTIVE BOUNDED GRANT, TWICE-CORRECTED — LOCAL DOCS ONLY, NOT PUSHED —
  NO WRITER OPENED BY THIS RECORD OR EITHER CORRECTION`
- **Grant author:** logical task **W0-D04** (prospective-grant document implementer), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.24
- **Grantee:** fixed roster task **W0-I04**, sub-lane **W1-I04A** — the same immutable identity
  the original grant and the hard-stop evidence already name. **No task identity is created**;
  the roster stays at exactly 48 and **no task 49 exists**
- **Subject:** bounded remediation of the paused, NO-GO-reviewed W1-I04A `shadow_remote` client
  core attempt in worktree `w1-i04a-shadow-remote-r1` of `cybrik-soc-command-center`
- **Decision basis:** the **W0-IR13** decision — GO on a fresh prospective bounded remediation
  grant for W1-I04A — together with the **W0-R06D** mandatory prospective corrections recorded
  in §2 below. `W0-IR13` and `W0-R06D` label a decision and a correction; neither is a roster
  task identity
- **Authority boundary:** this document records a **prospective grant only**. The control session
  authoring it wrote no product byte, opened no product writer, created no worktree or branch,
  and staged nothing. Nothing is promoted by this grant existing

This grant satisfies the precondition that
`docs/operations/W1-I04A-SHADOW-REMOTE-HARD-STOP-EVIDENCE.md` §7 and board §1.15/§14.23 record for
any resumption of the paused W1-I04A attempt: a **fresh prospective bounded grant**, scoped to
**genuinely distinct security/conformance/test fixes**, carrying an **exact disposition of the P1,
both P2s and all four P3s**, and requiring its **own** independent pre-commit and post-commit
reviews. It authorizes exactly **one** future remediation writer attempt under the terms below. It
accepts nothing, flips no gate, and is **not product evidence**; the four-path tree stays
`PAUSED — UNCOMMITTED` until a writer completes under these terms and both reviews pass.

---

## 1. Distinctness and non-evasion — why this is a new grant, not a resumption

1. **Non-evasive delta scope.** The original W1-I04A authoring grant
   (`docs/operations/W1-I04A-SHADOW-REMOTE-GRANT.md`) completed its authoring phase — the writer
   produced the four allowlisted paths and stopped before staging under its own §9 item 7. The
   subsequent independent **W0-R03F** pre-commit review returned **NO-GO** (§2.2 below), which
   **consumed** that grant's authority (hard-stop evidence §2, §6). This document is **not** a
   re-issue of that authoring scope under a new name: it grants a **new, narrower delta scope** —
   exactly the security/conformance/test fixes disposed of in §4–§5 below, defined by the W0-R03F
   review findings — not a rewrite of the slice and not a second attempt at the original scope.
2. **Same immutable identity, no roster growth.** The grantee remains the existing task **W0-I04**,
   sub-lane **W1-I04A**. No task 49 is created; the roster count of 48 is unchanged by this record.
3. **No session resumption, ever.** The exhausted writer session
   `c173b76f-25b5-4bbc-8660-d5fe9a9792c8` and the exhausted reviewer session
   `e650bda1-abfd-4b0e-ac79-69138716e4c6` are **never resumed**, in any form. A brand-new writer
   session and brand-new reviewer sessions are required (§3, §7).
4. **No cycle-cap dodge.** This grant is not a split of the original scope contrived to obtain a
   third runtime cycle. It authorizes its own independent **initial 600 s cycle plus at most one
   healthy 600 s extension**, under board §15, exactly as every prior grant in this series has.
5. **Existing dirty attempt tree — re-verified 2026-07-27, read-only, by this grant's author**
   immediately before drafting this record, matching the hard-stop evidence exactly:

   | Field | Measured |
   |---|---|
   | Worktree | `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i04a-shadow-remote-r1` — pre-existing, not created by this record |
   | Branch | `codex/w1-i04a-shadow-remote-r1` — pre-existing |
   | `HEAD` | `6464cfbfc99ecf2109988dff0e6164c8cac6b10a` — exactly the original grant §3 base |
   | Commits above base | `git rev-list --count 6464cfb..HEAD` = **0** |
   | Staged paths | **zero** |
   | Upstream/cache | none pushed, no tag, `origin` untouched; no ignored/cache residue |
   | Dirty paths (`-uall`) | **exactly four**, all untracked (`??`) |

   | # | Path | Re-verified SHA-256 |
   |---|---|---|
   | 1 | `services/api/src/cybrik_soc/modules/copilot/shadow_remote.py` | `ca351c05190ab0b26ac7aedebd0bd35a44b2421303d669b233c4e8ccbe14c2b5` |
   | 2 | `services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py` | `8df05e5fe041ef670bfc81f7c3ee8d6bfe27b65ca0436784fb2ffa582dec9bfc` |
   | 3 | `services/api/tests/unit/copilot/test_shadow_remote.py` | `8645e7592c9822b276bbe1d3aa29645fb073588e5f6a44b1999296b1f06540d7` |
   | 4 | `services/api/tests/unit/copilot/test_shadow_remote_contract.py` | `54c8b92db3e470757ae651f7dfdd927cbce6bd5e2f24f91d931e797c4404a565` |

   These four hashes are **byte-identical** to the ones pinned in the hard-stop evidence §1.1 and
   board §14.23.2 — the attempt tree has not moved since that record. **Any mismatch measured by
   a future writer at session start against this table is a hard STOP** before any edit (§9).
6. **The `w1-i03b-route-db-permanence-r1` worktree is untouched** by this record and must be left
   exactly as found by any future writer under this grant, exactly as every prior W1-I04A record
   has required.

---

## 2. W0-R06D mandatory corrections — prospective only, prior records unedited

Both corrections below were independently re-verified **read-only** by this grant's author against
the original writer transcript and the W0-R03F reviewer transcript on 2026-07-27. Neither changes
a hash, a commit, a gate, a status or a classification. Neither edits
`docs/operations/W1-I04A-SHADOW-REMOTE-GRANT.md` or
`docs/operations/W1-I04A-SHADOW-REMOTE-HARD-STOP-EVIDENCE.md`, which **keep their existing wording
byte-unchanged as dated history**; this section **supersedes that wording prospectively**, exactly
as the W0-R06B `mypy` correction superseded the `e07e70f` wording without rewriting it.

### 2.1 Retired: "two RED runs"

The hard-stop evidence §3, board §1.15/§14.23.2 and register §18.1 all describe the RED evidence
as **"two `ModuleNotFoundError` failing runs (76 at `01:23:08`, 78 at `01:23:30`)"**. Re-read
directly from writer transcript
`c173b76f-25b5-4bbc-8660-d5fe9a9792c8.jsonl` on 2026-07-27, this is **inaccurate**:

- **Transcript line 75** (`01:23:08.560Z`) is **one** `Bash` tool call — a single `pytest`
  invocation over both `test_shadow_remote.py` and `test_shadow_remote_contract.py` together.
- **Transcript line 76** is that single invocation's **one** tool result: `pytest`'s own output
  for **one run**, containing **two** `ERROR collecting …` blocks — one `ModuleNotFoundError` for
  each test module failing to import its (not-yet-written) source module. This is **one pytest
  invocation producing two collection errors**, not two separate runs.
- **Transcript line 77** (`01:23:28.914Z`) is the writer's **reasoning-only** entry for that
  turn — an internal deliberation block, not rendered narration text — and is **not** a second
  tool call, **not** a second `pytest` invocation, and carries no independently observable RED
  evidence of its own.
- **Transcript line 78** (`01:23:30.449Z`) is the writer's **assistant text message** — the
  narration actually visible to a transcript reader ("RED observed and preserved above:
  `ModuleNotFoundError` for **both** modules-under-test…") — describing the single result already
  captured at line 76. **W0-R06E correction, exact:** neither line 77 nor line 78 is a second
  tool call, a second `pytest` invocation, or a second observed failure; the prior wording of this
  section, which described "lines 77–78" together as one undifferentiated "assistant text
  message," is imprecise about which line carries the narration and is corrected here — line 77
  is reasoning-only, line 78 is the narration. No RED-run evidence exists at either line beyond,
  respectively, reasoning about and narration of line 76. **W0-R06F correction:** the prior wording
  of this bullet mis-assigned line 78's timestamp (`01:23:30.449Z`) to line 77; the two transcript
  lines carry two distinct timestamps — line 77 at `01:23:28.914Z`, line 78 at `01:23:30.449Z` —
  and the line 77/reasoning-only vs line 78/rendered-narration distinction above is unchanged by
  this timestamp correction.

**Corrected standing.** The genuine test-first chronology is unchanged in substance — both test
modules were written first (lines 61, 66), the target-source environment probe ran next (72–73),
then this **one** RED pytest invocation with its two collection errors (75–76), and **only then**
the source modules (82, 102). The chronology remains genuine, transcript-citable and not
reconstructed; the grant §7 fabricated-chronology P0 still does not apply. What is corrected is
narrower: **future wording must say "one pytest invocation/result producing two
`ModuleNotFoundError` collection errors (transcript line 76)", never "two RED runs"** or cite line
78 as a second run. This is a **factual P2 wording correction**, exactly of the same kind and
scope as the W0-R06B `mypy` correction it follows.

### 2.2 Retired: "one P1 and one P2" as the W0-R03F headline

Re-read directly from reviewer transcript
`e650bda1-abfd-4b0e-ac79-69138716e4c6.jsonl`, line 121, the review's own verdict line reads:

> `## PRE-COMMIT VERDICT: **NO-GO** — one P1 and one P2. Nothing staged, nothing modified.`

That headline **undercounts its own body**, which immediately below it lists **two distinct,
separately headed P2 findings** — `**P2 — the required `Idempotency-Key` header is never
sent.**` and `**P2 — the secret-leak tests certify a branch that cannot fail.**` — each with its
own file:line citation and its own reasoning, plus **four** distinct P3 caveats. The hard-stop
evidence, board §1.15/§14.23 and register §18 already carried the **body's** count forward
correctly as **"one P1 and two P2 findings"** with **four P3s**; only the review's own headline
sentence undercounted. **This grant records that discrepancy explicitly** so no future record
re-derives "one P2" from the headline sentence in isolation.

**Authoritative disposition, restated exactly:** **one P1** (§4), **two P2s** (§5), **four W0-R03F
P3s** (§7.1–§7.4) — the anchor is §7, not §6, which is the P2 test-addition section. This matches
every prior control record's body text as to the W0-R03F disposition; nothing here changes a
finding, a severity or a disposition — it only names and closes the headline/body wording gap at
its source. **This grant separately grants one further, grant-originated finding (§7.5)** that is
**not** part of the W0-R03F disposition restated above and must never be folded into "four P3s" —
see §7's heading and §7.5 for its exact provenance.

---

## 3. Writer binding — repo, base, session, runtime

1. **Repo/worktree/base.** `cybrik-soc-command-center`, the **pre-existing** worktree
   `w1-i04a-shadow-remote-r1`, branch `codex/w1-i04a-shadow-remote-r1`, exact base
   `6464cfbfc99ecf2109988dff0e6164c8cac6b10a`. If the observed `HEAD`, branch tip, dirty-path set,
   staged count or any of the four §1.5 hashes differs at writer session start, the writer **must
   STOP before any edit** — no exceptions, no "close enough".
2. **Model and session.** **Opus 5**, in a **brand-new Claude session**. Resuming
   `c173b76f-25b5-4bbc-8660-d5fe9a9792c8` or `e650bda1-abfd-4b0e-ac79-69138716e4c6` is **forbidden
   in every form**. A retry keeps the immutable task identity **W0-I04** (sub-lane W1-I04A) — no
   identity reuse or minting to evade the board §15 timeout.
3. **Runtime bound (board §15).** One initial **600 s** cycle plus **at most one** healthy
   **600 s** extension, granted only on evidenced process progress. **No third cycle.** Quota
   exhaustion, permission loops, deadlock and scope drift are never grounds. At the bound, the
   writer hard-stops and reports partial evidence; the lane returns to
   `PAUSED — UNCOMMITTED` and requires yet another fresh grant for any further action.

---

## 4. Mandatory fix — P1: remote-controlled key names never reach reason, audit or log

**Finding (W0-R03F, confirmed above):** `_reject_unknown` in `shadow_remote_contract.py:374-379`
builds its rejection reason as `f"unexpected properties: {', '.join(unknown)}"`, where `unknown`
is `sorted(set(payload) - allowed)` — remote-controlled JSON key names. That reason string is
consumed in `shadow_remote.py:416-418` (`f"shadow response violates the accepted shape at
{exc.field_path}: {exc.reason}"`), becomes the `ShadowFailureRecord.message_safe` field, and is
emitted verbatim by `_LOGGER.warning(...)` inside `_quarantined` (`shadow_remote.py:248-274`).
This is reproducible with a credential-shaped key name and with an unbounded/newline-bearing
injection (10,962 characters observed, embedded newlines forging additional log lines).

**Required fix, two independent layers:**

1. **Primary containment — `_reject_unknown` becomes bounded, count-only.** The rejection reason
   built by `_reject_unknown` (`shadow_remote_contract.py:374-379`) **must not include any key
   name from `payload`**. It must be rebuilt as a **bounded constant/count-only** message —
   naming the offending **count** of unexpected properties (e.g. `f"unexpected properties
   present: count={len(unknown)}"`) and, if a location is useful, only the already-safe `path`
   argument (which is module-local schema-path text, never remote-derived). **No remote key name,
   in whole or in part, may appear in the raised `reason` string.**
2. **Defense-in-depth — bound `message_safe` at the point it is constructed.** Independently of
   fix 1, every `message_safe` value assembled inside `shadow_remote.py` (the `_quarantined`
   call sites in `_run`, `shadow_remote.py:285-439`) must be capped at **no more than 200
   characters** and must have **all of the following removed or rejected** before it is stored in
   `ShadowFailureRecord.message_safe` or passed to `_LOGGER.warning`: CR (`\r`), LF (`\n`) and
   every other **C0 control character** (`U+0000`–`U+001F`); **DEL** (`U+007F`); and the
   **Unicode line and paragraph separators** `U+2028` (LINE SEPARATOR) and `U+2029` (PARAGRAPH
   SEPARATOR). **W0-R06F security rider, exact:** the prior wording named only "CR, LF and other
   C0 control characters," which does not, on its face, cover `U+007F` (DEL, formally neither C0
   nor printable) or `U+2028`/`U+2029` (Unicode separators outside the C0 range entirely, capable
   of forging additional log lines in renderers that treat them as line breaks even though a naive
   C0-only filter would pass them through). This is a second, independent bound — it must hold
   even if a future caller of `_reject_unknown` or any other validator regresses fix 1, and it is
   what closes the newline-injection/log-forging half of the P1 specifically. **Test-first status:**
   the pinned pre-fix bytes filter, at most, CR/LF; a new assertion that DEL/`U+2028`/`U+2029`
   are stripped from `message_safe` is **genuine RED** against those bytes — it is not eligible for
   the §9 `PRE-EXISTING GREEN` carve-out and must show honest RED before the source edit.

Both layers are required; neither alone satisfies the finding. The module's own stated invariant
at `shadow_remote.py:18-20` ("failure text is built only from category, operation name and field
path — never from the header, request body or response body") must hold in fact, not just in the
docstring.

---

## 5. Mandatory fixes — two P2s

### 5.1 P2 — `Idempotency-Key` header on create/cancel

**Finding:** the accepted OpenAPI at `ed95e51…` declares `Idempotency-Key` `required: true` on
both `createInvestigation` and `cancelInvestigation`, with its value required to equal the request
body's `idempotency_key`. `create_investigation` (`shadow_remote.py:172-186`) and
`cancel_investigation` (`shadow_remote.py:214-231`) never extract or send it; `_run`'s single
outbound call (`shadow_remote.py:338-344`) sends only the correlation header.

**Required fix, exact:**

1. For **`create_investigation`** and **`cancel_investigation`** only, extract `idempotency_key`
   from `request_body` before the transport call.
2. **Validate** it: must be a `str` with length **16–200 inclusive** (matching the same bounding
   discipline as the rest of the contract surface), and must contain **no control characters** —
   at minimum, no C0 control character (`U+0000`–`U+001F`), no DEL (`U+007F`), and no Unicode line
   or paragraph separator (`U+2028`, `U+2029`). Missing, wrong-typed, too-short, too-long, or
   containing any forbidden control character all count as **invalid**. **W0-R06F security rider:**
   the prior wording of this item validated only type and length; a header value built from an
   unvalidated `idempotency_key` could otherwise carry a CR/LF or Unicode separator into the
   outbound `Idempotency-Key` header text, mirroring the same class of injection risk the P1 (§4)
   closes for `message_safe` — this control-character check is added for the same reason and is
   part of this item's required validation, not a separate finding. This is a brand-new
   extraction/validation path with no pre-fix behavior to compare against, so every assertion of
   it, including the control-character rejection, is ordinary new-feature RED — no
   `PRE-EXISTING GREEN` carve-out applies.
3. **Invalid ⇒** the operation resolves to `ShadowFailureCategory.SCHEMA_INVALID`, quarantined,
   with **`attempts=0`** and **zero transport calls** — the same "never even attempt the
   transport" discipline `_run` already applies to a contract-pin mismatch
   (`shadow_remote.py:309-321`) and to a path-render failure (`shadow_remote.py:323-334`). No
   partial or best-effort request may be sent for an invalid key.
4. **Valid ⇒** the outbound request must carry a new header, exact name **`Idempotency-Key`**,
   set to the exact validated value, **in addition to** the existing
   `SHADOW_CORRELATION_HEADER`.
5. **GET operations omit it entirely.** `get_investigation_status`,
   `list_investigation_checkpoints` and `read_investigation_bundle` carry no request body and
   must **never** send an `Idempotency-Key` header, before or after this fix.

### 5.2 P2 — the secret-leak tests never reach the leaking branch

**Finding:** `test_no_token_or_secret_reaches_logs_or_quarantine_records`
(`test_shadow_remote.py:720-745`) serves the token body under HTTP `500`, so the client
quarantines on status (`shadow_remote.py:365-373`) before `response.json()` is ever reached —
the JSON/key-parsing path the P1 lives in is never exercised. The existing schema-invalid test
(`test_shadow_remote.py:534-556`) does reach the validator, but only ever places a token-shaped
value in **value** position, which was already safe by construction; no existing test places an
attacker-controlled string in **key** position.

**Required fix:** this is disposed of by the §6 items 1–2 test additions below — a dedicated
key-position test is mandatory and is not satisfied by any existing test. **W0-R06F correction:**
the prior wording of this line cited a nonexistent `§5.3`; this grant has no `§5.3` — §5 contains
only §5.1 and §5.2. Corrected to cite §6 items 1–2 by their actual anchor.

---

## 6. Mandatory P2 test additions — exact required assertions

All of the following are **new** test functions inside the two existing test files
(`test_shadow_remote.py`, `test_shadow_remote_contract.py`) — no new file, no fifth path (§8).
**W0-R06F correction — bounded helper/stub edits permitted:** "new test functions" names the
required *additions*; it does not forbid the **bounded** edits, inside those same two already-
allowlisted files, needed to make the new functions possible — most notably extending the existing
`RecordingShadowApp` test-stub class (`test_shadow_remote.py:82`) to capture/serve whatever the
new assertions above need (e.g. the `Idempotency-Key`/`idempotency-key` header capture for items
3–4, or the spoofed/absent `Content-Length` alongside an actual oversized body for §7.2's test).
Any such helper edit stays **inside the two existing test files only**, must not touch either
source module beyond what §4/§5/§7 already require, and remains subject to every other §8/§11
bound — it is not license to add a fifth path, a new file, or a change unrelated to enabling these
required assertions.

1. **HTTP 200 credential-shaped key leak.** Serve a well-formed `200` response body (reaching the
   validator, unlike the existing `500` test) whose JSON object contains one **unknown key**
   whose **name itself** is credential-shaped (e.g. `"Bearer poc-echoed-credential-abc123"` as a
   *key*, not a value). Assert the credential-shaped string is absent from `message_safe`, the
   quarantine record's `repr`, and the captured log text — closing exactly the gap named in §5.2.
2. **Many-key / newline-bearing injection, bounded.** Serve a `200` body with a large number of
   unknown keys (at least one containing an embedded newline, at least one containing DEL
   (`U+007F`), and at least one containing a Unicode line/paragraph separator (`U+2028`/`U+2029`)).
   Assert: `message_safe` is **no longer than 200 characters**; `message_safe` contains **no
   `\r` or `\n`**, no other C0 control character, no DEL (`U+007F`), and no `U+2028`/`U+2029`; no
   offending key text or secret-shaped substring survives in `message_safe`, the quarantine record
   or the captured log. **W0-R06F security rider (§4 item 2):** the DEL and Unicode-separator
   assertions are **genuine RED** against the pinned pre-fix bytes, which strip at most CR/LF —
   not eligible for the §9 `PRE-EXISTING GREEN` carve-out.
3. **`Idempotency-Key` present and equal on create/cancel.** For both `create_investigation` and
   `cancel_investigation` with a valid 16–200-character `idempotency_key` in the request body,
   assert the stub observes an `Idempotency-Key` header **equal to** the body value, alongside
   the existing correlation header. **Clarifier:** the ASGI/`httpx` transport stub normalizes
   header names to lowercase in its captured headers mapping; assertions must access the captured
   header via its **lowercase** key `idempotency-key`, not the mixed-case `Idempotency-Key`
   spelling used only for the value actually **sent** on the wire.
4. **`Idempotency-Key` absent on GET operations.** For `get_investigation_status`,
   `list_investigation_checkpoints` and `read_investigation_bundle`, assert the stub never
   observes an `Idempotency-Key` header (checked via the same lowercase `idempotency-key` key as
   item 3). **This assertion is `PRE-EXISTING GREEN — REGRESSION GUARD, NO RED EXPECTED`** (§9):
   no operation, GET or otherwise, currently sends this header at all, so the absence-on-GET
   check already passes against the pinned pre-fix bytes; it must be run and observed passing
   before the source edit, then re-run after the fix as a regression guard, not contrived into a
   RED it cannot produce.
5. **Invalid `idempotency_key` ⇒ zero transport calls.** For create/cancel with a missing,
   wrong-typed, too-short (< 16), too-long (> 200), or **control-character-bearing** (at least one
   case each for a C0 control character, DEL `U+007F`, and `U+2028`/`U+2029`, per §5.1 item 2)
   `idempotency_key`, assert: the outcome category is `SCHEMA_INVALID`; `attempts == 0`; the
   stub's call counter is **unchanged** (zero calls for that invocation) — mirroring the existing
   contract-pin-mismatch zero-call assertion pattern already in the suite.

---

## 7. P3 dispositions — the four W0-R03F P3s, plus one grant-originated finding

Items **§7.1–§7.4** below are the **four P3s the W0-R03F review itself found** (hard-stop
evidence §5.4, board §1.15/§14.23.3, register §18.1) — the same four the preamble and the §2.2
authoritative-disposition line account for. Item **§7.5** is a **fifth finding, originated by this
grant's own author**, not by W0-R03F — see §7.5 for its exact, explicit provenance. The two counts
are never to be merged: "four P3s" always means §7.1–§7.4 only.

### 7.1 P3 — `org_path` `maxLength` 512 — FIX

`_parse_org_scope` (`shadow_remote_contract.py:464-474`) currently calls `_require_str(org_path,
..., min_length=0)` with no `max_length`, so the declared 512-character bound is unenforced. Add
`max_length=512` to that call. **Tests:** one boundary case at exactly 512 characters (accept) and
one at 513 (reject with `ContractValidationError`). **The 512-character accept case is
`PRE-EXISTING GREEN — REGRESSION GUARD, NO RED EXPECTED`** (§9): the unenforced pre-fix code
already accepts a 512-character `org_path`, so this assertion cannot RED and must not be
contrived into one; only the 513-character reject case is a genuine new RED requirement.

### 7.2 P3 — Response-body size cap — FIX, `MAX_RESPONSE_BODY_BYTES = 1_048_576`

In `_run` (`shadow_remote.py:285-439`), after the status-code checks (`shadow_remote.py:364-394`)
and **before** `response.json()` is called (`shadow_remote.py:396-406`), measure the response body
size as **`len(response.content)`** — the actual number of bytes received in the buffered
`httpx.Response` body, not any remote-supplied header — and reject anything **larger than
`1_048_576` bytes** as `ShadowFailureCategory.MALFORMED_BODY`, quarantined, without attempting
JSON decode. **The remote `Content-Length` response header MUST NOT be used as the measured
value, in whole or in part, and MUST NOT be used as a short-circuit** (e.g. trusting a small or
absent `Content-Length` to skip measuring the actual body) — a remote peer controls that header
and can misstate it independently of the bytes it actually sends, so only the actually-received
`len(response.content)` is an honest measurement. **Tests, mandatory:** the ordinary
over-limit/under-limit boundary cases, **plus** at least one case where the stub response
declares a small or entirely absent `Content-Length` header while its actual body exceeds
`1_048_576` bytes — asserting the cap still triggers on the real received size, not on the
(spoofed) header. **Disclosed residual, mandatory on every citation of this fix:** by the time
this check runs, `httpx` (used without streaming) has **already buffered the complete response
body in process memory** to produce `response.content`/`response.json()`; this cap bounds what is
**parsed and retained downstream** of that point, and is **not** a bound on the **peak memory
allocation** `httpx` itself performs while reading the response. **True streaming enforcement is
explicitly deferred** to a future gateway-wiring lane, which is the layer that would own the
transport's read-size configuration — this pure-domain-slice client does not own or configure the
injected `httpx.AsyncClient`'s transport (original grant §5, out-of-scope bullet **"No runtime
wiring"** — nothing is registered into the gateway, router, app factory, lifespan or any existing
call path, so the client cannot own that call path's transport configuration either).
**W0-R06F correction:** the prior wording cited this as "out-of-scope item 2," an ordinal against
an unordered bulleted list in the original grant §5 — ambiguous and non-reproducible; corrected
here to a stable semantic anchor naming the bullet's own text instead of counting it. This body-
measurement discipline and its mandatory disclosure are mirrored in acceptance §10.3's commit-body
requirement.

### 7.3 P3 — Strict RFC3339 timestamps — FIX

`_require_timestamp_utc` (`shadow_remote_contract.py:423-431`) currently accepts anything
`datetime.fromisoformat` parses provided it ends in `Z`, which admits non-RFC3339 basic-format
strings (e.g. no `-`/`:` separators). Add a strict pattern check —
`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$` — applied **before** the existing
`datetime.fromisoformat` calendar-validity check, which is **retained** (still catches impossible
calendar dates such as month 13 or February 30 that the regex alone would not). **Tests:** one
case that is calendar-valid but basic-format (rejected by the new regex) and one case with a
fractional-second component (`.123456789Z`) that is **expected** to be accepted by both the new
regex and the retained calendar check. **W0-R06F correction — interpreter-conditional, not an
assumed fact:** whether the fractional-second case is actually `PRE-EXISTING GREEN` against the
pinned pre-fix bytes depends on `datetime.fromisoformat`'s fractional-second/`Z`-suffix handling
in the **actual interpreter the writer runs against** (§10.1 already discloses this venv's
interpreter as **CPython 3.12.13** against a declared `python_version = "3.11"`, and
`fromisoformat`'s ISO-8601 support has changed across CPython versions). The writer **must
actually run** this specific case against the pinned pre-fix bytes and **honestly label the
measured result** — `PRE-EXISTING GREEN — REGRESSION GUARD, NO RED EXPECTED` only if it is
observed to pass, or ordinary genuine RED if it is observed to fail. **No `PRE-EXISTING GREEN`
label may be asserted without having actually run the case against the pinned bytes in this
venv**; the prior wording stated the green result as if interpreter-independent, which this
corrects. The **strict new regex plus the retained calendar-validity check remain required
exactly as specified above, regardless of which label this case receives** — this correction
affects only the RED-vs-green bookkeeping of that one assertion, not the fix itself. The
basic-format reject case is unaffected by this correction and remains a genuine new RED
requirement in every interpreter.

### 7.4 P3 — `traceparent` — DEFER, not fixed

The contract declares `traceparent` as an **optional** header; this client's boundary
(`ROUTE_BY_OPERATION`/`_run`) creates it **absent**, and the client is otherwise **unwired** — it
has no real W3C trace context to propagate, because no gateway or caller in this pure-domain-slice
constructs one. This grant **explicitly forbids** synthesizing a fake `traceparent` from
`correlation_id` or any other module-local value, which would be a dishonest trace and worse than
omission. **Revisit only at a future gateway-wiring lane** that has a real trace context to hand
the client. No test is required for a deliberately absent, undeployed feature; the existing
custom `SHADOW_CORRELATION_HEADER` stays as the module-local substitute it already is.

### 7.5 Additional finding originated by this grant — not a W0-R03F P3

**Cause-chain leak — FIX.** `_require_enum` (`shadow_remote_contract.py:434-439`) and
`_require_timestamp_utc` (`shadow_remote_contract.py:423-431`) both re-raise with `from exc`. The
underlying `ValueError`s they chain **do** embed the offending remote value in their own message
text — `StrEnum(text)`'s `ValueError` reads `'{text}' is not a valid {ClassName}`, and
`datetime.fromisoformat`'s reads `Invalid isoformat string: '{text}'` — so while
`ContractValidationError.reason` itself stays safe, the **chained `__cause__`** carries the
remote value into any full traceback render (`traceback.format_exception`, `logging.exception`,
an unguarded `repr` of the exception chain). Change both `from exc` to **`from None`** to
suppress the chain. **Test:** construct an offending remote value (e.g. an invalid `run_status`
enum member or a malformed timestamp), catch the resulting `ContractValidationError`, render its
**full** exception chain (e.g. `"".join(traceback.format_exception(type(exc), exc,
exc.__traceback__))` or an assertion that `exc.__cause__ is None` combined with a rendered-chain
string check), and assert the offending remote value is **absent** from that full rendered chain
— not just from `str(exc)` or `exc.reason`.

**Provenance, exact — attribution/count correction.** This finding was **not** raised by the
W0-R03F review, the hard-stop evidence, or any prior record naming "four P3s"; it was identified
by this grant's own author from a **read-only re-read of the current `shadow_remote_contract.py`
source** while drafting this document, independent of the W0-R03F transcript. It is a genuine,
valid, in-scope fix under the same four-path allowlist (§8) and is granted on that basis — but it
must **never** be cited as a W0-R03F finding, folded into "the four P3s," or used to imply the
independent review found five. Any future record disposing of "the W0-R03F P3s" must cite exactly
§7.1–§7.4; any record disposing of "every P3-tier finding in this grant" must cite §7.1–§7.5 and
name §7.5's distinct, grant-originated provenance.

**Reviewed, no change (explicitly bounded scope):**

- The **empty-correlation-id guard** in `_run` (`shadow_remote.py:293-294`, raising `ValueError`
  for a blank `correlation_id`) is reviewed and left as-is; it is not part of any P1–P3 finding.
- The presence of dedicated 4xx-vs-5xx branches in `_run` (`shadow_remote.py:364-382`) with no
  separately named "4xx validator" utility is reviewed and left as-is; it is an observation, not
  a defect.
- **`http_client` stays caller-owned and injected**, exactly as the original grant §5 requires —
  this remediation does not construct, configure or own any `httpx.AsyncClient`.
- **Full request-body schema validation stays explicitly out of scope.** The only body-derived
  field this remediation touches is the `idempotency_key` extraction of §5.1/§6. No other field
  of `request_body` is validated, coerced or restructured by this grant.

---

## 8. Exact product edit allowlist — the same four already-dirty paths only

The edit allowlist is **exactly** the four paths already re-verified in §1.5 — no new path may be
created, none deleted, renamed or moved; no dependency added, upgraded, removed or installed; no
`__init__.py`, no `conftest.py`, no fifth path of any kind. The `-uall` dirty set must remain
**exactly these four paths, zero staged**, from writer session start until the authorized staging
step in §10.

Explicitly forbidden, without exception, exactly as the original grant §4 states: `pyproject.toml`,
`uv.lock`, any lockfile, any `__init__.py`, `config.py` or any settings module, `api.py`,
`gateway.py`, `llm.py`, `models.py`, `tools.py`, `shadow_suggest_worker.py`, `main.py`, any
route/router/gateway module, any Alembic migration, any `.github/` file, any `docs/` file, any
`README.md`, and every other tracked or untracked path in the repository. **No runtime wiring, no
real endpoint, no SOC database access, no vendored contract bytes, no new dependency, no
retry/backoff engine** — the original grant §5 out-of-scope list applies unchanged.

---

## 9. Test-first RED discipline, transcript-preserved

The remediation writer runs **test-first** for every new assertion in §6 and §7: extend the two
test modules with the new/modified test functions **first**, **run them and capture the observed
failure against the pinned (pre-fix) source bytes**, with the failing output preserved verbatim
in-transcript, **before** touching either source module. A **fabricated or after-the-fact
reconstructed** RED chronology is a **P0**, exactly as the original grant §7 and §9 item 12 state,
and exactly the standard this record's own §2.1 correction holds itself to.

**Satisfiable-RED carve-out, exact.** Genuine RED is required **only for assertions that actually
fail against the pinned pre-fix source bytes.** Where a new assertion already **passes** against
those pinned bytes — because the current, unfixed code already happens to exhibit the desired
behavior — no RED is possible for that specific assertion, and none may be manufactured. Such an
assertion must instead be run and its result preserved in-transcript labeled exactly
**`PRE-EXISTING GREEN — REGRESSION GUARD, NO RED EXPECTED`**, before any source edit, and re-run
after the fix to confirm it still passes as a regression guard. **At minimum, this applies
unconditionally to:** §6 item 4 (GET operations already omit `Idempotency-Key`, since no
operation currently sends the header at all) and §7.1's 512-character `org_path` accept case
(already accepted, since no `max_length` is currently enforced) — both pass identically regardless
of interpreter. **§7.3's fractional-second RFC3339 accept case is conditional, not automatic**
(§7.3 W0-R06F correction): it is `PRE-EXISTING GREEN` **only if actually observed to pass** when
run against the pinned pre-fix bytes in the writer's own venv; if the writer's measured run shows
it failing instead, it is genuine RED and must be captured and labeled as such, never forced into
`PRE-EXISTING GREEN` to match this document's expectation. Every **other** new assertion in §6/§7
— including the 513-character `org_path` reject, the basic-format timestamp reject, the P3-4
DEL/`U+2028`/`U+2029` sanitization assertions (§4 item 2, §6 item 2), the idempotency-key
control-character-rejection assertions (§5.1 item 2, §6 item 5), and every other P1/P2 assertion —
has no pre-existing-green carve-out and **must** show a genuine, honest RED against the pinned
pre-fix bytes before any source edit. **Contriving a failure where none exists, relabeling an
already-green result as RED, forcing a `PRE-EXISTING GREEN` label without having actually run the
case, or silently omitting a required `PRE-EXISTING GREEN` guard result is itself a §11 item 11
P0**, exactly as a fabricated RED
chronology is — the carve-out authorizes honest labeling of an unavoidable green, never a shortcut
around evidencing a genuine RED where one is achievable.

Test harness constraints from the original grant §7.1 continue unchanged: in-process ASGI stub
only (no socket, no port, no DNS, no egress), synthetic data only, no database, no container, no
image pull, no external service.

---

## 10. Acceptance, validation and commit protocol

### 10.1 Permitted commands and evidence discipline

- **RED:** the new tests of §6/§7 fail against the pinned pre-fix source bytes, captured
  in-transcript (§9).
- **GREEN:** the full set of the prior **81** targeted tests **plus every new test** added under
  §6/§7 passes.
- **Bounded regression:** the same copilot regression set the original grant §8.1 names **by
  five files** (`test_copilot_disposition.py`, `test_hunt_copilot_suggest.py`,
  `test_soar_copilot_draft.py`, `test_soar_copilot_tool.py`, `test_forensics_copilot_summary.py`)
  still passes. **Citation correction:** the original grant §8.1 names only the five files, not a
  test count; the **39**-test count is reported in hard-stop evidence §4 (`Bounded copilot
  regression | 39 passed`), and it is that count, not the original grant, that this record cites
  for the number.
- **Lint:** `ruff check` and `ruff format --check` — **check modes only**; `ruff format` (write
  mode) and `--fix` remain forbidden.
- **Syntax:** `ast.parse` / byte-compile of the four paths, with no repo cache written.
- **Types:** targeted `.venv/bin/mypy` on `mypy 2.3.0 (compiled: yes)`, invoked at the four paths
  specifically — never widened into a whole-package run.
- **Cache honesty:** any `__pycache__`, `.pytest_cache` or `.mypy_cache` residue is probed with a
  command verified to work on macOS/BSD (the original grant §8.4/§14.21.3-item-6 precedent) and
  reported honestly, not silently claimed absent.
- **Venv discipline, unchanged from the original grant §8.3:** the pre-existing, borrowed
  `cybrik-soc-command-center:services/api/.venv` is used **read-only** — no install, upgrade,
  download, `pip`, `uv sync`, lockfile touch or venv creation. `PYTHONPATH` is forced to the
  attempt worktree's `services/api/src` and **probe-verified** (resolved `cybrik_soc.__file__`
  printed) before any run is cited. Every executed figure carries the **mandatory
  dependency-version caveat**: the venv's interpreter is **CPython 3.12.13** and its third-party
  versions do not come from this base's pins, against a declared `python_version = "3.11"` in
  `[tool.mypy]`. This taints the evidentiary weight of local runs only, never hash-pinned bytes.

### 10.2 Review, staging and commit — Opus reviewers, Fable reserved for escalation only

This differs from the original grant's Fable-only reviewer discipline, by explicit tasking:

1. **Writer stops before staging**, with **zero paths staged** and a dirty tree of exactly the
   four §8 paths, and reports its evidence.
2. A **fresh, independent Opus 5** session performs the **pre-commit** review. **W0-R06F
   correction — exact, exhaustive exclusion list, by role:** it must be a **distinct session**
   from: (a) the future remediation writer itself; (b) the exhausted original writer session
   `c173b76f…`; (c) the exhausted W0-R03F pre-commit reviewer session `e650bda1…`; (d) any session
   that authored the **W0-IR13** decision; (e) any session that authored this grant document, in
   any of its states — the original prospective grant (register §19), the **W0-R06E**
   amendment-review/authoring session (board §1.17/§14.25, register §20), and the **W0-R06F**
   correction-review/authoring session (board §1.18/§14.26, register §21); and (f) distinct from
   every other reviewer named in this list and in step 4 below. No grant-authoring or
   grant-review session of any kind — past or present — may double as the future product
   pre-commit or post-commit reviewer. It must return **GO with no P0–P2**.
3. **Only then**, the **same remediation writer session** resumes **within its remaining §3.3
   runtime** and: stages **exactly the four paths** (`git add` of those four paths only, never
   `git add -A`); makes **exactly one** local, status-honest **`SCAFFOLD`** commit. **Runtime-
   accounting clarifier:** the pause while the independent pre-commit reviewer works does **not**
   itself consume any of the writer's §3.3 runtime allowance — the writer's clock is not running
   during a review it is not performing. When the writer resumes to stage and commit, it may act
   only **within whatever runtime it had genuinely left** at the point it stopped before staging;
   the reviewer's pause neither extends nor grants a fresh allowance, and does not authorize
   treating the resumed step as a new cycle. **W0-R06F correction — staging dead-end, exact:** this
   scheme has a failure mode the prior wording left unaddressed — if the writer's genuinely
   remaining runtime at the point it stopped before staging is **zero, or too little to plausibly
   complete staging and one commit**, resuming under this clause is a **dead end**, not a viable
   path. In that case the writer **must not** resume, must not stage, must not commit, and must
   not attempt any workaround to obtain more runtime — no replacement session, no identity
   substitution, no reclassification of the remaining step as a "new" cycle, and no treating the
   pre-commit review's `GO` as authority to extend runtime it does not itself grant. The writer
   **STOPs uncommitted**, reports the exhausted allowance and the pre-commit `GO` already obtained
   as partial evidence, and the lane returns to `PAUSED — UNCOMMITTED`; staging and commit under
   this already-reviewed state require a **new, explicit grant of runtime** (a fresh bounded
   authorization, board §15-style, naming this exact state) before any further action — never a
   silent substitute for one.
4. A **fresh, distinct Opus 5** session — distinct from the pre-commit reviewer of step 2 and
   from every session named in step 2 — performs the **post-commit** review and must return
   **PASS with no P0–P2** before anything counts as product evidence.
5. **Fable is reserved only for unresolved disagreement or escalation** — i.e. only if the
   pre-commit and post-commit Opus reviews (or a reviewer and this grant's own findings) conflict
   in a way that cannot be resolved by re-reading the code, a **fresh Fable session** may be used
   as a tie-breaking escalation review. Fable is **not** the default pre-commit or post-commit
   reviewer for this grant, unlike every prior W1-I04A/W1-I06C/W1-I07 record in this series.

### 10.3 Commit body — mandatory disclosures, mandatory omissions

The one authorized commit's body must disclose, at minimum: which of the P1, two P2s, four
W0-R03F P3s (§7.1–§7.4) and the one grant-originated finding (§7.5) were **fixed** under this
grant and which were **explicitly deferred** and why — naming both deferrals by anchor:
**§7.4** (`traceparent`, deferred entirely, not fixed) and **§7.2's true-streaming enforcement**
(the byte cap itself is fixed; only the deeper streaming-at-the-transport-layer enforcement is
deferred to a future gateway-wiring lane, per §7.2's disclosed residual). **W0-R06F correction:**
the prior wording of this line — "per §7.4 only … no other item is deferred" — omitted the §7.2
true-streaming deferral and is corrected here; no other W0-R03F/grant finding beyond these two
named deferrals (§7.4 and §7.2's true-streaming residual) is deferred. The RED chronology's
evidentiary basis (§9), including which assertions were
honest RED and which were labeled `PRE-EXISTING GREEN — REGRESSION GUARD, NO RED EXPECTED` under
the §9 satisfiable-RED carve-out; the borrowed-venv dependency-version caveat (§10.1); the §7.2
residual-buffering disclosure (`httpx` already buffers the full body before the new size cap
runs) **together with the §7.2 measurement method** — that the cap measures `len(response.content)`
and never the remote `Content-Length` header, alone or as a short-circuit; the §7's "Reviewed, no
change" disclosure that **full request-body schema validation stays out of scope**, with the only
body-derived field touched by this grant being the `idempotency_key` extraction of §5.1/§6; and
cache-residue honesty (§10.1). It must **not** claim runtime, CI, live-shadow or blocker-closure
evidence of any kind.

**W0-R06F correction — future writer transcript, a mandatory post-run field, not a pre-cited
path.** No writer session exists yet under this grant, so no session UUID or transcript file path
for it can be named by this document — any future reference to "the remediation writer's
transcript" is, as of this grant, a **placeholder for a mandatory post-run evidence field**, to be
populated with the actual session UUID/transcript filename **only once that session exists and
produces one**. The commit body, the pre-commit review, the post-commit review and any control
record citing this grant's execution must each **pin the writer's own session transcript by its
real, resulting UUID/filename at the time they are written** — never a fixed, pre-guessed, or
templated path asserted before that session exists. This is distinct from, and does not alter,
§14's citation of the **past** writer/reviewer transcripts (`c173b76f…`, `e650bda1…`), which
already exist and are correctly pinned by their real UUIDs.

---

## 11. STOP conditions — hard, no exceptions

The writer (and the resumed commit step) stops immediately, commits nothing, and reports, on any
of:

1. Any mismatch between the observed `HEAD`, branch tip, dirty-path set, staged count or any of
   the four §1.5 hashes at session start.
2. Any edit to a **fifth** path, an `__init__.py`, a `conftest.py`, or any **existing** file
   outside the four in §8, for any reason.
3. Any **dependency install**, upgrade, download, image pull, container start, database start,
   real network egress, real data, secret or `.env` access.
4. A **contract pin mismatch**, or any need to vendor or copy contract bytes.
5. Any need to touch the gateway, routes, router, app factory, lifespan, `__init__`, config or
   settings to make a fix work.
6. Any fix that widens beyond §4–§7 — a behavior, route, status-code, schema or contract-pin
   change not named in those sections.
7. Any **new** P0, P1 or P2 finding, in this lane's code or discovered in the base.
8. **Timeout** — the initial cycle plus at most one 600 s extension elapsed.
9. Any staging attempt before the pre-commit review returns **GO with no P0–P2**.
10. Any **remote action** whatsoever — push, fetch, merge, rebase, tag, remote add/set-url. The
    pre-existing `origin` remote is not to be touched.
11. A fabricated or reconstructed RED chronology (§9) — itself a **P0**. This includes contriving
    a failure where the satisfiable-RED carve-out (§9) applies, relabeling an already-green result
    as RED, or omitting a required `PRE-EXISTING GREEN — REGRESSION GUARD, NO RED EXPECTED` label.
12. Any prompt or temptation to resume `c173b76f…` or `e650bda1…`, reuse another task identity,
    or mint a new one.

---

## 12. Classification ceiling — binding, even on success

**Even after a post-commit review `PASS`**, the resulting commit counts **only** as:

> **local, independently reviewed, unmerged and unpushed `SCAFFOLD` evidence toward the
> `shadow_remote` portion of live-shadow blocker 3** — the same ceiling the original grant §11
> stated, now applying to the remediated commit.

It is explicitly **not** runtime, integration, CI, live-shadow, deployment or release evidence,
and nothing is `IMPLEMENTED`, `VERIFIED`, `PILOTED` or `GA`. **No blocker closes.** Real org
mapping, TTL enforcement, the live bundle path, gateway wiring, the Cyber AI durability/delivery
portions, the Fabric runtime seam and blocker 4 all remain open and untouched. **No UAT milestone
is reached and no instance is authorized.** W1 product implementation and integration/live shadow
stay **`HOLD`**; W1 runtime writers, delegated routine integration, push and external release stay
**`NO-GO`**; **G2 and G3 stay closed**; **`W0 COMPLETE=0`** with W0 closure **`NO-GO`**; the board
§11 exit criteria remain unmet. The W0-I04 admission itself **stays `HOLD`** — this grant changes
only the sub-lane's remediation authority, not the admission.

**Dates unchanged:** W1 **2026-08-01 → 2026-08-23**; release window **2026-12-21 → 2026-12-31**.

**The roster stays at exactly 48 with no task 49** — `W1-I04A`, `W0-IR13` and `W0-R06D` name a
sub-lane, a decision and a correction, **not tasks**.

---

## 13. What this grant does not do

- It **opens no writer now.** No session was dispatched, no product byte written by the session
  authoring this document.
- It **flips no status** and **promotes no gate.** GATE A4 and W1-C1/C2 stay
  `ACCEPTED — CLOSED 2026-07-26`; W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`. The W0-I04 admission
  stays `HOLD`.
- It **does not dispose of the dirty roadmap file.**
  `docs/strategy/06-ROADMAP-2026-2029.md` still carries its pre-existing, unrelated dirty
  working-copy edit, hash-pinned at `4ed13159a7afc104694dea8b2f2773003cdf8831`, **quarantined and
  preserved byte-for-byte, unstaged and unedited by this record**. Disposition still requires an
  explicit Founder decision or a separately scoped bounded docs grant — this is the same **P1**
  the original grant §1.3 recorded, and it **remains open**.
- It **does not resolve blocker 4** — the four dirty canonical roots and every sibling
  unintegrated accepted contract commit named in the original grant §1.4 **remain open**; **no
  claim of resolution is made**.
- **P3 recorded — persistent omission.** `docs/operations/README.md` is outside this record's
  three-path allowlist, so its long-standing index residual persists and now also omits this
  grant. **Not silently fixed outside a grant.**
- **P3 recorded.** The control validator does not machine-enforce this grant, board §1.16/§14.24,
  register §19 or any pin above; its `PASS` is a documentary consistency check only.
- **P3 recorded.** The placeholder Git author identity in this control repository (`Your Name
  <your@email.com>`) is an unchanged provenance weakness, carried forward unresolved.

---

## 14. Provenance

- Original authoring grant: `docs/operations/W1-I04A-SHADOW-REMOTE-GRANT.md`; board §1.14/§14.22;
  register §17.
- Hard-stop evidence: `docs/operations/W1-I04A-SHADOW-REMOTE-HARD-STOP-EVIDENCE.md`; board
  §1.15/§14.23; register §18.
- This grant's own bounded control-authoring authority and control-side measured evidence: board
  §14.24; board summary §1.16.
- Matching register entry: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §19.
- First amendment (W0-R06E corrections): board §1.17/§14.25; register §20.
- Second correction (W0-R06F corrections and folded P3 hardening, this document's current state):
  board §1.18/§14.26; register §21.
- Source transcripts re-read read-only for §2's corrections: writer
  `c173b76f-25b5-4bbc-8660-d5fe9a9792c8.jsonl` (lines 75–78) and reviewer
  `e650bda1-abfd-4b0e-ac79-69138716e4c6.jsonl` (line 121).
