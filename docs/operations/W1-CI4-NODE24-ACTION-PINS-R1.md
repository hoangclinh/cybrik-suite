# W1-CI4 Node 24 action-pin refresh R1

- **Status:** `CANONICAL MERGED 2026-07-30`
- **Prepared:** 2026-07-30
- **Task / wave / ownership:** `W1-CI4`; W1 assurance lane; Suite CI/control ownership
- **Base:** `ad964697eed2d623863b0b034a6215b3dfe29e4e`
- **Repository:** `cybrik-suite`
- **Product outcome:** remove the deprecated Node 20 GitHub-action runtime from both required
  jobs and run the contract validator on a pinned Node 24 LTS security release.

## 1. Bounded packet

### In scope

1. Pin both `actions/checkout` uses to commit
   `3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7.0.1`).
2. Pin `actions/setup-node` to commit
   `820762786026740c76f36085b0efc47a31fe5020` (`v7.0.0`).
3. Pin validator execution to Node.js `24.18.1`.
4. Fail closed in the control validator and its tests if these exact pins or multiplicities drift.
5. Update the bounded control/evidence documentation.

### Out of scope

- product runtime, contracts, lifecycle/status acceptance, local stack, UAT, POC, RC or release;
- dependency-version changes or lockfile changes;
- new workflow permissions, secrets, credentials, deployment or production access;
- required-check renaming or branch-protection relaxation.

### Owner paths

- `.github/workflows/contracts.yml`
- `tools/operations/validate-w1-control.mjs`
- `tools/operations/tests/validate-w1-control.test.mjs`
- `tools/contract-validation/README.md`
- `docs/operations/W1-CI4-NODE24-ACTION-PINS-R1.md`
- `docs/operations/W1-48-AGENT-ROLLING-BOARD.md`
- `docs/operations/W1-E2-EVIDENCE-REGISTER.md`
- `docs/operations/README.md`

### Facts, assumptions and unknowns

- GitHub release/API facts refreshed on 2026-07-30: checkout `v7.0.1` resolves to the exact
  commit above; setup-node `v7.0.0` resolves to its exact commit above. Both reviewed
  `action.yml` files declare `runs.using: node24`.
- The official Node distribution index identifies `v24.18.1`, dated 2026-07-28, as the current
  Krypton LTS security release used by this packet.
- No contract changes are affected. No assumption substitutes for hosted execution.
- Hosted push, PR and canonical-main runs all completed successfully; their exact identities are
  recorded in §4.

Captured provenance commands and results:

| Command / object | Result |
|---|---|
| `gh api repos/actions/checkout/git/ref/tags/v7.0.1` | object type `commit`, SHA `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| checkout `action.yml` at that exact commit | Git blob `5b0524f730db83f9513c18ab31a6c086c7239076`; 5,144 bytes; SHA-256 `d59219cb79590abdb877deaa14e3b65a00c05318bf5a6f3b989b9162b5d08c35`; `runs.using: node24` |
| `gh api repos/actions/setup-node/git/ref/tags/v7.0.0` | object type `commit`, SHA `820762786026740c76f36085b0efc47a31fe5020` |
| setup-node `action.yml` at that exact commit | Git blob `dc1cefd59528621f6952ef3309bb6c551925b330`; 2,991 bytes; SHA-256 `5d765941ab5d8bef27f08e81b0b041cdb2df2050ea0261dc925d157a2bafbd2b`; `runs.using: node24` |
| `https://nodejs.org/dist/index.json` | SHA-256 `2b97b35ca87144ff59da0bc33c4804d32e5afe81eee8449316ab919fae37c87d`; first `v24` entry: `v24.18.1`, date `2026-07-28`, LTS `Krypton`, `security: true` |
| Node `v24.18.1` official `SHASUMS256.txt` | Darwin arm64 tar.xz `1d60b703fe5d7e7072489be8187f430f1a095a658c31e5e1e281331a5873fac3` |

### Security boundaries

- Existing workflow-level `contents: read` remains unchanged; no job-level permission override.
- Action tags are evidence only; execution uses immutable 40-hex commit pins.
- Full-history checkout, full-tree/full-history gitleaks, explicit high-severity dependency audit
  and the two rendered required-check names remain unchanged.

## 2. TDD and acceptance

User journey: as release governor, I want required CI to use reviewed Node 24 action commits so
that deprecated action-runtime fallback cannot silently persist.

