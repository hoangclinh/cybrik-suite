# tests/ — Suite-level tests

Status: `ACTIVE TEST SCAFFOLD` — one Suite-owned cross-product SOSIM exists under `e2e/`.
It is test-only evidence, not UAT, mTLS, deployment, or release proof.

| Directory | Will contain |
|---|---|
| `contract/` | Contract conformance tests: verify each product against `contracts/` |
| `e2e/` | End-to-end scenarios spanning two or more products |

Product-internal tests live in each product repository. Only cross-product verification
belongs here. The current SOC-to-Cyber-AI lifecycle-create harness executes both products
in-process at exact immutable pins and deliberately excludes sockets, containers, databases,
and production trust. Test data must be synthetic — see `SECURITY.md` and `e2e/README.md`.
