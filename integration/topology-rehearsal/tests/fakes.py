"""Injected fakes and fixture algebra for the topology-only rehearsal specification.

Status: `RED — TESTS ONLY — RUNNER NOT IMPLEMENTED`.

Every double here is pure and in-memory. Nothing spawns a process, opens a socket, talks
to Docker or reads the host: a fake records the call it received on the one shared
`CallLog` and returns a scripted value. Ordering controls (consume-before-create,
teardown-always, semantic-binding-before-signature) are stated against that single log, so
the specification can pin *when* an effect happens, not only whether it happened.

`None` is the single unresolved value across every port. The runner must treat it as a
failure, never as a pass — that is the fail-closed-unresolved rule the diagnosis requires.

Naming rule for invented bytes: every digest, commit and identifier that was **not** read
out of a committed suite artifact carries a `SYNTHETIC_` prefix and is documented as
synthetic. Synthetic values are test scaffolding only. They are never observed facts, never
evidence, and `test_constants` proves no synthetic value may appear in the C8 implementation.
The probe digest is copied from the committed diagnosis packet; the D2 value is copied from
the browser-integrated UAT bridge R1 result. Both are labelled with their provenance.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any

# ---------------------------------------------------------------------------
# Reviewed exact values. These duplicate the committed record deliberately: a test-side
# pin that drifts from `constants` is the failure the specification wants to catch.
# ---------------------------------------------------------------------------
CAPABILITY_ID = "cybrik.suite.runtime-topology"
OBJECTIVE_ID = "postgres-loopback-internal-v1"
SERIES_ID = "postgres-loopback-internal-v1"
RECORD_ID = "postgres-loopback-internal-v1-r1"
RECORD_DIR = f"docs/uat/topology-rehearsals/{RECORD_ID}"
RECORD_PATH = f"{RECORD_DIR}/topology-rehearsal.json"
GRANT_PATH = f"{RECORD_DIR}/G-U2B-POSTGRES-TOPOLOGY-REHEARSAL-GRANT-R1.json"
GRANT_SCHEMA = "CYBRIK-TOPOLOGY-REHEARSAL-GRANT/v1"
AUTHORIZATION_NAMESPACE = "cybrik-uat-topology-rehearsal-v1"
SIGNER = "FOUNDER"

HOST_IP = "127.0.0.1"
HOST_PORT = 15433
CONTAINER_PORT = 5432
PORT_PROTOCOL = "tcp"
CONTAINER_PORT_KEY = "5432/tcp"
PUBLISH_SPEC = "127.0.0.1:15433:5432/tcp"
OBSERVED_PUBLICATION = "127.0.0.1:15433"

IMAGE_REFERENCE = "postgres:16-alpine"
PULL_POLICY = "never"
# Recorded in the browser-integrated UAT bridge R1 result as a prior observation of the
# consumed D2/G-U2B RED attempt. It is never the selected required image identity and never
# a gate.
D2_OBSERVED_IMAGE_ID = (
    "sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777"
)
D2_EVIDENCE_USE = "unverified_prior_observation"
D2_SOURCE = "G-U2B-POSTGRES-RED-RUNTIME-RESULT-R1"
# SYNTHETIC. An invented image identity that a fake host reports at rehearsal time. No host
# was inspected to produce it. It exists only so the specification can state that the
# rehearsal re-observes and records whatever the host reports, and that the recorded value is
# deliberately not the D2 digest and is not compared against it.
SYNTHETIC_HOST_IMAGE_ID = (
    "sha256:1f3a0c74bb3a2f0a1d6e4f5c8b9a0d7e6c5b4a39281706f5e4d3c2b1a0998877"
)
SYNTHETIC_INDEX_DIGEST = "sha256:" + "2" * 64
SYNTHETIC_MANIFEST_DIGEST = "sha256:" + "3" * 64
SYNTHETIC_RUNNER_AGGREGATE_SHA256 = "4" * 64
SYNTHETIC_DOCKER_SHA256 = "5" * 64
DOCKER_EXECUTABLE_PATH = "/usr/local/bin/docker"
# SYNTHETIC. Invented registry digests that name no image at all. They exist only so the
# specification can state that a fully *resolved* host observation which disagrees with the
# selected identity fails closed, which an unresolved-only case cannot state.
SYNTHETIC_OTHER_INDEX_DIGEST = "sha256:" + "6" * 64
SYNTHETIC_OTHER_MANIFEST_DIGEST = "sha256:" + "7" * 64

IMAGE_REPOSITORY = "postgres"
IMAGE_TAG = "16-alpine"
IMAGE_PLATFORM = {"os": "linux", "architecture": "arm64", "variant": None}
# A resolved host platform that is not the selected one, for host image drift cases.
OTHER_IMAGE_PLATFORM = {"os": "linux", "architecture": "amd64", "variant": None}
IMAGE_OBSERVED_AT = "2026-08-05T00:00:00Z"
# A live host reading strictly later than the instant the grant signed, and the second
# `observed_at` these fakes carry. While `host_image()` was the only source of one, the grant
# pin and the live host reading were the same string everywhere, so no test could state which
# of the two a recorded value came from: a mutation swapping them changed nothing observable.
# It is admitted by preparation, which accepts a reading at or after the pin, and it is inside
# the authorization window, so a test may use it without also becoming a window case.
LATER_HOST_OBSERVED_AT = "2026-08-05T00:00:30Z"
# The resolution state a selected image observation carries once its registry identity is
# pinned. The proposed record carries `UNRESOLVED` and no host identity claim at all.
IMAGE_RESOLVED = "RESOLVED"
IMAGE_UNRESOLVED = "UNRESOLVED"

PROBE_EXECUTABLE_PATH = "/usr/bin/nc"
# Recorded in the committed diagnosis packet section 3 and in the committed machine record.
PROBE_EXECUTABLE_SHA256 = (
    "427423db6d5d5e9f720c5e110a2c9b3cba39ea089dafed4ab936d04dd218bdac"
)
PROBE_ARGV = ("-z", "-w", "5", "127.0.0.1", "15433")

RUNTIME_LIMIT_SECONDS = 180
EXTENSION_CYCLES = 0
ATTEMPT_ORDINAL = 1
MAX_ATTEMPTS = 1

PRECHECK_ABORT = "PRECHECK_ABORT"
STOP_CONTROL = "STOP_CONTROL"
FAIL_PUBLICATION = "FAIL_PUBLICATION"
FAIL_INTERNAL_INGRESS = "FAIL_INTERNAL_INGRESS"
TOPOLOGY_PASS = "TOPOLOGY_PASS"
OUTCOME_NOT_RUN = "not_run"
PHASE_AUTHORIZED = "authorized"
# Fixed, exact terminal precedence from diagnosis section 8.
OUTCOME_PRECEDENCE = (
    PRECHECK_ABORT,
    STOP_CONTROL,
    FAIL_PUBLICATION,
    FAIL_INTERNAL_INGRESS,
    TOPOLOGY_PASS,
)

PUBLICATION_VIEWS = (
    "daemon_event",
    "host_config_port_bindings",
    "network_settings_ports",
    "docker_port",
    "host_listener",
)

# SYNTHETIC. An invented attempt identifier; no attempt was ever started under it. The
# derived resource names below are therefore synthetic too, and the specification uses them
# only to state how the runner must derive names from whatever attempt id it is given.
SYNTHETIC_ATTEMPT_ID = "20260805T000000Z-c8"
CONTAINER_NAME = f"cybrik-topology-{SYNTHETIC_ATTEMPT_ID}"
NETWORK_NAME = f"cybrik-topology-net-{SYNTHETIC_ATTEMPT_ID}"
VOLUME_NAME = f"cybrik-topology-vol-{SYNTHETIC_ATTEMPT_ID}"
CREDENTIAL_NAME = f"cybrik-topology-credential-{SYNTHETIC_ATTEMPT_ID}"
# Reviewed host-only directory for the one-attempt ephemeral credential. Unlike the
# attempt-derived filename below, this directory is a runner constant rather than a
# synthetic observation.
CREDENTIAL_DIRECTORY = "/tmp/cybrik-topology-rehearsal"
SYNTHETIC_CREDENTIAL_PATH = f"{CREDENTIAL_DIRECTORY}/{CREDENTIAL_NAME}.secret"
CONTAINER_CREDENTIAL_PATH = "/run/secrets/cybrik-postgres-password"

SUITE_CONTROL = "cybrik-suite"
SOC_CONTROL = "cybrik-soc-command-center"
AI_CONTROL = "cybrik-cyber-ai-platform"
FABRIC_CONTROL = "cybrik-security-tool-fabric"
# SYNTHETIC. Invented 40-hex strings shaped like Git commit ids. Neither names a commit that
# exists in any repository, and neither was read from `git`. They exist only so the
# specification can state exact-equality and clean-worktree control-identity behaviour.
SYNTHETIC_SUITE_COMMIT = "aaaa1111bbbb2222cccc3333dddd4444eeee5555"
SYNTHETIC_SOC_COMMIT = "5555eeee4444dddd3333cccc2222bbbb1111aaaa"
SYNTHETIC_AI_COMMIT = "1111aaaa2222bbbb3333cccc4444dddd5555eeee"
SYNTHETIC_FABRIC_COMMIT = "eeee5555dddd4444cccc3333bbbb2222aaaa1111"
# SYNTHETIC. Invented 40-hex strings shaped like Git tree ids, one per control repository and
# all distinct from every commit id above. A control identity that reports only a commit
# cannot distinguish two worktrees that share a commit but differ in content, so the
# specification pins the tree as a separate observed field with its own drift behaviour.
SYNTHETIC_SUITE_TREE = "170693383a05d1bfd06729e874558072b4a7a64e"
SYNTHETIC_SOC_TREE = "ce06b01a77be7e64c7b7b2e2e97dcf3e4f4f0ced"
SYNTHETIC_AI_TREE = "9a56fbdd042f1ea502ca60d5a93a492f16b6fe54"
SYNTHETIC_FABRIC_TREE = "b996c5de4eb651d72c0e96a6b879ac299d7d7df5"
EXPECTED_CONTROLS = {
    SUITE_CONTROL: SYNTHETIC_SUITE_COMMIT,
    SOC_CONTROL: SYNTHETIC_SOC_COMMIT,
    AI_CONTROL: SYNTHETIC_AI_COMMIT,
    FABRIC_CONTROL: SYNTHETIC_FABRIC_COMMIT,
}
EXPECTED_TREES = {
    SUITE_CONTROL: SYNTHETIC_SUITE_TREE,
    SOC_CONTROL: SYNTHETIC_SOC_TREE,
    AI_CONTROL: SYNTHETIC_AI_TREE,
    FABRIC_CONTROL: SYNTHETIC_FABRIC_TREE,
}
SYNTHETIC_REPOSITORY_ROOTS = {
    name: f"/synthetic/{name}" for name in EXPECTED_CONTROLS
}
CLEAN_CONTROL_IDENTITIES = {
    name: {"commit": EXPECTED_CONTROLS[name], "tree": EXPECTED_TREES[name], "clean": True}
    for name in EXPECTED_CONTROLS
}


def control_identities(
    patch: Mapping[str, Mapping[str, Any] | None] | None = None,
) -> dict[str, Any]:
    """`CLEAN_CONTROL_IDENTITIES` with a per-repository field patch.

    A patch value of `None` drops that repository entirely, which is how the specification
    states that a missing control observation is a refusal rather than a default.
    """
    changes = dict(patch or {})
    return {
        name: {**identity, **(changes.get(name) or {})}
        for name, identity in CLEAN_CONTROL_IDENTITIES.items()
        if changes.get(name, {}) is not None
    }

# Recorded in the committed diagnosis packet section 3 as a proposal-time host observation.
EPHEMERAL_RANGE = (49152, 65535)
LOOPBACK_LISTENER = {"address": HOST_IP, "port": HOST_PORT, "protocol": PORT_PROTOCOL}
WILDCARD_LISTENER = {"address": "0.0.0.0", "port": HOST_PORT, "protocol": PORT_PROTOCOL}
IPV6_LISTENER = {"address": "::", "port": HOST_PORT, "protocol": PORT_PROTOCOL}

# SYNTHETIC. An invented 64-hex string standing in for the digest of the authorized record
# bytes. The committed record's real digest is deliberately not used: this specification must
# not be readable as a claim about the committed record's authorized bytes, which do not
# exist. `test_constants` proves C8 does not embed it.
SYNTHETIC_RECORD_SHA256 = (
    "3f5c9a1d2e4b6870a9c8d7e6f5b4a3928170615243c2b1a0f9e8d7c6b5a49382"
)

# Recorded in the committed diagnosis packet section 3 as a post-attempt operator
# observation. No daemon was queried here; these strings are replayed only as a fake's
# scripted return value so the specification can state that the rehearsal must capture and
# record its own platform identity.
DOCUMENTED_PLATFORM = {
    "desktop_version": "4.84.0",
    "desktop_build": "234817",
    "engine_version": "29.6.2",
    "api_version": "1.55",
}

# Exact ordered teardown sequence from diagnosis section 7 item 9.
TEARDOWN_KINDS = ("container", "network", "volume", "credential")
# Exact ordered creation sequence. The credential material is created before the container
# that consumes it, and the container is created last.
CREATION_KINDS = ("network", "volume", "credential", "container")

# Every invented value in this module, gathered so `test_constants` can prove that no
# synthetic fixture byte is ever embedded in the C8 implementation and mistaken for a fact.
SYNTHETIC_VALUES = (
    SYNTHETIC_AI_COMMIT,
    SYNTHETIC_AI_TREE,
    SYNTHETIC_ATTEMPT_ID,
    SYNTHETIC_DOCKER_SHA256,
    SYNTHETIC_CREDENTIAL_PATH,
    SYNTHETIC_FABRIC_COMMIT,
    SYNTHETIC_FABRIC_TREE,
    SYNTHETIC_HOST_IMAGE_ID,
    SYNTHETIC_INDEX_DIGEST,
    SYNTHETIC_MANIFEST_DIGEST,
    SYNTHETIC_OTHER_INDEX_DIGEST,
    SYNTHETIC_OTHER_MANIFEST_DIGEST,
    SYNTHETIC_RECORD_SHA256,
    SYNTHETIC_RUNNER_AGGREGATE_SHA256,
    SYNTHETIC_SOC_COMMIT,
    SYNTHETIC_SOC_TREE,
    SYNTHETIC_SUITE_COMMIT,
    SYNTHETIC_SUITE_TREE,
    *SYNTHETIC_REPOSITORY_ROOTS.values(),
)


# ---------------------------------------------------------------------------
# Call log
# ---------------------------------------------------------------------------
class CallLog:
    """Ordered record of every call the runner made through an injected port."""

    def __init__(self) -> None:
        self._entries: list[tuple[str, dict[str, Any]]] = []

    def record(self, call: str, /, **payload: Any) -> None:
        # Positional-only: several ports record a `name=` payload, which would otherwise
        # collide with the call label and raise instead of logging.
        self._entries.append((call, dict(payload)))

    @property
    def entries(self) -> tuple[tuple[str, dict[str, Any]], ...]:
        return tuple(self._entries)

    def names(self) -> tuple[str, ...]:
        return tuple(name for name, _ in self._entries)

    def calls(self, name: str) -> tuple[dict[str, Any], ...]:
        return tuple(payload for recorded, payload in self._entries if recorded == name)

    def count(self, name: str) -> int:
        return len(self.calls(name))

    def index(self, name: str) -> int:
        """First index of `name`, or -1 when it was never called."""
        names = self.names()
        return names.index(name) if name in names else -1

    def first_index_of_prefix(self, prefix: str) -> int:
        for position, name in enumerate(self.names()):
            if name.startswith(prefix):
                return position
        return -1


class Unset:
    """Sentinel distinguishing "not scripted" from a scripted `None` (unresolved)."""


UNSET = Unset()


class _Script:
    """A queue of scripted responses whose final entry repeats forever."""

    def __init__(self, responses: Sequence[Any]) -> None:
        if not responses:
            raise ValueError("a scripted port needs at least one response")
        self._responses = list(responses)
        self._position = 0

    def next(self) -> Any:
        response = self._responses[min(self._position, len(self._responses) - 1)]
        self._position += 1
        return response


# ---------------------------------------------------------------------------
# Injected ports
# ---------------------------------------------------------------------------
class FakeClock:
    """Monotonic clock replaying a scripted elapsed-second sequence."""

    def __init__(self, log: CallLog, ticks: Sequence[float] = (0.0,)) -> None:
        self._log = log
        self._script = _Script(list(ticks))

    def monotonic(self) -> float:
        value = self._script.next()
        self._log.record("clock.monotonic", value=value)
        return value


class FakeControlIdentities:
    """Read-only Suite/SOC control identity and worktree cleanliness observation."""

    def __init__(
        self,
        log: CallLog,
        identities: Mapping[str, Any] | None = CLEAN_CONTROL_IDENTITIES,
    ) -> None:
        self._log = log
        self._identities = identities

    def observe_controls(self) -> Mapping[str, Any] | None:
        self._log.record("identities.observe_controls")
        return self._identities


def host_image(**overrides: Any) -> dict[str, Any]:
    """One host image observation agreeing with the selected identity by default."""
    return {
        "present": True,
        "repository": IMAGE_REPOSITORY,
        "tag": IMAGE_TAG,
        "platform": dict(IMAGE_PLATFORM),
        "index_digest": SYNTHETIC_INDEX_DIGEST,
        "manifest_digest": SYNTHETIC_MANIFEST_DIGEST,
        "local_image_id": SYNTHETIC_HOST_IMAGE_ID,
        "observed_at": IMAGE_OBSERVED_AT,
        **overrides,
    }


class FakeHost:
    """Read-only host observations: image presence, ephemeral range, listeners."""

    def __init__(
        self,
        log: CallLog,
        image: Mapping[str, Any] | None | Unset = UNSET,
        ephemeral_range: tuple[int, int] | None = EPHEMERAL_RANGE,
        listeners: Sequence[Any] = ((), (LOOPBACK_LISTENER,), ()),
    ) -> None:
        self._log = log
        self._image = host_image() if isinstance(image, Unset) else image
        self._ephemeral_range = ephemeral_range
        self._listeners = _Script(list(listeners))

    def observe_image(self, *, reference: str) -> Mapping[str, Any] | None:
        self._log.record("host.observe_image", reference=reference)
        return self._image

    def observe_ephemeral_range(self) -> tuple[int, int] | None:
        self._log.record("host.observe_ephemeral_range")
        return self._ephemeral_range

    def observe_listeners(self, *, port: int) -> Sequence[Any] | None:
        self._log.record("host.observe_listeners", port=port)
        return self._listeners.next()


def container_projection(
    *,
    bindings: Any = UNSET,
    ports: Any = UNSET,
    networks: Any = UNSET,
    image: str | None = SYNTHETIC_HOST_IMAGE_ID,
) -> dict[str, Any]:
    """One `docker inspect` projection carrying both publication views."""
    default_binding = {CONTAINER_PORT_KEY: [{"HostIp": HOST_IP, "HostPort": str(HOST_PORT)}]}
    return {
        "Image": image,
        "HostConfig": {
            "PortBindings": default_binding if isinstance(bindings, Unset) else bindings,
        },
        "NetworkSettings": {
            "Ports": default_binding if isinstance(ports, Unset) else ports,
            "Networks": {NETWORK_NAME: {"NetworkID": "net-1"}}
            if isinstance(networks, Unset)
            else networks,
        },
    }


def network_projection(*, internal: bool = True, containers: Any = UNSET) -> dict[str, Any]:
    return {
        "Name": NETWORK_NAME,
        "Internal": internal,
        "Containers": {CONTAINER_NAME: {"Name": CONTAINER_NAME}}
        if isinstance(containers, Unset)
        else containers,
    }


class FakeDocker:
    """Docker control port. Mutating calls are recorded; nothing is executed."""

    def __init__(
        self,
        log: CallLog,
        health: Sequence[Any] = ("healthy",),
        container: Any = UNSET,
        network: Any = UNSET,
        daemon_event: str | None = OBSERVED_PUBLICATION,
        docker_port: str | None = OBSERVED_PUBLICATION,
        residual: Sequence[str] | None = (),
        publications: Sequence[str] | None = (),
        create_failure: BaseException | None = None,
        platform: Mapping[str, Any] | None | Unset = UNSET,
        docker_digest: str | None = SYNTHETIC_DOCKER_SHA256,
    ) -> None:
        self._log = log
        self._health = _Script(list(health))
        self._container = container_projection() if isinstance(container, Unset) else container
        self._network = network_projection() if isinstance(network, Unset) else network
        self._daemon_event = daemon_event
        self._docker_port = docker_port
        self._residual = residual
        self._publications = publications
        self._create_failure = create_failure
        self._platform = (
            dict(DOCUMENTED_PLATFORM) if isinstance(platform, Unset) else platform
        )
        self._docker_digest = docker_digest

    def observe_executable_digest(self, *, path: str) -> str | None:
        self._log.record("docker.observe_executable_digest", path=path)
        return self._docker_digest

    def observe_platform(self) -> Mapping[str, Any] | None:
        self._log.record("docker.observe_platform")
        return self._platform

    def observe_publications(self, *, port: int) -> Sequence[str] | None:
        self._log.record("docker.observe_publications", port=port)
        return self._publications

    def create_network(self, *, name: str, internal: bool) -> str:
        self._log.record("docker.create_network", name=name, internal=internal)
        self._raise_scripted_failure()
        return f"network:{name}"

    def create_volume(self, *, name: str) -> str:
        self._log.record("docker.create_volume", name=name)
        self._raise_scripted_failure()
        return f"volume:{name}"

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
        self._log.record(
            "docker.create_container",
            name=name,
            image=image,
            network=network,
            volume=volume,
            publish=publish,
            pull=pull,
            environment=dict(environment),
        )
        self._raise_scripted_failure()
        return f"container:{name}"

    def start_container(self, *, name: str) -> None:
        self._log.record("docker.start_container", name=name)
        self._raise_scripted_failure()

    def observe_health(self, *, container: str, deadline: float) -> str | None:
        self._log.record("docker.observe_health", container=container, deadline=deadline)
        return self._health.next()

    def observe_container(self, *, container: str) -> Mapping[str, Any] | None:
        self._log.record("docker.observe_container", container=container)
        return self._container

    def observe_daemon_event(self, *, container: str) -> str | None:
        self._log.record("docker.observe_daemon_event", container=container)
        return self._daemon_event

    def observe_docker_port(self, *, container: str, container_port: str) -> str | None:
        self._log.record(
            "docker.observe_docker_port", container=container, container_port=container_port
        )
        return self._docker_port

    def observe_network(self, *, name: str) -> Mapping[str, Any] | None:
        self._log.record("docker.observe_network", name=name)
        return self._network

    def remove(self, *, kind: str, name: str) -> None:
        self._log.record("docker.remove", kind=kind, name=name)

    def observe_residual(self) -> Sequence[str] | None:
        self._log.record("docker.observe_residual")
        return self._residual

    def _raise_scripted_failure(self) -> None:
        if self._create_failure is not None:
            raise self._create_failure


class FakeProbe:
    """Bounded host TCP probe. It never connects; it replays a scripted verdict."""

    def __init__(
        self,
        log: CallLog,
        digest: str | None = PROBE_EXECUTABLE_SHA256,
        result: str | None = "reachable",
    ) -> None:
        self._log = log
        self._digest = digest
        self._result = result

    def observe_digest(self, *, path: str) -> str | None:
        self._log.record("probe.observe_digest", path=path)
        return self._digest

    def run(self, *, executable: str, argv: Sequence[str]) -> str | None:
        self._log.record("probe.run", executable=executable, argv=tuple(argv))
        return self._result


class FakeCredential:
    """Temporary credential material lifecycle, represented by a synthetic handle only."""

    def __init__(self, log: CallLog, residual: bool | None = False) -> None:
        self._log = log
        self._residual = residual

    def create(self, *, name: str) -> str:
        self._log.record("credential.create", name=name)
        return f"credential:{name}"

    def remove(self, *, name: str) -> None:
        self._log.record("credential.remove", name=name)

    def observe_residual(self, *, name: str) -> bool | None:
        self._log.record("credential.observe_residual", name=name)
        return self._residual


@dataclass(frozen=True)
class FakeCommandResult:
    returncode: int = 0
    stdout: str = ""
    stderr: str = ""


# Injected results that are not structurally a command result at all. A runner is an
# injected port, so nothing downstream of it may assume the shape of what it returns: a
# missing or wrong-typed field must decode as an unresolved observation rather than raise
# `AttributeError` or `TypeError` out of a seam whose only failure value is `None`.
#
# `returncode=True` is deliberate. `bool` is a subclass of `int` in Python, so a truthy flag
# handed back instead of a status would compare equal to the failure status `1` and read as
# a real reading. It is refused as malformed, not accepted as a status.
#
# The tuple is shared by the protocol and adapter specifications so both state one surface.
MALFORMED_COMMAND_RESULTS = (
    SimpleNamespace(stdout="", stderr=""),
    SimpleNamespace(returncode=None, stdout="", stderr=""),
    SimpleNamespace(returncode="0", stdout="", stderr=""),
    SimpleNamespace(returncode=True, stdout="", stderr=""),
    SimpleNamespace(returncode=0.0, stdout="", stderr=""),
    SimpleNamespace(returncode=0, stdout=None, stderr=""),
    SimpleNamespace(returncode=0, stdout=b"", stderr=""),
    SimpleNamespace(returncode=0, stdout="", stderr=None),
    SimpleNamespace(returncode=0, stdout="", stderr=0),
)


class FakeCommandRunner:
    """Exact argv adapter seam; unscripted commands fail instead of reaching the host."""

    def __init__(
        self,
        log: CallLog,
        responses: Mapping[tuple[str, ...], FakeCommandResult] | None = None,
    ) -> None:
        self._log = log
        self._responses = dict(responses or {})

    def run(
        self,
        argv: Sequence[str],
        *,
        timeout_seconds: float,
        stdin: bytes | None = None,
    ) -> FakeCommandResult:
        command = tuple(argv)
        self._log.record(
            "command.run",
            argv=command,
            timeout_seconds=timeout_seconds,
            stdin=stdin,
        )
        if command not in self._responses:
            raise AssertionError(f"unscripted command: {command!r}")
        return self._responses[command]


class FakeSignatureVerifier:
    """Detached Founder SSHSIG verifier. Records whether it was consulted at all."""

    def __init__(self, log: CallLog, verdict: bool | None = True) -> None:
        self._log = log
        self._verdict = verdict

    def verify(
        self,
        *,
        grant_bytes: bytes,
        signature_bytes: bytes,
        signer: str,
        namespace: str,
    ) -> bool | None:
        self._log.record(
            "verifier.verify",
            grant_bytes=grant_bytes,
            signature_bytes=signature_bytes,
            signer=signer,
            namespace=namespace,
        )
        return self._verdict


class FakeAttemptLedger:
    """One-attempt ledger. A second consumption of the same record is refused."""

    def __init__(self, log: CallLog, consumed: Iterable[str] = ()) -> None:
        self._log = log
        self._consumed = set(consumed)

    def is_consumed(self, *, record_id: str) -> bool:
        self._log.record("ledger.is_consumed", record_id=record_id)
        return record_id in self._consumed

    def consume(self, *, record_id: str, attempt_ordinal: int) -> None:
        self._log.record(
            "ledger.consume", record_id=record_id, attempt_ordinal=attempt_ordinal
        )
        if record_id in self._consumed:
            raise AssertionError(
                f"{record_id}: the one topology attempt is already consumed"
            )
        self._consumed.add(record_id)


@dataclass(frozen=True)
class FakeAdapters:
    """The complete injected surface handed to the runner."""

    log: CallLog
    identities: FakeControlIdentities
    host: FakeHost
    docker: FakeDocker
    probe: FakeProbe
    credential: FakeCredential
    verifier: FakeSignatureVerifier
    ledger: FakeAttemptLedger
    clock: FakeClock


def passing_adapters(
    *,
    identities: Mapping[str, Any] | None | Unset = UNSET,
    image: Mapping[str, Any] | None | Unset = UNSET,
    ephemeral_range: tuple[int, int] | None = EPHEMERAL_RANGE,
    listeners: Sequence[Any] = ((), (LOOPBACK_LISTENER,), ()),
    ticks: Sequence[float] = (0.0, 1.0, 2.0, 3.0),
    health: Sequence[Any] = ("healthy",),
    container: Any = UNSET,
    network: Any = UNSET,
    daemon_event: str | None = OBSERVED_PUBLICATION,
    docker_port: str | None = OBSERVED_PUBLICATION,
    residual: Sequence[str] | None = (),
    credential_residual: bool | None = False,
    publications: Sequence[str] | None = (),
    create_failure: BaseException | None = None,
    platform: Mapping[str, Any] | None | Unset = UNSET,
    docker_digest: str | None = SYNTHETIC_DOCKER_SHA256,
    probe_digest: str | None = PROBE_EXECUTABLE_SHA256,
    probe_result: str | None = "reachable",
    verdict: bool | None = True,
    consumed: Iterable[str] = (),
) -> FakeAdapters:
    """Adapters wired for a clean `TOPOLOGY_PASS`; every keyword breaks one control."""
    log = CallLog()
    return FakeAdapters(
        log=log,
        identities=FakeControlIdentities(
            log,
            CLEAN_CONTROL_IDENTITIES if isinstance(identities, Unset) else identities,
        ),
        host=FakeHost(
            log, image=image, ephemeral_range=ephemeral_range, listeners=listeners
        ),
        docker=FakeDocker(
            log,
            health=health,
            container=container,
            network=network,
            daemon_event=daemon_event,
            docker_port=docker_port,
            residual=residual,
            publications=publications,
            create_failure=create_failure,
            platform=platform,
            docker_digest=docker_digest,
        ),
        probe=FakeProbe(log, digest=probe_digest, result=probe_result),
        credential=FakeCredential(log, residual=credential_residual),
        verifier=FakeSignatureVerifier(log, verdict=verdict),
        ledger=FakeAttemptLedger(log, consumed=consumed),
        clock=FakeClock(log, ticks=ticks),
    )
