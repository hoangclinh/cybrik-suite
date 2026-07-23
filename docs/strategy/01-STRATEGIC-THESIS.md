# Strategic Thesis — CYBRIK Sovereign Security Investigation Suite

- **Trạng thái:** [PROPOSAL]
- **Ngày:** 2026-07-22
- **Đọc cùng:** [README.md](README.md), [02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md](02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md)

## 1. Vấn đề CYBRIK phải giải quyết

SOC hiện đại không thiếu dashboard hoặc alert; họ thiếu năng lực biến một alert thành quyết định
có thể bảo vệ trước quản lý, kiểm toán hoặc cơ quan điều tra. Một analyst thường phải:

1. tìm alert liên quan và raw telemetry;
2. enrich IOC/CVE/asset/identity;
3. dựng timeline và phạm vi ảnh hưởng;
4. đối chiếu CTI và MITRE ATT&CK;
5. chạy công cụ log/PCAP/file;
6. ghi lại vì sao đã kết luận và ai đã phê duyệt hành động;
7. chuyển kết quả thành case, detection mới và báo cáo.

Các bước đó phân tán qua nhiều console, phụ thuộc kinh nghiệm cá nhân và khó tái hiện. AI có thể
rút ngắn chuỗi này, nhưng AI không kiểm soát được evidence, tool authority và audit sẽ tạo ra rủi
ro lớn hơn vấn đề ban đầu.

## 2. Vì sao “SOC Copilot” không còn là định vị đủ mạnh

**[RESEARCH]** Microsoft, CrowdStrike, Google và Palo Alto đều đã công bố năng lực tóm tắt,
triage, threat hunting bằng ngôn ngữ tự nhiên, agent, plugin/connector và playbook. Microsoft
còn đưa graph, MCP và agent store vào Sentinel; CrowdStrike đưa AgentWorks và Agentic SOAR;
Google SecOps kết hợp Gemini với investigation và playbook; Cortex XSIAM có agent lập kế hoạch
nhiều bước. Bảng nguồn chi tiết ở
[02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md](02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md).

Do đó:

- local LLM chỉ là deployment property;
- alert summary chỉ là feature;
- natural-language query chỉ là table stakes;
- “multi-agent” không tự tạo lợi thế nếu dữ liệu, tool và evidence không đáng tin.

## 3. Product wedge đề xuất

### 3.1 Lời hứa sản phẩm

> Từ một alert, CYBRIK tạo hồ sơ điều tra kiểm chứng được trong hạ tầng khách hàng — không gửi
> dữ liệu ra ngoài, không cho model quyền vượt kiểm soát, và không bỏ mất chuỗi bằng chứng.

### 3.2 Đơn vị giá trị: Investigation Bundle

Mỗi cuộc điều tra sinh một bundle bất biến gồm:

- `investigation_id`, tenant, case/alert scope và actor;
- snapshot/hash của alert, raw evidence và tài liệu đã dùng;
- entity graph: host, user, IP, domain, file, process, vulnerability;
- timeline có múi giờ và provenance;
- giả thuyết, evidence ủng hộ/phản bác, độ tin cậy và khoảng trống dữ liệu;
- ATT&CK mapping và CTI references;
- tool plan, tool invocation, execution receipt và artifact output;
- model/runtime/prompt/retriever/policy/tool version;
- approval/denial và người chịu trách nhiệm;
- analyst verdict, feedback và detection candidates phát sinh.

Bundle vừa là đầu ra cho analyst, vừa là dataset để evaluation, audit, handoff và cải thiện
detection. Đây là tài sản dữ liệu riêng mà đối thủ khó sao chép từ model đơn thuần.

### 3.3 Ba khoảnh khắc “wow” có giá trị thật

1. **One-click evidence-backed investigation:** mở alert và nhận timeline + blast radius +
   evidence citations, không phải đoạn văn chung chung.
2. **Ask “what is missing?”:** AI không chỉ kết luận; nó chỉ ra telemetry nào còn thiếu và đề
   xuất tool/query để kiểm chứng từng giả thuyết.
