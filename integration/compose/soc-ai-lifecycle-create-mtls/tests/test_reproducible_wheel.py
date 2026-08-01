"""D1 lock, wheelhouse, and offline-reinstall integrity checks.

This explicit artifact target performs no resolution or installation.  It
verifies committed and outside-repository evidence produced by the bounded D1
tooling path, while keeping the internal B1 wheel outside the uv solver.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import tomllib
from pathlib import Path

import pytest


_REPO_ROOT = Path(__file__).resolve().parents[4]
_HARNESS_ROOT = Path(__file__).resolve().parents[1]
_PYPROJECT = _HARNESS_ROOT / "pyproject.toml"
_LOCK = _HARNESS_ROOT / "uv.lock"
_LOCK_EVIDENCE = _HARNESS_ROOT / "evidence" / "dependency-lock.json"
_OFFLINE_EVIDENCE = _HARNESS_ROOT / "evidence" / "offline-reinstall.json"
_LICENSE_EVIDENCE = _HARNESS_ROOT / "evidence" / "licenses.json"
_SBOM_EVIDENCE = _HARNESS_ROOT / "evidence" / "sbom.cdx.json"
_VEX_EVIDENCE = _HARNESS_ROOT / "evidence" / "vex.cdx.json"
_INTERNAL_WHEEL_EVIDENCE = _HARNESS_ROOT / "evidence" / "internal-wheel.json"
_PATCH = _HARNESS_ROOT / "patches" / "anycorn-0.20.0+cybrik.1.patch"
_INTERNAL_FINDING_ID = "CYBRIK-UAT-ANYCORN-SSL-OPTIONS-2026-08-01"
_INTERNAL_VERSION = "0.20.0+cybrik.1"

_REQUIRED_DIRECT_DEPENDENCIES = frozenset(
    {
        "alembic",
        "anyio",
        "argon2-cffi",
        "asyncpg",
        "cryptography",
        "email-validator",
        "fastapi",
        "h11",
        "h2",
        "hpack",
        "httpx",
        "maxminddb",
        "priority",
        "psycopg2-binary",
        "pydantic",
        "pydantic-settings",
        "pyjwt",
        "pyyaml",
        "redis",
        "rich-click",
        "sniffio",
        "sqlalchemy",
        "uvicorn",
        "wsproto",
    }
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _load_json(path: Path) -> dict[str, object]:
    assert path.is_file(), f"required D1 evidence is absent: {path.relative_to(_REPO_ROOT)}"
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _normalized_name(requirement: str) -> str:
    name = re.split(r"[<>=!~;\[ ]", requirement, maxsplit=1)[0]
    return name.casefold().replace("_", "-")


@pytest.fixture(scope="module")
def artifact_dir() -> Path:
    raw = os.environ.get("CYBRIK_UAT_D1_ARTIFACT_DIR")
    assert raw, "CYBRIK_UAT_D1_ARTIFACT_DIR is required for this explicit D1 target"
    candidate = Path(raw)
    assert candidate.is_absolute()
    resolved = candidate.resolve(strict=True)
    assert resolved.is_dir() and not resolved.is_relative_to(_REPO_ROOT)
    return resolved


def test_registry_lock_contains_the_harness_closure_but_never_anycorn() -> None:
    assert _PYPROJECT.is_file(), "dedicated D1 pyproject is absent; intended lock RED"
    assert _LOCK.is_file(), "dedicated D1 uv.lock is absent; intended lock RED"

    project = tomllib.loads(_PYPROJECT.read_text(encoding="utf-8"))
    dependencies = project["project"]["dependencies"]
    direct_names = {_normalized_name(item) for item in dependencies}
    assert _REQUIRED_DIRECT_DEPENDENCIES <= direct_names
    assert "anycorn" not in direct_names

    lock = tomllib.loads(_LOCK.read_text(encoding="utf-8"))
    packages = lock["package"]
    names = {_normalized_name(package["name"]) for package in packages}
    assert "anycorn" not in names
    assert _REQUIRED_DIRECT_DEPENDENCIES <= names
    for package in packages:
        source = package.get("source")
        if package["name"] == "cybrik-suite-uat-mtls":
            assert source == {"virtual": "."}
            continue
        assert source == {"registry": "https://pypi.org/simple"}


def test_export_and_wheelhouse_are_hash_complete_and_exclude_anycorn(
    artifact_dir: Path,
) -> None:
    evidence = _load_json(_LOCK_EVIDENCE)
    requirements = artifact_dir / "uv-exported-requirements.txt"
    wheelhouse = artifact_dir / "wheelhouse"
    assert requirements.is_file()
    assert wheelhouse.is_dir()

    text = requirements.read_text(encoding="utf-8")
    assert re.search(r"(?im)^anycorn(?:==|\[)", text) is None
    requirement_starts = [
        line for line in text.splitlines() if line and not line[0].isspace() and not line.startswith("#")
    ]
    assert requirement_starts
    assert all("==" in line for line in requirement_starts)
    assert text.count("--hash=sha256:") >= len(requirement_starts)

    wheels = sorted(wheelhouse.glob("*.whl"))
    assert wheels and len(wheels) == evidence["wheel_count"]
    assert all(not wheel.name.casefold().startswith("anycorn-") for wheel in wheels)
    recorded = evidence["wheels"]
    assert isinstance(recorded, list)
    assert recorded == [
        {"filename": wheel.name, "sha256": _sha256(wheel)} for wheel in wheels
    ]
    assert evidence["uv_lock_sha256"] == _sha256(_LOCK)
    assert evidence["requirements_sha256"] == _sha256(requirements)


def test_offline_reinstall_is_fresh_hash_verified_and_keeps_b1_separate(
    artifact_dir: Path,
) -> None:
    evidence = _load_json(_OFFLINE_EVIDENCE)
    lock = _load_json(_LOCK_EVIDENCE)
    assert evidence["result"] == "pass"
    assert evidence["network"] == "disabled"
    assert evidence["fresh_environment"] is True
    assert evidence["requirements_install"] == {
        "no_index": True,
        "find_links": str(artifact_dir / "wheelhouse"),
        "require_hashes": True,
    }
    assert evidence["b1_install"] == {
        "no_deps": True,
        "sha256_verified": True,
        "version": "0.20.0+cybrik.1",
    }
    offline_cache_match = re.search(r"--cache-dir\s+(\S+)", evidence["requirements_command"])
    assert offline_cache_match is not None
    assert Path(offline_cache_match.group(1)) != Path(lock["cache_dir"])


def test_license_inventory_is_exact_and_keeps_legal_review_explicit() -> None:
    evidence = _load_json(_LICENSE_EVIDENCE)
    lock = _load_json(_LOCK_EVIDENCE)
    wheel = _load_json(_INTERNAL_WHEEL_EVIDENCE)
    packages = evidence["packages"]
    assert isinstance(packages, list) and len(packages) == 57
    identities = [(item["name"].casefold(), item["version"]) for item in packages]
    assert len(identities) == len(set(identities))
    assert identities == sorted(identities)
    assert evidence["artifact_id"] == "anycorn-cybrik-uat-b1"
    assert evidence["inventory_scope"] == "exact_offline_d1_environment"
    assert evidence["legal_approval"] is False
    assert evidence["review_required_count"] == sum(
        item["disposition"] == "review_required" for item in packages
    )

    by_name = {item["name"].casefold(): item for item in packages}
    assert by_name["anycorn"]["version"] == _INTERNAL_VERSION
    assert by_name["anycorn"]["normalized_license"] == "MIT"
    assert by_name["psycopg2-binary"]["disposition"] == "review_required"
    assert evidence["generated_from"] == {
        "internal_wheel_sha256": wheel["sha256"],
        "requirements_sha256": lock["requirements_sha256"],
        "sbom_sha256": _sha256(_SBOM_EVIDENCE),
        "uv_lock_sha256": _sha256(_LOCK),
    }


def test_sbom_and_vex_bind_the_exact_b1_without_premature_resolution() -> None:
    sbom = _load_json(_SBOM_EVIDENCE)
    vex = _load_json(_VEX_EVIDENCE)
    lock = _load_json(_LOCK_EVIDENCE)
    wheel = _load_json(_INTERNAL_WHEEL_EVIDENCE)

    assert lock["b1_patch_sha256"] == _sha256(_PATCH)
    assert lock["b1_wheel_sha256"] == wheel["sha256"]
    assert lock["ssl_context_probe_sha256"] == wheel["ssl_context_probe_sha256"]

    assert sbom["bomFormat"] == "CycloneDX"
    assert sbom["specVersion"] == "1.6"
    components = sbom["components"]
    assert isinstance(components, list) and len(components) == 57
    assert all(component["type"] == "library" for component in components)
    b1_components = [
        component
        for component in components
        if component.get("name") == "anycorn" and component.get("version") == _INTERNAL_VERSION
    ]
    assert len(b1_components) == 1
    b1_ref = b1_components[0]["bom-ref"]

    assert vex["bomFormat"] == "CycloneDX"
    assert vex["specVersion"] == "1.6"
    vulnerabilities = vex["vulnerabilities"]
    assert isinstance(vulnerabilities, list) and len(vulnerabilities) == 1
    finding = vulnerabilities[0]
    assert finding["id"] == _INTERNAL_FINDING_ID
    assert finding["affects"] == [{"ref": b1_ref}]
    assert finding["analysis"]["state"] == "in_triage"
    assert "resolved_with_pedigree" not in json.dumps(finding)
    detail = finding["analysis"]["detail"]
    assert lock["b1_patch_sha256"] in detail
    assert lock["b1_wheel_sha256"] in detail
    assert lock["ssl_context_probe_sha256"] in detail
    assert "D2" in detail and "HOLD" in detail

    validation = lock["cyclonedx_validation"]
    assert validation["sbom"] == {
        "path": "evidence/sbom.cdx.json",
        "sha256": _sha256(_SBOM_EVIDENCE),
        "result": "pass",
    }
    assert validation["vex"] == {
        "path": "evidence/vex.cdx.json",
        "sha256": _sha256(_VEX_EVIDENCE),
        "result": "pass",
    }
    assert validation["schema_source"] == "official-cyclonedx-1.6"


def test_audit_tooling_and_osv_evidence_are_hash_pinned_and_fail_closed(
    artifact_dir: Path,
) -> None:
    evidence = _load_json(_LOCK_EVIDENCE)
    tooling = evidence["audit_tooling"]
    assert tooling["pip_audit_version"] == "2.10.1"
    assert tooling["requirements_path"] == str(artifact_dir / "tooling-requirements.txt")
    assert re.fullmatch(r"[0-9a-f]{64}", tooling["requirements_sha256"])
    assert tooling["wheelhouse_path"] == str(artifact_dir / "tooling-wheelhouse")
    assert tooling["offline_install"] == {
        "no_index": True,
        "find_links": str(artifact_dir / "tooling-wheelhouse"),
        "require_hashes": True,
    }
    tooling_wheels = tooling["wheels"]
    assert isinstance(tooling_wheels, list) and tooling_wheels
    assert all(re.fullmatch(r"[0-9a-f]{64}", item["sha256"]) for item in tooling_wheels)

    audit = evidence["vulnerability_audit"]
    assert audit["service"] == "osv"
    assert audit["endpoint"] == "https://api.osv.dev/v1/query"
    assert audit["pip_audit_version"] == "2.10.1"
    assert audit["completed"] is True
    assert audit["requirements_sha256"] == evidence["requirements_sha256"]
    assert audit["raw_output_path"] == str(artifact_dir / "pip-audit.json")
    assert re.fullmatch(r"[0-9a-f]{64}", audit["raw_output_sha256"])

    package_queries = audit["package_queries"]
    raw_audit = json.loads((artifact_dir / "pip-audit.json").read_text(encoding="utf-8"))
    audited_dependencies = raw_audit["dependencies"]
    assert isinstance(package_queries, list) and len(package_queries) == len(audited_dependencies)
    queried = [(item["name"].casefold(), item["version"]) for item in package_queries]
    assert len(queried) == len(set(queried))
    assert set(queried) == {
        (item["name"].casefold(), item["version"]) for item in audited_dependencies
    }
    assert all(re.fullmatch(r"[0-9a-f]{64}", item["raw_response_sha256"]) for item in package_queries)

    positive_control = audit["positive_control"]
    assert positive_control["name"] == "jinja2"
    assert positive_control["version"] == "2.4.1"
    control_path = artifact_dir / positive_control["response_file"]
    assert control_path.is_file()
    assert positive_control["raw_response_sha256"] == _sha256(control_path)
    control_response = json.loads(control_path.read_text(encoding="utf-8"))
    control_ids = {item["id"] for item in control_response.get("vulns", [])}
    assert positive_control["expected_vulnerability_ids"]
    assert set(positive_control["expected_vulnerability_ids"]) <= control_ids
    assert positive_control["blocking_severity_observed"] is True

    findings = audit["findings"]
    assert isinstance(findings, list)
    assert audit["finding_count"] == len(findings)
    allowed = {"CRITICAL", "HIGH", "MODERATE", "LOW", "UNKNOWN"}
    assert all(item["severity"] in allowed for item in findings)
    assert all(re.fullmatch(r"[0-9a-f]{64}", item["raw_response_sha256"]) for item in findings)
    blocking = [item for item in findings if item["severity"] in {"CRITICAL", "HIGH", "UNKNOWN"}]
    assert audit["blocking_findings"] == blocking
    assert audit["candidate_disposition"] == "HOLD"


def test_raw_osv_records_have_no_transitive_critical_high_or_unknown(
    artifact_dir: Path,
) -> None:
    index_path = artifact_dir / "osv-responses-index.json"
    assert index_path.is_file()
    queries = json.loads(index_path.read_text(encoding="utf-8"))
    assert isinstance(queries, list) and queries

    audit = _load_json(_LOCK_EVIDENCE)["vulnerability_audit"]
    expected_queries = {
        (item["name"].casefold(), item["version"], item["raw_response_sha256"])
        for item in audit["package_queries"]
    }
    indexed_queries = {
        (item["name"].casefold(), item["version"], item["raw_response_sha256"])
        for item in queries
    }
    assert indexed_queries == expected_queries

    findings: list[dict[str, str]] = []
    for query in queries:
        raw_path = artifact_dir / "osv-responses" / query["response_file"]
        assert raw_path.is_file()
        assert _sha256(raw_path) == query["raw_response_sha256"]
        response = json.loads(raw_path.read_text(encoding="utf-8"))
        for vulnerability in response.get("vulns", []):
            raw_severity = vulnerability.get("database_specific", {}).get("severity")
            severity = raw_severity.upper() if isinstance(raw_severity, str) else "UNKNOWN"
            if severity not in {"CRITICAL", "HIGH", "MODERATE", "LOW"}:
                severity = "UNKNOWN"
            findings.append(
                {
                    "id": vulnerability["id"],
                    "name": query["name"],
                    "version": query["version"],
                    "severity": severity,
                }
            )

    blocking = [
        finding
        for finding in findings
        if finding["severity"] in {"CRITICAL", "HIGH", "UNKNOWN"}
    ]
    assert blocking == [], f"D1 transitive closure has release-blocking OSV findings: {blocking}"
