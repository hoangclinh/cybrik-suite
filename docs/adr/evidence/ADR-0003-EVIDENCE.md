# ADR-0003 Evidence Packet — Durable agent orchestration (durability substrate)

- Status: `DRAFT` — recommendation only. Backs a `PROPOSED — NOT DECIDED` ADR; this packet
  informs a decision, it does not make one. Nothing in the suite is implemented, verified, or
  piloted; `cybrik-cyber-ai-platform` is a documentation-only scaffold.
- Date: 2026-07-24
- Backs: [ADR-0003](../ADR-0003-durable-agent-orchestration.md)
- Wave / gate: **Wave 2**; feeds **GATE A4** (see [ADR-DECISION-SPRINT-2026-07.md](../ADR-DECISION-SPRINT-2026-07.md)
  §3, wave board). **GATE A4 is NOT open.** This packet is **read-ahead Wave 2 research** produced
  under the sprint rule that read-only research may run ahead of a gate (§3, §5); it produces
  evidence, not a decision.
- Upstream dependency (resolved 2026-07-24): ADR-0003 sits **below**
  [accepted ADR-0002](../ADR-0002-cyber-ai-implementation-stack.md) in the decision graph
  (sprint §2). At GATE A3 the Founder accepted G5 as recommended: a **thin CYBRIK-owned
  deterministic domain state machine** owns budgets/evidence/receipts and this ADR owns only
  the durability substrate below it. The [ADR-0002 evidence](ADR-0002-EVIDENCE.md) and
  [Wave 1 decision packet](../FOUNDER-DECISION-PACKET-WAVE-1.md) are retained as provenance.
- Scope: `cybrik-cyber-ai-platform` — the **durability substrate below the CYBRIK-owned
  deterministic domain controller**: how long-running, interruptible investigations persist state,
  survive process restart, wait for days-long approvals, replay/audit faithfully, and issue
  idempotent tool calls through the Tool Fabric gateway. This packet chooses the **substrate**,
  **not** the controller (the controller's authority is fixed by the strategy and accepted
  ADR-0002 G5), and **not** the sandbox substrate (ADR-0005).
- Inherits (accepted Wave 0, not re-decided): the cross-product **envelope, workload identity,
  delegation chain, correlation semantics, and receipt-signing side** are fixed by accepted
  [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md) (E1/E2/E3/E5/E6/E7). Crucially,
  **ADR-0006 E4 left the event-bus choice to ADR-0003** — the bus is in scope here. Contract
  versioning + format pins of anything named here inherit accepted
  [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md) (D1–D7; D4 pins AsyncAPI 3.0.0 /
  JSON Schema 2020-12).
- Prepared by: orchestrator, under Founder delegation of overnight technical research (read-ahead
  Wave 2). **Produces a recommendation for a future Founder decision; it does not accept the ADR.**
  ADR acceptance remains a Founder gate (ADR-0001 D5 mechanics); no agent may infer approval.

## 0. Source-labelling key

Per [evidence/README.md](README.md) and sprint §6: `FACT` (verified against the primary source
cited), `RESEARCH` (summarized from a primary/official source via its published page/repo/spec,
not independently reproduced/built here), `PROPOSAL` (our position, ours to defend), `INFERENCE`
(reasoning from labelled facts; could be wrong), `UNKNOWN` (open question; material ones appear in
the Founder decision list). Every external claim cites a primary/official URL with an **access
date**. All external URLs in this packet were accessed **2026-07-24**. Internal cross-repo
references use `repo:path` form and are code state **as read on 2026-07-24**, not a claim of
implemented suite capability.

## 1. Decision criteria (constraints)

Stated before scoring. Drawn from `../../strategy/03-REFERENCE-ARCHITECTURE.md` §6.1/§6.2/§3.2/§9.2/§13/§14,
`../../strategy/05-CONTRACTS-AND-INTEGRATION.md` §2.2/§7/§11, `../../strategy/07-SOLO-FOUNDER-AI-OPERATING-MODEL.md`
§5, `../../strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` §2/§9, and the accepted ADR-0006/ADR-0001
models. Options are scored against these and only these.

