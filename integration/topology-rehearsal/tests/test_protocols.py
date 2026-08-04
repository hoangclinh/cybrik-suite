"""Injected capability boundaries for a runner that performs no hidden I/O."""

from __future__ import annotations

import inspect
from dataclasses import FrozenInstanceError

import pytest

import fakes
from conftest import load_c8, require_c8_attr


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


def test_protocols_export_only_the_reviewed_seams(protocols) -> None:
    assert set(require_c8_attr(protocols, "__all__")) == {
        "Adapters",
        "CommandResult",
        "CommandRunner",
        *PORTS,
    }
