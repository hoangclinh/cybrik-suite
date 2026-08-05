"""Read-only preparation must prove every pre-consumption fact or abort cleanly."""

from __future__ import annotations

import copy
from collections.abc import Mapping
from dataclasses import replace
from types import MappingProxyType
from typing import Any

import documents
import fakes
import pytest
from conftest import load_c8, require_c8_attr

# Every effect on the injected surface that is not one of the eight reviewed read-only
# observations. Preparation exists to refuse *before* anything is spent, so reaching any of
# these — a probe connect, credential material, the one bounded attempt, a Docker create,
# start or remove, the clock or the signature verifier — is a structural failure and not a
# behavioural detail. The list is stated in full rather than as a mutation sample: a phase
# that read the clock or verified a signature would already be doing something this phase is
# defined not to do, even though neither call creates a resource.
FORBIDDEN_EFFECTS = (
    "clock.monotonic",
    "credential.create",
    "credential.observe_residual",
    "credential.remove",
    "docker.create_container",
    "docker.create_network",
    "docker.create_volume",
    "docker.observe_container",
    "docker.observe_daemon_event",
    "docker.observe_docker_port",
    "docker.observe_health",
    "docker.observe_network",
    "docker.observe_residual",
    "docker.remove",
    "docker.start_container",
    "ledger.consume",
    "ledger.is_consumed",
    "probe.run",
    "verifier.verify",
)

# The eight reviewed observations, each taken exactly once on the passing path.
OBSERVATIONS = (
    "identities.observe_controls",
    "host.observe_image",
    "host.observe_ephemeral_range",
    "host.observe_listeners",
    "docker.observe_platform",
    "docker.observe_executable_digest",
    "docker.observe_publications",
    "probe.observe_digest",
)

# The port attribute each observation is taken through, so an exception raised out of any one
# of the eight seams can be stated as a case rather than as eight near-identical tests.
OBSERVATION_PORTS = (
    ("identities", "observe_controls"),
    ("host", "observe_image"),
    ("host", "observe_ephemeral_range"),
    ("host", "observe_listeners"),
    ("docker", "observe_platform"),
    ("docker", "observe_executable_digest"),
    ("docker", "observe_publications"),
    ("probe", "observe_digest"),
)

# A string only the raised exception carries. If it reaches the refusal text, the phase is
# quoting arbitrary adapter output — which may hold observed host data — into evidence.
LEAKABLE_CAUSE_TEXT = "adapter-detail-that-may-carry-observed-data"

# Types a deeply immutable snapshot may hold as leaves. Everything else must be a read-only
# mapping, a tuple or a frozenset, recursively.
IMMUTABLE_LEAVES = (bool, int, float, complex, str, bytes, type(None))

# An instant strictly before the grant's own signed host observation, and one strictly after.
STALE_OBSERVED_AT = "2026-08-04T23:59:59Z"
FRESH_OBSERVED_AT = "2026-08-05T00:01:00Z"

# Hostile edits an injected adapter could make to the caller-owned authorization *after* it
# was validated and *before* it is compared against the host or recorded. Every value here is
# well formed: the attack is not a malformed document but a live alias, so a phase that
# re-reads the caller's own mappings after validation accepts all of them.
HOSTILE_PULL_POLICY = "always"
HOSTILE_COMMIT = "1" * 40
HOSTILE_TREE = "2" * 40


@pytest.fixture(name="preparation")
def preparation_module():
    return load_c8("preparation")


@pytest.fixture(name="abort")
def abort_class():
    return require_c8_attr(load_c8("errors"), "PrecheckAbort")


def prepare(preparation, adapters=None, authorization=None):
    return require_c8_attr(preparation, "prepare")(
        authorization or documents.authorization(),
        adapters or fakes.passing_adapters(),
    )


# ---------------------------------------------------------------------------
# Test-side doubles. Everything here is local to this module: the shared fakes state a
# well-behaved injected surface, and these state the malformed one preparation must survive.
# ---------------------------------------------------------------------------
def exploding_port(port: Any, method: str, error: BaseException) -> Any:
    """A well-behaved port with exactly one call replaced by a raise.

    The replacement is bound onto a shallow copy of the real fake rather than served by a
    delegating `__getattr__` proxy. Since Python 3.12, `isinstance` against a
    runtime-checkable `Protocol` resolves members with `inspect.getattr_static`, so a proxy
    that answers `hasattr` no longer satisfies one. A delegating double would therefore fail
    the injected-surface check first and the failure actually under test — a read-only seam
    that raises out of a contract whose only stated failure value is `None` — would never be
    reached. The copy keeps the shared call log, so what the surface recorded stays exact.
    """

    def explode(*args: Any, **kwargs: Any) -> Any:
        raise error

    substitute = copy.copy(port)
    setattr(substitute, method, explode)
    return substitute


class HostileMapping(Mapping):
    """A Mapping implementation whose every read raises.

    A malformed mapping is not a hypothetical: `Mapping` is a structural promise about
    methods, not about their behaviour, so a document that satisfies `isinstance` can still
    raise out of a projection that has no exception in its contract.
    """

    def __init__(self, error: BaseException) -> None:
        self._error = error

    def __getitem__(self, key: object) -> Any:
        raise self._error

    def __iter__(self):
        raise self._error

    def __len__(self) -> int:
        raise self._error


class HostileAuthorization:
    """An authorization whose projections raise instead of answering."""

    def __init__(self, error: BaseException, *, failing: str) -> None:
        self._error = error
        self._failing = failing

    @property
    def grant(self) -> Any:
        if self._failing == "grant":
            raise self._error
        return documents.grant_document()

    @property
    def expected_controls(self) -> Any:
        if self._failing == "expected_controls":
            raise self._error
        return dict(fakes.EXPECTED_CONTROLS)


class CustomMutable:
    """A value that is neither a known immutable leaf nor a known frozen container."""

    def __init__(self) -> None:
        self.field = "value"


class MutableInt(int):
    """An immutable-looking scalar subclass that still carries mutable caller state."""

    def __new__(cls, value: int):
        instance = super().__new__(cls, value)
        instance.state = []
        return instance