| # | Criterion | Why it matters |
|---|---|---|
| O-C1 | Controller authority stays CYBRIK domain code | "Không chọn agent framework làm lõi contract … state, policy, evidence và receipt phải là domain model của CYBRIK" (`03 §11`); "LLM đề xuất plan; deterministic controller validate plan và chọn allowed transition" (`03 §6.2`). The substrate persists state **below** the controller; it must never become the source of truth or the transition authority. |
| O-C2 | Durable long-wait, restart-survivable | Investigations wait on human approval for hours-to-days and must survive process restart with the wait intact (`03 §13` "investigation chờ/retry có budget"; ADR-0004 evidence §2.7 records that SOC's current approval gate does **not** survive restart). |
| O-C3 | Checkpoint + replay/audit fidelity | "State checkpoint sau mỗi evidence/tool step; cancellation không làm mất receipts" (`03 §6.2`); trajectories must be inspectable for the seven eval layers (`08 §2`). Append-only history, never mutated. |
| O-C4 | Sovereign/air-gap + solo-founder footprint | T0 single-host, T2 air-gapped with no phone-home (`03 §10`); one founder operates all of it (`07 §5` minimal-tech). Every added long-running service is operational cost the founder pays at every tier. |
| O-C5 | Multi-tenancy: RLS FORCE, schema isolation, no cross-product join | Per-product DB isolation, tenant boundary on every store, "tuyệt đối không join cross-product database" (`03 §3.2`); cross-tenant tests mandatory (`03 §8.2`, `08 §6`). Orchestration state must live under the same RLS-FORCE discipline SOC already enforces. |
| O-C6 | Cross-product delivery integrity (bus + outbox) | "At-least-once delivery; consumer idempotent; Transactional outbox từ database owner" (`05 §2.2`); "Event bus lag → … outbox replay" (`03 §13`); consumers "dedup `event_id`" (`05 §7`). E4 handed the **bus choice** here (ADR-0006). |
| O-C7 | Idempotent, exact-once-effect tool calls through Fabric | "Mọi mutation/job create có idempotency key" (`05 §1`); "Idempotency không biến thành replay authority sau khi token/approval hết hạn" (`05 §11`); the Fabric Gateway does "delegation validation, idempotency" and the Execution Scheduler does "dedup" (`03 §7.1`). This is the ADR-0003 ↔ ADR-0004 seam (ADR-0003 decision #5). |
| O-C8 | Failure semantics: retry / compensation / timeout / cancel / kill-switch / policy re-eval | `03 §13` failure table + `03 §9.2` ("Fabric re-evaluates policy and target freshness"; "Policy version change mid-run → re-evaluate trước action; old approval invalid nếu material change"); cancellation must not lose receipts (`03 §6.2`); kill switch fails closed (`03 §7.1`). |
| O-C9 | Versioned, immutable workflow definitions | "Prompt/model/retriever/policy version … lưu immutable revision + digest" (`05 §9`, `03 §6.1` AI Ledger). A workflow definition is the same class of object: versioned, immutable, digest-pinned; a retry is a new attempt, not a rewrite of history. |
| O-C10 | Permissive license + offline supply chain | Anything shipped into an air-gapped customer must be permissively licensed and offline-installable/verifiable (`02 §7`, `03 §10` T2). |

## 2. Current-state evidence

### 2.1 What the strategy already fixes (internal baseline — RESEARCH from internal docs, not a decision)

- RESEARCH — The **Durable Orchestrator** module is already named and scoped: "State machine,
  checkpoint, budget, cancellation, retry, compensation" (`../../strategy/03-REFERENCE-ARCHITECTURE.md`
  §6.1). Orchestration rules (`03 §6.2`) fix: LLM proposes a plan, a **deterministic controller
  validates it and picks an allowed transition**; each node has **typed input/output schema,
  timeout, retry budget, maximum fan-out**; **no unbounded "think/reflect until done"**; tool calls
  only through Fabric; **state checkpoint after each evidence/tool step**; **cancellation does not
  lose receipts**; budgets over time/tokens/retrieved-bytes/tool-calls/egress/money; terminal states
  are `completed | partial | abstained | denied | cancelled | failed`.
- RESEARCH — The mandatory ADR list names this decision precisely: "**ADR-AI-003: durable
  orchestration/state machine/outbox**" (`03 §14` item 3) — the strategy itself couples "state
  machine" and "outbox" in the same ADR.
- RESEARCH — Process/store topology is pre-constrained: "PostgreSQL: database/schema tách theo sản
  phẩm; **tuyệt đối không join cross-product database**"; "Kafka: optional ở T0, required ở T1/T2 …
  **transactional outbox giữ parity**" (`03 §3.2`); `ai-api` + `ai-worker` as the two processes.
- RESEARCH — Cross-product async contract is pre-constrained: AsyncAPI + Kafka at T1/T2,
  **at-least-once delivery, consumer idempotent, transactional outbox from the database owner**, an
  envelope carrying `event_id`/`event_type`/`event_version`/…; consumers **dedup `event_id`**
  (`05 §2.2`, `05 §7`). The event catalog already lists `cybrik.ai.investigation.checkpointed.v1`
  (`05 §7`).
- RESEARCH — Failure semantics are pre-constrained (`03 §13`): Fabric unavailable → investigation
  **waits/retries within budget**; approval service unavailable → **fail closed**; event-bus lag →
  backpressure, **no drop, visible lag/SLO, outbox replay**; policy version change mid-run →
  **re-evaluate before action, old approval invalid on material change** (also `03 §9.2`).
- INFERENCE — These fix *what the orchestrator must do* and *that a transactional outbox is
  required*; they do **not** decide the **substrate** that provides durability, the **bus product**,
  the **schema layout**, or whether that substrate is in-house or a third-party durable-execution
  engine. Those are ADR-0003.

### 2.2 SOC code state — a design seed and a recorded gap (existing state in another repo, READ-ONLY 2026-07-24)

`cybrik-soc-command-center` is a separate product read read-only as a durability seed and to record
a gap. **None of this runs in `cybrik-cyber-ai-platform`, which is a documentation-only scaffold.**
Facts below are code state (Explore pass, 2026-07-24), corroborating ADR-0004 evidence §2.7.

- FACT (code state) — The SOC **stack** ADR-0002 aligns to is durable-Postgres-native: Python
  `>=3.11`, FastAPI `>=0.115`, **SQLAlchemy 2.0 async + asyncpg**, Alembic, `redis>=5.0`
  (`cybrik-soc-command-center:services/api/pyproject.toml`).
- FACT (code state) — **Tenant isolation is RLS `FORCE` with a transaction-local tenant GUC**, not
  schema-per-tenant: `cybrik-soc-command-center:services/api/src/cybrik_soc/platform/database.py:51`
  `tenant_session()` issues `SELECT set_config('app.current_tenant_id', :tid, true)`; `ENABLE` +
  `FORCE ROW LEVEL SECURITY` and a `{table}_tenant_isolation` policy are applied per migration
  (e.g. `.../alembic/versions/0013_soar.py:126-129`, `0017_soar_kill_switch.py:48-49`,
  `0001_sprint1_foundation.py`). This is the proven pattern ADR-0003 orchestration tables would reuse
  (O-C5).
- FACT (code state) — The SOC **SOAR engine is an explicitly Phase-1 IN-MEMORY state machine with a
  DB "side-mirror"**, and **durable resume is deliberately NOT built**:
  - Run-time state is in-memory dicts: `.../modules/soar/engine.py:136-137`
    (`self._executions` / `self._approvals`); per-tenant engines held module-global in
    `.../modules/soar/runtime.py:115` (`_runtimes`).
  - Docstrings state it: `runtime.py:3` ("giữ execution/approval **TRONG BỘ NHỚ** (không có store
    seam)"), `runtime.py:14-16` (on restart, in-memory `PENDING` approvals are **lost**; DB pending
    rows swept to `EXPIRED` after TTL as a fail-safe), `orm.py:7-11`/`orm.py:75`
    (`SoarExecution` is a "mirror bên").
  - **Resume of orphaned executions is explicitly deferred** to "PF-3 (substrate lớn)":
    `.../modules/soar/expire_worker.py:18-20`, `expire_worker.py:95-96`; `_expire_orphan`
    (`expire_worker.py:91`) can mark a stale row `EXPIRED`/cancel it but **cannot fire the
    `on_timeout` branch** because the execution is not in RAM.
- FACT (code state) — Durable pieces that **do** exist in SOC and seed the invariants ADR-0003
  needs: **append-only audit ledger** `audit_events` (`.../platform/audit_support.py:15` `record()`;
  grant `SELECT, INSERT` only, "append-only: KHÔNG UPDATE/DELETE", `0001_sprint1_foundation.py:153`);
  **append-only step-results** `soar_step_results` (`.../modules/soar/orm.py:102`, monotonic `seq`,
  grant `SELECT, INSERT` only, `0013_soar.py:140`); **DB-backed global kill-switch** `soar_kill_switch`
  (`orm.py:157`, DB gate `runtime.py:49`, no-DELETE grant `0017_soar_kill_switch.py:57-58`);
  **DB approval-request mirror with TTL/expiry sweep** (`SoarApprovalRequest` `orm.py:129`,
  `expires_at` `orm.py:151`; sweep `expire_worker.run_forever` on an `asyncio.sleep` loop wired at
  `.../main.py:75`, interval `.../config.py:141`).
- FACT (code state) — **Durable idempotency/dedup exists on the ingest path** (the pattern
  ADR-0003 would generalise): `.../modules/ingest/service.py:329-333`
  `INSERT … raw_events … ON CONFLICT (tenant_id, connector_id, dedup_key) … DO NOTHING RETURNING`
  (dedup key `service.py:97`); anti-replay nonce `webhook_nonces`
  (`service.py:236-242`, unique `(connector_id, nonce)`); 1-1 provenance lineage
  `.../platform/provenance.py:17,21,34`.
- FACT (code state) — **There is NO transactional outbox and NO event-publish/relay anywhere in
  SOC.** A repo-wide search for `outbox|publish_event|event_bus|dispatch_event|relay` returns zero
  source hits; "dispatch" in SOAR is connector **action** dispatch, not event publishing. The outbox
  the strategy mandates (`03 §3.2`, `05 §2.2`) is **unbuilt in every repo**.
