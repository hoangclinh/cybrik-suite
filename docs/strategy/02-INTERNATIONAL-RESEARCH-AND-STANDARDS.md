# International Research and Standards Baseline

- **Ngày nghiên cứu:** 2026-07-22
- **Trạng thái:** [RESEARCH] trừ nơi ghi nhãn khác
- **Nguyên tắc nguồn:** ưu tiên tài liệu chuẩn, cơ quan quản lý và tài liệu sản phẩm chính thức;
  không dùng bài “top products”, số liệu marketing thứ cấp hoặc nội dung không truy nguyên được.
- **Lưu ý:** quy định, model, MCP và sản phẩm AI thay đổi nhanh; phải re-verify trước mỗi major
  release và trước khi ký hợp đồng tại một jurisdiction mới.

## 1. Kết luận nghiên cứu

1. **Copilot và agent đã trở thành table stakes.** Các nền tảng lớn đều đi từ summary tới
   investigation, hunting, playbook, plugin và agent orchestration.
2. **Dữ liệu và context là lợi thế cấu trúc của đối thủ.** Microsoft/CrowdStrike/Google/Palo Alto
   đặt agent trên data lake, graph, sensors và threat intelligence của họ.
3. **Khoảng trống CYBRIK có thể sở hữu là sovereign + evidence + policy.** Tài liệu chính thức của
   Google cho biết Gemini SecOps dùng global Vertex AI endpoints; điều này hợp lệ với nhiều khách
   hàng nhưng để lại phân khúc cần inference hoàn toàn trong mạng khách hàng.
4. **MCP đang đi vào security platform nhưng không tự là security boundary.** Chuẩn MCP hiện hành
   cấm token passthrough, khuyến nghị audience binding và least privilege. CYBRIK phải đặt policy,
   identity, approval và receipt ở Tool Fabric dưới lớp MCP.
5. **CRA tạo deadline thật cho sản phẩm bán vào EU.** Nghĩa vụ báo cáo bắt đầu 2026-09-11 và CRA
   áp dụng đầy đủ 2027-12-11. Product security, vulnerability handling và evidence phải được xây
   từ đầu, không chờ gần GA.

## 2. Competitive landscape

| Nhà cung cấp | Năng lực đã công bố chính thức | Hàm ý cho CYBRIK |
|---|---|---|
| Microsoft | Security Copilot tích hợp Defender/Sentinel/Entra/Intune; plugin lấy incident, event, policy và TI; Sentinel phát triển data lake, graph, agent, playbook generation và MCP | Không cạnh tranh bằng chat/summary/NL-to-query; phải thắng ở local, vendor-neutral, evidence replay và disconnected operation |
| CrowdStrike | Charlotte AI, AgentWorks, agentic workforce và Agentic SOAR dựa trên Falcon data/TI; agent identity và guardrails là một phần platform | Tool Fabric phải có agent identity, policy và lifecycle ngay từ đầu; agent builder chỉ đến sau control plane |
| Google | Gemini SecOps hỗ trợ investigation, search, rule/playbook generation và recommendations; SOAR có lifecycle/version/rollback | Detection AI không được dừng ở generate rule; cần compile, replay, FP impact, approval và rollback |
| Palo Alto | Cortex XSIAM hợp nhất SIEM/XDR/SOAR/TIP; Agentic Assistant lập kế hoạch nhiều bước; Prisma AIRS bảo vệ prompt/model/agent/tool runtime | CYBRIK vừa phải dùng AI an toàn, vừa phải quan sát/bảo vệ chính AI/tool fabric của mình |

Nguồn chính thức:

