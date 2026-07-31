# docs/architecture

Status: mixed lifecycle. Product/runtime architecture remains outside this repository.

Suite-level (cross-product) architecture documents. Product-internal architecture stays in each product repository.

- `org-hierarchy/` — accepted-for-implementation W2-G model and separately gated product mapping.
- `resource-bounds/` — **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** Gate W2-H static contract
  architecture for conserved call-tree credits and deterministic replay. It is not a runtime,
  T10/T11 measurement, UAT, release, deployment, or production design.
- `transport-peer-evidence/` — **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** Gate W2-K
  server-neutral, fail-closed peer-evidence adapter profile. It selects no server and proves no
  runtime, UAT, release, deployment, or production readiness.
