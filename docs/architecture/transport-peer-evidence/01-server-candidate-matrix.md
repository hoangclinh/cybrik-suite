# Server candidate matrix

Status: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED**. Gate W2-K, v0.1.0; not stable v1/GA.

| Candidate ID | Version considered | Artifact scope | Selected | Installed | Pinned | Disposition | Reason |
|---|---|---|---:|---:|---:|---|---|
| `anycorn` | `0.20.0` | `official_upstream_distribution` | no | no | no | **HOLD** | Raw Anycorn `0.20.0` retains the open HIGH finding; it is not installed and not pinned, and released bytes do not contain the recorded hardened-SSL-options fix. |
| `hypercorn` | — | `official_upstream_distribution` | no | no | no | UNASSESSED | No runtime ASGI TLS-extension probe or adapter audit exists. |
| `granian` | — | `official_upstream_distribution` | no | no | no | UNASSESSED | No runtime ASGI TLS-extension probe or adapter audit exists. |
| `anycorn-cybrik-uat-b1` | `0.20.0+cybrik.1` | `internal_uat_evaluation_artifact`; install scope `suite_uat_tool_lock_only` | no | yes | yes | **HOLD** | `D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN`: exact B1 is installed and pinned only in the isolated UAT tool scope; D2 patch mitigation remains `NOT PROVEN`. |

No row is a recommendation. A future candidate must expose server-verified peer evidence, pass the
same no-degrade and secret-boundary suite, and receive a separate runtime admission. Waiting for an
upstream release remains a background watch item, not the critical path. K5 records the distinct
B1 identity and S1 admits evaluation only; neither selects a product server. The packet retains
`server_neutral=true` and `selected_server=null`. D1 dependency artifact evidence is complete,
D2 remains **HOLD** for runtime, and UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO.

Unqualified “Anycorn `0.20.0`” means only `id=anycorn` with
`artifact_scope=official_upstream_distribution`. PEP 440 public-version equivalence must never
collapse that raw release into `id=anycorn-cybrik-uat-b1`; ID plus artifact scope are authoritative.

The local harness profile forbids a trusted-boundary adapter. It must obtain peer evidence from the
serving process that verified the chain, not from a client or forwarded header.
