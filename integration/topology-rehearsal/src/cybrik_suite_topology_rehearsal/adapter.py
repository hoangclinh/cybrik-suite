"""Adapters bound to named plan commands or bounded local file capabilities.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

`EFFECT_BINDINGS` is the complete method-to-command map and `ExactCommandAdapter` is the
only argv handoff. File adapters use exclusive no-follow creation and durable replacement.
Importing this module performs no I/O and grants no runtime authority.
"""

from __future__ import annotations

import os
import secrets
import stat
import time
from collections.abc import Mapping, Sequence
from types import MappingProxyType
from typing import Any

from .constants import (
    ATTEMPT_ORDINAL,
    AUTHORIZATION_NAMESPACE,
    CONTAINER_CREDENTIAL_PATH,
    CONTROL_REPOSITORIES,
    DOCKER_EXECUTABLE_PATH,
    PROBE_REACHABLE,
    PULL_POLICY,
    RUNTIME_LIMIT_SECONDS,
    SIGNER,
)
from .observe import platform_evidence
from .plan import (
    CREDENTIAL_ENVIRONMENT_KEY,
    TopologyPlan,
)
from .protocols import (
    SUCCESS_RETURNCODE,
    AttemptLedger,
    Clock,
    CommandResult,
    CommandRunner,
    ControlIdentitySource,
    CredentialPort,
    DockerPort,
    HostObservationSource,
    ProbePort,
    SignatureVerifier,
    decoded,
    decoded_listener,
    lines,
    normalized_result,
    require_exact,
    require_port,
    residual_names,
    succeeded,
    verified,
)

__all__ = [  # noqa: RUF022 - repository contract requires Python lexical order
    "AtomicFileAttemptLedger",
    "ControlIdentityCommandAdapter",
    "CredentialFileAdapter",
    "DockerCommandAdapter",
    "EFFECT_BINDINGS",
    "ExactCommandAdapter",
    "HostCommandAdapter",
    "MonotonicClock",
    "ProbeCommandAdapter",
    "SshSignatureCommandAdapter",
]

CONTROL_OBSERVATIONS = ("commit", "tree", "status")
CONTROL_EFFECTS = tuple(
    f"control:{repository}:{observation}"
    for repository in CONTROL_REPOSITORIES
    for observation in CONTROL_OBSERVATIONS
)

# Complete method-to-command map; every planned effect has one owner.
EFFECT_BINDINGS = MappingProxyType(
    {
        "observe_controls": CONTROL_EFFECTS,
        "observe_image": ("docker:image",),
        "observe_ephemeral_range": ("host:ephemeral_range",),
        "observe_listeners": ("host:listeners",),
        "observe_platform": ("docker:platform",),
        "observe_executable_digest": ("docker:digest",),
        "observe_publications": ("docker:publications",),
        "create_network": ("docker:create_network",),
        "create_volume": ("docker:create_volume",),
        "create_container": ("docker:create_container",),
        "start_container": ("docker:start_container",),
        "observe_health": ("docker:health",),
        "observe_container": ("docker:container",),
        "observe_daemon_event": ("docker:event",),
        "observe_docker_port": ("docker:port",),
        "observe_network": ("docker:network",),
        "remove:container": ("docker:remove_container",),
        "remove:network": ("docker:remove_network",),
        "remove:volume": ("docker:remove_volume",),
        "observe_residual": (
            "docker:residual_container",
            "docker:residual_network",
            "docker:residual_volume",
        ),
        "observe_digest": ("probe:digest",),
        "probe": ("probe:host",),
        "verify_signature": ("signature:verify",),
    }
)

# The reviewed runtime envelope, not a second timeout that could outlive the attempt.
EFFECT_TIMEOUT_SECONDS = RUNTIME_LIMIT_SECONDS
PENDING_SUFFIX = ".pending"
SECRET_BYTES = 32
ENCODING = "utf-8"

# The argv carries only the mounted credential path, never the credential value.
CREDENTIAL_ENVIRONMENT = MappingProxyType(
    {CREDENTIAL_ENVIRONMENT_KEY: CONTAINER_CREDENTIAL_PATH}
)

