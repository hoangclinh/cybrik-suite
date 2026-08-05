"""The read-only pre-consumption phase: prove every fact, or refuse before any effect.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

This phase is diagnosis section 7 items 1-3 and nothing else. It takes exactly eight
read-only observations through injected ports, compares each against the authorization the
runner was handed, and answers with one immutable `PreparationResult` or one `PrecheckAbort`.
It creates nothing, starts nothing, consumes no attempt, writes no credential material, pulls
or installs no image and runs no probe: every mutating seam of the injected surface stays
untouched, so a refusal here costs the one bounded attempt nothing.

It does not consult the SSHSIG verifier either. Whether the Founder signed these bytes is a
separate answer taken by a separate phase, and a preparation module that could reach the
verifier would be positioned to satisfy the control it exists to precede.

Every projection arrives through a port whose only failure value is `None`, so nothing here
trusts a shape. A mapping that is not a mapping, a sequence that is a string, a `bool` handed
back where an `int` was reviewed and a key inventory nobody stated are each read as an
unresolved observation and refused — never walked into an exception out of a seam that has no
exception in its contract. `None` is never a default and never a pass.

A satisfied result carries the whole snapshot the later admission and runner phases read, and
every nested mapping and sequence in it is deep-frozen. A later phase therefore never has to
re-observe a fact, and never has to trust that a caller's mutable mapping still says what it
said when it was proved here.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

from .constants import (
    CONTROL_REPOSITORIES,
    DOCKER_EXECUTABLE_PATH,
    HOST_PORT,
    IMAGE_REFERENCE,
    PROBE_ARGV,
    PROBE_EXECUTABLE_PATH,
    PROBE_EXECUTABLE_SHA256,
    PULL_POLICY,
    SELECTED_IDENTITY_KEYS,
)
from .errors import PrecheckAbort
from .grant import (
    CONTROL_IDENTITY_KEYS,
    DIGEST_HEX_LENGTH,
    DOCKER_TOOL_KEYS,
    OBJECT_HEX_LENGTH,
    OBSERVED_BINDING_KEYS,
    OBSERVED_IDENTITY_KEYS,
    PROBE_TOOL_KEYS,
    REGISTRY_DIGEST_KEYS,
    REGISTRY_IDENTITY_KEYS,
    REVIEWED_REPOSITORY,
    REVIEWED_TAG,
    TOOL_KEYS,
    hex_string,
    instant,
    keyed,
    platform_findings,
    registry_digest,
)
from .protocols import (
    ControlIdentitySource,
    DockerPort,
    HostObservationSource,
    ProbePort,
)

__all__ = ["PreparationResult", "prepare"]

# The four ports this phase may reach. The credential, ledger, verifier and clock seams are
# deliberately absent: a phase that cannot name them cannot consume an attempt, write a secret
# or decide who signed a grant.
ADAPTER_PORTS = (
    ("identities", ControlIdentitySource),
    ("host", HostObservationSource),
    ("docker", DockerPort),
    ("probe", ProbePort),
)

# The grant sections this phase reads. It reads no window, attempt or authority section: those
# bind the authorization rather than the host, and belong to the phases that check them.
GRANT_SECTIONS = (
    "selected_image_identity",
    "observed_image_identity",
    "repositories",
    "tools",
)

# A host image observation is the observed identity plus the one thing only a host can say:
# whether the reviewed material is already there. Nothing here may fetch it if it is not.
PRESENT_KEY = "present"
HOST_IMAGE_KEYS = (PRESENT_KEY, *OBSERVED_IDENTITY_KEYS)
PLATFORM_KEY = "platform"
POLICY_KEY = "pull_policy"
LOCAL_IMAGE_KEY = "local_image_id"
OBSERVED_AT_KEY = "observed_at"

# The Docker daemon's own engine version, which must equal the version the grant pinned.
ENGINE_VERSION_KEY = "engine_version"
TOOL_PATH_KEY = "path"
TOOL_DIGEST_KEY = "sha256"
TOOL_VERSION_KEY = "version"
TOOL_ARGV_KEY = "argv"

# Exactly two bounds, each a real port. A range that is not two increasing valid ports cannot
# say whether the reviewed port is safe from the kernel's own ephemeral allocation.
EPHEMERAL_RANGE_BOUNDS = 2
MINIMUM_PORT = 1
MAXIMUM_PORT = 65535

# The result fields whose deep immutability is enforced at construction rather than trusted.
FROZEN_MAPPING_FIELDS = (
    "control_identities",
    "docker_executable",
    "docker_platform",
    "image",
    "probe_executable",
    "selected_image_identity",
)
FROZEN_SEQUENCE_FIELDS = (
    "docker_publications",
    "ephemeral_range",
    "pre_consumption_listeners",
)

REFUSAL_PREFIX = "preparation refused before consumption"


def frozen(value: object) -> Any:
    """One deeply read-only copy of an observation, leaving the original untouched.

    A snapshot a later phase can edit is not a snapshot: it is a shared reference that
    happens to be correct at the moment it is read. Strings and bytes are already immutable
    and are returned as they stand rather than exploded into per-character tuples.
    """
    if isinstance(value, Mapping):
        return MappingProxyType({key: frozen(item) for key, item in value.items()})
    if isinstance(value, (str, bytes, bytearray)) or not isinstance(value, Sequence):
        return value
    return tuple(frozen(item) for item in value)


@dataclass(frozen=True)
class Observations:
    """The eight read-only readings, exactly as the injected ports returned them."""

    controls: Any
    image: Any
    ephemeral_range: Any
    listeners: Any
    platform: Any
    docker_digest: Any
    publications: Any
    probe_digest: Any


@dataclass(frozen=True)
class PreparationResult:
    """One satisfied pre-consumption phase and the complete snapshot it proved.

    No field carries a default. A defaulted snapshot would let a fact nobody observed be read
    later as a fact somebody did, which is the failure this phase exists to prevent. The
    coherence is enforced here rather than trusted to each reader: a result reporting
    `satisfied` while holding a listener on the reviewed port, an incomplete control inventory
    or an editable nested mapping would be evidence of something that never happened.
    """

    satisfied: bool
    control_identities: Mapping[str, Any]
    image: Mapping[str, Any]
    selected_image_identity: Mapping[str, Any]
    docker_platform: Mapping[str, Any]
    docker_executable: Mapping[str, Any]
    probe_executable: Mapping[str, Any]
    ephemeral_range: tuple[int, ...]
    pre_consumption_listeners: tuple[Any, ...]
    docker_publications: tuple[str, ...]

    def __post_init__(self) -> None:
        if self.satisfied is not True:
            raise ValueError(
                f"satisfied must be exactly True, not {self.satisfied!r}: an unsatisfied "
                "preparation is a refusal, not a result"
            )
        for name in FROZEN_MAPPING_FIELDS:
            value = getattr(self, name)
            if type(value) is not MappingProxyType:
                raise ValueError(
                    f"{name} must be a read-only mapping, not {type(value).__name__}"
                )
        for name in FROZEN_SEQUENCE_FIELDS:
            value = getattr(self, name)
            if type(value) is not tuple:
                raise ValueError(
                    f"{name} must be an immutable tuple, not {type(value).__name__}"
                )
        if set(self.control_identities) != set(CONTROL_REPOSITORIES):
            raise ValueError(
                f"control_identities {sorted(self.control_identities)} are not the four "
                f"reviewed control repositories {sorted(CONTROL_REPOSITORIES)}"
            )
        if len(self.ephemeral_range) != EPHEMERAL_RANGE_BOUNDS or any(
            type(bound) is not int for bound in self.ephemeral_range
        ):
            raise ValueError(
                f"ephemeral_range {self.ephemeral_range!r} is not two observed ports"
            )
        if self.pre_consumption_listeners or self.docker_publications:
            raise ValueError(
                "a satisfied preparation observed no listener and no publication on the "
                "reviewed port, so neither may be recorded as one"
            )


def refusal(findings: Sequence[str]) -> PrecheckAbort:
    """One typed abort carrying every exact reason, never a bare classified stop."""
    return PrecheckAbort(f"{REFUSAL_PREFIX}: " + "; ".join(findings))


def adapter_findings(adapters: object) -> tuple[str, ...]:
    """Refuse an injected surface that cannot answer one of the four reviewed ports."""
    return tuple(
        f"adapters: {name} {getattr(adapters, name, None)!r} does not implement "
        f"{port.__name__}"
        for name, port in ADAPTER_PORTS
        if not isinstance(getattr(adapters, name, None), port)
    )


def expected_control_findings(expected: object) -> tuple[str, ...]:
    """The authorization must name a commit for each of the four control repositories."""
    if not isinstance(expected, Mapping):
        label = f"authorization: expected_controls {expected!r} is not an inventory"
        return (label,)
    refusals = keyed(
        expected, CONTROL_REPOSITORIES, "authorization expected_controls", ordered=False
    )
    if refusals:
        return refusals
    return tuple(
        f"authorization expected_controls: {name} commit {expected[name]!r} is not a "
        "Git object id"
        for name in CONTROL_REPOSITORIES
        if not hex_string(expected[name], OBJECT_HEX_LENGTH)
    )


def identity_findings(
    section: Mapping[str, Any], keys: Sequence[str], label: str
) -> tuple[str, ...]:
    """One fully resolved image identity: exact inventory, real digests, exact platform.

    The key inventory is the whole check rather than a lookup of the fields a later
    comparison happens to want. A selected registry identity that carried a host-only
    observation would be asserting a fact about one machine as a condition on the material
    an attempt may consume, and an inventory check is what refuses it.
    """
    refusals = keyed(section, keys, label)
    if refusals:
        return refusals
    findings: list[str] = []
    unread = tuple(key for key in keys if section[key] is None)
    if unread:
        findings.append(f"{label}: unresolved — {list(unread)} pin no value")
    findings.extend(
        f"{label}: {key} is {section[key]!r}, not the reviewed {expected!r}"
        for key, expected in (
            ("repository", REVIEWED_REPOSITORY),
            ("tag", REVIEWED_TAG),
        )
        if section[key] != expected
    )
    findings.extend(
        f"{label}: {key} {section[key]!r} is not a registry digest"
        for key in REGISTRY_DIGEST_KEYS
        if not registry_digest(section[key])
    )
    if section[PLATFORM_KEY] is not None:
        findings.extend(platform_findings(section[PLATFORM_KEY], label))
    if POLICY_KEY in keys and section[POLICY_KEY] != PULL_POLICY:
        findings.append(
            f"{label}: {POLICY_KEY} is {section[POLICY_KEY]!r}, not the reviewed "
            f"{PULL_POLICY!r}"
        )
    if LOCAL_IMAGE_KEY in keys and not registry_digest(section[LOCAL_IMAGE_KEY]):
        findings.append(
            f"{label}: {LOCAL_IMAGE_KEY} {section[LOCAL_IMAGE_KEY]!r} is not an image id"
        )
    if OBSERVED_AT_KEY in keys and instant(section[OBSERVED_AT_KEY]) is None:
        findings.append(
            f"{label}: {OBSERVED_AT_KEY} {section[OBSERVED_AT_KEY]!r} is not a UTC instant"
        )
    return tuple(findings)


def pinned_repository_findings(section: Mapping[str, Any]) -> tuple[str, ...]:
    """Four pinned control worktrees, each a commit, a tree and an exact clean flag."""
    refusals = keyed(section, CONTROL_REPOSITORIES, "grant repositories")
    if refusals:
        return refusals
    findings: list[str] = []
    for name in CONTROL_REPOSITORIES:
        identity = section[name]
        inner = keyed(identity, CONTROL_IDENTITY_KEYS, f"grant repositories: {name}")
        if inner:
            findings.extend(inner)
            continue
        findings.extend(
            f"grant repositories: {name} {key} {identity[key]!r} is not a Git object id"
            for key in ("commit", "tree")
            if not hex_string(identity[key], OBJECT_HEX_LENGTH)
        )
        if identity["clean"] is not True:
            findings.append(
                f"grant repositories: {name} pins clean {identity['clean']!r}, not True"
            )
    return tuple(findings)


def tool_findings(section: Mapping[str, Any]) -> tuple[str, ...]:
    """The two executables the attempt may reach, pinned by path, digest and argv."""
    refusals = keyed(section, TOOL_KEYS, "grant tools")
    if refusals:
        return refusals
    findings: list[str] = []
    docker = section["docker"]
    inner = keyed(docker, DOCKER_TOOL_KEYS, "grant tools: docker")
    findings.extend(inner)
    if not inner:
        if docker[TOOL_PATH_KEY] != DOCKER_EXECUTABLE_PATH:
            findings.append(
                f"grant tools: docker path {docker[TOOL_PATH_KEY]!r} is not the reviewed "
                f"{DOCKER_EXECUTABLE_PATH!r}"
            )
        if not hex_string(docker[TOOL_DIGEST_KEY], DIGEST_HEX_LENGTH):
            findings.append(
                f"grant tools: docker sha256 {docker[TOOL_DIGEST_KEY]!r} is not a digest"
            )
        version = docker[TOOL_VERSION_KEY]
        if not isinstance(version, str) or not version:
            findings.append(f"grant tools: docker version {version!r} was never observed")
    probe = section["probe"]
    inner = keyed(probe, PROBE_TOOL_KEYS, "grant tools: probe")
    findings.extend(inner)
    if not inner:
        if probe[TOOL_PATH_KEY] != PROBE_EXECUTABLE_PATH:
            findings.append(
                f"grant tools: probe path {probe[TOOL_PATH_KEY]!r} is not the reviewed "
                f"{PROBE_EXECUTABLE_PATH!r}"
            )
        if probe[TOOL_DIGEST_KEY] != PROBE_EXECUTABLE_SHA256:
            findings.append(
                f"grant tools: probe sha256 {probe[TOOL_DIGEST_KEY]!r} is not the "
                f"reviewed {PROBE_EXECUTABLE_SHA256!r}"
            )
        argv = probe[TOOL_ARGV_KEY]
        if isinstance(argv, (str, bytes, bytearray)) or not isinstance(argv, Sequence):
            findings.append(f"grant tools: probe argv {argv!r} is not an argv sequence")
        elif tuple(argv) != PROBE_ARGV:
            findings.append(
                f"grant tools: probe argv {list(argv)!r} is not the reviewed "
                f"{list(PROBE_ARGV)!r}"
            )
    return tuple(findings)


def grant_findings(document: object) -> tuple[str, ...]:
    """Read the four grant sections this phase compares the host against."""
    if not isinstance(document, Mapping):
        return (f"grant: {document!r} is not a grant document",)
    unreadable = tuple(
        f"grant: {name} {document.get(name)!r} is not a reviewed object"
        for name in GRANT_SECTIONS
        if not isinstance(document.get(name), Mapping)
    )
    if unreadable:
        return unreadable
    return (
        *identity_findings(
            document["selected_image_identity"],
            SELECTED_IDENTITY_KEYS,
            "grant selected_image_identity",
        ),
        *identity_findings(
            document["observed_image_identity"],
            OBSERVED_IDENTITY_KEYS,
            "grant observed_image_identity",
        ),
        *pinned_repository_findings(document["repositories"]),
        *tool_findings(document["tools"]),
    )


def observe(adapters: Any) -> Observations:
    """Take each reviewed read-only observation exactly once, and nothing else.

    Every call here reads. None of them creates, starts, removes, consumes an attempt,
    writes credential material, probes a port or reads a clock.
    """
    return Observations(
        controls=adapters.identities.observe_controls(),
        image=adapters.host.observe_image(reference=IMAGE_REFERENCE),
        ephemeral_range=adapters.host.observe_ephemeral_range(),
        listeners=adapters.host.observe_listeners(port=HOST_PORT),
        platform=adapters.docker.observe_platform(),
        docker_digest=adapters.docker.observe_executable_digest(
            path=DOCKER_EXECUTABLE_PATH
        ),
        publications=adapters.docker.observe_publications(port=HOST_PORT),
        probe_digest=adapters.probe.observe_digest(path=PROBE_EXECUTABLE_PATH),
    )


def control_findings(
    observed: object, expected: Mapping[str, Any], pinned: Mapping[str, Any]
) -> tuple[str, ...]:
    """Exactly the four reviewed worktrees, each on its pinned commit, tree and clean flag.

    The commit is checked against both the authorization and the grant, and the tree against
    the grant, because a commit alone cannot distinguish two worktrees that share it and
    differ in content. An unresolved cleanliness reading is not a clean worktree.
    """
    if not isinstance(observed, Mapping):
        return (f"control_identities: unresolved — {observed!r} is not an inventory",)
    findings: list[str] = []
    unexpected = tuple(sorted(set(observed) - set(CONTROL_REPOSITORIES)))
    if unexpected:
        findings.append(
            f"control_identities: {list(unexpected)} are not control repositories"
        )
    for name in CONTROL_REPOSITORIES:
        if name not in observed:
            findings.append(f"control_identities: {name} was never observed")
            continue
        inner = keyed(
            observed[name],
            CONTROL_IDENTITY_KEYS,
            f"control_identities: {name}",
            ordered=False,
        )
        if inner:
            findings.extend(inner)
            continue
        findings.extend(control_identity_findings(observed[name], expected, pinned, name))
    return tuple(findings)


def control_identity_findings(
    identity: Mapping[str, Any],
    expected: Mapping[str, Any],
    pinned: Mapping[str, Any],
    name: str,
) -> tuple[str, ...]:
    """One control worktree's observed commit, tree and cleanliness, each exact."""
    findings: list[str] = []
    commit = identity["commit"]
    if not hex_string(commit, OBJECT_HEX_LENGTH):
        findings.append(
            f"control_identities: {name} commit {commit!r} is not a Git object id"
        )
    else:
        findings.extend(
            f"control_identities: {name} is on commit {commit!r}, not the {source} {pin!r}"
            for source, pin in (
                ("authorized", expected[name]),
                ("granted", pinned[name]["commit"]),
            )
            if commit != pin
        )
    tree = identity["tree"]
    if not hex_string(tree, OBJECT_HEX_LENGTH):
        findings.append(f"control_identities: {name} tree {tree!r} is not a Git object id")
    elif tree != pinned[name]["tree"]:
        findings.append(
            f"control_identities: {name} holds tree {tree!r}, which drifts from the "
            f"granted {pinned[name]['tree']!r}"
        )
    if identity["clean"] is not True:
        findings.append(
            f"control_identities: {name} reports clean {identity['clean']!r}, not True"
        )
    return tuple(findings)


