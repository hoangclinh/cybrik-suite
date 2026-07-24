# contract-validation — CYBRIK Suite standards validator

Status: `SCAFFOLD` (validation tooling). It validates two disjoint packets under `contracts/`:
the accepted v0.1 cross-product packet (**ACCEPTED FOR IMPLEMENTATION**) and the additive W2-D
AI model-inference + alert-summarization packet, whose members are all **PROPOSED — NOT
ACCEPTED**. A green run is a **standards-conformance signal only**; it does not accept any
contract. Acceptance is a separate Founder gate (see the repository `CLAUDE.md` → "Approval
gates"); for the inference packet that is Gate W2-D, not yet opened.

This is **validation tooling only**. It is deliberately *not* a product runtime stack choice —
no product source code lives in this repository (see repository `CLAUDE.md`).

## What it checks

| Layer | Standard | Official validator | Exact version |
|---|---|---|---|
| v0.1 packet: JSON Schema documents, examples, packet integrity, security hardenings | JSON Schema 2020-12 | `ajv` (`ajv/dist/2020`) + `ajv-formats` | `ajv` 8.20.0, `ajv-formats` 3.0.1 |
| W2-D inference packet: JSON Schema documents, fixtures, packet integrity, trust invariants | JSON Schema 2020-12 | `ajv` (`ajv/dist/2020`) + `ajv-formats` | `ajv` 8.20.0, `ajv-formats` 3.0.1 |
| Control-plane + inference-plane wire specs | OpenAPI 3.1.x | Stoplight **Spectral** CLI, built-in `oas` ruleset | `@stoplight/spectral-cli` 6.16.2 |
| Event specs (suite + inference lifecycle) | AsyncAPI 3.0.0 | Official **`@asyncapi/parser`** | `@asyncapi/parser` 3.6.0 |
| YAML parsing (ref resolution) | — | `yaml` | 2.9.0 |

Coverage counts printed by a green run:

- **v0.1 packet** (`validate:schemas`): 10 schemas loaded/compiled, 10 positive examples pass,
  7 negative-schema fixtures rejected, 7 negative-semantic fixtures structurally valid, 13
  manifest members, 47 wire `$ref`s (18 external resolved), **25 hardening assertions**.
- **W2-D inference packet** (`validate:inference`): 8 schemas loaded/compiled, 8 positive
  examples pass, 8 negative-schema fixtures rejected, 4 negative-semantic fixtures structurally
  valid, 11 manifest members (+3 accepted primitives reused unmodified), 43 wire `$ref`s (18
  external resolved), 5 AsyncAPI messages data-bound, **39 trust-invariant assertions** (TI-1..TI-8
  structural + TR-1/TR-2/TR-5/grounding/cross-ref runtime, each exercised by a fixture).

The inference packet is **PROPOSED — NOT ACCEPTED**; its validator asserts that status and the
disjointness from the accepted tool-execution packet (no tool/agent/vendor authority on the wire).

## Run it

```bash
cd tools/contract-validation
npm ci            # reproducible install from package-lock.json (lockfileVersion 3)
npm run validate  # all three validators; exit 0 only if every layer passes
```

Individual layers: `npm run validate:schemas` · `npm run validate:inference` · `npm run validate:openapi` · `npm run validate:asyncapi`.

Requires Node.js `>=20` (see `package.json` `engines`). CI pins Node 20.18.1.

## Reproducibility & supply-chain posture

- **Exact versions.** Every dependency is pinned to an exact version (no `^`/`~`). `.npmrc` sets
  `save-exact=true`; `package-lock.json` (lockfileVersion 3) carries `resolved` + `integrity`
  (SRI) for all 266 packages. Use `npm ci`, never `npm install`, in CI.
- **No install-time code execution.** `.npmrc` sets `ignore-scripts=true`, so no dependency
  pre/post-install lifecycle scripts run. None of the pinned validators need them.
- **Licenses.** The installed tree is entirely permissive (MIT / Apache-2.0 / BSD-2/3-Clause /
  ISC / 0BSD / Unlicense / Python-2.0). No copyleft (GPL/LGPL/AGPL).
- **Generated artifacts are not committed.** `node_modules/` and `*.log` are gitignored
  (`.gitignore` here and at repo root). Only source + the lockfile ship.

## CI

`.github/workflows/contracts.yml` runs this validator (`contracts` job) plus a `gitleaks` 8.30.1
secret scan (`secret-scan` job) on every push and pull request. See that file and the repo-root
`.gitleaks.toml` for the secret-scan configuration.