class MutableStr(str):
    """A `str` subclass carrying mutable caller state behind a safe-looking scalar.

    `str` and `bytes` are also `Sequence`s, so a subclass that is not refused as a scalar is
    not merely mis-typed: it is silently taken apart into a tuple of its own characters or
    bytes, and the value the caller can still edit is what the phase went on to compare.
    """

    def __new__(cls, value: str):
        instance = super().__new__(cls, value)
        instance.state = []
        return instance


class MutableBytes(bytes):
    """A `bytes` subclass carrying mutable caller state behind a safe-looking scalar."""

    def __new__(cls, value: bytes):
        instance = super().__new__(cls, value)
        instance.state = []
        return instance


def exploding_adapters(port: str, method: str, error: BaseException):
    adapters = fakes.passing_adapters()
    return replace(
        adapters, **{port: exploding_port(getattr(adapters, port), method, error)}
    )


def mutating_port(port: Any, method: str, mutate: Any) -> Any:
    """A well-behaved port whose one named observation first edits caller-owned state.

    The real bound method still runs and still records on the shared call log, so the injected
    surface stays exactly the eight reviewed read-only observations: the only added behaviour
    is the edit a hostile or merely buggy adapter could make between validation and
    comparison. As in `exploding_port`, the substitute is a shallow copy carrying an instance
    attribute rather than a delegating proxy, so `isinstance` against the runtime-checkable
    port still holds and the injected-surface check is not what fails.
    """
    original = getattr(port, method)

    def observe(*args: Any, **kwargs: Any) -> Any:
        mutate()
        return original(*args, **kwargs)

    substitute = copy.copy(port)
    setattr(substitute, method, observe)
    return substitute


def mutating_adapters(adapters: Any, port: str, method: str, mutate: Any) -> Any:
    return replace(
        adapters, **{port: mutating_port(getattr(adapters, port), method, mutate)}
    )


def grant_authorization(document: Mapping[str, Any]):
    """One authorization carrying an exact grant document and nothing else changed."""
    return documents.authorization(grant=dict(document))


def with_tool(tool: str, patch: Mapping[str, Any]):
    base = documents.grant_document()
    tools = {**base["tools"], tool: {**base["tools"][tool], **patch}}
    return grant_authorization({**base, "tools": tools})


def without_tool_key(tool: str, key: str):
    base = documents.grant_document()
    trimmed = {
        name: value for name, value in base["tools"][tool].items() if name != key
    }
    return grant_authorization({**base, "tools": {**base["tools"], tool: trimmed}})


def with_repositories(patch: Mapping[str, Any]):
    base = documents.grant_document()
    return grant_authorization(
        {**base, "repositories": {**base["repositories"], **patch}}
    )


def with_identity(section: str, patch: Mapping[str, Any]):
    return grant_authorization(
        documents.with_nested(documents.grant_document(), section, patch)
    )


def mutable_paths(value: Any, path: str = "result", seen: tuple[int, ...] = ()) -> tuple[str, ...]:
    """Every nested value in a snapshot that is not deeply immutable."""
    if isinstance(value, IMMUTABLE_LEAVES):
        return ()
    if id(value) in seen:
        return (f"{path}: refers to itself",)
    trail = (*seen, id(value))
    if type(value) is MappingProxyType:
        return tuple(
            finding
            for key, item in value.items()
            for finding in (
                *mutable_paths(key, f"{path}.<key>", trail),
                *mutable_paths(item, f"{path}[{key!r}]", trail),
            )
        )
    if type(value) is tuple:
        return tuple(
            finding
            for position, item in enumerate(value)
            for finding in mutable_paths(item, f"{path}[{position}]", trail)
        )
    if type(value) is frozenset:
        return tuple(
            finding for item in value for finding in mutable_paths(item, f"{path}.<item>", trail)
        )
    return (f"{path}: {type(value).__name__} is not deeply immutable",)


def plain(value: Any) -> Any:
    """A frozen snapshot rendered into ordinary containers, so it can be compared later.

    `copy.deepcopy` cannot take a before-picture of a deeply frozen result: a `mappingproxy`
    is unpicklable, which is the very property that makes it a dead copy. Rendering into
    plain containers keeps the before-and-after comparison honest without demanding that the
    snapshot be copyable — a demand the deep-immutability control above forbids it to meet.
    """
    if type(value) is MappingProxyType:
        return {key: plain(item) for key, item in value.items()}
    if type(value) is tuple:
        return [plain(item) for item in value]
    return value


def result_fields() -> dict[str, Any]:
    """Exactly the field values one satisfied preparation would have proved."""
    return {
        "satisfied": True,
        "control_identities": MappingProxyType(
            {
                name: MappingProxyType(
                    {
                        "commit": fakes.EXPECTED_CONTROLS[name],
                        "tree": fakes.EXPECTED_TREES[name],
                        "clean": True,
                    }
                )
                for name in fakes.EXPECTED_CONTROLS
            }
        ),
        "image": MappingProxyType(
            {
                key: MappingProxyType(value) if isinstance(value, dict) else value
                for key, value in fakes.host_image().items()
            }
        ),
        "selected_image_identity": MappingProxyType(
            {
                key: MappingProxyType(value) if isinstance(value, dict) else value
                for key, value in documents.grant_document()[
                    "selected_image_identity"
                ].items()
            }
        ),
        "docker_platform": MappingProxyType(dict(fakes.DOCUMENTED_PLATFORM)),
        "docker_executable": MappingProxyType(
            {
                "path": fakes.DOCKER_EXECUTABLE_PATH,
                "sha256": fakes.SYNTHETIC_DOCKER_SHA256,
                "version": fakes.DOCUMENTED_PLATFORM["engine_version"],
            }
        ),
        "probe_executable": MappingProxyType(
            {
                "path": fakes.PROBE_EXECUTABLE_PATH,
                "sha256": fakes.PROBE_EXECUTABLE_SHA256,
                "argv": fakes.PROBE_ARGV,
            }
        ),
        "ephemeral_range": fakes.EPHEMERAL_RANGE,
        "pre_consumption_listeners": (),
        "docker_publications": (),
    }


def self_referential_proxy() -> MappingProxyType:
    """A read-only mapping that contains itself, so depth is unbounded but every type frozen."""
    backing: dict[str, Any] = {}
    proxy = MappingProxyType(backing)
    backing["self"] = proxy
    return proxy


