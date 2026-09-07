"""Unit test suite for CYBRIK Kubernetes Helm Chart manifests (WS-10-SUB-HELM-01).

Validates:
- YAML syntax across Chart.yaml, values.yaml, and all templates/*.yaml
- Chart.yaml metadata fields (apiVersion v2, name, version, appVersion, description, type)
- Rootless pod security standards (runAsNonRoot, allowPrivilegeEscalation, capabilities.drop: ALL)
- Explicit container resource requests and limits (CPU and memory)
- Comprehensive health probes (liveness, readiness, startup) for all core services
- Service definitions with correct port mappings (SOC 8000, Fabric 8080, Cyber AI 8090)
- NetworkPolicy ingress and egress isolation rules
- ServiceAccount security settings (automountServiceAccountToken: false)
"""

from __future__ import annotations

from pathlib import Path
import re
from typing import Any

import pytest

# Repository root and chart directory
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CHART_DIR = REPO_ROOT / "deploy" / "helm" / "cybrik-platform"
TEMPLATES_DIR = CHART_DIR / "templates"


def parse_yaml_scalar(val: str) -> Any:
    """Parse a single YAML scalar into appropriate Python type."""
    val = val.strip()
    if not val or val == "~" or val.lower() == "null":
        return None
    if val.lower() == "true":
        return True
    if val.lower() == "false":
        return False
    if re.fullmatch(r"-?[0-9]+", val):
        return int(val)
    if re.fullmatch(r"-?[0-9]+\.[0-9]+", val):
        return float(val)
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        return val[1:-1]
    if val.startswith("[") and val.endswith("]"):
        inner = val[1:-1].strip()
        if not inner:
            return []
        parts = [p.strip() for p in inner.split(",")]
        return [parse_yaml_scalar(p) for p in parts]
    if val.startswith("{") and val.endswith("}"):
        inner = val[1:-1].strip()
        if not inner:
            return {}
        result_dict: dict[str, Any] = {}
        for item in inner.split(","):
            if ":" in item:
                k, v = item.split(":", 1)
                result_dict[k.strip()] = parse_yaml_scalar(v.strip())
        return result_dict
    return val


def parse_yaml(text: str) -> Any:
    """Zero-external-dependency recursive-descent YAML parser for Kubernetes/Helm manifests."""
    lines = text.splitlines()

    def parse_block(index: int, min_indent: int) -> tuple[Any, int]:
        result: Any = None
        is_list = False
        is_dict = False

        while index < len(lines):
            line = lines[index]
            # Strip inline comments (preserving quotes)
            stripped_line = line
            if "#" in line:
                in_quote = False
                quote_char = ""
                cut = len(line)
                for i, ch in enumerate(line):
                    if ch in ('"', "'"):
                        if not in_quote:
                            in_quote = True
                            quote_char = ch
                        elif ch == quote_char:
                            in_quote = False
                    elif ch == "#" and not in_quote:
                        cut = i
                        break
                stripped_line = line[:cut]

            trimmed = stripped_line.strip()
            if not trimmed or trimmed == "---":
                index += 1
                continue

            indent = len(stripped_line) - len(stripped_line.lstrip())
            if indent < min_indent:
                break

            if trimmed.startswith("- "):
                if result is None:
                    result = []
                    is_list = True
                elif not is_list:
                    break

                item_text = trimmed[2:].strip()
                if not item_text:
                    sub_res, index = parse_block(index + 1, indent + 2)
                    result.append(sub_res)
                    continue
                elif ":" in item_text:
                    sub_dict: dict[str, Any] = {}
                    k, v = item_text.split(":", 1)
                    k = k.strip()
                    v = v.strip()
                    if v:
                        sub_dict[k] = parse_yaml_scalar(v)
                        sub_res, index = parse_block(index + 1, indent + 2)
                        if isinstance(sub_res, dict):
                            sub_dict.update(sub_res)
                    else:
                        sub_res, index = parse_block(index + 1, indent + 4)
                        sub_dict[k] = sub_res
                        sub_res2, index = parse_block(index, indent + 2)
                        if isinstance(sub_res2, dict):
                            sub_dict.update(sub_res2)
                    result.append(sub_dict)
                    continue
                else:
                    result.append(parse_yaml_scalar(item_text))
                    index += 1
                    continue

            if ":" in trimmed:
                if result is None:
                    result = {}
                    is_dict = True
                elif not is_dict:
                    break

                key, val = trimmed.split(":", 1)
                key = key.strip()
                val = val.strip()
                if val:
                    result[key] = parse_yaml_scalar(val)
                    index += 1
                else:
                    sub_res, index = parse_block(index + 1, indent + 1)
                    result[key] = sub_res
            else:
                index += 1

        return result, index

    res, _ = parse_block(0, 0)
    return res


