# ADR-0004 Evidence Packet — Tool Fabric control-plane / executor split

- Status: `DRAFT` — recommendation only. Backs a `PROPOSED — NOT DECIDED` ADR; this packet
  informs a decision, it does not make one. Nothing in the suite is implemented, verified, or
  piloted; `cybrik-security-tool-fabric` is a documentation-only scaffold.
- Date: 2026-07-24
- Backs: [ADR-0004](../ADR-0004-tool-fabric-control-plane-executor-split.md)
- Wave / gate: Wave 1; feeds **GATE A3** (see [ADR-DECISION-SPRINT-2026-07.md](../ADR-DECISION-SPRINT-2026-07.md)
  §3). GATE A3 is **not** opened by this packet; it opens only under separate Founder work
  authorization.
- Scope: `cybrik-security-tool-fabric` — the process/trust boundary between the trust-critical
  control plane (capability registry, policy decision, approval broker, credential broker,
  egress broker, receipt ledger, kill switch) and the executors that run security tools;
  executor lifecycle (pooled vs. per-invocation disposable); credential/egress flow to
  executors; where receipts are signed; blast-radius containment of a compromised executor.
- Inherits (accepted, not re-decided here): the workload-identity and receipt-signing **model**
  is fixed by [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md) — SPIFFE-style
  workload identity + mTLS (E2), delegation as digest-bound grants embedded in receipts (E3),
  and the **Tool Fabric control plane signs receipts while executors attest** (E5). This packet
  chooses the *split*, not those already-accepted model decisions. Contract versioning and
  format pins of anything named here inherit [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md)
  (D4: OpenAPI 3.1.x / JSON Schema 2020-12 / AsyncAPI 3.0.0 / MCP 2025-11-25).
- Prepared by: orchestrator, under Founder delegation of overnight technical decisions
  (Wave 1). **Produces a recommendation for the Founder decision; it does not accept the ADR.**
  ADR acceptance remains a Founder gate (ADR-0001 D5 mechanics).

## 0. Source-labelling key

Per [evidence/README.md](README.md) and sprint §6: `FACT` (verified against the primary source
cited), `RESEARCH` (summarized from a primary/official source via its published page/repo/spec,
not independently reproduced/built here), `PROPOSAL` (our position, ours to defend), `INFERENCE`
(reasoning from labelled facts; could be wrong), `UNKNOWN` (open question; material ones appear
in the Founder decision list). Every external claim cites a primary/official URL with an
**access date**. All external URLs in this packet were accessed **2026-07-24**. Internal
cross-repo references use `repo:path` form and are code state **as read on 2026-07-24**, not a
claim of implemented suite capability.

## 1. Decision criteria (constraints)

Stated before scoring. Drawn from `../../strategy/03-REFERENCE-ARCHITECTURE.md` §1/§7/§8/§13,
`../../strategy/07-SOLO-FOUNDER-AI-OPERATING-MODEL.md` §5, `../../strategy/08-EVALUATION-SECURITY-COMPLIANCE.md`
§6, and the accepted [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md)
identity/receipt model. Options are scored against these and only these.

| # | Criterion | Why it matters |
|---|---|---|
| F-C1 | Blast-radius containment | A fully compromised executor must not reach credentials at rest, the policy/approval store, the receipt signing key, other tenants' work, or the management/production network (`03 §7`, ADR-0004 consequence 5; NIST SP 800-207 "assume breach"). |
| F-C2 | Untrusted-input isolation | Raw file/PCAP/binary/detonation input must never run in the AI, SOC, or control-plane process, and must run in a **disposable** environment destroyed after use (`03 §7.3`: "Không chạy raw file/PCAP trong AI process hoặc SOC API process"). |
| F-C3 | Credential non-persistence + egress control | Brokered credentials must reach an executor short-lived, single-use, scoped, and never persist there; egress must be allowlisted/proxied and never returned to the model (`03 §7.1` Credential/Egress Broker, `03 §8.1`, `08 §6.1`). |
| F-C4 | Receipt integrity | Receipts must be tamper-evident and signed by the control plane; executors only attest evidence into them (accepted ADR-0006 E5; `03 §7.1` Receipt Ledger). |
| F-C5 | Executor identity attestation | Each executor must carry an attestable workload identity so the control plane knows *which* executor ran a step (accepted ADR-0006 E2; `03 §8.1` mTLS/workload identity). |
| F-C6 | Latency vs. isolation | Per-invocation disposal buys isolation but costs startup latency and scheduling; the split must let cheap read paths stay hot while dangerous paths pay for isolation (ADR-0004 consequence: latency vs. isolation). |
| F-C7 | Solo-founder operability, T0→T2 | One founder operates all of it; it must run on a single host at T0 and scale to Kubernetes/air-gap at T1/T2 without a *different* security model (`03 §10`, `07 §5` minimal-tech, `03 §1.8` "tối đa hai process chính"). |
| F-C8 | Fail-closed on control-plane loss | If the policy/approval/receipt store is unavailable, side-effecting classes must fail closed (deny), not degrade to unlogged execution (`03 §13`; `08 §6.2` deny-by-default). |
| F-C9 | Substrate license / supply-chain | Any isolation substrate shipped into an air-gapped customer must be permissively licensed and offline-installable/verifiable (`02 §7`, `03 §10` T2; SLSA/offline-verify posture). |
| F-C10 | Idempotency + bounded execution | Invocations must be idempotent and bounded (time/CPU/RAM/output/egress budget), with dedup, so retries and a compromised or runaway tool cannot amplify effect (`03 §7.1` Execution Scheduler, `08 §2` "bounded query, retry/idempotency", `03 §13` sandbox timeout). |

## 2. Current-state evidence

### 2.1 What the strategy already fixes (internal baseline — RESEARCH from internal docs, not a decision)

- RESEARCH — The Tool Fabric module set is already named: **Capability Registry, Gateway,
  Policy Decision Point, Approval Broker, Credential Broker, Egress Broker, Execution Scheduler,
  Executor Pools, Artifact Store, Receipt Ledger, Kill Switch** (internal:
  `../../strategy/03-REFERENCE-ARCHITECTURE.md` §7.1). The brokers, policy, approval, and receipt
  ledger are described as control-plane responsibilities; executor pools run the tools.
- RESEARCH — Capability **risk classes** are pre-defined (`03 §7.2`): **R0** read metadata
  (API worker, no approval), **R1** analyse artifact (no-network sandbox, quota), **R2** active
  observation (egress allowlist, optional approval), **R3** reversible mutation (named approver,
  TTL/rollback), **R4** destructive (hard-denied to agents in 1.x). "Risk class chỉ là upper
  bound" — policy may raise but never lower it.
