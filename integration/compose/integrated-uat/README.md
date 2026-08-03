# Master integrated UAT orchestrator

Status: **IMPLEMENTED — STATICALLY VERIFIED — RUNTIME NOT RUN**.

This directory owns the one-shot local, non-production integrated UAT harness.
It composes the concrete PostgreSQL D2 SOC-to-AI lifecycle stage with the
SOC-to-AI-to-Tool-Fabric alert-context stage. The concrete subprocess adapters,
environment inspector, recovery path and exact-only entry point are implemented.
No runtime attempt, listener, PostgreSQL service or product process was started
while producing this source packet.

## Frozen boundary

One master authorization binds this exact ordered repository tuple:

1. `cybrik-soc-command-center`;
2. `cybrik-cyber-ai-platform`;
3. `cybrik-security-tool-fabric`; and
4. `cybrik-suite`.

The canonical signed payload schema is
`CYBRIK-INTEGRATED-UAT-MASTER-AUTH/v1`. It binds the tuple and tracked-source
aggregate; four repository roots; the master evidence root; five ordered
capability roots; four helper-script hashes; the B1 wheel; the pinned Python
executable; freshness; signer; run identity; and one-shot policy. The alert-only
child schema is rejected. Exactly one SSHSIG verification is performed.

Every repository must remain clean. The same tuple and aggregate are required
at admission, in both child receipts and after teardown. The current master
schema shares the existing tracked alert SSHSIG namespace; schema-level domain
separation is enforced. A distinct namespace remains a separately authorized
trust-credential change.

The evidence root must be an absolute canonical directory owned by the current
UID, mode `0700`, outside and disjoint from all four canonical repository roots.
The empty-directory link count must match the filesystem-safe value `1` or `2`;
each marker and seal file must be a single-link, current-UID, mode `0600` regular
file opened without symlink traversal.

The five capability roots are, in order:

1. `postgres_d2_runtime`;
2. `postgres_d2_evidence`;
3. `alert_context_runtime`;
4. `alert_context_evidence`; and
5. `alert_context_state`.

All must be empty at preflight. PostgreSQL public evidence may remain in its
evidence root after D2; its runtime root and all three alert-owned roots must be
empty after teardown. The required absent-port set is exactly `55432`, `58442`,
`58443`, and `58444`.

## One-shot order

The concrete orchestration order is:

1. validate authorization and prove the marker and terminal seal are absent;
2. inspect the exact tuple, aggregate, clean repositories and absent ports;
3. atomically consume authorization before any stage effect;
4. run the concrete PostgreSQL D2 stage;
5. teardown that stage and prove it absent before the next stage;
6. run, teardown and absence-check the concrete alert-context stage;
7. run the common recovery teardown and absence check;
8. repeat the exact terminal environment inspection; and
9. emit exactly one combined terminal outcome seal.

Any post-consumption failure is terminal and cannot be retried because the
marker is permanent. A partially entered child stage is always offered a real,
idempotent teardown and absence check, followed by common recovery. Success seals contain
both accepted stage digests. Failure seals contain a stable failure code and
only digests from stages that completed receipt validation; they never pretend
that both stages passed. The exclusive canonical terminal seal is never
overwritten.

Every terminal outcome binds a SHA-256 digest of its canonical absence proof.
That proof covers the exact four absent ports, PostgreSQL, process, private
artifact, runtime artifact and PKI absence, plus the clean exact repository
tuple. If terminal inspection itself fails, the outcome records a canonical
fail-closed proof with no absence claims.

## Execution boundary

Running `scripts/run_integrated_uat.py` without exactly `--execute` is inert and
returns canonical `HOLD`. `--execute` still cannot enter runtime unless every
required `CYBRIK_UAT_*` path is canonical and purpose-bound, all six external
directories are empty/current-UID/mode `0700`, the repositories are clean at
the signed commits and trees, the B1 and Python hashes match, and the master
payload plus detached SSHSIG passes admission. Admission creates no child grant;
only the master writes the reservation, consumption marker and combined seal.

The signed packet and detached signature are external operator artifacts. Freeze
and commit the source first, generate one canonical master payload for that
exact tuple, sign it under the tracked namespace and execute only once. Never
hand-edit or reuse a prior alert-only authorization. A post-consumption failure
is terminal evidence, not a retry instruction.

This backend harness does not itself provide a browser URL, UI account or
persona UAT. Those remain a separate UI/runtime admission gate.

## Static verification

These commands perform no product runtime or network action:

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=integration/compose/integrated-uat/src \
  python -m pytest -q -p no:cacheprovider integration/compose/integrated-uat/tests

ruff check integration/compose/integrated-uat
ruff format --check integration/compose/integrated-uat
```

Latest local static result on `2026-08-03`: integrated master `120 passed`,
alert-context harness `292 passed`, and the bounded D2/master regression
`431 passed, 1 skipped`. The former docs-only deselection was resolved by
evidence-hash reconciliation.
