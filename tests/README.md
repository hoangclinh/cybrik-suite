# tests/ — Suite-level tests

Status: `SCAFFOLD` — **no tests exist yet.** Subdirectories are intentionally empty.

| Directory | Will contain |
|---|---|
| `contract/` | Contract conformance tests: verify each product against `contracts/` |
| `e2e/` | End-to-end scenarios spanning two or more products |

Product-internal tests live in each product repository. Only cross-product verification
belongs here. Test data must be synthetic — see `SECURITY.md`.