# In `lsof -Fpn`, `n` carries the listener address; other fields are ignored.
LISTENER_ADDRESS_FIELD = "n"
# A silent lsof status 1 is an observed absence; any output keeps it unresolved.
LISTENER_ABSENT_RETURNCODE = 1
# Exactly two readings describe the reviewed ephemeral range.
EPHEMERAL_RANGE_BOUNDS = 2

# Detached signatures over this bound are refused whole, never truncated.
SIGNATURE_MAX_BYTES = 8192

# Only nc status 1 is a reviewed refusal; every other nonzero status is unresolved.
PROBE_REFUSED = "refused"
PROBE_REFUSED_RETURNCODE = 1

# The durable ledger is serialized by its own pending file: its exclusive creator holds the
# one-attempt budget until it is replaced or discarded.
LEDGER_LOCK_ATTEMPTS = 600
LEDGER_LOCK_DELAY_SECONDS = 0.01

# The write bits that disqualify a credential's parent. Anyone who can write the parent can
# swap the name after creation, so exclusive creation of the file alone proves nothing.
UNSAFE_PARENT_WRITE_BITS = stat.S_IWGRP | stat.S_IWOTH


def bound_effect(binding: str) -> str:
    """The single named plan command a method is bound to."""
    effects = EFFECT_BINDINGS[binding]
    if len(effects) != 1:
        raise ValueError(f"{binding}: not a single-command binding")
    return effects[0]


def control_effects(repository: str) -> tuple[str, ...]:
    """The commit, tree and status effects bound to one control repository."""
    prefix = f"control:{repository}:"
    return tuple(
        effect for effect in EFFECT_BINDINGS["observe_controls"]
        if effect.startswith(prefix)
    )


def write_whole(handle: int, payload: bytes) -> None:
    """Complete interrupted or short writes; refuse zero progress."""
    written = 0
    while written < len(payload):
        try:
            count = os.write(handle, payload[written:])
        except InterruptedError:
            continue
        if count <= 0:
            raise ValueError(
                f"the write stalled after {written} of {len(payload)} bytes and the "
                "record is incomplete"
            )
        written += count


def close_quietly(handle: int) -> None:
    """Do not let cleanup replace an error that is already unwinding."""
    try:
        os.close(handle)
    except OSError:
        pass


def fsync_directory(path: str) -> None:
    """Flush the directory entry itself, so a created or replaced name survives a crash.

    Durable bytes say nothing about the name that reaches them: after a crash a replaced
    name could still resolve to the old inode. The open follows no symlink.
    """
    handle = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(handle)
    finally:
        os.close(handle)


def bounded_file_bytes(path: str, limit: int) -> bytes | None:
    """Read one bounded regular file without following links or blocking on a FIFO."""
    try:
        handle = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except OSError:
        return None
    material = bytearray()
    try:
        if not stat.S_ISREG(os.fstat(handle).st_mode):
            return None
        while len(material) <= limit:
            chunk = os.read(handle, limit + 1 - len(material))
            if not chunk:
                break
            material.extend(chunk)
    except OSError:
        return None
    finally:
        close_quietly(handle)
    return bytes(material) if len(material) <= limit else None


class ExactCommandAdapter:
    """The one place in the package where an argv reaches a command runner.

    A caller names an effect and never supplies one: the plan's tuple is handed over as-is.
    """

    def __init__(self, plan: TopologyPlan, runner: CommandRunner) -> None:
        # The one seam that can reach a process is checked structurally before it is held:
        # an annotation is only a comment at runtime, so a substitute that is not a runner
        # would otherwise surface once an effect was already being attempted.
        require_port("runner", runner, CommandRunner)
        self._plan = plan
        self._runner = runner

    @property
    def plan(self) -> TopologyPlan:
        return self._plan

    def run_effect(
        self,
        effect: str,
        *,
        timeout_seconds: float,
        stdin: bytes | None = None,
    ) -> CommandResult:
        argv = self._plan.commands.get(effect)
        if argv is None:
            raise ValueError(f"{effect}: not a named command in the reviewed plan")
        return self._runner.run(argv, timeout_seconds=timeout_seconds, stdin=stdin)


