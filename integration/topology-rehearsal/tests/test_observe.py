"""Fail-closed reductions over the five publication views and internal network."""

from __future__ import annotations

import ast
import dataclasses
from types import MappingProxyType

import documents
import fakes
import pytest
from conftest import C8_MODULES, PACKAGE, SRC, load_c8, require_c8_attr

# The names of the one decoded listener record's keys. They are read off the protocol
# boundary rather than spelled here, so this suite cannot itself become the second place a
# listener key is typed.
LISTENER_RECORD_KEY_NAMES = (
    "LISTENER_ADDRESS_KEY",
    "LISTENER_PORT_KEY",
    "LISTENER_PROTOCOL_KEY",
)


@pytest.fixture(name="observe")
def observe_module():
    return load_c8("observe")


@pytest.fixture(name="errors")
def errors_module():
    return load_c8("errors")


@pytest.fixture(name="protocols")
def protocols_module():
    return load_c8("protocols")


def call(observe, name: str, *args, **kwargs):
    return require_c8_attr(observe, name)(*args, **kwargs)


def string_constants(module: str) -> tuple[str, ...]:
    """Every string literal an authored module types, read from its own source."""
    path = SRC / PACKAGE / f"{module}.py"
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    return tuple(
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    )


def publication_inputs(**overrides):
    """The four agreeing publication views, with any one of them replaced.

    The agreeing set is written once. A per-case copy would let the *passing* baseline drift
    between cases, so a control could pass because its baseline had quietly weakened rather
    than because the reduction refused the one view under test.
    """
    inputs = {
        "daemon_event": fakes.OBSERVED_PUBLICATION,
        "container": fakes.container_projection(),
        "docker_port": fakes.OBSERVED_PUBLICATION,
        "listeners": (fakes.LOOPBACK_LISTENER,),
    }
    inputs.update(overrides)
    return inputs


def port_binding(**overrides):
    """One `PortBindings` entry for the reviewed container port."""
    return {"HostIp": fakes.HOST_IP, "HostPort": str(fakes.HOST_PORT), **overrides}


def test_all_five_exact_publication_views_reduce_to_one_agreement(observe) -> None:
    verdict = call(
        observe,
        "validate_publication",
        daemon_event=fakes.OBSERVED_PUBLICATION,
        container=fakes.container_projection(),
        docker_port=fakes.OBSERVED_PUBLICATION,
        listeners=(fakes.LOOPBACK_LISTENER,),
    )
    assert verdict.satisfied is True
    assert verdict.findings == ()
    assert tuple(verdict.views) == fakes.PUBLICATION_VIEWS


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("daemon_event", "0.0.0.0:15433"),
        ("docker_port", ":::15433"),
        ("listeners", ()),
        ("listeners", (fakes.WILDCARD_LISTENER,)),
        ("listeners", (fakes.IPV6_LISTENER,)),
        ("container", fakes.container_projection(bindings={})),
        ("container", fakes.container_projection(ports={})),
    ],
)
def test_any_missing_ambiguous_or_wildcard_publication_view_fails_closed(
    observe, field: str, value
) -> None:
    verdict = call(observe, "validate_publication", **publication_inputs(**{field: value}))
    assert verdict.satisfied is False
    assert verdict.findings


def test_internal_network_requires_internal_true_and_exactly_one_attachment(observe) -> None:
    assert call(
        observe, "validate_internal_network", fakes.network_projection()
    ).satisfied is True
    for projection in (
        fakes.network_projection(internal=False),
        fakes.network_projection(containers={}),
        fakes.network_projection(containers={"a": {}, "b": {}}),
        None,
    ):
        assert call(observe, "validate_internal_network", projection).satisfied is False


def test_health_and_probe_must_both_be_exactly_positive(observe) -> None:
    assert call(observe, "validate_internal_ingress", "healthy", "reachable").satisfied
    for health, probe in ((None, "reachable"), ("starting", "reachable"), ("healthy", None), ("healthy", "refused")):
        assert not call(observe, "validate_internal_ingress", health, probe).satisfied


def test_image_observation_keeps_registry_and_local_identities_separate(observe) -> None:
    selected = documents.grant_document()["selected_image_identity"]
    observed = documents.grant_document()["observed_image_identity"]
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied
    assert observed["local_image_id"] not in {
        selected["index_digest"],
        selected["manifest_digest"],
    }


@pytest.mark.parametrize("key", ("index_digest", "manifest_digest", "platform"))
def test_an_unresolved_selected_identity_fails_closed(observe, key: str) -> None:
    selected = dict(documents.grant_document()["selected_image_identity"])
    observed = dict(documents.grant_document()["observed_image_identity"])
    selected[key] = None
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied is False
    assert "unresolved" in " ".join(verdict.findings).lower()


@pytest.mark.parametrize(
    ("key", "host_value"),
    (
        ("index_digest", fakes.SYNTHETIC_OTHER_INDEX_DIGEST),
        ("manifest_digest", fakes.SYNTHETIC_OTHER_MANIFEST_DIGEST),
        ("platform", dict(fakes.OTHER_IMAGE_PLATFORM)),
    ),
)
def test_a_resolved_host_image_disagreeing_with_the_selection_fails_closed(
    observe, key: str, host_value
) -> None:
    """Both sides resolved and different is a mismatch, not an unresolved value."""
    selected = dict(documents.grant_document()["selected_image_identity"])
    observed = dict(documents.grant_document()["observed_image_identity"])
    observed[key] = host_value
    assert selected[key] is not None and observed[key] is not None
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied is False
    assert any(key in finding for finding in verdict.findings)
    assert "unresolved" not in " ".join(verdict.findings).lower()


@pytest.mark.parametrize("key", ("index_digest", "manifest_digest", "platform"))
def test_an_unresolved_host_observation_is_never_read_as_agreement(
    observe, key: str
) -> None:
    selected = dict(documents.grant_document()["selected_image_identity"])
    observed = dict(documents.grant_document()["observed_image_identity"])
    observed[key] = None
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied is False
    assert verdict.findings


def test_a_differing_local_image_id_is_never_read_as_a_disagreement(observe) -> None:
    """The host's local image id is an observation, not a second opinion on the selection.

    A local id names bytes on one host and can never equal a registry digest, so comparing
    it against the selection would turn every correct observation into a mismatch. The
    stated separation is behavioural here, not a property of one fixture.
    """
    selected = documents.grant_document()["selected_image_identity"]
    observed = dict(documents.grant_document()["observed_image_identity"])
    observed["local_image_id"] = fakes.D2_OBSERVED_IMAGE_ID
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied is True
    assert verdict.findings == ()


def test_the_selection_only_pull_policy_is_never_demanded_of_a_host_observation(
    observe,
) -> None:
    """`pull_policy` is a rule for the attempt, not something a host can report."""
    selected = documents.grant_document()["selected_image_identity"]
    observed = documents.grant_document()["observed_image_identity"]
    assert "pull_policy" in selected and "pull_policy" not in observed
    assert call(observe, "validate_image_identity", selected, observed).satisfied is True


def test_every_publication_verdict_reports_all_five_views_read_only(observe) -> None:
    """A refusal must still say what each of the five views actually showed.

    A verdict that dropped its views on failure would leave a reader with a refusal and no
    way to see which projection disagreed, which is the whole reason the five are compared.
    """
    verdict = call(
        observe,
        "validate_publication",
        **publication_inputs(
            daemon_event=None, container=None, docker_port=None, listeners=()
        ),
    )
    assert verdict.satisfied is False
    assert tuple(verdict.views) == fakes.PUBLICATION_VIEWS
    assert all(observed is None for observed in verdict.views.values())
    with pytest.raises(TypeError):
        verdict.views["daemon_event"] = fakes.OBSERVED_PUBLICATION


def test_each_publication_finding_names_the_exact_view_that_refused(observe) -> None:
    verdict = call(observe, "validate_publication", **publication_inputs(listeners=()))
    assert verdict.findings
    assert all(finding.startswith("host_listener") for finding in verdict.findings)


