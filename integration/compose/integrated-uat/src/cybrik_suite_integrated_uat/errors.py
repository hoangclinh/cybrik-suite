"""Stable public failures shared by integrated-UAT adapters."""


class AdapterFailure(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason
