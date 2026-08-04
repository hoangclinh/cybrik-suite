# G-U2B PostgreSQL runtime topology diagnosis review R1

Status: `CONFIRMED — INDEPENDENT REVIEW GO — DIAGNOSIS ONLY`.

Recorded: `2026-08-04T18:35:00+07:00`.

This review confirms the decision quality of the diagnosis packet. It does not authorize a Docker
effect, listener, connection, topology rehearsal, PostgreSQL RED attempt, UAT, demo, merge, release
or production action. Release dates remain unchanged; all runtime-facing gates remain `HOLD`.

## Reviewed identity

| Item | Exact value |
|---|---|
| Diagnosis path | `docs/uat/candidates/browser-integrated-uat-bridge-r1/G-U2B-POSTGRES-RUNTIME-TOPOLOGY-DIAGNOSIS-R1.md` |
| Diagnosis SHA-256 | `b4d9e8cd0ff34b5a99d9b8b3e04419c27b1927d6e61d146d7658454a74c73874` |
| Diagnosis size | `16245` bytes / `284` lines |
| Result packet SHA-256 | `24d65a67b3e916988114542342bd5411ef87081b28d972d41b25e6d0a94388fe` |
| Consumed admission record SHA-256 | `b463b6032a69b68958cd6a470a5a1ac8976ae6778bdb26192a13c5009128e578` |
| Reviewer | Claude Opus through the isolated 1DevTool work pool |
| Review mode | read-only; no Docker, listener, edit, commit, push, merge or release |
| Final verdict | `GO`, P0/P1/P2/P3 = `0/0/0/0` |

The reviewer computed the diagnosis SHA-256 before review and independently re-read the result
packet, consumed admission record, lineage policy, runtime-admission schema and validator.

## Confirmed decisions

1. Preserved attempt evidence, post-attempt operator observations, external documentation and
   inference are separated; the inferred publish argv is not laundered into an attempt fact.
2. The proposal uses fixed loopback port `15433`, below the observed macOS ephemeral range, with
   all pre-consumption checks mapped to a non-retryable `PRECHECK_ABORT`.
3. The host probe is the exact bounded argv
   `/usr/bin/nc -z -w 5 127.0.0.1 <REHEARSAL_PORT>` with path and digest to be frozen in the future
   authorization; no dependency install is admitted.
4. Terminal outcome precedence is unambiguous: pre-consumption abort, post-consumption control
   override, publication failure, internal-ingress failure, or pass. Every record closes without a
   same-record retry.
5. The proposed topology record lives outside the runtime-candidate registry and requires its own
   schema, singleton allowlist, validator and negative tests before it can be authorized.
6. The consumed `HOLD`/`not_run` record must use a typed sealed-predecessor reference and must not
   be misclassified as a failed `NO-GO` legacy candidate.
7. Exact series allowlists must block arbitrary successor series under `golden-uat-v1`; topology
   evidence remains a typed non-authorizing prerequisite, not reusable execution evidence.

## Gate effect

- The diagnosis proposal is accepted for implementation planning.
- The topology rehearsal remains unauthorized until every section 9 control in the diagnosis is
  implemented, tested and independently reviewed.
- G-U2B RED remains unproven; GREEN, integrated UAT, demo and release remain `HOLD`.
- Production remains Founder only.
