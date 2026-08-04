"""Canonical semantic grant binding that must succeed before SSHSIG verification."""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

import fakes
import documents
from conftest import load_c8, require_c8_attr


@pytest.fixture(name="grant")
def grant_module():
    return load_c8("grant")


def facts(grant, now: str = documents.NOW_INSIDE_WINDOW):
    facts_type = require_c8_attr(grant, "GrantFacts")
    document = documents.grant_document()
    return facts_type(
        record_path=fakes.RECORD_PATH,
        record_sha256=fakes.SYNTHETIC_RECORD_SHA256,
        runner_aggregate_sha256=fakes.SYNTHETIC_RUNNER_AGGREGATE_SHA256,
        topology=document["topology"],
        selected_image_identity=document["selected_image_identity"],
        observed_image_identity=document["observed_image_identity"],
        repositories=document["repositories"],
        tools=document["tools"],
        now=now,
    )


def test_canonical_bytes_are_stable_bounded_utf8_with_one_lf(grant) -> None:
    render = require_c8_attr(grant, "canonical_grant_bytes")
    first = render(documents.grant_document())
    assert first == render(documents.grant_document())
    assert first.endswith(b"\n") and not first.endswith(b"\n\n")
    assert len(first) <= 65536
    assert b"\r" not in first and not first.startswith(b"\xef\xbb\xbf")


def test_a_complete_exact_action_grant_satisfies_every_binding(grant) -> None:
    verdict = require_c8_attr(grant, "verify_bindings")(
        documents.grant_document(), facts(grant)
    )
    assert verdict.satisfied is True
    assert verdict.findings == ()


@pytest.mark.parametrize(
    "field",
    (
        "record",
        "runner",
        "topology",
        "selected_image_identity",
        "observed_image_identity",
        "repositories",
        "tools",
        "window",
        "attempt",
        "authorizes",
        "grants_no_authority",
    ),
)
def test_every_semantic_binding_is_mandatory_and_fail_closed(grant, field: str) -> None:
    malformed = documents.without_field(documents.grant_document(), field)
    verdict = require_c8_attr(grant, "verify_bindings")(malformed, facts(grant))
    assert verdict.satisfied is False
    assert verdict.findings


def test_exact_ordered_grant_key_inventory_is_mandatory(grant) -> None:
    document = documents.grant_document()
    reordered = documents.with_key_order(document, tuple(reversed(documents.GRANT_KEYS)))
    verdict = require_c8_attr(grant, "verify_bindings")(reordered, facts(grant))
    assert not verdict.satisfied
    assert any("key" in finding.lower() for finding in verdict.findings)


@pytest.mark.parametrize(
    ("section", "key", "bad"),
    [
        ("record", "sha256", "0" * 64),
        ("runner", "aggregate_sha256", "0" * 64),
        ("topology", "host_ip", "0.0.0.0"),
        ("selected_image_identity", "manifest_digest", None),
        ("observed_image_identity", "local_image_id", None),
        ("attempt", "max_attempts", 2),
        ("window", "extension_cycles", 1),
        ("grants_no_authority", "production", False),
    ],
)
def test_a_single_nested_drift_is_a_specific_semantic_failure(
    grant, section: str, key: str, bad
) -> None:
    malformed = documents.with_nested(documents.grant_document(), section, {key: bad})
    verdict = require_c8_attr(grant, "verify_bindings")(malformed, facts(grant))
    assert not verdict.satisfied
    assert verdict.findings


@pytest.mark.parametrize(
    "now",
    (documents.NOW_BEFORE_NOT_BEFORE, documents.NOW_AFTER_EXPIRES_AT),
)
def test_a_now_outside_the_authorized_window_is_a_semantic_failure(
    grant, now: str
) -> None:
    """A grant is exact-action in time as well as in content: early is not yet, late is over."""
    verdict = require_c8_attr(grant, "verify_bindings")(
        documents.grant_document(), facts(grant, now=now)
    )
    assert verdict.satisfied is False
    assert any("window" in finding.lower() for finding in verdict.findings)


