# ADR-0005 Evidence Packet — Sandbox substrate

- Status: `DRAFT` — recommendation only. Backs a `PROPOSED — NOT DECIDED` ADR; this packet
  informs a decision, it does not make one. Nothing in the suite is implemented, verified, or
  piloted; `cybrik-security-tool-fabric` is a documentation-only scaffold and no sandbox,
  substrate, executor, or isolation control plane exists in any repository.
- Date: 2026-07-24
- Backs: [ADR-0005](../ADR-0005-sandbox-substrate.md)
- Wave / gate: **Wave 2**; feeds **GATE A4** (see [ADR-DECISION-SPRINT-2026-07.md](../ADR-DECISION-SPRINT-2026-07.md)
  §3 wave board). **GATE A4 is NOT open.** This is read-ahead Wave 2 research. GATE A3 closed
  2026-07-24 with ADR-0002/ADR-0004 accepted as recommended; ADR-0003/ADR-0005 remain
  `PROPOSED — NOT DECIDED`.
- Scope: `cybrik-security-tool-fabric` sandbox control plane — the **isolation substrate** that
  backs the five sandbox profiles the strategy already names (S0–S4, `03 §7.3`): which isolation
  technology class is the *floor* for each profile, the network/egress posture per profile,
  artifact handling (immutable input, quarantined output), fail-closed behaviour when required
  isolation is unavailable, and portability across deployment tiers (T0 single host → T2
  air-gap). It does **not** re-decide the control-plane/executor split, the identity/receipt
  model, or capability risk classes — those are ADR-0004 (accepted) / ADR-0006 (accepted) /
  `03 §7.2`.
- Inherits (accepted, not re-decided here): the workload-identity + receipt-signing **model**
  is fixed by [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md) — SPIFFE-style
  workload identity + mTLS, delegation as digest-bound grants embedded in receipts, and **the
  control plane signs receipts while executors attest** (E5). Contract/format pins of anything
  named here inherit [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md) (D4). The
  process/trust **boundary** (control plane vs. executor tier) is [ADR-0004](../ADR-0004-tool-fabric-control-plane-executor-split.md),
  which was **`ACCEPTED` at GATE A3 on 2026-07-24**. This packet chooses the substrate behind
  that accepted executor-tier boundary; it does not re-open the split.
- Prepared by: orchestrator, under Founder delegation of overnight technical research (Wave 2
  read-ahead). **Produces a recommendation for a future Founder decision; it accepts nothing.**
  ADR acceptance is a Founder gate (ADR-0001 D5 mechanics); no agent may infer approval.

## 0. Source-labelling key

Per [evidence/README.md](README.md) and sprint §6: `FACT` (verified against the primary source
cited), `RESEARCH` (summarized from a primary/official source via its published page/repo/spec,
not independently reproduced/built here), `PROPOSAL` (our position, ours to defend), `INFERENCE`
(reasoning from labelled facts; could be wrong), `UNKNOWN` (open question; material ones appear
in the Founder decision list). Every external claim cites a primary/official URL with an
**access date**. All external URLs in this packet were accessed **2026-07-24**. Internal
cross-repo references use `repo:path` form and are code/doc state **as read on 2026-07-24**, not
a claim of implemented suite capability. `NOT IMPLEMENTED` is stated explicitly wherever a
mechanism is described.

## 1. Decision criteria (constraints)

Stated before scoring. Drawn from `../../strategy/03-REFERENCE-ARCHITECTURE.md` §7.2/§7.3/§10/§13,
`../../strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` §5/§6.4/§6.5/§8, `../../strategy/02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md`
§9, and the accepted ADR-0006 identity/receipt model. Options are scored against these and only
these.

| # | Criterion | Why it matters |
|---|---|---|
| SB-C1 | Containment strength matched to input hostility | The substrate must be at least as strong as the worst input a profile admits: no untrusted input (S0/S4) vs. reviewed parser over hostile *data* (S1) vs. execution of hostile *code/binary* (S2) vs. attacker-controlled *network traffic* (S3). Weaker-than-required isolation for a hostile tier is the defining failure (`03 §7.3`, `08 §6.4`). |
| SB-C2 | Disposability / no cross-invocation residue | Untrusted-input runs must occur in a per-invocation environment destroyed after use, with no state surviving to the next invocation and no host mount (`03 §7.3` S2 "disposable filesystem, no host mounts", `03 §13` sandbox-timeout → kill disposable workload). |
| SB-C3 | Default-deny egress + network isolation | Egress is deny-by-default and broker-mediated; S3 runs in a separate network namespace with no route to management/production networks; DNS/IP/redirect/metadata attacks are blocked at the broker, not the tool (`03 §7.3` S3, `08 §5` egress row, `08 §6.4`). |
| SB-C4 | Host/kernel attack-surface reduction & escape resistance | The substrate must reduce the host-kernel syscall surface reachable by the workload and resist the escape suite (`08 §5` sandbox-escape row, `08 §6.4` no privileged / read-only root / non-root / seccomp/AppArmor). |
| SB-C5 | Fail-closed when required isolation is unavailable | If a profile's required substrate cannot be provisioned (kernel/KVM/hypervisor absent, jailer unavailable), the invocation must **deny**, never silently down-tier to weaker isolation (`03 §13`, `08 §6.2` deny-by-default). |
| SB-C6 | Startup latency / density / teardown cost | Per-invocation disposal costs cold-start and scheduling; the substrate mix must keep cheap S0/S4 paths hot while paying isolation cost only where hostility requires it (ADR-0004 F-C6; `08 §8` R0 p95 ≤2 s, receipt ≤5 s). |
| SB-C7 | Portability T0→T2 incl. on-prem K8s & air-gap | Same security semantics from a single-host T0 to conformant-Kubernetes T1 to air-gapped T2 — no profile that only works in a managed cloud (`03 §10`, `08 §8` T2 offline; `07 §5` minimal-tech). |
| SB-C8 | License / supply-chain / offline verify | Every substrate shipped into an air-gapped customer must be permissively licensed, offline-installable, and offline-verifiable (SBOM/provenance) (`02 §9`, `08 §6.5`, `03 §10` T2). |
| SB-C9 | Resource caps & bounded execution | Hard CPU/RAM/PID/time/disk/output caps per invocation, enforced by the substrate + scheduler, so a runaway or hostile tool cannot amplify effect (`08 §6.4`, `03 §7.1` Execution Scheduler). |
| SB-C10 | Host/kernel/hypervisor patch & CVE posture | The substrate's own update posture (guest kernel, VMM, user-space kernel, container runtime) must have a patch SLO and anti-rollback/version floor for security fixes (`08 §6.4` patch SLO, `08 §6.5` version floor; CRA operational readiness `08 §11`). |
| SB-C11 | Artifact handling without host contamination | Input artifact immutable; output artifact quarantined and malware-scanned before it reaches the store; nothing written to the host or any repository (`03 §7.1` Artifact Store, `03 §7.3`, `08 §6.4` input immutable/output quarantined). |
| SB-C12 | Solo-founder operability | One founder must be able to run, observe, and patch the substrate on one host at T0 and scale it without a *different* security model at T1/T2 (`03 §1.8`, `07 §5`). |

## 2. Current-state evidence

