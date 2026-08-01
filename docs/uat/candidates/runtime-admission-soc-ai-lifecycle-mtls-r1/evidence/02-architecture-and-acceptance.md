# Runtime Admission SOC→AI Lifecycle mTLS R1 — Architecture and Acceptance

Status: `DRAFT — NOT EXECUTED`

Recorded at `2026-07-31T17:29:11Z`.

This document describes what a *true* SOC→AI lifecycle mTLS runtime-admission candidate would have
to be. It is a design and an acceptance specification. **Nothing in it has been built, installed,
started or run**, and it authorizes nothing. Any UAT claim is additionally bound by
`cybrik-suite:docs/uat/UAT-GATE-STANDARD.md`; this document grants no UAT pass, demo, POC, RC or
release claim.

---

## 1. Pinned base tuple

| Repository | Commit | Tree |
|---|---|---|
| `cybrik-suite` | `fc413f288b40138e5d11e1ddae34e64ca007fc5f` | `1376da058c2fe83f6a2c0b110c72a74f4575f12b` |
| `cybrik-soc-command-center` | `abfdfde96afc6daa2868694de993c623daa8862e` | `241ef24a33246918ff5cf133e7d8d004823fdf06` |
| `cybrik-cyber-ai-platform` | `789614144686dab88500dd2bfecdd608ef0a8b8f` | `244140e3aacd783b1bea7542f9f56ffc46cedc86` |
| `cybrik-security-tool-fabric` | `49583be00235a0f8ad7da8cb4ea99108ad201a69` | `ca8b4a03116bea979de89b92b2f8fef4fd31e001` |

---

## 2. Current state of the pinned tuple — what actually exists

### 2.1 Suite

A golden SOSIM harness exists for the SOC→AI lifecycle create path:

- `cybrik-suite:tests/e2e/test_soc_ai_lifecycle_create.py`
- `cybrik-suite:tests/e2e/run-soc-ai-lifecycle-create.sh`
- `cybrik-suite:integration/fixtures/soc-ai-lifecycle-create-sosim.v1.json`
- `cybrik-suite:docs/operations/W1-SOC-AI-LIFECYCLE-GOLDEN-SOSIM-EVIDENCE.md`

**It is in-process.** It is not a UAT harness, not mTLS, and not a deployment. It exercises no
socket, no TLS handshake, no certificate chain, no separate process boundary and no durable store.
It is useful as a contract-shape and sequencing check, and it is not evidence for any of the
acceptance criteria in §4.

### 2.2 SOC (`cybrik-soc-command-center`)

The existing `LifecycleCreateClient` already accepts a **caller-owned** mTLS `httpx.AsyncClient` and
exposes a **create-only** issuer path.

Consequence: **no minimal SOC product change is required** for a Suite-owned separate-process
harness. The harness constructs and owns the TLS client; SOC is used as-is. This keeps the work
inside the Suite ownership boundary (integration harness) and avoids putting execution or transport
policy into a repository that does not own it.

### 2.3 Cyber AI (`cybrik-cyber-ai-platform`)

AI `main` now carries:

- a bounded, **opt-in** `AsgiTlsTransportResolver`; and
- PostgreSQL lifecycle runtime composition.

Two limits matter for admission:

1. the resolver remains **unwired by default**; and
2. **no bound ASGI TLS server and no deployment exist**.

So the AI side today can, in principle, resolve ASGI TLS-extension material if something wires it —
but nothing terminates a real TLS connection.

### 2.4 Tool Fabric (`cybrik-security-tool-fabric`)

Pinned for **suite tuple and governance completeness only**. The create-only SOC→AI path does not
technically exercise Tool Fabric. Its required checks are recorded because the admission record
requires every repository in the tuple to carry green required checks, not because the harness
touches it. `control-plane` and `detect` are deliberately **not** recorded as required; the
non-required `executor` job is recorded as skipped.

---

## 3. What a true candidate must be

A candidate that could honestly be considered for runtime admission must satisfy **all** of the
following. Each is a property of the harness, not an aspiration.

1. **Separate process.** SOC-side client and AI-side server run in distinct OS processes. No
   in-process ASGI transport shortcut, no shared interpreter state.
2. **Actual loopback TLS socket.** A real TLS handshake over a real bound socket on loopback.
   Prospective binds: `127.0.0.1:58443` (AI HTTPS/mTLS) and `127.0.0.1:55432` (PostgreSQL).
