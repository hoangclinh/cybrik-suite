"""One bounded attempt: admit, consume once, observe, classify and always tear down.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

This is the only module that may consume the single attempt, and it consumes it exactly
once, immediately before the first create mutation. Everything before that point is
read-only and refuses without an effect; everything after it tears down unconditionally,
whatever terminal class the attempt reached.

Every fact this attempt hands to admission is observed independently of the document being
verified. The loader states the record path, the record digest, the aggregate digest of the
runner source it is about to execute and the one exact instant; the reviewed constants state
the topology and the pull policy; the read-only preparation phase states what the host
actually holds. A fact taken out of the authorization under verification would make that
document its own witness, so no such fact is read here at all — an unobserved loader value is
a refusal rather than a fallback.

One envelope is derived from the first elapsed-time reading, before anything is created, and
every bounded wait shares it. There is no extension cycle: an attempt that runs past the
reviewed envelope is a stop control, not a longer attempt.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

from .admission import decide
from .constants import (
    ATTEMPT_ORDINAL,
    CONTAINER_CREDENTIAL_PATH,
    CONTAINER_PORT_KEY,
    EVIDENCE_KEYS,
    EXTENSION_CYCLES,
    HEALTH_HEALTHY,
    HOST_PORT,
    PRECHECK_ABORT,
    PROBE_ARGV,
    PROBE_EXECUTABLE_PATH,
    PUBLISH_SPEC,
    PULL_POLICY,
    RECORD_ID,
    RUNTIME_LIMIT_SECONDS,
    SELECTED_IDENTITY_KEYS,
    STOP_CONTROL,
    TEARDOWN_KINDS,
)
from .errors import PrecheckAbort, resolve_outcome
from .grant import INSTANT_FORMAT, REVIEWED_TOPOLOGY, TOOL_KEYS, instant
from .observe import (
    validate_internal_ingress,
    validate_internal_network,
    validate_publication,
)
from .plan import (
    CREDENTIAL_ENVIRONMENT_KEY,
    CREDENTIAL_INFIX,
    DIGEST_MARKER,
    NETWORK_INFIX,
    RESOURCE_PREFIX,
    VOLUME_INFIX,
)
from .preparation import (
    OBSERVED_AT_KEY,
    POLICY_KEY,
    PRESENT_KEY,
    PreparationResult,
    frozen,
    prepare,
)
from .protocols import (
    AttemptLedger,
    Clock,
    CredentialPort,
    SignatureVerifier,
    require_port,
)

__all__ = ["RehearsalResult", "run_topology_rehearsal"]

# The four ports preparation does not check for itself. Each is checked before the attempt
# begins rather than where it is first reached: a bundle missing its ledger discovered after
# the network exists is a refusal that lands after the effect it was meant to prevent.
ATTEMPT_PORTS = (
    ("credential", CredentialPort),
    ("verifier", SignatureVerifier),
    ("ledger", AttemptLedger),
    ("clock", Clock),
)

# The four loader observations, each named by the fact it states and the projection that
# states it. They are taken at the boundary that reads the authorization bytes, which is the
# one place outside the host that observes anything at all.
LOADER_FACT_SOURCES = (
    ("record_path", "record_path"),
    ("record_sha256", "record_sha256"),
    ("runner_aggregate_sha256", "runner_aggregate_sha256"),
    ("now", "observed_at"),
)

# The fact names assembled from the reviewed constants and from the host observations.
TOPOLOGY_FACT = "topology"
SELECTED_FACT = "selected_image_identity"
OBSERVED_FACT = "observed_image_identity"
REPOSITORIES_FACT = "repositories"
TOOLS_FACT = "tools"
FACTS_KEY = "facts"

# The attempt identity. It is the exact instant of the host observation that admitted the
# attempt, rendered without the separators an argv token may not carry, plus the reviewed
# slice label. Deriving it from an observation rather than inventing it keeps every resource
# name traceable to the one reading that authorized creating it.
ATTEMPT_INSTANT_FORMAT = INSTANT_FORMAT.replace("-", "").replace(":", "")
ATTEMPT_SLICE = "c8"

# The three kinds the Docker port removes and the one the credential port removes. Both are
# read off the reviewed teardown inventory so neither can drift away from it.
DOCKER_TEARDOWN_KINDS = TEARDOWN_KINDS[:-1]
CREDENTIAL_TEARDOWN_KIND = TEARDOWN_KINDS[-1]

# Evidence sub-keys. The probe record states which executable answered and with what argv,
# and the teardown record states what the host still held once the attempt let go of it.
PROBE_EXECUTABLE_KEY = "executable"
PROBE_ARGV_KEY = "argv"
PROBE_RESULT_KEY = "result"
TIMINGS_STARTED_KEY = "started"
TIMINGS_COMPLETED_KEY = "completed"
TIMINGS_DEADLINE_KEY = "deadline"
TIMINGS_LIMIT_KEY = "runtime_limit_seconds"
TIMINGS_EXTENSION_KEY = "extension_cycles"
TEARDOWN_COMPLETE_KEY = "complete"
TEARDOWN_KINDS_KEY = "kinds"
TEARDOWN_RESIDUAL_KEY = "residuals"
TEARDOWN_CREDENTIAL_KEY = "credential_residual"
TEARDOWN_LISTENER_KEY = "listeners"

NO_FACTS: Mapping[str, Any] = MappingProxyType({})


@dataclass(frozen=True)
class RehearsalResult:
    """One terminal answer for one attempt, with everything the attempt observed.

    `attempt_consumed` and `teardown_complete` are separate readings on purpose: an attempt
    that was consumed and torn down cleanly and one that was consumed and left residue are
    the same terminal class only when the residue is also reported.
    """

    outcome: str
    attempt_consumed: bool
    teardown_complete: bool
    residuals: tuple[str, ...]
    findings: tuple[str, ...]
    evidence: Mapping[str, Any]


@dataclass(frozen=True)
class AttemptNames:
    """Every name one attempt may create, derived from one observed attempt identity."""

    attempt_id: str
    container: str
    network: str
    volume: str
    credential: str
    image_reference: str


@dataclass(frozen=True)
class AttemptObservation:
    """The post-creation readings, already reduced to verdicts and candidate classes."""

    health: Any
    probe_result: Any
    network_projection: Any
    publication_views: Mapping[str, Any]
    findings: tuple[str, ...]
    candidates: tuple[str, ...]


@dataclass(frozen=True)
class TeardownRecord:
    """What the host still held after the mandatory removal sequence."""

    complete: bool
    residuals: tuple[str, ...]
    credential_residual: Any
    listeners: tuple[str, ...]
    findings: tuple[str, ...]
    candidates: tuple[str, ...]


def _refused(*findings: str) -> RehearsalResult:
    """One pre-consumption refusal: nothing was created, so nothing is torn down."""
    reasons = tuple(finding for finding in findings if type(finding) is str and finding)
    return RehearsalResult(
        outcome=PRECHECK_ABORT,
        attempt_consumed=False,
        teardown_complete=False,
        residuals=(),
        findings=reasons or ("the attempt was refused before consumption",),
        evidence=MappingProxyType(
            {**{name: None for name in EVIDENCE_KEYS}, FACTS_KEY: NO_FACTS}
        ),
    )


def _observed_string(value: object, label: str) -> str:
    """One loader observation, or a refusal. An unobserved value is never a fallback."""
    if type(value) is not str or not value:
        raise PrecheckAbort(
            f"{label}: {value!r} was never observed, and a fact the loader did not read "
            "may not be taken from the document it is meant to check"
        )
    return value


def _loader_facts(authorization: object) -> dict[str, Any]:
    """The four facts the loader observed on the authorization envelope."""
    observed: dict[str, Any] = {}
    for name, projection in LOADER_FACT_SOURCES:
        try:
            value = getattr(authorization, projection, None)
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- untrusted projections fail closed
            raise PrecheckAbort(
                f"authorization {projection}: raised {type(error).__name__}"
            ) from None
        observed[name] = _observed_string(value, f"authorization {projection}")
    return observed


def _require_attempt_ports(adapters: object) -> None:
    """Refuse an injected surface that cannot answer one of the four attempt ports."""
    for name, port in ATTEMPT_PORTS:
        try:
            require_port(name, getattr(adapters, name, None), port)
        except TypeError as error:
            raise PrecheckAbort(f"adapters: {error}") from None


def _selected_identity(image: Mapping[str, Any]) -> Mapping[str, Any]:
    """The host-observed registry identity, plus the one reviewed pull policy.

    The selection is assembled rather than copied out of the authorization: a required
    selection read from the document that states it proves only that copying works. The
    host-only readings are excluded because a registry selection may never claim a local
    image id or an observation time of its own.
    """
    selection = {
        key: image[key] for key in SELECTED_IDENTITY_KEYS if key != POLICY_KEY
    }
    return frozen({**selection, POLICY_KEY: PULL_POLICY})


def _observed_identity(image: Mapping[str, Any]) -> Mapping[str, Any]:
    """The host image observation as an identity: everything but the presence flag."""
    return frozen({key: value for key, value in image.items() if key != PRESENT_KEY})


def _grant_facts(
    loader: Mapping[str, Any], prepared: PreparationResult
) -> dict[str, Any]:
    """The nine mandatory facts, each from a source independent of the document."""
    tools = dict(
        zip(
            TOOL_KEYS,
            (prepared.docker_executable, prepared.probe_executable),
            strict=True,
        )
    )
    return {
        **dict(loader),
        TOPOLOGY_FACT: REVIEWED_TOPOLOGY,
        SELECTED_FACT: _selected_identity(prepared.image),
        OBSERVED_FACT: _observed_identity(prepared.image),
        REPOSITORIES_FACT: prepared.control_identities,
        TOOLS_FACT: frozen(tools),
    }


def _attempt_names(prepared: PreparationResult) -> AttemptNames:
    """Derive every resource name from the one observed attempt identity.

    The image reference is digest-pinned from what the host reported it holds, so the attempt
    can only consume the exact material preparation proved present; a tag would name whatever
    the host happens to hold later.
    """
    observed_at = prepared.image[OBSERVED_AT_KEY]
    moment = instant(observed_at)
    if moment is None:
        raise PrecheckAbort(
            f"attempt identity: the host observation {observed_at!r} is not an exact UTC "
            "instant, so no attempt can be named after it"
        )
    attempt_id = f"{moment.strftime(ATTEMPT_INSTANT_FORMAT)}-{ATTEMPT_SLICE}"
    selected = prepared.image
    return AttemptNames(
        attempt_id=attempt_id,
        container=f"{RESOURCE_PREFIX}-{attempt_id}",
        network=f"{RESOURCE_PREFIX}-{NETWORK_INFIX}-{attempt_id}",
        volume=f"{RESOURCE_PREFIX}-{VOLUME_INFIX}-{attempt_id}",
        credential=f"{RESOURCE_PREFIX}-{CREDENTIAL_INFIX}-{attempt_id}",
        image_reference=(
            f"{selected['repository']}{DIGEST_MARKER}{selected['manifest_digest']}"
        ),
    )


def _create_resources(adapters: Any, names: AttemptNames) -> str | None:
    """Create the reviewed inventory once each, in order, or name the failure.

    The order is the reviewed creation order: the internal network first, then the volume,
    then the credential material the container consumes, then the container, then the start
    that actually publishes the reviewed binding.
    """
    try:
        adapters.docker.create_network(name=names.network, internal=True)
        adapters.docker.create_volume(name=names.volume)
        adapters.credential.create(name=names.credential)
        adapters.docker.create_container(
            name=names.container,
            image=names.image_reference,
            network=names.network,
            volume=names.volume,
            publish=PUBLISH_SPEC,
            pull=PULL_POLICY,
            environment={CREDENTIAL_ENVIRONMENT_KEY: CONTAINER_CREDENTIAL_PATH},
        )
        adapters.docker.start_container(name=names.container)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- a failed creation is a stop control
        return f"creation: raised {type(error).__name__}: {error}"
    return None


def _observe_attempt(
    adapters: Any, names: AttemptNames, deadline: float
) -> AttemptObservation:
    """Take every post-creation reading once and reduce them to verdicts.

    The readiness wait is the one bounded wait, and it is bounded by the shared envelope
    rather than by a bound of its own. A container that never reports readiness inside that
    envelope is a timeout — a stop control — and not merely an ingress that was not reached.
    """
    findings: list[str] = []
    candidates: list[str] = []
    health = adapters.docker.observe_health(
        container=names.container, deadline=deadline
    )
    if health != HEALTH_HEALTHY:
        findings.append(
            f"container_health: {health!r} was not the reviewed {HEALTH_HEALTHY!r} "
            "inside the one bounded envelope, so the wait ended without readiness"
        )
        candidates.append(STOP_CONTROL)
    container = adapters.docker.observe_container(container=names.container)
    daemon_event = adapters.docker.observe_daemon_event(container=names.container)
    docker_port = adapters.docker.observe_docker_port(
        container=names.container, container_port=CONTAINER_PORT_KEY
    )
    listeners = adapters.host.observe_listeners(port=HOST_PORT)
    network = adapters.docker.observe_network(name=names.network)
    probe_result = adapters.probe.run(
        executable=PROBE_EXECUTABLE_PATH, argv=PROBE_ARGV
    )
    publication = validate_publication(
        daemon_event=daemon_event,
        container=container,
        docker_port=docker_port,
        listeners=listeners,
    )
    attachment = validate_internal_network(network)
    ingress = validate_internal_ingress(health, probe_result)
    for verdict in (publication, attachment, ingress):
        if not verdict.satisfied:
            findings.extend(verdict.findings)
            candidates.append(verdict.outcome)
    return AttemptObservation(
        health=health,
        probe_result=probe_result,
        network_projection=frozen(network),
        publication_views=publication.views,
        findings=tuple(findings),
        candidates=tuple(candidates),
    )


def _guarded_observation(
    adapters: Any, names: AttemptNames, deadline: float
) -> AttemptObservation:
    """Observe the attempt, or report the seam failure as a stop control."""
    try:
        return _observe_attempt(adapters, names, deadline)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- an unreadable attempt is a stop control
        return AttemptObservation(
            health=None,
            probe_result=None,
            network_projection=None,
            publication_views=MappingProxyType({}),
            findings=(f"observation: raised {type(error).__name__}: {error}",),
            candidates=(STOP_CONTROL,),
        )


def _observed_names(value: object) -> tuple[str, ...] | None:
    """One observed inventory of names, or `None` when nothing was read.

    A string is a sequence of characters rather than of names, so accepting one would let a
    single reported residual decode as a per-character inventory.
    """
    if isinstance(value, (str, bytes, bytearray)) or not isinstance(value, Sequence):
        return None
    return tuple(f"{item}" for item in value)


def _teardown(adapters: Any, names: AttemptNames) -> TeardownRecord:
    """Remove every reviewed kind in order, then re-observe what the host still holds.

    Teardown is unconditional after consumption and covers the whole reviewed inventory,
    whether or not each kind was reached: a create that failed part-way through leaves the
    kinds before it behind, and a removal of something that was never created is a no-op
    rather than a reason to leave residue in place.
    """
    findings: list[str] = []
    candidates: list[str] = []
    resources = dict(
        zip(TEARDOWN_KINDS, (names.container, names.network, names.volume), strict=False)
    )
    try:
        for kind in DOCKER_TEARDOWN_KINDS:
            adapters.docker.remove(kind=kind, name=resources[kind])
        adapters.credential.remove(name=names.credential)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- an incomplete teardown is a stop control
        return TeardownRecord(
            complete=False,
            residuals=(),
            credential_residual=None,
            listeners=(),
            findings=(f"teardown: raised {type(error).__name__}: {error}",),
            candidates=(STOP_CONTROL,),
        )
    residuals = _observed_names(adapters.docker.observe_residual())
    credential_residual = adapters.credential.observe_residual(name=names.credential)
    listeners = _observed_names(adapters.host.observe_listeners(port=HOST_PORT))
    if residuals is None:
        findings.append("teardown: the Docker residual inventory was never read")
    elif residuals:
        findings.append(f"teardown: {list(residuals)!r} outlived the attempt")
    if credential_residual is not False:
        findings.append(
            f"teardown: the {CREDENTIAL_TEARDOWN_KIND} residual reading "
            f"{credential_residual!r} is not exactly False"
        )
    if listeners is None:
        findings.append("teardown: the post-attempt listener inventory was never read")
    elif listeners:
        findings.append(f"teardown: {list(listeners)!r} still hold the reviewed port")
    if findings:
        candidates.append(STOP_CONTROL)
    return TeardownRecord(
        complete=not findings,
        residuals=residuals or (),
        credential_residual=credential_residual,
        listeners=listeners or (),
        findings=tuple(findings),
        candidates=tuple(candidates),
    )


def _evidence(
    names: AttemptNames,
    prepared: PreparationResult,
    facts: Mapping[str, Any],
    observation: AttemptObservation,
    teardown: TeardownRecord,
    timings: Mapping[str, Any],
) -> Mapping[str, Any]:
    """The complete evidence inventory, plus the nine facts the attempt observed."""
    probe = {
        PROBE_EXECUTABLE_KEY: PROBE_EXECUTABLE_PATH,
        PROBE_ARGV_KEY: PROBE_ARGV,
        PROBE_RESULT_KEY: observation.probe_result,
    }
    teardown_record = {
        TEARDOWN_KINDS_KEY: TEARDOWN_KINDS,
        TEARDOWN_COMPLETE_KEY: teardown.complete,
        TEARDOWN_RESIDUAL_KEY: teardown.residuals,
        TEARDOWN_CREDENTIAL_KEY: teardown.credential_residual,
        TEARDOWN_LISTENER_KEY: teardown.listeners,
    }
    recorded = (
        names.attempt_id,
        prepared.docker_platform,
        prepared.control_identities,
        prepared.image,
        prepared.ephemeral_range,
        prepared.pre_consumption_listeners,
        observation.publication_views,
        observation.network_projection,
        probe,
        timings,
        teardown_record,
    )
    inventory = dict(zip(EVIDENCE_KEYS, recorded, strict=True))
    return MappingProxyType(
        {**inventory, FACTS_KEY: MappingProxyType(dict(facts))}
    )


def _run_attempt(
    adapters: Any,
    prepared: PreparationResult,
    facts: Mapping[str, Any],
    names: AttemptNames,
) -> RehearsalResult:
    """Consume the one attempt, run it inside one envelope and always tear it down."""
    started = adapters.clock.monotonic()
    deadline = started + RUNTIME_LIMIT_SECONDS
    try:
        adapters.ledger.consume(record_id=RECORD_ID, attempt_ordinal=ATTEMPT_ORDINAL)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- an unconsumed attempt never started
        return _refused(f"ledger: raised {type(error).__name__}: {error}")
    findings: list[str] = []
    candidates: list[str] = []
    creation = _create_resources(adapters, names)
    if creation is None:
        observation = _guarded_observation(adapters, names, deadline)
    else:
        findings.append(creation)
        candidates.append(STOP_CONTROL)
        observation = AttemptObservation(
            health=None,
            probe_result=None,
            network_projection=None,
            publication_views=MappingProxyType({}),
            findings=(),
            candidates=(),
        )
    findings.extend(observation.findings)
    candidates.extend(observation.candidates)
    completed = adapters.clock.monotonic()
    if completed > deadline:
        findings.append(
            f"envelope: the attempt reached {completed!r}, past the one deadline "
            f"{deadline!r}, and no extension cycle is authorized"
        )
        candidates.append(STOP_CONTROL)
    teardown = _teardown(adapters, names)
    findings.extend(teardown.findings)
    candidates.extend(teardown.candidates)
    timings = MappingProxyType(
        {
            TIMINGS_STARTED_KEY: started,
            TIMINGS_COMPLETED_KEY: completed,
            TIMINGS_DEADLINE_KEY: deadline,
            TIMINGS_LIMIT_KEY: RUNTIME_LIMIT_SECONDS,
            TIMINGS_EXTENSION_KEY: EXTENSION_CYCLES,
        }
    )
    return RehearsalResult(
        outcome=resolve_outcome(candidates),
        attempt_consumed=True,
        teardown_complete=teardown.complete,
        residuals=teardown.residuals,
        findings=tuple(findings),
        evidence=_evidence(names, prepared, facts, observation, teardown, timings),
    )


def run_topology_rehearsal(
    authorization: object,
    adapters: object,
    *,
    execute_requested: object = False,
) -> RehearsalResult:
    """Run the one authorized topology attempt, or refuse before consuming it.

    Nothing is observed at all without the exact execute request: a runner that read the
    host in order to decide whether it had been asked to would already have acted. After
    that, the read-only preparation phase and static admission both have to pass before the
    attempt is consumed, and consumption happens immediately before the first create.
    """
    if execute_requested is not True:
        return _refused("the exact execute request was not supplied")
    try:
        loader = _loader_facts(authorization)
        _require_attempt_ports(adapters)
        prepared = prepare(authorization, adapters)
        names = _attempt_names(prepared)
        facts = _grant_facts(loader, prepared)
    except (KeyboardInterrupt, SystemExit):
        raise
    except PrecheckAbort as error:
        return _refused(error.reason)
    except Exception as error:  # noqa: BLE001 -- every pre-consumption failure refuses
        return _refused(f"preparation raised {type(error).__name__}: {error}")
    decision = decide(
        authorization, adapters, facts=facts, execute_requested=True
    )
    if not decision.admitted:
        return _refused(*decision.findings)
    return _run_attempt(adapters, prepared, facts, names)