### 2.1 What the strategy already fixes (internal baseline — RESEARCH from internal docs, not a decision)

- RESEARCH — **Sandbox profiles are pre-named** (`../../strategy/03-REFERENCE-ARCHITECTURE.md`
  §7.3): **S0** API-only (no untrusted input); **S1** restricted container (read-only rootfs,
  non-root, seccomp/AppArmor, no network, CPU/RAM/time/output caps) for reviewed parsers/
  scanners; **S2** microVM (disposable filesystem, no host mounts, controlled artifact channel)
  for untrusted file/binary/code detonation/complex analysis; **S3** controlled network lab
  (separate network namespace, egress via broker, no route to management/production network) for
  PCAP replay / active observation; **S4** response executor (no file input; typed vendor API
  with short-lived credential + policy + approval + rollback). Explicit rule: **"Không chạy raw
  file/PCAP trong AI process hoặc SOC API process"** (never run raw file/PCAP in the AI process
  or SOC API process).
- RESEARCH — **Capability risk classes** are pre-defined (`03 §7.2`): **R0** read metadata (API
  worker, no approval); **R1** analyse artifact (no-network sandbox, quota); **R2** active
  observation (egress allowlist, optional approval); **R3** reversible mutation (named approver,
  TTL/rollback); **R4** destructive/irreversible (**hard-denied to agents in 1.x**). "Risk class
  chỉ là upper bound" — policy may raise but never lower isolation.
- RESEARCH — **Sandbox control requirements** (`08 §6.4`): untrusted artifact never runs in the
  SOC/Cyber AI/Fabric **API** process; no privileged containers; read-only root; non-root;
  seccomp/AppArmor; **S2 microVM for high-risk binary/code**; separate network namespace;
  deny-egress by default; CPU/RAM/process/time/disk/output limits; immutable input; quarantined/
  scanned output; disposable worker + secure cleanup; **host/kernel/hypervisor patch SLO**.