- RESEARCH — **Sandbox profiles** are pre-defined (`03 §7.3`): **S0** API-only (no untrusted
  input); **S1** restricted container (read-only rootfs, non-root, seccomp/AppArmor, no network,
  resource caps) for reviewed parsers/scanners; **S2** microVM with **disposable filesystem**,
  no host mounts, for untrusted file/binary/code detonation; **S3** controlled network lab
  (separate netns, egress via broker) for PCAP replay/active observation; **S4** response
  executor (no file input; typed vendor API with short-lived credential + policy + approval +
  rollback). Explicit rule: "Không chạy raw file/PCAP trong AI process hoặc SOC API process."
- RESEARCH — Credential/egress flow (`03 §8.1`): service-to-service uses **mTLS/workload
  identity**; "Tool backend nhận credential do Credential Broker cấp, không nhận delegation token
  nguyên bản" (the executor receives a broker-issued short-lived credential, never the raw
  delegation token); token TTL proposed 2–5 min, audience one service, tokens never logged
  (only `jti` hash logged).
- RESEARCH — Failure posture (`03 §13`, `08 §6.2`): approval service unavailable → fail closed;
  audit/receipt store unavailable → R2/R3 fail closed, R0 may degrade per policy; sandbox
  timeout → kill disposable workload, preserve partial logs/digests; policy version change
  mid-run → re-evaluate before action, old approval invalid on material change (`03 §9.2`);
  global/tenant/tool/action **kill switch fails closed** (`03 §7.1`).
- INFERENCE — These fix *what* the pieces are and *that* isolation is tiered by risk; they do
  **not** decide the process/trust boundary, the executor lifecycle (pooled vs. per-invocation),
  the identity issuer, the transport, or the receipt-signing envelope. Those are this ADR.

### 2.2 Accepted-model constraints this ADR must honour (not re-decide)

- FACT — Accepted [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md): **E2** the
  suite uses a **SPIFFE-style workload identity model** (per-deployment trust domain, short-lived
  credentials, mTLS), with the **issuer/substrate implementation (SPIRE vs. minimal internal
  issuer) explicitly left to ADR-0004**; **E5** the **Tool Fabric control plane signs receipts**
  and **executors attest evidence to the control plane**; **E3** delegation is an ordered chain
  of digest-bound grants embedded in receipts; MCP is an adapter, **not** a trust boundary.
- INFERENCE — E2/E5 remove two would-be options from this ADR: signing receipts *at the executor*
  is out (E5), and inventing a non-SPIFFE identity model is out (E2). What remains open is the
  **issuer implementation** and the **split** that makes E5's "control plane signs, executor
  attests" physically true — i.e. the executor must not hold the signing key or the credentials
  at rest, which is a boundary/lifecycle decision (F-C1/F-C4).

### 2.3 SPIFFE / workload identity (implementation surface deferred by ADR-0006)

- FACT — SPIFFE is a set of open standards for identifying workloads: a **SPIFFE ID** within a
  **trust domain**, materialised as short-lived **SVIDs** in two forms — **X.509-SVID** and
  **JWT-SVID**; **SPIRE** is the reference implementation, supporting Kubernetes, VMs, and bare
  metal, and performs node + workload **attestation** to issue SVIDs.
  <https://spiffe.io/docs/latest/spiffe-about/overview/> (accessed 2026-07-24)
- RESEARCH — Zero-trust guidance underpins the split: NIST SP 800-207 (verify explicitly, least
  privilege, **assume breach**) and SP 800-207A (workload identity for cloud-native/multi-service)
  are the strategy's cited baseline (`02 §6`). <https://csrc.nist.gov/pubs/sp/800/207/final>,
  <https://csrc.nist.gov/pubs/sp/800/207/a/final> (accessed 2026-07-24)
- INFERENCE — X.509-SVID mTLS gives an attestable executor identity that works air-gapped with a
  self-hosted trust domain (F-C5, F-C7). The open implementation question ADR-0006 handed here is
  **SPIRE (full node+workload attestation, higher operational footprint) vs. a minimal internal
  CA/issuer** (fewer moving parts for a solo founder at T0). This is a *measured* choice (§8), not
  resolvable on paper — the deciding input is SPIRE's server+agent+registration footprint versus
  plain mTLS with an internal CA at T0 (carried UNKNOWN from the ADR-0006 packet §2.3).

### 2.4 Isolation-substrate landscape (substrate choice belongs to ADR-0005; cited for feasibility only)

- RESEARCH — **gVisor** (Apache-2.0) is a user-space application kernel that intercepts syscalls
  to isolate untrusted workloads with a smaller host attack surface than a shared kernel; runs as
  an OCI runtime (`runsc`). <https://gvisor.dev/docs/> (accessed 2026-07-24)
- RESEARCH — **Firecracker** (Apache-2.0) is a KVM-based microVM VMM with a minimal device model,
  designed for fast-starting, disposable, per-workload isolation.
  <https://firecracker-microvm.github.io/> (accessed 2026-07-24)
- RESEARCH — **Kata Containers** (Apache-2.0) runs OCI containers inside lightweight VMs to add a
  hardware-virtualization boundary behind a container interface. <https://katacontainers.io/>
  (accessed 2026-07-24)
- RESEARCH — NIST SP 800-190 (Application Container Security Guide) is the recognised primary
  guidance for container isolation risks (kernel sharing, hardening, least privilege) that the
  S1/S2 profiles must answer. <https://csrc.nist.gov/pubs/sp/800/190/final> (accessed 2026-07-24)
- INFERENCE — All three substrates are permissively licensed and offline-installable (F-C9) and
  can back the S1/S2/S3 profiles the strategy names. **Which** substrate backs each profile, and
  its per-invocation startup-latency envelope, is **ADR-0005** (sandbox substrate), not this ADR —
  this ADR only needs the *feasibility* that a disposable per-invocation isolation boundary exists
  to demand. No substrate is chosen or benchmarked here.

### 2.5 Signing / attestation envelope (format deferred)

- RESEARCH — Tamper-evident receipt/attestation envelopes have permissive, offline-verifiable
  standards: **COSE** (RFC 9052) for CBOR-signed objects, **JWS** (RFC 7515) for JSON, and the
  **Sigstore / in-toto** attestation family for supply-chain-style signed statements.
  <https://www.rfc-editor.org/rfc/rfc9052>, <https://www.rfc-editor.org/rfc/rfc7515>,
  <https://docs.sigstore.dev/> (accessed 2026-07-24)
