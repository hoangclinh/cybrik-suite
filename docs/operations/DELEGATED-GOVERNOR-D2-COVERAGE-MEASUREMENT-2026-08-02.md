# Delegated Governor D2 coverage measurement — 2026-08-02

Status: `VERIFIED — COVERAGE GATE PASS — RUNTIME HOLD`.

## 1. Authority and exact scope

The Founder-authorized P0 dependency action and the delegated Governor's routine local evidence
authority cover the finite chain recorded here. Production, public GA, legal/risk acceptance and
material trust-boundary changes remain Founder-controlled. The terminal repository scope is
exactly these nine paths:

1. `CLAUDE.md`;
2. `docs/operations/README.md`;
3. `docs/operations/DELEGATED-GOVERNOR-D2-COVERAGE-MEASUREMENT-2026-08-02.md`;
4. `docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md`;
5. `integration/compose/README.md`;
6. `integration/compose/soc-ai-lifecycle-create-mtls/README.md`;
7. `integration/compose/soc-ai-lifecycle-create-mtls/evidence/coverage-measurement.json`;
8. `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py`; and
9. `tools/contract-validation/tests/validate-transport.test.mjs`.

No product source, dependency, lock, runtime-admission carrier, workflow or release manifest is
changed by this record.

## 2. Exact execution chain

| Gate | Exact outcome | Evidence |
|---|---|---|
| `UAT-MTLS-D2-COV-P0` | `TOOLING VERIFIED — BASELINE COVERAGE FAIL — AUTHORIZATION CONSUMED` | Suite `a209d66c277efce2de62528efdda4070febf6b16`; 385 passed, one guarded skip; baseline line `849/1568` (54.145%) and branch `265/514` (51.556%); failure reason `package_line_coverage_below_80` |
| `UAT-MTLS-D2-COV-M1` | `FAIL — COMMAND SHAPE REJECTED — RUNTIME NOT EXECUTED` | Suite `93c8b6efbd141ab3f37ff2f07f331153de5f314a`; absolute node-id did not deselect the guarded test; 488 passed, one skip; the guard fired before importing `run_runtime_attempt`; no network |
| `UAT-MTLS-D2-COV-M2` | `PASS — COVERAGE GATE CLOSED — RUNTIME HOLD` | Same Suite commit and tree `c67470e531dd3345744e3ef48bc11e0b3d3af218`; 488 passed, 1 deselected; line `1366/1568` (87.117%); branch `439/514` (85.409%); all eight critical symbols at 100% line and applicable branch coverage |

P0 used exactly the authorized OSV POST and pinned wheel GET. M1 and M2 used no network. All three
actions preserved their outside-repository evidence roots. M2's result SHA-256 is
`4a85daaeb793b2dbe573dab643ad3431024e8173159c408419837b2c743938f5`; the previously unanchored
verifier stdout is now independently anchored as
`299a9ae6ca6a54f6cac573aa7657e03f3e879b4266658f083db4042ae59c73a4`.

## 3. Command correction

Pytest reports the target relative to the component rootdir, not the Suite root. The operative
deselect is therefore exactly:

```text
--deselect=tests/test_lifecycle_runtime.py::test_authorized_runtime_attempt_executes_the_red_green_sequence
```

The former absolute `<SUITE_ROOT>/integration/compose/...` form is inert and is withdrawn as an
operative command. M1 preserves the failed form as historical evidence; it must not be retried.
M2 first required the relative node-id in `pytest --collect-only -q`, then required the exact
terminal summary `488 passed, 1 deselected` and rejected any `skipped` outcome.

## 4. Coverage and verifier evidence

The stdlib verifier recomputed package coverage from Coverage.py JSON format 3 and version 7.15.2.
It required exactly nine package files, no excluded lines, at least 80% line and branch coverage,
and 100% coverage for:

- `server.build_patched_ssl_context`;
- `policy.parse_loopback_bind`;
- `policy.validate_proposed_bind`;
- `evidence.secret_reason`;
- `evidence.validate_evidence`;
- `harness._assert_ssl_context_evidence`;
- `harness.teardown`; and
- `harness.verify_absent`.

The two arc-free functions record `not-applicable-no-static-branch`; the other six have complete
branch denominators. A separate import-inert run of `tests/test_coverage_gate.py` at the terminal
branch base passed `31 passed in 0.91s`. Its JUnit artifact SHA-256 is
`51ab9cdb2c1fddd34393735c4dd5ab9117b1fd4561cac0308e68d27a828907fe`.

## 5. Reconciled errata

1. This record, the ADR, both integration READMEs, the operations catalog and `CLAUDE.md` now bind
   the previously external-only P0→M1→M2 chain.
2. Pending/proposed coverage text is superseded by the terminal status above.
3. Commit `93c8b6e` stated the eventual coverage values before M2 existed. M2 later verified those
   values; this record does not backdate that evidence.
4. The same commit message said `488 passed and 1 gated skip`. That shape is rejected M1 history;
   the accepted M2 shape is `488 passed, 1 deselected`.
5. The M2 verifier-output hash is anchored above and in the committed JSON summary.
6. P0 hash `937752eb…` is explicitly a baseline **FAIL** integrity anchor, never the M2 PASS result.
7. P0 `coverage.json` was observed mode `0644` and hardened to `0600` without changing its SHA-256
   `e4694bf51e02091cfcaf3f0bb470792ed2149d9a9208df6e5ae48de650f2ec65`; independent review
   classified the original mode as nonblocking P3 hygiene drift.
8. The verifier's own 31-test suite was executed separately and is anchored in section 4.
9. P1 and P2 authoring-time states are preserved as history, while their current-state labels now
   bind the later P0 consumption and M2 verification without granting runtime credit.

## 6. Independent review and boundary

Codex independent post-execution review returned `GO`; a follow-up mode review classified one P3
hygiene drift, after which the file mode was hardened with its digest unchanged. Claude Opus
independently read the scripts, tests, source ranges and raw evidence and returned `GO` with no
P0–P2; its eight nonblocking errata are reconciled in section 5. A terminal-packet R1 review then
found the P2 overclaim in the first sentence above; this R2 wording and the committed summary remove
that contradiction before merge.

No listener, product process, Docker container, database, migration, certificate, private key,
PKI action or N1–N10 runtime case executed in M1 or M2. The accepted result is only:

> `COVERAGE GATE PASS — RUNTIME HOLD`

D2 runtime, N1–N10, integrated UAT, `DEMO_READY_LOCAL`, POC, RC, stable-v1, GA and production do not
gain credit from this measurement. Release dates remain unchanged. A separate exact-bit runtime
admission and independent review remain mandatory.

## 7. Rollback

Repository rollback is a normal revert of this nine-path terminal packet. External P0/M1/M2
evidence bytes remain immutable historical evidence. The P0 mode hardening changed metadata only
and left the recorded artifact digest unchanged. Nothing in this record authorizes deleting or
replaying consumed evidence roots.
