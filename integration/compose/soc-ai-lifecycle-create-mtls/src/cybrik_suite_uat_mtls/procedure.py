"""Immutable, non-executable lifecycle and N1-N10 procedure descriptions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from . import evidence, policy

UNKNOWN_STEP: Final = "unknown_step"
ARGV_IS_SHELL_STRING: Final = "argv_is_shell_string"
ARGV_NOT_SEQUENCE: Final = "argv_not_sequence"
ARGV_EMPTY: Final = "argv_empty"
ARGV_ELEMENT_NOT_A_STRING: Final = "argv_element_not_a_string"
ARGV_ELEMENT_EMPTY: Final = "argv_element_empty"
ARGV_SHELL_EVALUATOR: Final = "argv_shell_evaluator"
ARGV_INLINE_EVALUATION: Final = "argv_inline_evaluation"
ARGV_SHELL_METACHARACTER: Final = "argv_shell_metacharacter"
ARGV_SECRET_BEARING: Final = "argv_secret_bearing"
ARGV_NOT_ALLOWLISTED: Final = "argv_not_allowlisted"
UNKNOWN_GATE: Final = "unknown_gate"
DESCRIPTION_MISSING: Final = "description_missing"
COMMAND_NOT_DECLARED: Final = "command_not_declared"
PROCEDURE_NOT_DECLARED: Final = "procedure_not_declared"
PROCEDURE_NAME_MALFORMED: Final = "procedure_name_malformed"
EXECUTION_CLAIMED: Final = "execution_claimed"
DUPLICATE_STEP: Final = "duplicate_step"
MISSING_STOP_FOR_START: Final = "missing_stop_for_start"
MISSING_ROLLBACK_FOR_START: Final = "missing_rollback_for_start"
MISSING_STEP: Final = "missing_step"

INVENTORY_NOT_DECLARED: Final = "inventory_not_declared"
CASE_NOT_DECLARED: Final = "case_not_declared"
DUPLICATE_CASE_ID: Final = "duplicate_case_id"
MISSING_CASE: Final = "missing_case"
CASE_ORDER_NOT_CANONICAL: Final = "case_order_not_canonical"
CASE_ID_UNKNOWN: Final = "case_id_unknown"
CASE_PURPOSE_MISMATCH: Final = "case_purpose_mismatch"
CASE_SURFACE_UNKNOWN: Final = "case_surface_unknown"
CASE_OUTCOME_MISSING: Final = "case_outcome_missing"
CASE_STATUS_NOT_AUTHORED_NOT_RUN: Final = "case_status_not_authored_not_run"
CASE_GATE_NOT_RUNTIME: Final = "case_gate_not_runtime"

LIFECYCLE_STEPS: Final = ("start", "seed", "reset", "stop", "rollback")
CASE_STATUS_AUTHORED_NOT_RUN: Final = "authored_not_run"

_ALLOWED_GATES: Final = frozenset({"D2"})
_SHELL_EVALUATORS: Final = frozenset(
    {"sh", "bash", "zsh", "dash", "fish", "env", "xargs", "command"}
)
_SHELL_METACHARACTERS: Final = frozenset({";", "|", "&", ">", "<", "`", "$", "\n", "\r"})
_HARNESS_PREFIX: Final = (
    "python3",
    "-m",
    "cybrik_suite_uat_mtls.harness",
)
_START_BIND_ARGUMENTS: Final = (
    "--ai-bind",
    "127.0.0.1:58443",
    "--postgres-bind",
    "127.0.0.1:55432",
)


class ProcedureViolation(Exception):
    """Stable refusal with no rejected value retained."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Command:
    step: str
    argv: tuple[str, ...]
    description: str
    authorizing_gate: str


@dataclass(frozen=True)
class Procedure:
    name: str
    commands: tuple[Command, ...]
    execution_authorized: bool = False

    def render(self) -> tuple[str, ...]:
        """Render documentation lines; this method never invokes an argv."""

        return tuple(
            f"{command.step}: {' '.join(command.argv)} [{command.authorizing_gate}]"
            for command in self.commands
        )


def _program_name(token: str) -> str:
    return token.rsplit("/", 1)[-1].casefold()


