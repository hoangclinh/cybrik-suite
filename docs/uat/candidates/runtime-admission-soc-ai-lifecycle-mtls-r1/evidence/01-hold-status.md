# Runtime Admission SOC→AI Lifecycle mTLS R1 — HOLD Status

Status: `D2 HARNESS PRESENT — RUNTIME NOT EXECUTED`

Recorded at `2026-08-03T12:48:48Z`.

Live state: `D2_HARNESS_PRESENT_RUNTIME_UNEXECUTED`.

Carried-forward D1 dependency substate: `D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN`.

## 1. Identity

- Series: `runtime-admission-soc-ai-lifecycle-mtls`.
- Candidate: `runtime-admission-soc-ai-lifecycle-mtls-r1`.
- Attempt ordinal: `1`.
- Maximum attempts for this series: `2`.
- Objective lineage: capability `cybrik.suite.golden-workflow`, objective `golden-uat-v1`.
- Current attempt status: `not_run`.
- Execution authorized: `false`.
- Executed, passed and failed checks: `0 / 0 / 0`.
- Declared disposition: `HOLD`.
- Evidence final profile verdict: `HOLD`.

## 2. What this record does not do

This runtime-admission candidate does **not** authorize and has not performed any of the following:

- starting, stopping or otherwise operating any product process, stack, container, database or
  migration;
- opening any socket or listener, including the two prospective loopback binds named in §5;
- selecting, installing or pinning any CYBRIK product server or the raw official Anycorn release;
- issuing, provisioning, importing or handling any certificate, private key, token or secret;
- reading or writing production credentials, production configuration, production data or
  production traffic;
- claiming a UAT pass, demo readiness, POC readiness, RC readiness, GA, public release or any
  production posture.

Any UAT claim is additionally bound by `cybrik-suite:docs/uat/UAT-GATE-STANDARD.md`. That standard
is a process standard only; it certifies nothing and no wave has been submitted or judged under it.
This HOLD candidate grants no UAT pass, demo, POC, RC or release claim.

The separate D1 dependency gate has completed an exact internal B1 artifact, isolated UAT lock,
audit, SBOM/VEX, license inventory and offline reinstall. That bounded dependency work does not
authorize this runtime candidate and does not change its zero-count `not_run` state.

## 3. Why the candidate is HOLD and not authorized

Two independent reasons, either of which alone is sufficient:

1. **The candidate still has no admitted runtime result.** A Suite-owned three-service harness now
   exists and static verification is green, but no exact-head authorization artifact has been
   issued for it, no real listener or PostgreSQL runtime has been started, and the required
   runtime N1–N10 evidence remains unexecuted for this candidate.
2. **The raw upstream HIGH remains open and B1 mitigation is not runtime-proven.** Anycorn — the
   prospective ASGI server for the AI-side HTTPS/mTLS listener — has no release that contains the
   upstream fix preserving hardened SSL options. D1 proves an internal patch only in an isolated
   no-socket probe; D2 must provide the real listener/TLS-extension evidence. Details in §4.

The committed candidate is unauthorized for the two reasons above. Under §7, a future exact-bit
preflight update may authorize one bounded `not_run` attempt after the current harness, tuple and
procedures are re-pinned while the Anycorn High remains truthfully open; the empirical probe from
that run is what can close A1. That authorization is permission to obtain evidence, not a claim
that runtime evidence exists.

## 4. Blocking upstream finding — Anycorn (HIGH, prospective exercised transport dependency)

Facts as of `2026-07-31`:

- Latest Anycorn release: `0.20.0`, PyPI upload `2026-07-28`.
- Official PyPI wheel SHA-256:
  `43fcf5ade1b727f3a39b5bff0305012262be9b9993150dd312d626126382c8a1`.
- Official PyPI sdist SHA-256:
  `e5555ddc95bc2df13908093ee11eff8f0a05165b9b9a368c28291065eab63927`.