- INFERENCE — E5 fixes *who signs* (control plane) and *what attests* (executor); it does **not**
  fix the **envelope format** (COSE vs. JWS vs. in-toto-style statement) or the executor
  **attestation transport/mechanism**. Those are measured/among-equivalents choices deferred to §8,
  to be pinned under ADR-0001's format-pinning discipline (accepted D4) when receipts become a
  contract.

### 2.6 Design seeds already in the SOC repo (existing code state — a seed, NOT a Fabric capability)

- FACT (code state, `cybrik-soc-command-center`, read 2026-07-24) — the following SOC-internal
  code maps to Fabric control-plane pieces. It is another repository's existing state, **not** Tool
  Fabric, which does not exist as code:
  - **Approval gate (implemented, test-covered in SOC — not stubbed)** —
    `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/soar/engine.py`:
    `class SoarEngine` (line 110) is a deny-by-default four-eyes SOAR approval-gate state machine.
    `SoarEngine.approve(...)` (line 463) enforces author↔approver separation
    (`approver == execution.triggered_by` rejected, line 484), TTL expiry (line 481), and a fresh
    kill-switch read before dispatch (line 471); `reject(...)` (527), `expire_approvals(...)`
    (553, auto-cancel/fail-safe), `_run_action_step(...)` (280) places class-B steps into
    `PENDING_APPROVAL`. HTTP surface in `.../soar/api.py`: `list_approvals` (438, requires
    `soar:approve`), `approve_action` (493), `reject_action` (502), `_decide` (462). This is a
    strong seed for the Fabric **Approval Broker** semantics (`03 §7.1`).
  - **Egress guard** — `cybrik-soc-command-center:services/api/src/cybrik_soc/platform/outbound.py`
    (the allow-listed outbound guard the SOC LLM adapter reuses) seeds the Fabric **Egress Broker**
    (`03 §7.1`).
  - **Secret resolution** — `.../platform/secrets.py` resolves `secret_ref`s — a seed for the
    Fabric **Credential Broker**'s "resolve `secret_ref`, issue short-lived credential, never
    return to model" contract (`03 §7.1`).
  - **Capability schema input** — `.../modules/copilot/tools.py` (`Tool` / registry / argument
    validation) is design input for the Fabric **Capability Registry** schema (`03 §12.1`).
  - **Tech stack of the seed** — Python ≥3.11 / FastAPI / SQLAlchemy-async + asyncpg (PostgreSQL,
    JSONB, tenant RLS) / Alembic; a modular monolith.
- INFERENCE — These seeds argue the recommended boundary is buildable by one founder by lifting
  proven SOC patterns into a Fabric control plane (F-C7). They do **not** argue the boundary
  already exists: Tool Fabric is a documentation-only scaffold; none of this runs in
  `cybrik-security-tool-fabric`.

### 2.7 Confirmed SOC gap — in-memory approval state + no external Fabric ingress + no receipts

Recorded precisely per Founder instruction; **not resolved by this ADR**. All items are FACT
about SOC code state as read 2026-07-24, or an UNKNOWN/GAP where a contract is owed. None of this
implies any Tool Fabric capability.

- FACT (code state) — **Approval/execution run-time state is held IN-MEMORY (Python dicts); the
  database is an explicitly-labelled side/mirror record, not the source of truth.** Exact symbols:
  - `.../soar/engine.py:136` — `self._executions: dict[uuid.UUID, Execution] = {}`
  - `.../soar/engine.py:137` — `self._approvals: dict[uuid.UUID, ApprovalRequest] = {}`
  - `.../soar/runtime.py:115` — `_runtimes: dict[uuid.UUID, SoarRuntime] = {}` (module-level, one
    `SoarEngine` per tenant **per process**).
  - The module's own docstrings state this: `runtime.py:3` ("giữ execution/approval **trong bộ
    nhớ** (không có store seam)"), `runtime.py:14-16` (on app restart, an in-memory `PENDING`
    approval is **lost**; DB pending rows are swept to `EXPIRED` after TTL as a fail-safe),
    `orm.py:7-11` and `api.py:17` (the Postgres tables `SoarApprovalRequest` (`orm.py:129`),
    `SoarExecution` (`orm.py:74`), `SoarStepResult` (`orm.py:102`, append-only) are a "**mirror
    ben**" / side-record), `api.py:480-485` (on restart, an approval present in DB but absent from
    memory is **fail-safe-rejected**, never re-executed).
- FACT (code state) — **No external Tool-Fabric approval ingress is implemented.** A whole-repo
  search for `fabric` returns **zero hits in any `.py`/`.ts` source**; the only occurrences are
  `cybrik-soc-command-center:docs/architecture/INDEX.md:104,106`, which reference the sibling
  product "Security Tool Fabric" and an "evidence/approval/receipt model" **explicitly labelled
  PROPOSED ("Đề xuất")**. All SOAR approval endpoints are gated by an **internal** authenticated
  `Principal` via `Depends(require("soar:approve"))` (RBAC) — an interactive SOC user, not an
  external service principal or a signed inter-service call. An inbound webhook-signing scheme
  exists (`.../platform/signing.py`, `cybrik-webhook-v1`) but is wired **only** to log/telemetry
  ingestion (`.../modules/ingest/service.py:214,223`), **not** to SOAR approvals.
- FACT (code state) — **No execution receipts / signed execution records exist in SOC code.** A
  whole-repo search for `receipt` returns a single hit: `docs/architecture/INDEX.md:106` (the same
  PROPOSED cross-product concept). The tamper-evidence that *does* exist is an **append-only audit
  trail**, not signed receipts: `.../soar/audit.py` (`AuditSink` / `InMemoryAuditLog`, events
  `soar.approval.approved` / `soar.step.executed` / `soar.approval.expired`) flushed to the shared
  append-only `audit_events` table (`runtime.py:190` → `platform.audit_support.record`);
  `SoarStepResult` grants exclude UPDATE/DELETE (migration `alembic/versions/0013_soar.py`).