# ---------------------------------------------------------------------------
# The passing path
# ---------------------------------------------------------------------------
def test_preparation_observes_controls_host_platform_image_port_and_probe(preparation) -> None:
    adapters = fakes.passing_adapters()
    result = prepare(preparation, adapters)
    assert result.satisfied is True
    names = adapters.log.names()
    for expected in OBSERVATIONS:
        assert names.count(expected) == 1
    assert len(names) == len(OBSERVATIONS), "exactly the eight reviewed observations"
    assert not set(names) & set(FORBIDDEN_EFFECTS)


def test_preparation_never_consults_the_signature_verifier(preparation) -> None:
    adapters = fakes.passing_adapters()
    prepare(preparation, adapters)
    assert "verifier.verify" not in adapters.log.names()


def test_preparation_exports_only_the_read_only_phase(preparation) -> None:
    assert set(require_c8_attr(preparation, "__all__")) == {
        "PreparationResult",
        "prepare",
    }


def test_prepare_edits_no_input_it_was_handed(preparation) -> None:
    """Neither the observations nor the authorization may come back changed."""
    identities = fakes.control_identities()
    image = fakes.host_image()
    platform = dict(fakes.DOCUMENTED_PLATFORM)
    listeners = ([],)
    authorization = documents.authorization()
    inputs = (identities, image, platform, listeners, authorization.grant, authorization.expected_controls)
    before = copy.deepcopy(inputs)
    prepare(
        preparation,
        fakes.passing_adapters(
            identities=identities, image=image, platform=platform, listeners=listeners
        ),
        authorization,
    )
    assert inputs == before


# ---------------------------------------------------------------------------
# Deep immutability
# ---------------------------------------------------------------------------
def test_the_whole_snapshot_is_deeply_immutable_not_only_its_outer_containers(
    preparation,
) -> None:
    result = prepare(preparation)
    offending = tuple(
        finding
        for name in (
            "control_identities",
            "image",
            "selected_image_identity",
            "docker_platform",
            "docker_executable",
            "probe_executable",
            "ephemeral_range",
            "pre_consumption_listeners",
            "docker_publications",
        )
        for finding in mutable_paths(getattr(result, name), name)
    )
    assert offending == ()


def test_the_snapshot_holds_no_live_alias_into_a_callers_mutable_input(preparation) -> None:
    """Editing an input after the fact may not change a single byte of what was proved."""
    image = fakes.host_image()
    identities = fakes.control_identities()
    platform = dict(fakes.DOCUMENTED_PLATFORM)
    result = prepare(
        preparation,
        fakes.passing_adapters(image=image, identities=identities, platform=platform),
    )
    proved = plain(
        (result.image, result.control_identities, result.docker_platform)
    )
    image["platform"]["architecture"] = "changed"
    identities[fakes.SUITE_CONTROL]["clean"] = False
    platform["engine_version"] = "changed"
    assert (
        plain((result.image, result.control_identities, result.docker_platform))
        == proved
    )


# ---------------------------------------------------------------------------
# Authorization projection isolation
#
# `prepare` reads the authorization once and then takes eight observations through injected
# ports. Between those two moments the caller's own mappings are reachable by anything the
# surface calls. Holding them live across the observations means the document that was
# validated, the document the host is compared against and the document that is recorded need
# not be the same document — which is a defect of the phase, not of its adapters.
# ---------------------------------------------------------------------------
def test_an_adapter_cannot_edit_the_selected_identity_into_the_snapshot(preparation) -> None:
    """What is recorded is the authorized selection, not one edited mid-observation."""
    authorization = documents.authorization()

    def mutate() -> None:
        authorization.grant["selected_image_identity"]["pull_policy"] = HOSTILE_PULL_POLICY

    adapters = mutating_adapters(
        fakes.passing_adapters(), "probe", "observe_digest", mutate
    )
    result = prepare(preparation, adapters, authorization)
    assert (
        authorization.grant["selected_image_identity"]["pull_policy"] == HOSTILE_PULL_POLICY
    ), "the control is vacuous unless the hostile edit really happened"
    assert result.satisfied is True
    assert result.selected_image_identity["pull_policy"] == fakes.PULL_POLICY


def test_an_adapter_cannot_move_the_authorized_commits_to_match_what_it_reports(
    preparation, abort
) -> None:
    """Control drift is decided against the authorization as read, not as it now stands.

    This is the same live-alias defect at its worst. The identity port edits both the
    authorization's expected commits and the grant's pinned repositories to the commits it is
    about to report, so a phase comparing against the caller's live mappings finds four clean
    worktrees on their authorized and granted commits, and satisfies a preparation for four
    trees nobody ever authorized.
    """
    authorization = documents.authorization()
    hostile_identities = {
        name: {"commit": HOSTILE_COMMIT, "tree": HOSTILE_TREE, "clean": True}
        for name in fakes.EXPECTED_CONTROLS
    }

    def mutate() -> None:
        for name in fakes.EXPECTED_CONTROLS:
            authorization.expected_controls[name] = HOSTILE_COMMIT
            authorization.grant["repositories"][name].update(
                {"commit": HOSTILE_COMMIT, "tree": HOSTILE_TREE}
            )

    adapters = mutating_adapters(
        fakes.passing_adapters(identities=hostile_identities),
        "identities",
        "observe_controls",
        mutate,
    )
    with pytest.raises(abort):
        prepare(preparation, adapters, authorization)
    assert (
        authorization.expected_controls[fakes.SUITE_CONTROL] == HOSTILE_COMMIT
    ), "the control is vacuous unless the hostile edit really happened"
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (bytearray(b"observed"), b"observed"),
        ({"outer": [1, {"inner": (2, 3)}]}, None),
        ({"set"}, frozenset({"set"})),
        ([1, 2, 3], (1, 2, 3)),
    ],
)
def test_frozen_deep_copies_every_known_container_into_an_immutable_one(
    preparation, value, expected
) -> None:
    frozen = require_c8_attr(preparation, "frozen")
    before = copy.deepcopy(value)
    result = frozen(value)
    assert mutable_paths(result, "frozen") == ()
    assert value == before, "freezing may not edit its input"
    if expected is not None:
        assert result == expected
        assert type(result) is type(expected)


def test_frozen_converts_a_mutable_byte_buffer_into_a_dead_copy(preparation) -> None:
    frozen = require_c8_attr(preparation, "frozen")
    buffer = bytearray(b"observed")
    result = frozen(buffer)
    buffer[0:1] = b"X"
    assert result == b"observed"