- INFERENCE — SOC is a strong seed for the *invariants* (RLS FORCE, append-only ledgers, DB kill
  switch, durable dedup) but is an explicit **anti-pattern for durability**: in-memory run-state,
  no resume, no outbox. It argues an ADR-0003 substrate is genuinely needed and that the invariants
  are buildable in the same Postgres discipline; it does **not** argue any capability exists.

### 2.3 Accepted-model constraints this ADR must honour (not re-decide)

- FACT — Accepted [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md): **E4 — the
  event bus is out of scope of ADR-0006; the envelope is bus-agnostic and the bus choice belongs to
  ADR-0003.** **E1** CloudEvents-style envelope with CYBRIK extension attributes + versioned
  payloads. **E5** the Tool Fabric control plane signs receipts; executors attest. **E6**
  (conditional) trace context required on operational cross-product events and created at the
  boundary when absent; `investigation_id` required only for investigation-scoped events; causation
  reference required for derived events; correlation semantics defined per event class. **E7**
  `cybrik.<product>.<entity>.<action>.v<major>` naming.
- INFERENCE — E4 explicitly puts the **bus** in ADR-0003's scope; E1/E6/E7 fix the envelope the
  outbox must serialise; E5 fixes that the **receipt** (the durable proof folded back into the
  Investigation Bundle) is signed on the **Fabric** side, so ADR-0003's effect ledger references
  receipts rather than minting them. None of these are reopened here.

## 2.4 Boundary vs. ADR-0006 (accepted), ADR-0004 (proposed), ADR-0005 (proposed)

INFERENCE throughout; stated to keep concerns from leaking across ADRs.

- **vs. ADR-0006 (accepted).** ADR-0006 owns the envelope/identity/delegation/correlation model and
  the receipt-signing *side*. ADR-0003 **consumes** that model (the outbox serialises E1/E6/E7
  envelopes; the effect ledger references E5 receipts) and **owns the one thing E4 handed it: the
  bus.** ADR-0003 does not invent identity, delegation, or receipt formats.
- **vs. ADR-0004 (proposed).** ADR-0004 owns the Fabric control-plane/executor split, the Execution
  Scheduler's own dedup, and (per ADR-0004 evidence §2.7) the **open, unresolved SOC approval-ingress
  gap**. ADR-0003 owns the **orchestration-side** idempotency: it mints an idempotency key per
  intended effect, records the effect in its own ledger, and re-reads that ledger on resume so a
  restart never re-issues an already-applied effect. The **ADR-0003 ↔ ADR-0004 idempotency
  contract** (O-C7, H7) is the join: at-least-once delivery (ADR-0003 outbox) + Fabric scheduler
  dedup (ADR-0004) + orchestration effect ledger (ADR-0003) together produce the exact-once *effect
  illusion*. ADR-0003 does **not** decide the Fabric split, nor close the approval-ingress gap —
  it depends on it and must degrade safely while it is open.
- **vs. ADR-0005 (proposed).** ADR-0005 owns the **sandbox substrate** (isolation tech for running
  hostile tool input). That is orthogonal to the **durability** substrate here: an orchestration
  step that waits on a Fabric sandbox execution is, to ADR-0003, just a durable `await` on a Fabric
  invocation result. ADR-0003 chooses no sandbox and ADR-0005 chooses no durability engine.

## 3. External research — durability-substrate options (primary/official sources only)

All four options from the ADR context class "database-backed state machine with outbox / durable-
workflow engine / event-sourcing" are made concrete as the four live options below. Access date
**2026-07-24** for every URL.

### 3.1 In-house PostgreSQL durable state machine + transactional outbox

- RESEARCH — The **transactional outbox** is a documented pattern with a defined guarantee: write
  the outbound message into an `OUTBOX` table **in the same local transaction** that updates
  business state; a separate **message relay / polling publisher** reads the outbox and publishes to
  the broker; delivery is **at-least-once** ("The Message relay might publish a message more than
  once") and **ordered** ("sent … in the order they were sent by the application"); the message is
  "guaranteed to be sent **if and only if** the database transaction commits."
  <https://microservices.io/patterns/data/transactional-outbox.html>
- INFERENCE — An in-house substrate is a set of PostgreSQL tables under CYBRIK's own RLS-FORCE
  schema (ILLUSTRATIVE — NOT A CONTRACT): a **workflow-definition** table (immutable, versioned,
  digest-pinned — O-C9); a **workflow-instance / state** table (current node, status, budgets); an
  append-only **step / checkpoint** table (one row per completed evidence/tool step — O-C3, mirroring
  the existing `soar_step_results` discipline); a **timer** table (durable due-time rows for
  days-long waits — O-C2); an **idempotency / effect ledger** (idempotency-key → recorded effect +
  receipt ref — O-C7); and a **transactional outbox** (envelope rows committed with state, relayed
  at-least-once — O-C6). All in the **same PostgreSQL** as the rest of Cyber AI, in a **separate
  orchestration schema** from the Investigation Graph/Bundle, RLS `FORCE`, no cross-product join
  (O-C5). This reuses SOC's proven RLS + append-only + durable-dedup patterns (§2.2).
- INFERENCE — Cost: CYBRIK must **build and prove** the checkpoint/timer/resume/relay machinery
  that a durable-execution engine provides off the shelf. This is the honest counterweight (§6).

### 3.2 DBOS (Transact) — lightweight durable execution in Postgres

- FACT — **DBOS Transact (Python) is MIT-licensed.** Repository badge + `LICENSE`.
  <https://github.com/dbos-inc/dbos-transact-py> (2026-07-24) — satisfies O-C10.
- RESEARCH — DBOS "workflows make your program **durable** by checkpointing its state in Postgres.
  If your program ever fails, when it restarts all your workflows will automatically **resume from
  the last completed step**"; workflows are "stored as rows in a Postgres table"; it provides
  "Reliable Queues … backed by Postgres." <https://docs.dbos.dev/>,
  <https://github.com/dbos-inc/dbos-transact-py> (2026-07-24). Directly relevant to O-C2/O-C3.
- FACT (from official docs) — DBOS keeps its state in a **`dbos` system schema in a configurable
  system database**: "DBOS records application execution history in several system tables. These
  tables are located in your system database, whose location you configure when you launch your
  application." Named tables include `dbos.workflow_status`, `dbos.operation_outputs`,
  `dbos.notifications`, `dbos.workflow_events`, `dbos.streams`, `dbos.queues`,
  `dbos.workflow_schedules`, `dbos.application_versions`, `dbos.dbos_migrations`.
  <https://docs.dbos.dev/explanations/system-tables> (2026-07-24).
- INFERENCE — DBOS is the **closest fit to the recommendation's shape** (same Postgres, MIT,
  resume-from-last-step, durable queues) and is therefore pre-qualified as the **spike-gated
  fallback** behind the same port (§6). But its state lives in **DBOS-owned `dbos.*` system tables**,
  not CYBRIK's RLS-FORCE orchestration tables. Whether RLS FORCE + the transaction-local tenant GUC
  can be applied to DBOS system tables without breaking DBOS's own reads/writes, whether DBOS's
  built-in observability emits any default telemetry that must be disabled for air-gap, and how
  DBOS handles **workflow-version drain** during a rolling upgrade are **UNKNOWN** and are the
  spike's DBOS-specific questions (§10, H2).

