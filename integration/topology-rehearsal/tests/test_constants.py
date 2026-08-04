"""The exact reviewed values C8 must freeze, and the values it must never contain.

Status: `RED — TESTS ONLY — RUNNER NOT IMPLEMENTED`.

`constants` is the single place a reviewed number, path or identifier may live. Every value
below is pinned twice — once here and once in the implementation — so a silent edit to
either side is a failure. The last test in this module runs the other way: it proves that no
synthetic fixture byte invented by this test suite has leaked into the implementation, where
it could be misread as an observed fact.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

import fakes
import documents
from conftest import PACKAGE, SRC, load_c8, require_c8_attr, require_c8_path, source_paths

# name in `constants` -> exact reviewed value, mirrored from the committed diagnosis packet
# and machine record. A drift on either side fails.
EXACT_VALUES = {
    "CAPABILITY_ID": fakes.CAPABILITY_ID,
    "OBJECTIVE_ID": fakes.OBJECTIVE_ID,
    "SERIES_ID": fakes.SERIES_ID,
    "RECORD_ID": fakes.RECORD_ID,
    "RECORD_DIR": fakes.RECORD_DIR,
    "RECORD_PATH": fakes.RECORD_PATH,
    "GRANT_PATH": fakes.GRANT_PATH,
    "GRANT_SCHEMA": fakes.GRANT_SCHEMA,
    "AUTHORIZATION_NAMESPACE": fakes.AUTHORIZATION_NAMESPACE,
    "SIGNER": fakes.SIGNER,
    "HOST_IP": fakes.HOST_IP,
    "HOST_PORT": fakes.HOST_PORT,
    "CONTAINER_PORT": fakes.CONTAINER_PORT,
    "PORT_PROTOCOL": fakes.PORT_PROTOCOL,
    "CONTAINER_PORT_KEY": fakes.CONTAINER_PORT_KEY,
    "PUBLISH_SPEC": fakes.PUBLISH_SPEC,
    "EXPECTED_PUBLICATION": fakes.OBSERVED_PUBLICATION,
    "IMAGE_REFERENCE": fakes.IMAGE_REFERENCE,
    "PULL_POLICY": fakes.PULL_POLICY,
    # The record's `topology.image` is a resolution-stated observation of the selection, so
    # both its key inventory and its two resolution states are reviewed values.
    "SELECTED_IDENTITY_KEYS": documents.SELECTED_IDENTITY_KEYS,
    "IMAGE_RESOLVED": fakes.IMAGE_RESOLVED,
    "IMAGE_UNRESOLVED": fakes.IMAGE_UNRESOLVED,
    "PROBE_EXECUTABLE_PATH": fakes.PROBE_EXECUTABLE_PATH,
    "PROBE_EXECUTABLE_SHA256": fakes.PROBE_EXECUTABLE_SHA256,
    "PROBE_ARGV": fakes.PROBE_ARGV,
    "PROBE_REACHABLE": "reachable",
    "HEALTH_HEALTHY": "healthy",
    "RUNTIME_LIMIT_SECONDS": fakes.RUNTIME_LIMIT_SECONDS,
    "EXTENSION_CYCLES": fakes.EXTENSION_CYCLES,
    "ATTEMPT_ORDINAL": fakes.ATTEMPT_ORDINAL,
    "MAX_ATTEMPTS": fakes.MAX_ATTEMPTS,
    "OUTCOME_NOT_RUN": fakes.OUTCOME_NOT_RUN,
    "PHASE_AUTHORIZED": fakes.PHASE_AUTHORIZED,
    "PRECHECK_ABORT": fakes.PRECHECK_ABORT,
    "STOP_CONTROL": fakes.STOP_CONTROL,
    "FAIL_PUBLICATION": fakes.FAIL_PUBLICATION,
    "FAIL_INTERNAL_INGRESS": fakes.FAIL_INTERNAL_INGRESS,
    "TOPOLOGY_PASS": fakes.TOPOLOGY_PASS,
    "OUTCOME_PRECEDENCE": fakes.OUTCOME_PRECEDENCE,
    "PUBLICATION_VIEWS": fakes.PUBLICATION_VIEWS,
    "CREATION_KINDS": fakes.CREATION_KINDS,
    "TEARDOWN_KINDS": fakes.TEARDOWN_KINDS,
    "CONTROL_REPOSITORIES": (
        fakes.SUITE_CONTROL,
        fakes.SOC_CONTROL,
        fakes.AI_CONTROL,
        fakes.FABRIC_CONTROL,
    ),
    "GRANT_KEYS": documents.GRANT_KEYS,
    "GRANT_NO_AUTHORITY": documents.GRANT_NO_AUTHORITY,
    "RECORD_PRODUCTION_EXCLUSION": documents.RECORD_PRODUCTION_EXCLUSION,
    "EVIDENCE_KEYS": (
        "attempt_id",
        "platform",
        "control_identities",
        "image",
        "ephemeral_range",
        "pre_consumption_listeners",
        "publication_views",
        "network_attachment",
        "probe",
        "timings",
        "teardown",
    ),
}

# Every constant that must be an immutable container. A list or dict here would let one
# caller mutate a reviewed value for every other caller in the process.
IMMUTABLE_CONTAINERS = (
    "PROBE_ARGV",
    "OUTCOME_PRECEDENCE",
    "PUBLICATION_VIEWS",
    "CREATION_KINDS",
    "TEARDOWN_KINDS",
    "CONTROL_REPOSITORIES",
    "GRANT_KEYS",
    "EVIDENCE_KEYS",
    "SELECTED_IDENTITY_KEYS",
)


@pytest.fixture(name="constants")
def constants_module():
    return load_c8("constants")


@pytest.mark.parametrize("name", sorted(EXACT_VALUES))
def test_every_reviewed_value_is_frozen_exactly(constants, name: str) -> None:
    assert require_c8_attr(constants, name) == EXACT_VALUES[name]


@pytest.mark.parametrize("name", IMMUTABLE_CONTAINERS)
def test_every_sequence_constant_is_an_immutable_tuple(constants, name: str) -> None:
    assert isinstance(require_c8_attr(constants, name), tuple)


@pytest.mark.parametrize(
    ("name", "expected"),
    (
        ("GRANT_NO_AUTHORITY", documents.GRANT_NO_AUTHORITY),
        ("RECORD_PRODUCTION_EXCLUSION", documents.RECORD_PRODUCTION_EXCLUSION),
    ),
)
def test_authority_denials_are_distinct_read_only_mappings(
    constants, name: str, expected
) -> None:
    exclusion = require_c8_attr(constants, name)
    assert not isinstance(exclusion, dict), "a plain dict is mutable shared state"
    assert dict(exclusion) == expected
    assert all(value is True for value in dict(exclusion).values())


def test_constants_exports_exactly_the_reviewed_names(constants) -> None:
    exported = set(require_c8_attr(constants, "__all__"))
    assert exported == set(EXACT_VALUES)


def test_the_publish_spec_is_composed_from_its_own_parts(constants) -> None:
    """The bind string may not be an independently typed literal that can drift."""
    host_ip = require_c8_attr(constants, "HOST_IP")
    host_port = require_c8_attr(constants, "HOST_PORT")
    container_port = require_c8_attr(constants, "CONTAINER_PORT")
    protocol = require_c8_attr(constants, "PORT_PROTOCOL")
    assert require_c8_attr(constants, "PUBLISH_SPEC") == (
        f"{host_ip}:{host_port}:{container_port}/{protocol}"
    )
    assert require_c8_attr(constants, "CONTAINER_PORT_KEY") == (
        f"{container_port}/{protocol}"
    )
    assert require_c8_attr(constants, "EXPECTED_PUBLICATION") == f"{host_ip}:{host_port}"


def test_the_probe_argv_targets_exactly_the_reviewed_loopback_publication(
    constants,
) -> None:
    argv = require_c8_attr(constants, "PROBE_ARGV")
    host_ip = require_c8_attr(constants, "HOST_IP")
    host_port = require_c8_attr(constants, "HOST_PORT")
    assert argv == ("-z", "-w", "5", host_ip, str(host_port))
    assert "-z" in argv, "the probe must forbid application data"
    assert argv[argv.index("-w") + 1] == "5", "the connect must stay bounded"


def test_the_selected_identity_keys_exclude_every_host_only_observation(
    constants,
) -> None:
    """A selected registry identity may never carry a host identity or its own state."""
    keys = require_c8_attr(constants, "SELECTED_IDENTITY_KEYS")
    assert not set(keys) & {"local_image_id", "observed_at", "resolution_state"}
    assert require_c8_attr(constants, "IMAGE_RESOLVED") != require_c8_attr(
        constants, "IMAGE_UNRESOLVED"
    )


def test_the_reviewed_host_port_sits_below_the_observed_ephemeral_range(
    constants,
) -> None:
    low, _high = fakes.EPHEMERAL_RANGE
    assert require_c8_attr(constants, "HOST_PORT") < low


def test_the_outcome_precedence_is_the_exact_ordered_terminal_class_list(
    constants,
) -> None:
    precedence = require_c8_attr(constants, "OUTCOME_PRECEDENCE")
    assert precedence == (
        require_c8_attr(constants, "PRECHECK_ABORT"),
        require_c8_attr(constants, "STOP_CONTROL"),
        require_c8_attr(constants, "FAIL_PUBLICATION"),
        require_c8_attr(constants, "FAIL_INTERNAL_INGRESS"),
        require_c8_attr(constants, "TOPOLOGY_PASS"),
    )
    assert precedence[-1] == "TOPOLOGY_PASS", "a pass may only be the weakest class"
    assert len(set(precedence)) == len(precedence)


def test_the_teardown_inventory_covers_every_created_kind(constants) -> None:
    created = set(require_c8_attr(constants, "CREATION_KINDS"))
    torn_down = set(require_c8_attr(constants, "TEARDOWN_KINDS"))
    assert created == torn_down, "every created resource kind must have a teardown target"


def test_the_grant_path_and_record_path_sit_inside_the_pinned_record_directory(
    constants,
) -> None:
    record_dir = require_c8_attr(constants, "RECORD_DIR")
    assert require_c8_attr(constants, "RECORD_PATH").startswith(f"{record_dir}/")
    assert require_c8_attr(constants, "GRANT_PATH").startswith(f"{record_dir}/")
    assert require_c8_attr(constants, "GRANT_PATH").endswith(".json")
    assert record_dir.endswith(f"/{require_c8_attr(constants, 'RECORD_ID')}")


def test_the_single_attempt_budget_is_exactly_one(constants) -> None:
    assert require_c8_attr(constants, "ATTEMPT_ORDINAL") == 1
    assert require_c8_attr(constants, "MAX_ATTEMPTS") == 1
    assert require_c8_attr(constants, "EXTENSION_CYCLES") == 0


def test_the_d2_observation_never_leaks_into_runner_source() -> None:
    """Historical host evidence belongs to the record, never executable constants."""
    require_c8_path(SRC)
    offences = [
        str(path)
        for path in source_paths()
        if fakes.D2_OBSERVED_IMAGE_ID in path.read_text(encoding="utf-8")
    ]
    assert offences == []


def test_no_synthetic_fixture_value_leaks_into_the_implementation() -> None:
    """Invented test bytes must never appear in C8, where they would read as facts.

    Every digest, commit and attempt id this suite invents is scaffolding. If one of them
    turns up in the implementation it has been promoted into an apparent observation, so
    this control fails closed on the exact offending value and file.
    """
    require_c8_path(SRC)
    paths = source_paths()
    if not paths:
        pytest.fail(
            "missing C8 implementation — no authored source file exists, so this "
            "leak control cannot be satisfied vacuously",
            pytrace=False,
        )
    offences = [
        f"{path}: synthetic fixture value {value!r}"
        for path in paths
        for value in fakes.SYNTHETIC_VALUES
        if value in path.read_text(encoding="utf-8")
    ]
    assert offences == []


def test_the_constants_module_is_the_only_place_reviewed_numbers_are_typed() -> None:
    """No sibling module may re-type reviewed integer constants in executable syntax."""
    package_dir = require_c8_path(SRC / PACKAGE)
    literals = {fakes.HOST_PORT, fakes.RUNTIME_LIMIT_SECONDS}
    offences: list[str] = []
    for path in sorted(package_dir.glob("*.py")):
        if path.stem in {"constants", "__init__"}:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        offences.extend(
            f"{path}:{node.lineno}: re-typed reviewed integer {node.value}"
            for node in ast.walk(tree)
            if isinstance(node, ast.Constant)
            and type(node.value) is int
            and node.value in literals
        )
    assert offences == []


def test_the_constants_module_file_exists_as_authored_source() -> None:
    path = require_c8_path(SRC / PACKAGE / "constants.py")
    assert isinstance(path, Path) and path.is_file()