@pytest.mark.parametrize(
    "build",
    [
        pytest.param(lambda: CustomMutable(), id="custom-mutable-object"),
        pytest.param(lambda: MutableInt(1), id="mutable-scalar-subclass"),
        pytest.param(lambda: MutableStr("observed"), id="mutable-str-subclass"),
        pytest.param(lambda: MutableBytes(b"observed"), id="mutable-bytes-subclass"),
        pytest.param(
            lambda: {"nested": MutableStr("observed")}, id="nested-mutable-str-subclass"
        ),
        pytest.param(
            lambda: {MutableBytes(b"key"): "observed"}, id="keyed-mutable-bytes-subclass"
        ),
        pytest.param(lambda: {"nested": CustomMutable()}, id="nested-custom-mutable"),
        pytest.param(lambda: [CustomMutable()], id="sequenced-custom-mutable"),
        pytest.param(lambda: cyclic_list(), id="cyclic-sequence"),
        pytest.param(lambda: cyclic_mapping(), id="cyclic-mapping"),
        pytest.param(lambda: {"key": cyclic_mapping()}, id="nested-cyclic-mapping"),
    ],
)
def test_frozen_refuses_a_value_it_cannot_prove_deeply_immutable(preparation, build) -> None:
    frozen = require_c8_attr(preparation, "frozen")
    with pytest.raises(ValueError):
        frozen(build())


@pytest.mark.parametrize("value", ["observed", b"observed", 29, True, None])
def test_frozen_keeps_an_exact_builtin_scalar_as_the_same_safe_leaf(preparation, value) -> None:
    """A positive control: refusing scalar subclasses may not refuse the scalars themselves."""
    frozen = require_c8_attr(preparation, "frozen")
    result = frozen(value)
    assert result is value
    assert type(result) is type(value)


def cyclic_list() -> list:
    value: list = []
    value.append(value)
    return value


def cyclic_mapping() -> dict:
    value: dict = {}
    value["self"] = value
    return value


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("docker_platform", MappingProxyType({"engine_version": bytearray(b"29")})),
        ("docker_platform", MappingProxyType({"engine_version": {"set"}})),
        ("docker_platform", MappingProxyType({"engine_version": CustomMutable()})),
        ("image", MappingProxyType({"platform": {"os": "linux"}})),
        ("image", MappingProxyType({"platform": ["linux"]})),
        ("image", MappingProxyType({"platform": (["linux"],)})),
        ("selected_image_identity", MappingProxyType({"platform": self_referential_proxy()})),
        ("probe_executable", MappingProxyType({"argv": (bytearray(b"-z"),)})),
        ("ephemeral_range", (49152, 65535, 1)),
        ("pre_consumption_listeners", (MappingProxyType({"port": {"set"}}),)),
    ],
)
def test_direct_construction_proves_every_nested_value_immutable(
    preparation, field, value
) -> None:
    result_type = require_c8_attr(preparation, "PreparationResult")
    with pytest.raises(ValueError):
        result_type(**{**result_fields(), field: value})


def test_the_exact_proved_field_set_constructs(preparation) -> None:
    """A positive control: the coherence branches must refuse drift, not everything."""
    result_type = require_c8_attr(preparation, "PreparationResult")
    assert result_type(**result_fields()).satisfied is True


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("satisfied", False),
        ("satisfied", None),
        ("satisfied", 1),
        ("control_identities", dict(fakes.CLEAN_CONTROL_IDENTITIES)),
        ("control_identities", MappingProxyType({})),
        (
            "control_identities",
            MappingProxyType(
                {
                    name: MappingProxyType({"commit": commit, "tree": "0" * 40, "clean": True})
                    for name, commit in list(fakes.EXPECTED_CONTROLS.items())[:3]
                }
            ),
        ),
        ("image", dict(fakes.host_image())),
        ("selected_image_identity", None),
        ("docker_platform", ()),
        ("docker_executable", [("path", fakes.DOCKER_EXECUTABLE_PATH)]),
        ("probe_executable", "probe"),
        ("ephemeral_range", [49152, 65535]),
        ("ephemeral_range", (49152,)),
        ("ephemeral_range", ()),
        ("ephemeral_range", (True, 65535)),
        ("ephemeral_range", ("49152", "65535")),
        ("pre_consumption_listeners", (MappingProxyType({"port": fakes.HOST_PORT}),)),
        ("pre_consumption_listeners", []),
        ("docker_publications", (fakes.OBSERVED_PUBLICATION,)),
        ("docker_publications", [fakes.OBSERVED_PUBLICATION]),
    ],
)
def test_every_result_coherence_branch_refuses_a_snapshot_of_something_that_never_happened(
    preparation, field, value
) -> None:
    result_type = require_c8_attr(preparation, "PreparationResult")
    with pytest.raises(ValueError):
        result_type(**{**result_fields(), field: value})


def test_a_mixed_key_control_inventory_is_refused_rather_than_compared(preparation) -> None:
    """Sorting a mixed-type inventory for a message must not raise `TypeError` instead."""
    result_type = require_c8_attr(preparation, "PreparationResult")
    identities = MappingProxyType(
        {
            **dict(result_fields()["control_identities"]),
            1: MappingProxyType({"commit": "0" * 40, "tree": "0" * 40, "clean": True}),
        }
    )
    with pytest.raises(ValueError):
        result_type(**{**result_fields(), "control_identities": identities})


@pytest.mark.parametrize(
    "platform",
    [
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "engine_version": bytearray(b"29.6.2")}, id="bytearray"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "engine_version": {"29.6.2"}}, id="set"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "engine_version": CustomMutable()}, id="custom"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "engine_version": cyclic_mapping()}, id="cyclic"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "engine_version": ["29.6.2"]}, id="nested-mutable"),
    ],
)
def test_an_observation_carrying_an_unfreezable_value_aborts_before_consumption(
    preparation, abort, platform
) -> None:
    adapters = fakes.passing_adapters(platform=platform)
    with pytest.raises(abort):
        prepare(preparation, adapters)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


