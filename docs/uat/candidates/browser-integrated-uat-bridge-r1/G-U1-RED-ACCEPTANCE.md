# G-U1 RED contract/security checkpoint

Status: `ACCEPTED — BACKEND-OBSERVED G-U1 RED — OPENS BOUNDED G-U2 ONLY`

Prepared by: delegated technical governor under the active Founder delegation.

Prepared at: `2026-08-04` Asia/Ho_Chi_Minh.

Accepted by: delegated technical governor under the active Founder delegation.

Accepted at: `2026-08-04T07:01:15+07:00`.

Release dates: unchanged. Runtime/demo release: `HOLD`. Production authority: Founder only.

## 1. Scope and inherited authority

This record is the successor to `G-U0-ACCEPTANCE.md`. It preserves the accepted G-U0 bytes and
records one separate G-U1 source checkpoint; it does not rewrite the G-U0 packet.

G-U0 authorized only:

- RED contract/security tests;
- synthetic fixtures and denial oracles; and
- no listener, local stack, browser URL, account issuance, migration, backfill or runtime claim.

The G-U1 checkpoint therefore contains tests only. It has no product implementation path, no
dependency change and no deployment or runtime artifact.

The inherited G-U0 content was re-measured at the SOC checkpoint and Suite predecessor before any
G-U1 disposition:

| Repository | Commit / tree | Path | Bytes | SHA-256 |
|---|---|---|---:|---|
| SOC | `403cb8201f22db455fc6979184b25f7dfa3dec64` / `5e77f77f2d20a11686fad4e1ea5fd6da87ef6a9c` | `docs/architecture/ALERT-ORG-ATTRIBUTION-RLS-G-U0.md` | 38,556 | `121ba2e43f5687df7c7bb4c6ebda16fe65182228740df0c0a50c495726695f56` |
| SOC | same | `docs/architecture/INTEGRATED-INVESTIGATION-BFF-G-U0.md` | 29,928 | `a75f1a7ccc33346cdb4e3bf1e7eeeef1674f1454db37ca0d20812439df2d0b56` |
| SOC | same | `docs/architecture/BROWSER-INTEGRATED-UAT-G-U0.md` | 27,620 | `477c39992004b197137db73704961b3f6486f2c3a7484bf99995e9fae3e537a5` |
| Suite | `42dd2a0c9173941be42e5281557639df510868ae` / `4f664b75ba2e496c24fa63b651fd5f15377357d5` | `docs/uat/candidates/browser-integrated-uat-bridge-r1/README.md` | 32,466 | `990dd1ccc7ca24a4b65f003308ad2e23bfddf56e53bd35624a9f317817be248c` |
| Suite | same | `docs/uat/candidates/browser-integrated-uat-bridge-r1/G-U0-ACCEPTANCE.md` | 3,106 | `119ff82a4b16aefb1824035162bf492dff75022fec48f3b93fe494b1aed6197c` |

The first four hashes exactly match the accepted packet identity. The fifth row pins the separate
acceptance record itself. No G-U0 byte was edited by this G-U1 worktree.

## 2. Exact SOC checkpoint identity

Repository: `cybrik-soc-command-center`.

| Property | Exact value |
|---|---|
| Branch | `codex/uat-browser-g-u1-red-r1` |
| Base | `e813a5a1c0e26950271a5dcc757aefb5f73e31e8` |
| Initial RED commit | `ac231000268055e0581bb258d9fa407e077aed45` — `test: freeze G-U1 browser investigation security REDs` |
| Replay correction | `1b5cfb5b42aa6b8b7714d6397228f25cc1331899` — `test: add G-U1 investigation replay REDs` |
| Review-hardening / exact head | `403cb8201f22db455fc6979184b25f7dfa3dec64` — `test: harden G-U1 RED security oracles` |
| Exact head tree | `5e77f77f2d20a11686fad4e1ea5fd6da87ef6a9c` |
| Hosted ref | `refs/heads/codex/uat-browser-g-u1-red-r1` at the exact commit above |
| Hosted check runs at measurement | `0` — no hosted-green claim is made |
| Pull request / merge | none / none |
| Working tree after commit | clean |

The exact ten committed paths across the three-commit checkpoint are:

