# SOC-AI-Fabric alert-context mTLS UAT harness

Status: **concrete harness implemented and statically verified; runtime remains
HOLD until the exact tuple is frozen and a fresh external one-shot SSHSIG
authority is supplied**.

This Suite-owned sibling harness binds one exact, clean four-repository tuple
(Suite, SOC Command Center, Cyber AI Platform, and Security Tool Fabric) to an
allowlisted tracked-blob aggregate. Execution additionally requires a
detached, mode-`0600`, externally verified one-shot authorization. Verification
uses `/usr/bin/ssh-keygen -Y verify`, the fixed namespace
`cybrik-uat-soc-ai-fabric-v1`, and a mode-`0600` external `allowed_signers`
file. Its exact bytes, Ed25519 fingerprint and signer are pinned by the tracked
`authorization-trust.json`; replacing authorization, signature and external
key material together therefore still fails closed. The verified signer
identity must exactly match the signed `authorized_by` field.
Consumption state is atomically written to a mode-`0700` directory outside all
four repositories.

The only proposed listeners are `127.0.0.1:58442` (SOC),
`127.0.0.1:58443` (Cyber AI), and `127.0.0.1:58444` (Tool Fabric). TLS helpers
require TLS 1.3, a verified client certificate, and an exact SHA-256 leaf
fingerprint-to-principal mapping. Certificate CNs, HTTP headers, and request
bodies are never authority inputs.

Importing the package performs no I/O. The runner keeps HOLD as its default,
uses injected process hooks, and must invoke this admission boundary before
starting any process. `scripts/run_local_uat.py` with no arguments remains
inert. The only executable spelling is the exact `--execute` argument. Concrete
wiring prepares three disjoint ephemeral PKI channels, a mode-`0600` runtime
configuration and logs, authenticated role-wise process control, TLS-1.3
readiness probes, exact positive/F1/F2 clients, reverse teardown and
no-residual probes. Child Python starts with `-B -P`, a seven-key environment
allowlist and both the alert harness and lifecycle B1 source roots. No stack was
started while authoring or statically testing this wiring.

This harness is an **additive alert-context slice**. Its positive case proves a
read-only SOC → Cyber AI → Tool Fabric → SOC resolution with a durable verified
Fabric receipt. F1 proves that actor-copy widening is denied before SOC, model
or journal effects. F2 proves that tampering with a copied receipt journal is
unverifiable and leaves the authoritative journal unchanged. Reverse teardown
and no-residual evidence complete before the one-shot authorization is consumed.
Standalone execution retains those consumption and child terminal-seal
semantics. `run_reserved_stage` is the separate non-consuming seam for a future
single-authority master: it runs the cases and teardown under the caller's
reservation, returns unsealed case/absence records, and neither consumes child
authority nor writes a child terminal seal.

The concrete master entrypoint is `scripts/integrated_uat_stage.py`. It accepts
the already-consumed canonical master marker plus the exact ordered repository
roots/identities, master tracked aggregate, and all five ordered master root
capabilities bound by `external_roots_sha256`; it selects only
`alert_context_runtime`/`alert_context_evidence`/`alert_context_state` for its
runtime. It also requires the exact B1 wheel and pinned Python digest. The
stage imports the master allowlist only after validating the Suite root, then
re-observes the tuple and recomputes that union aggregate before preparing the
runtime. Its `ReservedRuntimeBinding` is
deliberately not an `ExternalAuthorization`; the child authorize, consume, and
evidence/seal callbacks all fail closed. Public run and absence receipts bind
the master authorization, marker, repository roots/tuple, aggregate, and
external-root digest. Reserved cleanup removes runtime contents but retains all
master-bound root directories; alert runtime, evidence, and state roots are all
empty after cleanup. The master terminal inspector re-observes the exact clean
tuple and binds the signed aggregate argument without a child marker. There is
one master grant and no child signature.

This slice does **not** close A5/N1/N9 PostgreSQL durable replay at
`127.0.0.1:55432`. The already-authored lifecycle-create PostgreSQL runtime path
remains a separate blocking gate until both slices can be sequenced under one
exact tuple, one external authority and one terminal seal. Nothing in this
packet records a completed runtime UAT, PostgreSQL proof, release or production
readiness.

Static verification is intended to run from this harness root without a
handwritten `PYTHONPATH`. The local test bootstrap resolves the exact sibling
worktree roots for SOC, Cyber AI, and Tool Fabric automatically, or accepts the
explicit overrides `CYBRIK_UAT_SOC_SRC`, `CYBRIK_UAT_AI_API_SRC`,
`CYBRIK_UAT_AI_CORE_SRC`, and `CYBRIK_UAT_FABRIC_SRC` when a different local
layout is required.

Exact local static test command:

`./.venv/bin/python -m pytest -q`

Required external execution inputs are supplied only through the exact
`CYBRIK_UAT_*` environment contract: four repository roots; disjoint mode-`0700`
runtime/evidence/state roots; mode-`0600` canonical authorization, SSHSIG and
`allowed_signers`; signer `FOUNDER`; the pinned B1 wheel; and the pinned Python
3.12 interpreter. The private SSH key is not read by this harness. Actual
signing remains an explicit external pre-UAT action after the final Suite commit
and all four commit/tree pins and the tracked-blob aggregate are known.
