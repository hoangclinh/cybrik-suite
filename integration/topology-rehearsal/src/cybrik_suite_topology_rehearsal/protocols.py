"""Injected capability boundaries for a runner that performs no hidden I/O.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Every external capability the rehearsal can ever reach is declared here as a
runtime-checkable protocol, and nothing else in the package may reach past one. That is the
structural isolation control of diagnosis section 7 item 7: a module that cannot name a
process, a socket or a Docker client cannot acquire one by accident, and a substitute passed
in during review is checkable at the boundary rather than trusted.

`None` is the single unresolved value across every port. A port that cannot answer returns
`None`; it never returns a cheerful default, because a defaulted observation would let an
unresolved control read as a satisfied one.

`Adapters` is the complete injected surface, frozen so that no phase of a single attempt can
swap a port out from under a later phase.

`__all__` is the curated *seam* surface — the ports, the bundle and the result type — and
nothing else. The result plumbing below (`normalized_result`, `succeeded`, `decoded`,
`lines`, `residual_names`, `decoded_listener`, `verified`, `require_port` and
`require_exact`) is deliberately absent from it. Those are shared implementation that
`adapter` imports by name, not part of the boundary a reviewer or a substitute has to
satisfy; exporting them would present package plumbing as contract.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Protocol, runtime_checkable

from .constants import PORT_PROTOCOL

__all__ = [
    "Adapters",
    "AttemptLedger",
    "Clock",
    "CommandResult",
    "CommandRunner",
    "ControlIdentitySource",
    "CredentialPort",
    "DockerPort",
    "HostObservationSource",
    "ProbePort",
    "SignatureVerifier",
]


# The return code a result carries when nothing was executed. It is deliberately not zero:
# a default-constructed result must read as an unresolved observation, never as a command
# that succeeded without ever running.
UNRESOLVED_RETURNCODE = -1
SUCCESS_RETURNCODE = 0
ADDRESS_SEPARATOR = ":"
IPV6_OPEN = "["
IPV6_CLOSE = "]"

# The keys of the one decoded host listener record. `decoded_listener` below builds the
# record from them and the observation reduction reads it back through the same names, so
# the shape is declared once at the boundary that produces it. Two independently typed
# spellings could drift apart without either side failing: the reduction would simply read
# `None` from a record the adapter believed it had filled.
LISTENER_ADDRESS_KEY = "address"
LISTENER_PORT_KEY = "port"
LISTENER_PROTOCOL_KEY = "protocol"


@dataclass(frozen=True)
class CommandResult:
    """The complete result of one executed argv, and nothing the caller may edit."""

    returncode: int = UNRESOLVED_RETURNCODE
    stdout: str = ""
    stderr: str = ""


def require_port(label: str, injected: object, port: type) -> None:
    """Refuse an injected capability that does not implement its declared protocol.

    An annotation is only a comment at runtime, so every seam is checked structurally where
    it is accepted — in a constructor or in the bundle below, never part-way through an
    attempt where the refusal would land after the effect it was meant to prevent. It lives
    beside the protocols themselves so that one reviewed refusal serves every holder of one.
    """
    if not isinstance(injected, port):
        raise TypeError(
            f"{label}: {type(injected).__name__} does not implement {port.__name__}"
        )


def require_exact(label: str, observed: object, expected: object) -> None:
    """Refuse a high-level argument that drifted from the reviewed plan."""
    if observed != expected:
        raise ValueError(f"{label}: {observed!r} is not the reviewed {expected!r}")


def normalized_result(result: object) -> CommandResult | None:
    """Return one structurally valid command result, or `None` when it is malformed.

    Every decoder below reads a result it did not construct: it arrives through the injected
    runner, so its shape is never guaranteed. Deciding that question once, here, keeps every
    decoder's answer to a malformed reading identical instead of leaving each one to trip
    over a different missing attribute and raise out of a seam whose contract is `None`.

    `bool` is refused deliberately. `True` is an `int` in Python, so a truthy flag handed
    back instead of a status would compare equal to the failure status 1 and be decoded as
    a real reading.
    """
    returncode = getattr(result, "returncode", None)
    stdout = getattr(result, "stdout", None)
    stderr = getattr(result, "stderr", None)
    if (
        type(returncode) is not int
        or not isinstance(stdout, str)
        or not isinstance(stderr, str)
    ):
        return None
    return CommandResult(returncode=returncode, stdout=stdout, stderr=stderr)


def succeeded(effect: str, result: object) -> str:
    """Return stdout only for a structurally valid zero-status command result.

    This is the mutation path, so a reading that is not a clean success is refused out loud
    with its own reason rather than going quietly unresolved: a create, start or remove that
    did not happen must not be recoverable as an absent observation.
    """
    observed = normalized_result(result)
    if observed is None:
        raise ValueError(f"{effect}: the command result is malformed: {result!r}")
    if observed.returncode == UNRESOLVED_RETURNCODE:
        raise ValueError(f"{effect}: the command is unresolved — it never ran")
    if observed.returncode < 0:
        raise ValueError(
            f"{effect}: the command was killed by signal {-observed.returncode}"
        )
    if observed.returncode != SUCCESS_RETURNCODE:
        raise ValueError(
            f"{effect}: the command failed with status {observed.returncode}: "
            f"{observed.stderr.strip()}"
        )
    return observed.stdout.strip()


def decoded(result: object) -> Any:
    """Return one JSON projection, or `None` when it did not resolve."""
    observed = normalized_result(result)
    if observed is None or observed.returncode != SUCCESS_RETURNCODE:
        return None
    payload = observed.stdout.strip()
    if not payload:
        return None
    try:
        return json.loads(payload)
    except ValueError:
        return None


def lines(result: object) -> tuple[str, ...] | None:
    """Return non-empty lines, or `None` when the command did not resolve."""
    observed = normalized_result(result)
    if observed is None or observed.returncode != SUCCESS_RETURNCODE:
        return None
    return tuple(line.strip() for line in observed.stdout.splitlines() if line.strip())


def verified(result: object) -> bool | None:
    """Return a signature verdict only for a verification that actually ran to a status.

    `False` is the signer's own refusal: the command executed, read the bound bytes and
    rejected them. A malformed result, the unresolved sentinel, a timeout and a signal death
    are all commands that produced no verdict at all, and reporting one of them as a refusal
    would send a reader after a bad signature when the remedy is to verify again.
    """
    observed = normalized_result(result)
    if observed is None or observed.returncode < 0:
        return None
    return observed.returncode == SUCCESS_RETURNCODE


def residual_names(result: object) -> tuple[str, ...] | None:
    """Decode one residual projection as JSON strings, failing closed."""
    observed = lines(result)
    if observed is None:
        return None
    names: list[str] = []
    for line in observed:
        try:
            name = json.loads(line)
        except ValueError:
            return None
        if not isinstance(name, str) or not name:
            return None
        names.append(name)
    return tuple(names)


def decoded_listener(field: str) -> dict[str, Any] | None:
    """Decode one lsof address field without normalising a wildcard to loopback."""
    address, separator, port = field.rpartition(ADDRESS_SEPARATOR)
    if not separator or not port.isdigit():
        return None
    if address.startswith(IPV6_OPEN) and address.endswith(IPV6_CLOSE):
        address = address[len(IPV6_OPEN):-len(IPV6_CLOSE)]
    if not address:
        return None
    return {
        LISTENER_ADDRESS_KEY: address,
        LISTENER_PORT_KEY: int(port),
        LISTENER_PROTOCOL_KEY: PORT_PROTOCOL,
    }


@runtime_checkable
class CommandRunner(Protocol):
    """The one seam through which an exact argv may reach a process.

    `argv` is positional so it can only ever be handed over whole; the bound and the
    optional standard input are keyword-only so neither can be supplied by accident.
    """

    def run(
        self,
        argv: Sequence[str],
        *,
        timeout_seconds: float,
        stdin: bytes | None = None,
    ) -> CommandResult: ...


@runtime_checkable
class Clock(Protocol):
    """Elapsed-time source for the bounded runtime envelope."""

    def monotonic(self) -> float: ...


@runtime_checkable
class ControlIdentitySource(Protocol):
    """Read-only control-repository identity and worktree cleanliness observation."""

    def observe_controls(self) -> Mapping[str, Any] | None: ...


@runtime_checkable
class HostObservationSource(Protocol):
    """Read-only host observations: image presence, ephemeral range, listeners."""

    def observe_image(self, *, reference: str) -> Mapping[str, Any] | None: ...

    def observe_ephemeral_range(self) -> tuple[int, int] | None: ...

    def observe_listeners(self, *, port: int) -> Sequence[Any] | None: ...


@runtime_checkable
class DockerPort(Protocol):
    """Every Docker effect the rehearsal may reach, creation and observation alike."""

    def observe_platform(self) -> Mapping[str, Any] | None: ...

    def observe_executable_digest(self, *, path: str) -> str | None: ...

    def observe_publications(self, *, port: int) -> Sequence[str] | None: ...

    def create_network(self, *, name: str, internal: bool) -> str: ...

    def create_volume(self, *, name: str) -> str: ...

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
    ) -> str: ...

    def start_container(self, *, name: str) -> None: ...

    def observe_health(self, *, container: str, deadline: float) -> str | None: ...

    def observe_container(self, *, container: str) -> Mapping[str, Any] | None: ...

    def observe_daemon_event(self, *, container: str) -> str | None: ...

    def observe_docker_port(
        self, *, container: str, container_port: str
    ) -> str | None: ...

    def observe_network(self, *, name: str) -> Mapping[str, Any] | None: ...

    def remove(self, *, kind: str, name: str) -> None: ...

    def observe_residual(self) -> Sequence[str] | None: ...


@runtime_checkable
class ProbePort(Protocol):
    """The bounded, no-data host TCP probe and the identity of its executable."""

    def observe_digest(self, *, path: str) -> str | None: ...

    def run(self, *, executable: str, argv: Sequence[str]) -> str | None: ...


@runtime_checkable
class CredentialPort(Protocol):
    """Temporary credential material lifecycle, referred to only by handle."""

    def create(self, *, name: str) -> str: ...

    def remove(self, *, name: str) -> None: ...

    def observe_residual(self, *, name: str) -> bool | None: ...


@runtime_checkable
class SignatureVerifier(Protocol):
    """Detached signature verification of the externally signed grant."""

    def verify(
        self,
        *,
        grant_bytes: bytes,
        signature_bytes: bytes,
        signer: str,
        namespace: str,
    ) -> bool | None: ...


@runtime_checkable
class AttemptLedger(Protocol):
    """The durable one-attempt budget for one ledger, at the root the caller names.

    A consumed record may never be consumed twice through the same ledger. The ledger's
    identity is the path the caller supplies, so the budget is exactly as wide as that
    siting: a caller deriving the path from an operator-supplied control root binds the
    budget to that root, and a second root carries a second budget.

    This port promises no-replay through one ledger, not root-independence, and that gap is
    an open defect rather than a design position.

    An earlier version of this contract argued the gap was harmless, on the ground that an
    actor able to vary the root could by that same act install a signing key and mint fresh
    grants -- a strictly greater power than replaying one. That ground is refuted and has
    been deleted rather than softened. Key installation is *not* available to that actor:
    `control_identity_findings` (preparation) and `repository_findings` (grant) each require
    every control worktree to report `clean is True` and to match the granted commit *and*
    tree exactly, so a root carrying an installed key fails admission. Nothing pins the
    attempt-ledger file, which is untracked. The two capabilities are therefore not
    equivalent, and anchoring this budget does buy something the current siting does not.

    The correct siting is an open question this port cannot settle, because choosing a
    location independent of the operator-supplied root means choosing a trust anchor, which
    is an authority decision. Until it is made, a caller deriving the ledger path from an
    operator-supplied control root leaves a second clean checkout at the granted commit
    holding a second one-attempt budget for the same record.
    """

    def is_consumed(self, *, record_id: str) -> bool: ...

    def consume(self, *, record_id: str, attempt_ordinal: int) -> None: ...


# The port each injected field must actually satisfy. An annotation alone is a comment at
# runtime, so the bundle checks every field against its declared protocol on construction.
PORT_TYPES: Mapping[str, type] = MappingProxyType(
    {
        "identities": ControlIdentitySource,
        "host": HostObservationSource,
        "docker": DockerPort,
        "probe": ProbePort,
        "credential": CredentialPort,
        "verifier": SignatureVerifier,
        "ledger": AttemptLedger,
        "clock": Clock,
    }
)


@dataclass(frozen=True)
class Adapters:
    """The complete injected surface handed to one attempt, frozen for its lifetime.

    Every field is checked against its own protocol before the bundle exists. A substitute
    that is missing a seam is refused at injection time rather than part-way through an
    attempt, where the failure would already have had its effect.
    """

    identities: ControlIdentitySource
    host: HostObservationSource
    docker: DockerPort
    probe: ProbePort
    credential: CredentialPort
    verifier: SignatureVerifier
    ledger: AttemptLedger
    clock: Clock

    def __post_init__(self) -> None:
        for field_name, port in PORT_TYPES.items():
            require_port(field_name, getattr(self, field_name), port)
