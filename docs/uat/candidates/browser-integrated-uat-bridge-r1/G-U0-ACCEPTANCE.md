# G-U0 design/contract freeze acceptance

Status: `ACCEPTED — G-U0 FROZEN — OPENS BOUNDED G-U1 RED WORK ONLY`

Accepted by: delegated technical governor under the active Founder delegation.

Accepted at: `2026-08-04` Asia/Ho_Chi_Minh.

Release dates: unchanged. Production authority: Founder only.

## Exact reviewed packet

| Repository | Path | Bytes | SHA-256 |
|---|---|---:|---|
| SOC | `docs/architecture/ALERT-ORG-ATTRIBUTION-RLS-G-U0.md` | 38,556 | `121ba2e43f5687df7c7bb4c6ebda16fe65182228740df0c0a50c495726695f56` |
| SOC | `docs/architecture/INTEGRATED-INVESTIGATION-BFF-G-U0.md` | 29,928 | `a75f1a7ccc33346cdb4e3bf1e7eeeef1674f1454db37ca0d20812439df2d0b56` |
| SOC | `docs/architecture/BROWSER-INTEGRATED-UAT-G-U0.md` | 27,620 | `477c39992004b197137db73704961b3f6486f2c3a7484bf99995e9fae3e537a5` |
| Suite | `docs/uat/candidates/browser-integrated-uat-bridge-r1/README.md` | 32,466 | `990dd1ccc7ca24a4b65f003308ad2e23bfddf56e53bd35624a9f317817be248c` |

The SOC files above were reviewed from base `2fb98e85ed3ab19f80df8f8884cf41e3444e757a` before their
documentation commit. The Suite README was reviewed from base
`767ac080479be07171ec9c9e04fe8b9c3ef27f26` before this acceptance record. Commit identities are
recorded after landing; the content digests above are the acceptance identity.

## Independent review

- reviewer: Claude through 1DevTool, model alias `opus` under the configured Opus 4.8 preference;
- run: `1e585ff1-4f82-4c5d-a7d0-9e86935c6078`;
- mode: read-only, common parent worktree, no runtime, no secret access;
- result: `GO`;
- severity: `P0=0`, `P1=0`, `P2=0`;
- duration: 326 seconds.

The review rechecked all prior closures: tenant/org FORCE RLS coverage, the single normative
`0026` binding schema, target-free pre-read binding, exact receipt four-tuple, initiating/effective
actor binding, marking fail-closed behavior, parallel backend/UI gate convergence, non-circular
G-U5/G-U7 ordering, and application-access denial without treating CORS or loopback port absence
as the trust boundary.

Three editorial P3 notes remain intentionally nonblocking and do not alter the reviewed bytes:
one ambiguous heading, one source-gate use of the word `proof`, and minor FACT anchor line drift.

## Exact disposition

Permitted transition:

```text
UI_DESIGN_PENDING -> UI_TDD_OPEN
```

Permitted next work:

- G-U1 RED contract/security tests only;
- exact synthetic fixtures and expected denial oracles;
- no implementation may weaken or reinterpret the frozen packet.

Not authorized or proven by this acceptance:

- no migration, backfill, listener, local stack, browser URL or account issuance;
- no G-U2 implementation, G-U3 portal, G-U4 harness, G-U5 matrix readiness or G-U6 source closure;
- no G-U7 signed browser run;
- no backend `BACKEND_PROVED` claim;
- no UAT-ready, demo, POC, RC, GA, release or production claim.

The backend lane remains independently `BACKEND_PENDING`. `UI_SOURCE_READY` is reachable only when
the accepted UI source lane later completes G-U1..G-U6 and converges with an exact, independently
reviewed `BACKEND_PROVED` terminal result.
