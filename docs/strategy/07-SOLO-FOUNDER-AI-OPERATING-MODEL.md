# Solo Founder + AI Engineering Operating Model

- **Ngày:** 2026-07-22 · **Cập nhật AI-native cadence:** 2026-07-23
- **Trạng thái:** [PROPOSAL]
- **Mục tiêu:** một Founder có thể xây sản phẩm nghiêm túc mà không biến AI thành người phê duyệt
  chính công việc do AI tạo ra

## 1. Operating principle

Claude/ChatGPT/Codex là lực lượng nghiên cứu, thiết kế, implementation, test và review; Founder là
người chịu trách nhiệm về scope, architecture, risk acceptance, customer truth và release.

AI không tăng capacity vô hạn. Bottleneck chuyển từ “gõ code” sang:

- lựa chọn đúng vấn đề;
- cung cấp context sạch;
- review thay đổi;
- giữ contract/architecture nhất quán;
- tạo dữ liệu/eval đáng tin;
- vận hành integration lab;
- quyết định risk và nói “không”.

## 2. Team-of-agents model

Một work item quan trọng dùng các vai độc lập có thể chạy song song theo ownership:

| Vai | Nhiệm vụ | Không được làm |
|---|---|---|
| Researcher | Nguồn chính thức, standards, prior art, unknowns | Quyết định product thay Founder |
| Architect | ADR, contracts, threat model, failure modes | Thiết kế xa nhiều tuần hoặc quyết định thay Founder |
| Test designer | Acceptance/eval/adversarial cases trước code | Hạ threshold để cho build pass |
| Implementer | Code nhỏ nhất để pass contract/test | Tự mở scope, tự sửa unrelated code |
| Reviewer | Correctness/security/compatibility review độc lập | Tin summary của implementer thay vì đọc diff |
| Verifier | Chạy test/build/eval, kiểm artifacts/evidence | Chỉ báo “looks good” không có lệnh/kết quả |
| Documenter | Cập nhật docs/runbook/changelog | Claim feature chưa chạy thật |

Không dùng cùng một conversation/context làm implementer và final security approver cho R3,
identity, tenant isolation, crypto, sandbox hoặc updater. Dùng model/session khác và Founder review.

## 3. Tool assignment đề xuất

Đây là cách chia thực dụng, không phải giới hạn cố định:

- **Claude:** discovery dài, synthesis, ADR, alternative analysis, threat-model review.
- **ChatGPT:** product reasoning, standards synthesis, UX/use-case, adversarial critique.
- **Codex:** repository exploration, scoped implementation, tests, refactor, verification.
- **Local Qwen:** sensitive/sanitization-constrained analysis trong lab, offline regression và
  dogfooding product.

Chọn công cụ theo evidence thực tế; không để brand model trở thành architecture dependency.

## 4. Data handling boundary khi dùng AI development tools

### Được dùng với cloud AI

- source code đã được phép xử lý;
- synthetic fixtures;
- public standards/docs;
- redacted stack traces/logs;
- generated/sanitized PCAP, IOC, alert và case data;
- architecture không chứa customer secret.

### Không đưa lên cloud AI

- production/customer raw logs, PCAP, malware, case evidence;
- secrets, tokens, keys, internal credentials;
- classified/export-controlled data;
- customer identifiers/contracts chưa được phép;
- unredacted vulnerability exploit details của khách hàng;
- private model weights/data có điều khoản cấm.

Sensitive work dùng local model/tooling trong approved environment. Redaction là pipeline có test,
không phải thao tác copy/paste dựa vào trí nhớ.

## 5. Work-item size and WIP

### 5.1 WIP limits

- 1 integrated weekly outcome;
- tối đa 1 writer task đang chạy trong mỗi repository/module ownership;
- nhiều read-only researcher/test/reviewer có thể chạy song song;
- 1 continuous assurance task luôn hoạt động, không chờ “hardening phase”;
- 0 opportunistic dependency upgrade trong feature branch;
- 0 new framework nếu chưa có ADR và removal/exit strategy.

### 5.2 Kích thước task

Một task lý tưởng:

- hoàn thành trong 0.5–2 founder days;
- một bounded context/repository;
- diff reviewable, hướng tới <400 LOC meaningful change;
- có acceptance criteria và rollback;
- không trộn refactor, dependency upgrade và behavior change.

Task lớn phải cắt theo vertical behavior, không cắt thành “backend xong nhưng chưa có contract/UI/
audit” kéo dài nhiều tuần.

## 6. Standard workflow

Các step dưới đây là một **micro-loop kéo dài vài giờ đến tối đa hai ngày**, không phải phase tuần/
tháng. Discovery cho task kế tiếp chạy đồng thời khi task hiện tại đang implement/verify; contract,
test, code, review và docs có thể xen kẽ nhiều lần trước khi merge.

