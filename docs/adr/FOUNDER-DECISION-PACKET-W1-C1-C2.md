# Founder Decision Packet — W1-C1 / W1-C2 contract proposals

- **Prepared:** 2026-07-26
- **Status:** `ACCEPTED — W1-C1/C2 CONTRACT GATE CLOSED 2026-07-26 — LOCAL COMMITS ONLY — NOT PUSHED`
- **Decisions:** W1 alert-context capability packet and investigation lifecycle/transport packet
- **Recommendation:** Option A; C1-1–C1-10=yes and C2-1–C2-10=yes
- **Decision:** Option A **accepted 2026-07-26** under Founder-delegated current-thread authority;
  `C1-1..C1-10=yes` and `C2-1..C2-10=yes`; both packets are `ACCEPTED FOR IMPLEMENTATION v0.1.0`
  and exist as local commits only
- **Decision scope:** contract acceptance record only — the two packets are accepted at
  `v0.1.0`, and nothing beyond that record was granted.
- **Release impact:** none. W0–W6 dates and the 2026-12-21 → 2026-12-31 release window remain
  unchanged.

This packet asked whether two independently reviewed W1 contract packets should be accepted. Those
questions were answered on 2026-07-26. The exact scope of that answer:

- Acceptance is contract-first only. It moves the two packets to `ACCEPTED FOR IMPLEMENTATION
  v0.1.0` — not stable v1/GA — and grants no endpoint, transport, registry, server, product or
  runtime implementation authority.
- The two accepted packets exist as **local commits on their own branches**. Nothing was pushed,
  merged or released.
- GATE A4 (ADR-0003/ADR-0005) is a separate, already-closed gate and is unchanged by this one.

## 1. Exact accepted evidence

| Accepted lane | Accepted local commit | Scope and evidence | Current lifecycle |
|---|---|---|---|
| W1-C1 alert context | `3a2c71555a423465855ffaddcb663c8b704dbfbd` on `codex/w1-i01-alert-context-proposal-r1`, parent `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619` | exactly 16 paths; standalone validator `PASS`; 21/21 tests; 87.27% branch coverage against the declared 80% branch floor; member-set digest `sha256:e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35` (13/13 member hashes match); final independent review W0-R05 `PASS`, no open P0–P2 | `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY` |
| W1-C2 investigation lifecycle | `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4` on `codex/w1-i02-investigation-lifecycle-proposal-r1`, parent `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619` | exactly 32 paths; standalone validator `PASS`; 31/31 tests; 97.44% branch coverage; official Ajv strict eight clean compilations, Spectral/AsyncAPI zero errors; aggregate SHA-256 `0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e` (30/30 member digests match); final independent review W0-T01 `PASS`, no open P0–P3 | `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY` |

Both accepted commits share the parent `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619` and were made on
their own isolated branches. The digests use each packet's declared aggregate algorithm; they are
not Git commit identities. Both rows are re-verified from the **committed** bytes of the accepted
commits; every earlier pre-acceptance value is recorded as history in §9. Every result is
**static/documentary only** from manual reproducible execution — **CI: NOT WIRED**, and no CI
result is claimed.

## 2. Option set — Option A selected 2026-07-26

| Option | Meaning |
|---|---|
| **A — accept both packets (SELECTED 2026-07-26)** | Answer C1-1–C1-10 and C2-1–C2-10 `yes`; accept both packets at `ACCEPTED FOR IMPLEMENTATION v0.1.0` through two separate docs-only evidence-linked acceptance applications, recorded as local commits only. Push, merge, product/runtime, integration, deployment and release each remain separately gated. |
| B — accept W1-C1 only (not selected) | Answer C1-1–C1-10 `yes`; keep W1-C2 proposed. |
| C — defer both (not selected) | Keep both packets proposed; continue read-only design/review only. |

## 3. W1-C1 exact decisions — C1-1–C1-10 (all accepted 2026-07-26)

Each `Yes` was recorded as an accepted contract decision at `v0.1.0`. No row grants endpoint,
transport, registry, product or runtime implementation authority, and no row grants push, merge or
release authority.

| Gate | Accepted decision |
|---|---|
| C1-1 | **Yes** — SOC owns alert truth and the exact alert-context projection |
| C1-2 | **Yes** — tenant, org, actor and clearance derive from authenticated SOC identity/policy; body fields never expand authority |
| C1-3 | **Yes** — authorization occurs before cache/idempotency lookup; replay binds principal, capability, schema, policy and normalized input digests |
| C1-4 | **Yes** — same key/binding replays byte-identically; same key with a different binding returns a closed conflict before target lookup |
| C1-5 | **Yes** — unavailable responses use one sanitized shape for absent, unauthorized and filtered targets; static packet proves shape only, not timing |
| C1-6 | **Yes** — internal alert/event/entity/case references have no arbitrary locator; SOC produces the RFC 8785/JCS context digest after authorization/redaction |
| C1-7 | **Yes** — result marking never exceeds request clearance; no authoritative source-marking floor is claimed by this packet |
| C1-8 | **Yes** — `soc.get_alert_context@0.1.0` is R0, `side_effects=false`; W2-F inference delegation is not Fabric tool execution authority |
| C1-9 | **Yes** — scope the acceptance to the exact 16-path/hash candidate only; no endpoint, transport, registry, product or runtime implementation follows automatically |
| C1-10 | **Yes** — defer `include_descendants` permission, digest signing/attestation, timing/audit targets and transport binding to explicit follow-on gates |

