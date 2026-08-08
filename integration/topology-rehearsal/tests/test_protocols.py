"""Injected capability boundaries for a runner that performs no hidden I/O."""

from __future__ import annotations

import ast
import inspect
from dataclasses import FrozenInstanceError
from types import SimpleNamespace

import fakes
import pytest
from conftest import PACKAGE, SRC, load_c8, require_c8_attr

# The keys of the one decoded host listener record. This boundary produces the record and
# `observe` consumes it, so the spellings are typed here once and derived on both sides.
LISTENER_RECORD_KEY_NAMES = (
    "LISTENER_ADDRESS_KEY",
    "LISTENER_PORT_KEY",
    "LISTENER_PROTOCOL_KEY",
)

# Every shared malformed shape, plus two objects that carry no result field at all.
MALFORMED_RESULTS = (None, object(), *fakes.MALFORMED_COMMAND_RESULTS)

# The decoders whose unresolved answer is `None`. `succeeded` is stated separately: it is
# the mutation path and its contract is a detailed refusal, not an unresolved value.
UNRESOLVED_DECODERS = ("decoded", "lines", "residual_names", "verified")

# The shared result plumbing `adapter` imports by name. It is implementation, not an
# injected seam, so it is deliberately outside the curated `__all__`.
INTERNAL_RESULT_HELPERS = (
    "decoded",
    "decoded_listener",
    "lines",
    "normalized_result",
    "residual_names",
    "succeeded",
    "verified",
)

# A verification either ran to a status or it did not happen at all. `False` is reserved
# for the second: an executed, structurally valid, positive nonzero refusal by the signer.
SIGNATURE_VERDICTS = (
    (0, True),
    (1, False),
    (2, False),
    (125, False),
    (255, False),
    # The unresolved sentinel of a default-constructed result: nothing ever executed.
    (-1, None),
    # A timeout or a signal death: the command was killed rather than answering.
    (-9, None),
    (-15, None),
)

PORTS = {
    "Clock": "clock",
    "CredentialPort": "credential",
    "ControlIdentitySource": "identities",
    "HostObservationSource": "host",
    "DockerPort": "docker",
    "ProbePort": "probe",
    "SignatureVerifier": "verifier",
    "AttemptLedger": "ledger",
}


@pytest.fixture(name="protocols")
def protocols_module():
    return load_c8("protocols")


@pytest.mark.parametrize("name", sorted(PORTS))
def test_every_external_capability_is_a_runtime_checkable_protocol(
    protocols, name: str
) -> None:
    protocol = require_c8_attr(protocols, name)
    assert inspect.isclass(protocol)
    assert getattr(protocol, "_is_protocol", False) is True
    assert getattr(protocol, "_is_runtime_protocol", False) is True


@pytest.mark.parametrize(("name", "adapter_name"), sorted(PORTS.items()))
def test_the_in_memory_adapter_satisfies_each_protocol(
    protocols, name: str, adapter_name: str
) -> None:
    adapters = fakes.passing_adapters()
    assert isinstance(getattr(adapters, adapter_name), require_c8_attr(protocols, name))


def test_the_complete_adapter_bundle_is_frozen(protocols) -> None:
    bundle_type = require_c8_attr(protocols, "Adapters")
    adapters = fakes.passing_adapters()
    bundle = bundle_type(
        identities=adapters.identities,
        host=adapters.host,
        docker=adapters.docker,
        probe=adapters.probe,
        credential=adapters.credential,
        verifier=adapters.verifier,
        ledger=adapters.ledger,
        clock=adapters.clock,
    )
    with pytest.raises(FrozenInstanceError):
        bundle.clock = adapters.clock


def test_command_runner_protocol_binds_exact_argv_and_timeout(protocols) -> None:
    protocol = require_c8_attr(protocols, "CommandRunner")
    fake = fakes.FakeCommandRunner(fakes.CallLog())
    assert isinstance(fake, protocol)
    signature = inspect.signature(protocol.run)
    assert tuple(signature.parameters) == (
        "self",
        "argv",
        "timeout_seconds",
        "stdin",
    )
    assert signature.parameters["timeout_seconds"].kind is inspect.Parameter.KEYWORD_ONLY
    assert signature.parameters["stdin"].kind is inspect.Parameter.KEYWORD_ONLY


def test_default_command_result_is_unresolved_not_cheerful_success(protocols) -> None:
    result = require_c8_attr(protocols, "CommandResult")()
    assert result.returncode != 0
    assert result.stdout == ""


def test_docker_port_includes_tool_identity_start_and_observation_seams(protocols) -> None:
    docker = require_c8_attr(protocols, "DockerPort")
    assert tuple(inspect.signature(docker.observe_executable_digest).parameters) == (
        "self",
        "path",
    )
    assert tuple(inspect.signature(docker.start_container).parameters) == (
        "self",
        "name",
    )


def test_adapter_bundle_rejects_an_object_that_does_not_implement_its_port(protocols) -> None:
    bundle_type = require_c8_attr(protocols, "Adapters")
    adapters = fakes.passing_adapters()
    with pytest.raises(TypeError):
        bundle_type(
            identities=object(),
            host=adapters.host,
            docker=adapters.docker,
            probe=adapters.probe,
            credential=adapters.credential,
            verifier=adapters.verifier,
            ledger=adapters.ledger,
            clock=adapters.clock,
        )