- RESEARCH — **Escape/egress test intent already catalogued** (`08 §5`): sandbox escape/resource
  abuse → "Malformed file, fork/zip bomb, device/symlink, escape suite"; egress/exfiltration →
  "DNS rebinding, redirect, IPv6/private metadata, covert large output"; token/credential leak →
  "expired/replay token"; the File/PCAP safety eval suite (`08 §3.1` #9) requires malformed
  files, archive bombs, parser crashes, huge flows, evasions.
- RESEARCH — **Failure posture** (`03 §13`): sandbox timeout → kill disposable workload, preserve
  partial logs/digests; R2/R3 fail closed when audit/receipt store unavailable; kill switch fails
  closed (`03 §7.1`). **Deployment tiers** (`03 §10`): T0 Docker Compose single host; T1
  conformant Kubernetes; T2 sovereign/air-gap with a "sandbox zone" and offline verification.
- INFERENCE — The strategy fixes **what the profiles are** and **that isolation is tiered by input
  hostility**; it does **not** name the concrete substrate that provides each profile, nor the
  per-invocation cold-start envelope, nor the fail-closed-vs-down-tier rule. That is **this ADR**.

### 2.2 Accepted / proposed boundaries this packet must honour (not re-decide)

- FACT — Accepted [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md): the suite
  uses a **SPIFFE-style workload identity** model (per-deployment trust domain, short-lived mTLS
  credentials), and the **control plane signs receipts while executors attest** (E5). The
  identity **issuer implementation** (SPIRE vs. a minimal internal CA) is explicitly left open.
- FACT — [ADR-0004](../ADR-0004-tool-fabric-control-plane-executor-split.md) was
  **`ACCEPTED` at GATE A3 on 2026-07-24**. Its evidence packet
  ([ADR-0004-EVIDENCE.md](ADR-0004-EVIDENCE.md) §2.4, §8.4) explicitly defers the substrate
  choice to ADR-0005 and requires a disposable per-invocation boundary for untrusted classes.
  This packet supplies the substrate recommendation and does not re-open ADR-0004's split.
- INFERENCE — Two things are therefore fixed *around* ADR-0005, not by it: (a) the credential,
  egress, policy, approval and receipt-signing brokers stay **control-side** (accepted ADR-0004 +
  ADR-0006 E5), so **the substrate never holds a signing key or a long-lived secret** — it runs
  tool logic and hostile input only; (b) each executor/sandbox must be able to present an
  **attestable workload identity** (ADR-0006), which constrains substrate choice only weakly
  (all candidates can carry an mTLS identity via the executor process that launches them).

### 2.3 Current code/doc state — repository-qualified (FACT; a gap, not a capability)

- FACT (code/doc state, read 2026-07-24) — **`cybrik-security-tool-fabric` has no source at all.**
  The repository is a documentation-only scaffold: its tracked files are `README.md`, `AGENTS.md`,
  `CLAUDE.md`, `SECURITY.md`, and `docs/*/README.md` placeholders (`docs/architecture/README.md`,
  `docs/security/README.md`, `docs/operations/README.md`, etc.); `src/README.md` is a placeholder
  with **no code under `src/`**. No sandbox, executor, substrate driver, jailer profile, or
  isolation control plane exists. `NOT IMPLEMENTED`.
- FACT (code state, `cybrik-soc-command-center`, read 2026-07-24) — **No isolation-substrate code
  exists in SOC either.** A source grep for `gvisor|firecracker|kata|microvm|runsc|detonat|seccomp`
  over `services/**/*.py` returns **zero hits**. Every occurrence of the string `sandbox` in SOC
  source (e.g. `services/api/tests/**`, `services/api/scripts/perf_queue_10k.py:12`) refers to the
  **CI/test execution environment** ("chạy trong sandbox py3.10"), **not** a security-isolation
  substrate. There is no file/PCAP detonation code anywhere in the suite.
- FACT (code state, SOC) — the **only** substrate-adjacent SOC seeds are the ones ADR-0004's
  packet already records for the *brokers*, not for isolation: `cybrik-soc-command-center:services/api/src/cybrik_soc/platform/outbound.py`
  (allow-listed outbound guard — a seed for the Fabric **Egress Broker**, relevant to SB-C3) and
  `.../platform/secrets.py` (`secret_ref` resolution — a seed for the **Credential Broker**).
  These are control-side broker seeds, **not** sandbox isolation; the isolation substrate has no
  seed in any repo.
- INFERENCE — There is **nothing to benchmark against today**. Every substrate claim below is
  RESEARCH from the vendors' primary docs plus INFERENCE/PROPOSAL; **no substrate was installed,
  built, configured, or measured in preparing this packet.** `NOT IMPLEMENTED`.

## 3. Boundary vs. ADR-0006 / ADR-0004 / ADR-0003

INFERENCE throughout, from §2.2 and the ADRs cited. Drawing the boundary keeps this packet from
straying into decisions it does not own.

| Neighbouring ADR | Owns | ADR-0005 (this) owns | Interface / non-overlap |
|---|---|---|---|
| **ADR-0006** (`ACCEPTED`) | Identity **model** (SPIFFE-style mTLS), receipt-signing side (control plane signs, executor attests), delegation-as-digest-bound-grants. | Nothing about identity or signing. | The substrate must let the launching executor present an mTLS workload identity; the substrate is **not** a trust boundary substitute for control-side signing. A microVM does **not** move signing into the guest (E5 unchanged). |
| **ADR-0004** (`ACCEPTED` 2026-07-24) | The process/trust **boundary** (control plane vs. executor tier), executor lifecycle *policy* (pooled vs. disposable), where brokers live. | *Which isolation technology* provides each sandbox profile the lifecycle demands, and the per-profile network/artifact/fail-closed posture. | ADR-0004 says "a disposable per-invocation boundary must exist"; ADR-0005 says "for S2 that boundary is a Firecracker microVM," etc. The substrate mapping implements the accepted boundary without re-opening it. |
| **ADR-0003** (`PROPOSED`, Wave 2 sibling) | Durable **agent-orchestration** runtime/state machine/checkpoint (Cyber AI side). | The **tool-execution sandbox** substrate (Tool Fabric side). | Disjoint: the orchestrator (ADR-0003) requests capabilities via the Fabric Gateway and **never runs tools in-process** (`03 §6.2` "Tool call chỉ qua Fabric"). Orchestration state is not sandbox state; no coupling. |

- INFERENCE — The clean statement: **ADR-0005 chooses the isolation floor per sandbox profile and
  the network/artifact/fail-closed posture; it changes no identity, signing, split, or
  orchestration decision.** It is deliberately *substrate-agnostic at the boundary* so a substrate
  can be swapped behind the control-side brokers without a contract change (ADR-0004-EVIDENCE §8
  "substrate swaps behind the control-side brokers").

## 4. Primary-source research (all accessed 2026-07-24)

Primary/official sources only. Secondary/marketing sources are inadmissible per README hard rules.

### 4.1 gVisor (user-space application kernel)

- FACT — gVisor positions itself as "an application kernel, **not** a virtual machine hypervisor
  or a system call filter," giving "VM-like security benefits without VM overhead": the **Sentry**
  runs in user space as a Go-implemented kernel, intercepts syscalls and page faults, and an
  attacker "would need to exploit both the gVisor Sentry and the host kernel," which "do not share
  any code." It ships as an OCI runtime, **`runsc`**, usable from Docker/Kubernetes.
  <https://gvisor.dev/docs/architecture_guide/intro/> (2026-07-24)
- FACT — Security model: **"No system call is passed through directly to the host"**; the host
  surface exposed to the Sentry is minimized (Gofer for filesystem, a minimal host syscall set,
  no socket-create/file-open by default). Explicit **limitations**: **"gVisor does not provide
  protection against hardware side channels"**, it **"relies on the host operating system and the
  platform for defense against hardware-based attacks,"** network policy "should be applied at the
  container level," and **"A sandbox is not a substitute for a secure architecture."**
  <https://gvisor.dev/docs/architecture_guide/security/> (2026-07-24)
- FACT — Platforms: **`systrap` replaced `ptrace` as the default platform in mid-2023** (ptrace is
  "no longer supported"); systrap uses `seccomp`'s `SECCOMP_RET_TRAP`/`SIGSYS`; **KVM** uses
  virtualization extensions and "runs best on bare-metal," while inside a nested VM "the `systrap`
  platform will often provide better performance … due to the overhead of nested virtualization."
  <https://gvisor.dev/docs/architecture_guide/platforms/> (2026-07-24)
- FACT — Networking: gVisor's default is its own user-space stack **netstack**, which "enforce[s]
  a strong isolation boundary"; `--network=host` "trades the security and isolation of netstack
  for the performance of native Linux networking."
  <https://gvisor.dev/docs/architecture_guide/networking/> (2026-07-24)
- FACT (license, re-verified from the master `LICENSE` file per Founder instruction) — the gVisor
  repository's primary license is **Apache License, Version 2.0**; the same `LICENSE` file notes
  that some individual files carry MIT or BSD licenses. <https://github.com/google/gvisor/blob/master/LICENSE>
  (2026-07-24). INFERENCE — permissive, air-gap-installable (SB-C8), with a per-file license scan
  owed before any spike.

### 4.2 Firecracker (KVM microVM VMM)

- FACT — Host prerequisites: **"Firecracker requires read/write access to `/dev/kvm` exposed by
  the KVM module"** and **"supports x86_64 and aarch64 Linux."** A microVM boots an uncompressed
  guest kernel + rootfs configured over an API socket.
  <https://github.com/firecracker-microvm/firecracker/blob/main/docs/getting-started.md> (2026-07-24)
- FACT — Production host setup: Firecracker **"must be started using the `jailer` binary … or
  executed under process constraints equal or more restrictive"**; **"By default, Firecracker uses
  the most restrictive [seccomp] filters, which is the recommended option for production usage"**
  (`--no-seccomp` not recommended); host/guest kernels **and microcode** "must be regularly
  patched"; swap should be disabled. Security boundary: **"Firecracker is designed to provide
  isolation boundaries between microVMs running in different Firecracker processes … each
  Firecracker process corresponds to a workload of a single tenant."** Explicit limits:
  **"Firecracker is not able to mitigate host's hardware vulnerabilities"** and it **"does not
  perform network traffic filtering."** Multi-tenant side-channel guidance: disable SMT, disable
  Kernel Samepage Merging, DDR4+TRR+ECC memory, follow vendor advisories.
  <https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md> (2026-07-24)
- FACT — Jailer isolation primitives: it "isolate[s] the Firecracker process" via mount namespace
  (`unshare()`), optional PID namespace (`CLONE_NEWPID`), optional network namespace (`setns()`),
  `pivot_root()`/chroot into `<chroot_dir>`, cgroup v1/v2 resource limits, privilege drop
  (`uid`/`gid`), `setrlimit()` bounds, and `mknod` of `/dev/net/tun` + `/dev/kvm` inside the jail.
  <https://github.com/firecracker-microvm/firecracker/blob/main/docs/jailer.md> (2026-07-24)
- RESEARCH — Firecracker is Apache-2.0 (its official repository); license re-verify owed per
  `LICENSE` before a spike (SB-C8). INFERENCE — because Firecracker **does not filter network
  traffic**, the S3 network lab needs the separate netns **plus the control-side Egress Broker**
  to satisfy SB-C3 — the microVM boundary alone does not enforce egress policy.

### 4.3 Kata Containers (VM behind an OCI/CRI interface)

- FACT — Kata builds "lightweight virtual machines that seamlessly plug into the containers
  ecosystem," giving "stronger workload isolation using **hardware virtualization technology as a
  second layer of defense**," each workload in "its own dedicated kernel." It supports the **OCI**
  container format and **Kubernetes CRI**, and multiple hypervisors — **QEMU, Cloud-Hypervisor,
  and Firecracker**. <https://katacontainers.io/> (2026-07-24)
- INFERENCE — Kata is the **Kubernetes portability wrapper**: a `RuntimeClass` selects Kata, and
  Kata-with-Firecracker gives the same microVM boundary as direct Firecracker but behind the
  standard container interface — so S2/S3 can ship on a conformant-Kubernetes T1/T2 without a
  different security model (SB-C7). At T0 (single host, Docker Compose) direct Firecracker + jailer
  avoids the Kubernetes dependency.

### 4.4 Hardened rootless OCI containers (S0/S4 floor)

- FACT — Docker rootless mode "executes the Docker daemon and containers inside a **user
  namespace**," to "mitigate potential vulnerabilities in the daemon and the container runtime,"
  and "does not use binaries with `SETUID` bits … except `newuidmap`/`newgidmap`."
  <https://docs.docker.com/engine/security/rootless/> (2026-07-24)
- FACT — The default Docker **seccomp** profile is an allowlist (`defaultAction` `SCMP_ACT_ERRNO`)
  that "disables around 44 system calls out of 300+," "moderately protective while providing wide
  application compatibility"; "It is not recommended to change the default `seccomp` profile."
  <https://docs.docker.com/engine/security/seccomp/> (2026-07-24)
- FACT — Rootless **limitations**: cgroup resource flags (`--cpus`, `--memory`, `--pids-limit`)
  "supported only when running with cgroup v2 and systemd" (otherwise "rootless mode ignores the
  cgroup-related `docker run` flags"); by default only `memory`/`pids` controllers are delegated;
  "ping does not work by default" on some distros; ports <1024 need extra capability config; "The
  data dir should not be on NFS"; running as a systemd-wide service is unsupported.
  <https://docs.docker.com/engine/security/rootless/tips/> (2026-07-24)
- INFERENCE — Rootless OCI (non-root, read-only rootfs, default-deny seccomp, `no-new-privileges`,
  dropped caps) is adequate **only** where **no untrusted code and no untrusted file** run — i.e.
  S0 (API-only) and S4 (typed vendor API, no file input). It shares the host kernel, so it is
  **not** an acceptable floor for S1/S2/S3 (SB-C1/SB-C4). The cgroup-v2+systemd caveat is a real
  SB-C9 constraint to pin (resource caps silently ignored otherwise → must fail closed, not run
  uncapped).

### 4.5 Standards baseline (RESEARCH from internal crosswalk + NIST)

- RESEARCH — `03 §7.3`/`08 §6.4` map directly onto NIST SP 800-190 (Application Container Security
  Guide) container-isolation controls (kernel sharing, no privileged, least privilege, image
  provenance), cited by ADR-0004-EVIDENCE §2.4. The suite's identity/zero-trust baseline (SPIFFE,
  NIST SP 800-207 assume-breach) is fixed by ADR-0006; `02 §9` pins SPIFFE/mTLS, SBOM (SPDX/
  CycloneDX) and SLSA provenance as P0/P1 — all offline-verifiable (SB-C8).

## 5. Profile / substrate / tier matrix (PROPOSAL)

The **substrate is an isolation *floor* keyed to the sandbox profile** (the input-hostility band),
not a 1:1 with the risk class; policy may only ever *raise* isolation (`03 §7.2`). The risk-class
column shows the *primary* class the strategy pairs with each profile — the exact capability→
profile binding is a Capability Registry / PDP policy decision owed to ADR-0004 (see §14, UNKNOWN).

| Profile | Primary risk class | Untrusted input | **Substrate floor (PROPOSAL)** | Lifecycle | Network | Rationale (labelled) |
|---|---|---|---|---|---|---|
| **S0** API-only | R0 read metadata | none | **Hardened rootless OCI** (non-root, read-only rootfs, default-deny seccomp, no-new-privileges, dropped caps) | **Pooled** long-lived allowed **only when policy permits** | Egress via broker only | INFERENCE §4.4 — no untrusted code/file runs; shared kernel acceptable; pooling buys SB-C6 latency at no SB-C1 cost. |
| **S1** restricted container | R1 analyse artifact (reviewed parser/scanner over hostile *data*) | data only | **gVisor `runsc`** (systrap default), **no-network**, **disposable** | **Per-invocation disposable** | **None** (netstack, no host net) | FACT §4.1 — user-space kernel removes direct host-syscall passthrough for a reviewed parser handling hostile bytes; SB-C2/SB-C4. |
| **S2** microVM | R2 (hostile *code/binary* detonation) | executable code | **Firecracker microVM (via jailer)**, disposable; gVisor allowed as **defense-in-depth inside**, **never the sole boundary** | **Per-invocation disposable** | **None by default** | FACT §4.2 — dedicated guest kernel + KVM boundary for the most hostile tier; PROPOSAL that gVisor-only is insufficient here (see §6, §7). |
| **S3** controlled network lab | R2/R3 (PCAP replay / active observation over attacker-controlled traffic) | network traffic | **Firecracker microVM + separate netns + control-side Egress Broker** | **Per-invocation disposable** | **Broker-mediated allowlist only**; **no route to mgmt/prod** | FACT §4.2 (Firecracker "does not perform network traffic filtering") ⇒ microVM boundary **plus** netns+broker; SB-C3. |
| **S4** response executor | R3 reversible mutation | none (typed vendor API, no file) | **Hardened rootless OCI** | **Pooled** allowed | Broker egress to the approved vendor API | INFERENCE §4.4 — no file/code detonates; the risk is *authority/side-effect*, handled control-side by policy/approval/credential broker (ADR-0004), not by heavier isolation. |
| — | **R4** destructive | — | **DENIED to agents in 1.x** (`03 §7.2`) — no substrate provisioned | — | — | RESEARCH `03 §7.2` — hard deny; not a substrate question. |

Deployment-tier portability (SB-C7):

| Tier (`03 §10`) | S0/S4 | S1 | S2 / S3 |
|---|---|---|---|
| **T0** single host / Docker Compose | rootless OCI | `runsc` runtime | **direct Firecracker + jailer** (needs `/dev/kvm`) |
| **T1** conformant Kubernetes | rootless OCI | `runsc` via RuntimeClass | **Kata `RuntimeClass` (Firecracker/Cloud-Hypervisor backend)** |
| **T2** sovereign / air-gap | rootless OCI (offline image) | `runsc` (offline) | Kata/Firecracker (offline; separated "sandbox zone" `03 §10`) |

- PROPOSAL — **Kata is the K8s portability wrapper for S2/S3** (T1/T2); **direct Firecracker+jailer
  is the T0 path**. Same microVM security model at every tier (SB-C7); only the packaging differs.

## 6. Security / escape / egress / failure analysis

INFERENCE/PROPOSAL throughout, reasoned from §4 primary sources and §1 criteria; **no capability
exists**.

**Why the floor rises with hostility (SB-C1/SB-C4).**
- S0/S4 run **no untrusted code or file**, so a shared-kernel hardened container is the correct
  floor — heavier isolation buys nothing (INFERENCE §4.4).
- S1 runs a **reviewed** parser over **hostile data**. gVisor removes direct host-syscall
  passthrough (FACT §4.1 "No system call is passed through directly to the host"), which is the
  right strength for a parser-crash / malformed-file threat, at container-like cost.
- S2 **executes hostile code**. Here the conservative PROPOSAL: **a hardware-virtualization
  (KVM/microVM) boundary is the mandatory floor**, because a hostile binary that compromises a
  user-space Sentry is then one **host-kernel** bug from escape (gVisor and the host kernel "do
  not share any code," but the Sentry still runs on the host kernel via systrap), and gVisor
  **explicitly disclaims** hardware-side-channel and hardware-attack defense (FACT §4.1). A
  Firecracker guest has its **own kernel** behind KVM (FACT §4.2/§4.3). gVisor markets itself as
  safe "to run untrusted code" (FACT §4.1) — our requirement of a microVM floor for the *most
  hostile* detonation tier is a **defense-in-depth PROPOSAL that is stricter than gVisor's own
  claim**, not a claim that gVisor is broken; gVisor may still run **inside** the microVM as a
  second layer, but is **never the sole S2 boundary**.
- S3 handles **attacker-controlled network traffic**. Firecracker **"does not perform network
  traffic filtering"** (FACT §4.2), so the microVM boundary is combined with a **separate network
  namespace + control-side Egress Broker** for DNS/IP/redirect/metadata/IPv6 control (SB-C3).

**Escape suite (SB-C4, from `08 §5`/`08 §6.4`).** Malformed file, fork/zip bomb, device/symlink,
resource-exhaustion, and substrate-specific escape attempts must be run against each profile's
substrate; assert no host mount reachable, no cross-invocation residue on disposable profiles
(SB-C2), and that S2/S3 survive a guest-kernel compromise without host reach (KVM boundary holds).

**Egress / exfiltration (SB-C3, from `08 §5`).** DNS rebinding, HTTP redirect, IPv6/link-local,
cloud-metadata (`169.254.169.254`), and covert-large-output attempts must be blocked at the Egress
Broker; S1/S2 default to **no network**; S3 permits only the broker allowlist and has **no route
to management/production** networks.

**Failure / fail-closed (SB-C5, from `03 §13`/`08 §6.2`).** See §10 — the load-bearing rule is
that a profile whose required substrate cannot be provisioned **denies**, never down-tiers.

**Residual exposure of a fully compromised sandbox (recommended mapping):** the single invocation's
data; the one scoped single-use credential's authority for that invocation's lifetime (broker-
issued, never a signing key — E5); and whatever the egress allowlist permits — all bounded,
disposed after use, and receipt-recorded. **Not** reachable: credentials at rest, the signing key,
other invocations/tenants, or the management/production network. This is identical to
ADR-0004-EVIDENCE §4's blast-radius claim and depends on the substrate only for the *disposal +
kernel-boundary* half of it.

## 7. Recommendation and counterargument

### 7.1 RECOMMENDATION (not a decision)

For a **future** Founder decision at GATE A4 (which is **not open**). None of this accepts
ADR-0003 or ADR-0005; both stay `PROPOSED`, and this packet stays `DRAFT`. ADR-0002/ADR-0004
are already accepted and are not re-opened.

1. **Adopt the risk-tiered substrate mapping of §5**, not a single substrate: the isolation floor
   rises with input hostility (S0/S4 → hardened rootless OCI; S1 → gVisor `runsc`; S2 → Firecracker
   microVM; S3 → Firecracker microVM + netns + Egress Broker; R4 denied).
2. **Hardened rootless OCI for S0/R0 (pooled, API-only) and S4/R3 (typed response executor, no file
   input)** — non-root, read-only rootfs, default-deny seccomp, no-new-privileges, dropped caps.
3. **gVisor `runsc` for S1/R1** reviewed parsers/scanners, **disposable per-invocation, no-network
   by default**.
4. **Firecracker microVM as the mandatory floor for S2/R2 hostile code/binary detonation**; gVisor
   permitted as **defense-in-depth inside** the microVM but **never the sole S2 boundary**.
5. **Firecracker microVM + separate netns + control-side Egress Broker for S3/R2** controlled
   network / PCAP isolated lab; no route to management/production.
6. **R4 denied** to agents in 1.x (no substrate provisioned).
7. **Kata `RuntimeClass` is the Kubernetes portability wrapper for S2/S3** at T1/T2; **direct
   Firecracker + jailer** is the T0 path — same microVM security model at every tier.
8. **Fail closed on missing required isolation** for S1/S2/S3; S2/S3 **never** fall back to
   gVisor-only or OCI-only; **raw file/PCAP never executes in an API or host process** (`03 §7.3`).
9. **macOS is dev-loop-only** (§11): S0/S4 and a *functional* gVisor S1 run inside a Linux VM;
   S2/S3 run only on a Linux host/CI with `/dev/kvm`. No native macOS security parity is claimed.
10. **Defer all measured kernel/hardware choices** (§13) to a Linux benchmark + escape-test spike:
    guest-kernel build/hardening, Firecracker jailer profile, gVisor systrap-vs-KVM platform, Kata
    hypervisor, CPU architecture, nested-virtualization posture, and patch/version floors.

Consequences the Founder would accept if following this: **three** substrate technologies to
operate and patch (rootless OCI, gVisor, Firecracker/Kata) instead of one; a hard **Linux+KVM
dependency** for the S2/S3 tiers (no native macOS/Windows parity); per-invocation cold-start
latency on S1/S2/S3 taken as the price of containment; and a standing obligation to keep guest
kernels, the VMM, and the container runtime patched to a security **version floor** (SB-C10).

### 7.2 Counterargument (the strongest case against the recommendation)

- PROPOSAL/INFERENCE — **"gVisor is enough for S2; the microVM floor is over-engineering."**
  gVisor's own intro says it exists "to safely run untrusted code" (FACT §4.1), it is
  operationally lighter (an OCI runtime, no `/dev/kvm`), and it starts faster and denser than a
  microVM (SB-C6/SB-C12). A single-substrate gVisor-everywhere design would be simpler for a solo
  founder and would still beat shared-kernel containers. **Rebuttal:** for the *detonation* tier
  the asymmetry of consequences (a hostile binary purpose-built to escape) justifies the
  hardware-virtualization boundary and the hardware-attack posture gVisor disclaims (FACT §4.1);
  the recommendation keeps gVisor for S1 and *inside* S2, so its efficiency is captured where the
  threat is data, not code. The counterargument is nonetheless **real** and is exactly why the
  systrap-vs-KVM and gVisor-vs-microVM cost is a **measured** gate (§13), not a paper certainty —
  if benchmarks show gVisor's escape resistance is adequate for a customer's threat model, the S2
  floor is the one decision most worth revisiting.
- The second-strongest counter — **operability**: three substrates triple the patch/CVE surface
  (SB-C10) for one founder. Rebuttal: T0 needs only rootless OCI + (optionally) Firecracker on one
  Linux host; gVisor and Kata are additive at T1/T2; the substrate swaps *behind* the control-side
  brokers, so the operational unit that grows is the substrate, not the security model.

## 8. Rejected / not-recommended alternatives

- **Single hardened-container substrate for everything (OCI-only) — rejected** for S1/S2/S3
  (SB-C1/SB-C4): a shared host kernel is exactly the surface a hostile file/binary/PCAP attacks
  (`08 §6.4` mandates an S2 microVM for high-risk code). Retained only for S0/S4.
- **gVisor as the sole substrate for every tier (gVisor-everywhere) — not recommended** (not
  "unsafe" for S1): correct and efficient for S1, but for S2 detonation it leaves the Sentry on
  the host kernel and disclaims hardware-attack defense (FACT §4.1). Kept for S1 and as DiD inside
  S2, never as the sole S2/S3 boundary.
- **Full QEMU VM per invocation — not recommended**: gives the microVM boundary but at higher
  boot cost/footprint than Firecracker's minimal device model (SB-C6/SB-C12); Firecracker (or Kata
  with a lightweight hypervisor) dominates for disposable per-invocation isolation.
- **Down-tiering to weaker isolation when the required substrate is unavailable — rejected**
  (SB-C5): S2/S3 falling back to gVisor-only or OCI-only would silently run hostile code/traffic
  under insufficient isolation. Must **fail closed** (§10).
- **Running raw file/PCAP in the Fabric/AI/SOC API or any host process — rejected/foreclosed** by
  `03 §7.3` and `08 §6.4` ("Không chạy raw file/PCAP trong AI process hoặc SOC API process").
- **Claiming native macOS S2/S3 parity via nested virtualization — rejected** (§11): Firecracker
  requires `/dev/kvm` on Linux (FACT §4.2); nested virt inside a macOS Linux VM is not a supported,
  benchmarked security boundary. macOS is dev-loop-only.
- **Pooled (non-disposable) executors for S1/S2/S3 — rejected** (SB-C2): cross-invocation residue
  in a shared worker is the untrusted-input risk disposal exists to remove (mirrors
  ADR-0004-EVIDENCE §7). Pooling is permitted only for S0/S4.

## 9. Artifact handling (SB-C11 — PROPOSAL; ILLUSTRATIVE, NOT A CONTRACT)

Answering ADR-0005 decision-needed item #4 without inventing a schema:

- **Input** is delivered to the sandbox as an **immutable, read-only** artifact (content-addressed
  by digest); the sandbox has **no host mount** and cannot write back to the host or any
  repository (`03 §7.3` S2, `08 §6.4`).
- **Output** leaves the sandbox only through a **controlled artifact channel**, is **quarantined
  and malware-scanned** before it reaches the Artifact Store, and is stored immutably with hash +
  classification + retention/legal-hold (`03 §7.1` Artifact Store, `08 §6.4`). On timeout/kill,
  **partial logs/digests are preserved** and the workload is destroyed (`03 §13`).
- Nothing here is a contract; field names are illustrative. `NOT IMPLEMENTED`.

## 10. Fail-closed rules (SB-C5 — PROPOSAL)

- If a profile's **required substrate cannot be provisioned** (no `/dev/kvm` for S2/S3, jailer
  unavailable, `runsc` missing for S1, cgroup-v2+systemd absent so resource caps would be ignored
  for S0/S4), the invocation **DENIES**. It **never** down-tiers to weaker isolation.
