# Runtime Authorization — AI PG R3

Recorded at `2026-07-31T08:16:00Z`.

## Exact authority

- Candidate: `runtime-admission-ai-pg-r3`.
- Authority: exactly one bounded non-production PostgreSQL attempt.
- Current state: `not_run`, `0 / 0 / 0`, `execution_authorized:true`.
- This authority becomes exercisable only after this exact five-path enabling update is merged to
  canonical `main` and its rendered required checks are green. It grants no execution from the
  unmerged branch.
- Independent review:
  `docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/03-independent-runtime-review.md`,
  SHA-256 `de654a1c7e1ec7fca0bcea9c709bf20ac92d2c05dabd5fdc531315976dc5da04`.
- Immediate parent Suite commit/tree:
  `c0ef0d3a41d10dbdd885fc38f9f1fc0db967b5bd` /
  `b59af36b2dfea496b6745ed446573732e1b92751`.
- Immediate parent Suite hosted run: `30615019067`, with both rendered required checks
  successful.
- The machine record pins each rendered check by repository, SHA, name and status; its schema has
  no run-id field. Run `30615019067` is therefore retained here as evidence for the immediate
  parent, not represented as a machine field.

The review and correction artifacts are immutable historical snapshots. Their references to Suite
commit `6278920d162c6ec30320699aa11c6fff9e00ad34`, tree
`e75286a9ee00de72d2571ee05a9fe11953e515c8`, run `30609391186`, and pre-enabling candidate digest
`a7461f6a82c237c96b215935ef31e259499eba3581fd7f59b0153560532259ab` are superseded for execution
by the immediate-parent tuple above, exactly as the independent review required. The first
independent-review attempt produced no verdict after its 600-second timeout; the immutable HOLD
history remains pinned in `02-hold-status.md`.

## Mandatory execution order

The lifecycle procedure object is not serialized execution order. Execute the recorded entries
inside one non-interactive zsh session in exactly this order:

Canonical order: `start` → `reset` → `seed` (SQL) → the pytest command → `rollback` → `stop`.

1. every `start` entry in array order;
2. every `reset` entry in array order;
3. `seed[0]` (the stdin-fed SQL role setup) exactly once;
4. `seed[1]` (change to the pinned Cyber AI worktree), then `seed[2]` (the exact pytest command)
   exactly once;
5. verify the pytest result reports `13 passed` and reports no skipped tests;
6. every `rollback` entry in array order after a successful test;
7. every `stop` entry in array order.

On any failure, `set -euo pipefail` terminates the session and the armed trap performs containment.
Do not continue, correct, substitute or retry any command. A failure spends the only recovery
ordinal and requires a new truthful `NO-GO` result artifact.

## Boundaries

- Fresh synthetic 64-lowercase-hex credentials only.
- Exact clean Cyber AI commit/tree only.
- Exact pre-existing PostgreSQL image digest and loopback bind only.
- No production credential, configuration, data or traffic.
- No HTTP listener, outbox-worker dispatch, full stack, UAT, demo, POC, RC, GA, public release or
  production authority.
- The review artifact and this pre-run authorization artifact may not be reused as runtime-result
  evidence.
- The registry validator rejects more than one simultaneous `RUNTIME_AUTHORIZED` candidate even
  across different series identifiers. It cannot observe an out-of-band command, so the operator
  must still treat any such invocation as unauthorized and terminal.
