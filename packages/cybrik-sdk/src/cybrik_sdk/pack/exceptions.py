"""Exceptions for CYBRIK Content Pack processing and verification."""

from __future__ import annotations

from cybrik_sdk.exceptions import CybrikError, CybrikValidationError


class ContentPackError(CybrikError):
    """Base exception for all content pack operations."""


class ContentPackValidationError(ContentPackError, CybrikValidationError):
    """Schema, manifest, or semantic validation failure in a content pack."""


class ContentPackSecurityError(ContentPackError):
    """Security invariant violation detected in a content pack."""


class PathTraversalError(ContentPackSecurityError):
    """Archive contains an entry that attempts path traversal outside root."""


class DisallowedLinkError(ContentPackSecurityError):
    """Archive contains a forbidden symlink, hardlink, FIFO, or device node."""


class DecompressionBombError(ContentPackSecurityError):
    """Archive violates size, file count, or compression ratio limits."""


class DisallowedFileTypeError(ContentPackSecurityError):
    """Archive contains disallowed executable binary, script, or unapproved extension."""


class TamperDetectionError(ContentPackSecurityError):
    """Archive or manifest integrity mismatch / tampering detected."""