def validate_command(candidate: object) -> Command:
    if not isinstance(candidate, Command):
        raise ProcedureViolation(COMMAND_NOT_DECLARED)
    if not isinstance(candidate.step, str) or candidate.step not in LIFECYCLE_STEPS:
        raise ProcedureViolation(UNKNOWN_STEP)
    if isinstance(candidate.argv, str):
        raise ProcedureViolation(ARGV_IS_SHELL_STRING)
    if not isinstance(candidate.argv, tuple):
        raise ProcedureViolation(ARGV_NOT_SEQUENCE)
    if not candidate.argv:
        raise ProcedureViolation(ARGV_EMPTY)
    for token in candidate.argv:
        if not isinstance(token, str):
            raise ProcedureViolation(ARGV_ELEMENT_NOT_A_STRING)
        if not token:
            raise ProcedureViolation(ARGV_ELEMENT_EMPTY)
    if _program_name(candidate.argv[0]) in _SHELL_EVALUATORS:
        raise ProcedureViolation(ARGV_SHELL_EVALUATOR)
    if "-c" in candidate.argv:
        raise ProcedureViolation(ARGV_INLINE_EVALUATION)
    for token in candidate.argv:
        if any(marker in token for marker in _SHELL_METACHARACTERS):
            raise ProcedureViolation(ARGV_SHELL_METACHARACTER)
        if evidence.secret_reason(token) is not None:
            raise ProcedureViolation(ARGV_SECRET_BEARING)
    base_argv = _HARNESS_PREFIX + (candidate.step,)
    if candidate.step == "start":
        allowed_argv = (base_argv + _START_BIND_ARGUMENTS,)
    else:
        allowed_argv = (base_argv,)
    if candidate.argv not in allowed_argv:
        raise ProcedureViolation(ARGV_NOT_ALLOWLISTED)
    if candidate.authorizing_gate not in _ALLOWED_GATES:
        raise ProcedureViolation(UNKNOWN_GATE)
    if (
        not isinstance(candidate.description, str)
        or not candidate.description.strip()
        or candidate.description.strip() != candidate.description
    ):
        raise ProcedureViolation(DESCRIPTION_MISSING)
    return candidate


def validate_procedure(candidate: object) -> Procedure:
    if not isinstance(candidate, Procedure):
        raise ProcedureViolation(PROCEDURE_NOT_DECLARED)
    if (
        not isinstance(candidate.name, str)
        or not candidate.name.strip()
        or candidate.name.strip() != candidate.name
    ):
        raise ProcedureViolation(PROCEDURE_NAME_MALFORMED)
    if candidate.execution_authorized is not False:
        raise ProcedureViolation(EXECUTION_CLAIMED)
    if not isinstance(candidate.commands, tuple):
        raise ProcedureViolation(COMMAND_NOT_DECLARED)
    for command in candidate.commands:
        validate_command(command)

    steps = tuple(command.step for command in candidate.commands)
    if len(set(steps)) != len(steps):
        raise ProcedureViolation(DUPLICATE_STEP)
    if "start" in steps and "stop" not in steps:
        raise ProcedureViolation(MISSING_STOP_FOR_START)
    if "start" in steps and "rollback" not in steps:
        raise ProcedureViolation(MISSING_ROLLBACK_FOR_START)
    if frozenset(steps) != frozenset(LIFECYCLE_STEPS):
        raise ProcedureViolation(MISSING_STEP)
    if steps != LIFECYCLE_STEPS:
        raise ProcedureViolation(MISSING_STEP)
    return candidate


LIFECYCLE_BLUEPRINT: Final = Procedure(
    name="soc-ai-lifecycle-create-mtls",
    commands=(
        Command(
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
            description="Future D2 loopback-only start blueprint; no runner exists.",
            authorizing_gate="D2",
        ),
        Command(
            step="seed",
            argv=("python3", "-m", "cybrik_suite_uat_mtls.harness", "seed"),
            description="Future synthetic-only seed blueprint; no data is read now.",
            authorizing_gate="D2",
        ),
        Command(
            step="reset",
            argv=("python3", "-m", "cybrik_suite_uat_mtls.harness", "reset"),
            description="Future bounded reset blueprint; no state is mutated now.",
            authorizing_gate="D2",
        ),
        Command(
            step="stop",
            argv=("python3", "-m", "cybrik_suite_uat_mtls.harness", "stop"),
            description="Future paired stop blueprint; no process is signalled now.",
            authorizing_gate="D2",
        ),
        Command(
            step="rollback",
            argv=("python3", "-m", "cybrik_suite_uat_mtls.harness", "rollback"),
            description="Future full rollback blueprint; no repository is changed now.",
            authorizing_gate="D2",
        ),
    ),
)

