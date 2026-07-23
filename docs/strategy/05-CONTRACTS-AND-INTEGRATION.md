# Preliminary Contracts and Integration Profile

- **Ngày:** 2026-07-22
- **Trạng thái:** [PROPOSAL — contract v0, chưa dùng production]
- **Mục tiêu:** định nghĩa semantic boundary trước khi tạo repository hoặc code

## 1. Contract principles

1. Contract-first: JSON Schema/OpenAPI/AsyncAPI là source of truth; SDK sinh tự động.
2. Breaking change cần major version; additive field không được đổi semantic field cũ.
3. Mọi mutation/job create có idempotency key.
4. Mọi request có tenant, purpose, actor/delegation, trace và data marking.
5. Không gửi raw credential/secret/model key qua contract.
6. Claim, evidence, tool result, policy decision và approval là object riêng.
7. Async job là mặc định cho investigation/sandbox; synchronous chỉ cho R0 ngắn.
8. Unknown enum/field xử lý theo version policy; security decision fail closed.

## 2. Transport baseline

### 2.1 REST

- Base path: `/api/v1`.
- JSON: `application/json`; artifact upload/download qua pre-authorized object transfer hoặc
  streamed endpoint có size limit.
- Authentication: short-lived audience-bound delegation token; service mTLS.
- `Idempotency-Key` bắt buộc cho create/invoke/mutation.
- `traceparent` theo W3C Trace Context; `X-Cybrik-Request-Id` để hỗ trợ vận hành.
- Pagination cursor-based; không offset cho large collections.
- Time là RFC 3339 UTC; giữ source timezone/precision trong provenance khi cần.

### 2.2 Async events

- AsyncAPI + Kafka ở T1/T2.
- At-least-once delivery; consumer idempotent.
- Transactional outbox từ database owner.
- Event envelope có `event_id`, `event_type`, `event_version`, `occurred_at`, `producer`,
  `tenant_id`, `trace_id`, `subject`, `data_marking`, `payload`.
- Event không chứa raw secret, token hoặc unrestricted evidence payload.

### 2.3 MCP

- MCP pin theo profile trong tài liệu nghiên cứu.
- MCP server là adapter của Tool Fabric, không gọi thẳng executor/backend.
- Tool discovery chỉ trả capability actor được phép nhìn thấy.
- `tools/call` map sang cùng `InvocationRequest`; không có đường bypass REST policy.
- Remote MCP bắt buộc auth/mTLS; stdio chỉ cho local trusted client và vẫn cần process identity.

## 3. Common envelope

```json
{
  "api_version": "cybrik.io/v1",
  "request_id": "req_01...",
  "trace_id": "4bf92f...",
  "tenant_id": "uuid",
  "actor": {
    "id": "uuid-or-workload-id",
    "type": "user|service|agent",
    "delegated_by": "uuid|null"
  },
  "purpose": "incident_investigation",
  "scope": {
    "case_id": "uuid|null",
    "alert_ids": ["uuid"],
    "resource_patterns": []
  },
  "data_marking": {
    "classification": "internal",
    "tlp": "TLP:AMBER",
    "handling": []
  }
}
```

`tenant_id` trong body/envelope không tự cấp quyền; service lấy tenant authoritative từ token và
từ chối nếu mismatch.

## 4. SOC → Cyber AI contracts

### 4.1 Create investigation

`POST /api/v1/investigations`

```json
{
  "kind": "alert_triage",
  "objective": "Determine whether the alert is a true incident and scope affected entities",
  "locale": "en",
  "context_refs": [
    {
      "type": "soc.alert",
      "id": "uuid",
      "version": "etag-or-revision",
      "digest": "sha256:..."
    }
  ],
  "allowed_capabilities": [
    "soc.get_alert_context@1",
    "soc.search_related_events@1",
    "cti.lookup_indicator@1"
  ],
  "budget": {
    "deadline_seconds": 300,
    "max_model_calls": 12,
    "max_tool_calls": 20,
    "max_retrieved_bytes": 1048576
  },
  "callback": {
    "mode": "event",
    "event_type": "cybrik.ai.investigation.completed.v1"
  }
}
```

Response `202 Accepted`:

```json
{
  "investigation_id": "inv_01...",
  "status": "queued",
  "created_at": "2026-07-22T10:00:00Z",
  "status_url": "/api/v1/investigations/inv_01..."
}
```

### 4.2 Status and cancellation

