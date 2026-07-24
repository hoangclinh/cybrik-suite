# CYBRIK Suite overnight handoff — 2026-07-24

- Status: `REVIEW BRANCH HANDOFF — GATE A3/WAVE 2 COMMIT AND PUSH AUTHORIZED; NO MERGE`
- Working window: coordinated Claude CLI work through the requested 05:00 cutoff; final audit
  and documentation reconciliation completed after the cutoff.
- Priority applied: `cybrik-soc-command-center` first; architecture evidence for
  `cybrik-cyber-ai-platform` and `cybrik-security-tool-fabric` second.
- Authority boundary: overnight delegation covered technical recommendations and SOC seam
  decisions. It did **not** authorize an ADR status-flip under ADR-0001 D5, product source-code
  creation behind proposed ADRs, deployment, secrets, migration, or remote push.

## 1. Repository state at handoff

| Repository | Branch | State | Remote action |
|---|---|---|---|
| `cybrik-soc-command-center` | `codex/overnight-s16-1` | Clean; four local commits above `267c698` | No push |
| `cybrik-suite` | `codex/overnight-wave1-adr` | GATE A3 decision record plus Wave 2 DRAFT evidence | Review-branch commit/push authorized; no merge |
| `cybrik-cyber-ai-platform` | `main` | Clean at `2635485` | No change/push |
| `cybrik-security-tool-fabric` | `main` | Clean at `beb01d7` | No change/push |

SOC local commits:

1. `95e3108` — `feat(ingest): add feature-flagged PF dual-write hook`
2. `d84ee16` — `fix(ingest): bound PF dual-write latency`
3. `27dde58` — `feat(siem): version correlated envelope for Alert Writer`
4. `7273c30` — `docs(siem): record delegated Alert Writer seam decision`

## 2. SOC outcomes

### 2.1 S16-1 dual-write seam

- Feature-flagged, default-off at-least-once PF dual-write hook exists.
- Downstream idempotency remains keyed by `raw_event_id`.
- Producer wait is bounded to 0.5 seconds; failure does not fabricate success.
- Independent review found no P0/P1. The main P2 risk remains: the awaited producer call is
  still inside the database transaction and can hold it up to the bound. Do not activate a real
  connector until S16-2 slow-broker/connection-pool soak proves the bound is acceptable.

Verification recorded during the window:

- Targeted dual-write tests: 18 passed.
- Ruff and mypy: passed.
- Full API unit suite at that slice: 1744 passed.

### 2.2 Correlated envelope v2 prerequisite for Alert Writer

Implemented and committed locally:

- `tenant_id`, `id`, `source_alert_id`, `label_floor`, and `envelope_version` are present in the
  internal `correlated` envelope.
- `id == source_alert_id == dedup_key`; Kafka key remains the same `dedup_key`.
- QD-13 label floor is monotonic maximum for the group lifetime. A valid `toi_mat` contributor
  is never downgraded. Mixed monitored systems produce `monitored_system = null`.
- Old Valkey hashes without label fields remain loadable. Invalid or inconsistent stored label
  fields fail safely to a valid default and cannot emit an unknown classification.
- Matcher projection carries only the resolved normalized `labels` block, never the raw payload.

Deliberate trade-off:

- The label floor can **overclassify until the group TTL expires** after a high-label event leaves
  the sliding window. This is an explicit safety bias; it must not be represented as an exact
  per-burst classification.

Verification:

- API SIEM targeted tests: 75 passed.
- Full fast API unit suite: 1762 passed.
- PF correlation logic with dependency stubs: 11 passed.
- PF matcher suite with dependency stubs: 26 passed.
- Independent final rerun: 75 + 11 + 26 passed.
- Ruff and `git diff --check`: passed.
- Real Valkey/Kafka parity, T1 integration, and staging were not run.

### 2.3 Alert Writer seam decision

Technical decision recorded under the overnight delegation:

1. Correlation/matcher read `events.normalized`.
2. Alert Writer consumes only `correlated`, which is already alert-shaped.
3. Per-event `detections` do **not** become alerts in S16; they remain hunt/inspection data until
   a later noise-policy decision.