| SHA-256 | Bytes | Repository-qualified path |
|---|---:|---|
| `b121c746898677fab2afe178beb87c9a009a35f0be136809a1635774de6c9f84` | 5,370 | `cybrik-soc-command-center:apps/soc-portal/e2e/browser-evidence-leakage.spec.ts` |
| `de71e4dd1fd4fbfa67a8e7ce08030801b8cc10ea88e993f394936b19938bc0fb` | 8,210 | `cybrik-soc-command-center:apps/soc-portal/e2e/browser-investigation-panel.spec.ts` |
| `7cc35cede5a49a90d9a3f2e788570564cea8470b91cfe469e9802ee6d3251f3b` | 6,166 | `cybrik-soc-command-center:apps/soc-portal/e2e/browser-marking-scope-omission.spec.ts` |
| `c3c4f12051f0c7818ef506e4c4a2e896debf4984b5449e4bbf53ab54bc90cdcd` | 5,689 | `cybrik-soc-command-center:apps/soc-portal/e2e/browser-network-non-exposure.spec.ts` |
| `2d2bc1a518136f16f4ab2b6f9c43027b9f834f7392ad59ca53fd217d0f6c4249` | 9,121 | `cybrik-soc-command-center:apps/soc-portal/e2e/browser-persona-negatives.spec.ts` |
| `49945724afda1f6b8643d8d4fec954733ab118a18fba173af9e5f628a843785b` | 6,872 | `cybrik-soc-command-center:apps/soc-portal/e2e/browser-session-purge.spec.ts` |
| `899f346d2a8eb86b1a5972d54bccc3829b3594a7d582fd2b3fe1abd327960fde` | 14,625 | `cybrik-soc-command-center:services/api/tests/contracts/test_browser_investigation_contract.py` |
| `0cfa03f08069f7f70396eb694ee20d7b9e37095297671bd09c16344399b8f5d8` | 7,736 | `cybrik-soc-command-center:services/api/tests/unit/copilot/test_integrated_investigation_projection.py` |
| `5a10ab17d2bc14e5edae2b7e3450fff2b03f516387feb6a2b652a73c9623fe98` | 12,646 | `cybrik-soc-command-center:services/api/tests/unit/copilot/test_integrated_investigation_replay.py` |
| `74dd14514776969fe1141cd4d205d73950f456a42a5d8a946f7dfcacf28fe453` | 5,098 | `cybrik-soc-command-center:services/api/tests/unit/copilot/test_integrated_investigation_route.py` |

The aggregate uses repository-relative paths without the displayed `cybrik-soc-command-center:`
qualifier and ungrouped decimal byte counts. Its complete input is:

```text
b121c746898677fab2afe178beb87c9a009a35f0be136809a1635774de6c9f84  5370  apps/soc-portal/e2e/browser-evidence-leakage.spec.ts
de71e4dd1fd4fbfa67a8e7ce08030801b8cc10ea88e993f394936b19938bc0fb  8210  apps/soc-portal/e2e/browser-investigation-panel.spec.ts
7cc35cede5a49a90d9a3f2e788570564cea8470b91cfe469e9802ee6d3251f3b  6166  apps/soc-portal/e2e/browser-marking-scope-omission.spec.ts
c3c4f12051f0c7818ef506e4c4a2e896debf4984b5449e4bbf53ab54bc90cdcd  5689  apps/soc-portal/e2e/browser-network-non-exposure.spec.ts
2d2bc1a518136f16f4ab2b6f9c43027b9f834f7392ad59ca53fd217d0f6c4249  9121  apps/soc-portal/e2e/browser-persona-negatives.spec.ts
49945724afda1f6b8643d8d4fec954733ab118a18fba173af9e5f628a843785b  6872  apps/soc-portal/e2e/browser-session-purge.spec.ts
899f346d2a8eb86b1a5972d54bccc3829b3594a7d582fd2b3fe1abd327960fde  14625  services/api/tests/contracts/test_browser_investigation_contract.py
0cfa03f08069f7f70396eb694ee20d7b9e37095297671bd09c16344399b8f5d8  7736  services/api/tests/unit/copilot/test_integrated_investigation_projection.py
5a10ab17d2bc14e5edae2b7e3450fff2b03f516387feb6a2b652a73c9623fe98  12646  services/api/tests/unit/copilot/test_integrated_investigation_replay.py
74dd14514776969fe1141cd4d205d73950f456a42a5d8a946f7dfcacf28fe453  5098  services/api/tests/unit/copilot/test_integrated_investigation_route.py
```

SHA-256 over those exact UTF-8 lines, including each final LF:

```text
92dd6a63a088dbd23d692deb887b67fb8235028a2013c2221fb37fdd79a0f4ac
```

## 3. What the RED checkpoint freezes

### 3.1 Backend contract and security boundary

The four backend test files freeze:

- only the accepted SOC public routes: POST/GET investigation and GET checkpoints;
- advisory `org` UUID and server-derived authority;
- closed POST body with only optional bounded `objective`;
- required bounded `Idempotency-Key` for POST;
- no public cancel, bundle, direct Cyber AI or direct Tool Fabric route;
- exact closed status, marking, checkpoint and four-field receipt-reference projections;
- the frozen public error vocabulary, including `401 authentication_required` on every route;
- authentication before target disclosure;
- rejection of all body-supplied authority fields;
- fail-closed projection behavior for malformed/open enums, progress and receipt references;
- same-key binding, alert and objective conflict before target/upstream access;
- one canonical replay winner, with an atomic owned reservation before upstream create and no
  duplicate create for a competing reservation loser;
