# Evaluation, Security, Compliance and Release Gates

- **Ngày:** 2026-07-22 · **Cập nhật continuous assurance:** 2026-07-23
- **Trạng thái:** [PROPOSAL]
- **Chuẩn tham chiếu:** NIST AI RMF/GenAI Profile, NIST SSDF, NIST CSF 2.0, NIST Zero Trust,
  MITRE ATLAS, OWASP GenAI/Agentic, ISO/IEC 27001/42001/23894, EU AI Act, EU CRA

## 1. Assurance objective

CYBRIK phải chứng minh bốn điều độc lập:

1. **Useful:** giảm thời gian và tăng chất lượng điều tra.
2. **Grounded:** claim liên kết đúng evidence, biết abstain khi thiếu dữ liệu.
3. **Controlled:** model/agent không vượt tenant, scope, policy hoặc approval.
4. **Operable:** cài, chạy, quan sát, backup, restore, update và ứng cứu được trong môi trường local/
   air-gapped.

Model benchmark cao không bù được thất bại ở bất kỳ trục nào trên.

## 2. Evaluation layers

| Layer | Câu hỏi | Phương pháp chính |
|---|---|---|
| Component | Parser/retriever/model/tool có đúng contract? | Unit/fixture/property tests |
| Task | Triage/timeline/CTI/detection có đúng? | Golden set, deterministic validators, expert labels |
| Agent trajectory | Plan/tool sequence có hợp lý/an toàn? | Trace comparison, policy simulator, adversarial cases |
| End-to-end | Analyst có nhanh/chính xác hơn? | Historical replay + design-partner study |
| Online shadow | Behavior mới có tốt hơn baseline mà không side effect? | Dual-run, blind comparison, drift metrics |
| Operations | System có chịu lỗi/upgrade/restore/air-gap? | Soak, chaos/degraded drills, install rehearsal |
| Security | Adversary có chiếm prompt/tool/tenant/sandbox/update? | Threat-driven tests + independent pentest |

## 3. Evaluation datasets

### 3.1 Required suites

1. **Alert triage:** TP/FP/benign/inconclusive, severity, escalation rationale.
2. **Incident reconstruction:** entity, timeline, scope, causal uncertainty.
3. **Evidence grounding:** valid/invalid/stale/conflicting/missing citations.
4. **CTI/RAG:** current/expired/revoked/marked/poisoned/conflicting content.
5. **Tool planning:** allowed/denied/approval-required, bounded query, retry/idempotency.
6. **Prompt/tool injection:** alert/log/document/tool-output/model-context attacks.
7. **Tenant/classification:** cross-tenant IDs, cache collisions, object locator leakage.
8. **Detection engineering:** Sigma/YARA/Suricata positive/negative/performance corpus.
9. **File/PCAP safety:** malformed files, archive bombs, parser crashes, huge flows, evasions.
10. **Operational:** model/tool unavailable, bus lag, audit failure, stale approval, update rollback.

### 3.2 Dataset tiers

- **Synthetic public:** CI, no sensitive data.
- **Curated open corpus:** license/provenance reviewed.
- **Sanitized historical:** customer-approved and redacted.
- **Locked release set:** access limited, chống overfit.
- **Adversarial red-team set:** hidden cases, refreshed mỗi release train.

Mỗi dataset có manifest: owner, license/consent, source, marking, hash, version, intended use,
limitations, leakage analysis và expiry/review date.

## 4. Core quality metrics

### 4.1 Evidence and claims

| Metric | Định nghĩa |
|---|---|
| Citation validity | Reference dereference được, đúng tenant/version/digest |
| Citation entailment | Evidence thực sự hỗ trợ claim, không chỉ cùng chủ đề |
| Material claim coverage | % material claims có evidence hoặc counter-evidence |
| Unsupported material claim rate | Claim material không đủ evidence nhưng trình bày như fact |
| Contradiction recall | Phát hiện evidence xung đột trong controlled set |
| Appropriate abstention | Abstain/inconclusive đúng khi evidence thiếu/không đáng tin |
| Provenance completeness | Source/parser/transform/time/digest/marking đủ |

