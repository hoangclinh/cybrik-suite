"""Injected child-stage and observation seams; no real adapter lives here."""

from __future__ import annotations

from typing import Protocol

from .models import EnvironmentSnapshot, OrchestrationContext, StageReceipt


class PostgresD2Stage(Protocol):
    def run(self, context: OrchestrationContext) -> StageReceipt: ...

    def teardown(self, context: OrchestrationContext) -> None: ...

    def verify_absent(self, context: OrchestrationContext) -> None: ...


class AlertContextStage(Protocol):
    def run(self, context: OrchestrationContext) -> StageReceipt: ...

    def teardown(self, context: OrchestrationContext) -> None: ...

    def verify_absent(self, context: OrchestrationContext) -> None: ...


class CommonTeardown(Protocol):
    def teardown(self, context: OrchestrationContext) -> None: ...

    def verify_absent(self, context: OrchestrationContext) -> None: ...


class EnvironmentInspector(Protocol):
    def inspect(self) -> EnvironmentSnapshot: ...
