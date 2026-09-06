"""Developer CLI utility for CYBRIK Autonomous Cyber Defense Platform."""

from __future__ import annotations

import sys
from typing import Any

import typer

from cybrik_sdk.client import SyncCybrikClient
from cybrik_sdk.config import CybrikConfig

__version__ = "0.1.0"

app = typer.Typer(
    name="cybrik",
    help="CYBRIK Unified Developer CLI Utility",
    no_args_is_help=True,
)

cases_app = typer.Typer(
    name="cases",
    help="Manage and inspect SOC incident cases",
    no_args_is_help=True,
)
app.add_typer(cases_app, name="cases")

containment_app = typer.Typer(
    name="containment",
    help="Manage and inspect SOAR containment actions",
    no_args_is_help=True,
)
app.add_typer(containment_app, name="containment")


CANONICAL_CONTAINMENT_CATALOG: list[dict[str, str]] = [
    {
        "action": "isolate_host",
        "risk_tier": "CRITICAL",
        "reversible": "yes",
        "description": "Network isolation for compromised endpoint host",
    },
    {
        "action": "unisolate_host",
        "risk_tier": "MEDIUM",
        "reversible": "no",
        "description": "Restore network connectivity to isolated endpoint",
    },
    {
        "action": "revoke_user_session",
        "risk_tier": "LOW",
        "reversible": "no",
        "description": "Revoke active authentication sessions and tokens",
    },
    {
        "action": "disable_user",
        "risk_tier": "HIGH",
        "reversible": "no",
        "description": "Disable compromised user identity account in IdP",
    },
    {
        "action": "block_ip",
        "risk_tier": "MEDIUM",
        "reversible": "yes",
        "description": "Block adversary IP on perimeter firewall",
    },
    {
        "action": "unblock_ip",
        "risk_tier": "LOW",
        "reversible": "no",
        "description": "Remove IP block rule from perimeter firewall",
    },
    {
        "action": "sinkhole_dns",
        "risk_tier": "HIGH",
        "reversible": "yes",
        "description": "Redirect malicious domain to sinkhole IP",
    },
    {
        "action": "unsinkhole_dns",
        "risk_tier": "LOW",
        "reversible": "no",
        "description": "Remove DNS sinkhole redirection rule",
    },
    {
        "action": "terminate_process",
        "risk_tier": "CRITICAL",
        "reversible": "no",
        "description": "Terminate executing malicious process on endpoint",
    },
    {
        "action": "quarantine_file",
        "risk_tier": "MEDIUM",
        "reversible": "no",
        "description": "Isolate malicious file artifact into forensic quarantine vault",
    },
]


def _build_config(
    base_url: str | None = None,
    soc_url: str | None = None,
    fabric_url: str | None = None,
    ai_url: str | None = None,
    token: str | None = None,
    api_key: str | None = None,
) -> CybrikConfig:
    """Helper to assemble CybrikConfig from CLI arguments."""
    base = base_url or "http://localhost:8000"
    return CybrikConfig(
        base_url=base,
        soc_url=soc_url,
        fabric_url=fabric_url,
        ai_url=ai_url,
        token=token,
        api_key=api_key,
    )


@app.command("version")
def version_cmd(
    base_url: str | None = typer.Option(None, "--base-url", help="Base gateway URL"),
    soc_url: str | None = typer.Option(None, "--soc-url", help="SOC Command Center URL"),
    fabric_url: str | None = typer.Option(None, "--fabric-url", help="Security Tool Fabric URL"),
    ai_url: str | None = typer.Option(None, "--ai-url", help="Cyber AI Platform URL"),
) -> None:
    """Display SDK version and connected endpoint URLs."""
    config = _build_config(base_url, soc_url, fabric_url, ai_url)
    typer.echo(f"CYBRIK Unified SDK v{__version__}")
    typer.echo("Connected Endpoint URLs:")
    typer.echo(f"  Base Gateway: {config.base_url}")
    typer.echo(f"  SOC Center:   {config.soc_url}")
    typer.echo(f"  Tool Fabric:  {config.fabric_url}")
    typer.echo(f"  AI Platform:  {config.ai_url}")


