# Pre-Founder integrated UAT scenario — operator guide

Status: **AUTHORED AND UNIT-TESTED — RUNTIME NOT EXECUTED — HOLD**

This guide defines the dry, non-runtime check that an engineering agent must
complete before the Founder is asked to perform the integrated UAT. It does not
grant runtime authority, start Docker, open a socket, mutate a checkout, or
claim that Tool Fabric has been exercised.

The scenario runner is:

`integration/compose/soc-ai-lifecycle-create-mtls/scripts/prefounder_uat_scenario.py`

Its default and only authored mode is `assess`. The runner consumes an
operator-produced observations document and writes one fresh, owner-only JSON
report outside the Suite checkout. It performs no live probes itself.
The supplied Suite root must resolve to the checkout containing the runner;
an arbitrary or copied empty directory is rejected.

## Current verdict

The current candidate must produce `HOLD`, even when all supplied repository,
Docker, image and bind observations are green. Tool Fabric is pinned in the
three-product repository tuple but is not technically exercised by the
create-only D2 path. No reviewed Tool Fabric runtime receipt or admitted
receipt digest exists, so `READY` is structurally unreachable.

When a future reviewed digest is admitted, the runner reads the receipt through
a no-follow descriptor, enforces a bounded stable regular-file identity, and
compares the SHA-256 of the exact bytes. File presence alone cannot clear the
blocker.

This is intentional. A synthetic observation cannot convert provenance-only
Tool Fabric coverage into runtime evidence.

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
producer.

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

`--mode execute` always fails closed with `execute_mode_not_authored`. It must
not be used as a substitute for the separately signed, one-shot D2 runtime
authorization and exact-head grant.

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

## Test evidence

The scenario runner and its contract tests were reviewed and executed without
Docker, sockets, subprocess probes, network access, or the local stack:

```text
67 passed in 0.07s
ruff: All checks passed
```

These results prove the assessment tool's behavior only. They are not an
integrated runtime UAT result.
