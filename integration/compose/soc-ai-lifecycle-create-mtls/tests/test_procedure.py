"""Tests for the immutable lifecycle procedure blueprint.

The blueprint is a description, not a runner. These tests prove the description
is complete and fail-closed, and that the module offers no way to execute any of
the described commands.
"""

from __future__ import annotations

import ast
import dataclasses
from pathlib import Path

import pytest

from cybrik_suite_uat_mtls import evidence, procedure

_SRC_ROOT = Path(__file__).resolve().parents[1] / "src" / "cybrik_suite_uat_mtls"


def _command(**overrides: object) -> procedure.Command:
    base = procedure.Command(
        step="start",
        argv=(
            "python3",
            "-m",
            "cybrik_suite_uat_mtls.harness",
            "start",
            "--ai-bind",
            "127.0.0.1:58443",
            "--postgres-bind",
            "127.0.0.1:55432",
        ),
        description="authored blueprint only",
        authorizing_gate="D2",
    )
    return dataclasses.replace(base, **overrides)  # type: ignore[arg-type]


# --------------------------------------------------------------------------
# The authored blueprint
# --------------------------------------------------------------------------


def test_lifecycle_steps_are_the_exact_paired_set() -> None:
    assert procedure.LIFECYCLE_STEPS == ("start", "seed", "reset", "stop", "rollback")


def test_blueprint_validates_and_covers_every_step_exactly_once() -> None:
    validated = procedure.validate_procedure(procedure.LIFECYCLE_BLUEPRINT)
    steps = [command.step for command in validated.commands]
    assert steps == list(procedure.LIFECYCLE_STEPS)


def test_blueprint_claims_no_execution_authority() -> None:
    assert procedure.LIFECYCLE_BLUEPRINT.execution_authorized is False
    assert {
        command.authorizing_gate for command in procedure.LIFECYCLE_BLUEPRINT.commands
    } == {"D2"}


def test_blueprint_commands_are_argv_arrays_not_shell_strings() -> None:
    for command in procedure.LIFECYCLE_BLUEPRINT.commands:
        assert isinstance(command.argv, tuple)
        assert all(isinstance(token, str) for token in command.argv)
        assert command.argv[0] == "python3"


def test_blueprint_commands_carry_no_secret_bearing_token() -> None:
    for command in procedure.LIFECYCLE_BLUEPRINT.commands:
        for token in command.argv:
            assert evidence.secret_reason(token) is None


def test_blueprint_binds_only_the_reviewed_loopback_surfaces() -> None:
    tokens = {
        token
        for command in procedure.LIFECYCLE_BLUEPRINT.commands
        for token in command.argv
    }
    assert "127.0.0.1:58443" in tokens
    assert "127.0.0.1:55432" in tokens


def test_blueprint_is_immutable() -> None:
    with pytest.raises(dataclasses.FrozenInstanceError):
        procedure.LIFECYCLE_BLUEPRINT.name = "other"  # type: ignore[misc]
    with pytest.raises(dataclasses.FrozenInstanceError):
        procedure.LIFECYCLE_BLUEPRINT.commands[0].step = "stop"  # type: ignore[misc]


def test_render_returns_pure_text_lines_for_every_step() -> None:
    rendered = procedure.LIFECYCLE_BLUEPRINT.render()
    assert isinstance(rendered, tuple)
    assert all(isinstance(line, str) for line in rendered)
    joined = "\n".join(rendered)
    for step in procedure.LIFECYCLE_STEPS:
        assert step in joined


@pytest.mark.parametrize(
    "attribute", ("run", "execute", "invoke", "spawn", "apply", "__call__")
)
def test_procedure_exposes_no_execution_method(attribute: str) -> None:
    assert not hasattr(procedure.LIFECYCLE_BLUEPRINT, attribute)
    assert not hasattr(procedure.LIFECYCLE_BLUEPRINT.commands[0], attribute)


def test_procedure_module_defines_no_execution_helper() -> None:
    tree = ast.parse(
        (_SRC_ROOT / "procedure.py").read_text(encoding="utf-8"), filename="procedure.py"
    )
    forbidden = {"run", "execute", "invoke", "spawn", "launch", "apply", "start_all"}
    defined = {
        node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)
    }
    assert defined.isdisjoint(forbidden), sorted(defined & forbidden)