### Step 1 — Brief

Mỗi task có Markdown brief:

- problem/user outcome;
- in-scope/out-of-scope;
- facts/assumptions/unknowns;
- affected contracts/data/security boundaries;
- acceptance/eval cases;
- rollback and observability;
- docs/ADR to update.

### Step 2 — Read-only discovery

AI đọc code/docs/tests/current git state, ghi exact files/symbols. Không sửa trong discovery. Founder
xác nhận nếu phát hiện scope/architecture conflict.

### Step 3 — Design and threat pass

- contract/schema first;
- abuse/failure/degraded modes;
- tenant/identity/secret/audit impacts;
- dependency/license review;
- data migration/compatibility nếu có.

Critical changes bắt buộc ADR được chấp nhận trước khi merge implementation; ADR và prototype có
thể được phát triển cùng ngày dưới feature branch/flag.

### Step 4 — Tests/evals first

- contract fixture;
- unit/integration/adversarial test;
- golden eval case nếu AI behavior;
- expected failure proves test is meaningful;
- production data không cần thiết để CI pass.

### Step 5 — Implementation

Implementer được ownership file rõ, giữ diff nhỏ, không tự sửa lỗi ngoài scope. Feature flag cho
thay đổi lớn hoặc migration path chưa hoàn tất.

### Step 6 — Independent review

Reviewer đọc diff + surrounding code + tests, tập trung:

- authorization/tenant/confused deputy;
- error/failure/idempotency/retry;
- stale data/approval/cache;
- resource exhaustion;
- compatibility/rollback;
- missing negative tests;
- license/supply chain.

### Step 7 — Verification

Chạy targeted test → full relevant suite → build/type/lint → security/eval gates. Lưu lệnh, version,
result và artifacts; không chỉ ghi PASS bằng prose.

### Step 8 — Documentation and release note

Cập nhật contract/ADR/runbook/threat model/changelog/support matrix cùng change. Claim level ghi:
implemented, tested, pilot hoặc proposed.

### Step 9 — Founder acceptance

Founder xem diff/evidence/risk/deployment/rollback. Critical changes không merge chỉ vì hai AI đều
đồng ý.

## 7. Definition of Done

Một item chỉ Done khi:

1. acceptance criteria pass;
2. positive + negative + authorization/tenant tests có đủ;
3. error/degraded behavior observable;
4. audit/receipt/provenance đúng nếu relevant;
5. performance/resource caps được test hoặc ghi limitation;
6. dependency/license/SBOM updated;
7. docs/ADR/runbook/changelog updated;
8. feature flag/rollback verified;
9. independent AI review issues resolved/accepted;
10. Founder kiểm tra outcome trong UI/API thực.

AI feature bổ sung:

- eval dataset/version + baseline/comparison;
- model/prompt/retriever/tool versions captured;
- injection/poisoning/unsupported claim tests;
- no silent model fallback;
- shadow/pilot evidence nếu thay đổi decision behavior.

## 8. Documentation system

### 8.1 Markdown as source of truth

Mỗi repository có:

```text
docs/
  README.md
  product/
  architecture/
  adr/
  contracts/
  security/
  evaluation/
  operations/
  releases/
```

File generated OpenAPI/AsyncAPI/JSON Schema có source location rõ; generated output không được sửa
tay. Link checker, markdown lint và claim/status guards chạy CI.

### 8.2 Document status vocabulary

- `PROPOSED`
- `ACCEPTED`
- `IMPLEMENTING`
- `IMPLEMENTED`
- `VERIFIED`
- `PILOTED`
- `GA`
- `DEPRECATED`
- `SUPERSEDED`

Không dùng “done/ready” mơ hồ. Tài liệu architecture đích không được đọc như hiện trạng.

### 8.3 ADR rule

ADR cần khi thay:

- product/data ownership;
- public contract;
- security boundary/identity/crypto;
- database/event model;
- model/RAG/tool/sandbox architecture;
- dependency engine/license lớn;
- deployment/support/compliance posture.

ADR gồm context, decision, alternatives, consequences, migration, rollback, validation và review
date. Không xóa ADR cũ; mark superseded.

## 9. Branch, commit and release discipline

- protected `main`, short-lived feature branch;
- one concern per branch/PR;
- conventional/traceable commit message kèm issue/ADR;
- no direct push/force rewrite cho release branch;
- signed release tag và immutable artifacts;
- release candidate trước stable;
- hotfix có security impact phải backport test và advisory decision;
- diff, lockfiles, generated contract và SBOM được review trước merge.

AI có thể chuẩn bị commit/PR draft, nhưng external action như push/publish/release cần Founder duyệt.

