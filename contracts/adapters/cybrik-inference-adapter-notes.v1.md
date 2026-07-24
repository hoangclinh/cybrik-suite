# CYBRIK inference adapter mapping notes v1

Status: `PROPOSED` — **NOT ACCEPTED** (v0.1.0; not stable v1/GA). No product may implement until a
separate Founder gate (Gate W2-D) accepts it. A green validator/secret-scan run is a
standards-conformance signal only; it is **not** acceptance.

Contract version: 0.1.0 · ADR basis: ADR-0002 G3 (model-runtime seam), ADR-0001 (versioning).

## Purpose and the wire/adapter boundary

This note records how concrete model runtimes map **onto** the provider-neutral W2-D inference
wire contract (`cybrik.model-*` / `cybrik.alert-summarization-*`). It exists to make one boundary
explicit and durable:

> **Vendor/runtime specifics are adapter metadata, NEVER wire fields.**

The wire contract names a model only by a **policy-selected `model_class` token** (e.g.
`chat.general`, `summarization.soc_alert`). It carries **no** `vendor`, `provider`, `model`,
`endpoint`, `base_url`, `api_key`, `deployment`, or `weights` field. This is enforced
*structurally*: every request/result/error is `additionalProperties: false`, so a caller
**cannot** pin a concrete model even by mistake — such a field has nowhere to live. The
model/policy layer resolves a class to a concrete runtime + weights **server-side**. This note
therefore describes an **internal, control-side** mapping; none of it is transmitted between
products.

This is a mapping note, not a runtime, an SDK, a client, or a deployment. It declares no
endpoints, hostnames, credentials, or vendor URLs.

## What stays neutral on the wire vs. what an adapter owns internally

| Concern | Provider-neutral wire (this packet) | Adapter metadata (control-side, NOT on the wire) |
|---|---|---|
| Model selection | `model_class` token | Concrete runtime + weights id, quantization, replica |
| Prompt | `promptTemplateRef` (id + SemVer + digest) | Resolved template text, chat-role framing |
| Structured output | `outputContract.schema_ref` (+ `strict`) | Native `response_format` / grammar / JSON-mode knob |
| Decoding | bounded `sampling` (temperature/top_p/stop/seed) | Native sampler parameter names/ranges |
| Features | neutral `featureToken` set | Native capability flags |
| Streaming | `response_mode: stream` (same typed final result) | SSE/chunk framing, keep-alive |
| Token accounting | neutral `usage` counts | Runtime-native token/usage payload |
| Errors | typed `errorClass` + sanitized `message_safe` | Raw runtime error blob (never surfaced) |
| Health | `healthState` (ready/degraded/unavailable) | Node/replica diagnostics, host identity |

An adapter MUST NOT leak any right-column value onto the wire. In particular, `message_safe`
carries no stack traces, prompts, credentials, model output, or runtime-native error payloads.

## Illustrative runtime mappings (non-normative, no endpoints)

These sketch how an adapter *would* translate the neutral contract into a runtime's native shape.
They are illustrative only and pin nothing.

- **Ollama / llama.cpp (local, `data_residency: local`).** `model_class` → a locally loaded
  weights file; `sampling.temperature`/`top_p`/`stop_sequences`/`seed` → native options;
  `outputContract` → llama.cpp GBNF grammar / Ollama `format: json`; `response_mode: stream` →
  chunked responses aggregated into the same typed result.
- **vLLM (local/self-hosted, `data_residency: local`).** `model_class` → a served model name in
  the adapter's own registry; `outputContract` → guided decoding; `usage` derived from the
  runtime's prompt/completion token counts, re-expressed as neutral `usage`.
- **OpenAI-envelope-compatible runtimes (`data_residency: external`).** The familiar
  `messages[]` / `response_format` / `tool_choice` request envelope is an **adapter detail**. Note
  the deliberate asymmetry: **tool/function-calling is never mapped** — `capability.tool_calling`
  is `const "disabled"` and no request field can request it. An external class may egress only
  when `data_marking` + `redaction_policy` permit it (enforced control-side).
- **Qwen (and similar instruction-tuned weights).** A concrete weights family behind a
  `model_class`; its chat template and special tokens are resolved from the governed
  `promptTemplateRef`, never sent by the caller.

## Trust invariants the adapter layer MUST preserve

1. **No credential/tool/shell authority to the model.** The adapter passes the resolved prompt
   and inputs to the runtime and returns untrusted output. It grants the model no credential,
   database, tool, function, MCP, or shell authority. Tool execution is governed by the separate
   accepted Tool-Fabric packet (ADR-0004), never here.
2. **Fail-closed redaction.** Marking/redaction is applied **before** any content reaches a
   runtime; `redaction_policy.on_unresolved` is `const "deny"`. If the profile cannot be
   satisfied, the adapter denies — it never sends unredacted sensitive content.
3. **Bounds clamping.** The adapter clamps request `limits`/`deadline_seconds` to the resolved
   class ceilings and never above them; exceeding a budget yields a typed error, not silent
   truncation.
4. **Marking non-downgrade.** Output `data_marking` MUST be `>=` the input marking (the union of
   alert markings for summarization). The adapter never lowers sensitivity.
5. **Refusal/fallback surfaced, not hidden.** A model refusal is returned as
   `outcome: "refused"` data; a fallback substitution is recorded via `fallbackInfo`. Neither is
   dropped, and neither is an authorization signal.
6. **Output is not authority.** Runtime output (`output` / `summary_text`) is untrusted,
   advisory analyst-support data and MUST NOT be consumed as authorization, approval, or an action
   trigger.

## Out of scope

MCP servers/tools/actions; agent orchestration and durable bus choice (ADR-0003); sandbox
substrate (ADR-0005); the org-hierarchy contract delta (ADR-0007, `org_scope` is opaque/advisory
only here). None of these are decided or implemented by this note.