def test_the_same_grant_inside_its_window_binds(grant) -> None:
    verdict = require_c8_attr(grant, "verify_bindings")(
        documents.grant_document(), facts(grant, now=documents.NOW_INSIDE_WINDOW)
    )
    assert verdict.satisfied is True


def test_the_window_is_closed_at_not_before_and_open_at_expires_at(grant) -> None:
    """The exact boundaries, so neither edge may drift by a second in either direction."""
    verify = require_c8_attr(grant, "verify_bindings")
    opening = verify(
        documents.grant_document(), facts(grant, now=documents.NOW_AT_NOT_BEFORE)
    )
    assert opening.satisfied is True
    assert opening.findings == ()
    closing = verify(
        documents.grant_document(), facts(grant, now=documents.NOW_AT_EXPIRES_AT)
    )
    assert closing.satisfied is False
    assert any("window" in finding.lower() for finding in closing.findings)


@pytest.mark.parametrize(
    "patch",
    [
        {fakes.SUITE_CONTROL: {"clean": False}},
        {fakes.SOC_CONTROL: {"tree": fakes.SYNTHETIC_AI_TREE}},
        {fakes.AI_CONTROL: {"tree": "0" * 40}},
    ],
)
def test_control_repository_cleanliness_and_tree_drift_are_semantic_failures(
    grant, patch
) -> None:
    """A commit alone cannot witness worktree content; tree and cleanliness both bind."""
    document = documents.grant_document()
    repositories = {
        name: {**identity, **patch.get(name, {})}
        for name, identity in document["repositories"].items()
    }
    malformed = {**document, "repositories": repositories}
    verdict = require_c8_attr(grant, "verify_bindings")(malformed, facts(grant))
    assert verdict.satisfied is False
    assert verdict.findings


def test_every_control_repository_reports_a_distinct_tree(grant) -> None:
    document = documents.grant_document()
    trees = [identity["tree"] for identity in document["repositories"].values()]
    assert len(set(trees)) == len(trees)
    assert set(trees) == set(fakes.EXPECTED_TREES.values())
    assert not set(trees) & set(fakes.EXPECTED_CONTROLS.values())
    # And the binding, not only the fixture, must reject one shared tree: four repositories
    # collapsed onto a single tree id witness nothing about three of them.
    collapsed = {
        name: {**identity, "tree": fakes.SYNTHETIC_SUITE_TREE}
        for name, identity in document["repositories"].items()
    }
    verdict = require_c8_attr(grant, "verify_bindings")(
        {**document, "repositories": collapsed}, facts(grant)
    )
    assert verdict.satisfied is False
    assert verdict.findings


def test_registry_digests_and_local_image_id_are_distinct_categories(grant) -> None:
    malformed = documents.with_nested(
        documents.grant_document(),
        "observed_image_identity",
        {"local_image_id": fakes.SYNTHETIC_MANIFEST_DIGEST},
    )
    verdict = require_c8_attr(grant, "verify_bindings")(malformed, facts(grant))
    assert not verdict.satisfied
    assert any("identity" in finding.lower() for finding in verdict.findings)


def test_unresolved_required_identity_is_one_primary_failure(grant) -> None:
    unresolved = documents.with_nested(
        documents.grant_document(),
        "selected_image_identity",
        {"index_digest": None, "manifest_digest": None, "platform": None},
    )
    verdict = require_c8_attr(grant, "verify_bindings")(unresolved, facts(grant))
    assert not verdict.satisfied
    assert len([item for item in verdict.findings if "unresolved" in item.lower()]) == 1


def test_grant_facts_and_verdict_are_immutable(grant) -> None:
    current = facts(grant)
    with pytest.raises(FrozenInstanceError):
        current.now = "later"
    verdict = require_c8_attr(grant, "verify_bindings")(
        documents.grant_document(), current
    )
    with pytest.raises(FrozenInstanceError):
        verdict.satisfied = False


def test_grant_module_exposes_no_emit_sign_or_execute_function(grant) -> None:
    exported = set(require_c8_attr(grant, "__all__"))
    assert exported == {
        "GrantFacts",
        "GrantVerdict",
        "canonical_grant_bytes",
        "verify_bindings",
    }
    assert not any(token in name.lower() for name in exported for token in ("sign", "execute", "write"))
