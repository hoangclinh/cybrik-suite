"""Read-only pre-consumption proof, or typed refusal before any effect.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Exactly eight injected observations are checked without verifier, ledger, credential, clock,
probe, image pull or mutation access. Unknown shapes and `None` fail closed. A satisfied
result is a recursively immutable snapshot for later phases, never a live input alias.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

from .constants import (
    CONTROL_REPOSITORIES,
    DOCKER_EXECUTABLE_PATH,
    HOST_PORT,
    IMAGE_REFERENCE,
    PLATFORM_EVIDENCE_KEYS,
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
from .observe import (
    HOST_IMAGE_KEYS,
    IMMUTABLE_LEAVES,
    PRESENT_KEY,
    immutability_findings,
    local_presence_findings,
    signed_identity_findings,
    stored_entries,
)
from .protocols import (
    ControlIdentitySource,
    DockerPort,
    HostObservationSource,
    ProbePort,
)

__all__ = ["PreparationResult", "prepare"]

# The only four ports this read-only phase may reach.
ADAPTER_PORTS = (
    ("identities", ControlIdentitySource),
    ("host", HostObservationSource),
    ("docker", DockerPort),
    ("probe", ProbePort),
)

# The only four sections this phase compares the observed host against. Every other
# authorization semantic — the window, the attempt, the topology — belongs to admission, and
# nothing here validates any of them. Ingress is deliberately wider than this list:
# `projected` dead-copies the whole grant, so an uncopyable value in a section preparation
# never reads, such as `topology`, still refuses before any observation rather than reaching
# later phases as mutable authorization bytes or state the caller or an adapter can edit.
GRANT_SECTIONS = (
    "selected_image_identity",
    "observed_image_identity",
    "repositories",
    "tools",
)

# The observed identity plus whether the reviewed image is already local is `HOST_IMAGE_KEYS`,
# imported above and never re-typed here. It is declared in `observe` because the signed
# identity reduction there judges the same reading, and this module imports from `observe`, so
# only that direction is available to both readers without closing an import cycle.
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

# Exactly two valid increasing bounds.
EPHEMERAL_RANGE_BOUNDS = 2
MINIMUM_PORT = 1
MAXIMUM_PORT = 65535

# Fields whose recursive immutability is enforced at construction.
FROZEN_MAPPING_FIELDS = (
    "control_identities",
    "docker_executable",
    "docker_platform",
    "granted_image_identity",
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


def frozen(value: object, seen: tuple[int, ...] = ()) -> Any:
    """Return a recursively immutable dead copy; reject cycles and unknown types."""
    if type(value) in IMMUTABLE_LEAVES:
        return value
    if isinstance(value, IMMUTABLE_LEAVES):
        # A safe leaf is an exact type, never a subclass of one. `str` and `bytes` are also
        # `Sequence`s, so a subclass reaching the generic container handling below would be
        # taken apart into a tuple of its own characters or bytes rather than refused, and
        # the caller would keep a live handle on whatever mutable state it carries.
        raise ValueError(  # noqa: TRY004 -- every unprovable value refuses the one same way
            f"a {type(value).__name__} subclasses a safe scalar but may carry mutable state "
            "of its own, so it is not one of the leaves this phase can prove"
        )
    if id(value) in seen:
        raise ValueError(
            f"a {type(value).__name__} refers to itself, so no dead copy of it exists"
        )
    trail = (*seen, id(value))
    if isinstance(value, bytearray):
        return bytes(value)
    if isinstance(value, Mapping):
        return MappingProxyType(
            {frozen(key, trail): frozen(item, trail) for key, item in value.items()}
        )
    if isinstance(value, AbstractSet):
        return frozenset(frozen(item, trail) for item in value)
    if isinstance(value, Sequence):
        return tuple(frozen(item, trail) for item in value)
    raise ValueError(
        f"a {type(value).__name__} cannot be proved deeply immutable, so it may not be "
        "recorded as something this phase proved"
    )


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
    """A coherent satisfied result containing the complete immutable snapshot."""

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
    # The signed host observation this result is pinned from, and the instant taken out of it:
    # never a fact — `image[observed_at]` stays the live reading — but the one instant this
    # phase and a pre-host plan can both name. The identity travels with the pin so agreement
    # is provable *here*, in every copy of a result, rather than only in `snapshot()`'s wiring,
    # which no copy goes through and which a forged pin therefore never has to satisfy.
    granted_image_identity: Mapping[str, Any]
    granted_observed_at: str

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
                    f"{name} must be a read-only mapping, not {type(value).__name__}")
        for name in FROZEN_SEQUENCE_FIELDS:
            value = getattr(self, name)
            if type(value) is not tuple:
                raise ValueError(
                    f"{name} must be an immutable tuple, not {type(value).__name__}")
        for name in (*FROZEN_MAPPING_FIELDS, *FROZEN_SEQUENCE_FIELDS):
            nested = immutability_findings(getattr(self, name), name)
            if nested:
                raise ValueError(f"{name} is not a deep proof: " + "; ".join(nested))
        # Sort representations so mixed key types remain a bounded refusal.
        if set(self.control_identities) != set(CONTROL_REPOSITORIES):
            raise ValueError(
                f"control_identities {sorted(repr(key) for key in self.control_identities)}"
                f" are not the four reviewed control repositories "
                f"{sorted(CONTROL_REPOSITORIES)}")
        if len(self.ephemeral_range) != EPHEMERAL_RANGE_BOUNDS or any(
            type(bound) is not int for bound in self.ephemeral_range
        ):
            raise ValueError(
                f"ephemeral_range {self.ephemeral_range!r} is not two observed ports")
        if self.pre_consumption_listeners or self.docker_publications:
            raise ValueError(
                "a satisfied preparation observed no listener and no publication on the "
                "reviewed port, so neither may be recorded as one")
        # Both instants below are read from what the mapping *stores*, by `stored_entries`,
        # never through `Mapping.get`: that accessor is a third protocol nothing here
        # reconciles, since `keyed` iterates and `stored_entries` reconciles `.items()` against
        # `__getitem__` only. `mappingproxy.get` delegates to the underlying mapping's own
        # `get` while `dict.items` and `dict.__getitem__` are resolved in C and do not, so a
        # `dict` subclass overriding `get` alone passed every gate above while storing and
        # subscripting one instant and answering these comparisons with another. The pin was
        # then bound to an instant the signed observation does not state, and `frozen`,
        # `runner`'s attempt names and any auditor recorded the one it stores. This is the hole
        # `signed_identity_findings` closed on the bindings of both operands, left behind on
        # the two instants. A mapping whose own two views diverge is refused before either
        # instant is compared rather than read past.
        signed_entries, signed_divergence = stored_entries(
            self.granted_image_identity, "granted_image_identity"
        )
        if signed_divergence:
            raise ValueError("; ".join(signed_divergence))
        read_entries, read_divergence = stored_entries(self.image, "image")
        if read_divergence:
            raise ValueError("; ".join(read_divergence))
        signed = signed_entries.get(OBSERVED_AT_KEY)
        if type(self.granted_observed_at) is not str or self.granted_observed_at != signed:
            raise ValueError(f"granted_observed_at {self.granted_observed_at!r} is not the exact"
                             f" UTC instant {signed!r} the authorization signed for the host"
                             " observation it names, so it names no attempt")
        drift = signed_identity_findings(self.granted_image_identity, self.image)
        if drift:
            raise ValueError("; ".join(drift))
        pinned = instant(signed)
        observed = read_entries.get(OBSERVED_AT_KEY)
        read = instant(observed)
        if pinned is None or read is None or read < pinned:
            raise ValueError(f"image {OBSERVED_AT_KEY} {observed!r} is not"
                             f" a reading at or after the signed {signed!r}, so this is no host"
                             " anybody re-checked at a nameable instant")


def refusal(findings: Sequence[str]) -> PrecheckAbort:
    """One typed abort carrying every exact reason, never a bare classified stop."""
    return PrecheckAbort(f"{REFUSAL_PREFIX}: " + "; ".join(findings))


def guarded(label: str, read: Any) -> Any:
    """Convert ordinary seam errors to bounded refusals; preserve process interrupts."""
    try:
        return read()
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- every ordinary seam error fails closed
        finding = (f"{label}: raised {type(error).__name__} out of a seam whose only stated "
                   "failure value is None")
        raise refusal((finding,)) from None


def projected(label: str, read: Any) -> Any:
    """Read one caller-owned projection through a guard and copy it dead at ingress.

    The copy is taken before any validation and before any observation, so the value that is
    checked, the value the observed host is compared against and the value that is recorded
    are one value. Neither the caller nor anything the injected surface reaches can edit an
    already-validated authorization between the check and the snapshot. The read itself is
    never repeated, so this costs no additional adapter call and mutates no input.

    The copy covers the whole projection, not only the part this phase compares: `prepare`
    semantically checks the four `GRANT_SECTIONS` and nothing else, but the entire grant is
    what later phases receive, so the entire grant must be provably copyable here. A value
    with no dead copy — anywhere in it, including a section preparation never reads — is
    refused rather than passed on, which is what keeps later phases from sharing mutable
    authorization bytes or state with the caller or an adapter.
    """
    value = guarded(label, read)
    try:
        return frozen(value)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- an uncopyable projection fails closed
        finding = (f"{label}: raised {type(error).__name__} while being copied, so no dead copy "
                   "of it exists to prove anything against")
        raise refusal((finding,)) from None


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
    """Validate one exact, fully resolved image identity."""
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
    """Take each reviewed read-only observation exactly once through a bounded guard."""
    return Observations(
        controls=guarded(
            "identities.observe_controls",
            lambda: adapters.identities.observe_controls(),
        ),
        image=guarded(
            "host.observe_image",
            lambda: adapters.host.observe_image(reference=IMAGE_REFERENCE),
        ),
        ephemeral_range=guarded(
            "host.observe_ephemeral_range",
            lambda: adapters.host.observe_ephemeral_range(),
        ),
        listeners=guarded(
            "host.observe_listeners",
            lambda: adapters.host.observe_listeners(port=HOST_PORT),
        ),
        platform=guarded(
            "docker.observe_platform", lambda: adapters.docker.observe_platform()
        ),
        docker_digest=guarded(
            "docker.observe_executable_digest",
            lambda: adapters.docker.observe_executable_digest(
                path=DOCKER_EXECUTABLE_PATH
            ),
        ),
        publications=guarded(
            "docker.observe_publications",
            lambda: adapters.docker.observe_publications(port=HOST_PORT),
        ),
        probe_digest=guarded(
            "probe.observe_digest",
            lambda: adapters.probe.observe_digest(path=PROBE_EXECUTABLE_PATH),
        ),
    )


def control_findings(
    observed: object, expected: Mapping[str, Any], pinned: Mapping[str, Any]
) -> tuple[str, ...]:
    """Require four clean worktrees on authorized commits and granted trees."""
    if not isinstance(observed, Mapping):
        return (f"control_identities: unresolved — {observed!r} is not an inventory",)
    findings: list[str] = []
    # Sort representations so mixed key types cannot escape as TypeError.
    unexpected = tuple(sorted(repr(key) for key in set(observed) - set(CONTROL_REPOSITORIES)))
    if unexpected:
        findings.append(f"control_identities: {list(unexpected)} are not control repositories")
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
        findings.append(f"control_identities: {name} commit {commit!r} is not a Git object id")
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
    """Require the selected image locally with exact stable identity and fresh observation.

    `observed_at` is ordered after the signed observation but excluded from identity equality.
    """
    if not isinstance(image, Mapping):
        return (f"image: unresolved — {image!r} is not a host image observation",)
    refusals = keyed(image, HOST_IMAGE_KEYS, "image", ordered=False)
    if refusals:
        return refusals
    findings: list[str] = []
    findings.extend(local_presence_findings(image, "image"))
    unread = tuple(key for key in OBSERVED_IDENTITY_KEYS if image[key] is None)
    if unread:
        findings.append(
            f"image: unresolved — {list(unread)} were never read, so the host never said "
            "what it holds"
        )
    observed_at = instant(image[OBSERVED_AT_KEY])
    signed_at = instant(pinned[OBSERVED_AT_KEY])
    if observed_at is None:
        findings.append(
            f"image: {OBSERVED_AT_KEY} {image[OBSERVED_AT_KEY]!r} is not a UTC instant"
        )
    elif signed_at is None or observed_at < signed_at:
        findings.append(
            f"image: {OBSERVED_AT_KEY} {image[OBSERVED_AT_KEY]!r} is not at or after the granted"
            f" host observation {pinned[OBSERVED_AT_KEY]!r}, so it describes a host nobody"
            " re-checked")
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
    """Require two increasing valid bounds that exclude the reviewed host port."""
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
            f"ephemeral_range: the reviewed host port {HOST_PORT} lies inside the "
            f"observed ephemeral range {(low, high)!r}",
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
    """Require the exact daemon inventory and the granted engine version."""
    if not isinstance(observed, Mapping):
        return (f"docker_platform: unresolved — {observed!r} is not platform evidence",)
    inventory = keyed(observed, PLATFORM_EVIDENCE_KEYS, "docker_platform", ordered=False)
    if inventory:
        return inventory
    unread = tuple(
        f"docker_platform: {key} {observed[key]!r} is not a non-empty observed string"
        for key in PLATFORM_EVIDENCE_KEYS
        if type(observed[key]) is not str or not observed[key]
    )
    if unread:
        return unread
    engine = observed[ENGINE_VERSION_KEY]
    if engine != version:
        return (
            f"docker_platform: {ENGINE_VERSION_KEY} {engine!r} is not the granted "
            f"Docker version {version!r}",
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
        ephemeral_range=frozen(observed.ephemeral_range),
        pre_consumption_listeners=frozen(observed.listeners),
        docker_publications=frozen(observed.publications),
        granted_image_identity=frozen(document["observed_image_identity"]),
        granted_observed_at=document["observed_image_identity"][OBSERVED_AT_KEY],
    )


def prepare(authorization: object, adapters: object) -> PreparationResult:
    """Prove all pre-consumption facts or abort before consumption.

    Inputs are projected once into dead copies, never mutated, and ordinary seam errors stay
    bounded. Everything after ingress reads those copies only, so no later refusal or record
    depends on a mapping the caller or an adapter still holds.

    Each projection is copied in full while only the four `GRANT_SECTIONS` are semantically
    compared here; the rest of the authorization is admission's to judge, not this phase's.
    An authorization that cannot be deeply copied is refused at ingress — before the injected
    surface is checked and before any observation — whichever section it sits in.
    """
    expected = projected(
        "authorization expected_controls",
        lambda: getattr(authorization, "expected_controls", None),
    )
    document = projected(
        "authorization grant", lambda: getattr(authorization, "grant", None)
    )
    refusals = (
        *guarded("adapters", lambda: adapter_findings(adapters)),
        *guarded(
            "authorization expected_controls",
            lambda: expected_control_findings(expected),
        ),
        *guarded("grant", lambda: grant_findings(document)),
    )
    if refusals:
        raise refusal(refusals)
    observed = observe(adapters)
    findings = guarded(
        "observation", lambda: observation_findings(observed, expected, document)
    )
    if findings:
        raise refusal(findings)
    return guarded("snapshot", lambda: snapshot(observed, document))