class ControlIdentityCommandAdapter(ControlIdentitySource):
    """Control-repository identity read from each injected worktree, never from `PATH`."""

    def __init__(self, plan: TopologyPlan, runner: CommandRunner) -> None:
        self._executor = ExactCommandAdapter(plan, runner)

    def observe_controls(self) -> Mapping[str, Any] | None:
        observed: dict[str, Any] = {}
        for repository in CONTROL_REPOSITORIES:
            commit, tree, status = control_effects(repository)
            commit_lines = lines(self._run(commit))
            tree_lines = lines(self._run(tree))
            status_result = normalized_result(self._run(status))
            if not commit_lines or not tree_lines or status_result is None:
                return None
            if status_result.returncode != SUCCESS_RETURNCODE:
                return None
            observed[repository] = {
                "commit": commit_lines[0],
                "tree": tree_lines[0],
                "clean": not status_result.stdout.strip(),
            }
        return observed

    def _run(self, effect: str) -> CommandResult:
        return self._executor.run_effect(
            effect, timeout_seconds=EFFECT_TIMEOUT_SECONDS
        )


class HostCommandAdapter(HostObservationSource):
    """Read-only host observations. Nothing here creates, mutates or connects."""

    def __init__(self, plan: TopologyPlan, runner: CommandRunner) -> None:
        self._plan = plan
        self._executor = ExactCommandAdapter(plan, runner)

    def observe_image(self, *, reference: str) -> Mapping[str, Any] | None:
        require_exact("reference", reference, self._plan.image_reference)
        projected = decoded(self._run(bound_effect("observe_image")))
        if isinstance(projected, list):
            projected = projected[0] if projected else None
        return projected if isinstance(projected, Mapping) else None

    def observe_ephemeral_range(self) -> tuple[int, int] | None:
        """Return exactly two increasing host ephemeral bounds, else unresolved."""
        observed = lines(self._run(bound_effect("observe_ephemeral_range")))
        if observed is None or len(observed) != EPHEMERAL_RANGE_BOUNDS:
            return None
        try:
            first, last = (int(value.split()[-1]) for value in observed)
        except ValueError:
            return None
        return (first, last) if first < last else None

    def observe_listeners(self, *, port: int) -> Sequence[Any] | None:
        """Every listener on the reviewed port, an empty tuple, or `None`.

        A matched listener, an observed absence and a failed observation are kept apart: a
        broken `lsof` must not read as the clean host a pre-consumption check looks for. It
        also exits 1 when it could not look, so only a silent status 1 is a real absence.
        """
        require_exact("port", port, self._plan.host_port)
        result = normalized_result(self._run(bound_effect("observe_listeners")))
        if result is None:
            return None
        if result.returncode == LISTENER_ABSENT_RETURNCODE:
            silent = not result.stdout.strip() and not result.stderr.strip()
            return () if silent else None
        if result.returncode != SUCCESS_RETURNCODE:
            return None
        observed: list[dict[str, Any]] = []
        for line in result.stdout.splitlines():
            field = line.strip()
            if not field.startswith(LISTENER_ADDRESS_FIELD):
                continue
            listener = decoded_listener(field[len(LISTENER_ADDRESS_FIELD):])
            if listener is None:
                return None
            observed.append(listener)
        return tuple(observed)

    def _run(self, effect: str) -> CommandResult:
        return self._executor.run_effect(
            effect, timeout_seconds=EFFECT_TIMEOUT_SECONDS
        )