REQUIRED_CASE_PURPOSES: Final = (
    ("N1", "replayed_delegation"),
    ("N2", "cnf_mismatch"),
    ("N3", "wrong_audience"),
    ("N4", "wrong_scope"),
    ("N5", "wrong_operation"),
    ("N6", "cross_tenant"),
    ("N7", "tenant_org_advisory_mismatch"),
    ("N8", "missing_server_tls_extension"),
    ("N9", "postgresql_unavailable"),
    ("N10", "secret_material_leakage"),
)
_PURPOSE_BY_ID: Final = dict(REQUIRED_CASE_PURPOSES)
_REQUIRED_CASE_IDS: Final = tuple(case_id for case_id, _ in REQUIRED_CASE_PURPOSES)


@dataclass(frozen=True)
class NegativeCase:
    case_id: str
    purpose: str
    surface: str
    required_outcome: str
    status: str = CASE_STATUS_AUTHORED_NOT_RUN
    authorizing_gate: str = "D2"


_OUTCOMES: Final = (
    "Reject replayed delegation without creating a second durable investigation.",
    "Reject a token whose cnf thumbprint differs from the presented client certificate.",
    "Reject a delegation token addressed to any audience other than the lifecycle service.",
    "Reject a delegation token missing the exact investigation lifecycle create scope.",
    "Reject a delegation token carrying an operation other than investigation create.",
    "Reject every request whose authoritative tenant differs from the target tenant.",
    "Reject tenant and organization advisory fields that disagree with authoritative claims.",
    "Reject the request when the server-owned ASGI TLS extension is absent or malformed.",
    "Fail closed without an in-memory replay fallback when PostgreSQL is unavailable.",
    "Reject evidence containing secret material and emit only stable non-secret reasons.",
)

CASE_INVENTORY: Final = tuple(
    NegativeCase(
        case_id=case_id,
        purpose=purpose,
        surface=(policy.POSTGRES_SURFACE if case_id == "N9" else policy.AI_MTLS_SURFACE),
        required_outcome=outcome,
    )
    for (case_id, purpose), outcome in zip(REQUIRED_CASE_PURPOSES, _OUTCOMES, strict=True)
)


def validate_case(candidate: object) -> NegativeCase:
    if not isinstance(candidate, NegativeCase):
        raise ProcedureViolation(CASE_NOT_DECLARED)
    if not isinstance(candidate.case_id, str) or candidate.case_id not in _PURPOSE_BY_ID:
        raise ProcedureViolation(CASE_ID_UNKNOWN)
    if candidate.purpose != _PURPOSE_BY_ID[candidate.case_id]:
        raise ProcedureViolation(CASE_PURPOSE_MISMATCH)
    if candidate.surface not in policy.PROPOSED_BINDS:
        raise ProcedureViolation(CASE_SURFACE_UNKNOWN)
    expected_surface = (
        policy.POSTGRES_SURFACE if candidate.case_id == "N9" else policy.AI_MTLS_SURFACE
    )
    if candidate.surface != expected_surface:
        raise ProcedureViolation(CASE_SURFACE_UNKNOWN)
    if (
        not isinstance(candidate.required_outcome, str)
        or len(candidate.required_outcome) < 20
        or candidate.required_outcome.strip() != candidate.required_outcome
        or evidence.secret_reason(candidate.required_outcome) is not None
    ):
        raise ProcedureViolation(CASE_OUTCOME_MISSING)
    if candidate.status != CASE_STATUS_AUTHORED_NOT_RUN:
        raise ProcedureViolation(CASE_STATUS_NOT_AUTHORED_NOT_RUN)
    if candidate.authorizing_gate != "D2":
        raise ProcedureViolation(CASE_GATE_NOT_RUNTIME)
    return candidate


def validate_case_inventory(candidate: object) -> tuple[NegativeCase, ...]:
    if not isinstance(candidate, tuple):
        raise ProcedureViolation(INVENTORY_NOT_DECLARED)
    for case in candidate:
        validate_case(case)
    case_ids = tuple(case.case_id for case in candidate)
    if len(set(case_ids)) != len(case_ids):
        raise ProcedureViolation(DUPLICATE_CASE_ID)
    if frozenset(case_ids) != frozenset(_REQUIRED_CASE_IDS):
        raise ProcedureViolation(MISSING_CASE)
    if case_ids != _REQUIRED_CASE_IDS:
        raise ProcedureViolation(CASE_ORDER_NOT_CANONICAL)
    return candidate


def case_evidence(candidate: object) -> dict[str, object]:
    case = validate_case(candidate)
    surface = policy.resolve_proposed_surface(case.surface)
    return {
        "attempt_count": 0,
        "authored_not_run": True,
        "authorizing_gate": case.authorizing_gate,
        "bind": surface.bind,
        "case_id": case.case_id,
        "purpose": case.purpose,
        "required_outcome": case.required_outcome,
        "status": case.status,
        "surface": case.surface,
    }
