# ADR-0006 Evidence Packet — Cross-product event and identity model

- Status: `DRAFT` — recommendation only. *Status note 2026-07-24:* the backed ADR was
  since `ACCEPTED` by the Founder ([ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md));
  this packet is retained unmodified as decision provenance (E6 was accepted in revised
  conditional form — see the ADR).
- Date: 2026-07-23
- Backs: [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md)
- Scope: event envelope standard, analyst/workload identity, tenant/classification
  propagation, causation/correlation, analyst→agent→tool delegation chain, receipt
  integrity. Versioning of all of it inherits ADR-0001's policy.

## 1. Decision criteria

| # | Criterion | Why it matters |
|---|---|---|
| E-C1 | Auditability/replay | Full analyst→agent→tool chain must be reconstructable from stored events/receipts (strategy document 03 §1.5) |
| E-C2 | Sovereign/air-gap fit | No external IdP or internet dependency; offline verification (T2) |
| E-C3 | Tenant/classification propagation | Tenant, clearance, TLP/marking must ride every hop and be enforceable per store |
| E-C4 | Interop with security ecosystem | SIEM/analytics consumers should meet familiar shapes where cheap |
| E-C5 | Solo-founder operability | Fewer bespoke mechanisms; boring, well-documented standards |
| E-C6 | No model authority | Envelope/identity design must make model-generated authority fields ignorable by construction (strategy document 05 §11.1) |

## 2. External research

All URLs accessed 2026-07-23.

### 2.1 CloudEvents

- FACT — CloudEvents is a CNCF **Graduated** project (2024-01-25) specifying "event data in
  a common way"; spec line v1.0.x. <https://cloudevents.io/>
- FACT — Required context attributes: `id`, `source`, `specversion`, `type`. Optional:
  `datacontenttype`, `dataschema`, `subject`, `time`, plus `data`. Producers must ensure
  `source`+`id` uniqueness. <https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md>
- FACT — Extensions: "A CloudEvent MAY include any number of additional context attributes
  with distinct names, known as 'extension attributes'", following the same naming/type
  rules. Incompatible data-schema changes "SHOULD be reflected by a different URI"
  (`dataschema`); event `type` may carry version info.
  <https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md>
- INFERENCE — CloudEvents standardizes exactly the layer CYBRIK needs standardized (routing
  metadata + extension mechanism) and deliberately says nothing about payload domain
  semantics — which CYBRIK must own anyway.

### 2.2 OCSF

- FACT — OCSF is a Linux Foundation project (since 2024-11-19): an extensible framework
  with a vendor-agnostic core security schema — data types, attribute dictionary, taxonomy
  — expressed in JSON and "agnostic to storage format, data collection and ETL processes".
  <https://ocsf.io/>
- FACT — Current stable schema version **v1.8.0** (v1.9.0-dev in development); categories
  include System Activity, Findings, IAM, Network Activity, Discovery, Application
  Activity, Remediation, Unmanned Systems. <https://schema.ocsf.io/>
- INFERENCE — OCSF is a **payload/domain taxonomy for security telemetry**, not a transport
  envelope and not a workflow-event model. CYBRIK's suite-internal events (investigation
  lifecycle, approval decisions, receipts) have no natural OCSF class; forcing them into
  OCSF would abuse the taxonomy. Conversely, security *observations* CYBRIK emits or
  ingests do map naturally to OCSF classes.
- UNKNOWN — Whether OCSF v1.8.0 metadata attributes fully cover CYBRIK's marking needs
  (TLP + clearance + handling caveats) was not verified attribute-by-attribute.

### 2.3 SPIFFE/SPIRE

- FACT — SPIFFE is "a set of open-source standards for securely identifying software
  systems"; identities are SPIFFE IDs within a trust domain; SVIDs are short-lived
  documents in two forms, X.509-SVID and JWT-SVID; SPIRE is the reference implementation
  supporting Kubernetes, VMs, and bare metal. <https://spiffe.io/docs/latest/spiffe-about/overview/>
- INFERENCE — SPIFFE-style identity fits E-C2: trust domains are self-hosted, no external
  IdP; short-lived X.509 SVIDs give mTLS workload identity that works air-gapped. The
  strategy baseline already points this way (`../../strategy/02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md`
  §6, citing NIST SP 800-207/207A).
