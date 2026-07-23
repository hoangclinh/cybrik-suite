# CYBRIK Sovereign Security Investigation Suite — Hồ sơ chiến lược

> **CANONICAL** kể từ 2026-07-23 theo Founder decision: README này và các tài liệu 01–08 là
> phiên bản chiến lược chính thức của CYBRIK Suite. Bản trong
> `cybrik-soc-command-center:docs/cybrik-suite/` là SUPERSEDED pointer.

- **Ngày lập:** 2026-07-22 · **Cập nhật roadmap:** 2026-07-23
- **Tầm nhìn:** hoàn thành sản phẩm 2026 · go-to-market 2027 · mở rộng 2028–2029
- **Trạng thái:** Founder đã chốt deadline và full-feature contract 2026; 2027 chỉ thương mại hóa/mở rộng
- **Phạm vi:** CYBRIK SOC Command Center + CYBRIK Cyber AI Platform + CYBRIK Security Tool Fabric
- **Đối tượng:** Founder/Product Owner, kiến trúc sư, đối tác triển khai, khách hàng thiết kế

## 1. Kết luận điều hành

CYBRIK không nên cạnh tranh **chỉ** bằng một chatbot SOC, cũng không nên fork/rebrand hoặc viết
lại từ số 0 các commodity engine như search/index, endpoint sensor, packet engine hay hypervisor.
Nhưng CYBRIK **phải sở hữu đầy đủ năng lực sản phẩm SIEM, Threat Intelligence và sandbox** trong
bộ giải pháp. Các nhà cung cấp lớn đã đưa tóm tắt, natural-language hunting, agent, plugin và SOAR
vào cùng nền tảng. Cửa thắng khả thi cho CYBRIK là:

> **Hệ điều hành điều tra an ninh có chủ quyền:** chạy trong hạ tầng khách hàng, biến một
> alert thành hồ sơ điều tra có bằng chứng kiểm chứng được, dùng công cụ qua policy/approval,
> tái hiện được toàn bộ quá trình, và vẫn hoạt động khi không có Internet.

Ba sản phẩm có vai trò khác nhau nhưng tạo thành một trải nghiệm duy nhất:

1. **CYBRIK SOC Command Center** là system of record và human workbench: alert, case,
   asset, tenant, identity, RBAC, audit và giao diện analyst.
2. **CYBRIK Cyber AI Platform** là intelligence plane: model runtime abstraction, RAG/CTI,
   investigation graph, agent orchestration, evidence synthesis và evaluation.
3. **CYBRIK Security Tool Fabric** là capability and control plane: tool registry, typed
   invocation, sandbox, egress control, policy, approval, execution receipt và MCP gateway.

Điểm đột phá không phải “AI trả lời hay”, mà là **AI tạo ra một Investigation Bundle**:
timeline, entity graph, giả thuyết, evidence, nguồn trích dẫn, ATT&CK mapping, tool receipts,
độ tin cậy, dữ liệu còn thiếu và đề xuất bước tiếp theo. Bundle này gắn vào case của SOC,
có thể replay và được một người khác kiểm tra độc lập.

### 1.1 Sở hữu capability không đồng nghĩa viết lại mọi engine

“Owner” trong kiến trúc có hai nghĩa phải tách rõ:

1. **Product ownership:** CYBRIK chịu trách nhiệm contract, hành vi, bảo mật, UX, vận hành, SLA,
   upgrade và kết quả end-to-end trước khách hàng.
2. **Engine/IP ownership:** mã thuật toán nền do CYBRIK tự viết. CYBRIK chỉ đầu tư vào phần tạo
   khác biệt; engine open-source/third-party giữ nguyên tên, license và ranh giới.

