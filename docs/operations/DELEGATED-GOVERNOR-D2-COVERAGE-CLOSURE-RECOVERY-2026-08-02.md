# Delegated Governor D2 coverage-closure recovery — 2026-08-02

Status: `AUTHORIZED EXACT NON-PRODUCTION ACTION — NOT YET EXECUTED`.

## 1. Authority and outcome

The Founder objective supplied to the active Codex Governor task, whose exact UTF-8 bytes have
SHA-256 `edbbe5441a7bfbb95a739e641f697b62d53b264589386717ee42c50151b38291`, authorizes the
Governor to run bounded dependency installation, build and local development/UAT preparation while
reserving production, public release/GA, legal claims, acceptance of Critical/High risk and
material trust-boundary changes to the Founder. This record applies that authority to one
reversible prerequisite for `UAT-MTLS-D2-COV-P0`: reconstruct the already locked D1 test closure
outside every repository and temporary root.

This is an execution authorization, not acceptance evidence. Completion requires the runner,
artifact inventory, exact installed-distribution digest, tests and independent review to pass.
`UAT-MTLS-D2`, runtime UAT, demo, POC, RC, stable-v1, public GA and production remain `HOLD` or
`NO-GO` according to their existing gates.
Production and public GA remain Founder-controlled.

## 2. Exact repository and path scope

- repository: `cybrik-suite`;
- authorization base: `9f2f43309f73d34acdff1f4e9125aa3513d2fc2d`;
- closure root:
  `/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-r1`;
- preserved evidence root:
  `/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-evidence-r1`;
- repository writes are limited to exactly these ten paths:
  1. `CLAUDE.md`;
  2. `docs/operations/DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md`;
  3. `docs/operations/DELEGATED-GOVERNOR-D2-COVERAGE-CLOSURE-RECOVERY-2026-08-02.md`;
  4. `docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md`;
  5. `integration/compose/soc-ai-lifecycle-create-mtls/README.md`;
  6. `integration/compose/soc-ai-lifecycle-create-mtls/scripts/recover_coverage_closure.py`;
  7. `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_coverage_closure_recovery.py`;
  8. `integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py`;
  9. `integration/compose/soc-ai-lifecycle-create-mtls/evidence/coverage-closure-recovery.json`
     (a post-execution summary authored from verified outside-repository evidence, not a runner
     output path);
  10. `tools/contract-validation/tests/validate-transport.test.mjs`;
- generated dependency bytes and execution evidence stay outside the repository.

Both outside-repository roots must be absent at execution start. Their existing parents must be
canonical directories owned by the effective uid and not writable by group or other. The roots
must be disjoint from one another, all Suite/product repositories, `/tmp`, `/private/tmp` and the
canonical Darwin per-user temporary directory. Each new root is mode `0700`; evidence files are
mode `0600`.

## 3. Pinned inputs and permitted dependency action

The exact inputs are:

- `/opt/homebrew/bin/uv` version `0.11.16`, resolved executable SHA-256
  `96e422f83fd306848446170d97c1d1af8290f00e4aacfa7134e130280d573126`;
- `/Users/hoanglinh/.local/share/uv/python/cpython-3.12.13-macos-aarch64-none/bin/python3.12`,
  CPython `3.12.13`, SHA-256
  `a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623`;
- base-interpreter `pip==26.1.1` only as the hash-enforcing wheel downloader;
- Suite `uv.lock` SHA-256
  `e05c5e281e230b2089e356d716212a6d2c2e4320a3a30dc8dfd126216faa3add`;
- exported requirements SHA-256
  `93ec6936e7999ee68e04434b563581ccc5a2e3b4010e252554048b7f75bf1603`;
- exactly the 56 filenames and SHA-256 values recorded in
  `integration/compose/soc-ai-lifecycle-create-mtls/evidence/dependency-lock.json`;
- installed closure SHA-256
  `6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919`.

The runner may perform, in this order only:

1. a locked `uv export` with `--no-emit-project`, `--no-emit-local`, `--no-sources`, the `test`
   dependency group and no caller configuration;
2. one hash-enforced, wheels-only download resolution through `https://pypi.org/simple`, accepting
   only the exact lock-evidenced `files.pythonhosted.org` wheel filenames and hashes;
3. a no-seed `uv venv` using the pinned interpreter;
4. one `uv pip sync` using only the verified local wheelhouse with `--no-index`, `--find-links` and
   `--require-hashes`;
5. isolated inventory verification and bounded evidence emission.

Proxy use, redirects selected by caller configuration, alternate indexes/mirrors, sdists, build
frontends, editable/project installation, user site-packages, dependency mutation and reuse of a
pre-existing root are forbidden. Absolute executable paths and sanitized environment variables
are mandatory.

## 4. Acceptance and negative gates

Recovery is `PASS` only when all of the following are true:

- the exported requirements digest is exact;
- the wheelhouse contains exactly the 56 recorded wheel filenames and every digest is exact;
- the target environment contains exactly 56 canonical distributions;
- its closure digest is exact;
- `pytest==9.1.1` and `cryptography==50.0.0`;
- `anycorn`, `coverage`, `pip`, `setuptools` and `wheel` are absent;
- no repository byte or product environment changed;
- the success evidence binds commands, tool identities, roots, input/output digests and package
  inventory;
- focused tests and independent review pass.

Any mismatch is a hard stop. A failure record is preserved in the separately identity-bound
evidence root. Rollback may remove only the fresh closure root whose recorded `st_dev` and `st_ino`
still match and whose contents were created by this attempt; ambiguity preserves the path for
manual inspection. The evidence root is never removed by automated rollback.

## 5. Explicit exclusions

This action does not:

- install or extract Coverage.py;
- install, select, execute or change Anycorn/B1;
- modify `pyproject.toml`, `uv.lock`, product repositories, product dependencies or environments;
- create listeners, certificates, keys, containers or databases;
- run migrations, N1-N10, the local stack or any product process;
- change `legal_approval`, VEX disposition or accept a Critical/High risk;
- satisfy coverage, runtime admission, UAT, demo, POC, RC, GA or production gates.

After exact recovery and independent review, the separate D2 coverage-tooling authorization and
coverage measurement gates remain mandatory.

## 6. Rollback and governance expiry

Before execution, rollback is deletion of this unmerged packet. During execution, rollback is the
bounded identity-checked closure-root removal described above. After canonical merge, governance
rollback is a normal revert; generated local evidence remains immutable historical evidence.

This exact-action authority is consumed by the first `--execute` attempt against the two roots in
section 2. It is not reusable for a different root, dependency set, repository, runtime action or
production/public release.