def test_a_self_referential_platform_value_aborts_rather_than_recursing(
    preparation, abort
) -> None:
    platform: dict[str, Any] = dict(fakes.DOCUMENTED_PLATFORM)
    platform["engine_version"] = platform
    adapters = fakes.passing_adapters(platform=platform)
    with pytest.raises(abort):
        prepare(preparation, adapters)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


# ---------------------------------------------------------------------------
# Platform evidence
# ---------------------------------------------------------------------------
def test_the_platform_evidence_inventory_is_the_reviewed_constant(preparation) -> None:
    constants = load_c8("constants")
    keys = require_c8_attr(constants, "PLATFORM_EVIDENCE_KEYS")
    assert keys == ("desktop_version", "desktop_build", "engine_version", "api_version")
    assert set(keys) == set(fakes.DOCUMENTED_PLATFORM)
    assert prepare(preparation).satisfied is True


def test_a_reordered_platform_inventory_is_still_the_same_evidence(preparation) -> None:
    """The inventory is exact but unordered: a daemon may report its fields in any order."""
    reversed_platform = {
        key: fakes.DOCUMENTED_PLATFORM[key] for key in reversed(list(fakes.DOCUMENTED_PLATFORM))
    }
    assert prepare(preparation, fakes.passing_adapters(platform=reversed_platform)).satisfied


@pytest.mark.parametrize(
    "platform",
    [
        pytest.param(None, id="unresolved"),
        pytest.param({}, id="empty"),
        pytest.param("29.6.2", id="not-a-mapping"),
        pytest.param(
            {key: value for key, value in fakes.DOCUMENTED_PLATFORM.items() if key != "api_version"},
            id="missing-api-version",
        ),
        pytest.param(
            {key: value for key, value in fakes.DOCUMENTED_PLATFORM.items() if key != "desktop_build"},
            id="missing-desktop-build",
        ),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "context": "desktop-linux"}, id="extra-key"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, 1: "one"}, id="mixed-key-types"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "desktop_version": None}, id="unread-value"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "desktop_version": ""}, id="empty-value"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "desktop_build": 234817}, id="untyped-value"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "api_version": True}, id="boolean-value"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "engine_version": ""}, id="engine-never-observed"),
        pytest.param({**fakes.DOCUMENTED_PLATFORM, "engine_version": "29.6.1"}, id="engine-drift"),
    ],
)
def test_platform_evidence_that_is_not_the_exact_reviewed_inventory_aborts(
    preparation, abort, platform
) -> None:
    adapters = fakes.passing_adapters(platform=platform)
    with pytest.raises(abort):
        prepare(preparation, adapters)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


def test_the_observed_engine_version_must_equal_the_version_the_grant_pinned(
    preparation, abort
) -> None:
    authorization = with_tool("docker", {"version": "29.6.3"})
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, authorization)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


# ---------------------------------------------------------------------------
# Adapter exceptions and projection totality
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(("port", "method"), OBSERVATION_PORTS)
@pytest.mark.parametrize(
    "error",
    [
        RuntimeError(LEAKABLE_CAUSE_TEXT),
        ValueError(LEAKABLE_CAUSE_TEXT),
        TypeError(LEAKABLE_CAUSE_TEXT),
        OSError(LEAKABLE_CAUSE_TEXT),
        AttributeError(LEAKABLE_CAUSE_TEXT),
        KeyError(LEAKABLE_CAUSE_TEXT),
    ],
)
def test_an_observation_that_raises_becomes_a_bounded_precheck_abort(
    preparation, abort, port, method, error
) -> None:
    adapters = exploding_adapters(port, method, error)
    with pytest.raises(abort) as raised:
        prepare(preparation, adapters)
    reason = str(raised.value)
    assert reason
    assert type(error).__name__ in reason
    assert LEAKABLE_CAUSE_TEXT not in reason, "an adapter's own text may carry observed data"
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize(("port", "method"), OBSERVATION_PORTS)
@pytest.mark.parametrize("interrupt", [KeyboardInterrupt, SystemExit])
def test_an_interrupted_observation_is_never_swallowed_into_a_refusal(
    preparation, port, method, interrupt
) -> None:
    adapters = exploding_adapters(port, method, interrupt())
    with pytest.raises(interrupt):
        prepare(preparation, adapters)


@pytest.mark.parametrize("failing", ["grant", "expected_controls"])
def test_an_authorization_projection_that_raises_becomes_a_bounded_precheck_abort(
    preparation, abort, failing
) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort) as raised:
        prepare(
            preparation,
            adapters,
            HostileAuthorization(RuntimeError(LEAKABLE_CAUSE_TEXT), failing=failing),
        )
    assert "RuntimeError" in str(raised.value)
    assert LEAKABLE_CAUSE_TEXT not in str(raised.value)
    assert adapters.log.names() == (), "a refused authorization takes no observation"


@pytest.mark.parametrize("failing", ["grant", "expected_controls"])
@pytest.mark.parametrize("interrupt", [KeyboardInterrupt, SystemExit])
def test_an_interrupt_raised_while_copying_a_projection_is_never_swallowed(
    preparation, failing, interrupt
) -> None:
    """Copying the authorization dead at ingress may not swallow a process interrupt.

    The copy walks the caller's own mapping, so an interrupt delivered during that walk
    surfaces there rather than at a seam. It is still an interrupt, not a refusal.
    """
    adapters = fakes.passing_adapters()
    authorization = documents.authorization(**{failing: HostileMapping(interrupt())})
    with pytest.raises(interrupt):
        prepare(preparation, adapters, authorization)
    assert adapters.log.names() == (), "a refused authorization takes no observation"