Proposed GA gate:

- citation validity 100% về locator/auth/digest;
- material claim coverage ≥98%;
- citation entailment ≥95% trên expert-reviewed release set;
- unsupported material claim rate ≤1%;
- zero fabricated source/object ID;
- abstention false-negative cho critical missing evidence trong ngưỡng do domain owner duyệt.

Không gộp các số thành một “AI score” duy nhất.

### 4.2 Investigation outcome

- verdict precision/recall per class, đặc biệt Critical/High TP;
- time-to-triage, time-to-scope, time-to-timeline;
- entity/timeline precision/recall;
- analyst accept/edit/reject/not-actionable;
- severity of analyst correction;
- missing-evidence recommendation usefulness;
- report completeness và handoff quality.

AI không tự close incident ở 1.x, nên metric ưu tiên recall/risk avoidance hơn tỷ lệ auto-close.

### 4.3 Retrieval/CTI

- Recall@K, nDCG@K theo task;
- policy leakage = 0;
- stale/revoked document retrieval rate;
- source diversity/trust distribution;
- poisoned-content promotion rate;
- marking/tenant filter correctness;
- index freshness, ingest failure/quarantine;
- citation-to-original fidelity.

### 4.4 Tool/agent

- allowed plan success;
- denied plan block rate;
- unauthorized invocation/side effect = 0;
- approval bypass = 0;
- stale approval rejection = 100%;
- duplicate side effect under retry = 0;
- timeout/cancel cleanup success;
- receipt completeness/signature verification;
- tool-call count/time/byte budget compliance;
- kill-switch propagation time.

### 4.5 Detection content

- compiler/syntax pass;
- TP/FP on locked corpus;
- query/scan/runtime performance;
- backend semantic parity;
- ATT&CK mapping correctness;
- regression after engine/content update;
- rollback success and mean time to disable noisy rule.

## 5. Security threat catalog

| Threat | Primary controls | Required tests |
|---|---|---|
| Prompt injection in alert/log | Untrusted-data boundary, no direct authority, structured tool schema | Direct/indirect injection corpus; fake delimiters; multilingual payloads |
| RAG poisoning | Source trust, quarantine, signatures, marking, contradiction | Poisoned docs/CTI, revoked source, ranking manipulation |
| Tool poisoning/name collision | Signed manifest, publisher identity, digest pin, registry review | Typosquat, version swap, schema/side-effect change |
| Excessive agency | Autonomy per capability, budgets, state machine, hard deny R4 | Loop/fan-out/budget bypass; self-approval attempts |
| Confused deputy | Audience/purpose/resource tokens, execution-time authz | Cross-audience token, actor/tenant spoof, resource expansion |
| Token/credential leak | Credential broker, no passthrough, redaction, short TTL | Tool output/prompt/log exfiltration; expired/replay token |
| Cross-tenant retrieval/cache | Tenant in every policy/store/cache key, RLS/partition tests | Same IDs/queries across tenant; event/artifact locator leakage |
| Insecure output handling | Typed schemas, renderer escaping, command never built from prose | XSS/SQL/shell/template payload in model/tool output |
| Sandbox escape/resource abuse | S1/S2 isolation, no host mount, caps, disposable worker | Malformed file, fork/zip bomb, device/symlink, escape suite |
| Egress/data exfiltration | Deny-by-default broker, DNS/IP validation, byte/rate caps | DNS rebinding, redirect, IPv6/private metadata, covert large output |
| Stale/changed approval | Exact digest/snapshot, expiry, re-evaluation | Modify target/params/tool/policy after approval |
| Supply-chain compromise | Signed artifact, SBOM/AI-BOM, provenance, offline verify | Tampered model/tool/content/image, revoked key, rollback attack |
| Audit tampering | Append-only ledger, digest/signature, restricted roles | Update/delete, gap/reorder, audit outage fail-closed |
| Model extraction/privacy | Local runtime, quota, output filter, no training reuse by default | Memorization probes, sensitive fragment echo, excessive query |