- UNKNOWN / GAP — For a Fabric R2/R3 action there is **no accepted ingress contract** for (a) how
  a **Fabric-originated** approval-required request reaches a human approver's inbox, and (b) how a
  **SOC-authenticated** approver decision returns to Fabric as a **digest-bound approval** binding
  capability + resolved arguments + policy digest (so a stale approval dies on any material change,
  per `03 §9.2`). An approval arriving from **outside** the live SOC session (email/portal link,
  an external or on-call approver) has **no defined authenticated ingress** at all. Additionally,
  the SOC gate's in-memory, per-process, non-durable approval state (above) is **not** the durable,
  digest-bound, restart-surviving approval a cross-product Fabric flow will require. This gap sits
  on the critical `Alert → … → Approval → Receipt → Case` slice (sprint §1) and is a
  **cross-product contract** owed under ADR-0001 later — *recorded and surfaced* here (§6, §11,
  §12), not resolved by this ADR.

## 3. Option analysis (option matrix)

The three options are ADR-0004's A/B/C. They are **not** mutually exclusive across risk classes:
the live recommendation is a **risk-tiered** application of B and C (§6), scored here individually
against §1.

### 3.1 Option A — single service, internal module boundary

| Criterion | Score | Note |
|---|---|---|
| F-C1 blast radius | Weak | A tool compromise shares the process with credentials, policy, and the receipt signer. |
| F-C2 untrusted input | Weak | Untrusted file/PCAP would run in-process — the exact thing `03 §7.3` forbids. |
| F-C3 cred/egress | Weak-medium | Broker code exists but shares memory with the tool; credentials reachable in-process. |
| F-C4 receipts | Weak | Signer key co-resident with tool code; E5 "executor attests, control plane signs" is not physically true. |
| F-C5 identity | N/A | No separate executor to attest. |
| F-C6 latency | Strong | No cross-process/scheduling cost. |
| F-C7 operability | Strong | One process to run. |
| F-C8 fail-closed | Medium | Achievable in code, but a compromised in-process tool can subvert the same process's fail-closed logic. |
| F-C9 substrate | N/A | No isolation substrate. |
| F-C10 idempotency/bounded | Medium | Achievable in code; bounds share the blast radius. |
| **Verdict** | **Rejected as the boundary** | Fastest, but violates F-C1/F-C2/F-C4 and contradicts accepted E5. Acceptable only as a T0 *dev-loop* shape with untrusted classes disabled — never as the shipped security model. |

### 3.2 Option B — control-plane service + executor pool over an authenticated queue/API

| Criterion | Score | Note |
|---|---|---|
| F-C1 blast radius | Medium-strong | Executor is a separate process/trust zone; credentials, policy store, and signer stay control-side. A compromised *pooled* executor can still affect later invocations sharing that worker. |
| F-C2 untrusted input | Medium | Separate process, but a long-lived pooled worker is not disposable — cross-invocation residue is possible for untrusted input. |
| F-C3 cred/egress | Strong | Brokers stay control-side; executor gets only short-lived scoped credentials and egresses through the broker. |
| F-C4 receipts | Strong | Control plane holds the signing key; executor attests over the authenticated channel (satisfies E5). |
| F-C5 identity | Strong | Executor carries a SPIFFE-style workload identity over mTLS (satisfies E2). |
| F-C6 latency | Strong | Pooled workers stay hot; no per-call startup. |
| F-C7 operability | Strong | Control plane + a worker pool is one founder's reach at T0, scales at T1/T2. |
| F-C8 fail-closed | Strong | Control plane owns policy/approval/receipt; executor cannot self-authorise when it is unreachable. |
| F-C9 substrate | Strong | No mandatory heavy substrate for the pooled tier. |
| F-C10 idempotency/bounded | Strong | Scheduler owns dedup/idempotency/budget control-side (`03 §7.1`). |
| **Verdict** | **Baseline boundary** | Correct always-on process/trust split and the minimum that makes E2/E5 physically true — but insufficient alone for untrusted-input classes (F-C2). |

### 3.3 Option C — B plus per-invocation disposable sandbox for every tool run

| Criterion | Score | Note |
|---|---|---|
| F-C1 blast radius | Strong | Fresh environment per run; nothing survives to the next invocation. |
| F-C2 untrusted input | Strong | Disposable filesystem/microVM per detonation is exactly `03 §7.3` S2/S3. |
| F-C3 cred/egress | Strong | Same control-side brokers as B; credential lifetime ≤ one invocation (single-use). |
| F-C4 / F-C5 | Strong | Inherits B's signing/identity split. |
| F-C6 latency | Weak-medium | Per-invocation startup + scheduling cost on *every* run, including cheap R0 reads. |
| F-C7 operability | Medium | Per-invocation lifecycle + a substrate to operate everywhere. |
| F-C8 fail-closed | Strong | Inherits B; disposal on timeout preserves partial digests (`03 §13`). |
| F-C9 substrate | Medium | Requires a shipped, offline-verifiable substrate at every tier (ADR-0005). |
| F-C10 idempotency/bounded | Strong | Disposal makes bounds hard limits; residue cannot amplify a retry. |
| **Verdict** | **Mandatory for untrusted classes; wasteful if applied to R0** | Right for R1/R2/R3 and any untrusted input; paying its latency on R0 metadata reads buys no isolation (no untrusted input runs there). |

### 3.4 Why risk-tiered, not a single option

- INFERENCE — F-C2 forces **C** for any class that runs untrusted/hostile input (R1 artifact
  analysis, R2 active observation, R3 mutation-adjacent detonation, S1/S2/S3). F-C6/F-C7 argue
  against paying C's per-invocation cost for **R0** read-metadata, where **S0 API-only** workers
  run no untrusted input and a **pooled** worker is safe **only when policy permits**. The
  strategy's own risk-class/sandbox tables (`03 §7.2`, `03 §7.3`) already encode this gradient; the
  recommendation makes the *boundary* match it. Policy may only ever *raise* isolation, never lower
  it (`03 §7.2`).

## 4. Security / trust-boundary analysis (blast radius)

INFERENCE throughout, reasoned from §1–§3 and the accepted ADR-0006 model; no capability exists.

**Trust zones (proposed).** (1) *Control plane* — capability registry, PDP, approval/credential/
egress brokers, receipt ledger + signing key, kill switch; highest trust. (2) *Executor tier* —
runs tool logic; **assumed potentially hostile** (F-C1, NIST SP 800-207 assume-breach). (3)
*Disposable sandbox* — per-invocation environment for untrusted input; lowest trust, zero
persistence. (4) *SOC* (analyst identity + approval decision) and (5) *Cyber AI* (requester) sit
across the boundary and never mint authority into Fabric.

**What crosses each boundary (ILLUSTRATIVE — NOT A CONTRACT):**