# --------------------------------------------------------------------------
# Command validation — fail closed
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("overrides", "expected_reason"),
    (
        ({"step": "deploy"}, procedure.UNKNOWN_STEP),
        ({"step": 1}, procedure.UNKNOWN_STEP),
        ({"argv": "python3 -m cybrik_suite_uat_mtls.harness start"}, procedure.ARGV_IS_SHELL_STRING),
        ({"argv": None}, procedure.ARGV_NOT_SEQUENCE),
        ({"argv": ()}, procedure.ARGV_EMPTY),
        ({"argv": ("python3", 7)}, procedure.ARGV_ELEMENT_NOT_A_STRING),
        ({"argv": ("python3", "")}, procedure.ARGV_ELEMENT_EMPTY),
        ({"argv": ("sh", "-c", "noop")}, procedure.ARGV_SHELL_EVALUATOR),
        ({"argv": ("/bin/bash", "harness.sh")}, procedure.ARGV_SHELL_EVALUATOR),
        ({"argv": ("zsh", "harness.sh")}, procedure.ARGV_SHELL_EVALUATOR),
        ({"argv": ("env", "python3")}, procedure.ARGV_SHELL_EVALUATOR),
        ({"argv": ("xargs", "python3")}, procedure.ARGV_SHELL_EVALUATOR),
        ({"argv": ("python3", "-c", "noop")}, procedure.ARGV_INLINE_EVALUATION),
        ({"argv": ("python3", "-m", "harness; rm -rf /")}, procedure.ARGV_SHELL_METACHARACTER),
        ({"argv": ("python3", "-m", "$(harness)")}, procedure.ARGV_SHELL_METACHARACTER),
        ({"argv": ("python3", "-m", "harness | tee log")}, procedure.ARGV_SHELL_METACHARACTER),
        ({"argv": ("python3", "-m", "harness > out")}, procedure.ARGV_SHELL_METACHARACTER),
        ({"argv": ("python3", "-m", "harness && stop")}, procedure.ARGV_SHELL_METACHARACTER),
        ({"argv": ("python3", "-m", "harness\nstop")}, procedure.ARGV_SHELL_METACHARACTER),
        (
            {"argv": ("python3", "-m", "cybrik_suite_uat_mtls.harness", "start", "postgresql://uat:secret@host/db")},
            procedure.ARGV_SECRET_BEARING,
        ),
        ({"argv": ("rm", "-r", "/tmp/example")}, procedure.ARGV_NOT_ALLOWLISTED),
        (
            {"argv": ("python3", "-m", "other.module", "start")},
            procedure.ARGV_NOT_ALLOWLISTED,
        ),
        (
            {"argv": ("python3", "-m", "cybrik_suite_uat_mtls.harness", "start")},
            procedure.ARGV_NOT_ALLOWLISTED,
        ),
        (
            {"argv": ("python3", "-m", "cybrik_suite_uat_mtls.harness", "stop")},
            procedure.ARGV_NOT_ALLOWLISTED,
        ),
        ({"authorizing_gate": "D1"}, procedure.UNKNOWN_GATE),
        ({"authorizing_gate": "D3"}, procedure.UNKNOWN_GATE),
        ({"authorizing_gate": None}, procedure.UNKNOWN_GATE),
        ({"description": ""}, procedure.DESCRIPTION_MISSING),
        ({"description": 1}, procedure.DESCRIPTION_MISSING),
    ),
)
def test_validate_command_rejects_unsafe_descriptions(
    overrides: dict[str, object], expected_reason: str
) -> None:
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_command(_command(**overrides))
    assert caught.value.reason == expected_reason


def test_validate_command_requires_a_declared_command() -> None:
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_command("python3 -m harness start")
    assert caught.value.reason == procedure.COMMAND_NOT_DECLARED


def test_validate_procedure_rejects_d1_for_every_runtime_step() -> None:
    commands = tuple(
        dataclasses.replace(command, authorizing_gate="D1")
        for command in procedure.LIFECYCLE_BLUEPRINT.commands
    )
    candidate = dataclasses.replace(procedure.LIFECYCLE_BLUEPRINT, commands=commands)
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.UNKNOWN_GATE


# --------------------------------------------------------------------------
# Procedure validation — the paired lifecycle must exist exactly once
# --------------------------------------------------------------------------


def _procedure_with(steps: tuple[str, ...]) -> procedure.Procedure:
    return procedure.Procedure(
        name="partial-blueprint",
        commands=tuple(
            _command(
                step=step,
                argv=(
                    (
                        "python3",
                        "-m",
                        "cybrik_suite_uat_mtls.harness",
                        "start",
                        "--ai-bind",
                        "127.0.0.1:58443",
                        "--postgres-bind",
                        "127.0.0.1:55432",
                    )
                    if step == "start"
                    else ("python3", "-m", "cybrik_suite_uat_mtls.harness", step)
                ),
            )
            for step in steps
        ),
    )


def test_validate_procedure_requires_a_declared_procedure() -> None:
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure({"name": "blueprint"})
    assert caught.value.reason == procedure.PROCEDURE_NOT_DECLARED


@pytest.mark.parametrize("name", ("", "   ", 5))
def test_validate_procedure_rejects_a_malformed_name(name: object) -> None:
    candidate = dataclasses.replace(
        procedure.LIFECYCLE_BLUEPRINT, name=name  # type: ignore[arg-type]
    )
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.PROCEDURE_NAME_MALFORMED


def test_validate_procedure_rejects_a_claimed_execution_authority() -> None:
    candidate = dataclasses.replace(
        procedure.LIFECYCLE_BLUEPRINT, execution_authorized=True
    )
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.EXECUTION_CLAIMED


def test_validate_procedure_rejects_undeclared_commands() -> None:
    candidate = dataclasses.replace(
        procedure.LIFECYCLE_BLUEPRINT, commands=("start",)  # type: ignore[arg-type]
    )
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.COMMAND_NOT_DECLARED


def test_validate_procedure_rejects_a_duplicated_step() -> None:
    candidate = _procedure_with(("start", "seed", "reset", "stop", "rollback", "start"))
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.DUPLICATE_STEP


def test_validate_procedure_requires_stop_whenever_start_is_present() -> None:
    candidate = _procedure_with(("start", "seed", "reset", "rollback"))
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.MISSING_STOP_FOR_START


def test_validate_procedure_requires_rollback_whenever_start_is_present() -> None:
    candidate = _procedure_with(("start", "seed", "reset", "stop"))
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.MISSING_ROLLBACK_FOR_START


def test_validate_procedure_requires_the_complete_lifecycle() -> None:
    candidate = _procedure_with(("start", "stop", "rollback"))
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.MISSING_STEP


def test_validate_procedure_rejects_an_empty_procedure() -> None:
    candidate = _procedure_with(())
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_procedure(candidate)
    assert caught.value.reason == procedure.MISSING_STEP
