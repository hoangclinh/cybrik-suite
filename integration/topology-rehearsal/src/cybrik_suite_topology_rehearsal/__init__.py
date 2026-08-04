"""Bounded library core for the G-U2B PostgreSQL loopback topology rehearsal.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Only the bounded C8-A core is present: `constants`, `errors`, `protocols`, `plan`, and
`adapter`. The later `observe`, `grant`, `preparation`, `admission`, and `runner` modules and
both entrypoint scripts remain absent, and their tests stay RED.

Importing this package performs no I/O and authorizes no Docker effect, listener,
PostgreSQL attempt, UAT, demo, merge, release, or production action.
"""