class DockerCommandAdapter(DockerPort):
    """Every Docker effect, each one a named plan command validated before it runs."""

    def __init__(self, plan: TopologyPlan, runner: CommandRunner, clock: Clock) -> None:
        require_port("clock", clock, Clock)
        self._plan = plan
        self._executor = ExactCommandAdapter(plan, runner)
        self._clock = clock

    def observe_platform(self) -> Mapping[str, Any] | None:
        """The four reviewed platform facts, normalized here rather than left nested.

        The command renders a nested client/server document, while every consumer compares
        the flat reviewed inventory. Normalizing at the seam that owns the command keeps the
        raw shape from travelling any further than the adapter that produced it.
        """
        return platform_evidence(decoded(self._run(bound_effect("observe_platform"))))

    def observe_executable_digest(self, *, path: str) -> str | None:
        """The identity of the Docker client itself, so the tool is evidence too."""
        require_exact("path", path, DOCKER_EXECUTABLE_PATH)
        observed = lines(self._run(bound_effect("observe_executable_digest")))
        return observed[0].split()[0] if observed else None

    def observe_publications(self, *, port: int) -> Sequence[str] | None:
        require_exact("port", port, self._plan.host_port)
        return lines(self._run(bound_effect("observe_publications")))

    def create_network(self, *, name: str, internal: bool) -> str:
        require_exact("name", name, self._plan.network_name)
        require_exact("internal", internal, True)
        return self._mutate(bound_effect("create_network"))

    def create_volume(self, *, name: str) -> str:
        require_exact("name", name, self._plan.volume_name)
        return self._mutate(bound_effect("create_volume"))

    def create_container(
        self,
        *,
        name: str,
        image: str,
        network: str,
        volume: str,
        publish: str,
        pull: str,
        environment: Mapping[str, str],
    ) -> str:
        require_exact("name", name, self._plan.container_name)
        require_exact("image", image, self._plan.image_reference)
        require_exact("network", network, self._plan.network_name)
        require_exact("volume", volume, self._plan.volume_name)
        require_exact("publish", publish, self._plan.publish_spec)
        require_exact("pull", pull, PULL_POLICY)
        # The only environment the reviewed argv carries is the path of the read-only
        # credential mount. A password passed as an argument or as its own environment value
        # is readable in the process table by every other process on the host.
        require_exact("environment", dict(environment), dict(CREDENTIAL_ENVIRONMENT))
        return self._mutate(bound_effect("create_container"))

    def start_container(self, *, name: str) -> None:
        require_exact("name", name, self._plan.container_name)
        self._mutate(bound_effect("start_container"))

    def observe_health(self, *, container: str, deadline: float) -> str | None:
        """One health projection, bounded by whichever deadline expires first.

        A health check returning after the window closed would report on a container the
        attempt no longer owns. The window is measured on the injected clock alone.
        """
        require_exact("container", container, self._plan.container_name)
        remaining = min(deadline - self._clock.monotonic(), EFFECT_TIMEOUT_SECONDS)
        if remaining <= 0:
            return None
        projected = decoded(
            self._executor.run_effect(
                bound_effect("observe_health"), timeout_seconds=remaining
            )
        )
        return projected if isinstance(projected, str) else None

    def observe_container(self, *, container: str) -> Mapping[str, Any] | None:
        require_exact("container", container, self._plan.container_name)
        projected = decoded(self._run(bound_effect("observe_container")))
        return projected if isinstance(projected, Mapping) else None

    def observe_daemon_event(self, *, container: str) -> str | None:
        """The daemon's own view of the publication, or `None` when it did not resolve.

        An empty attribute is what the daemon renders when it has no publication to report,
        not a publication of the empty string; returning it would read as agreement.
        """
        require_exact("container", container, self._plan.container_name)
        projected = decoded(self._run(bound_effect("observe_daemon_event")))
        if not isinstance(projected, str) or not projected.strip():
            return None
        return projected

    def observe_docker_port(self, *, container: str, container_port: str) -> str | None:
        require_exact("container", container, self._plan.container_name)
        require_exact("container_port", container_port, self._plan.container_port_key)
        observed = lines(self._run(bound_effect("observe_docker_port")))
        return observed[0] if observed else None

    def observe_network(self, *, name: str) -> Mapping[str, Any] | None:
        require_exact("name", name, self._plan.network_name)
        projected = decoded(self._run(bound_effect("observe_network")))
        return projected if isinstance(projected, Mapping) else None

    def remove(self, *, kind: str, name: str) -> None:
        expected = {
            "container": self._plan.container_name,
            "network": self._plan.network_name,
            "volume": self._plan.volume_name,
        }
        if kind not in expected:
            raise ValueError(f"kind: {kind!r} is not a Docker resource of this plan")
        require_exact("name", name, expected[kind])
        self._mutate(bound_effect(f"remove:{kind}"))

    def observe_residual(self) -> Sequence[str] | None:
        inventory: list[str] = []
        for effect in EFFECT_BINDINGS["observe_residual"]:
            observed = residual_names(self._run(effect))
            if observed is None:
                return None
            inventory.extend(observed)
        return tuple(inventory)

    def _mutate(self, effect: str) -> str:
        return succeeded(effect, self._run(effect))

    def _run(self, effect: str) -> CommandResult:
        return self._executor.run_effect(
            effect, timeout_seconds=EFFECT_TIMEOUT_SECONDS
        )