## 4. W1-C2 exact decisions — C2-1–C2-10 (all accepted 2026-07-26)

Each `Yes` binds the accepted `v0.1.0` contract only. No row adopts Bundle v0.1.1 or supersedes
v0.1.0.

| Gate | Accepted decision |
|---|---|
| C2-1 | **Yes** — Cyber AI is the sole lifecycle/checkpoint/event/Bundle producer and state-transition authority |
| C2-2 | **Yes** — SOC is an authenticated requestor/consumer/viewer only and cannot mint lifecycle state or rewrite a Bundle |
| C2-3 | **Yes** — W2-D remains the sole inference-path owner; W2-F remains only the SOC→Cyber AI identity/delegation seam and grants no Fabric execution authority |
| C2-4 | **Yes** — endorse create, status, ordered checkpoint list, compare-and-set cancel and Bundle-read operations with no declared server/runtime binding |
| C2-5 | **Yes** — tenant/org/actor scope derives from authenticated identity/policy and advisory body values never expand scope; marking is an authoritative request input and artifact marking never downgrades |
| C2-6 | **Yes** — idempotency binds authenticated principal, key and normalized body; mismatched reuse is an idempotency conflict |
| C2-7 | **Yes** — cancellation is compare-and-set; one transition wins; terminal attempts and prior checkpoints/receipts are immutable |
| C2-8 | **Yes** — retries create new attempts, checkpoint sequence is monotonic per attempt and markings never downgrade |
| C2-9 | **Yes** — unknown and unauthorized IDs share the sanitized error class/shape/message; timing equivalence remains a runtime-only obligation |
| C2-10 | **Yes** — scope the acceptance to the exact 32-path/hash candidate; Bundle v0.1.1 is only a proposed successor candidate, v0.1.0 remains the authoritative Bundle contract, and v0.1.1 adoption, supersession and consumer migration require separate future authority |

## 5. Post-decision sequence — steps 1–3 done, steps 4–6 still gated

1. ~~Record the exact answer.~~ **Done 2026-07-26.**
2. ~~Apply two separate docs-only acceptance applications with evidence links and committed-byte
   hash verification.~~ **Done and applied 2026-07-26** (§8).
3. ~~Record each accepted packet as a path-limited local commit on its own branch.~~
   **Done 2026-07-26**; see §1. Push and merge were **not** performed and are **not** authorized.
4. Obtain separate publication authority before any push of either branch, and separate merge
   authority before either reaches `main`.
5. Keep SOC/Cyber AI/Fabric runtime writers held until exact product/base/path/test/reviewer gates.
6. Keep the real shadow vertical held until committed product inputs exist.

## 6. Boundaries retained

- GATE A4 closed 2026-07-26 with ADR-0003 and ADR-0005 `ACCEPTED` as decisions only; that
  acceptance grants no contract acceptance and no product, runtime or release authority, and
  changes nothing in this gate.
- Nothing was pushed, merged or released. The two accepted packets exist only as local
  commits on their own branches; publication, merge to `main`, release and release-date
  authority each remain separate Founder decisions.
- Contract acceptance opened no product or runtime writer. SOC, Cyber AI and Fabric W1
  writers remain `HOLD` until their own exact repo/base/path/test/reviewer authority.
- FAB-C0 is evidence-ready but uncommitted and is not part of this contract acceptance.
- No dependency, DB/container, endpoint, server, broker, credential, model, sandbox or deployment
  is selected or started.
- No contract acceptance proves runtime authorization, no-existence timing, durability, live
  SOC→AI→Fabric execution or a returned Bundle.
- No routine integration, release, release-date or release-blocker authority is granted.
- W1-C1 evidence supports the request-clearance ceiling on result marking only; it does not prove
  an authoritative source-marking floor.
- Even after both acceptances, adopting Bundle v0.1.1, superseding v0.1.0 or
  migrating any consumer each needs its own separate future Founder decision; v0.1.0 bytes stay
  unchanged.

## 7. Exact recorded decision shorthand

```text
Duyệt W1-C1/C2 Option A: C1-1..C1-10=yes; C2-1..C2-10=yes; chấp nhận hai packet ở mức `ACCEPTED FOR IMPLEMENTATION v0.1.0`, chỉ tồn tại dưới dạng local commit trên nhánh riêng; Bundle v0.1.1 chỉ là proposed successor candidate, v0.1.0 vẫn authoritative, adoption/supersession/consumer migration cần quyết định riêng sau; không push/merge/release, không mở product/runtime, không install dependency, chạy DB/container, deploy hoặc release.
```

