# Pre-Founder integrated UAT scenario — operator guide

Status: **AUTHORED AND UNIT-TESTED — RUNTIME NOT EXECUTED — HOLD**

This guide defines the dry, non-runtime check that an engineering agent must
complete before the Founder is asked to perform the integrated UAT. It does not
grant runtime authority, start Docker, open a socket, mutate a checkout, or
claim that Tool Fabric has been exercised.

The scenario runner is:

`integration/compose/soc-ai-lifecycle-create-mtls/scripts/prefounder_uat_scenario.py`

The complete rehearsal specification is the adjacent canonical manifest:

`integration/compose/soc-ai-lifecycle-create-mtls/scripts/prefounder_integrated_scenario.manifest.json`

Its current SHA-256 is
`b69331ee620823581930b3fb4cfd05e589c9f5f6655829c17d7d1a97d22f8ebd`.
Its schema is `CYBRIK-D2-PREFOUNDER-INTEGRATED-SCENARIO/v2`.
The runner reads it through a bounded no-follow descriptor and rejects any
byte, shape, ordering, identity, status, negative-case or terminal-evidence
drift before deriving a verdict.

Its default and only authored mode is `assess`. The runner consumes an
operator-produced observations document and writes one fresh, owner-only JSON
report outside the Suite checkout. It performs no live probes itself.
The observations document is read once through a bounded, no-follow,
single-linked regular-file descriptor with stable identity; symlinks, hard
links and files changed during the read fail closed.
The supplied Suite root must resolve to the checkout containing the runner;
an arbitrary or copied empty directory is rejected.

## Current verdict

The current candidate must produce `HOLD`, even when all supplied repository,
Docker, image and bind observations are green. Tool Fabric is pinned in the
three-product repository tuple but is not technically exercised by the
create-only D2 path. No reviewed Tool Fabric runtime receipt or admitted
receipt digest exists, so `READY` is structurally unreachable.

The current truthful blocker set is:

- cross-product steps touching Tool Fabric are `not_implemented`;
- Tool Fabric has no emittable runtime receipt producer;
- all declared product runtime wiring is `not_wired`;
- the frozen runner contract is `authored_not_run`;
- the authored SOC/Cyber AI and terminal steps are `authored_not_run`;
- N1-N10 are authored but not executed;
- Tool Fabric-specific fail-closed cases F1-F2 are not implemented;
- rollback and all five no-residual evidence checks are not captured; and
- no reviewed, exact-byte Tool Fabric runtime receipt digest is admitted.

Separately, and outside that frozen set, the rehearsal dimension reports
`fabric_synthetic_attestation_absent` until a synthetic Tool Fabric attestation
is supplied. That blocker is not a UAT blocker and clearing it changes nothing
about the verdict above.

When a future reviewed digest is admitted, the runner reads the receipt through
a no-follow descriptor, enforces a bounded stable regular-file identity, and
compares the SHA-256 of the exact bytes. File presence alone cannot clear the
blocker, and an admitted digest pin alone cannot clear it either: the receipt
must also be claimed present and actually present in the tree.

This is intentional. A synthetic observation cannot convert provenance-only
Tool Fabric coverage into runtime evidence.

## Execution-plan contract (rehearsal order)

The runner carries a frozen, machine-tested admission-rehearsal contract,
`EXECUTION_PLAN` (`CYBRIK-D2-PREFOUNDER-EXECUTION-PLAN/v1`). It is the exact
ordered rehearsal of the assessor's admission conditions for a future
three-product UAT: the steps partition the frozen blocker vocabulary so every
blocker is cleared by exactly one step, and the terminal gate is admission of
an accepted bound Tool Fabric runtime receipt. It is not the integrated runtime
scenario
itself and cannot substitute for executing N1-N10, the Tool Fabric path,
terminal-evidence validation or rollback verification.

| Step | Action | Clears |
|---|---|---|
| 1 | `pin_three_product_identities` | product identity, detached HEAD and clean-worktree blockers |
| 2 | `verify_product_source_roots` | `product_source_root_absent` |
| 3 | `verify_docker_engine` | Docker CLI and daemon blockers |
| 4 | `verify_pinned_postgres_image` | `docker_image_missing` |
| 5 | `verify_loopback_binds_free` | `loopback_bind_occupied` |
| 6 | `wire_product_owned_runtime_surfaces` | `runtime_wiring_absent` |
| 7 | `implement_fabric_owned_runtime_producer` | `tool_fabric_runtime_producer_absent` |
| 8 | `implement_cross_product_integrated_path` | `integrated_step_not_implemented` |
| 9 | `author_tool_fabric_negative_coverage` | `tool_fabric_negative_gap_open` |
| 10 | `execute_integrated_rehearsal_steps` | scenario and runner-not-run blockers |
| 11 | `execute_negative_case_inventory` | `negative_case_not_run` |
| 12 | `capture_rollback_and_no_residual_evidence` | `terminal_evidence_not_captured` |
| 13 | `admit_real_tool_fabric_runtime_receipt` | `tool_fabric_runtime_receipt_absent` |