- UNKNOWN — SPIRE's operational footprint for a solo founder at T0 (server + agents +
  registration entries) vs. plain mTLS with an internal CA was not measured. The *model*
  (SPIFFE-style IDs, short-lived credentials) can be decided independently of the
  *implementation* (SPIRE vs. minimal internal issuer); ADR-0004 evidence should measure.

### 2.4 Correlation and tracing

- RESEARCH — Strategy document 05 §2.1 already adopts W3C Trace Context (`traceparent`) for
  request tracing and defines correlation fields (`trace_id`, `investigation_id`,
  `action_id`, …) in document 08 §7.1. CloudEvents has a distributed-tracing extension in
  its spec repository, but the exact extension attributes were not verified on this pass.
  UNKNOWN until checked against the extensions documents in
  <https://github.com/cloudevents/spec>.

### 2.5 MCP position (restated)

- FACT — MCP authorization guidance forbids token passthrough and requires audience-bound,
  short-lived, least-privilege tokens (research baseline in strategy document 02 §4;
  <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>).
- PROPOSAL — MCP remains an **adapter/capability protocol** over Tool Fabric. Identity,
  policy, approval, and receipts live below MCP; nothing in this ADR may treat an MCP
  session as a trust boundary.

## 3. Option analysis — event envelope

### Option A — OCSF-aligned envelope (OCSF event classes as the envelope itself)

| Criterion | Score | Notes |
|---|---|---|
| E-C1 Audit/replay | Medium | OCSF has no causation/delegation semantics; would need heavy extension |
| E-C2 Sovereign | Strong | Just JSON, no dependency |
| E-C3 Tenant/marking | Medium | Metadata exists but CYBRIK-specific marking/clearance would be extensions anyway |
| E-C4 Interop | Strong for telemetry, weak for workflow | Investigation/approval/receipt events have no OCSF class |
| E-C5 Operability | Weak | Every suite-internal event forced through a telemetry taxonomy it doesn't fit |
| E-C6 No model authority | Neutral | Orthogonal to envelope choice |

Trade-off: excellent for the security-telemetry edge, wrong shape for the suite's own
workflow events — the majority of the vertical-slice traffic.

### Option B — CloudEvents-style envelope + typed payloads (OCSF where it fits)

Envelope = CloudEvents required/optional attributes + CYBRIK extension attributes
(tenant, marking, actor/delegation references, correlation/causation). Payload = versioned
CYBRIK JSON Schema objects for workflow events; OCSF-aligned objects where an OCSF class
genuinely fits (e.g. findings/telemetry exchanged with SIEM-facing components).

| Criterion | Score | Notes |
|---|---|---|
| E-C1 Audit/replay | Strong | `source`+`id` uniqueness, `type`+`dataschema` versioning hooks, extension attrs for causation/correlation |
| E-C2 Sovereign | Strong | Pure spec, CNCF-graduated, no service dependency |
| E-C3 Tenant/marking | Strong | First-class extension attributes, filterable at the bus/broker layer without parsing payloads |
| E-C4 Interop | Strong | Broad ecosystem support; OCSF used where the ecosystem expects OCSF |
| E-C5 Operability | Strong | One envelope for all events; payload schemas evolve under ADR-0001 |
| E-C6 No model authority | Strong (by policy) | Envelope written only by service code from authenticated context; model output can populate payload fields only, never envelope identity/tenant attributes |

Trade-off: two schema layers to govern (envelope extensions + payload schemas), and the
already-sketched envelope in strategy document 05 §2.2 (`event_id`, `event_type`,
`event_version`, …) would be renamed/aligned to CloudEvents attribute names.

### Option C — In-house envelope

The strategy document 05 §2.2 sketch, formalized as a CYBRIK-only schema.

| Criterion | Score | Notes |
|---|---|---|
| E-C1 Audit/replay | Strong (if designed well) | Full control |
| E-C2 Sovereign | Strong | No dependency |
| E-C3 Tenant/marking | Strong | Native fields |
| E-C4 Interop | Weak | Every external consumer needs a bespoke adapter |
| E-C5 Operability | Weak-to-medium | We own all documentation, edge-case semantics, and future migration alone — worst fit for a solo founder |
| E-C6 No model authority | Neutral | Same policy either way |

