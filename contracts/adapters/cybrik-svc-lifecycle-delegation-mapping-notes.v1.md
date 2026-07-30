# CYBRIK W2-F lifecycle-delegation binding notes v1

Status: **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** (v0.1.0; not stable v1/GA).

This additive proposal restricts the accepted W2-F service-delegation validation view to the
accepted investigation-lifecycle surface. It reuses the accepted `cybrik.svc-*` schemas without
modifying them and declares no new schema, endpoint, transport, runtime, deployment, release, or
acceptance authority. The relying-party audience is exactly `svc:cyber-ai-lifecycle`.

## Exact external operation mapping

| REST operation | Delegation operation | Exact scope | Disposition |
|---|---|---|---|
| `createInvestigation` | `investigation.create` | `investigation.lifecycle:create` | SOC may mint one short-lived request token. |
| `getInvestigationStatus` | `investigation.status` | `investigation.lifecycle:read` | SOC may mint one short-lived request token. |
| `listInvestigationCheckpoints` | `investigation.status` | `investigation.lifecycle:read` | This is an external read of producer-owned checkpoints, not a checkpoint write. |
| `cancelInvestigation` | `investigation.cancel` | `investigation.lifecycle:cancel` | SOC may mint one short-lived request token. |
| `readInvestigationBundle` | `investigation.bundle_read` | none | This is already an accepted business lifecycle operation with an accepted v0.1.1 response contract. This proposed binding grants it no delegation authority: no token is minted or consumed while the current Cyber AI implementation remains unconditional refusal. |

The exact-scope rule is deliberately singular: a lifecycle token contains exactly the one scope
mapped to its operation. Extra scopes are rejected rather than treated as harmless.

## Non-delegatable operations in this proposed binding

- `investigation.checkpoint` is an internal Cyber AI producer write. It is not delegatable by SOC.
- `readInvestigationBundle` / `investigation.bundle_read` is already a declared accepted business
  lifecycle operation, and accepted v0.1.1 is the authoritative response profile for new bundle
  reads. This proposal does not reopen or weaken that accepted contract. It declines only W2-F
  delegation authority for this operation because the current Cyber AI implementation is still
  unimplemented and returns unconditional refusal. That current refusal path must neither mint nor
  consume a token.

## Restriction over accepted W2-F

Every permitted call must satisfy all accepted W2-F checks and these additional restrictions:

1. `aud`, the relying-party audience, and pinned trust metadata all equal
   `svc:cyber-ai-lifecycle`.
2. The mTLS peer certificate thumbprint equals `cnf["x5t#S256"]`; `require_mtls` and
   `require_cnf` remain `true`.
3. The token lifetime is at most 120 seconds; issuer, algorithm, time window, and `kid` are checked
   against pinned trust.
4. Body tenant, optional org, actor, operation, and marking are advisory and cannot widen the
   signed token. Tenant/org/actor mismatches and marking escalation are rejected.
5. Operation and exact scope must match the table above. A token for one operation is never
   reusable for another.
6. `jti` is single-use for its validity window. Replay is rejected.

This proposal does not turn lifecycle delegation into a Fabric tool grant, approval, capability,
credential lease, action authority, MCP surface, or model-inference token.
