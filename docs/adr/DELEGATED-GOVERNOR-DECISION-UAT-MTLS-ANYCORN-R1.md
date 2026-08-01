# Delegated Governor decision record — SOC→AI lifecycle mTLS UAT server candidate R1

- **Task ID:** `UAT-MTLS-AI-SERVER-UNBLOCK-R1`
- **Task-ID boundary:** this is a coordinator-delegated decision label, not a new identity in the
  fixed 48-task roster.
- **Status:** `D1 DEPENDENCY ARTIFACT COMPLETE — RUNTIME AUTHORED NOT RUN — D2 HOLD`
- **S1 R2 clarification (historical pre-D1):** `ACCEPTED BY DELEGATED GOVERNOR — D1 STILL HOLD PENDING FOUNDER`
- **S1 R3 endpoint correction (historical pre-D1):** `ACCEPTED BY DELEGATED GOVERNOR — D1 STILL HOLD PENDING FOUNDER`
- **Date:** 2026-08-01
- **Canonical base:** `cybrik-suite@0766f31ca7ec283755c5ace5bc94f9df7cd05f1c`
- **Ownership cell:** Suite Integration/Release; Cyber AI Runtime/Safety is a read-only consumer
- **Release impact:** none. Stable-v1 dates and Founder-controlled production/public-GA gates are unchanged.

## 1. Outcome

The recommended candidate for the fastest safe path to the first separate-process SOC→Cyber AI
lifecycle mTLS UAT is a **Suite-owned, local-only integration harness** using candidate option B1:
an internal UAT-only `anycorn==0.20.0+cybrik.1` wheel reproducibly built from the official
`0.20.0` sdist after applying one audited two-hunk patch: the upstream-equivalent `9eabf20`
behavioral fix and the local-version metadata change.
The raw official `0.20.0` wheel remains unselected, uninstalled, unpinned and `HOLD`.

This record originated as the candidate-specific compensating-control design and RED→GREEN task
packet. A0, K5 and S1 subsequently accepted the sequencing, metadata-control amendment and bounded
evaluation admission; the exact D1 action then produced the isolated dependency artifact and its
evidence. It still authorizes no D2 runtime, product/server selection, POC, RC, stable-v1, GA or
production action. W2-K remains server-neutral and keeps the official upstream Anycorn `0.20.0`
distributions unselected, uninstalled, unpinned and on `HOLD`. The distinct B1 artifact remains
confined to `suite_uat_tool_lock_only` and product `selected=false`:

- `docs/releases/GATE-W2-K-TRANSPORT-PEER-EVIDENCE-ACCEPTANCE-2026-08-01.md`;
- `docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md`;
- `docs/architecture/transport-peer-evidence/01-server-candidate-matrix.md`.

The completed D1 action remains bounded and does **not**:

- add the raw official Anycorn distribution to the solver, lock or installed environment, or select
  B1 as a product server;
- authorize any socket, PostgreSQL process, migration, certificate generation or runtime attempt;
- change a product repository, product dependency or product lockfile;
- select Anycorn for production, POC, RC, stable v1 or GA;
- accept the open High finding on the raw upstream SSL-context builder.

This record is registered in `docs/adr/README.md` after the separately reviewed acceptance and D1
artifact sequence. That catalogue entry records only the current D1 live facts; it widens no wire,
runtime, release or production authority.

It also confers no UAT pass under `docs/uat/UAT-GATE-STANDARD.md` and no
`DEMO_READY_LOCAL` status.

The existing runtime-admission candidate remains `HOLD`, `execution_authorized=false`,
`status=not_run`, with zero attempts.

## 2. Product outcome and integration consumer

The intended consumer is the accepted create-only SOC→Cyber AI lifecycle seam:

1. a Suite-owned AI-server process exposes exact clean Cyber AI source roots through a bounded
   `PYTHONPATH`, without installing or resolving either unpublished product package into the UAT
   tool lock, and composes `compose_lifecycle_runtime(...)` with
   `AsgiTlsTransportResolver`, pinned synthetic trust, the real signature verifier, the existing
   investigation service and PostgreSQL-backed replay/checkpoint persistence;
2. the audited internal Anycorn artifact terminates a real loopback mTLS connection and publishes
   the standard server-owned ASGI TLS extension;
3. a separate SOC-client process uses the exact clean SOC `LifecycleCreateClient` with a
   caller-owned `httpx.AsyncClient` configured for mTLS;
4. the token `cnf["x5t#S256"]` equals the SHA-256 thumbprint derived from the client certificate
   presented on that connection;
5. all ten accepted negative cases fail closed and durable replay is proven in PostgreSQL.

This is a proposed integration harness, not product source. It follows the existing Suite SOSIM
source-root composition pattern in `tests/e2e/run-soc-ai-lifecycle-create.sh` and
`tests/e2e/test_soc_ai_lifecycle_create.py`. SOC, Cyber AI and Fabric product bytes and locks remain
unchanged for this R1 path.

## 3. Exact live facts

### 3.1 Canonical product tuple

| Repository | Canonical main | Hosted CI |
|---|---|---|
| `cybrik-suite` | `0766f31ca7ec283755c5ace5bc94f9df7cd05f1c` | contracts run `30687260708` success |
| `cybrik-soc-command-center` | `abfdfde96afc6daa2868694de993c623daa8862e` | CI run `30641710439` success |
| `cybrik-cyber-ai-platform` | `789614144686dab88500dd2bfecdd608ef0a8b8f` | CI run `30650670701` success |
| `cybrik-security-tool-fabric` | `49583be00235a0f8ad7da8cb4ea99108ad201a69` | CI run `30591694272` success |

Fabric is tuple/governance evidence only and is not exercised by the create-only path.

### 3.2 Anycorn source and artifact facts

- Latest PyPI release observed on 2026-08-01: `0.20.0`, uploaded 2026-07-28.
- Tag commit: `f81a302a2cf3ea36093372e2f62283d945d47fe6`.
- Official wheel SHA-256:
  `43fcf5ade1b727f3a39b5bff0305012262be9b9993150dd312d626126382c8a1`.
- Official sdist SHA-256:
  `e5555ddc95bc2df13908093ee11eff8f0a05165b9b9a368c28291065eab63927`.
- License classifier and supplied license text: MIT.
- The release is classified Beta and declares Python `>=3.10`.
- Upstream fix commit `9eabf20e22bb2fe4987110bebf05eb822517f754` is not in a release.
- Raw `0.20.0` assigns `context.options = OP_NO_COMPRESSION` inside
  `Config.create_ssl_context()`, replacing hardened default flags. The upstream fix changes that
  assignment to `|=`.

Authoritative sources:

