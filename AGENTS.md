# AGENTS.md — cybrik-suite

Status: `SCAFFOLD`. Instructions for any AI coding agent working in this repository. This file
mirrors the governance rules in `CLAUDE.md`; read both.

## Scope

This is the CYBRIK Suite meta/control repository: docs, contracts, integration harnesses,
release control. It contains no product source code and must stay that way.

## Hard rules

1. **Ownership.** Respect product ownership boundaries (see the table in `CLAUDE.md`).
   SOC truth belongs to `cybrik-soc-command-center`; tool execution authority to
   `cybrik-security-tool-fabric`; AI planning/orchestration to `cybrik-cyber-ai-platform`.
2. **Read target-repo instructions first.** Before modifying files in another repository,
   read that repository's `CLAUDE.md`/`AGENTS.md`. Their rules win inside their repository.
3. **Approval gates.** Do not commit, push, create remotes, restructure directories, accept
   contracts, or touch `cybrik-soc-command-center` without explicit Founder approval in the
   current session.
4. **Contract-first.** New cross-product interfaces start as `PROPOSED` documents under
   `contracts/`. Never scaffold an OpenAPI/AsyncAPI/JSON Schema/MCP definition and present it
   as accepted.
5. **Data handling.** No secrets, customer data, logs, PCAPs, malware, dumps, or model weights
   in this repository — neither read into context nor written to disk here.
6. **Status honesty.** Label all generated content `SCAFFOLD` / `PROPOSED` / `DRAFT` /
   `NOT IMPLEMENTED` as appropriate. Never claim implementation or verification that has not
   happened.
7. **No coupling.** No submodules, source symlinks, nested repositories, or cross-repo
   relative imports.
