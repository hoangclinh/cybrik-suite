# SOC-to-AI lifecycle-create mTLS UAT preparation

Status: `D1 ARTIFACT COMPLETE — RUNTIME NOT RUN`.

This directory contains the dependency-neutral policy/evidence/procedure library plus the bounded
D1 dependency artifact and its supply-chain evidence. The internally versioned
`anycorn==0.20.0+cybrik.1` B1 wheel was built twice from the exact official sdist and committed
patch, was byte-identical across both builds, and was installed only into an isolated offline UAT
tool environment. It is not a selected CYBRIK product server and no runtime UAT has executed.

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
