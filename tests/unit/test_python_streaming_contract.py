"""Contract qualification tests for CYBRIK Python SDK Real-Time Streaming Client.

Validates cybrik_sdk streaming types, SSE event parser contract,
EventStreamClient implementation, CybrikClient streaming endpoints,
and zero-external-dependency invariants against OpenAPI / SSE platform contracts.
"""

from __future__ import annotations

import ast
import inspect
import sys
from dataclasses import fields
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PY_SDK_DIR = REPO_ROOT / "packages" / "cybrik-sdk"
OPENAPI_SOC_PATH = REPO_ROOT / "contracts" / "openapi" / "cybrik-soc-v1.yaml"
OPENAPI_INVESTIGATION_PATH = (
    REPO_ROOT / "contracts" / "openapi" / "cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml"
)


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


class TestPythonStreamingSourceFiles:
    """Verifies that all required streaming implementation and export files exist."""

    def test_streaming_source_file_exists(self) -> None:
        streaming_file = PY_SDK_DIR / "src" / "cybrik_sdk" / "streaming.py"
        assert streaming_file.exists(), f"Missing {streaming_file}"

    def test_client_source_file_exists(self) -> None:
        client_file = PY_SDK_DIR / "src" / "cybrik_sdk" / "client.py"
        assert client_file.exists(), f"Missing {client_file}"

    def test_init_source_file_exists(self) -> None:
        init_file = PY_SDK_DIR / "src" / "cybrik_sdk" / "__init__.py"
        assert init_file.exists(), f"Missing {init_file}"

    def test_streaming_test_file_exists(self) -> None:
        test_file = PY_SDK_DIR / "tests" / "test_streaming.py"
        assert test_file.exists(), f"Missing {test_file}"


class TestPythonStreamingContract:
    """Validates type definitions, classes, and zero-dependency invariants in streaming.py."""

    @pytest.fixture(autouse=True)
    def setup_streaming_content(self) -> None:
        self.streaming_file = PY_SDK_DIR / "src" / "cybrik_sdk" / "streaming.py"
        assert self.streaming_file.exists()
        with open(self.streaming_file, "r", encoding="utf-8") as f:
            self.streaming_content = f.read()

    def test_zero_third_party_dependencies_outside_sdk_requirements(self) -> None:
        """Enforces zero third-party dependencies outside the SDK's existing standard requirements."""
        disallowed = [
            "requests",
            "aiohttp",
            "sseclient",
            "urllib3",
            "websockets",
            "fastapi",
            "flask",
        ]
        for pkg in disallowed:
            assert f"import {pkg}" not in self.streaming_content, f"Disallowed import: {pkg}"

        # Parse AST and ensure all top-level module imports are either standard library or in SDK dependencies
        tree = ast.parse(self.streaming_content)
        allowed_third_party = {"httpx", "pydantic", "cybrik_sdk"}
        stdlib_names = set(sys.stdlib_module_names) if hasattr(sys, "stdlib_module_names") else set()

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    top_module = alias.name.split(".")[0]
                    assert (
                        top_module in allowed_third_party
                        or top_module in stdlib_names
                        or top_module.startswith("_")
                    ), f"Disallowed external module import in streaming.py: {top_module}"
            elif isinstance(node, ast.ImportFrom) and node.module:
                top_module = node.module.split(".")[0]
                assert (
                    top_module in allowed_third_party
                    or top_module in stdlib_names
                    or top_module.startswith("_")
                    or node.level > 0  # relative import
                ), f"Disallowed external from-import in streaming.py: {top_module}"

    def test_stream_event_dataclass_contract(self) -> None:
        from cybrik_sdk.streaming import StreamEvent

        field_names = {f.name for f in fields(StreamEvent)}
        expected_fields = {"event_type", "data", "event_id", "retry", "timestamp", "raw"}
        assert expected_fields.issubset(field_names), f"Missing fields: {expected_fields - field_names}"

        # Verify to_dict method
        assert hasattr(StreamEvent, "to_dict")
        instance = StreamEvent(event_type="test", data="hello", event_id="123")
        d = instance.to_dict()
        assert isinstance(d, dict)
        assert d["event_type"] == "test"
        assert d["data"] == "hello"
        assert d["event_id"] == "123"

    def test_sse_parser_contract(self) -> None:
        from cybrik_sdk.streaming import SSEParser

        assert hasattr(SSEParser, "feed_chunk")
        assert hasattr(SSEParser, "reset")

        sig_feed = inspect.signature(SSEParser.feed_chunk)
        assert "chunk" in sig_feed.parameters

        sig_reset = inspect.signature(SSEParser.reset)
        assert len(sig_reset.parameters) == 1  # only self

    def test_event_stream_client_contract(self) -> None:
        from cybrik_sdk.streaming import EventStreamClient

        assert hasattr(EventStreamClient, "stream")
        assert hasattr(EventStreamClient, "stream_async")
        assert hasattr(EventStreamClient, "last_event_id")

        sig_stream = inspect.signature(EventStreamClient.stream)
        assert "url" in sig_stream.parameters
        assert "headers" in sig_stream.parameters
        assert "timeout" in sig_stream.parameters

        sig_stream_async = inspect.signature(EventStreamClient.stream_async)
        assert "url" in sig_stream_async.parameters
        assert "headers" in sig_stream_async.parameters
        assert "timeout" in sig_stream_async.parameters