def render_helm_template(content: str, values: dict[str, Any], release_name: str = "cybrik-release") -> str:
    """Render Go template directives in a Helm template string into standard Kubernetes YAML."""
    # 1. Resolve toYaml for capabilities
    def repl_to_yaml(m: re.Match[str]) -> str:
        path = m.group(1).strip()
        indent = int(m.group(2))
        curr: Any = values
        for p in path.split("."):
            if not p or p == "Values":
                continue
            curr = curr[p]
        prefix = " " * indent
        return "\n".join(f"{prefix}- {item}" for item in curr)

    rendered = re.sub(
        r"\{\{-?\s*toYaml\s+\.Values\.([a-zA-Z0-9_\.]+)\s*\|\s*nindent\s+(\d+)\s*-?\}\}",
        repl_to_yaml,
        content,
    )

    # 2. Resolve selectorLabels
    def repl_selector_labels(m: re.Match[str]) -> str:
        indent = int(m.group(1))
        prefix = " " * indent
        return (
            f"{prefix}app.kubernetes.io/name: cybrik-platform\n"
            f"{prefix}app.kubernetes.io/instance: {release_name}"
        )

    rendered = re.sub(
        r"\{\{-?\s*include\s+\"cybrik-platform\.selectorLabels\"\s+\.\s*\|\s*nindent\s+(\d+)\s*-?\}\}",
        repl_selector_labels,
        rendered,
    )

    # 3. Resolve common labels
    def repl_labels(m: re.Match[str]) -> str:
        indent = int(m.group(1))
        prefix = " " * indent
        return (
            f"{prefix}helm.sh/chart: cybrik-platform-1.0.0\n"
            f"{prefix}app.kubernetes.io/name: cybrik-platform\n"
            f"{prefix}app.kubernetes.io/instance: {release_name}\n"
            f"{prefix}app.kubernetes.io/version: \"1.0.0\"\n"
            f"{prefix}app.kubernetes.io/managed-by: Helm"
        )

    rendered = re.sub(
        r"\{\{-?\s*include\s+\"cybrik-platform\.labels\"\s+\.\s*\|\s*nindent\s+(\d+)\s*-?\}\}",
        repl_labels,
        rendered,
    )

    # 4. Resolve simple includes
    rendered = re.sub(r"\{\{\s*include\s+\"cybrik-platform\.fullname\"\s+\.\s*\}\}", "cybrik-platform", rendered)
    rendered = re.sub(r"\{\{\s*include\s+\"cybrik-platform\.name\"\s+\.\s*\}\}", "cybrik-platform", rendered)
    sa_name = values.get("serviceAccount", {}).get("name", "cybrik-platform-sa")
    rendered = re.sub(r"\{\{\s*include\s+\"cybrik-platform\.serviceAccountName\"\s+\.\s*\}\}", sa_name, rendered)

    # 5. Resolve value paths like {{ .Values.soc.replicaCount }} or {{ .Values.soc.port | quote }}
    def repl_value(m: re.Match[str]) -> str:
        path = m.group(1).strip()
        quote = bool(m.group(2))
        curr: Any = values
        for p in path.split("."):
            if not p or p == "Values":
                continue
            curr = curr[p]
        if isinstance(curr, bool):
            val_str = "true" if curr else "false"
        else:
            val_str = str(curr)
        if quote:
            val_str = f'"{val_str}"'
        return val_str

    rendered = re.sub(
        r"\{\{\s*\.Values\.([a-zA-Z0-9_\.]+)(\s*\|\s*quote)?\s*\}\}",
        repl_value,
        rendered,
    )

    # 6. Clean if/else/end directives
    lines = []
    for line in rendered.splitlines():
        trimmed = line.strip()
        if (
            trimmed.startswith("{{- if")
            or trimmed.startswith("{{- else")
            or trimmed.startswith("{{- end")
            or trimmed in ("{{- end }}", "{{- end -}}", "{{ end }}")
        ):
            continue
        lines.append(line)
    return "\n".join(lines)


