"""Behavior-preserving composite recovery coordinator."""

from __future__ import annotations

from .errors import AdapterFailure
from .models import OrchestrationContext


class CompositeCommonTeardown:
    def __init__(
        self,
        *,
        alert_context_stage: object,
        postgres_d2_stage: object,
        supplemental: object | None = None,
    ) -> None:
        self._targets = tuple(
            item
            for item in (alert_context_stage, postgres_d2_stage, supplemental)
            if item is not None
        )

    def _apply(self, operation: str, context: OrchestrationContext) -> None:
        failed = False
        for target in self._targets:
            try:
                getattr(target, operation)(context)
            except Exception:  # noqa: BLE001 - every cleanup target must run
                failed = True
        if failed:
            raise AdapterFailure(f"composite_{operation}_failed")

    def teardown(self, context: OrchestrationContext) -> None:
        self._apply("teardown", context)

    def verify_absent(self, context: OrchestrationContext) -> None:
        self._apply("verify_absent", context)