- **S2/S3 never fall back to gVisor-only or OCI-only.** A gVisor DiD layer *inside* an S2 microVM
  is allowed; gVisor *instead of* the microVM is a denial condition.
- **Raw file/PCAP never executes in an API or host process** — the strategy's hard rule (`03 §7.3`).
- Consistent with `03 §13` (sandbox timeout → kill + preserve partial digests) and `08 §6.2`
  (deny-by-default); kill switches (global/tenant/tool/action) fail closed (`03 §7.1`).

## 11. macOS-vs-Linux truth (SB-C7 — FACT-grounded)

- FACT — Firecracker "requires read/write access to `/dev/kvm`" and "supports x86_64 and aarch64
  **Linux**" (§4.2). gVisor's KVM platform "runs best on bare-metal"; systrap is the default and
  the fallback inside VMs (§4.1). Docker Desktop on macOS runs containers inside a Linux VM.
- INFERENCE / **honest posture**:
  - **S0/S4** (hardened rootless OCI, no untrusted input) work on macOS **inside the Docker Linux
    VM** — adequate for a dev loop.
  - **S1** (gVisor) can run **functionally** inside a Linux VM on macOS (systrap), useful for
    developing/parsing logic, but this is **not a security-parity** environment.
  - **S2/S3** (Firecracker microVM) run **only on a Linux host or Linux CI with `/dev/kvm`**;
    nested virtualization inside a macOS Linux VM is **not** a supported or benchmarked security
    boundary.
  - Therefore **macOS is dev-loop-only**. **No native macOS security parity is claimed.** Security
    validation (escape/egress suites, §12) runs on Linux host/CI only.

