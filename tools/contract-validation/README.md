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
| Spectral/AsyncAPI glob compatibility | CommonJS compatibility adapter backed by the patched upstream implementation | adapter 5.0.9-cybrik.1; upstream 5.0.9 |
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
npm audit --audit-level=high
npm run validate  # all three validators; exit 0 only if every layer passes
```

Individual layers: `npm run validate:schemas` · `npm run validate:inference` · `npm run validate:svc` · `npm run validate:openapi` · `npm run validate:asyncapi`.

Requires Node.js `20` or `>=22` (see `package.json` `engines`). CI pins the Node.js 24 LTS
security release `24.18.1`.

The standalone F8 trust/durability validator uses the same lockfile-pinned toolchain. Its default
resolution is this directory after `npm ci`. A clean worktree may instead reuse an already
provisioned, byte-identical Suite validator toolchain without copying or linking `node_modules`:

```bash
CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT=/absolute/path/to/cybrik-suite/tools/contract-validation \
  npm run validate:f8:receipt-trust-durability
```

The override is version-gated: the validator reads the resolved package metadata and fails closed
unless `ajv` is exactly 8.20.0 and `ajv-formats` is exactly 3.0.1, matching
this directory's `package.json` and `package-lock.json`. The override provisions validation tooling
only; it is not product runtime evidence and grants no implementation, UAT, release, or production
authority.

The repository-root command `node tools/operations/validate-w1-control.mjs` also loads the pinned
`yaml@2.9.0` from this toolchain. On a fresh clone, run `npm ci` in
`tools/contract-validation` before invoking that standalone control-validator command.

## Reproducibility & supply-chain posture

- **Exact versions.** Every dependency is pinned to an exact version (no `^`/`~`). `.npmrc` sets
  `save-exact=true`; `package-lock.json` (lockfileVersion 3) carries `resolved` + `integrity`
  (SRI) for all 266 packages. Use `npm ci`, never `npm install`, in CI.
- **No install-time code execution.** `.npmrc` sets `ignore-scripts=true`, so no dependency
  pre/post-install lifecycle scripts run. None of the pinned validators need them.
- **Explicit dependency gate.** `.npmrc` disables npm's implicit install-time audit noise, while
  CI separately runs `npm audit --audit-level=high` as a blocking step. `npm run validate` also
  executes two compatibility tests before Spectral. The repository-local
  `vendor/brace-expansion-compat` adapter preserves the callable CommonJS API required by
  `minimatch@3` while delegating expansion to upstream `brace-expansion` 5.0.9; it contains no
  copied expansion algorithm.
- **Licenses.** The installed tree is entirely permissive (MIT / Apache-2.0 / BSD-2/3-Clause /
  ISC / 0BSD / Unlicense / Python-2.0). No copyleft (GPL/LGPL/AGPL).
- **Generated artifacts are not committed.** `node_modules/` and `*.log` are gitignored
  (`.gitignore` here and at repo root). Only source + the lockfile ship.

## CI

`.github/workflows/contracts.yml` runs this validator (`contracts` job) plus a `gitleaks` 8.30.1
secret scan (`secret-scan` job) on every push and pull request. See that file and the repo-root
`.gitleaks.toml` for the secret-scan configuration.

## Gate W2-H resource-bounds contract

The resource-bounds validator is registered as an additive contract drift check:

```bash
npm run validate:w2h:resource-bounds
npm run test:w2h:resource-bounds
```

It compiles seven JSON Schema 2020-12 documents, validates 10 positive and rejects 10
negative-schema fixtures, requires each of 16 negative-semantic replay cases to fail exactly its
declared resource invariant, checks packet/member digests, and runs seeded conservation
properties over synthetic trees covering admission, release return-and-consume, and terminal root
closure. Replay uses only fixture sequence numbers and a virtual clock.
Status is **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** under the W2-H/R5 amendment; acceptance is permission to implement later,
and green is static L1/L2 evidence only — not runtime, UAT, T10/T11, release, deployment, or
production proof.

## Gate W2-K transport peer-evidence contract

Status: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED**. Run the standalone checks with:

```bash
npm run validate:w2k:transport-peer
npm run test:w2k:transport-peer
```

The profile is server-neutral and fail closed. It validates two schemas, 18 synthetic fixtures,
three-way `x5t#S256` equality, no-degrade behavior, denial-class coverage, packet digests, and the
absence of raw certificate or authorization material. It opens no socket and selects no server.

