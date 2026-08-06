"""Read-only preparation must prove every pre-consumption fact or abort cleanly."""

from __future__ import annotations

import copy
from collections.abc import Mapping, Sequence
from dataclasses import fields as dataclass_fields
from dataclasses import replace
from itertools import product
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

# The key under which both the live host reading and the signed observation state an instant.
OBSERVED_AT = "observed_at"

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
        "granted_image_identity": MappingProxyType(
            {
                key: MappingProxyType(value) if isinstance(value, dict) else value
                for key, value in documents.grant_document()[
                    "observed_image_identity"
                ].items()
            }
        ),
        "granted_observed_at": fakes.IMAGE_OBSERVED_AT,
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
            "granted_image_identity",
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


class ItemsRefusesToAnswer(dict):
    """A read-only field whose stored entries will not be handed over at all."""

    def items(self):
        raise RuntimeError("this mapping will not be read")


def test_a_top_level_field_that_refuses_to_be_read_refuses_as_a_value_error(
    preparation,
) -> None:
    """F141: `__post_init__` states one refusal type, and a field's `.items()` may not escape it.

    Every other unprovable value reaches the caller as `ValueError`. A `mappingproxy` delegates
    `.items()` to the mapping beneath it, so a field that refuses iteration reached the caller
    as `RuntimeError` instead — past every `except ValueError` written against this contract.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    with pytest.raises(ValueError):
        result_type(
            **{**result_fields(), "image": MappingProxyType(ItemsRefusesToAnswer())}
        )


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


# ---------------------------------------------------------------------------
# The pinned instant a satisfied result names its authorization with
# ---------------------------------------------------------------------------
# Everything that is not the exact UTC instant the grant signed for its host observation. The
# field is not decoration: `runner.attempt_id_for` renders the single authorized attempt's name
# out of it, so a result carrying any of these is a satisfied snapshot that names no attempt,
# and the disagreement would surface only once that one attempt had been spent. `MutableStr` is
# included because `frozen()` refuses safe-scalar subclasses outright (`preparation.py:125-133`)
# while a subclass still parses as an instant — a snapshot documented as a complete immutable
# record may not hold one value the same module would refuse to copy.
UNPINNED_INSTANTS = (
    pytest.param("", id="empty"),
    pytest.param("   ", id="whitespace"),
    pytest.param("2026-08-05T00:00:00Z ", id="trailing-space"),
    pytest.param("not-an-instant", id="prose"),
    pytest.param("2026-08-05T00:00:00+00:00", id="offset-instead-of-z"),
    pytest.param("2026-13-05T00:00:00Z", id="impossible-month"),
    pytest.param("2026-8-5T00:00:00Z", id="unpadded-fields"),
    pytest.param("20260805T000000Z", id="already-rendered"),
    pytest.param(None, id="never-observed"),
    pytest.param(20260805000000, id="not-a-string"),
    pytest.param(MutableStr(fakes.IMAGE_OBSERVED_AT), id="str-subclass"),
)


@pytest.mark.parametrize("pinned", UNPINNED_INSTANTS)
def test_a_satisfied_result_may_not_record_a_pin_that_names_no_attempt(
    preparation, pinned
) -> None:
    result_type = require_c8_attr(preparation, "PreparationResult")
    with pytest.raises(ValueError):
        result_type(**{**result_fields(), "granted_observed_at": pinned})


def test_the_pinned_instant_is_mandatory_rather_than_defaulted(preparation) -> None:
    """A satisfied result must *name* its authorization, not fall back to naming nothing.

    A default made "no pin was proved" a constructible state of a class whose one documented
    state is a proof. Nothing ever constructed it deliberately — `snapshot()` always copies the
    grant's signed instant — so the default's only reachable consumers were direct constructions
    that meant to state a pin and silently did not.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    proved = {
        name: value
        for name, value in result_fields().items()
        if name != "granted_observed_at"
    }
    with pytest.raises(TypeError):
        result_type(**proved)


def test_a_satisfied_result_keeps_the_exact_instant_the_authorization_signed(
    preparation,
) -> None:
    """A positive control: the reviewed instant must construct and survive unaltered."""
    result_type = require_c8_attr(preparation, "PreparationResult")
    result = result_type(**result_fields())
    assert result.granted_observed_at == fakes.IMAGE_OBSERVED_AT
    assert type(result.granted_observed_at) is str