That answer was recorded on 2026-07-26. The W1-C1/C2 contract gate is closed and both packets are
`ACCEPTED FOR IMPLEMENTATION v0.1.0` as local commits only.

## 8. Applied acceptance applications

**Authority basis.** Option A was recorded with `C1-1..C1-10=yes` and `C2-1..C2-10=yes` under
**Founder-delegated current-thread authority**, scoped to this thread and to the nineteen paths
listed in `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.7, plus the two path-limited candidate
commits described in §1. That authority covers the contract acceptance, its documentation record
and those two local commits, and nothing else. Push, merge, product/runtime writers, dependency
installation, DB/container start, deployment, integration, release and release-date authority each
remain with the Founder and are each separately gated.

Under that delegated authority, and under no wider authority, the two separate docs-only
evidence-linked acceptance applications have been applied:

| Application | Path | Status |
|---|---|---|
| W1-C1 alert-context application | `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` | `APPLIED 2026-07-26` |
| W1-C2 investigation-lifecycle application | `docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` | `APPLIED 2026-07-26` |

Neither application adopts Bundle v0.1.1, supersedes v0.1.0, migrates a consumer, or grants push,
merge, product/runtime, integration, deployment, release or release-date authority.

**Rider — W0-R01 Option B (Fable independent review).** The final cross-agent review of the two
candidates raised one non-blocking finding on the W1-C2 lane. Option B was selected: the finding is
disclosed as a **LOW advisory** and changed **no accepted contract byte**. Option A of that rider —
rewriting accepted packet bytes before acceptance — was **not** selected, so the accepted commits in
§1 carry exactly the reviewed bytes. The advisory is carried forward in
`docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` and
`docs/operations/W1-E2-EVIDENCE-REGISTER.md` and is not a P0–P3 defect.

## 9. Evidence reconciliation — history retained, not current status

The §1 rows have been repaired twice. Both repairs are recorded here as history; the values now
pinned in §1 are the current status and are re-verified from the **committed** bytes of the
accepted commits.

**First repair (pre-acceptance, §14.4 five-path authority).** The §1 rows previously carried a
W1-C1 aggregate, a W1-C2 aggregate, a W1-C2 test count and two line-coverage figures that did
**not** reproduce from the then-current on-disk candidate bytes.

| Attribute | Superseded value | Value pinned by the first repair |
|---|---|---|
| W1-C1 aggregate | earlier `ce9921d3…` value | `sha256:cd872a0e…`, from 13/13 matching member hashes |
| W1-C1 coverage | `90.39%` line coverage | `87.87%` branch coverage |
| W1-C2 aggregate | earlier `f79702c6…` value | `16099c17…`, from 30/30 matching member digests |
| W1-C2 test count | earlier `10/10` figure | `29/29` |
| W1-C2 coverage | `86.67%` line coverage | `97.39%` branch coverage |

**Second repair (post-acceptance, §14.7 nineteen-path authority).** Accepting the two packets moved
the authoritative byte set from the uncommitted worktrees to the two local commits pinned in §1,
and the final review round added test cases to both lanes. Every pin below was recomputed from the
committed bytes.

| Attribute | Superseded pre-acceptance value | Current value pinned in §1 |
|---|---|---|
| W1-C1 aggregate | `cd872a0e…` | `sha256:e4cfbf8c…` (13/13 member hashes match) |
| W1-C1 test count | `18/18` | `21/21` |
| W1-C1 coverage | `87.87%` branch coverage | `87.27%` branch coverage against the declared 80% branch floor |
| W1-C2 aggregate | `16099c17…` | `0fcac6ede9b2c…` (30/30 member digests match) |
| W1-C2 test count | `29/29` | `31/31` |
| W1-C2 coverage | `97.39%` branch coverage | `97.44%` branch coverage |

Attributes **unchanged** by either repair: W1-C1 16 paths; W1-C2 32 paths, Ajv strict eight clean
compilations and zero Spectral/AsyncAPI errors; both candidates rooted at parent
`3ef8e0536f8210f2739c6fa0e32e37f8dc27d619`.

The final independent reviews recorded for these candidates are cross-lane: W1-C1 final
`W0-R05 PASS` and W1-C2 final `W0-T01 PASS`, consistent with the rule that no reviewer approves its
own authored proposal.

**Application reconciliation — closed 2026-07-26.**
`docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` and
`docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` both record the current
post-acceptance values and retain the superseded values as history. No open gate remains from this
item.

## 10. Standing posture unchanged

`W0 COMPLETE=0` and W0 closure `NO-GO`. W1 runtime writers remain `HOLD`/`NO-GO`. Delegated routine
integration and external release remain `NO-GO`. The 2026-12-21 → 2026-12-31 release window is
unchanged and no release claim is made.
