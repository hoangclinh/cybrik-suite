# Gate W2-D — AI model-inference + alert-summarization packet acceptance (2026-07-24)

- Status: `DECISION RECORD` — **Gate W2-D outcome: ACCEPTED FOR IMPLEMENTATION** (packet
  v0.1.0; **not** stable v1/GA, **not** an ADR-0001 immutable bundle tag). Every member of the
  W2-D inference packet is flipped from `PROPOSED — NOT ACCEPTED` to `ACCEPTED FOR
  IMPLEMENTATION` at v0.1.0. This authorizes products to implement contract-first against
  v0.1.0; it does **not** promote to a stable version, create a bundle tag, or close any release
  blocker.
- Date: 2026-07-24
- Branch / reviewed tree: `codex/w2d-ai-inference-contracts`. The reviewed (pre-flip) baseline was
  `e7d192b` (`contracts(w2d): PROPOSED W2-D AI model-inference + alert-summarization packet`),
  Gate-cited CI run **30084152546** green, **0 Critical / 0 High**. This decision is the
  status-flip commit on the same branch; the validator/secret-scan run is re-recorded at the
  flip head (§2). No merge to `main`.
- Authority: Founder-delegated **technical** Gate W2-D (delegation of the technical accept/-hold
  decision to Codex; executed and recorded by the suite Claude lead). Delegation covers the
  technical gate decision and the acceptance-for-implementation flip only. It does **not**
  authorize promotion to stable v1/GA, creating an immutable bundle tag, or merging to `main`.
- Reviewed packet: the 8 inference JSON Schemas (`contracts/json-schema/cybrik.model-*`,
  `cybrik.alert-summarization-*`), all positive + negative fixtures (`contracts/examples/inference/`),
  the inference-plane OpenAPI 3.1.1 mapping notes (`contracts/openapi/cybrik-ai-inference-plane.v1.openapi.yaml`),
  the AsyncAPI 3.0.0 inference lifecycle events (`contracts/asyncapi/cybrik-ai-inference-events.v1.asyncapi.yaml`),
  the provider-adapter notes (`contracts/adapters/`), and both manifests
  (`contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json`,
  `contracts/examples/inference/examples-manifest.json`).

## 1. Decision

**ACCEPTED FOR IMPLEMENTATION — v0.1.0, not stable v1/GA.** The gate rule is: accept for
implementation only if the post-validator security/trust and standards review surfaces **no
Critical or High** trust defect. The review surfaces **0 Critical and 0 High** trust or schema
defects; the packet is internally coherent at v0.1.0, additive to and disjoint from the accepted
v0.1 cross-product packet, and carries no tool/agent/approval authority on the inference seam
(MCP out of scope). Under the rule, the packet is therefore **ACCEPTED FOR IMPLEMENTATION** at
v0.1.0.

This is an implementation-authorization acceptance only. It is **not** a stable v1/GA promotion,
**not** an immutable bundle tag (`x-cybrik-is-bundle-tag` stays `false`), and does **not** close
any release blocker. Runtime-only invariants recorded in the manifest
(`trust_invariants.runtime_only` TR-1..TR-6, `cross_ref_integrity`) remain explicit and REQUIRED
of every implementation — a green validator run proves standards conformance and fixture
coverage, not running enforcement.

### Gate decisions resolved (G-W2D-1..5, accepted exactly as delegated)

| ID | Decision | Outcome |
|---|---|---|
| G-W2D-1 | Provider-neutral `model_class`; vendor/model (Ollama/Qwen/OpenAI-envelope) is adapter metadata only, never on the wire | **ACCEPTED** |
| G-W2D-2 | Fail-closed `redaction_policy` (`on_unresolved` const `deny`) + marking non-downgrade (TR-1) are mandatory inference trust invariants | **ACCEPTED** |
| G-W2D-3 | Inference seam carries **no** tool/agent/approval authority (TI-2); MCP out of scope; cannot become a tool-execution bypass | **ACCEPTED** |
| G-W2D-4 | Alert summarization consumes SOC alerts by **digest-bound `objectRef` only**; SOC remains owner of alert truth (no SOC schema change) | **ACCEPTED** |
| G-W2D-5 | AsyncAPI/OpenAPI deltas retained as **additive mapping notes** with no operational servers/endpoints | **ACCEPTED** |

## 2. Evidence — validators, negative tests, secret scan (re-run at the status-flip head)

Reproducible from the committed lockfile: `cd tools/contract-validation && npm ci && npm run validate`.