### 3.3 Temporal — durable-execution platform (separate service)

- FACT — **The Temporal server is MIT-licensed.** Repository badge + `LICENSE`.
  <https://github.com/temporalio/temporal> (2026-07-24) — license alone satisfies O-C10.
- RESEARCH — Temporal is a "durable execution platform" that runs Workflows resiliently, operated as
  a **separate Temporal Service** = the **Temporal Server (Frontend, History, Matching, Worker
  services)** plus **Persistence** and **Visibility** stores. <https://github.com/temporalio/temporal>,
  <https://docs.temporal.io/clusters> (2026-07-24).
- RESEARCH — Its **persistence is a separate datastore from the application's own database**: "A
  Temporal Service's only required dependency for basic operation is the Persistence database,"
  supported stores **Cassandra, PostgreSQL, MySQL, SQLite (dev/test only)**; a **Visibility store**
  is separate (Elasticsearch recommended for production, SQL DBs supported from Server 1.20+).
  <https://docs.temporal.io/temporal-service/persistence> (2026-07-24).
- INFERENCE — Temporal's operational footprint (a multi-role server + its own persistence + a
  visibility store) is **heavy for a solo founder at T0 and awkward for T2 air-gap** (O-C4), and its
  workflow state lives in **Temporal's own datastore, outside CYBRIK's RLS-FORCE Postgres** — so
  tenant isolation and audit would have to be re-established in a store CYBRIK does not control with
  the SOC RLS pattern (O-C5), and Temporal's workflow history becomes a **competing source of truth**
  next to the CYBRIK domain state machine (tension with O-C1). Rejected for T0/T1 on this footprint;
  see §7.

### 3.4 Prefect — data-pipeline workflow orchestration

- FACT — **Prefect is Apache-2.0.** Repository `LICENSE`.
  <https://github.com/PrefectHQ/prefect> (2026-07-24) — satisfies O-C10.
- RESEARCH — Prefect is "a **workflow orchestration framework for building data pipelines in
  Python**" — "the simplest way to elevate a script into a production workflow," with
  `flow`/`task` decorators and "scheduling, caching, retries, and event-based automations," monitored
  via a self-hosted Prefect server or Prefect Cloud. <https://github.com/PrefectHQ/prefect>
  (2026-07-24).
- INFERENCE — Prefect's model is **flow-run orchestration + observability** (scheduling, caching,
  flow/task retries), not a per-step **durable state machine with exact-once effect semantics and
  digest-bound resumable approval waits**. Its retry model re-runs flows/tasks; it is not the
  deterministic durable substrate ADR-0003 requires (O-C1/O-C2/O-C3/O-C7). Rejected; see §7.

## 4. Option analysis (option matrix)

Scored against §1. `S` strong / `M` medium / `W` weak. INFERENCE throughout, from §2–§3.

| Criterion | In-house PG + outbox | DBOS | Temporal | Prefect |
|---|---|---|---|---|
| O-C1 controller authority stays CYBRIK | **S** — substrate is dumb tables below the controller | S — controller code stays ours; DBOS below the port | **W** — Temporal workflow history is a competing source of truth | W — Prefect flow is the orchestration model |
| O-C2 durable long-wait / restart | M→S — durable timer table; must build + prove resume | **S** — resume-from-last-step built in | S — durable timers/signals built in | M — waits exist but flow-run-shaped |
| O-C3 checkpoint + replay/audit | **S** — append-only step table under our schema | S — `operation_outputs`/`workflow_status` in `dbos` schema | M — history in Temporal's store, not ours | M — run logs, not step-exact audit |
| O-C4 sovereign/air-gap + founder footprint | **S** — one Postgres, no new long-running service | **S** — a library, same Postgres, no new service | **W** — server (4 roles) + persistence + visibility store | M — needs a Prefect server; data-pipeline-shaped |
| O-C5 RLS FORCE / schema isolation / no cross-product join | **S** — our schema, SOC RLS pattern reused | M — state in `dbos.*` system schema; RLS-on-system-tables **UNKNOWN** | **W** — state in Temporal's external datastore | W — state in Prefect's store |
| O-C6 bus + outbox (at-least-once, dedup) | **S** — outbox authored under our commit | M — DBOS queues are internal; cross-product outbox still ours to add | M — Temporal signals are internal; cross-product outbox still ours to add | W — not a cross-product event bus |
| O-C7 idempotent exact-once effect via Fabric | **S** — effect ledger authored under our schema | S — via port + our effect ledger | M — via port + our effect ledger | W — task-level, not effect-ledger-exact |
| O-C8 failure semantics (retry/compensate/cancel/kill/policy re-eval) | **S** — we author every rule | S — retries/timers built in; policy re-eval + kill re-read ours | S — rich primitives; but authored in Temporal's model | M — retries yes; policy re-eval/kill re-read not native |
| O-C9 versioned immutable definitions | **S** — definition table is ours | M — DBOS versions workflows its own way (drain **UNKNOWN**) | M — Temporal versioning is its own API | W — flow versioning is deployment-shaped |
| O-C10 permissive license / offline | **S** — no third-party runtime | **S** — MIT, same Postgres, offline | S — MIT, but heavy offline install | S — Apache-2.0 |
| **Verdict** | **Recommended primary** | **Pre-qualified spike-gated fallback (same port)** | **Rejected for T0/T1** | **Rejected** |

## 5. Security / replay / failure analysis

INFERENCE throughout, reasoned from §1–§4 and the accepted ADR-0006 model; no capability exists.

**Replay / audit fidelity (O-C3, O-C9).** The controller checkpoints after each evidence/tool step
into an **append-only** step table (never mutated — the SOC `soar_step_results` discipline, §2.2);
a **retry is a new appended attempt** referencing the same logical step and the same **immutable,
digest-pinned workflow-definition version**, never an in-place rewrite of history. Cancellation
transitions to `cancelled` **without deleting receipts** (`03 §6.2`). This keeps the full trajectory
inspectable for `08 §2` regardless of which substrate sits under the port.

**Durable long-wait + resume (O-C2, O-C8).** `waiting_approval` is a durable state with a durable
**timer** row (due-time persisted), so a days-long wait survives any number of restarts. On resume,
the controller **re-reads the kill switch** (cooperative, fail-closed — the SOC DB-kill-switch
pattern) and **re-evaluates the policy digest**: per `03 §9.2`, a change of target/parameters/tool
version/policy digest **invalidates a stale approval**, so resume must re-check freshness before any
effect, never blind-replay an approval captured before the restart (`05 §11`: idempotency is not
replay authority after approval expiry).

**Exact-once-effect illusion (O-C7 — the ADR-0003 ↔ ADR-0004 seam).** No substrate gives true
exactly-once across a network. The illusion is assembled: (a) the outbox delivers cross-product
events **at-least-once** and consumers **dedup `event_id`** (`05 §2.2`, `05 §7`); (b) the Fabric
Gateway/Scheduler **dedup** by idempotency key (`03 §7.1`, ADR-0004); (c) the orchestration
**effect ledger** records "key K → applied, receipt R" so that on resume/retry the controller checks
the ledger and **does not re-issue an already-applied effect**. The signed **receipt** (ADR-0006 E5,
Fabric-side) is the durable proof folded back. Mandatory effect ledger = the exact-once-effect
illusion; without it, at-least-once + retry would double-apply.