@pytest.mark.parametrize(
    "authorization",
    [
        pytest.param(
            documents.authorization(grant=HostileMapping(RuntimeError(LEAKABLE_CAUSE_TEXT))),
            id="hostile-grant-mapping",
        ),
        pytest.param(
            documents.authorization(
                expected_controls=HostileMapping(RuntimeError(LEAKABLE_CAUSE_TEXT))
            ),
            id="hostile-expected-controls-mapping",
        ),
        pytest.param(
            grant_authorization(
                {
                    **documents.grant_document(),
                    "repositories": HostileMapping(RuntimeError(LEAKABLE_CAUSE_TEXT)),
                }
            ),
            id="hostile-repositories-mapping",
        ),
        pytest.param(
            grant_authorization(
                {**documents.grant_document(), "tools": HostileMapping(KeyError("docker"))}
            ),
            id="hostile-tools-mapping",
        ),
    ],
)
def test_a_malformed_mapping_implementation_cannot_escape_untyped(
    preparation, abort, authorization
) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort) as raised:
        prepare(preparation, adapters, authorization)
    assert LEAKABLE_CAUSE_TEXT not in str(raised.value)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize(
    "identities",
    [
        pytest.param({1: {}, "extra": {}}, id="mixed-key-types"),
        pytest.param({**fakes.CLEAN_CONTROL_IDENTITIES, 1: {}, (2,): {}}, id="mixed-extra-keys"),
        pytest.param({fakes.SUITE_CONTROL: ["commit", "tree", "clean"]}, id="sequence-identity"),
        pytest.param({fakes.SUITE_CONTROL: "clean"}, id="string-identity"),
        pytest.param(
            {**fakes.CLEAN_CONTROL_IDENTITIES, fakes.SUITE_CONTROL: {1: "commit"}},
            id="untyped-inner-keys",
        ),
        pytest.param(["cybrik-suite"], id="sequence-inventory"),
        pytest.param("cybrik-suite", id="string-inventory"),
        pytest.param(0, id="integer-inventory"),
    ],
)
def test_a_type_confused_control_inventory_aborts_instead_of_raising(
    preparation, abort, identities
) -> None:
    adapters = fakes.passing_adapters(identities=identities)
    with pytest.raises(abort):
        prepare(preparation, adapters)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize(
    "expected",
    [
        pytest.param({1: "a" * 40, "extra": "b" * 40}, id="mixed-key-types"),
        pytest.param({**fakes.EXPECTED_CONTROLS, 1: "a" * 40}, id="extra-untyped-key"),
        pytest.param(["cybrik-suite"], id="sequence"),
        pytest.param("cybrik-suite", id="string"),
        pytest.param(0, id="integer"),
    ],
)
def test_a_type_confused_expected_control_inventory_aborts_instead_of_raising(
    preparation, abort, expected
) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, documents.authorization(expected_controls=expected))
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


# ---------------------------------------------------------------------------
# Refusal coverage: the injected surface
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("port", ["identities", "host", "docker", "probe"])
@pytest.mark.parametrize(
    "substitute",
    [
        pytest.param(None, id="absent"),
        pytest.param(object(), id="not-a-port"),
        pytest.param("adapter", id="string"),
    ],
)
def test_an_injected_surface_missing_a_reviewed_port_aborts(
    preparation, abort, port, substitute
) -> None:
    adapters = replace(fakes.passing_adapters(), **{port: substitute})
    with pytest.raises(abort):
        prepare(preparation, adapters)
    assert adapters.log.names() == (), "a surface check precedes every observation"


def test_an_authorization_that_is_not_an_object_at_all_aborts(preparation, abort) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, object())
    assert adapters.log.names() == ()


# ---------------------------------------------------------------------------
# Refusal coverage: the authorization's expected controls
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "expected",
    [
        pytest.param(None, id="unresolved"),
        pytest.param({}, id="empty"),
        pytest.param(
            {name: commit for name, commit in list(fakes.EXPECTED_CONTROLS.items())[:3]},
            id="missing-one-repository",
        ),
        pytest.param({**fakes.EXPECTED_CONTROLS, "cybrik-extra": "a" * 40}, id="extra-repository"),
        pytest.param({**fakes.EXPECTED_CONTROLS, fakes.SUITE_CONTROL: "z" * 40}, id="not-hex"),
        pytest.param({**fakes.EXPECTED_CONTROLS, fakes.SOC_CONTROL: "a" * 39}, id="short-object-id"),
        pytest.param({**fakes.EXPECTED_CONTROLS, fakes.AI_CONTROL: "A" * 40}, id="upper-case-hex"),
        pytest.param({**fakes.EXPECTED_CONTROLS, fakes.FABRIC_CONTROL: None}, id="unread-commit"),
        pytest.param({**fakes.EXPECTED_CONTROLS, fakes.SUITE_CONTROL: 0}, id="untyped-commit"),
    ],
)
def test_an_authorization_that_does_not_name_four_control_commits_aborts(
    preparation, abort, expected
) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, documents.authorization(expected_controls=expected))
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


