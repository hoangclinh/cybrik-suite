# CYBRIK Unified Python Client SDK & Developer CLI Utility (`cybrik-sdk`)

The `cybrik-sdk` package provides an asynchronous and synchronous Python client for the CYBRIK Autonomous Cyber Defense Platform, encompassing:
- **SOC Command Center (`SocClient` / `SyncSocClient`)**: Case triage, investigation retrieval, case export.
- **Security Tool Fabric (`FabricClient` / `SyncFabricClient`)**: Capability discovery, containment execution, receipts.
- **Cyber AI Platform (`AiClient` / `SyncAiClient`)**: Local AI model benchmark execution, evaluation scenarios.
- **Developer CLI (`cybrik`)**: Command-line interface for system health checks, case management, containment catalog discovery, and platform status.

## Installation

```bash
pip install cybrik-sdk
```

## Quickstart

### Asynchronous Client

```python
import asyncio
from cybrik_sdk import CybrikClient, CybrikConfig


async def main() -> None:
    config = CybrikConfig(
        base_url="http://localhost:8000",
        token="ey...",
    )
    async with CybrikClient(config) as client:
        # SOC Operations
        cases = await client.soc.list_cases(status="open")
        for case in cases:
            print(f"Case {case.id}: {case.title} [{case.priority}]")

        # Fabric Operations
        capabilities = await client.fabric.list_capabilities()
        print(f"Available capabilities: {len(capabilities)}")

        # AI Operations
        health = await client.ai.get_health()
        print(f"AI Platform health: {health}")


asyncio.run(main())
```

### Synchronous Client

```python
from cybrik_sdk import SyncCybrikClient, CybrikConfig

config = CybrikConfig(base_url="http://localhost:8000")
with SyncCybrikClient(config) as client:
    health = client.get_health()
    print("Health report:", health)
```

### Developer CLI

```bash
# Display version and connected endpoints
cybrik version

# Check health of SOC, Fabric, and AI platform
cybrik health

# List open SOC cases
cybrik cases list

# List available containment actions
cybrik containment list
```