3. **Ephemeral dev-only PKI, generated outside the repository.** CA, server and client material is
   created per run in a temporary directory outside any repository working tree, is dev-only, is
   never committed, and is destroyed on teardown. No production or long-lived material.
4. **Synthetic data only.** Tenants, orgs, actors, cases and payloads are generated synthetic
   values. No customer data, no production logs, no sanitized-production shortcut.
5. **PostgreSQL durable replay.** Replay/idempotency state is persisted in PostgreSQL and the
   durability property is verified across a real round trip, not in memory.
6. **Token `cnf` bound to the client certificate thumbprint.** The delegation token's confirmation
   claim must match the presenting client certificate's thumbprint; a token presented over a
   different client certificate must be rejected.

Contract surface already present in the Suite that this exercises:

- `cybrik-suite:contracts/json-schema/cybrik.svc-delegation-request.v1.schema.json`
- `cybrik-suite:contracts/json-schema/cybrik.svc-delegation-token.v1.schema.json`
- `cybrik-suite:contracts/json-schema/cybrik.svc-trust-metadata.v1.schema.json`
- `cybrik-suite:contracts/json-schema/cybrik.svc-common-defs.v1.schema.json`
- `cybrik-suite:contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json`
- `cybrik-suite:contracts/adapters/cybrik-svc-lifecycle-delegation-mapping-notes.v1.md`
- `cybrik-suite:docs/releases/GATE-W2-F-LIFECYCLE-DELEGATION-ACCEPTANCE-2026-07-31.md`

---

## 4. Required negative tests

Every entry below must be written and must demonstrably fail closed before this candidate can leave
`HOLD`. All are currently `hold` — none is written, none has run.

| # | Negative test | Must demonstrate | Existing contract example |
|---|---|---|---|
| N1 | Replay | A previously accepted delegation request is rejected on replay, with the rejection durable in PostgreSQL | `contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.replay.json` |
| N2 | Certificate mismatch | A token whose `cnf` thumbprint does not match the presented client certificate is rejected | — |
| N3 | Wrong audience | A token minted for another audience is rejected | `…/svc-lifecycle-request.wrong-audience.json` |
| N4 | Wrong scope | A token lacking the required scope is rejected | `…/svc-lifecycle-request.scope-mismatch.json` |
| N5 | Wrong operation | A create-only token cannot drive a non-create operation | `…/svc-lifecycle-request.operation-mismatch.json` |
| N6 | Cross-tenant | A request for another tenant is rejected without leaking existence | `…/svc-lifecycle-request.tenant-mismatch.json` |
| N7 | Tenant-org advisory mismatch | An org advisory inconsistent with the tenant binding is rejected | `…/svc-lifecycle-request.org-mismatch.json` |
| N8 | No TLS extension | A connection presenting no ASGI TLS extension material fails closed; it must never degrade to an unauthenticated accept | — |
| N9 | Database unavailable | With PostgreSQL unavailable, the path fails closed rather than accepting without durable replay state | — |
| N10 | Secret leakage | No key, token, `cnf` value, DSN password or certificate private material appears in any log, error body, response header or evidence artifact | — |

N2, N8, N9 and N10 have no pre-existing contract example and must be authored as part of the
harness. N6–N7 satisfy the tenant-isolation smoke row; N1–N5 and N8–N9 satisfy the authorization
smoke row; N10 satisfies the secret-boundary smoke row.

---

## 5. Blocking upstream dependency finding — Anycorn

The prospective AI-side HTTPS/mTLS listener needs an ASGI server that both terminates mTLS and
supplies the ASGI TLS extension. Anycorn is the prospective choice, and it is currently blocked.

- Latest release `0.20.0`, PyPI upload `2026-07-28`.
- Wheel SHA-256 `43fcf5ade1b727f3a39b5bff0305012262be9b9993150dd312d626126382c8a1`.
- Sdist SHA-256 `e5555ddc95bc2df13908093ee11eff8f0a05165b9b9a368c28291065eab63927`.
- Release tag commit `f81a302a2cf3ea36093372e2f62283d945d47fe6`.
- Upstream fix commit `9eabf20e22bb2fe4987110bebf05eb822517f754` (`2026-07-29`) preserves hardened
  SSL options. **No release contains it.**

Therefore raw `0.20.0` is **NO-GO for production** and **HOLD for this UAT candidate**. This is a
HIGH-severity finding on the prospective exercised transport dependency, and it is a standing reason
execution remains unauthorized.

