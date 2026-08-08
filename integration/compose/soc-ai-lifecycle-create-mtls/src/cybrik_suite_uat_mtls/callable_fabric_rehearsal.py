"""Suite-owned, in-process rehearsal of an injected AI-to-Fabric resolution seam.

Status: SCAFFOLD / NOT IMPLEMENTED AS RUNTIME. This module proves only that separately owned
callables can be composed while the injected Fabric authority argument is a distinct object from
the AI request argument. It imports no product source, implements no product behavior, opens no
transport, creates no receipt, and is not runtime wiring.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

FabricAuthorityValidator = Callable[[object, object], None]
FabricResolutionCallable = Callable[[object, object], Awaitable[object | None]]


class CallableRehearsalDenied(RuntimeError):
    """Fail-closed local rehearsal outcome; never a product transport error contract."""


@dataclass(frozen=True, slots=True)
class CallableFabricRehearsalObservation:
    """Facts earned only after the two injected callables complete successfully."""

    authority_validation_completed: bool = True
    fabric_resolution_callable_completed: bool = True
    non_none_resolution_returned: bool = True


async def rehearse_callable_fabric_resolution(
    *,
    ai_resolution_request: object,
    fabric_authority: object,
    validate_fabric_authority: FabricAuthorityValidator,
    resolve_through_fabric: FabricResolutionCallable,
) -> CallableFabricRehearsalObservation:
    """Compose opaque product-owned values and callables without taking runtime ownership.

    The authority object must have distinct identity from the Cyber AI request. Validation and
    resolution are injected Fabric responsibilities; the returned object remains opaque to Suite
    because SOC, not this harness, owns alert truth. The validator remains responsible for all
    semantic checks, including rejecting authority embedded in an AI request.
    """

    if ai_resolution_request is fabric_authority:
        raise CallableRehearsalDenied(
            "Fabric authority must be supplied as an opaque object with distinct identity"
        )

    validate_fabric_authority(ai_resolution_request, fabric_authority)
    resolution = await resolve_through_fabric(ai_resolution_request, fabric_authority)
    if resolution is None:
        raise CallableRehearsalDenied("Fabric callable returned no resolution")

    return CallableFabricRehearsalObservation()


__all__ = (
    "CallableFabricRehearsalObservation",
    "CallableRehearsalDenied",
    "FabricAuthorityValidator",
    "FabricResolutionCallable",
    "rehearse_callable_fabric_resolution",
)
