# contracts/adapters

Status: **ACCEPTED FOR IMPLEMENTATION** (v0.1.0; not stable v1/GA). Accepted at Gate W2-D (Codex under Founder delegation, 2026-07-24).

Provider-adapter **mapping notes** for the W2-D AI-inference packet. These documents record how
concrete model runtimes map **onto** the provider-neutral inference wire contract under
`../json-schema/` (`cybrik.model-*` / `cybrik.alert-summarization-*`). Their entire reason for
existing is to keep one boundary explicit:

> Vendor/runtime specifics (Ollama, vLLM, llama.cpp, OpenAI-envelope, Qwen) are **adapter
> metadata, never wire fields**. The wire names a model only by a policy-selected `model_class`
> token; there is no vendor/endpoint/api_key field to pin (`additionalProperties: false`).

- `cybrik-inference-adapter-notes.v1.md` — the wire/adapter boundary, an illustrative
  (endpoint-free) runtime mapping table, and the trust invariants the adapter layer must preserve.
- `cybrik-svc-delegation-mapping-notes.v1.md` — the W2-F **identity/delegation** boundary: how a
  short-lived, certificate-bound delegation token (`cybrik.svc-*`) authorizes a **neutral W2-D
  inference-operation token** (`ai.inference.create` / `ai.summarization.create`) without importing
  or modifying any W2-D schema and without granting any tool/agent/MCP authority. Accepted at Gate
  W2-F (Codex under Founder delegation, 2026-07-24).

No endpoints, hostnames, credentials, vendor URLs, or client code live here. Acceptance authorizes
contract-first implementation at v0.1.0 only; promotion to a stable v1/GA version or an immutable
bundle tag remains a separate Founder gate.