Every assessment report embeds the plan under `execution_plan` with, per step,
the authored `action`, `instruction` and `clears` plus the derived
`blocked_by` and `satisfied` facts, and a top-level `next_step` naming the
first unsatisfied step. The top-level `next_blocker` names the first blocker in
that same ordered plan. `READY` is derivable only when every step is satisfied;
because the Fabric-owned producer step and the distinct terminal accepted-
receipt gate are open, the current candidate remains `HOLD`. The plan is
validated fail-closed on every run:
a missing, reordered, duplicated, extended or off-vocabulary step aborts with
`execution_plan_invalid` and no report is written. The plan orders read-only
rehearsal observations only; it does not authorize executing any step's
underlying runtime action.

## Integrated rehearsal manifest

The manifest declares eight ordered steps:

1. SOC produces the synthetic lifecycle-create request;
2. Cyber AI validates transport-bound delegation;
3. Cyber AI records durable replay state;
4. Cyber AI requests a typed, read-only Tool Fabric capability;
5. Tool Fabric re-authorizes the exact request;
6. Tool Fabric executes within the declared resource boundary;
7. Tool Fabric emits an accepted bound runtime receipt from its own runtime
   path; and
8. Suite captures negative, rollback and terminal evidence.

Each step carries a unique identity, producer, consumer, purpose, surface and
truthful status. N1-N10 remain mapped to their exact SOC/Cyber AI/Suite steps;
F1-F2 explicitly expose the previously missing Tool Fabric delegation and
receipt-tamper coverage. The terminal contract requires rollback plus absence
of residual containers, listeners, ephemeral PKI, repository changes and
restricted material.

The manifest is `rehearsal_only`. Editing its status fields is not runtime
evidence: a future status change is accepted only in a newly reviewed,
digest-pinned candidate backed by the corresponding execution artifacts.

The exact negative inventory is:

- N1 replayed delegation;
- N2 certificate-binding (`cnf`) mismatch;
- N3 wrong audience;
- N4 wrong scope;
- N5 wrong operation;
- N6 cross-tenant request;
- N7 tenant/organization advisory mismatch;
- N8 missing server-owned TLS extension;
- N9 PostgreSQL unavailable with no in-memory fallback;
- N10 restricted-material leakage into evidence;
- F1 Tool Fabric delegation rejection; and
- F2 Tool Fabric receipt-tamper rejection.

N1-N10 are authored but not run. F1-F2 remain not implemented. No item may be
promoted merely by editing the manifest.

It also declares the exact role and current wiring state of each product:

- SOC owns `soc_truth` and the lifecycle-create client surface;
- Cyber AI owns `ai_runtime`, mTLS admission, durable replay and the outbound
  delegation request;
- Tool Fabric owns `tool_execution`, policy admission, bounded execution and
  receipt production. Its concrete domain currently stops at in-process
  `R0AlertContextInvocationService.invoke`, which returns an unsigned
  `ReceiptPlan`; it has no emittable runtime receipt producer. Runtime wiring is
  `not_wired`, the producer is `not_implemented`, and the receipt-signature
  envelope remains `proposed_not_implemented`.

Suite owns only the cross-product contract, manifest, assessor and integration
harness. This manifest invents no Fabric endpoint, adapter, signer, source path
or digest. Editing status fields, adding a Suite-local file or adding an
observation claim cannot manufacture a Fabric producer or receipt.

The assessor validates these declarations and the injected repository identity
facts. It does not probe a checkout for files or symbols. The engineering agent
must obtain those read-only facts separately and retain them with the report;
an unverified path written into the manifest is not implementation evidence.

## Frozen eventual runner contract

`integration/compose/soc-ai-lifecycle-create-mtls/scripts/run_prefounder_integrated_uat.sh`
is a non-executable, fail-closed specification of the eventual runtime order.
Its contract is `CYBRIK-D2-PREFOUNDER-RUNNER-CONTRACT/v1` and its SHA-256 is
`345e68c9a5111505109a709e7e34f3cdc05216598c92521ecc722f125fa5ecb2`.

The file is **AUTHORED NOT RUN**. It refuses before any runtime action even if
the placeholder environment value is supplied. It is not the command for the
Founder to execute. Its 19 ordered identities cover read-only preflight, the
eight manifest steps, N1-N10 plus F1-F2, rollback, all no-residual checks and
terminal admission of the exact Tool Fabric receipt.

