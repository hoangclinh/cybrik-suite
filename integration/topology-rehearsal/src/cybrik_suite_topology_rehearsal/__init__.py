"""Bounded, topology-only rehearsal runner for the G-U2B PostgreSQL loopback question.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

This package implements the runner specified by
`docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1/G-U2B-POSTGRES-RUNTIME-TOPOLOGY-DIAGNOSIS-R1.md`
sections 7 and 8. It is injection-only: every process, socket, Docker and file capability
arrives through an injected port declared in `protocols`, and every argv it can ever hand
to an executor is a named entry in the immutable plan built by `plan`.

Importing this package authorizes nothing. It performs no I/O at import time, and it
carries no authority for a Docker effect, a listener, a PostgreSQL RED attempt, UAT, a
demo, a merge, a release or any production action.
"""