- <https://pypi.org/pypi/anycorn/0.20.0/json>
- <https://github.com/davidbrochart/anycorn/tree/f81a302a2cf3ea36093372e2f62283d945d47fe6>
- <https://github.com/davidbrochart/anycorn/compare/f81a302a2cf3ea36093372e2f62283d945d47fe6...9eabf20e22bb2fe4987110bebf05eb822517f754>
- <https://github.com/davidbrochart/anycorn/commit/9eabf20e22bb2fe4987110bebf05eb822517f754>
- <https://asgi.readthedocs.io/en/latest/specs/tls.html>

### 3.3 Corrected server-compatibility facts

Direct inspection of these exact tagged upstream symbols supports the candidate hypothesis:

- `davidbrochart/anycorn@f81a302a2cf3ea36093372e2f62283d945d47fe6:src/anycorn/utils.py::tls_version_to_int`
  maps TLS version strings to integer wire codes;
- `davidbrochart/anycorn@f81a302a2cf3ea36093372e2f62283d945d47fe6:src/anycorn/utils.py::TLS_CIPHER_NAME_TO_CODE`
  maps negotiated cipher names to IANA integer codes;
- `davidbrochart/anycorn@f81a302a2cf3ea36093372e2f62283d945d47fe6:src/anycorn/utils.py::_extract_client_chain`
  falls back on Python 3.12 to one PEM-encoded leaf certificate;
- `davidbrochart/anycorn@f81a302a2cf3ea36093372e2f62283d945d47fe6:src/anycorn/utils.py::build_tls_extension`
  builds the ASGI TLS extension from the accepted server-side connection;
- `davidbrochart/anycorn@f81a302a2cf3ea36093372e2f62283d945d47fe6:src/anycorn/run.py::worker_serve`
  dynamically invokes `config.create_ssl_context()`;
- `davidbrochart/anycorn@f81a302a2cf3ea36093372e2f62283d945d47fe6:src/anycorn/config.py::Config.create_ssl_context`
  contains the released SSL-options defect that option B1 is intended to patch exactly once.

The current product seams used by the proposed harness are:

- `cybrik-cyber-ai-platform@789614144686dab88500dd2bfecdd608ef0a8b8f:services/ai-api/src/cybrik_ai_api/transport_security.py::AsgiTlsTransportResolver`;
- `cybrik-cyber-ai-platform@789614144686dab88500dd2bfecdd608ef0a8b8f:services/ai-api/src/cybrik_ai_api/runtime_composition.py::compose_lifecycle_runtime`;
- `cybrik-soc-command-center@abfdfde96afc6daa2868694de993c623daa8862e:services/api/src/cybrik_soc/modules/copilot/lifecycle_create.py::LifecycleCreateClient`;
- `cybrik-suite@0766f31ca7ec283755c5ace5bc94f9df7cd05f1c:tests/e2e/run-soc-ai-lifecycle-create.sh`
  and
  `cybrik-suite@0766f31ca7ec283755c5ace5bc94f9df7cd05f1c:tests/e2e/test_soc_ai_lifecycle_create.py`
  for exact-source-root composition.

These are source-inspection facts, not runtime proof. The option remains `HOLD` until a real
listener demonstrates the complete serve path and emitted extension.

These facts supersede the earlier review hypotheses that numeric TLS fields or a product-level
entrypoint were necessarily absent.

## 4. Options and disposition

| Option | Disposition | Reason |
|---|---|---|
| A — VCS dependency at `9eabf20` | `REJECT FOR R1` | Four unreleased commits beyond the tag; weak wheel/hash/offline story; unnecessary product-lock churn. |
| B1 — internal UAT-only `0.20.0+cybrik.1` wheel from official sdist plus one audited two-hunk patch | `RECOMMENDED CANDIDATE — HOLD` | Fits accepted A1 unblock (2); the only behavior change is the upstream-equivalent SSL fix and the second hunk changes version metadata only. |
| C — wait for an official fixed release | `VALID FALLBACK` | Best production candidate if available, but elapsed time is outside CYBRIK control and must not block dependency-ready UAT preparation. |
| D — official `0.20.0` wheel plus Suite-owned subclass override | `REJECT FOR R1` | Falls outside accepted A1's closed unblock set and creates avoidable acceptance-governance churn. |

Option B1 does not declare the raw release safe. The patch must be byte-pinned, source-reviewed and
prove one behavioral `=` to `|=` hunk equivalent to upstream plus one metadata-only local-version
hunk before build; the produced local-version
wheel must be reproducible and independently audited. The High finding may be marked
`MITIGATED FOR THIS EXACT UAT ARTIFACT` only after the real D2 serve-path probe. Any patch, build or
probe mismatch returns the candidate to `HOLD` and falls back to option C; it never converts into
risk acceptance. No CYBRIK-supported production package follows from B1.

This comparison is not a W2-K decision and does not reopen W2-K. The existing W2-K matrix remains
a factual, non-recommending inventory of raw candidates; B1 is a distinct proposed internal
artifact and is not yet a matrix row. Evaluation admission remains
`HOLD-SEPARATE-UAT-S1-GATE`; no option may progress to dependency resolution from this proposal
alone.

## 5. Trust and security boundaries

The implementation must preserve all of the following:

1. Listener binds only to `127.0.0.1`; no wildcard, IPv6 wildcard, public or container-published
   bind is accepted.
2. The first admitted UAT profile sets
   `SSLContext.minimum_version = ssl.TLSVersion.TLSv1_3` and rejects a negotiated version other
   than ASGI integer code `0x0304`.
3. `verify_mode` is exactly `ssl.CERT_REQUIRED`.
4. Server trust uses an ephemeral dev-only CA; server and client certificates are generated
   outside every repository and destroyed on teardown.
5. The patched `Config.create_ssl_context()` must preserve every security option enabled by a
   fresh secure stdlib context. Static provenance must prove that the patch contains only the
   upstream `context.options = OP_NO_COMPRESSION` to `|=` behavioral hunk and the local-version
   metadata hunk; the real serve-path test must prove that the patched builder is executed.
6. The ASGI TLS extension is built only from the server-owned accepted connection. No request
   header, query, body or forwarded-certificate value contributes.
7. Audience and trust domain are fixed by the relying-party composition, never certificate or
   request input.
8. The presented leaf thumbprint, token `cnf` and observed relying-party thumbprint must be equal.
9. PostgreSQL replay state is mandatory; persistence failure must fail closed without an
   in-memory fallback.
10. Logs, responses and evidence contain no raw token, private key, certificate private material,
    DSN password or full `cnf` value.

## 6. Prospective owner paths split by gate

This proposal itself changes only
`docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md`. It grants no writer authority. If the
proposal is accepted, each implementation gate must use a new exact-base, exact-path task packet;
the finite lists below are the maximum prospective scope and may be narrowed, never implicitly
widened.

### 6.1 Pre-D1 dependency-neutral preparation

Only the following paths may be proposed before candidate-evaluation admission or dependency
installation:

- `integration/compose/README.md`
- `integration/compose/soc-ai-lifecycle-create-mtls/README.md`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/__init__.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/policy.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/evidence.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/procedure.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_evidence.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_procedure.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_case_inventory.py`

These files must import no Anycorn module, resolve or install no package, open no socket, start no
process and mutate no runtime-admission field. The shell runner is intentionally excluded until
the executable dependency path is authorized. `integration/compose/README.md` must replace its
`intentionally empty` claim with a truthful dependency-neutral-preparation status in the same
commit. Tests execute without installing a package by setting only the bounded source root for the
command, for example:

```sh
PYTHONPATH=integration/compose/soc-ai-lifecycle-create-mtls/src \
  python3 -m pytest \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_evidence.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_procedure.py \
    integration/compose/soc-ai-lifecycle-create-mtls/tests/test_case_inventory.py
```

### 6.2 D1 preparation and separately gated K5 control carriers

The dependency, harness, evidence, runner and runtime-candidate paths in the first group below are
the maximum D1 write scope. All are D1-only except the three existing S1 R2 preparation paths
explicitly reopened below. No D1 writer may touch any of them until the admission-sequencing
clarification is accepted, S1 admits option B1 for bounded evaluation, and the Founder grants
dependency installation/build authority:

- `integration/compose/soc-ai-lifecycle-create-mtls/pyproject.toml`
- `integration/compose/soc-ai-lifecycle-create-mtls/uv.lock`
- `integration/compose/soc-ai-lifecycle-create-mtls/patches/anycorn-0.20.0+cybrik.1.patch`
- `integration/compose/soc-ai-lifecycle-create-mtls/scripts/build_anycorn_patch.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/server.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/client.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_anycorn_patch_provenance.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_reproducible_wheel.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_patched_ssl_context.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_real_tls_extension.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/README.md`
- `integration/compose/README.md`
- `tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh`
- `integration/compose/soc-ai-lifecycle-create-mtls/evidence/dependency-lock.json`
- `integration/compose/soc-ai-lifecycle-create-mtls/evidence/patch-provenance.json`
- `integration/compose/soc-ai-lifecycle-create-mtls/evidence/internal-wheel.json`
- `integration/compose/soc-ai-lifecycle-create-mtls/evidence/licenses.json`
- `integration/compose/soc-ai-lifecycle-create-mtls/evidence/sbom.cdx.json`
- `integration/compose/soc-ai-lifecycle-create-mtls/evidence/vex.cdx.json`
- `integration/compose/soc-ai-lifecycle-create-mtls/evidence/offline-reinstall.json`
- `docs/uat/candidates/README.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/01-hold-status.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/02-architecture-and-acceptance.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json`

S1 R2 expands the D1 maximum prospective allowlist by exactly these three existing paths and no others:

- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/README.md`
- `integration/compose/README.md`

`test_policy.py` must separate the dependency-neutral modules from the D1 runtime modules; that
split removes no fail-closed purity, inventory or import coverage. Both README files must replace
their dependency-neutral-only claims with truthful authored/not-run D1 status in the same packet.
These three remain valid pre-D1 §6.1 preparation paths; R2 only reopens them for later D1 edits and
does not retroactively classify their already-accepted dependency-neutral bytes as D1 work.

The following eight W2-K metadata/control carriers are **not** D1-only. K5 may amend them under its
separate exact-path review while every installation field remains false. D1 may touch them later
only to flip B1 `installed` and `pinned` atomically after the exact artifact exists:

- `contracts/compatibility/cybrik-suite-transport-peer-evidence-packet.v1.manifest.json`
- `contracts/README.md`
- `contracts/compatibility/README.md`
- `docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md`
- `docs/adr/DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md`
- `docs/architecture/transport-peer-evidence/01-server-candidate-matrix.md`
- `docs/releases/GATE-W2-K-TRANSPORT-PEER-EVIDENCE-ACCEPTANCE-2026-08-01.md`
- `tools/contract-validation/tests/validate-transport-peer.test.mjs`

The dedicated UAT lock covers third-party harness dependencies only. The unpublished SOC and Cyber
AI packages are not installed, editable-installed or resolved into it; the runner imports their
exact clean checkout source roots through `PYTHONPATH`, matching the existing SOSIM pattern.
The official raw Anycorn wheel is never installed or pinned. The dedicated lock contains a
registry-only third-party closure with exact artifact hashes; `anycorn` is absent from the solver
and `uv.lock`. The internally versioned, patch-provenance-bound B1 wheel is pinned separately by
exact SHA-256 in `evidence/internal-wheel.json` and installed offline with `--no-deps` only after a
fail-closed SHA-256 check. No raw Anycorn distribution may enter the solver, `uv.lock` or the
installed environment; the official `0.20.0` sdist is fetched only as hashed build input under the
exact artifact endpoint enumerated in Gate UAT-MTLS-D1 and is never installed. D1 may execute patch
provenance, reproducibility, SSL-context, lock, audit, SBOM and offline-reinstall tests. Those
commands may use only the exact outbound and child-process authority enumerated under Gate
UAT-MTLS-D1; they may open no listener, start no ASGI/database server and make no product-runtime
connection. D1 may author but not execute the real-listener/PostgreSQL targets.
The four status carriers listed above must be updated atomically to say `authored/not run` and
retain `HOLD`, `execution_authorized=false`, zero runtime checks and truthful evidence digests.

Committed-byte provenance tests must never import `anycorn`. Artifact-dependent targets require a
bounded `CYBRIK_UAT_D1_ARTIFACT_DIR` when invoked and fail closed when it is absent. They are
explicit D1 targets outside the dependency-neutral clean-checkout target, not `skip`, `xfail` or
`todo`; the committed clean-checkout suite remains green without an ephemeral artifact.
The dependency-neutral command must name its four existing test files explicitly rather than
discovering the whole `tests/` directory. D1 artifact commands likewise name only their explicit
artifact targets after setting `CYBRIK_UAT_D1_ARTIFACT_DIR`; collection-time imports may not turn an
unselected test into a missing-dependency failure.

The eight W2-K R5 status/control paths must reconcile present-time facts atomically without
changing any wire schema, fixture or packet-member digest. R5 adds an explicit amendment to the
delegated decision and a post-acceptance live-fact addendum to the gate record. The raw candidate
remains in the existing manifest `server_candidates` array and keeps `id=anycorn`,
`version_considered=0.20.0`, artifact scope
`official_upstream_distribution`, unselected/uninstalled/unpinned and `HOLD`. The distinct B1 row
is added to that same `server_candidates` array and must use `id=anycorn-cybrik-uat-b1`,
`version_considered=0.20.0+cybrik.1`, artifact scope
`internal_uat_evaluation_artifact`, `installed_scope=suite_uat_tool_lock_only`,
`uat_evaluation_admitted=true`, `installed=false`, `pinned=false`, product `selected=false` and
`HOLD`. D1 alone may flip `installed` and `pinned` atomically after the exact B1 artifact exists.
`server_neutral=true` and
`selected_server=null` remain exact because no CYBRIK product server is selected. The W2-K test
must fail closed on duplicate IDs, missing scope qualifiers, or conflating B1 evaluation with a
product/server selection. R5 requires independent review before K5 application; D1 later changes
only the B1 install/pin facts atomically after the exact artifact exists.
Every amended carrier must state that unqualified `Anycorn 0.20.0` refers only to
`id=anycorn`/`artifact_scope=official_upstream_distribution`; PEP 440 public-version equivalence
must never collapse it with `id=anycorn-cybrik-uat-b1`.