- `GET /api/v1/investigations/{id}`
- `GET /api/v1/investigations/{id}/bundle`
- `GET /api/v1/investigations/{id}/events?cursor=...`
- `POST /api/v1/investigations/{id}:cancel`
- `POST /api/v1/investigations/{id}:retry` — tạo attempt mới, không sửa lịch sử cũ.

Status enum:

`queued | running | waiting_approval | completed | partial | abstained | denied | cancelled | failed`

### 4.3 Investigation Bundle v0

```json
{
  "schema_version": "0.1.0",
  "investigation_id": "inv_01...",
  "attempt_id": "att_01...",
  "status": "partial",
  "objective": "...",
  "summary": "...",
  "verdict_proposal": {
    "value": "true_positive|false_positive|benign_positive|inconclusive",
    "confidence": 0.82,
    "basis": "evidence_weighted",
    "requires_human_decision": true
  },
  "claims": [],
  "evidence": [],
  "hypotheses": [],
  "entities": [],
  "timeline": [],
  "attack_mappings": [],
  "missing_evidence": [],
  "tool_receipts": [],
  "limitations": [],
  "runtime": {},
  "digests": {},
  "created_at": "2026-07-22T10:05:00Z"
}
```

### 4.4 Claim

```json
{
  "claim_id": "clm_01...",
  "text": "The source host contacted a domain associated with the campaign.",
  "type": "observation|inference|hypothesis|recommendation",
  "materiality": "material|supporting",
  "confidence": 0.91,
  "evidence_refs": ["ev_01...", "ev_02..."],
  "counter_evidence_refs": ["ev_03..."],
  "status": "supported|contested|unsupported|unknown"
}
```

Rule: `observation` material không có `evidence_refs` là schema-valid nhưng **release-eval invalid**;
platform phải downgrade thành inference/hypothesis hoặc abstain.

### 4.5 Evidence reference

```json
{
  "evidence_id": "ev_01...",
  "type": "soc.alert|ocsf.event|stix.object|tool.artifact|document.chunk",
  "source": {
    "system": "cybrik-soc",
    "object_id": "uuid",
    "object_version": "rev-7",
    "locator": "cybrik://tenant/.../alerts/..."
  },
  "observed_at": "2026-07-22T09:59:00Z",
  "retrieved_at": "2026-07-22T10:01:00Z",
  "digest": "sha256:...",
  "excerpt": "bounded/redacted excerpt",
  "provenance": {
    "collector": "security-onion",
    "parser_version": "ecs-1.2.0",
    "transform_chain": []
  },
  "data_marking": {},
  "trust": {
    "source_confidence": 80,
    "freshness": "current",
    "integrity_verified": true
  }
}
```

Evidence locator phải dereference qua owner API với authorization hiện tại; không phải public URL.

### 4.6 Analyst feedback

`POST /api/v1/investigations/{id}/feedback`

```json
{
  "bundle_digest": "sha256:...",
  "decision": "accepted|edited|rejected|not_actionable",
  "final_verdict": "true_positive",
  "claim_feedback": [
    {"claim_id": "clm_01...", "rating": "correct", "reason_code": "verified"}
  ],
  "reason_codes": ["useful_timeline", "missing_endpoint_data"],
  "free_text": "optional, retention/redaction policy applies"
}
```

Feedback không sửa bundle/audit gốc. Dataset curation là process riêng có access policy.

## 5. Cyber AI → Tool Fabric contracts

### 5.1 Capability manifest

```yaml
apiVersion: fabric.cybrik.io/v1
kind: Capability
metadata:
  name: soc.search_related_events
  version: 1.2.0
  publisher: cybrik
  digest: sha256:...
  signatureRef: sigstore:...
spec:
  description: Search related security events within a bounded scope
  riskClass: R0
  sideEffects: none
  idempotency: safe
  inputSchemaRef: schemas/soc.search_related_events.input.v1.json
  outputSchemaRef: schemas/soc.search_related_events.output.v1.json
  requiredScopes: [soc.events.read]
  supportedPurposes: [incident_investigation, threat_hunt]
  isolationProfile: S0
  networkPolicy: none
  limits:
    timeoutSeconds: 20
    maxInputBytes: 16384
    maxOutputBytes: 1048576
    maxItems: 500
  evidence:
    outputCanBeEvidence: true
    integrityReceipt: required
```

Manifest bị từ chối nếu thiếu digest/signature/license/owner/risk/side-effects/schema/limits.

