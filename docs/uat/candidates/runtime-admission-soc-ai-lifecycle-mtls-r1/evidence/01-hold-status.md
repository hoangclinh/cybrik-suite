# Runtime Admission SOC→AI Lifecycle mTLS R1 — HOLD Status

Status: `DRAFT — NOT EXECUTED`

Recorded at `2026-07-31T17:29:11Z`.

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

This candidate does **not** authorize and does **not** perform any of the following:

- starting, stopping or otherwise operating any process, stack, container, database, migration,
  formatter, installer or package manager;
- opening any socket or listener, including the two prospective loopback binds named in §5;
- adding, installing, pinning, vendoring or upgrading any dependency, including Anycorn;
- issuing, provisioning, importing or handling any certificate, private key, token or secret;
- reading or writing production credentials, production configuration, production data or
  production traffic;
- claiming a UAT pass, demo readiness, POC readiness, RC readiness, GA, public release or any
  production posture.

Any UAT claim is additionally bound by `cybrik-suite:docs/uat/UAT-GATE-STANDARD.md`. That standard
is a process standard only; it certifies nothing and no wave has been submitted or judged under it.
This HOLD candidate grants no UAT pass, demo, POC, RC or release claim.

## 3. Why the candidate is HOLD and not authorized

Two independent reasons, either of which alone is sufficient:

1. **No harness exists.** The separate-process, real-TLS-socket harness described in
   `02-architecture-and-acceptance.md` is a design only. Nothing in the pinned tuple opens a bound
   ASGI TLS server, and no negative test in the required set has been written or run.
2. **A HIGH-severity blocking finding is open on the prospective exercised transport dependency.**
   Anycorn — the prospective ASGI server for the AI-side HTTPS/mTLS listener — has no release that
   contains the upstream fix preserving hardened SSL options. Details in §4.

Execution stays unauthorized until both are closed by a separately reviewed admission update.

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

Acceptable unblock — either of:

1. an Anycorn release that contains `9eabf20e22bb2fe4987110bebf05eb822517f754`, **followed by**
   artifact and transitive lock review and an empirical ASGI TLS-extension probe; or
2. a separately audited internal patch proposal, approved **before** any installation.

Neither is performed by this packet. No Anycorn artifact is added, installed or pinned here.

Official sources:

- <https://pypi.org/pypi/anycorn/json>
- <https://github.com/davidbrochart/anycorn/commit/9eabf20e22bb2fe4987110bebf05eb822517f754>
- <https://asgi.readthedocs.io/en/latest/implementations.html>
- <https://asgi.readthedocs.io/en/latest/specs/tls.html>

## 5. Prospective network surfaces — no listener opened

| Prospective bind | Purpose |
|---|---|
| `127.0.0.1:58443` | AI-side HTTPS/mTLS ASGI listener for the prospective separate-process harness |
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

## 7. Promotion path

Promotion out of `HOLD` requires a separate, separately reviewed exact-bit update that at minimum:

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

After any admitted execution, its outcome must be recorded in a **new** result artifact. This
pre-run HOLD artifact cannot be reused as runtime-result evidence.