class ProbeCommandAdapter(ProbePort):
    """The bounded, no-data host probe and the identity of its executable."""

    def __init__(self, plan: TopologyPlan, runner: CommandRunner) -> None:
        self._plan = plan
        self._executor = ExactCommandAdapter(plan, runner)

    def observe_digest(self, *, path: str) -> str | None:
        require_exact("path", path, self._plan.probe_executable_path)
        observed = lines(self._run(bound_effect("observe_digest")))
        return observed[0].split()[0] if observed else None

    def run(self, *, executable: str, argv: Sequence[str]) -> str | None:
        """The reviewed verdict, never the probe's own output.

        The probe sends no application data, so the verdict is its exit status: connected,
        refused, or unresolved. A refusal and an unresolved probe never read as each other.
        """
        require_exact("executable", executable, self._plan.probe_executable_path)
        require_exact("argv", tuple(argv), self._plan.host_probe[1:])
        result = normalized_result(self._run(bound_effect("probe")))
        if result is None:
            return None
        if result.returncode == SUCCESS_RETURNCODE:
            return PROBE_REACHABLE
        if result.returncode == PROBE_REFUSED_RETURNCODE:
            return PROBE_REFUSED
        return None

    def _run(self, effect: str) -> CommandResult:
        return self._executor.run_effect(
            effect, timeout_seconds=EFFECT_TIMEOUT_SECONDS
        )


class SshSignatureCommandAdapter(SignatureVerifier):
    """Detached signature verification of the externally signed grant."""

    def __init__(self, plan: TopologyPlan, runner: CommandRunner) -> None:
        self._plan = plan
        self._executor = ExactCommandAdapter(plan, runner)

    def verify(
        self,
        *,
        grant_bytes: bytes,
        signature_bytes: bytes,
        signer: str,
        namespace: str,
    ) -> bool | None:
        require_exact("signer", signer, SIGNER)
        require_exact("namespace", namespace, AUTHORIZATION_NAMESPACE)
        if not grant_bytes or not signature_bytes:
            return None
        before = bounded_file_bytes(self._plan.signature_path, SIGNATURE_MAX_BYTES)
        if before != signature_bytes:
            return None
        result = self._executor.run_effect(
            bound_effect("verify_signature"),
            timeout_seconds=EFFECT_TIMEOUT_SECONDS,
            stdin=grant_bytes,
        )
        after = bounded_file_bytes(self._plan.signature_path, SIGNATURE_MAX_BYTES)
        if after != before:
            return None
        return verified(result)