R5 intentionally re-scopes, but must not delete or weaken, the current universal
`installed=false`/`pinned=false` assertion. The test must continue to require those values for
**every** `artifact_scope=official_upstream_distribution` row, including raw Anycorn, Hypercorn and
Granian, and add a complementary fail-closed assertion that an internal UAT row is permitted only
when its ID is `anycorn-cybrik-uat-b1`, its `installed_scope` is
`suite_uat_tool_lock_only`, it remains `installed=false` and `pinned=false` before D1, remains
product `selected=false`, and carries no authority outside that exact lock. D1 must change both
installation fields atomically or neither. K5 discloses this control re-scope explicitly; deleting the
raw-candidate loop or losing Hypercorn/Granian coverage fails review and validation.

### 6.3 D2-only runtime evidence

D1 may change the four status carriers listed in §6.2 only to record authored/not-run state and
fresh digests; it may not authorize execution or record runtime outcomes. After independent review
and a separate D2 authorization, a finite packet may propose only these existing/new evidence
carriers:

- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json`
- `docs/uat/candidates/README.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/01-hold-status.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/02-architecture-and-acceptance.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/03-independent-runtime-review.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/04-runtime-authorization.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/05-runtime-result.md`
- `tools/contract-validation/tests/validate-runtime-admission.test.mjs`
- `integration/compose/soc-ai-lifecycle-create-mtls/evidence/vex.cdx.json`

Only the D2 admission integrator may change `execution_authorized`, and only after the independent
GO artifact is pinned by path and SHA-256. The same integrator must update the committed test title
and only the assertions whose truth changes in the listed validator test, preserving the candidate
count if no new `runtime-admission.json` is added, so the control suite remains truthful.
No product-repository path, root Suite dependency, cross-product contract, accepted schema/fixture,
release manifest or GitHub workflow is in scope.

## 7. TDD sequence

### 7.1 RED checkpoint

Write and execute tests before implementation. A valid RED must reach the intended missing
harness or missing hardened-config behavior; `ModuleNotFoundError` caused only by an uninstalled
dependency is not valid RED evidence.

Before dependency installation, the allowed RED preparation is dependency-neutral:

- static policy test rejects a non-loopback bind;
- static policy test rejects an implementation that calls the Anycorn base SSL builder;
- lifecycle procedure test requires start/stop/reset/seed/rollback commands to remain paired;
- evidence sanitizer test rejects secret-bearing output patterns;
- N1–N10 inventory test requires every case exactly once and forbids `skip`, `xfail`, `todo` and
  unexecuted-success states.

D1 adds and executes a second no-socket RED checkpoint before building B1: the provenance test must
fail because the audited patch/internal wheel is absent. D1 then makes that same target GREEN by
proving the official sdist hash, exact two-hunk patch, local version, reproducible wheel hash,
preserved SSL option bits and isolated lock. Reproducibility means two clean-directory builds with
the exact pinned CPython full version/executable digest, platform/ABI tag, frontend/backend
versions and artifact hashes, `SOURCE_DATE_EPOCH=315532800`, `TZ=UTC`, `LC_ALL=C` and
`PYTHONHASHSEED=0`, plus `umask 022`, produce byte-identical wheels. The two builds must use two
distinct absolute build directories; a same-path rebuild does not satisfy reproducibility. This
checkpoint opens no listener or database.

Only after separate D2 authorization may the runtime RED checkpoint execute the real patched
Anycorn `serve()` path. Its intended RED is the absent/incomplete separate-process harness or
server-owned TLS evidence behavior, never a missing dependency or unauthorized runtime setup.

### 7.2 GREEN checkpoint

Minimal implementation must make the same real-path test pass while proving:

- the real server imports the exact internally built B1 wheel and its patched
  `Config.create_ssl_context()`;
- patch provenance and installed-module digest match the D1 evidence exactly;
- hardened option bits survive; `minimum_version` is exactly `ssl.TLSVersion.TLSv1_3` and
  `verify_mode` is exactly `ssl.CERT_REQUIRED`;
- real loopback mTLS produces `tls_version == 0x0304`, an integer `cipher_suite`, one PEM leaf and
  no client-certificate error;
- the Cyber AI resolver derives the expected RFC 8705 thumbprint;
- SOC create succeeds once and the exact replay is rejected durably;
- N1–N10 all pass fail-closed.

### 7.3 Refactor and coverage

No refactor precedes GREEN. The new harness package must reach at least 80% line and branch
coverage, with 100% coverage of the SSL-context builder, bind validation, evidence sanitizer and
teardown paths.

## 8. Required N1–N10 runtime cases

| ID | Required live outcome |
|---|---|
| N1 | Replayed delegation is rejected with replay state surviving in PostgreSQL. |
| N2 | Token `cnf` mismatch against the presented client certificate is rejected. |
| N3 | Wrong audience is rejected. |
| N4 | Wrong scope is rejected. |
| N5 | Wrong operation on the create-only token is rejected. |
| N6 | Cross-tenant request is rejected without existence leakage. |
| N7 | Tenant/org advisory mismatch is rejected. |
| N8 | Missing server-owned ASGI TLS extension fails closed; no unauthenticated fallback. |
| N9 | PostgreSQL unavailable fails closed; no process-local replay fallback. |
| N10 | No secret or private material appears in logs, responses, headers or evidence. |

## 9. Supply-chain and offline gates

Before any runtime attempt, the prospective UAT tool must have:

- a dedicated lock generated for Python 3.12 with exact artifact hashes;
- official Anycorn `0.20.0` sdist hash, exact two-hunk patch hash, reproducible internal
  `0.20.0+cybrik.1` wheel hash, and wheel-only resolution for the transitive closure;
- exact build provenance pinning the CPython full version/executable digest, platform/ABI tag,
  build frontend/backend versions and hashes, deterministic environment and two-build equality;
- MIT license evidence and transitive license inventory;
- CycloneDX SBOM for the exact environment;
- vulnerability scan, recording each finding's severity, and a narrow VEX entry using the internal vulnerability identifier
  `CYBRIK-UAT-ANYCORN-SSL-OPTIONS-2026-08-01`: D1 records the exact B1 build with CycloneDX
  `analysis.state=in_triage`; only a successful D2 patched-builder/serve-path proof may update that
  exact build to `analysis.state=resolved_with_pedigree`,
  `analysis.justification=code_not_present`, with patch/wheel/probe digests in `analysis.detail`;
  raw Anycorn remains affected/HOLD;
- offline wheelhouse creation and hash-verified offline reinstall proof;
- rollback that removes only the ephemeral `dist/` artifact and isolated UAT environment,
  wheelhouse, cache and clean build workspaces while leaving all product locks/bytes unchanged.

CycloneDX SBOM and VEX documents are validated against their own schemas. Only bounded digests and
summaries enter the custom evidence sanitizer; D1 must not weaken that sanitizer to admit a full
SBOM or VEX tree. The wheelhouse, cache and clean build workspaces remain outside the repository;
only the exact B1 wheel may occupy the ephemeral gitignored `dist/` directory during D1. The
offline reinstall proof is scoped to the exact recorded platform and ABI.

If any transitive dependency has an open Critical/High on the exercised path, the candidate stays
`HOLD`. No risk is accepted by this record.

## 10. Execution and evidence gates

### Gate UAT-MTLS-A0 — non-circular admission sequencing clarification

Current state: `ACCEPTED — TWO-PHASE SEQUENCE — CURRENT ATTEMPT UNAUTHORIZED`.

Suite main commit `76eea6a988251f3c5faf19169154e7bf0f4d7cc4` accepts the A0 process sequence.
The committed runtime candidate remains `execution_authorized=false`, `not_run`, at zero counts,
one open High, ten held smoke rows and overall `HOLD`; A0 itself grants no runtime authority.

The accepted prose currently describes A1–A7 as conditions for a bounded execution even though A1,
A2, A3 and A4 require outputs from that execution. A0 must make the two phases explicit without
weakening any criterion:

1. a preflight admission may set `execution_authorized=true` for exactly one `not_run` attempt
   while the candidate truthfully remains `HOLD`, the raw-Anycorn High remains open and runtime
   smoke rows remain `hold`;
2. the D2 run produces the empirical A1–A4 outputs; after the run, authorization becomes false,
   the attempt becomes `passed` or `failed`, and A1–A7 determine the truthful terminal evidence.

The maximum A0 scope is exactly these four existing paths. The runtime carrier must re-pin changed
evidence digests while remaining `HOLD`, `not_run` and `execution_authorized=false`; the test must
prove both phases are structurally fail-closed:

- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/01-hold-status.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/02-architecture-and-acceptance.md`
- `docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json`
- `tools/contract-validation/tests/validate-runtime-admission.test.mjs`

