"""Exceptions for CYBRIK Unified SDK."""

from __future__ import annotations


class CybrikError(Exception):
    """Base exception for all CYBRIK SDK errors."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        response_body: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body

    def __str__(self) -> str:
        if self.status_code is not None:
            return f"[{self.status_code}] {self.message}"
        return self.message


class CybrikSDKError(CybrikError):
    """Base exception class for CYBRIK SDK errors."""


class CybrikAuthError(CybrikError):
    """Authentication or authorization failure (HTTP 401, 403)."""


class CybrikNotFoundError(CybrikError):
    """Target resource not found (HTTP 404)."""


class CybrikRateLimitError(CybrikError):
    """Rate limit or execution budget exceeded (HTTP 429)."""

    def __init__(
        self,
        message: str,
        status_code: int | None = 429,
        response_body: str | None = None,
        retry_after: float | None = None,
    ) -> None:
        super().__init__(message, status_code=status_code, response_body=response_body)
        self.retry_after = retry_after


class CybrikValidationError(CybrikError):
    """Request schema or semantic validation error (HTTP 400, 422)."""


def raise_for_status_code(
    status_code: int,
    message: str,
    response_body: str | None = None,
    retry_after: float | None = None,
) -> None:
    """Raise specialized CybrikError based on HTTP status code."""
    if status_code in (401, 403):
        raise CybrikAuthError(
            message,
            status_code=status_code,
            response_body=response_body,
        )
    if status_code == 404:
        raise CybrikNotFoundError(
            message,
            status_code=status_code,
            response_body=response_body,
        )
    if status_code == 429:
        raise CybrikRateLimitError(
            message,
            status_code=status_code,
            response_body=response_body,
            retry_after=retry_after,
        )
    if status_code in (400, 422):
        raise CybrikValidationError(
            message,
            status_code=status_code,
            response_body=response_body,
        )
    if status_code >= 400:
        raise CybrikError(
            message,
            status_code=status_code,
            response_body=response_body,
        )