- **JSON Schema 2020-12 / fixtures / trust invariants (`validate:inference`)** — PASS. 8 inference
  schemas loaded/compiled; 8/8 positive fixtures validate; 8/8 negative-schema fixtures rejected;
  4/4 negative-semantic fixtures structurally valid; 11 manifest members (+3 accepted primitives
  reused unmodified); 5/5 AsyncAPI messages data-bound; **39 trust-invariant assertions** pass
  (TI-1..TI-8 structural + TR-1/TR-2/TR-5/grounding/cross-ref runtime, each exercised by a fixture).
- **Lifecycle consistency** — PASS. The compatibility manifest is the single source of truth for
  lifecycle state; `validate-inference.mjs` now accepts exactly two consistent whole-packet states
  (`PROPOSED`/not-accepted or `ACCEPTED FOR IMPLEMENTATION`/accepted) and **fails a half-flipped
  packet**. All 8 schemas, both manifests, and the OpenAPI/AsyncAPI `info` blocks agree on
  `ACCEPTED FOR IMPLEMENTATION` at v0.1.0; `x-cybrik-is-bundle-tag` remains `false`; accepted-state
  acceptance metadata (gate, decided_by, decided_on, evidence[]) is present.
- **v0.1 base packet (`validate:schemas`)** — PASS, unchanged. **25 hardening assertions** retained
  and passing; the accepted base primitives (common-defs, data-marking, envelope) are reused by
  `$ref` and were not modified or re-versioned by this gate.
- **OpenAPI 3.1.1 (Spectral `oas`, fail-severity=error)** — PASS. 0 errors (intentional style
  warnings only, for a non-deployable server-less mapping-notes document).
- **AsyncAPI 3.0.0 (`@asyncapi/parser`)** — PASS. version=3.0.0, 0 errors.
- **Secret scan (gitleaks 8.30.1, pinned; matches CI)** — CLEAN. Gate-cited CI run **30084152546**
  green at `e7d192b`; re-run at the status-flip commit head.

A green validator run is a standards-conformance and fixture-coverage signal, not a proof of
runtime enforcement of the TR-1..TR-6 / cross-ref invariants, and not, by itself, acceptance.

## 3. What did NOT change with this acceptance

- **Status metadata only.** No wire semantics, payload examples, field, version, or format pin
  changed. The flip touched only lifecycle/status markers (`x-cybrik-status`,
  `x-cybrik-not-accepted`, Status headers) and the manifest gate/acceptance blocks.
- No promotion to stable v1/GA and no immutable bundle tag: packet stays v0.1.0,
  `x-cybrik-is-bundle-tag=false`.
- The accepted base v0.1 packet is **unchanged**; base primitives remain
  `ACCEPTED FOR IMPLEMENTATION` and are reused unmodified.
- No security invariant/hardening was relaxed: all **39** inference trust-invariant assertions and
  the base **25** hardenings remain and pass.
- Disjointness preserved: the inference seam and the accepted tool-execution seam (ADR-0004) stay
  disjoint; MCP remains out of scope; SOC remains the owner of alert truth (digest-bound
  `objectRef` only).
- No merge to `main`; no secrets, product dependencies, migrations, deployments, or remote
  configuration changed. The only install performed is the isolated, pinned validation toolchain
  (`npm ci`, `ignore-scripts=true`), whose `node_modules` is gitignored.

## 4. Remaining, still-required runtime gates (not closed by this acceptance)

Acceptance-for-implementation authorizes contract-first implementation only. The following remain
the responsibility of each implementing product and are **not** proven by a green validator run:

- **TR-1** marking non-downgrade (result marking ≥ input/union-of-alert marking).
- **TR-2** feature-negotiation fail-closed (`unsupported_feature` denial, never silent ignore).
- **TR-3** health fail-closed (absent/stale/unknown health ⇒ `unavailable`; no routing).
- **TR-4** budget/limit clamping to resolved-class ceilings (typed over-budget errors).
- **TR-5** authoritative tenant/actor/org/model resolution from credential + policy (reject
  body/credential mismatch).
- **TR-6** output-is-not-authority (model output is untrusted analyst-support data, never an
  approval or action trigger).
- Cross-artifact correlation/grounding bindings in `cross_ref_integrity`.

Promotion to a stable v1/GA version or an ADR-0001 immutable bundle tag remains a **separate
Founder gate** (ADR-0001 D6). Until such a bundle tag exists, no release manifest may reference
any member as GA.

## 5. Do not claim

- The packet is accepted **for implementation at v0.1.0 only**. It is **not** stable, **not** GA,
  **not** a bundle tag, and confers no release authorization.
- A green validator/secret-scan run is a conformance and fixture-coverage signal, not a proof of
  runtime enforcement of the TR-1..TR-6 / cross-ref invariants.
- Nothing here is implemented, verified against a running system, piloted, or GA.
