# Core Use Cases and Release Scope

- **Ngày:** 2026-07-22 · **Cập nhật execution:** 2026-07-23
- **Trạng thái:** [DECISION — full-feature breadth] · [PROPOSAL — acceptance detail]
- **Mục tiêu:** khóa full-feature contract 2026 và cách tích hợp đồng thời thành một sản phẩm

## 1. Primary job-to-be-done

> Khi một alert có khả năng nghiêm trọng xuất hiện, tôi cần nhanh chóng biết điều gì đã xảy ra,
> phạm vi ảnh hưởng, bằng chứng nào xác nhận/phản bác, còn thiếu dữ liệu gì và hành động nào an
> toàn — trong khi giữ toàn bộ dữ liệu và quyền kiểm soát ở hạ tầng của mình.

Persona chính là SOC L1/L2 analyst; L3/hunter và SOC manager là secondary. Platform/security admin
là persona vận hành, không phải người dùng chính quyết định UX ban đầu.

## 2. Use-case priority

| Priority | Use case | Outcome | Sản phẩm dẫn dắt |
|---|---|---|---|
| P0 | Alert-to-Investigation | Bundle có timeline, entity, evidence, CTI, ATT&CK, missing evidence | SOC + Cyber AI + Fabric R0/R1 |
| P0 | Evidence-grounded triage | Verdict proposal có citation/abstention; analyst quyết định | Cyber AI, hiển thị ở SOC |
| P0 | Safe read-only investigation tools | Query related alert/log/IOC/asset/file metadata có scope và receipt | Tool Fabric |
| P1 | Detection candidate from case | Draft Sigma/YARA/Suricata, compile + replay + FP report | Cyber AI + Fabric sandbox |
| P1 | File/PCAP investigation | Static scan, metadata, strings, YARA, PCAP summary/replay trong isolation | Tool Fabric + Cyber AI |
| P1 | CTI knowledge update | STIX/TAXII + offline signed bundles, marking/expiry/provenance | Cyber AI |
| P1 | Approved reversible response | Dry-run, exact target, four-eyes, TTL/rollback, receipt | Tool Fabric + SOC |
| P2 | Proactive threat hunt agent | Hypothesis-driven hunt có evidence và bounded tool budget | Cyber AI |
| P2 | Cross-case campaign graph | Liên hệ case/entity/IOC theo policy, không trộn tenant | Cyber AI |
| P3 | Bounded autonomous response | Chỉ low-risk, reversible, proven precision, per-tool gate | Toàn bộ suite |

Các workstream P1/P2/P3 phát triển song song sau contract tối thiểu, dùng feature flag/shadow cho
rollout an toàn chứ không để trì hoãn capability. V1 có R3 reversible action với human approval và
A4 cho enrichment/routing/tagging low-risk, reversible, policy-gated. External side effect vẫn đi
qua R3 approval; A5 destructive autonomy không phải product feature.

## 3. Golden workflow: Alert-to-Investigation

### 3.1 User experience

1. Analyst mở alert trong SOC và chọn **Start investigation**.
2. UI hiển thị plan dự kiến, nguồn dữ liệu và budget; analyst có thể bỏ tool không phù hợp.
3. Timeline cập nhật theo checkpoint: context, enrichment, related activity, hypothesis testing.
4. Mỗi claim bấm được để xem evidence gốc/receipt; evidence nhạy cảm chỉ hiện theo clearance.
5. AI hiển thị đồng thời:
   - điều đã biết;
   - điều suy luận;
   - điều mâu thuẫn;
   - điều chưa biết;
   - bước kiểm chứng tiếp theo.
6. Analyst chọn accept/edit/reject verdict và quyết định escalate/close/create case.
7. SOC lưu verdict của người, link tới bundle AI, không ghi AI text thành truth không phân biệt.

### 3.2 Definition of Done cho một investigation

- mọi claim material có ít nhất một citation hợp lệ hoặc được đánh dấu hypothesis;
- evidence có source, timestamp, tenant, marking và digest;
- tool call có typed parameters, receipt, status và duration;
- bundle ghi model/prompt/retriever/tool/policy versions;
- missing evidence và limitations không rỗng nếu input không đủ;
- không có cross-tenant/resource ngoài scope;
- analyst có thể export report và replay metadata;
- feedback được ghi tách biệt với audit gốc.

## 4. Autonomy ladder

Autonomy được cấp **theo từng capability và use case**, không theo tên agent hoặc model.

| Level | Mô tả | Ví dụ | Gate tối thiểu |
|---|---|---|---|
| A0 Explain | Không gọi tool; giải thích dữ liệu đã chọn | Tóm tắt alert | Grounding/citation, no side effect |
| A1 Recommend | Đề xuất plan/verdict/query/detection | Triage proposal | Structured output, abstention, analyst decision |
| A2 Observe | Tự gọi R0/R1 read-only bounded tools | IOC lookup, PCAP parse | Tool allowlist, receipt, sandbox/quota |
| A3 Act with approval | Gọi R2/R3 sau approval theo action | Temporary block | Dry-run, four-eyes, freshness, rollback, kill switch |
| A4 Bounded automation | Tự động trong policy hẹp, reversible | Enrich + add low-risk tag | Shadow evidence, precision/SLO, automatic rollback |
| A5 Autonomous destructive | Hành động rộng/khó đảo ngược | Wipe/delete/permanent broad block | **Không nằm trong product 1.x** |