Crosswalk chi tiết phải map cases sang NIST AI 100-2e2025, MITRE ATLAS và OWASP GenAI/Agentic
ở repository evaluation; bảng trên chỉ là index.

## 6. Security control requirements

### 6.1 Identity and secrets

- human identity do SOC sở hữu;
- workload identity short-lived, mTLS;
- delegation audience/purpose/resource-bound;
- secret chỉ tồn tại trong approved secret store/credential broker;
- model/prompt/tool output không bao giờ nhận secret;
- key rotation/revocation và offline trust-root update có runbook.

### 6.2 Authorization and approval

- deny-by-default RBAC/ABAC;
- separation of duties cho R3;
- exact resolved target/arguments hiển thị cho approver;
- approval TTL, snapshot freshness, policy re-evaluation;
- protected targets và R4 hard deny trong code/policy baseline;
- global/tenant/tool/action kill switch;
- action verification, TTL/rollback.

### 6.3 Data protection

- encryption in transit/at rest theo deployment;
- tenant/classification/TLP/purpose metadata;
- minimization: không index/copy raw evidence nếu không cần;
- raw prompt/tool payload logging off by default; bounded encrypted audit payload khi policy cho;
- retention, deletion, legal hold, export và key destruction;
- support bundle redaction và customer-controlled export;
- backups giữ cùng classification/encryption/tenant controls.

### 6.4 Sandbox

- untrusted artifact không chạy ở SOC/Cyber AI/Fabric API process;
- no privileged containers; read-only root; non-root; seccomp/AppArmor;
- S2 microVM cho binary/code risk cao;
- separate network namespace, deny egress mặc định;
- CPU/RAM/process/time/disk/output limits;
- input immutable, output quarantined/scanned;
- disposable worker and secure cleanup;
- host/kernel/hypervisor patch SLO.

### 6.5 Supply chain and update

- dependency/model/dataset/prompt/tool/content inventory;
- SPDX/CycloneDX SBOM/AI-BOM/VEX;
- SLSA provenance target cho release artifacts;
- self-managed/KMS/HSM signing phù hợp air-gap;
- offline verification bundle;
- anti-rollback/version floor cho security update;
- staged/canary deploy và emergency revoke;
- license/NOTICE/source-offer evidence.

## 7. Observability and audit

### 7.1 Correlation fields

`trace_id`, `request_id`, `tenant_id`, `actor_id`, `investigation_id`, `attempt_id`, `action_id`,
`approval_id`, `receipt_id`, `model_revision`, `prompt_revision`, `tool_digest`, `policy_digest`.

### 7.2 Required metrics

- investigation queue/runtime/status/abstention;
- model latency/tokens/error/circuit breaker by task, không gắn raw sensitive text;
- retrieval latency/quality/filter/quarantine;
- tool queue/runtime/deny/approval/timeout/rollback;
- sandbox resource/kill/escape signal;
- audit write/gap/verification;
- event outbox lag/dedup;
- cache hit split by tenant/policy-safe key;
- update/signature/SBOM verification status.

### 7.3 Audit privacy

Audit phải đủ để chứng minh decision nhưng không mặc định lưu toàn bộ sensitive prompt/raw tool
output. Lưu hashes, references, redacted/bounded excerpts và immutable artifacts theo policy.
Operator telemetry không rời deployment trong T2.

## 8. SLO proposals

Các số cần benchmark và Founder chốt trước pilot:

| Service behavior | Initial target |
|---|---|
| R0 metadata tool p95 | ≤2 s nội bộ |
| Interactive summary first result p95 | ≤15 s trên supported hardware profile |
| Standard investigation completion p95 | ≤5 phút, async progress visible |
| Approval/kill-switch control path p95 | ≤2 s; fail closed |
| Invocation receipt availability | ≤5 s sau executor completion |
| No lost accepted jobs | 100% trong tested failure scenarios |
| T1 monthly control-plane availability | 99.9% target, exclusions documented |
| T2 install/upgrade | Không yêu cầu Internet; verification 100% artifacts |

