# RELEASE-BLOCKERS — Suite-level blocking release decisions

Status: active register. A blocker here blocks **every** external release of **any** CYBRIK
Suite product until resolved by the Founder with evidence.

| ID | Blocker | Status | Resolution requires |
|---|---|---|---|
| RB-001 | No verified responsible-disclosure channel existed. All `SECURITY.md` files were private-pre-release placeholders and intentionally named no contact address — a security email/channel must not be invented on paper. | **RESOLVED (2026-08-20)** (raised 2026-07-23, Founder decision; closed 2026-08-20, Founder sign-off) | Resolved. Evidence: (1) verified intake channel `security@cybrik.ai` / `report@cybrik.ai` routing to `contact@bpech.com` via Cloudflare Email Routing, delivery tested end-to-end; (2) published policy with contact, SLA matrix, and legal safe-harbor statement in [`docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md`](../security/RESPONSIBLE-DISCLOSURE-POLICY.md) (status `ACTIVE — APPROVED BY FOUNDER`); (3) active `SECURITY.md` naming the live channel across all four repositories (`cybrik-suite`, `cybrik-soc-command-center`, `cybrik-cyber-ai-platform`, `cybrik-security-tool-fabric`) |

Rules:

- No release manifest in `releases/manifests/` may be created while a `BLOCKING — OPEN`
  entry exists, unless the manifest explicitly records a Founder waiver.
- Resolving a blocker requires evidence linked from this table, not just a status flip.
