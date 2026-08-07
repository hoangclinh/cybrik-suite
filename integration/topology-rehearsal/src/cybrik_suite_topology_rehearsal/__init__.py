"""Bounded library core for the G-U2B PostgreSQL loopback topology rehearsal.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Only part of the bounded C8 library core is present: `constants`, `errors`, `protocols`,
`adapter`, `plan`, `views`, `observe`, `grant`, `preparation`, `admission`, and `runner`,
together with both entrypoint scripts, `prepare_topology_grant.py` and
`run_topology_rehearsal.py`.

Landed is not run. Neither script has been executed against Docker, a listener or a
database, and the runner entrypoint's own authorization loader refuses rather than building
an envelope no reviewed module builds.

Importing this package performs no I/O and authorizes no Docker effect, listener,
PostgreSQL attempt, UAT, demo, merge, release, or production action.
"""