def test_the_result_field_inventory_is_exactly_the_proved_field_set(preparation) -> None:
    """Pin the inventory, so a twelfth field cannot arrive unvalidated and unnoticed.

    This is the control whose absence let `granted_observed_at` be added to the class without
    `result_fields()` or any coherence parametrisation noticing. It mirrors the inventory pin
    `tests/test_admission.py:803` already holds over the independent fact record.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    names = tuple(field.name for field in dataclass_fields(result_type))
    assert names == tuple(result_fields())


def test_the_pinned_instant_reaches_the_snapshot_from_the_signed_document(
    preparation,
) -> None:
    """The proved path must produce the instant the grant signed, not a live host reading.

    Driven through a host that answers *later* than the grant signed, which preparation
    admits. While the fakes carried a single `observed_at` the two candidate sources were the
    same string, so this test could not tell them apart and sourcing the pin from the live
    observation changed nothing it asserted. The divergence is the whole control: only one of
    the two instants below can be the recorded pin, and it must be the signed one.
    """
    adapters = fakes.passing_adapters(
        image=fakes.host_image(observed_at=fakes.LATER_HOST_OBSERVED_AT)
    )
    assert fakes.LATER_HOST_OBSERVED_AT != fakes.IMAGE_OBSERVED_AT
    result = prepare(preparation, adapters)
    assert result.image[OBSERVED_AT] == fakes.LATER_HOST_OBSERVED_AT
    assert result.granted_observed_at == fakes.IMAGE_OBSERVED_AT


# Well-formed UTC instants that the authorization never signed. Each is exactly the forgery
# the shape-only pin admitted: a copy of a *proved* result carrying a pin the grant does not
# state, which `runner.attempt_id_for` then renders the one authorized attempt's name out of,
# and from which every container, network, volume and credential name derives. The near
# misses matter as much as the epoch: a pin one second off the signed instant is the shape a
# clock skew or a re-render produces, and it names a different attempt just as completely.
FORGED_INSTANTS = (
    pytest.param("1970-01-01T00:00:00Z", id="epoch"),
    pytest.param("0001-01-01T00:00:00Z", id="year-one"),
    pytest.param("2026-08-04T23:59:59Z", id="one-second-before"),
    pytest.param("2026-08-05T00:00:01Z", id="one-second-after"),
    pytest.param("9999-12-31T23:59:59Z", id="far-future"),
)


@pytest.mark.parametrize("forged", FORGED_INSTANTS)
def test_a_proved_result_may_not_be_copied_with_a_pin_the_authorization_never_signed(
    preparation, forged
) -> None:
    """The pin must *agree* with the signed observation, not merely parse as an instant.

    A result is the record of what was proved, and it is copied — by `dataclasses.replace`
    and by anything that reconstructs one — outside the one function that wired it. Validating
    only the pin's shape leaves agreement resting on `snapshot()`'s literal wiring, which no
    copy goes through, so a satisfied "complete proof" can name an attempt nobody authorized.
    """
    result = prepare(preparation)
    # The control is vacuous unless the forgery really is a different instant.
    assert result.granted_observed_at != forged
    with pytest.raises(ValueError):
        replace(result, granted_observed_at=forged)


def test_a_proved_result_may_not_be_copied_with_a_reading_older_than_its_own_pin(
    preparation,
) -> None:
    """The ordering `prepare` proved must hold in the record, not only during the check.

    `image_findings` refuses a host read before the grant signed, but that judgement lives in
    `prepare`. A copy that keeps the signed pin and substitutes an older reading describes a
    host nobody re-checked, and nothing in the result said so.
    """
    result = prepare(preparation)
    stale = MappingProxyType({**dict(result.image), OBSERVED_AT: STALE_OBSERVED_AT})
    assert STALE_OBSERVED_AT < result.granted_observed_at
    with pytest.raises(ValueError):
        replace(result, image=stale)


@pytest.mark.parametrize("forged", FORGED_INSTANTS)
def test_the_pin_and_the_signed_identity_it_was_drawn_from_may_not_disagree(
    preparation, forged
) -> None:
    """Agreement is one property, so moving either side of it must refuse just the same.

    Rewriting the carried identity rather than the pin is the same forgery approached from
    the other end: it would leave a result whose pin is not the instant its own signed host
    observation states. A check that only read the pin would not see it at all.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    identity = MappingProxyType(
        {**dict(result_fields()["granted_image_identity"]), OBSERVED_AT: forged}
    )
    with pytest.raises(ValueError):
        result_type(**{**result_fields(), "granted_image_identity": identity})


# ---------------------------------------------------------------------------
# The third accessor: `Mapping.get`, which nothing in this package reconciles
# ---------------------------------------------------------------------------
# Both instants `__post_init__` relates were bound through `Mapping.get`. That is a third
# protocol no reader here cross-checks: `keyed` iterates, and `views.stored_entries` reconciles
# `.items()` against `__getitem__` only. `MappingProxyType` over a `dict` *subclass* is exactly
# a `MappingProxyType` by `type()`, so it passes the read-only-mapping gate and the deep
# immutability proof, and `mappingproxy.get` delegates to the underlying mapping's own `get`
# while `dict.items` and `dict.__getitem__` are resolved in C and do not. A `dict` subclass
# overriding `get` alone therefore stores and subscripts one instant while answering this one
# comparison with another. Every consumer — `frozen`, `runner`'s attempt names, an auditor
# reading the field — records the instant it stores; the comparison saw the other one and found
# nothing to say. This is the same hole `observe.signed_identity_findings` closed on the
# bindings of both operands, left behind on the two instants.