| Boundary | Toward executor | Back to control plane |
|---|---|---|
| Control plane → executor | typed invocation (capability id+digest, resolved args, scope), **single-use short-lived scoped credential**, egress-broker handle, budget/timeout | attested evidence: input/output digests, side-effect record, executor workload identity, exit/kill signal |
| Executor → sandbox | immutable input artifact, resource caps, no host mounts | quarantined output artifact (scanned), partial logs/digests on timeout |
| Executor → network | *(only via Egress Broker)* | — |

**Blast radius of a fully compromised executor (recommended split):** cannot read credentials at
rest (broker is control-side; only a single-use, scoped, short-lived lease is present, F-C3);
cannot forge a receipt (signing key never on the executor, E5/F-C4); cannot self-authorise
(PDP/approval control-side, F-C8); cannot reach un-allowlisted network or the management/production
network (Egress Broker + separate netns, `03 §7.3` S3); cannot reach another tenant's work
(per-invocation disposal for untrusted classes; tenant-scoped credentials, `03 §8.2`); cannot
persist to the next invocation (disposal, F-C1/F-C2). Residual exposure a compromised executor
*does* have: the data of the single invocation it is running, the one scoped credential's
authority for that invocation's lifetime, and whatever the egress allowlist permits — all bounded
and receipt-recorded.

**Idempotency / bounded / default-deny (F-C8, F-C10):** the Execution Scheduler owns idempotency
keys + dedup control-side; every invocation carries a hard budget (time/CPU/RAM/output/egress);
absence of a valid policy decision, fresh approval, or reachable receipt store means **deny**
(fail-closed), never silent execution; kill switches (global/tenant/tool/action) fail closed
(`03 §7.1`, `08 §6.2`).

## 5. Lifecycle / sequence (ILLUSTRATIVE — NOT A CONTRACT)

Narrative only; no field names below are a schema, and no contract file is created by this packet.
Consistent with `03 §9.2` (approved response) and accepted ADR-0006 §5 (six-hop paper trace).

1. **Request.** Cyber AI (workload identity, mTLS) sends a typed capability invocation to the
   control-plane Gateway: capability id+version+digest, resolved-arg intent, resource scope, and
   the delegation-chain reference (analyst→agent). Model proposed it; it asserts no authority.
2. **Decide.** PDP evaluates tenant/purpose/target/risk. R0 read → allow; R2/R3 → `REQUIRE_APPROVAL`.
   Dry-run resolves the exact target/parameters.
3. **Approve (side-effecting classes).** Approval Broker emits an approval-required event; a named
   SOC-authenticated approver sees resolved target/params/impact and decides. The decision is
   **digest-bound** to capability + resolved args + policy digest, with TTL; any material change
   invalidates it (`03 §9.2`). *(Cross-product ingress for this hop is the open gap, §2.7.)*
4. **Lease.** On (re-validated) approval, Credential Broker issues a **single-use, scoped,
   short-lived** credential; Egress Broker prepares the allowlisted path. Neither the raw
   delegation token nor a persistent secret reaches the executor.
5. **Execute.** Scheduler dispatches to an executor (attested workload identity) over the
   authenticated channel, with idempotency key + budget. Untrusted-input classes run in a
   **fresh per-invocation disposable sandbox** (S1/S2/S3); R0 may run in a pooled S0 worker when
   policy permits.
6. **Attest.** Executor returns attested evidence (input/output digests, side-effect record, its
   identity). Sandbox is destroyed; partial digests preserved on timeout/kill.
7. **Sign + record.** Control-plane Receipt Ledger **signs** the receipt (referencing policy
   digest, approval id, capability digest, delegation-chain digest, executor identity) and emits
   `…invocation.completed.v1`. The signing key never leaves the control plane.
8. **Fold back.** Cyber AI folds the receipt into the Investigation Bundle; SOC writes any case
   mutation **as the human analyst**, storing `investigation_id`/`receipt_id`.

INFERENCE — Every hop is expressible with the accepted ADR-0006 envelope/identity model plus the
recommended split, inventing no mechanism beyond brokers, disposable executors, and control-plane
signing. Nothing here exists in code. `NOT IMPLEMENTED`.

## 6. RECOMMENDATION (not a decision)

For the Founder decision (Wave 1, GATE A3). None of this accepts ADR-0004; ADR status stays
`PROPOSED`, this packet stays `DRAFT`.

1. **Reject a single-process shipped target.** Option A is rejected as the shipped security model;
   permit it only as a T0 dev-loop shape with untrusted classes disabled (§7).
2. **Boundary = B as the always-on baseline.** A trust-critical **control-plane service**
   (capability registry, PDP, approval/credential/egress brokers, receipt ledger, kill switch) and
   a **separate executor tier** in a distinct trust zone, over an **authenticated mTLS channel** —
   with the boundary **ready for per-invocation disposable executors**. This is the minimum that
   makes ADR-0006 E2/E5 physically true. *(directional; transport is the hedge — §8)*
3. **Executor lifecycle = risk-tiered.** **Disposable per-invocation isolation (C) is mandatory**
   for every class that runs hostile/untrusted input — R1 artifact analysis, R2 active observation,
   R3 mutation-adjacent detonation (S1/S2/S3): a fresh environment per run, destroyed after, no
   host mounts, no cross-invocation residue. **Low-risk R0 read-metadata may use a pooled
   long-lived S0 API worker only when policy permits**; policy may raise but never lower isolation
   (`03 §7.2`). *(reversible-with-cost)*
4. **Identity = SPIFFE-style mTLS** per ADR-0006 E2: each executor carries a workload identity in a
   per-deployment trust domain; the control plane records *which* attested executor ran each step.
   Issuer implementation (SPIRE vs. minimal internal CA) **deferred/measured** (§8).
5. **Credential + egress brokers stay control-side; leases single-use, scoped, short-lived.**
   Executors never hold long-lived credentials or an open egress path: the Credential Broker issues
   one scoped credential per invocation (never the raw delegation token, never returned to the
   model), and all executor egress goes through the Egress Broker (DNS/IP/domain/protocol
   allowlist, proxy, rate/byte caps, no redirect by default). A fully compromised executor reaches
   no credential at rest and no un-allowlisted network (F-C1, F-C3).
6. **Receipts signed by the control plane** per ADR-0006 E5: the executor **attests** evidence
   (inputs, output digests, side-effect record, workload identity) over the authenticated channel;
   the control-plane Receipt Ledger **holds the signing key** and emits the signed, digest-bound
   receipt referencing policy digest, approval id, and delegation chain. The signing key is never on
   an executor. *(fixed by E5)*
