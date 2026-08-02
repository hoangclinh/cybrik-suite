# integration/compose

Status: `D2 COVERAGE GATE PASS — RUNTIME NOT RUN`.

Local multi-product composition preparation for integration testing. No compose manifest,
container definition or runtime runner is active here. The only current directory is:

| Directory | Status | What it is |
|---|---|---|
| `soc-ai-lifecycle-create-mtls/` | `D2 COVERAGE GATE PASS — RUNTIME NOT RUN` | D1 artifact evidence plus an import-inert, exact-pin, fail-closed D2 harness. Coverage-only M2 passed at 87.117% line and 85.409% branch; no listener, database, PKI, migration or product runtime has run. |

D1 used only the bounded paths and outbound/tooling authority recorded in
`docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md`. The internal
`anycorn-cybrik-uat-b1` artifact is installed and pinned only in
`suite_uat_tool_lock_only`; product `selected=false`, `selected_server=null`, and the raw official
Anycorn candidate remains uninstalled, unpinned and `HOLD`.

The D1 dependency boundary remains `D1 ARTIFACT COMPLETE — RUNTIME NOT RUN`. The D2 coverage
prerequisite is verified at `UAT-MTLS-D2-COV-M2`; the guarded runtime harness and N1–N10 checks
remain authored but not run. Gate `UAT-MTLS-D2` remains
**HOLD** and is the only gate that may open listeners, start separate processes or PostgreSQL, use
ephemeral dev PKI, or execute runtime checks. `DEMO_READY_LOCAL`, UAT, POC, RC, stable-v1 and GA
remain **NO-GO**; release dates are unchanged.