- [Microsoft Security Copilot overview](https://learn.microsoft.com/en-us/copilot/security/microsoft-security-copilot)
- [Security Copilot application card for agents](https://learn.microsoft.com/en-us/copilot/security/security-copilot-application-card-agents)
- [Microsoft Sentinel agentic platform and MCP announcement](https://www.microsoft.com/en-us/security/blog/2025/09/30/empowering-defenders-in-the-era-of-agentic-ai-with-microsoft-sentinel/)
- [CrowdStrike Charlotte AI AgentWorks](https://www.crowdstrike.com/en-us/blog/how-charlotte-ai-agentworks-fuels-securitys-agentic-ecosystem/)
- [CrowdStrike Agentic SOAR](https://www.crowdstrike.com/en-us/blog/crowdstrike-leads-new-evolution-of-security-automation-with-charlotte-agentic-soar/)
- [Google Security Operations — Respond](https://cloud.google.com/security/products/security-orchestration-automation-response)
- [Gemini in Google SecOps overview](https://docs.cloud.google.com/chronicle/docs/secops/gemini-secops)
- [Cortex XSIAM Agentic AI documentation](https://docs-cortex.paloaltonetworks.com/r/Cortex-XSIAM/Cortex-XSIAM-3.x-Documentation/Agentic-AI-in-Cortex-XSIAM)
- [Prisma AIRS AI Runtime Security](https://www.paloaltonetworks.com/ai-security/ai-runtime-security)

### 2.1 Khoảng trống cạnh tranh khả thi

**[INFERENCE]** CYBRIK không có lợi thế telemetry toàn cầu hoặc đội threat research hàng nghìn
người. Định vị khả thi hơn là:

- hoạt động đầy đủ ở on-prem/air-gap;
- không phụ thuộc một SIEM/XDR;
- transparency cao hơn: evidence provenance, tool receipt, prompt/model/tool versions;
- approval và tenant/classification native;
- TCO phù hợp với SOC vừa và sovereign MSSP;
- hỗ trợ English/Vietnamese ngay từ contract và evaluation, sau đó mở thêm locale.

## 3. Chuẩn dữ liệu và nội dung an ninh

| Lớp | Chuẩn đề xuất | Cách dùng trong CYBRIK |
|---|---|---|
| Security events | [OCSF](https://ocsf.io/) | Canonical interchange schema cho event/finding; version mapping, không làm mất raw provenance |
| CTI objects | [STIX 2.1](https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html) | Object/relationship/marking cho CTI; extension chỉ khi không biểu diễn được bằng chuẩn |
| CTI transport | [TAXII 2.1](https://docs.oasis-open.org/cti/taxii/v2.1/os/taxii-v2.1-os.html) | Feed collections qua HTTPS; bản air-gap dùng signed export bundle với cùng object model |
| Adversary behavior | [MITRE ATT&CK](https://attack.mitre.org/techniques/) | Version-pin content, lưu technique version và mapping provenance |
| Log detection | [Sigma specification](https://sigmahq.io/sigma-specification/) | Authoring/interchange; compile sang backend và backtest trước publish |
| File detection | [YARA/YARA-X](https://virustotal.github.io/yara-x/docs/writing_rules/anatomy-of-a-rule/) | File/memory pattern; chạy trong sandbox, giới hạn resource |
| Network detection | [Suricata rules](https://docs.suricata.io/) | IDS signature; validate syntax, PCAP replay và measure noise |
| Playbook interchange | [CACAO 2.0](https://docs.oasis-open.org/cacao/security-playbooks/v2.0/security-playbooks-v2.0.html) | Import/export playbook; internal executor vẫn dùng typed capability + policy riêng |
| Action language | [OpenC2 2.0](https://docs.oasis-open.org/openc2/oc2ls/v2.0/oc2ls-v2.0.html) | Adapter cho actuator tương thích; không thay thế authorization/approval |
| Observability | [OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/) | Trace/metric/log xuyên SOC→AI→Fabric; raw prompt/evidence không export mặc định |

### 3.1 Ghi chú ATT&CK versioning

Trang ATT&CK chính thức ghi nhận **Data Source objects bị deprecated trong ATT&CK v18, tháng
10/2025**. Vì vậy schema mới không được hard-code mô hình Data Source cũ; phải lưu ATT&CK version
và theo dõi Detection Strategies/Data Components hiện hành.

Nguồn: [MITRE ATT&CK Data Sources](https://attack.mitre.org/datasources/).

## 4. MCP và tool interoperability

Baseline đề xuất là pin MCP **2025-11-25** cho lần triển khai đầu, chỉ nâng sau compatibility test.

Các yêu cầu bảo mật lấy từ tài liệu chính thức:

- không token passthrough;
- token phải dành cho đúng audience/resource;
- token ngắn hạn, scope nhỏ nhất;
- HTTPS/mTLS cho remote transport;
- explicit user consent/approval với hành động nhạy cảm;
- MCP server không nhận credential của model;
- mọi tool invocation phải qua authorization của Tool Fabric.

Nguồn:

- [MCP Authorization specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)

**[PROPOSAL]** MCP là adapter cho discovery/invocation. Contract typed, policy decision, approval,
idempotency và execution receipt là chuẩn nội bộ của CYBRIK. Điều này cho phép thay MCP version
hoặc cung cấp REST/CLI mà không đổi mô hình an ninh.

## 5. AI risk and secure agent baseline

| Nguồn | Ứng dụng bắt buộc |
|---|---|
| [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) | Govern–Map–Measure–Manage cho AI product lifecycle |
| [NIST GenAI Profile AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) | Risk register/eval cho confabulation, data privacy, information integrity, misuse |
| [NIST AI 100-2e2025](https://csrc.nist.gov/pubs/ai/100/2/e2025/final) | Taxonomy adversarial ML: evasion, poisoning, privacy, misuse |
| [MITRE ATLAS](https://atlas.mitre.org/) | Threat model/red-team cases cho RAG, model, prompt và agent/tool |
| [OWASP GenAI Security Project](https://genai.owasp.org/) | LLM/agentic application risks và implementation checklist |
| [NIST Cybersecurity Framework 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20) | Enterprise cybersecurity outcomes và governance baseline |
| [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) | Secure development lifecycle baseline |
| [NIST SP 800-218A](https://csrc.nist.gov/Projects/ssdf/publications) | SSDF profile cho generative AI/dual-use foundation models |

**[PROPOSAL]** Mỗi release phải có crosswalk tối thiểu giữa threat cases nội bộ và NIST AI
100-2, MITRE ATLAS, OWASP LLM/Agentic risks. Không dùng một checklist duy nhất như bằng chứng
“AI secure”.

## 6. Identity, zero trust và tenant isolation

| Chuẩn/nguồn | Kiến trúc áp dụng |
|---|---|
| [NIST SP 800-207 Zero Trust](https://csrc.nist.gov/pubs/sp/800/207/final) | Verify explicitly, least privilege, assume breach giữa ba sản phẩm |
| [NIST SP 800-207A](https://csrc.nist.gov/pubs/sp/800/207/a/final) | Workload identity cho cloud-native/multi-service |
| [SPIFFE concepts](https://spiffe.io/docs/latest/spiffe/concepts/) | SPIFFE ID + short-lived X.509 SVID cho service/workload, trust domain tách theo deployment |

Không truyền access token người dùng nguyên trạng sang tool backend. SOC phát **delegation token
ngắn hạn, audience-bound, purpose-bound**; Tool Fabric đổi thành workload credential phù hợp sau
khi policy cho phép. Tenant/clearance phải được áp ở từng data store, không chỉ ở API gateway.

## 7. Software and AI supply-chain baseline

| Năng lực | Chuẩn/công cụ chuẩn mở | Yêu cầu CYBRIK |
|---|---|---|
| SBOM/AI-BOM | [SPDX 3.0](https://spdx.dev/use/specifications/), [SPDX AI profile](https://spdx.dev/learn/areas-of-interest/ai/) | Mô tả code, model, dataset, prompt, agent, license và relationship |
| Alternative BOM/VEX | [CycloneDX](https://cyclonedx.org/) | Tiếp tục tương thích CI hiện tại; thêm AI/ML-BOM và VEX khi toolchain ổn định |
| Build provenance | [SLSA 1.2](https://slsa.dev/spec/v1.2/requirements) | Signed provenance, hermetic/reproducible where practical, protected builder |
| Signing | [Sigstore Cosign self-managed keys](https://docs.sigstore.dev/cosign/key_management/signing_with_self-managed_keys/) | KMS/HSM hoặc key nội bộ; bản air-gap verify offline |
| Offline verification | [Cosign verification](https://docs.sigstore.dev/cosign/verifying/verify/) | Bundle signature/provenance/public roots cùng release, không phụ thuộc public Rekor lúc cài |

**[FACT–SOC]** CI hiện tại đã sinh CycloneDX SBOM và có dependency/secret scan theo
`cybrik-soc-command-center:docs/architecture/ARCHITECTURE-OVERVIEW-2026-07.md`. Đây là nền
tốt nhưng chưa phải AI-BOM hoặc product-level vulnerability response.

## 8. Regulatory and certification horizon

### 8.1 European Union AI Act

Nguồn chính thức hiện hành cho biết:

- AI Act có hiệu lực 2024-08-01;
- prohibited practices và AI literacy áp dụng từ 2025-02-02;
- nghĩa vụ cho GPAI model providers áp dụng từ 2025-08-02;
- transparency rules áp dụng từ 2026-08-02;
- lịch high-risk đã được điều chỉnh qua AI omnibus/political agreement và còn phụ thuộc loại hệ
  thống; phải re-verify khi phát hành.

Nguồn:

- [European Commission — AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- [GPAI obligations](https://digital-strategy.ec.europa.eu/en/factpages/general-purpose-ai-obligations-under-ai-act)
- [Guidelines for GPAI providers](https://digital-strategy.ec.europa.eu/en/faqs/guidelines-obligations-general-purpose-ai-providers)

**[INFERENCE, not legal advice]** Nếu CYBRIK chỉ tích hợp model open-weight của bên khác và không
huấn luyện/đưa một GPAI model riêng ra thị trường, CYBRIK có khả năng là downstream AI system
provider/deployer chứ không phải GPAI model provider. Fine-tune lớn, đổi tên model hoặc phân phối
weights có thể thay đổi vai trò. Cần legal review theo từng release và sales model.

### 8.2 EU Cyber Resilience Act

- CRA áp dụng cho hardware/software products with digital elements đưa vào thị trường EU.
- Nghĩa vụ báo cáo bắt đầu **2026-09-11**.
- Early warning trong 24 giờ và full notification trong 72 giờ đối với trường hợp thuộc phạm vi.
- CRA áp dụng đầy đủ từ **2027-12-11**.

Nguồn:

- [European Commission — CRA summary](https://digital-strategy.ec.europa.eu/en/policies/cra-summary)
- [CRA reporting obligations](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting)
- [Regulation (EU) 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R2847)

Hàm ý roadmap: PSIRT, vulnerability intake, coordinated disclosure, supported-product inventory,
SBOM/VEX, secure update, incident clock và customer notification workflow phải có trước GA.

### 8.3 NIS2, GDPR và customer obligations

- [NIS2 Directive (EU) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/2022-12-27?locale=en)
  tác động tới nhiều khách hàng thiết yếu/quan trọng; CYBRIK nên tạo evidence và report hỗ trợ
  khách hàng, nhưng không tự tuyên bố làm họ compliant.
- [GDPR Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj) yêu cầu privacy
  by design, minimization, purpose limitation và quyền data subject khi dữ liệu cá nhân nằm trong
  log/evidence. Cần retention/deletion/export policy theo tenant và legal hold.

### 8.4 Management systems and certification

| Chuẩn | Mục tiêu thực tế |
|---|---|
| [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) | Bắt đầu ISMS evidence từ 2026; readiness 2027; certification khi sales yêu cầu và phạm vi ổn định |
| [ISO/IEC 42001:2023](https://www.iso.org/standard/42001) | AIMS inventory/risk/impact/eval/change control; readiness song song GA |
| [ISO/IEC 23894:2023](https://www.iso.org/standard/77304.html) | AI risk-management guidance bổ sung cho 42001/NIST AI RMF |
| [ENISA EUCC](https://certification.enisa.europa.eu/browse-topic/eucc_en) | Theo dõi cho product assurance; certification scheme không phải core software capability |

“Aligned”, “ready” và “certified” là ba trạng thái khác nhau; tài liệu bán hàng phải dùng đúng từ.

## 9. Standards adoption order

### P0 — phải có trong contract đầu tiên

- OpenAPI/JSON Schema, OCSF mapping version, STIX/TAXII 2.1;
- ATT&CK version pin;
- SPIFFE/mTLS hoặc tương đương cho workload identity;
- OpenTelemetry trace correlation;
- SPDX/CycloneDX BOM + signed release;
- MCP authorization profile có audience-bound token và no passthrough.

### P1 — phải có trước integrated beta / pre-market

- Sigma/YARA/Suricata content lifecycle;
- CACAO import/export tối thiểu;
- SLSA provenance;
- NIST AI RMF/GenAI risk register và MITRE ATLAS/OWASP eval mapping.

### P2 — sau khi core workflow chứng minh giá trị

- OpenC2 actuator adapters;
- EUCC/Common Criteria assessment nếu procurement yêu cầu;
- public connector certification program và marketplace governance.

## 10. Research watchlist

Re-verify mỗi quý:

- MCP specification/security guidance và tương thích client;
- EU AI Act implementing guidance/standards;
- CRA implementing/delegated acts và ENISA reporting platform;
- ATT&CK release/model changes;
- OCSF, STIX/TAXII, Sigma và CycloneDX/SPDX versions;
- Qwen/vLLM/Ollama licenses, security advisories và model cards;
- competitive agent autonomy, evidence/audit claims và on-prem offerings.
