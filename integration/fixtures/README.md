# integration/fixtures

Status: `SCAFFOLD` / `TEST-ONLY` / `SOSIM` / `NOT UAT` / `NOT mTLS` /
`NOT deployment` / `NOT release proof`.

Shared synthetic test data only — never real customer or production data.

`soc-ai-lifecycle-create-sosim.v1.json` records the exact Suite-base, SOC, and Cyber AI
commit/tree tuple for the lifecycle-create harness, its exact create-only delegation authority,
and its nonclaims. It contains no token, private key, certificate, secret, customer identifier,
production log, or hosted-environment evidence. The runtime test key is generated afresh in
process and is never persisted or printed.
