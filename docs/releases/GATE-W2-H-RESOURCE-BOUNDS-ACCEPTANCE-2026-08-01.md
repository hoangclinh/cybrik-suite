# Gate W2-H — resource-bounds contract acceptance

Decision date: 2026-08-01 (Asia/Ho_Chi_Minh).

Canonical base: `17011ce58a6877a55dead5e3eb5944e2699d962d`.

Decision checkpoint: `70c6f77`.

RED checkpoint: `d0adaf0`.

Outcome: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** at v0.1.0. This is not stable v1/GA,
is not an ADR-0001 immutable bundle tag, and is not `G-C`.

## Accepted surface

Gate W2-H accepts the exact seven-schema `cybrik.res-*` accounting profile, its deterministic
36-fixture corpus, the examples manifest, and the 45-member compatibility manifest for
contract-first product implementation. The accepted profile preserves six conserved dimensions,
15 `RES_*` codes, the 10/10/16 positive/negative-schema/negative-semantic fixture split, and four
accepted dependency pins.

Acceptance is governance-metadata and digest-only. It changes no JSON Schema property, required
field, type, enum, `$ref`, `const`, conditional mapping, resource dimension, error code, fixture
payload, replay rule, dependency, endpoint, or runtime behavior. `RES_ACTIVE_CHILDREN` remains
`retriable: false`; only `RES_INSUFFICIENT_REMAINDER` remains retriable.

## Exact authority

The atomic acceptance is bounded to the following 28 paths, exactly as authorized by W2-H/R5:

1. `docs/adr/DELEGATED-GOVERNOR-DECISION-W2-H-RESOURCE-BOUNDS-PROPOSAL.md`
2. `docs/adr/ADR-0012-resource-bounds-contract-profile.md`
3. `docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md`
4. `docs/releases/GATE-W2-H-RESOURCE-BOUNDS-ACCEPTANCE-2026-08-01.md`
5. `docs/releases/README.md`
6. `docs/adr/README.md`
7. `docs/architecture/README.md`
8. `docs/architecture/resource-bounds/README.md`
9. `docs/architecture/resource-bounds/01-contract-semantics.md`
10. `docs/architecture/resource-bounds/02-deterministic-replay-and-evidence.md`
11. `contracts/README.md`
12. `contracts/json-schema/README.md`
13. `contracts/examples/README.md`
14. `contracts/compatibility/README.md`
15. `tools/contract-validation/README.md`
16. `tools/contract-validation/validate-resource-bounds.mjs`
17. `tools/contract-validation/tests/validate-resource-bounds.test.mjs`
18. `tools/contract-validation/validate.mjs`
19. `tools/contract-validation/tests/validate-transport.test.mjs`
20. `contracts/json-schema/cybrik.res-common-defs.v1.schema.json`
21. `contracts/json-schema/cybrik.res-bounds-grant.v1.schema.json`
22. `contracts/json-schema/cybrik.res-reservation-request.v1.schema.json`
23. `contracts/json-schema/cybrik.res-reservation-result.v1.schema.json`
24. `contracts/json-schema/cybrik.res-release.v1.schema.json`
25. `contracts/json-schema/cybrik.res-root-closure.v1.schema.json`
26. `contracts/json-schema/cybrik.res-bounds-error.v1.schema.json`
27. `contracts/examples/resource-bounds/examples-manifest.json`
28. `contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`

## Byte and semantic evidence

The fixture aggregate algorithm is SHA-256 over the literal header
`cybrik-fixture-aggregate-v1\n`, followed by one row per fixture sorted by repository-relative
path. Each row is `<path>`, one tab, the lowercase SHA-256 of the exact file bytes, and one newline.

- Fixture count before and after: `36`.
- 36-fixture aggregate before and after:
  `1315ee0221e8f5a87cd4df568663bc45cde6f22ec3c57a3e5c65b754b21edf61`.

Each schema semantic projection removes exactly the three root governance fields that exist and
move — `description`, `x-cybrik-status`, and `x-cybrik-not-accepted` — recursively sorts object
keys, preserves array order, serializes the result as JSON with one trailing newline, and hashes
those UTF-8 bytes with SHA-256. Before and after values are identical:

| Schema | Before and after SHA-256 |
|---|---|
| `cybrik.res-bounds-error.v1.schema.json` | `cca444316609166c4dbbc27c27ed29e0eaafda9939b71d897bc187f17724de1b` |
| `cybrik.res-bounds-grant.v1.schema.json` | `071c76a8e153784793c5e6605e213470cbc455b3f0d55a0047ae36fb00d38229` |
| `cybrik.res-common-defs.v1.schema.json` | `5e2433f99bf8ab061e116badba9d1a060ca5c651cb7526d9d7059c183dd7740c` |
| `cybrik.res-release.v1.schema.json` | `d919ff6bcc7318cb1fb2e5f1b5fc55a13ff3649cd778963473435c257f3aa32f` |
| `cybrik.res-reservation-request.v1.schema.json` | `473a254c3b4aef872cce0ed1587143f14a9237a5176e56d2091e3eab1a53b797` |
| `cybrik.res-reservation-result.v1.schema.json` | `5453b278ebf6180f99b121d9f28c0baa2c18e38b835fbee2c00a6757281874f1` |
| `cybrik.res-root-closure.v1.schema.json` | `79c5e788f62f319ecee09689236294977217921b7c53f87c5b6235eb45319877` |

All 36 fixture member digests remain unchanged. Exactly eight of the 44 non-self member digests
move: the seven schema digests and the examples-manifest digest. The compatibility-manifest self
digest is `6d2f016f0a51b2b4e1bec82f3ad4a14ac9f390cb1f675b93b85767fd0d94c446` and the
recut aggregate is `0025b9e35e44ebcc74450257e3ad9f6c1885f3c10767df29a8b32b155bd71042`.

PR #38 and post-merge run `30684160610` are prior R4 hardening evidence for canonical base
`17011ce58a6877a55dead5e3eb5944e2699d962d`; they are not hosted evidence for R5. R5 merge remains
conditional on its own independent review and rendered required hosted checks.

## Authority boundary

This acceptance authorizes later product implementation against v0.1.0 only. It grants no runtime,
integration, UAT, T10/T11, local-stack, deployment, release, production, credential, migration, or
dependency-install authority. W0-T11 remains `HOLD until real vertical exists`. The stable-v1.0
Founder go/no-go remains 2026-12-20 and the release window remains 2026-12-21 through 2026-12-31.

## Rollback

Before any separately authorized product consumer depends on W2-H, rollback is the atomic reversion
of all R5 lifecycle carriers and the digest recut. A partial rollback is forbidden and must fail the
cross-carrier tests. After a product consumer is authorized, an incompatible change requires a
separately reviewed versioned decision and must never be silently rewritten in place.
