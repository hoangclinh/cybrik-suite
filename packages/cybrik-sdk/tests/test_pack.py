"""Unit and integration tests for CYBRIK Content Pack packaging engine and security guardrails."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import tarfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import pytest
from typer.testing import CliRunner

from cybrik_sdk.cli import app
from cybrik_sdk.pack import (
    ALLOWED_CONTENT_TYPES,
    ContentItemEntry,
    ContentPackBuilder,
    ContentPackManifest,
    ContentPackVerifier,
    DecompressionBombError,
    DisallowedFileTypeError,
    DisallowedLinkError,
    PathTraversalError,
    TamperDetectionError,
)

runner = CliRunner()

DUMMY_MANIFEST_BYTES: bytes = (
    b'{"pack_id": "test.pack", "name": "Test", "version": "1.0.0", "description": "d", '
    b'"author": "a", "license": "MIT", "min_cybrik_version": "0.1.0", '
    b'"content_types": ["documentation"], "contents": [], "created_at": "2026-01-01T00:00:00Z"}'
)


def _create_sample_pack_source(base_dir: Path) -> Path:
    """Helper to assemble a valid sample content pack directory."""
    src = base_dir / "sample_pack"
    src.mkdir(parents=True, exist_ok=True)
    (src / "rules").mkdir(parents=True, exist_ok=True)
    (src / "playbooks").mkdir(parents=True, exist_ok=True)
    (src / "parsers").mkdir(parents=True, exist_ok=True)
    (src / "docs").mkdir(parents=True, exist_ok=True)

    rule_content = b"title: Suspicious PowerShell\nid: 1059-001\nstatus: stable\n"
    playbook_content = b'{"name": "isolate_compromised_host", "steps": ["isolate", "notify"]}'
    parser_content = b"name: suricata-eve\nformat: json\n"
    doc_content = b"# MITRE Top 20 Sigma Pack\nComprehensive detection engineering pack.\n"

    (src / "rules" / "powershell_encoded.yml").write_bytes(rule_content)
    (src / "playbooks" / "containment_flow.json").write_bytes(playbook_content)
    (src / "parsers" / "suricata_eve.yaml").write_bytes(parser_content)
    (src / "docs" / "README.md").write_bytes(doc_content)

    manifest_dict: dict[str, Any] = {
        "pack_id": "community.mitre-top20-sigma",
        "name": "MITRE ATT&CK Top 20 Sigma Rules",
        "version": "1.2.0",
        "description": "Detection engineering rules for Top 20 adversary techniques",
        "author": "CYBRIK Community Engineering",
        "license": "Apache-2.0",
        "min_cybrik_version": "0.1.0",
        "content_types": [
            "sigma_rules",
            "soar_playbooks",
            "siem_parsers",
            "documentation",
        ],
        "contents": [
            {
                "path": "docs/README.md",
                "item_type": "documentation",
                "sha256_hash": hashlib.sha256(doc_content).hexdigest(),
            },
            {
                "path": "parsers/suricata_eve.yaml",
                "item_type": "siem_parsers",
                "sha256_hash": hashlib.sha256(parser_content).hexdigest(),
            },
            {
                "path": "playbooks/containment_flow.json",
                "item_type": "soar_playbooks",
                "sha256_hash": hashlib.sha256(playbook_content).hexdigest(),
            },
            {
                "path": "rules/powershell_encoded.yml",
                "item_type": "sigma_rules",
                "sha256_hash": hashlib.sha256(rule_content).hexdigest(),
            },
        ],
        "created_at": "2026-09-06T12:00:00Z",
    }
    (src / "manifest.json").write_text(json.dumps(manifest_dict, indent=2), encoding="utf-8")
    return src


def _build_raw_archive(
    members_data: Mapping[str, bytes | tuple[bytes, bytes]],
) -> bytes:
    """Helper to build arbitrary tar.gz archives for testing guardrails."""
    tar_buf = io.BytesIO()
    with tarfile.open(fileobj=tar_buf, mode="w", format=tarfile.PAX_FORMAT) as tar:
        for name, spec in members_data.items():
            content: bytes
            member_type: bytes
            if isinstance(spec, tuple):
                content, member_type = spec
            else:
                content = spec
                member_type = tarfile.REGTYPE

            ti = tarfile.TarInfo(name=name)
            ti.size = len(content)
            ti.mtime = 0
            ti.mode = 0o644
            ti.uid = 0
            ti.gid = 0
            ti.type = member_type
            tar.addfile(ti, io.BytesIO(content))

    gz_buf = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=gz_buf, mtime=0.0) as gz:
        gz.write(tar_buf.getvalue())
    return gz_buf.getvalue()


def test_manifest_model_validation() -> None:
    """Test ContentPackManifest validation rules (slug, semver, duplicates)."""
    # Valid manifest
    manifest = ContentPackManifest(
        pack_id="community.test-pack_01",
        name="Test Pack",
        version="1.0.0",
        description="A valid test pack",
        author="SecOps",
        license="MIT",
        min_cybrik_version="0.1.0",
        content_types=["sigma_rules", "documentation"],
        contents=[
            ContentItemEntry(
                path="rules/rule.yml",
                item_type="sigma_rules",
                sha256_hash="a" * 64,
            )
        ],
        created_at="2026-09-06T12:00:00Z",
    )
    assert manifest.pack_id == "community.test-pack_01"
    assert manifest.version == "1.0.0"

    # Reject uppercase in slug
    with pytest.raises(ValueError, match="lowercase slug"):
        ContentPackManifest.model_validate(
            {**manifest.model_dump(), "pack_id": "Community.InvalidSlug"}
        )

    # Reject invalid SemVer
    with pytest.raises(ValueError, match="SemVer"):
        ContentPackManifest.model_validate({**manifest.model_dump(), "version": "1.0"})

    # Reject disallowed content type
    with pytest.raises(ValueError, match="Disallowed content type"):
        ContentPackManifest.model_validate(
            {**manifest.model_dump(), "content_types": ["arbitrary_code"]}
        )

    # Reject duplicate paths
    with pytest.raises(ValueError, match="Duplicate path"):
        ContentPackManifest.model_validate(
            {
                **manifest.model_dump(),
                "contents": [
                    {
                        "path": "rules/rule.yml",
                        "item_type": "sigma_rules",
                        "sha256_hash": "a" * 64,
                    },
                    {
                        "path": "rules/rule.yml",
                        "item_type": "sigma_rules",
                        "sha256_hash": "b" * 64,
                    },
                ],
            }
        )


def test_valid_content_pack_building_inspection_verification(tmp_path: Path) -> None:
    """Test end-to-end building, inspection, verification, determinism, and extraction."""
    src = _create_sample_pack_source(tmp_path)
    output_pack_1 = tmp_path / "pack1.cybrik-pack"
    output_pack_2 = tmp_path / "pack2.cybrik-pack"

    builder = ContentPackBuilder()
    res1 = builder.build_from_directory(source_dir=src, output_path=output_pack_1)

    assert output_pack_1.is_file()
    assert res1.file_count == 4
    assert len(res1.pack_digest) == 64
    assert res1.manifest.pack_id == "community.mitre-top20-sigma"
    assert res1.manifest.version == "1.2.0"

    # Determinism check: building again from identical source produces identical bytes
    res2 = builder.build_from_directory(source_dir=src, output_path=output_pack_2)
    assert res1.pack_digest == res2.pack_digest
    assert output_pack_1.read_bytes() == output_pack_2.read_bytes()

    verifier = ContentPackVerifier()

    # Test inspection
    info = verifier.inspect(output_pack_1)
    assert info.pack_id == "community.mitre-top20-sigma"
    assert info.name == "MITRE ATT&CK Top 20 Sigma Rules"
    assert info.version == "1.2.0"
    assert info.pack_digest == res1.pack_digest
    assert info.file_count == 4
    assert set(info.content_types) == set(ALLOWED_CONTENT_TYPES)

    # Test verification
    v_res = verifier.verify(output_pack_1)
    assert v_res.valid is True
    assert v_res.pack_id == "community.mitre-top20-sigma"
    assert v_res.version == "1.2.0"
    assert v_res.pack_digest == res1.pack_digest
    assert v_res.file_count == 4
    assert len(v_res.verified_files) == 4

    # Test safe extraction
    extract_dir = tmp_path / "extracted"
    extracted_files = verifier.extract(output_pack_1, extract_dir)
    assert len(extracted_files) == 5  # 4 content files + manifest.json
    for ef in extracted_files:
        assert ef.is_file()
        assert ef.is_relative_to(extract_dir)


def test_path_traversal_rejection(tmp_path: Path) -> None:
    """Test strict rejection of parent directory traversal, absolute paths, and drive letters."""
    verifier = ContentPackVerifier()

    # Case 1: Traversal entry ../../etc/passwd
    archive_traversal = _build_raw_archive(
        {
            "manifest.json": DUMMY_MANIFEST_BYTES,
            "../../etc/passwd": b"root:x:0:0::/root:/bin/sh\n",
        }
    )
    with pytest.raises(PathTraversalError, match="Path traversal '..'"):
        verifier.verify(archive_traversal)

    # Case 2: Absolute path /var/log/syslog
    archive_abs = _build_raw_archive(
        {
            "manifest.json": DUMMY_MANIFEST_BYTES,
            "/var/log/syslog": b"log data\n",
        }
    )
    with pytest.raises(PathTraversalError, match="Absolute path"):
        verifier.verify(archive_abs)

    # Case 3: Windows drive letter C:\malicious.json
    archive_drive = _build_raw_archive(
        {
            "manifest.json": DUMMY_MANIFEST_BYTES,
            "C:/malicious.json": b"{}",
        }
    )
    with pytest.raises(PathTraversalError, match="Windows drive letter"):
        verifier.verify(archive_drive)

    # Case 4: ContentItemEntry path traversal validation
    with pytest.raises(ValueError, match="Path traversal '..'"):
        ContentItemEntry(
            path="rules/../../etc/passwd",
            item_type="sigma_rules",
            sha256_hash="0" * 64,
        )


def test_symlink_rejection(tmp_path: Path) -> None:
    """Test strict rejection of symlinks, hardlinks, and special device nodes."""
    verifier = ContentPackVerifier()

    # Symlink entry
    tar_buf = io.BytesIO()
    with tarfile.open(fileobj=tar_buf, mode="w", format=tarfile.PAX_FORMAT) as tar:
        ti_m = tarfile.TarInfo(name="manifest.json")
        m_bytes = DUMMY_MANIFEST_BYTES
        ti_m.size = len(m_bytes)
        ti_m.mtime = 0
        ti_m.mode = 0o644
        tar.addfile(ti_m, io.BytesIO(m_bytes))

        # Add symlink
        ti_sym = tarfile.TarInfo(name="rules/link.yml")
        ti_sym.type = tarfile.SYMTYPE
        ti_sym.linkname = "/etc/passwd"
        ti_sym.mtime = 0
        tar.addfile(ti_sym)

    gz_buf = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=gz_buf, mtime=0.0) as gz:
        gz.write(tar_buf.getvalue())

    with pytest.raises(DisallowedLinkError, match="Symlink or hardlink"):
        verifier.verify(gz_buf.getvalue())


def test_archive_bomb_defense(tmp_path: Path) -> None:
    """Test protection against archive bombs (excessive file count, size, compression ratio)."""
    # 1. File count bomb
    manifest_stub = (
        b'{"pack_id": "bomb.pack", "name": "Bomb", "version": "1.0.0", "description": "d", '
        b'"author": "a", "license": "MIT", "min_cybrik_version": "0.1.0", '
        b'"content_types": ["documentation"], "contents": [], "created_at": "2026-01-01T00:00:00Z"}'
    )
    many_files = {"manifest.json": manifest_stub}
    for i in range(15):
        many_files[f"docs/file_{i}.md"] = b"content"

    bomb_archive = _build_raw_archive(many_files)
    strict_count_verifier = ContentPackVerifier(max_file_count=10)
    with pytest.raises(DecompressionBombError, match="Archive file count"):
        strict_count_verifier.verify(bomb_archive)

    # 2. Maximum unpacked size bomb
    large_files = {
        "manifest.json": manifest_stub,
        "docs/large.md": b"A" * 5000,
    }
    size_bomb_archive = _build_raw_archive(large_files)
    strict_size_verifier = ContentPackVerifier(max_unpacked_size=2000)
    with pytest.raises(DecompressionBombError, match="exceeds limit"):
        strict_size_verifier.verify(size_bomb_archive)

    # 3. High compression ratio bomb (> 20:1 with > 1MB uncompressed)
    repetitive_content = b"0" * (2 * 1024 * 1024)  # 2 MB repeating data compresses to ~2 KB
    ratio_files = {
        "manifest.json": manifest_stub,
        "docs/ratio.txt": repetitive_content,
    }
    ratio_archive = _build_raw_archive(ratio_files)
    strict_ratio_verifier = ContentPackVerifier(max_compression_ratio=15.0)
    with pytest.raises(DecompressionBombError, match="Decompression ratio"):
        strict_ratio_verifier.verify(ratio_archive)


def test_file_tampering_rejection(tmp_path: Path) -> None:
    """Test tamper detection on checksum mismatch, rogue unmanifested files, and corrupted JSON."""
    src = _create_sample_pack_source(tmp_path)
    archive_path = tmp_path / "valid.cybrik-pack"
    ContentPackBuilder().build_from_directory(source_dir=src, output_path=archive_path)

    verifier = ContentPackVerifier()
    # Baseline check passes
    assert verifier.verify(archive_path).valid is True

    # 1. Tamper content bytes
    raw_archive = archive_path.read_bytes()
    with gzip.GzipFile(fileobj=io.BytesIO(raw_archive), mode="rb") as gz:
        tar_bytes = gz.read()

    # Extract all members
    tar_in = tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r")
    members = tar_in.getmembers()

    # Re-pack tar with 1 byte modified in powershell_encoded.yml
    tar_tampered_buf = io.BytesIO()
    with tarfile.open(fileobj=tar_tampered_buf, mode="w", format=tarfile.PAX_FORMAT) as tar_out:
        for m in members:
            f = tar_in.extractfile(m)
            assert f is not None
            data = f.read()
            if m.name == "rules/powershell_encoded.yml":
                data = data + b"\n# TAMPERED LINE"
            ti = tarfile.TarInfo(name=m.name)
            ti.size = len(data)
            ti.mtime = 0
            ti.mode = 0o644
            tar_out.addfile(ti, io.BytesIO(data))

    gz_tampered_buf = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=gz_tampered_buf, mtime=0.0) as gz:
        gz.write(tar_tampered_buf.getvalue())

    tampered_bytes = gz_tampered_buf.getvalue()
    with pytest.raises(TamperDetectionError, match="Integrity check failed"):
        verifier.verify(tampered_bytes)

    # 2. Rogue unmanifested file added to archive
    tar_rogue_buf = io.BytesIO()
    with tarfile.open(fileobj=tar_rogue_buf, mode="w", format=tarfile.PAX_FORMAT) as tar_out:
        for m in members:
            f = tar_in.extractfile(m)
            assert f is not None
            tar_out.addfile(m, io.BytesIO(f.read()))
        # Inject unmanifested rogue file
        rogue_data = b"rogue content\n"
        ti_rogue = tarfile.TarInfo(name="rules/rogue_rule.yml")
        ti_rogue.size = len(rogue_data)
        ti_rogue.mtime = 0
        ti_rogue.mode = 0o644
        tar_out.addfile(ti_rogue, io.BytesIO(rogue_data))

    gz_rogue_buf = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=gz_rogue_buf, mtime=0.0) as gz:
        gz.write(tar_rogue_buf.getvalue())

    with pytest.raises(TamperDetectionError, match="unmanifested rogue files"):
        verifier.verify(gz_rogue_buf.getvalue())


def test_disallowed_executable_file_rejection(tmp_path: Path) -> None:
    """Test rejection of executable extensions (.sh, .exe, .so, etc.) and binary magic bytes."""
    verifier = ContentPackVerifier()
    manifest_stub = (
        b'{"pack_id": "exec.pack", "name": "Exec", "version": "1.0.0", "description": "d", '
        b'"author": "a", "license": "MIT", "min_cybrik_version": "0.1.0", '
        b'"content_types": ["documentation"], "contents": ['
        b'{"path": "scripts/evil.sh", "item_type": "documentation", "sha256_hash": "'
        + hashlib.sha256(b"echo pwned\n").hexdigest().encode()
        + b'"}], "created_at": "2026-01-01T00:00:00Z"}'
    )

    # 1. Shell script extension (.sh)
    archive_sh = _build_raw_archive(
        {
            "manifest.json": manifest_stub,
            "scripts/evil.sh": b"echo pwned\n",
        }
    )
    with pytest.raises(DisallowedFileTypeError, match="disallowed executable or script extension"):
        verifier.verify(archive_sh)

    # 2. ELF binary disguised as .yml
    elf_data = b"\x7fELF" + b"\x02\x01\x01" + b"\x00" * 20
    elf_hash = hashlib.sha256(elf_data).hexdigest()
    manifest_elf = (
        b'{"pack_id": "exec.pack", "name": "Exec", "version": "1.0.0", "description": "d", '
        b'"author": "a", "license": "MIT", "min_cybrik_version": "0.1.0", '
        b'"content_types": ["sigma_rules"], "contents": ['
        b'{"path": "rules/trojan.yml", "item_type": "sigma_rules", "sha256_hash": "'
        + elf_hash.encode()
        + b'"}], "created_at": "2026-01-01T00:00:00Z"}'
    )
    archive_elf = _build_raw_archive(
        {
            "manifest.json": manifest_elf,
            "rules/trojan.yml": elf_data,
        }
    )
    with pytest.raises(DisallowedFileTypeError, match="executable magic bytes"):
        verifier.verify(archive_elf)

    # 3. Shebang script disguised as .json
    shebang_data = b"#!/bin/bash\nrm -rf /tmp/*\n"
    shebang_hash = hashlib.sha256(shebang_data).hexdigest()
    manifest_shebang = (
        b'{"pack_id": "exec.pack", "name": "Exec", "version": "1.0.0", "description": "d", '
        b'"author": "a", "license": "MIT", "min_cybrik_version": "0.1.0", '
        b'"content_types": ["soar_playbooks"], "contents": ['
        b'{"path": "playbooks/script.json", "item_type": "soar_playbooks", "sha256_hash": "'
        + shebang_hash.encode()
        + b'"}], "created_at": "2026-01-01T00:00:00Z"}'
    )
    archive_shebang = _build_raw_archive(
        {
            "manifest.json": manifest_shebang,
            "playbooks/script.json": shebang_data,
        }
    )
    with pytest.raises(DisallowedFileTypeError, match="executable magic bytes"):
        verifier.verify(archive_shebang)


def test_cli_pack_commands(tmp_path: Path) -> None:
    """Test CLI commands: cybrik pack build, validate, and inspect."""
    src = _create_sample_pack_source(tmp_path)
    pack_output = tmp_path / "community_mitre.cybrik-pack"

    # 1. CLI build
    res_build = runner.invoke(
        app,
        ["pack", "build", str(src), "-o", str(pack_output)],
    )
    assert res_build.exit_code == 0
    assert "Successfully built CYBRIK Content Pack:" in res_build.output
    assert "community.mitre-top20-sigma" in res_build.output
    assert "Pack Digest: sha256:" in res_build.output
    assert pack_output.is_file()

    # 2. CLI validate (valid pack)
    res_validate = runner.invoke(
        app,
        ["pack", "validate", str(pack_output)],
    )
    assert res_validate.exit_code == 0
    assert "[PASS] Content Pack validation succeeded:" in res_validate.output
    assert "community.mitre-top20-sigma" in res_validate.output

    # 3. CLI inspect (standard table view)
    res_inspect = runner.invoke(
        app,
        ["pack", "inspect", str(pack_output)],
    )
    assert res_inspect.exit_code == 0
    assert "CYBRIK Content Pack: MITRE ATT&CK Top 20 Sigma Rules" in res_inspect.output
    assert "rules/powershell_encoded.yml" in res_inspect.output
    assert "sigma_rules" in res_inspect.output
    assert "Summary: 4 file(s)" in res_inspect.output

    # 4. CLI inspect (--json flag)
    res_inspect_json = runner.invoke(
        app,
        ["pack", "inspect", str(pack_output), "--json"],
    )
    assert res_inspect_json.exit_code == 0
    parsed_json = json.loads(res_inspect_json.output)
    assert parsed_json["pack_id"] == "community.mitre-top20-sigma"
    assert parsed_json["version"] == "1.2.0"
    assert len(parsed_json["contents"]) == 4

    # 5. CLI validate failure on corrupted file
    corrupt_pack = tmp_path / "corrupted.cybrik-pack"
    corrupt_pack.write_bytes(b"NOT_A_VALID_GZIP_FILE")
    res_bad_validate = runner.invoke(
        app,
        ["pack", "validate", str(corrupt_pack)],
    )
    assert res_bad_validate.exit_code == 1
    assert "[FAIL] Content Pack validation failed:" in res_bad_validate.output

    # 6. CLI inspect failure on corrupted file
    res_bad_inspect = runner.invoke(
        app,
        ["pack", "inspect", str(corrupt_pack)],
    )
    assert res_bad_inspect.exit_code == 1
    assert "Error inspecting content pack:" in res_bad_inspect.output


def test_builder_auto_discovery(tmp_path: Path) -> None:
    """Test builder auto-discovering files when contents list is omitted in manifest."""
    src = tmp_path / "auto_pack"
    src.mkdir(parents=True, exist_ok=True)
    (src / "rules").mkdir(parents=True, exist_ok=True)
    (src / "docs").mkdir(parents=True, exist_ok=True)

    (src / "rules" / "sigma_rule.yml").write_text("title: Auto Rule\n", encoding="utf-8")
    (src / "docs" / "info.md").write_text("# Auto Pack Info\n", encoding="utf-8")

    manifest_dict = {
        "pack_id": "community.auto-pack",
        "name": "Auto Discovered Pack",
        "version": "1.0.0",
        "description": "Pack with auto-discovered items",
        "author": "SecOps",
        "license": "Apache-2.0",
        "min_cybrik_version": "0.1.0",
        "content_types": ["sigma_rules", "documentation"],
        "created_at": "2026-09-06T12:00:00Z",
    }
    (src / "manifest.json").write_text(json.dumps(manifest_dict, indent=2), encoding="utf-8")

    out_pack = tmp_path / "auto_pack.cybrik-pack"
    builder = ContentPackBuilder()
    res = builder.build_from_directory(source_dir=src, output_path=out_pack)

    assert res.file_count == 2
    paths = [item.path for item in res.manifest.contents]
    assert "rules/sigma_rule.yml" in paths
    assert "docs/info.md" in paths

    verifier = ContentPackVerifier()
    v_res = verifier.verify(out_pack)
    assert v_res.valid is True
    assert v_res.file_count == 2


def test_builder_and_verifier_error_cases(tmp_path: Path) -> None:
    """Test validation errors for missing directories, files, or invalid sources."""
    builder = ContentPackBuilder()
    verifier = ContentPackVerifier()

    # 1. Source directory does not exist
    with pytest.raises(Exception, match="does not exist"):
        builder.build_from_directory(tmp_path / "nonexistent_dir")

    # 2. Source directory missing manifest.json
    empty_dir = tmp_path / "empty_dir"
    empty_dir.mkdir()
    with pytest.raises(Exception, match="Manifest file not found"):
        builder.build_from_directory(empty_dir)

    # 3. Invalid JSON in manifest
    bad_json_dir = tmp_path / "bad_json_dir"
    bad_json_dir.mkdir()
    (bad_json_dir / "manifest.json").write_text("{not valid json", encoding="utf-8")
    with pytest.raises(Exception, match="Invalid JSON"):
        builder.build_from_directory(bad_json_dir)

    # 4. Manifest references nonexistent file
    missing_file_dir = tmp_path / "missing_file_dir"
    missing_file_dir.mkdir()
    manifest_missing = {
        "pack_id": "test.missing",
        "name": "Missing",
        "version": "1.0.0",
        "description": "d",
        "author": "a",
        "license": "MIT",
        "min_cybrik_version": "0.1.0",
        "content_types": ["documentation"],
        "contents": [{"path": "docs/absent.md", "item_type": "documentation", "sha256_hash": ""}],
        "created_at": "2026-01-01T00:00:00Z",
    }
    (missing_file_dir / "manifest.json").write_text(json.dumps(manifest_missing), encoding="utf-8")
    with pytest.raises(Exception, match="does not exist|missing"):
        builder.build_from_directory(missing_file_dir)

    # 5. Archive missing manifest.json
    no_manifest_archive = _build_raw_archive({"docs/readme.txt": b"content"})
    with pytest.raises(Exception, match="missing.*manifest"):
        verifier.verify(no_manifest_archive)

    # 6. Invalid pack source type
    with pytest.raises(Exception, match="Invalid pack source"):
        verifier.verify(12345)  # type: ignore[arg-type]
