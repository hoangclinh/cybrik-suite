"""Contract qualification tests for CYBRIK TypeScript SDK Real-Time Streaming Client.

Validates @cybrik/sdk-ts streaming types, SSE event parser contract,
AlertStreamSubscription implementation, CybrikClient.subscribeAlerts endpoint,
and zero-external-dependency invariants against OpenAPI / SSE platform contracts.
"""

from __future__ import annotations

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


class TestTypeScriptStreamingSourceFiles:
    """Verifies that all required streaming implementation and export files exist."""

    def test_streaming_source_file_exists(self) -> None:
        streaming_file = TS_SDK_DIR / "src" / "streaming.ts"
        assert streaming_file.exists(), f"Missing {streaming_file}"

    def test_client_source_file_exists(self) -> None:
        client_file = TS_SDK_DIR / "src" / "client.ts"
        assert client_file.exists(), f"Missing {client_file}"

    def test_index_source_file_exists(self) -> None:
        index_file = TS_SDK_DIR / "src" / "index.ts"
        assert index_file.exists(), f"Missing {index_file}"

    def test_streaming_test_file_exists(self) -> None:
        test_file = TS_SDK_DIR / "tests" / "streaming.test.js"
        assert test_file.exists(), f"Missing {test_file}"


class TestTypeScriptStreamingContract:
    """Validates type definitions, interfaces, and classes in streaming.ts."""

    @pytest.fixture(autouse=True)
    def setup_streaming_content(self) -> None:
        streaming_file = TS_SDK_DIR / "src" / "streaming.ts"
        assert streaming_file.exists()
        with open(streaming_file, "r", encoding="utf-8") as f:
            self.streaming_content = f.read()

    def test_stream_event_type_definition(self) -> None:
        assert "type StreamEventType" in self.streaming_content
        expected_types = [
            "alert.created",
            "alert.updated",
            "case.opened",
            "heartbeat",
        ]
        for ev_type in expected_types:
            assert f"'{ev_type}'" in self.streaming_content or f'"{ev_type}"' in self.streaming_content

    def test_stream_event_interface(self) -> None:
        assert "interface StreamEvent" in self.streaming_content
        assert "id: string" in self.streaming_content
        assert "event: StreamEventType" in self.streaming_content
        assert "data: T" in self.streaming_content
        assert "timestamp?: string" in self.streaming_content
        assert "retry?: number" in self.streaming_content

    def test_stream_subscription_options_interface(self) -> None:
        assert "interface StreamSubscriptionOptions" in self.streaming_content
        assert "filter?:" in self.streaming_content
        assert "severity?: string[]" in self.streaming_content
        assert "status?: string[]" in self.streaming_content
        assert "source?: string[]" in self.streaming_content
        assert "signal?: AbortSignal" in self.streaming_content
        assert "reconnect?: boolean" in self.streaming_content
        assert "maxReconnectAttempts?: number" in self.streaming_content
        assert "initialBackoffMs?: number" in self.streaming_content
        assert "maxBackoffMs?: number" in self.streaming_content

    def test_alert_stream_subscription_class(self) -> None:
        assert "class AlertStreamSubscription" in self.streaming_content
        assert "AsyncIterable<StreamEvent>" in self.streaming_content
        assert "[Symbol.asyncIterator]" in self.streaming_content
        assert "close(): void" in self.streaming_content

    def test_zero_external_runtime_imports_in_streaming(self) -> None:
        """Enforces zero external runtime dependencies (EventSource npm, axios, etc.)."""
        disallowed = ["eventsource", "axios", "node-fetch", "got", "rxjs"]
        for pkg in disallowed:
            assert f"from '{pkg}'" not in self.streaming_content
            assert f'from "{pkg}"' not in self.streaming_content

        for line in self.streaming_content.splitlines():
            trimmed = line.strip()
            if trimmed.startswith("import ") and " from " in trimmed:
                target = trimmed.split(" from ")[-1].strip(";'\" ")
                assert target.startswith("./"), f"Disallowed external import found: {target}"


class TestTypeScriptClientStreamingContract:
    """Validates CybrikClient integration with real-time streaming."""

    @pytest.fixture(autouse=True)
    def setup_client_content(self) -> None:
        client_file = TS_SDK_DIR / "src" / "client.ts"
        index_file = TS_SDK_DIR / "src" / "index.ts"
        with open(client_file, "r", encoding="utf-8") as f:
            self.client_content = f.read()
        with open(index_file, "r", encoding="utf-8") as f:
            self.index_content = f.read()

    def test_subscribe_alerts_method_present(self) -> None:
        assert "subscribeAlerts(" in self.client_content
        assert "AlertStreamSubscription" in self.client_content

    def test_streaming_endpoint_path(self) -> None:
        assert "/api/v1/alerts/stream" in self.client_content

    def test_index_re_exports_streaming(self) -> None:
        assert "streaming.js" in self.index_content


class TestOpenAPIStreamingCompatibilityContract:
    """Validates alignment of streaming models with OpenAPI schemas."""

    @pytest.fixture(autouse=True)
    def setup_contracts(self) -> None:
        assert OPENAPI_SPEC_PATH.exists()
        with open(OPENAPI_SPEC_PATH, "r", encoding="utf-8") as f:
            self.yaml_content = f.read()
        self.schemas = parse_simple_yaml_schemas(self.yaml_content)

        streaming_file = TS_SDK_DIR / "src" / "streaming.ts"
        with open(streaming_file, "r", encoding="utf-8") as f:
            self.streaming_content = f.read()

    def test_filter_fields_match_alert_schema(self) -> None:
        alert_props = self.schemas["Alert"]["properties"]
        # The filter options: severity, status, source must correspond to Alert fields
        assert "severity" in alert_props
        assert "status" in alert_props
        assert "source" in alert_props

    def test_alert_severity_contract_aligned(self) -> None:
        severities = self.schemas["AlertSeverity"]["enums"]
        assert "CRITICAL" in severities
        assert "HIGH" in severities
        assert "MEDIUM" in severities
        assert "LOW" in severities
        assert "INFORMATIONAL" in severities