7. **Idempotency, bounded execution, default-deny/fail-closed** per `03 §7.1`/`§13` and `08 §6.2`:
   scheduler-owned idempotency + dedup; hard per-invocation budgets; deny on missing policy/approval
   or unreachable receipt store; kill switches fail closed.
8. **Defer measured/among-equivalents choices** to explicit follow-up spikes/decisions (§8): the
   identity **issuer** (SPIRE vs. internal CA), the executor **transport** (authenticated queue vs.
   RPC), the receipt **signing-envelope** (COSE/JWS/in-toto-style), the executor **attestation
   mechanism**, and the sandbox **substrate** (→ ADR-0005). Do not decide these now.
9. **Record the confirmed SOC gap** (§2.7) as an open cross-product dependency, **not** closed by
   this ADR: SOC's SOAR approval run-time state is in-memory/per-process/non-durable, and no
   external Fabric approval ingress and no execution receipts exist in SOC code. A durable,
   digest-bound, cross-product approval ingress/return contract is owed under ADR-0001 later.

Consequences the Founder accepts if following this: a two-tier system to operate (control plane +
executors) plus a sandbox substrate to run everywhere (T0→T2); per-invocation latency on untrusted
classes taken as the price of containment; a standing obligation to keep the signing key and
credentials off executors *by construction*; and an **open** approval-ingress contract that must be
closed — including a durable, digest-bound approval that survives restart, which SOC's current
in-memory gate does not provide — before the `Alert→…→Approval→Receipt→Case` slice can run
end-to-end.

## 7. Rejected alternatives

- **Single-process shipped target (Option A) — rejected** for F-C1/F-C2/F-C4 and direct conflict
  with accepted E5 (a co-resident signer cannot honour "executor attests, control plane signs").
  Retained only as a T0 dev-loop convenience with untrusted classes disabled, never shipped.
- **Executor-side receipt signing — rejected/foreclosed** by accepted ADR-0006 E5; a compromised
  executor holding the signing key defeats receipt integrity (F-C4). Not reopened.
- **Non-SPIFFE / bespoke workload identity — rejected/foreclosed** by accepted ADR-0006 E2. Not
  reopened.
- **Pooled long-lived executors for untrusted-input classes — rejected** for F-C2: cross-invocation
  residue in a shared worker is exactly the untrusted-input risk disposal exists to remove. Pooled
  workers are permitted *only* for R0/S0 no-untrusted-input reads, and only when policy permits.
- **Blanket per-invocation disposal for every class (uniform C) — not recommended** (not
  "rejected" on safety): correct but pays C's latency/operability cost on R0 reads that carry no
  untrusted input and gain no isolation from it (F-C6/F-C7). Risk-tiering dominates.
- **Passing the raw analyst delegation token to the tool backend — rejected** by `03 §8.1`
  (executor receives a broker-issued credential, not the raw token) and the accepted MCP-is-not-a-
  trust-boundary position (ADR-0006).

## 8. Reversible decisions vs. deferred measured gates

- **Reversible-with-cost (decide now, can migrate):** the R0/S0 pooled cut (§6.3) can tighten to
  per-invocation later if measurement demands; migration cost is operational, not architectural.
- **Directional, low reversal cost:** the boundary (§6.2) and control-side broker placement (§6.5)
  — the *boundary* and *control-side brokers* are the hedge; the transport and substrate swap
  behind them.
- **Fixed by accepted ADR-0006 (not reopened here):** the identity *model* (§6.4) and the
  receipt-signing side (§6.6).
- **Deferred measured gates (do NOT decide now — each owed an explicit follow-up spike/decision):**
  1. **Issuer implementation** — SPIRE (full node+workload attestation, higher footprint) vs. a
     minimal internal CA/issuer at T0 (carried from ADR-0006 §2.3). Measure server+agent+
     registration footprint vs. plain-mTLS-with-internal-CA.
  2. **Executor transport** — authenticated message queue vs. request/response RPC against the
     Execution Scheduler (`03 §7.1`). Not benchmarked.
  3. **Receipt signing envelope + executor attestation mechanism** — COSE vs. JWS vs.
     in-toto-style statement; how an executor's attested identity is bootstrapped and verified.
     To be pinned under ADR-0001 D4 when receipts become a contract.
  4. **Sandbox substrate** — gVisor / Firecracker / Kata (or hardened containers) per S1/S2/S3
     profile, and per-invocation startup-latency envelope. This is **ADR-0005**.
  5. **Approval-ingress contract resolution** (the §2.7 gap) — owed under ADR-0001 later.

## 9. Rollout / rollback (PROPOSAL — sequencing only; nothing is built)

- **Contract-first, per ADR-0001.** No executor code before the capability-invocation, receipt,
  and approval-ingress interfaces are drafted as `PROPOSED` contracts and Founder-accepted. This
  packet drafts none.
- **Phase 0 (T0 dev-loop).** Single-host Docker Compose; control plane + one executor **process**
  (Option B shape), untrusted classes disabled; internal CA mTLS. No pooled-vs-disposable
  commitment shipped. Reversible: this is a dev convenience, not the security model.
- **Phase 1 (baseline).** Control-plane service + pooled S0 executor for R0; per-invocation
  disposable S1 for reviewed R1 parsers behind a feature flag. Receipts signed control-side from
  day one (never retrofit signing).
- **Phase 2 (untrusted classes).** S2/S3 disposable executors for R2/R3 once the substrate is
  chosen (ADR-0005). Kill switches and fail-closed paths exercised before any R3 enablement
  (mirrors `08` A4 activation gate: capability/tenant-scoped enablement, not a date).
- **Rollback.** Because R2/R3 default-deny and every side effect is receipt-gated, disabling a tool
  or tier is a policy/kill-switch flip (`03 §7.1`), not a data migration. The pooled→disposable and
  disposable→pooled moves for a given class are config/flag changes; no client contract changes if
  the invocation/receipt contracts are stable (ADR-0001 N-1). A compromised-tier response is a
  tenant/tool/global kill-switch, fail-closed by design.

## 10. Validation plan (how the recommendation would be proven before shipping — none run yet)

- **Blast-radius tests (F-C1/F-C2).** Escape/residue suite from `08 §5.2`/`08 §6.4`: malformed
  file, fork/zip bomb, device/symlink, escape attempts; assert no credential-at-rest reachable, no
  cross-invocation residue on disposable executors, no signing key on the executor.
- **Credential/egress tests (F-C3).** Expired/replay token, credential lifetime ≤ one invocation,
  DNS rebinding / redirect / private-metadata / IPv6 egress attempts blocked by the broker
  (`08 §5.2` egress row).