**Cross-product isolation (O-C5).** Orchestration tables live in the **same PostgreSQL** as Cyber
AI but in a **separate orchestration schema** from the Investigation Graph/Bundle, under RLS `FORCE`
with the transaction-local tenant GUC (SOC `database.py` pattern), and **never** join a cross-product
database (`03 §3.2`). This is straightforward for the in-house option (our schema) but is the
DBOS-specific **UNKNOWN**: DBOS state lives in its own `dbos.*` system tables (§3.2), so RLS-FORCE
applicability there must be proven before DBOS can be the substrate (H2, §10).

**Failure map (O-C8), from `03 §13`.** Model runtime down → investigation `partial/failed`, request
not lost (durable state). Fabric unavailable → **wait/retry within budget** (durable timer + budget).
Approval service unavailable → **fail closed**. Audit/receipt store unavailable → R2/R3 **fail
closed**. Event-bus lag → backpressure, **no drop, outbox replay** (the outbox is the replay buffer).
Policy version change mid-run → **re-evaluate before action**. Every branch is expressible over
durable Postgres state + an outbox; none requires a third-party engine, though DBOS/Temporal would
provide some of the retry/timer plumbing off the shelf.

## 6. RECOMMENDATION (not a decision) + counterargument

For a **future** Founder decision at GATE A4 (Wave 2). None of this accepts ADR-0003; ADR status
stays `PROPOSED — NOT DECIDED`, this packet stays `DRAFT`. Accepted ADR-0002 now fixes the
CYBRIK-owned deterministic controller and single-PostgreSQL starting posture assumed below.

1. **Substrate = in-house PostgreSQL durable state machine behind a narrow `DurableExecutionPort`.**
   Workflow-definition (immutable/versioned/digest), instance/state, append-only step/checkpoint,
   durable timer, idempotency/effect ledger, and transactional outbox tables — in the **same
   PostgreSQL**, a **separate orchestration schema** from the Investigation Graph/Bundle, **RLS
   `FORCE`**, no cross-product join. The **CYBRIK deterministic domain controller remains the
   authority**; the substrate only persists state below it (O-C1). *(directional; the **port** is
   the hedge)*
2. **DBOS (MIT) pre-qualified as a spike-gated fallback behind the same port.** Because DBOS matches
   the recommended shape (same Postgres, resume-from-last-step, MIT), it is the ready alternative if
   the in-house invariants prove unreliable — but only **behind the identical `DurableExecutionPort`**
   and only if its system-schema RLS / default-telemetry / version-drain UNKNOWNs resolve (H2, §10).
3. **Reject Temporal for T0/T1** on operational + air-gap + RLS-external footprint (§3.3, §7): a
   separate multi-role server + its own persistence + a visibility store, with workflow state outside
   CYBRIK's RLS-FORCE Postgres and a history that competes with the domain state machine (O-C1/O-C4/
   O-C5). *(revisitable only at large T2 scale, not now)*
4. **Reject Prefect**: its flow-run/observability model is not the deterministic durable substrate
   with digest-bound resumable approvals and exact-once effect semantics that ADR-0003 requires
   (§3.4, O-C1/O-C7).
5. **Cross-product outbox is mandatory regardless of engine** (`03 §3.2`, `05 §2.2`): at-least-once
   delivery + consumer idempotency / `event_id` dedup. Even DBOS/Temporal's internal queues do not
   remove the need for the transactional outbox that bridges a Cyber-AI DB commit to the cross-product
   bus (the E4 bus). *(fixed by strategy)*
6. **Same PostgreSQL, separate orchestration schema, RLS FORCE, no cross-product DB joins** (O-C5).
7. **Failure/replay semantics are substrate-independent and mandatory** (§5): durable days-long
   `waiting_approval`; **policy-digest re-evaluation at resume**; **versioned immutable workflow
   definitions**; **a retry is a new attempt, never a history mutation**; **cooperative cancel +
   kill-switch re-read** on resume; **typed/bounded nodes** (timeout/retry/max-fan-out, no unbounded
   loops); **exact-once-effect illusion through a mandatory effect ledger**.
8. **Authorize the A4 comparison spike** (§10) rather than deciding the substrate on paper.

**Counterargument (stated honestly, ours to answer).** The strongest case against #1 is that
**DBOS already provides**, off the shelf and MIT-licensed in the same Postgres, the checkpoint,
resume-from-last-step, durable queue, and timer machinery that the in-house option asks CYBRIK to
**build and prove** — so for a solo founder, adopting DBOS first looks like *less* work and *less*
risk than hand-rolling durable-execution plumbing (a classic "don't build your own workflow engine"
argument). We answer, but do not dismiss, it: (a) the deterministic controller, the effect ledger,
the RLS-FORCE orchestration schema, and policy-digest-at-resume are CYBRIK-owned **either way** —
they sit *above* the port — so the marginal in-house build is the checkpoint/timer/resume/relay
tables only, over a Postgres pattern SOC already runs (RLS FORCE, append-only, `ON CONFLICT` dedup,
`asyncio.sleep` sweeper); (b) DBOS keeps its state in **DBOS-owned `dbos.*` system tables**, so
adopting DBOS as the *substrate* means proving RLS FORCE, tenant isolation, offline/no-telemetry
operation, and version-drain **against a schema CYBRIK does not own** — unresolved UNKNOWNs (§3.2)
that are riskier at T2 air-gap than owning the tables outright; (c) the **narrow port makes the
choice reversible** — start in-house to hold every invariant from day one, spike DBOS in parallel,
and **flip to DBOS only if the in-house invariants prove unreliable *and* the DBOS UNKNOWNs
resolve**. If the spike shows the in-house resume/timer machinery is fragile and DBOS's system-schema
RLS is clean, the recommendation inverts — that is the point of pre-qualifying DBOS behind the same
port rather than rejecting it.

**Consequences the decider accepts if following this:** a durable-execution substrate to **build and
prove** in-house (checkpoint/timer/resume/outbox), taken as the price of owning every invariant; a
standing obligation to keep the controller authority in CYBRIK domain code (O-C1); an orchestration
schema to govern under ADR-0001 alongside the Investigation Graph/Bundle; and an **open dependency**
on the ADR-0004 approval-ingress gap (§2.4) that must close before the `Alert→…→Approval→Receipt→Case`
slice runs end-to-end.

## 7. Rejected alternatives

- **Temporal as the T0/T1 substrate — rejected** (§3.3): a separate multi-role server + its own
  persistence datastore + a visibility store is disproportionate operational and air-gap footprint
  for a solo founder (O-C4), places workflow state **outside** CYBRIK's RLS-FORCE Postgres (O-C5),
  and makes Temporal's workflow history a competing source of truth against the CYBRIK domain state
  machine (O-C1). Its MIT license is not the problem; its footprint and authority posture are.
  Revisitable only if T2 scale later demands it — not now.
- **Prefect — rejected** (§3.4): a data-pipeline orchestration + observability framework whose
  flow/task-rerun model is not the per-step deterministic durable state machine with digest-bound
  resumable approvals and exact-once effect semantics ADR-0003 needs (O-C1/O-C7).