Canonical registration is complete: `validate-transport-peer.mjs` and its test are registered in
`validate.mjs`; W2-K entered when the orchestrator had 23 steps, while the `validate.mjs` header now
truthfully states the present-day count. These 29 validators include the separately registered
Fabric runtime-producer gate and its regression suite. The orchestrator's `ALL GREEN`
banner names W2-K ACCEPTED FOR IMPLEMENTATION / NOT IMPLEMENTED. The W2-I P2-3 additive-byte pin now also carries the exact,
additive W2-K paragraph, ADR-0013 catalog row and Governor-decision row applied to
`docs/adr/README.md`; every other byte of that catalog, including the W2-I entries, is
unchanged outside the exact W2-K lifecycle addition. The W2-H entries moved separately and later,
under the W2-H/R5 acceptance, which is disjoint from this packet. R4 acceptance authorizes contract-first
implementation only and grants no runtime, UAT, release, deployment, or production authority.
Standalone green (via the scripts above) remains static conformance only.

## Topology-only rehearsal records

The topology-rehearsal validator is a separate, non-product preflight control:

```bash
npm run validate:topology-rehearsal
npm run test:topology-rehearsal
```

It discovers only `docs/uat/topology-rehearsals/*/topology-rehearsal.json`, enforces the one exact
policy-and-code-pinned record identity, fixed loopback/internal-network envelope, one 180-second
cycle with no extension, exact bounded host probe, phase/outcome truth table, contained artifact
digests, locally reviewed external-manifest limitation and zero residual resources for every closed
record. Zero prepared records is the current valid state. A green result is static control evidence
only and grants no Docker effect, runtime, UAT, demo, release or production authority.

## Runtime-admission records

The runtime-admission validator is a governance-record check for the 2026-07-31 non-production
runtime authority decision:

```bash
npm run validate:runtime-admission
npm run test:runtime-admission
```

It loads `docs/uat/runtime-admission.schema.json` as the canonical record shape and
`docs/uat/runtime-authorization-withdrawal.schema.json` as the append-only unused-authority
withdrawal shape, validates the
truthful HOLD template at `docs/uat/templates/runtime-admission.hold.json`, verifies the immutable
three-record legacy seal and the allowed capability/objective registry at
`docs/uat/runtime-admission-lineage-policy.json`, discovers only
`docs/uat/candidates/*/runtime-admission.json` plus the exact optional sibling
`runtime-authorization-withdrawal.json`, and fail-closes on missing gate items, duplicate or
incomplete four-repo tuples, non-success required hosted checks, missing rollback/seed procedures,
open Critical/High findings, cross-series terminal-objective reopening, historical-evidence
promotion or byte reuse, canonical-path escape through symlinked parents, stronger-profile
overclaim, or any failed tenant-isolation,
authorization or secret-boundary check. A withdrawal frees the singleton only when it preserves
the original unused authorization bytes, closes the series, and its detached SSHSIG verifies as
`FOUNDER` against the pinned `docs/uat/runtime-authorization-withdrawal-trust.json` identity under
the dedicated `cybrik-uat-runtime-withdrawal-v1` namespace. Invalid withdrawal material leaves the
authority effectively active. A green result validates static runtime-admission records
only; it grants no `DEMO_READY_LOCAL`, UAT pass, POC readiness, RC readiness or GA claim.

## Receipt trust and durability

Status: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED**. Run:

```bash
npm run validate:f8:receipt-trust-durability
npm run test:f8:receipt-trust-durability
```

The validator checks packet/reuse hashes, public-only RFC 7638 Ed25519 keys, monotone rotation,
durable ordering, fail-closed completion, append-only/no-resign semantics, and retention coupling.
Green is static evidence only and grants no runtime, UAT, release, deployment, or production
authority.
