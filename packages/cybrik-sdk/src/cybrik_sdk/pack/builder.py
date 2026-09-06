"""Canonical Content Pack builder for CYBRIK SDK."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import tarfile
from pathlib import Path, PurePosixPath
from typing import Any

from cybrik_sdk.pack.exceptions import (
    ContentPackValidationError,
    DisallowedFileTypeError,
    DisallowedLinkError,
    PathTraversalError,
)
from cybrik_sdk.pack.models import (
    ALLOWED_CONTENT_TYPES,
    BuildResult,
    ContentItemEntry,
    ContentPackManifest,
)

DISALLOWED_BUILD_EXTENSIONS: set[str] = {
    ".sh",
    ".bash",
    ".zsh",
    ".exe",
    ".bat",
    ".cmd",
    ".ps1",
    ".vbs",
    ".so",
    ".dylib",
    ".dll",
    ".bin",
    ".elf",
    ".py",
    ".pyc",
    ".pyd",
    ".pyo",
    ".wasm",
    ".class",
    ".jar",
    ".com",
    ".scr",
    ".msi",
}

ALLOWED_BUILD_EXTENSIONS: set[str] = {
    ".yml",
    ".yaml",
    ".json",
    ".md",
    ".txt",
    ".rst",
}

EXECUTABLE_MAGIC_PREFIXES: list[bytes] = [
    b"\x7fELF",               # Linux ELF
    b"MZ",                   # DOS/PE
    b"\xca\xfe\xba\xbe",     # Mach-O universal
    b"\xfe\xed\xfa\xce",     # Mach-O 32-bit
    b"\xfe\xed\xfa\xcf",     # Mach-O 64-bit
    b"\xcf\xfa\xed\xfe",     # Mach-O 64-bit reverse
    b"#!",                   # Script shebang
]


class ContentPackBuilder:
    """Builder for canonical, deterministic CYBRIK content packs (.cybrik-pack)."""

    def __init__(self) -> None:
        pass

    def _validate_entry_path(self, rel_path: str) -> str:
        """Validate that a relative entry path conforms to security constraints."""
        clean = rel_path.strip().replace("\\", "/")
        if not clean:
            raise PathTraversalError("Content item path cannot be empty")
        if clean.startswith("/"):
            raise PathTraversalError(f"Absolute path '{rel_path}' is forbidden")
        if ":" in clean.split("/")[0]:
            raise PathTraversalError(f"Drive letter in path '{rel_path}' is forbidden")
        parts = clean.split("/")
        if ".." in parts:
            raise PathTraversalError(f"Path traversal '..' in '{rel_path}' is forbidden")
        norm = PurePosixPath(clean)
        if norm.is_absolute() or ".." in norm.parts:
            raise PathTraversalError(f"Path traversal detected in '{rel_path}'")
        return clean

    def _validate_file_content(self, rel_path: str, data: bytes) -> None:
        """Inspect file extension and initial bytes to prevent executable code inclusion."""
        suffix = Path(rel_path).suffix.lower()
        if suffix in DISALLOWED_BUILD_EXTENSIONS:
            raise DisallowedFileTypeError(
                f"Disallowed executable or script file '{rel_path}' (extension '{suffix}')"
            )
        if suffix not in ALLOWED_BUILD_EXTENSIONS and rel_path != "manifest.json":
            raise DisallowedFileTypeError(
                f"File '{rel_path}' has unapproved extension '{suffix}'. "
                f"Allowed: {sorted(ALLOWED_BUILD_EXTENSIONS)}"
            )
        for prefix in EXECUTABLE_MAGIC_PREFIXES:
            if data.startswith(prefix):
                raise DisallowedFileTypeError(
                    f"File '{rel_path}' contains executable magic bytes ({prefix!r})"
                )

    def build_from_memory(
        self,
        manifest: ContentPackManifest,
        files: dict[str, bytes],
        output_path: Path | str | None = None,
    ) -> BuildResult:
        """Build canonical archive deterministically from manifest and in-memory byte map.

        Args:
            manifest: ContentPackManifest describing metadata and content inventory.
            files: Dictionary mapping relative paths to raw file bytes.
            output_path: Destination path for .cybrik-pack archive. If None, archive
                is not written to disk unless path is derived.

        Returns:
            BuildResult with archive details and overall pack digest.
        """
        # Validate manifest contents
        manifest_paths = {item.path: item for item in manifest.contents}
        provided_paths = set(files.keys())

        # Check for discrepancies
        missing_files = set(manifest_paths.keys()) - provided_paths
        if missing_files:
            raise ContentPackValidationError(
                f"Manifest specifies files not present in files dict: {sorted(missing_files)}"
            )
        rogue_files = provided_paths - set(manifest_paths.keys())
        if rogue_files:
            raise ContentPackValidationError(
                f"Files provided that are not declared in manifest: {sorted(rogue_files)}"
            )

        # Validate security and hashes for each file
        canonical_items: list[ContentItemEntry] = []
        total_unpacked_size = 0

        for item in sorted(manifest.contents, key=lambda x: x.path):
            clean_path = self._validate_entry_path(item.path)
            data = files[item.path]
            self._validate_file_content(clean_path, data)

            sha256_digest = hashlib.sha256(data).hexdigest()
            if item.sha256_hash and item.sha256_hash.lower() != sha256_digest:
                raise ContentPackValidationError(
                    f"Hash mismatch for '{item.path}': "
                    f"declared {item.sha256_hash}, actual {sha256_digest}"
                )

            entry = ContentItemEntry(
                path=clean_path,
                item_type=item.item_type,
                sha256_hash=sha256_digest,
                size_bytes=len(data),
            )
            canonical_items.append(entry)
            total_unpacked_size += len(data)

        # Build canonical manifest
        canonical_manifest = ContentPackManifest(
            pack_id=manifest.pack_id,
            name=manifest.name,
            version=manifest.version,
            description=manifest.description,
            author=manifest.author,
            license=manifest.license,
            min_cybrik_version=manifest.min_cybrik_version,
            content_types=manifest.content_types,
            contents=canonical_items,
            created_at=manifest.created_at,
        )

        manifest_bytes = canonical_manifest.canonical_bytes()
        total_unpacked_size += len(manifest_bytes)

        # Construct deterministic tar archive in memory
        tar_buf = io.BytesIO()
        with tarfile.open(fileobj=tar_buf, mode="w", format=tarfile.PAX_FORMAT) as tar:
            # 1. Add manifest.json first
            m_ti = tarfile.TarInfo(name="manifest.json")
            m_ti.size = len(manifest_bytes)
            m_ti.mtime = 0
            m_ti.mode = 0o644
            m_ti.uid = 0
            m_ti.gid = 0
            m_ti.uname = ""
            m_ti.gname = ""
            m_ti.type = tarfile.REGTYPE
            tar.addfile(m_ti, io.BytesIO(manifest_bytes))

            # 2. Add content items in alphabetical order
            for item in canonical_manifest.contents:
                content_bytes = files[item.path]
                ti = tarfile.TarInfo(name=item.path)
                ti.size = len(content_bytes)
                ti.mtime = 0
                ti.mode = 0o644
                ti.uid = 0
                ti.gid = 0
                ti.uname = ""
                ti.gname = ""
                ti.type = tarfile.REGTYPE
                tar.addfile(ti, io.BytesIO(content_bytes))

        # Gzip compression with fixed timestamp for bit-for-bit determinism
        tar_bytes = tar_buf.getvalue()
        gz_buf = io.BytesIO()
        with gzip.GzipFile(filename="", mode="wb", fileobj=gz_buf, mtime=0.0) as gz:
            gz.write(tar_bytes)

        archive_bytes = gz_buf.getvalue()
        pack_digest = hashlib.sha256(archive_bytes).hexdigest()

        dest_path = (
            Path(output_path)
            if output_path is not None
            else Path(f"{canonical_manifest.pack_id}-{canonical_manifest.version}.cybrik-pack")
        )
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(archive_bytes)

        return BuildResult(
            archive_path=str(dest_path.resolve()),
            pack_digest=pack_digest,
            manifest=canonical_manifest,
            file_count=len(canonical_manifest.contents),
            total_unpacked_size=total_unpacked_size,
        )

    def build_from_directory(
        self,
        source_dir: Path | str,
        output_path: Path | str | None = None,
        manifest: ContentPackManifest | None = None,
    ) -> BuildResult:
        """Build canonical .cybrik-pack archive from a directory.

        Args:
            source_dir: Directory containing manifest.json and content files.
            output_path: Destination path for output .cybrik-pack file.
            manifest: Optional pre-loaded ContentPackManifest. If None, loaded from
                source_dir / 'manifest.json'.

        Returns:
            BuildResult with archive details and overall pack digest.
        """
        root = Path(source_dir).resolve()
        if not root.is_dir():
            raise ContentPackValidationError(f"Source directory '{source_dir}' does not exist")

        manifest_file = root / "manifest.json"
        if manifest is None:
            if not manifest_file.is_file():
                raise ContentPackValidationError(
                    f"Manifest file not found: '{manifest_file}'"
                )
            manifest_text = manifest_file.read_text(encoding="utf-8")
            try:
                raw_dict_obj = json.loads(manifest_text)
                if not isinstance(raw_dict_obj, dict):
                    raise ContentPackValidationError("Manifest root must be a JSON object")
                raw_dict: dict[str, Any] = raw_dict_obj
            except ContentPackValidationError:
                raise
            except Exception as err:
                raise ContentPackValidationError(f"Invalid JSON in manifest: {err}") from err

            # Discover content files in directory if not present in manifest
            contents_raw = raw_dict.get("contents", [])
            if not contents_raw:
                discovered_items: list[dict[str, Any]] = []
                for p in sorted(root.rglob("*")):
                    if p.is_symlink():
                        raise DisallowedLinkError(f"Symlink '{p}' is forbidden")
                    if not p.is_file():
                        continue
                    rel = p.relative_to(root).as_posix()
                    if rel == "manifest.json" or rel.startswith("."):
                        continue
                    # Infer item type
                    itype = self._infer_item_type(rel, raw_dict.get("content_types", []))
                    data = p.read_bytes()
                    self._validate_file_content(rel, data)
                    discovered_items.append(
                        {
                            "path": rel,
                            "item_type": itype,
                            "sha256_hash": hashlib.sha256(data).hexdigest(),
                            "size_bytes": len(data),
                        }
                    )
                raw_dict["contents"] = discovered_items
            else:
                # Fill or verify sha256_hash and size_bytes
                for item_dict in contents_raw:
                    rel_p = item_dict.get("path", "")
                    clean_rel = self._validate_entry_path(rel_p)
                    target = (root / clean_rel).resolve()
                    if not target.is_relative_to(root):
                        raise PathTraversalError(
                            f"Path '{rel_p}' resolves outside source directory"
                        )
                    if target.is_symlink():
                        raise DisallowedLinkError(f"Symlink '{rel_p}' is forbidden")
                    if not target.is_file():
                        raise ContentPackValidationError(
                            f"Referenced file does not exist: '{rel_p}'"
                        )
                    data = target.read_bytes()
                    self._validate_file_content(clean_rel, data)
                    digest = hashlib.sha256(data).hexdigest()
                    if not item_dict.get("sha256_hash"):
                        item_dict["sha256_hash"] = digest
                    item_dict["size_bytes"] = len(data)

            try:
                manifest = ContentPackManifest.model_validate(raw_dict)
            except Exception as err:
                raise ContentPackValidationError(
                    f"Manifest schema validation error: {err}"
                ) from err

        # Load all content files into byte map
        files_map: dict[str, bytes] = {}
        for item in manifest.contents:
            clean_rel = self._validate_entry_path(item.path)
            target = (root / clean_rel).resolve()
            if not target.is_relative_to(root):
                raise PathTraversalError(f"Path '{item.path}' resolves outside source directory")
            if target.is_symlink():
                raise DisallowedLinkError(f"Symlink '{item.path}' is forbidden")
            if not target.is_file():
                raise ContentPackValidationError(f"Content file missing: '{item.path}'")
            data = target.read_bytes()
            self._validate_file_content(clean_rel, data)
            files_map[item.path] = data

        return self.build_from_memory(
            manifest=manifest,
            files=files_map,
            output_path=output_path,
        )

    def _infer_item_type(self, rel_path: str, allowed: list[str]) -> str:
        """Heuristic item type inference for auto-discovered files."""
        low = rel_path.lower()
        if "sigma" in low or low.startswith("rules/"):
            return "sigma_rules"
        if "playbook" in low or low.startswith("playbooks/"):
            return "soar_playbooks"
        if "parser" in low or low.startswith("parsers/"):
            return "siem_parsers"
        if "doc" in low or low.startswith("docs/") or "readme" in low:
            return "documentation"
        # Fallback to first allowed content type
        for ct in allowed:
            if ct in ALLOWED_CONTENT_TYPES:
                return ct
        return "documentation"