### 5.2 Invocation

`POST /api/v1/invocations`

```json
{
  "action_id": "act_01...",
  "investigation_id": "inv_01...",
  "capability": {
    "name": "soc.search_related_events",
    "version": "1.2.0",
    "digest": "sha256:..."
  },
  "arguments": {
    "entity": {"type": "ip", "value": "192.0.2.10"},
    "time_range": {"start": "...", "end": "..."},
    "limit": 100
  },
  "resource_scope": {
    "case_id": "uuid",
    "allowed_indexes": ["security-events"]
  },
  "execution": {
    "mode": "execute|dry_run",
    "deadline_seconds": 30
  }
}
```

Response có thể là:

- `202 queued`;
- `200 completed` cho R0 nhanh;
- `403 denied`;
- `409 approval_required` kèm approval request;
- `429 budget_exceeded`;
- `503 unavailable` nhưng không thực thi ngầm.

### 5.3 Policy decision

```json
{
  "decision_id": "pdp_01...",
  "effect": "allow|deny|require_approval",
  "policy_version": "2026.07.3",
  "policy_digest": "sha256:...",
  "reason_codes": ["R3_REQUIRES_FOUR_EYES"],
  "obligations": {
    "approver_roles": ["soc_manager"],
    "minimum_approvers": 1,
    "separation_of_duties": true,
    "expires_at": "...",
    "require_dry_run": true,
    "require_rollback": true,
    "max_ttl_seconds": 3600
  }
}
```

AI không được tự diễn giải reason thành allow. Chỉ `effect=allow` sau validation mới đi tới executor.

### 5.4 Approval request and decision

```json
{
  "approval_id": "apr_01...",
  "action_id": "act_01...",
  "status": "pending",
  "requested_by": {"type": "agent", "id": "cybrik-investigator"},
  "requested_for": {"actor_id": "uuid", "tenant_id": "uuid"},
  "capability_digest": "sha256:...",
  "resolved_target": {"type": "endpoint", "id": "host-123", "snapshot": "sha256:..."},
  "resolved_arguments": {},
  "expected_impact": {},
  "rollback_plan": {},
  "evidence_refs": [],
  "policy_digest": "sha256:...",
  "expires_at": "..."
}
```

Decision:

```json
{
  "decision": "approved|denied",
  "reason_code": "verified_containment_need",
  "comment": "optional",
  "observed_target_snapshot": "sha256:..."
}
```

Approval invalid nếu action/capability/arguments/target snapshot/policy thay đổi material.

### 5.5 Execution receipt

```json
{
  "receipt_id": "rcp_01...",
  "action_id": "act_01...",
  "status": "completed|partial|denied|failed|timed_out|cancelled|rolled_back",
  "capability": {"name": "...", "version": "...", "digest": "sha256:..."},
  "executor": {"id": "spiffe://...", "version": "...", "isolation_profile": "S4"},
  "policy_decision_id": "pdp_01...",
  "approval_id": "apr_01...",
  "credential_lease_id_hash": "sha256:...",
  "started_at": "...",
  "finished_at": "...",
  "resolved_arguments_digest": "sha256:...",
  "input_artifact_digests": [],
  "output_artifacts": [],
  "side_effect": {
    "performed": true,
    "target": {},
    "verification": {},
    "expires_at": "...",
    "rollback_handle": "opaque"
  },
  "logs_digest": "sha256:...",
  "receipt_digest": "sha256:...",
  "signature": "..."
}
```

Receipt không chứa credential hoặc unrestricted raw stdout. Log/artifact truy cập qua scoped
locator và retention policy.

## 6. Artifact contracts

Artifact lifecycle:

`declared -> uploaded -> quarantined -> scanned -> accepted|rejected -> processing -> retained|expired|legal_hold`

Metadata tối thiểu:

- artifact ID, tenant/case/investigation;
- media type, size, SHA-256 và optional stronger/multiple hashes;
- uploader/source, received time, classification/marking;
- malware handling flag;
- encryption/key reference (không key);
- storage locator không public;
- scan/CDR results;
- retention/legal hold;
- parent/derived relationships.

Archive extraction có file-count, depth, expanded-size và ratio limit. Symlink/device/special file
bị từ chối. Original artifact không mount writable vào sandbox.

## 7. Event catalog v1

