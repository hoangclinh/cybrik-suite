# contract-validation — CYBRIK Suite standards validator

Status: `SCAFFOLD` (validation tooling). It validates three disjoint packets under `contracts/`:
the accepted v0.1 cross-product packet (**ACCEPTED FOR IMPLEMENTATION**), the additive W2-D
AI model-inference + alert-summarization packet, and the additive W2-F internal service-delegation
+ workload-identity packet — the latter two now all **ACCEPTED FOR IMPLEMENTATION** (v0.1.0; not
stable v1/GA) as of Gate W2-D and Gate W2-F respectively (Codex under Founder delegation,
2026-07-24). A green run is a **standards-conformance signal only**; it does not by itself accept
any contract. Acceptance is a separate Founder gate (see the repository `CLAUDE.md` → "Approval
gates"); for these packets that is Gate W2-D / Gate W2-F, now decided.

This is **validation tooling only**. It is deliberately *not* a product runtime stack choice —
no product source code lives in this repository (see repository `CLAUDE.md`).

## What it checks

| Layer | Standard | Official validator | Exact version |
|---|---|---|---|
| v0.1 packet: JSON Schema documents, examples, packet integrity, security hardenings | JSON Schema 2020-12 | `ajv` (`ajv/dist/2020`) + `ajv-formats` | `ajv` 8.20.0, `ajv-formats` 3.0.1 |
| W2-D inference packet: JSON Schema documents, fixtures, packet integrity, trust invariants | JSON Schema 2020-12 | `ajv` (`ajv/dist/2020`) + `ajv-formats` | `ajv` 8.20.0, `ajv-formats` 3.0.1 |
| W2-F service-delegation packet: JSON Schema documents, fixtures, packet integrity, trust invariants | JSON Schema 2020-12 | `ajv` (`ajv/dist/2020`) + `ajv-formats` | `ajv` 8.20.0, `ajv-formats` 3.0.1 |
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
- **W2-F service-delegation packet** (`validate:svc`): 4 schemas loaded/compiled, 3 positive
  examples pass, 7 negative-schema fixtures rejected, 9 negative-semantic fixtures structurally
  valid, 5 manifest members (+2 accepted primitives reused unmodified), **44 trust-invariant
  assertions** (SI-1..SI-9 structural + SR-1..SR-10 runtime, each exercised by a fixture:
  asymmetric-only signing, explicit `at+jwt` typing, replay `jti`, sender-constrained `cnf`,
  complete claim set, single strict audience, no static bearer / forwarded user token, hard 120s
  TTL ceiling; time window, short-TTL, audience, cross-tenant, org-scope, operation binding,
  marking non-escalation, replay, proof-of-possession, issuer/key pinning).

The inference and service-delegation packets are each **ACCEPTED FOR IMPLEMENTATION** (v0.1.0; not
stable v1/GA). Each validator accepts exactly two consistent whole-packet lifecycle states
(`PROPOSED`/not-accepted or `ACCEPTED FOR IMPLEMENTATION`/accepted), derives the state from its
compatibility manifest, and fails a half-flipped packet; each also asserts disjointness from the
accepted tool-execution packet (no tool/agent/vendor authority on the wire). `validate-svc.mjs`
additionally asserts the manifest's `NO SERVER / NO ENDPOINT` and `MCP OUT OF SCOPE` scope and the
ADR-0004/ADR-0007 out-of-scope declarations.

The W0-I01 Investigation/Claim/Evidence/Bundle packet is also **ACCEPTED FOR IMPLEMENTATION** at
v0.1.0 (not stable v1/GA) by explicit Founder Option A with G-W0I01-1..5 `yes` on 2026-07-26.
Its `validate-investigation.mjs` validator remains deliberately **standalone** and is not invoked
by `validate.mjs` or `npm run validate`. Run it directly from the suite repository root:

```bash
node tools/contract-validation/validate-investigation.mjs
```

It loads 5 packet schemas (4 payload schemas), verifies 9 positive, 8 negative-schema, and 9
negative-semantic fixtures, checks 45 declared fixture-verifiable invariants, and reports TR-5 as
`declared_runtime_only` rather than verified. A green standalone run proves contract/fixture
conformance only; it proves no product consumer, runtime authorization path, endpoint, or
transport binding.

## Run it

```bash
cd tools/contract-validation
npm ci            # reproducible install from package-lock.json (lockfileVersion 3)
npm run validate  # all three validators; exit 0 only if every layer passes
```

Individual layers: `npm run validate:schemas` · `npm run validate:inference` · `npm run validate:svc` · `npm run validate:openapi` · `npm run validate:asyncapi`.

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
