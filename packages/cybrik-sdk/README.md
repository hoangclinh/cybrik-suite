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

# Content Pack Distribution Engine
# Build a content pack from directory
cybrik pack build ./my-pack -o my-pack-1.0.0.cybrik-pack

# Validate security invariants and checksum integrity
cybrik pack validate my-pack-1.0.0.cybrik-pack

# Inspect content pack metadata, inventory, and checksums
cybrik pack inspect my-pack-1.0.0.cybrik-pack
```

## Content Packs (`cybrik_sdk.pack`)

CYBRIK Content Packs (`.cybrik-pack`) provide a secure, canonical distribution format for declarative security artifacts:
- **Sigma Detection Rules** (`sigma_rules`)
- **SOAR Playbooks** (`soar_playbooks`)
- **SIEM Parsers** (`siem_parsers`)
- **Documentation** (`documentation`)

### Security Guardrails

The Content Pack distribution engine strictly enforces seven security invariants:
1. **Path Traversal Defense**: Rejects parent references (`..`), absolute paths (`/`), and Windows drive letters (`C:`).
2. **Symlink & Hardlink Rejection**: Rejects symlinks, hardlinks, FIFOs, and special devices.
3. **Archive Bomb Defense**: Enforces maximum unpacked size (50 MB), file count (500), and compression ratio (20:1).
4. **Content-Type Allowlist & Executable Blocklist**: Rejects binaries, scripts (`.sh`, `.exe`, `.so`, `.dylib`, `.py`), and inspects magic byte headers.
5. **Cryptographic SHA-256 Verification**: Verifies SHA-256 integrity of all constituent files.
6. **Tamper Detection**: Rejects any archive or manifest modification.
7. **No Arbitrary Code Execution**: Content packs contain strictly declarative data.