| Gate | Evidence |
|---|---|
| RED | New exact-pin test executed against the old workflow: `tests 1`, `pass 0`, `fail 1`; intended mismatch `0 !== 2` for checkout |
| GREEN | Targeted pin/inline/noncanonical/split-or-explicit/unpinned tests: `5/5 PASS` |
| Full control on checksum-verified Node 24.18.1 | `206/206 PASS`; line `97.38%`, branch `90.97%`, functions `98.89%` |
| Control validator | `PASS`, fixed roster `tasks=48`; statically asserts configured workflow Node `24.18.1` |
| Contract/dependency/security on Node 24.18.1 | Canonical validate pass; W1 contracts `98/98`; dependency compatibility `2/2`; audit 0; Spectral 0 errors/19 warnings; AsyncAPI 0 errors; gitleaks dir/git clean |
| Hosted acceptance | `PASS` — both rendered required checks passed on push, PR and exact canonical merge; queried check annotations contain only expected Spectral warnings and no Node 20 action-runtime annotation |

Negative coverage includes additive stale-Node-20 rejection, positive action allowlisting, total
action-use cardinality, checkout/setup-node multiplicity, both standard and inline `uses:` forms,
flow/quoted/split/explicit/Unicode-key syntax, reusable-workflow job references and a whole-step
YAML alias,
rendered required-check-name stability, unpinned-action rejection, shallow checkout rejection,
missing required command rejection, suppressed-job rejection and permission-guard preservation.
The action inventory is derived from the job/step `uses` values produced by the already-pinned
`yaml@2.9.0` parser, including resolved aliases, rather than a textual regex. These controls execute
through canonical validation inside the required `contract standards validation` job, not only
in the local control test suite. Failure remains observable as a required-check failure and a
specific fail-closed validator/test error.

## 3. Rollback, review and integration

- **Rollback:** normal revert of the eventual merge followed by both required checks; never
  force-push.
- **Observability:** GitHub check conclusions and annotations, exact workflow commit, validator
  output and Node version.
- **Model/account:** Codex implementation and evidence coordination; independent Opus review
  required before merge because this changes the release-control supply-chain path.
- **Budget:** eight owned paths, five bounded RED/GREEN checkpoints, independent review until
  `P0=P1=P2=0`, one PR/merge cycle; stop on any unresolved P0/P1/P2 or required-check failure.
- **Integration consumer:** `main` branch protection and every future Suite contract/control PR.

### Independent review history and disposition

Opus run on the first GREEN candidate returned `NO-GO`, `P0=0 P1=0 P2=2 P3=5`:

1. `P2-1` missing committed provenance evidence — closed by the exact tag object, action manifest
   blob/SHA-256/runtime and Node distribution evidence above.
2. `P2-2` additive Node 20 action runtime not fail-closed — closed by explicit superseded-pin
   exclusion, exact total action-use count and negative tests executed through canonical
   validation.
3. P3 job-scope/negative-coverage/grammar/check-name issues — current validator enforcement is
   job-scoped; checkout multiplicity and both required-check names now have negative coverage;
   error wording handles singular/plural. The test-level whole-file assertion is independent
   test evidence, not the validator's runtime-proof mechanism. The Node-24-local-execution
   observation is closed by the checksum-verified Node 24.18.1 full control/contract/audit run
   above.

The second Opus review returned `NO-GO`, `P0=0 P1=0 P2=1 P3=5`. Its remaining P2 reproduced a
parser bypass: a fourth `uses:` line with trailing whitespace was invisible to the original
extractor. A second RED checkpoint reproduces that bypass; the remediation constrains horizontal
whitespace without crossing lines, then applies SHA validation, superseded-pin exclusion, total
cardinality and exact multiplicity to recognized action lines. The trailing-whitespace negative
and secret-scan rendered-name negative pass in the full Node 24 suite.

The third Opus review returned `NO-GO`, `P0=0 P1=1 P2=1 P3=5`. It found that inline
`- uses:` steps were not recognized and correctly rejected the resulting completeness wording.
A third RED checkpoint reproduces the inline bypass. The remediation recognizes both canonical
separate-line and inline step forms, anchors both rendered job names, removes the redundant
zero-action branch and positively rejects every action outside the reviewed allowlist. A fourth
RED/GREEN cycle proves that flow-map and quoted-key variants are rejected as unsupported syntax,
which was the textual-control completeness claim later invalidated by the fourth-review retry.

