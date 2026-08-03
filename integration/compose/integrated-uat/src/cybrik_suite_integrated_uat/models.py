"""Immutable values for the injection-only integrated UAT contract."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

EXPECTED_REPOSITORIES = (
    "cybrik-soc-command-center",
    "cybrik-cyber-ai-platform",
    "cybrik-security-tool-fabric",
    "cybrik-suite",
)
EXPECTED_PORTS = (55432, 58442, 58443, 58444)
EXPECTED_EXTERNAL_CAPABILITIES = (
    "postgres_d2_runtime",
    "postgres_d2_evidence",
    "alert_context_runtime",
    "alert_context_evidence",
    "alert_context_state",
)


def canonical_json_bytes(document: object) -> bytes:
    return (json.dumps(document, sort_keys=True, separators=(",", ":")) + "\n").encode(
        "utf-8"
    )


@dataclass(frozen=True, slots=True)
class RepositoryIdentity:
    repository: str
    commit: str
    tree: str
    clean: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "clean": self.clean,
            "commit": self.commit,
            "repository": self.repository,
            "tree": self.tree,
        }


@dataclass(frozen=True, slots=True)
class RepositoryRoot:
    repository: str
    root: Path

    def to_dict(self) -> dict[str, str]:
        return {"repository": self.repository, "root": str(self.root)}


@dataclass(frozen=True, slots=True)
class ExternalRootBinding:
    capability: str
    root: Path

    def to_dict(self) -> dict[str, str]:
        return {"capability": self.capability, "root": str(self.root)}


def repository_tuple_digest(identities: tuple[RepositoryIdentity, ...]) -> str:
    payload = canonical_json_bytes([identity.to_dict() for identity in identities])
    return hashlib.sha256(payload).hexdigest()


def repository_roots_digest(roots: tuple[RepositoryRoot, ...]) -> str:
    payload = canonical_json_bytes([root.to_dict() for root in roots])
    return hashlib.sha256(payload).hexdigest()


def external_roots_digest(roots: tuple[ExternalRootBinding, ...]) -> str:
    payload = canonical_json_bytes([root.to_dict() for root in roots])
    return hashlib.sha256(payload).hexdigest()


@dataclass(frozen=True, slots=True)
class MasterAuthorization:
    aggregate_sha256: str
    authorization_sha256: str
    evidence_root: Path
    exact_head_grant_sha256: str
    external_roots: tuple[ExternalRootBinding, ...]
    external_roots_sha256: str
    repository_roots: tuple[RepositoryRoot, ...]
    repository_roots_sha256: str
    repository_tuple: tuple[RepositoryIdentity, ...]
    repository_tuple_sha256: str
    run_id: str


@dataclass(frozen=True, slots=True)
class EnvironmentSnapshot:
    absent_ports: tuple[int, ...]
    aggregate_sha256: str
    external_roots_sha256: str
    pki_absent: bool
    postgres_absent: bool
    private_artifacts_absent: bool
    processes_absent: bool
    repository_roots_sha256: str
    repository_tuple: tuple[RepositoryIdentity, ...]
    repository_tuple_sha256: str
    runtime_artifacts_absent: bool

    def absence_proof(self) -> dict[str, object]:
        return {
            "absent_ports": list(self.absent_ports),
            "external_roots_sha256": self.external_roots_sha256,
            "pki_absent": self.pki_absent,
            "postgres_absent": self.postgres_absent,
            "private_artifacts_absent": self.private_artifacts_absent,
            "processes_absent": self.processes_absent,
            "repository_roots_sha256": self.repository_roots_sha256,
            "repository_tuple": [item.to_dict() for item in self.repository_tuple],
            "repository_tuple_sha256": self.repository_tuple_sha256,
            "runtime_artifacts_absent": self.runtime_artifacts_absent,
        }


def absence_proof_digest(snapshot: EnvironmentSnapshot) -> str:
    return hashlib.sha256(canonical_json_bytes(snapshot.absence_proof())).hexdigest()


@dataclass(frozen=True, slots=True)
class OrchestrationContext:
    aggregate_sha256: str
    authorization_sha256: str
    consumption_marker: Path
    evidence_root: Path
    external_roots_sha256: str
    marker_sha256: str
    repository_tuple: tuple[RepositoryIdentity, ...]
    repository_tuple_sha256: str
    repository_roots_sha256: str
    run_id: str


@dataclass(frozen=True, slots=True)
class StageReceipt:
    aggregate_sha256: str
    receipt_sha256: str
    repository_tuple_sha256: str
    stage: str


@dataclass(frozen=True, slots=True)
class TerminalSeal:
    aggregate_sha256: str
    alert_context_receipt_sha256: str | None
    authorization_sha256: str
    exact_head_grant_sha256: str
    external_roots_sha256: str
    failure_code: str | None
    marker_sha256: str
    postgres_d2_receipt_sha256: str | None
    repository_tuple: tuple[RepositoryIdentity, ...]
    repository_tuple_sha256: str
    repository_roots_sha256: str
    run_id: str
    terminal_absence_proof: dict[str, object]
    terminal_absence_proof_sha256: str
    status: str

    def to_dict(self) -> dict[str, object]:
        return {
            "aggregate_sha256": self.aggregate_sha256,
            "alert_context_receipt_sha256": self.alert_context_receipt_sha256,
            "authorization_sha256": self.authorization_sha256,
            "exact_head_grant_sha256": self.exact_head_grant_sha256,
            "external_roots_sha256": self.external_roots_sha256,
            "failure_code": self.failure_code,
            "marker_sha256": self.marker_sha256,
            "postgres_d2_receipt_sha256": self.postgres_d2_receipt_sha256,
            "repository_tuple": [item.to_dict() for item in self.repository_tuple],
            "repository_tuple_sha256": self.repository_tuple_sha256,
            "repository_roots_sha256": self.repository_roots_sha256,
            "run_id": self.run_id,
            "status": self.status,
            "terminal_absence_proof": self.terminal_absence_proof,
            "terminal_absence_proof_sha256": self.terminal_absence_proof_sha256,
        }
