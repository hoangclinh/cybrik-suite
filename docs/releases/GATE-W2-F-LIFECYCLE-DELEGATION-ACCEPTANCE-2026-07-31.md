# Gate W2-F-LIFECYCLE-BINDING — acceptance (2026-07-31)

- **Decision:** `ACCEPTED FOR IMPLEMENTATION` at v0.1.0; `NOT IMPLEMENTED`.
- **Authority:** Codex Governor under Founder-delegated technical authority.
- **Reviewed base:** `303749dd0e2e5f35360870c6844ea07ef4d97d88`.
- **Stability:** not stable v1/GA and not an ADR-0001 immutable bundle tag.

## Accepted boundary

This decision accepts only the additive restriction profile that binds the accepted W2-F
service-delegation validation view to the accepted investigation-lifecycle operations below, for
the exact relying-party audience `svc:cyber-ai-lifecycle`:

| Business operation | Delegation operation | Exact scope |
|---|---|---|
| `createInvestigation` | `investigation.create` | `investigation.lifecycle:create` |
| `getInvestigationStatus` | `investigation.status` | `investigation.lifecycle:read` |
| `listInvestigationCheckpoints` | `investigation.status` | `investigation.lifecycle:read` |
| `cancelInvestigation` | `investigation.cancel` | `investigation.lifecycle:cancel` |

All accepted W2-F controls remain mandatory: pinned asymmetric issuer and algorithm, mutually
authenticated transport, certificate-bound `cnf`, a maximum 120-second lifetime, authoritative
tenant/org/actor/operation/marking binding, exact single scope and single-use `jti` replay denial.

## Preserved prohibitions

- `investigation.checkpoint` remains an internal Cyber AI producer write and is not delegatable.
- `readInvestigationBundle` remains an accepted business lifecycle operation, but
  `investigation.bundle_read` receives no delegation authority under this profile. No caller may
  mint and no relying party may consume such a token. A separate accepted implementation and
  contract gate is required to change that rule.
- W2-F delegation is not Fabric tool, capability, approval, action, MCP or credential authority.

## Non-claims

This status flip changes no wire payload, fixture semantics, endpoint, route, socket, runtime,
deployment, mTLS rollout or token mint/verifier wiring. It proves no local stack, UAT,
`DEMO_READY_LOCAL`, release readiness or production readiness. Release dates are unchanged.

Green static validation proves only packet integrity and adversarial fixture coverage. Product
implementations must still prove every LSD-1..LSD-11 runtime obligation, tenant/authz negative,
durable replay behavior and degraded behavior in an admitted exact-build runtime candidate.

## Verification at the acceptance bytes

- `node --test --experimental-test-coverage tests/validate-svc-lifecycle.test.mjs`: 22/22 pass;
  93.15% line, 86.88% branch and 100% function coverage for the validator.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm run validate`: ALL GREEN across the registered mixed-lifecycle static contract corpus;
  OpenAPI validation has zero errors (existing style warnings remain warnings).

These results are static contract evidence only and do not alter any non-claim above.
