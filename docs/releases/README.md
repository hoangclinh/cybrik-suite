# docs/releases

Status: **no product release exists** — no release notes have been written and no release
manifest exists in `../../releases/manifests/`.

| Document | Content |
|---|---|
| [RELEASE-BLOCKERS.md](RELEASE-BLOCKERS.md) | Active register of suite-level blocking release decisions. Currently: **RB-001 OPEN** — external releases blocked until a verified responsible-disclosure channel exists |
| [GATE-W2-B-CONTRACT-ACCEPTANCE-2026-07-24.md](GATE-W2-B-CONTRACT-ACCEPTANCE-2026-07-24.md) | Gate W2-B decision record. Outcome: **ACCEPTED FOR IMPLEMENTATION** (packet v0.1.0; not stable v1/GA, not a bundle tag) after the two High trust blockers (W2B-H1, W2B-H2) were resolved contract-first |
| [GATE-W2-C1-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md](GATE-W2-C1-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md) | Gate W2-C1 decision record. Outcome: **architecture & process ACCEPTED** — ADR-0007 org-hierarchy model + open-decision constraints OD-1..OD-6, and the UAT Gate Standard as a suite process standard. Accepts **no** contract/schema/code/UI; the contract delta stays `PROPOSED — NOT APPLIED` |
| [GATE-W2-D-INFERENCE-ACCEPTANCE-2026-07-24.md](GATE-W2-D-INFERENCE-ACCEPTANCE-2026-07-24.md) | Gate W2-D decision record. Outcome: **ACCEPTED FOR IMPLEMENTATION** (W2-D AI model-inference + alert-summarization packet v0.1.0; not stable v1/GA, not a bundle tag). Resolves G-W2D-1..5; status-flip only (no wire-semantics change); TR-1..TR-6 remain required runtime gates |
| [GATE-W2-F-SERVICE-DELEGATION-ACCEPTANCE-2026-07-24.md](GATE-W2-F-SERVICE-DELEGATION-ACCEPTANCE-2026-07-24.md) | Gate W2-F decision record. Outcome: **ACCEPTED FOR IMPLEMENTATION** (W2-F internal service-delegation + workload-identity packet v0.1.0; not stable v1/GA, not a bundle tag). Resolves G-W2F-1..5; realizes ADR-0006 E2/E3 via ADR-0008; SR-1..SR-10 remain required runtime gates; no server/endpoint, no tool/MCP authority |

Release notes and cross-product release coordination documents will be added here per
release, only for real, verified release candidates.