class CredentialFileAdapter(CredentialPort):
    """Exclusive, no-follow credential material bound to the reviewed plan path."""

    def __init__(self, plan: TopologyPlan) -> None:
        require_port("plan", plan, TopologyPlan)
        self._plan = plan

    def create(self, *, name: str) -> str:
        path = self._credential_path(name)
        # Judge the parent before any credential byte can reach it.
        self._require_trusted_parent(path)
        handle = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        try:
            write_whole(handle, secrets.token_urlsafe(SECRET_BYTES).encode(ENCODING))
            os.fsync(handle)
        except BaseException:
            close_quietly(handle)
            raise
        else:
            os.close(handle)
        # The bytes are durable but the name reaching them is not until the directory entry
        # is flushed too. A credential that survives a crash as an unreachable inode is
        # indistinguishable from one that was never created.
        fsync_directory(os.path.dirname(path))
        return path

    def remove(self, *, name: str) -> None:
        """Unlink the credential itself, following nothing.

        Removal is unconditional rather than guarded by an existence check: the check would
        follow a symlink, and the path could change between the check and the unlink anyway.
        """
        try:
            os.unlink(self._credential_path(name))
        except FileNotFoundError:
            return

    def observe_residual(self, *, name: str) -> bool | None:
        """Whether anything at all remains at the credential path.

        `lstat` follows nothing, so a dangling link left at the path is reported as the
        residue it is. A path that cannot be observed at all is unresolved, never clean.
        """
        try:
            os.lstat(self._credential_path(name))
        except FileNotFoundError:
            return False
        except OSError:
            return None
        return True

    def _require_trusted_parent(self, path: str) -> None:
        """Refuse a credential parent this user does not exclusively control.

        `lstat` follows nothing, so a symlink standing in for the directory is classified
        as the non-directory it is rather than judged by what it points at. The exact parent
        is examined, because that entry is the one the credential's name can be swapped in.
        """
        parent = os.path.dirname(path)
        try:
            status = os.lstat(parent)
        except OSError as error:
            raise ValueError(
                f"{parent}: the credential parent directory is missing or unobservable "
                f"and no credential is written: {error}"
            ) from error
        if not stat.S_ISDIR(status.st_mode):
            raise ValueError(f"{parent}: the credential parent is not a directory")
        owner = os.getuid()
        if status.st_uid != owner:
            raise ValueError(
                f"{parent}: the credential parent directory owner {status.st_uid} is not "
                f"this user {owner}"
            )
        if stat.S_IMODE(status.st_mode) & UNSAFE_PARENT_WRITE_BITS:
            raise ValueError(
                f"{parent}: the credential parent directory is group- or other-writable"
            )

    def _credential_path(self, name: str) -> str:
        """The reviewed credential path, for the one reviewed credential name only.

        The path is read from the plan, never composed from the name, so no caller can
        steer the adapter at a path the reviewed argv does not mount.
        """
        require_exact("name", name, self._plan.credential_name)
        return self._plan.credential_path