## 12. Validation / spike plan (how the recommendation would be proven — none run yet)

All **planned, not executed**; no substrate has been installed, built, or measured. `NOT
IMPLEMENTED`.

- **Cold-start / density / memory / teardown (SB-C6/SB-C9).** Measure per-invocation cold-start,
  achievable density, memory footprint, and teardown time for rootless OCI, gVisor `runsc`
  (systrap and KVM), and Firecracker (direct + via Kata) on a Linux benchmark host; confirm S0/S4
  pooled paths meet `08 §8` (R0 p95 ≤2 s, receipt ≤5 s) and the tiered cut is justified by data.
- **Escape suite (SB-C4).** Malformed file, fork/zip bomb, disk/device/symlink, resource
  exhaustion, and **substrate-specific escape** attempts per profile; assert no host mount, no
  cross-invocation residue on disposable profiles, and that an S2/S3 guest-kernel compromise does
  not reach the host (KVM boundary).
- **Egress / DNS-rebinding / metadata / IPv6 / link-local (SB-C3).** Confirm S1/S2 have no network
  and S3 permits only the broker allowlist with no mgmt/prod route; block DNS rebinding, redirect,
  IPv6/link-local, and `169.254.169.254` metadata; detect covert-large-output.
- **Credential replay / expiry (SB-C1 boundary with ADR-0004).** Expired/replay token rejected;
  credential lifetime ≤ one invocation; no credential at rest in the sandbox.
