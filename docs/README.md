# docs/ — CYBRIK Suite documentation

Status: `SCAFFOLD`.

| Directory | Purpose | Current state |
|---|---|---|
| `strategy/` | Suite strategy documents (README + 01–08), imported from `cybrik-soc-command-center:docs/cybrik-suite/` | **CANONICAL** per Founder decision 2026-07-23 — see `migration/IMPORT-MANIFEST.md`; the SOC copy is a SUPERSEDED pointer |
| `architecture/` | Suite-level (cross-product) architecture | `org-hierarchy/` packet (W2-C0): evidence, domain model, UX IA, threat model, contract-gap — all `PROPOSED — NOT ACCEPTED` |
| `adr/` | Architecture Decision Records for suite-level decisions | ADR-0001/0002/0004/0006 `ACCEPTED`; ADR-0003/0005/0007 `PROPOSED` (ADR-0007 = org hierarchy & external-authority boundary, W2-C0) |
| `security/` | Suite security baseline, threat models, compliance mapping | empty (org-hierarchy threat model lives in `architecture/org-hierarchy/04-…`) |
| `evaluation/` | Cross-product evaluation strategy and results | empty |
| `operations/` | Runbooks and operating procedures for the suite | empty |
| `releases/` | Release notes, coordination docs, and blocking release decisions | active `RELEASE-BLOCKERS.md` register (RB-001 OPEN); no release notes — no release exists |
| `uat/` | UAT gate standards for suite UI waves | `UAT-GATE-STANDARD.md` (W2-C0): persona matrix + bilingual/accessibility/responsive/evidence rules — `PROPOSED — NOT ACCEPTED` |
| `migration/` | Records of migrations between repositories: import manifest, source map, and the executed multi-repo bootstrap runbook | populated by bootstrap — see `migration/README.md` |

Product-specific documentation lives in each product repository, not here.