**Nothing is added, installed or pinned by this packet.** Acceptable unblock is either:

1. a release containing `9eabf20`, followed by artifact and transitive lock review plus an empirical
   TLS-extension probe; or
2. a separately audited internal patch proposal, approved before installation.

Official sources:

- <https://pypi.org/pypi/anycorn/json>
- <https://github.com/davidbrochart/anycorn/commit/9eabf20e22bb2fe4987110bebf05eb822517f754>
- <https://asgi.readthedocs.io/en/latest/implementations.html>
- <https://asgi.readthedocs.io/en/latest/specs/tls.html>

---

## 6. Two-phase admission and evidence closure

**A1–A7 are evidence-closure criteria, not preauthorization criteria.** Requiring their empirical
runtime results before authorizing the only run that can produce them would be circular.

- **Phase A — preflight admission:** after the artifact/lock/patch/SBOM/VEX review, authored but
  unexecuted separate-process harness and N1–N10 tests, exact lifecycle procedures, refreshed green
  required checks and independent preflight `GO` are pinned, a future exact-bit update may set
  `execution_authorized=true` for exactly one `not_run` local-only attempt. The candidate remains
  `HOLD`; open findings and unexecuted smoke rows remain truthful.
- **Phase B — bounded execution and evidence closure:** the one admitted attempt produces A1–A4
  empirical evidence. Immediately afterward, authorization returns to `false`, status becomes
  `passed` or `failed`, and exact counts and evidence are recorded. A failed attempt is `NO-GO`; a
  passed attempt remains `HOLD` under the current validator and proceeds to the separate UAT gate.

This document accepts the sequence only. The current committed candidate remains unauthorized,
`not_run`, at zero counts and `HOLD`; no dependency, process, listener, database, migration, secret
or runtime action is authorized here.

---

## 7. Acceptance criteria for evidence closure

All of the following must hold simultaneously, evidenced, at an exact re-pinned tuple:

- **A1** — Anycorn finding closed by §5 unblock (1) or (2), with artifact digests, transitive lock
  review and an empirical ASGI TLS-extension probe result recorded.
- **A2** — All six §3 properties implemented and evidenced: separate process, real loopback TLS
  socket, ephemeral out-of-repo dev PKI, synthetic data, PostgreSQL durable replay, `cnf`-to-client
  certificate thumbprint binding.
- **A3** — All ten §4 negative tests authored and failing closed, with output captured.
- **A4** — Negative-smoke rows in the runtime-admission record replaced with truthful executed
  results; no row left at `hold`.
- **A5** — Hosted required checks re-pinned and green on all four repositories at the new tuple.
- **A6** — An independent `GO` review artifact, distinct from this document, pinned by
  repository-relative path and SHA-256.
- **A7** — The runtime-admission validator passes with the candidate deriving the intended
  disposition.

Phase A admits the one bounded non-production execution only after its independent preflight gate.
Satisfying A1–A7 after that execution closes the runtime evidence and admits the passed result to
the separate `cybrik-suite:docs/uat/UAT-GATE-STANDARD.md` process. It does not confer
`DEMO_READY_LOCAL`, a UAT pass, POC readiness, RC readiness, GA, public release or any production
posture. Each remains a separate gate with its own evidence.

---

## 8. Non-authorizing historical prerequisite

`runtime-admission-ai-pg-r3` is pinned by record and evidence SHA-256 as a
`historical_prerequisite` only. It supplies context on bounded local PostgreSQL runtime handling.
**It grants no execution authority and does not reopen the terminal R1, R2 and R3 results**, which
remain immutable `NO-GO` under the `cybrik.ai.durable-postgres` / `bounded-postgres-runtime-v1`
objective. This candidate is a distinct objective and creates no PostgreSQL retry.

---

## 9. Scope boundary of this packet

This candidate packet writes exactly this document, `01-hold-status.md`, the candidate
`runtime-admission.json`, one registry paragraph in `docs/uat/candidates/README.md`, and the
committed-candidate test title, registry-size pin and disposition assertion in
`tools/contract-validation/tests/validate-runtime-admission.test.mjs`.

The prerequisite validator semantics and Suite-local reference containment were reviewed and
merged separately in Suite PR `#29`; they are not modified by this packet. The A0 amendment adds
only the accepted two-phase sequencing language, one fail-closed validator test and the matching
machine-readable process flag. It authorizes no dependency install, formatter run, socket open,
stack or container start, database start, migration, or secret handling.
