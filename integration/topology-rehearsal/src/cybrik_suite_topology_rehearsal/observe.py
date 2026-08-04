"""Fail-closed reductions from injected observations to one classified verdict.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Every function here is total and pure. It reaches nothing, holds nothing between calls and
returns one immutable `ObservationVerdict` for the observations it was handed. Those
observations arrive through injected ports, so their shape is never guaranteed: a malformed
projection decodes as an unresolved view rather than raising out of a seam whose only
failure value is `None`.

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
    PORT_PROTOCOL,
    PRECHECK_ABORT,
    PROBE_REACHABLE,
    PUBLICATION_VIEWS,
    SELECTED_IDENTITY_KEYS,
    STOP_CONTROL,
)
from .errors import TERMINAL_ERRORS
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