- **Receipt integrity (F-C4/F-C5).** Tamper a receipt / attested evidence → verification fails;
  confirm signature is control-plane-produced and executor identity is attested, not asserted.
- **Fail-closed (F-C8).** Kill the policy/approval/receipt store → R2/R3 deny; kill switch → deny;
  target measured against `08` control-path SLO (`≤2 s`, fail closed).
- **Idempotency/bounded (F-C10).** Duplicate invocation key → single effect; budget breach → kill +
  partial digest preserved.
- **Latency envelope (F-C6).** Measure per-invocation disposal startup per candidate substrate
  (feeds ADR-0005) and R0 pooled-path latency; confirm the risk-tiered cut is justified by data.
- **Approval-ingress gap (§2.7).** Contract conformance tests do not yet exist because the contract
  does not exist; this is a prerequisite deliverable, not a validation of current code.
- **Status:** all of the above are **planned, not executed**. No harness, executor, or substrate
  exists to run them against. `NOT IMPLEMENTED`.

## 11. Risk register

| # | Risk | Likelihood / impact if unmanaged | Mitigation in the recommendation |
|---|---|---|---|
| RK-1 | Pooled R0 worker later found to touch untrusted input | Med / High (cross-invocation compromise) | Policy may only *raise* isolation; R0/S0 pooling gated on "no untrusted input" and revocable to disposable (F2 reversible, §8). |
| RK-2 | Signing key or credential leaks onto an executor during implementation | Low / Critical (receipt forgery, cred theft) | Key/broker are control-side by construction; validation §10 asserts absence on executor; E5 fixed. |
| RK-3 | SOC in-memory approval state relied on for a cross-product Fabric flow | Med / High (lost approvals on restart; non-durable, non-digest-bound) | Recorded as GAP (§2.7); durable digest-bound approval ingress owed under ADR-0001 before the slice ships. |
| RK-4 | No external Fabric approval ingress → slice cannot run end-to-end | High (today) / High | Surfaced as open cross-product dependency (F7); not claimed closed. |
| RK-5 | Per-invocation disposal latency makes interactive R2 too slow | Med / Med | Risk-tiering keeps R0 hot; substrate latency measured under ADR-0005 before R2/R3 enablement (§10). |
| RK-6 | Substrate choice (ADR-0005) constrains or invalidates the split | Low / Med | Boundary is substrate-agnostic; substrate swaps behind the control-side brokers (§8 directional). |
| RK-7 | Deferred envelope/attestation choices drift into ad-hoc formats | Med / Med | Pinned under ADR-0001 D4 when receipts become a contract; listed as measured gate §8.3. |
| RK-8 | Solo-founder operational load of two tiers + substrate | Med / Med | T0 runs both as processes on one host (F-C7); SOC seeds (§2.6) lower build cost; SPIRE-vs-CA measured (§8.1). |

## 12. GATE A3 — Founder decisions required + draft acceptance text

### 12.1 Decision questions (exact, answerable)

Answer form and recommended answer in the last column. Reversibility per §8. **These questions are
posed for a future GATE A3; this packet does not open or close that gate.**

| # | Question | Form | Recommended |
|---|---|---|---|
| F1 | Reject a **single-process shipped target** (Option A) as the security model — permitting it only as a T0 dev-loop with untrusted classes disabled? | yes/no | **yes** |
| F2 | Boundary = Option **B** baseline: separate control-plane service + executor tier over an authenticated mTLS channel, **ready for per-invocation disposable executors**? | yes/no | **yes** |
| F3 | Executor lifecycle = **risk-tiered**: disposable per-invocation isolation (C) **mandatory** for untrusted-input classes (R1/R2/R3, S1/S2/S3); pooled long-lived **S0** workers allowed for **R0** read-metadata **only when policy permits**? | yes/no | **yes** (reversible) |
| F4 | Identity = **SPIFFE-style mTLS** workload identity per accepted ADR-0006 E2, issuer implementation (SPIRE vs. minimal internal CA) **deferred to a measured spike**? | yes/no | **yes** (E2 fixed; issuer deferred) |
| F5 | Credential + egress **brokers stay control-side**; executors get only **single-use, scoped, short-lived** credentials and broker-mediated egress, never the raw delegation token, never a credential at rest? | yes/no | **yes** |
| F6 | Receipts **signed by the control plane**, executors **attest** (fixed by accepted ADR-0006 E5); signing key never on an executor? | yes/no | **yes** (fixed) |
| F7 | **Idempotency, bounded execution, and default-deny/fail-closed** (kill switch, missing policy/approval/receipt store → deny) are mandatory properties of the split? | yes/no | **yes** |
| F8 | **Defer** the measured/among-equivalents choices — issuer (SPIRE vs. internal CA), executor transport (queue vs. RPC), receipt signing-envelope (COSE/JWS/in-toto-style), executor attestation mechanism, and sandbox substrate (→ ADR-0005) — rather than deciding them now? | yes/no | **yes** |
| F9 | Record the **confirmed SOC gap** (§2.7: in-memory/per-process approval state; no external Fabric ingress; no receipts in SOC code) as an open cross-product dependency owed a durable, digest-bound approval-ingress contract under ADR-0001, and **not** closed by this ADR? | yes/no | **yes** |

### 12.2 DRAFT acceptance text (PROPOSED WORDING ONLY — NOT AN ACCEPTANCE)

The following is *draft* wording a future acceptance record **would** use **if** the Founder
answers F1–F9 as recommended at GATE A3. It is **not** an acceptance, changes **no** status, and
is included only so the Founder can see the exact commitment. Per ADR-0001 D5, any status flip
requires explicit Founder authorization recorded with evidence links; no agent may infer approval.
This packet leaves ADR-0004 `PROPOSED — NOT DECIDED`.

> *(DRAFT — do not apply without a Founder gate.)* "ADR-0004 is `ACCEPTED`. The Founder decided
> F1–F9 at GATE A3 (Wave 1) on `<DATE>`: reject a single-process shipped target (F1); adopt a
> control-plane + isolated-executor baseline ready for per-invocation disposable executors (F2);
> make disposable per-invocation isolation mandatory for untrusted-input classes with pooled S0
> workers permitted for R0 only when policy permits (F3); adopt SPIFFE-style mTLS workload identity
> with the issuer implementation deferred to a measured spike (F4); keep credential/egress brokers
> control-side with single-use, scoped, short-lived leases and no persistent secrets on executors
> (F5); sign receipts in the control plane with executor attestation, signing key never on an
> executor (F6); require idempotency, bounded execution, and default-deny/fail-closed behaviour
> (F7); defer issuer, transport, receipt envelope, attestation mechanism, and sandbox substrate
> (ADR-0005) to explicit follow-up (F8); and record the SOC approval gap as an open cross-product
> dependency owed a contract under ADR-0001 (F9). Status flip applied by an AI agent under explicit
> Founder authorization per ADR-0001 D5; no agent inferred approval. `NOT IMPLEMENTED`: this ADR
> accepts the split *model* only; no control plane, executor, broker, sandbox, issuer, or receipt
> signer exists in code."

