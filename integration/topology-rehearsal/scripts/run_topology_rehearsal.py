"""Inert runner entrypoint for the G-U2B topology rehearsal attempt.

Importing this script performs no I/O, imports no library module and authorizes no Docker
effect, listener, PostgreSQL attempt, UAT, demo, merge, release or production action. Every
library import is taken inside the function that needs it, so the front door stays inert.

Nothing runs without the exact `--execute` request together with the two external artifact
paths and the four `--control-root NAME=PATH` worktrees. Any other argv returns the fixed
non-zero hold exit. The control roots are the operator's own declaration: this file reads
them off argv and forwards them unmodified, and there is no second way to obtain them.
"""

from __future__ import annotations

import argparse
import subprocess
from collections.abc import Sequence
from typing import Any

__all__ = [
    "HOLD_EXIT",
    "SubprocessCommandRunner",
    "build_parser",
    "build_runtime_wiring",
    "execute_authorized_attempt",
    "main",
]

HOLD_EXIT = 2

# The bound every argv this executor is handed runs under. It is a property of the one
# executor object rather than of a call site, so no adapter can widen it.
COMMAND_TIMEOUT_SECONDS = 120.0

CONTROL_ROOT_SEPARATOR = "="

# The one attempt-ledger file name. It is appended to a path the plan already derived, so
# this file names no worktree and re-decides no trust anchor.
ATTEMPT_LEDGER_SUFFIX = ".attempt-ledger"


