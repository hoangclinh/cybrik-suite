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
one outside-repository-only, pip-free stdlib extraction of the exact SHA-256-pinned Coverage.py
`7.15.2` macOS arm64 CPython 3.12 wheel into a fresh tool-only target directory. A second disjoint,
non-temporary evidence root is preserved on success, failure and rollback. The one-shot Founder
artifact pins the clean Suite commit/tree/worktree, working directory, interpreter and symlink
chain, canonical Darwin host-temp derivation/pin, exact wheel URL/size/digest, canonical OSV
request digest, complete network closure, three authorized tool subpaths and rollback. A non-empty
OSV result, pre-existing root, missing test
closure or identity mismatch stops before extraction. No package installer, index, build frontend
or lifecycle script is invoked. The action changes neither this harness lock nor any product
environment and may select only the eight exact import-inert unit/static test files; the guarded D2
runtime target is explicitly deselected. Extraction integrity and the coverage result are separate
gates. Coverage `PASS` requires at least 80% line and branch coverage across the full harness
package plus 100% line/branch coverage of the exact builder, bind-validation, sanitizer and
teardown functions named in the ADR, exercised only through fakes, monkeypatches and temporary
roots. The proposal authorizes nothing until Founder approval is recorded, and neither extraction
nor a passing coverage result by itself opens Phase A, recovers B1, runs N1–N10 or grants
UAT/release credit.

## Authored stdlib coverage verifier

`UAT-MTLS-D2-COV-P1` is `AUTHORED — STATIC TESTS GREEN — COVERAGE NOT MEASURED — RUNTIME HOLD`.
The pure-stdlib, import-inert `scripts/verify_coverage_gate.py` independently checks one pinned
Coverage.py 7.15.2 JSON format-3 report. It requires the exact package file set, recomputes package
line and branch ratios separately, cross-checks report summaries, and binds each critical function
to its current top-level AST range and branch arcs. Critical ranges cannot use exclusions or
any Coverage.py default coverage-pragma spelling, and the measured package permits no excluded
line. Function region facts are matched from the first body statement through the last body
statement while the producer `start_line` remains bound to the top-level declaration. The two AST
arc-free functions keep 100% line coverage and record the bounded
branch result `not-applicable-no-static-branch`; every branch-bearing critical function requires a
non-empty, 100%-covered branch denominator, with `num_partial_branches` independently
cross-checked. The verifier writes one fresh atomic, no-overwrite, mode-`0600` PASS or FAIL result
beside the input without importing the harness or Coverage.py.

The preceding measurement must run after the literal `cd <SUITE_ROOT>`, set
`PYTHONDONTWRITEBYTECODE=1`, disable pytest's cache provider and pass `--rcfile=/dev/null` to each of
`coverage run`, `coverage report` and `coverage json`, as fixed by the ADR. The final worktree
residue check must also be empty. These controls prevent test residue or caller/checkout
configuration from changing exclusions, partial branches or reported file keys.

After the separately authorized D2-COV-P0 extraction and measurement produce `coverage.json`,
the exact verifier command is:

```sh
<PINNED_PYTHON> \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/scripts/verify_coverage_gate.py \
  --suite-root <SUITE_ROOT> \
  --coverage-json <COVERAGE_EVIDENCE_ROOT>/coverage.json \
  --result-json <COVERAGE_EVIDENCE_ROOT>/coverage-gate.json
```

This authoring slice does not install Coverage.py, does not measure the current package, does not
satisfy the section 7.3 coverage gate and does not open Phase A. D2 remains **HOLD** and all
runtime/UAT/release boundaries above remain unchanged.

## Executable authorization hardening

`UAT-MTLS-D2-COV-P2` is `AUTHORED — VALIDATOR TESTS GREEN — DEPENDENCY ACTION NOT RUN — RUNTIME
HOLD`. The pure-stdlib `scripts/validate_coverage_authorization.py` replaces manual trust in the P0
artifact with an executable fail-closed preflight. It binds the exact ordered field set, clean
detached Suite commit/tree/root with no tracked, untracked or ignored residue, current authorization
window, durable non-temporary roots, pinned Python symlink and real executable, the committed D1
lock/requirements/wheel evidence and exact 56-member installed closure digest
`6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919`,
`pytest==9.1.1`, `cryptography==50.0.0` and the exact `/usr/bin/curl` identity.

From a fresh exact authorized Suite worktree, before running tests or creating ignored artifacts, a
future separately approved action must first run:

```sh
<PINNED_PYTHON> \
  integration/compose/soc-ai-lifecycle-create-mtls/scripts/validate_coverage_authorization.py \
  --authorization <FOUNDER_AUTHORIZATION_ARTIFACT> \
  --check-only
```

Only an exact PASS may be consumed once by replacing `--check-only` with `--consume`. Consumption
creates the two fresh mode-`0700` roots, the three authorized tool subpaths, and bounded mode-`0600`
authorization evidence. It performs no network call, dependency installation, wheel extraction,
coverage measurement or runtime action. The accepted D1 closure must not be under `/tmp`,
`/private/tmp` or the Darwin host-temporary root. The prior D1 environment is both temp-resident and
contains Anycorn B1, so a durable pip-less reconstruction of the exact 56-member coverage-only
closure is mandatory and needs its own prospective bounded Founder authorization; a surviving older
closure is not substitutable.

This hardening is not the dependency authorization. Coverage extraction and measurement are still
not run, D2 runtime remains **HOLD**, and all UAT/demo/POC/RC/stable-v1/GA/production boundaries and
release dates remain unchanged.