def image_findings(
    image: object, pinned: Mapping[str, Any], selected: Mapping[str, Any]
) -> tuple[str, ...]:
    """The host must already hold exactly the selected material, and say so field by field.

    The observation is compared against both identities the grant carries: the host identity
    it pins and the registry selection it authorizes. Nothing here fetches or installs an
    absent image — material that is not present is a refusal, not a task.

    The binding covers the stable identity and deliberately leaves `observed_at` out of it.
    The grant states when its author looked; this phase states when the runner looked, and
    those two instants are never the same reading. Binding them would make a satisfied result
    unreachable on any host whose observation was taken after the grant was signed. The
    timestamp is still refused unless it is an exact UTC instant, so dropping it from the
    comparison hands nothing back to an unresolved reading.
    """
    if not isinstance(image, Mapping):
        return (f"image: unresolved — {image!r} is not a host image observation",)
    refusals = keyed(image, HOST_IMAGE_KEYS, "image", ordered=False)
    if refusals:
        return refusals
    findings: list[str] = []
    if image[PRESENT_KEY] is not True:
        findings.append(
            f"image: present is {image[PRESENT_KEY]!r}, not exactly True, so the reviewed "
            "material is not already on this host"
        )
    unread = tuple(key for key in OBSERVED_IDENTITY_KEYS if image[key] is None)
    if unread:
        findings.append(
            f"image: unresolved — {list(unread)} were never read, so the host never said "
            "what it holds"
        )
    if image[OBSERVED_AT_KEY] is not None and instant(image[OBSERVED_AT_KEY]) is None:
        findings.append(
            f"image: {OBSERVED_AT_KEY} {image[OBSERVED_AT_KEY]!r} is not a UTC instant"
        )
    findings.extend(
        f"image: {key} {image[key]!r} is not the granted host identity {pinned[key]!r}"
        for key in OBSERVED_BINDING_KEYS
        if image[key] != pinned[key]
    )
    findings.extend(
        f"image: {key} {image[key]!r} is not the selected registry identity "
        f"{selected[key]!r}"
        for key in REGISTRY_IDENTITY_KEYS
        if image[key] != selected[key]
    )
    return tuple(findings)


