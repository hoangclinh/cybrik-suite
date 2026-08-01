# Gate UAT-MTLS-K5/S1 — W2-K live facts and patched-candidate evaluation

Decision date: 2026-08-01 (Asia/Ho_Chi_Minh).

Base commit: `76eea6a988251f3c5faf19169154e7bf0f4d7cc4`.

Outcome: **K5 ACCEPTED; S1 ACCEPTED — FOR IMPLEMENTATION — NOT IMPLEMENTED**.

## Exact scope

K5 changes exactly eight existing W2-K metadata/control paths:

1. `contracts/compatibility/cybrik-suite-transport-peer-evidence-packet.v1.manifest.json`
2. `contracts/README.md`
3. `contracts/compatibility/README.md`
4. `docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md`
5. `docs/adr/DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md`
6. `docs/architecture/transport-peer-evidence/01-server-candidate-matrix.md`
7. `docs/releases/GATE-W2-K-TRANSPORT-PEER-EVIDENCE-ACCEPTANCE-2026-08-01.md`
8. `tools/contract-validation/tests/validate-transport-peer.test.mjs`

S1 changes exactly five decision/registration/control paths:

1. `docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md`
2. `docs/adr/README.md`
3. `tools/contract-validation/tests/validate-transport.test.mjs`
4. `docs/releases/GATE-UAT-MTLS-K5-S1-ACCEPTANCE-2026-08-01.md`
5. `docs/releases/README.md`

The combined scope is exactly 13 paths. No wire schema, fixture, product file, dependency manifest,
lockfile, workflow, runtime-admission attempt state, or release artifact is in scope.

## K5 live-fact amendment

Every official upstream candidate now declares
`artifact_scope=official_upstream_distribution`. Raw Anycorn `0.20.0` remains `id=anycorn`,
unselected, `installed=false`, `pinned=false`, and HOLD with its High finding. Hypercorn and Granian
remain unassessed, unselected, uninstalled, and unpinned.

The distinct B1 record uses `id=anycorn-cybrik-uat-b1`, version `0.20.0+cybrik.1`,
`artifact_scope=internal_uat_evaluation_artifact`, and
`installed_scope=suite_uat_tool_lock_only`. It is product `selected=false`, `installed=false`,
`pinned=false`, and HOLD. The test fails closed on duplicate IDs, missing scope qualifiers, a raw
row becoming installed/pinned, a pre-D1 B1 install/pin, product selection, public-version
conflation, or an authority field outside the exact UAT lock.

The 19 packet members and every member digest remain byte-identical. The existing aggregate digest
remains `74f0ac5dbfa194272f48192ae7ef664bb39b7b2227454078537bd8368a824780`.
`server_neutral=true` and `selected_server=null` remain exact.

## S1 evaluation admission

S1 admits B1 only for bounded isolated UAT evaluation. It is not a product/server selection and it
does not create, install, pin, import, execute, or prove the internal artifact. PEP 440 public-version
equivalence never collapses B1 into raw Anycorn: ID plus artifact scope is authoritative.

A0 is accepted at the exact base above, while its current attempt remains unauthorized, `not_run`,
at zero counts and `HOLD`. D1 remains **HOLD** and is the only future gate that may atomically
change B1 to installed/pinned after the exact artifact exists. D2 remains **HOLD** and is the only
future gate that may authorize a bounded runtime attempt. The raw-release High remains open.
UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO.

## S1 R2 D1 clarification

The delegated Governor accepts the technical clarification
`S1-R2-D1-CLARIFICATION=ACCEPTED-BY-DELEGATED-GOVERNOR-D1-STILL-HOLD-PENDING-FOUNDER`.
It repairs D1's lock, exact-path and evidence-authority contradictions without opening D1 or
changing the K5/S1 outcome:

- the dedicated `uv.lock` is registry-only for the third-party closure with exact hashes;
  `anycorn` is absent from the solver and lock, while the exact B1 wheel is pinned separately by
  SHA-256 and installed offline with `--no-deps` after a fail-closed hash check;
- D1's future maximum scope adds only the existing `test_policy.py` and two harness README files
  needed to preserve truthful inventory, purity coverage and authored/not-run status;
- clean-checkout tests require no ephemeral artifact; explicit artifact targets use the bounded
  `CYBRIK_UAT_D1_ARTIFACT_DIR` contract and fail closed rather than becoming skip/xfail/todo;
- deterministic proof adds `umask 022` and two distinct absolute build directories;
- CycloneDX SBOM and VEX use their own schema validators, while only bounded digests/summaries enter
  the unchanged custom evidence sanitizer;
- wheelhouse, cache and build workspaces stay outside the repository, the offline proof is scoped
  to the exact platform, and rollback includes the ephemeral gitignored `dist/` artifact;
- relative to the superseded sdist/build-only wording, R2 explicitly adds the closed endpoint set
  `https://pypi.org/pypi/anycorn/0.20.0/json`, the one hash-matching
  `files.pythonhosted.org` sdist URL, `https://api.osv.dev/v1/querybatch`, and
  `https://pypi.org/simple` plus exact hash-pinned `files.pythonhosted.org` tooling artifacts; if the
  Founder later grants D1, exact build-backend child processes are also allowed.

D1 remains **HOLD** pending the explicit Founder grant. D2 remains **HOLD** pending its separate
reviewed runtime admission. Raw Anycorn remains HOLD; B1 remains `installed=false`, `pinned=false`
and product `selected=false`. UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO. Release dates remain
unchanged.

## Authority boundary

K5 and S1 authorize no dependency resolution, build, installation, process, listener, socket,
database, migration, certificate handling, secret handling, product implementation, deployment,
publication, production action, or release-date change. Release dates remain unchanged.

Rollback before D1 is the atomic reversion of these exact metadata/control and registration paths.
Partial rollback that conflates the raw and internal candidates is forbidden and fails closed.
