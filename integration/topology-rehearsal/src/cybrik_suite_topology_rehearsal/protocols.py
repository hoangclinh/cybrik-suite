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
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Protocol, runtime_checkable

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


@dataclass(frozen=True)
class CommandResult:
    """The complete result of one executed argv, and nothing the caller may edit."""

    returncode: int = UNRESOLVED_RETURNCODE
    stdout: str = ""
    stderr: str = ""


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
    """The durable one-attempt budget: a consumed record may never be consumed twice."""

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
            injected = getattr(self, field_name)
            if not isinstance(injected, port):
                raise TypeError(
                    f"{field_name}: {type(injected).__name__} does not implement "
                    f"{port.__name__}"
                )