Không thăng cấp vì model self-reported confidence. Gate dùng dữ liệu eval, shadow operation,
incident history, target risk và approval của Founder/customer.

## 5. Cyber AI Platform release scope

Các nhãn v0.1/v0.5/v1.0 là mức trưởng thành của **weekly release candidates**, không phải ba phase
waterfall. Mỗi tuần phải tích hợp một vertical slice; ngày thực thi chi tiết nằm tại
[06-ROADMAP-2026-2029.md](06-ROADMAP-2026-2029.md).

### 5.1 v0.1 — Foundation/compatibility

**Must:**

- OpenAI-compatible model adapter, Qwen default profile, deterministic test stub;
- model/prompt registry tối thiểu với digest/version/license;
- `/v1/investigations` async state machine có checkpoint/cancel;
- claim/evidence/citation schema và Investigation Bundle v0;
- SOC context tool qua Fabric R0;
- immutable AI run ledger và OpenTelemetry correlation;
- offline golden eval runner;
- feature flag `shadow_remote`.

**Không có:** RAG tổng quát, autonomous agent, external CTI, sandbox detonation.

### 5.2 v0.5 — Integrated beta / pre-market

- hybrid RAG cho runbook/CVE/CTI có tenant/classification filter;
- STIX/TAXII ingest + signed offline CTI bundle;
- Investigation Graph entity/timeline/hypothesis;
- bounded planner dùng Fabric R0/R1;
- contradiction detection, abstention và missing-evidence planner;
- English/Vietnamese eval sets;
- online shadow comparison với Copilot hiện tại;
- bundle viewer/export trong SOC.

### 5.3 v1.0 — Product release trong 2026

- tích lũy toàn bộ foundation và integrated-beta capability, không để core feature ở preview;
- multi-runtime local model profiles, routing/fallback/canary/rollback;
- durable multi-agent roles cho triage/investigation/hunt/malware/detection/report/response plan;
- proactive hunt, cross-case campaign graph và technical/executive report;
- HA/backup/restore/upgrade/offline update;
- model rollout/canary/rollback và AI-BOM;
- policy-aware cache, retention, legal hold và data deletion;
- audit/eval/admin APIs; không nhất thiết có UI riêng;
- performance/SLO cho concurrent investigations;
- third-party pen test closure;
- signed LTS release và support matrix;
- compliance evidence pack theo tài liệu 08.

## 6. Security Tool Fabric release scope

### 6.1 v0.1 — Capability kernel

- signed tool manifest + JSON Schema input/output;
- registry/discovery/version pin;
- REST invocation và MCP adapter read-only;
- delegation validation, tenant/purpose/resource scope;
- R0 executor, timeout, byte/result cap, idempotency;
- execution receipt và immutable ledger;
- global/tenant/tool kill switch;
- conformance SDK/test fixtures.

Tool pack đầu tiên:

1. SOC `get_alert_context`;
2. SOC `get_related_alerts`;
3. SOC `get_asset_context`;
4. SOC `lookup_ioc`;
5. Data Lake/SIEM `search_events` với typed query/time/limit;
6. CTI `get_stix_objects`.

### 6.2 v0.5 — Analysis and approval

- S1 restricted sandbox và artifact store;
- YARA/YARA-X scan, file metadata/strings/hash, archive inventory;
- PCAP metadata/flow/DNS/TLS summary;
- Sigma compile/lint/backtest adapter;
- Suricata syntax + PCAP replay adapter;
- policy decision point, approval broker, expiry/four-eyes;
- credential/egress broker;
- R2 active observation trong network lab.

### 6.3 v1.0 — Enterprise control plane

- S2 microVM profile cho untrusted binary/code workload;
- R3 reversible response với dry-run/TTL/rollback/verification;
- tool publisher signing/revocation và compatibility policy;
- publisher/connector SDK, generic OpenAPI/MCP adapter và conformance kit;
- HA scheduler/executor pools, quotas/backpressure;
- offline tool bundle/update/rollback;
- tool conformance/security certification nội bộ;
- core integration pack cho alert/case/asset, SIEM/log, IOC/CVE/KEV/ATT&CK, CTI, file/PCAP và
  detection engines được xác minh end-to-end trong integration lab;
- A4 low-risk enrichment/routing/tagging engine với policy/budget/kill switch/automatic rollback.

R4 luôn hard-deny trong 1.x.

## 7. SOC integration release scope

### Compatibility milestone