## 10. Cadence

### Hằng ngày

- 15 phút: chốt vertical outcome, WIP và risk;
- AI discovery/test design cho slice kế tiếp chạy trước 3–7 ngày tối đa;
- writer agents triển khai theo repo/module ownership, Founder tích hợp diff nhỏ liên tục;
- targeted tests/eval chạy theo mỗi patch; full relevant suite trước merge;
- nightly build/eval/security scan và install smoke;
- update decision/evidence log tự động từ artifacts.

### Hằng tuần

- Thứ Hai: demo mục tiêu end-to-end và scope budget của tuần.
- Thứ Hai–Thứ Năm: continuous discovery/delivery, merge nhỏ hằng ngày sau policy checks.
- Thứ Sáu: cài weekly release candidate sạch, full eval/security comparison, demo thật.
- Backlog tuần sau đổi ngay theo evidence; không bảo vệ kế hoạch cũ khi outcome không đạt.
- Slice chưa đủ evidence vẫn merge sau feature flag/shadow nếu không làm tăng attack surface.

### Hằng tháng

- phát hành stable build từ các weekly RC đã soak;
- restore/rollback/security incident drill;
- recovery/resequence implementation theo deadline Full Feature Complete 2026-11-15, không thay
  đổi feature contract mười trụ cột;
- standards/regulatory/license/dependency/model watch;
- cập nhật sales/readiness evidence cho 2027.

### Mỗi quý

- external architecture/security/customer reality review;
- threat model/risk register và product boundary review;
- dependency/model/tool strategy và LTS decision;
- kill/continue experiments ngoài feature contract; core capability chỉ được resequence cách làm.

## 11. Evaluation dataset operations

- Dataset có manifest, license, provenance, marking, hash và owner.
- Tách train/development test khỏi locked release test.
- Founder không xem expected answer locked set trong implementation loop thường xuyên.
- Model-as-judge chỉ là signal; material security claims cần deterministic/human validation.
- Customer feedback không tự vào corpus; qua consent, redaction, dedup, quality review.
- Regression được triage như bug product, không prompt-tune tùy tiện để overfit một case.

## 12. Dependency and model update policy

Không chạy auto-upgrade production dependency/model.

Mỗi update có:

- release/advisory/license review;
- artifact digest/signature;
- SBOM/AI-BOM diff;
- compatibility suite;
- golden/adversarial eval comparison;
- performance/hardware comparison;
- canary + rollback;
- documented risk acceptance.

Emergency security update có fast path nhưng không bỏ signature, smoke, tenant/authz và rollback.

## 13. Use of parallel AI work

Parallelize read-only research, test-case generation và independent review. Hạn chế nhiều agent cùng
sửa overlapping files. Mỗi writer có file/module ownership; integrator đọc toàn diff.

Không dùng số lượng agent như tiến độ. Nếu Founder không thể review output trong cùng iteration,
đó là WIP vượt capacity.

## 14. External assurance without adding developers

Roadmap vẫn giữ một developer, nhưng cần mua independent evidence:

- legal/privacy/open-source counsel;
- annual hoặc pre-GA penetration test;
- sandbox/isolation architecture review;
- ISO readiness/certification body khi cần;
- design-partner operational validation;
- professional translation review cho legal/customer docs.

AI không thể cấp chứng nhận hoặc tạo tính độc lập khi chính nó viết và tự chấm cùng một hệ thống.

## 15. Monthly founder dashboard

Chỉ 12 chỉ số:

1. 2026 Full Feature Complete burn-up theo mười trụ cột;
2. WIP age;
3. escaped regressions;
4. open Critical/High risks;
5. contract-breaking changes;
6. golden eval regression;
7. citation/unsupported-claim rate;
8. unauthorized side-effect/cross-tenant count;
9. pilot time-to-triage/timeline;
10. deployment/restore success;
11. operational toil hours;
12. design-partner active usage/feedback.

Token count, lines of code, number of agents và number of generated features không phải KPI.

## 16. Founder weekly checklist

- [ ] Outcome tuần này có tạo vertical increment chạy được trong chuỗi SOC–AI–Fabric không?
- [ ] Có task nào vượt hai ngày mà chưa cắt nhỏ?
- [ ] Contract/test/ADR có đi trước implementation không?
- [ ] AI có chạm dữ liệu không được phép không?
- [ ] Implementer và reviewer có độc lập đủ không?
- [ ] Diff có mở dependency/license/security boundary mới không?
- [ ] Negative/tenant/failure tests đã có chưa?
- [ ] Docs nói đúng mức proposed/implemented/verified/piloted/GA chưa?
- [ ] Có rollback và degraded mode không?
- [ ] Việc ngoài feature contract nào nên dừng để giải phóng capacity?