- **"Just use DBOS now, skip the in-house substrate" — not rejected; deferred to the spike.** DBOS
  is pre-qualified as the fallback behind the same port (§6.2); it is not adopted now because its
  system-schema RLS / telemetry / version-drain UNKNOWNs (§3.2, H2) are unresolved and the narrow
  port makes starting in-house reversible. This is a *measured* deferral, not a rejection.
- **Event-sourcing as the primary store (rebuild state purely by replaying an event log) — not
  recommended as the substrate**: it is a heavier consistency/replay model than the checkpoint+outbox
  the strategy names (`03 §6.1`, §14 "state machine/outbox"), and the append-only step table already
  gives replay fidelity without making the log the authority. Not selected; the outbox + checkpoint
  tables are the chosen shape.
- **No outbox / publish events directly after commit — rejected** by `03 §3.2`/`05 §2.2`: a direct
  post-commit publish loses the message on a crash between commit and publish; the outbox's
  commit-coupled at-least-once guarantee (§3.1) is mandatory.

## 8. Reversible decisions vs. deferred measured gates

- **Directional, low reversal cost (the *port* is the hedge):** the in-house-vs-DBOS substrate
  choice (§6.1/§6.2) — both sit behind the identical `DurableExecutionPort`, so swapping the
  implementation does not change the controller or the contracts above it.
- **Reversible-with-cost (decide now, migrate later if the spike demands):** in-house first, flip to
  DBOS if in-house invariants prove unreliable **and** DBOS UNKNOWNs resolve (§6.2, §10).
- **Fixed by strategy / accepted ADRs (not reopened here):** mandatory transactional outbox
  (`03 §3.2`); at-least-once + consumer idempotency (`05 §2.2`); same-Postgres/separate-schema/no
  cross-product join (`03 §3.2`); RLS FORCE (SOC pattern); envelope/identity/receipt-signing side
  (ADR-0006); anything shipped versioned under ADR-0001.
- **Deferred measured gates (do NOT decide now — each owed an explicit spike/benchmark):** in-house
  resume/timer reliability under fault injection; DBOS system-schema RLS + default-telemetry +
  version-drain (H2); the **bus product** (E4 — Kafka is named for T1/T2 by `03 §11`, but the T0
  transport and the exact broker pin are not decided here); resolution of the ADR-0004
  approval-ingress gap.

## 9. Rollout / rollback (PROPOSAL — sequencing only; nothing is built)

- **Contract-first, per ADR-0001.** No orchestration code before the `DurableExecutionPort` seam,
  the cross-product event/outbox envelope, and the ADR-0003 ↔ ADR-0004 idempotency contract are
  drafted as `PROPOSED` contracts and Founder-accepted. **This packet drafts none.**
- **Phase 0 (T0 dev-loop).** Single Postgres, in-house substrate tables in an orchestration schema,
  RLS FORCE, outbox relay as an `asyncio` sweeper (SOC `expire_worker` pattern); no bus required at
  T0 (`03 §3.2`: Kafka optional at T0). Reversible: a dev shape, not a shipped commitment.
- **Phase 1 (durability invariants).** Prove restart-during-approval-wait, clock-injected timers,
  two-tenant RLS, and zero-duplicate-effect **before** any autonomous capability — mirrors the
  `08 §9` A4 activation gate (per-capability/tenant enablement, shadow window, kill switch, TTL/
  rollback), not a date.
- **Phase 2 (cross-product bus).** Introduce the E4 bus (Kafka at T1/T2 per `03 §11`) behind the
  outbox; the outbox is the parity/replay buffer (`03 §13`).
- **Rollback.** Because the port is narrow and the substrate is dumb tables, swapping in-house → DBOS
  (or back) is an implementation change behind the port, not a contract change (ADR-0001 N-1). A
  runaway workflow is stopped by the kill switch (fail-closed) + budget exhaustion, not a data
  migration. No autonomous capability is enabled without passing the A4 gate.

## 10. Validation / spike plan — the A4 comparison spike (planned, NOT executed)

**Define the A4 comparison spike** to decide the substrate on measurement, not paper. It runs the
**same `DurableExecutionPort` contract** against **both** the in-house implementation and DBOS and
asserts identical, mandatory invariants:

1. **Restart during approval wait.** Start a workflow into `waiting_approval`, kill the process, wait
   past a timer boundary, restart → the workflow resumes in `waiting_approval`, the durable timer is
   intact, the kill switch is re-read, and the policy digest is re-evaluated before any effect (no
   blind approval replay — `03 §9.2`, `05 §11`).
2. **Clock-injected timers.** With an injected clock, a days-long timer fires deterministically at
   the due time across restarts (no wall-clock flakiness; days compressed in test).
3. **Two-tenant RLS.** Two tenants run concurrent workflows; assert **zero** cross-tenant read/write
   of orchestration state under RLS FORCE — for the in-house schema **and** (the DBOS-specific
   question) for DBOS's `dbos.*` system tables.
4. **Zero duplicate effects.** Force retries/redeliveries and a mid-flight restart; assert the effect
   ledger + Fabric dedup yield **exactly one** applied effect per idempotency key (the exact-once
   illusion), with the receipt folded back once.
5. **DBOS-specific UNKNOWNs (H2).** Resolve: can RLS FORCE + the tenant GUC be applied to DBOS system
   tables without breaking DBOS; does DBOS emit any default telemetry that must be disabled for
   air-gap; how does DBOS drain in-flight workflows across a **version** change during rolling
   upgrade.

**Flip rule.** Recommend the in-house substrate as primary; **flip to DBOS only if** the in-house
invariants (1–4) **prove unreliable** under this spike **and** the DBOS UNKNOWNs (5) **resolve**
cleanly. If both are clean, in-house holds (it owns the schema); if in-house is fragile and DBOS is
clean, the port makes the flip a behind-the-seam change.

**Status:** all of the above is **planned, not executed**. No substrate, port, table, timer, outbox,
or effect ledger exists to run it against. `NOT IMPLEMENTED`.

## 11. Risk register

| # | Risk | Likelihood / impact if unmanaged | Mitigation in the recommendation |
|---|---|---|---|
| RK-1 | In-house resume/timer machinery is subtly wrong (lost/duplicated resume) | Med / High | A4 spike tests 1/2/4 before any autonomous capability; DBOS pre-qualified behind the same port as the ready flip (§6.2). |
| RK-2 | Effect ledger missing/incomplete → at-least-once double-applies a tool effect | Med / High | Effect ledger is **mandatory** (§5, §6.7); Fabric dedup + `event_id` dedup layered on top; spike test 4 asserts zero duplicates. |
| RK-3 | Blind approval replay on resume after a policy/target change | Low / Critical | Policy-digest re-evaluation + kill-switch re-read at resume (§5); `03 §9.2` / `05 §11`; spike test 1. |
| RK-4 | DBOS system-schema cannot take RLS FORCE / leaks tenant data | Med / High (if DBOS adopted) | DBOS is spike-gated, not adopted now; H2/test-3/5 must resolve before any flip. |
| RK-5 | Temporal-style external state store adopted, breaking RLS/authority posture | Low / High | Temporal rejected for T0/T1 (§7); state stays in CYBRIK RLS-FORCE Postgres. |
| RK-6 | Outbox omitted "because the engine has queues" → lost cross-product events on crash | Med / High | Outbox mandatory regardless of engine (§6.5); `03 §3.2`/`05 §2.2`. |
| RK-7 | ADR-0004 approval-ingress gap never closes → slice cannot run end-to-end | High (today) / High | Surfaced as an open cross-product dependency (§2.4); not claimed closed; slice blocked until a durable digest-bound approval-ingress contract lands under ADR-0001. |
| RK-8 | ADR-0002 later superseded in a way that moves controller authority or storage posture | Low / High | ADR-0002 is accepted as recommended; any future superseding ADR must explicitly re-evaluate this substrate boundary. |
| RK-9 | Orchestration schema drifts into cross-product joins with Investigation Graph/Bundle | Low / High | Separate schema + "no cross-product DB join" invariant (`03 §3.2`, §6.6); cross-tenant/cross-product tests (`03 §8.2`). |
| RK-10 | Workflow-definition versioning done by history mutation → broken replay/audit | Low / Med | Immutable versioned definitions + append-only history; a retry is a new attempt (§5, O-C9). |