# The instant the ledger measured this hole with: a pin the authorization never signed, out of
# which `runner.attempt_id_for` renders the one authorized attempt's whole name.
EPOCH_INSTANT = "1970-01-01T00:00:00Z"


def gets_another_instant(mapping: Mapping[str, Any], forged: str) -> MappingProxyType:
    """A mapping that *stores and subscripts* `forged` while its `.get` answers genuinely.

    The genuine answer is taken from the mapping the case starts from, so a refusal below is
    the control under test rather than a hand-built mapping that had drifted on some other key.
    """
    genuine = dict(mapping)

    class StoresOneInstantGetsAnother(dict):
        def get(self, key: str, default: Any = None) -> Any:
            if key == OBSERVED_AT:
                return genuine[OBSERVED_AT]
            return super().get(key, default)

    return MappingProxyType(StoresOneInstantGetsAnother({**genuine, OBSERVED_AT: forged}))


@pytest.mark.parametrize(
    ("field", "forged"),
    [
        pytest.param("granted_image_identity", EPOCH_INSTANT, id="signed-identity"),
        pytest.param("image", STALE_OBSERVED_AT, id="live-reading"),
    ],
)
def test_a_mapping_that_gets_one_instant_and_stores_another_passes_every_other_gate(
    preparation, field, forged
) -> None:
    """The premise of the two refusals below, asserted rather than assumed.

    If the construction did not pass the read-only-mapping gate, the deep immutability proof
    and the two views `stored_entries` reconciles, the refusals below would prove nothing about
    which accessor the instants are read through.
    """
    liar = gets_another_instant(result_fields()[field], forged)
    assert type(liar) is MappingProxyType
    assert dict(liar.items())[OBSERVED_AT] == forged
    assert liar[OBSERVED_AT] == forged
    assert liar.get(OBSERVED_AT) == fakes.IMAGE_OBSERVED_AT, (
        "premise: `.get` must answer the genuine instant, or the case is vacuous"
    )
    assert require_c8_attr(load_c8("views"), "immutability_findings")(liar, field) == ()
    _, divergence = require_c8_attr(load_c8("views"), "stored_entries")(liar, field)
    assert divergence == (), (
        "premise: the two cross-checked views agree, so only the third protocol admits this"
    )
    # The reader `__post_init__` actually runs, asserted rather than inferred from the two
    # above: it too must accept this mapping whole, and record what it *stores*.
    copied, proof_findings, proof_divergence = require_c8_attr(
        load_c8("views"), "proved_copy"
    )(liar, field)
    assert (proof_findings, proof_divergence) == ((), ())
    assert dict(copied)[OBSERVED_AT] == forged


def test_the_pin_is_judged_against_the_instant_the_signed_identity_stores(
    preparation,
) -> None:
    """The pin must agree with what the identity holds, not with what it answers one caller.

    An identity that stores and subscripts the epoch while its `.get` answers the signed
    instant was accepted whole: the pin comparison passed, `signed_identity_findings` had
    nothing to say — `observed_at` is excluded from the binding keys, being two events — and
    the satisfied result then carried a `granted_observed_at` its own signed observation does
    not state. `runner.attempt_id_for` renders the attempt name from the pin while every
    auditor reading the identity sees the epoch.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    identity = gets_another_instant(result_fields()["granted_image_identity"], EPOCH_INSTANT)
    with pytest.raises(ValueError):
        recorded = result_type(**{**result_fields(), "granted_image_identity": identity})
        raise AssertionError(
            "a satisfied result bound granted_observed_at "
            f"{recorded.granted_observed_at!r} to a signed identity that stores "
            f"{dict(recorded.granted_image_identity.items())[OBSERVED_AT]!r}"
        )


def test_the_ordering_is_judged_against_the_instant_the_live_reading_stores(
    preparation,
) -> None:
    """The freshness ordering must judge the reading the result records, not a third answer.

    The mirror of the case above on the other operand. A reading that stores and subscripts an
    instant *before* the signed observation, while its `.get` answers one at it, satisfied the
    ordering check and was then recorded — so a satisfied result described a host nobody
    re-checked after the grant was signed, which is exactly what this comparison exists to
    refuse.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    reading = gets_another_instant(result_fields()["image"], STALE_OBSERVED_AT)
    # The control is vacuous unless the stored reading really is older than the pin.
    assert STALE_OBSERVED_AT < fakes.IMAGE_OBSERVED_AT
    with pytest.raises(ValueError):
        recorded = result_type(**{**result_fields(), "image": reading})
        raise AssertionError(
            "a satisfied result pinned to "
            f"{recorded.granted_observed_at!r} recorded a live reading that stores the older "
            f"{dict(recorded.image.items())[OBSERVED_AT]!r}"
        )