@pytest.mark.parametrize(
    "overrides",
    (
        {"listeners": (fakes.LOOPBACK_LISTENER, fakes.LOOPBACK_LISTENER)},
        {"container": fakes.container_projection(
            bindings={fakes.CONTAINER_PORT_KEY: [port_binding(), port_binding()]}
        )},
        {"container": fakes.container_projection(
            ports={fakes.CONTAINER_PORT_KEY: [port_binding(), port_binding()]}
        )},
    ),
)
def test_a_second_listener_or_binding_is_ambiguous_and_fails_closed(
    observe, overrides
) -> None:
    """Two claims for one reviewed port is an ambiguity, not a doubled agreement."""
    verdict = call(observe, "validate_publication", **publication_inputs(**overrides))
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize(
    "listener",
    (
        {"address": fakes.HOST_IP, "port": fakes.HOST_PORT + 1, "protocol": fakes.PORT_PROTOCOL},
        {"address": fakes.HOST_IP, "port": fakes.HOST_PORT, "protocol": "udp"},
        {"address": fakes.HOST_IP, "port": str(fakes.HOST_PORT), "protocol": fakes.PORT_PROTOCOL},
        {"address": fakes.HOST_IP, "port": True, "protocol": fakes.PORT_PROTOCOL},
        {"address": "", "port": fakes.HOST_PORT, "protocol": fakes.PORT_PROTOCOL},
        {"port": fakes.HOST_PORT, "protocol": fakes.PORT_PROTOCOL},
        fakes.HOST_IP,
    ),
)
def test_a_listener_that_is_not_the_reviewed_binding_fails_closed(
    observe, listener
) -> None:
    """A near-miss listener is not the reviewed publication.

    `port=True` is stated deliberately: `bool` is an `int` in Python, so a flag handed back
    instead of a port would compare equal to `1` and could be read as a real reading.
    """
    verdict = call(observe, "validate_publication", **publication_inputs(listeners=(listener,)))
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize(
    "container",
    (
        None,
        "",
        (),
        {"HostConfig": None, "NetworkSettings": None},
        fakes.container_projection(bindings={fakes.CONTAINER_PORT_KEY: ()}),
        fakes.container_projection(bindings={fakes.CONTAINER_PORT_KEY: [{}]}),
        fakes.container_projection(
            bindings={fakes.CONTAINER_PORT_KEY: [port_binding(HostPort=fakes.HOST_PORT)]}
        ),
        fakes.container_projection(
            bindings={fakes.CONTAINER_PORT_KEY: [port_binding(HostIp=None)]}
        ),
        fakes.container_projection(bindings={fakes.CONTAINER_PORT_KEY: port_binding()}),
    ),
)
def test_a_malformed_container_projection_fails_closed_rather_than_raising(
    observe, container
) -> None:
    """A projection is injected, so its shape is never guaranteed and never assumed."""
    verdict = call(observe, "validate_publication", **publication_inputs(container=container))
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize(
    "projection",
    (
        fakes.network_projection(internal=1),
        fakes.network_projection(internal="true"),
        fakes.network_projection(containers=()),
        {"Internal": True},
        "",
        (),
    ),
)
def test_a_network_projection_that_is_not_exactly_the_reviewed_shape_fails_closed(
    observe, projection
) -> None:
    """`Internal` must be exactly `True`; a merely truthy flag is not an isolated network."""
    verdict = call(observe, "validate_internal_network", projection)
    assert verdict.satisfied is False
    assert verdict.findings


def test_every_refusal_carries_its_own_exact_terminal_class(observe, errors) -> None:
    """A reducer names the terminal class its refusal belongs to; no caller re-decides it."""
    error_for = require_c8_attr(errors, "error_for")
    refusals = (
        (
            call(
                observe,
                "validate_publication",
                **publication_inputs(
                    daemon_event=None, container=None, docker_port=None, listeners=()
                ),
            ),
            "PublicationFailure",
        ),
        (call(observe, "validate_internal_network", None), "StopControl"),
        (call(observe, "validate_internal_ingress", None, None), "InternalIngressFailure"),
        (call(observe, "validate_image_identity", None, None), "PrecheckAbort"),
    )
    for verdict, expected in refusals:
        assert verdict.satisfied is False
        assert error_for(verdict.outcome) is require_c8_attr(errors, expected)


def test_a_satisfied_verdict_names_no_terminal_class(observe) -> None:
    verdict = call(observe, "validate_internal_ingress", "healthy", "reachable")
    assert verdict.satisfied is True
    assert verdict.outcome is None


@pytest.mark.parametrize(
    "fields",
    (
        {"satisfied": True, "findings": ("host_listener: refused",)},
        {"satisfied": True, "outcome": fakes.FAIL_PUBLICATION},
        {"satisfied": False},
        {"satisfied": False, "findings": ("host_listener: refused",)},
        {"satisfied": False, "outcome": fakes.FAIL_PUBLICATION},
        {"satisfied": False, "findings": ("",), "outcome": fakes.FAIL_PUBLICATION},
        {
            "satisfied": False,
            "findings": ("host_listener: refused",),
            "outcome": fakes.TOPOLOGY_PASS,
        },
        {
            "satisfied": False,
            "findings": ["host_listener: refused"],
            "outcome": fakes.FAIL_PUBLICATION,
        },
    ),
)
def test_an_incoherent_verdict_cannot_be_constructed(observe, fields) -> None:
    """A satisfied refusal, an unexplained one and a passing failure class are all refused.

    The consistency is enforced at construction rather than trusted, because a verdict is
    the evidence a later phase reads: one that said `satisfied` while carrying findings
    would let a refused observation be recorded as a satisfied control.
    """
    verdict_type = require_c8_attr(observe, "ObservationVerdict")
    with pytest.raises(ValueError):
        verdict_type(**fields)