Trade-off: maximal control, zero leverage. INFERENCE: the in-house sketch is ~90%
attribute-equivalent to CloudEvents already, so Option C pays the bespoke-ecosystem cost to
avoid a renaming exercise.

## 4. Identity, delegation, and receipt integrity (cross-cutting, all envelope options)

All items PROPOSAL unless labeled otherwise; consistent with strategy documents 02 §6,
03 §8, 05 §2/§5, 08 §6.1.

1. **Analyst identity** stays SOC-owned. It crosses product boundaries only as a
   short-lived, audience-bound, purpose-bound **delegation token** (claims baseline:
   strategy document 03 §8.1). Cyber AI and Tool Fabric never mint analyst identity.
2. **Workload identity**: SPIFFE-style IDs per service/executor within a per-deployment
   trust domain; short-lived X.509 credentials for mTLS. Whether the issuer is SPIRE or a
   minimal internal issuer is an ADR-0004-adjacent implementation choice, not this ADR.
3. **Delegation chain** (analyst → agent → tool): an ordered list of grants. Each grant
   records grantor, grantee, purpose, resource scope, expiry, and — for tool execution —
   the `approval_id` that authorized the step. The chain travels **by reference + digest**
   (not by embedding raw tokens) in events and is embedded in execution receipts, so a
   receipt alone answers "who allowed this, on whose behalf, for what". Model/agent output
   can *request* a grant but can never *assert* one (E-C6).
4. **Tenant/classification propagation**: tenant + marking are envelope-level attributes on
   every event, claims on every token, and columns/keys in every store; body-declared
   tenant never grants authority (strategy document 05 §3).
5. **Causation/correlation**: every event carries `trace_id` (W3C Trace Context),
   a correlation ID for the business thread (`investigation_id`), and a causation reference
   (the `id` of the event/request that directly caused this one), enabling replay as a
   DAG, not just a time-sorted list.
6. **Receipt integrity**: receipts are content-digested and signed per strategy document 05
   §5.5; the signing key belongs to the Tool Fabric control plane (executor attestation
   feeds it, per ADR-0004). Receipts reference policy digest, approval id, capability
   digest, and delegation-chain digest — versioned under ADR-0001.

## 5. Paper trace — six hops (ILLUSTRATIVE — NOT A CONTRACT)

Field names below are illustrative narrative, not schemas; no contract file is created by
this document.

**Hop 1 — Alert (SOC).** SOC freezes a scoped alert-context snapshot; emits
`cybrik.soc.alert.snapshot.created.v1`. Envelope: source=SOC workload identity;
tenant + marking extensions; new `trace_id`; subject=alert id; payload carries
snapshot digest. Identity: SOC service (workload); acting analyst recorded as initiator.
No delegation yet.

**Hop 2 — Investigation (Cyber AI).** SOC calls Cyber AI with a delegation token
(analyst → Cyber AI, purpose=incident_investigation, scope=case/alert ids, short TTL).
Cyber AI validates audience/tenant, creates the investigation, emits
`…investigation.created.v1`: same `trace_id`, correlation=`investigation_id`,
causation=hop-1 event id. Delegation chain now: grant #1 (analyst→AI-agent), by reference
+ digest.

**Hop 3 — Tool request (Cyber AI → Tool Fabric).** Orchestrator issues a typed capability
invocation with `action_id`, capability name+version+digest, resource scope, and the
delegation chain reference (analyst→agent). Envelope: causation=investigation step;
identity: Cyber AI workload (mTLS) carrying delegation. Fabric's policy decision (own
digest) returns `require_approval`. The model proposed the step; it asserted no authority
— tenant/actor came from token claims, not model output.

**Hop 4 — Approval (SOC human).** Fabric emits `…approval.required.v1` (causation=hop-3
request). SOC displays resolved target/params/impact to a named approver, who decides as a
SOC-authenticated human. `…approval.decided.v1` carries approver identity, decision,
target-snapshot digest, expiry. Delegation chain gains grant #2: approver→agent for exactly
this action (`approval_id`), digest-bound to capability + resolved arguments + policy
version — stale-approval rules from strategy document 05 §5.4 apply.