The dry assessment explicitly accepts the current expected `HOLD` and records
all blockers. A following, distinct launch-admission identity would require
zero `runtime_launch.blockers` before any future authorized scenario action.
Execution-only blockers such as runner-not-run, negative-case-not-run,
terminal evidence and final receipt admission do not make the dry assessment
semantically unreachable.

## Optional synthetic Tool Fabric attestation (rehearsal only)

The Tool Fabric UAT lane can produce a read-only, non-executing synthetic
artifact. It may be recorded here, and only here:

```sh
  --fabric-attestation /absolute/external/path/fabric-attestation.json \
  --fabric-attestation-sha256 <64 lowercase hex characters>
```

Both flags are one indivisible argument; supplying either alone fails closed
with `arguments_invalid`, because an artifact without a reviewed digest pin
would be admitted on its own say-so.

This artifact is **not** the Tool Fabric runtime receipt and is not runtime
evidence of any kind. It is admitted into a separate report dimension,
`prefounder_rehearsal` (`CYBRIK-D2-PREFOUNDER-REHEARSAL/v1`), which carries its
own disjoint blocker vocabulary. It can never reach `status`, `blockers`,
`execution_plan`, `next_blocker`, plan step 10, the
`tool_fabric_runtime_receipt_absent` gate, `READY`, or a success exit code. The
frozen assessment is byte-identical with and without it.

The runner enforces all of the following and writes no report if any fails:

- the path is absolute, literal and non-traversing (`fabric_attestation_path_invalid`);
- the path is outside the Suite checkout, both literally and after its parent is
  resolved (`fabric_attestation_must_be_outside_suite`);
- the artifact is read through a bounded, no-follow, single-linked, regular-file
  descriptor whose identity is unchanged across the read, so a symlink, hard
  link, device, directory, empty file, oversized file or a file swapped mid-read
  is refused;
- the exact bytes hash to the supplied pin (`fabric_attestation_digest_mismatch`);
- the schema version matches exactly (`fabric_attestation_schema_version_mismatch`);
- the envelope carries the exact producer, environment, evidence class, artifact
  class and Fabric-lane schema tag (`fabric_attestation_invalid`); and
- the six safety claims hold their exact pins **by identity, not truthiness** —
  `read_only` and `synthetic` must be `true`; `execution_authority`,
  `is_runtime_receipt`, `runtime_executed` and `side_effect_performed` must be
  `false` — and the claims digest must bind those exact claims
  (`fabric_attestation_claim_inconsistent`).

Because `is_runtime_receipt` and `runtime_executed` must be `false` by identity,
no admissible synthetic artifact can read as runtime evidence. A refused
artifact aborts the whole run with exit code `2` and no report; it never relaxes
a verdict.

## Required observations

Prepare a JSON document outside every repository with this exact shape:

```json
{
  "schema_version": "CYBRIK-D2-PREFOUNDER-OBSERVATIONS/v1",
  "observed_at": "2026-08-03T00:00:00Z",
  "products": {
    "cybrik-cyber-ai-platform": {
      "commit": "789614144686dab88500dd2bfecdd608ef0a8b8f",
      "tree": "244140e3aacd783b1bea7542f9f56ffc46cedc86",
      "head_detached": true,
      "worktree_clean": true
    },
    "cybrik-security-tool-fabric": {
      "commit": "49583be00235a0f8ad7da8cb4ea99108ad201a69",
      "tree": "ca8b4a03116bea979de89b92b2f8fef4fd31e001",
      "head_detached": true,
      "worktree_clean": true
    },
    "cybrik-soc-command-center": {
      "commit": "abfdfde96afc6daa2868694de993c623daa8862e",
      "tree": "241ef24a33246918ff5cf133e7d8d004823fdf06",
      "head_detached": true,
      "worktree_clean": true
    }
  },
  "docker": {
    "cli_present": true,
    "daemon_running": false,
    "images_present": [],
    "binds_free": {
      "127.0.0.1:55432": true,
      "127.0.0.1:58443": true
    }
  },
  "tool_fabric_runtime_receipt": {
    "claimed_present": false
  }
}
```

Every value must come from a separately reviewed, read-only observation step.
Do not edit the document to manufacture a desired verdict. The runner validates
shape and exact product identities; it does not authenticate the observation
producer or inspect the product checkouts itself.

## Run the assessment

Use absolute paths. The report must be fresh and outside the Suite checkout.

```sh
python3 integration/compose/soc-ai-lifecycle-create-mtls/scripts/prefounder_uat_scenario.py \
  --suite-root /absolute/path/to/cybrik-suite \
  --observations /absolute/external/path/prefounder-observations.json \
  --report-json /absolute/external/path/prefounder-report.json
```