## 13. Source register

Primary/official sources only; secondary/marketing sources are inadmissible per README hard rules.
Internal references are repository documents/code read on 2026-07-24.

| ID | Source | Type | Used for | Accessed / read |
|---|---|---|---|---|
| S1 | SPIFFE overview — <https://spiffe.io/docs/latest/spiffe-about/overview/> | Primary (official project) | §2.3 workload identity/attestation | 2026-07-24 |
| S2 | NIST SP 800-207 Zero Trust — <https://csrc.nist.gov/pubs/sp/800/207/final> | Primary (NIST) | §2.3/§4 assume-breach baseline | 2026-07-24 |
| S3 | NIST SP 800-207A — <https://csrc.nist.gov/pubs/sp/800/207/a/final> | Primary (NIST) | §2.3 workload identity | 2026-07-24 |
| S4 | NIST SP 800-190 Application Container Security — <https://csrc.nist.gov/pubs/sp/800/190/final> | Primary (NIST) | §2.4 container isolation guidance | 2026-07-24 |
| S5 | gVisor docs — <https://gvisor.dev/docs/> | Primary (official project) | §2.4 substrate feasibility | 2026-07-24 |
| S6 | Firecracker — <https://firecracker-microvm.github.io/> | Primary (official project) | §2.4 substrate feasibility | 2026-07-24 |
| S7 | Kata Containers — <https://katacontainers.io/> | Primary (official project) | §2.4 substrate feasibility | 2026-07-24 |
| S8 | COSE RFC 9052 — <https://www.rfc-editor.org/rfc/rfc9052> | Primary (IETF) | §2.5 receipt envelope option | 2026-07-24 |
| S9 | JWS RFC 7515 — <https://www.rfc-editor.org/rfc/rfc7515> | Primary (IETF) | §2.5 receipt envelope option | 2026-07-24 |
| S10 | Sigstore docs — <https://docs.sigstore.dev/> | Primary (official project) | §2.5 attestation family | 2026-07-24 |
| S11 | SLSA v1.2 — <https://slsa.dev/spec/v1.2/requirements> | Primary (official project) | §1 F-C9 supply-chain posture | 2026-07-24 |
| I1 | `../../strategy/03-REFERENCE-ARCHITECTURE.md` §7/§8/§9/§13 | Internal doc (`PROPOSAL`) | Module set, risk classes, sandbox profiles, flows, failure modes | read 2026-07-24 |
| I2 | `../../strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` §5/§6 | Internal doc (`PROPOSAL`) | Security controls, threat/escape tests, SLOs | read 2026-07-24 |
| I3 | `../../strategy/02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md` §6/§7 | Internal doc | Identity/zero-trust + supply-chain standards crosswalk | read 2026-07-24 |
| I4 | Accepted [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md) E2/E3/E5 | Internal ADR (`ACCEPTED`) | Fixed identity/receipt model | read 2026-07-24 |
| I5 | Accepted [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md) D4/D5 | Internal ADR (`ACCEPTED`) | Format pins, acceptance mechanics | read 2026-07-24 |
| I6 | [ADR-0005](../ADR-0005-sandbox-substrate.md) | Internal ADR (`PROPOSED`) | Substrate decision boundary | read 2026-07-24 |
| C1 | `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/soar/{engine,api,runtime,orm,audit,playbook}.py` | Cross-repo code state | §2.6/§2.7 approval-gate seed + in-memory gap | read 2026-07-24 |
| C2 | `cybrik-soc-command-center:services/api/src/cybrik_soc/platform/{outbound,secrets,signing}.py` | Cross-repo code state | §2.6 egress/credential seeds; webhook scope | read 2026-07-24 |
| C3 | `cybrik-soc-command-center:docs/architecture/INDEX.md:104,106` | Cross-repo doc (`PROPOSED`) | §2.7 only mention of Fabric/receipt is PROPOSED | read 2026-07-24 |

## 14. Evidence limitations / carried unknowns

1. **Issuer implementation** — SPIRE vs. a minimal internal CA/issuer at T0 was not measured
   (carried from ADR-0006 §2.3). `UNKNOWN`.
2. **Executor transport** — queue vs. RPC against the scheduler not benchmarked. `UNKNOWN`.
3. **Receipt signing envelope + executor attestation mechanism** — COSE/JWS/in-toto-style not
   selected or prototyped; attestation bootstrap not designed. `UNKNOWN`.
4. **Sandbox substrate + per-invocation startup latency** — gVisor/Firecracker/Kata/hardened
   containers per S1/S2/S3 not chosen or measured; this is **ADR-0005**. `UNKNOWN`.
5. **SOC external-approval ingress + durable digest-bound approval** — no accepted cross-product
   contract exists (§2.7); a dependency owed under ADR-0001, unresolved here. `UNKNOWN`.
6. **External claims** were verified against the official pages/specs listed in the source register
   via their published content on 2026-07-24 (SPIFFE, NIST SP 800-207/207A/190, gVisor, Firecracker,
   Kata, COSE RFC 9052, JWS RFC 7515, Sigstore, SLSA). Substrate **licenses** (each stated
   Apache-2.0) should be re-opened `LICENSE`-by-`LICENSE` before any spike or contract; no substrate
   was installed, built, or benchmarked here.
7. **SOC code citations** (§2.6/§2.7, source register C1–C3) are existing state in another
   repository, read read-only on 2026-07-24 as a design seed and to record a gap — **not** a claim
   of Tool Fabric capability. The SOC SOAR gate is implemented and test-covered *in the SOC repo*;
   nothing in `cybrik-security-tool-fabric` is.
8. **Nothing in the suite is implemented.** No control plane, executor, broker, sandbox, identity
   issuer, or receipt signer is built, wired, or piloted in `cybrik-security-tool-fabric` — it is a
   documentation-only scaffold. `NOT IMPLEMENTED`. This packet is research + proposal + a
   recommendation; it accepts nothing.