Không hứa latency độc lập hardware/model/context. Mọi support profile có measured BOM/concurrency.

## 9. Continuous quality policy hierarchy

Đây không phải các phase waterfall. `G-DEV` chạy theo mỗi PR; full evaluation/security chạy nightly;
`G-RC` tạo mỗi tuần; stable build tạo hằng tháng. Policy chặn đúng change/build vi phạm, không bắt
mọi workstream chờ một đợt kiểm thử cuối dự án.

### G-DEV — Merge gate

- tests/lint/type/build/contract compatibility;
- unit/integration negative tenant/authz/error cases;
- dependency/license/SBOM diff;
- targeted AI eval không regression ngoài budget;
- docs/ADR/changelog cập nhật;
- reviewer độc lập + Founder acceptance cho critical boundary.

### G-RC — Release candidate

- full golden + adversarial suites;
- migration/upgrade/rollback/backup/restore;
- image/model/tool/content signatures verified offline;
- vulnerability scan + VEX/risk decision;
- performance/resource/soak tests;
- no open Critical; High có default là block release;
- known limitation and support matrix.

### G-PILOT — Customer pilot

- data processing/retention/consent agreed;
- customer rollback/support/incident contacts;
- feature flags default safe;
- action R3 disabled until separate acceptance;
- success metrics/baseline collected;
- exit/delete/export process tested.

### G-GA — General availability

- Definition of CYBRIK Suite Full Competitive Release trong roadmap §10;
- independent pentest closure;
- PSIRT and customer notification drill;
- LTS/EOL policy;
- legal/regulatory evidence review;
- clean-room install/upgrade/rollback/restore và pre-market acceptance evidence;
- Founder-signed release risk record.

### G-AUTO — Mở A4 cho một capability

A4 engine, policy, telemetry, kill switch và rollback là feature bắt buộc của Full Competitive
Release 2026. Gate này kiểm soát **activation cho từng capability/tenant**, không phải lý do dời
implementation sang 2027. Ít nhất một capability enrich/tag/route nội bộ, reversible và không có
external side effect phải pass pre-market gate để release không chỉ có engine nằm im.

- capability R0/R1 hoặc reversible low-risk R3 có rollback;
- internal no-external-side-effect: tối thiểu 30 ngày shadow/production-like replay và sample size
  được chốt trước; customer-specific/external capability: tối thiểu 90 ngày production shadow;
- precision/recall/unsafe-action thresholds chốt trước khi xem result;
- zero policy/tenant/approval bypass;
- customer opt-in riêng, per-tenant kill switch;
- automatic TTL/rollback và continuous drift monitoring;
- post-incident review process.

Không có global “enable autonomous agents”.

## 10. Compliance implementation roadmap

### 2026 — Build product and assurance together

- ISMS/AIMS scope, asset/AI system inventory và risk registers;
- secure development/SSDF workflow;
- PSIRT, vulnerability intake, disclosure và incident clock;
- data map/retention/classification;
- SBOM + AI-BOM, signing/provenance và offline verification vận hành thật;
- legal memos cho AI Act/CRA/GDPR/license role;
- policy/approval/audit operational evidence;
- model/data/prompt/tool lifecycle records;
- privacy impact/data protection assessment templates;
- access review, backup/restore, update/rollback và incident tabletop;
- controls crosswalk NIST CSF/AI RMF/ISO;
- external pentest và closure Critical/High trong tháng 12;
- CRA/AI Act technical evidence pack theo applicability;
- security whitepaper và customer assurance pack cho market 2027.

### 2027-H1 — Paid deployment evidence

