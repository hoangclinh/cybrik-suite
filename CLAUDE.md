# CLAUDE.md — cybrik-suite (meta/control repository)

Status: `SCAFFOLD`. This file governs AI-assisted work in this repository and in cross-repo
sessions rooted here.

## What this repository is

Meta/control repository for the CYBRIK Suite: documentation, cross-product contracts,
integration/compatibility harnesses, and release control. **No product source code lives here.**

## Product ownership boundaries

| Concern | Owner |
|---|---|
| SOC truth: alerts, cases, assets, analyst identity | `cybrik-soc-command-center` |
| Tool execution authority, capability registry, policy/approval, credential/egress broker, sandbox, execution receipts | `cybrik-security-tool-fabric` |
| Model runtime, model/prompt registry, RAG/CTI pipelines, agent orchestration, Investigation Graph/Bundle, AI evaluation | `cybrik-cyber-ai-platform` |
| Cross-product contracts, suite docs, integration harness, release manifests | `cybrik-suite` (this repo) |

Never implement a concern in a repository that does not own it. If ownership is ambiguous,
stop and ask the Founder.

## Cross-repository rules

1. **Read before write.** Before editing any other repository from a session rooted here, read
   that repository's own `CLAUDE.md` and `AGENTS.md` (if present) and follow them. They take
   precedence over this file inside their repository.
2. **Contract-first.** Cross-product interfaces are proposed and accepted in `contracts/`
   before being implemented in product repositories. Do not invent ad-hoc interfaces in
   product code.
3. **No coupling mechanisms.** No Git submodules, no symlinked source trees, no relative
   runtime imports between repositories, no nested repositories.
4. **Repository-qualified references.** In documentation, refer to files in other repositories
   as `repo-name:path/to/file` (e.g. `cybrik-soc-command-center:docs/architecture/...`).
   Do not fabricate relative links across repository boundaries.

## Approval gates

Forward-looking technical review, gate acceptance/rejection, bounded commits, push, canonical
merge and release are delegated to the Codex Governor by
`docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`. Earlier per-action Founder approval
requirements for those actions are dated history. Evidence, exact scope, required checks,
independent review where applicable and rollback remain mandatory.

Explicit Founder approval is still required for:

- creating, deleting, moving, or renaming repositories or top-level directories;
- production deployment, production rollout, production data or production configuration;
- production credentials, secrets, signing keys or identity-provider changes;
- destructive history rewriting, force-pushing protected refs, or creating an additional remote;
- remote repository settings not covered by a separately recorded authorization;
- any change inside `cybrik-soc-command-center` (including replacing its docs with pointers —
  that is a separate migration requiring its own approval);
- dependency installation (except the consumed UAT-MTLS-D1 exact-action exception below), database
  migration, deployment, or running formatters/auto-fixers in any repository; and
- purchasing or changing third-party billing.

UAT-MTLS-D1 exact-action exception: Appendix B of
`docs/operations/DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md` records the Founder
delegation chain and the Codex Governor's one exact authorization for the D1 dependency/build/evidence scope only.
That exception is consumed and complete; it is not reusable
for D2, another dependency change, product selection, runtime, deployment or production.

UAT-MTLS-D2 coverage-closure recovery exact-action exception: Appendix C of the same reconciliation
record and
`docs/operations/DELEGATED-GOVERNOR-D2-COVERAGE-CLOSURE-RECOVERY-2026-08-02.md` authorize one
bounded, reversible reconstruction of the exact 56-member coverage-only test closure outside all
repositories and temporary roots. The exception is consumed by its first `--execute` attempt. It
does not authorize Coverage.py extraction, Anycorn execution, product dependency changes,
runtime, migration, deployment, legal/risk disposition, public release, GA or production.

## Data-handling boundary

- Never read, copy, or print secrets: `.env*` (except `.env.example`), tokens, private keys,
  certificate private material.
- Never commit customer data, production logs, PCAPs, malware samples, database dumps, or
  model weights into any suite repository.
- `.claude/settings.local.json` is local-only and gitignored; never commit it.

## Status honesty

Scaffolded or AI-generated content is not a feature. Every new document or artifact must carry
an accurate status: `SCAFFOLD`, `PROPOSED`, `DRAFT`, or `NOT IMPLEMENTED`. Never label anything
`IMPLEMENTED`, `VERIFIED`, `PILOTED`, or `GA` without evidence.