Exit codes:

- `0`: `READY` was derived. This is unreachable in the current revision.
- `1`: valid assessment with status `HOLD` and a frozen list of blockers.
- `2`: malformed input, unsafe output target, contradiction, or unsupported
  operation; no report is accepted.

The frozen eventual runner uses exit code `3` for `runtime_not_authorized`; it
must not be invoked during this dry pre-UAT.

`--mode execute` always fails closed with `execute_mode_not_authored`. It must
not be used as a substitute for the separately signed, one-shot D2 runtime
authorization and exact-head grant.

## Engineering dry pre-UAT now

The engineering agent now has one fail-closed preflight command. It derives the
commit, tree, detached-HEAD and clean-worktree facts directly from the three
installed repositories through a frozen read-only Git allowlist, creates the
observations document outside every repository, invokes
`prefounder_uat_scenario.py` in `assess` mode and prints a short verdict. It
cannot start Docker, open a listener, connect to PostgreSQL or call a product
runtime.

First create a fresh, owner-only prerequisites template outside every
repository:

```sh
python3 integration/compose/soc-ai-lifecycle-create-mtls/scripts/prefounder_preflight.py --emit-prerequisites-template \
  /absolute/external/path/prefounder-prerequisites.json
```

The template starts fail-closed: Docker CLI and daemon are `false`, no image is
claimed present, both binds are `false`, and no Tool Fabric runtime receipt is
claimed. After separately performing only the permitted read-only checks, the
operator may update those facts. The prerequisites schema is closed and cannot
supply product identities, runtime authorization, an endpoint or execution
authority.

Then run the complete dry preflight from the bound Suite checkout, replacing
each path with the exact installed checkout and fresh external output paths:

```sh
python3 integration/compose/soc-ai-lifecycle-create-mtls/scripts/prefounder_preflight.py \
  --suite-root /absolute/path/to/the-same-cybrik-suite-checkout-containing-this-script \
  --soc-root /absolute/path/to/cybrik-soc-command-center \
  --cyber-ai-root /absolute/path/to/cybrik-cyber-ai-platform \
  --tool-fabric-root /absolute/path/to/cybrik-security-tool-fabric \
  --prerequisites /absolute/external/path/prefounder-prerequisites.json \
  --observations-json /absolute/external/path/prefounder-observations.json \
  --report-json /absolute/external/path/prefounder-report.json
```

The command mirrors the assessor exit code and reports `status=HOLD`, one
`blocker=...` line per open blocker, the first `next_step`, and
`runtime_launch_admitted=false` for the current candidate. `status=READY`
remains structurally unreachable. Both output files are created once with mode
`0600`; existing files and any output path inside Suite are refused.

After the command, the engineering agent must still independently check the
declared SOC and Cyber AI source paths/symbols, record the Fabric
in-process/unsigned-`ReceiptPlan` limitation and absent emittable runtime
receipt producer, retain the owner-only report, and run the hermetic contract
tests and static checks below.

Do not execute `run_prefounder_integrated_uat.sh` or
`tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh`. Neither is an authorized
three-product runtime UAT in this revision.

## Engineering-agent acceptance before Founder handoff

The engineering agent must retain the report and independently verify all of
the following:

1. the exact Suite candidate is clean and has passed its full non-runtime test,
   lint and security gates;
2. all three product worktrees match the pinned commit and tree, are detached,
   and are clean;
3. Docker CLI, daemon and the exact digest-pinned PostgreSQL image are present;
4. loopback binds `127.0.0.1:55432` and `127.0.0.1:58443` are free;
5. the 11 findings from the sealed scan of
   `bbc26b356ce9f1ba572c2256945fa1adfee490c4` are remediated and independently
   reviewed on the new exact candidate;
6. Tool Fabric is exercised through an implemented runtime path, and its
   receipt is produced, validated, reviewed and digest-pinned in the candidate;
7. a fresh exact one-shot authorization and exact-head grant bind the final
   Suite and three-product tuple;
8. rollback and terminal-evidence checks are ready before any resource is
   created.

Only after all eight conditions are evidenced may the runner contract be
revised so `READY` becomes reachable. That revision requires its own RED/GREEN
tests and independent review. It does not change release dates and grants no
production authority.

## Verification evidence

This frozen guide embeds no mutable test count, duration or lint-success claim.
The engineering handoff must report the current focused `pytest`, Ruff lint and
format-check, `py_compile`, `bash -n` and `git diff --check` results from the
exact reviewed candidate. Those results prove only assessor and contract
behavior; they are not an integrated runtime UAT result.
