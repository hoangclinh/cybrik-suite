from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest
from test_adapters import (
    _authorization,
    _context,
    _Executor,
    _inspection_document,
    _install_script,
    _master_artifacts,
    _suite_root,
)

from cybrik_suite_integrated_uat.adapters import (
    COMMON_TEARDOWN_SCRIPT,
    ENVIRONMENT_INSPECTOR_SCRIPT,
    AdapterFailure,
    CommonTeardown,
    CompositeCommonTeardown,
    EnvironmentInspector,
    PostgresD2Stage,
)
from cybrik_suite_integrated_uat.models import (
    ExternalRootBinding,
    canonical_json_bytes,
    external_roots_digest,
)


def test_absence_and_repository_reports_reject_wrong_exact_shapes(
    tmp_path: Path,
) -> None:
    auth = _authorization(tmp_path)
    context = _context(auth)
    suite_root = _suite_root(auth)
    _, common_digest = _install_script(suite_root, COMMON_TEARDOWN_SCRIPT)
    common = CommonTeardown(
        authorization=auth,
        executor=_Executor(
            lambda _argv, _kwargs: SimpleNamespace(
                returncode=0,
                stdout=canonical_json_bytes(
                    {
                        "absent": False,
                        "aggregate_sha256": auth.aggregate_sha256,
                        "authorization_sha256": auth.authorization_sha256,
                        "external_roots_sha256": auth.external_roots_sha256,
                        "marker_sha256": context.marker_sha256,
                        "repository_roots_sha256": auth.repository_roots_sha256,
                        "repository_tuple_sha256": auth.repository_tuple_sha256,
                        "run_id": auth.run_id,
                        "schema": "cybrik.integrated-uat.absence/v1",
                        "scope": "common",
                    }
                ),
                stderr=b"",
            )
        ),
        python_executable=Path(sys.executable).resolve(),
        script_sha256=common_digest,
        suite_root=suite_root,
    )

    with pytest.raises(AdapterFailure, match="^common_absence_check_failed$"):
        common.verify_absent(context)

    _, inspector_digest = _install_script(suite_root, ENVIRONMENT_INSPECTOR_SCRIPT)
    inspector = EnvironmentInspector(
        authorization=auth,
        executor=_Executor(
            lambda _argv, _kwargs: SimpleNamespace(
                returncode=0,
                stdout=canonical_json_bytes(
                    _inspection_document(auth, repository_tuple=["invalid"])
                ),
                stderr=b"",
            )
        ),
        python_executable=Path(sys.executable).resolve(),
        script_sha256=inspector_digest,
        suite_root=suite_root,
    )

    with pytest.raises(AdapterFailure, match="^environment_inspection_invalid$"):
        inspector.inspect()


@pytest.mark.parametrize("mutation", ["mode", "nonempty", "duplicate", "repository"])
def test_adapter_rejects_unsafe_or_overlapping_external_roots(
    tmp_path: Path, mutation: str
) -> None:
    auth = _authorization(tmp_path)
    external_roots = list(auth.external_roots)
    if mutation == "mode":
        external_roots[0].root.chmod(0o755)
    elif mutation == "nonempty":
        (external_roots[0].root / "residual").write_text("present", encoding="utf-8")
    elif mutation == "duplicate":
        external_roots[1] = ExternalRootBinding(
            capability=external_roots[1].capability,
            root=external_roots[0].root,
        )
    else:
        repository = auth.repository_roots[0].root
        repository.chmod(0o700)
        external_roots[0] = ExternalRootBinding(
            capability=external_roots[0].capability,
            root=repository,
        )
    changed = tuple(external_roots)
    invalid = replace(
        auth,
        external_roots=changed,
        external_roots_sha256=external_roots_digest(changed),
    )

    with pytest.raises(AdapterFailure, match="^adapter_authorization_invalid$"):
        PostgresD2Stage(
            **_master_artifacts(tmp_path),
            authorization=invalid,
            executor=_Executor(),
            python_executable=Path(sys.executable).resolve(),
            script_sha256="f" * 64,
            suite_root=_suite_root(auth),
        )


@pytest.mark.parametrize("operation", ["teardown", "verify_absent"])
def test_composite_cleanup_continues_reverse_recovery_after_first_failure(
    tmp_path: Path, operation: str
) -> None:
    context = _context(_authorization(tmp_path))
    events: list[str] = []

    class Target:
        def __init__(self, name: str, fail: bool = False) -> None:
            self.name, self.fail = name, fail

        def teardown(self, _context: object) -> None:
            self._call()

        def verify_absent(self, _context: object) -> None:
            self._call()

        def _call(self) -> None:
            events.append(f"{self.name}.{operation}")
            if self.fail:
                raise RuntimeError("synthetic")

    composite = CompositeCommonTeardown(
        alert_context_stage=Target("alert", fail=True),
        postgres_d2_stage=Target("postgres"),
        supplemental=Target("supplemental"),
    )

    with pytest.raises(AdapterFailure, match=f"^composite_{operation}_failed$"):
        getattr(composite, operation)(context)
    assert events == [
        f"{name}.{operation}" for name in ("alert", "postgres", "supplemental")
    ]