# ---------------------------------------------------------------------------
# Refusal coverage: the grant document
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "authorization",
    [
        pytest.param(documents.authorization(grant=None), id="absent-grant"),
        pytest.param(documents.authorization(grant="grant"), id="string-grant"),
        pytest.param(
            grant_authorization(documents.without_field(documents.grant_document(), "tools")),
            id="missing-tools-section",
        ),
        pytest.param(
            grant_authorization(
                documents.without_field(documents.grant_document(), "repositories")
            ),
            id="missing-repositories-section",
        ),
        pytest.param(
            grant_authorization({**documents.grant_document(), "selected_image_identity": None}),
            id="unread-selected-identity",
        ),
        pytest.param(
            grant_authorization({**documents.grant_document(), "observed_image_identity": []}),
            id="sequence-observed-identity",
        ),
    ],
)
def test_a_grant_section_that_is_not_a_reviewed_object_aborts(
    preparation, abort, authorization
) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, authorization)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize(
    "authorization",
    [
        pytest.param(with_repositories({fakes.SUITE_CONTROL: "clean"}), id="string-identity"),
        pytest.param(
            with_repositories({fakes.SOC_CONTROL: {"commit": "a" * 40, "clean": True}}),
            id="missing-tree",
        ),
        pytest.param(
            with_repositories(
                {
                    fakes.AI_CONTROL: {
                        "commit": fakes.SYNTHETIC_AI_COMMIT,
                        "tree": fakes.SYNTHETIC_AI_TREE,
                        "clean": True,
                        "root": "/synthetic",
                    }
                }
            ),
            id="extra-inner-key",
        ),
        pytest.param(
            with_repositories(
                {
                    fakes.FABRIC_CONTROL: {
                        "commit": "z" * 40,
                        "tree": fakes.SYNTHETIC_FABRIC_TREE,
                        "clean": True,
                    }
                }
            ),
            id="commit-not-an-object-id",
        ),
        pytest.param(
            with_repositories(
                {
                    fakes.SUITE_CONTROL: {
                        "commit": fakes.SYNTHETIC_SUITE_COMMIT,
                        "tree": None,
                        "clean": True,
                    }
                }
            ),
            id="tree-never-read",
        ),
        pytest.param(
            with_repositories(
                {
                    fakes.SOC_CONTROL: {
                        "commit": fakes.SYNTHETIC_SOC_COMMIT,
                        "tree": fakes.SYNTHETIC_SOC_TREE,
                        "clean": False,
                    }
                }
            ),
            id="pinned-dirty",
        ),
        pytest.param(
            with_repositories(
                {
                    fakes.AI_CONTROL: {
                        "commit": fakes.SYNTHETIC_AI_COMMIT,
                        "tree": fakes.SYNTHETIC_AI_TREE,
                        "clean": 1,
                    }
                }
            ),
            id="merely-truthy-clean",
        ),
        pytest.param(
            grant_authorization(
                {
                    **documents.grant_document(),
                    "repositories": {
                        name: value
                        for name, value in list(documents.grant_document()["repositories"].items())[
                            :3
                        ]
                    },
                }
            ),
            id="missing-one-repository",
        ),
    ],
)
def test_a_grant_that_does_not_pin_four_clean_control_worktrees_aborts(
    preparation, abort, authorization
) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, authorization)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize(
    "authorization",
    [
        pytest.param(with_tool("docker", {"path": "/usr/bin/docker"}), id="docker-path-drift"),
        pytest.param(with_tool("docker", {"path": None}), id="docker-path-unread"),
        pytest.param(with_tool("docker", {"sha256": "z" * 64}), id="docker-digest-not-hex"),
        pytest.param(with_tool("docker", {"sha256": "a" * 63}), id="docker-digest-short"),
        pytest.param(with_tool("docker", {"version": ""}), id="docker-version-empty"),
        pytest.param(with_tool("docker", {"version": None}), id="docker-version-unread"),
        pytest.param(with_tool("docker", {"version": 29}), id="docker-version-untyped"),
        pytest.param(without_tool_key("docker", "version"), id="docker-version-absent"),
        pytest.param(with_tool("docker", {"digest": "a" * 64}), id="docker-extra-key"),
        pytest.param(with_tool("probe", {"path": "/bin/nc"}), id="probe-path-drift"),
        pytest.param(with_tool("probe", {"sha256": "a" * 64}), id="probe-digest-drift"),
        pytest.param(with_tool("probe", {"sha256": None}), id="probe-digest-unread"),
        pytest.param(with_tool("probe", {"argv": "-z -w 5"}), id="probe-argv-string"),
        pytest.param(with_tool("probe", {"argv": None}), id="probe-argv-unread"),
        pytest.param(with_tool("probe", {"argv": ["-z"]}), id="probe-argv-drift"),
        pytest.param(without_tool_key("probe", "argv"), id="probe-argv-absent"),
        pytest.param(
            grant_authorization(
                {
                    **documents.grant_document(),
                    "tools": {"docker": documents.grant_document()["tools"]["docker"]},
                }
            ),
            id="probe-tool-absent",
        ),
        pytest.param(
            grant_authorization({**documents.grant_document(), "tools": {}}),
            id="no-tool-pinned",
        ),
    ],
)
def test_a_grant_that_does_not_pin_both_executables_exactly_aborts(
    preparation, abort, authorization
) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, authorization)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize(
    "authorization",
    [
        pytest.param(
            with_identity("selected_image_identity", {"pull_policy": "always"}),
            id="pull-policy-drift",
        ),
        pytest.param(
            with_identity("selected_image_identity", {"pull_policy": None}),
            id="pull-policy-unread",
        ),
        pytest.param(
            with_identity("selected_image_identity", {"repository": "postgresql"}),
            id="repository-drift",
        ),
        pytest.param(
            with_identity("selected_image_identity", {"tag": "17-alpine"}), id="tag-drift"
        ),
        pytest.param(
            with_identity("selected_image_identity", {"index_digest": "sha256:zz"}),
            id="index-digest-malformed",
        ),
        pytest.param(
            with_identity("selected_image_identity", {"platform": {"os": "linux"}}),
            id="platform-inventory-drift",
        ),
        pytest.param(
            with_identity(
                "selected_image_identity",
                {"platform": {"os": "", "architecture": "arm64", "variant": None}},
            ),
            id="platform-os-empty",
        ),
        pytest.param(
            with_identity(
                "selected_image_identity",
                {"platform": {"os": "linux", "architecture": "arm64", "variant": ""}},
            ),
            id="platform-variant-empty",
        ),
        pytest.param(
            with_identity("observed_image_identity", {"local_image_id": "not-an-image-id"}),
            id="local-image-id-malformed",
        ),
        pytest.param(
            with_identity("observed_image_identity", {"local_image_id": None}),
            id="local-image-id-unread",
        ),
        pytest.param(
            with_identity("observed_image_identity", {"observed_at": "2026-08-05 00:00:00"}),
            id="observed-at-not-an-instant",
        ),
        pytest.param(
            with_identity("observed_image_identity", {"observed_at": None}),
            id="observed-at-unread",
        ),
        pytest.param(
            with_identity("observed_image_identity", {"pull_policy": fakes.PULL_POLICY}),
            id="host-identity-claims-a-policy",
        ),
    ],
)
def test_a_grant_identity_that_is_not_the_reviewed_selection_aborts(
    preparation, abort, authorization
) -> None:
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, authorization)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)


