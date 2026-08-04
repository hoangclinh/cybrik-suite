"""Pure construction of the exact one-attempt Docker and probe command plan."""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

import fakes
from conftest import MissingC8Module, load_c8, require_c8_attr


@pytest.fixture(name="plan")
def plan_module():
    return load_c8("plan")


class MissingPlan:
    """Stand-in for the plan the absent C8 `build_plan` would have returned.

    Every read and every write fails with the exact missing-C8 reason, so a plan test can
    never report an opaque `'object' object has no attribute ...` in place of the one true
    cause. Building it in the fixture would report a fixture error instead of a failing
    test, which would hide the subject of the RED.
    """

    def __init__(self, module: MissingC8Module) -> None:
        object.__setattr__(self, "_module", module)

    def __getattr__(self, name: str):
        require_c8_attr(object.__getattribute__(self, "_module"), name)

    def __setattr__(self, name: str, value: object) -> None:
        require_c8_attr(object.__getattribute__(self, "_module"), name)


@pytest.fixture(name="built")
def built_plan(plan):
    if isinstance(plan, MissingC8Module):
        return MissingPlan(plan)
    build = require_c8_attr(plan, "build_plan")
    return build(
        attempt_id=fakes.SYNTHETIC_ATTEMPT_ID,
        image_reference=f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}",
        repository_roots=fakes.SYNTHETIC_REPOSITORY_ROOTS,
    )


def test_plan_construction_is_pure_and_immutable(built) -> None:
    with pytest.raises(FrozenInstanceError):
        built.host_port = 1


def test_resource_names_are_derived_from_only_the_attempt_id(built) -> None:
    assert built.container_name == fakes.CONTAINER_NAME
    assert built.network_name == fakes.NETWORK_NAME
    assert built.volume_name == fakes.VOLUME_NAME


def test_the_network_is_created_internal_and_the_volume_is_disposable(built) -> None:
    assert built.create_commands[0] == (
        "docker",
        "network",
        "create",
        "--internal",
        fakes.NETWORK_NAME,
    )
    assert built.create_commands[1] == (
        "docker",
        "volume",
        "create",
        fakes.VOLUME_NAME,
    )


def test_every_creation_command_is_the_same_named_plan_entry(built) -> None:
    """A second, differently-shaped argv for the same effect is exactly the drift risk."""
    assert built.create_commands == (
        built.commands["docker:create_network"],
        built.commands["docker:create_volume"],
        built.commands["docker:create_container"],
    )


def test_every_observation_command_is_a_named_plan_entry(built) -> None:
    observed = set(built.observe_commands)
    assert observed <= set(built.commands.values())
    assert observed >= {
        built.commands[name]
        for name in ("docker:container", "docker:port", "docker:network")
    }
    assert built.host_probe == built.commands["probe:host"]


def test_the_container_command_uses_digest_pull_never_and_loopback_publication(
    built,
) -> None:
    command = built.create_commands[2]
    assert command[:2] == ("docker", "create")
    assert "--pull=never" in command
    assert ("--network", fakes.NETWORK_NAME) == (
        command[command.index("--network")],
        command[command.index("--network") + 1],
    )
    assert command.count("--publish") == 1
    assert command[command.index("--publish") + 1] == fakes.PUBLISH_SPEC
    assert command[-1] == f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}"
    assert fakes.IMAGE_REFERENCE not in command


def test_the_host_probe_is_the_exact_reviewed_no_data_probe(built) -> None:
    assert built.host_probe == (fakes.PROBE_EXECUTABLE_PATH, *fakes.PROBE_ARGV)


def test_plan_contains_only_observation_commands_after_creation(built) -> None:
    joined = tuple(" ".join(command) for command in built.observe_commands)
    assert any(command.startswith("docker inspect") for command in joined)
    assert any(command.startswith("docker port") for command in joined)
    assert any("network inspect" in command for command in joined)
    assert all(" create " not in f" {command} " for command in joined)


