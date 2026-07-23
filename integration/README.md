# integration/ — Cross-product integration

Status: `SCAFFOLD` — **no integration harness exists yet.** Every subdirectory is
intentionally empty; no Docker Compose or Helm manifests have been authored, and none should
be fabricated ahead of real, runnable integrations.

| Directory | Will contain |
|---|---|
| `compose/` | Local multi-product composition for development/integration testing |
| `helm/` | Suite-level deployment charts (if/when adopted) |
| `fixtures/` | Shared synthetic test data (never real customer/production data) |
| `compatibility/` | Cross-product compatibility test configurations |

Local runtime data (volumes, `.data/`) is gitignored.
