# ADR-0005 sandbox substrate — status-flip application

- **Prepared:** 2026-07-26
- **Applied:** 2026-07-26
- **Status:** `APPLIED 2026-07-26 — ADR-0005 STATUS FLIP RECORDED — NO IMPLEMENTATION AUTHORITY`
- **Applies to:** [ADR-0005 — Sandbox substrate](ADR-0005-sandbox-substrate.md)
- **Resulting ADR status:** `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no implementation,
  dependency, substrate, spike, benchmark, container, microVM, netns, broker, Git, deployment or
  release authority follows
- **Applied under:** GATE A4 Option A **accepted 2026-07-26** under Founder-delegated
  current-thread authority (`H1..H11=yes`, `J1..J10=yes`)
- **Release impact:** none. W0–W6 dates and the 2026-12-21 → 2026-12-31 release window remain
  unchanged. No release claim is made or implied.

This is a docs-only application that records a status flip. It moved ADR-0005 from
`PROPOSED — NOT DECIDED` to `ACCEPTED` as a **decision record only**. It does **not** adopt or
install gVisor, Firecracker, Kata or any OCI runtime, start any container, microVM, netns or
broker, open any Fabric product/runtime writer, or authorize any spike, benchmark, staging, commit,
merge, push, deployment or release. GATE A4 itself is
`ACCEPTED — GATE A4 CLOSED 2026-07-26 — STATUS FLIP APPLIED — NO IMPLEMENTATION AUTHORITY`.

## 1. Evidence sources

| Source | Exact reference |
|---|---|
| Decision packet (**governing wording**) | `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` §5 (J1–J10) |
| Supporting analysis and draft acceptance wording | `docs/adr/evidence/ADR-0005-EVIDENCE.md` §15 |
| ADR under application | `docs/adr/ADR-0005-sandbox-substrate.md` |
| Accepted upstream boundary | `docs/adr/ADR-0004-tool-fabric-control-plane-executor-split.md` F3 (`ACCEPTED` 2026-07-24) |
| Lane | W0-B05 — `DECISION READY`; measured runtime choices still deferred |

Evidence is documentary and analytical only. No sandbox driver, isolation runtime, egress broker,
benchmark or escape test exists or has been run in any product repository today.

## 2. Governing precedence

Where `docs/adr/evidence/ADR-0005-EVIDENCE.md` and `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` §5
disagree, **the Gate A4 packet wording governs this application**, because the evidence file is
earlier read-ahead analysis and the packet is the decision-ready formulation reconciled against
accepted ADR-0004. See §4 for the one substantive disagreement, its resolution, and its repair at
source on 2026-07-26. This precedence rule stands regardless of that repair.

## 3. Decisions carried forward by this application — J1–J10

Recorded verbatim from `FOUNDER-DECISION-PACKET-WAVE-2.md` §5. Each entry was answered `yes` at
GATE A4 on 2026-07-26 and is now part of the accepted ADR-0005 decision record. None of them
adopts a substrate product, authorizes a spike or opens implementation.

| Gate | Accepted answer (Gate A4 packet wording) |
|---|---|
| J1 | Yes — risk-tiered sandbox-profile floors; capability→profile binding remains a Capability Registry/PDP decision and policy may only raise isolation |
| J2 | Yes — hardened rootless OCI substrate floor for S0 and no-file S4; only policy-approved S0/R0 metadata workers may be pooled, while S4 remains per-invocation disposable under accepted ADR-0004 F3 |
| J3 | Yes — disposable no-network gVisor `runsc` floor for S1; no 1:1 capability-risk binding is decided here |
| J4 | Yes — Firecracker microVM mandatory floor for S2; gVisor may be defense-in-depth only, and any R2 execution remains disposable under ADR-0004 F3 |
| J5 | Yes — Firecracker + separate netns + control-side egress broker for S3; any R2/R3 execution remains disposable under ADR-0004 F3 |
| J6 | Yes — R4 destructive remains denied to agents in 1.x |
| J7 | Yes — Kata `RuntimeClass` wrapper for T1/T2; direct Firecracker+jailer at T0 |
| J8 | Yes — fail closed when required isolation is unavailable; never downgrade S2/S3; never run raw file/PCAP in API/host process |
| J9 | Yes — macOS is dev-loop-only; S2/S3 require Linux host/CI with KVM; no native parity claim |
| J10 | Yes — defer kernel/hardware/profile/version pins to a Linux benchmark and escape-test spike |

## 4. S4 pooling — historical evidence conflict, closed 2026-07-26

The governing rule in §4.1/§4.3 is permanent and still binds. The conflict that made it necessary
to state here — stale S4-pooling wording in the read-ahead evidence file — was repaired at source
on 2026-07-26 and is recorded as closed in §4.4.

### 4.1 The accepted boundary

`ADR-0004` F3 is `ACCEPTED` (2026-07-24) and reads:

> **F3 — Risk-tiered executor lifecycle.** Disposable per-invocation isolation is mandatory for
> untrusted-input classes R1/R2/R3 and sandbox profiles S1/S2/S3. Pooled long-lived S0 workers are
> permitted for R0 read-metadata capabilities only when policy permits.

Under accepted F3, pooling is permitted for **S0 workers serving R0 read-metadata capabilities
only, and only when policy permits**. S4 is an **R3** class (reversible mutation). R3 is named
explicitly in F3 as a class for which disposable per-invocation isolation is **mandatory**.
Therefore **S4 may never be pooled.**

### 4.2 The evidence wording that conflicted, and its repair

`docs/adr/evidence/ADR-0005-EVIDENCE.md` predated that reconciliation and asserted the opposite in
several places. Every location below was repaired on disk on 2026-07-26 under a separate bounded
evidence-file authority:

| Location | Former stale assertion | Disposition |
|---|---|---|
| §5 profile/substrate/tier matrix, `S4` row | S4 marked "**Pooled** allowed" | repaired — S4 row now reads per-invocation disposable, never pooled (ADR-0004 F3) |
| §7.1 recommendation item 2 | described S0/R0 and S4/R3 together as the pooled, API-only hardened-OCI floor | repaired — hardened rootless OCI stated as the *floor* only, with the S0/R0-only pooling clause |
| §8 rejected alternatives | "Pooling is permitted only for S0/S4" | repaired — pooled S4 recorded as rejected/foreclosed by accepted ADR-0004 F3 |
| §12 validation/spike plan | asked the benchmark to confirm "S0/S4 pooled paths" meet the R0 latency budget | repaired — S0/R0 pooled path and disposable S4 path measured separately; no benchmark may assume or introduce a pooled S4 path |
| §15.1 `J2` row and §15.2 draft acceptance text | phrased J2 as hardened rootless OCI for S0/R0 **and S4/R3 (pooled)** | repaired — both now carry the governing floor/lifecycle split quoted in §4.3 |

The same repair added a dated header note, a `FACT`/`INFERENCE` pair in §2.2, an ADR-0004 row
correction in §3 and a new risk row **SR-11** in §14 covering re-entry of pooled S4 into a
downstream doc, spike or benchmark.

### 4.3 Resolution

The stale evidence wording was **superseded for every purpose of this application** — and has since
been corrected at source — by the Gate A4 packet J2 wording, quoted exactly:

> hardened rootless OCI substrate floor for S0 and no-file S4; only policy-approved S0/R0 metadata
> workers may be pooled, while S4 remains per-invocation disposable under accepted ADR-0004 F3

Binding reading, stated without ambiguity:

1. Hardened rootless OCI is the substrate **floor** for both S0 and no-file S4. Substrate floor and
   executor lifecycle are two different questions; sharing a floor does not share a lifecycle.
2. **Only policy-approved S0/R0 metadata workers may be pooled.** Pooling additionally requires
   policy approval; it is not automatic for S0 either.
3. **S4 remains per-invocation disposable under accepted ADR-0004 F3.** S4 is never pooled, under
   any policy, in any tier, in any environment, including the T0 development loop.
4. Any future document, benchmark, spike plan or acceptance text that pools S4 contradicts accepted
   ADR-0004 F3 and is invalid on its face. It does not need a fresh decision to be rejected — F3 is
   already accepted.
5. This resolution **narrows** the earlier read-ahead recommendation; it does not reopen, widen or
   re-decide accepted ADR-0004.

### 4.4 Repaired at source — closed 2026-07-26

`docs/adr/evidence/ADR-0005-EVIDENCE.md` was **outside this application's write allowlist**, so when
this section was first written its §5/§7.1/§8/§12/§15 S4-pooling wording was stale on disk and the
correction was carried as a separate gate. That correction has since been applied: the evidence file
was repaired on 2026-07-26 under a separate bounded evidence-file authority and now matches the
governing J2 wording quoted in §4.3.

The repair changed **executor-lifecycle wording only**. No recommended isolation floor, dependency
or substrate choice or release date moved by that repair; the later GATE A4 closure on 2026-07-26
is what moved the ADR status, and it moved nothing else. §4.3 stays the controlling reading for this
application, and the evidence file may now be read consistently with it rather than being excluded
as authority on S4 lifecycle.

Suite tooling still fails closed on this concern: `tools/operations/validate-w1-control.mjs`
rejects Gate A4 wording that permits pooled S4, and its test suite carries the matching negative
case.

## 5. CI and verification posture

**CI: NOT WIRED** for anything in this application. No isolation benchmark, escape test, sandbox
driver test or Linux/KVM job is registered in any pipeline. No CI result is claimed.

The only executable verification touching this document is the suite control validator, which
checks documentary invariants — not isolation behavior:

```bash
node tools/operations/validate-w1-control.mjs
node --test tools/operations/tests/validate-w1-control.test.mjs
```

## 6. Static-only boundaries

- **Static/documentary evidence only.** No containment strength, escape resistance, egress
  control, startup latency or density figure is demonstrated.
- No gVisor, Firecracker, Kata or hardened-OCI runtime is installed, pinned, started or measured.
- No kernel, hypervisor, seccomp profile, cgroup configuration or image version is pinned; J10
  defers all such pins to a Linux benchmark and escape-test spike that has **not** been run.
- No egress broker, netns configuration or artifact-extraction path exists.
- macOS is dev-loop-only. S2/S3 require a Linux host or CI with `/dev/kvm`. **No native macOS
  security parity is claimed**, and none of the S2/S3 evidence in this application was produced on
  any host.
- A microVM boundary does **not** move credentials, policy or receipt-signing authority into an
  executor; those stay control-side per accepted ADR-0004 F5/F6.
- W2-F inference delegation is not Fabric tool execution authority.
- Nothing here proves the live W1 walking skeleton. Offline W0-T10 conformance is not a substitute.

## 7. What the applied status flip did and did not do

The flip moved ADR-0005 out of `PROPOSED — NOT DECIDED` to `ACCEPTED`. It does **not**:

- adopt, select, install or pin any isolation product or version;
- authorize the Linux-only benchmark and escape-test spikes, which are separately authorized and
  must not run on the normal product writer path;
- authorize any sandbox-driver, broker or executor implementation slice, which comes only after
  those spike proofs;
- start any container, microVM, netns or broker, or handle any credential;
- authorize any commit, merge, push, deployment, release or release-date change;
- promote W1 runtime writers, which remain `NO-GO`, or change `W0 COMPLETE=0`;
- permit pooled S4 under any reading (see §4).

## 8. Residual gates

1. **GATE A4 — closed 2026-07-26.** Option A was accepted under Founder-delegated current-thread
   authority; `J1..J10` are `yes` and ADR-0005 is `ACCEPTED` as a decision record. No open gate
   remains from this item, and no substrate, spike or implementation authority may be inferred from
   it. Gates 2–7 below are unaffected and remain open.
2. **ADR-0005 evidence correction gate — closed 2026-07-26.**
   `docs/adr/evidence/ADR-0005-EVIDENCE.md` §5/§7.1/§8/§12/§15 previously pooled S4 against accepted
   ADR-0004 F3. That file was out of this application's allowlist; it was repaired on disk on
   2026-07-26 under a separate bounded evidence-file authority and now matches the governing J2
   wording (see §4.4). The no-pooled-S4 rule itself is permanent, not closed. No open gate remains
   from this item.
3. **Linux benchmark and escape-test spike** (J10) — kernel/hardware/profile/version pins deferred
   until it runs.
4. **Separate sandbox-driver/broker implementation authorization** with exact repo, base SHA, path
   allowlist, RED/acceptance command and named reviewer.
5. **Capability→profile binding** remains a Capability Registry/PDP decision (J1); policy may only
   raise isolation, never lower it.
6. **Issuer, transport, receipt-envelope and attestation spikes** retain their own separate gates.
7. **`ADR-DECISION-SPRINT-2026-07.md` stale header — closed 2026-07-26.** Its progress block
   previously stated that no Wave 2 decision packet exists, which
   `FOUNDER-DECISION-PACKET-WAVE-2.md` contradicted. That file was outside this application's write
   allowlist; it was repaired on disk on 2026-07-26 under a separate bounded authority, which at
   that time recorded the Wave 2 decision packet at `DECISION READY` with GATE A4 not yet answered.
   That header was updated again when GATE A4 closed on 2026-07-26; it now records the closure and
   ADR-0005 as `ACCEPTED`. No open gate remains from this item; gates 2–6 above are unaffected.

This application is `APPLIED 2026-07-26` and ADR-0005 is `ACCEPTED` as a decision record only.
Every substrate, dependency, spike, benchmark, container/microVM/netns/broker, Git, deployment and
release action listed in §7 remains separately gated, and pooled S4 remains foreclosed by accepted
ADR-0004 F3.