class SubprocessCommandRunner:
    """The single process seam, argv-only, `shell=False` and timeout-bounded.

    One class, one spawn site, and exactly one instance on the default path. The bounds are
    per-instance, so a second executor would be a second unreviewed seam.
    """

    def run(
        self,
        argv: Sequence[str],
        *,
        timeout_seconds: float,
        stdin: bytes | None = None,
    ) -> Any:
        from cybrik_suite_topology_rehearsal.protocols import CommandResult

        try:
            completed = subprocess.run(
                list(argv),
                shell=False,
                capture_output=True,
                timeout=timeout_seconds,
                input=stdin,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            return CommandResult()
        return CommandResult(
            returncode=completed.returncode,
            stdout=completed.stdout.decode("utf-8", "replace"),
            stderr=completed.stderr.decode("utf-8", "replace"),
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--grant")
    parser.add_argument("--signature")
    # Repeatable and accumulating: four declared worktrees must stay four.
    parser.add_argument("--control-root", dest="control_root", action="append", default=[])
    return parser


def _control_root_pair(token: object) -> tuple[str, str]:
    """One `NAME=PATH` token, or a refusal naming the shape that was wrong."""
    if not isinstance(token, str) or CONTROL_ROOT_SEPARATOR not in token:
        raise ValueError("control-root: a worktree is declared as NAME=PATH")
    name, _, path = token.partition(CONTROL_ROOT_SEPARATOR)
    if not name or not path:
        raise ValueError("control-root: both the name and the path must be given")
    return name, path


def _control_roots(tokens: Sequence[object]) -> dict[str, str]:
    """Fold the typed tokens, refusing a second declaration of one already named."""
    roots: dict[str, str] = {}
    for token in tokens:
        name, path = _control_root_pair(token)
        if name in roots:
            raise ValueError("control-root: a worktree was declared twice")
        roots[name] = path
    if not roots:
        raise ValueError("control-root: no worktree was declared")
    return roots


def load_authorization(grant_path: str, signature_path: str) -> Any:
    """Refuse: the envelope this would build is not authored and not reviewed.

    The identity of this function is pinned by
    `test_default_dependency_loader_returns_the_reviewed_real_triple`; its *behaviour* is
    pinned by nothing, because every test injects its own loader. That asymmetry is the whole
    reason it refuses rather than guesses.

    The envelope the runner consumes carries `record_sha256`, `runner_aggregate_sha256`,
    `expected_controls` and one `observed_at` instant, and none of the four is derived from
    the grant — a fact copied out of the document it is meant to check proves only that
    copying works. Each is an authority input: the record digest and the runner aggregate
    digest decide what the admission decision is taken *about*, and `expected_controls` is
    what preparation forces the signature-covered pin to agree with. No module in `src`
    builds this envelope and no test states its loading contract, so any implementation here
    would be nine unreviewed authority decisions taken by whichever spelling turned the bar
    green.

    Refusing is therefore the fail-closed answer and not a gap: RUNTIME is HOLD, this slice is
    static, and an entrypoint whose default path cannot fabricate an authorization is exactly
    the inertness the front door advertises. The refusal is the typed `PrecheckAbort` the
    operator is owed, naming the boundary rather than the argv.
    """
    from cybrik_suite_topology_rehearsal.errors import PrecheckAbort

    raise PrecheckAbort(
        "load_authorization: building the authorization envelope from "
        f"{grant_path!r} and {signature_path!r} is not authorized in this slice"
    )


def load_runtime_dependencies() -> Any:
    """The reviewed real triple this composition root runs on."""
    from types import SimpleNamespace

    from cybrik_suite_topology_rehearsal.runner import run_topology_rehearsal

    return SimpleNamespace(
        authorization_loader=load_authorization,
        wiring_builder=build_runtime_wiring,
        runner=run_topology_rehearsal,
    )


def build_runtime_wiring(
    *,
    authorization: Any,
    repository_roots: Any,
    command_runner: Any = None,
) -> Any:
    """Compose the one plan, the one executor and the complete adapter surface.

    The four worktrees arrive as a mandatory argument. Nothing here reads the host, the
    envelope or this file's own location for one; there is no fallback, so a caller that did
    not name them has left nothing honest behind and is refused by name.

    The key space belongs to `plan`. This function re-raises `plan`'s refusal as the typed
    abort the operator is owed rather than answering the question a second time.
    """
    from types import SimpleNamespace

    from cybrik_suite_topology_rehearsal import adapter, plan
    from cybrik_suite_topology_rehearsal.errors import PrecheckAbort
    from cybrik_suite_topology_rehearsal.protocols import Adapters
    from cybrik_suite_topology_rehearsal.runner import attempt_id_for

    identity = authorization.grant["observed_image_identity"]
    try:
        built = plan.build_plan(
            attempt_id=attempt_id_for(identity["observed_at"]),
            image_reference=(
                f"{identity['repository']}{plan.DIGEST_MARKER}"
                f"{identity['manifest_digest']}"
            ),
            repository_roots=repository_roots,
        )
    except PrecheckAbort:
        raise
    except Exception as error:
        raise PrecheckAbort(
            f"repository_roots: the four control worktrees were not named ({error})"
        ) from error

    runner = SubprocessCommandRunner() if command_runner is None else command_runner
    clock = adapter.MonotonicClock()
    command_adapters = {
        "controls": adapter.ControlIdentityCommandAdapter(built, runner),
        "docker": adapter.DockerCommandAdapter(built, runner, clock),
        "host": adapter.HostCommandAdapter(built, runner),
        "probe": adapter.ProbeCommandAdapter(built, runner),
        "signature": adapter.SshSignatureCommandAdapter(built, runner),
    }
    credential = adapter.CredentialFileAdapter(built)
    ledger = adapter.AtomicFileAttemptLedger(
        f"{built.signature_path}{ATTEMPT_LEDGER_SUFFIX}"
    )
    adapters = Adapters(
        identities=command_adapters["controls"],
        host=command_adapters["host"],
        docker=command_adapters["docker"],
        probe=command_adapters["probe"],
        credential=credential,
        verifier=command_adapters["signature"],
        ledger=ledger,
        clock=clock,
    )
    return SimpleNamespace(
        plan=built,
        command_runner=runner,
        command_adapters=command_adapters,
        adapters=adapters,
        credential=credential,
        ledger=ledger,
        clock=clock,
    )


def execute_authorized_attempt(
    grant_path: str,
    signature_path: str,
    *,
    repository_roots: Any,
    dependencies_loader: Any = load_runtime_dependencies,
) -> int:
    """Load once, build once, run once, and hold on anything that is not a pass."""
    from cybrik_suite_topology_rehearsal.constants import TOPOLOGY_PASS
    from cybrik_suite_topology_rehearsal.errors import PrecheckAbort

    dependencies = dependencies_loader()
    authorization = dependencies.authorization_loader(grant_path, signature_path)
    try:
        wiring = dependencies.wiring_builder(
            authorization=authorization,
            repository_roots=repository_roots,
        )
    except PrecheckAbort:
        return HOLD_EXIT
    result = dependencies.runner(
        authorization,
        wiring.adapters,
        execute_requested=True,
    )
    return 0 if result.outcome == TOPOLOGY_PASS else HOLD_EXIT


def main(
    argv: Sequence[str] | None = None,
    *,
    execute: Any = execute_authorized_attempt,
) -> int:
    """Read what was typed and forward it, or hold before anything is opened."""
    try:
        parsed = build_parser().parse_args(list(argv or []))
    except SystemExit:
        return HOLD_EXIT
    if not parsed.execute or not parsed.grant or not parsed.signature:
        return HOLD_EXIT
    try:
        roots = _control_roots(parsed.control_root)
    except ValueError:
        return HOLD_EXIT
    from cybrik_suite_topology_rehearsal.errors import PrecheckAbort

    try:
        return execute(parsed.grant, parsed.signature, repository_roots=roots)
    except PrecheckAbort:
        # A typed refusal from below is the operator's answer, not a traceback: the key
        # space belongs to `plan`, and `main` only reports the hold it was handed.
        return HOLD_EXIT
