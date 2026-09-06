"""Configuration definitions for the CYBRIK Unified SDK."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class CybrikConfig:
    """Unified configuration for CYBRIK client SDK.

    Attributes:
        base_url: Base endpoint URL for the unified gateway or ingress.
        soc_url: Dedicated endpoint URL for the SOC Command Center.
        fabric_url: Dedicated endpoint URL for the Security Tool Fabric.
        ai_url: Dedicated endpoint URL for the Cyber AI Platform.
        api_key: Static API key for authentication via X-API-Key header.
        token: Bearer JWT or delegation token for Authorization header.
        timeout_seconds: Client HTTP timeout in seconds (default: 30.0).
        max_retries: Maximum exponential backoff retry attempts for 429/503 (default: 3).
    """

    base_url: str = "http://localhost:8000"
    soc_url: str | None = None
    fabric_url: str | None = None
    ai_url: str | None = None
    api_key: str | None = None
    token: str | None = None
    timeout_seconds: float = 30.0
    max_retries: int = 3

    def __post_init__(self) -> None:
        """Resolve service URLs and environment variable fallbacks."""
        if self.api_key is None:
            self.api_key = os.environ.get("CYBRIK_API_KEY")
        if self.token is None:
            self.token = os.environ.get("CYBRIK_TOKEN")

        base = self.base_url.rstrip("/")
        if self.soc_url is None:
            self.soc_url = os.environ.get("CYBRIK_SOC_URL") or f"{base}/soc"
        else:
            self.soc_url = self.soc_url.rstrip("/")

        if self.fabric_url is None:
            self.fabric_url = os.environ.get("CYBRIK_FABRIC_URL") or f"{base}/fabric"
        else:
            self.fabric_url = self.fabric_url.rstrip("/")

        if self.ai_url is None:
            self.ai_url = os.environ.get("CYBRIK_AI_URL") or f"{base}/ai"
        else:
            self.ai_url = self.ai_url.rstrip("/")

    @classmethod
    def from_env(cls) -> CybrikConfig:
        """Instantiate CybrikConfig from environment variables with sensible defaults."""
        return cls(
            base_url=os.environ.get("CYBRIK_BASE_URL", "http://localhost:8000"),
            soc_url=os.environ.get("CYBRIK_SOC_URL"),
            fabric_url=os.environ.get("CYBRIK_FABRIC_URL"),
            ai_url=os.environ.get("CYBRIK_AI_URL"),
            api_key=os.environ.get("CYBRIK_API_KEY"),
            token=os.environ.get("CYBRIK_TOKEN"),
            timeout_seconds=float(os.environ.get("CYBRIK_TIMEOUT_SECONDS", "30.0")),
            max_retries=int(os.environ.get("CYBRIK_MAX_RETRIES", "3")),
        )
