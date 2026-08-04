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
    assert built.credential_path == fakes.SYNTHETIC_CREDENTIAL_PATH


def test_the_network_is_created_internal_and_the_volume_is_disposable(built) -> None:
    assert built.create_commands[0] == (
        fakes.DOCKER_EXECUTABLE_PATH,
        "network",
        "create",
        "--internal",
        fakes.NETWORK_NAME,
    )
    assert built.create_commands[1] == (
        fakes.DOCKER_EXECUTABLE_PATH,
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
        built.commands["docker:start_container"],
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
    assert command[:2] == (fakes.DOCKER_EXECUTABLE_PATH, "create")
    assert "--pull=never" in command
    assert ("--network", fakes.NETWORK_NAME) == (
        command[command.index("--network")],
        command[command.index("--network") + 1],
    )
    assert command.count("--publish") == 1
    assert command[command.index("--publish") + 1] == fakes.PUBLISH_SPEC
    assert command[-1] == f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}"
    assert fakes.IMAGE_REFERENCE not in command
    mount = command[command.index("--mount") + 1]
    assert mount == (
        f"type=bind,src={fakes.SYNTHETIC_CREDENTIAL_PATH},"
        f"dst={fakes.CONTAINER_CREDENTIAL_PATH},readonly"
    )
    assert ("--env", f"POSTGRES_PASSWORD_FILE={fakes.CONTAINER_CREDENTIAL_PATH}") == (
        command[command.index("--env")],
        command[command.index("--env") + 1],
    )
    assert "--health-cmd" in command
    assert "/usr/local/bin/pg_isready -U postgres" == command[
        command.index("--health-cmd") + 1
    ]
    assert built.create_commands[3] == (
        fakes.DOCKER_EXECUTABLE_PATH,
        "start",
        fakes.CONTAINER_NAME,
    )


def test_the_host_probe_is_the_exact_reviewed_no_data_probe(built) -> None:
    assert built.host_probe == (fakes.PROBE_EXECUTABLE_PATH, *fakes.PROBE_ARGV)


def test_plan_contains_only_observation_commands_after_creation(built) -> None:
    joined = tuple(" ".join(command) for command in built.observe_commands)
    assert any(
        command.startswith(f"{fakes.DOCKER_EXECUTABLE_PATH} inspect")
        for command in joined
    )
    assert any(
        command.startswith(f"{fakes.DOCKER_EXECUTABLE_PATH} port")
        for command in joined
    )
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
        "docker:digest",
        "probe:digest",
        "probe:host",
        "signature:verify",
        "docker:create_network",
        "docker:create_volume",
        "docker:create_container",
        "docker:start_container",
        "docker:health",
        "docker:container",
        "docker:event",
        "docker:port",
        "docker:network",
        "docker:remove_container",
        "docker:remove_network",
        "docker:remove_volume",
        "docker:residual_container",
        "docker:residual_network",
        "docker:residual_volume",
    }
    assert set(built.commands) == repository_keys | fixed_keys
    assert len(set(built.commands.values())) == len(built.commands)


def test_residual_observation_covers_every_created_docker_resource_kind(built) -> None:
    """A teardown proof that can only see containers cannot report a leaked network.

    Every kind the plan creates has its own residual projection, each filtered to this
    attempt's own derived name and each rendering that name as a JSON string so a residual
    inventory is machine-readable without a second parsing dialect.
    """
    assert built.commands["docker:residual_container"] == (
        fakes.DOCKER_EXECUTABLE_PATH,
        "ps",
        "--all",
        "--filter",
        f"name={fakes.CONTAINER_NAME}",
        "--format",
        "{{json .Names}}",
    )
    assert built.commands["docker:residual_network"] == (
        fakes.DOCKER_EXECUTABLE_PATH,
        "network",
        "ls",
        "--filter",
        f"name={fakes.NETWORK_NAME}",
        "--format",
        "{{json .Name}}",
    )
    assert built.commands["docker:residual_volume"] == (
        fakes.DOCKER_EXECUTABLE_PATH,
        "volume",
        "ls",
        "--filter",
        f"name={fakes.VOLUME_NAME}",
        "--format",
        "{{json .Name}}",
    )


def test_the_plan_names_the_signature_file_its_own_argv_verifies(built) -> None:
    """The verified path is a plan field, not a spelling an adapter re-derives.

    An adapter that has to rebuild this path to read the bytes it is asked about could
    name a different file than the one `ssh-keygen` is handed, which is exactly the drift
    a single reviewed expression removes.
    """
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    assert built.signature_path == f"{suite_root}/{fakes.GRANT_PATH}.sig"
    assert built.commands["signature:verify"][-1] == built.signature_path


def test_listener_and_event_observations_pin_machine_readable_projections(built) -> None:
    assert built.commands["host:listeners"] == (
        "/usr/sbin/lsof",
        "-nP",
        "-sTCP:LISTEN",
        f"-iTCP:{fakes.HOST_PORT}",
        "-Fpn",
    )
    assert built.commands["docker:event"] == (
        fakes.DOCKER_EXECUTABLE_PATH,
        "events",
        "--since",
        f"{fakes.RUNTIME_LIMIT_SECONDS}s",
        "--until",
        "0s",
        "--filter",
        f"container={fakes.CONTAINER_NAME}",
        "--filter",
        "event=start",
        "--format",
        '{{json (index .Actor.Attributes "desktop.docker.io/ports/5432/tcp")}}',
    )


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
    assert all(
        command[0] == fakes.DOCKER_EXECUTABLE_PATH
        for name, command in built.commands.items()
        if name.startswith("docker:") and name != "docker:digest"
    )
    assert built.commands["docker:digest"] == (
        "/usr/bin/shasum",
        "-a",
        "256",
        fakes.DOCKER_EXECUTABLE_PATH,
    )
    assert built.commands["signature:verify"][:4] == (
        "/usr/bin/ssh-keygen",
        "-Y",
        "verify",
        "-f",
    )
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    assert built.commands["signature:verify"][4] == (
        f"{suite_root}/docs/uat/topology-rehearsal-allowed-signers"
    )
    assert built.commands["signature:verify"][-1] == (
        f"{suite_root}/{fakes.GRANT_PATH}.sig"
    )


def test_teardown_is_exactly_container_network_then_volume(built) -> None:
    assert built.teardown_commands == (
        (fakes.DOCKER_EXECUTABLE_PATH, "rm", "--force", fakes.CONTAINER_NAME),
        (fakes.DOCKER_EXECUTABLE_PATH, "network", "rm", fakes.NETWORK_NAME),
        (fakes.DOCKER_EXECUTABLE_PATH, "volume", "rm", fakes.VOLUME_NAME),
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
