# Delegated Governor D2 coverage-closure recovery — 2026-08-02

Status: `R1 CONSUMED — FAILED PRE-NETWORK — R2 CONSUMED — FAILED AFTER WHEEL ACQUISITION — R3 AUTHORIZED — EXECUTION NOT RUN — RUNTIME HOLD`.

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

This R1 exact-action authority was consumed by the first `--execute` attempt against the two roots
in section 2. It is not reusable for a different root, dependency set, repository, runtime action
or production/public release.

## 7. R1 terminal execution evidence

R1 executed once at Suite commit `26d680fbfc1bc9cb25c63f089569c60fcbc54e2b`, tree
`df54838f6cc84785f50483f869e0bd3a41b56572`. Attempt
`7a8f6f6e1c09abf421e327bf5093348c2f0a23a97d73a39fdab038504ab16e11` failed before any wheel
download or other permitted network action with `requirements_identity_mismatch`. The runner
removed the fresh R1 closure root and preserved:

- `recovery-start.json` SHA-256
  `ab5b29db2a45e9328bf52d9ac38fd70335722721d65c8d24611e8a92a7d5c05b`;
- `recovery-failure.json` SHA-256
  `6a88a0139df170d359160922953dac327091a795ae1dc76def0cb41828002cab`;
- evidence root
  `/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-evidence-r1`.

The cause is deterministic: the historical D1 full-file requirements digest included two uv
autogenerated header lines containing the deleted cache/output paths, while R1 intentionally used
new durable paths and `--no-cache`. Reconstructing those exact historical header lines from the
committed D1 `export_command` plus the current exported body reproduces the unchanged historical
SHA-256 `93ec6936e7999ee68e04434b563581ccc5a2e3b4010e252554048b7f75bf1603`.

## 8. Exact R2 retry authorization

R2 is the sole correction attempt authorized by Appendix D. It keeps the ten-path repository
scope in section 2 and uses only these new fresh outside-repository roots:

- closure root: `/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-r2`;
- evidence root: `/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-evidence-r2`.

Before either R2 root can be created, the runner must verify the exact R1 evidence/root state and
run two `uv export` probes to stdout with `--offline`, `--no-cache` and no output file. One probe
uses `--no-header`; the other retains exactly two valid autogenerated header lines. Their bodies
must be byte-identical and have SHA-256
`bf3fc708b271e245eacc1b0696f6892935fec9f45fda762fd5d041d0bdb7d07d`. Reconstructing the D1
historical header plus that body must reproduce `93ec6936e7999ee68e04434b563581ccc5a2e3b4010e252554048b7f75bf1603`.

Only a successful `--check-only` result with no R2 root may precede the first R2 `--execute`. The
actual R2 requirements file is exported with `--no-header --offline`; every wheel, closure and
negative gate in sections 3–5 remains unchanged. R2 is consumed when `_execute` creates its fresh
evidence root. Any R2 failure exhausts this authorization and requires a separately reviewed new
record; no automatic R3 exists. D2 runtime and every release boundary remain **HOLD**.

R2 passed `--check-only` and executed once at Suite commit
`7e2db401aefe18428a507f4a32fade3106a360b5`, tree
`1c23aee6ab0f1b619a03696cbed5e1745a8da9cb`. Attempt
`13c07a0ffc8f47f99bc274bdd196234bc82c410ab30224914bc2c9aaaf5a44d2` reproduced both requirements
digests, completed the permitted 56-wheel acquisition and wheelhouse verification, then failed
closed with `venv_identity_mismatch`. The runner removed the fresh R2 closure root and preserved:

- `recovery-start.json` SHA-256
  `de64c42ca6054260f52a8f04822f27f5f576c73c381be20c55c86dbd37f28c15`;
- `recovery-failure.json` SHA-256
  `c979869dde1e9e3c1378addee8223b2626d73e735a0b159c0dd072782c3947a7`;
- `requirements-failure.txt` SHA-256
  `bf3fc708b271e245eacc1b0696f6892935fec9f45fda762fd5d041d0bdb7d07d`;
- evidence root
  `/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-evidence-r2`.

R2 proves only that uv `0.11.16` did not create the downstream-required literal
`bin/python -> python3.12` link; the rolled-back closure and preserved R2 evidence do not contain
the full three-link graph. The current-host uv default is therefore treated as the bounded R3
inference `bin/python -> <absolute pinned interpreter>`, `bin/python3 -> python`, and
`bin/python3.12 -> python`, not as an R2 observation. R3 must verify that exact inference before
mutation and record the observed/expected link diagnostics on any failure. R2 is terminal consumed
history and is not reopened or retried.

## 9. Exact R3 venv-link correction authorization

R3 is one separately reviewed correction for the R2 command-contract defect. It preserves the
exact ten repository paths in section 2, every dependency, digest, executable, endpoint, negative
gate and exclusion, and uses only these fresh roots:

- closure root: `/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-r3`;
- evidence root: `/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-evidence-r3`.

Before either R3 root can be created, the runner must verify the exact R2 evidence digests above,
the absent R2 closure root, the detached clean Suite commit/tree supplied to the runner, and the
same two offline stdout requirements probes and historical reconstruction required by R2.

After `uv venv --no-seed` creates the fresh environment and before offline sync, the runner may
perform exactly one descriptor-anchored link normalization inside that fresh closure root:

1. verify owned, non-group/other-writable `venv` and `venv/bin` directories and the exact initial
   link graph `python -> <absolute pinned interpreter>`, `python3 -> python`,
   `python3.12 -> python`;
2. replace `python3.12` first with a link to the exact absolute pinned interpreter;
3. replace `python` with the relative link `python3.12`, retaining `python3 -> python`;
4. verify all three literal targets, resolve `python` to the exact pinned regular interpreter and
   reverify its pinned SHA-256 before offline sync.

Any initial-graph drift, non-link, ownership/mode issue, relink error, literal-target drift,
realpath drift or executable-digest drift fails closed and triggers the same identity-bound
full-closure rollback. Failure evidence records the expected and safely observed link graph so a
future decision never depends on reconstructing deleted-root state. The exact R3 closure/evidence
roots are pins, not caller-selectable retry names. This adds no dependency, endpoint, network
phase, runtime or product authority.

Only a successful non-mutating `--check-only` against a clean detached exact R3 commit/tree may
precede the sole R3 `--execute`. R3 is consumed when `_execute` creates its fresh evidence root.
Any R3 failure exhausts this record; there is no automatic R4. D2 runtime, Coverage.py extraction,
N1–N10 and every demo/POC/RC/GA/production or release boundary remain **HOLD**.