### Gate UAT-MTLS-K5 — W2-K live-fact metadata/control amendment

Current state: `ACCEPTED AND IMPLEMENTED BY D1 ARTIFACT ONLY — NO RUNTIME`.

K5 authorizes only the eight W2-K paths in §6.2 to distinguish the official upstream candidate
from the scoped internal B1 evaluation artifact. It preserves every wire schema, fixture,
packet-member digest, `server_neutral=true`, `selected_server=null`, the raw-release High finding
and product/server non-selection. K5 is accepted before S1. B1 lands at `installed=false` and
`pinned=false`; D1 alone may flip both atomically after the isolated artifact exists.

### Gate UAT-MTLS-S1 — patched-candidate evaluation admission

Current state: `ACCEPTED — B1 BOUNDED EVALUATION ARTIFACT IMPLEMENTED — RUNTIME NOT RUN`.

S1 is bounded to exactly five decision/registration/control paths:

1. `docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md`
2. `docs/adr/README.md`
3. `tools/contract-validation/tests/validate-transport.test.mjs`
4. `docs/releases/GATE-UAT-MTLS-K5-S1-ACCEPTANCE-2026-08-01.md`
5. `docs/releases/README.md`

S1 is distinct from W2-K and does not itself edit its carriers. After K5 is accepted, S1 may admit
B1 only for bounded isolated UAT evaluation; it does not select a CYBRIK product, POC, RC,
stable-v1, GA or production server. Raw official Anycorn `0.20.0` remains the unselected,
uninstalled, unpinned and HOLD W2-K matrix row. Hypercorn and Granian remain unassessed.

S1 records only evaluation admission: B1 remains `installed=false`, `pinned=false`, product
`selected=false` and `HOLD`. At S1 acceptance, D1 remained **HOLD** and D2 remained **HOLD**. The
D1 live-fact record below supersedes the pre-D1 dependency-installation HOLD and B1 install/pin
facts only. Current B1 live facts: `installed=true`, `pinned=true`, product `selected=false`,
`installed_scope=suite_uat_tool_lock_only`, and `HOLD`. The packet preserves
`selected_server=null`; UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO.

### Gate UAT-MTLS-D1 — dependency installation

Current state: `AUTHORIZED — D1 DEPENDENCY ARTIFACT COMPLETE — RUNTIME NOT RUN`.

On 2026-08-01, Founder-delegated Codex Governor operating authority explicitly covered routine
dependency installation, local build/UAT preparation, repository commits, push, merge and internal
release while retaining production and public GA control with the Founder. Under that authority,
Codex admitted and completed only the closed D1 dependency/build/evidence scope below. This record
does not widen the reviewed paths or endpoints, does not authorize D2, and does not claim UAT,
demo, POC, RC, stable-v1, GA or production readiness. The exact authority chain and consumed action
are recorded in
`docs/operations/DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md` Appendix B.
D2 remains **HOLD**.

The granted and exercised authority was bounded to resolving/installing the dedicated
Suite-owned UAT tool environment, creating its lock/wheelhouse/SBOM/license/VEX evidence and
running dependency-only tests.

R2 opened the endpoint categories; S1 R3 corrects the OSV path and makes the
wheelhouse purpose explicit. The exercised authority used only this closed D1 HTTPS set:

- `https://pypi.org/pypi/anycorn/0.20.0/json` for release metadata;
- the one exact `files.pythonhosted.org` sdist URL returned for `0.20.0`, accepted only when its
  SHA-256 equals `e5555ddc95bc2df13908093ee11eff8f0a05165b9b9a368c28291065eab63927`;
- `https://api.osv.dev/v1/query` for the per-package advisory-database query; and
- `https://pypi.org/simple` plus only the exact hash-pinned `files.pythonhosted.org` wheels needed
  to populate the registry-only UAT transitive-closure wheelhouse and the isolated
  SBOM/license/audit tooling environment outside the UAT lock.

S1 R3 replaces the batch endpoint because it returns only vulnerability identifiers and modified
timestamps, which cannot evaluate D1's Critical/High HOLD rule. The isolated tooling environment
must use an exact-hash tooling closure containing `pip-audit==2.10.1`. In its separate
`tooling-requirements.txt`, every tooling requirement is `==` pinned with at least one `--hash=sha256:`.
The same recorded CPython executable downloads only wheels with `--require-hashes` and
`--only-binary=:all:` into a separate outside-repository tooling wheelhouse.
The offline tooling install uses `--no-index`, `--find-links` and `--require-hashes`.
The tooling requirements and every tooling-wheel digest enter D1 evidence; its audit command is exactly:

```text
pip-audit \
  --vulnerability-service osv \
  --osv-url https://api.osv.dev/v1/query \
  --require-hashes \
  --disable-pip \
  --no-deps \
  -r <OUTSIDE_REPO>/uv-exported-requirements.txt
```

The pip-audit output records affected package/version, vulnerability IDs and fix versions; it is
not the severity authority. Using the same authorized POST endpoint, D1 must retain outside the
repository the raw OSV response for every audited package/version and bind every pip-audit finding
ID to its full OSV record. A bounded normalized finding enters evidence with the raw-response
SHA-256 and the recognized qualitative `database_specific.severity` value. Case-insensitive
`critical`, `high`, `moderate` and `low` normalize to `CRITICAL`, `HIGH`, `MODERATE` and `LOW`;
missing, unrecognized or conflicting severity is `UNKNOWN`.
Any `CRITICAL`, `HIGH` or `UNKNOWN` finding keeps the candidate `HOLD`; no missing severity can
become a green result. The exported
requirements intentionally exclude B1: the separate exact B1 wheel remains covered by the raw
Anycorn High finding and the candidate-specific VEX entry.

The registry-only closure must be exported with uv `0.11.16` as a fully pinned requirements file
whose every requirement has `==` and at least one `--hash=sha256:` entry. On the exact recorded
platform, CPython `3.12.13` with executable SHA-256
`a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623` and pip `26.1.1`
must be resolved to one recorded absolute executable path.
That recorded executable must create the wheelhouse with this exact command:

```text
umask 022
<PINNED_PYTHON_3_12_13> -m pip download \
  --require-hashes \
  --only-binary=:all: \
  --index-url https://pypi.org/simple \
  --cache-dir <OUTSIDE_REPO>/pip-cache \
  --dest <OUTSIDE_REPO>/wheelhouse \
  -r <OUTSIDE_REPO>/uv-exported-requirements.txt
```

D1 evidence must record the source `uv.lock` and exported-requirements digests, exact command
lines, interpreter/pip/uv versions, platform and `cp312` ABI, absolute outside-repository cache and
wheelhouse paths, total wheel count, and independently recomputed per-wheel SHA-256 values matching
the exported hashes. It must assert that every wheelhouse member is a wheel, `anycorn` is absent
from both the lock-derived requirements and wheelhouse, no extra index or host and no repository
write occurred, and the offline proof uses `--no-index`, `--find-links` and `--require-hashes` with
a fresh cache distinct from the download cache. Review workspaces are retained only through
independent review, explicit artifact-dependent verification, D1 merge and final hosted-CI evidence
capture. The `Suite Integration/Release` owner must delete the outside-repository D1 artifact root within 24 hours after D1 merge and record the verified-absent result in the D1 integration evidence.
The B1 wheel remains a separate exact-hash input installed offline with
`--no-deps`; the raw Anycorn wheel is never downloaded or installed.

D1 also permits the exact build-backend child processes needed for the two reproducibility builds.
This enumerated widening grants no listener, server, database, migration or product-runtime
authority and no product dependency change. D1 opened only after A0 and K5 were accepted and S1
admitted option B1.

### Gate UAT-MTLS-D2-P0 — preflight authoring

Current state: `AUTHORIZED — AUTHORING ONLY — RUNTIME HOLD`.

The independent Opus architecture review of the exact integrated D1 base found three control
contradictions that made the required preflight harness unwritable: the closed D1 list named five
runtime paths that were never authored, the recursive dependency-neutral purity test rejected any
runtime module placed beside the pure library, and the SSL-builder policy could not both execute
the audited B1 base builder and raise the candidate minimum to TLSv1.3. The Codex Governor accepts
that critique and opens this finite reconciliation as a forward D2 preparation action.

D1 remains complete for its consumed dependency/build/evidence action;
no D1 dependency authority is reused or reopened. D2-P0 may author and statically test the exact harness bytes that Phase A
must review, but it must not open a socket, start PostgreSQL, run a migration, generate PKI, or execute N1–N10.
The runtime-bearing tests must remain collected but unexecuted behind the D2 exact-action guard.

The maximum prospective authoring scope is exactly:

- `docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md`
- `integration/compose/README.md`
- `integration/compose/soc-ai-lifecycle-create-mtls/README.md`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/policy.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/client.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/harness.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/pki.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/server.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/store.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_real_tls_extension.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_negative_cases.py`
- `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_teardown.py`
- `tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh`
- `tools/contract-validation/tests/validate-transport.test.mjs`

No other path is authorized by D2-P0. In particular, this authoring action changes no dependency
or lock, candidate status carrier, hosted-check pin, evidence result, product repository, contract,
schema, release manifest or workflow.

The internal wrapper remains the only allowed public builder symbol. It may delegate to exactly
`anycorn.config.Config.create_ssl_context` only when the reference pins B1 wheel SHA-256
`d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c`; raw, aliased,
unpinned or wrong-digest delegates remain rejected. After that exact patched builder returns, the
wrapper must set the minimum and maximum protocol version to TLSv1.3 and retain
`ssl.CERT_REQUIRED`. Runtime evidence must prove these properties on the accepted connection; this
authoring record proves none of them.

The original D1 artifact root remains absent after its recoverable move to Trash. D2-P0 does not
restore, rebuild, install or execute it. A later Phase A review must pin the exact recovered or
reproduced B1 bits at a new outside-repository path; if those exact bits are unavailable, D2 stays
HOLD pending a separately reviewed rebuild action.

The independent Opus review of the first D2-P0 bytes returned `APPROVE WITH REQUIRED FIXES`. The
Governor accepts its two P0 findings and requires the repaired bytes to preserve the real ASGI TLS
extension summary under the outside-repository evidence root, assert its exact TLS 1.3/mTLS shape
before rollback, and make rollback independent of the one-shot execution guard. Cleanup still
validates absolute, disjoint, outside-repository roots whose basenames are purpose-bound to
`cybrik-uat-d2-runtime-*` and `cybrik-uat-d2-evidence-*`; it retains bounded server/client PID
records, refuses a mismatched process identity, verifies both loopback listeners absent, destroys
only the runtime root, preserves the evidence root, and reports cleanup failure instead of
suppressing it.

D2-P0 does not satisfy the section 7.3 coverage gate. Phase A must remain closed until exact
commands and artifacts prove at least 80% line and branch coverage and 100% coverage of the
critical paths. If the pinned verification environment lacks the necessary coverage runner, a
separate bounded coverage-tooling action must first be reviewed; D2-P0 authoring authority may not
install it, widen the dependency lock or reinterpret passing test counts as coverage evidence.

The negative issuer used for N2–N7 is an explicitly accepted test-only relying-party probe. It uses
the unchanged pinned SOC `LifecycleCreateClient` and production issuer implementation, mutates only
the signed negative claim, then rebinds the client's secret-free provenance to the authority the
client requested so the request reaches the Cyber AI relying party. This deliberately bypasses
only the client's redundant pre-I/O provenance guard for the negative request; it changes no SOC
product byte, positive path, key handling or production policy. Each result must remain a constant
accept/refuse count plus a stable non-secret refusal class, and N6 may pass only on the same generic
relying-party refusal used by the other authorization negatives.

Phase A must import-check the exact pinned SOC and Cyber AI APIs before any directory, container or
listener is created. After the pinned Cyber AI migrations, the harness must also prove the
migration-created `cybrik_ai_api_app` role is `NOLOGIN`, non-superuser and `NOBYPASSRLS`, all five
runtime tables have both RLS and `FORCE ROW LEVEL SECURITY`, a cross-tenant visibility probe returns
zero, and N1 leaves exactly one replay row in PostgreSQL. N9 stops PostgreSQL and verifies listener
absence before the request; a paused or merely timing-out database is not sufficient evidence.

D2 remains **HOLD**. UAT, `DEMO_READY_LOCAL`, POC, RC, stable-v1, GA, public release and production
remain **NO-GO**. Production and public GA remain Founder-controlled. Release dates remain unchanged.

### Gate UAT-MTLS-D2-COV-P0 — isolated coverage-tooling proposal

Current state: `PROPOSED — HOLD PENDING FOUNDER DEPENDENCY AUTHORIZATION`.

The merged D2-P0 candidate is canonical at Suite commit
`fd19b88e9cf40704284f0494f6dc8349e7c45a0c`. Its section 7.3 coverage gate remains unsatisfied
because the exact D1 Python environment, the host Python and the preserved download caches contain
neither `coverage` nor `pytest-cov`. Passing test counts are not coverage evidence.

This proposal requests one dependency-install action that is isolated from the Suite lock and
every product environment. Installing the verifier and passing the coverage gate are deliberately
separate outcomes: the exact installation may complete while coverage remains `HOLD`; it creates
no pressure to reinterpret a failed measurement as success. The action must not edit
`pyproject.toml`, `uv.lock`, the D1 SBOM/VEX/license packet, any product repository, workflow,
release manifest or runtime-admission carrier. If approved, the maximum dependency action is
exactly:

1. create one fresh mode-`0700` outside-repository root whose basename matches
   `cybrik-uat-d2-coverage-[a-z0-9][a-z0-9._-]{0,63}`;
2. create one fresh, disjoint, preserved mode-`0700` outside-repository evidence root whose
   basename matches `cybrik-uat-d2-coverage-evidence-[a-z0-9][a-z0-9._-]{0,63}`; neither root may
   contain, be contained by, or be an ancestor/descendant of a Suite/product repository or the
   other root;
3. fetch only
   `coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl` from
   `https://files.pythonhosted.org/packages/06/d1/da99af464c335d4e023a6efcd7ec30f63b88a43c93745154ab74ffb31cea/coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl`;
   the only other permitted network call is the exact JSON POST already described below to
   `https://api.osv.dev/v1/query`; PyPI project metadata, alternate mirrors and indexes are not
   execution inputs;
4. require size `221943` and SHA-256
   `b868acc62aa5de3be7a9d05c2333bf8359ca987e43f9cb30ff8fbda6a024ab73` before any install;
5. use only the absolute `PINNED_PYTHON=` path and `PINNED_PYTHON_REALPATH=` recorded in the
   Founder authorization artifact. `PINNED_PYTHON` may be the exact D1 offline-venv `python`
   symlink so its already-pinned test closure is available, but it may have no symlinked parent,
   its single link target must be `python3.12`, and `realpath(PINNED_PYTHON)` must equal the recorded
   regular `PINNED_PYTHON_REALPATH`. The resolved executable must report CPython `3.12.13` and have
   SHA-256 `a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623`;
6. install with the exact absolute interpreter command `<PINNED_PYTHON> -m pip install --no-index
   --no-deps --target <COVERAGE_ROOT>/site-packages
   <COVERAGE_ROOT>/wheel/coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl`; the command may not
   mutate `PATH`, use another index/distribution, run a lifecycle script or alter an existing
   environment;
7. record the wheel, interpreter, command, installed `coverage.__version__`, root identities and
   OSV response digests in the preserved evidence root. Only these integrity checks define
   `D2-COV-P0-INSTALL=PASS`; the coverage percentage remains a separate `HOLD` gate;
8. remove only the isolated tool root on failure or rollback, after writing a bounded secret-free
   failure record. The evidence root must remain intact for review.

After the one exact installation, ordinary test-only changes may improve coverage without another
dependency install. Each measurement must use the same pinned interpreter and the literal command
shape below; `<SUITE_ROOT>`, `<COVERAGE_ROOT>` and `<COVERAGE_EVIDENCE_ROOT>` are exact absolute
standalone lines in the authorization artifact, not caller-selected PATH values:

```text
COVERAGE_FILE=<COVERAGE_ROOT>/data/.coverage \
PYTHONPATH=<COVERAGE_ROOT>/site-packages:<SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/src \
<PINNED_PYTHON> -m coverage run --branch \
  --source=<SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls \
  -m pytest -q -o addopts= \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_evidence.py \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_procedure.py \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_case_inventory.py \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_real_tls_extension.py \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_negative_cases.py \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_teardown.py \
  <SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py \
  --deselect=<SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py::test_authorized_runtime_attempt_executes_the_red_green_sequence

PYTHONPATH=<COVERAGE_ROOT>/site-packages \
<PINNED_PYTHON> -m coverage report --data-file=<COVERAGE_ROOT>/data/.coverage --fail-under=80

PYTHONPATH=<COVERAGE_ROOT>/site-packages \
<PINNED_PYTHON> -m coverage json --data-file=<COVERAGE_ROOT>/data/.coverage \
  -o <COVERAGE_EVIDENCE_ROOT>/coverage.json
```

A bounded stdlib verifier must recompute line and branch ratios independently from
`coverage.json`; combined `coverage report` percentage alone is insufficient. `PASS` requires at
least 80% line coverage and at least 80% branch coverage across the full
`src/cybrik_suite_uat_mtls` package. It also requires 100% line and branch coverage, measured by
exact AST-derived source ranges and branch arcs, for:

- `server.build_patched_ssl_context`;
- `policy.parse_loopback_bind` and `policy.validate_proposed_bind`;
- `evidence.secret_reason` and `evidence.validate_evidence`;
- `harness._assert_ssl_context_evidence`, `harness.teardown` and `harness.verify_absent`.

