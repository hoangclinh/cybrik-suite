"""Canonical semantic grant binding that must succeed before SSHSIG verification."""

from __future__ import annotations

import ast
import json
import sys
from copy import deepcopy
from dataclasses import FrozenInstanceError, replace

import documents
import fakes
import pytest
from conftest import PACKAGE, SRC, load_c8, require_c8_attr, require_c8_path

# One minute past the reviewed runtime envelope. A window wider than the limit authorizes
# more wall-clock than section 7 reviewed, even though every instant in it parses.
OVERLONG_EXPIRES_AT = "2026-08-05T00:04:00Z"

# The bound a canonical grant may not exceed. An unbounded rendering is a byte budget nobody
# agreed to sign, and a document a reviewer cannot read in one sitting is not exact-action.
GRANT_BYTE_LIMIT = 65536

# Every fact the runner must observe for itself before a grant may be read against it. None
# of them may carry a default: a defaulted fact would let an unobserved control read as a
# satisfied one, which is exactly the fail-open this binding exists to prevent.
REQUIRED_FACTS = (
    "record_path",
    "record_sha256",
    "runner_aggregate_sha256",
    "topology",
    "selected_image_identity",
    "observed_image_identity",
    "repositories",
    "tools",
    "now",
)

# The only module roots a pure binding module may name. Anything else is either an effect —
# a file, a process, a socket — or a dependency this specification never reviewed.
GRANT_IMPORT_ROOTS = frozenset(
    {"__future__", "collections", "dataclasses", "datetime", "json", "types", "typing"}
)
# The two reviewed values that decide whether a signature is the Founder's. A binding module
# that imported either would be positioned to answer the authorization question it exists to
# run strictly *before*, which is the self-authorization this separation removes.
SELF_AUTHORIZING_CONSTANTS = ("AUTHORIZATION_NAMESPACE", "SIGNER")


@pytest.fixture(name="grant")
def grant_module():
    return load_c8("grant")


