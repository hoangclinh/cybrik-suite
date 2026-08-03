# Integrated master Phase A runtime authorization

Status: `RUNTIME_AUTHORIZED — NOT RUN — NON-PRODUCTION ONLY`.

Recorded: `2026-08-03T16:35:00Z`.

This record authorizes exactly one bounded non-production attempt of the
Suite-owned integrated SOC → Cyber AI → Tool Fabric harness. It does not certify
UAT, demo, POC, RC, stable v1.0, GA or production readiness. Release dates are
unchanged and production remains Founder-controlled.

## Exact candidate tuple

| Repository | Commit | Tree |
|---|---|---|
| Suite | `8e6f05f823b237b8c1b93e630182d570062b239e` | `1cfc07c2c5c2ddc7789533297f7ac8661ba2aa3a` |
| SOC | `abfdfde96afc6daa2868694de993c623daa8862e` | `241ef24a33246918ff5cf133e7d8d004823fdf06` |
| Cyber AI | `51377267c6adbd7860270253cb212681001c7b1e` | `831a24ffd3033f966f35a9daab9f5d8af81e8b64` |
| Tool Fabric | `50aff1df146d6e98b33d9f82617781595bcf1512` | `2b4d516eef0a3b0ae05b44a225515efef749f25b` |

The four worktrees were observed clean. The integrated preparation step observes
each commit, tree, cleanliness state and the allowlisted tracked-blob aggregate
twice; any change fails closed before an unsigned packet is written.

## Hosted and local evidence

- Suite run `30832023474`: `secret-scan` and
  `contract standards validation` passed on the exact Suite commit.
- SOC run `30641710439`: all rendered required checks passed. `e2e-org` and
  `alert-context-route-db` were skipped by the workflow and are recorded as
  suppressed, not required checks.
- Cyber AI run `30832880217`: scaffold, lockfile, lint, type, test,
  build-offline, secret-scan and security-supply-chain passed on the exact
  Cyber AI commit. Coordinator-reported supplemental local pre-push evidence
  was `1044 passed, 17 skipped`, with `93.04%` branch coverage; the hosted run,
  not this supplemental measurement, is the exact-head admission evidence.
- Tool Fabric run `30797481044`: scaffold-integrity, secret-scan, detect,
  control-plane, executor and admission-gate passed on the exact Tool Fabric
  commit.
- Integrated master static suite: `164 passed`; Ruff check and format check
  passed; working-tree and full-history gitleaks scans passed.
- D2 bounded static suite: `1692 passed, 2 skipped`; nine D1-artifact tests were
  omitted because no composite D1 artifact root was supplied.
- Alert-context bounded static subset: `250 passed`; six dependency-bound files
  were not rerun because the existing offline environment lacked `referencing`.

The omissions above are explicit limitations and receive no runtime credit. The
exact signed runtime must still execute every admitted negative and rollback
check before any result profile can be evaluated.

## Exact execution boundary

The current attempt starts as `not_run` with zero executed checks. Execution is
permitted only after all of the following remain true:

1. the exact four-repository tuple above is still clean;
2. the external public allowed-signers file, pinned Python executable and
   patched B1 wheel match their tracked identities and digests;
3. six disjoint empty current-UID mode-`0700` capability roots exist outside all
   repositories;
4. a deterministic no-trailing-newline master payload is generated from this
   exact tuple and signed externally by `FOUNDER` with SSHSIG namespace
   `cybrik-uat-soc-ai-fabric-v1`;
5. ports `127.0.0.1:55432`, `127.0.0.1:58442`, `127.0.0.1:58443` and
   `127.0.0.1:58444` are absent before execution; and
6. a separate clean detached Suite worktree at exact commit
   `8e6f05f823b237b8c1b93e630182d570062b239e` is used; from its
   `integration/compose/integrated-uat` directory, the exact
   `python -B -P scripts/run_integrated_uat.py --execute` entry point is invoked
   once with the signed payload. No alternate runner is authorized.

The runner consumes the authorization permanently before entering child stages.
A post-consumption failure is terminal evidence and is not permission to retry.

## Data, findings and network

Only generated synthetic tenant, organization, actor, alert, investigation,
delegation and receipt values are permitted. Production credentials,
configuration, data and traffic are prohibited. The four listeners are bound to
loopback only. No Ollama service, Internet egress, public listener or production
system is part of this attempt.

There are zero open Critical and zero open High findings on the exercised exact
path. The raw upstream Anycorn artifact is excluded. Admission pins only the
reviewed patched B1 wheel with SHA-256
`d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c`.

## Negative and rollback contract

Static verification passed the candidate's cross-tenant, tenant-organization,
wrong audience, wrong scope, wrong operation, replay, certificate-binding,
missing-TLS-extension, PostgreSQL-unavailable, Fabric-denial, receipt-tamper and
restricted-material checks. The admitted runtime must execute the corresponding
N1–N10 and F1–F2 paths. Any failed tenant-isolation, authorization or secret
boundary check is immediate `NO-GO`.

Every terminal path runs the idempotent common teardown, proves the four ports,
PostgreSQL, child processes, containers, ephemeral PKI and restricted material
absent, and writes an immutable terminal seal that binds the absence-proof
digest. Stop/reset is teardown plus the exact absence proof. Seed occurs only
inside the child stages from synthetic fixtures. Rollback is the same teardown
and evidence-preservation path; it never retries the consumed attempt.

## Governor disposition

The ten non-production admission items are present and the exact current attempt
is `RUNTIME_AUTHORIZED`. This is permission to collect bounded runtime evidence,
not a UAT pass. UI/persona UAT remains a separate gate under
`docs/uat/UAT-GATE-STANDARD.md`; the backend harness exposes no browser URL or UI
account.
