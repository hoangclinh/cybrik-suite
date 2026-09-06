"""Pydantic data models for CYBRIK Content Packs."""

from __future__ import annotations

import json
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_CONTENT_TYPES: tuple[str, ...] = (
    "sigma_rules",
    "soar_playbooks",
    "siem_parsers",
    "documentation",
)
ContentType = Literal["sigma_rules", "soar_playbooks", "siem_parsers", "documentation"]

SLUG_REGEX = re.compile(r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$")
SEMVER_REGEX = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)
SHA256_HEX_REGEX = re.compile(r"^[a-f0-9]{64}$")


class ContentItemEntry(BaseModel):
    """Entry describing a single content file in a CYBRIK content pack."""

    model_config = ConfigDict(extra="forbid")

    path: str = Field(
        ...,
        description="Relative file path within pack (e.g. rules/mitre_t1059.yml)",
    )
    item_type: str = Field(
        ...,
        description="Item classification: sigma_rules, soar_playbooks, siem_parsers, documentation",
    )
    sha256_hash: str = Field(
        ...,
        description="Cryptographic SHA-256 hex digest of file contents",
    )
    size_bytes: int | None = Field(
        default=None,
        description="Optional unpacked file size in bytes",
    )

    @field_validator("path")
    @classmethod
    def validate_path(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Item path cannot be empty")
        if v.startswith("/") or v.startswith("\\"):
            raise ValueError(f"Absolute path '{v}' is forbidden")
        if re.match(r"^[a-zA-Z]:", v):
            raise ValueError(f"Drive letter in path '{v}' is forbidden")
        parts = v.replace("\\", "/").split("/")
        if ".." in parts:
            raise ValueError(f"Path traversal '..' in '{v}' is forbidden")
        if any(part == "" for part in parts[:-1]):
            raise ValueError(f"Empty segment in path '{v}' is forbidden")
        return v.replace("\\", "/")

    @field_validator("item_type")
    @classmethod
    def validate_item_type(cls, v: str) -> str:
        if v not in ALLOWED_CONTENT_TYPES:
            raise ValueError(
                f"Invalid item_type '{v}'. Allowed content types: {list(ALLOWED_CONTENT_TYPES)}"
            )
        return v

    @field_validator("sha256_hash")
    @classmethod
    def validate_sha256(cls, v: str) -> str:
        v = v.lower().strip()
        if not SHA256_HEX_REGEX.match(v):
            raise ValueError(
                f"Invalid sha256_hash '{v}': must be 64-character lowercase hex string"
            )
        return v


class ContentPackManifest(BaseModel):
    """Manifest describing a CYBRIK Content Pack archive."""

    model_config = ConfigDict(extra="forbid")

    pack_id: str = Field(
        ...,
        description="Lowercase slug identifier (e.g. community.mitre-top20-sigma)",
    )
    name: str = Field(
        ...,
        description="Human-readable pack title",
    )
    version: str = Field(
        ...,
        description="Semantic version string (SemVer, e.g. 1.0.0)",
    )
    description: str = Field(
        ...,
        description="Detailed description of pack contents and purpose",
    )
    author: str = Field(
        ...,
        description="Author or organization publishing this pack",
    )
    license: str = Field(
        ...,
        description="Software or content license (e.g. Apache-2.0, MIT)",
    )
    min_cybrik_version: str = Field(
        ...,
        description="Minimum compatible CYBRIK platform/SDK version",
    )
    content_types: list[str] = Field(
        ...,
        description="List of content types included in this pack",
    )
    contents: list[ContentItemEntry] = Field(
        ...,
        description="Manifest inventory of all constituent files with SHA-256 digests",
    )
    created_at: str = Field(
        ...,
        description="ISO 8601 creation timestamp",
    )

    @field_validator("pack_id")
    @classmethod
    def validate_pack_id(cls, v: str) -> str:
        v = v.strip()
        if not SLUG_REGEX.match(v):
            raise ValueError(
                f"Invalid pack_id '{v}': must be lowercase slug "
                "(e.g. community.mitre-top20-sigma)"
            )
        return v

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: str) -> str:
        v = v.strip()
        if not SEMVER_REGEX.match(v):
            raise ValueError(
                f"Invalid version '{v}': must follow SemVer format (e.g. 1.0.0, 0.2.1-rc1)"
            )
        return v

    @field_validator("content_types")
    @classmethod
    def validate_content_types(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("content_types list cannot be empty")
        for ct in v:
            if ct not in ALLOWED_CONTENT_TYPES:
                raise ValueError(
                    f"Disallowed content type '{ct}'. Allowed: {list(ALLOWED_CONTENT_TYPES)}"
                )
        return sorted(list(dict.fromkeys(v)))

    @field_validator("contents")
    @classmethod
    def validate_contents(cls, v: list[ContentItemEntry]) -> list[ContentItemEntry]:
        paths: set[str] = set()
        for item in v:
            if item.path in paths:
                raise ValueError(f"Duplicate path '{item.path}' in manifest contents")
            paths.add(item.path)
        return sorted(v, key=lambda item: item.path)

    def canonical_dict(self) -> dict[str, Any]:
        """Return canonicalized dictionary representation."""
        data = self.model_dump(mode="json")
        # Ensure contents sorted by path
        if isinstance(data.get("contents"), list):
            data["contents"] = sorted(data["contents"], key=lambda x: str(x.get("path", "")))
        if isinstance(data.get("content_types"), list):
            data["content_types"] = sorted(list(set(data["content_types"])))
        return data

    def canonical_json(self) -> str:
        """Return RFC 8785 canonical JSON formatted string."""
        return json.dumps(
            self.canonical_dict(),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )

    def canonical_bytes(self) -> bytes:
        """Return UTF-8 bytes of canonical JSON representation."""
        return self.canonical_json().encode("utf-8")


class BuildResult(BaseModel):
    """Result of building a canonical CYBRIK content pack archive."""

    model_config = ConfigDict(extra="forbid")

    archive_path: str = Field(description="Filesystem path of written .cybrik-pack archive")
    pack_digest: str = Field(description="SHA-256 digest of final archive")
    manifest: ContentPackManifest = Field(description="Canonicalized manifest embedded in pack")
    file_count: int = Field(description="Number of content items packaged")
    total_unpacked_size: int = Field(
        description="Total uncompressed bytes across all content items"
    )


class VerificationResult(BaseModel):
    """Result of verifying a CYBRIK content pack archive against security invariants."""

    model_config = ConfigDict(extra="forbid")

    valid: bool = Field(
        default=True,
        description="Whether the pack passed all security and integrity checks",
    )
    pack_id: str = Field(description="Identifier of verified pack")
    version: str = Field(description="Version of verified pack")
    pack_digest: str = Field(description="SHA-256 digest of archive")
    manifest: ContentPackManifest = Field(description="Parsed manifest")
    file_count: int = Field(description="Count of verified files")
    unpacked_size_bytes: int = Field(description="Total unpacked bytes")
    verified_files: list[str] = Field(description="List of verified relative file paths")


class InspectionResult(BaseModel):
    """Inspection summary for a CYBRIK content pack archive."""

    model_config = ConfigDict(extra="forbid")

    pack_id: str = Field(description="Pack identifier")
    name: str = Field(description="Pack name")
    version: str = Field(description="Pack version")
    description: str = Field(description="Pack description")
    author: str = Field(description="Pack author")
    license: str = Field(description="Pack license")
    min_cybrik_version: str = Field(description="Minimum CYBRIK version")
    created_at: str = Field(description="Creation timestamp")
    content_types: list[str] = Field(description="Pack content types")
    pack_digest: str = Field(description="Archive SHA-256 digest")
    contents: list[ContentItemEntry] = Field(description="Manifest items inventory")
    file_count: int = Field(description="Total files in pack")
    total_size_bytes: int = Field(description="Total uncompressed size in bytes")
