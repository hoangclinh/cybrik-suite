# CYBRIK Suite — Vulnerability Disclosure Policy & Intake Specification

**Document Status:** `ACTIVE — APPROVED BY FOUNDER`  
**Governance Marker:** `RB-001 RESOLVED; INTAKE CHANNEL VERIFIED (security@cybrik.ai -> contact@bpech.com via Cloudflare Email Routing)`  
**Target Scope:** All 4 CYBRIK Suite core repositories (`cybrik-suite`, `cybrik-soc-command-center`, `cybrik-cyber-ai-platform`, `cybrik-security-tool-fabric`)  
**Specification Version:** 1.0.0  
**Last Updated:** 2026-08-20  

---

## 1. Executive Summary & Purpose

This document establishes the official policy, triage protocol, and structured intake specification for responsible vulnerability disclosure across the CYBRIK Suite. It is active and externally binding.

Suite Release Blocker **RB-001** (recorded in [`docs/releases/RELEASE-BLOCKERS.md`](../releases/RELEASE-BLOCKERS.md)) required a verified, monitored intake channel, legal safe-harbor protections, and operational response procedures before any external software release. This document satisfies the policy specification requirement of RB-001; the intake channel `security@cybrik.ai` (secondary alias `report@cybrik.ai`) has been provisioned and verified via Cloudflare Email Routing to `contact@bpech.com`, and repository-level `SECURITY.md` files have been activated across all four repositories. **RB-001 is RESOLVED (2026-08-20).**

---

## 2. Legal Safe Harbor Statement

CYBRIK values the contributions of the independent security research community. When conducting security research in good faith and in compliance with this policy, CYBRIK commits to the following protections:

1. **Authorization under CFAA and Equivalent Laws:**  
   CYBRIK considers security research conducted under the terms of this policy to be authorized conduct under the Computer Fraud and Abuse Act (CFAA) (18 U.S.C. § 1030) and state/international computer misuse statutes.
2. **DMCA Anti-Circumvention Safe Harbor:**  
   CYBRIK will not bring copyright infringement claims or assert violations of DMCA § 1201 against researchers for circumventing security controls during bona fide security research on in-scope systems.
3. **Terms of Service Exemption:**  
   To the extent that research activities conflict with general Terms of Service or Acceptable Use Policies, CYBRIK grants a limited, revocable waiver solely for good-faith vulnerability discovery and coordinated disclosure in compliance with this policy.
4. **Legal Non-Action Guarantee:**  
   CYBRIK will not initiate legal action against, or contact law enforcement regarding, researchers who adhere to the following Good-Faith Rules of Engagement.

### 2.1 Rules of Engagement for Good-Faith Research

To remain protected under this Safe Harbor, researchers MUST:
- Make every effort to avoid privacy violations, degradation of user experience, disruption to production environments, and destruction or manipulation of data.
- Only interact with test accounts, designated sandbox environments, or accounts owned directly by the researcher. Accessing, modifying, or exfiltrating data belonging to other tenants or users is strictly prohibited.
- Stop testing and report immediately upon encountering sensitive data (e.g., PII, credentials, private keys, cross-tenant records). Do not view, download, or retain more data than the absolute minimum required to prove the vulnerability concept.
- Maintain strict confidentiality under the 90-day Coordinated Vulnerability Disclosure (CVD) embargo window; do not publish or disclose technical details to third parties without mutual written agreement.
- Refrain from extortion, ransom demands, or withholding vulnerability details for commercial leverage.

---

## 3. Scope Definition & Asset Categorization

This policy covers vulnerabilities discovered in the codebase, architecture, contracts, and deployed runtime services of all four CYBRIK Suite products.

```
+-------------------------------------------------------------------------------+
|                             CYBRIK SUITE ECOSYSTEM                            |
+-------------------------------------------------------------------------------+
|  cybrik-suite                 | Multi-tenant orchestrator & contract packet   |
|  cybrik-soc-command-center    | SOC UI, alert routing, case management & RBAC |
|  cybrik-cyber-ai-platform     | Agentic inference plane & model adapters      |
|  cybrik-security-tool-fabric  | Isolated tool execution sandboxes (S0-S3)     |
+-------------------------------------------------------------------------------+
```

