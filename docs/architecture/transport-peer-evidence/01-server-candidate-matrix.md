# Server candidate matrix

Status: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED**. Gate W2-K, v0.1.0; not stable v1/GA.

| Candidate | Selected | Installed | Pinned | Disposition | Reason |
|---|---:|---:|---:|---|---|
| Anycorn `0.20.0` | no | no | no | **HOLD** | Existing HIGH finding: released bytes do not contain the recorded hardened-SSL-options fix. Anycorn is not installed and not pinned. |
| Hypercorn | no | no | no | UNASSESSED | No runtime ASGI TLS-extension probe or adapter audit exists. |
| Granian | no | no | no | UNASSESSED | No runtime ASGI TLS-extension probe or adapter audit exists. |

No row is a recommendation. A future candidate must expose server-verified peer evidence, pass the
same no-degrade and secret-boundary suite, and receive a separate runtime admission. Waiting for an
upstream release remains a background watch item, not the critical path. An internal Anycorn fork is
not authorized by W2-K.

The local harness profile forbids a trusted-boundary adapter. It must obtain peer evidence from the
serving process that verified the chain, not from a client or forwarded header.
