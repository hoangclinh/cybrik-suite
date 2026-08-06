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
from math import isfinite
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

__all__ = ["RehearsalResult", "attempt_id_for", "run_topology_rehearsal"]

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

# The attempt identity. It is the exact instant the grant signed for its host observation,
# rendered without the separators an argv token may not carry, plus the reviewed slice label.
# Deriving it from the pinned instant rather than inventing it keeps every resource name
# traceable to the one document that authorized creating it, and keeps it nameable before any
# host is read — which is the only way it can be the same name a composition-time plan holds.
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


def attempt_id_for(pinned_observed_at: str) -> str:
    """Render the one attempt identity from the instant the authorization pinned.

    This is the only rendering of that identity in the package, and it is exported because
    two callers need it: the composition root, which names the attempt before any host is
    read and holds nothing but the pinned instant, and `_attempt_names` below, which names it
    again once preparation has answered. A second formula spelled out at either site would be
    two renderings of one identity with nothing structural holding them together; the
    disagreement would surface only after the single authorized attempt had already been
    spent creating names its own plan-bound ports then refuse.

    It is a function of its argument alone — no clock, no host reading and no snapshot — so
    every caller holding the same pinned instant renders the same string wherever and whenever
    it runs. Anything that is not exactly the reviewed UTC shape names no attempt at all.
    """
    moment = instant(pinned_observed_at)
    if moment is None:
        raise PrecheckAbort(
            f"attempt identity: the pinned host observation {pinned_observed_at!r} is not an "
            "exact UTC instant, so no attempt can be named after it"
        )
    return f"{moment.strftime(ATTEMPT_INSTANT_FORMAT)}-{ATTEMPT_SLICE}"


def _attempt_names(prepared: PreparationResult) -> AttemptNames:
    """Derive every resource name from the one pinned attempt identity.

    The identity is the instant the authorization pinned for its host observation, not the
    live instant preparation read off this host. Both are admitted readings — preparation
    takes any observation at or after the pin — so the live one is a different value on every
    host, while the command plan is built by the composition root before any host is read and
    can only ever carry the pin. Naming the attempt from the live reading agreed with that
    plan on exactly one host in the world, the one reporting the second the authorization was
    signed on; on every other host the first create was refused by the attempt's own
    plan-bound ports, which spends the single authorized attempt proving that the created
    names and the enforced names disagree. The pinned instant is the honest source because it
    is what the one attempt is *about*: a name the signed document is entitled to fix, unlike
    a control root or an admission fact. It is neither observed nor submitted as a fact here —
    `_grant_facts` still hands admission the live host identity, and that live reading must
    still be at or after the pin for anything to be named at all.

    The image reference is digest-pinned from what the host reported it holds, so the attempt
    can only consume the exact material preparation proved present; a tag would name whatever
    the host happens to hold later.
    """
    attempt_id = attempt_id_for(prepared.granted_observed_at)
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


def _guarded_removal(remove: Any, kind: str, /, **arguments: Any) -> str | None:
    """Remove one reviewed kind, or name the exact kind that refused to be removed.

    Every kind is removed under a guard of its own rather than under one shared `try`: a
    single raise used to abandon every removal after it, and the last kind removed is the
    on-disk credential material, so one failed Docker removal orphaned a secret file on the
    host that nothing later in the attempt would have gone back for.
    """
    try:
        remove(**arguments)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- a failed removal is a stop control
        return f"teardown: removing the {kind} raised {type(error).__name__}: {error}"
    return None


def _guarded_reading(
    read: Any, label: str, /, **arguments: Any
) -> tuple[Any, str | None]:
    """Take one post-teardown reading, or report the unreadable seam as a finding.

    These readings are what prove the host actually let go of everything the attempt
    created, so they are taken after the single-use entry is already spent. A raise from
    any of them escaping here would burn the one attempt with no result and no evidence at
    all, which is strictly worse than reporting that the host could not be re-read.
    """
    try:
        return read(**arguments), None
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- an unreadable host is a stop control
        return None, (
            f"teardown: reading the {label} raised {type(error).__name__}: {error}"
        )


