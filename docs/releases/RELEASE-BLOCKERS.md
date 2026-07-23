# RELEASE-BLOCKERS — Suite-level blocking release decisions

Status: active register. A blocker here blocks **every** external release of **any** CYBRIK
Suite product until resolved by the Founder with evidence.

| ID | Blocker | Status | Resolution requires |
|---|---|---|---|
| RB-001 | No verified responsible-disclosure channel exists. All `SECURITY.md` files are private-pre-release placeholders and intentionally name no contact address — a security email/channel must not be invented on paper. | **BLOCKING — OPEN** (raised 2026-07-23, Founder decision) | A real, tested disclosure channel (monitored mailbox or intake form), a published policy (contact, SLA, safe-harbor statement), and Founder sign-off replacing the placeholders in all four repositories' `SECURITY.md` |

Rules:

- No release manifest in `releases/manifests/` may be created while a `BLOCKING — OPEN`
  entry exists, unless the manifest explicitly records a Founder waiver.
- Resolving a blocker requires evidence linked from this table, not just a status flip.