3. **Turn learning into defence:** analyst chấp nhận kết luận; hệ thống tạo draft Sigma/YARA/
   Suricata, chạy replay/backtest, hiển thị false-positive impact rồi mới cho publish qua approval.

## 4. Định vị quốc tế

### 4.1 Beachhead market

**[PROPOSAL]** Ưu tiên tổ chức có một hoặc nhiều đặc điểm:

- yêu cầu on-prem, disconnected hoặc air-gapped;
- dữ liệu không được đi qua public cloud;
- cần multi-tenant/MSSP nhưng vẫn tách dữ liệu chặt;
- hạ tầng nhiều vendor, không muốn khóa vào một XDR/SIEM duy nhất;
- cần evidence chain, approval và báo cáo phục vụ kiểm toán/điều tra;
- thiếu analyst cấp cao nhưng có đội vận hành tại chỗ.

Vertical phù hợp: government, critical infrastructure, defence, finance, telecom, large
industrial và sovereign MSSP. Không định vị ban đầu cho SMB cloud-first cần một SaaS plug-and-play.

### 4.2 Thông điệp tiếng Anh đề xuất

> **CYBRIK is a sovereign security investigation operating system that turns alerts into
> evidence-backed, replayable investigations and policy-controlled actions — entirely inside
> the customer's environment.**

### 4.3 Khác biệt cần chứng minh, không chỉ tuyên bố

| Claim | Evidence sản phẩm phải có |
|---|---|
| Sovereign | Network-isolation test, offline installer/update, no-phone-home verification |
| Evidence-backed | Citation precision, provenance chain, contradiction/abstention tests |
| Safe agentic | Tool-policy tests, tenant leak tests, approval receipts, kill switch |
| Replayable | Re-run từ bundle với version/hash đầy đủ, structural diff |
| Vendor-neutral | OCSF/STIX/TAXII/Sigma + ít nhất ba SIEM/tool integrations thật |
| International-ready | English-first API/docs/UI, PSIRT, SBOM/VEX, support policy, external pentest |

## 5. Ranh giới tài sản trí tuệ

**[FACT–SOC]** `cybrik-soc-command-center:docs/product/PRODUCT-BOUNDARIES.md` đã xác định CYBRIK
sở hữu portal, workbench, canonical model, connector framework, alert fusion, case, AI, RBAC và
audit; engine bên thứ ba giữ nguyên tên và license.

**[PROPOSAL]** IP mới nên tập trung vào:

- Investigation Graph và Investigation Bundle schema;
- evidence-aware orchestration và confidence/abstention policy;
- tenant/classification-aware retrieval;
- capability risk model, approval calculus và execution receipt;
- deterministic tool adapters cho security workflows;
- security-specific eval datasets, replay harness và release gates;
- offline content/model/tool update supply chain.

CYBRIK vẫn sở hữu SIEM, TI và sandbox ở cấp **product capability/control plane**. Không đầu tư IP
vào việc fork/rebrand hoặc viết lại commodity search/index, endpoint agent, malware scanner, NIDS,
virtualization substrate hay open-source sandbox engine. IP tập trung vào canonical semantics,
evidence, orchestration, policy, isolation profile, integration, lifecycle và analyst workflow.

## 6. Moat tích lũy theo thời gian

### 6.1 Workflow moat

Mỗi analyst decision tạo quan hệ giữa alert, evidence, tool result, verdict và action. Khi được
ẩn danh/giữ trong tenant theo policy, dữ liệu này cải thiện ranking, playbook và detection mà không
cần fine-tune model ngay.

### 6.2 Evaluation moat

Golden cases song ngữ, attack simulations, PCAP/file corpus hợp pháp, prompt/tool-injection cases
và regression history quan trọng hơn việc chạy model mới nhất. Model có thể thay; eval corpus và
release discipline là tài sản bền hơn.

### 6.3 Integration moat

