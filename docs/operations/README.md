# docs/operations

Status: `ACTIVE CATALOG`.

Runbooks and operating procedures for the suite.

| Document | Purpose | Status |
|---|---|---|
| [W1-48-AGENT-ROLLING-BOARD.md](W1-48-AGENT-ROLLING-BOARD.md) | W1 early-entry transition and the fixed roster of 48 immutable task identities; gate dispositions and the bounded documentation-authority record | `ACTIVE`. W0 closure `NO-GO` with `COMPLETE=0`; W1 product/integration writers `HOLD`; W1 runtime writers, delegated routine integration and external release `NO-GO`; **CI: NOT WIRED** |
| [W1-E2-EVIDENCE-REGISTER.md](W1-E2-EVIDENCE-REGISTER.md) | Exact per-lane evidence for GATE A4, W1-C1, W1-C2 and FAB-C0 | `ACTIVE — LOCAL COMMIT AND WORKTREE EVIDENCE ONLY — NOT PUSHED, NOT INTEGRATED` |
| [W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md](W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md) | Founder decision packet for live-shadow blocker 4: measured canonical/evidence topology across the four repositories, hosted `origin` state, and the canonical-integration / CI-activation option space | `PROPOSED — FOUNDER DECISION REQUIRED`. Docs-only; opens no writer; authorizes no push, merge, PR, remote/settings, plan or purchase change; closes no blocker. Board §1.22/§14.30, register §25 |
| [W1-I04A-SHADOW-REMOTE-GRANT.md](W1-I04A-SHADOW-REMOTE-GRANT.md) | Prospective bounded grant for the SOC W1-I04A typed `shadow_remote` client core (four paths, base `6464cfb…`) | Consumed — the granted writer hard-stopped and was reviewed `NO-GO`; board §1.14/§14.22 |
| [W1-I04A-SHADOW-REMOTE-HARD-STOP-EVIDENCE.md](W1-I04A-SHADOW-REMOTE-HARD-STOP-EVIDENCE.md) | Hard-stop evidence for that first W1-I04A attempt, with the W0-R03F pre-commit `NO-GO` findings | `PAUSED — UNCOMMITTED`; **not** product evidence; board §1.15/§14.23 |
| [W1-I04A-SHADOW-REMOTE-REMEDIATION-GRANT.md](W1-I04A-SHADOW-REMOTE-REMEDIATION-GRANT.md) | Fresh prospective bounded remediation grant disposing the W0-R03F P1/P2/P3 findings | Superseded in part by its amendment and correction chain; board §1.16–§1.19, §14.24–§14.27 |
| [W1-I04A-SHADOW-REMOTE-POST-COMMIT-EVIDENCE.md](W1-I04A-SHADOW-REMOTE-POST-COMMIT-EVIDENCE.md) | Post-commit evidence for SOC commit `74f9774…`, plus the 2026-07-27 writer-transcript provenance correction | Local, independently reviewed, **unmerged and unpushed** `SCAFFOLD` evidence only; no blocker closes; board §1.20/§1.21, §14.28/§14.29; register §23/§24 |
| [OVERNIGHT-HANDOFF-2026-07-24.md](OVERNIGHT-HANDOFF-2026-07-24.md) | SOC-first overnight implementation/research handoff across four repositories | Review branch; no merge. Dated 2026-07-24 and **not** refreshed: §3.2/§4/§5 still read `GATE A4 is not open`, which GATE A4's closure on 2026-07-26 superseded. Open residual, board §14.8.3; `docs/adr/README.md` is authoritative on ADR status |

Machine validation for the two W1 control documents is described in
[W1-48-AGENT-ROLLING-BOARD.md](W1-48-AGENT-ROLLING-BOARD.md) §13. Both commands are run manually —
**CI: NOT WIRED** — and as measured on 2026-07-26 the on-disk validator returns `PASS` with
`tests 77 · pass 77 · fail 0`; see board §13.1 and §14.9. That is a static/documentary consistency
check over control documents only: it is not product or CI evidence, `W0 COMPLETE=0` and W0 closure
stays `NO-GO`, and no writer is opened.