class AtomicFileAttemptLedger(AttemptLedger):
    """The durable one-attempt budget, written whole or not at all.

    A consumed record is appended by writing a fresh exclusive file and replacing the ledger
    in one step, so an interrupted consumption cannot leave a half-written budget a later
    attempt would read as unused. That pending file is also the lock: exclusive creation
    admits one consumer at a time and the consumed state is re-read *inside* it, so the
    second of two consumers that both saw an unused budget is refused.

    A pending file left behind is not garbage to clear. It is either a live consumer's lock
    or the debris of one that died, told apart only by age: one older than the whole runtime
    envelope cannot be live, while a recent one is waited out and then refused rather than
    removed. Anything there that is not a regular file is refused and never unlinked.
    """

    def __init__(self, path: str) -> None:
        self._path = path

    def is_consumed(self, *, record_id: str) -> bool:
        return any(entry.split()[0] == record_id for entry in self._entries())

    def consume(self, *, record_id: str, attempt_ordinal: int) -> None:
        # The ordinal is checked first, so an attempt that is not the one reviewed attempt
        # is refused before any file exists to be cleaned up.
        require_exact("attempt_ordinal", attempt_ordinal, ATTEMPT_ORDINAL)
        self._require_unconsumed(record_id)
        pending = f"{self._path}{PENDING_SUFFIX}"
        handle = self._acquire(pending)
        replaced = False
        try:
            self._require_unconsumed(record_id)
            entries = (*self._entries(), f"{record_id} {attempt_ordinal}")
            try:
                write_whole(handle, ("\n".join(entries) + "\n").encode(ENCODING))
                os.fsync(handle)
            except BaseException:
                close_quietly(handle)
                raise
            else:
                os.close(handle)
            os.replace(pending, self._path)
            replaced = True
            # The replace is only atomic in memory until the directory entry is durable.
            # Without this, a crash could leave the old, unconsumed ledger resolving at the
            # durable name while the consuming attempt had already been reported as spent.
            fsync_directory(self._directory())
        except BaseException:
            # Only an unreplaced pending file is still this consumer's to drop. Once the
            # replace has happened this consumer no longer owns that name, and anything
            # standing there again belongs to a consumer that acquired it afterwards.
            if not replaced:
                self._discard(pending)
            raise

    def _require_unconsumed(self, record_id: str) -> None:
        if self.is_consumed(record_id=record_id):
            raise ValueError(
                f"{record_id}: the one topology attempt is already consumed"
            )

    def _directory(self) -> str:
        return os.path.dirname(self._path) or os.curdir

    def _acquire(self, pending: str) -> int:
        """Try briefly for an exclusive hold; preserve and refuse a recent live hold."""
        for _ in range(LEDGER_LOCK_ATTEMPTS):
            if self._reclaimable(pending):
                handle = self._create_pending(pending)
                if handle is not None:
                    return handle
            time.sleep(LEDGER_LOCK_DELAY_SECONDS)
        raise ValueError(
            f"{pending}: the attempt ledger is still held by a consumption in flight — a "
            "recent pending ledger is preserved rather than broken open"
        )

    def _create_pending(self, pending: str) -> int | None:
        """Exclusive, no-follow hold on the pending path, or `None` if someone else has it."""
        try:
            return os.open(
                pending,
                os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW,
                0o600,
            )
        except FileExistsError:
            return None

    def _reclaimable(self, pending: str) -> bool:
        """Whether the pending path is free, reclaiming only debris that cannot be live.

        `lstat` comes first and follows nothing, so a symlink planted at the pending path is
        classified before any call that might traverse it. Only a regular file older than
        the entire runtime envelope is reclaimed: unlinking a recent one could hand a second
        consumer the budget a live first consumer is still spending.
        """
        try:
            status = os.lstat(pending)
        except FileNotFoundError:
            return True
        if not stat.S_ISREG(status.st_mode):
            raise ValueError(
                f"{pending}: a symlink or other non-regular file at the pending ledger "
                "path is refused, never followed and never removed"
            )
        if time.time() - status.st_mtime <= RUNTIME_LIMIT_SECONDS:
            return False
        try:
            os.unlink(pending)
        except FileNotFoundError:
            pass
        return True

    def _discard(self, pending: str) -> None:
        """Drop this consumer's own pending file, and nothing that is not a regular file."""
        try:
            if not stat.S_ISREG(os.lstat(pending).st_mode):
                return
            os.unlink(pending)
        except FileNotFoundError:
            return

    def _entries(self) -> tuple[str, ...]:
        """Every recorded entry, refusing to read the durable budget through a symlink.

        A ledger reached through a link is somebody else's file. An absent ledger is an
        unused budget, but an unreadable one is never quietly treated as empty.

        The open is non-blocking, so a FIFO planted at the durable path is refused rather
        than stalling the rehearsal on a writer that never arrives, and what was reached is
        settled by `fstat` on the descriptor itself — a name checked before the open could
        be a different object by then. A non-regular descriptor is closed before refusing.
        """
        try:
            handle = os.open(self._path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        except FileNotFoundError:
            return ()
        except OSError as error:
            raise ValueError(
                f"{self._path}: the attempt ledger is unreadable — this refuses to follow "
                f"a symlink at the durable ledger path: {error}"
            ) from error
        try:
            if not stat.S_ISREG(os.fstat(handle).st_mode):
                raise ValueError(
                    f"{self._path}: a non-regular file at the durable ledger path is "
                    "refused, never read and never removed"
                )
            stream = os.fdopen(handle, encoding=ENCODING)
        except OSError as error:
            close_quietly(handle)
            raise ValueError(
                f"{self._path}: the attempt ledger is unreadable and its refusal is never "
                f"an empty budget: {error}"
            ) from error
        except BaseException:
            close_quietly(handle)
            raise
        with stream:
            return tuple(line.strip() for line in stream if line.strip())


class MonotonicClock(Clock):
    """The elapsed-time source for the bounded runtime envelope.

    A monotonic reading cannot be moved by the host changing its idea of the time.
    """

    def monotonic(self) -> float:
        return time.monotonic()