# ---------------------------------------------------------------------------
# Validate-then-record: the recorded field is a live accessor, not the value that was judged
# ---------------------------------------------------------------------------
# Every reader `__post_init__` runs snapshots what a mapping stores and reconciles that against
# the subscript — but each snapshot is a *local* dict, and the dataclass field keeps the
# caller's live mapping object. Nothing binds read k to read k+1. So a mapping that answers
# every protocol honestly for exactly as many reads as validation spends, and hostilely
# afterwards, is accepted with `satisfied=True` while the recorded field goes on to hand
# attacker-controlled content to the live consumption path. No value the validator read was
# ever false, no instant was moved and no field value changed: the whole bypass is the ordering
# of the record against the check. Closing one accessor would leave the others, because what is
# defective is not which view is trusted but that the recorded object can still answer at all.
ATTACKER_REPOSITORY = "attacker/exfil"
ATTACKER_MANIFEST_DIGEST = "sha256:" + "e" * 64

# A budget no validation could reach, used only to measure how many reads validation spends.
UNREACHABLE_READ_BUDGET = 10**6


class ReadBudgetMapping(dict):
    """Honest for exactly `budget` protocol reads, then answering out of `hostile` instead.

    All four protocols a reader in this package can reach are budgeted together — `.items()`,
    `__iter__`, `__getitem__` and `.get` — so no single accessor is the trick, and every one of
    them is genuine for the whole of validation.
    """

    def __init__(
        self, entries: Mapping[str, Any], hostile: Mapping[str, Any], budget: int
    ) -> None:
        super().__init__(entries)
        self.hostile = dict(hostile)
        self.budget = budget
        self.reads = 0

    def _exhausted(self) -> bool:
        self.reads += 1
        return self.reads > self.budget

    def items(self):
        return self.hostile.items() if self._exhausted() else super().items()

    def __iter__(self):
        return iter(self.hostile) if self._exhausted() else super().__iter__()

    def __getitem__(self, key):
        return self.hostile[key] if self._exhausted() else super().__getitem__(key)

    def get(self, key, default=None):
        return (
            self.hostile.get(key, default)
            if self._exhausted()
            else super().get(key, default)
        )


def budgeted_field(name: str, budget: int) -> tuple[MappingProxyType, ReadBudgetMapping]:
    """One live field mapping that turns hostile after `budget` reads, and its backing dict.

    `MappingProxyType` over a `dict` *subclass* is exactly a `MappingProxyType` by `type()`, so
    this clears the declared read-only-mapping gate and the deep immutability proof.
    """
    genuine = dict(result_fields()[name])
    backing = ReadBudgetMapping(
        genuine,
        {
            **genuine,
            "repository": ATTACKER_REPOSITORY,
            "manifest_digest": ATTACKER_MANIFEST_DIGEST,
        },
        budget,
    )
    return MappingProxyType(backing), backing


def honest_image_reference() -> str:
    genuine = result_fields()["image"]
    return f"{genuine['repository']}@{genuine['manifest_digest']}"


ATTACKER_IMAGE_REFERENCE = f"{ATTACKER_REPOSITORY}@{ATTACKER_MANIFEST_DIGEST}"


def build_with_budgets(
    result_type: Any, budgets: Mapping[str, int]
) -> tuple[Any, dict[str, MappingProxyType], dict[str, ReadBudgetMapping]]:
    """Construct one result with each named field budgeted, or let its `ValueError` out."""
    fields = dict(result_fields())
    proxies: dict[str, MappingProxyType] = {}
    backings: dict[str, ReadBudgetMapping] = {}
    for name, budget in budgets.items():
        proxy, backing = budgeted_field(name, budget)
        fields[name] = proxy
        proxies[name] = proxy
        backings[name] = backing
    return result_type(**fields), proxies, backings


def reads_spent(result_type: Any, names: Sequence[str]) -> dict[str, int]:
    """How many live protocol reads one construction spends on each named field."""
    _, _, backings = build_with_budgets(
        result_type, {name: UNREACHABLE_READ_BUDGET for name in names}
    )
    return {name: backing.reads for name, backing in backings.items()}