- giữ `POST /api/v1/copilot/ask` và response hiện hành;
- thêm `AIPlatformClient` sau seam `LLMClient`/gateway;
- giữ embedded mode để rollback;
- shadow remote không ảnh hưởng UI/decision;
- audit correlation giữa `CopilotAudit` và `investigation_id`.

### Investigation workspace milestone

- Start/cancel/retry investigation;
- progress/checkpoint, bundle/evidence viewer;
- accept/edit/reject + reason;
- promote evidence/detection/action proposal vào case dưới actor người dùng;
- approval inbox và receipt viewer;
- degraded state rõ ràng khi AI/Fabric unavailable.

SOC không chứa model registry, RAG index, generic agent engine hoặc sandbox worker.

## 8. Detection engineering scope

### 8.1 Candidate lifecycle

`DRAFT -> COMPILED -> TESTED -> REVIEWED -> STAGED -> ACTIVE -> RETIRED/ROLLED_BACK`

AI chỉ tạo `DRAFT`. Mỗi transition yêu cầu evidence:

- compiler/linter version;
- test corpus digest;
- true/false-positive results;
- performance/cost estimate;
- ATT&CK and source references;
- reviewer/approver;
- target backend/version;
- signed package digest.

### 8.2 Metrics theo rule type

- Sigma: backend compilation success, event coverage, FP/TP, query cost;
- YARA: match/non-match corpus, scan time, timeout, archive bomb safety;
- Suricata: syntax, PCAP TP/FP, packet loss/throughput impact, SID/revision governance.

Không chấm rule bằng “giống rule của chuyên gia” hoặc model judge duy nhất.

## 9. File and PCAP analysis scope

### v0.5 cho phép

- hash/type/metadata/strings/imports/archive inventory;
- YARA scan;
- PCAP flow/DNS/TLS/HTTP metadata extraction;
- Suricata replay;
- artifact relationships và report;
- no-network sandbox mặc định.

### V1.0 dynamic analysis profile

- S2 microVM cho untrusted binary/code với snapshot/reset và evidence capture;
- no-network detonation mặc định; egress simulation chỉ qua controlled service;
- timeout/memory/CPU/process/file/byte caps và parser/tool crash containment.

### Ngoài security boundary của product 1.x

- Internet-connected malware detonation;
- kernel exploit analysis trên host chung;
- agent tự tải binary/tool từ Internet;
- active scanning production target không approval.

## 10. CTI and RAG content policy

Mỗi source phải có:

- owner/publisher, license/terms và allowed use;
- collection/tenant visibility;
- trust/confidence and marking;
- fetched/valid-from/valid-until/revoked;
- parser/version/source hash;
- original artifact preservation policy;
- poisoning/quality evaluation status.

RAG không “tin” tài liệu chỉ vì nằm trong index. Ranking kết hợp relevance, source trust,
freshness, marking, contradiction và case applicability. Nội dung retrieved luôn là untrusted
data đối với prompt.

## 11. International product requirements

### Must trước GA

- English là locale mặc định của API/error/docs; Vietnamese là locale được hỗ trợ đầy đủ;
- timezone/UTC correctness, Unicode/IDN, IPv4/IPv6;
- configurable retention/data residency/no-phone-home;
- backup/restore và offline upgrade rehearsal;
- accessibility WCAG AA cho workflow chính;
- semantic versioning, deprecation policy, LTS/support matrix;
- public security contact, disclosure policy, advisory/CVE process;
- SBOM/VEX/AI-BOM, signed releases và license notices;
- auditable admin actions và support bundle có redaction;
- installation without vendor cloud account.

### Ecosystem expansion sau GA — không phải core feature debt

- additional locales từ partner, không hard-code country policy;
- multi-region/disaster recovery profile;
- certified connector program;
- expanded SDK examples, partner portal và public connector catalog;
- sector-specific content packs.

## 12. Product acceptance metrics

### Pilot outcome targets

- median time-to-triage giảm ít nhất 40% so baseline của design partner;
- median time-to-build incident timeline giảm ít nhất 50%;
- ít nhất 90% material claims có citation hợp lệ; release gate cuối cao hơn ở tài liệu 08;
- analyst đánh giá bundle “useful with minor/no edits” ở ít nhất 70% scoped cases;
- zero cross-tenant leaks và zero unapproved side effects;
- 100% R3 action có dry-run, approval, receipt và rollback/expiry;
- offline install/upgrade/restore thành công từ tài liệu, không cần Internet.

Các con số này là target để đo, không phải claim hiện tại.

## 13. Intentional non-goals — không phải tính năng bị cắt để giữ deadline

- generic no-code agent builder;
- public marketplace;
- custom foundation-model training;
- autonomous remediation diện rộng;
- UEBA model platform mới thay cho UEBA trong SOC;
- cloud SaaS multi-region control plane;
- mobile application;
- full digital-forensics suite thay thế Velociraptor/Autopsy/Volatility;
- proprietary threat feed toàn cầu;
- customer-facing prompt editor không có governance.
