# SECURITY.md — cybrik-suite

Status: `ACTIVE — RESPONSIBLE DISCLOSURE ENABLED`

## Prohibited content

The following must never be committed to this repository:

- secrets of any kind: `.env` files (except `.env.example`), API keys, tokens, passwords,
  private keys, certificate private material;
- customer or production data: logs, database dumps, PCAPs, telemetry containing real
  identifiers;
- malware samples or live exploit payloads;
- model weights or other large binary artifacts.

If any such content is found in history, treat it as an incident: stop, notify the Founder,
and rotate any exposed credential. Do not attempt history rewrites without approval.

## Responsible disclosure

Report suspected vulnerabilities in any CYBRIK Suite component to the canonical public
security address:

- **security@cybrik.ai** (primary)
- **report@cybrik.ai** (secondary alias)

Do not open public issues for security matters. Do not disclose technical details publicly
before the coordinated disclosure window has closed.

The authoritative policy — scope, rules of engagement, intake schema, and report templates —
is `docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md`, published at
<https://github.com/hoangclinh/cybrik-suite/blob/main/docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md>.

### Legal safe harbor (summary)

For security research conducted in good faith and in compliance with the policy above, CYBRIK:

- considers the research **authorized conduct under the Computer Fraud and Abuse Act**
  (18 U.S.C. § 1030) and equivalent computer-misuse statutes;
- grants an **exemption from DMCA § 1201 anti-circumvention claims** for bona fide research
  on in-scope systems, and will not bring related copyright infringement claims;
- **will not initiate legal action** against, or refer to law enforcement, researchers who
  adhere to the policy's Rules of Engagement.

This safe harbor does not extend to out-of-scope activities (denial of service, social
engineering, third-party infrastructure) as defined in the full policy.

### Response SLAs (summary)

| Severity | Initial response | Target remediation |
|---|---|---|
| Critical | 24 hours | 7 calendar days |
| High | 48 hours | 14 calendar days |
| Medium | 72 hours | 30 calendar days |
| Low | 7 calendar days | 90 calendar days |

All reports are handled under a standard **90-day Coordinated Vulnerability Disclosure (CVD)
embargo** from initial acknowledgment, which may be shortened by mutual written consent once a
fix ships, or expedited if the issue is under active exploitation.

Blocking decision RB-001 (`docs/releases/RELEASE-BLOCKERS.md`) is **RESOLVED** — a verified
disclosure channel is live.