- **Receipt / attestation + signing-key absence (ADR-0006 E5 boundary).** Confirm the signing key
  is **never** present in any sandbox/executor; tampered attested evidence fails verification;
  signature is control-plane-produced.
- **Fail-closed (SB-C5).** Remove `/dev/kvm` / jailer / `runsc` / cgroup-v2 → the profile **denies**
  rather than down-tiers; kill switch → deny.
- **Air-gap / offline verify (SB-C8).** Offline-install each substrate from a signed bundle with
  offline SBOM/provenance verification (`08 §8` T2, `08 §6.5`).
- **Status:** none executed; **no harness, executor, or substrate exists to run them against.**

## 13. Reversible decisions vs. measured deferrals

- **Directional, low reversal cost (decide the *shape* now, swap the *product* later):** the
  **profile→isolation-class mapping** of §5 (rise the floor with hostility) and the **fail-closed
  rule** (§10) — these are the load-bearing decisions; the concrete product behind each floor
  swaps behind the control-side brokers.
- **Reversible-with-cost:** the S2 floor being a *microVM* vs. gVisor-only (§7.2 counterargument);
  migrating is operational, not architectural, but is the decision most worth revisiting if
  benchmarks change the calculus.
- **Deferred *measured* gates (do NOT decide now — each owed an explicit Linux benchmark +
  escape-test spike):**
  1. **Guest-kernel build & hardening** — which minimal guest kernel, config, and hardening for
     Firecracker/Kata microVMs; patch cadence.
  2. **Firecracker jailer profile** — exact cgroup/namespace/seccomp/rlimit jail configuration
     (FACT §4.2 recommends the most restrictive default; the concrete profile is measured).
  3. **gVisor platform** — systrap (default) vs. KVM, chosen by the benchmark host and nested-virt
     posture (FACT §4.1).
  4. **Kata hypervisor** — QEMU vs. Cloud-Hypervisor vs. Firecracker backend for T1/T2 (FACT §4.3).
  5. **CPU architecture** — x86_64 vs. aarch64 support matrix (FACT §4.2 both supported).
  6. **Nested virtualization** — whether/where nested virt is a supported boundary (default: no).
  7. **Patch / version floors** — anti-rollback security version floors for guest kernel, VMM,
     `runsc`, and container runtime (`08 §6.5`, `08 §11` CRA).