@app.command("health")
def health_cmd(
    base_url: str | None = typer.Option(None, "--base-url", help="Base gateway URL"),
    soc_url: str | None = typer.Option(None, "--soc-url", help="SOC Command Center URL"),
    fabric_url: str | None = typer.Option(None, "--fabric-url", help="Security Tool Fabric URL"),
    ai_url: str | None = typer.Option(None, "--ai-url", help="Cyber AI Platform URL"),
    token: str | None = typer.Option(None, "--token", help="Bearer authorization token"),
    api_key: str | None = typer.Option(None, "--api-key", help="API key"),
) -> None:
    """Ping SOC, Fabric, and AI platform health endpoints."""
    config = _build_config(base_url, soc_url, fabric_url, ai_url, token, api_key)
    all_healthy = True

    typer.echo("CYBRIK Ecosystem Health Check:")
    with SyncCybrikClient(config) as client:
        # Check SOC
        try:
            soc_res = client.soc.get_health()
            status_text = soc_res.get("status", "ok") if isinstance(soc_res, dict) else "ok"
            typer.echo(f"  [PASS] SOC Command Center: {status_text} ({config.soc_url})")
        except Exception as err:
            all_healthy = False
            typer.echo(f"  [FAIL] SOC Command Center: {err} ({config.soc_url})", err=True)

        # Check Fabric
        try:
            fab_res = client.fabric.get_health()
            status_text = fab_res.get("status", "ok") if isinstance(fab_res, dict) else "ok"
            typer.echo(f"  [PASS] Security Tool Fabric: {status_text} ({config.fabric_url})")
        except Exception as err:
            all_healthy = False
            typer.echo(f"  [FAIL] Security Tool Fabric: {err} ({config.fabric_url})", err=True)

        # Check AI Platform
        try:
            ai_res = client.ai.get_health()
            status_text = ai_res.get("status", "ok") if isinstance(ai_res, dict) else "ok"
            typer.echo(f"  [PASS] Cyber AI Platform: {status_text} ({config.ai_url})")
        except Exception as err:
            all_healthy = False
            typer.echo(f"  [FAIL] Cyber AI Platform: {err} ({config.ai_url})", err=True)

    if not all_healthy:
        sys.exit(1)


@cases_app.command("list")
def cases_list(
    status: str = typer.Option("open", "--status", "-s", help="Filter cases by status"),
    limit: int = typer.Option(50, "--limit", "-l", help="Max cases to retrieve"),
    base_url: str | None = typer.Option(None, "--base-url", help="Base gateway URL"),
    soc_url: str | None = typer.Option(None, "--soc-url", help="SOC Command Center URL"),
    token: str | None = typer.Option(None, "--token", help="Bearer authorization token"),
    api_key: str | None = typer.Option(None, "--api-key", help="API key"),
) -> None:
    """List cases from SOC Command Center."""
    config = _build_config(base_url=base_url, soc_url=soc_url, token=token, api_key=api_key)
    with SyncCybrikClient(config) as client:
        cases = client.soc.list_cases(status=status, page_size=limit)

    if not cases:
        typer.echo(f"No cases found with status '{status}'.")
        return

    typer.echo(f"Found {len(cases)} case(s) [status={status}]:")
    typer.echo("-" * 78)
    typer.echo(f"{'CASE ID':<36} | {'PRIORITY':<8} | {'STATUS':<10} | {'TITLE'}")
    typer.echo("-" * 78)
    for c in cases:
        prio = (c.priority or "medium").upper()
        stat = (c.status or "open").upper()
        typer.echo(f"{c.id:<36} | {prio:<8} | {stat:<10} | {c.title}")


@containment_app.command("list")
def containment_list(
    base_url: str | None = typer.Option(None, "--base-url", help="Base gateway URL"),
    fabric_url: str | None = typer.Option(None, "--fabric-url", help="Security Tool Fabric URL"),
    token: str | None = typer.Option(None, "--token", help="Bearer authorization token"),
    api_key: str | None = typer.Option(None, "--api-key", help="API key"),
    offline: bool = typer.Option(False, "--offline", help="Display offline canonical catalog"),
) -> None:
    """List available SOAR containment actions."""
    capabilities: list[dict[str, Any]] = []
    if not offline:
        try:
            config = _build_config(
                base_url=base_url, fabric_url=fabric_url, token=token, api_key=api_key
            )
            with SyncCybrikClient(config) as client:
                capabilities = client.fabric.list_capabilities()
        except Exception:
            capabilities = []

    # If capabilities returned from live endpoint, display them
    if capabilities:
        typer.echo(f"Available Tool Fabric Capabilities ({len(capabilities)} registered):")
        typer.echo("-" * 78)
        typer.echo(f"{'ACTION / CAPABILITY':<24} | {'RISK TIER':<9} | {'DESCRIPTION'}")
        typer.echo("-" * 78)
        for cap in capabilities:
            name = cap.get("name", cap.get("action", "unknown"))
            tier = cap.get("risk_tier", "MEDIUM")
            desc = cap.get("description", "")
            typer.echo(f"{name:<24} | {tier:<9} | {desc}")
        return

    # Fallback to standard canonical containment catalog
    typer.echo(
        f"Canonical SOAR Containment Catalog ({len(CANONICAL_CONTAINMENT_CATALOG)} actions):"
    )
    typer.echo("-" * 88)
    typer.echo(f"{'ACTION':<22} | {'RISK TIER':<9} | {'REVERSIBLE':<10} | {'DESCRIPTION'}")
    typer.echo("-" * 88)
    for item in CANONICAL_CONTAINMENT_CATALOG:
        act = item["action"]
        risk = item["risk_tier"]
        rev = item["reversible"]
        desc = item["description"]
        typer.echo(f"{act:<22} | {risk:<9} | {rev:<10} | {desc}")


if __name__ == "__main__":
    app()