def sweep_every_budget(preparation, names: Sequence[str]) -> None:
    """No budget at all may leave a satisfied result naming the attempt from attacker content.

    The sweep is what makes this immune to read-count drift. Pinning one arithmetic coincidence
    — the budget that happens to equal what validation spends today — states only that a mapping
    staying honest throughout is copied. It says nothing about a mapping that straddles the
    reads, and straddling is the whole defect: a repair that merely moves the copy to a *later*
    live read is still bypassed by a caller budgeting up to that read. So every budget from the
    first read to the last is exercised, on the cartesian product of the named fields, and each
    outcome must be either a refusal or an honest name. `image` and `granted_image_identity` are
    swept together because flipping the reading alone is caught by `signed_identity_findings`
    comparing it against the pin: an attacker simply flips both so the two agree on its content.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    namer = require_c8_attr(load_c8("runner"), "_attempt_names")
    honest = honest_image_reference()
    assert honest != ATTACKER_IMAGE_REFERENCE

    spent = reads_spent(result_type, names)
    assert all(count > 0 for count in spent.values()), (
        f"premise: validation must read every swept field at all, spent {spent!r}"
    )
    exhausted = False
    for combination in product(*(range(1, spent[name] + 1) for name in names)):
        budgets = dict(zip(names, combination, strict=True))
        try:
            result, proxies, backings = build_with_budgets(result_type, budgets)
        except ValueError:
            exhausted = True
            continue
        assert result.satisfied is True
        rendered = namer(result).image_reference
        assert rendered == honest, (
            f"budgets {budgets!r}: a satisfied result handed the one authorized attempt the "
            f"image reference {rendered!r}, though every value validation read was the genuine "
            f"{honest!r}"
        )
        for name, proxy in proxies.items():
            assert getattr(result, name) is not proxy, (
                f"budgets {budgets!r}: {name} is recorded as the caller's own live mapping, so "
                "nothing binds what was validated to what is consumed"
            )
        exhausted = exhausted or any(
            backing.reads > backing.budget for backing in backings.values()
        )
    assert exhausted, (
        "premise: at least one budget in the sweep must actually be exhausted during "
        "construction, or every case is vacuously honest"
    )


def test_a_satisfied_result_may_not_record_a_mapping_that_can_still_answer(
    preparation,
) -> None:
    """What was validated must be what is recorded, not a live handle onto the same reads.

    The verdict is taken through the live consumption path — `runner._attempt_names` renders the
    image reference the one authorized attempt is created from — so this asserts an authority
    bypass, not merely that two objects are aliases.
    """
    sweep_every_budget(preparation, ("image",))


def test_a_satisfied_result_may_not_record_two_mappings_that_can_still_agree_later(
    preparation,
) -> None:
    """The pin and the reading budgeted together, which is the variant that defeats the drift.

    Flipping the reading alone is refused because the pin still states the genuine binding. Both
    flipping at their own last read is the real attack, and it is the one a repair that copies by
    a further live read cannot survive.
    """
    sweep_every_budget(preparation, ("image", "granted_image_identity"))


def test_a_result_still_records_a_dead_copy_of_an_honest_reading(preparation) -> None:
    """The premise of the sweep: an honest mapping is accepted, and not kept as a live alias."""
    result_type = require_c8_attr(preparation, "PreparationResult")
    proxy, backing = budgeted_field("image", UNREACHABLE_READ_BUDGET)
    result = result_type(**{**result_fields(), "image": proxy})
    assert result.satisfied is True
    assert backing.reads > 0
    assert result.image is not proxy
    assert dict(result.image) == dict(result_fields()["image"])


# ---------------------------------------------------------------------------
# Ingress copy: the observation that was judged must be the observation that is recorded
# ---------------------------------------------------------------------------
# The sweeps above drive `PreparationResult` directly, and that is exactly why they cannot see
# this: they prove the constructor judges and copies out of one read, but `prepare` is one
# frame further up. `observe` takes each of the eight readings through a guard that does not
# copy, so the live adapter-returned object survives ingress. `observation_findings` then
# judges that live object, and `snapshot` later calls `frozen` on the *same* live object — a
# second, unrelated read whose answer is what becomes the record. An adapter returning a
# mapping that is honest for exactly as many reads as the findings spend and hostile
# afterwards therefore raises no finding and is then recorded out of the hostile read, with
# `satisfied=True`. The constructor never sees the divergence: by the time it runs, the
# attacker's answer is the only answer there is.
#
# What is swept is the security property, not a read count: for every budget, `prepare` must
# either refuse or return a result in which no attacker-supplied value appears anywhere. A
# repair that merely moves the copy to a *later* live read still fails this, because the sweep
# simply budgets up to that read.
ATTACKER_COMMIT = "b" * 40
ATTACKER_TREE = "c" * 40
ATTACKER_ENGINE_VERSION = "0.0.0-attacker"

# Every value only a hostile read can produce. No honest read of the fakes returns one, so
# finding any of them anywhere in a satisfied snapshot is unambiguous.
ATTACKER_VALUES = frozenset(
    {
        ATTACKER_COMMIT,
        ATTACKER_TREE,
        ATTACKER_ENGINE_VERSION,
        ATTACKER_REPOSITORY,
        ATTACKER_MANIFEST_DIGEST,
    }
)

# Budgets are the number of honest reads, swept from zero — a reading already hostile when
# `prepare` first touches it — up to at least this many. The ceiling comfortably covers every
# straddle reproduced through `observe_controls` and `observe_platform`, and it keeps the
# sweep meaningful after a repair that lowers the number of live reads: a budget above what is
# spent simply never turns hostile. Zero is what keeps the exhaustion premise below reachable
# once no straddle exists any more, because a reading taken exactly once can still be hostile
# on that one read — and then it must be refused, having been judged on what it recorded.
MINIMUM_OBSERVATION_SWEEP = 40


def budgeted_controls(budget: int) -> ReadBudgetMapping:
    """A control inventory reporting the granted worktrees, then the attacker's."""
    genuine = fakes.control_identities()
    hostile = {
        name: {"commit": ATTACKER_COMMIT, "tree": ATTACKER_TREE, "clean": True}
        for name in genuine
    }
    return ReadBudgetMapping(genuine, hostile, budget)