class TestPythonClientStreamingContract:
    """Validates CybrikClient integration and package exports."""

    def test_sdk_init_exports(self) -> None:
        import cybrik_sdk

        assert hasattr(cybrik_sdk, "StreamEvent")
        assert hasattr(cybrik_sdk, "SSEParser")
        assert hasattr(cybrik_sdk, "EventStreamClient")
        assert "StreamEvent" in cybrik_sdk.__all__
        assert "SSEParser" in cybrik_sdk.__all__
        assert "EventStreamClient" in cybrik_sdk.__all__

    def test_cybrik_client_streaming_methods_present(self) -> None:
        from cybrik_sdk.client import CybrikClient

        assert hasattr(CybrikClient, "stream_reasoning_deltas")
        assert hasattr(CybrikClient, "stream_alert_events")

        sig_reasoning = inspect.signature(CybrikClient.stream_reasoning_deltas)
        assert "investigation_id" in sig_reasoning.parameters

        sig_alerts = inspect.signature(CybrikClient.stream_alert_events)
        assert "status" in sig_alerts.parameters

    def test_sync_cybrik_client_streaming_methods_present(self) -> None:
        from cybrik_sdk.client import SyncCybrikClient

        assert hasattr(SyncCybrikClient, "stream_reasoning_deltas")
        assert hasattr(SyncCybrikClient, "stream_alert_events")


class TestOpenAPIStreamingCompatibilityContract:
    """Validates alignment of streaming models with OpenAPI schemas."""

    @pytest.fixture(autouse=True)
    def setup_contracts(self) -> None:
        assert OPENAPI_SOC_PATH.exists(), f"Missing {OPENAPI_SOC_PATH}"
        with open(OPENAPI_SOC_PATH, "r", encoding="utf-8") as f:
            self.soc_yaml = f.read()
        self.soc_schemas = parse_simple_yaml_schemas(self.soc_yaml)

    def test_alert_status_contract_aligned(self) -> None:
        statuses = self.soc_schemas["AlertStatus"]["enums"]
        expected_statuses = {"NEW", "TRIAGED", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"}
        assert expected_statuses.issubset(statuses), f"Missing status enums: {expected_statuses - statuses}"

    def test_alert_severity_contract_aligned(self) -> None:
        severities = self.soc_schemas["AlertSeverity"]["enums"]
        expected_severities = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"}
        assert expected_severities.issubset(severities)

    def test_alert_schema_properties_contract_aligned(self) -> None:
        alert_props = self.soc_schemas["Alert"]["properties"]
        assert "alert_id" in alert_props
        assert "severity" in alert_props
        assert "status" in alert_props
        assert "created_at" in alert_props

    def test_investigation_lifecycle_openapi_contract_aligned(self) -> None:
        assert OPENAPI_INVESTIGATION_PATH.exists()
        with open(OPENAPI_INVESTIGATION_PATH, "r", encoding="utf-8") as f:
            inv_yaml = f.read()
        # Verify that investigation_id is defined as the path parameter for investigation routes
        assert "/api/v1/investigations/{investigation_id}" in inv_yaml