- mandatory live reauthorization and context-digest equality before replay;
- typed membership/grant revocation collapsed into one non-disclosing outcome while unexpected
  authority defects propagate for engineering visibility;
- non-disclosing replay refusal whose message, arguments, attributes, slots and exception chain
  reveal no binding/target material after revocation or context drift; and
- status/checkpoint reads that do not consume create idempotency.

### 3.2 Browser source inventory

Playwright discovery found 32 tests in the six accepted G-U0 browser paths. They define RED oracles
for:

- N9 route-locale consistency;
- N10 hidden marking/org-scope omission with no existence signal;
- N11 unresolved marking/residency collapse to non-disclosing unavailable;
- N12 tenant-switch purge;
- N13 role/session/membership/grant/logout purge;
- N14 SOC-origin-only normal traffic, no browser service credential and explicit application or
  client-certificate denial for later harness-provided AI/Fabric probe URLs;
- safe receipt/checkpoint rendering and hostile evidence stripping;
- A05 negative-only separation; and
- client authority-smuggling/guessed-identifier negatives for the P1/P2/P3/P5/P6 source matrix.

The G-U1 tests do not claim the complete G-U5 persona-fixture matrix. Exact distinct synthetic
persona identities, grants and expiry/revocation fixtures remain a G-U4/G-U5 obligation.

## 4. Verification evidence

All commands ran from the SOC checkpoint worktree without starting a listener, web server,
database or local stack. Staged checks ran before each commit; post-commit checks ran after the
working tree became clean. Tool versions were Python `3.12.13`, pytest `9.1.1`, Ruff `0.16.0`,
Node `26.0.0`, TypeScript `5.5.4`, Playwright `1.61.1` and Gitleaks `8.30.1`.

| Check | Result | Honest interpretation |
|---|---|---|
| Ruff read-only format/check on four Python tests | pass | Python RED source is syntactically/style valid |
| Backend G-U1 target | `63 failed in 2.94s` | intended RED: accepted routes and the projection/replay modules are absent |
| Replay-only target | `11 failed in 0.03s` | every replay case fails only on the missing replay implementation |
| Related backend regression set | `113 passed in 0.92s` | existing alert-context/lifecycle/delegation source behavior remains green |
| Portal TypeScript `tsc --noEmit` | pass | browser RED source type-checks |
| Playwright `--list` | `32 tests in 6 files` | exact browser inventory is discoverable; tests were not executed |
| Skip/xfail/only search across all ten paths | none | no disabled Python or browser case |
| `git show --check` on all three checkpoint commits | pass | no whitespace error in the committed scope |
| Gitleaks exact three-commit scan | `3 commits`, `82.47 KB`, no leaks | committed bytes, not an empty staged diff, were scanned |

The exact backend RED command was:

```text
services/api/.venv/bin/python -m pytest -q --tb=no \
  services/api/tests/contracts/test_browser_investigation_contract.py \
  services/api/tests/unit/copilot/test_integrated_investigation_projection.py \
  services/api/tests/unit/copilot/test_integrated_investigation_replay.py \
  services/api/tests/unit/copilot/test_integrated_investigation_route.py
```

The exact related-regression command selected:

```text
services/api/.venv/bin/python -m pytest -q \
  services/api/tests/unit/test_alert_context_route.py \
  services/api/tests/unit/copilot/test_lifecycle_create.py \
  services/api/tests/unit/test_alert_context_authorize.py \
  services/api/tests/unit/test_alert_context_redaction_digest.py \
  services/api/tests/unit/test_svc_delegation_no_go.py
```

Final Python style verification used only `ruff format --check` and `ruff check` over the four
listed G-U1 files. The browser checks used `tsc --noEmit` and:

```text
playwright test --list \
  e2e/browser-investigation-panel.spec.ts \
  e2e/browser-marking-scope-omission.spec.ts \
  e2e/browser-session-purge.spec.ts \
  e2e/browser-network-non-exposure.spec.ts \
  e2e/browser-evidence-leakage.spec.ts \
  e2e/browser-persona-negatives.spec.ts
```

The TypeScript/Playwright binaries came from the existing main-checkout dependency installation;
a temporary ignored `node_modules` symlink was removed immediately after verification. No
dependency was installed or changed in the G-U1 worktree.

The committed secret scan used:

```text
gitleaks git \
  --log-opts='e813a5a1c0e26950271a5dcc757aefb5f73e31e8..403cb8201f22db455fc6979184b25f7dfa3dec64' \
  --redact --no-banner .
```