These critical paths must be reached with import-inert fakes, monkeypatches and temporary roots;
the gate does not defer them to runtime and does not permit Anycorn resolution, B1 restoration,
listeners, containers, PKI, migrations or N1–N10. No successful install or measurement by itself
opens Phase A, authorizes B1 recovery or grants UAT/release credit.

The official PyPI release JSON at `https://pypi.org/pypi/coverage/7.15.2/json` had SHA-256
`771ec4e205bcffa75b9592bcd3dc144475f38561d4a22ffcfa8f9a5852cc337c` at the point of inspection;
that mutable project-document digest is informational, not a future equality gate. The exact
OSV query for PyPI `coverage` version `7.15.2` returned no vulnerabilities; its raw `{}` response
had SHA-256 `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`.
These are proposal facts, not an install, audit artifact, coverage result or risk acceptance.

### Gate UAT-MTLS-D2 — real runtime execution

Current state: `HOLD — SEPARATE REVIEWED RUNTIME-ADMISSION UPDATE REQUIRED`.

D2 uses the A0 two-phase sequence. Before authorization, all of these preflight conditions must be
true at one exact re-pinned tuple:

- B1 patch, build, lock, audit, SBOM, `analysis.state=in_triage` VEX and offline-reinstall preflight
  evidence is complete; the only remaining High is the raw-release finding whose empirical
  mitigation is the purpose of D2;
- the separate-process harness and every N1–N10 test are authored but not run;
- rendered required checks are refreshed and green for all four repositories;
- lifecycle procedures, synthetic-data boundary, production exclusions, loopback exposure,
  rollback and evidence routing are exact;
- an independent preflight GO artifact authorizes exactly one bounded run by path and SHA-256.

The preflight GO artifact must also pin the exact one-shot roots with standalone
`RUNTIME_ROOT=<absolute path>` and `EVIDENCE_ROOT=<absolute path>` lines. Both paths remain subject
to the purpose-bound, outside-repository and disjoint-root checks. Because the evidence root is
preserved and the start step requires both roots to be fresh, the same authorization cannot be
replayed with a different suffix or reused for a second attempt.

The admission integrator may then set `execution_authorized=true` only while status is `not_run`;
the candidate and evidence verdict remain `HOLD`. The authorized run is loopback-only,
synthetic-only and non-production. It must produce the evidence needed to evaluate all accepted
A1–A7 criteria:

- **A1:** the Anycorn finding is closed by
  `evidence/02-architecture-and-acceptance.md` §5 unblock (1) an official release containing
  `9eabf20`, or (2) a separately audited internal patch proposal, with artifact digests,
  transitive lock review and an empirical ASGI TLS-extension probe; B1 uses unblock (2);
- **A2:** separate processes, real loopback TLS, ephemeral out-of-repository PKI, synthetic data,
  PostgreSQL durable replay and certificate-thumbprint binding are implemented and evidenced;
- **A3:** all ten required negative tests are authored and fail closed with captured output;
- **A4:** every negative-smoke row has a truthful executed result and none remains `hold`;
- **A5:** rendered required checks are refreshed, re-pinned and green for all four repositories;
- **A6:** an independent GO artifact is pinned by repository-relative path and SHA-256;
- **A7:** the canonical runtime-admission validator derives the intended disposition.

Immediately after the bounded run, the integrator sets `execution_authorized=false`, records
`passed` or `failed` and exact counts, captures all A1–A4 outputs, refreshes A5, obtains the final A6
review and runs A7. A failed attempt derives `NO-GO`; a passed attempt remains truthfully `HOLD`
under the current validator and proceeds to the separate UAT Gate Standard rather than claiming a
UAT pass from this record.

## 11. Reviewer and verification routing

- Writer: Codex or Claude-A, Suite Integration/Release ownership.
- Supply-chain reviewer: different account/model from the writer.
- TLS/trust-boundary reviewer: different account/model from the writer.
- Codex Governor runs the exact lock, audit, SBOM, offline reinstall, unit/integration, secret
  scan and diff checks itself before any PR.
- Before intent-to-add, verification records the exact
  `git ls-files --others --exclude-standard` inventory. Every path in that inventory then receives
  intent-to-add (`git add -N -- <exact paths>`) so `git diff --check` and diff review read its
  bytes; no unrecorded path may enter the diff. A Git-diff-only secret scan is forbidden. Actual
  staging occurs only after the recorded untracked inventory, intent-to-add diff,
  whole-working-tree secret scan and exact-path review are clean.
- Fable is reserved for a conflicting High-risk conclusion; routine implementation and review use
  Opus/Codex.

Claude-B quota exhaustion is operational context only and grants no independence exception.

## 12. Rollback

Before runtime: revert the bounded Suite harness commit and delete only the ephemeral gitignored
`dist/` artifact plus the isolated UAT environment, wheelhouse, cache and clean build workspaces.
Product repositories remain byte-identical.

During an authorized runtime attempt: stop both client/server processes, close both loopback
listeners, drop only the disposable UAT PostgreSQL schema/database, revoke and destroy the
ephemeral dev PKI, then verify no process, listener, credential material or untracked artifact
remains.

## 13. Governor disposition

- `PROPOSAL-B1=RECOMMEND`
- `RUNTIME-IMPLEMENTATION=NOT-IMPLEMENTED`
- `ADMISSION-SEQUENCING-A0=ACCEPTED-SEQUENCE-CURRENT-ATTEMPT-UNAUTHORIZED`
- `UAT-CANDIDATE-EVALUATION=ACCEPTED-S1-BOUNDED-ISOLATED-NOT-IMPLEMENTED`
- `SERVER-SELECTION=DEFERRED`
- `RAW-ANYCORN-0.20.0=HOLD`
- `PRODUCT-DEPENDENCY-CHANGES=DENY`
- `W2K-R5-METADATA-CONTROL-AMENDMENT=IMPLEMENTED-BY-D1-ARTIFACT-ONLY`
- `S1-R2-D1-CLARIFICATION=HISTORICAL-PRE-D1-ACCEPTED-BY-DELEGATED-GOVERNOR-D1-STILL-HOLD-PENDING-FOUNDER`
- `S1-R3-D1-ENDPOINT-CORRECTION=HISTORICAL-PRE-D1-ACCEPTED-BY-DELEGATED-GOVERNOR-D1-STILL-HOLD-PENDING-FOUNDER`
- `DEPENDENCY-INSTALLATION=D1-COMPLETE-ISOLATED-UAT-ARTIFACT-ONLY`
- `RUNTIME-EXECUTION=HOLD-PENDING-SEPARATE-ADMISSION`
- `PRODUCTION/POC/RC/STABLE-V1/GA=NO-GO-BY-THIS-RECORD`
- `UAT-PASS/DEMO_READY_LOCAL=NO-GO-BY-THIS-RECORD`
- Release dates remain unchanged.