## 14. Risk register

| # | Risk | Likelihood / impact if unmanaged | Mitigation in the recommendation |
|---|---|---|---|
| SR-1 | S2 gVisor-only "temporary" shortcut ships as the detonation boundary | Med / Critical (host-kernel escape from hostile binary) | Firecracker microVM is the **mandatory** S2 floor; gVisor-only is a **fail-closed denial** (§10); measured gate §13.3. |
| SR-2 | Required substrate unavailable → silent down-tier | Med / High | **Fail closed**, never down-tier (§10, J8); validation §12 removes `/dev/kvm`/jailer/`runsc` and asserts deny. |
| SR-3 | Firecracker "does not filter network traffic" ⇒ S3 egress unmanaged | Med / High (exfiltration) | S3 = microVM **+ netns + control-side Egress Broker** (§5, SB-C3); egress suite §12. |
| SR-4 | Rootless cgroup-v2/systemd caveat ⇒ resource caps silently ignored | Med / Med (runaway/DoS) | Require cgroup v2 + systemd for S0/S4 or fail closed (§10); FACT §4.4. |
| SR-5 | Hardware side channels / hardware vulns unmitigated by any substrate | Low-Med / High (cross-tenant leak) | FACT §4.1/§4.2 disclaim these; single-tenant-per-Firecracker-process, SMT/KSM off, ECC memory — a **measured** host-hardening gate §13; documented residual. |
| SR-6 | Three substrates triple patch/CVE surface for one founder | Med / Med | T0 = rootless OCI (+ optional Firecracker) on one host; substrate grows, security model does not (SB-C12); patch/version-floor gate §13.7. |
| SR-7 | macOS mistaken for a security-parity environment | Med / High (false assurance) | Explicit **dev-loop-only** posture (§11, J9); security suites run on Linux host/CI only. |
| SR-8 | Substrate choice accidentally re-opens or violates the accepted ADR-0004 split | Low / Med | Mapping implements the accepted executor lifecycle behind control-side brokers; substrate swaps behind that boundary (§3). |
| SR-9 | Capability→profile binding under-specified (S2↔R2 imperfect fit) | Med / Med | Flagged UNKNOWN (§15); the exact binding is a Capability Registry / PDP policy owed to ADR-0004; profile is an isolation **floor** policy may only raise. |
| SR-10 | Air-gap substrate install/verify not exercised | Med / Med | Offline-install + offline SBOM/provenance verify in validation §12; SB-C8. |

## 15. GATE A4 — decision questions (exact) + draft acceptance text

### 15.1 Decision questions J1–J10 (exact, answerable)

Posed for a **future** GATE A4; **this packet does not open or close that gate**, and GATE A4 is
**not open**. GATE A3 closed 2026-07-24. Reversibility per §13.

| # | Question | Form | Recommended |
|---|---|---|---|
| **J1** | Adopt the **risk-tiered substrate mapping** (§5): the isolation floor rises with input hostility across S0–S4, rather than a single substrate for all profiles? | yes/no | **yes** |
| **J2** | **Hardened rootless OCI** as the floor for **S0/R0** (pooled, API-only) and **S4/R3** (typed response executor, **no file input**)? | yes/no | **yes** |
| **J3** | **gVisor `runsc`** for **S1/R1** reviewed parsers/scanners, **disposable per-invocation, no-network by default**? | yes/no | **yes** |
| **J4** | **Firecracker microVM** as the **mandatory floor for S2/R2** hostile code/binary detonation, with gVisor allowed only as **defense-in-depth inside**, **never the sole S2 boundary**? | yes/no | **yes** |
| **J5** | **Firecracker microVM + separate netns + control-side Egress Broker** for **S3/R2** controlled network / PCAP isolated lab (no route to management/production)? | yes/no | **yes** |
| **J6** | **R4 destructive denied** to agents in 1.x (no substrate provisioned)? | yes/no | **yes** |
| **J7** | **Kata `RuntimeClass`** as the **Kubernetes portability wrapper** for S2/S3 at T1/T2, with **direct Firecracker + jailer** as the T0 path (same microVM security model)? | yes/no | **yes** |
| **J8** | **Fail closed** when required isolation is unavailable for S1/S2/S3; **S2/S3 never fall back to gVisor-only or OCI-only**; **raw file/PCAP never executes in an API or host process**? | yes/no | **yes** |
| **J9** | **macOS is dev-loop-only** — S0/S4 and functional gVisor S1 inside a Linux VM; **S2/S3 only on a Linux host/CI with `/dev/kvm`**; no native macOS security parity claimed? | yes/no | **yes** |
| **J10** | **Defer** the measured kernel/hardware choices (guest-kernel build/hardening, jailer profile, gVisor systrap-vs-KVM, Kata hypervisor, CPU architecture, nested virtualization, patch/version floors) to a **Linux benchmark + escape-test spike**? | yes/no | **yes** |

### 15.2 DRAFT acceptance text (PROPOSED WORDING ONLY — NOT AN ACCEPTANCE)

The following is *draft* wording a future acceptance record **would** use **if** the Founder
answers J1–J10 as recommended at a future GATE A4. It is **not** an acceptance, changes **no**
status, and is included only so the Founder can see the exact commitment. Per ADR-0001 D5, any
status flip requires explicit Founder authorization recorded with evidence links; no agent may
infer approval. This packet leaves ADR-0003/ADR-0005 `PROPOSED — NOT DECIDED`; accepted
ADR-0002/ADR-0004 are not re-opened.

> *(DRAFT — do not apply without a Founder gate; GATE A4 is not open.)* "ADR-0005 is `ACCEPTED`.
> The Founder decided J1–J10 at GATE A4 (Wave 2) on `<DATE>`: adopt a risk-tiered substrate
> mapping (J1); hardened rootless OCI for S0/R0 and S4/R3 with no file input (J2); gVisor `runsc`
> disposable no-network for S1/R1 (J3); Firecracker microVM as the mandatory S2/R2 floor with
> gVisor defense-in-depth only, never the sole boundary (J4); Firecracker microVM + netns +
> Egress Broker for S3/R2 (J5); R4 denied (J6); Kata `RuntimeClass` as the K8s portability wrapper
> for S2/S3 with direct Firecracker+jailer at T0 (J7); fail-closed on missing isolation with no
> gVisor-only/OCI-only fallback for S2/S3 and no raw file/PCAP in any API/host process (J8);
> macOS dev-loop-only with no native security parity (J9); and defer the measured kernel/hardware
> choices to a Linux benchmark + escape-test spike (J10). Status flip applied by an AI agent under
> explicit Founder authorization per ADR-0001 D5; no agent inferred approval. `NOT IMPLEMENTED`:
> this ADR accepts the substrate *mapping* only; no sandbox, substrate driver, jailer profile,
> gVisor/Firecracker/Kata integration, executor, or isolation control plane exists in code."

