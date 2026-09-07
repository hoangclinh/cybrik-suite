"""Contract qualification tests for the CYBRIK TypeScript / Node.js Client SDK.

Validates @cybrik/sdk-ts package manifest, tsconfig, exports, error taxonomy,
interface definitions against contracts/openapi/cybrik-soc-v1.yaml, and zero-runtime-dependency
invariants.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TS_SDK_DIR = REPO_ROOT / "packages" / "cybrik-sdk-ts"
OPENAPI_SPEC_PATH = REPO_ROOT / "contracts" / "openapi" / "cybrik-soc-v1.yaml"


def parse_simple_yaml_schemas(yaml_content: str) -> dict[str, Any]:
    """Extract schema names, enums, and properties from OpenAPI YAML without external PyYAML."""
    schemas: dict[str, dict[str, Any]] = {}
    current_schema = None
    in_schemas = False
    in_properties = False
    in_enum = False

    for line in yaml_content.splitlines():
        trimmed = line.strip()
        indent = len(line) - len(line.lstrip())

        if trimmed == "schemas:":
            in_schemas = True
            continue

        if in_schemas:
            if indent == 2 and trimmed and not trimmed.startswith("#"):
                # Out of components.schemas
                in_schemas = False
                continue

            if indent == 4 and trimmed.endswith(":"):
                current_schema = trimmed[:-1].strip()
                schemas[current_schema] = {
                    "enums": set(),
                    "properties": set(),
                    "required": set(),
                }
                in_properties = False
                in_enum = False
                continue

            if current_schema and indent == 6:
                if trimmed == "enum:":
                    in_enum = True
                    in_properties = False
                    continue
                if trimmed == "properties:":
                    in_properties = True
                    in_enum = False
                    continue
                if trimmed == "required:":
                    in_properties = False
                    in_enum = False
                    continue

            if current_schema and in_enum and indent == 8 and trimmed.startswith("- "):
                enum_val = trimmed[2:].strip().strip("\"'")
                schemas[current_schema]["enums"].add(enum_val)

            if current_schema and in_properties and indent == 8 and trimmed.endswith(":"):
                prop_name = trimmed[:-1].strip()
                schemas[current_schema]["properties"].add(prop_name)

    return schemas


class TestTypeScriptSDKManifest:
    """Validates package.json fields, semver compliance, and script configuration."""

    @pytest.fixture(autouse=True)
    def setup_manifest(self) -> None:
        self.manifest_path = TS_SDK_DIR / "package.json"
        assert self.manifest_path.exists(), f"package.json not found at {self.manifest_path}"
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            self.manifest = json.load(f)

    def test_package_metadata(self) -> None:
        assert self.manifest.get("name") == "@cybrik/sdk-ts"
        assert self.manifest.get("type") == "module"
        assert self.manifest.get("main") == "dist/index.js"
        assert self.manifest.get("types") == "dist/index.d.ts"
        assert "CYBRIK" in self.manifest.get("description", "")

    def test_semver_syntax(self) -> None:
        version = self.manifest.get("version", "")
        semver_pattern = r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$"
        assert re.match(semver_pattern, version), f"Invalid semver: {version}"
        assert version == "0.1.0"

    def test_script_definitions(self) -> None:
        scripts = self.manifest.get("scripts", {})
        assert "build" in scripts, "Missing build script"
        assert "tsc" in scripts["build"]
        assert "test" in scripts, "Missing test script"
        assert "node --test" in scripts["test"]

    def test_zero_runtime_dependencies(self) -> None:
        deps = self.manifest.get("dependencies", {})
        assert deps == {}, f"Runtime dependencies must be empty, found: {deps}"


class TestTypeScriptConfig:
    """Validates tsconfig.json compiler options for strict Node16 ESM."""

    @pytest.fixture(autouse=True)
    def setup_tsconfig(self) -> None:
        self.tsconfig_path = TS_SDK_DIR / "tsconfig.json"
        assert self.tsconfig_path.exists(), f"tsconfig.json not found at {self.tsconfig_path}"
        with open(self.tsconfig_path, "r", encoding="utf-8") as f:
            self.tsconfig = json.load(f)

    def test_compiler_options(self) -> None:
        opts = self.tsconfig.get("compilerOptions", {})
        assert opts.get("target") == "ES2022"
        assert opts.get("module") == "Node16"
        assert opts.get("moduleResolution") == "Node16"
        assert opts.get("declaration") is True
        assert opts.get("strict") is True
        assert opts.get("outDir") == "./dist"


class TestOpenAPISchemaContract:
    """Validates TypeScript models and interfaces against OpenAPI cybrik-soc-v1.yaml."""

    @pytest.fixture(autouse=True)
    def setup_contracts(self) -> None:
        assert OPENAPI_SPEC_PATH.exists(), f"OpenAPI spec not found at {OPENAPI_SPEC_PATH}"
        with open(OPENAPI_SPEC_PATH, "r", encoding="utf-8") as f:
            self.yaml_content = f.read()
        self.schemas = parse_simple_yaml_schemas(self.yaml_content)

        models_file = TS_SDK_DIR / "src" / "models.ts"
        assert models_file.exists(), f"models.ts not found at {models_file}"
        with open(models_file, "r", encoding="utf-8") as f:
            self.models_content = f.read()

    def test_openapi_schema_definitions_present(self) -> None:
        expected_schemas = {
            "AlertSeverity",
            "AlertStatus",
            "Alert",
            "AlertBatch",
            "IngestResponse",
            "SystemHealth",
        }
        for schema_name in expected_schemas:
            assert schema_name in self.schemas, f"Missing {schema_name} in OpenAPI spec"

    def test_alert_severity_contract(self) -> None:
        yaml_severities = self.schemas["AlertSeverity"]["enums"]
        expected_severities = {
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW",
            "INFORMATIONAL",
        }
        assert yaml_severities == expected_severities

        for sev in expected_severities:
            assert f"'{sev}'" in self.models_content or f'"{sev}"' in self.models_content

    def test_alert_status_contract(self) -> None:
        yaml_statuses = self.schemas["AlertStatus"]["enums"]
        expected_statuses = {
            "NEW",
            "TRIAGED",
            "INVESTIGATING",
            "CONTAINED",
            "RESOLVED",
            "CLOSED",
        }
        assert yaml_statuses == expected_statuses

        for status in expected_statuses:
            assert f"'{status}'" in self.models_content or f'"{status}"' in self.models_content

    def test_alert_model_fields(self) -> None:
        yaml_props = self.schemas["Alert"]["properties"]
        assert "alert_id" in yaml_props
        assert "title" in yaml_props
        assert "severity" in yaml_props
        assert "status" in yaml_props
        assert "created_at" in yaml_props

        assert "interface Alert" in self.models_content
        assert "alert_id: string" in self.models_content
        assert "title: string" in self.models_content
        assert "severity: AlertSeverity" in self.models_content
        assert "status: AlertStatus" in self.models_content
        assert "created_at: string" in self.models_content

    def test_system_health_model(self) -> None:
        assert "interface SystemHealth" in self.models_content
        assert "status:" in self.models_content
        assert "version: string" in self.models_content
        assert "timestamp: string" in self.models_content

    def test_ingest_response_model(self) -> None:
        assert "interface IngestResponse" in self.models_content
        assert "accepted: boolean" in self.models_content
        assert "count: number" in self.models_content
        assert "batch_id: string" in self.models_content

    def test_client_options_model(self) -> None:
        assert "interface CybrikClientOptions" in self.models_content
        assert "endpoint: string" in self.models_content
        assert "apiToken?: string" in self.models_content
        assert "tenantId?: string" in self.models_content
        assert "timeoutMs?: number" in self.models_content
        assert "customHeaders?: Record<string, string>" in self.models_content


class TestTypeScriptErrorTaxonomy:
    """Validates error hierarchy, HTTP status mapping, and code declarations."""

    @pytest.fixture(autouse=True)
    def setup_errors(self) -> None:
        errors_file = TS_SDK_DIR / "src" / "errors.ts"
        assert errors_file.exists(), f"errors.ts not found at {errors_file}"
        with open(errors_file, "r", encoding="utf-8") as f:
            self.errors_content = f.read()

    def test_error_classes_defined(self) -> None:
        expected_classes = [
            "CybrikSDKError",
            "CybrikAuthenticationError",
            "CybrikAuthorizationError",
            "CybrikNotFoundError",
            "CybrikRateLimitError",
            "CybrikServerError",
            "CybrikTimeoutError",
        ]
        for cls_name in expected_classes:
            assert f"class {cls_name}" in self.errors_content, f"Missing class {cls_name}"

    def test_error_inheritance_and_properties(self) -> None:
        assert "class CybrikSDKError extends Error" in self.errors_content
        assert "statusCode?: number" in self.errors_content
        assert "code: string" in self.errors_content
        assert "retryAfterSeconds?: number" in self.errors_content


class TestTypeScriptClientContract:
    """Validates CybrikClient methods, native fetch usage, and re-exports."""

    @pytest.fixture(autouse=True)
    def setup_client(self) -> None:
        client_file = TS_SDK_DIR / "src" / "client.ts"
        index_file = TS_SDK_DIR / "src" / "index.ts"
        assert client_file.exists()
        assert index_file.exists()

        with open(client_file, "r", encoding="utf-8") as f:
            self.client_content = f.read()
        with open(index_file, "r", encoding="utf-8") as f:
            self.index_content = f.read()

    def test_client_methods(self) -> None:
        assert "class CybrikClient" in self.client_content
        assert "getHealth(): Promise<SystemHealth>" in self.client_content
        assert "ingestEvents(events:" in self.client_content
        assert "getAlert(alertId: string): Promise<Alert>" in self.client_content
        assert "listAlerts(options?:" in self.client_content

    def test_header_injection_constants(self) -> None:
        assert "cybrik-sdk-ts/0.1.0" in self.client_content
        assert "Authorization" in self.client_content
        assert "X-Tenant-ID" in self.client_content

    def test_zero_external_runtime_imports(self) -> None:
        """Ensure no external libraries (e.g. axios, node-fetch, got, lodash) are imported."""
        src_dir = TS_SDK_DIR / "src"
        disallowed_packages = ["axios", "node-fetch", "got", "superagent", "lodash", "undici"]

        for ts_path in src_dir.glob("*.ts"):
            with open(ts_path, "r", encoding="utf-8") as f:
                content = f.read()
            for pkg in disallowed_packages:
                assert f"from '{pkg}'" not in content and f'from "{pkg}"' not in content

            # Verify all imports start with './' or standard built-in
            for line in content.splitlines():
                line = line.strip()
                if line.startswith("import ") and " from " in line:
                    module_target = line.split(" from ")[-1].strip(";'\" ")
                    assert module_target.startswith(
                        "./"
                    ), f"Non-local import found in {ts_path.name}: {module_target}"

    def test_index_re_exports(self) -> None:
        assert "errors.js" in self.index_content
        assert "models.js" in self.index_content
        assert "client.js" in self.index_content