def budgeted_image(budget: int) -> ReadBudgetMapping:
    """A host image reading answering the selected identity, then the attacker's."""
    genuine = fakes.host_image()
    hostile = {
        **genuine,
        "repository": ATTACKER_REPOSITORY,
        "manifest_digest": ATTACKER_MANIFEST_DIGEST,
    }
    return ReadBudgetMapping(genuine, hostile, budget)


def budgeted_platform(budget: int) -> ReadBudgetMapping:
    """Platform evidence stating the granted engine version, then the attacker's."""
    genuine = dict(fakes.DOCUMENTED_PLATFORM)
    hostile = {**genuine, "engine_version": ATTACKER_ENGINE_VERSION}
    return ReadBudgetMapping(genuine, hostile, budget)


def recorded_leaves(value: Any, path: str) -> tuple[tuple[str, Any], ...]:
    """Every leaf a frozen snapshot records, with the path it is recorded at."""
    if type(value) is MappingProxyType:
        return tuple(
            leaf
            for key, item in value.items()
            for leaf in recorded_leaves(item, f"{path}[{key!r}]")
        )
    if type(value) in (tuple, frozenset):
        return tuple(
            leaf
            for position, item in enumerate(value)
            for leaf in recorded_leaves(item, f"{path}[{position}]")
        )
    return ((path, value),)


def attacker_content(result: Any) -> tuple[str, ...]:
    """Every place a satisfied result records something only a hostile read could answer."""
    return tuple(
        f"{path} = {value!r}"
        for field in dataclass_fields(type(result))
        for path, value in recorded_leaves(getattr(result, field.name), field.name)
        if isinstance(value, str) and value in ATTACKER_VALUES
    )


def observation_reads_spent(preparation, observation: str, build: Any) -> int:
    """How many live protocol reads one whole `prepare` spends on that one observation."""
    reading = build(UNREACHABLE_READ_BUDGET)
    result = prepare(preparation, fakes.passing_adapters(**{observation: reading}))
    assert result.satisfied is True, (
        f"premise: an honest {observation} reading must still satisfy the phase"
    )
    return reading.reads


@pytest.mark.parametrize(
    ("observation", "build"),
    [
        pytest.param("identities", budgeted_controls, id="observe_controls"),
        pytest.param("image", budgeted_image, id="observe_image"),
        pytest.param("platform", budgeted_platform, id="observe_platform"),
    ],
)
def test_no_observation_may_answer_the_record_differently_than_the_findings(
    preparation, abort, observation, build
) -> None:
    """One reading, judged and recorded, whatever a hostile adapter budgets its honesty to.

    This drives `prepare` rather than `PreparationResult`, because the bypass is in the caller:
    the constructor's own proof is real and complete, and is handed the attacker's content
    already as fact. The verdict is taken over the whole snapshot — every field, every nested
    leaf — so it states the security property directly and not which accessor was trusted.
    """
    spent = observation_reads_spent(preparation, observation, build)
    assert spent > 0, f"premise: prepare must read {observation} at all, spent {spent}"
    exhausted = False
    for budget in range(max(spent, MINIMUM_OBSERVATION_SWEEP) + 1):
        reading = build(budget)
        adapters = fakes.passing_adapters(**{observation: reading})
        try:
            result = prepare(preparation, adapters)
        except abort:
            exhausted = exhausted or reading.reads > reading.budget
            continue
        assert result.satisfied is True
        recorded = attacker_content(result)
        assert recorded == (), (
            f"budget {budget}: {observation} answered every read the findings spent honestly "
            f"and turned hostile afterwards, and a satisfied preparation recorded "
            f"{list(recorded)!r}"
        )
        assert not set(adapters.log.names()) & set(FORBIDDEN_EFFECTS)
        exhausted = exhausted or reading.reads > reading.budget
    assert exhausted, (
        f"premise: at least one budget in the sweep must actually be exhausted while preparing "
        f"{observation}, or every case is vacuously honest"
    )


# ---------------------------------------------------------------------------
# What a copy of a proved result can, and cannot, establish about the signed observation
# ---------------------------------------------------------------------------
# The pin check above relates two caller-supplied fields to each other, so a copy that moves
# both sides at once satisfies it. The controls below raise the price of an invented signed
# observation: it must carry the whole reviewed identity inventory, every value resolved and
# well formed, and it must reproduce the live reading's binding on every key. None of them
# establishes that the identity is the one an authorization actually signed — no copy holds
# that document — and that residual is stated in the module comment on the field, not implied.

# Well-formed values that are simply not the ones the fakes observed, so a copy carrying one
# is refused by the comparison under test rather than by a shape check that would fire anyway.
UNOBSERVED_INDEX_DIGEST = "sha256:" + "9" * 64
UNOBSERVED_MANIFEST_DIGEST = "sha256:" + "a" * 64
UNOBSERVED_IMAGE_ID = "sha256:" + "b" * 64

