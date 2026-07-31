# ADR-0013 — Transport peer-evidence adapter profile

Status: **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED**. Gate W2-K static proposal only.

## Context

The accepted W2-F delegation contract requires the relying party to compare the presented
certificate thumbprint with token confirmation, while the proposed W2-I transport binding names a
transport thumbprint. Neither selects a server or defines how a server-neutral adapter conveys only
evidence derived from a chain the serving side verified. Binding that seam directly to one ASGI
server would make an upstream release a critical-path architecture decision.

This ADR is Suite-owned contract work. It changes no product repository and confers no runtime or
authorization behavior on `cybrik-soc-command-center`, `cybrik-cyber-ai-platform`, or
`cybrik-security-tool-fabric`.

## Decision

Propose `cybrik.transport-peer-evidence.v1` and its fail-closed error vocabulary as a
server-neutral adapter profile. A conforming evidence object is acceptable only when:

1. channel evidence is present;
2. mutual TLS and serving-side chain verification are both true;
3. the only peer identifier is an `x5t#S256` value reused from accepted W2-F common definitions;
4. its source is `server_verified_chain`; and
5. transport, relying-party, and token-confirmation thumbprints are exactly equal.

Absent, held, unverified, mismatched, or incomplete evidence denies. No degraded or header-based
fallback exists. Evidence carries no permission, role, capability, scope, approval, token, raw
certificate, public key, subject, SAN, secret, or private material.

Governance lifecycle metadata belongs to packet metadata; wire evidence and denial instances carry none.
The proposal status remains explicit on the schema roots, examples manifest, compatibility
manifest, this ADR, and the delegated decision record. Both wire schemas use
`additionalProperties: false`, so adding `x-cybrik-lifecycle` to an emitted instance fails closed
rather than lifting packet governance into the transport payload.

## Server neutrality

No server is selected, installed, or pinned. Anycorn `0.20.0` remains **HOLD** under the existing
runtime-admission finding. Other candidates remain unassessed. A future server must pass a separate
runtime conformance gate; static green under this ADR is not that gate.

The future local harness forbids a `trusted-boundary-adapter`: loopback UAT must derive peer evidence
from the chain verified by the serving process itself. Proxy or caller assertions are out of scope.

## Runtime boundary

N2–N8 and N10 receive static contract coverage only; N1 and N9 have no static substitute. All
N1–N10 nevertheless retain `runtime_status: requires_runtime`: static schema or inherited W2-F
coverage never completes a held UAT smoke. Separate processes, a real loopback TLS socket, ephemeral
out-of-repository development PKI, runtime logs and response headers, and PostgreSQL durability also
remain runtime-only. This proposal satisfies none of the existing runtime-admission A1–A7 criteria
and does not move that candidate out of HOLD.

## Resource-bounds non-goal

W2-H `resource-bounds` remains a parallel, proposed packet. Resource accounting attaches only after
transport evidence derivation and relying-party reauthorization; it is not a property of this
evidence object. This ADR modifies no W2-H artifact and does not claim T11 measurement evidence.

## Consequences

- Server choice becomes replaceable behind one fail-closed conformance surface.
- A client or header can never synthesize peer evidence.
- W2-I remains proposed and one-directional: this ADR refines evidence derivation without accepting
  W2-I or modifying its bytes.
- Green validators mean **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** static conformance only, never
  UAT, deployment, release, GA, or production readiness.