## 16. Source register

Primary/official sources only; secondary/marketing sources are inadmissible per README hard rules.
Internal references are repository documents/code read on 2026-07-24.

| ID | Source | Type | Used for | Accessed / read |
|---|---|---|---|---|
| P1 | gVisor — intro <https://gvisor.dev/docs/architecture_guide/intro/> | Primary (official project) | §4.1 gVisor positioning / runsc | 2026-07-24 |
| P2 | gVisor — security model <https://gvisor.dev/docs/architecture_guide/security/> | Primary (official project) | §4.1/§6 syscall interception, limitations (side channels, "not a substitute") | 2026-07-24 |
| P3 | gVisor — platforms <https://gvisor.dev/docs/architecture_guide/platforms/> | Primary (official project) | §4.1/§13 systrap vs KVM vs ptrace, default | 2026-07-24 |
| P4 | gVisor — networking <https://gvisor.dev/docs/architecture_guide/networking/> | Primary (official project) | §4.1 netstack default vs host networking | 2026-07-24 |
| P5 | gVisor — `LICENSE` (master) <https://github.com/google/gvisor/blob/master/LICENSE> | Primary (official repo license file) | §4.1 **re-verified** Apache-2.0 (+ some MIT/BSD files) | 2026-07-24 |
| P6 | Firecracker — production host setup <https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md> | Primary (official repo) | §4.2/§6 jailer mandatory, restrictive seccomp, single-tenant, no net filtering, side-channel guidance | 2026-07-24 |
| P7 | Firecracker — getting started <https://github.com/firecracker-microvm/firecracker/blob/main/docs/getting-started.md> | Primary (official repo) | §4.2/§11 `/dev/kvm`, x86_64/aarch64 Linux | 2026-07-24 |
| P8 | Firecracker — jailer <https://github.com/firecracker-microvm/firecracker/blob/main/docs/jailer.md> | Primary (official repo) | §4.2 jailer isolation primitives | 2026-07-24 |
| P9 | Kata Containers <https://katacontainers.io/> | Primary (official project) | §4.3 VM-behind-container, OCI/CRI, hypervisors | 2026-07-24 |
| P10 | Kata software page <https://katacontainers.io/software/> | Primary (official project) | §4.3 supported components/hypervisors (referenced) | 2026-07-24 |
| P11 | Docker — rootless mode <https://docs.docker.com/engine/security/rootless/> | Primary (vendor docs) | §4.4 user-namespace daemon/containers | 2026-07-24 |
| P12 | Docker — rootless tips/limitations <https://docs.docker.com/engine/security/rootless/tips/> | Primary (vendor docs) | §4.4 cgroup-v2/systemd caveat, NFS, ports, ping | 2026-07-24 |
| P13 | Docker — seccomp profile <https://docs.docker.com/engine/security/seccomp/> | Primary (vendor docs) | §4.4 default seccomp allowlist (~44 syscalls) | 2026-07-24 |
| I1 | `../../strategy/03-REFERENCE-ARCHITECTURE.md` §7.2/§7.3/§10/§13 | Internal doc (`PROPOSAL`) | Sandbox profiles S0–S4, risk classes, tiers, failure modes | read 2026-07-24 |
| I2 | `../../strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` §5/§6.4/§6.5/§8/§11 | Internal doc (`PROPOSAL`) | Sandbox controls, escape/egress tests, SLOs, CRA | read 2026-07-24 |
| I3 | `../../strategy/02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md` §9 | Internal doc | SPIFFE/SBOM/SLSA adoption order | read 2026-07-24 |
| I4 | Accepted [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md) | Internal ADR (`ACCEPTED`) | Fixed identity/receipt model (§2.2/§3) | read 2026-07-24 |
| I5 | Accepted [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md) D4/D5 | Internal ADR (`ACCEPTED`) | Format pins, acceptance mechanics | read 2026-07-24 |
| I6 | [ADR-0004](../ADR-0004-tool-fabric-control-plane-executor-split.md) + [evidence](ADR-0004-EVIDENCE.md) | Internal ADR (`ACCEPTED` 2026-07-24) | Accepted split; substrate deferred to here (§2.2/§3) | read/decided 2026-07-24 |
| I7 | [ADR-0005](../ADR-0005-sandbox-substrate.md) | Internal ADR (`PROPOSED`) | The decision boundary this packet backs | read 2026-07-24 |
| C1 | `cybrik-security-tool-fabric:` (tree) | Cross-repo code/doc state | §2.3 documentation-only scaffold, no source | read 2026-07-24 |
| C2 | `cybrik-soc-command-center:services/api/src/cybrik_soc/platform/{outbound,secrets}.py` | Cross-repo code state | §2.3 egress/credential **broker** seeds (not isolation) | read 2026-07-24 |

## 17. Evidence limitations / carried unknowns

1. **No substrate measured.** Cold-start/density/memory/teardown, escape, and egress suites are
   planned (§12) but **not run**; no substrate was installed, built, or benchmarked. `UNKNOWN`.
2. **Guest-kernel build/hardening, jailer profile, gVisor systrap-vs-KVM, Kata hypervisor, CPU
   architecture, nested virtualization, patch/version floors** — all deferred to a Linux benchmark
   + escape-test spike (§13). `UNKNOWN`.
3. **Capability→profile binding.** The exact mapping of each capability to a sandbox profile
   (esp. S2↔R2 detonation vs. R1 analysis) is a Capability Registry / PDP **policy** owed to
   ADR-0004; the profile here is an isolation **floor** policy may only raise (SR-9). `UNKNOWN`.
4. **Identity issuer in disposable microVMs.** How a per-invocation microVM bootstraps/attests its
   SPIFFE workload identity (SPIRE node/workload attestation vs. an executor-mediated internal CA)
   interacts with ADR-0004's deferred issuer spike; not resolved here. `UNKNOWN`.
5. **Hardware side channels / hardware vulnerabilities.** Explicitly disclaimed by gVisor and
   Firecracker (FACT §4.1/§4.2); host-hardening (single-tenant-per-process, SMT/KSM off, ECC) is a
   measured host-ops gate, not solved by substrate choice (SR-5). `UNKNOWN`.
6. **Licenses.** gVisor Apache-2.0 (with some MIT/BSD files) was **re-verified** from the master
   `LICENSE` file (FACT §4.1/P5). Firecracker and Kata Apache-2.0 are `RESEARCH` from their
   official repos/sites; a per-`LICENSE` re-verify is owed before any spike (SB-C8). No substrate
   was installed.
7. **GATE A4 is not open.** This is Wave 2 read-ahead research and decides nothing.
   GATE A3 closed 2026-07-24; ADR-0002/ADR-0004 are accepted. ADR-0003/ADR-0005 remain
   `PROPOSED — NOT DECIDED`.
8. **Nothing in the suite is implemented.** No sandbox, substrate driver, jailer profile, gVisor/
   Firecracker/Kata integration, executor, egress/credential broker, or isolation control plane is
   built, wired, or piloted in `cybrik-security-tool-fabric` (a documentation-only scaffold) or any
   other repository. `NOT IMPLEMENTED`. This packet is research + proposal + a recommendation; it
   accepts nothing.
