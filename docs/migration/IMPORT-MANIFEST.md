# IMPORT-MANIFEST — Strategy documents draft import

**DRAFT IMPORT — SOURCE NOT DELETED.**

The copies under `docs/strategy/` are drafts. The source directory in
`cybrik-soc-command-center` remains untouched and remains canonical until a separate,
explicitly approved migration designates otherwise.

## Source

| Field | Value |
|---|---|
| Source repository path | `<CYBRIK_WORKSPACE_ROOT>/cybrik-soc-command-center` |
| Source directory | `docs/cybrik-suite/` |
| Source branch | `main` |
| Source HEAD | `78bd289ccefa34223f78e6f1eafbfc581ecb1a8f` |
| Source status | **DIRTY** for 2 of 10 files (see table) — import captured the working-tree versions, which for those 2 files do not correspond to HEAD |
| Import timestamp | 2026-07-23T15:48:19Z (UTC) |
| Destination | `cybrik-suite/docs/strategy/` |

Source dirty detail at import time:

```
 M docs/cybrik-suite/README.md
?? docs/cybrik-suite/09-CLAUDE-CODE-MULTI-REPO-BOOTSTRAP-PROMPT.md
```

## Per-file record (SHA-256)

Files whose destination hash differs from the source hash were modified **only** by the
outward-link rewrite described in `SOURCE-MAP.md`; no other content was changed.

| File | Source Git state | Source SHA-256 | Destination SHA-256 | Dest = Source? |
|---|---|---|---|---|
| `README.md` | modified (dirty) | `323fccb8d581132346dbc3a1bfc6a9ac0ccaf1b4599486845db99da17b28a359` | `0464896af37557231237ef49c1a5184077471ac90be6b46e0d54e66b181339f0` | No — 6 links rewritten |
| `01-STRATEGIC-THESIS.md` | clean at HEAD | `f36fbda24d8056662e5537029a84dcf69149272219c37b1df25163328e25edcc` | `ee0c8523e9bc4a16e24544fcbcbde6633179458974d89b2d392d19d41c263c57` | No — 1 link rewritten |
| `02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md` | clean at HEAD | `3b14d57381dfe41ead4cc50607e2207c934c51444e3f78c6c159c83ae1f23f05` | `c51498aa644b7c1a4b5b178eabd03b79c79448a1bdf9965cddf2e719a1510384` | No — 1 link rewritten |
| `03-REFERENCE-ARCHITECTURE.md` | clean at HEAD | `8eff45fea98881629a498b8c5e84471c7cf1c886f20bd0aed4cd1d80b392ba9d` | `366afb6f3e8464fe8c1b74d540a33f2b3c74de336300c3c6b6c15e0815f23955` | No — 2 links rewritten |
| `04-CORE-USE-CASES-AND-RELEASE-SCOPE.md` | clean at HEAD | `6658c2dbaa7395529bd83a91f33dc7450309fb8618d5afbbc7736317182261c3` | `6658c2dbaa7395529bd83a91f33dc7450309fb8618d5afbbc7736317182261c3` | **Yes — byte-identical** |
| `05-CONTRACTS-AND-INTEGRATION.md` | clean at HEAD | `f2eaf750d8b0382e272da685197c837c4704c1cba724689d8330b20d04a05398` | `f2eaf750d8b0382e272da685197c837c4704c1cba724689d8330b20d04a05398` | **Yes — byte-identical** |
| `06-ROADMAP-2026-2029.md` | clean at HEAD | `8177994f0e0e202bfa4aaeb1f0958ed83dc9290c41054a08fa2a4dbf1405905f` | `8177994f0e0e202bfa4aaeb1f0958ed83dc9290c41054a08fa2a4dbf1405905f` | **Yes — byte-identical** |
| `07-SOLO-FOUNDER-AI-OPERATING-MODEL.md` | clean at HEAD | `2fa5cb898e8d27230b9a70bd4651ffb8a5fed0696105f95a86e895d6f7c44e76` | `2fa5cb898e8d27230b9a70bd4651ffb8a5fed0696105f95a86e895d6f7c44e76` | **Yes — byte-identical** |
| `08-EVALUATION-SECURITY-COMPLIANCE.md` | clean at HEAD | `f48dbc119da4770e72b8faa1221739a40e352dbd4e8962d00d0a43f98c6b3467` | `f48dbc119da4770e72b8faa1221739a40e352dbd4e8962d00d0a43f98c6b3467` | **Yes — byte-identical** |
| `09-CLAUDE-CODE-MULTI-REPO-BOOTSTRAP-PROMPT.md` | untracked (dirty) | `3e13d58481df3a29b8da3b609c5c23e8852710507808392e7495ffc044b92478` | `3e13d58481df3a29b8da3b609c5c23e8852710507808392e7495ffc044b92478` | **Yes — byte-identical** |