def ephemeral_findings(observed: object) -> tuple[str, ...]:
    """Two exact valid increasing ports that do not cover the reviewed host port.

    A reviewed port inside the host's own ephemeral range is a port the kernel may hand to
    something else first, so the attempt would be competing for its own publication.
    """
    if isinstance(observed, (str, bytes, bytearray)) or not isinstance(
        observed, Sequence
    ):
        return (f"ephemeral_range: unresolved — {observed!r} is not a port range",)
    if len(observed) != EPHEMERAL_RANGE_BOUNDS:
        return (f"ephemeral_range: {list(observed)!r} is not exactly two bounds",)
    low, high = observed
    invalid = tuple(
        bound
        for bound in (low, high)
        if type(bound) is not int or not MINIMUM_PORT <= bound <= MAXIMUM_PORT
    )
    if invalid:
        return (f"ephemeral_range: {list(invalid)!r} are not valid ports",)
    if low >= high:
        return (f"ephemeral_range: {(low, high)!r} does not increase",)
    if low <= HOST_PORT <= high:
        return (
            (
                f"ephemeral_range: the reviewed host port {HOST_PORT} lies inside the "
                f"observed ephemeral range {(low, high)!r}"
            ),
        )
    return ()


def emptiness_findings(observed: object, label: str) -> tuple[str, ...]:
    """The reviewed port must be held by nothing at all before the attempt begins."""
    if isinstance(observed, (str, bytes, bytearray)) or not isinstance(
        observed, Sequence
    ):
        return (f"{label}: unresolved — {observed!r} is not an observed sequence",)
    if observed:
        return (f"{label}: {list(observed)!r} already hold port {HOST_PORT}",)
    return ()