The first fourth-review attempt ended with a Claude infrastructure `500` and produced no verdict;
it is not counted as a pass. The bounded retry returned `NO-GO`, `P0=0 P1=1 P2=1 P3=5`, after
reproducing split `uses` key/colon and explicit `? uses` forms that still evaded the textual
extractor. The fifth RED checkpoint preserves both bypasses. The remediation removes the textual
action extractor and instead parses the workflow with the already-pinned `yaml@2.9.0`, walks
every structurally interpreted job-level and step-level `uses` value, and applies the immutable
SHA, superseded-pin, allowlist, total-cardinality and multiplicity rules to that inventory.
Additional cases cover Unicode-escaped `uses`, reusable-workflow job references and a merged YAML
alias. The earlier adverse verdict and the infrastructure failure remain dated history.

Compact coordinator transcript for the fresh exact binary run:

```text
node-v24.18.1-darwin-arm64.tar.xz: OK
node --version: v24.18.1
node --test --experimental-test-coverage ...: tests 206, pass 206, fail 0
coverage: line 97.38%, branch 90.97%, functions 98.89%
node tools/operations/validate-w1-control.mjs: W1 control PASS, tasks=48
npm audit --audit-level=high: found 0 vulnerabilities
npm run validate: PASS; dependency compatibility 2/2; Spectral 0 errors/19 warnings; AsyncAPI 0 errors
npm run test:w1-contracts: 98/98 PASS
gitleaks dir/git 8.30.1: no leaks found
```

The fifth independent Opus review of exact tip
`d96e536c277bcebbcc5a068028c8acf148fb9cae` returned **`GO`,
`P0=0 P1=0 P2=0 P3=5`**. It independently measured the exact eight-path scope and clean tree,
confirmed that the structural inventory closes the previously reproduced bypass class, and
retained five nonblocking P3 follow-ups:

1. the standalone control-validator command now requires `npm ci` in
   `tools/contract-validation` first;
2. the pre-existing textual `if: false` suppression guard should become structural;
3. `run:` steps and the workflow-directory inventory remain outside this bounded action-use
   control;
4. merge-key, multi-document and duplicate-key parser behavior should receive explicit negative
   tests; and
5. external action provenance still depended on the then-pending hosted run.

The first item is now documented in `tools/contract-validation/README.md`; the fifth is closed by
the hosted evidence below. Items 2–4 remain nonblocking follow-up work. All adverse verdicts and
the infrastructure failure above remain dated history and are not rewritten as a pass.

## 4. Canonical integration evidence

| Evidence | Exact result |
|---|---|
| Reviewed tip | `d96e536c277bcebbcc5a068028c8acf148fb9cae`; exact eight paths; clean worktree; independent Opus `GO`, `P0=P1=P2=0 P3=5` |
| Push run | `30543352613`; event `push`; head `d96e536c277bcebbcc5a068028c8acf148fb9cae`; both jobs `SUCCESS` |
| Pull request | `https://github.com/hoangclinh/cybrik-suite/pull/3`; base `ad964697eed2d623863b0b034a6215b3dfe29e4e`; head `d96e536c277bcebbcc5a068028c8acf148fb9cae`; mergeable state `CLEAN` |
| PR run | `30543370258`; event `pull_request`; both jobs `SUCCESS` |
| Canonical merge | `9e20dc7f5ff77e908f6b35c8f0a05fd879e370b2`; parents exact base then reviewed tip; tree `11c408782de41a14279f4c9b99ba2eae13ea5f96`, byte-identical to reviewed-tip tree |
| Canonical run | `30543470413`; event `push`; head exact merge; contract job `SUCCESS` in 45 s; secret-scan job `SUCCESS` in 10 s |
| Annotations | no Node 20 action-runtime annotation; 19 pre-existing Spectral warnings remain permitted at fail-severity `error` |
| Protection | strict required checks remain `contract standards validation` and `secret-scan (gitleaks 8.30.1)`; app id 15368; admins enforced; force-push and deletion disabled |

`W1-CI4` is `CANONICAL MERGED`. This is static CI/control evidence only. It proves no product
runtime, local stack, demo, UAT, deployment or production state. Its original blanket runtime hold
is dated historical governance and is superseded for forward-looking non-production execution by
`DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md`; release dates remain unchanged and
production remains Founder-controlled.
