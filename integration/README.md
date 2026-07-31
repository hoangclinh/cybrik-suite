# integration/ — Cross-product integration

Status: `ACTIVE TEST SCAFFOLD` — one Suite-owned in-process SOSIM fixture exists under
`fixtures/`. It is not a deployable integration environment, UAT, mTLS, or release proof.
No Docker Compose or Helm manifests have been authored, and none should be fabricated ahead of
real, runnable integrations.

| Directory | Will contain |
|---|---|
| `compose/` | Local multi-product composition for development/integration testing |
| `helm/` | Suite-level deployment charts (if/when adopted) |
| `fixtures/` | Shared synthetic test data (never real customer/production data) |
| `compatibility/` | Cross-product compatibility test configurations |

Local runtime data (volumes, `.data/`) is gitignored.

The current SOC-to-Cyber-AI lifecycle-create fixture pins exact product commits and trees for
the test-only harness in `tests/e2e/`. It contains synthetic metadata only and provides no
runtime transport-attestation or deployment evidence.
