"""Strict security and integrity verifier for CYBRIK Content Packs."""

from __future__ import annotations

import hashlib
import io
import json
import tarfile
from pathlib import Path, PurePosixPath
from typing import Any

from cybrik_sdk.pack.exceptions import (
    ContentPackValidationError,
    DecompressionBombError,
    DisallowedFileTypeError,
    DisallowedLinkError,
    PathTraversalError,
    TamperDetectionError,
)
from cybrik_sdk.pack.models import (
    ContentPackManifest,
    InspectionResult,
    VerificationResult,
)

DEFAULT_MAX_UNPACKED_SIZE: int = 50 * 1024 * 1024  # 50 MB
DEFAULT_MAX_FILE_COUNT: int = 500
DEFAULT_MAX_COMPRESSION_RATIO: float = 20.0  # 20:1

ALLOWED_EXTENSIONS: set[str] = {
    ".yml",
    ".yaml",
    ".json",
    ".md",
    ".txt",
    ".rst",
}

DISALLOWED_EXTENSIONS: set[str] = {
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

EXECUTABLE_MAGIC_PREFIXES: list[bytes] = [
    b"\x7fELF",               # Linux ELF
    b"MZ",                   # DOS/PE executable
    b"\xca\xfe\xba\xbe",     # Mach-O universal binary
    b"\xfe\xed\xfa\xce",     # Mach-O 32-bit
    b"\xfe\xed\xfa\xcf",     # Mach-O 64-bit
    b"\xcf\xfa\xed\xfe",     # Mach-O 64-bit reverse
    b"#!",                   # Script shebang
]


class ContentPackVerifier:
    """Strict security guardrail verifier for CYBRIK Content Packs (.cybrik-pack)."""

    def __init__(
        self,
        max_unpacked_size: int = DEFAULT_MAX_UNPACKED_SIZE,
        max_file_count: int = DEFAULT_MAX_FILE_COUNT,
        max_compression_ratio: float = DEFAULT_MAX_COMPRESSION_RATIO,
    ) -> None:
        self.max_unpacked_size = max_unpacked_size
        self.max_file_count = max_file_count
        self.max_compression_ratio = max_compression_ratio

    def _read_archive_bytes(self, pack_source: str | Path | bytes) -> bytes:
        """Read archive bytes from Path, str, or raw bytes."""
        if isinstance(pack_source, (str, Path)):
            p = Path(pack_source)
            if not p.is_file():
                raise ContentPackValidationError(f"Archive file not found: '{p}'")
            return p.read_bytes()
        if isinstance(pack_source, (bytes, bytearray)):
            return bytes(pack_source)
        raise ContentPackValidationError("Invalid pack source: expected path or bytes")

    def inspect(self, pack_source: str | Path | bytes) -> InspectionResult:
        """Inspect pack metadata, item manifest, and overall digest without complete extraction."""
        archive_bytes = self._read_archive_bytes(pack_source)
        pack_digest = hashlib.sha256(archive_bytes).hexdigest()

        try:
            with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as tar:
                try:
                    manifest_member = tar.getmember("manifest.json")
                except KeyError as err:
                    raise ContentPackValidationError(
                        "Archive missing root manifest.json"
                    ) from err

                f = tar.extractfile(manifest_member)
                if f is None:
                    raise TamperDetectionError("Unable to read manifest.json from archive")
                raw_bytes = f.read()
                try:
                    raw_dict = json.loads(raw_bytes.decode("utf-8"))
                    manifest = ContentPackManifest.model_validate(raw_dict)
                except Exception as err:
                    raise TamperDetectionError(f"Corrupted manifest in archive: {err}") from err

                total_size = sum(item.size_bytes or 0 for item in manifest.contents)
                return InspectionResult(
                    pack_id=manifest.pack_id,
                    name=manifest.name,
                    version=manifest.version,
                    description=manifest.description,
                    author=manifest.author,
                    license=manifest.license,
                    min_cybrik_version=manifest.min_cybrik_version,
                    created_at=manifest.created_at,
                    content_types=manifest.content_types,
                    pack_digest=pack_digest,
                    contents=manifest.contents,
                    file_count=len(manifest.contents),
                    total_size_bytes=total_size,
                )
        except (tarfile.ReadError, EOFError, OSError) as err:
            raise TamperDetectionError(f"Corrupted or invalid .cybrik-pack archive: {err}") from err

    def verify(self, pack_source: str | Path | bytes) -> VerificationResult:
        """Strictly verify a content pack against all seven security guardrails."""
        archive_bytes = self._read_archive_bytes(pack_source)
        compressed_size = len(archive_bytes)
        pack_digest = hashlib.sha256(archive_bytes).hexdigest()

        try:
            with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as tar:
                members = tar.getmembers()

                # Guardrail 3: Archive bomb defense (file count)
                if len(members) > self.max_file_count:
                    raise DecompressionBombError(
                        f"Archive file count {len(members)} exceeds max limit {self.max_file_count}"
                    )

                cumulative_unpacked_size = 0
                manifest_member: tarfile.TarInfo | None = None
                content_members: dict[str, tarfile.TarInfo] = {}

                for member in members:
                    # Guardrail 2: Symlink & hardlink rejection
                    if member.issym() or member.islnk() or member.type in (
                        tarfile.SYMTYPE,
                        tarfile.LNKTYPE,
                    ):
                        raise DisallowedLinkError(
                            f"Symlink or hardlink '{member.name}' is strictly forbidden"
                        )
                    if member.isfifo() or member.ischr() or member.isblk() or member.type in (
                        tarfile.FIFOTYPE,
                        tarfile.CHRTYPE,
                        tarfile.BLKTYPE,
                    ):
                        raise DisallowedLinkError(
                            f"Special device or FIFO entry '{member.name}' is strictly forbidden"
                        )
                    if not (member.isfile() or member.isdir()):
                        raise DisallowedLinkError(
                            f"Unsupported archive member type {member.type!r} in '{member.name}'"
                        )

                    # Guardrail 1: Path traversal defense
                    raw_name = member.name.strip().replace("\\", "/")
                    if not raw_name:
                        raise PathTraversalError("Archive entry path cannot be empty")
                    if raw_name.startswith("/"):
                        raise PathTraversalError(
                            f"Absolute path traversal attempt in entry: '{member.name}'"
                        )
                    if ":" in raw_name.split("/")[0]:
                        raise PathTraversalError(
                            f"Windows drive letter traversal attempt in entry: '{member.name}'"
                        )
                    if "\x00" in raw_name:
                        raise PathTraversalError(
                            f"Null byte in archive entry path: '{member.name}'"
                        )
                    segments = raw_name.split("/")
                    if ".." in segments:
                        raise PathTraversalError(
                            f"Path traversal '..' in entry: '{member.name}'"
                        )
                    norm = PurePosixPath(raw_name)
                    if norm.is_absolute() or ".." in norm.parts:
                        raise PathTraversalError(
                            f"Path traversal detected in entry: '{member.name}'"
                        )

                    if member.isfile():
                        # Guardrail 3: Archive bomb defense (individual file size)
                        if member.size > self.max_unpacked_size:
                            raise DecompressionBombError(
                                f"Single file '{member.name}' size ({member.size} bytes) "
                                f"exceeds limit ({self.max_unpacked_size} bytes)"
                            )
                        cumulative_unpacked_size += member.size
                        if cumulative_unpacked_size > self.max_unpacked_size:
                            raise DecompressionBombError(
                                f"Cumulative unpacked size ({cumulative_unpacked_size} bytes) "
                                f"exceeds limit ({self.max_unpacked_size} bytes)"
                            )

                        if norm.as_posix() == "manifest.json":
                            manifest_member = member
                        else:
                            content_members[norm.as_posix()] = member

                # Guardrail 3: Archive bomb defense (compression ratio)
                if cumulative_unpacked_size > 1024 * 1024:
                    ratio = cumulative_unpacked_size / max(compressed_size, 1)
                    if ratio > self.max_compression_ratio:
                        raise DecompressionBombError(
                            f"Decompression ratio {ratio:.1f}:1 exceeds maximum "
                            f"allowed limit {self.max_compression_ratio:.1f}:1"
                        )

                # Ensure manifest.json exists
                if manifest_member is None:
                    raise ContentPackValidationError("Archive missing root manifest.json")

                manifest_file = tar.extractfile(manifest_member)
                if manifest_file is None:
                    raise TamperDetectionError("Unable to extract manifest.json from archive")

                try:
                    manifest_data = manifest_file.read().decode("utf-8")
                    raw_dict: dict[str, Any] = json.loads(manifest_data)
                    manifest = ContentPackManifest.model_validate(raw_dict)
                except (json.JSONDecodeError, UnicodeDecodeError) as err:
                    raise TamperDetectionError(
                        f"manifest.json is corrupted or not valid JSON: {err}"
                    ) from err
                except Exception as err:
                    raise ContentPackValidationError(
                        f"Manifest schema validation failure: {err}"
                    ) from err

                manifest_paths = {item.path: item for item in manifest.contents}

                # Guardrail 5 & 6: Tamper detection for rogue or missing files
                archive_content_paths = set(content_members.keys())
                manifest_content_paths = set(manifest_paths.keys())

                rogue_files = archive_content_paths - manifest_content_paths
                if rogue_files:
                    raise TamperDetectionError(
                        f"Archive contains unmanifested rogue files: {sorted(rogue_files)}"
                    )

                missing_files = manifest_content_paths - archive_content_paths
                if missing_files:
                    raise TamperDetectionError(
                        f"Manifest declares files missing from archive: {sorted(missing_files)}"
                    )

                # Guardrail 4: Content-type allowlist & Guardrail 5: SHA-256 integrity
                verified_files: list[str] = []
                for item in manifest.contents:
                    member = content_members[item.path]
                    suffix = Path(item.path).suffix.lower()

                    if suffix in DISALLOWED_EXTENSIONS:
                        raise DisallowedFileTypeError(
                            f"File '{item.path}' has disallowed executable "
                            f"or script extension '{suffix}'"
                        )
                    if suffix not in ALLOWED_EXTENSIONS:
                        raise DisallowedFileTypeError(
                            f"File '{item.path}' has unapproved extension '{suffix}'"
                        )

                    f = tar.extractfile(member)
                    if f is None:
                        raise TamperDetectionError(
                            f"Unable to extract content file: '{item.path}'"
                        )
                    data = f.read()

                    # Check for executable magic bytes
                    for prefix in EXECUTABLE_MAGIC_PREFIXES:
                        if data.startswith(prefix):
                            raise DisallowedFileTypeError(
                                f"File '{item.path}' contains executable magic bytes ({prefix!r})"
                            )

                    # Compute and assert cryptographic SHA-256 integrity
                    actual_digest = hashlib.sha256(data).hexdigest()
                    if actual_digest != item.sha256_hash.lower():
                        raise TamperDetectionError(
                            f"Integrity check failed for '{item.path}': "
                            f"expected {item.sha256_hash}, computed {actual_digest}"
                        )

                    verified_files.append(item.path)

                return VerificationResult(
                    valid=True,
                    pack_id=manifest.pack_id,
                    version=manifest.version,
                    pack_digest=pack_digest,
                    manifest=manifest,
                    file_count=len(verified_files),
                    unpacked_size_bytes=cumulative_unpacked_size,
                    verified_files=verified_files,
                )
        except (tarfile.ReadError, EOFError, OSError) as err:
            raise TamperDetectionError(f"Corrupted or invalid .cybrik-pack archive: {err}") from err

    def extract(self, pack_source: str | Path | bytes, destination_dir: str | Path) -> list[Path]:
        """Safely verify and unpack content files into the destination directory."""
        self.verify(pack_source)
        dest = Path(destination_dir).resolve()
        dest.mkdir(parents=True, exist_ok=True)

        archive_bytes = self._read_archive_bytes(pack_source)
        extracted: list[Path] = []

        with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as tar:
            for member in tar.getmembers():
                if not member.isfile():
                    continue
                target = (dest / member.name).resolve()
                if not target.is_relative_to(dest):
                    raise PathTraversalError(
                        f"Refusing to extract entry outside destination: '{member.name}'"
                    )
                target.parent.mkdir(parents=True, exist_ok=True)
                f = tar.extractfile(member)
                if f is not None:
                    target.write_bytes(f.read())
                    target.chmod(0o644)
                    extracted.append(target)
        return extracted
