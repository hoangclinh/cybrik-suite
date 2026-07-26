# docs/operations

Status: `ACTIVE CATALOG`.

Runbooks and operating procedures for the suite.

| Document | Purpose | Status |
|---|---|---|
| [W1-48-AGENT-ROLLING-BOARD.md](W1-48-AGENT-ROLLING-BOARD.md) | W1 early-entry transition and the fixed roster of 48 immutable task identities; gate dispositions and the bounded documentation-authority record | `ACTIVE`. W0 closure `NO-GO` with `COMPLETE=0`; W1 product/integration writers `HOLD`; W1 runtime writers, delegated routine integration and external release `NO-GO`; **CI: NOT WIRED** |
| [W1-E2-EVIDENCE-REGISTER.md](W1-E2-EVIDENCE-REGISTER.md) | Exact per-lane evidence for GATE A4, W1-C1, W1-C2 and FAB-C0 | `ACTIVE — LOCAL COMMIT AND WORKTREE EVIDENCE ONLY — NOT PUSHED, NOT INTEGRATED` |
| [OVERNIGHT-HANDOFF-2026-07-24.md](OVERNIGHT-HANDOFF-2026-07-24.md) | SOC-first overnight implementation/research handoff across four repositories | Review branch; no merge. Dated 2026-07-24 and **not** refreshed: §3.2/§4/§5 still read `GATE A4 is not open`, which GATE A4's closure on 2026-07-26 superseded. Open residual, board §14.8.3; `docs/adr/README.md` is authoritative on ADR status |

Machine validation for the two W1 control documents is described in
[W1-48-AGENT-ROLLING-BOARD.md](W1-48-AGENT-ROLLING-BOARD.md) §13. Both commands are run manually —
**CI: NOT WIRED** — and as measured on 2026-07-26 the on-disk validator returns `PASS` with
`tests 77 · pass 77 · fail 0`; see board §13.1 and §14.9. That is a static/documentary consistency
check over control documents only: it is not product or CI evidence, `W0 COMPLETE=0` and W0 closure
stays `NO-GO`, and no writer is opened.
