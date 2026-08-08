# G-U2B PostgreSQL RED runtime result R1

Status: `STOP — ONE-SHOT CONSUMED — VALID RED NOT PROVEN`.

Recorded: `2026-08-04T15:31:00+07:00`.

Release dates remain unchanged. Browser UAT and demo remain `HOLD`. Production remains Founder
only.

## Bound attempt

| Fact | Exact value |
|---|---|
| Attempt ID | `20260804T082945Z-22343` |
| Start | `2026-08-04T08:29:45Z` |
| End | `2026-08-04T08:29:56Z` |
| Elapsed | `11 seconds` |
| Grant path | `G-U2B-POSTGRES-RED-RUNTIME-GRANT-R1.md` |
| Grant SHA-256 consumed at execution | `eaf6216dc9641c213dd43adbcb3ffc06bc09bdf372a107e79a29bf8361023cb8` |
| Post-attempt reconciled grant SHA-256 | `a5a27a63f2495e7011bc794b6068de4e8260c65d225960fb6be73cf6d9ab0037` |
| Executing Suite commit/tree | `efd766f8d8ca811c3d7d57800eb4c2d7fdbaa596` / `2337ff4f4ee6d913244e72c1f309b01667c3035e` |
| Decision-source Suite predecessor/tree | `4937542fcdd3f871607df6fd3b2625082cc06be1` / `4be22a9b55598121bc93a7cbf2857379c09f856b` |
| Runner SHA-256 | `d5de55931bf8d875c180cdcb10b3a11e27a0192c8d081d699d5d8c01bc6a2a28` |
| Runner review | `GO`, P0/P1/P2/P3 = `0/0/0/0` |
| Final classification | `STOP` |
| Valid RED | `false` |
| Retry | `not authorized; not performed` |

## What passed before the stop

- Executing Suite HEAD/tree matched the independently reviewed runner pins, while the accepted
  Suite predecessor tree matched the grant.
- SOC HEAD/tree, clean worktree, exact test Git blob, byte count and SHA-256 matched the grant.
- Python `3.12.13`, pytest `9.1.1`, SQLAlchemy `2.0.51`, asyncpg `0.31.0` and the Python
  executable SHA-256 matched the prepared runtime.
- `postgres:16-alpine` was already present at image ID/digest
  `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`; no pull or
  install occurred.
- Exactly one disposable PostgreSQL container, internal network and volume were created. No other
  Cybrik service, broker, UI, browser, Ollama or full stack was started.

## Stop reason and execution floor

After container health, Docker returned:

```text
no public port '5432/tcp' published for cybrik-g-u2b-red-20260804T082945Z22343
```

The fail-closed runner stopped at the local listener-posture boundary. Consequently:

| Stage | Count/result |
|---|---|
| Role bootstrap | `not executed` |
| Committed migration | `not executed` |
| Application-role preflight | `not executed` |
| Pytest collection | `0` |
| Pytest execution | `0` |
| Passed checks | `0` |
| Failed checks | `0` |

The attempt is truthfully `not_run` at the test-accounting layer with
`execution_authorized=false`. It is not a failed test attempt because no test was collected or
executed. It is not a valid RED because neither missing accepted table was observed through the
granted unprivileged application session.

The preserved `final-disposition.txt` contains the legacy field `pytest_exit_code=1`. In this
pre-pytest STOP it records the runner shell's non-zero exit from the failed `docker port` posture
command, not a pytest process or test result. The original file remains unmodified; the appended
operator observation records `pytest_collected=false` and `pytest_executed=false` explicitly.

## Teardown and external evidence

Teardown removed the exact container, network and volume and then verified each was absent. The
temporary credential root is absent. Evidence is owned by the current user, with directory mode
`0500` and file mode `0400`. A credential-pattern scan returned no match.

External evidence root:

```text
/Users/hoanglinh/.local/state/cybrik-g-u2b-db-red-5e13e50f/20260804T082945Z-22343
```

Canonical manifest SHA-256:

```text
7a194d0a834798a5607b48bb140e67de520ebf91787e085c02065b40c52dcbbb
```

Canonical manifest entries:

```text
2fcf058929220e1389d86afc5b726908613b6f6fc3d68b0b1af3f5a84db58a52  final-disposition.txt
34ba1f37dc640d366c9453bd64339587fc49e6d40624fe96b30712079a87f164  runtime.txt
511607f564e5f43190b0a69641b961a23bb6a82fc9caa2e7ddbb027b7aab1b31  operator-observation.txt
54997044f968d1e09a3eb2d58d0bf8b779b62933221db3592d57c84c28007df4  immutable-inputs.txt
dc7d079e245806e1d8df009d0009401566ac833a527cdeeaacbb80b231b7363f  image.txt
e58557e0cd172535ed5cac8561f4e15c8e8ec3326ff64b1a3c79c7b79534a12b  teardown.txt
```

The operator observation was appended after the runner stopped and before the evidence directory
was locked to mode `0500` with files at mode `0400`, because the runner's fail-closed trap recorded
a generic unexpected-runner reason. It preserves the exact Docker error and phase floor without
rewriting the original five evidence files. This phase floor is operator-attested with limited
audit strength: the runner-written files directly prove immutable preflight, image presence and
teardown, while the absence of migration/role-preflight/pytest transcripts is consistent with but
does not independently prove every negative stage assertion.

## Gate effect

- This runtime-admission series is closed with its sole authority consumed.
- G-U2B PostgreSQL RED remains `NOT PROVEN`; GREEN implementation remains `HOLD`.
- Browser integrated UAT remains `HOLD`; no URL or UAT credential is available.
- Demo, POC, RC, stable-v1.0, GA and production remain unauthorized by this record.
- A future retry requires a different, independently reviewed admission series after a read-only
  topology diagnosis and a rehearsed loopback-only listener approach. This record grants no retry.