## 12. GATE A4 — Founder decisions required + draft acceptance text

**These questions are posed for a future GATE A4, which is NOT open.** This packet neither opens nor
closes that gate; it is read-ahead research. Answer form and recommended answer in the last column.
Reversibility per §8.

### 12.1 Decision questions (exact, answerable) — H1–H11

| # | Question | Form | Recommended |
|---|---|---|---|
| H1 | Substrate = **in-house PostgreSQL durable state machine behind a narrow `DurableExecutionPort`** (definition/state/step-checkpoint/timer/idempotency-effect-ledger/outbox tables), with the CYBRIK deterministic domain controller remaining the authority above the port? *(conditional on ADR-0002 in-house-controller recommendation)* | yes/no | **yes** (directional; port is the hedge) |
| H2 | **DBOS (MIT) pre-qualified as a spike-gated fallback behind the same port**, adoptable only if its system-schema **RLS / default-telemetry / version-drain** UNKNOWNs resolve (H2 spike, §10.5)? | yes/no | **yes** |
| H3 | **Reject Temporal (T0/T1) and reject Prefect** as the substrate — Temporal for operational/air-gap/RLS-external footprint, Prefect because flow-rerun/observability is not the required deterministic durable substrate? | yes/no | **yes** (Temporal revisitable only at large T2 scale) |
| H4 | Orchestration state in the **same PostgreSQL** but a **separate orchestration schema** from the Investigation Graph/Bundle, **RLS FORCE**, **no cross-product DB joins**? | yes/no | **yes** |
| H5 | The **CYBRIK deterministic controller stays the authority** (validates the LLM plan, picks allowed transitions, owns budgets/typed-bounded nodes); the substrate only persists state below it (`03 §6.2`, `03 §11`)? | yes/no | **yes** (fixed by strategy) |
| H6 | **Failure semantics** are mandatory and substrate-independent: durable days-long `waiting_approval`; **policy-digest re-evaluation at resume**; **cooperative cancel + kill-switch re-read**; retry/compensation/timeout; cancellation never loses receipts (`03 §13`, `03 §9.2`, `03 §6.2`)? | yes/no | **yes** |
| H7 | The **ADR-0003 ↔ ADR-0004 idempotency contract** = orchestration mints an idempotency key per intended effect + a **mandatory effect ledger**; Fabric scheduler dedups; together they give the **exact-once-effect illusion** (`05 §11`, `03 §7.1`)? | yes/no | **yes** |
| H8 | **Cross-product transactional outbox is mandatory regardless of engine** (at-least-once + consumer idempotency / `event_id` dedup), and the **E4 bus choice** (Kafka named for T1/T2) is owned here but its exact broker pin deferred (`03 §3.2`, `05 §2.2`, ADR-0006 E4)? | yes/no | **yes** (outbox now; broker pin deferred) |
| H9 | **Workflow definitions are versioned + immutable + digest-pinned**, and **a retry is a new attempt rather than a mutation of history** (append-only), preserving replay/audit fidelity (`05 §9`, `03 §6.2`)? | yes/no | **yes** |
| H10 | **Authorize the A4 comparison spike** (§10: restart-during-approval-wait; clock-injected timers; two-tenant RLS; zero duplicate effects; DBOS system-schema RLS/telemetry/version-drain) with the flip rule "in-house primary; flip to DBOS only if in-house invariants prove unreliable **and** DBOS UNKNOWNs resolve"? | yes/no | **yes** |
| H11 | **Endorse the carried unknowns (§14) as deferrals** — bus/broker pin, DBOS UNKNOWNs, in-house resume reliability, the ADR-0004 approval-ingress gap, and the dependency on ADR-0002 acceptance — rather than deciding them now? | yes/no | **yes** |

### 12.2 DRAFT acceptance text (PROPOSED WORDING ONLY — NOT AN ACCEPTANCE)

The following is *draft* wording a future acceptance record **would** use **if** the Founder answers
H1–H11 as recommended at a future GATE A4 **and** ADR-0002 is first accepted as recommended. It is
**not** an acceptance, changes **no** status, and is included only so the Founder can see the exact
commitment. Per ADR-0001 D5, any status flip requires explicit Founder authorization recorded with
evidence links; no agent may infer approval. This packet leaves ADR-0003 `PROPOSED — NOT DECIDED`
and GATE A4 unopened.

> *(DRAFT — do not apply without a Founder gate; presupposes ADR-0002 accepted as recommended.)*
> "ADR-0003 is `ACCEPTED`. The Founder decided H1–H11 at GATE A4 (Wave 2) on `<DATE>`: adopt an
> **in-house PostgreSQL durable state machine behind a narrow `DurableExecutionPort`** — workflow-
> definition (immutable/versioned/digest), state, append-only step/checkpoint, durable timer,
> idempotency/effect-ledger, and transactional-outbox tables — with the **CYBRIK deterministic
> domain controller** remaining the authority above the port (H1, H5); **pre-qualify DBOS (MIT) as a
> spike-gated fallback behind the same port** (H2); **reject Temporal for T0/T1 and reject Prefect**
> as the substrate (H3); keep orchestration state in the **same PostgreSQL, a separate schema from
> the Investigation Graph/Bundle, RLS FORCE, no cross-product joins** (H4); require durable days-long
> `waiting_approval`, **policy-digest re-evaluation at resume**, cooperative cancel with kill-switch
> re-read, retry/compensation/timeout, and receipts never lost on cancellation (H6); assemble the
> **exact-once-effect illusion** from a mandatory effect ledger + Fabric dedup as the ADR-0003 ↔
> ADR-0004 idempotency contract (H7); make the **transactional outbox mandatory regardless of
> engine** with at-least-once + `event_id` dedup and own the E4 bus choice while deferring the exact
> broker pin (H8); keep **workflow definitions immutable/versioned** with retries as new attempts,
> never history mutation (H9); **authorize the A4 comparison spike** with the stated flip rule (H10);
> and **endorse the carried unknowns as deferrals** (H11). Status flip applied by an AI agent under
> explicit Founder authorization per ADR-0001 D5; no agent inferred approval. `NOT IMPLEMENTED`:
> this ADR accepts the substrate **model** only; no controller, substrate, port, table, timer,
> outbox, effect ledger, or bus exists in code."