def _teardown(adapters: Any, names: AttemptNames) -> TeardownRecord:
    """Remove every reviewed kind in order, then re-observe what the host still holds.

    Teardown is unconditional after consumption and covers the whole reviewed inventory,
    whether or not each kind was reached: a create that failed part-way through leaves the
    kinds before it behind, and a removal of something that was never created is a no-op
    rather than a reason to leave residue in place. One kind that cannot be removed is a
    finding about that kind, never a reason to stop removing the kinds after it.
    """
    findings: list[str] = []
    candidates: list[str] = []
    resources = dict(
        zip(TEARDOWN_KINDS, (names.container, names.network, names.volume), strict=False)
    )
    removals = [
        _guarded_removal(
            adapters.docker.remove, kind, kind=kind, name=resources[kind]
        )
        for kind in DOCKER_TEARDOWN_KINDS
    ]
    removals.append(
        _guarded_removal(
            adapters.credential.remove,
            CREDENTIAL_TEARDOWN_KIND,
            name=names.credential,
        )
    )
    findings.extend(removal for removal in removals if removal is not None)
    residual_reading, residual_finding = _guarded_reading(
        adapters.docker.observe_residual, "Docker residual inventory"
    )
    credential_residual, credential_finding = _guarded_reading(
        adapters.credential.observe_residual,
        f"{CREDENTIAL_TEARDOWN_KIND} residual",
        name=names.credential,
    )
    listener_reading, listener_finding = _guarded_reading(
        adapters.host.observe_listeners,
        "post-attempt listener inventory",
        port=HOST_PORT,
    )
    residuals = _observed_names(residual_reading)
    listeners = _observed_names(listener_reading)
    if residual_finding is not None:
        findings.append(residual_finding)
    elif residuals is None:
        findings.append("teardown: the Docker residual inventory was never read")
    elif residuals:
        findings.append(f"teardown: {list(residuals)!r} outlived the attempt")
    if credential_finding is not None:
        findings.append(credential_finding)
    elif credential_residual is not False:
        findings.append(
            f"teardown: the {CREDENTIAL_TEARDOWN_KIND} residual reading "
            f"{credential_residual!r} is not exactly False"
        )
    if listener_finding is not None:
        findings.append(listener_finding)
    elif listeners is None:
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


def _finite_reading(reading: float) -> bool:
    """Whether a numeric reading is a real finite value it is safe to measure with.

    `isfinite` answers for every reading a clock can plausibly hand back except one: an
    `int` too large to convert to a float raises `OverflowError` out of the check itself.
    Asking the question inside the guard keeps that shape a finding like every other
    unusable reading rather than an exception escaping the whole attempt.
    """
    try:
        return isfinite(reading)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception:  # noqa: BLE001 -- a reading with no float form is not a reading
        return False


def _guarded_clock(adapters: Any) -> tuple[float | None, str | None]:
    """One monotonic reading, or the seam failure it must not let escape as an exception.

    Every other injected seam in this file converts a raise into a terminal value instead of
    propagating it; the clock had two bare calls that did not, so a raising clock escaped
    `run_topology_rehearsal` as a bare `OSError`. The two callers decide what an unobserved
    reading means for the phase they are in: the opening reading fixes the one envelope, so
    its failure must refuse before anything is consumed, while the completion reading only
    records where the attempt ended, so its failure is a finding rather than a reason to skip
    the mandatory teardown.

    Not raising is only half of answering. A seam that returns a value this file then does
    arithmetic on has to be checked for the shape of that value the way every other seam here
    is, so the reading is admitted only if it is a real finite number: a string or `None`
    would reach the deadline as a `TypeError` after the attempt was consumed, a `bool` is an
    `int` without being an elapsed time, and a `nan` would compare its way past the deadline
    to a falsely clean envelope instead of a stop control.
    """
    try:
        reading = adapters.clock.monotonic()
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- an unreadable clock is a stop control, not a crash
        return None, f"clock: raised {type(error).__name__}: {error}"
    if type(reading) not in (int, float) or not _finite_reading(reading):
        return None, f"clock: answered {reading!r}, which is not an elapsed-time reading"
    return reading, None


def _run_attempt(
    adapters: Any,
    prepared: PreparationResult,
    facts: Mapping[str, Any],
    names: AttemptNames,
) -> RehearsalResult:
    """Consume the one attempt, run it inside one envelope and always tear it down."""
    started, opening_finding = _guarded_clock(adapters)
    if opening_finding is not None:
        return _refused(opening_finding)
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
    completed, completion_finding = _guarded_clock(adapters)
    if completion_finding is not None:
        findings.append(completion_finding)
        candidates.append(STOP_CONTROL)
    elif completed < started:
        findings.append(
            f"envelope: the attempt completed at {completed!r}, earlier than the opening "
            f"reading {started!r}, so the pair is not an elapsed time at all"
        )
        candidates.append(STOP_CONTROL)
    elif completed > deadline:
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