def facts(grant, now: str = documents.NOW_INSIDE_WINDOW, **overrides):
    facts_type = require_c8_attr(grant, "GrantFacts")
    document = documents.grant_document()
    return facts_type(
        **{
            "record_path": fakes.RECORD_PATH,
            "record_sha256": fakes.SYNTHETIC_RECORD_SHA256,
            "runner_aggregate_sha256": fakes.SYNTHETIC_RUNNER_AGGREGATE_SHA256,
            "topology": document["topology"],
            "selected_image_identity": document["selected_image_identity"],
            "observed_image_identity": document["observed_image_identity"],
            "repositories": document["repositories"],
            "tools": document["tools"],
            "now": now,
            **overrides,
        }
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


def test_canonical_bytes_are_the_documents_own_two_space_json_rendering(grant) -> None:
    """The bytes a signer signs are one exact rendering of one exact key order.

    The rendering keeps the document's own order rather than sorting it. A canonicalizer
    that re-ordered would let two differently ordered documents render to the same bytes,
    so a signature taken over one would silently carry the other.
    """
    document = documents.grant_document()
    render = require_c8_attr(grant, "canonical_grant_bytes")
    assert render(document) == json.dumps(document, indent=2).encode("utf-8") + b"\n"
    reordered = documents.with_key_order(document, tuple(reversed(documents.GRANT_KEYS)))
    assert render(reordered) != render(document)


@pytest.mark.parametrize(
    "unrenderable",
    (
        (),
        "grant",
        1,
        None,
        {"schema": {"a", "b"}},
        {"schema": float("nan")},
        {"schema": {1: "a non-string nested key"}},
    ),
)
def test_canonical_bytes_refuse_anything_that_is_not_a_renderable_grant(
    grant, unrenderable
) -> None:
    """A document that cannot render exactly has no canonical bytes to sign."""
    with pytest.raises(ValueError):
        require_c8_attr(grant, "canonical_grant_bytes")(unrenderable)


def test_canonical_bytes_normalize_recursion_to_the_single_value_error(grant) -> None:
    recursive: dict[str, object] = {}
    recursive["self"] = recursive
    with pytest.raises(ValueError):
        require_c8_attr(grant, "canonical_grant_bytes")(recursive)


def test_canonical_bytes_normalize_excessive_depth_to_the_single_value_error(grant) -> None:
    deeply_nested: dict[str, object] = {}
    cursor = deeply_nested
    for _ in range(sys.getrecursionlimit() + 10):
        child: dict[str, object] = {}
        cursor["child"] = child
        cursor = child
    with pytest.raises(ValueError):
        require_c8_attr(grant, "canonical_grant_bytes")(deeply_nested)


def test_a_grant_past_the_reviewed_byte_bound_is_refused_not_rendered(grant) -> None:
    oversized = documents.grant_document(authorizes="x" * GRANT_BYTE_LIMIT)
    with pytest.raises(ValueError):
        require_c8_attr(grant, "canonical_grant_bytes")(oversized)


@pytest.mark.parametrize("omitted", REQUIRED_FACTS)
def test_no_independently_observed_fact_carries_a_default(grant, omitted: str) -> None:
    facts_type = require_c8_attr(grant, "GrantFacts")
    complete = {name: getattr(facts(grant), name) for name in REQUIRED_FACTS}
    del complete[omitted]
    with pytest.raises(TypeError):
        facts_type(**complete)


def test_verify_bindings_edits_neither_the_document_nor_the_observed_facts(
    grant,
) -> None:
    """Reading a grant is a pure reduction: it leaves both of its inputs exactly as given."""
    document = documents.grant_document()
    unchanged = deepcopy(document)
    current = facts(grant)
    require_c8_attr(grant, "verify_bindings")(document, current)
    assert document == unchanged
    assert current == facts(grant)


def test_one_replaced_fact_leaves_every_other_binding_intact(grant) -> None:
    """Facts are replaced into a new value, never edited in place."""
    current = facts(grant)
    later = replace(current, now=documents.NOW_AT_NOT_BEFORE)
    verify = require_c8_attr(grant, "verify_bindings")
    assert verify(documents.grant_document(), later).satisfied is True
    assert current.now == documents.NOW_INSIDE_WINDOW


@pytest.mark.parametrize(
    ("override", "named"),
    [
        ({"record_path": f"{fakes.RECORD_DIR}/other-rehearsal.json"}, "record"),
        ({"record_sha256": "0" * 64}, "record"),
        ({"runner_aggregate_sha256": "0" * 64}, "runner"),
    ],
)
def test_the_record_and_runner_bindings_must_equal_the_observed_facts(
    grant, override, named: str
) -> None:
    """A grant binds the record and runner the runner itself observed, not its own claim."""
    verdict = require_c8_attr(grant, "verify_bindings")(
        documents.grant_document(), facts(grant, **override)
    )
    assert verdict.satisfied is False
    assert any(named in finding.lower() for finding in verdict.findings)


@pytest.mark.parametrize(
    ("section", "path", "bad"),
    [
        ("topology", ("host_port",), fakes.HOST_PORT + 1),
        ("selected_image_identity", ("manifest_digest",), "sha256:" + "0" * 64),
        ("observed_image_identity", ("manifest_digest",), "sha256:" + "0" * 64),
        ("repositories", ("cybrik-suite", "clean"), False),
        ("tools", ("docker", "sha256"), "0" * 64),
    ],
)
def test_each_runner_observation_must_bind_in_its_failing_direction(
    grant, section: str, path: tuple[str, ...], bad
) -> None:
    document = documents.grant_document()
    observed = deepcopy(document[section])
    cursor = observed
    for key in path[:-1]:
        cursor = cursor[key]
    cursor[path[-1]] = bad
    verdict = require_c8_attr(grant, "verify_bindings")(
        document, facts(grant, **{section: observed})
    )
    assert verdict.satisfied is False
    assert any(section in finding for finding in verdict.findings)


def test_a_grant_signed_before_the_attempt_binds_a_fresh_host_observation(grant) -> None:
    """The runtime timestamp is fresh evidence, not a value copied out of signed bytes."""
    document = documents.grant_document()
    observed = deepcopy(document["observed_image_identity"])
    observed["observed_at"] = documents.NOW_INSIDE_WINDOW
    verify = require_c8_attr(grant, "verify_bindings")
    assert verify(
        document, facts(grant, observed_image_identity=observed)
    ).satisfied is True

    observed["manifest_digest"] = "sha256:" + "0" * 64
    refused = verify(document, facts(grant, observed_image_identity=observed))
    assert refused.satisfied is False
    assert any("observed_image_identity" in finding for finding in refused.findings)


def test_selected_and_observed_registry_identities_must_agree(grant) -> None:
    document = documents.with_nested(
        documents.grant_document(),
        "observed_image_identity",
        {"manifest_digest": "sha256:" + "0" * 64},
    )
    verdict = require_c8_attr(grant, "verify_bindings")(
        document,
        facts(grant, observed_image_identity=document["observed_image_identity"]),
    )
    assert verdict.satisfied is False
    assert any("selected" in finding for finding in verdict.findings)


def test_runtime_observation_key_order_is_not_a_signed_semantic(grant) -> None:
    document = documents.grant_document()
    observed = dict(reversed(tuple(document["observed_image_identity"].items())))
    observed["observed_at"] = documents.NOW_INSIDE_WINDOW
    verdict = require_c8_attr(grant, "verify_bindings")(
        document, facts(grant, observed_image_identity=observed)
    )
    assert verdict.satisfied is True


@pytest.mark.parametrize(
    ("side", "observed_at", "satisfied"),
    [
        ("signed", documents.NOW_AT_NOT_BEFORE, True),
        ("signed", documents.NOW_AT_EXPIRES_AT, False),
        ("runtime", documents.NOW_AT_NOT_BEFORE, True),
        ("runtime", documents.NOW_AT_EXPIRES_AT, False),
    ],
)
def test_both_observation_timestamps_use_the_closed_open_window_boundaries(
    grant, side: str, observed_at: str, satisfied: bool
) -> None:
    document = documents.grant_document()
    runtime_observation = deepcopy(document["observed_image_identity"])
    if side == "signed":
        document = documents.with_nested(
            document, "observed_image_identity", {"observed_at": observed_at}
        )
    else:
        runtime_observation["observed_at"] = observed_at
    verdict = require_c8_attr(grant, "verify_bindings")(
        document,
        facts(grant, observed_image_identity=runtime_observation),
    )
    assert verdict.satisfied is satisfied
    if not satisfied:
        assert any("window" in finding for finding in verdict.findings)


@pytest.mark.parametrize(
    "signed_at",
    (documents.NOW_BEFORE_NOT_BEFORE, documents.NOW_AFTER_EXPIRES_AT),
)
def test_a_signed_image_observation_outside_the_window_is_refused(
    grant, signed_at: str
) -> None:
    document = documents.with_nested(
        documents.grant_document(),
        "observed_image_identity",
        {"observed_at": signed_at},
    )
    verdict = require_c8_attr(grant, "verify_bindings")(document, facts(grant))
    assert verdict.satisfied is False
    assert any("window" in finding for finding in verdict.findings)


@pytest.mark.parametrize(
    ("signed_at", "runtime_at", "now"),
    [
        (documents.NOW_INSIDE_WINDOW, documents.NOW_AT_NOT_BEFORE, documents.NOW_INSIDE_WINDOW),
        (documents.NOW_AT_NOT_BEFORE, "2026-08-05T00:02:00Z", documents.NOW_INSIDE_WINDOW),
    ],
)
def test_observation_chronology_must_be_signed_then_runtime_then_now(
    grant, signed_at: str, runtime_at: str, now: str
) -> None:
    document = documents.with_nested(
        documents.grant_document(),
        "observed_image_identity",
        {"observed_at": signed_at},
    )
    runtime_observation = deepcopy(document["observed_image_identity"])
    runtime_observation["observed_at"] = runtime_at
    verdict = require_c8_attr(grant, "verify_bindings")(
        document,
        facts(
            grant,
            now=now,
            observed_image_identity=runtime_observation,
        ),
    )
    assert verdict.satisfied is False
    assert any("chronology" in finding for finding in verdict.findings)


@pytest.mark.parametrize(
    "observed_at",
    (documents.NOW_BEFORE_NOT_BEFORE, documents.NOW_AFTER_EXPIRES_AT),
)
def test_a_host_image_observed_outside_the_authorized_window_is_refused(
    grant, observed_at: str
) -> None:
    document = documents.grant_document()
    observed = deepcopy(document["observed_image_identity"])
    observed["observed_at"] = observed_at
    verdict = require_c8_attr(grant, "verify_bindings")(
        document, facts(grant, observed_image_identity=observed)
    )
    assert verdict.satisfied is False
    assert any("window" in finding for finding in verdict.findings)


@pytest.mark.parametrize(
    ("field", "bad"),
    [
        ("local_image_id", 0),
        ("local_image_id", "sha256:not-a-digest"),
        ("platform", "linux/arm64"),
        ("platform", {"os": "linux", "architecture": 64, "variant": None}),
    ],
)
def test_runtime_image_observation_has_exact_reviewed_shapes(
    grant, field: str, bad
) -> None:
    document = documents.with_nested(
        documents.grant_document(), "observed_image_identity", {field: bad}
    )
    verdict = require_c8_attr(grant, "verify_bindings")(
        document,
        facts(grant, observed_image_identity=document["observed_image_identity"]),
    )
    assert verdict.satisfied is False
    assert any("observed_image_identity" in finding for finding in verdict.findings)


@pytest.mark.parametrize(
    "extra",
    [
        {"local_image_id": fakes.SYNTHETIC_HOST_IMAGE_ID},
        {"resolution_state": fakes.IMAGE_RESOLVED},
        {"observed_at": fakes.IMAGE_OBSERVED_AT},
    ],
)
def test_a_selected_identity_may_not_carry_a_host_only_observation(grant, extra) -> None:
    """The required registry selection and the host observation stay separate objects."""
    malformed = documents.with_nested(
        documents.grant_document(), "selected_image_identity", extra
    )
    verdict = require_c8_attr(grant, "verify_bindings")(malformed, facts(grant))
    assert verdict.satisfied is False
    assert any("identity" in finding.lower() for finding in verdict.findings)


@pytest.mark.parametrize("patch", [{"ordinal": 2}, {"ordinal": 0}, {"max_attempts": 0}])
def test_the_grant_authorizes_exactly_one_numbered_attempt(grant, patch) -> None:
    malformed = documents.with_nested(documents.grant_document(), "attempt", patch)
    verdict = require_c8_attr(grant, "verify_bindings")(malformed, facts(grant))
    assert verdict.satisfied is False
    assert any("attempt" in finding.lower() for finding in verdict.findings)


@pytest.mark.parametrize(
    ("field", "bad"),
    [
        ("schema", f"{fakes.GRANT_SCHEMA}1"),
        ("authorizes", "topology_rehearsal_unbounded"),
    ],
)
def test_the_pinned_schema_and_single_authorized_action_are_exact(
    grant, field: str, bad: str
) -> None:
    malformed = documents.grant_document(**{field: bad})
    verdict = require_c8_attr(grant, "verify_bindings")(malformed, facts(grant))
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize(
    "patch",
    [
        {"expires_at": OVERLONG_EXPIRES_AT},
        {"not_before": documents.EXPIRES_AT, "expires_at": documents.NOT_BEFORE},
        {"expires_at": "2026-08-05 00:03:00"},
        {"not_before": None},
    ],
)
def test_a_window_that_is_not_the_reviewed_bounded_interval_is_refused(
    grant, patch
) -> None:
    """An overlong, inverted or unreadable window authorizes a span nobody reviewed."""
    malformed = documents.with_nested(documents.grant_document(), "window", patch)
    verdict = require_c8_attr(grant, "verify_bindings")(malformed, facts(grant))
    assert verdict.satisfied is False
    assert any("window" in finding.lower() for finding in verdict.findings)


def test_an_unreadable_now_is_a_window_refusal_rather_than_a_pass(grant) -> None:
    verdict = require_c8_attr(grant, "verify_bindings")(
        documents.grant_document(), facts(grant, now="2026-08-05 00:01:00")
    )
    assert verdict.satisfied is False
    assert any("window" in finding.lower() for finding in verdict.findings)


@pytest.mark.parametrize(
    "inexact",
    ("2026-8-05T00:01:00Z", "2026-08-5T00:01:00Z", "2026-08-05T 0:01:00Z"),
)
def test_an_inexact_but_parseable_instant_spelling_is_refused(grant, inexact: str) -> None:
    verdict = require_c8_attr(grant, "verify_bindings")(
        documents.grant_document(), facts(grant, now=inexact)
    )
    assert verdict.satisfied is False
    assert any("window" in finding.lower() for finding in verdict.findings)


@pytest.mark.parametrize(
    ("document", "current"),
    [(None, facts), ({}, object())],
)
def test_outer_grant_and_facts_guards_fail_closed(grant, document, current) -> None:
    observed = current(grant) if callable(current) else current
    verdict = require_c8_attr(grant, "verify_bindings")(document, observed)
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize(
    "arguments",
    [
        {"satisfied": True, "findings": ("drift",)},
        {"satisfied": False, "findings": ()},
        {"satisfied": 1, "findings": ("drift",)},
        {"satisfied": False, "findings": ("",)},
        {"satisfied": False, "findings": ["drift"]},
    ],
)
def test_a_verdict_cannot_report_an_incoherent_answer(grant, arguments) -> None:
    """A verdict is the evidence a later phase reads, so incoherence is refused here."""
    with pytest.raises(ValueError):
        require_c8_attr(grant, "GrantVerdict")(**arguments)


def test_the_binding_module_reaches_for_no_effect_and_never_authorizes_itself() -> None:
    """The grant binding is a pure reduction that cannot answer its own authorization.

    Semantic binding runs strictly before SSHSIG verification, so this module may not name
    the signer or the signature namespace: a module that could decide who signed a grant
    could satisfy the very control it exists to precede.
    """
    path = require_c8_path(SRC / PACKAGE / "grant.py")
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    roots: set[str] = set()
    from_constants: set[str] = set()
    relative_imports: set[tuple[int, str | None]] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level == 0 and node.module:
                roots.add(node.module.split(".")[0])
            elif node.level > 0:
                relative_imports.add((node.level, node.module))
            if node.level > 0 and node.module == "constants":
                from_constants.update(alias.name for alias in node.names)
    assert sorted(roots - GRANT_IMPORT_ROOTS) == []
    assert relative_imports == {(1, "constants")}
    assert sorted(from_constants.intersection(SELF_AUTHORIZING_CONSTANTS)) == []