### 3.1 In-Scope Technical Assets

| Repository / Asset | Key Subsystems & Attack Surfaces in Scope |
|---|---|
| **`cybrik-suite`** | Cross-product contract schemas (`contracts/json-schema`), AsyncAPI event specifications, delegation tokens, state transitions, release manifest integrity. |
| **`cybrik-soc-command-center`** | Web frontend/backend, tenant isolation boundaries, analyst authentication/authorization, case management, approval gate bypasses. |
| **`cybrik-cyber-ai-platform`** | AI agent orchestration pipelines, prompt/instruction injection defenses, context aggregators, inference transport adapters, model weights exfiltration. |
| **`cybrik-security-tool-fabric`** | Sandboxed tool execution runners (S0–S3 profiles), container/jailbreak escapes, risk-class gating (R0–R3), capability token verification. |

### 3.2 In-Scope Vulnerability Classes

- **Remote Code Execution (RCE)** and Command Injection in orchestrators, tool runners, or backend services.
- **Cross-Tenant Data Exposure** and Insecure Direct Object References (IDOR) violating ADR-0006 tenant isolation.
- **Tool Sandbox Escapes** breaching container boundaries (S1/S2/S3 isolation profiles) or executing unpermitted host side effects.
- **Authentication and Authorization Bypasses**, including forged delegation chains, invalidated JWT/SPIFFE tokens, or privilege escalation.
- **Agentic & LLM Exploitation** (OWASP Top 10 for LLMs), including indirect prompt injections that hijack tool invocation or tamper with durable case outcomes.
- **Cryptographic & Signature Failures**, including contract attestation tampering or Phase 5c technical review receipt forgery.
- **Server-Side Request Forgery (SSRF)** against internal service control planes or cloud metadata endpoints.
- **Hardcoded Secret / Credential Leakage** within codebases or emitted telemetry.

### 3.3 Out-of-Scope Targets & Activities

The following activities and target classes are explicitly **EXCLUDED** from scope and not covered by safe harbor protections:

1. **Denial of Service (DoS/DDoS):** Volumetric network flooding, resource exhaustion attacks against shared infrastructure, or uncoordinated high-volume fuzzing.
2. **Social Engineering:** Phishing, vishing, smishing, or physical attacks targeting CYBRIK founders, employees, contractors, or datacenter facilities.
3. **Third-Party Upstream Infrastructure:** Cloud providers (AWS/GCP/Azure), third-party DNS, or SaaS dependencies (unless demonstrating a direct vulnerability in CYBRIK's configuration or code integration).
4. **Non-Impactful Bugs:** Missing HTTP security headers without proof of exploitability, self-XSS, logout CSRF, or SPF/DKIM/DMARC informational records on non-sending domains.
5. **Pre-Compromised Host Scenarios:** Attacks requiring prior root/admin access to an endpoint where the vulnerability does not elevate privileges beyond local host control.

---

## 4. Vulnerability Severity & Response SLA Matrix

CYBRIK commits to deterministic, SLA-backed vulnerability handling aligned with Common Vulnerability Scoring System (CVSS) v3.1 / v4.0 metrics:

| Severity Tier | CVSS v3.1 Score | Initial Response SLA | Triage & Validation SLA | Target Remediation SLA | Embargo Period |
|---|---|---|---|---|---|
| **CRITICAL** | 9.0 – 10.0 | **24 hours** | 48 hours | **7 calendar days** | 90 days |
| **HIGH** | 7.0 – 8.9 | **48 hours** | 96 hours | **14 calendar days** | 90 days |
| **MEDIUM** | 4.0 – 6.9 | **72 hours** | 7 calendar days | **30 calendar days** | 90 days |
| **LOW / INFO** | 0.1 – 3.9 | **7 calendar days** | 14 calendar days | **90 calendar days** | 90 days |

### 4.1 SLA Workflow Definitions

- **Initial Response SLA:** The maximum elapsed time before the CYBRIK security triage team acknowledges receipt of the report and assigns a tracking identifier (`CYBRIK-VULN-YYYY-XXXX`).
- **Triage & Validation SLA:** The timeframe within which engineering reproduces the vulnerability, validates impact, and assigns an authoritative CVSS rating.
- **Target Remediation SLA:** The timeframe to develop, test, and merge verified patches into repository mainlines and release security fixes to affected consumers.
- **Embargo Period:** The standard 90-day window from initial intake during which all parties agree to maintain non-disclosure.

---

## 5. Coordinated Vulnerability Disclosure (CVD) Protocol

CYBRIK adheres strictly to the principles of Coordinated Vulnerability Disclosure (CVD):

```
+------------------+     +-------------------+     +--------------------+     +---------------------+
| 1. Secure Intake | --> | 2. Triage & CVSS  | --> | 3. Patch & Validate| --> | 4. Public Advisory  |
| (JSON / PGP Enc) |     | (24h - 72h SLA)   |     | (7d - 30d SLA)     |     | (CVE / Attribution) |
+------------------+     +-------------------+     +--------------------+     +---------------------+
```

1. **Standard 90-Day Embargo:**  
   Vulnerability reports remain under confidential embargo for 90 calendar days from initial acknowledgment, or until a patch is released and mutually agreed upon for disclosure, whichever comes first.
2. **Mutual Disclosure Timing:**  
   CYBRIK coordinates public disclosure dates with the researcher. If a fix is deployed ahead of 90 days, disclosure may be accelerated by mutual written consent.
3. **Active Exploitation Exception:**  
   If CYBRIK or the researcher obtains verifiable evidence that the reported vulnerability is being actively exploited in the wild, both parties will collaborate on an emergency expedited timeline (targeting fix and advisory within 24–48 hours).
4. **CVE Reservation & Attribution:**  
   CYBRIK will request or assign a standard Common Vulnerabilities and Exposures (CVE) identifier for verified vulnerabilities of Medium or higher severity. Researchers adhering to this policy will receive explicit credit in the public advisory, release notes, and the CYBRIK Security Hall of Fame (subject to researcher preference).
5. **No Bounties (Pre-Release Phase):**  
   During the current pre-release phase, CYBRIK does not operate a paid monetary bug bounty program. Researchers are acknowledged via public attribution, CVE co-authorship, and formal letters of recognition.

---

## 6. RFC 9116 `security.txt` Specification

To provide automated and standard discovery for security researchers, CYBRIK publishes the following RFC 9116 `security.txt` specification.

> [!NOTE]
> The disclosure mailbox is live and verified. The `Encryption:` PGP key endpoint is the only element still pending publication.

### 6.1 Canonical `/.well-known/security.txt`

```text
# CYBRIK Suite RFC 9116 Security Contact File
# Canonical location: https://cybrik.ai/.well-known/security.txt
# Policy: https://github.com/hoangclinh/cybrik-suite/blob/main/docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md

Contact: mailto:security@cybrik.ai
Contact: https://github.com/hoangclinh/cybrik-suite/security/advisories/new
Expires: 2027-08-20T00:00:00.000Z
Encryption: https://cybrik.ai/pgp-key.asc
Preferred-Languages: en, vi
Canonical: https://cybrik.ai/.well-known/security.txt
Policy: https://github.com/hoangclinh/cybrik-suite/blob/main/docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md
Hiring: https://cybrik.ai/careers
Acknowledgments: https://github.com/hoangclinh/cybrik-suite/blob/main/docs/security/HALL-OF-FAME.md
```

---

## 7. Vulnerability Intake Specifications & Templates

Security researchers may submit vulnerability reports via structured JSON conforming to the formal schema, or via structured Markdown.

### 7.1 JSON Schema Intake Specification

The formal schema validating automated disclosure submissions is maintained at:
[`docs/security/disclosure-intake-schema.json`](disclosure-intake-schema.json)

Submissions must conform to `draft/2020-12` and include required fields: `reporter`, `affected_repository`, `affected_component`, `vulnerability_type`, `severity`, `summary`, `reproduction_steps`, `proof_of_concept`, and `disclosure_embargo_agreement`.

### 7.2 Structured Markdown Report Template

Researchers submitting reports via secure email or private repository advisory should utilize the following structure:

```markdown
# [CYBRIK-REPORT] <Short Title Describing Vulnerability>

## 1. Reporter Information
- **Name / Handle:** <Researcher Name or Handle>
- **Email:** <Contact Email>
- **Organization / Affiliation:** <Independent or Org>
- **PGP Fingerprint (Optional):** <40-character hex OpenPGP fingerprint>
- **Public Attribution Requested:** [Yes / No]

## 2. Vulnerability Overview
- **Affected Repository:** [cybrik-suite | cybrik-soc-command-center | cybrik-cyber-ai-platform | cybrik-security-tool-fabric]
- **Affected Component / Path:** <e.g., contracts/adapters/cybrik-inference-adapter-notes.v1.md or crates/sandbox-runner>
- **Impacted Version / Commit SHA:** <e.g., commit 8a9d12f or v0.1.0-alpha>
- **Vulnerability Category (CWE / OWASP):** <e.g., CWE-94, OWASP-LLM-01, Tool Sandbox Breakout>
- **Self-Assessed Severity:** [CRITICAL | HIGH | MEDIUM | LOW]
- **Estimated CVSS v3.1 Vector & Score:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` (Score: 9.8)

## 3. Executive Summary
<Concise description of the vulnerability, the underlying defect, and the potential security impact.>

## 4. Step-by-Step Deterministic Reproduction
1. Set up the local test environment using `<command or configuration>`.
2. Send the following crafted payload / invoke the API endpoint:
   ```bash
   curl -X POST https://localhost:8080/api/v1/... -d '...'
   ```
3. Observe the unintended behavior: `<describe observed result>`.
4. Expected secure behavior: `<describe expected result>`.

## 5. Proof of Concept (PoC)
```python
# Minimal non-destructive Python PoC demonstrating the flaw
import requests
...
```

## 6. Impact & Attack Scenarios
<Detailed analysis of confidentiality, integrity, availability, or cross-tenant boundary impact.>

## 7. Suggested Remediation / Proposed Fix
<Specific code changes, input validation routines, architectural hardening, or patch diffs.>

## 8. Embargo Agreement
- [x] I agree to keep this vulnerability confidential under the 90-day Coordinated Vulnerability Disclosure (CVD) embargo until a fix has been published and coordinated.
```

---

## 8. Release Gate & Governance Traceability (RB-001)

| Gate Step | Description | Technical State | Governance Authority |
|---|---|---|---|
| **Step 1: Local Engineering Preparation** | Formulate comprehensive policy, safe harbor terms, SLA matrix, RFC 9116 specification, intake schema, and report templates. | **COMPLETED** (This document & `disclosure-intake-schema.json`) | Claude Worker (Subagent) |
| **Step 2: Operational Channel Activation** | Provision and verify dedicated secure email intake (`security@cybrik.ai`, alias `report@cybrik.ai`), and private GitHub vulnerability reporting. | **COMPLETED** — intake verified, routed to `contact@bpech.com` via Cloudflare Email Routing (2026-08-20). PGP keypair publication tracked separately as non-blocking. | Founder |
| **Step 3: Suite `SECURITY.md` Update** | Replace private pre-release placeholder `SECURITY.md` files across all 4 repositories with live operational contact instructions. | **COMPLETED** — `SECURITY.md` active across all four repositories (2026-08-20). | Founder |
| **Step 4: Blocker Closure (RB-001)** | Transition RB-001 in `docs/releases/RELEASE-BLOCKERS.md` from `BLOCKING — OPEN` to `RESOLVED` with evidence links. | **RESOLVED** — RB-001 closed 2026-08-20 with evidence recorded in `docs/releases/RELEASE-BLOCKERS.md`. | Founder |

---

*End of Policy Document — CYBRIK Suite Responsible Disclosure Specification.*
