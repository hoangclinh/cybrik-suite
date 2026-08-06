"""Fail-closed readings of injected observations: flat evidence, and classified verdicts.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Every function here is total and pure. It reaches nothing, holds nothing between calls and
answers only from what it was handed: a reduction returns one immutable `ObservationVerdict`
and a normalization returns one immutable flat reading. Those observations arrive through
injected ports, so their shape is never guaranteed: a malformed projection decodes as an
unresolved view rather than raising out of a seam whose only failure value is `None`.

`platform_evidence` normalizes rather than judges, and it belongs to the same job family as
the publication readers below: one decoded Docker projection in, one flat resolved reading
or `None` out. It reads the raw `docker version` document into the flat inventory
`preparation` compares, and lives beside those readers rather than in the Docker adapter
that calls it, because nothing about it touches a command result or a process seam. Like
them it is package plumbing rather than boundary contract, so it is deliberately absent from
the curated `__all__` below, which names only the reducers a caller reaches for.

`None` is the single unresolved value, and an unresolved view is never agreement. A view
that could not be read says so; it never falls back to the reviewed value it was being
compared against, because a defaulted observation would let an unread control read as a
satisfied one. Agreement is exact equality with the one reviewed binding, so a wildcard or
an ambiguous address is refused for the same reason any other wrong value is, without a
blocklist of spellings that a new spelling could slip past.

A verdict is coherent by construction: it cannot be satisfied while carrying findings, it
cannot refuse without a reason, and every refusal names the exact terminal class it belongs
to. No caller has to re-decide whether a refusal aborts the precheck, fires a stop control,
or classifies a publication or an internal-ingress failure. Those classes are the ones
diagnosis section 8 assigns, read reduction by reduction: an unread pre-consumption identity
is `PRECHECK_ABORT`, a network that is not internal or does not hold exactly the one
attachment is `STOP_CONTROL`, disagreeing publication projections are `FAIL_PUBLICATION`,
and the container readiness and bounded host probe are `FAIL_INTERNAL_INGRESS`.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

from .constants import (
    CONTAINER_PORT_KEY,
    EXPECTED_PUBLICATION,
    FAIL_INTERNAL_INGRESS,
    FAIL_PUBLICATION,
    HEALTH_HEALTHY,
    HOST_PORT,
    PLATFORM_EVIDENCE_KEYS,
    PORT_PROTOCOL,
    PRECHECK_ABORT,
    PROBE_REACHABLE,
    PUBLICATION_VIEWS,
    SELECTED_IDENTITY_KEYS,
    STOP_CONTROL,
)
from .errors import TERMINAL_ERRORS
from .grant import (
    OBSERVED_BINDING_KEYS,
    OBSERVED_IDENTITY_KEYS as SIGNED_IDENTITY_KEYS,
    REGISTRY_DIGEST_KEYS,
    keyed,
    platform_findings,
    registry_digest,
)
from .plan import TopologyPlan
from .protocols import (
    ADDRESS_SEPARATOR,
    LISTENER_ADDRESS_KEY,
    LISTENER_PORT_KEY,
    LISTENER_PROTOCOL_KEY,
)

__all__ = [
    "ObservationVerdict",
    "validate_image_identity",
    "validate_internal_ingress",
    "validate_internal_network",
    "validate_publication",
]

# The empty view table every reduction but the publication one reports. It is shared and
# read-only: a mutable default would let one verdict's evidence grow into every other's.
NO_VIEWS: Mapping[str, str | None] = MappingProxyType({})

# The identity fields a host can actually report back. `pull_policy` is a rule the attempt
# obeys rather than anything a host observes, so demanding it of an observation would refuse
# every correct reading. The host-only `local_image_id` is absent for the opposite reason: it
# names bytes on one machine and can never equal a registry digest, so it is recorded as an
# observation and never compared against the selection.
SELECTION_ONLY_KEYS = ("pull_policy",)
OBSERVED_IDENTITY_KEYS = tuple(
    key for key in SELECTED_IDENTITY_KEYS if key not in SELECTION_ONLY_KEYS
)

# The exact keys of the two container projections carrying a publication view. The listener
# record's own keys are not re-typed here: they are the shape `protocols.decoded_listener`
# produces, so both sides derive them from that one boundary declaration.
HOST_CONFIG_BINDING_PATH = ("HostConfig", "PortBindings")
NETWORK_SETTINGS_PORT_PATH = ("NetworkSettings", "Ports")
BINDING_ADDRESS_KEY = "HostIp"
BINDING_PORT_KEY = "HostPort"
NETWORK_INTERNAL_KEY = "Internal"
NETWORK_ATTACHMENT_KEY = "Containers"

# The complete key inventory a publication projection may carry. Section 7 item 6 requires
# the projection to contain *only* the reviewed mapping, so an inventory that also publishes
# another port is refused even where the reviewed key itself agrees.
REVIEWED_BINDING_KEYS = frozenset({CONTAINER_PORT_KEY})

# Exactly one claim per view. Two claims for one reviewed port is an ambiguity, not a
# doubled agreement: a reader could not say which of them the publication actually is.
EXPECTED_VIEW_CLAIM_COUNT = 1

# Exactly one container attached to the reviewed internal network. It is stated separately
# from the claim count above, and stays separate while both are one: a single shared name
# would make a later change to either invariant silently change the other as well.
EXPECTED_NETWORK_ATTACHMENT_COUNT = 1

# `docker version --format {{json .}}` renders a nested document, and every reviewed platform
# fact is read from the daemon's own `Server` section. The `Client` section is the CLI's own
# identity and carries none of them, so it is never consulted. `ApiVersion` is the spelling
# docker/cli emits for the reviewed packet; the capitalized `APIVersion` below is recorded
# only so it can be recognised, never so it can be read. These names are all raw-document
# keys, deliberately spelled unlike `preparation`'s flat inventory keys so that a key from
# one side of the seam can never be mistaken for the same-named key on the other.
SERVER_SECTION = "Server"
PLATFORM_SECTION = "Platform"
PLATFORM_NAME_KEY = "Name"
SERVER_VERSION_KEY = "Version"
API_VERSION_KEY = "ApiVersion"
SUPERSEDED_API_VERSION_KEY = "APIVersion"

# Docker Desktop states its version and its build in this one string and nowhere else, so
# both halves are parsed out of it. The groups admit neither whitespace nor a parenthesis, so
# an absent version, an absent build and an unterminated build cannot match as something.
DESKTOP_PLATFORM_NAME = re.compile(
    r"Docker Desktop (?P<version>[^\s()]+) \((?P<build>[^\s()]+)\)"
)


@dataclass(frozen=True)
class ObservationVerdict:
    """One reduction's answer: satisfied, or refused with reasons and a terminal class.

    The coherence is enforced here rather than trusted to each caller, because a verdict is
    the evidence a later phase reads. One that reported `satisfied` while carrying findings
    would let a refused observation be recorded as a satisfied control, and one that refused
    without naming its class would leave the classification to whoever happened to read it.
    """

    satisfied: bool
    outcome: str | None = None
    findings: tuple[str, ...] = ()
    views: Mapping[str, str | None] = NO_VIEWS

    def __post_init__(self) -> None:
        if type(self.satisfied) is not bool:
            raise ValueError(
                f"satisfied must be exactly a bool, not {self.satisfied!r}"
            )
        if type(self.findings) is not tuple or any(
            not isinstance(finding, str) or not finding for finding in self.findings
        ):
            raise ValueError(
                f"findings must be a tuple of non-empty reasons: {self.findings!r}"
            )
        if type(self.views) is not MappingProxyType:
            raise ValueError(
                f"views must be a read-only mapping, not {type(self.views).__name__}"
            )
        if self.satisfied:
            if self.findings or self.outcome is not None:
                raise ValueError(
                    "a satisfied verdict carries no finding and no terminal class"
                )
            return
        if not self.findings:
            raise ValueError(
                "an unsatisfied verdict must carry at least one reason: an unexplained "
                "refusal is not evidence"
            )
        if self.outcome not in TERMINAL_ERRORS:
            raise ValueError(f"{self.outcome!r} is not a failing terminal class")


def verdict_for(
    findings: Sequence[str],
    outcome: str,
    *,
    views: Mapping[str, str | None] = NO_VIEWS,
) -> ObservationVerdict:
    """The one verdict for the reasons a reduction gathered.

    A reduction that gathered no reason is satisfied and a reduction that gathered one is
    refused under the class it was given. Neither branch is a default: both are the exact
    reading of what the reduction found.
    """
    reasons = tuple(findings)
    if reasons:
        return ObservationVerdict(
            satisfied=False, outcome=outcome, findings=reasons, views=views
        )
    return ObservationVerdict(satisfied=True, views=views)


def nested(value: object, path: Sequence[str]) -> Any:
    """Walk a projection by exact key, yielding `None` at the first key that is not there.

    A projection arrives through an injected port, so every step is checked rather than
    assumed: an absent or wrong-typed level is an unresolved reading, not an exception.
    """
    current: Any = value
    for key in path:
        if not isinstance(current, Mapping):
            return None
        current = current.get(key)
    return current


# Safe immutable leaves; every other type is a container to walk or a value to report.
IMMUTABLE_LEAVES = (bool, int, float, complex, str, bytes, type(None))


def immutability_findings(
    value: object, path: str, seen: tuple[int, ...] = ()
) -> tuple[str, ...]:
    """Report every nested value that is not already deeply immutable.

    Total and pure like the readers around it: it is handed one value and answers about that
    value only, reaching nothing and raising nothing. A cycle is reported at the path where it
    closes rather than followed, so an unbounded projection is a finding, not a recursion.
    """
    if type(value) in IMMUTABLE_LEAVES:
        return ()
    if id(value) in seen:
        return (f"{path} refers to itself",)
    trail = (*seen, id(value))
    if type(value) is MappingProxyType:
        return tuple(
            finding
            for key, item in value.items()
            for finding in (
                *immutability_findings(key, f"{path}.<key>", trail),
                *immutability_findings(item, f"{path}.<value>", trail),
            )
        )
    if type(value) is tuple:
        return tuple(
            finding
            for item in value
            for finding in immutability_findings(item, f"{path}.<item>", trail)
        )
    if type(value) is frozenset:
        return tuple(
            finding
            for item in value
            for finding in immutability_findings(item, f"{path}.<member>", trail)
        )
    return (f"{path} holds a {type(value).__name__}, which is not deeply immutable",)


def signed_identity_findings(identity: Any, image: Any) -> tuple[str, ...]:
    """Refuse a pinned identity that is not a whole, resolved, agreeing host observation.

    A copy of a result carries no authorization, so nothing here can prove this identity is
    the one a grant signed; that residual is stated on the field itself. What is provable is
    that an invented identity is not cheap: it must carry the entire reviewed inventory, every
    value resolved and well formed, and it must state the same binding as the live reading on
    every key. Only `observed_at` may differ, because two readings are two separate events.
    """
    label = "granted_image_identity"
    refusals = keyed(identity, SIGNED_IDENTITY_KEYS, label, ordered=False)
    if refusals:
        return refusals
    unread = tuple(key for key in SIGNED_IDENTITY_KEYS if identity[key] is None)
    if unread:
        return (
            f"{label}: unresolved — {list(unread)} were never read, so the host never said "
            "what it holds",
        )
    findings = [
        f"{label}: {key} {identity[key]!r} is not a registry digest"
        for key in (*REGISTRY_DIGEST_KEYS, "local_image_id")
        if not registry_digest(identity[key])
    ]
    findings.extend(platform_findings(identity["platform"], label))
    findings.extend(
        f"{label}: {key} {identity[key]!r} is not the {key} {image.get(key)!r} the live"
        " reading states, so this result names two images and proves neither"
        for key in OBSERVED_BINDING_KEYS
        if identity[key] != image.get(key)
    )
    return tuple(findings)


def entry_sequence(value: object) -> Sequence[Any] | None:
    """One sequence of entries, or `None`.

    A string is a sequence of characters rather than of entries, so accepting one would let
    a single reported address decode as a list of per-character claims.
    """
    if isinstance(value, (str, bytes, bytearray)) or not isinstance(value, Sequence):
        return None
    return value


def single_claim(value: object) -> Any:
    """The one claim a view may carry, or `None` when it carries none or several."""
    entries = entry_sequence(value)
    if entries is None or len(entries) != EXPECTED_VIEW_CLAIM_COUNT:
        return None
    return entries[0]


def reported_publication(value: object) -> str | None:
    """One reported publication string, or `None` when nothing was reported."""
    if not isinstance(value, str):
        return None
    return value.strip() or None


def binding_publication(bindings: object) -> str | None:
    """The single host binding a container projection claims for the reviewed port.

    The whole key inventory is checked, not just the reviewed key. A projection that also
    publishes another port is not the reviewed single mapping, so reading past the extra key
    would accept a container with a second, unreviewed publication as a satisfied control —
    and the reviewed key agreeing is exactly the case where that would go unnoticed.

    The host port is required to be the daemon's own string spelling. An integer here would
    mean the projection was rebuilt by something other than the daemon, and a rebuilt view
    is not an independent view.
    """
    if not isinstance(bindings, Mapping):
        return None
    if set(bindings) != REVIEWED_BINDING_KEYS:
        return None
    entry = single_claim(bindings.get(CONTAINER_PORT_KEY))
    if not isinstance(entry, Mapping):
        return None
    address = entry.get(BINDING_ADDRESS_KEY)
    port = entry.get(BINDING_PORT_KEY)
    if not isinstance(address, str) or not address:
        return None
    if not isinstance(port, str) or not port.isdigit():
        return None
    return f"{address}{ADDRESS_SEPARATOR}{port}"


def listener_publication(listeners: object) -> str | None:
    """The single host listener holding the reviewed port, or `None`.

    `bool` is refused deliberately. `True` is an `int` in Python, so a flag handed back
    instead of a port would compare equal to 1 and could be read as a real reading.
    """
    listener = single_claim(listeners)
    if not isinstance(listener, Mapping):
        return None
    if listener.get(LISTENER_PROTOCOL_KEY) != PORT_PROTOCOL:
        return None
    address = listener.get(LISTENER_ADDRESS_KEY)
    port = listener.get(LISTENER_PORT_KEY)
    if not isinstance(address, str) or not address:
        return None
    if type(port) is not int or port != HOST_PORT:
        return None
    return f"{address}{ADDRESS_SEPARATOR}{port}"


def validate_publication(
    *,
    daemon_event: object,
    container: object,
    docker_port: object,
    listeners: object,
) -> ObservationVerdict:
    """Reduce the five independent publication views to one agreement, or refuse.

    All five must resolve and all five must equal the one reviewed binding. Four agreeing
    views and one unresolved view is not a publication anybody observed: it is four views
    and a gap, and the gap is exactly where a wildcard bind or a second claim would sit.

    The refused verdict still carries every view, so a reader is told which projection
    disagreed rather than only that the reduction failed.
    """
    views: Mapping[str, str | None] = MappingProxyType(
        dict(
            zip(
                PUBLICATION_VIEWS,
                (
                    reported_publication(daemon_event),
                    binding_publication(nested(container, HOST_CONFIG_BINDING_PATH)),
                    binding_publication(nested(container, NETWORK_SETTINGS_PORT_PATH)),
                    reported_publication(docker_port),
                    listener_publication(listeners),
                ),
                strict=True,
            )
        )
    )
    findings = tuple(
        f"{name}: unresolved — no publication was observed"
        if observed is None
        else f"{name}: observed {observed!r}, not the reviewed {EXPECTED_PUBLICATION!r}"
        for name, observed in views.items()
        if observed != EXPECTED_PUBLICATION
    )
    return verdict_for(findings, FAIL_PUBLICATION, views=views)


def validate_internal_network(projection: object) -> ObservationVerdict:
    """Refuse anything but an internal network holding exactly the one attachment.

    Section 8 maps a non-internal or multiple network attachment to `STOP_CONTROL`, and this
    reduction classifies its refusals there. An unresolved projection is the same refusal
    read one step earlier: a network nobody could read is not a network anybody proved
    internal, so it is the same control invariant failing rather than a weaker diagnostic
    reading. Classifying any of the three as an ingress failure would report a failed control
    as a failed reachability probe, and would rank the refusal below a publication failure
    that section 8 says it overrides.

    `Internal` must be exactly `True`. A merely truthy flag is not isolation: it is a value
    whose meaning the reviewer never read, and reading it as isolation would report a
    network with a route off the host as a network without one.
    """
    if not isinstance(projection, Mapping):
        unreadable = (
            f"internal_network: unresolved — {projection!r} is not a network projection"
        )
        return verdict_for((unreadable,), STOP_CONTROL)
    findings: list[str] = []
    internal = projection.get(NETWORK_INTERNAL_KEY)
    if internal is not True:
        findings.append(
            f"internal_network: Internal is {internal!r}, not exactly True"
        )
    attachments = projection.get(NETWORK_ATTACHMENT_KEY)
    if not isinstance(attachments, Mapping):
        findings.append(
            f"network_attachment: unresolved — {attachments!r} is not an attachment "
            "mapping"
        )
    elif len(attachments) != EXPECTED_NETWORK_ATTACHMENT_COUNT:
        findings.append(
            f"network_attachment: {len(attachments)} attachments observed, not exactly "
            f"{EXPECTED_NETWORK_ATTACHMENT_COUNT}"
        )
    return verdict_for(findings, STOP_CONTROL)


def validate_internal_ingress(health: object, probe: object) -> ObservationVerdict:
    """Both the container's own readiness and the bounded host probe must be exact.

    This is the one reduction section 8 leaves under `FAIL_INTERNAL_INGRESS`: an agreed
    publication whose healthy container the bounded host TCP probe could not reach. The
    network attachment is not read here; it is a control invariant and is classified above.

    Neither reading has a partial credit state. A container that is still starting has not
    reported readiness, and a probe that did not answer has not reported reachability.
    """
    findings = [
        f"{label}: observed {observed!r}, not the reviewed {expected!r}"
        for label, observed, expected in (
            ("container_health", health, HEALTH_HEALTHY),
            ("host_probe", probe, PROBE_REACHABLE),
        )
        if observed != expected
    ]
    return verdict_for(findings, FAIL_INTERNAL_INGRESS)


def validate_image_identity(selected: object, observed: object) -> ObservationVerdict:
    """Compare the pinned registry selection against what the host reports it holds.

    Three states are kept apart deliberately. An unresolved *selection* means the attempt
    never pinned which material it was allowed to consume; an unresolved *observation* means
    the host could not say what it holds; and two resolved values that differ is a real
    disagreement about material both sides could name. Only the last is a mismatch, and
    reporting one of them as another would send a reader after the wrong remedy.

    Nesting is not walked. A selected platform may carry its own absent variant, which is a
    property of the platform rather than an unpinned selection.
    """
    if not isinstance(selected, Mapping) or not isinstance(observed, Mapping):
        return verdict_for(
            tuple(
                f"{label}: unresolved — {value!r} is not an image identity"
                for label, value in (
                    ("selected_image_identity", selected),
                    ("observed_image_identity", observed),
                )
                if not isinstance(value, Mapping)
            ),
            PRECHECK_ABORT,
        )
    findings: list[str] = []
    for key in OBSERVED_IDENTITY_KEYS:
        selection = selected.get(key)
        observation = observed.get(key)
        if selection is None:
            findings.append(f"{key}: the selected identity is unresolved")
        elif observation is None:
            findings.append(f"{key}: the host observation is unresolved")
        elif observation != selection:
            findings.append(
                f"{key}: the host holds {observation!r}, which is not the selected "
                f"{selection!r}"
            )
    return verdict_for(findings, PRECHECK_ABORT)


def observed_text(value: object) -> str | None:
    """One exactly-`str`, non-empty reading, or `None` when the field cannot be read.

    The consuming phase judges each recorded value with `type(value) is not str`, so a
    `str` subclass is refused here rather than carried one phase further to fail there.
    """
    return value if type(value) is str and value else None


def desktop_identity(name: object) -> tuple[str, str] | None:
    """The Docker Desktop version and build parsed out of the one string that carries both.

    `docker version` states the Desktop product only as `Server.Platform.Name`, rendered as
    `Docker Desktop <version> (<build>)`; there is no separate JSON field for either half.
    The match is whole rather than a search, so a name that merely contains that shape — and
    an Engine name such as `Docker Engine - Community`, which is not a Desktop platform at
    all — yields no identity instead of a guess assembled from part of a string.
    """
    text = observed_text(name)
    if text is None:
        return None
    matched = DESKTOP_PLATFORM_NAME.fullmatch(text)
    return (matched["version"], matched["build"]) if matched else None


def observed_api_version(server: Mapping[str, Any]) -> str | None:
    """The API version under its one supported spelling, refusing a disagreeing duplicate.

    `Server.ApiVersion` is what docker/cli emits for the reviewed packet. The capitalized
    `Server.APIVersion` was a 29.0.0-only regression restored to `ApiVersion` by docker/cli
    PR #6648 for 29.0.1, so no supported version authorizes reading it as a source. A
    document carrying both spellings with different values states one fact twice and
    disagrees with itself; nothing warrants preferring either, so it is left unresolved. The
    same value under both is only an unread extra key and changes nothing. A duplicate that
    is present but unreadable — a JSON `null`, say — is not treated as an absent key: it is
    still a second, differing assertion about the one fact, so it is refused rather than
    guessed past.
    """
    observed = observed_text(server.get(API_VERSION_KEY))
    if observed is None:
        return None
    superseded = server.get(SUPERSEDED_API_VERSION_KEY, observed)
    return observed if superseded == observed else None


def platform_evidence(document: object) -> Mapping[str, Any] | None:
    """The flat reviewed inventory read out of the raw `docker version` document.

    All four facts come from the daemon's own `Server` section, because the daemon is the
    Desktop product the attempt talks to; the `Client` section is the CLI's own identity and
    carries none of them, so an absent or drifted client cannot move this result.

    The inventory resolves whole or not at all. A partial reading would be refused
    downstream as drift anyway, and a filled-in placeholder would record a platform identity
    nobody observed. The keys are taken from the reviewed inventory rather than typed again,
    so the emitted evidence cannot drift away from the inventory that is checked. `strict=True`
    is the one deliberately non-total path in this module: an arity tripwire that fires only if
    `PLATFORM_EVIDENCE_KEYS` changes without what is read here changing with it, and the phase
    that consumes this turns it into a bounded refusal rather than letting it escape the seam.
    """
    if not isinstance(document, Mapping):
        return None
    server = document.get(SERVER_SECTION)
    if not isinstance(server, Mapping):
        return None
    platform = server.get(PLATFORM_SECTION)
    if not isinstance(platform, Mapping):
        return None
    desktop = desktop_identity(platform.get(PLATFORM_NAME_KEY))
    engine = observed_text(server.get(SERVER_VERSION_KEY))
    api = observed_api_version(server)
    if desktop is None or engine is None or api is None:
        return None
    observed = (*desktop, engine, api)
    return MappingProxyType(
        dict(zip(PLATFORM_EVIDENCE_KEYS, observed, strict=True))
    )


class CommandAdapterAccessors:
    """The one read-only `.plan` identity accessor shared by every command adapter.

    Every command adapter in `adapter.py` holds one `ExactCommandAdapter` as `self._executor`
    and, until the entrypoint wiring contract needed it, exposed neither the plan nor the
    runner it was built with. A wiring that built all five adapters over one reviewed plan can
    read it back by identity (`adapter.plan is wiring.plan`) rather than keeping a second,
    adapter-local copy. A `TopologyPlan` is inert reviewed data — a frozen dataclass of argv
    tuples — so publishing it grants no authority to act.

    There is deliberately no matching `.runner`. `aae6a30` pinned one, and
    `tests/test_adapter.py` withdrew it: publishing the raw executor off every command adapter
    would let a holder of the frozen `Adapters` bundle call `adapters.docker.runner.run(argv,
    ...)` with arbitrary argv and walk past the plan-membership guard in
    `ExactCommandAdapter.run_effect`, the one check keeping a reachable command inside the
    reviewed plan. That the five adapters share a single injected runner is proved
    behaviourally instead — by driving each adapter and reading the injected runner's own
    ledger — which proves the stronger property (each adapter *uses* it, not merely that it
    was *handed* it) and hands the caller nothing.

    This lives here, alongside `platform_evidence`, rather than in `adapter.py` itself,
    because that module is already at its reviewed 800-line bound: this is the one place the
    accessor can be added to every command adapter without growing it by a byte. With the
    executor accessor withdrawn, nothing here reaches a process seam, so this module's own
    claim to reach nothing still holds.

    Like `platform_evidence`, this is package plumbing rather than a pure reducer, so it is
    deliberately absent from the curated `__all__` above.
    """

    @property
    def plan(self) -> TopologyPlan:
        return self._executor.plan