def test_every_external_effect_has_one_named_command_in_the_plan(built) -> None:
    repository_keys = {
        f"control:{repository}:{observation}"
        for repository in fakes.EXPECTED_CONTROLS
        for observation in ("commit", "tree", "status")
    }
    fixed_keys = {
        "host:ephemeral_range",
        "host:listeners",
        "docker:platform",
        "docker:image",
        "docker:publications",
        "probe:digest",
        "probe:host",
        "signature:verify",
        "docker:create_network",
        "docker:create_volume",
        "docker:create_container",
        "docker:health",
        "docker:container",
        "docker:event",
        "docker:port",
        "docker:network",
        "docker:remove_container",
        "docker:remove_network",
        "docker:remove_volume",
        "docker:residual",
    }
    assert set(built.commands) == repository_keys | fixed_keys
    assert len(set(built.commands.values())) == len(built.commands)


def test_control_identity_commands_bind_each_injected_root_without_shell(built) -> None:
    for repository, root in fakes.SYNTHETIC_REPOSITORY_ROOTS.items():
        assert built.commands[f"control:{repository}:commit"] == (
            "/usr/bin/git",
            "-C",
            root,
            "rev-parse",
            "HEAD",
        )
        assert built.commands[f"control:{repository}:tree"] == (
            "/usr/bin/git",
            "-C",
            root,
            "rev-parse",
            "HEAD^{tree}",
        )
        assert built.commands[f"control:{repository}:status"] == (
            "/usr/bin/git",
            "-C",
            root,
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
        )


def test_host_signature_and_probe_commands_are_absolute_and_bounded(built) -> None:
    for key in ("host:ephemeral_range", "host:listeners", "probe:digest", "signature:verify"):
        assert built.commands[key][0].startswith("/")
    assert built.commands["probe:host"] == built.host_probe
    assert built.commands["signature:verify"][:4] == (
        "/usr/bin/ssh-keygen",
        "-Y",
        "verify",
        "-f",
    )


def test_teardown_is_exactly_container_network_then_volume(built) -> None:
    assert built.teardown_commands == (
        ("docker", "rm", "--force", fakes.CONTAINER_NAME),
        ("docker", "network", "rm", fakes.NETWORK_NAME),
        ("docker", "volume", "rm", fakes.VOLUME_NAME),
    )
    assert built.teardown_commands == (
        built.commands["docker:remove_container"],
        built.commands["docker:remove_network"],
        built.commands["docker:remove_volume"],
    )


def all_command_groups(built) -> tuple[tuple[str, ...], ...]:
    """Every argv the plan can hand to the executor, from all four command groups.

    Scanning only `commands` would let a forbidden effect hide in a create, observe,
    teardown or probe sequence that no named entry covers.
    """
    return (
        *built.commands.values(),
        *built.create_commands,
        *built.observe_commands,
        *built.teardown_commands,
        built.host_probe,
    )


@pytest.mark.parametrize(
    "forbidden",
    (
        "0.0.0.0",
        "::",
        "[::]",
        "::1",
        "--network=host",
        "docker pull",
        "psql",
        "pytest",
        "alembic",
    ),
)
def test_no_command_group_contains_a_forbidden_effect_or_address(
    built, forbidden: str
) -> None:
    rendered = "\n".join(" ".join(command) for command in all_command_groups(built))
    assert forbidden not in rendered


def test_every_command_group_argument_is_an_exact_string_token(built) -> None:
    """No argv may carry a shell string, a glob or an embedded separator."""
    for command in all_command_groups(built):
        assert isinstance(command, tuple)
        for argument in command:
            assert isinstance(argument, str) and argument
            assert not set(argument) & set(";|&`$\n\t*?")


def test_plan_exports_only_immutable_plan_construction(plan) -> None:
    assert set(require_c8_attr(plan, "__all__")) == {"TopologyPlan", "build_plan"}