| Event type | Producer | Consumer chính |
|---|---|---|
| `cybrik.soc.alert.snapshot.created.v1` | SOC | Cyber AI |
| `cybrik.ai.investigation.created.v1` | Cyber AI | SOC/observability |
| `cybrik.ai.investigation.checkpointed.v1` | Cyber AI | SOC |
| `cybrik.ai.investigation.completed.v1` | Cyber AI | SOC/eval |
| `cybrik.ai.investigation.abstained.v1` | Cyber AI | SOC/eval |
| `cybrik.fabric.invocation.requested.v1` | Cyber AI/SOC | Fabric worker |
| `cybrik.fabric.approval.required.v1` | Fabric | SOC |
| `cybrik.fabric.approval.decided.v1` | SOC | Fabric |
| `cybrik.fabric.invocation.completed.v1` | Fabric | Cyber AI/SOC |
| `cybrik.fabric.kill_switch.changed.v1` | Fabric admin | All executors |
| `cybrik.content.bundle.published.v1` | Content pipeline | Suite updater |
| `cybrik.eval.regression.detected.v1` | Eval service | Release process |

Event payload dùng reference + digest cho artifact lớn. Consumer phải validate producer identity,
schema version, tenant và dedup `event_id`.

## 8. Error model

```json
{
  "error": {
    "code": "FABRIC_APPROVAL_REQUIRED",
    "message": "Human approval is required for this capability.",
    "request_id": "req_01...",
    "retryable": false,
    "details": {
      "approval_id": "apr_01..."
    }
  }
}
```

Stable error families:

- `AUTH_*`, `SCOPE_*`, `TENANT_*`;
- `CONTRACT_*`, `VALIDATION_*`;
- `BUDGET_*`, `RATE_*`;
- `MODEL_*`, `RETRIEVAL_*`, `INVESTIGATION_*`;
- `FABRIC_POLICY_*`, `FABRIC_APPROVAL_*`, `FABRIC_EXECUTION_*`, `SANDBOX_*`;
- `ARTIFACT_*`, `DEPENDENCY_*`.

Không dùng backend exception/message làm public error; không tiết lộ resource cross-tenant.

## 9. Versioning and compatibility

- API major trong path; schema version trong object/event.
- Capability version theo SemVer và pin digest khi execution.
- Tool patch không được đổi side effect/risk/input semantic; thay đổi đó là major.
- Prompt/model/retriever/policy version không SemVer mơ hồ; lưu immutable revision + digest.
- Deprecation tối thiểu hai minor releases và 180 ngày cho stable API, trừ security emergency.
- LTS target 24 tháng cho GA releases.
- `cybrik-contracts` CI chạy:
  - schema validation fixtures;
  - backward compatibility diff;
  - generated SDK compile;
  - producer/consumer contract tests;
  - malicious/unknown field tests.

## 10. Current Copilot compatibility mapping

| Current field | New source |
|---|---|
| `AskRequest.task_type` | `Investigation.kind` mapping |
| `AskRequest.question` | `objective`/analyst note, marked untrusted input |
| `AskRequest.alert_id` | `context_refs[type=soc.alert]` |
| `AskResponse.answer` | Bundle summary + verdict explanation |
| `AskResponse.citations` | Flattened material claim evidence refs |
| `AskResponse.tool_calls` | Flattened receipts/status |
| `AskResponse.disposition` | Compatibility mapping from verdict/recommendation; human still decides |
| `provider`/`model` | Bundle runtime model route |

Symbols cần giữ contract test:

- `services/api/src/cybrik_soc/modules/copilot/api.py::AskRequest`
- `services/api/src/cybrik_soc/modules/copilot/api.py::AskResponse`
- `services/api/src/cybrik_soc/modules/copilot/api.py::ask`

## 11. Security invariants for every contract

1. Model-generated tenant/actor/approval/credential fields bị bỏ qua hoặc từ chối.
2. Target và parameters phải resolve server-side; UI/AI không tự khẳng định target identity.
3. Authorization được kiểm lại tại execution time.
4. Idempotency không biến thành replay authority sau khi token/approval hết hạn.
5. Cache key bắt buộc có tenant, policy, marking, subject scope và source version.
6. Tool output là untrusted data khi quay lại model.
7. Artifact locator không là arbitrary URL; chỉ opaque reference do owner service cấp.
8. Audit/receipt write failure chặn R2/R3 action.
9. Unknown risk/side-effect enum fail closed.
10. Contract fixtures phải có cross-tenant, confused-deputy, token replay, prompt/tool injection,
    artifact bomb và stale-approval cases.
