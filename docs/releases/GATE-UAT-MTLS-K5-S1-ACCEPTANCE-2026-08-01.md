# Gate UAT-MTLS-K5/S1 — W2-K live facts and patched-candidate evaluation

Decision date: 2026-08-01 (Asia/Ho_Chi_Minh).

Base commit: `76eea6a988251f3c5faf19169154e7bf0f4d7cc4`.

Outcome: **K5 IMPLEMENTED BY D1 ARTIFACT ONLY; S1 HISTORICAL ACCEPTANCE; D2 HOLD — RUNTIME NOT RUN**.

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
`installed_scope=suite_uat_tool_lock_only`. At the current D1 live state it is product
`selected=false`, `installed=true`, `pinned=true`, and HOLD. The test fails closed on duplicate IDs,
missing scope qualifiers, a raw row becoming installed/pinned, either B1 field reverting false,
product selection, public-version
conflation, or an authority field outside the exact UAT lock.

The 19 packet members and every member digest remain byte-identical. The existing aggregate digest
remains `74f0ac5dbfa194272f48192ae7ef664bb39b7b2227454078537bd8368a824780`.
`server_neutral=true` and `selected_server=null` remain exact.

## S1 evaluation admission

S1 historically admitted B1 only for bounded isolated UAT evaluation. It was not a product/server
selection and did not itself create, install, pin, import, execute, or prove the internal artifact.
D1 subsequently created the exact isolated artifact without changing the S1 product boundary. PEP
440 public-version equivalence never collapses B1 into raw Anycorn: ID plus artifact scope is authoritative.

A0 is accepted at the exact base above, while its current attempt remains unauthorized, `not_run`,
at zero counts and `HOLD`. D1 has atomically recorded the isolated B1 artifact as installed/pinned.
D2 remains **HOLD** and is the only
future gate that may authorize a bounded runtime attempt. The raw-release High remains open.
UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO.

## S1 R2 D1 clarification

Historical pre-D1 record. The original token and limits below remain immutable provenance; they do
not describe the current D1 live state.

The delegated Governor accepts the technical clarification
`S1-R2-D1-CLARIFICATION=ACCEPTED-BY-DELEGATED-GOVERNOR-D1-STILL-HOLD-PENDING-FOUNDER`.
It repairs D1's lock, exact-path and evidence-authority contradictions without opening D1 or
changing the K5/S1 outcome:

- the dedicated `uv.lock` is registry-only for the third-party closure with exact hashes;
  `anycorn` is absent from the solver and lock, while the exact B1 wheel is pinned separately by
  SHA-256 and installed offline with `--no-deps` after a fail-closed hash check;
- D1's then-future maximum scope added only the existing `test_policy.py` and two harness README files
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
  `https://pypi.org/simple` plus exact hash-pinned `files.pythonhosted.org` tooling artifacts; at R2
  acceptance, D1 still awaited the separate exact-action grant.

At R2 acceptance, D1 remained **HOLD** pending the explicit Founder grant. D2 remains **HOLD** pending its separate
reviewed runtime admission. Raw Anycorn remains HOLD; B1 remains `installed=false`, `pinned=false`
and product `selected=false`. UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO. Release dates remain
unchanged.

## S1 R3 D1 endpoint correction

Historical pre-D1 record. The original token and endpoint correction below remain immutable
provenance; they do not describe the current D1 live state.

The delegated Governor accepts
`S1-R3-D1-ENDPOINT-CORRECTION=ACCEPTED-BY-DELEGATED-GOVERNOR-D1-STILL-HOLD-PENDING-FOUNDER`.
This supersedes R2's OSV endpoint token with
`https://api.osv.dev/v1/query`, because the batch response cannot carry the full finding records
and severity needed to enforce D1's existing Critical/High HOLD rule. It also makes R2's existing
PyPI endpoint category explicitly cover the exact-hash UAT transitive-closure wheelhouse as well as
the isolated tooling closure. It does not add a host or a second OSV endpoint.

R3 also freezes the future D1 audit to isolated OSV mode using an exact-hash tooling closure
containing `pip-audit==2.10.1` and freezes the
wheelhouse to the pinned CPython 3.12.13, pip 26.1.1 and uv 0.11.16 command/provenance contract in
the decision record. No dependency, artifact or advisory database was downloaded by R3.

At R3 acceptance, D1 remained **HOLD** pending the explicit Founder grant. D2 remains **HOLD** pending its separate
reviewed runtime admission. Raw Anycorn remains HOLD; B1 remains `installed=false`, `pinned=false`
and product `selected=false`. UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO. Release dates remain
unchanged.

## D1 live-fact supersession

Current state: `D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN`. The separately recorded exact-action
authority produced and offline-installed only `id=anycorn-cybrik-uat-b1` in
`suite_uat_tool_lock_only`; its live facts are atomically `installed=true`, `pinned=true`, product
`selected=false`, and HOLD. Raw official Anycorn, Hypercorn and Granian remain
`installed=false`, `pinned=false`, and unselected. `server_neutral=true` and
`selected_server=null` remain exact.

D2 remains **HOLD**. The runtime candidate remains `not_run`, `execution_authorized=false`, at
zero checks and HOLD. UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO; release dates are unchanged.

## Authority boundary

K5 and S1 authorize no dependency resolution, build, installation, process, listener, socket,
database, migration, certificate handling, secret handling, product implementation, deployment,
publication, production action, or release-date change. Release dates remain unchanged.

Rollback before D1 is the atomic reversion of these exact metadata/control and registration paths.
Partial rollback that conflates the raw and internal candidates is forbidden and fails closed.