| Miền | CYBRIK bắt buộc sở hữu ở cấp sản phẩm | Engine/component được tích hợp, không rebrand |
|---|---|---|
| SIEM/Data Plane | Ingest contract, OCSF canonical model, event-lake write path, tenant isolation, Sigma correlation/detection lifecycle, search/hunt API, alert fusion, UI và audit | Kafka, OpenSearch, Wazuh, Suricata, Zeek, Arkime hoặc backend tương đương |
| Threat Intelligence | IOC operational registry trong SOC; STIX/TAXII ingest, source trust, dedup, marking, expiry/revocation, correlation, knowledge graph/RAG và signed offline update trong Cyber AI | MISP/OpenCTI-compatible server, public/commercial feeds và standards content |
| Sandbox/analysis | Tool Fabric job/policy/approval, S1/S2 isolation profile, artifact chain, resource/egress control, receipt, file/PCAP/log workflow | Container/microVM substrate và YARA/YARA-X/Suricata/Zeek/parser engines |
| EDR/NDR | Connector, normalization, investigation tool, containment policy và reversible action orchestration | Endpoint/kernel sensor và packet-analysis engine như Wazuh/Suricata/Zeek; không viết lại từ đầu trong 2026 |

Vì vậy SIEM/TI trong roadmap SOC và Cyber AI **không mâu thuẫn** với chiến lược tái sử dụng engine.
CYBRIK bán và chịu trách nhiệm cho capability hợp nhất; không nhận IP của engine tích hợp là IP
của mình.

## 2. Quyết định chiến lược đề xuất

| Chủ đề | Đề xuất |
|---|---|
| Mũi nhọn 2026 | Alert-to-Investigation cho môi trường on-prem/air-gapped |
| UI analyst | Chỉ SOC Command Center sở hữu; không xây ba UI cạnh tranh nhau |
| Mức tự chủ ban đầu | Read-only investigation; hành động ghi luôn cần approval |
| AI runtime | OpenAI-compatible abstraction; Qwen là profile mặc định, không hard-code |
| RAG ban đầu | PostgreSQL + pgvector, hybrid retrieval, policy-aware filtering |
| Orchestration | State machine bền vững, có checkpoint; không để LLM tự tạo vòng lặp vô hạn |
| Tool access | Tool Fabric là đường duy nhất; model không có credential hoặc shell trực tiếp |
| Interoperability | REST/OpenAPI + AsyncAPI; MCP là adapter được kiểm soát, không phải trust boundary |
| Dữ liệu sự kiện | OCSF nội bộ; STIX/TAXII cho CTI; Sigma/YARA/Suricata cho detection content |
| Supply chain | SBOM + AI-BOM + provenance + ký artifact; offline verification bắt buộc |
| Thị trường đầu tiên | Tổ chức cần data sovereignty: government, critical infrastructure, defence, finance |
| Product deadline | Full Feature Complete 2026-11-15; Full Competitive Release trước 2026-12-31 |
| Go-to-market | Paid Early Access từ 2027-01; 2027 là năm thương mại hóa và mở rộng |
| Phương pháp | AI-native continuous discovery/delivery, vertical slice hằng tuần, feature flag, shadow/canary |

## 3. Bản đồ tài liệu

| File | Nội dung |
|---|---|
| [01-STRATEGIC-THESIS.md](01-STRATEGIC-THESIS.md) | Định vị, cạnh tranh, product wedge, moat và anti-goals |
| [02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md](02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md) | Nghiên cứu đối thủ, chuẩn mở, pháp lý và nguồn chính thức |
| [03-REFERENCE-ARCHITECTURE.md](03-REFERENCE-ARCHITECTURE.md) | Ranh giới ba sản phẩm, trust zones, luồng dữ liệu và deployment tiers |
| [04-CORE-USE-CASES-AND-RELEASE-SCOPE.md](04-CORE-USE-CASES-AND-RELEASE-SCOPE.md) | Use case, autonomy ladder, full-feature release contract và intentional non-goals |
| [05-CONTRACTS-AND-INTEGRATION.md](05-CONTRACTS-AND-INTEGRATION.md) | REST/event/MCP contract sơ bộ, evidence và approval model |
| [06-ROADMAP-2026-2029.md](06-ROADMAP-2026-2029.md) | Execution board: Full Competitive Release trong 2026, thị trường từ 2027 |
| [07-SOLO-FOUNDER-AI-OPERATING-MODEL.md](07-SOLO-FOUNDER-AI-OPERATING-MODEL.md) | Cách một Founder dùng Claude/Codex để phát triển có kiểm soát |
| [08-EVALUATION-SECURITY-COMPLIANCE.md](08-EVALUATION-SECURITY-COMPLIANCE.md) | Eval, threat model, compliance, SLO và release gates |