**Hop 5 — Receipt (Tool Fabric).** Fabric re-validates policy + approval freshness,
executes via an attested executor (executor workload identity recorded), emits
`…invocation.completed.v1` with the signed receipt: action id, capability digest, policy
decision id, `approval_id`, delegation-chain digest, executor identity, artifact digests,
side-effect record, receipt digest + signature. Causation=hop-4 decision event.

**Hop 6 — Case (SOC).** Cyber AI folds the receipt into the Investigation Bundle
(claim→evidence links). Analyst reviews the proposal in SOC and accepts; SOC writes the
case mutation **as the human analyst** under SOC RBAC/RLS, storing `investigation_id`,
`receipt_id`, bundle digest. All three ledgers (SOC business audit, AI ledger, Fabric
receipt ledger) correlate via `trace_id`/`investigation_id`/`action_id`; the whole chain
replays from stored events as a causation DAG with tenant + marking intact at every hop.

INFERENCE — Every hop above is expressible with Option B's envelope plus the identity model
of §4 without inventing mechanisms beyond: CYBRIK extension attributes, delegation grants,
and signed receipts. Nothing in this trace exists in code. `NOT IMPLEMENTED`.

## 6. RECOMMENDATION (not a decision)

**Option B — CloudEvents-style envelope with CYBRIK extension attributes; versioned CYBRIK
JSON Schema payloads for workflow events; OCSF-aligned payloads only where an OCSF class
genuinely fits**, combined with the §4 identity/delegation model:

- SPIFFE-style workload identity per deployment trust domain (issuer implementation
  deferred to ADR-0004 evidence);
- analyst identity asserted only via short-lived delegation tokens (strategy document 03
  §8.1 claims baseline);
- delegation chain as referenced, digest-bound grants embedded in receipts;
- tenant + marking as envelope attributes + token claims, enforced per store;
- causation/correlation: W3C `trace_id` + `investigation_id` correlation + per-event
  causation reference;
- receipt signing by the Fabric control plane, digests versioned under ADR-0001;
- envelope/payload versioning per ADR-0001 (event `type` carries major version, e.g.
  `…completed.v1`; payload schema evolves per contract-file SemVer).

Consequences the Founder accepts if following this: a renaming/alignment pass over the
strategy document 05 §2.2 sketch; commitment to maintaining CYBRIK extension-attribute
definitions as accepted contracts; OCSF adoption is deliberately partial (telemetry-shaped
payloads only), which must be communicated honestly in marketing/interop claims.

## 7. Founder decisions required

| # | Question | Form |
|---|---|---|
| E1 | Envelope: A (OCSF-as-envelope), B (CloudEvents-style + typed payloads), or C (in-house)? | A/B/C |
| E2 | Adopt SPIFFE-style workload identity model (IDs, trust domain per deployment, short-lived creds), with issuer implementation decided under ADR-0004 evidence? | yes/no |
| E3 | Delegation chain as ordered digest-bound grants referenced (not embedded) in events and embedded in receipts, per §4.3? | yes/no |
| E4 | Confirm the canonical bus decision (Kafka optional T0 / required T1+, per strategy document 03 §3.2) is **out of scope** for ADR-0006 — the envelope must stay bus-agnostic — and lands with ADR-0003 evidence instead? | yes/no |
| E5 | Receipt signing authority: Tool Fabric control plane signs receipts (executors attest, control plane signs)? | yes/no |
| E6 | Causation/correlation triple: W3C `trace_id` + `investigation_id` correlation + per-event causation reference, mandatory on every cross-product event? | yes/no |
| E7 | Event `type` naming keeps the existing `cybrik.<product>.<entity>.<action>.v<major>` shape from strategy document 05 §7? | yes/no |

## 8. Evidence limitations

- CloudEvents distributed-tracing extension attributes not verified in detail (UNKNOWN,
  §2.4); must be checked before any contract is drafted.
- OCSF v1.8.0 metadata/marking attribute coverage not audited attribute-by-attribute
  (UNKNOWN, §2.2).
- SPIRE operational footprint at T0 for a solo founder not measured; only the identity
  *model* is recommended here (§2.3).
- No prototype, no schema, no contract, no code exists for any of this. Everything in this
  packet is research and proposal. `NOT IMPLEMENTED`.
- Delivery guarantees (at-least-once, outbox, dedup) are restated from strategy sketches;
  they harden into decisions under ADR-0003, not here.