- paid design-partner deployment controls và customer-specific risk assessment;
- production outcome/SLO/incident/upgrade evidence;
- supplier/dependency review theo customer procurement;
- customer DPA/security schedule/EULA/support execution;
- internal audit/readiness assessment dựa trên vận hành thật.

### 2027-H2 — Market expansion and certification

- recurring pentest/red-team cho material boundary changes;
- update CRA/AI Act documentation theo thị trường/jurisdiction thực;
- ISO 27001/42001 certification nếu procurement pipeline biện minh;
- sector/partner assurance packs;
- certification decision based on sales pipeline, không theo prestige.

## 11. CRA operational readiness

Do CRA reporting requirements có hiệu lực 2026-09-11, CYBRIK cần sớm có:

- product/component/version/customer deployment inventory;
- supported versions và support period;
- vulnerability intake/triage/exploit-awareness;
- severity/applicability/VEX;
- 24-hour early-warning clock và 72-hour full-notification workflow cho event thuộc phạm vi;
- evidence preservation và approval/escalation contacts;
- customer communication templates;
- ENISA Single Reporting Platform access/runbook khi applicable;
- post-notification/final report tracking;
- coordinated disclosure và remediation/update delivery.

Applicability và nội dung báo cáo phải được counsel xác nhận; tài liệu này không là legal advice.

## 12. AI Act/AIMS artifacts

Mỗi production AI use case có:

- intended use, prohibited/out-of-scope use;
- provider/deployer/model role assessment;
- system/model/data/prompt/tool inventory;
- human oversight design;
- risk/impact assessment and controls;
- performance, robustness, cybersecurity and limitation evidence;
- monitoring, incident, change and decommission plan;
- user/admin instructions and transparency notice;
- AI literacy/training material cho operator/analyst;
- energy/hardware footprint khi relevant.

## 13. Release evidence pack

Mỗi stable release sinh một bundle ký gồm:

1. release manifest/version/digests;
2. source/build provenance;
3. SBOM, VEX, AI-BOM và licenses/NOTICE;
4. model cards, prompt/retriever/tool/policy versions;
5. contract compatibility report;
6. unit/integration/e2e/security test results;
7. golden/adversarial eval report và regression decisions;
8. performance/hardware/SLO results;
9. migration/upgrade/rollback/backup/restore results;
10. threat model/risk register changes;
11. pentest findings/closure khi applicable;
12. known limitations, supported configurations, EOL;
13. compliance crosswalk và signed Founder risk acceptance.

Khách hàng T2 phải verify pack offline trước install.

## 14. Required independent assessments

Trước GA:

- suite penetration test, gồm identity/delegation/API/MCP;
- sandbox/egress/isolation review;
- update/signing/offline supply-chain review;
- tenant isolation and artifact authorization review;
- legal review AI Act/CRA/GDPR/open-source/product claims;
- ISO 27001/42001 readiness review nếu marketing dùng từ “ready/aligned”.

Sau GA: pentest ít nhất hằng năm hoặc sau material boundary change; red-team agent/tool mỗi major
release; certification audit theo chosen scheme.

## 15. Founder release questions

1. Chúng ta có evidence product cải thiện analyst outcome, hay chỉ demo trông ấn tượng?
2. Claim nào không có citation hoặc limitation?
3. Nếu model bị chiếm, attacker có thể làm gì ngoài tạo text xấu?
4. Nếu SOC/AI/Fabric/audit/bus lần lượt lỗi, side effect nào còn có thể xảy ra?
5. Có cách nào dùng tenant A đọc cache/artifact/event/receipt tenant B?
6. Approval có còn hiệu lực sau khi target/tool/policy đổi không?
7. Release có cài, verify, update và restore offline thật không?
8. Artifact/model/tool/content bị revoke thì tìm khách hàng bị ảnh hưởng bằng cách nào?
9. Có open Critical/High nào đang được che bằng “accepted risk” không đủ căn cứ?
10. Marketing đang dùng “certified/compliant/autonomous” vượt quá evidence nào?