4. Alert Writer uses the existing authenticated ingest path (HTTP/HMAC) rather than inserting
   directly into alert tables.
5. Delivery is at-least-once and the receiver is idempotent.

Still `NOT IMPLEMENTED`:

- Alert Writer worker.
- Per-tenant internal connector route and HMAC secret provisioning.
- Ingest enforcement that may raise but never lower QD-13 label floor.
- Alert-Writer DLQ/replay support.
- Real-cluster activation and end-to-end proof to `/alerts`.

## 3. Suite ADR evidence

### 3.1 Wave 1 — GATE A3 closed 2026-07-24

Prepared and accepted by explicit Founder approval:

- `ADR-0002-EVIDENCE.md`: recommends Python 3.12 with 3.11 fallback on wheel gaps;
  FastAPI/Pydantic v2/async SQLAlchemy; a thin CYBRIK-owned OpenAI-compatible runtime seam;
  PostgreSQL + pgvector; deterministic CYBRIK controller with SDKs only as libraries.
- `ADR-0004-EVIDENCE.md`: recommends a separate Tool Fabric control plane and executor tier;
  disposable isolation for untrusted classes; control-side credential/egress brokers; mTLS
  workload identity; control-plane-signed receipts and executor attestation.
- `FOUNDER-DECISION-PACKET-WAVE-1.md`: exact Founder-approved G1–G7 and F1–F9 answers.

ADR-0002 and ADR-0004 are `ACCEPTED`. Product implementation remains contract-first: required
cross-product interfaces must still be proposed and explicitly accepted under ADR-0001 before
product code implements them.

### 3.2 Wave 2 read-ahead — GATE A4 is not open

- `ADR-0003-EVIDENCE.md` (619 lines): recommends a CYBRIK-owned PostgreSQL durable state machine
  behind `DurableExecutionPort`, with DBOS as a spike-gated fallback; mandatory outbox,
  idempotency/effect ledger, durable approval wait, versioned immutable workflows, and
  policy-digest re-evaluation on resume.
- `ADR-0005-EVIDENCE.md` (625 lines): recommends hardened rootless OCI for S0/S4, gVisor for S1,
  Firecracker microVM as the mandatory S2/S3 floor, Kata as the Kubernetes portability wrapper,
  fail-closed downgrade rules, and macOS as dev-loop-only.

Both packets passed `git diff --check` and local-link validation. They are recommendations only.
A Wave 2 decision packet is still owed after GATE A3; ADR-0003/ADR-0005 remain `PROPOSED`.

## 4. Unchanged governance and release blockers

- ADR-0001, ADR-0002, ADR-0004, and ADR-0006 are accepted suite ADRs.
- GATE A3 is closed; GATE A4 is not open.
- RB-001 remains `BLOCKING — OPEN`: a verified responsible-disclosure channel is required before
  any external release.
- No product dependency, source tree, database, deployment, secret, remote, or production state
  changed during this window.

## 5. Recommended continuation order

1. In SOC, run S16-2 slow-broker/pool soak and real Valkey/Kafka parity before enabling dual-write.
2. Implement the smallest safe S16-3 continuation: opt-in ingest label-floor enforcement that
   can only raise labels, plus a tenant-specific internal connector route; keep defaults off.
3. Implement Alert Writer with fresh HMAC nonce/timestamp per retry, `dedup_key` as both body ID
   and idempotency key, explicit retry/terminal status taxonomy, and DLQ replay.
4. Prove the complete chain on T1:
   `events.normalized → detections → correlated → Alert Writer → ingest → /alerts`.
5. Draft and accept the required cross-product contracts under ADR-0001 before product code
   implements them. Then prepare the Wave 2 decision packet and open GATE A4.

## 6. Do not claim

- No SOC Alert Writer or full S16 vertical slice exists yet.
- No Cyber AI Platform or Tool Fabric runtime exists yet.
- No real sandbox, durable orchestrator, model runtime, MCP gateway, or external approval ingress
  was implemented or piloted.
- No branch in this handoff was pushed.
