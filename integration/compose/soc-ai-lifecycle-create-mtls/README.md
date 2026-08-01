# SOC-to-AI lifecycle-create mTLS UAT preparation

Status: `NOT IMPLEMENTED — PRE-D1 DEPENDENCY-NEUTRAL PREPARATION`.

This directory currently contains only a pure Python policy/evidence/procedure library and its
tests. It is an authored blueprint for a future separate-process, loopback-only mTLS and
PostgreSQL UAT harness. It is not a harness runner and proves no runtime behavior.

## Current boundary

- Only synthetic or sanitized future test data is permitted.
- Proposed listeners are pinned to `127.0.0.1:58443` for the AI mTLS surface and
  `127.0.0.1:55432` for PostgreSQL. Current code parses these strings; it never binds them.
- No Anycorn or product package is imported, installed, resolved, built or downloaded.
- No socket, process, database, container, migration, certificate, key or secret is opened or
  handled.
- The raw Anycorn SSL-context builder and any symbolic delegation to it fail closed. Only the
  prospective internal patched-builder symbol can be described.
- The lifecycle commands are immutable argv descriptions. There is no executable module or
  execution method behind them.

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

## Future gates and rollback

`UAT-MTLS-D1` remains **HOLD**. It is the only future gate that may authorize dependency
resolution, the audited `anycorn==0.20.0+cybrik.1` build, exact lock/pin, SBOM/VEX evidence and
offline reinstall proof.

`UAT-MTLS-D2` remains **HOLD**. It is the only future gate that may authorize certificates,
listeners, separate SOC/AI processes, PostgreSQL, migrations and execution of N1-N10.

The authored lifecycle contains paired `start`, `seed`, `reset`, `stop` and `rollback` command
descriptions. Before D1, rollback is deletion or reversion of this exact dependency-neutral slice;
there is no runtime state to recover.

UAT, `DEMO_READY_LOCAL`, customer POC, RC, stable-v1 and GA remain **NO-GO**. Release dates are
unchanged: stable-v1 go/no-go remains 2026-12-20 and the official window remains
2026-12-21 through 2026-12-31.

## Dependency-neutral verification

```sh
PYTHONPATH=integration/compose/soc-ai-lifecycle-create-mtls/src \
  python3 -m pytest integration/compose/soc-ai-lifecycle-create-mtls/tests
```

This command verifies authored controls only. It does not execute UAT.