# Every key on which the signed host observation and the live reading state one same binding.
# `observed_at` is deliberately absent: the two instants are two different events.
FORGED_BINDINGS = (
    pytest.param("repository", "postgres-forged", id="repository"),
    pytest.param("tag", "16-alpine-forged", id="tag"),
    pytest.param(
        "platform", MappingProxyType(dict(fakes.OTHER_IMAGE_PLATFORM)), id="platform"
    ),
    pytest.param("index_digest", UNOBSERVED_INDEX_DIGEST, id="index_digest"),
    pytest.param("manifest_digest", UNOBSERVED_MANIFEST_DIGEST, id="manifest_digest"),
    pytest.param("local_image_id", UNOBSERVED_IMAGE_ID, id="local_image_id"),
)


@pytest.mark.parametrize(("key", "forged"), FORGED_BINDINGS)
def test_a_proved_result_may_not_carry_a_reading_that_drifts_from_the_signed_binding(
    preparation, key, forged
) -> None:
    """The record must state one image, not two that merely sit in the same object.

    `image_findings` compares the live reading against the granted host identity, but that
    judgement lives in `prepare`, which no copy goes through. A result whose reading and whose
    signed identity name different material is a satisfied proof of nothing: `runner`'s attempt
    names render the image reference out of `image`, while the pin is drawn from the identity.
    """
    result = prepare(preparation)
    # The control is vacuous unless the forgery really is a different binding.
    assert result.image[key] != forged
    with pytest.raises(ValueError):
        replace(result, image=MappingProxyType({**dict(result.image), key: forged}))


@pytest.mark.parametrize(("key", "forged"), FORGED_BINDINGS)
def test_a_proved_result_may_not_carry_a_signed_identity_that_drifts_from_the_reading(
    preparation, key, forged
) -> None:
    """Agreement is one property, so moving the identity's side of it must refuse too."""
    result = prepare(preparation)
    assert result.granted_image_identity[key] != forged
    with pytest.raises(ValueError):
        replace(
            result,
            granted_image_identity=MappingProxyType(
                {**dict(result.granted_image_identity), key: forged}
            ),
        )


# Mappings that are not a signed host observation of the reviewed image, each still deeply
# immutable and each still stating the exact instant the pin names, so what refuses them is
# the identity's own shape and nothing else.
STUB_IDENTITIES = (
    pytest.param(
        MappingProxyType({OBSERVED_AT: fakes.IMAGE_OBSERVED_AT}), id="one-key-stub"
    ),
    pytest.param(MappingProxyType({}), id="empty"),
    pytest.param(
        MappingProxyType(
            {
                key: value
                for key, value in result_fields()["granted_image_identity"].items()
                if key != "local_image_id"
            }
        ),
        id="missing-local-image-id",
    ),
    pytest.param(
        MappingProxyType(
            {**dict(result_fields()["granted_image_identity"]), "signer": "cybrik"}
        ),
        id="unreviewed-extra-key",
    ),
    pytest.param(
        MappingProxyType(
            {**dict(result_fields()["granted_image_identity"]), "local_image_id": None}
        ),
        id="unresolved-image-id",
    ),
    pytest.param(
        MappingProxyType(
            {
                **dict(result_fields()["granted_image_identity"]),
                "index_digest": "not-a-digest",
            }
        ),
        id="malformed-digest",
    ),
)