def test_protocols_export_only_the_reviewed_seams(protocols) -> None:
    assert set(require_c8_attr(protocols, "__all__")) == {
        "Adapters",
        "CommandResult",
        "CommandRunner",
        *PORTS,
    }


@pytest.mark.parametrize("result", MALFORMED_RESULTS)
def test_a_result_that_is_not_structurally_a_command_result_is_unresolved(
    protocols, result: object
) -> None:
    """One normalization decides the shape question for every decoder that follows.

    A result arrives through an injected port, so its shape is never guaranteed. Deciding
    that once, in one pure helper, keeps every decoder's answer to a malformed reading the
    same instead of leaving each one to trip over a different missing attribute.
    """
    assert require_c8_attr(protocols, "normalized_result")(result) is None


@pytest.mark.parametrize(
    "reading",
    (
        SimpleNamespace(returncode=0, stdout="out\n", stderr="err\n"),
        SimpleNamespace(returncode=125, stdout="", stderr="conflict\n"),
        SimpleNamespace(returncode=-9, stdout="", stderr=""),
    ),
)
def test_a_structurally_valid_result_normalizes_to_the_frozen_reading(
    protocols, reading: SimpleNamespace
) -> None:
    normalized = require_c8_attr(protocols, "normalized_result")(reading)
    assert normalized == require_c8_attr(protocols, "CommandResult")(
        returncode=reading.returncode, stdout=reading.stdout, stderr=reading.stderr
    )


@pytest.mark.parametrize("result", MALFORMED_RESULTS)
@pytest.mark.parametrize("decoder", UNRESOLVED_DECODERS)
def test_every_observation_decoder_refuses_a_malformed_result_without_raising(
    protocols, decoder: str, result: object
) -> None:
    """A malformed injected result is an unresolved observation, never an exception.

    Each decoder reads a result it did not construct. Letting `AttributeError` or
    `TypeError` escape would turn a fail-closed observation seam into a crash for which the
    caller has no `None` branch at all.
    """
    assert require_c8_attr(protocols, decoder)(result) is None


@pytest.mark.parametrize("result", MALFORMED_RESULTS)
def test_a_malformed_mutation_result_keeps_its_own_detailed_refusal(
    protocols, result: object
) -> None:
    """The mutation path still refuses out loud; it does not quietly go unresolved."""
    with pytest.raises(ValueError, match="malformed"):
        require_c8_attr(protocols, "succeeded")("docker:create_network", result)


@pytest.mark.parametrize(("returncode", "expected"), SIGNATURE_VERDICTS)
def test_a_signature_verdict_is_returned_only_for_a_verification_that_ran(
    protocols, returncode: int, expected: bool | None
) -> None:
    """`False` is the signer's refusal and may not stand in for a check that never ran.

    The unresolved sentinel, a timeout and a signal death all produced no verdict at all.
    Recording one of them as a refusal would send a reader after a bad signature when the
    real remedy is to run the verification again.
    """
    result = require_c8_attr(protocols, "CommandResult")(returncode=returncode)
    assert require_c8_attr(protocols, "verified")(result) is expected


def test_a_decoded_listener_record_carries_exactly_the_boundary_key_names(
    protocols,
) -> None:
    """The decoded record's shape is the boundary's own declared key inventory.

    A record built from inline literals would be a second, unreviewed spelling of the shape
    the observation reduction reads, and the two could drift apart without either side
    failing: the reduction would simply read `None` from a record the adapter had filled.
    """
    keys = tuple(require_c8_attr(protocols, name) for name in LISTENER_RECORD_KEY_NAMES)
    separator = require_c8_attr(protocols, "ADDRESS_SEPARATOR")
    decoded = require_c8_attr(protocols, "decoded_listener")(
        f"{fakes.HOST_IP}{separator}{fakes.HOST_PORT}"
    )
    assert set(decoded) == set(keys)
    assert decoded == dict(
        zip(keys, (fakes.HOST_IP, fakes.HOST_PORT, fakes.PORT_PROTOCOL), strict=True)
    )


def test_each_listener_record_key_is_typed_exactly_once_in_this_boundary(
    protocols,
) -> None:
    path = SRC / PACKAGE / "protocols.py"
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    typed = [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    ]
    for name in LISTENER_RECORD_KEY_NAMES:
        spelling = require_c8_attr(protocols, name)
        assert typed.count(spelling) == 1, f"{name} is typed more than once"


def test_the_internal_result_helpers_are_shared_but_deliberately_unexported(
    protocols,
) -> None:
    """`__all__` is the injected seam surface, not an inventory of every callable here.

    The result helpers are package plumbing that `adapter` imports by name. Exporting them
    would present implementation as contract, so their absence is stated as a decision in
    the module docstring rather than left to look like an oversight.
    """
    exported = set(require_c8_attr(protocols, "__all__"))
    docstring = require_c8_attr(protocols, "__doc__")
    for name in INTERNAL_RESULT_HELPERS:
        assert callable(require_c8_attr(protocols, name))
        assert name not in exported
        assert f"`{name}`" in docstring
    assert "deliberately absent" in docstring
