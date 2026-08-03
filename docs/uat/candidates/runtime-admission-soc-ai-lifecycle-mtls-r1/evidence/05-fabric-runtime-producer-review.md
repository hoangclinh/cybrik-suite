# Fabric runtime producer implementation review

Status: `COORDINATOR-VERIFIED IMPLEMENTATION EVIDENCE — NOT RUNTIME EVIDENCE`

Recorded: 2026-08-03

## Immutable candidate identity

- Repository: `cybrik-security-tool-fabric`
- Commit: `7f2561e501585bb5d66b9a32d6b9ac2c3a2f94d7`
- Tree: `0cd08e52a636ff03586aa30223a623e1f08a836b`
- Parent: `e06b19c528c90a375898f8cce6d22ed0124c96da`
- Author and committer: `Cybrik Codex Worker <codex-worker@local.invalid>`
- Prospective patch SHA-256: `4e52491718b67128f306bf4ab122cb02d962377242bb3c200cd0a87ecd508d1e`
- Exact 51-path content aggregate SHA-256: `9a54f288348715f0c156437bd974acb6cad62655d6994a96c4ead8a6e75f2f6d`
- Push state when reviewed: not pushed
- Merge state when reviewed: not merged

## Implemented scope

The candidate supplies a Fabric-owned, injection-only reference route factory, durable intent and
completion journals, product adapters, receipt readers, and the accepted ADR-0014 trust and
durability validators. Durable intent is written and read back before SOC dispatch. Durable
completion is written, read back, and binding-verified before a receipt can be released. The default
Wave 0 application remains unchanged and the reference factory is not a deployment claim.

## Verification evidence

- Full repository tests: 797 passed; one Starlette/httpx deprecation warning.
- Aggregate branch-aware coverage: 91%.
- Changed-module branch-aware coverage: journal 88%, service 96%, adapters 88%, routes 95%, trust
  validator 100%.
- Ruff lint and format check: passed.
- Mypy strict: passed.
- Bandit: passed.
- `pip-audit`: no known vulnerabilities found.
- Gitleaks current-tree scan and prospective scaffold allowlist: passed.
- Markdown links, documentation hygiene, and `git diff --check`: passed.

Coverage used the previously authorized one-shot Coverage.py 7.15.2 wheel whose SHA-256 is
`b868acc62aa5de3be7a9d05c2333bf8359ca987e43f9cb30ff8fbda6a024ab73`, under authorization
`f3b49a3b-032f-4d6f-9152-a402d93c5f19`. This local measurement does not close hosted CI or the
current-Suite-tree coverage gate.

## Independent review disposition

Two independent code-review passes returned `GO` with P0-P2 clear after test-first repairs for:

1. receipt read-side binding of `delegation_ref` and `capability.digest`;
2. collision-safe unsafe-journal markers; and
3. retry reuse of the first durable intent identity after completion-commit failure.

One of the final reviewers could not re-execute the focused subset in its isolated environment
because the `referencing` dependency was unavailable; that reviewer therefore performed bounded
static verification. The coordinator separately executed the complete 797-test suite and the checks
listed above on the immutable candidate tree.

The Fabric suite and checks were executed in the
`cybrik-worktrees/w3-48/fabric-runtime-producer-r1` worktree. The current Suite Node orchestrator was
also run after the final author-pin hardening and canonical gate registration against the current
nine-path reconciliation bytes in an isolated temporary copy using an existing byte-identical
dependency cache sourced from a sibling Suite worktree. The source checkout under review was
`cybrik-worktrees/w3-48/suite-fabric-receipt-runtime-design-r1`; its
`package-lock.json` SHA-256 was
`43c7990b6b65d1aaeb1353ba82821dd887cf7202151088b4c88d4475393563b9`. No dependency was installed.
The source Suite worktree intentionally has no `node_modules`, so a direct dependency-bearing rerun
there is not claimed.

## Residual non-blocking findings

- P3: a binding-drift exception still maps to the generic route `503` retryable response.
- P3: there is no adapter-level real `ProcessLocalFsyncStores` divergent-bytes retry test.

These findings do not reopen the implementation-review condition, but they remain backlog work and
must not be represented as closed.

## Non-claims and remaining runtime gates

This packet is not hosted CI evidence, runtime negative evidence, rollback evidence, an integrated
UAT pass, a demo authorization, a release promotion, or production authorization. Runtime remains
`HOLD` until the canonical four-repository tuple has hosted green CI, negative and rollback evidence
is captured, and coverage is remeasured on the current Suite candidate tree. Production remains
Founder-controlled.
