# SOC-to-AI lifecycle-create mTLS UAT preparation

Status: `D2-P0 PREFLIGHT AUTHORED — RUNTIME NOT RUN`.

This directory contains the dependency-neutral policy/evidence/procedure library plus the bounded
D1 dependency artifact and its supply-chain evidence. The internally versioned
`anycorn==0.20.0+cybrik.1` B1 wheel was built twice from the exact official sdist and committed
patch, was byte-identical across both builds, and was installed only into an isolated offline UAT
tool environment. It is not a selected CYBRIK product server and no runtime UAT has executed.

The D1 dependency boundary remains `D1 ARTIFACT COMPLETE — RUNTIME NOT RUN`. D2-P0 adds an
import-inert harness, ephemeral PKI builder, exact digest-pinned PostgreSQL controller, real SOC
client/AI composition adapters, N1–N10 drivers and an authorization-guarded operator runner. This
authoring gate confers no permission to install, restore or execute B1, create PKI, open listeners,
start PostgreSQL, run migrations or execute any runtime case.

The authored runner preserves sanitized TLS and PostgreSQL posture evidence outside every
repository while rollback destroys only the disjoint runtime root. Its first runtime action must
import-check the exact pinned product APIs; the migration checkpoint must prove the runtime role,
five `FORCE RLS` tables and a zero-row cross-tenant probe. The N1 checkpoint requires one durable
PostgreSQL replay row, N9 removes PostgreSQL before the request, and N10 compares evidence against
the exact ephemeral password and private-key bytes in addition to generic secret patterns.
Future runtime and evidence roots must be fresh absolute paths with purpose-bound basenames
`cybrik-uat-d2-runtime-*` and `cybrik-uat-d2-evidence-*`; neither may contain, be contained by, or
overlap any Suite/product repository or each other.

## Current boundary

- Only synthetic or sanitized future test data is permitted.
- Proposed listeners remain `127.0.0.1:58443` for the AI mTLS surface and
  `127.0.0.1:55432` for PostgreSQL. D1 opened neither listener.
- The raw official Anycorn distribution is absent from `uv.lock`, the runtime wheelhouse and the
  installed environment. B1 is pinned separately by exact SHA-256 and installed offline with
  `--no-deps` after a fail-closed digest check.
- D1 opened no socket, server, database, container, migration, certificate, key or product-runtime
  connection. The installed B1 `SSLContext` builder was exercised only by a socket-denying
  in-process probe.
- The transitive closure has zero known vulnerabilities at the recorded audit point. The raw
  Anycorn High remains open and B1 VEX remains `in_triage` until D2 empirical runtime evidence.
- License inventory remains non-approving: `psycopg2-binary` requires legal review and
  `legal_approval=false`.

## Authored negative inventory

All cases remain `authored_not_run` and require D2 runtime authority:

| Case | Future negative proof |
|---|---|
| N1 | replayed delegation |
| N2 | `cnf` thumbprint mismatch |
| N3 | wrong audience |
| N4 | wrong scope |
| N5 | wrong operation |
| N6 | cross-tenant request |
| N7 | tenant/organization advisory mismatch |
| N8 | missing or malformed server-owned TLS extension |
| N9 | PostgreSQL unavailable with no in-memory fallback |
| N10 | secret-bearing evidence leakage |

## Gates and rollback

`UAT-MTLS-D1` is complete only for the isolated B1 dependency artifact, exact lock, audit,
SBOM/VEX, license inventory and offline reinstall proof. It confers no runtime or release credit.

`UAT-MTLS-D2` remains **HOLD**. It alone may authorize certificates, listeners, separate SOC/AI
processes, PostgreSQL, migrations and execution of N1–N10 after a separate exact-bit review.

D1 rollback removes the outside-repository artifact/caches and reverts this bounded branch; there
is no runtime state to recover. UAT, `DEMO_READY_LOCAL`, customer POC, RC, stable-v1 and GA remain
**NO-GO**. Release dates are unchanged: stable-v1 go/no-go remains 2026-12-20 and the official
window remains 2026-12-21 through 2026-12-31.

## Dependency-neutral verification

This command deliberately names only the four static files and needs no ephemeral D1 artifact:

```sh
PYTHONPATH=integration/compose/soc-ai-lifecycle-create-mtls/src \
  python3 -m pytest \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_evidence.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_procedure.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_case_inventory.py
```

## Explicit D1 artifact verification

Set `CYBRIK_UAT_D1_ARTIFACT_DIR` to the exact outside-repository artifact root and run only the
artifact-dependent targets:

```sh
CYBRIK_UAT_D1_ARTIFACT_DIR=/absolute/outside-repository/artifact-root \
  python3 -m pytest \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_anycorn_patch_provenance.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_patched_ssl_context.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_reproducible_wheel.py
```

Neither command executes runtime UAT.

## D2-P0 static preflight verification

The following selection verifies the authored runtime inventory, authorization guard, B1 builder
policy, negative-case mapping and teardown shape without selecting the runtime test itself:

```sh
PYTHONPATH=integration/compose/soc-ai-lifecycle-create-mtls/src \
  python3 -m pytest -q \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_real_tls_extension.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py::test_harness_exposes_exactly_the_five_allowlisted_operator_steps \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py::test_runtime_entrypoint_has_a_committed_authorization_guard \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py::test_missing_pinned_trust_factory_is_wrapped_as_authorization_failure \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py::test_runtime_driver_is_collected_but_cannot_run_without_phase_a \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_negative_cases.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_teardown.py
```

Do not run `tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh` or the runtime pytest target while
`UAT-MTLS-D2` is **HOLD**. A future committed Phase A admission must bind the exact Suite and
product commits, clean worktrees, B1 wheel digest and canonical authorization-artifact digest
before that runner can pass its first guard. That artifact must also contain exact standalone
`RUNTIME_ROOT=<absolute path>` and `EVIDENCE_ROOT=<absolute path>` lines; both roots must be fresh,
purpose-bound and disjoint, and the preserved evidence root consumes the authorization after the
single attempt.

D2-P0 does not satisfy the section 7.3 coverage gate. Phase A remains closed until a separately
pinned command proves at least 80% line and branch coverage and 100% coverage of the critical
paths. If the pinned environment does not already contain the required coverage runner, a
separate bounded coverage-tooling action must be reviewed before it is installed or used. Static
pass counts are not a substitute for this coverage evidence. Release dates are unchanged.

## Proposed isolated coverage-tooling action

`UAT-MTLS-D2-COV-P0` is `PROPOSED — HOLD PENDING FOUNDER DEPENDENCY AUTHORIZATION`. It requests
one outside-repository-only installation of the exact SHA-256-pinned Coverage.py `7.15.2` macOS
arm64 CPython 3.12 wheel into a fresh tool-only target directory, with a second disjoint evidence
root preserved on success, failure and rollback. It changes neither this harness lock nor any
product environment and may select only the eight exact import-inert unit/static test files; the
guarded D2 runtime target is explicitly deselected. Installation integrity and the coverage result
are separate gates. Coverage `PASS` requires at least 80% line and branch coverage across the full
harness package plus 100% line/branch coverage of the exact builder, bind-validation, sanitizer and
teardown functions named in the ADR, exercised only through fakes, monkeypatches and temporary
roots. The proposal authorizes nothing until Founder approval is recorded, and neither installation
nor a passing coverage result by itself opens Phase A, recovers B1, runs N1–N10 or grants
UAT/release credit.
