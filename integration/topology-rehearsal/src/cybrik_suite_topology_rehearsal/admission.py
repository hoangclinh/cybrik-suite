"""Fail-closed semantic, signature and one-attempt admission without consumption.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Admission reduces caller-owned authorization bytes to one immutable decision. It performs no
host observation and no effect: a successful decision proves only that the exact static grant,
record, signature and unconsumed ledger state may proceed to the later preparation/runner gates.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from hashlib import sha256
from typing import Any

from .constants import (
    ATTEMPT_ORDINAL,
    AUTHORIZATION_NAMESPACE,
    CAPABILITY_ID,
    CONTAINER_PORT,
    CONTROL_REPOSITORIES,
    EXTENSION_CYCLES,
    GRANT_PATH,
    HOST_IP,
    HOST_PORT,
    IMAGE_RESOLVED,
    MAX_ATTEMPTS,
    OBJECTIVE_ID,
    OUTCOME_NOT_RUN,
    PHASE_AUTHORIZED,
    PORT_PROTOCOL,
    PRECHECK_ABORT,
    PROBE_ARGV,
    PROBE_EXECUTABLE_PATH,
    PROBE_EXECUTABLE_SHA256,
    PUBLISH_SPEC,
    RECORD_DIR,
    RECORD_ID,
    RECORD_PATH,
    RECORD_PRODUCTION_EXCLUSION,
    RUNTIME_LIMIT_SECONDS,
    SELECTED_IDENTITY_KEYS,
    SERIES_ID,
    SIGNER,
)
from .errors import PrecheckAbort
from .grant import GrantFacts, canonical_grant_bytes, instant, verify_bindings
from .preparation import frozen

__all__ = [
    "AdmissionDecision",
    "RecordShapeVerdict",
    "decide",
    "validate_record_shape",
]

RECORD_KEYS = (
    "schema_version",
    "record_id",
    "recorded_at",
    "identity",
    "attempt",
    "topology",
    "production_exclusion",
    "authorization",
    "evidence",
    "disposition",
)
IDENTITY_KEYS = ("capability_id", "objective_id")
RECORD_ATTEMPT_KEYS = (
    "series_id",
    "attempt_ordinal",
    "max_attempts",
    "phase",
    "execution_authorized",
    "attempt_consumed",
    "outcome",
)
RECORD_TOPOLOGY_KEYS = (
    "host_ip",
    "host_port",
    "container_port",
    "internal_network",
    "runtime_limit_seconds",
    "extension_cycles",
    "image",
    "probe",
)
IMAGE_KEYS = ("resolution_state", *SELECTED_IDENTITY_KEYS)
PLATFORM_KEYS = ("os", "architecture", "variant")
PROBE_KEYS = ("executable_path", "executable_sha256", "argv")
AUTHORIZATION_KEYS = (
    "signer",
    "namespace",
    "grant_path",
    "grant_sha256",
    "signature_path",
    "signature_sha256",
    "allowed_signers_path",
    "allowed_signers_sha256",
    "trust_path",
)
EVIDENCE_KEYS = (
    "directory",
    "external_bytes_ci_verified",
    "artifacts",
    "record_review_binding",
    "result_controls",
)
ARTIFACT_KEYS = ("kind", "path", "sha256")
REQUIRED_ARTIFACT_KINDS = (
    "diagnosis",
    "diagnosis_review",
    "record_review",
    "grant",
    "authorization_signature",
)
RECORD_REVIEW_KEYS = (
    "review_path",
    "review_sha256",
    "reviewed_phase",
    "reviewed_record_sha256",
)
DISPOSITION_KEYS = ("profile", "rationale")
HEX = frozenset("0123456789abcdef")


@dataclass(frozen=True)
class RecordShapeVerdict:
    """One pure record-shape answer with exact reasons on refusal."""

    satisfied: bool
    findings: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _coherent(self.satisfied, self.findings, "record shape")


@dataclass(frozen=True)
class AdmissionDecision:
    """One static admission answer; success still carries no execution authority."""

    admitted: bool
    outcome: str
    findings: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _coherent(self.admitted, self.findings, "admission")
        expected = OUTCOME_NOT_RUN if self.admitted else PRECHECK_ABORT
        if self.outcome != expected:
            raise ValueError(
                f"admission outcome {self.outcome!r} is not the coherent {expected!r}"
            )


@dataclass(frozen=True)
class AuthorizationSnapshot:
    """Caller projections copied dead before any semantic or injected call."""

    record: Any
    grant: Any
    grant_bytes: Any
    signature_bytes: Any
    record_path: Any
    record_sha256: Any
    expected_controls: Any


def _coherent(satisfied: object, findings: object, label: str) -> None:
    if type(satisfied) is not bool:
        raise ValueError(f"{label} satisfied flag must be exactly bool")
    if type(findings) is not tuple or any(
        type(finding) is not str or not finding for finding in findings
    ):
        raise ValueError(f"{label} findings must be an immutable non-empty-string tuple")
    if satisfied == bool(findings):
        raise ValueError(f"a satisfied {label} has no finding; a refusal has at least one")


def _refused(*findings: str) -> AdmissionDecision:
    reasons = tuple(finding for finding in findings if type(finding) is str and finding)
    if not reasons:
        reasons = ("admission refused before consumption",)
    return AdmissionDecision(False, PRECHECK_ABORT, reasons)


def _digest(value: object) -> bool:
    return type(value) is str and len(value) == 64 and all(char in HEX for char in value)


def _registry_digest(value: object) -> bool:
    return (
        type(value) is str
        and value.startswith("sha256:")
        and _digest(value.removeprefix("sha256:"))
    )


def _exact_keys(value: object, expected: Sequence[str], label: str) -> tuple[str, ...]:
    if not isinstance(value, Mapping):
        return (f"{label}: is not an object",)
    try:
        keys = tuple(value.keys())
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- hostile mappings fail closed
        return (f"{label}: keys raised {type(error).__name__}",)
    if any(type(key) is not str for key in keys):
        return (f"{label}: carries a non-string key",)
    if set(keys) != set(expected) or len(keys) != len(expected):
        finding = (
            f"{label}: keys {sorted(keys)!r} are not the exact reviewed inventory "
            f"{sorted(expected)!r}"
        )
        return (finding,)
    return ()


def _exact_values(
    value: Mapping[str, Any], expected: Mapping[str, Any], label: str
) -> tuple[str, ...]:
    return tuple(
        f"{label}: {key} is {value[key]!r}, not the reviewed {wanted!r}"
        for key, wanted in expected.items()
        if type(value[key]) is not type(wanted) or value[key] != wanted
    )


def _platform_findings(value: object, label: str) -> tuple[str, ...]:
    findings = _exact_keys(value, PLATFORM_KEYS, label)
    if findings:
        return findings
    platform = value
    assert isinstance(platform, Mapping)
    reasons: list[str] = []
    for key in ("os", "architecture"):
        if type(platform[key]) is not str or not platform[key]:
            reasons.append(f"{label}: {key} is not a non-empty string")
    if platform["variant"] is not None and (
        type(platform["variant"]) is not str or not platform["variant"]
    ):
        reasons.append(f"{label}: variant is neither null nor a non-empty string")
    return tuple(reasons)


def _image_findings(value: object) -> tuple[str, ...]:
    findings = list(_exact_keys(value, IMAGE_KEYS, "record topology image"))
    if findings:
        return tuple(findings)
    image = value
    assert isinstance(image, Mapping)
    if image["resolution_state"] != IMAGE_RESOLVED:
        findings.append(
            f"record topology image: resolution_state is not {IMAGE_RESOLVED!r}"
        )
    for key in ("repository", "tag"):
        if type(image[key]) is not str or not image[key]:
            findings.append(f"record topology image: {key} is not a non-empty string")
    findings.extend(_platform_findings(image["platform"], "record topology image platform"))
    for key in ("index_digest", "manifest_digest"):
        if not _registry_digest(image[key]):
            findings.append(f"record topology image: {key} is not a registry digest")
    if type(image["pull_policy"]) is not str or not image["pull_policy"]:
        findings.append("record topology image: pull_policy is not a non-empty string")
    return tuple(findings)


def _attempt_findings(value: object) -> tuple[str, ...]:
    findings = list(_exact_keys(value, RECORD_ATTEMPT_KEYS, "record attempt"))
    if findings:
        return tuple(findings)
    attempt = value
    assert isinstance(attempt, Mapping)
    expected = {
        "series_id": SERIES_ID,
        "attempt_ordinal": ATTEMPT_ORDINAL,
        "max_attempts": MAX_ATTEMPTS,
        "phase": PHASE_AUTHORIZED,
        "execution_authorized": True,
        "attempt_consumed": False,
        "outcome": OUTCOME_NOT_RUN,
    }
    return _exact_values(attempt, expected, "record attempt")


def _topology_findings(value: object) -> tuple[str, ...]:
    findings = list(_exact_keys(value, RECORD_TOPOLOGY_KEYS, "record topology"))
    if findings:
        return tuple(findings)
    topology = value
    assert isinstance(topology, Mapping)
    findings.extend(
        _exact_values(
            topology,
            {
                "host_ip": HOST_IP,
                "host_port": HOST_PORT,
                "container_port": CONTAINER_PORT,
                "internal_network": True,
                "runtime_limit_seconds": RUNTIME_LIMIT_SECONDS,
                "extension_cycles": EXTENSION_CYCLES,
            },
            "record topology",
        )
    )
    findings.extend(_image_findings(topology["image"]))
    probe = topology["probe"]
    probe_keys = _exact_keys(probe, PROBE_KEYS, "record topology probe")
    findings.extend(probe_keys)
    if not probe_keys:
        assert isinstance(probe, Mapping)
        findings.extend(
            _exact_values(
                probe,
                {
                    "executable_path": PROBE_EXECUTABLE_PATH,
                    "executable_sha256": PROBE_EXECUTABLE_SHA256,
                },
                "record topology probe",
            )
        )
        argv = probe["argv"]
        if isinstance(argv, (str, bytes, bytearray)) or not isinstance(argv, Sequence):
            findings.append("record topology probe: argv is not an argument sequence")
        elif tuple(argv) != PROBE_ARGV:
            findings.append("record topology probe: argv is not the reviewed probe argv")
    return tuple(findings)


def _authorization_findings(value: object) -> tuple[str, ...]:
    findings = list(_exact_keys(value, AUTHORIZATION_KEYS, "record authorization"))
    if findings:
        return tuple(findings)
    authorization = value
    assert isinstance(authorization, Mapping)
    for key in (
        "signer",
        "namespace",
        "grant_path",
        "signature_path",
        "allowed_signers_path",
        "trust_path",
    ):
        if type(authorization[key]) is not str or not authorization[key]:
            findings.append(f"record authorization: {key} is not a non-empty string")
    for key in ("grant_sha256", "signature_sha256", "allowed_signers_sha256"):
        if not _digest(authorization[key]):
            findings.append(f"record authorization: {key} is not a sha256 digest")
    return tuple(findings)


def _artifact_findings(value: object) -> tuple[str, ...]:
    if isinstance(value, (str, bytes, bytearray)) or not isinstance(value, Sequence):
        return ("record evidence artifacts: is not an array",)
    findings: list[str] = []
    kinds: list[str] = []
    for index, artifact in enumerate(value):
        label = f"record evidence artifacts[{index}]"
        inner = _exact_keys(artifact, ARTIFACT_KEYS, label)
        findings.extend(inner)
        if inner:
            continue
        assert isinstance(artifact, Mapping)
        kind = artifact["kind"]
        if type(kind) is not str or not kind:
            findings.append(f"{label}: kind is not a non-empty string")
        else:
            kinds.append(kind)
        if type(artifact["path"]) is not str or not artifact["path"]:
            findings.append(f"{label}: path is not a non-empty string")
        if not _digest(artifact["sha256"]):
            findings.append(f"{label}: sha256 is not a digest")
    for required in REQUIRED_ARTIFACT_KINDS:
        count = kinds.count(required)
        if count != 1:
            findings.append(
                f"record evidence artifacts: {required!r} occurs {count} times, not once"
            )
    if len(kinds) != len(set(kinds)):
        findings.append("record evidence artifacts: artifact kinds are not unique")
    return tuple(findings)


def _evidence_findings(value: object) -> tuple[str, ...]:
    findings = list(_exact_keys(value, EVIDENCE_KEYS, "record evidence"))
    if findings:
        return tuple(findings)
    evidence = value
    assert isinstance(evidence, Mapping)
    if evidence["directory"] != RECORD_DIR:
        findings.append("record evidence: directory is not the reviewed record directory")
    if evidence["external_bytes_ci_verified"] is not False:
        findings.append("record evidence: external bytes CI flag must remain exactly False")
    if evidence["result_controls"] is not None:
        findings.append("record evidence: result_controls must be null before execution")
    findings.extend(_artifact_findings(evidence["artifacts"]))
    binding = evidence["record_review_binding"]
    binding_keys = _exact_keys(binding, RECORD_REVIEW_KEYS, "record review binding")
    findings.extend(binding_keys)
    if not binding_keys:
        assert isinstance(binding, Mapping)
        for key in ("review_path",):
            if type(binding[key]) is not str or not binding[key]:
                findings.append(f"record review binding: {key} is not a non-empty string")
        for key in ("review_sha256", "reviewed_record_sha256"):
            if not _digest(binding[key]):
                findings.append(f"record review binding: {key} is not a digest")
        if binding["reviewed_phase"] != "proposed":
            findings.append("record review binding: reviewed_phase is not 'proposed'")
    return tuple(findings)


def _record_findings(record: object) -> tuple[str, ...]:
    findings = list(_exact_keys(record, RECORD_KEYS, "record"))
    if findings:
        return tuple(findings)
    document = record
    assert isinstance(document, Mapping)
    if document["schema_version"] != "1.0.0":
        findings.append("record: schema_version is not '1.0.0'")
    if document["record_id"] != RECORD_ID:
        findings.append("record: record_id is not the reviewed record")
    if instant(document["recorded_at"]) is None:
        findings.append("record: recorded_at is not an exact UTC instant")
    identity = document["identity"]
    identity_keys = _exact_keys(identity, IDENTITY_KEYS, "record identity")
    findings.extend(identity_keys)
    if not identity_keys:
        assert isinstance(identity, Mapping)
        findings.extend(
            _exact_values(
                identity,
                {"capability_id": CAPABILITY_ID, "objective_id": OBJECTIVE_ID},
                "record identity",
            )
        )
    findings.extend(_attempt_findings(document["attempt"]))
    findings.extend(_topology_findings(document["topology"]))
    production = document["production_exclusion"]
    production_keys = _exact_keys(
        production, tuple(RECORD_PRODUCTION_EXCLUSION), "record production_exclusion"
    )
    findings.extend(production_keys)
    if not production_keys:
        assert isinstance(production, Mapping)
        findings.extend(
            _exact_values(
                production, RECORD_PRODUCTION_EXCLUSION, "record production_exclusion"
            )
        )
    findings.extend(_authorization_findings(document["authorization"]))
    findings.extend(_evidence_findings(document["evidence"]))
    disposition = document["disposition"]
    disposition_keys = _exact_keys(disposition, DISPOSITION_KEYS, "record disposition")
    findings.extend(disposition_keys)
    if not disposition_keys:
        assert isinstance(disposition, Mapping)
        if disposition["profile"] != "HOLD":
            findings.append("record disposition: profile is not HOLD")
        if type(disposition["rationale"]) is not str or not disposition["rationale"]:
            findings.append("record disposition: rationale is not a non-empty string")
    return tuple(findings)


def validate_record_shape(record: object) -> RecordShapeVerdict:
    """Pure total validation of the exact pre-execution authorized record shape."""
    try:
        findings = _record_findings(record)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- hostile record shapes fail closed
        findings = (f"record shape raised {type(error).__name__}",)
    return RecordShapeVerdict(not findings, findings)


def _project(authorization: object, name: str) -> Any:
    label = f"authorization {name}"
    try:
        value = getattr(authorization, name, None)
        return frozen(value)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- projections are untrusted seams
        raise PrecheckAbort(f"{label}: raised {type(error).__name__}") from None


def _snapshot(authorization: object) -> AuthorizationSnapshot:
    return AuthorizationSnapshot(
        record=_project(authorization, "record"),
        grant=_project(authorization, "grant"),
        grant_bytes=_project(authorization, "grant_bytes"),
        signature_bytes=_project(authorization, "signature_bytes"),
        record_path=_project(authorization, "record_path"),
        record_sha256=_project(authorization, "record_sha256"),
        expected_controls=_project(authorization, "expected_controls"),
    )


def _plain_json(value: object) -> Any:
    """Render a dead copied JSON value into private plain containers for canonicalization."""
    if isinstance(value, Mapping):
        return {key: _plain_json(item) for key, item in value.items()}
    if type(value) is tuple:
        return [_plain_json(item) for item in value]
    return value


def _artifact_by_kind(record: Mapping[str, Any], kind: str) -> Mapping[str, Any]:
    artifacts = record["evidence"]["artifacts"]
    matches = tuple(item for item in artifacts if item["kind"] == kind)
    if len(matches) != 1:
        raise ValueError(f"{kind} artifact is not unique")
    return matches[0]


def _binding_findings(snapshot: AuthorizationSnapshot) -> tuple[str, ...]:
    record = snapshot.record
    grant = snapshot.grant
    findings: list[str] = []
    if type(snapshot.record_path) is not str or snapshot.record_path != RECORD_PATH:
        findings.append("loader record_path is not the reviewed proposed record path")
    if not _digest(snapshot.record_sha256):
        findings.append("loader record_sha256 is not a digest")
    if not isinstance(record, Mapping) or not isinstance(grant, Mapping):
        return (*findings, "record or grant is not an object")
    review = record["evidence"]["record_review_binding"]
    if review["reviewed_phase"] != "proposed":
        findings.append("record review does not attest the proposed phase")
    if review["reviewed_record_sha256"] != snapshot.record_sha256:
        findings.append("record review does not bind the loader proposed-record digest")
    grant_record = grant.get("record")
    if not isinstance(grant_record, Mapping):
        findings.append("grant record binding is not an object")
    else:
        if grant_record.get("path") != snapshot.record_path:
            findings.append("grant does not bind the loader proposed-record path")
        if grant_record.get("sha256") != snapshot.record_sha256:
            findings.append("grant does not bind the loader proposed-record digest")
    authorization = record["authorization"]
    grant_artifact = _artifact_by_kind(record, "grant")
    signature_artifact = _artifact_by_kind(record, "authorization_signature")
    if authorization["signer"] != SIGNER:
        findings.append("record signer is not the exact reviewed signer")
    if authorization["namespace"] != AUTHORIZATION_NAMESPACE:
        findings.append("record namespace is not the exact reviewed namespace")
    for field, artifact, artifact_field in (
        ("grant_path", grant_artifact, "path"),
        ("grant_sha256", grant_artifact, "sha256"),
        ("signature_path", signature_artifact, "path"),
        ("signature_sha256", signature_artifact, "sha256"),
    ):
        if authorization[field] != artifact[artifact_field]:
            findings.append(f"record authorization {field} drifts from its artifact")
    if authorization["grant_path"] != GRANT_PATH:
        findings.append("record grant_path is not the reviewed grant path")
    if authorization["signature_path"] != f"{GRANT_PATH}.sig":
        findings.append("record signature_path is not adjacent to the reviewed grant")
    if type(snapshot.grant_bytes) is not bytes:
        findings.append("grant bytes are not exact bytes")
    else:
        digest = sha256(snapshot.grant_bytes).hexdigest()
        if digest != authorization["grant_sha256"]:
            findings.append("grant bytes do not match the record grant digest")
    if type(snapshot.signature_bytes) is not bytes:
        findings.append("signature bytes are not exact bytes")
    else:
        digest = sha256(snapshot.signature_bytes).hexdigest()
        if digest != authorization["signature_sha256"]:
            findings.append("signature bytes do not match the record signature digest")
    try:
        canonical = canonical_grant_bytes(_plain_json(grant))
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- canonicalization is fail-closed
        findings.append(f"grant canonicalization raised {type(error).__name__}")
    else:
        if snapshot.grant_bytes != canonical:
            findings.append("grant bytes are not the canonical rendering of the grant")
    return tuple(findings)


def _grant_facts(snapshot: AuthorizationSnapshot) -> GrantFacts:
    record = snapshot.record
    grant = snapshot.grant
    if not isinstance(record, Mapping) or not isinstance(grant, Mapping):
        raise TypeError("record and grant must be objects")
    expected = snapshot.expected_controls
    if not isinstance(expected, Mapping):
        raise TypeError("expected controls must be an object")
    expected_keys = _exact_keys(expected, CONTROL_REPOSITORIES, "expected controls")
    if expected_keys:
        raise ValueError(expected_keys[0])
    repositories = grant["repositories"]
    if not isinstance(repositories, Mapping):
        raise TypeError("grant repositories must be an object")
    independent_repositories = {
        name: {
            "commit": expected[name],
            "tree": repositories[name]["tree"],
            "clean": repositories[name]["clean"],
        }
        for name in CONTROL_REPOSITORIES
    }
    image = record["topology"]["image"]
    selected = {key: image[key] for key in SELECTED_IDENTITY_KEYS}
    topology = {
        "host_ip": record["topology"]["host_ip"],
        "host_port": record["topology"]["host_port"],
        "container_port": record["topology"]["container_port"],
        "protocol": PORT_PROTOCOL,
        "internal_network": record["topology"]["internal_network"],
        "publish_spec": PUBLISH_SPEC,
    }
    return GrantFacts(
        record_path=snapshot.record_path,
        record_sha256=snapshot.record_sha256,
        runner_aggregate_sha256=grant["runner"]["aggregate_sha256"],
        topology=topology,
        selected_image_identity=selected,
        observed_image_identity=grant["observed_image_identity"],
        repositories=independent_repositories,
        tools=grant["tools"],
        now=record["recorded_at"],
    )


def _verify_signature(snapshot: AuthorizationSnapshot, adapters: object) -> bool:
    record = snapshot.record
    assert isinstance(record, Mapping)
    authorization = record["authorization"]
    verdict = adapters.verifier.verify(
        grant_bytes=snapshot.grant_bytes,
        signature_bytes=snapshot.signature_bytes,
        signer=authorization["signer"],
        namespace=authorization["namespace"],
    )
    return verdict is True


def decide(
    authorization: object, adapters: object, *, execute_requested: object = False
) -> AdmissionDecision:
    """Admit exact signed static authority without observing or consuming the attempt."""
    if execute_requested is not True:
        return _refused("the exact execute request was not supplied")
    try:
        snapshot = _snapshot(authorization)
        shape = validate_record_shape(snapshot.record)
        if not shape.satisfied:
            return _refused(*shape.findings)
        bindings = _binding_findings(snapshot)
        if bindings:
            return _refused(*bindings)
        facts = _grant_facts(snapshot)
        grant_verdict = verify_bindings(snapshot.grant, facts)
        if not grant_verdict.satisfied:
            return _refused(*grant_verdict.findings)
        if not _verify_signature(snapshot, adapters):
            return _refused("detached signature verification did not return exactly True")
        record = snapshot.record
        assert isinstance(record, Mapping)
        consumed = adapters.ledger.is_consumed(record_id=record["record_id"])
        if consumed is not False:
            return _refused("the topology attempt is already consumed or unresolved")
        return AdmissionDecision(True, OUTCOME_NOT_RUN)
    except (KeyboardInterrupt, SystemExit):
        raise
    except PrecheckAbort as error:
        return _refused(error.reason)
    except Exception as error:  # noqa: BLE001 -- all ordinary injected failures refuse
        return _refused(f"admission raised {type(error).__name__}")
