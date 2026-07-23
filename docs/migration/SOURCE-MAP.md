# SOURCE-MAP — Outward link rewrites in the strategy draft import (10 rewrites, 4 files)

Status: record of the 2026-07-23 bootstrap import. See `IMPORT-MANIFEST.md` for hashes.

Relative links in the source documents that pointed **outside** `docs/cybrik-suite/` (into
other parts of the SOC repository) could not remain valid relative links after the copy.
They were rewritten to repository-qualified references of the form
`cybrik-soc-command-center:docs/...`. No fabricated links were created; the referenced files
were verified to exist in the SOC repository at import time. Link text semantics were
preserved (in every case the link text was the target filename).

## Rewrites (10 total, across 4 files)

| Destination file : line | Original relative link | Rewritten reference | Target exists in SOC? |
|---|---|---|---|
| `README.md:103` | `../architecture/ARCHITECTURE-OVERVIEW-2026-07.md` | `cybrik-soc-command-center:docs/architecture/ARCHITECTURE-OVERVIEW-2026-07.md` | Yes |
| `README.md:104` | `../architecture/DATA-PLANE-V2.md` | `cybrik-soc-command-center:docs/architecture/DATA-PLANE-V2.md` | Yes |
| `README.md:105` | `../architecture/AI-COPILOT-ARCHITECTURE.md` | `cybrik-soc-command-center:docs/architecture/AI-COPILOT-ARCHITECTURE.md` | Yes |
| `README.md:106` | `../product/PRODUCT-BOUNDARIES.md` | `cybrik-soc-command-center:docs/product/PRODUCT-BOUNDARIES.md` | Yes |
| `README.md:107` | `../licensing/OPEN-SOURCE-POLICY.md` | `cybrik-soc-command-center:docs/licensing/OPEN-SOURCE-POLICY.md` | Yes |
| `README.md:108` | `../security/SECURITY-BASELINE.md` | `cybrik-soc-command-center:docs/security/SECURITY-BASELINE.md` | Yes |
| `01-STRATEGIC-THESIS.md:109` | `../product/PRODUCT-BOUNDARIES.md` | `cybrik-soc-command-center:docs/product/PRODUCT-BOUNDARIES.md` | Yes |
| `02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md:145` | `../architecture/ARCHITECTURE-OVERVIEW-2026-07.md` | `cybrik-soc-command-center:docs/architecture/ARCHITECTURE-OVERVIEW-2026-07.md` | Yes |
| `03-REFERENCE-ARCHITECTURE.md:6` | `../architecture/ARCHITECTURE-OVERVIEW-2026-07.md` | `cybrik-soc-command-center:docs/architecture/ARCHITECTURE-OVERVIEW-2026-07.md` | Yes |
| `03-REFERENCE-ARCHITECTURE.md:333` | `../architecture/DATA-PLANE-V2.md` | `cybrik-soc-command-center:docs/architecture/DATA-PLANE-V2.md` | Yes |

(10 rewritten lines across 4 files: 6 in `README.md`, 1 each in `01` and `02`, 2 in `03`.
Every outward parent-relative Markdown link in the destination copies was rewritten — zero
remain.)

## Not rewritten

- Internal links among the ten strategy documents — still valid within `docs/strategy/`.
- External `https://` links — unchanged.
- `09-CLAUDE-CODE-MULTI-REPO-BOOTSTRAP-PROMPT.md` already used repository-qualified
  reference text; it required no rewrite and is byte-identical to its source.

No case required a semantic change beyond the reference form, so no `LINK-REVIEW.md` was
needed for this import.
