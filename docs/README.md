# docs/ — CYBRIK Suite documentation

Status: `SCAFFOLD`.

| Directory | Purpose | Current state |
|---|---|---|
| `strategy/` | Suite strategy documents (README + 01–08), imported from `cybrik-soc-command-center:docs/cybrik-suite/` | **CANONICAL** per Founder decision 2026-07-23 — see `migration/IMPORT-MANIFEST.md`; the SOC copy is a SUPERSEDED pointer |
| `architecture/` | Suite-level (cross-product) architecture | `org-hierarchy/` packet: domain model / UX IA / threat model `ACCEPTED` as architecture at **W2-C1** (via ADR-0007); evidence base `[UNKNOWN]`s open; contract-gap delta `PROPOSED — NOT APPLIED` (separate gate) |
| `adr/` | Architecture Decision Records for suite-level decisions | all ten decided — ADR-0001/0002/0004/0006 `ACCEPTED` (2026-07-24); ADR-0003/0005 `ACCEPTED` at **GATE A4, 2026-07-26 — decision only, no implementation authority**; ADR-0007 `ACCEPTED` at W2-C1 (model only, contract delta applied later by ADR-0009); ADR-0008 `ACCEPTED FOR IMPLEMENTATION` at W2-F, ADR-0009 at W2-G (both pre-GA `v0.1.0`), ADR-0010 `ACCEPTED FOR IMPLEMENTATION — APPLIED` (pre-GA `0.1.1`). `adr/README.md` is authoritative |
| `security/` | Suite security baseline, threat models, compliance mapping | empty (org-hierarchy threat model lives in `architecture/org-hierarchy/04-…`) |
| `evaluation/` | Cross-product evaluation strategy and results | empty |
| `operations/` | Runbooks and operating procedures for the suite | active: `W1-48-AGENT-ROLLING-BOARD.md` (fixed 48 task identities; W0 closure `NO-GO` with `COMPLETE=0`; W1 runtime writers `NO-GO`; bounded non-production runtime/demo/UAT execution `CONDITIONAL GO — ADMISSION GATED`), `DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md` (Founder-directed execution authority, no readiness implied), `W1-E2-EVIDENCE-REGISTER.md`, `OVERNIGHT-HANDOFF-2026-07-24.md`. See `operations/README.md` |
| `releases/` | Release notes, coordination docs, release manifests, and blocking release decisions | `RELEASE-BLOCKERS.md` register: **RB-001 `RESOLVED`** (2026-08-20, Founder sign-off — verified intake `security@cybrik.ai`), **no blocker open**. One release **candidate** manifest exists: `v1.0.0-rc1` at `releases/manifests/release-candidate-v1.0.0-rc1.manifest.json`, spec `releases/RELEASE-CANDIDATE-V1.0.0-RC1.md` — `CANDIDATE_READY_FOR_STAGING_QUALIFICATION`, staging qualification `PENDING_HUMAN_PR_MERGE`, no `v1.0.0-rc1` tag in any repository, all four pins unmerged. No release notes — **no release exists** |
| `uat/` | UAT gate standards for suite UI waves | `UAT-GATE-STANDARD.md`: persona matrix + bilingual/accessibility/responsive/evidence rules — `ACCEPTED` suite process standard (W2-C1); certifies no UI, no UAT claimed executed |
| `migration/` | Records of migrations between repositories: import manifest, source map, and the executed multi-repo bootstrap runbook | populated by bootstrap — see `migration/README.md` |

Product-specific documentation lives in each product repository, not here.