def platform_evidence_findings(observed: object, version: object) -> tuple[str, ...]:
    """One readable platform evidence object whose engine is the pinned Docker version."""
    if not isinstance(observed, Mapping) or not observed:
        return (f"docker_platform: unresolved — {observed!r} is not platform evidence",)
    untyped = tuple(sorted(repr(key) for key in observed if type(key) is not str))
    if untyped:
        return (f"docker_platform: keys {list(untyped)!r} are not exactly strings",)
    engine = observed.get(ENGINE_VERSION_KEY)
    if not isinstance(engine, str) or not engine:
        return (f"docker_platform: {ENGINE_VERSION_KEY} {engine!r} was never observed",)
    if engine != version:
        return (
            (
                f"docker_platform: {ENGINE_VERSION_KEY} {engine!r} is not the granted "
                f"Docker version {version!r}"
            ),
        )
    return ()


def digest_findings(observed: object, pinned: object, label: str) -> tuple[str, ...]:
    """One observed executable digest, exactly equal to the digest the grant pins."""
    if not hex_string(observed, DIGEST_HEX_LENGTH):
        return (f"{label}: unresolved — {observed!r} is not a sha256 digest",)
    if observed != pinned:
        return (f"{label}: observed {observed!r}, not the granted {pinned!r}",)
    return ()


