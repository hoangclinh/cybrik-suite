"""Unit tests for CybrikConfig and environment configuration."""

from __future__ import annotations

import os
from unittest.mock import patch

from cybrik_sdk.config import CybrikConfig


def test_config_defaults() -> None:
    config = CybrikConfig()
    assert config.base_url == "http://localhost:8000"
    assert config.soc_url == "http://localhost:8000/soc"
    assert config.fabric_url == "http://localhost:8000/fabric"
    assert config.ai_url == "http://localhost:8000/ai"
    assert config.api_key is None
    assert config.token is None
    assert config.timeout_seconds == 30.0
    assert config.max_retries == 3


def test_config_custom_endpoints() -> None:
    config = CybrikConfig(
        base_url="https://api.cybrik.corp",
        soc_url="https://soc-dedicated.cybrik.corp/",
        fabric_url="https://fabric-dedicated.cybrik.corp/",
        ai_url="https://ai-dedicated.cybrik.corp/",
    )
    assert config.base_url == "https://api.cybrik.corp"
    assert config.soc_url == "https://soc-dedicated.cybrik.corp"
    assert config.fabric_url == "https://fabric-dedicated.cybrik.corp"
    assert config.ai_url == "https://ai-dedicated.cybrik.corp"


def test_config_from_env() -> None:
    env_vars = {
        "CYBRIK_BASE_URL": "http://cluster.local:8080",
        "CYBRIK_SOC_URL": "http://soc.cluster.local:8001",
        "CYBRIK_FABRIC_URL": "http://fabric.cluster.local:8002",
        "CYBRIK_AI_URL": "http://ai.cluster.local:8003",
        "CYBRIK_API_KEY": "env-api-key",
        "CYBRIK_TOKEN": "env-token",
        "CYBRIK_TIMEOUT_SECONDS": "15.0",
        "CYBRIK_MAX_RETRIES": "5",
    }
    with patch.dict(os.environ, env_vars, clear=False):
        config = CybrikConfig.from_env()
        assert config.base_url == "http://cluster.local:8080"
        assert config.soc_url == "http://soc.cluster.local:8001"
        assert config.fabric_url == "http://fabric.cluster.local:8002"
        assert config.ai_url == "http://ai.cluster.local:8003"
        assert config.api_key == "env-api-key"
        assert config.token == "env-token"
        assert config.timeout_seconds == 15.0
        assert config.max_retries == 5