def test_a_coherent_verdict_is_immutable(observe) -> None:
    verdict_type = require_c8_attr(observe, "ObservationVerdict")
    verdict = verdict_type(
        satisfied=False,
        findings=("host_listener: refused",),
        outcome=fakes.FAIL_PUBLICATION,
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        verdict.satisfied = True


@pytest.mark.parametrize(
    "projection",
    (
        None,
        "",
        (),
        {"Internal": True},
        fakes.network_projection(internal=False),
        fakes.network_projection(internal=1),
        fakes.network_projection(internal="true"),
        fakes.network_projection(containers={}),
        fakes.network_projection(containers=()),
        fakes.network_projection(containers={"a": {}, "b": {}}),
    ),
)
def test_an_unresolved_non_internal_or_ambiguous_network_is_a_stop_control(
    observe, errors, projection
) -> None:
    """Diagnosis section 8 maps non-internal or multiple attachments to `STOP_CONTROL`.

    An unresolved projection is the same refusal read one step earlier: a network nobody
    could read is not a network anybody proved internal, and classifying it as a diagnostic
    ingress failure would report a failed control invariant as a failed reachability probe.
    """
    verdict = call(observe, "validate_internal_network", projection)
    assert verdict.satisfied is False
    assert verdict.findings
    assert verdict.outcome == fakes.STOP_CONTROL
    assert require_c8_attr(errors, "error_for")(verdict.outcome) is require_c8_attr(
        errors, "StopControl"
    )


@pytest.mark.parametrize(
    ("health", "probe"),
    (
        (None, "reachable"),
        ("starting", "reachable"),
        ("healthy", None),
        ("healthy", "refused"),
    ),
)
def test_only_the_bounded_host_probe_reduction_keeps_the_internal_ingress_class(
    observe, errors, health, probe
) -> None:
    """`FAIL_INTERNAL_INGRESS` is the healthy container the bounded probe could not reach.

    Section 8 reserves the class for exactly that reading, so it stays on this reduction and
    is not lent to the network control that now classifies as `STOP_CONTROL`.
    """
    verdict = call(observe, "validate_internal_ingress", health, probe)
    assert verdict.satisfied is False
    assert verdict.outcome == fakes.FAIL_INTERNAL_INGRESS
    assert require_c8_attr(errors, "error_for")(verdict.outcome) is require_c8_attr(
        errors, "InternalIngressFailure"
    )


def test_a_network_control_refusal_outranks_every_diagnostic_refusal(observe, errors) -> None:
    """Precedence is not weakened by the reclassification: the control invariant still wins."""
    network = call(
        observe, "validate_internal_network", fakes.network_projection(internal=False)
    )
    publication = call(observe, "validate_publication", **publication_inputs(listeners=()))
    ingress = call(observe, "validate_internal_ingress", "healthy", None)
    candidates = (publication.outcome, network.outcome, ingress.outcome)
    resolve = require_c8_attr(errors, "resolve_outcome")
    assert resolve(candidates) == fakes.STOP_CONTROL
    assert resolve(tuple(reversed(candidates))) == fakes.STOP_CONTROL


def test_the_internal_ingress_error_docstring_does_not_conflate_network_and_probe(
    errors,
) -> None:
    """The typed class must describe the one reading it is now reserved for."""
    error = require_c8_attr(errors, "InternalIngressFailure")
    assert error.outcome == fakes.FAIL_INTERNAL_INGRESS
    docstring = error.__doc__
    assert isinstance(docstring, str) and docstring.strip()
    assert "network attachment" not in docstring


@pytest.mark.parametrize("view", ("bindings", "ports"))
@pytest.mark.parametrize(
    "inventory",
    (
        # The reviewed binding agrees, but a second port is published beside it.
        {fakes.CONTAINER_PORT_KEY: [port_binding()], "5433/tcp": [port_binding()]},
        {
            fakes.CONTAINER_PORT_KEY: [port_binding()],
            f"{fakes.CONTAINER_PORT}/udp": [port_binding()],
        },
        # A malformed key inventory: the reviewed port spelled without its protocol, with
        # the wrong protocol case, or as an integer the daemon never emits.
        {"5432": [port_binding()]},
        {f"{fakes.CONTAINER_PORT}/TCP": [port_binding()]},
        {fakes.CONTAINER_PORT: [port_binding()]},
        {fakes.CONTAINER_PORT_KEY: [port_binding()], "": [port_binding()]},
    ),
)
def test_a_binding_inventory_that_is_not_exactly_the_reviewed_key_fails_closed(
    observe, view: str, inventory
) -> None:
    """One reviewed key, and nothing else, may appear in a publication projection.

    A projection that also publishes another port is not the reviewed single mapping, even
    where the reviewed key itself agrees: section 7 item 6 requires the projection to contain
    *only* the reviewed binding, so reading past the extra keys would accept a container with
    a second, unreviewed publication as a satisfied control.
    """
    verdict = call(
        observe, "validate_publication", **publication_inputs(
            container=fakes.container_projection(**{view: inventory})
        )
    )
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize("satisfied", (1, 0, "yes", None, (), 1.0))
def test_a_verdict_refuses_a_satisfied_flag_that_is_not_exactly_a_bool(
    observe, satisfied
) -> None:
    """`satisfied=1` is not a satisfied control.

    `True` is an `int` in Python, so a truthy stand-in would compare equal to the real flag
    and let an unread reduction be recorded as a passed one.
    """
    verdict_type = require_c8_attr(observe, "ObservationVerdict")
    with pytest.raises(ValueError):
        verdict_type(satisfied=satisfied)


@pytest.mark.parametrize(
    "views",
    (
        {},
        {"daemon_event": fakes.OBSERVED_PUBLICATION},
        None,
        (),
        [("daemon_event", None)],
    ),
)
def test_a_verdict_refuses_a_views_table_a_reader_could_mutate(observe, views) -> None:
    """Evidence a later phase reads may not be a mapping that phase could edit."""
    verdict_type = require_c8_attr(observe, "ObservationVerdict")
    with pytest.raises(ValueError):
        verdict_type(satisfied=True, views=views)


def test_a_verdict_keeps_its_views_exactly_read_only(observe) -> None:
    verdict_type = require_c8_attr(observe, "ObservationVerdict")
    verdict = verdict_type(
        satisfied=True,
        views=MappingProxyType({"daemon_event": fakes.OBSERVED_PUBLICATION}),
    )
    assert type(verdict.views) is MappingProxyType
    assert dict(verdict.views) == {"daemon_event": fakes.OBSERVED_PUBLICATION}
    with pytest.raises(TypeError):
        verdict.views["daemon_event"] = None


def test_the_claim_and_attachment_invariants_are_distinct_named_controls(observe) -> None:
    """One claim per view and one network attachment are two invariants, not one constant.

    They happen to be the same number today. Sharing a single name would make a later change
    to either of them silently change the other, so each reduction names its own.
    """
    claims = require_c8_attr(observe, "EXPECTED_VIEW_CLAIM_COUNT")
    attachments = require_c8_attr(observe, "EXPECTED_NETWORK_ATTACHMENT_COUNT")
    assert claims == 1
    assert attachments == 1
    assert not hasattr(observe, "EXPECTED_CLAIM_COUNT"), "the shared name must be gone"


def test_the_listener_record_keys_are_typed_once_at_the_protocol_boundary(
    observe, protocols
) -> None:
    """The producer and the consumer of a listener record read the same key names.

    Two independently typed spellings would drift the moment one of them changed, and the
    reduction would then read `None` from a record the adapter believed it had filled.
    """
    for name in LISTENER_RECORD_KEY_NAMES:
        assert require_c8_attr(observe, name) is require_c8_attr(protocols, name)
    spellings = {require_c8_attr(protocols, name) for name in LISTENER_RECORD_KEY_NAMES}
    retyped = [value for value in string_constants("observe") if value in spellings]
    assert retyped == [], "the reduction must derive the keys, not re-type them"


def test_a_decoded_host_listener_is_read_by_the_publication_reduction(
    observe, protocols
) -> None:
    """The record the adapter decodes is exactly the record the reduction accepts."""
    decode = require_c8_attr(protocols, "decoded_listener")
    separator = require_c8_attr(protocols, "ADDRESS_SEPARATOR")
    listener = decode(f"{fakes.HOST_IP}{separator}{fakes.HOST_PORT}")
    assert listener is not None
    verdict = call(
        observe, "validate_publication", **publication_inputs(listeners=(listener,))
    )
    assert verdict.satisfied is True


def test_observation_module_exports_only_pure_reducers(observe) -> None:
    assert set(require_c8_attr(observe, "__all__")) == {
        "ObservationVerdict",
        "validate_image_identity",
        "validate_internal_ingress",
        "validate_internal_network",
        "validate_publication",
    }


def module_level_assignments(module: str) -> frozenset[str]:
    """Every name an authored module binds at its own top level, read from its source."""
    path = SRC / PACKAGE / f"{module}.py"
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    return frozenset(
        target.id
        for node in tree.body
        if isinstance(node, (ast.Assign, ast.AnnAssign))
        for target in (node.targets if isinstance(node, ast.Assign) else (node.target,))
        if isinstance(target, ast.Name)
    )


def test_the_observation_module_never_rebinds_a_name_the_grant_already_owns() -> None:
    """One name, one meaning, package-wide.

    `grant` is the single owner of the reviewed key inventories. When `observe` binds one of
    those names again at its own top level, the same identifier denotes two different tuples
    depending on which module a reader imported it from, and a later `from .observe import
    OBSERVED_IDENTITY_KEYS` silently receives the narrower one. That is not a style point: it
    is exactly the defect that refused every genuine identity when a validated function moved
    into this module. Aliasing the import around the collision leaves the collision standing,
    so the collision itself is what this pins.
    """
    grant = load_c8("grant")
    owned = frozenset(
        name
        for name in vars(grant)
        if name.isupper() and not name.startswith("_")
    )
    collisions = sorted(module_level_assignments("observe") & owned)
    assert collisions == [], (
        "observe re-binds names the grant already owns: "
        f"{collisions}; import them instead of typing them again"
    )


def test_the_signed_identity_inventory_is_the_grant_inventory_itself(observe) -> None:
    """The tuple this module checks a signed identity against must be grant's own object.

    Equality is not enough. Two tuples that happen to agree today drift apart the moment a
    key is added to one inventory, and the drift is silent because both sides still validate.
    """
    grant = load_c8("grant")
    assert require_c8_attr(observe, "OBSERVED_IDENTITY_KEYS") is require_c8_attr(
        grant, "OBSERVED_IDENTITY_KEYS"
    )


# The names of the host reading's own inventory. They are the third inventory the signed
# identity reduction reads, and unlike the two grant-owned ones they were declared in
# `preparation`, which `observe` cannot import from without a cycle. Each consumer below must
# receive the one declared object rather than re-type an agreeing copy of it.
HOST_READING_KEY_NAMES = ("PRESENT_KEY", "HOST_IMAGE_KEYS")

# Every module that reads one of those names, and the name it reads.
HOST_READING_CONSUMERS = (
    ("preparation", "PRESENT_KEY"),
    ("preparation", "HOST_IMAGE_KEYS"),
    ("runner", "PRESENT_KEY"),
)


def test_the_host_reading_inventory_is_declared_in_exactly_one_module() -> None:
    """One name, one meaning, for the host reading's keys as much as the identity's.

    The signed identity reduction must judge the live reading's own inventory, and the module
    that does the judging cannot import from `preparation` — `preparation` imports from it. A
    second local declaration would be the same collision the test above pins, so the single
    declaration site is what this pins, together with each consumer reading that one object.
    """
    declaring = sorted(
        module
        for module in C8_MODULES
        if module_level_assignments(module) & frozenset(HOST_READING_KEY_NAMES)
    )
    assert declaring == ["observe"], (
        f"the host reading keys are declared in {declaring}; exactly one module may type them"
    )
    observe = load_c8("observe")
    for module, name in HOST_READING_CONSUMERS:
        assert require_c8_attr(load_c8(module), name) is require_c8_attr(observe, name), (
            f"{module}.{name} must be observe's own object, not an agreeing copy"
        )


def signed_pair(**image_overrides):
    """The grant's signed host observation and the agreeing live reading it names.

    Both sides are written once from the shared documents, so a case below is refused by the
    control under test rather than by a baseline that had quietly drifted out of agreement.
    """
    identity = MappingProxyType(
        dict(documents.grant_document()["observed_image_identity"])
    )
    return identity, MappingProxyType(fakes.host_image(**image_overrides))


def test_a_signed_identity_agreeing_with_a_whole_host_reading_is_accepted(observe) -> None:
    """The positive control: a genuine pair must still reduce to no findings at all."""
    identity, image = signed_pair()
    assert call(observe, "signed_identity_findings", identity, image) == ()


# Live readings that are not a whole host observation of material this host holds. Every one
# of them agrees with the signed identity on all six binding keys, so what refuses them is the
# reading's own inventory or its own `present` flag and nothing else.
INCOMPLETE_HOST_READINGS = (
    pytest.param({"present": False}, id="present-false"),
    pytest.param({"present": None}, id="present-unread"),
    pytest.param({"present": 1}, id="present-truthy-not-true"),
    pytest.param({"present": "yes"}, id="present-truthy-string"),
)


@pytest.mark.parametrize("override", INCOMPLETE_HOST_READINGS)
def test_a_signed_identity_is_refused_against_a_reading_that_denies_the_material(
    observe, override
) -> None:
    """A reading that does not say the material is here cannot prove an identity of it.

    The reduction compared the six binding keys but never read `present`, so a reading whose
    own answer was "not on this host" still agreed on every key it was asked about. The result
    then asserted a satisfied proof of an image its own reading said it did not hold.
    """
    identity, image = signed_pair(**override)
    findings = call(observe, "signed_identity_findings", identity, image)
    assert findings, "a reading that denies the material must be refused"


def test_a_signed_identity_is_refused_against_a_reading_missing_its_presence_answer(
    observe,
) -> None:
    """Dropping the key is the same failure as answering it wrongly, not a way around it."""
    identity, image = signed_pair()
    partial = MappingProxyType(
        {key: value for key, value in image.items() if key != "present"}
    )
    findings = call(observe, "signed_identity_findings", identity, partial)
    assert findings, "a reading with no presence answer must be refused"


def test_a_signed_identity_is_refused_against_a_reading_carrying_an_unreviewed_key(
    observe,
) -> None:
    """The reading's whole inventory is reviewed, so an extra claim is refused as well.

    An unreviewed key is a claim nobody read. Accepting it here while `image_findings` refuses
    it at `prepare()` time would make the two judgements of the same field disagree.
    """
    identity, image = signed_pair()
    extended = MappingProxyType({**dict(image), "signer": "cybrik"})
    findings = call(observe, "signed_identity_findings", identity, extended)
    assert findings, "an unreviewed key in the reading must be refused"


# ---------------------------------------------------------------------------
# One field, one protocol: a reading may not answer the presence control one thing and
# store another
# ---------------------------------------------------------------------------
# `MappingProxyType` over a `dict` *subclass* is exactly a `MappingProxyType` by `type()`, so
# it satisfies every declared read-only-mapping gate without going near the sanctioned
# `object.__setattr__` hatch. The subclass may still overload `__getitem__`, and the presence
# control read the answer through that one accessor while the inventory check reads by
# iteration, the binding comparison reads through `.get`, and `runner._observed_identity`
# records what `.items()` yields. Three protocols over one field is a hole: the reading that
# every consumer stores as "not on this host" answered the control "yes".


class SubscriptLiar(dict):
    """A reading that stores one presence answer and subscripts as another."""

    def __getitem__(self, key: str):
        if key == "present":
            return True
        return super().__getitem__(key)


class SubscriptRefuser(dict):
    """A reading that stores a whole presence answer but refuses to be subscripted for it.

    `dict.get` and `dict.items` are resolved in C and do not route through an overridden
    `__getitem__`, so this stores and yields exactly what the fakes state while the one
    accessor the control used raises.
    """

    def __getitem__(self, key: str):
        if key == "present":
            raise KeyError(key)
        return super().__getitem__(key)


def proved_result():
    """One genuinely proved `PreparationResult`, wired by `prepare` and not by hand."""
    preparation = load_c8("preparation")
    return require_c8_attr(preparation, "prepare")(
        documents.authorization(), fakes.passing_adapters()
    )


def test_a_lying_reading_satisfies_every_declared_type_gate(observe) -> None:
    """The premise of the two tests below, asserted rather than assumed.

    If the construction did not pass the type gate, the inventory check and the deep
    immutability proof, the refusals below would prove nothing about the presence control.
    """
    liar = MappingProxyType(SubscriptLiar(fakes.host_image(present=False)))
    assert type(liar) is MappingProxyType
    assert dict(liar.items())["present"] is False
    assert liar.get("present") is False
    assert liar["present"] is True
    keys = require_c8_attr(observe, "HOST_IMAGE_KEYS")
    assert call(observe, "keyed", liar, keys, "image", ordered=False) == ()


def test_a_reading_that_stores_a_denial_is_refused_however_it_subscripts(observe) -> None:
    """The stored answer is the answer: every consumer of the reading records that one."""
    liar = MappingProxyType(SubscriptLiar(fakes.host_image(present=False)))
    findings = call(observe, "local_presence_findings", liar, "image")
    assert findings, (
        "a reading storing present False must be refused whatever it answers a subscript"
    )


def test_a_signed_identity_is_refused_against_a_reading_that_stores_a_denial(
    observe,
) -> None:
    """The same hole through the reduction that judges the pinned identity."""
    identity, _ = signed_pair()
    liar = MappingProxyType(SubscriptLiar(fakes.host_image(present=False)))
    findings = call(observe, "signed_identity_findings", identity, liar)
    assert findings, "a reading that denies the material must be refused"


def test_a_proved_result_may_not_be_copied_with_a_reading_that_stores_a_denial() -> None:
    """The copy path the whole control exists for: `dataclasses.replace` on a proved result.

    A result asserting `satisfied is True` over a reading that *stores* "not on this host" is
    the exact forgery the presence control was added to refuse, and it must not be reachable
    by handing the same field a mapping subclass that answers one accessor differently.
    """
    result = proved_result()
    liar = MappingProxyType(SubscriptLiar({**dict(result.image), "present": False}))
    with pytest.raises(ValueError):
        dataclasses.replace(result, image=liar)


def test_an_unchanged_reading_may_still_be_copied_onto_a_proved_result() -> None:
    """The positive control: a check that refuses every copy has proved nothing."""
    result = proved_result()
    unchanged = MappingProxyType(dict(result.image))
    copied = dataclasses.replace(result, image=unchanged)
    assert copied.satisfied is True
    assert dict(copied.image) == dict(result.image)


def test_a_reading_whose_subscript_refuses_the_answer_reports_rather_than_raises(
    observe,
) -> None:
    """A reducer contracted to *return findings* may not throw an unbounded `KeyError`.

    Passing the inventory check does not make a mapping subscriptable — `keyed` only
    iterates — so the presence control cannot rest on it. The refusal is right; the
    unbounded exception class escaping a total reducer is not.
    """
    refuser = MappingProxyType(SubscriptRefuser(fakes.host_image()))
    findings = call(observe, "local_presence_findings", refuser, "image")
    assert findings, "a reading that will not answer the control must still be refused"


def test_a_proved_result_refuses_an_unreadable_reading_as_a_value_error() -> None:
    """`__post_init__` is documented and tested to refuse with `ValueError`.

    A caller catching `ValueError` around a copy would not catch a `KeyError`, so the
    refusal has to arrive as the class the constructor states.
    """
    result = proved_result()
    refuser = MappingProxyType(SubscriptRefuser(dict(result.image)))
    with pytest.raises(ValueError):
        dataclasses.replace(result, image=refuser)


# ---------------------------------------------------------------------------
# The same hole on the other operand: a signed identity may not answer the reduction one
# binding and store another
# ---------------------------------------------------------------------------
# `local_presence_findings` was closed against a *reading* whose subscript disagreed with
# what it stored. The pinned identity it is compared against was read the same way and left
# open: `signed_identity_findings` reads `identity[key]` at the unresolved check, at the
# registry-digest loop, at the platform check and at the binding comparison, while `keyed`
# validates that same mapping by iterating it and `preparation.__post_init__` reads its
# `observed_at` through `.get`. A `MappingProxyType` over a `dict` subclass is exactly a
# `MappingProxyType` by `type()`, so it passes the field's type gate and the deep
# immutability proof while overloading `__getitem__` — and an identity that *stores* a
# forged tag could answer the reduction the genuine one and be recorded as a proved pin.
#
# The subscript is kept as a cross-check rather than dropped, because `__getitem__` is a
# live protocol on this field elsewhere in the package: `runner._selected_identity` and
# `grant`'s own reductions read `mapping[key]`. Judging by iteration alone would accept a
# mapping whose subscript states something else entirely, which is a case this reduction
# already refuses today.


def lying_identity(identity, **forged):
    """A signed identity that *stores* `forged` while its subscript answers the genuine value.

    The forged entries are written once here rather than per case, so a case below is refused
    by the control under test and not by a hand-built mapping that had drifted.
    """
    genuine = dict(identity)

    class StoresOneBindingSubscriptsAnother(dict):
        def __getitem__(self, key: str):
            if key in forged:
                return genuine[key]
            return super().__getitem__(key)

    return MappingProxyType(
        StoresOneBindingSubscriptsAnother({**genuine, **forged})
    )


def unreadable_identity(identity, name: str):
    """A signed identity storing every genuine binding that refuses to be subscripted for one.

    `dict.get` and `dict.items` are resolved in C and do not route through an overridden
    `__getitem__`, so this stores and yields exactly what the grant signed while the one
    accessor the reduction used raises.
    """

    class RefusesToBeSubscripted(dict):
        def __getitem__(self, key: str):
            if key == name:
                raise KeyError(key)
            return super().__getitem__(key)

    return MappingProxyType(RefusesToBeSubscripted(dict(identity)))


class PlainIdentitySubclass(dict):
    """A `dict` subclass that overrides nothing at all.

    The positive control for the construction itself: if a proxy over a mapping *subclass*
    were refused outright, the refusals below would prove nothing about the subscript.
    """


def test_a_lying_signed_identity_satisfies_every_declared_type_gate(observe) -> None:
    """The premise of the refusals below, asserted rather than assumed."""
    identity, _ = signed_pair()
    liar = lying_identity(identity, tag="FORGED")
    assert type(liar) is MappingProxyType
    assert dict(liar.items())["tag"] == "FORGED"
    assert liar.get("tag") == "FORGED"
    assert liar["tag"] == dict(identity)["tag"]
    keys = require_c8_attr(observe, "OBSERVED_IDENTITY_KEYS")
    assert call(observe, "keyed", liar, keys, "granted_image_identity", ordered=False) == ()


# Forged bindings a signed identity may store while subscripting as the genuine one. Each is
# a value this reduction already refuses when it is read honestly, so what would admit it is
# the second accessor and nothing else.
FORGED_SIGNED_BINDINGS = (
    pytest.param({"tag": "FORGED"}, id="tag-forged"),
    pytest.param({"repository": "evil/repo"}, id="repository-forged"),
    pytest.param({"index_digest": "not-a-digest"}, id="index-digest-forged"),
    pytest.param({"manifest_digest": "not-a-digest"}, id="manifest-digest-forged"),
    pytest.param({"local_image_id": "junk"}, id="local-image-id-forged"),
    pytest.param({"platform": "junk"}, id="platform-forged"),
    pytest.param({"tag": None}, id="tag-unread"),
    pytest.param({"platform": None}, id="platform-unread"),
    pytest.param({"index_digest": None}, id="index-digest-unread"),
)


@pytest.mark.parametrize("forged", FORGED_SIGNED_BINDINGS)
def test_a_signed_identity_is_refused_by_what_it_stores_however_it_subscripts(
    observe, forged
) -> None:
    """The stored binding is the binding: it is what every consumer of this field records."""
    identity, image = signed_pair()
    findings = call(
        observe, "signed_identity_findings", lying_identity(identity, **forged), image
    )
    assert findings, (
        f"a signed identity storing {forged!r} must be refused whatever it subscripts as"
    )


def test_a_signed_identity_whose_subscript_states_another_binding_is_still_refused(
    observe,
) -> None:
    """The inverse case, which this reduction refused before and must go on refusing.

    `__getitem__` is a live protocol on this field elsewhere in the package, so an identity
    whose subscript answers something other than what it stores is a refusal in *either*
    direction. Reading by iteration alone would have re-admitted this one.
    """
    identity, image = signed_pair()
    genuine = dict(identity)

    class SubscriptsAForgedTag(dict):
        def __getitem__(self, key: str):
            if key == "tag":
                return "FORGED"
            return super().__getitem__(key)

    inverted = MappingProxyType(SubscriptsAForgedTag(genuine))
    findings = call(observe, "signed_identity_findings", inverted, image)
    assert findings, "an identity whose subscript states another binding must be refused"


def test_a_signed_identity_whose_subscript_refuses_a_binding_reports_rather_than_raises(
    observe,
) -> None:
    """A reducer contracted to *return findings* may not throw an unbounded `KeyError`.

    `keyed` only iterates, so passing it does not make a mapping subscriptable and this
    reduction cannot rest on it.
    """
    identity, image = signed_pair()
    findings = call(
        observe, "signed_identity_findings", unreadable_identity(identity, "tag"), image
    )
    assert findings, "an identity that will not answer must still be refused"


def test_a_signed_identity_agreeing_through_both_of_its_views_is_accepted(observe) -> None:
    """The positive control: a check that refuses every identity has proved nothing."""
    identity, image = signed_pair()
    assert call(observe, "signed_identity_findings", identity, image) == ()
    unchanged = MappingProxyType(dict(identity))
    assert call(observe, "signed_identity_findings", unchanged, image) == ()
    subclassed = MappingProxyType(PlainIdentitySubclass(dict(identity)))
    assert call(observe, "signed_identity_findings", subclassed, image) == ()


def test_a_proved_result_may_not_be_copied_with_an_identity_that_stores_a_forged_binding(
) -> None:
    """The copy path the pin exists for: `dataclasses.replace` on a proved result.

    A result asserting `satisfied is True` while *recording* a forged tag is the exact
    forgery this pin was added to refuse, and it must not be reachable by handing the field
    a mapping subclass that answers one accessor differently.
    """
    result = proved_result()
    liar = lying_identity(result.granted_image_identity, tag="FORGED")
    with pytest.raises(ValueError):
        dataclasses.replace(result, granted_image_identity=liar)


def test_an_unchanged_signed_identity_may_still_be_copied_onto_a_proved_result() -> None:
    """Positive control: the genuine pin must still copy and still be satisfied."""
    result = proved_result()
    unchanged = MappingProxyType(dict(result.granted_image_identity))
    copied = dataclasses.replace(result, granted_image_identity=unchanged)
    assert copied.satisfied is True
    assert dict(copied.granted_image_identity) == dict(result.granted_image_identity)


def test_a_signed_identity_in_a_plain_mapping_subclass_may_still_be_copied() -> None:
    """Positive control: the refusal is the disagreement, never the subclass by itself."""
    result = proved_result()
    subclassed = MappingProxyType(
        PlainIdentitySubclass(dict(result.granted_image_identity))
    )
    copied = dataclasses.replace(result, granted_image_identity=subclassed)
    assert copied.satisfied is True
    assert dict(copied.granted_image_identity) == dict(result.granted_image_identity)


def test_a_proved_result_refuses_an_unreadable_signed_identity_as_a_value_error() -> None:
    """`__post_init__` is documented and tested to refuse with `ValueError`.

    A caller catching `ValueError` around a copy would not catch a `KeyError`.
    """
    result = proved_result()
    refuser = unreadable_identity(result.granted_image_identity, "tag")
    with pytest.raises(ValueError):
        dataclasses.replace(result, granted_image_identity=refuser)


# ---------------------------------------------------------------------------
# F84. `stored_entries` cross-checks what a mapping stores against what its subscript
# answers, and judged that agreement by *object identity*. A mapping that rebuilds its
# values on subscript — returning an equal, distinct object of the same type — was refused
# although its two views state the same value, and the refusal it emitted named that one
# value twice and called it a disagreement.
#
# Equality alone is not the repair. `__eq__` is caller-defined: an object can claim equality
# it does not have, can claim it in one direction only, or can refuse to answer, and this
# cross-check exists to protect the *other* `__getitem__` readers (`runner._selected_identity`
# and `grant`'s reductions), which will receive the subscripted object rather than the stored
# one. Agreement is therefore identity, or same exact type with equality asserted in both
# directions and returning exactly `True`; a comparison that raises is a refusal, not an
# escape.


class RebuildsEachSubscript(dict):
    """An honest mapping that returns an equal, distinct object of the same type.

    Nothing about this mapping is forged: both of its views state the same value. It is the
    case the identity comparison refused.
    """

    def __getitem__(self, key: str):
        stored = super().__getitem__(key)
        if isinstance(stored, str):
            return "".join(character for character in stored)
        return stored


class ClaimsEqualityWithAnything:
    """A hostile object whose `__eq__` answers `True` to every comparison."""

    def __eq__(self, other: object) -> bool:
        return True

    def __hash__(self) -> int:
        return 0

    def __repr__(self) -> str:
        return "ClaimsEqualityWithAnything()"


class EqualInOneDirectionOnly:
    """Two of these compare equal left-to-right and unequal right-to-left."""

    def __init__(self, side: str) -> None:
        self.side = side

    def __eq__(self, other: object) -> bool:
        return self.side == "left"

    def __hash__(self) -> int:
        return 0

    def __repr__(self) -> str:
        return f"EqualInOneDirectionOnly({self.side!r})"


class RefusesToBeCompared:
    """An object whose `__eq__` raises rather than answering."""

    def __eq__(self, other: object) -> bool:
        raise RuntimeError("this object will not be compared")

    def __hash__(self) -> int:
        return 0

    def __repr__(self) -> str:
        return "RefusesToBeCompared()"


def subscripting_plainly(stored: dict, answers: dict):
    """The same two-faced mapping, left as the plain `dict` a live reading nests it as.

    A real Docker network reading nests plain `dict`s, so the nested cases below cannot be
    built out of the read-only wrapper `subscripting` returns without changing the case.
    """

    class SubscriptsItsOwnAnswer(dict):
        def __getitem__(self, key: str):
            if key in answers:
                return answers[key]
            return super().__getitem__(key)

    return SubscriptsItsOwnAnswer(stored)


def subscripting(stored: dict, answers: dict):
    """A mapping storing `stored` whose subscript answers `answers` where it has one."""
    return MappingProxyType(subscripting_plainly(stored, answers))


def test_a_mapping_that_rebuilds_its_values_on_subscript_is_accepted(observe) -> None:
    """The F84 case: equal, distinct, same type, and honest in both directions."""
    rebuilder = MappingProxyType(RebuildsEachSubscript({"tag": "16-alpine"}))
    assert rebuilder["tag"] is not dict(rebuilder.items())["tag"], (
        "premise: this mapping must return a distinct object, or the case is vacuous"
    )
    stored, findings = call(observe, "stored_entries", rebuilder, "probe")
    assert findings == (), f"an honest rebuilding mapping must be accepted, got {findings}"
    assert stored == {"tag": "16-alpine"}


def test_a_signed_identity_that_rebuilds_its_values_on_subscript_is_accepted(
    observe,
) -> None:
    """The same case at the reduction that reads it, not only at the helper."""
    identity, image = signed_pair()
    rebuilder = MappingProxyType(RebuildsEachSubscript(dict(identity)))
    assert call(observe, "signed_identity_findings", rebuilder, image) == ()


def test_a_subscript_stating_another_value_is_still_refused_and_names_both(
    observe,
) -> None:
    """A genuine disagreement must still refuse, and its message must be readable."""
    mapping = subscripting({"tag": "16-alpine"}, {"tag": "FORGED"})
    _, findings = call(observe, "stored_entries", mapping, "probe")
    assert len(findings) == 1
    message = findings[0]
    assert repr("FORGED") in message and repr("16-alpine") in message, message
    assert message.count(repr("16-alpine")) == 1, (
        f"a refusal that names one value twice contradicts itself: {message}"
    )


def test_a_subscript_claiming_equality_with_anything_is_still_refused(observe) -> None:
    """A hostile `__eq__` may not talk its way past the cross-check."""
    mapping = subscripting({"tag": "16-alpine"}, {"tag": ClaimsEqualityWithAnything()})
    _, findings = call(observe, "stored_entries", mapping, "probe")
    assert findings, "an object that claims equality with anything must be refused"


def test_a_subscript_equal_in_one_direction_only_is_refused(observe) -> None:
    """Same exact type, equal left-to-right, unequal right-to-left: not agreement."""
    stored_value = EqualInOneDirectionOnly("right")
    subscripted = EqualInOneDirectionOnly("left")
    assert (subscripted == stored_value) is True
    assert (stored_value == subscripted) is False
    assert type(subscripted) is type(stored_value)
    mapping = subscripting({"tag": stored_value}, {"tag": subscripted})
    _, findings = call(observe, "stored_entries", mapping, "probe")
    assert findings, "an asymmetric equality claim must be refused"


def test_a_subscript_whose_comparison_raises_is_refused_without_being_consulted(
    observe,
) -> None:
    """A reducer contracted to return findings may not raise out of a comparison.

    **Strengthened by the F135 repair, and the change is deliberate.** This test used to assert
    the finding named `RuntimeError`, i.e. that the raise was caught and reported. Agreement is
    no longer decided by an `__eq__` the judged object defines, so a non-leaf value is refused on
    the spot and its comparison is never invoked at all. The guarantee this test exists for — a
    reducer must return findings rather than raise — holds strictly more firmly than before: the
    hostile object is not given the opportunity to raise.

    The premise assertion below keeps the case non-vacuous. Were `RefusesToBeCompared` to stop
    raising, this would silently become a test about an ordinary object.
    """
    with pytest.raises(RuntimeError):
        RefusesToBeCompared() == RefusesToBeCompared()  # noqa: B015 -- premise

    mapping = subscripting({"tag": RefusesToBeCompared()}, {"tag": RefusesToBeCompared()})
    _, findings = call(observe, "stored_entries", mapping, "probe")
    assert len(findings) == 1
    assert "do not compare exactly equal in both directions" in findings[0], findings[0]


def test_a_subscript_that_refuses_to_answer_at_all_is_still_refused(observe) -> None:
    """The pre-existing raising-subscript refusal, unchanged by this repair."""
    identity, _ = signed_pair()
    _, findings = call(
        observe, "stored_entries", unreadable_identity(identity, "tag"), "probe"
    )
    assert len(findings) == 1
    assert "KeyError" in findings[0], findings[0]


# ---------------------------------------------------------------------------
# F136. `proved_copy` fuses the walk, the two-view reconciliation and the copy so that what is
# judged and what is recorded are one read's answer — but it walked only exact
# `MappingProxyType`, `tuple` and `frozenset`. Every other value was handed back *uncopied and
# uncross-checked* with an immutability finding. A live Docker network reading nests plain
# `dict`s and `runner._proved_reading` wraps only the top level, so the cross-check the fusion
# docstring claims runs "at every depth" ran at depth 0: a nested mapping stating one set of
# attachments by iteration and another by subscript was passed straight through, and
# `preparation.frozen` then rebuilt it from a *second* live read — the two-pass hole the fusion
# exists to close.
#
# What gets walked and what the immutability verdict says are two different answers, and only
# the first is widened here. `PreparationResult.__post_init__` refuses on exactly the finding a
# nested plain `dict` produces, so a walk that also widened the verdict — accepting everything
# `preparation.frozen` accepts — would stop `preparation` refusing what it refuses today. The
# walk therefore goes as deep as `frozen` rebuilds while the verdict stays byte-identical to
# `immutability_findings` on the same value.


def views_call(name: str, *args, **kwargs):
    """Reach a `views` name directly: `proved_copy` is not re-exported through `observe`."""
    return require_c8_attr(load_c8("views"), name)(*args, **kwargs)


def nested_reading(containers):
    """A network reading nesting `containers`, read-only at the top as the runner takes it."""
    return MappingProxyType(fakes.network_projection(containers=containers))


ATTACKER_ATTACHMENT = {"Name": "ATTACKER"}


class TaggedString(str):
    """A `str` subclass: a safe leaf's subclass, and also a `Sequence`."""


class ItemsRefusesToAnswer(dict):
    """A nested mapping that will not be iterated at all."""

    def items(self):
        raise RuntimeError("this mapping will not be read")


def test_a_nested_plain_mapping_whose_two_views_disagree_is_refused() -> None:
    """The F136 case: the liar one level below the top, where a real reading nests it."""
    genuine = fakes.network_projection()["Containers"]
    liar = subscripting_plainly(genuine, {fakes.CONTAINER_NAME: ATTACKER_ATTACHMENT})
    assert dict(liar.items())[fakes.CONTAINER_NAME] != liar[fakes.CONTAINER_NAME], (
        "premise: this mapping's two views must disagree, or the case is vacuous"
    )
    _, _, divergence = views_call("proved_copy", nested_reading(liar), "network")
    assert divergence, (
        "a nested mapping whose subscript states another attachment must be refused"
    )


def test_a_nested_read_only_mapping_whose_two_views_disagree_is_still_refused() -> None:
    """The positive control that isolates the cause: the identical liar behind a proxy.

    This one was already walked and already refused, so it names the exact type gate rather
    than the liar as the defect, and it must keep refusing after the walk is deepened.
    """
    genuine = fakes.network_projection()["Containers"]
    liar = subscripting(genuine, {fakes.CONTAINER_NAME: ATTACKER_ATTACHMENT})
    _, _, divergence = views_call("proved_copy", nested_reading(liar), "network")
    assert divergence, "the pre-repair positive control must not regress"


def test_a_mapping_two_levels_below_the_top_is_cross_checked_as_well() -> None:
    """Depth 1 is not a new special case: the walk either goes all the way down or it does not."""
    liar = subscripting_plainly({"Name": fakes.CONTAINER_NAME}, {"Name": "ATTACKER"})
    reading = nested_reading({fakes.CONTAINER_NAME: liar})
    _, _, divergence = views_call("proved_copy", reading, "network")
    assert divergence, "a disagreement two levels down must be refused too"


def test_a_nested_sequence_hiding_a_two_faced_mapping_is_cross_checked() -> None:
    """`preparation.frozen` rebuilds a `Sequence` too, so the walk may not stop at one."""
    liar = subscripting_plainly({"Name": fakes.CONTAINER_NAME}, {"Name": "ATTACKER"})
    reading = nested_reading({fakes.CONTAINER_NAME: [liar]})
    _, _, divergence = views_call("proved_copy", reading, "network")
    assert divergence, "a disagreement nested inside a list must be refused too"


def test_the_copy_of_a_nested_mapping_is_a_dead_one_rather_than_the_live_object() -> None:
    """A value handed back uncopied is a value `preparation.frozen` reads live a second time.

    That is the two-pass hole in its original form: the read that was judged and the read that
    was recorded are two reads of one object the caller still owns.
    """
    containers = fakes.network_projection()["Containers"]
    copied, _, _ = views_call("proved_copy", nested_reading(containers), "network")
    recorded = dict(copied)["Containers"]
    assert recorded is not containers, (
        "a nested container handed back uncopied is re-read live by `preparation.frozen`"
    )
    assert dict(recorded) == containers, "the dead copy must state what the reading stored"


def test_a_nested_mapping_that_refuses_to_be_read_is_reported_rather_than_raising() -> None:
    """A reducer contracted to return findings may not raise out of the deepened walk."""
    _, _, divergence = views_call(
        "proved_copy", nested_reading(ItemsRefusesToAnswer()), "network"
    )
    assert len(divergence) == 1, divergence
    assert "RuntimeError" in divergence[0], divergence[0]


def test_a_top_level_mapping_that_refuses_to_be_read_is_reported_rather_than_raising() -> None:
    """F141: the guard the nested path has, at the depth `__post_init__` actually calls.

    `proved_copy` is entered on a field directly, so the exact-`MappingProxyType` branch is
    the top of a real walk, not an interior node. A reducer contracted to return findings may
    not raise out of it there either.
    """
    _, _, divergence = views_call(
        "proved_copy", MappingProxyType(ItemsRefusesToAnswer()), "image"
    )
    assert len(divergence) == 1, divergence
    assert "RuntimeError" in divergence[0], divergence[0]


def test_an_honest_nested_reading_is_still_accepted_by_the_deepened_walk() -> None:
    """The positive control: a cross-check that refuses every reading has proved nothing."""
    reading = nested_reading(fakes.network_projection()["Containers"])
    copied, _, divergence = views_call("proved_copy", reading, "network")
    assert divergence == (), f"an honest reading must be accepted, got {divergence}"
    assert dict(copied)["Internal"] is True
    assert dict(dict(copied)["Containers"]) == fakes.network_projection()["Containers"]


DEEPLY_WALKED_VALUES = (
    pytest.param(fakes.network_projection(), id="plain-nested-reading"),
    pytest.param(MappingProxyType(fakes.network_projection()), id="read-only-reading"),
    pytest.param(MappingProxyType({"ports": [5432, 5433]}), id="nested-list"),
    pytest.param(MappingProxyType({"ports": {5432}}), id="nested-set"),
    pytest.param((["attachment"],), id="tuple-holding-a-list"),
    pytest.param(bytearray(b"digest"), id="bytearray"),
    pytest.param(TaggedString("16-alpine"), id="string-subclass"),
)


@pytest.mark.parametrize("value", DEEPLY_WALKED_VALUES)
def test_the_deepened_walk_reports_exactly_the_immutability_findings_it_reported_before(
    value,
) -> None:
    """The verdict `PreparationResult.__post_init__` refuses on may not move.

    `preparation` raises on these findings before it looks at anything else, so a walk that
    stopped reporting a nested plain `dict` — or that started reporting the values *inside*
    one it has already reported — would change what that phase refuses and how it says so.
    """
    findings = views_call("proved_copy", value, "field")[1]
    assert findings == views_call("immutability_findings", value, "field")


def test_a_string_subclass_is_a_leaf_rather_than_a_sequence_to_walk() -> None:
    """`str` is a `Sequence`: walking one yields its own characters, not nested values.

    `preparation.frozen` refuses a safe scalar's subclass for the same reason rather than
    taking it apart, so this walk may not take it apart either.
    """
    tagged = TaggedString("16-alpine")
    copied, findings, divergence = views_call("proved_copy", tagged, "field")
    assert copied is tagged
    assert findings == ("field holds a TaggedString, which is not deeply immutable",)
    assert divergence == ()


# ---------------------------------------------------------------------------
# F85. The third protocol on the *live reading*: the binding comparison read the reading
# through `.get`, while `keyed` validates it by iteration, `local_presence_findings` reads
# what it stores, `preparation.frozen` rebuilds it from `.items()` and
# `runner._observed_identity` carries forward exactly what `.items()` yielded — and
# `stored_entries` cross-checks only `.items()` against `__getitem__`, never `.get`.
#
# `mappingproxy.get` delegates to the underlying mapping's own `get`, and `dict.items` and
# `dict.__getitem__` are resolved in C and do not route through it. So a `dict` subclass that
# overrides `get` alone stores and subscripts the attacker's binding while answering the one
# accessor the comparison used with the genuine one. Every consumer records the forged
# binding; the comparison saw the genuine one and found nothing to say.


def reading_that_gets_another_binding(image, **forged):
    """A live reading that *stores and subscripts* `forged` while its `.get` answers genuinely.

    The genuine answers are taken from the same reading the case starts from, so a refusal
    below is the control under test rather than a hand-built mapping that had drifted.
    """
    genuine = dict(image)

    class StoresOneBindingGetsAnother(dict):
        def get(self, key: str, default=None):
            if key in forged:
                return genuine[key]
            return super().get(key, default)

    return MappingProxyType(StoresOneBindingGetsAnother({**genuine, **forged}))


def test_a_reading_that_gets_one_binding_and_stores_another_passes_every_gate(
    observe,
) -> None:
    """The premise of the refusal below, asserted rather than assumed.

    If the construction did not pass the type gate, the inventory check and the presence
    control, the refusal below would prove nothing about the binding comparison.
    """
    _, image = signed_pair()
    liar = reading_that_gets_another_binding(image, tag="FORGED")
    assert type(liar) is MappingProxyType
    assert dict(liar.items())["tag"] == "FORGED"
    assert liar["tag"] == "FORGED"
    assert liar.get("tag") == dict(image)["tag"], (
        "premise: `.get` must answer the genuine binding, or the case is vacuous"
    )
    keys = require_c8_attr(observe, "HOST_IMAGE_KEYS")
    assert call(observe, "keyed", liar, keys, "image", ordered=False) == ()
    assert call(observe, "local_presence_findings", liar, "image") == ()
    _, divergence = call(observe, "stored_entries", liar, "image")
    assert divergence, (
        "F134: `.get` is a cross-checked view. This reading stores and subscripts the forged "
        "binding while answering `.get` genuinely, so its three views no longer agree and the "
        "cross-check refuses it. Before F134 was repaired this asserted `divergence == ()`."
    )


# Bindings a live reading may store and subscript while answering `.get` genuinely. Each is a
# value the reduction already refuses when the reading is read honestly, so what would admit
# it is the third accessor and nothing else.
FORGED_LIVE_BINDINGS = (
    pytest.param({"tag": "FORGED"}, id="tag-forged"),
    pytest.param({"repository": "evil/repo"}, id="repository-forged"),
    pytest.param({"index_digest": "not-a-digest"}, id="index-digest-forged"),
    pytest.param({"manifest_digest": "not-a-digest"}, id="manifest-digest-forged"),
    pytest.param({"local_image_id": "junk"}, id="local-image-id-forged"),
    pytest.param({"platform": "junk"}, id="platform-forged"),
    pytest.param({"tag": None}, id="tag-unread"),
)


@pytest.mark.parametrize("forged", FORGED_LIVE_BINDINGS)
def test_a_live_reading_is_judged_by_what_it_stores_however_it_answers_get(
    observe, forged
) -> None:
    """The stored binding is the binding: it is what every consumer of this reading records."""
    identity, image = signed_pair()
    liar = reading_that_gets_another_binding(image, **forged)
    findings = call(observe, "signed_identity_findings", identity, liar)
    assert findings, (
        f"a live reading storing {forged!r} must be refused whatever its `.get` answers"
    )
    key = next(iter(forged))
    assert any(key in finding for finding in findings), (
        f"the refusal must name {key!r}: {findings}"
    )


def test_a_live_reading_agreeing_through_all_of_its_views_is_still_accepted(
    observe,
) -> None:
    """The positive control: a check that refuses every reading has proved nothing."""
    identity, image = signed_pair()
    assert call(observe, "signed_identity_findings", identity, image) == ()
    subclassed = MappingProxyType(PlainIdentitySubclass(dict(image)))
    assert call(observe, "signed_identity_findings", identity, subclassed) == ()
    rebuilder = MappingProxyType(RebuildsEachSubscript(dict(image)))
    assert call(observe, "signed_identity_findings", identity, rebuilder) == ()


def test_a_live_reading_whose_subscript_states_another_binding_is_refused(
    observe,
) -> None:
    """The reading's own two cross-checked views must not diverge either.

    `__getitem__` is a live protocol on this field elsewhere in the package, so a reading
    whose subscript answers something other than what it stores is a refusal in either
    direction — the same discipline already applied to the signed identity.
    """
    identity, image = signed_pair()
    inverted = subscripting(dict(image), {"tag": "FORGED"})
    findings = call(observe, "signed_identity_findings", identity, inverted)
    assert findings, "a reading whose subscript states another binding must be refused"


def test_a_live_reading_whose_subscript_refuses_a_binding_reports_rather_than_raises(
    observe,
) -> None:
    """A reducer contracted to *return findings* may not throw an unbounded `KeyError`."""
    identity, image = signed_pair()
    findings = call(
        observe, "signed_identity_findings", identity, unreadable_identity(image, "tag")
    )
    assert findings, "a reading that will not answer must still be refused"


def test_a_reading_whose_items_omit_a_binding_is_refused_rather_than_raising(
    observe,
) -> None:
    """The stored snapshot is read by `.get`, so a short `.items()` refuses rather than raises.

    `keyed` validates the inventory by iterating, and `dict(mapping.items())` is a separate
    protocol: a subclass overriding `items` alone passes the inventory check while the
    snapshot every judgement below is taken from is missing a key. Subscripting that snapshot
    would throw `KeyError` out of a reducer contracted to return findings, so it is read by
    `.get` on the plain local dict and an absent binding is refused as a disagreement.
    """
    identity, image = signed_pair()
    genuine = dict(image)

    class ItemsOmitsTheTag(dict):
        def items(self):
            return [(key, value) for key, value in genuine.items() if key != "tag"]

    short = MappingProxyType(ItemsOmitsTheTag(genuine))
    keys = require_c8_attr(observe, "HOST_IMAGE_KEYS")
    assert call(observe, "keyed", short, keys, "image", ordered=False) == (), (
        "premise: the inventory check reads by iteration, so this must pass it"
    )
    assert "tag" not in dict(short.items())
    findings = call(observe, "signed_identity_findings", identity, short)
    assert findings, "a reading whose snapshot omits a binding must be refused"
    assert any("tag" in finding for finding in findings), findings
