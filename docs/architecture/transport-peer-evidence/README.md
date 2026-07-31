# Transport peer-evidence adapter profile

Status: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED**. Gate W2-K, v0.1.0; not stable v1/GA.

This Suite-owned profile defines a small evidence seam between TLS termination and relying-party
authorization. It is intentionally independent of a specific ASGI server and carries only a pinned
SHA-256 certificate thumbprint from a chain the serving side verified.

Flow, when implemented in a separately accepted product change:

1. a server verifies the mutual-TLS peer chain;
2. a server-specific adapter emits the accepted evidence object;
3. the relying party compares transport, relying-party, and token `cnf` thumbprints; and
4. only after equality succeeds does accepted W2-F reauthorization evaluate audience, scope,
   operation, tenant, and org constraints.

Missing or held evidence denies. Headers, caller assertions, raw certificates, unverified chains,
and trusted-boundary shortcuts are never accepted. The profile conveys no authorization.

The current SOC caller-owned mTLS seam is documented at
`cybrik-soc-command-center:services/api/src/cybrik_soc/modules/ai/client.py`; this acceptance changes no
SOC bytes. The AI resolver seam is documented at
`cybrik-cyber-ai-platform:services/ai-api/src/cybrik_ai_api/transport_security.py`; this acceptance
does not claim that seam is wired or runtime-proven. Tool Fabric is not exercised by the create-only
path and remains pinned only by Suite governance.

See the [server candidate matrix](01-server-candidate-matrix.md). Separate-process execution, real
loopback TLS, development PKI, and PostgreSQL durability remain HOLD. Static validation is not UAT.
