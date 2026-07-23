# IMPORT-MANIFEST — Strategy documents draft import

**DRAFT IMPORT — SOURCE NOT DELETED.**

The copies under `docs/strategy/` are drafts. The source directory in
`cybrik-soc-command-center` remains untouched and remains canonical until a separate,
explicitly approved migration designates otherwise.

## Source

| Field | Value |
|---|---|
| Source repository path | `/Users/hoanglinh/Claude/Projects/cybrik-soc-command-center` |
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