The browser suite was deliberately not executed: G-U0 forbids a local stack and G-U4 has not yet
provided the isolated deterministic harness. `--list` is source/discovery evidence only. It is not
a browser result, application-access proof or signed UAT run. Both N14 direct probes fail fast when
their G-U4-provided URL variables are absent; only the probes have no target default. The same file
still declares the expected local SOC portal/API origins. A probe cannot silently pass through
CORS, DNS or port absence. The A05 source also requires explicit `E2E_A05_EMAIL` and
`E2E_A05_PASSWORD`; no credential fallback exists.

## 5. Review record and remediation

An initial independent read-only Codex reviewer inspected the six browser and the then-three
backend test files against the frozen G-U0 documents. Its verdict after the first remediation was:

- `P0=0`;
- `P1=0`;
- `P2=0`;
- `P3=0`;
- `GO` for the source-only G-U1 checkpoint.

Closed findings included locale-selector false RED, malformed checkpoint fixtures, invented A05
header/control semantics, mislabeled persona coverage, hardcoded downstream probes, CORS/port
absence as false denial evidence and an internal tuple-return overconstraint.

The first Claude/Opus read-only review of this Suite draft completed through 1DevTool in 295
seconds. The wrapper returned no immutable run ID. The review was restricted to the Suite worktree,
could not read the SOC checkpoint and correctly returned `NO-GO` rather than treating missing
primary evidence as success. It found `P1=2`, `P2=6` and five P3 notes. Remediation required before
re-review was:

- scope this checkpoint so unexecuted browser tests cannot open G-U3;
- require an observed per-spec browser RED-to-GREEN transcript before G-U3 integration;
- replace the empty staged secret/whitespace evidence with an exact-commit scan;
- make the aggregate manifest byte-reproducible;
- re-pin the inherited G-U0 bytes at the SOC checkpoint;
- add exact verification commands, tool versions and reviewer identity;
- add the missing replay RED boundary;
- change this record from premature `ACCEPTED` to `DRAFT` until the final review passes; and
- clarify the immutable commit anchor, Python skip search, N14 fail-fast probe variables and
  G-U2-before-G-U3 order.

A second Claude/Opus review completed through 1DevTool in 439 seconds from the common parent of both
worktrees. The wrapper again returned no immutable run ID. It independently reproduced all byte
counts and test inventories, and found `P0=0`, `P1=1`, `P2=4`, `P3=8`. Its sole P1 was verifier
permission denial for `git`/`shasum`, not evidence drift; the delegated governor subsequently
reproduced the exact commit, tree, clean status, hashes, aggregate and Gitleaks range locally. The
four substantive P2 findings were all remediated in the exact-head hardening commit:

- inspect the complete outward exception surface instead of only `str(error)`;
- distinguish typed membership/grant revocation from unexpected engineering defects;
- reserve idempotency atomically before upstream create and deny a contention loser without a
  duplicate create; and
- include the required `401 authentication_required` in the closed OpenAPI error vocabulary.

The eight P3 notes were also remediated where actionable: guarded projection imports, accepted
1,000-item boundary, nested capability deep-copy, optional objective, precise probe wording and A05
env inventory, exact external marker matching and exact unauthenticated status checks. A final
read-only Codex re-review of the exact-head ten committed paths returned `GO` with
`P0=P1=P2=P3=0` and no
false-RED/false-GREEN finding. This closes the source-checkpoint review bar without claiming a
browser execution result.

## 6. Effective gate decision

The delegated technical governor accepts only the **backend-observed RED portion** of G-U1. This
decision:

- preserves `UI_TDD_OPEN`;
- opens bounded, test-first G-U2 SOC data-boundary/BFF GREEN work;
- keeps G-U3 portal implementation `HOLD` until each of the six browser specs has an observed,
  intended RED result against an authorized source-test composition;
- requires the exact commit/tree above, not the mutable branch name, as the evidence anchor;
- does not merge the intentionally failing RED commit into the canonical branch;
- requires G-U2 to make every backend RED pass without deleting or weakening an assertion; and
- requires a per-spec observed RED-to-GREEN transcript for all six browser files before any G-U3
  integration, so an unexecuted test cannot first appear as a vacuous pass.

This decision does **not** establish or authorize:

- G-U4 deterministic harness or any local runtime;
- G-U3 portal implementation or integration;
- G-U5 persona-matrix completion;
- G-U6 hosted/source quality closure;
- G-U7 signed browser run;
- `BACKEND_PROVED`, `UI_SOURCE_COMPLETE`, `UI_SOURCE_READY` or `UI_AUTHORIZED`;
- a browser URL, UAT account, demo, POC, RC, GA, release or production action.

Runtime/demo release therefore remains `HOLD`. Production remains Founder-only.