- Release tag commit: `f81a302a2cf3ea36093372e2f62283d945d47fe6`.
- Upstream fix commit `9eabf20e22bb2fe4987110bebf05eb822517f754`, dated `2026-07-29`, preserves
  hardened SSL options. **No release contains it yet.**

Conclusion: raw `0.20.0` is **NO-GO for production** and **HOLD for this UAT candidate**. This is a
HIGH-severity finding against the prospective exercised transport dependency. It is recorded in the
runtime-admission record as `open_findings.high = 1` and is described in `open_findings.notes` and
`evidence.limitations`. Because no attempt has run or failed, the open finding blocks execution and
truthfully derives `HOLD`; it does not create a runtime `NO-GO` result.

Artifact-level unblock — either of:

1. an Anycorn release that contains `9eabf20e22bb2fe4987110bebf05eb822517f754`, **followed by**
   artifact and transitive lock review and an empirical ASGI TLS-extension probe; or
2. a separately audited internal patch proposal, approved **before** any installation.

Option 2 is now satisfied at D1 for the isolated B1 evaluation artifact only. The raw release stays
uninstalled/unpinned and affected; B1 remains `in_triage` until D2 supplies empirical listener and
ASGI TLS-extension evidence.

## 4.1 D1 exact dependency evidence

- State: `D2_HARNESS_PRESENT_RUNTIME_UNEXECUTED`.
- B1 wheel SHA-256: `d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c`.
- Patch SHA-256: `1090569a745fc8cf9aa543505fc6616ebc724e6a16864ecb122cf4888954394e`.
- Dedicated `uv.lock` SHA-256: `e05c5e281e230b2089e356d716212a6d2c2e4320a3a30dc8dfd126216faa3add`.
- No-socket SSL-context probe SHA-256: `91ddea52e76a1334724b187d5ea0a90e8fdf7a84bd3108b8057689de9092dc45`.
- SBOM SHA-256: `7702ea5d3a63d9cbd4fbf00e1aeeee51efe0df3fe3a8d979669bd441e82752dd`.
- VEX SHA-256: `51bc8e75eec3584607bd67640a77ea4d27b4442efc896d92dbb5cd3ed5442512`.
- Runtime: `not_run`; `execution_authorized=false`; checks `0 / 0 / 0`; disposition `HOLD`.
- Static harness verification at the current branch tip: Alert harness `292 passed, 1 warning` and
  integrated master `120 passed` on `2026-08-03`. These are non-runtime tests; they do not change
  the candidate's zero-count `not_run` record.

Official sources:

- <https://pypi.org/pypi/anycorn/json>
- <https://github.com/davidbrochart/anycorn/commit/9eabf20e22bb2fe4987110bebf05eb822517f754>
- <https://asgi.readthedocs.io/en/latest/implementations.html>
- <https://asgi.readthedocs.io/en/latest/specs/tls.html>

## 5. Prospective network surfaces — no listener opened

| Prospective bind | Purpose |
|---|---|
| `127.0.0.1:58442` | SOC-side HTTPS/mTLS ASGI listener for the prospective separate-process harness |
| `127.0.0.1:58443` | AI-side HTTPS/mTLS ASGI listener for the prospective separate-process harness |
| `127.0.0.1:58444` | Tool Fabric HTTPS/mTLS ASGI listener for the prospective separate-process harness |
| `127.0.0.1:55432` | PostgreSQL durable-replay backing store for the prospective harness |

Mode is `local_only`. **No listener is opened by this packet.** Both binds are proposals recorded
so that a future authorization review has an exact, bounded surface to approve or reject.

## 6. Historical prerequisite — non-authorizing

This candidate pins one historical prerequisite:

- Candidate: `runtime-admission-ai-pg-r3`
- Record: `docs/uat/candidates/runtime-admission-ai-pg-r3/runtime-admission.json`
  SHA-256 `72ec88e98023c5992d5e42c710d0632680158d13ecc0a1065795a0a9db4263e3`