def observation_findings(
    observed: Observations, expected: Mapping[str, Any], document: Mapping[str, Any]
) -> tuple[str, ...]:
    """Every way the observed host can fail to be the host the authorization describes."""
    tools = document["tools"]
    return (
        *control_findings(observed.controls, expected, document["repositories"]),
        *image_findings(
            observed.image,
            document["observed_image_identity"],
            document["selected_image_identity"],
        ),
        *ephemeral_findings(observed.ephemeral_range),
        *emptiness_findings(observed.listeners, "pre_consumption_listeners"),
        *emptiness_findings(observed.publications, "docker_publications"),
        *platform_evidence_findings(observed.platform, tools["docker"][TOOL_VERSION_KEY]),
        *digest_findings(
            observed.docker_digest,
            tools["docker"][TOOL_DIGEST_KEY],
            "docker_executable_digest",
        ),
        *digest_findings(
            observed.probe_digest,
            tools["probe"][TOOL_DIGEST_KEY],
            "probe_executable_digest",
        ),
    )


def snapshot(observed: Observations, document: Mapping[str, Any]) -> PreparationResult:
    """The deep-frozen record of everything this phase proved, and nothing it assumed."""
    return PreparationResult(
        satisfied=True,
        control_identities=frozen(observed.controls),
        image=frozen(observed.image),
        selected_image_identity=frozen(document["selected_image_identity"]),
        docker_platform=frozen(observed.platform),
        docker_executable=frozen(
            {
                TOOL_PATH_KEY: DOCKER_EXECUTABLE_PATH,
                TOOL_DIGEST_KEY: observed.docker_digest,
                TOOL_VERSION_KEY: observed.platform[ENGINE_VERSION_KEY],
            }
        ),
        probe_executable=frozen(
            {
                TOOL_PATH_KEY: PROBE_EXECUTABLE_PATH,
                TOOL_DIGEST_KEY: observed.probe_digest,
                TOOL_ARGV_KEY: PROBE_ARGV,
            }
        ),
        ephemeral_range=tuple(observed.ephemeral_range),
        pre_consumption_listeners=tuple(frozen(entry) for entry in observed.listeners),
        docker_publications=tuple(observed.publications),
    )


def prepare(authorization: object, adapters: object) -> PreparationResult:
    """Prove every pre-consumption fact, or abort before anything is consumed.

    The authorization is read first and entirely: a grant nobody can read pins nothing to
    compare a host against, so an unreadable one is refused without taking an observation at
    all. Once it is readable the eight reviewed observations are taken exactly once each,
    every finding is gathered so a reader is told everything that is wrong rather than only
    the first thing, and the phase either refuses with those exact reasons or returns the
    frozen snapshot.

    Neither input is edited, normalised or cached. The snapshot is a deep copy frozen on the
    way out, so a caller that later mutates its own mapping cannot change what was proved.
    """
    refusals = (
        *adapter_findings(adapters),
        *expected_control_findings(getattr(authorization, "expected_controls", None)),
        *grant_findings(getattr(authorization, "grant", None)),
    )
    if refusals:
        raise refusal(refusals)
    document: Mapping[str, Any] = authorization.grant  # type: ignore[attr-defined]
    expected: Mapping[str, Any] = authorization.expected_controls  # type: ignore[attr-defined]
    observed = observe(adapters)
    findings = observation_findings(observed, expected, document)
    if findings:
        raise refusal(findings)
    return snapshot(observed, document)