Tool Fabric tích lũy adapter có typed input/output, permission, isolation profile, evidence
semantics và test fixture. Số lượng connector không quan trọng bằng độ tin cậy và khả năng chứng
minh side effect.

### 6.4 Trust moat

Offline verification, transparent security advisories, SBOM/AI-BOM, signed releases, stable API,
long-term support và independent assessment tạo niềm tin quốc tế mà marketing AI không thay thế.

## 7. Anti-goals đến hết 2027

1. Không huấn luyện foundation model riêng.
2. Không fork/rebrand hoặc viết lại commodity SIEM storage/search, EDR sensor, NDR packet engine
   hay sandbox substrate từ đầu; vẫn phải cung cấp đầy đủ SIEM/TI/sandbox product capability.
3. Không mở tool marketplace công khai trước khi tool signing, review và revocation hoàn chỉnh.
4. Không cho LLM shell tổng quát hoặc credential trực tiếp.
5. Không tự động hoá hành động phá huỷ/chặn diện rộng.
6. Không tạo UI analyst riêng cho Cyber AI hoặc Tool Fabric.
7. Không hỗ trợ hàng chục deployment profile; chỉ ba tier chuẩn.
8. Không tuyên bố compliance/certification khi mới chỉ “aligned”.
9. Không đo thành công bằng số prompt, token hoặc số agent.
10. Không xây RAG, CTI, PCAP, detection và response như các project thành phần tách rời rồi chờ
    tích hợp cuối kỳ; tất cả phát triển đồng thời theo weekly vertical slices của golden workflow.
    Public marketplace và A5 destructive autonomy vẫn nằm ngoài V1; A4 low-risk bounded
    automation nằm trong Full Competitive Release 2026.

## 8. Mô hình thương mại sơ bộ

**[PROPOSAL]** Tách license theo giá trị vận hành, không theo token:

- **SOC Command Center:** theo tenant/analyst hoặc deployment tier.
- **Cyber AI Platform:** theo compute profile + số investigation đồng thời; không meter từng token
  trong bản local vì khó dự toán và tạo cảm giác SaaS.
- **Security Tool Fabric:** core gateway đi kèm; advanced sandbox/executor và certified connector
  packs là add-on.
- **Content & assurance subscription:** signed CTI/detection/eval/update bundles cho môi trường
  disconnected.
- **BPECH/partners:** triển khai, tích hợp, vận hành, đào tạo theo ranh giới pháp nhân hiện hành.

Giá chỉ được chốt sau hai design partner pilot và dữ liệu TCO phần cứng/vận hành.

## 9. Chỉ số North Star

**North Star:** tỷ lệ investigation được hoàn thành với evidence bundle đầy đủ trong thời gian mục
tiêu, không có vi phạm tenant/policy.

Các chỉ số phụ:

- giảm median time-to-triage và time-to-scope;
- tỷ lệ claim có evidence hợp lệ;
- tỷ lệ analyst chấp nhận/sửa/bác đề xuất;
- số lần AI abstain đúng khi thiếu dữ liệu;
- detection candidate vượt backtest và được publish;
- tool action bị policy từ chối đúng;
- số incident tái hiện được từ bundle;
- upgrade/restore thành công trong môi trường offline.

## 10. Điều kiện để lời hứa “quốc tế” đáng tin

Một developer duy nhất có thể theo đuổi full-feature contract nếu tái sử dụng engine trưởng thành,
chuẩn hóa contract, chia module ownership cho AI và tích hợp liên tục. Nhưng chính Founder không
thể đồng thời là tác giả, người kiểm thử độc lập, pentester và bên chứng nhận. Vì vậy roadmap
giữ một người phát triển nhưng bắt buộc dùng dịch vụ độc lập cho:

- legal/license/privacy review;
- penetration test trước GA;
- đánh giá ISO readiness/certification khi đến ngưỡng;
- kiểm chứng bản dịch pháp lý và tài liệu hợp đồng;
- pilot validation từ khách hàng ngoài nhóm phát triển.

Đây là assurance boundary, không phải mở rộng đội development.
