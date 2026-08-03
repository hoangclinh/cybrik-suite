# Master integrated UAT orchestrator

Status: **IMPLEMENTED — STATICALLY VERIFIED — RUNTIME NOT RUN — RUNTIME/DEMO
HOLD**.

This directory owns the one-shot local, non-production integrated UAT harness.
It composes the concrete PostgreSQL D2 SOC-to-AI lifecycle stage with the
SOC-to-AI-to-Tool-Fabric alert-context stage. The concrete subprocess adapters,
environment inspector, recovery path and exact-only entry point are implemented.
No runtime attempt, listener, PostgreSQL service or product process was started
while producing this source packet.

Release dates are unchanged. Production remains Founder-only and is outside
this local UAT admission.

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
idempotent teardown and absence check, followed by common recovery. Success
seals contain both accepted stage digests. Failure seals contain a stable
failure code and only digests from stages that completed receipt validation;
they never pretend that both stages passed. The exclusive canonical terminal
seal is never overwritten.

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

The signed packet and detached signature are external operator artifacts. The
deterministic generator prepares an unsigned packet; it never signs, consumes
authorization, starts a listener or product, or runs either UAT stage.

### Operator sequence

Perform these steps in order. Do not combine packet preparation with runtime
admission.

1. Freeze and commit the intended source in all four repositories. Verify each
   repository is clean; the generator observes the exact commits, trees and
   tracked-source aggregate twice and refuses source drift. Do not change a
   repository after emitting the packet.
2. Create six mutually disjoint, empty, current-UID directories with mode
   `0700`, outside every repository: the master evidence root and the five
   capability roots listed above. The D2 directory leaf names must match
   `cybrik-uat-d2-runtime-<id>` and `cybrik-uat-d2-evidence-<id>`. Create a
   seventh, separate, empty, current-UID, mode-`0700` private output directory
   for the unsigned payload and preparation receipt. The two output files must
   not already exist.
3. From `integration/compose/integrated-uat`, export exactly the preparation
   environment below, replacing every absolute example path with the frozen
   local path. Do not add unreviewed `CYBRIK_UAT_*` variables.

   ```sh
   export CYBRIK_UAT_SUITE_ROOT=/absolute/path/to/cybrik-suite
   export CYBRIK_UAT_SOC_ROOT=/absolute/path/to/cybrik-soc-command-center
   export CYBRIK_UAT_CYBER_AI_ROOT=/absolute/path/to/cybrik-cyber-ai-platform
   export CYBRIK_UAT_TOOL_FABRIC_ROOT=/absolute/path/to/cybrik-security-tool-fabric
   export CYBRIK_UAT_MASTER_EVIDENCE_ROOT=/private/path/master-evidence
   export CYBRIK_UAT_D2_RUNTIME_DIR=/private/path/cybrik-uat-d2-runtime-run-id
   export CYBRIK_UAT_D2_EVIDENCE_DIR=/private/path/cybrik-uat-d2-evidence-run-id
   export CYBRIK_UAT_RUNTIME_ROOT=/private/path/alert-context-runtime
   export CYBRIK_UAT_EVIDENCE_ROOT=/private/path/alert-context-evidence
   export CYBRIK_UAT_STATE_ROOT=/private/path/alert-context-state
   export CYBRIK_UAT_B1_WHEEL=/private/path/anycorn-0.20.0+cybrik.1-py3-none-any.whl
   export CYBRIK_UAT_PYTHON=/absolute/path/to/pinned-python
   export CYBRIK_UAT_AUTHORIZATION_ALLOWED_SIGNERS=/private/path/allowed_signers
   export CYBRIK_UAT_ALLOWED_SIGNER=FOUNDER
   ```

   `CYBRIK_UAT_AUTHORIZATION_ALLOWED_SIGNERS` is the external public
   allowed-signers file matching the tracked trust descriptor; it is not a
   private key and must be a current-UID, single-link, mode-`0600` regular file.
   The B1 wheel must have the exact filename shown above, SHA-256
   `d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c`,
   current UID, one link and mode `0600`. `CYBRIK_UAT_PYTHON` must be the
   absolute, single-link regular executable whose SHA-256 is the tracked value
   `a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623`;
   its mode must be `0700` or `0755`, with no group or other write bit.
4. Emit one deterministic unsigned packet, using timezone-aware timestamps and
   an expiry no more than 24 hours after issue. Both output paths must be inside
   the private output directory from step 2.

   ```sh
   python -B -P scripts/generate_master_authorization.py emit \
     --authorization-id run-id \
     --authorized-by FOUNDER \
     --issued-at 2026-08-03T10:00:00+07:00 \
     --expires-at 2026-08-04T10:00:00+07:00 \
     --payload-output /private/path/packet/master-authorization.json \
     --receipt-output /private/path/packet/preparation-receipt.json
   ```

   Success returns `PREPARED_UNSIGNED`. The files are created once as
   mode-`0600` regular files. Inspect the receipt, confirm its
   `authorization_id` and `payload_sha256`, and independently hash the payload.
   The canonical authorization payload intentionally has **no trailing
   newline**; do not open and save it in an editor or append bytes. The receipt
   contains a non-secret `signing_argv_template` with
   `<PRIVATE_KEY_PATH>` and `<AUTHORIZATION_PAYLOAD_PATH>` placeholders. It
   never records or discovers a private-key path.
5. Transfer the unchanged payload to the external Founder signing boundary.
   The Founder replaces the receipt placeholders and creates a detached SSHSIG
   with `/usr/bin/ssh-keygen -Y sign` under the namespace shown in the receipt.
   Packet preparation does not perform this step. Return the detached signature
   without exposing or copying the Founder private key into a repository,
   capability root or receipt.
6. Only after the payload and detached signature are present, set
   `CYBRIK_UAT_AUTHORIZATION_FILE` and
   `CYBRIK_UAT_AUTHORIZATION_SIGNATURE` to those exact artifacts. Start a
   separate, explicit, one-shot runtime admission:

   ```sh
   export CYBRIK_UAT_AUTHORIZATION_FILE=/private/path/packet/master-authorization.json
   export CYBRIK_UAT_AUTHORIZATION_SIGNATURE=/private/path/packet/master-authorization.json.sig
   python -B -P scripts/run_integrated_uat.py --execute
   ```

Never hand-edit or reuse a prior alert-only authorization. The generator does
not make runtime GO; only the subsequent exact admission can consume the packet.
A post-consumption failure is terminal evidence, not a retry instruction.

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

Latest local static result on `2026-08-03`:

- integrated master: `164 passed`;
- alert-context bounded static subset: `250 passed`; five dependency-bound test
  files plus `runtime_composition` were not rerun because the existing offline
  environment does not contain `referencing`. This is a bounded environment
  omission, not a test failure; and
- D2 bounded suite: `1692 passed, 2 skipped`; nine explicit D1 artifact tests
  were not rerun because no composite D1 artifact root was supplied.

These results are static/bounded evidence only. They do not claim a runtime
attempt, browser URL, UI account, demo GO, release GO or production readiness.