@pytest.mark.parametrize("identity", STUB_IDENTITIES)
def test_a_satisfied_result_may_not_call_a_bare_stub_a_signed_host_observation(
    preparation, identity
) -> None:
    """A field documented as the signed observation must carry one, or carry nothing.

    Reading only `observed_at` out of it made every other key optional, so a "signed host
    observation" could name no repository, no digest and no host image id at all. That is not
    evidence anyone could compare anything against; it is a container for one instant.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    with pytest.raises(ValueError):
        result_type(**{**result_fields(), "granted_image_identity": identity})


@pytest.mark.parametrize("forged", FORGED_INSTANTS)
def test_a_two_field_copy_may_not_invent_the_signed_observation_it_pins_itself_to(
    preparation, forged
) -> None:
    """Moving both sides of an agreement is how an agreement between two fields is defeated.

    This is the exact shape the previous pin check missed: the copy rewrites the identity and
    the pin together, so they still agree with each other while agreeing with nothing that was
    proved. It cannot be closed here — `__post_init__` holds no authorization to compare
    against — but an invented identity must at least fail to be a reviewed observation.
    """
    result = prepare(preparation)
    with pytest.raises(ValueError):
        replace(
            result,
            granted_image_identity=MappingProxyType({OBSERVED_AT: forged}),
            granted_observed_at=forged,
        )


# The key under which the live reading answers whether the reviewed material is on this host.
PRESENT = "present"

# Live readings that are not a whole host observation of material this host holds. Each one
# still states the reviewed instant and still agrees with the signed identity on every one of
# the six binding keys, so what refuses the copy is the reading's own inventory or its own
# presence answer — nothing that would have fired anyway.
INCOMPLETE_READINGS = (
    pytest.param({PRESENT: False}, id="present-false"),
    pytest.param({PRESENT: None}, id="present-unread"),
    pytest.param({PRESENT: 1}, id="present-truthy-not-true"),
    pytest.param({PRESENT: "yes"}, id="present-truthy-string"),
    pytest.param({"signer": "cybrik"}, id="unreviewed-extra-key"),
)


@pytest.mark.parametrize("patch", INCOMPLETE_READINGS)
def test_a_proved_result_may_not_carry_a_reading_that_denies_its_own_material(
    preparation, patch
) -> None:
    """The record must not assert a proof its own reading contradicts.

    `image_findings` requires the reading to carry exactly the reviewed inventory and to say
    `present is True`, but that judgement lives in `prepare`, which no copy goes through. A
    copy that flips `present` to False keeps every binding key agreeing, so the signed-identity
    comparison saw nothing wrong, and `runner` strips `present` before recording — so a
    satisfied result could state that the reviewed image is not on the host it rehearsed on and
    the evidence record would never carry the contradiction.
    """
    result = prepare(preparation)
    reading = MappingProxyType({**dict(result.image), **patch})
    # The control is vacuous unless the patch really changed the reading. Equality would not
    # say so: `1 == True`, and a truthy stand-in for a flag is exactly one of the cases here.
    assert any(
        key not in result.image or reading[key] is not result.image[key] for key in patch
    )
    with pytest.raises(ValueError):
        replace(result, image=reading)


def test_a_proved_result_may_not_carry_a_reading_with_no_presence_answer(
    preparation,
) -> None:
    """Dropping the key must refuse exactly as answering it wrongly does.

    A reading that never answers is not a reading that answered yes. Checking only the value
    would leave the whole control bypassable by deleting one key.
    """
    result = prepare(preparation)
    assert PRESENT in result.image
    reading = MappingProxyType(
        {key: value for key, value in result.image.items() if key != PRESENT}
    )
    with pytest.raises(ValueError):
        replace(result, image=reading)


def test_a_genuine_proved_result_is_still_copyable_unchanged(preparation) -> None:
    """The positive control: the reading `prepare` proved must survive being copied.

    Without this, a check that refused every reading would look exactly as green as one that
    refuses only the readings that contradict themselves.
    """
    result = prepare(preparation)
    copied = replace(result, image=MappingProxyType(dict(result.image)))
    assert copied.satisfied is True
    assert copied.image[PRESENT] is True
    assert dict(copied.image) == dict(result.image)


@pytest.mark.parametrize(
    "identity",
    [
        pytest.param(
            dict(result_fields()["granted_image_identity"]), id="live-mapping"
        ),
        pytest.param(
            MappingProxyType(
                {
                    **dict(result_fields()["granted_image_identity"]),
                    "platform": dict(fakes.IMAGE_PLATFORM),
                }
            ),
            id="nested-live-mapping",
        ),
    ],
)
def test_the_signed_identity_is_deep_frozen_by_the_validator_not_only_by_the_snapshot(
    preparation, identity
) -> None:
    """Pin the enforcement, not the artefact `snapshot()` already froze.

    Asserting that a `prepare()` result is immutable proves `frozen()` works; it says nothing
    about whether the field is in `FROZEN_MAPPING_FIELDS`. Every value here is a coherent
    signed observation in every other respect, so only the field's presence in that inventory
    refuses it — dropping the name from the tuple makes both of these construct.
    """
    result_type = require_c8_attr(preparation, "PreparationResult")
    with pytest.raises(ValueError):
        result_type(**{**result_fields(), "granted_image_identity": identity})


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


def test_an_uncopyable_value_in_an_unreviewed_grant_section_aborts_at_ingress(
    preparation, abort
) -> None:
    """The ingress copy covers the whole grant, not only the sections this phase compares.

    `topology` is not one of the four sections preparation compares the observed host
    against — admission owns those semantics — but it still travels inside the projection
    later phases receive. A value there with no dead copy is therefore refused at ingress,
    before the injected surface is checked and before any of the eight observations is taken,
    rather than being carried past this phase as mutable authorization state nobody proved.
    The refusal names the projection and the copy, and quotes neither the offending value nor
    the copier's own message, so the reason stays bounded.
    """
    adapters = fakes.passing_adapters()
    authorization = grant_authorization(
        documents.with_nested(
            documents.grant_document(), "topology", {"host_ip": CustomMutable()}
        )
    )
    with pytest.raises(abort) as raised:
        prepare(preparation, adapters, authorization)
    reason = str(raised.value)
    assert "authorization grant" in reason
    assert "while being copied" in reason
    assert "ValueError" in reason
    assert CustomMutable.__name__ not in reason, "the refused value is not quoted back"
    assert adapters.log.names() == (), "ingress precedes every observation"


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
