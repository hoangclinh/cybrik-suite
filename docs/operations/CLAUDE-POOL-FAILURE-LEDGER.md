# Claude pool failure ledger

Status: `ACTIVE APPEND-ONLY OPERATIONS EVIDENCE — NO RUNTIME OR RELEASE AUTHORITY`.

This ledger records Claude delegation failures that affect the 48-agent roadmap. Its purpose is
to distinguish account quota, provider infrastructure, local permission policy and orchestration
timeouts before consuming Codex capacity as a fallback. It contains no credentials, tokens,
private prompts or Claude transcript bodies.

The machine-readable source is
[`evidence/claude-pool-failures.jsonl`](evidence/claude-pool-failures.jsonl). This document is the
human-readable operating view. A completed Claude response is still an incident when required
write or verification operations were denied; process exit `0` alone is not task success.

## Required record

Every failed or partially blocked Claude run must record:

1. incident ID and timezone-aware start/end time;
2. immutable 1DevTool run ID;
3. explicit pool (`personal`, `work`, or `unattributed`), launcher and attribution evidence;
4. target/model/category, timeout, process status and exit code;
5. one failure class and the exact blocked capability;
6. retry/extension decision, fallback owner and result;
7. evidence location and any remaining uncertainty.

Failure classes are closed to:

- `INFRA_529`: provider overload or equivalent 529 response;
- `QUOTA_EXHAUSTED`: usage window exhausted or a quota reset is explicitly reported;
- `PERMISSION_GATE`: Claude completed text generation but a required tool/write/test command was denied;
- `TIMEOUT`: the orchestration deadline ended before a terminal result;
- `AUTH`: authentication or account-session failure;
- `MODEL_UNAVAILABLE`: requested model could not be selected;
- `UNKNOWN`: insufficient evidence; never relabel this as quota or infrastructure by inference.

## Pool attribution

- `personal`: dispatched through the direct default Claude launcher while `CLAUDE_CONFIG_DIR` is
  unset, or explicitly through `1devtool-claude-personal`.
- `work`: dispatched explicitly through `1devtool-claude-work`.
- `unattributed`: launcher/environment evidence is missing or contradictory.

1DevTool run metadata currently records target/model/category but not account/pool. Therefore the
dispatcher must record the launcher at dispatch time. Model name, remaining usage and response
style are not valid pool evidence. Account email, organization ID and auth material must not be
written to this repository.

Both local pool launchers were observed authenticated to first-party Claude Max on 2026-08-04.
That observation proves only launcher readiness at the observation time, not which account served
an earlier unattributed run.

## Incident register

| Incident | Time (`Asia/Ho_Chi_Minh`) | Pool | Run/model | Class | Exact failure | Disposition |
|---|---|---|---|---|---|---|
| `CLD-20260804-001` | 2026-08-04 07:26:05–07:33:20 | `unattributed` | `9a50dbe5-8288-4d25-905b-cc1392b0142a`, Opus, `code`, 434 s | `PERMISSION_GATE` | Claude produced an implementation report, but write and pytest operations were denied; no file was written | No pool switch because this was not quota/529. Codex applied the bounded G-U2A kernel and captured local RED/GREEN evidence |
| `CLD-20260804-002` | 2026-08-04 07:52:22–07:57:10 | `unattributed` | `67f60dba-92d4-4ae8-be29-0a19d2b35e61`, Opus, category `null`, 288 s | `PERMISSION_GATE` | `Write`, `pytest` and `ruff` were denied; Claude returned a patch proposal only | No retry or pool switch. Codex applied the defensive P1/P2 remediation under TDD and independent review |
| `CLD-20260804-003` | 2026-08-04 08:41:44–08:51:45 | `work` | `9db15a3d-4c7f-4abc-9132-5f0b4cd25503`, Opus, `docs`, 601 s | `TIMEOUT` | Retained metadata proves timeout, `exit 124`, `contentCaptured=false` and 15 output characters. The coordinator observed `Execution error` and no target diff immediately after timeout, but those two observations are not retained in the run directory | No extension because no retained draft or progress artifact existed; coordinator-observed no-diff state is supporting, not durable, evidence. No pool switch because this was not quota/auth/model failure. Codex coordinator took the reviewed amendment as bounded fallback; independent review remains required |
| `CLD-20260804-004` | 2026-08-04 10:40:32–10:50:33 | `work` | `02a7121f-e59c-4b42-8c44-49be1cf05a97`, Opus, `test`, 601 s | `TIMEOUT` | Retained metadata proves timeout, `exit 124`, `contentCaptured=false` and 15 output characters; the isolated G-U2B RED worktree remained at zero diff immediately after timeout | No extension because no draft, diff or other progress artifact existed. No pool switch because this was not quota/auth/model failure. Codex coordinator performs the exact four-path test-only RED fallback; independent review remains required |

Adjacent control evidence: unattributed run `42396f62-1a57-4961-ab9e-5b0cdedf9b5e` used Opus for
architecture planning from 07:15:10 to 07:24:55, completed in 585 seconds and returned a usable
plan. This makes provider outage, exhausted quota and model unavailability unsupported
explanations for the two permission incidents. It does not prove which pool served any of the
three historical runs.

## Dispatch and fallback policy

1. Select and record the pool before dispatch. Alternate `work` and `personal` by lane capacity;
   do not invoke the unattributed default path for new roadmap work.
2. On `QUOTA_EXHAUSTED`, preserve the worktree and resubmit once through the other explicit pool.
3. On `INFRA_529`, do not churn pools. The coordinator performs the bounded task locally, per the
   current Founder instruction, and records the provider failure.
4. On `PERMISSION_GATE`, do not spend another Claude call on the same write attempt. Use the
   returned analysis/patch, execute through the coordinator, and retain independent review.
5. On a progressing `TIMEOUT` at 600 seconds, inspect progress and allow at most one additional
   cycle of at most 600 seconds. Record both run IDs or the correlated continuation ID.
6. Never classify an exit-0 run as successful until the requested artifact and validation evidence
   exist in the scoped worktree.

This ledger changes only agent-operations observability. It does not change release dates, open a
runtime/demo gate, authorize local stack execution or alter Founder-only production control.
