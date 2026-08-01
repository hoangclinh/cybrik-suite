# integration/compose

Status: `NOT IMPLEMENTED` — dependency-neutral preparation only.

Local multi-product composition for integration testing. No compose manifest, container
definition, service description or runtime runner has been authored here; none may be fabricated
ahead of runnable integrations.

One directory exists:

| Directory | Status | What it is |
|---|---|---|
| `soc-ai-lifecycle-create-mtls/` | `NOT IMPLEMENTED` — dependency-neutral controls | Pre-D1 pure/static policy, evidence, procedure and N1–N10 inventory for the prospective SOC→Cyber AI lifecycle-create mTLS UAT harness. No runner or runtime authority exists. |

The preparation scope is bounded by
`docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md` §6.1. Nothing under this directory
imports an Anycorn module, resolves or installs a package, opens a socket, starts a process,
touches a database or certificate, or mutates a runtime-admission field.

UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO. Gate `UAT-MTLS-D1` (dependency installation) and gate
`UAT-MTLS-D2` (real runtime execution) both remain **HOLD**.