## 13. Source register

Primary/official sources only; secondary/marketing sources are inadmissible per README hard rules.
Internal references are repository documents/code read on 2026-07-24.

| ID | Source | Type | Used for | Accessed / read |
|---|---|---|---|---|
| S1 | Transactional Outbox pattern — <https://microservices.io/patterns/data/transactional-outbox.html> | Primary (pattern author, Chris Richardson) | §3.1/§5 outbox definition + at-least-once guarantee | 2026-07-24 |
| S2 | DBOS docs (overview) — <https://docs.dbos.dev/> | Primary (official project) | §3.2 durability/resume/queues | 2026-07-24 |
| S3 | DBOS Transact (Python) repo + LICENSE — <https://github.com/dbos-inc/dbos-transact-py> | Primary (official project) | §3.2 MIT license, checkpoint/resume | 2026-07-24 |
| S4 | DBOS system tables — <https://docs.dbos.dev/explanations/system-tables> | Primary (official project) | §3.2/§5 `dbos.*` system schema | 2026-07-24 |
| S5 | Temporal server repo + LICENSE — <https://github.com/temporalio/temporal> | Primary (official project) | §3.3 MIT license, platform shape | 2026-07-24 |
| S6 | Temporal clusters/service — <https://docs.temporal.io/clusters> | Primary (official project) | §3.3 server components | 2026-07-24 |
| S7 | Temporal persistence — <https://docs.temporal.io/temporal-service/persistence> | Primary (official project) | §3.3 separate datastore + visibility store | 2026-07-24 |
| S8 | Prefect repo + LICENSE — <https://github.com/PrefectHQ/prefect> | Primary (official project) | §3.4 Apache-2.0, data-pipeline framework | 2026-07-24 |
| I1 | `../../strategy/03-REFERENCE-ARCHITECTURE.md` §3.2/§6.1/§6.2/§9.2/§13/§14 | Internal doc (`PROPOSAL`) | Durable Orchestrator scope, rules, failure map, outbox mandate | read 2026-07-24 |
| I2 | `../../strategy/05-CONTRACTS-AND-INTEGRATION.md` §1/§2.2/§7/§9/§11 | Internal doc (`PROPOSAL`) | Outbox, at-least-once, dedup, immutable revisions, idempotency-not-replay | read 2026-07-24 |
| I3 | `../../strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` §2/§9 | Internal doc (`PROPOSAL`) | Trajectory eval; A4 activation gate | read 2026-07-24 |
| I4 | Accepted [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md) E1/E4/E5/E6/E7 | Internal ADR (`ACCEPTED`) | Envelope; **bus deferred to ADR-0003 (E4)**; receipt-signing side | read 2026-07-24 |
| I5 | Accepted [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md) D1/D4/D5 | Internal ADR (`ACCEPTED`) | Versioning, format pins (AsyncAPI 3.0.0), acceptance mechanics | read 2026-07-24 |
| I6 | [ADR-0002](../ADR-0002-cyber-ai-implementation-stack.md) + [evidence](ADR-0002-EVIDENCE.md) §3.4/§4.6 | Internal ADR (`ACCEPTED` 2026-07-24) + packet (`DRAFT`) | Upstream: in-house controller accepted; durability deferred here | read/decided 2026-07-24 |
| I7 | [ADR-0004 evidence](ADR-0004-EVIDENCE.md) §2.7 | Internal packet (`DRAFT`) | Recorded SOC approval-ingress/durability gap | read 2026-07-24 |
| C1 | `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/soar/{engine,runtime,orm,audit,api,expire_worker,guards}.py` | Cross-repo code state | §2.2 in-memory state machine, no-resume, append-only ledgers, TTL sweep | read 2026-07-24 |
| C2 | `cybrik-soc-command-center:services/api/src/cybrik_soc/platform/{database,audit_support,provenance}.py` | Cross-repo code state | §2.2 RLS FORCE + tenant GUC, append-only audit, provenance | read 2026-07-24 |
| C3 | `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/ingest/service.py` + `alembic/versions/*.py` | Cross-repo code state | §2.2 durable `ON CONFLICT` dedup, nonces; RLS FORCE migrations; no outbox | read 2026-07-24 |
| C4 | `cybrik-soc-command-center:services/api/pyproject.toml` | Cross-repo code state | §2.2 SOC stack (py>=3.11, SQLAlchemy async, asyncpg, Alembic) | read 2026-07-24 |

## 14. Evidence limitations / carried unknowns

1. **Upstream dependency resolved after packet drafting.** GATE A3 closed 2026-07-24 and ADR-0002
   accepted the in-house-controller / single-PostgreSQL starting posture as recommended. This is
   no longer an unknown; any future ADR-0002 supersession must re-evaluate this packet.
2. **DBOS system-schema RLS / default-telemetry / version-drain.** Whether RLS FORCE + tenant GUC
   apply cleanly to DBOS `dbos.*` system tables, whether DBOS emits default telemetry needing an
   air-gap opt-out, and how DBOS drains in-flight workflows across a version change — not measured.
   `UNKNOWN` (§3.2, §10.5, H2).
3. **In-house resume/timer reliability.** The correctness of hand-built checkpoint/timer/resume/relay
   machinery under fault injection is asserted, not measured; the A4 spike (§10) is the proof, unrun.
   `UNKNOWN`.
4. **Bus/broker pin.** Kafka is named for T1/T2 (`03 §11`) but the E4 bus product, the T0 transport,
   and the exact broker version pin (under ADR-0001 D4 / AsyncAPI 3.0.0) are not decided here.
   `UNKNOWN`.
5. **ADR-0004 approval-ingress gap.** No accepted cross-product contract exists for a durable,
   digest-bound, restart-surviving approval ingress/return (ADR-0004 evidence §2.7); ADR-0003 depends
   on it and cannot close it. `UNKNOWN`.
6. **External claims** were verified against the official pages/repos listed in the source register
   via their published content on 2026-07-24 (transactional-outbox pattern page; DBOS docs + repo +
   system-tables page; Temporal repo + clusters + persistence docs; Prefect repo). Component
   **licenses** (DBOS MIT, Temporal MIT, Prefect Apache-2.0) were read from each project's stated
   license/badge but not re-opened `LICENSE`-file-by-file here; no engine was installed, built, or
   benchmarked.
7. **SOC code citations** (§2.2, source register C1–C4) are existing state in another repository, read
   read-only on 2026-07-24 as a durability seed and to record a gap — **not** a claim of Cyber AI
   capability. The SOC SOAR engine is implemented and test-covered *in the SOC repo* as an explicitly
   in-memory Phase-1 engine with resume deferred ("PF-3"); nothing in `cybrik-cyber-ai-platform` is.
8. **Nothing in the suite is implemented.** No durable orchestrator, `DurableExecutionPort`, state/
   step/checkpoint/timer/idempotency/effect-ledger table, transactional outbox, event bus, or
   deterministic controller is built, wired, or piloted in `cybrik-cyber-ai-platform` — it is a
   documentation-only scaffold. `NOT IMPLEMENTED`. This packet is research + proposal + a
   recommendation; it accepts nothing and opens no gate.
