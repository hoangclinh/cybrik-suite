"""Suite-owned injection-only master integrated UAT contract."""

from .models import (
    EXPECTED_PORTS,
    EXPECTED_REPOSITORIES,
    EnvironmentSnapshot,
    MasterAuthorization,
    OrchestrationContext,
    RepositoryIdentity,
    StageReceipt,
    TerminalSeal,
    absence_proof_digest,
    repository_tuple_digest,
)
from .orchestrator import IntegratedUatOrchestrator, OrchestrationFailure
from .protocols import (
    AlertContextStage,
    CommonTeardown,
    EnvironmentInspector,
    PostgresD2Stage,
)
from .storage import CONSUMPTION_MARKER, TERMINAL_SEAL

__all__ = [
    "CONSUMPTION_MARKER",
    "EXPECTED_PORTS",
    "EXPECTED_REPOSITORIES",
    "TERMINAL_SEAL",
    "AlertContextStage",
    "CommonTeardown",
    "EnvironmentInspector",
    "EnvironmentSnapshot",
    "IntegratedUatOrchestrator",
    "MasterAuthorization",
    "OrchestrationContext",
    "OrchestrationFailure",
    "PostgresD2Stage",
    "RepositoryIdentity",
    "StageReceipt",
    "TerminalSeal",
    "absence_proof_digest",
    "repository_tuple_digest",
]