@pytest.fixture(scope="session")
def chart_data() -> dict[str, Any]:
    chart_file = CHART_DIR / "Chart.yaml"
    assert chart_file.exists(), f"Chart.yaml not found at {chart_file}"
    return parse_yaml(chart_file.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def values_data() -> dict[str, Any]:
    values_file = CHART_DIR / "values.yaml"
    assert values_file.exists(), f"values.yaml not found at {values_file}"
    return parse_yaml(values_file.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def rendered_manifests(values_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    manifests: dict[str, dict[str, Any]] = {}
    for template_file in sorted(TEMPLATES_DIR.glob("*.yaml")):
        raw_content = template_file.read_text(encoding="utf-8")
        rendered_content = render_helm_template(raw_content, values_data)
        parsed = parse_yaml(rendered_content)
        assert parsed is not None, f"Failed to parse rendered template {template_file.name}"
        manifests[template_file.name] = parsed
    return manifests


# ============================================================================
# 1. Chart.yaml Metadata and Syntax Validation
# ============================================================================
class TestChartYaml:
    """Validates Chart.yaml syntax and required Helm v2 application fields."""

    def test_chart_yaml_exists(self) -> None:
        assert (CHART_DIR / "Chart.yaml").is_file()

    def test_chart_yaml_syntax(self, chart_data: dict[str, Any]) -> None:
        assert isinstance(chart_data, dict)
        assert len(chart_data) >= 6

    def test_chart_api_version_is_v2(self, chart_data: dict[str, Any]) -> None:
        assert chart_data.get("apiVersion") == "v2"

    def test_chart_name(self, chart_data: dict[str, Any]) -> None:
        assert chart_data.get("name") == "cybrik-platform"

    def test_chart_version(self, chart_data: dict[str, Any]) -> None:
        assert chart_data.get("version") == "1.0.0"

    def test_chart_app_version(self, chart_data: dict[str, Any]) -> None:
        assert chart_data.get("appVersion") == "1.0.0"

    def test_chart_description(self, chart_data: dict[str, Any]) -> None:
        assert chart_data.get("description") == "CYBRIK Unified Cyber AI Platform Production Helm Chart"

    def test_chart_type_is_application(self, chart_data: dict[str, Any]) -> None:
        assert chart_data.get("type") == "application"


# ============================================================================
# 2. values.yaml Configuration and Security Validation
# ============================================================================
class TestValuesYaml:
    """Validates production values.yaml configuration and rootless security settings."""

    def test_values_yaml_exists(self) -> None:
        assert (CHART_DIR / "values.yaml").is_file()

    def test_values_yaml_syntax(self, values_data: dict[str, Any]) -> None:
        assert isinstance(values_data, dict)
        expected_keys = {
            "global",
            "securityContext",
            "soc",
            "fabric",
            "cyberAi",
            "postgres",
            "valkey",
            "networkPolicy",
            "serviceAccount",
        }
        assert expected_keys.issubset(set(values_data.keys()))

    def test_global_values(self, values_data: dict[str, Any]) -> None:
        global_cfg = values_data.get("global", {})
        assert global_cfg.get("environment") == "production"
        assert global_cfg.get("registry") == "ghcr.io/hoangclinh"

    def test_rootless_pod_security_context_values(self, values_data: dict[str, Any]) -> None:
        sec = values_data.get("securityContext", {})
        assert sec.get("runAsNonRoot") is True
        assert sec.get("runAsUser") == 10001
        assert sec.get("runAsGroup") == 10001
        assert sec.get("fsGroup") == 10001
        assert sec.get("allowPrivilegeEscalation") is False
        assert sec.get("readOnlyRootFilesystem") is True
        caps = sec.get("capabilities", {})
        assert caps.get("drop") == ["ALL"]

    def test_soc_service_values(self, values_data: dict[str, Any]) -> None:
        soc = values_data.get("soc", {})
        assert soc.get("enabled") is True
        assert soc.get("replicaCount") == 2
        assert soc.get("port") == 8000
        assert soc.get("resources", {}).get("limits") == {"cpu": "1000m", "memory": "1Gi"}
        assert soc.get("resources", {}).get("requests") == {"cpu": "200m", "memory": "256Mi"}
        probes = soc.get("probes", {})
        assert probes.get("liveness", {}).get("path") == "/livez"
        assert probes.get("readiness", {}).get("path") == "/readyz"
        assert probes.get("startup", {}).get("path") == "/readyz"

    def test_fabric_service_values(self, values_data: dict[str, Any]) -> None:
        fabric = values_data.get("fabric", {})
        assert fabric.get("enabled") is True
        assert fabric.get("replicaCount") == 2
        assert fabric.get("port") == 8080
        assert fabric.get("resources", {}).get("limits") == {"cpu": "1000m", "memory": "1Gi"}
        assert fabric.get("resources", {}).get("requests") == {"cpu": "200m", "memory": "256Mi"}
        probes = fabric.get("probes", {})
        assert probes.get("liveness", {}).get("path") == "/health/liveness"
        assert probes.get("readiness", {}).get("path") == "/health/readiness"
        assert probes.get("startup", {}).get("path") == "/health/readiness"

    def test_cyber_ai_service_values(self, values_data: dict[str, Any]) -> None:
        cyber_ai = values_data.get("cyberAi", {})
        assert cyber_ai.get("enabled") is True
        assert cyber_ai.get("replicaCount") == 2
        assert cyber_ai.get("port") == 8090
        assert cyber_ai.get("resources", {}).get("limits") == {"cpu": "2000m", "memory": "2Gi"}
        assert cyber_ai.get("resources", {}).get("requests") == {"cpu": "500m", "memory": "512Mi"}
        probes = cyber_ai.get("probes", {})
        assert probes.get("liveness", {}).get("path") == "/health"
        assert probes.get("readiness", {}).get("path") == "/health"
        assert probes.get("startup", {}).get("path") == "/health"

    def test_datastores_and_policies_values(self, values_data: dict[str, Any]) -> None:
        pg = values_data.get("postgres", {})
        assert pg.get("enabled") is True
        assert pg.get("port") == 5432
        assert pg.get("persistence", {}).get("enabled") is True
        assert pg.get("persistence", {}).get("size") == "10Gi"

        valkey = values_data.get("valkey", {})
        assert valkey.get("enabled") is True
        assert valkey.get("port") == 6379
        assert valkey.get("persistence", {}).get("enabled") is True
        assert valkey.get("persistence", {}).get("size") == "5Gi"

        assert values_data.get("networkPolicy", {}).get("enabled") is True

        sa = values_data.get("serviceAccount", {})
        assert sa.get("create") is True
        assert sa.get("name") == "cybrik-platform-sa"
        assert sa.get("automountServiceAccountToken") is False


# ============================================================================
# 3. Helm Template YAML Syntax Validation
# ============================================================================
class TestHelmTemplatesYamlSyntax:
    """Validates that all template files exist and parse as valid YAML."""

    EXPECTED_TEMPLATES = [
        "deployment-soc.yaml",
        "deployment-fabric.yaml",
        "deployment-cyber-ai.yaml",
        "service-soc.yaml",
        "service-fabric.yaml",
        "service-cyber-ai.yaml",
        "configmap.yaml",
        "networkpolicy.yaml",
        "serviceaccount.yaml",
    ]

    def test_helpers_template_exists(self) -> None:
        helpers_file = TEMPLATES_DIR / "_helpers.tpl"
        assert helpers_file.is_file()
        content = helpers_file.read_text(encoding="utf-8")
        assert 'define "cybrik-platform.name"' in content
        assert 'define "cybrik-platform.fullname"' in content
        assert 'define "cybrik-platform.labels"' in content
        assert 'define "cybrik-platform.selectorLabels"' in content

    @pytest.mark.parametrize("template_name", EXPECTED_TEMPLATES)
    def test_template_file_exists(self, template_name: str) -> None:
        template_path = TEMPLATES_DIR / template_name
        assert template_path.is_file(), f"Template {template_name} missing from {TEMPLATES_DIR}"

    @pytest.mark.parametrize("template_name", EXPECTED_TEMPLATES)
    def test_template_yaml_syntax(self, template_name: str, rendered_manifests: dict[str, dict[str, Any]]) -> None:
        manifest = rendered_manifests.get(template_name)
        assert manifest is not None, f"Template {template_name} failed to render/parse"
        assert isinstance(manifest, dict), f"Rendered template {template_name} is not a dictionary"
        assert "apiVersion" in manifest, f"Missing apiVersion in {template_name}"
        assert "kind" in manifest, f"Missing kind in {template_name}"
        assert "metadata" in manifest, f"Missing metadata in {template_name}"


# ============================================================================
# 4. Rootless Pod Security Standards Validation
# ============================================================================
class TestRootlessPodSecurityStandards:
    """Validates container and pod securityContext compliance with Rootless / Restricted PSS."""

    DEPLOYMENT_TEMPLATES = [
        ("deployment-soc.yaml", "soc"),
        ("deployment-fabric.yaml", "fabric"),
        ("deployment-cyber-ai.yaml", "cyber-ai"),
    ]

    @pytest.mark.parametrize("template_name,container_name", DEPLOYMENT_TEMPLATES)
    def test_container_security_context_run_as_non_root(
        self, template_name: str, container_name: str, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests[template_name]
        containers = manifest["spec"]["template"]["spec"]["containers"]
        target = next((c for c in containers if c["name"] == container_name), None)
        assert target is not None, f"Container {container_name} not found in {template_name}"

        sec_ctx = target.get("securityContext", {})
        assert sec_ctx.get("runAsNonRoot") is True
        assert sec_ctx.get("runAsUser") == 10001
        assert sec_ctx.get("runAsGroup") == 10001

    @pytest.mark.parametrize("template_name,container_name", DEPLOYMENT_TEMPLATES)
    def test_container_security_context_no_privilege_escalation(
        self, template_name: str, container_name: str, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests[template_name]
        containers = manifest["spec"]["template"]["spec"]["containers"]
        target = next((c for c in containers if c["name"] == container_name), None)
        assert target is not None

        sec_ctx = target.get("securityContext", {})
        assert sec_ctx.get("allowPrivilegeEscalation") is False

    @pytest.mark.parametrize("template_name,container_name", DEPLOYMENT_TEMPLATES)
    def test_container_security_context_drop_all_capabilities(
        self, template_name: str, container_name: str, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests[template_name]
        containers = manifest["spec"]["template"]["spec"]["containers"]
        target = next((c for c in containers if c["name"] == container_name), None)
        assert target is not None

        sec_ctx = target.get("securityContext", {})
        capabilities = sec_ctx.get("capabilities", {})
        drop_list = capabilities.get("drop", [])
        assert drop_list == ["ALL"]

    @pytest.mark.parametrize("template_name,container_name", DEPLOYMENT_TEMPLATES)
    def test_container_security_context_read_only_root_filesystem(
        self, template_name: str, container_name: str, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests[template_name]
        containers = manifest["spec"]["template"]["spec"]["containers"]
        target = next((c for c in containers if c["name"] == container_name), None)
        assert target is not None

        sec_ctx = target.get("securityContext", {})
        assert sec_ctx.get("readOnlyRootFilesystem") is True

    @pytest.mark.parametrize("template_name,_", DEPLOYMENT_TEMPLATES)
    def test_pod_level_security_context(
        self, template_name: str, _: str, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests[template_name]
        pod_sec_ctx = manifest["spec"]["template"]["spec"].get("securityContext", {})
        assert pod_sec_ctx.get("runAsNonRoot") is True
        assert pod_sec_ctx.get("runAsUser") == 10001
        assert pod_sec_ctx.get("runAsGroup") == 10001
        assert pod_sec_ctx.get("fsGroup") == 10001


# ============================================================================
# 5. Explicit CPU and Memory Requests and Limits
# ============================================================================
class TestContainerResources:
    """Validates explicit CPU and memory resource requests and limits."""

    DEPLOYMENT_RESOURCES = [
        ("deployment-soc.yaml", "soc", "1000m", "1Gi", "200m", "256Mi"),
        ("deployment-fabric.yaml", "fabric", "1000m", "1Gi", "200m", "256Mi"),
        ("deployment-cyber-ai.yaml", "cyber-ai", "2000m", "2Gi", "500m", "512Mi"),
    ]

    @pytest.mark.parametrize("template_name,container_name,limit_cpu,limit_mem,req_cpu,req_mem", DEPLOYMENT_RESOURCES)
    def test_container_resources_defined(
        self,
        template_name: str,
        container_name: str,
        limit_cpu: str,
        limit_mem: str,
        req_cpu: str,
        req_mem: str,
        rendered_manifests: dict[str, dict[str, Any]],
    ) -> None:
        manifest = rendered_manifests[template_name]
        containers = manifest["spec"]["template"]["spec"]["containers"]
        target = next((c for c in containers if c["name"] == container_name), None)
        assert target is not None

        resources = target.get("resources", {})
        assert "limits" in resources, f"limits missing in {container_name}"
        assert "requests" in resources, f"requests missing in {container_name}"

        limits = resources["limits"]
        assert limits.get("cpu") == limit_cpu
        assert limits.get("memory") == limit_mem

        requests = resources["requests"]
        assert requests.get("cpu") == req_cpu
        assert requests.get("memory") == req_mem


# ============================================================================
# 6. Health Probes Validation (Liveness, Readiness, Startup)
# ============================================================================
class TestHealthProbes:
    """Validates liveness, readiness, and startup health probes."""

    PROBE_SPECS = [
        ("deployment-soc.yaml", "soc", "/livez", 8000, "/readyz", 8000, "/readyz", 8000),
        ("deployment-fabric.yaml", "fabric", "/health/liveness", 8080, "/health/readiness", 8080, "/health/readiness", 8080),
        ("deployment-cyber-ai.yaml", "cyber-ai", "/health", 8090, "/health", 8090, "/health", 8090),
    ]

    @pytest.mark.parametrize(
        "template_name,container_name,live_path,live_port,ready_path,ready_port,start_path,start_port",
        PROBE_SPECS,
    )
    def test_probes_configured(
        self,
        template_name: str,
        container_name: str,
        live_path: str,
        live_port: int,
        ready_path: str,
        ready_port: int,
        start_path: str,
        start_port: int,
        rendered_manifests: dict[str, dict[str, Any]],
    ) -> None:
        manifest = rendered_manifests[template_name]
        containers = manifest["spec"]["template"]["spec"]["containers"]
        target = next((c for c in containers if c["name"] == container_name), None)
        assert target is not None

        # Liveness probe
        assert "livenessProbe" in target, f"Missing livenessProbe in {container_name}"
        liveness = target["livenessProbe"]
        assert liveness.get("httpGet", {}).get("path") == live_path
        assert liveness.get("httpGet", {}).get("port") == live_port

        # Readiness probe
        assert "readinessProbe" in target, f"Missing readinessProbe in {container_name}"
        readiness = target["readinessProbe"]
        assert readiness.get("httpGet", {}).get("path") == ready_path
        assert readiness.get("httpGet", {}).get("port") == ready_port

        # Startup probe
        assert "startupProbe" in target, f"Missing startupProbe in {container_name}"
        startup = target["startupProbe"]
        assert startup.get("httpGet", {}).get("path") == start_path
        assert startup.get("httpGet", {}).get("port") == start_port


# ============================================================================
# 7. Service Port Exposure Validation
# ============================================================================
class TestServiceDefinitions:
    """Validates Kubernetes Service port exposures for core components."""

    SERVICE_SPECS = [
        ("service-soc.yaml", 8000, "soc"),
        ("service-fabric.yaml", 8080, "fabric"),
        ("service-cyber-ai.yaml", 8090, "cyber-ai"),
    ]

    @pytest.mark.parametrize("service_template,expected_port,component", SERVICE_SPECS)
    def test_service_ports_and_selectors(
        self,
        service_template: str,
        expected_port: int,
        component: str,
        rendered_manifests: dict[str, dict[str, Any]],
    ) -> None:
        manifest = rendered_manifests[service_template]
        assert manifest.get("kind") == "Service"
        spec = manifest.get("spec", {})
        assert spec.get("type") == "ClusterIP"

        ports = spec.get("ports", [])
        assert len(ports) >= 1
        port_entry = ports[0]
        assert port_entry.get("port") == expected_port
        assert port_entry.get("protocol") == "TCP"

        selector = spec.get("selector", {})
        assert selector.get("app.kubernetes.io/component") == component


# ============================================================================
# 8. NetworkPolicy Isolation Rules
# ============================================================================
class TestNetworkPolicy:
    """Validates NetworkPolicy ingress and egress isolation rules."""

    def test_network_policy_exists_and_applies_policy_types(
        self, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests["networkpolicy.yaml"]
        assert manifest.get("kind") == "NetworkPolicy"
        spec = manifest.get("spec", {})
        policy_types = spec.get("policyTypes", [])
        assert "Ingress" in policy_types
        assert "Egress" in policy_types

    def test_network_policy_defines_ingress_rules(
        self, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests["networkpolicy.yaml"]
        spec = manifest.get("spec", {})
        ingress = spec.get("ingress", [])
        assert len(ingress) >= 1

        ingress_rule = ingress[0]
        ports = [p.get("port") for p in ingress_rule.get("ports", [])]
        assert 8000 in ports
        assert 8080 in ports
        assert 8090 in ports
        assert 5432 in ports
        assert 6379 in ports

    def test_network_policy_defines_egress_rules(
        self, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests["networkpolicy.yaml"]
        spec = manifest.get("spec", {})
        egress = spec.get("egress", [])
        assert len(egress) >= 2

        all_egress_ports: list[int] = []
        for rule in egress:
            for p in rule.get("ports", []):
                all_egress_ports.append(p.get("port"))

        assert 8000 in all_egress_ports
        assert 8080 in all_egress_ports
        assert 8090 in all_egress_ports
        assert 5432 in all_egress_ports
        assert 6379 in all_egress_ports
        assert 53 in all_egress_ports  # DNS egress


# ============================================================================
# 9. ServiceAccount Token Automount Settings
# ============================================================================
class TestServiceAccount:
    """Validates ServiceAccount configuration with automount token disabled."""

    def test_service_account_disables_token_automount(
        self, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests["serviceaccount.yaml"]
        assert manifest.get("kind") == "ServiceAccount"
        assert manifest.get("automountServiceAccountToken") is False

    def test_service_account_name(
        self, rendered_manifests: dict[str, dict[str, Any]]
    ) -> None:
        manifest = rendered_manifests["serviceaccount.yaml"]
        name = manifest.get("metadata", {}).get("name")
        assert name == "cybrik-platform-sa"


# ============================================================================
# 10. ConfigMap Shared Configuration
# ============================================================================
class TestConfigMap:
    """Validates ConfigMap shared platform configuration."""

    def test_configmap_data(self, rendered_manifests: dict[str, dict[str, Any]]) -> None:
        manifest = rendered_manifests["configmap.yaml"]
        assert manifest.get("kind") == "ConfigMap"
        data = manifest.get("data", {})
        assert data.get("ENVIRONMENT") == "production"
        assert data.get("SOC_PORT") == "8000"
        assert data.get("FABRIC_PORT") == "8080"
        assert data.get("CYBER_AI_PORT") == "8090"
        assert data.get("POSTGRES_PORT") == "5432"
        assert data.get("VALKEY_PORT") == "6379"