Tài liệu 09 (bootstrap prompt) đã chuyển thành migration runbook:
[CLAUDE-CODE-MULTI-REPO-BOOTSTRAP.md](../migration/CLAUDE-CODE-MULTI-REPO-BOOTSTRAP.md) —
nó là runbook, không phải tài liệu chiến lược.

## 4. Nhãn bằng chứng dùng trong bộ tài liệu

- **[FACT–SOC]**: xác nhận trực tiếp từ code/tài liệu canonical của SOC hiện tại.
- **[RESEARCH]**: xác nhận từ nguồn chính thức bên ngoài, đường dẫn và ngày truy cập có trong
  tài liệu nghiên cứu.
- **[PROPOSAL]**: kiến trúc hoặc kế hoạch do tài liệu này đề xuất; chưa được triển khai.
- **[INFERENCE]**: suy luận từ hiện trạng/nghiên cứu; cần pilot hoặc đánh giá để xác nhận.
- **[DECISION]**: cần Founder quyết định trước khi biến thành cam kết.

## 5. Baseline được kế thừa từ SOC V2

**[FACT–SOC]** SOC hiện tại là modular monolith FastAPI + Next.js, PostgreSQL RLS,
Redis/Valkey cho rate limit/state, có canonical alert, alert/case/asset/IOC, RBAC, audit,
SOAR approval và AI Copilot. Nguồn canonical:

- `cybrik-soc-command-center:docs/architecture/ARCHITECTURE-OVERVIEW-2026-07.md`
- `cybrik-soc-command-center:docs/architecture/DATA-PLANE-V2.md`
- `cybrik-soc-command-center:docs/architecture/AI-COPILOT-ARCHITECTURE.md`
- `cybrik-soc-command-center:docs/product/PRODUCT-BOUNDARIES.md`
- `cybrik-soc-command-center:docs/licensing/OPEN-SOURCE-POLICY.md`
- `cybrik-soc-command-center:docs/security/SECURITY-BASELINE.md`

**[FACT–SOC]** Đường AI hiện hành nằm tại:

- `services/api/src/cybrik_soc/modules/copilot/api.py::ask`
- `services/api/src/cybrik_soc/modules/copilot/gateway.py::run_chat`
- `services/api/src/cybrik_soc/modules/copilot/llm.py::OpenAICompatClient`
- `services/api/src/cybrik_soc/modules/copilot/tools.py::ToolRegistry`
- `services/api/src/cybrik_soc/modules/copilot/models.py::CopilotAudit`

Các thành phần này là **điểm xuất phát và compatibility seam**, không phải bằng chứng rằng
Cyber AI Platform hoặc Tool Fabric đã tồn tại.

## 6. Sáu nguyên tắc không được đánh đổi

1. **Evidence before eloquence:** không có evidence thì AI phải abstain.
2. **No direct model authority:** model không giữ secret, credential, shell hoặc quyền ghi.
3. **Autonomy is per capability:** cấp tự chủ theo từng tool/use case, không bật toàn hệ thống.
4. **Tenant and classification travel with data:** tenant, purpose, clearance và case scope đi
   xuyên mọi API, event, retrieval và tool call.
5. **Everything consequential is replayable:** model, prompt, retrieval, tool, policy và approval
   đều có version/hash/receipt.
6. **Independent operation:** bản air-gapped phải cài, vận hành, cập nhật, backup, restore và
   verify artifact mà không phụ thuộc dịch vụ cloud của CYBRIK.

## 7. Các quyết định Founder đã khóa và cần cụ thể hóa

1. **Đã khóa:** feature contract mười trụ cột; không capability lõi nào được cắt hoặc chuyển sang
   2027. Cần ký acceptance criteria chi tiết cho từng trụ cột.
2. Chấp nhận tạo hai repository sản phẩm mới và một repository contract nhỏ, thay vì tiếp tục
   nhồi AI/tool orchestration vào SOC monolith?
3. Chọn 2–3 paid design partner cho 2027-Q1 để triển khai full release, không dùng pilot như giai
   đoạn hoàn thiện core feature?
4. Đặt lịch ngay trong 2026 cho legal review, independent penetration test và audit readiness?
   Đây không phải thêm developer, nhưng là điều kiện để lời hứa “quốc tế” đáng tin.
5. Chọn chính sách phát hành: LTS 24 tháng đề xuất, hay release liên tục không cam kết LTS?