Internal links between the strategy documents (e.g. `01-STRATEGIC-THESIS.md` →
`02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md`) were preserved unchanged and remain valid,
since all ten files were copied into the same destination directory.

## Path normalization (2026-07-23)

Per Founder decision, workstation-specific absolute paths in migration documentation were
normalized to the placeholder `<CYBRIK_WORKSPACE_ROOT>`. For audit purposes the mapping is
recorded exactly once, here:

> `<CYBRIK_WORKSPACE_ROOT>` = `/Users/hoanglinh/Claude/Projects` (the workspace root on the
> workstation where the 2026-07-23 bootstrap was executed).

Rewrites performed (11 total):

| File | Lines | Rewrite |
|---|---|---|
| `CLAUDE-CODE-MULTI-REPO-BOOTSTRAP.md` | 15, 16, 41, 44, 47, 50, 54, 75, 90, 463 (pre-header line numbers) | 10 occurrences of the absolute workspace prefix → `<CYBRIK_WORKSPACE_ROOT>` |
| `IMPORT-MANIFEST.md` (this file) | Source table, "Source repository path" row | absolute source path → `<CYBRIK_WORKSPACE_ROOT>/cybrik-soc-command-center` |

`SOURCE-MAP.md` contained no absolute paths and required no normalization.

## Canonicalization (2026-07-23, Founder decision)

The statement `DRAFT IMPORT — SOURCE NOT DELETED` above records a true fact about the
import moment and is retained unchanged. It is now superseded by the following Founder
decisions:

1. `docs/strategy/README.md` and strategy documents `01`–`08` in **this repository** are the
   **canonical** CYBRIK Suite strategy documentation.
2. `09-CLAUDE-CODE-MULTI-REPO-BOOTSTRAP-PROMPT.md` was moved (via `git mv`, history
   preserved) to `docs/migration/CLAUDE-CODE-MULTI-REPO-BOOTSTRAP.md` — it is a migration
   runbook, not a strategy document. A short EXECUTED header and the path normalization
   above were applied to the moved file.
3. In the SOC repository, `docs/cybrik-suite/README.md` is replaced by a concise SUPERSEDED
   pointer; strategy documents `01`–`08` and the untracked source copy of `09` are removed
   from the SOC working tree after hash verification against the committed destination
   (suite commit `acb9842888def89859008a37d5ca1e8311435e16`).

Post-import modifications to previously imported files (all documented, none touching
strategy substance of `01`–`08`):

| File | New SHA-256 | Change |
|---|---|---|
| `docs/migration/CLAUDE-CODE-MULTI-REPO-BOOTSTRAP.md` (was `docs/strategy/09-…`) | `4802b41d0ea1979d3fdf2b33b66feb593f4c97bf18a6176a3f1bcede6a11ecdb` | moved; EXECUTED header added; 10 path normalizations |
| `docs/strategy/README.md` | `5999e5bac8ba0a568b6061f86ab2cbabe1301ebcdde9d6fa19fc2af87f9123af` | CANONICAL banner added; document 09 removed from the strategy catalog, replaced by a pointer to the migration runbook |

Strategy documents `01`–`08` remain byte-identical to their state in suite commit
`acb9842` (of which `04`–`08` are byte-identical to the SOC source; `01`–`03` differ only
by the outward-link rewrites recorded in `SOURCE-MAP.md`).
