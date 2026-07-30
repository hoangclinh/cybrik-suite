# W1 CI3 Dependency Remediation R1

Status: `LOCAL CANDIDATE GO — AUTHORING SNAPSHOT BEFORE COMMIT/PUSH/MERGE — HOSTED CI PENDING`.

Base: `554ada18ee6855a967de8a5425efc5edf89bb908`.

## 1. Problem and rejected approach

The base lockfile reported 0 Critical and 13 High entries from
`GHSA-mh99-v99m-4gvg`, rooted in the Spectral/AsyncAPI path through
`minimatch@3.1.5` and `brace-expansion@1`.

A direct root override to `brace-expansion@5.0.9` made `npm audit` green but was rejected.
`minimatch@3` requires the legacy CommonJS module itself to be callable, while upstream
`brace-expansion@5` exposes the patched implementation as the named `expand` function. The
rejected graph threw `TypeError: expand is not a function` for brace patterns. No bytes from that
rejected graph are accepted as the solution.

## 2. Accepted design

The repository-local `vendor/brace-expansion-compat` package:

- is installed as the explicitly downstream-labelled adapter
  `brace-expansion@5.0.9-cybrik.1`;
- depends on the exact upstream patched package as the alias
  `brace-expansion-v5@npm:brace-expansion@5.0.9`;
- exports the upstream `expand` function through both the legacy callable CommonJS surface and the
  named `expand` surface; and
- copies no expansion algorithm.

The root npm override resolves every legacy `brace-expansion` consumer to this adapter. This keeps
Spectral CLI behavior stable while using the patched upstream expansion implementation.

## 3. Enforced scope

The implementation candidate changes exactly these ten paths:

1. `.github/workflows/contracts.yml`
2. `tools/contract-validation/README.md`
3. `tools/contract-validation/package-lock.json`
4. `tools/contract-validation/package.json`
5. `tools/contract-validation/tests/dependency-compat.test.mjs`
6. `tools/contract-validation/validate.mjs`
7. `tools/contract-validation/vendor/brace-expansion-compat/index.cjs`
8. `tools/contract-validation/vendor/brace-expansion-compat/package.json`
9. `tools/operations/tests/validate-w1-control.test.mjs`
10. `tools/operations/validate-w1-control.mjs`

Governance and evidence documents are tracked separately from this implementation count.

## 4. TDD and verification

The compatibility tests first failed 0/2 against the rejected direct override, reproducing the
runtime exception and the non-callable export. They now pass 2/2.

An independent read-only Opus attempt
`6e5614fe-e56c-4224-a4df-06a53c874bc3` reached its exact 600-second ceiling with exit 124,
`status=timeout`, `contentCaptured=false` and no verdict. It is not represented as a pass. Under
the delegated-governor fallback, Codex then completed the diff review, changed the adapter version
from the potentially misleading upstream-looking `5.0.9` to `5.0.9-cybrik.1`, exposed and tested
the upstream expansion bounds, and re-ran the full evidence set. Final self-review:
`P0=0`, `P1=0`, `P2=0`, `P3=1`; the single P3 is the retained `glob@7` maintenance item in §5.

Current local evidence:

- `npm ci`: pass with lifecycle scripts disabled;
- `npm audit --audit-level=high`: 0 vulnerabilities;
- dependency compatibility: 2/2;
- W1 control: 202/202;
- accepted W1 static contracts: 98/98 with exact count enforcement;
- canonical `npm run validate`: pass;
- Spectral: 0 errors and 19 pre-existing warnings;
- AsyncAPI: 0 errors; and
- `git diff --check`: clean.

The CI workflow now runs the high-severity dependency audit explicitly after `npm ci`, and the
canonical validator runs the compatibility regression before Spectral.

## 5. Disposition and residual risk

Codex Governor disposition: `LOCAL CANDIDATE GO`.

The dependency-specific CI3 blocker is cleared locally. Push and canonical merge require a clean
reviewed commit and passing hosted required checks. No hosted result is claimed here.

The Spectral CLI graph still contains deprecated `glob@7`; the current npm advisory database
reports no vulnerability after this remediation. The adapter remains a maintenance item until
upstream Spectral no longer requires the legacy callable dependency surface. Neither residual is a
runtime-product claim.

Runtime, local stack, demo and UAT remain `NO-GO`; release dates are unchanged; production remains
Founder-controlled.

## 6. Canonical integration evidence

The authoring snapshot above was executed after its gates passed:

- implementation commit:
  `f82f45e8d56be27651c56e8d1510877f48563224`;
- branch: `codex/w1-ci3-dependency-remediation-r1`;
- pull request: `https://github.com/hoangclinh/cybrik-suite/pull/1`;
- canonical merge:
  `28c564eb9b6853b73a18a59a2e84ba58fd67816a`;
- merge parents: hosted `main` base
  `5a4823f06ce9b12083e13cf9b1031f46130d90a8`, then reviewed implementation
  `f82f45e8d56be27651c56e8d1510877f48563224`;
- merge tree: `f222fad6bc6d3682684a0975f47a5415f7f716dc`, byte-identical to the
  implementation tree;
- push checks: run `30537452524`, both jobs passed;
- pull-request checks: run `30537544800`, both jobs passed; and
- post-merge canonical checks: run `30537649671`, both jobs passed.

`main` protection is strict and requires the rendered check names
`contract standards validation` and `secret-scan (gitleaks 8.30.1)`. Admin enforcement remains
enabled; force-push and deletion remain disabled.

Rollback is a normal merge revert, for example `git revert -m 1 28c564eb…`, followed by the same
required checks. That command is documented only and was not run.

Hosted runners emitted a nonblocking maintenance warning that the pinned GitHub actions still
target the deprecated Node 20 action runtime and are being forced to Node 24. This is a new hosted
`P3`; it does not mean the validator target changed — `actions/setup-node` installed and used the
pinned Node.js 20.18.1 validator runtime. A separate action-pin refresh should remove the warning.

Canonical integration changes no runtime/UAT decision, no release date and no production
authority.
