# docs/ — CYBRIK Suite documentation

Status: `SCAFFOLD`.

| Directory | Purpose | Current state |
|---|---|---|
| `strategy/` | Suite strategy documents (README + 01–08), imported from `cybrik-soc-command-center:docs/cybrik-suite/` | **CANONICAL** per Founder decision 2026-07-23 — see `migration/IMPORT-MANIFEST.md`; the SOC copy is a SUPERSEDED pointer |
| `architecture/` | Suite-level (cross-product) architecture | empty |
| `adr/` | Architecture Decision Records for suite-level decisions | six `PROPOSED — NOT DECIDED` briefs (ADR-0001…0006); none accepted |
| `security/` | Suite security baseline, threat models, compliance mapping | empty |
| `evaluation/` | Cross-product evaluation strategy and results | empty |
| `operations/` | Runbooks and operating procedures for the suite | empty |
| `releases/` | Release notes, coordination docs, and blocking release decisions | active `RELEASE-BLOCKERS.md` register (RB-001 OPEN); no release notes — no release exists |
| `migration/` | Records of migrations between repositories: import manifest, source map, and the executed multi-repo bootstrap runbook | populated by bootstrap — see `migration/README.md` |

Product-specific documentation lives in each product repository, not here.