- Evidence: `docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/05-r3-runtime-result.md`
  SHA-256 `71041ecf06870cce1fc94911b9c57b90813cb510cb82347a28501d17621d8e23`
- Evidence use: `historical_prerequisite`

**This reference grants no execution authority.** It does not reopen, reinterpret or supersede the
terminal `runtime-admission-ai-pg` R1, R2 and R3 results, all of which remain immutable `NO-GO`.
The `cybrik.ai.durable-postgres` / `bounded-postgres-runtime-v1` objective stays terminal. This
candidate is a distinct objective (`cybrik.suite.golden-workflow` / `golden-uat-v1`) and creates no
PostgreSQL retry, no corrected selector and no out-of-band invocation of any prior attempt.

## 7. Two-phase admission sequencing

Accepting this sequence resolves only the process circularity. D1 dependency evidence is complete,
but this candidate does not authorize execution, open a listener, start PostgreSQL or change the
current runtime facts:
`execution_authorized=false`, status `not_run`, counts `0 / 0 / 0`, one open High finding, all
negative-smoke rows `hold`, and disposition `HOLD`.

### Phase A — preflight admission

A future, separately reviewed exact-bit admission update may set `execution_authorized=true` for
exactly one bounded attempt while its status is still `not_run`. Before that update, all of the
following preflight evidence must exist at one re-pinned four-repository tuple:

1. the exact dependency artifact, lock, patch, SBOM, VEX and supply-chain review remain complete;
2. the current separate-process harness, its source aggregate and all N1–N10 tests are authored
   and independently reviewed but have not been executed;
3. start, stop, reset, seed and rollback procedures, synthetic-only data policy, loopback-only
   exposure and production exclusions are exact and reviewable;
4. all rendered required checks are refreshed and green; and
5. an independent preflight `GO` artifact authorizes only the exact attempt, paths and digests.

During Phase A the candidate remains `HOLD`: the open High and every unexecuted smoke row remain
truthful. Preflight authorization is permission to obtain empirical evidence, not evidence closure.

### Phase B — bounded execution and evidence closure

The admitted attempt may run once within its exact local-only boundary. Immediately after the run,
the integrator must set `execution_authorized=false`, record status `passed` or `failed`, record
exact executed/passed/failed counts, and capture the A1–A4 empirical artifacts. A failed attempt
derives `NO-GO`. A passed attempt remains `HOLD` under the current validator and proceeds to the
separate UAT Gate Standard; it does not itself establish a UAT pass or `DEMO_READY_LOCAL`.

The A1–A7 criteria in `02-architecture-and-acceptance.md` are completed during evidence closure
after the bounded execution. They are not prerequisites that must already contain runtime results
before Phase A can authorize the one attempt needed to produce those results.

## 8. Evidence-closure and promotion path

After a Phase B execution, evidence closure requires a separate, independently reviewed exact-bit
update that at minimum:

1. closes the Anycorn finding by one of the two acceptable unblocks in §4, with artifact digests and
   an empirical ASGI TLS-extension probe result recorded;
2. records the harness design in `02-architecture-and-acceptance.md` as implemented, with the
   exact separate-process, real-loopback-TLS, ephemeral out-of-repo dev PKI and PostgreSQL
   durable-replay properties evidenced;
3. records every negative test in the required set as written and passing;
4. replaces the `hold` negative-smoke rows with truthful executed results;
5. records an independent `GO` review artifact, pinned by repository-relative path and SHA-256;
6. passes the runtime-admission validator, the full relevant Suite checks and all hosted required
   checks at an exact re-pinned tuple.

The outcome must be recorded in a **new** result artifact. This pre-run HOLD artifact cannot be
reused as runtime-result evidence. Completing A1–A7 admits the result to the separate UAT gate; it
does not silently promote this runtime-admission record or grant any release status.