# ---------------------------------------------------------------------------
# Refusal coverage: the observed host (retained cases plus the stale-observation control)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "adapters",
    [
        lambda: fakes.passing_adapters(identities=None),
        lambda: fakes.passing_adapters(
            identities={fakes.SUITE_CONTROL: {"commit": "0" * 40, "clean": True}}
        ),
        lambda: fakes.passing_adapters(image=None),
        lambda: fakes.passing_adapters(ephemeral_range=None),
        lambda: fakes.passing_adapters(ephemeral_range=(10000, 20000)),
        lambda: fakes.passing_adapters(listeners=((fakes.LOOPBACK_LISTENER,),)),
        lambda: fakes.passing_adapters(platform=None),
        lambda: fakes.passing_adapters(docker_digest=None),
        lambda: fakes.passing_adapters(docker_digest="0" * 64),
        lambda: fakes.passing_adapters(probe_digest=None),
        lambda: fakes.passing_adapters(probe_digest="0" * 64),
        lambda: fakes.passing_adapters(publications=("127.0.0.1:15433",)),
        lambda: fakes.passing_adapters(ephemeral_range=(65535, 49152)),
        lambda: fakes.passing_adapters(ephemeral_range=(0, 65535)),
        lambda: fakes.passing_adapters(ephemeral_range=(49152, 65536)),
        lambda: fakes.passing_adapters(ephemeral_range=(True, 65535)),
        lambda: fakes.passing_adapters(ephemeral_range=("49152", "65535")),
        lambda: fakes.passing_adapters(ephemeral_range=(49152,)),
        lambda: fakes.passing_adapters(ephemeral_range="49152-65535"),
        lambda: fakes.passing_adapters(listeners=("listening",)),
        lambda: fakes.passing_adapters(publications="127.0.0.1"),
        lambda: fakes.passing_adapters(publications=None),
        lambda: fakes.passing_adapters(listeners=(None,)),
        lambda: fakes.passing_adapters(docker_digest="A" * 64),
        lambda: fakes.passing_adapters(probe_digest=fakes.PROBE_EXECUTABLE_SHA256.upper()),
    ],
)
def test_any_unresolved_or_mismatched_precondition_aborts_before_consumption(
    preparation, abort, adapters
) -> None:
    current = adapters()
    with pytest.raises(abort):
        prepare(preparation, current)
    assert not set(current.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize(
    "patch",
    [
        # A dirty worktree, whichever control repository reports it.
        {fakes.SUITE_CONTROL: {"clean": False}},
        {fakes.FABRIC_CONTROL: {"clean": False}},
        # An unresolved cleanliness observation is not a clean worktree.
        {fakes.SOC_CONTROL: {"clean": None}},
        # A tree that drifts from the reviewed content, on the reviewed commit.
        {fakes.AI_CONTROL: {"tree": "0" * 40}},
        {fakes.SUITE_CONTROL: {"tree": fakes.SYNTHETIC_SOC_TREE}},
        # A control identity that reports no tree at all cannot witness content.
        {fakes.SOC_CONTROL: {"tree": None}},
        # A merely truthy cleanliness flag is not an observed clean worktree.
        {fakes.AI_CONTROL: {"clean": 1}},
        # A commit that drifts from the authorization and the grant.
        {fakes.FABRIC_CONTROL: {"commit": "0" * 40}},
        {fakes.SUITE_CONTROL: {"commit": None}},
        # A whole repository that was never observed.
        {fakes.SOC_CONTROL: None},
    ],
)
def test_control_worktree_drift_or_uncleanliness_aborts_before_consumption(
    preparation, abort, patch
) -> None:
    """The git tree and status outputs must both change the verdict, never be ignored."""
    current = fakes.passing_adapters(identities=fakes.control_identities(patch))
    with pytest.raises(abort):
        prepare(preparation, current)
    assert not set(current.log.names()) & set(FORBIDDEN_EFFECTS)


def test_the_clean_control_fixture_reports_commit_tree_and_cleanliness(preparation) -> None:
    identities = fakes.control_identities()
    assert set(identities) == set(fakes.EXPECTED_CONTROLS)
    for name, identity in identities.items():
        assert set(identity) == {"commit", "tree", "clean"}
        assert identity["commit"] == fakes.EXPECTED_CONTROLS[name]
        assert identity["tree"] == fakes.EXPECTED_TREES[name]
        assert identity["clean"] is True
    assert prepare(preparation, fakes.passing_adapters(identities=identities)).satisfied


@pytest.mark.parametrize(
    "image",
    [
        fakes.host_image(index_digest=fakes.SYNTHETIC_OTHER_INDEX_DIGEST),
        fakes.host_image(manifest_digest=fakes.SYNTHETIC_OTHER_MANIFEST_DIGEST),
        fakes.host_image(platform=dict(fakes.OTHER_IMAGE_PLATFORM)),
        fakes.host_image(index_digest=None),
        fakes.host_image(manifest_digest=None),
        fakes.host_image(platform=None),
        fakes.host_image(present=False),
        fakes.host_image(local_image_id=None),
        fakes.host_image(present=1),
        fakes.host_image(repository="postgresql"),
        fakes.host_image(tag="17-alpine"),
        fakes.host_image(observed_at="2026-08-05 00:00:00"),
        fakes.host_image(observed_at=None),
        documents.without_field(fakes.host_image(), "observed_at"),
        {**fakes.host_image(), "pull_policy": fakes.PULL_POLICY},
    ],
)
def test_a_host_image_that_is_not_exactly_the_selected_identity_aborts(
    preparation, abort, image
) -> None:
    current = fakes.passing_adapters(image=image)
    with pytest.raises(abort):
        prepare(preparation, current)
    assert not set(current.log.names()) & set(FORBIDDEN_EFFECTS)


def test_a_host_observation_older_than_the_signed_grant_aborts(preparation, abort) -> None:
    """A reading taken before the grant was written describes a host nobody re-checked."""
    current = fakes.passing_adapters(image=fakes.host_image(observed_at=STALE_OBSERVED_AT))
    with pytest.raises(abort):
        prepare(preparation, current)
    assert not set(current.log.names()) & set(FORBIDDEN_EFFECTS)


@pytest.mark.parametrize("observed_at", [fakes.IMAGE_OBSERVED_AT, FRESH_OBSERVED_AT])
def test_a_host_observation_at_or_after_the_signed_grant_is_accepted(
    preparation, observed_at
) -> None:
    """The stable identity still excludes `observed_at`: the two readings are never equal."""
    result = prepare(
        preparation, fakes.passing_adapters(image=fakes.host_image(observed_at=observed_at))
    )
    assert result.satisfied is True
    assert result.image["observed_at"] == observed_at


def test_unresolved_selected_image_identity_aborts_without_host_mutation(
    preparation, abort
) -> None:
    document = documents.with_nested(
        documents.grant_document(),
        "selected_image_identity",
        {"index_digest": None, "manifest_digest": None, "platform": None},
    )
    auth = documents.authorization(
        grant=document,
        grant_bytes=documents.canonical_bytes(document),
    )
    adapters = fakes.passing_adapters()
    with pytest.raises(abort):
        prepare(preparation, adapters, auth)
    assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)
