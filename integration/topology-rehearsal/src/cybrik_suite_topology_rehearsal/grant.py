"""Canonical grant bytes and the semantic bindings that must hold before a signature.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Reading a grant is a pure reduction. `canonical_grant_bytes` renders one document to one
exact byte string, and `verify_bindings` reduces that document and the facts the runner
observed for itself to a single immutable `GrantVerdict`. Neither reaches for a file, a
process or a socket, and neither edits the values it was handed.

This module runs strictly *before* SSHSIG verification, so it may not name the signer or the
signature namespace. A binding module that could decide who signed a grant would be
positioned to satisfy the very control it exists to precede, and the separation is what keeps
"this grant says the right thing" and "the Founder signed it" two independent answers.

The canonical rendering keeps the document's own key order rather than sorting it. A
canonicalizer that re-ordered would let two differently ordered documents render to the same
bytes, so a signature taken over one would silently carry the other. The rendering is
`ensure_ascii` JSON, which is why no carriage return and no byte-order mark can survive into
the signed bytes: both would be escaped rather than emitted. It is bounded because an
unbounded rendering is a byte budget nobody agreed to sign, and a document a reviewer cannot
read in one sitting is not exact-action.

Every binding is mandatory and every one fails closed. Nothing here carries a default: a
defaulted fact would let an unobserved control read as a satisfied one, which is exactly the
fail-open this binding exists to prevent. The grant must bind the record and the runner the
runner itself observed rather than its own claim, the reviewed topology, a registry selection
kept separate from the host observation it is compared against, four distinctly identified
clean control worktrees, the reviewed tools, one bounded window no wider than the reviewed
runtime envelope, exactly one numbered attempt, one exact authorized action, and the denials
that say what it grants no authority to do.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from types import MappingProxyType
from typing import Any

from .constants import (
    ATTEMPT_ORDINAL,
    CONTAINER_PORT,
    CONTROL_REPOSITORIES,
    DOCKER_EXECUTABLE_PATH,
    EXTENSION_CYCLES,
    GRANT_KEYS,
    GRANT_NO_AUTHORITY,
    GRANT_SCHEMA,
    HOST_IP,
    HOST_PORT,
    IMAGE_REFERENCE,
    MAX_ATTEMPTS,
    PORT_PROTOCOL,
    PROBE_ARGV,
    PROBE_EXECUTABLE_PATH,
    PROBE_EXECUTABLE_SHA256,
    PUBLISH_SPEC,
    PULL_POLICY,
    RECORD_PATH,
    RUNTIME_LIMIT_SECONDS,
    SELECTED_IDENTITY_KEYS,
)

__all__ = ["GrantFacts", "GrantVerdict", "canonical_grant_bytes", "verify_bindings"]

# The one rendering a signer may ever sign: two-space indentation, the document's own key
# order, and exactly one trailing newline so a file and its bytes cannot disagree.
CANONICAL_INDENT = 2
CANONICAL_ENCODING = "utf-8"
CANONICAL_TERMINATOR = b"\n"
# The bound a canonical grant may not exceed, in bytes.
GRANT_BYTE_LIMIT = 65536

# The one exact action this grant may authorize. It is a single reviewed string rather than a
# family of spellings: an action nobody can enumerate is not an exact-action authorization.
AUTHORIZED_ACTION = "topology_rehearsal_single_attempt"

# The exact instant spelling both the window and the host observation must use. A local or
# offset-bearing spelling would let two readers place the same attempt in different windows.
INSTANT_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
# The widest interval a grant may authorize. It is derived from the reviewed runtime envelope
# rather than typed again: a window wider than the limit authorizes more wall-clock than
# section 7 reviewed, even though every instant inside it parses.
MAXIMUM_WINDOW = timedelta(seconds=RUNTIME_LIMIT_SECONDS)

# Digest and Git object shapes. A digest that is not the reviewed shape names no artifact, so
# it is refused where it stands rather than compared and reported as a mismatch.
HEX_DIGITS = frozenset("0123456789abcdef")
DIGEST_PREFIX = "sha256:"
DIGEST_HEX_LENGTH = 64
OBJECT_HEX_LENGTH = 40

# The reviewed publication, assembled from the reviewed parts rather than typed a second
# time. `internal_network` is compared by exact type as well as by value: `1` equals `True`
# in Python, so a merely truthy flag would otherwise read as isolation nobody observed.
REVIEWED_TOPOLOGY = MappingProxyType(
    {
        "host_ip": HOST_IP,
        "host_port": HOST_PORT,
        "container_port": CONTAINER_PORT,
        "protocol": PORT_PROTOCOL,
        "internal_network": True,
        "publish_spec": PUBLISH_SPEC,
    }
)
TOPOLOGY_KEYS = tuple(REVIEWED_TOPOLOGY)

# The reviewed image reference, split into the two parts a selected identity states
# separately. Splitting the one reviewed reference keeps the repository and the tag from
# drifting away from the reference the plan actually names.
REFERENCE_SEPARATOR = ":"
REVIEWED_IMAGE_PARTS = IMAGE_REFERENCE.partition(REFERENCE_SEPARATOR)
REVIEWED_REPOSITORY = REVIEWED_IMAGE_PARTS[0]
REVIEWED_TAG = REVIEWED_IMAGE_PARTS[-1]

# The two identities stay separate objects. A selected *registry* identity may never carry a
# host-only observation, and the host observation is the only place one may appear: a
# selection that claimed a local image id would be asserting a fact about one machine as a
# condition on the material an attempt may consume.
HOST_ONLY_KEYS = ("local_image_id", "observed_at")
SELECTION_ONLY_KEYS = ("pull_policy",)
OBSERVED_IDENTITY_KEYS = (
    *(key for key in SELECTED_IDENTITY_KEYS if key not in SELECTION_ONLY_KEYS),
    *HOST_ONLY_KEYS,
)
PLATFORM_KEYS = ("os", "architecture", "variant")
REGISTRY_DIGEST_KEYS = ("index_digest", "manifest_digest")
OBSERVED_BINDING_KEYS = tuple(
    key for key in OBSERVED_IDENTITY_KEYS if key != "observed_at"
)

RECORD_KEYS = ("path", "sha256")
RUNNER_KEYS = ("aggregate_sha256",)
CONTROL_IDENTITY_KEYS = ("commit", "tree", "clean")
TOOL_KEYS = ("docker", "probe")
DOCKER_TOOL_KEYS = ("path", "sha256", "version")
PROBE_TOOL_KEYS = ("path", "sha256", "argv")
WINDOW_KEYS = ("not_before", "expires_at", "runtime_limit_seconds", "extension_cycles")
ATTEMPT_KEYS = ("ordinal", "max_attempts")
NO_AUTHORITY_KEYS = tuple(GRANT_NO_AUTHORITY)


@dataclass(frozen=True)
class GrantFacts:
    """Everything the runner observed for itself before reading a grant against it.

    Not one field carries a default. A defaulted fact would let a control nobody observed
    read as a satisfied one, so an absent observation is a construction failure here rather
    than a quiet pass three bindings later.
    """

    record_path: str
    record_sha256: str
    runner_aggregate_sha256: str
    topology: Mapping[str, Any]
    selected_image_identity: Mapping[str, Any]
    observed_image_identity: Mapping[str, Any]
    repositories: Mapping[str, Any]
    tools: Mapping[str, Any]
    now: str

    def __post_init__(self) -> None:
        for name in ("record_path", "record_sha256", "runner_aggregate_sha256", "now"):
            value = getattr(self, name)
            if not isinstance(value, str):
                raise TypeError(f"{name} must be an observed string, not {value!r}")
            if not value:
                raise ValueError(f"{name} must be a non-empty observed string")
        for name in (
            "topology",
            "selected_image_identity",
            "observed_image_identity",
            "repositories",
            "tools",
        ):
            value = getattr(self, name)
            if not isinstance(value, Mapping):
                raise TypeError(f"{name} must be an observed mapping, not {value!r}")


@dataclass(frozen=True)
class GrantVerdict:
    """One answer about one grant: satisfied, or refused with the exact reasons.

    A verdict is the evidence a later phase reads, so incoherence is refused here rather
    than left for each reader to re-decide. A verdict that reported `satisfied` while
    carrying findings would let a refused grant be recorded as a bound one, and one that
    refused with no reason at all would not be evidence of anything.
    """

    satisfied: bool
    findings: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if type(self.satisfied) is not bool:
            raise ValueError(f"satisfied must be exactly a bool, not {self.satisfied!r}")
        if type(self.findings) is not tuple or any(
            not isinstance(finding, str) or not finding for finding in self.findings
        ):
            raise ValueError(
                f"findings must be a tuple of non-empty reasons: {self.findings!r}"
            )
        if self.satisfied and self.findings:
            raise ValueError("a satisfied verdict carries no finding")
        if not self.satisfied and not self.findings:
            raise ValueError(
                "an unsatisfied verdict must carry at least one reason: an unexplained "
                "refusal is not evidence"
            )


def canonical_grant_bytes(document: object) -> bytes:
    """The one exact byte rendering of one grant document, or a refusal.

    A document that cannot render exactly has no canonical bytes to sign, so an unrenderable
    value, a value that is not a document at all and a rendering past the reviewed bound are
    all refused here rather than handed on as bytes nobody could reproduce.

    Every refusal is one `ValueError`, including the one raised for a value that is not a
    document at all. A caller asking for canonical bytes is asking one question — are there
    exact bytes to sign here — and splitting the answer by *why* there are none would make
    the single refusal a caller has to handle depend on which way the value was wrong.
    """
    if not isinstance(document, Mapping):
        raise ValueError(  # noqa: TRY004 - one refusal: this value has no canonical bytes
            f"a grant document must be a mapping, not {document!r}"
        )
    pending: list[object] = [document]
    visited: set[int] = set()
    while pending:
        current = pending.pop()
        if isinstance(current, Mapping):
            identity = id(current)
            if identity in visited:
                continue
            visited.add(identity)
            for key, value in current.items():
                if type(key) is not str:
                    raise ValueError(
                        f"a grant document key must be exactly a string, not {key!r}"
                    )
                pending.append(value)
        elif isinstance(current, (list, tuple)):
            identity = id(current)
            if identity in visited:
                continue
            visited.add(identity)
            pending.extend(current)
    try:
        rendered = json.dumps(document, indent=CANONICAL_INDENT, allow_nan=False)
    except (RecursionError, TypeError, ValueError) as error:
        raise ValueError(f"a grant document must render exactly: {error}") from error
    canonical = rendered.encode(CANONICAL_ENCODING) + CANONICAL_TERMINATOR
    if len(canonical) > GRANT_BYTE_LIMIT:
        raise ValueError(
            f"a canonical grant may not exceed {GRANT_BYTE_LIMIT} bytes: "
            f"{len(canonical)} bytes were rendered"
        )
    return canonical


def instant(value: object) -> datetime | None:
    """One exact UTC instant, or `None` when nothing readable was stated."""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.strptime(value, INSTANT_FORMAT).replace(tzinfo=UTC)
    except ValueError:
        return None
    if parsed.strftime(INSTANT_FORMAT) != value:
        return None
    return parsed


def hex_string(value: object, length: int) -> bool:
    """Whether a value is exactly a lowercase hex string of the reviewed length."""
    return (
        isinstance(value, str)
        and len(value) == length
        and set(value) <= HEX_DIGITS
    )


def registry_digest(value: object) -> bool:
    """Whether a value is exactly a prefixed registry digest."""
    if not isinstance(value, str) or not value.startswith(DIGEST_PREFIX):
        return False
    return hex_string(value[len(DIGEST_PREFIX) :], DIGEST_HEX_LENGTH)


def platform_findings(value: object, label: str) -> tuple[str, ...]:
    """Require the exact platform inventory and typed values used by image identity."""
    if not isinstance(value, Mapping) or tuple(value) != PLATFORM_KEYS:
        return (
            f"{label}: platform {value!r} is not the reviewed ordered platform object",
        )
    findings: list[str] = []
    for key in ("os", "architecture"):
        if not isinstance(value[key], str) or not value[key]:
            findings.append(
                f"{label}: platform {key} {value[key]!r} is not a non-empty string"
            )
    variant = value["variant"]
    if variant is not None and (not isinstance(variant, str) or not variant):
        findings.append(
            f"{label}: platform variant {variant!r} is neither null nor a non-empty string"
        )
    return tuple(findings)


def keyed(
    value: object,
    expected: Sequence[str],
    label: str,
    *,
    ordered: bool = True,
) -> tuple[str, ...]:
    """Refuse anything but a mapping carrying exactly the reviewed ordered key inventory.

    The whole inventory is read rather than only the keys a later check happens to want. An
    absent key is a binding nobody stated, and an extra key is a claim nobody reviewed; both
    are the same failure of exactness and both are refused before any value is compared.
    """
    if not isinstance(value, Mapping):
        return (f"{label}: {value!r} is not an object carrying the reviewed keys",)
    inventory = tuple(value)
    matches = inventory == tuple(expected) if ordered else set(inventory) == set(expected)
    if matches:
        return ()
    drift = (
        f"{label}: keys {inventory} are not the reviewed ordered inventory "
        f"{tuple(expected)}"
    )
    return (drift,)


def exact(value: object, expected: object) -> bool:
    """Whether a value equals a reviewed one and is the same type as it.

    `bool` is a subclass of `int` in Python, so equality alone would let a flag stand in for
    a reviewed number and a number stand in for a reviewed flag.
    """
    return type(value) is type(expected) and value == expected


def bound(observed: object, section: Mapping[str, Any], label: str) -> tuple[str, ...]:
    """Refuse a section the runner did not observe for itself.

    A grant that bound its own claim rather than the runner's observation would authorize
    whatever it happened to say, which is the self-witnessing this binding removes.
    """
    if isinstance(observed, Mapping) and dict(section) == dict(observed):
        return ()
    drift = (
        f"{label}: the grant binds {dict(section)!r}, which is not what the runner "
        f"observed: {observed!r}"
    )
    return (drift,)


def record_findings(document: Mapping[str, Any], facts: GrantFacts) -> tuple[str, ...]:
    """The grant must name the reviewed record, at the digest the runner read."""
    section = document["record"]
    refusals = keyed(section, RECORD_KEYS, "record")
    if refusals:
        return refusals
    findings: list[str] = []
    path = section["path"]
    if path != RECORD_PATH:
        findings.append(f"record: {path!r} is not the reviewed record {RECORD_PATH!r}")
    if path != facts.record_path:
        findings.append(
            f"record: the grant binds {path!r}, not the record the runner read "
            f"{facts.record_path!r}"
        )
    digest = section["sha256"]
    if not hex_string(digest, DIGEST_HEX_LENGTH):
        findings.append(f"record: sha256 {digest!r} is not a digest")
    elif digest != facts.record_sha256:
        findings.append(
            f"record: the grant binds sha256 {digest!r}, not the bytes the runner read "
            f"{facts.record_sha256!r}"
        )
    return tuple(findings)


def runner_findings(document: Mapping[str, Any], facts: GrantFacts) -> tuple[str, ...]:
    """The grant must bind the exact runner source the attempt is about to execute."""
    section = document["runner"]
    refusals = keyed(section, RUNNER_KEYS, "runner")
    if refusals:
        return refusals
    digest = section["aggregate_sha256"]
    if not hex_string(digest, DIGEST_HEX_LENGTH):
        return (f"runner: aggregate_sha256 {digest!r} is not a digest",)
    if digest != facts.runner_aggregate_sha256:
        drift = (
            f"runner: the grant binds aggregate_sha256 {digest!r}, not the runner the "
            f"attempt computed {facts.runner_aggregate_sha256!r}"
        )
        return (drift,)
    return ()


def topology_findings(document: Mapping[str, Any], facts: GrantFacts) -> tuple[str, ...]:
    """The single reviewed loopback publication, field by exact field."""
    section = document["topology"]
    refusals = keyed(section, TOPOLOGY_KEYS, "topology")
    if refusals:
        return refusals
    findings = [
        f"topology: {key} is {section[key]!r}, not the reviewed {expected!r}"
        for key, expected in REVIEWED_TOPOLOGY.items()
        if not exact(section[key], expected)
    ]
    return (*findings, *bound(facts.topology, section, "topology"))


def selected_identity_findings(
    document: Mapping[str, Any], facts: GrantFacts
) -> tuple[str, ...]:
    """The required registry selection: fully pinned, and carrying no host observation."""
    section = document["selected_image_identity"]
    refusals = keyed(section, SELECTED_IDENTITY_KEYS, "selected_image_identity")
    if refusals:
        return refusals
    findings: list[str] = []
    # One primary failure, not one per field: an attempt that never pinned its material has
    # one thing wrong with it, and reporting it several times would bury it among its own
    # consequences.
    unpinned = tuple(key for key in SELECTED_IDENTITY_KEYS if section[key] is None)
    if unpinned:
        findings.append(
            f"selected_image_identity: unresolved — {list(unpinned)} pin no value, so the "
            "grant never says which material one attempt may consume"
        )
    for key, expected in (
        ("repository", REVIEWED_REPOSITORY),
        ("tag", REVIEWED_TAG),
        ("pull_policy", PULL_POLICY),
    ):
        if section[key] is not None and section[key] != expected:
            findings.append(
                f"selected_image_identity: {key} is {section[key]!r}, not the reviewed "
                f"{expected!r}"
            )
    findings.extend(
        f"selected_image_identity: {key} {section[key]!r} is not a registry digest"
        for key in REGISTRY_DIGEST_KEYS
        if section[key] is not None and not registry_digest(section[key])
    )
    if section["platform"] is not None:
        findings.extend(
            platform_findings(section["platform"], "selected_image_identity")
        )
    return (
        *findings,
        *bound(facts.selected_image_identity, section, "selected_image_identity"),
    )


def observed_identity_findings(
    document: Mapping[str, Any], facts: GrantFacts
) -> tuple[str, ...]:
    """Bind stable host identity while keeping the fresh runtime timestamp independent."""
    section = document["observed_image_identity"]
    observed = facts.observed_image_identity
    refusals = (
        *keyed(section, OBSERVED_IDENTITY_KEYS, "observed_image_identity"),
        *keyed(
            observed,
            OBSERVED_IDENTITY_KEYS,
            "observed_image_identity runtime observation",
            ordered=False,
        ),
    )
    if refusals:
        return refusals
    findings: list[str] = []
    selected = document["selected_image_identity"]
    for label, identity in (
        ("observed_image_identity", section),
        ("observed_image_identity runtime observation", observed),
    ):
        unread = tuple(key for key in OBSERVED_IDENTITY_KEYS if identity[key] is None)
        if unread:
            findings.append(
                f"{label}: unresolved — {list(unread)} were never read, so the host "
                "never said what it holds"
            )
        findings.extend(
            f"{label}: {key} {identity[key]!r} is not a registry digest"
            for key in REGISTRY_DIGEST_KEYS
            if identity[key] is not None and not registry_digest(identity[key])
        )
        if identity["platform"] is not None:
            findings.extend(platform_findings(identity["platform"], label))
        local = identity["local_image_id"]
        if local is not None and not registry_digest(local):
            findings.append(
                f"{label}: local_image_id {local!r} is not a sha256 image id"
            )
        compared_digests = (
            *(identity[key] for key in REGISTRY_DIGEST_KEYS),
            *(
                selected[key]
                for key in REGISTRY_DIGEST_KEYS
                if isinstance(selected, Mapping) and key in selected
            ),
        )
        if local is not None and local in compared_digests:
            findings.append(
                f"{label}: local_image_id equals a registry digest, but host and registry "
                "identity categories are distinct"
            )
        if identity["observed_at"] is not None and instant(identity["observed_at"]) is None:
            findings.append(
                f"{label}: observed_at {identity['observed_at']!r} is not an exact UTC "
                "instant"
            )
    signed_binding = {key: section[key] for key in OBSERVED_BINDING_KEYS}
    runtime_binding = {key: observed[key] for key in OBSERVED_BINDING_KEYS}
    if signed_binding != runtime_binding:
        findings.append(
            "observed_image_identity: the stable signed identity does not equal the fresh "
            f"runtime observation: signed={signed_binding!r}, observed={runtime_binding!r}"
        )
    registry_identity_keys = (
        "repository",
        "tag",
        "platform",
        "index_digest",
        "manifest_digest",
    )
    selected_binding = {key: selected[key] for key in registry_identity_keys}
    observed_binding = {key: section[key] for key in registry_identity_keys}
    if selected_binding != observed_binding:
        findings.append(
            "observed_image_identity: the observed registry identity does not equal the "
            f"selected identity: selected={selected_binding!r}, observed={observed_binding!r}"
        )
    return tuple(findings)


def repository_findings(
    document: Mapping[str, Any], facts: GrantFacts
) -> tuple[str, ...]:
    """Four control worktrees, each clean and each witnessed by its own distinct tree."""
    section = document["repositories"]
    refusals = keyed(section, CONTROL_REPOSITORIES, "repositories")
    if refusals:
        return refusals
    findings: list[str] = []
    trees: list[str] = []
    for name in CONTROL_REPOSITORIES:
        identity = section[name]
        inner = keyed(identity, CONTROL_IDENTITY_KEYS, f"repositories: {name}")
        if inner:
            findings.extend(inner)
            continue
        for key in ("commit", "tree"):
            if not hex_string(identity[key], OBJECT_HEX_LENGTH):
                findings.append(
                    f"repositories: {name} {key} {identity[key]!r} is not a Git object id"
                )
            elif key == "tree":
                trees.append(identity[key])
        if identity["clean"] is not True:
            findings.append(
                f"repositories: {name} reports clean {identity['clean']!r}, not exactly "
                "True, so a commit alone would witness content nobody reviewed"
            )
    if len(set(trees)) != len(trees):
        findings.append(
            f"repositories: {sorted(trees)} collapse onto a shared tree, so one tree id is "
            "being read as a witness for more than one worktree"
        )
    return (*findings, *bound(facts.repositories, section, "repositories"))


def tool_findings(document: Mapping[str, Any], facts: GrantFacts) -> tuple[str, ...]:
    """The two executables an attempt may reach, pinned by path and by digest."""
    section = document["tools"]
    refusals = keyed(section, TOOL_KEYS, "tools")
    if refusals:
        return refusals
    findings: list[str] = []
    docker = section["docker"]
    inner = keyed(docker, DOCKER_TOOL_KEYS, "tools: docker")
    findings.extend(inner)
    if not inner:
        if docker["path"] != DOCKER_EXECUTABLE_PATH:
            findings.append(
                f"tools: docker path {docker['path']!r} is not the reviewed "
                f"{DOCKER_EXECUTABLE_PATH!r}"
            )
        if not hex_string(docker["sha256"], DIGEST_HEX_LENGTH):
            findings.append(f"tools: docker sha256 {docker['sha256']!r} is not a digest")
        if not isinstance(docker["version"], str) or not docker["version"]:
            findings.append(
                f"tools: docker version {docker['version']!r} was never observed"
            )
    probe = section["probe"]
    inner = keyed(probe, PROBE_TOOL_KEYS, "tools: probe")
    findings.extend(inner)
    if not inner:
        if probe["path"] != PROBE_EXECUTABLE_PATH:
            findings.append(
                f"tools: probe path {probe['path']!r} is not the reviewed "
                f"{PROBE_EXECUTABLE_PATH!r}"
            )
        if probe["sha256"] != PROBE_EXECUTABLE_SHA256:
            findings.append(
                f"tools: probe sha256 {probe['sha256']!r} is not the reviewed "
                f"{PROBE_EXECUTABLE_SHA256!r}"
            )
        if not isinstance(probe["argv"], Sequence) or tuple(probe["argv"]) != PROBE_ARGV:
            findings.append(
                f"tools: probe argv {probe['argv']!r} is not the reviewed {list(PROBE_ARGV)!r}"
            )
    return (*findings, *bound(facts.tools, section, "tools"))


def window_findings(document: Mapping[str, Any], facts: GrantFacts) -> tuple[str, ...]:
    """One bounded interval, no wider than reviewed, holding the moment of the attempt.

    The interval is closed at `not_before` and open at `expires_at`: an attempt starting
    exactly at the opening instant is inside the window, and one starting exactly at the
    expiry is over. An unreadable bound or an unreadable moment is a refusal rather than a
    pass, because a window nobody can place an attempt in authorizes nothing.
    """
    section = document["window"]
    refusals = keyed(section, WINDOW_KEYS, "window")
    if refusals:
        return refusals
    findings: list[str] = []
    bounds: dict[str, datetime | None] = {}
    for key in ("not_before", "expires_at"):
        bounds[key] = instant(section[key])
        if bounds[key] is None:
            findings.append(
                f"window: {key} {section[key]!r} is not an exact UTC instant"
            )
    for key, expected in (
        ("runtime_limit_seconds", RUNTIME_LIMIT_SECONDS),
        ("extension_cycles", EXTENSION_CYCLES),
    ):
        if not exact(section[key], expected):
            findings.append(
                f"window: {key} is {section[key]!r}, not the reviewed {expected!r}"
            )
    opening, expiry = bounds["not_before"], bounds["expires_at"]
    if opening is None or expiry is None:
        return tuple(findings)
    if opening >= expiry:
        findings.append(
            f"window: expires_at {section['expires_at']!r} does not follow not_before "
            f"{section['not_before']!r}"
        )
        return tuple(findings)
    if expiry - opening > MAXIMUM_WINDOW:
        findings.append(
            f"window: {(expiry - opening).total_seconds()} seconds is wider than the "
            f"reviewed envelope of {RUNTIME_LIMIT_SECONDS} seconds"
        )
    now = instant(facts.now)
    if now is None:
        findings.append(
            f"window: the observed now {facts.now!r} is not an exact UTC instant, so no "
            "attempt can be placed inside the authorized window"
        )
    elif not opening <= now < expiry:
        findings.append(
            f"window: the observed now {facts.now!r} is outside the authorized window "
            f"[{section['not_before']!r}, {section['expires_at']!r})"
        )
    observations = (
        (
            "signed image observation",
            document["observed_image_identity"].get("observed_at")
            if isinstance(document["observed_image_identity"], Mapping)
            else None,
        ),
        (
            "runtime image observation",
            facts.observed_image_identity.get("observed_at"),
        ),
    )
    observation_times: dict[str, datetime | None] = {}
    for label, value in observations:
        observed_at = instant(value)
        observation_times[label] = observed_at
        if observed_at is None:
            findings.append(
                f"window: the {label} timestamp {value!r} is not an exact UTC instant"
            )
        elif not opening <= observed_at < expiry:
            findings.append(
                f"window: the {label} timestamp {value!r} is outside the authorized "
                f"window [{section['not_before']!r}, {section['expires_at']!r})"
            )
    signed_at = observation_times["signed image observation"]
    runtime_at = observation_times["runtime image observation"]
    if (
        signed_at is not None
        and runtime_at is not None
        and now is not None
        and not signed_at <= runtime_at <= now
    ):
        findings.append(
            "window: image observation chronology must be signed observation <= runtime "
            f"observation <= now, got {signed_at!s}, {runtime_at!s}, {now!s}"
        )
    return tuple(findings)


def attempt_findings(document: Mapping[str, Any]) -> tuple[str, ...]:
    """Exactly one numbered attempt out of exactly one."""
    section = document["attempt"]
    refusals = keyed(section, ATTEMPT_KEYS, "attempt")
    if refusals:
        return refusals
    return tuple(
        f"attempt: {key} is {section[key]!r}, not the one reviewed {expected!r}"
        for key, expected in (
            ("ordinal", ATTEMPT_ORDINAL),
            ("max_attempts", MAX_ATTEMPTS),
        )
        if not exact(section[key], expected)
    )


def authority_findings(document: Mapping[str, Any]) -> tuple[str, ...]:
    """The pinned schema, the one exact action, and the denials that bound it."""
    findings: list[str] = []
    if document["schema"] != GRANT_SCHEMA:
        findings.append(
            f"schema: {document['schema']!r} is not the pinned {GRANT_SCHEMA!r}"
        )
    if document["authorizes"] != AUTHORIZED_ACTION:
        findings.append(
            f"authorizes: {document['authorizes']!r} is not the one reviewed exact action "
            f"{AUTHORIZED_ACTION!r}"
        )
    section = document["grants_no_authority"]
    refusals = keyed(section, NO_AUTHORITY_KEYS, "grants_no_authority")
    if refusals:
        return (*findings, *refusals)
    findings.extend(
        f"grants_no_authority: {key} is {section[key]!r}, not exactly True, and a denial "
        "one caller can flip is not a denial"
        for key in NO_AUTHORITY_KEYS
        if section[key] is not True
    )
    return tuple(findings)


def verify_bindings(document: object, facts: object) -> GrantVerdict:
    """Reduce one grant and the runner's own observations to one immutable verdict.

    Both inputs are left exactly as they were given: reading a grant is a pure reduction, so
    nothing here edits, normalises or caches either of them. Every binding is mandatory, and
    a grant is bound only when every one of them holds.
    """
    if not isinstance(facts, GrantFacts):
        return GrantVerdict(
            satisfied=False,
            findings=(f"facts: {facts!r} is not an observed set of grant facts",),
        )
    if not isinstance(document, Mapping):
        return GrantVerdict(
            satisfied=False,
            findings=(f"grant: {document!r} is not a grant document",),
        )
    refusals = keyed(document, GRANT_KEYS, "grant")
    if refusals:
        return GrantVerdict(satisfied=False, findings=refusals)
    findings = (
        *authority_findings(document),
        *record_findings(document, facts),
        *runner_findings(document, facts),
        *topology_findings(document, facts),
        *selected_identity_findings(document, facts),
        *observed_identity_findings(document, facts),
        *repository_findings(document, facts),
        *tool_findings(document, facts),
        *window_findings(document, facts),
        *attempt_findings(document),
    )
    if findings:
        return GrantVerdict(satisfied=False, findings=findings)
    return GrantVerdict(satisfied=True)
