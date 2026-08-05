"""Semantic bindings, signature and one-attempt state form one fail-closed gate."""

from __future__ import annotations

import json
from dataclasses import fields as dataclass_fields
from dataclasses import replace
from hashlib import sha256
from types import MappingProxyType, SimpleNamespace
from typing import Any

import documents
import fakes
import pytest
from conftest import load_c8, require_c8_attr

# The exact independent observation set a caller must hand admission. Admission observes
# nothing itself and may derive none of these from the grant it is verifying, so the whole
# set arrives from the later composition gate that actually observed it.
INDEPENDENT_FACT_KEYS = (
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

# Well-shaped values that name nothing in the reviewed authorization. They exist only so a
# fact can be moved away from the grant while staying the right shape, which is what makes a
# drift a semantic refusal rather than a shape refusal.
OTHER_DIGEST = "9" * 64
OTHER_OBJECT_ID = "0" * 40
OTHER_IMAGE_ID = "sha256:" + "8" * 64
OTHER_REVIEW_SHA256 = "d" * 64
UNSUPPLIED = object()


@pytest.fixture(name="admission")
def admission_module():
    return load_c8("admission")


def independent_facts(**patch):
    """One passing observation set, assembled only from reviewed constants and fakes.

    Nothing here is read out of the grant or the record under verification: every value is
    stated from the constant or fixture a runner would have observed for itself, so a test
    can move any single binding away from the grant and watch admission refuse.
    """
    facts = {
        "record_path": fakes.RECORD_PATH,
        "record_sha256": fakes.SYNTHETIC_RECORD_SHA256,
        "runner_aggregate_sha256": fakes.SYNTHETIC_RUNNER_AGGREGATE_SHA256,
        "topology": {
            "host_ip": fakes.HOST_IP,
            "host_port": fakes.HOST_PORT,
            "container_port": fakes.CONTAINER_PORT,
            "protocol": fakes.PORT_PROTOCOL,
            "internal_network": True,
            "publish_spec": fakes.PUBLISH_SPEC,
        },
        "selected_image_identity": {
            "repository": fakes.IMAGE_REPOSITORY,
            "tag": fakes.IMAGE_TAG,
            "platform": dict(fakes.IMAGE_PLATFORM),
            "index_digest": fakes.SYNTHETIC_INDEX_DIGEST,
            "manifest_digest": fakes.SYNTHETIC_MANIFEST_DIGEST,
            "pull_policy": fakes.PULL_POLICY,
        },
        "observed_image_identity": {
            "repository": fakes.IMAGE_REPOSITORY,
            "tag": fakes.IMAGE_TAG,
            "platform": dict(fakes.IMAGE_PLATFORM),
            "index_digest": fakes.SYNTHETIC_INDEX_DIGEST,
            "manifest_digest": fakes.SYNTHETIC_MANIFEST_DIGEST,
            "local_image_id": fakes.SYNTHETIC_HOST_IMAGE_ID,
            "observed_at": fakes.IMAGE_OBSERVED_AT,
        },
        "repositories": {
            name: dict(identity)
            for name, identity in fakes.CLEAN_CONTROL_IDENTITIES.items()
        },
        "tools": {
            "docker": {
                "path": fakes.DOCKER_EXECUTABLE_PATH,
                "sha256": fakes.SYNTHETIC_DOCKER_SHA256,
                "version": fakes.DOCUMENTED_PLATFORM["engine_version"],
            },
            "probe": {
                "path": fakes.PROBE_EXECUTABLE_PATH,
                "sha256": fakes.PROBE_EXECUTABLE_SHA256,
                "argv": list(fakes.PROBE_ARGV),
            },
        },
        "now": documents.NOW_INSIDE_WINDOW,
    }
    facts.update(patch)
    return facts


def facts_with_section(section: str, **patch):
    facts = independent_facts()
    return {**facts, section: {**facts[section], **patch}}


def facts_with_repository(name: str, **patch):
    facts = independent_facts()
    repositories = {**facts["repositories"], name: {**facts["repositories"][name], **patch}}
    return {**facts, "repositories": repositories}


def facts_with_tool(name: str, **patch):
    facts = independent_facts()
    tools = {**facts["tools"], name: {**facts["tools"][name], **patch}}
    return {**facts, "tools": tools}


def grant_facts_object(**patch):
    """The same passing observation set as the exact `GrantFacts` value object."""
    return require_c8_attr(load_c8("grant"), "GrantFacts")(**independent_facts(**patch))


def decide(
    admission,
    adapters=None,
    authorization=None,
    execute_requested=True,
    facts=UNSUPPLIED,
):
    return require_c8_attr(admission, "decide")(
        authorization or documents.authorization(),
        adapters or fakes.passing_adapters(),
        facts=independent_facts() if facts is UNSUPPLIED else facts,
        execute_requested=execute_requested,
    )


def record_with_attempt(**patch):
    record = documents.synthetic_authorized_record()
    return {**record, "attempt": {**record["attempt"], **patch}}


def record_with_authorization(**patch):
    record = documents.synthetic_authorized_record()
    return {**record, "authorization": {**record["authorization"], **patch}}


def record_with_section(name: str, value: Any):
    record = documents.synthetic_authorized_record()
    return {**record, name: value}


def record_with_nested(section: str, key: str, value: Any):
    record = documents.synthetic_authorized_record()
    return {**record, section: {**record[section], key: value}}


def record_with_image(**patch):
    record = documents.synthetic_authorized_record()
    image = {**record["topology"]["image"], **patch}
    return {
        **record,
        "topology": {**record["topology"], "image": image},
    }


def record_with_probe(**patch):
    record = documents.synthetic_authorized_record()
    probe = {**record["topology"]["probe"], **patch}
    return {
        **record,
        "topology": {**record["topology"], "probe": probe},
    }


def record_with_evidence(**patch):
    record = documents.synthetic_authorized_record()
    return {**record, "evidence": {**record["evidence"], **patch}}


def record_with_artifact(**patch):
    record = documents.synthetic_authorized_record()
    artifacts = list(record["evidence"]["artifacts"])
    artifacts[0] = {**artifacts[0], **patch}
    return record_with_evidence(artifacts=artifacts)


def record_with_review(**patch):
    record = documents.synthetic_authorized_record()
    binding = {**record["evidence"]["record_review_binding"], **patch}
    return record_with_evidence(record_review_binding=binding)


def record_with_artifact_of_kind(kind: str, **patch):
    record = documents.synthetic_authorized_record()
    artifacts = [
        {**artifact, **patch} if artifact["kind"] == kind else artifact
        for artifact in record["evidence"]["artifacts"]
    ]
    return record_with_evidence(artifacts=artifacts)


def record_with_extra_artifact(artifact):
    record = documents.synthetic_authorized_record()
    return record_with_evidence(
        artifacts=[*record["evidence"]["artifacts"], artifact]
    )


class ExplodingKeys(dict):
    """A structural mapping whose inventory read fails at the trust boundary."""

    def __init__(self, error: BaseException) -> None:
        super().__init__()
        self._error = error

    def keys(self):
        raise self._error


class RaisingAuthorization:
    """The first authorization projection raises instead of returning a value."""

    def __init__(self, error: BaseException) -> None:
        self._error = error

    @property
    def record(self):
        raise self._error


class HostileMapping(dict):
    """A caller mapping whose every structural read fails at the trust boundary."""

    def __init__(self, error: BaseException, base: Any = None) -> None:
        super().__init__(base or {})
        self._error = error

    def keys(self):
        raise self._error

    def items(self):
        raise self._error

    def values(self):
        raise self._error

    def __getitem__(self, key):
        raise self._error


class CountingMapping(dict):
    """A caller mapping that records every structural read admission performs on it."""

    def __init__(self, base: Any) -> None:
        super().__init__(base)
        self.reads: list[str] = []

    def keys(self):
        self.reads.append("keys")
        return super().keys()

    def items(self):
        self.reads.append("items")
        return super().items()

    def __getitem__(self, key):
        self.reads.append(str(key))
        return super().__getitem__(key)


class CountingAuthorization:
    """An authorization that records every projection read it is asked for."""

    def __init__(self, source: Any) -> None:
        self._source = source
        self.reads: list[str] = []

    def __getattr__(self, name: str):
        self.reads.append(name)
        return getattr(self._source, name)


class DriftingAuthorization:
    """An authorization whose projections change value after their first read."""

    def __init__(self, source: Any, drift: Any) -> None:
        self._source = source
        self._drift = drift
        self._seen: set[str] = set()

    def __getattr__(self, name: str):
        if name in self._seen:
            return self._drift
        self._seen.add(name)
        return getattr(self._source, name)


class MutatingVerifier:
    """A verifier that edits the caller's live authorization while it is consulted."""

    def __init__(self, log, mutate) -> None:
        self._log = log
        self._mutate = mutate

    def verify(self, **kwargs):
        self._log.record("verifier.verify", **kwargs)
        self._mutate()
        return True


class RaisingVerifier:
    def __init__(self, error: BaseException) -> None:
        self._error = error

    def verify(self, **_kwargs):
        raise self._error


class RaisingLedger:
    def __init__(self, error: BaseException) -> None:
        self._error = error

    def is_consumed(self, **_kwargs):
        raise self._error

    def consume(self, **_kwargs):
        raise AssertionError("admission may never consume")


def test_synthetic_authorized_fixture_matches_the_committed_record_shape(admission) -> None:
    record = documents.synthetic_authorized_record()
    assert require_c8_attr(admission, "validate_record_shape")(record).satisfied
    assert set(record) == {
        "schema_version",
        "record_id",
        "recorded_at",
        "identity",
        "attempt",
        "topology",
        "production_exclusion",
        "authorization",
        "evidence",
        "disposition",
    }
    assert "record_sha256" not in record
    assert record["attempt"]["phase"] == fakes.PHASE_AUTHORIZED
    assert record["attempt"]["outcome"] == fakes.OUTCOME_NOT_RUN


def test_synthetic_authorization_binds_the_exact_artifact_paths_digests_and_bytes(
    admission,
) -> None:
    record = documents.synthetic_authorized_record()
    authorization = documents.authorization(record=record)
    artifacts = {
        artifact["kind"]: artifact for artifact in record["evidence"]["artifacts"]
    }
    grant_artifact = artifacts["grant"]
    signature_artifact = artifacts["authorization_signature"]
    record_authorization = record["authorization"]
    assert record_authorization["grant_path"] == grant_artifact["path"]
    assert record_authorization["grant_sha256"] == grant_artifact["sha256"]
    assert record_authorization["grant_sha256"] == sha256(
        authorization.grant_bytes
    ).hexdigest()
    assert record_authorization["signature_path"] == signature_artifact["path"]
    assert record_authorization["signature_sha256"] == signature_artifact["sha256"]
    assert record_authorization["signature_sha256"] == sha256(
        authorization.signature_bytes
    ).hexdigest()
    assert require_c8_attr(admission, "validate_record_shape")(record).satisfied


def test_grant_binds_the_exact_pinned_proposed_record_identity(admission) -> None:
    """The grant binds the prior proposed bytes, not an impossible self-hash.

    The authorized record contains the grant artifact and therefore cannot hash to the digest
    inside that same grant. Its record-review binding carries the exact proposed prior-state
    digest; the loader supplies the same path/digest to semantic admission.
    """
    authorization = documents.authorization()
    assert authorization.grant["record"] == {
        "path": authorization.record_path,
        "sha256": authorization.record_sha256,
    }
    assert (
        authorization.record["evidence"]["record_review_binding"][
            "reviewed_record_sha256"
        ]
        == authorization.record_sha256
    )
    adapters = fakes.passing_adapters()
    assert decide(admission, adapters, authorization).admitted is True


@pytest.mark.parametrize(
    "authorization_patch",
    [
        {"record_path": "docs/uat/wrong-proposed-record.json"},
        {"record_sha256": "0" * 64},
    ],
)
def test_loader_prior_record_identity_drift_refuses_before_signature(
    admission, authorization_patch
) -> None:
    authorization = documents.authorization(**authorization_patch)
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, authorization)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_record_review_prior_digest_drift_refuses_before_signature(admission) -> None:
    record = documents.synthetic_authorized_record()
    binding = {
        **record["evidence"]["record_review_binding"],
        "reviewed_record_sha256": "0" * 64,
    }
    record = {
        **record,
        "evidence": {**record["evidence"], "record_review_binding": binding},
    }
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(record=record))
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_record_review_phase_drift_refuses_before_signature(admission) -> None:
    record = documents.synthetic_authorized_record()
    binding = {
        **record["evidence"]["record_review_binding"],
        "reviewed_phase": "authorized",
    }
    record = {
        **record,
        "evidence": {**record["evidence"], "record_review_binding": binding},
    }
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(record=record))
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_the_record_image_is_a_resolution_stated_observation_of_the_selection(
    admission,
) -> None:
    """`topology.image` is derived from the selection, and is never the same object."""
    selected = documents.grant_document()["selected_image_identity"]
    image = documents.synthetic_authorized_record()["topology"]["image"]
    assert set(selected) == set(documents.SELECTED_IDENTITY_KEYS)
    assert "resolution_state" not in selected
    assert set(image) == {"resolution_state", *documents.SELECTED_IDENTITY_KEYS}
    assert image != selected
    assert image["resolution_state"] == fakes.IMAGE_RESOLVED
    assert {key: image[key] for key in documents.SELECTED_IDENTITY_KEYS} == selected
    assert "local_image_id" not in image
    assert require_c8_attr(admission, "validate_record_shape")(
        documents.synthetic_authorized_record()
    ).satisfied


@pytest.mark.parametrize(
    "image",
    [
        documents.grant_document()["selected_image_identity"],
        documents.selected_image_observation(resolution_state=fakes.IMAGE_UNRESOLVED),
        documents.with_fields(
            documents.selected_image_observation(),
            {"local_image_id": fakes.SYNTHETIC_HOST_IMAGE_ID},
        ),
        documents.without_field(documents.selected_image_observation(), "index_digest"),
    ],
)
def test_a_record_image_that_is_not_a_resolved_selected_observation_fails_shape(
    admission, image
) -> None:
    """A bare grant object, an unresolved selection and a host identity all fail closed."""
    record = documents.synthetic_authorized_record()
    malformed = {**record, "topology": {**record["topology"], "image": image}}
    assert not require_c8_attr(admission, "validate_record_shape")(malformed).satisfied


def test_default_without_exact_execute_request_is_hold_and_never_verifies(admission) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, execute_requested=False)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.entries == ()


def test_exact_semantics_are_checked_before_the_detached_signature(admission) -> None:
    malformed = documents.grant_document(record={"path": "wrong", "sha256": "0" * 64})
    auth = documents.authorization(grant=malformed, grant_bytes=documents.canonical_bytes(malformed))
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, auth)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert "verifier.verify" not in adapters.log.names()


def test_valid_semantics_and_signature_admit_but_do_not_consume(admission) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters)
    assert verdict.admitted is True
    assert adapters.log.count("verifier.verify") == 1
    assert adapters.log.count("ledger.is_consumed") == 1
    assert adapters.log.count("ledger.consume") == 0


def test_the_verifier_receives_the_canonical_grant_bytes_signer_and_namespace(
    admission,
) -> None:
    """The verified bytes are the canonical rendering of the very document that bound."""
    auth = documents.authorization()
    adapters = fakes.passing_adapters()
    assert decide(admission, adapters, auth).admitted is True
    call = adapters.log.calls("verifier.verify")[0]
    canonical = require_c8_attr(load_c8("grant"), "canonical_grant_bytes")(auth.grant)
    assert call["grant_bytes"] == canonical
    assert call["grant_bytes"] == auth.grant_bytes
    assert call["signature_bytes"] == auth.signature_bytes
    assert call["signer"] == fakes.SIGNER
    assert call["namespace"] == fakes.AUTHORIZATION_NAMESPACE


@pytest.mark.parametrize(
    "substituted",
    [
        # Canonical bytes of a *different* grant document.
        documents.canonical_bytes(documents.grant_document(authorizes="something_else")),
        # The same document rendered in a non-canonical encoding.
        json.dumps(documents.grant_document(), separators=(",", ":")).encode("utf-8"),
        documents.canonical_bytes(documents.grant_document())[:-1],
    ],
)
def test_grant_bytes_that_do_not_canonicalize_the_grant_refuse_before_verification(
    admission, substituted: bytes
) -> None:
    auth = documents.authorization(grant_bytes=substituted)
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, auth)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_digest_consistent_but_noncanonical_grant_bytes_still_refuse(admission) -> None:
    substituted = json.dumps(documents.grant_document(), separators=(",", ":")).encode(
        "utf-8"
    )
    substituted_sha256 = sha256(substituted).hexdigest()
    record = record_with_authorization(grant_sha256=substituted_sha256)
    artifacts = [
        {**artifact, "sha256": substituted_sha256}
        if artifact["kind"] == "grant"
        else artifact
        for artifact in record["evidence"]["artifacts"]
    ]
    record = {**record, "evidence": {**record["evidence"], "artifacts": artifacts}}
    authorization = documents.authorization(record=record, grant_bytes=substituted)
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, authorization)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


@pytest.mark.parametrize(
    ("field", "bad"),
    [
        ("signer", "IMPOSTOR"),
        ("signer", fakes.SIGNER.lower()),
        ("namespace", "cybrik-uat-topology-rehearsal-v2"),
        ("namespace", ""),
    ],
)
def test_a_signer_or_namespace_other_than_the_exact_constant_refuses(
    admission, field: str, bad: str
) -> None:
    auth = documents.authorization(record=record_with_authorization(**{field: bad}))
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, auth)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


@pytest.mark.parametrize(
    ("record_patch", "artifact_kind", "artifact_patch"),
    [
        ({"grant_path": "docs/uat/wrong-grant.json"}, None, None),
        ({"grant_sha256": "0" * 64}, None, None),
        ({"signature_path": "docs/uat/wrong-grant.sig"}, None, None),
        ({"signature_sha256": "0" * 64}, None, None),
        ({}, "grant", {"path": "docs/uat/other-grant.json"}),
        ({}, "grant", {"sha256": "1" * 64}),
        ({}, "authorization_signature", {"path": "docs/uat/other-grant.sig"}),
        ({}, "authorization_signature", {"sha256": "2" * 64}),
    ],
)
def test_record_artifact_and_authorization_binding_drift_refuses_before_signature(
    admission, record_patch, artifact_kind, artifact_patch
) -> None:
    record = record_with_authorization(**record_patch)
    if artifact_kind is not None:
        artifacts = [
            {**artifact, **artifact_patch}
            if artifact["kind"] == artifact_kind
            else artifact
            for artifact in record["evidence"]["artifacts"]
        ]
        record = {**record, "evidence": {**record["evidence"], "artifacts": artifacts}}
    adapters = fakes.passing_adapters()
    verdict = decide(
        admission,
        adapters,
        documents.authorization(record=record),
    )
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


@pytest.mark.parametrize(
    ("kind", "duplicate"),
    [
        ("grant", False),
        ("grant", True),
        ("authorization_signature", False),
        ("authorization_signature", True),
    ],
)
def test_missing_or_duplicate_authorization_artifact_refuses_before_signature(
    admission, kind: str, duplicate: bool
) -> None:
    record = documents.synthetic_authorized_record()
    artifacts = list(record["evidence"]["artifacts"])
    target = next(artifact for artifact in artifacts if artifact["kind"] == kind)
    artifacts = artifacts + [dict(target)] if duplicate else [
        artifact for artifact in artifacts if artifact["kind"] != kind
    ]
    record = {**record, "evidence": {**record["evidence"], "artifacts": artifacts}}
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(record=record))
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


@pytest.mark.parametrize(
    "record_patch",
    [
        {"phase": "proposed"},
        {"execution_authorized": False},
        {"attempt_consumed": True},
        {"attempt_ordinal": 2},
        {"max_attempts": 2},
        {"outcome": fakes.TOPOLOGY_PASS},
    ],
)
def test_record_state_drift_refuses_before_any_mutation(admission, record_patch) -> None:
    auth = documents.authorization(record=record_with_attempt(**record_patch))
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, auth)
    assert not verdict.admitted
    assert adapters.log.count("ledger.consume") == 0


@pytest.mark.parametrize("signature_verdict", (False, None))
def test_absent_or_invalid_signature_refuses(admission, signature_verdict) -> None:
    adapters = fakes.passing_adapters(verdict=signature_verdict)
    verdict = decide(admission, adapters)
    assert not verdict.admitted
    assert verdict.outcome == fakes.PRECHECK_ABORT


def test_an_already_consumed_attempt_refuses(admission) -> None:
    adapters = fakes.passing_adapters(consumed=(fakes.RECORD_ID,))
    verdict = decide(admission, adapters)
    assert not verdict.admitted
    assert adapters.log.count("ledger.consume") == 0


@pytest.mark.parametrize(
    ("type_name", "args"),
    [
        ("RecordShapeVerdict", (1, ())),
        ("RecordShapeVerdict", (True, ["mutable"])),
        ("RecordShapeVerdict", (True, ("contradiction",))),
        ("RecordShapeVerdict", (False, ())),
        ("AdmissionDecision", (True, fakes.PRECHECK_ABORT, ())),
        ("AdmissionDecision", (False, fakes.PRECHECK_ABORT, ())),
    ],
)
def test_admission_value_objects_refuse_incoherent_states(
    admission, type_name: str, args: tuple[Any, ...]
) -> None:
    with pytest.raises(ValueError):
        require_c8_attr(admission, type_name)(*args)


@pytest.mark.parametrize(
    "record",
    [
        None,
        ExplodingKeys(RuntimeError("untrusted detail")),
        {**documents.synthetic_authorized_record(), 7: "non-string key"},
        record_with_section("schema_version", "2.0.0"),
        record_with_section("record_id", "another-record"),
        record_with_section("recorded_at", "not-an-instant"),
        record_with_section("identity", None),
        record_with_section("attempt", None),
        record_with_section("topology", None),
        record_with_section("production_exclusion", None),
        record_with_section("authorization", None),
        record_with_section("evidence", None),
        record_with_section("disposition", None),
        record_with_image(
            repository="",
            tag="",
            platform={"os": "", "architecture": "arm64", "variant": 7},
            index_digest="bad",
            manifest_digest="bad",
            pull_policy="",
        ),
        record_with_probe(argv="not-an-argv"),
        record_with_probe(argv=["--wrong"]),
        record_with_authorization(grant_sha256="bad"),
        record_with_evidence(artifacts="not-an-array"),
        record_with_evidence(artifacts=[None]),
        record_with_artifact(kind="", path="", sha256="bad"),
        record_with_evidence(
            directory="wrong",
            external_bytes_ci_verified=True,
            result_controls={},
        ),
        record_with_review(review_path="", review_sha256="bad"),
        record_with_nested("disposition", "profile", "PASS"),
        record_with_nested("disposition", "rationale", ""),
    ],
)
def test_record_shape_is_total_and_fail_closed_for_malformed_nested_values(
    admission, record
) -> None:
    verdict = require_c8_attr(admission, "validate_record_shape")(record)
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize("interrupt", [KeyboardInterrupt, SystemExit])
def test_record_shape_never_reclassifies_a_process_interrupt(admission, interrupt) -> None:
    with pytest.raises(interrupt):
        require_c8_attr(admission, "validate_record_shape")(ExplodingKeys(interrupt()))


def test_an_authorization_projection_exception_is_bounded_before_adapter_use(
    admission,
) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(
        admission,
        adapters,
        RaisingAuthorization(RuntimeError("untrusted detail must not leak")),
    )
    assert verdict.admitted is False
    assert adapters.log.entries == ()
    assert all("untrusted detail" not in finding for finding in verdict.findings)


@pytest.mark.parametrize("interrupt", [KeyboardInterrupt, SystemExit])
def test_authorization_projection_preserves_process_interrupts(admission, interrupt) -> None:
    with pytest.raises(interrupt):
        decide(admission, fakes.passing_adapters(), RaisingAuthorization(interrupt()))


def test_verifier_exception_is_bounded_and_never_reaches_the_ledger(admission) -> None:
    adapters = fakes.passing_adapters()
    adapters = replace(adapters, verifier=RaisingVerifier(RuntimeError("private detail")))
    verdict = decide(admission, adapters)
    assert verdict.admitted is False
    assert adapters.log.count("ledger.is_consumed") == 0
    assert all("private detail" not in finding for finding in verdict.findings)


def test_ledger_exception_is_bounded_after_one_valid_signature(admission) -> None:
    adapters = fakes.passing_adapters()
    adapters = replace(adapters, ledger=RaisingLedger(RuntimeError("private detail")))
    verdict = decide(admission, adapters)
    assert verdict.admitted is False
    assert adapters.log.count("verifier.verify") == 1
    assert all("private detail" not in finding for finding in verdict.findings)


def test_the_independent_fact_inventory_is_exactly_the_grant_facts_fields() -> None:
    """The set a caller must supply is the set the grant binding mandates, field for field."""
    grant_facts = require_c8_attr(load_c8("grant"), "GrantFacts")
    assert tuple(field.name for field in dataclass_fields(grant_facts)) == (
        INDEPENDENT_FACT_KEYS
    )
    assert set(independent_facts()) == set(INDEPENDENT_FACT_KEYS)


def test_caller_supplied_independent_facts_admit_the_reviewed_authorization(
    admission,
) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, facts=independent_facts())
    assert verdict.admitted is True
    assert adapters.log.count("verifier.verify") == 1
    assert adapters.log.count("ledger.is_consumed") == 1
    assert adapters.log.count("ledger.consume") == 0


def test_an_exact_grant_facts_value_object_is_accepted_as_the_observation_set(
    admission,
) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, facts=grant_facts_object())
    assert verdict.admitted is True
    assert adapters.log.count("verifier.verify") == 1


def test_admission_verifies_the_caller_facts_and_never_facts_taken_from_the_grant(
    admission, monkeypatch
) -> None:
    """The facts handed to the binding verifier are the caller's, value for value.

    Admission observes nothing, so every fact it verifies a grant against must have been
    observed elsewhere. Facts derived inside admission from the grant or the record would
    make the grant its own witness: the document would be compared against itself and pass
    whatever it happened to say. Here the supplied facts deliberately disagree with the
    grant, and the verifier must still receive exactly what the caller supplied.
    """
    grant_module = load_c8("grant")
    grant_facts = require_c8_attr(grant_module, "GrantFacts")
    verdict_type = require_c8_attr(grant_module, "GrantVerdict")
    seen: list[tuple[Any, Any]] = []

    def spy(document, facts):
        seen.append((document, facts))
        return verdict_type(True)

    monkeypatch.setattr(admission, "verify_bindings", spy)
    supplied = independent_facts(
        record_path="docs/uat/independently-observed-record.json",
        record_sha256=OTHER_DIGEST,
        runner_aggregate_sha256=OTHER_DIGEST,
        now=documents.NOW_AFTER_EXPIRES_AT,
    )
    authorization = documents.authorization()
    assert decide(admission, None, authorization, facts=supplied).admitted is True

    document, observed = seen[0]
    assert isinstance(observed, grant_facts)
    assert observed.record_path == "docs/uat/independently-observed-record.json"
    assert observed.record_sha256 == OTHER_DIGEST
    assert observed.runner_aggregate_sha256 == OTHER_DIGEST
    assert observed.now == documents.NOW_AFTER_EXPIRES_AT
    assert observed.runner_aggregate_sha256 != authorization.grant["runner"][
        "aggregate_sha256"
    ]
    assert dict(observed.tools["docker"]) == supplied["tools"]["docker"]
    assert dict(observed.repositories) == supplied["repositories"]
    assert document is not authorization.grant


def test_the_facts_are_deep_copied_at_ingress_so_a_later_edit_cannot_reach_them(
    admission, monkeypatch
) -> None:
    """Ingress takes a dead copy: the caller keeps no live handle on what was verified."""
    grant_module = load_c8("grant")
    verdict_type = require_c8_attr(grant_module, "GrantVerdict")
    seen: list[Any] = []

    def spy(document, facts):
        seen.append(facts)
        return verdict_type(True)

    monkeypatch.setattr(admission, "verify_bindings", spy)
    supplied = independent_facts()
    assert decide(admission, facts=supplied).admitted is True
    observed = seen[0]

    assert observed.tools is not supplied["tools"]
    assert type(observed.tools) is MappingProxyType
    with pytest.raises(TypeError):
        observed.tools["docker"] = {}
    supplied["tools"]["docker"]["sha256"] = OTHER_DIGEST
    supplied["repositories"][fakes.SUITE_CONTROL]["clean"] = False
    supplied["observed_image_identity"]["local_image_id"] = OTHER_IMAGE_ID
    assert observed.tools["docker"]["sha256"] == fakes.SYNTHETIC_DOCKER_SHA256
    assert observed.repositories[fakes.SUITE_CONTROL]["clean"] is True
    assert (
        observed.observed_image_identity["local_image_id"]
        == fakes.SYNTHETIC_HOST_IMAGE_ID
    )


def test_a_caller_mapping_mutated_after_ingress_cannot_change_the_decision(
    admission,
) -> None:
    """Every input is copied dead before the first injected call, so a mid-decision edit
    of the caller's own mappings decides nothing: the ledger is still asked about the
    record admission actually read.
    """
    record = documents.synthetic_authorized_record()
    grant = documents.grant_document()
    facts = independent_facts()
    authorization = documents.authorization(record=record, grant=grant)
    adapters = fakes.passing_adapters()

    def mutate() -> None:
        record["record_id"] = "another-record"
        record["attempt"]["attempt_consumed"] = True
        record["evidence"]["record_review_binding"]["reviewed_phase"] = "authorized"
        grant["authorizes"] = "something_else"
        facts["runner_aggregate_sha256"] = OTHER_DIGEST
        facts["repositories"][fakes.SUITE_CONTROL]["clean"] = False

    adapters = replace(adapters, verifier=MutatingVerifier(adapters.log, mutate))
    verdict = decide(admission, adapters, authorization, facts=facts)
    assert verdict.admitted is True
    assert adapters.log.calls("ledger.is_consumed")[0]["record_id"] == fakes.RECORD_ID
    assert adapters.log.count("ledger.consume") == 0


def test_every_authorization_projection_is_read_exactly_once(admission) -> None:
    """Admission reads the exact projection inventory it needs, once each, and no more.

    A projection read twice could return two different values, and a projection admission
    has no use for — the control commits preparation observes for itself — is authority it
    should never be holding.
    """
    authorization = CountingAuthorization(documents.authorization())
    verdict = decide(admission, authorization=authorization)
    assert verdict.admitted is True
    assert sorted(authorization.reads) == [
        "grant",
        "grant_bytes",
        "record",
        "record_path",
        "record_sha256",
        "signature_bytes",
    ]


def test_a_projection_that_drifts_between_reads_cannot_change_the_decision(
    admission,
) -> None:
    authorization = DriftingAuthorization(documents.authorization(), "drifted")
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, authorization)
    assert verdict.admitted is True
    assert adapters.log.count("verifier.verify") == 1


def test_the_caller_facts_mapping_is_read_once_and_never_again(admission) -> None:
    facts = CountingMapping(independent_facts())
    adapters = fakes.passing_adapters()
    assert decide(admission, adapters, facts=facts).admitted is True
    assert facts.reads == ["items"]


def test_missing_independent_facts_refuse_before_the_verifier_and_the_ledger(
    admission,
) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, facts=None)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.entries == ()


@pytest.mark.parametrize(
    "facts",
    [
        pytest.param([], id="not-a-mapping"),
        pytest.param("facts", id="a-string"),
        pytest.param(7, id="a-number"),
        pytest.param(
            SimpleNamespace(**independent_facts()), id="an-attribute-bearing-object"
        ),
        pytest.param(
            {key: value for key, value in independent_facts().items() if key != "now"},
            id="missing-a-fact",
        ),
        pytest.param(
            {**independent_facts(), "observed_at": fakes.IMAGE_OBSERVED_AT},
            id="an-unreviewed-extra-fact",
        ),
        pytest.param({**independent_facts(), 7: "non-string key"}, id="non-string-key"),
        pytest.param(
            independent_facts(topology="127.0.0.1:15433"), id="a-scalar-for-a-section"
        ),
        pytest.param(independent_facts(now=None), id="an-unobserved-moment"),
    ],
)
def test_facts_that_are_not_the_exact_observation_set_refuse_before_any_adapter(
    admission, facts
) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, facts=facts)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.entries == ()


def test_a_hostile_facts_mapping_refuses_without_quoting_its_own_cause(admission) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(
        admission, adapters, facts=HostileMapping(RuntimeError("untrusted detail"))
    )
    assert verdict.admitted is False
    assert adapters.log.entries == ()
    assert all("untrusted detail" not in finding for finding in verdict.findings)


@pytest.mark.parametrize("interrupt", [KeyboardInterrupt, SystemExit])
def test_the_facts_ingress_copy_never_reclassifies_a_process_interrupt(
    admission, interrupt
) -> None:
    with pytest.raises(interrupt):
        decide(admission, facts=HostileMapping(interrupt()))


@pytest.mark.parametrize(
    "facts",
    [
        pytest.param(
            independent_facts(record_path="docs/uat/other-record.json"), id="record-path"
        ),
        pytest.param(independent_facts(record_sha256=OTHER_DIGEST), id="record-digest"),
        pytest.param(
            independent_facts(runner_aggregate_sha256=OTHER_DIGEST), id="runner-aggregate"
        ),
        pytest.param(facts_with_section("topology", host_port=15434), id="host-port"),
        pytest.param(
            facts_with_section("topology", internal_network=False), id="isolation"
        ),
        pytest.param(
            facts_with_section(
                "selected_image_identity",
                index_digest=fakes.SYNTHETIC_OTHER_INDEX_DIGEST,
            ),
            id="selected-index-digest",
        ),
        pytest.param(
            facts_with_section(
                "selected_image_identity", platform=dict(fakes.OTHER_IMAGE_PLATFORM)
            ),
            id="selected-platform",
        ),
        pytest.param(
            facts_with_section(
                "observed_image_identity",
                manifest_digest=fakes.SYNTHETIC_OTHER_MANIFEST_DIGEST,
            ),
            id="observed-manifest-digest",
        ),
        pytest.param(
            facts_with_section("observed_image_identity", local_image_id=OTHER_IMAGE_ID),
            id="observed-host-image",
        ),
        pytest.param(
            facts_with_section(
                "observed_image_identity", observed_at=documents.NOW_AFTER_EXPIRES_AT
            ),
            id="observation-outside-the-window",
        ),
        pytest.param(
            facts_with_repository(fakes.SUITE_CONTROL, commit=OTHER_OBJECT_ID),
            id="control-commit",
        ),
        pytest.param(
            facts_with_repository(fakes.SOC_CONTROL, tree=OTHER_OBJECT_ID),
            id="control-tree",
        ),
        pytest.param(
            facts_with_repository(fakes.AI_CONTROL, clean=False), id="dirty-worktree"
        ),
        pytest.param(facts_with_tool("docker", sha256=OTHER_DIGEST), id="docker-digest"),
        pytest.param(facts_with_tool("docker", version="0.0.0"), id="docker-version"),
        pytest.param(
            facts_with_tool("probe", argv=["-z", fakes.HOST_IP]), id="probe-argv"
        ),
        pytest.param(
            independent_facts(now=documents.NOW_AFTER_EXPIRES_AT), id="after-expiry"
        ),
        pytest.param(
            independent_facts(now=documents.NOW_AT_EXPIRES_AT), id="at-expiry"
        ),
        pytest.param(
            independent_facts(now=documents.NOW_BEFORE_NOT_BEFORE), id="before-opening"
        ),
        pytest.param(independent_facts(now="not-an-instant"), id="unreadable-moment"),
    ],
)
def test_facts_that_drift_from_the_grant_refuse_before_signature_and_ledger(
    admission, facts
) -> None:
    """Every runner, image, repository, tool and window binding can fail on its own."""
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, facts=facts)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0
    assert adapters.log.count("ledger.is_consumed") == 0


def test_an_attempt_beginning_exactly_at_the_opening_instant_is_inside_the_window(
    admission,
) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(
        admission, adapters, facts=independent_facts(now=documents.NOW_AT_NOT_BEFORE)
    )
    assert verdict.admitted is True


def test_no_facts_authorization_or_adapter_is_touched_without_the_exact_execute_request(
    admission,
) -> None:
    facts = CountingMapping(independent_facts())
    authorization = CountingAuthorization(documents.authorization())
    adapters = fakes.passing_adapters()
    verdict = decide(
        admission, adapters, authorization, execute_requested=False, facts=facts
    )
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert facts.reads == []
    assert authorization.reads == []
    assert adapters.log.entries == ()


class ScalarString(str):
    """A `str` subclass: equal to a reviewed string, but not provably a dead value."""


@pytest.mark.parametrize(
    "facts",
    [
        pytest.param(
            independent_facts(record_path=ScalarString(fakes.RECORD_PATH)),
            id="a-scalar-subclass-fact",
        ),
        pytest.param(
            facts_with_tool("probe", path=ScalarString(fakes.PROBE_EXECUTABLE_PATH)),
            id="a-scalar-subclass-inside-a-section",
        ),
    ],
)
def test_a_scalar_subclass_in_the_facts_refuses_before_the_verifier_and_ledger(
    admission, facts
) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, facts=facts)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.entries == ()


class ScalarBytes(bytes):
    """A `bytes` subclass standing where exact signed bytes are required."""


@pytest.mark.parametrize(
    "patch",
    [
        pytest.param(
            {"record": record_with_section("record_id", ScalarString(fakes.RECORD_ID))},
            id="record-scalar-subclass",
        ),
        pytest.param(
            {
                "grant": documents.grant_document(
                    authorizes=ScalarString("topology_rehearsal_single_attempt")
                )
            },
            id="grant-scalar-subclass",
        ),
        pytest.param(
            {"grant_bytes": ScalarBytes(documents.DEFAULT_GRANT_BYTES)},
            id="grant-bytes-scalar-subclass",
        ),
        pytest.param(
            {"signature_bytes": ScalarBytes(documents.SIGNATURE_BYTES)},
            id="signature-bytes-scalar-subclass",
        ),
        pytest.param(
            {"record_path": ScalarString(fakes.RECORD_PATH)},
            id="loader-path-scalar-subclass",
        ),
    ],
)
def test_a_scalar_subclass_in_the_authorization_refuses_before_verifier_and_ledger(
    admission, patch
) -> None:
    """An equal-but-not-exact scalar keeps a live handle on state nobody proved dead."""
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(**patch))
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.entries == ()


@pytest.mark.parametrize(
    "record",
    [
        pytest.param(
            record_with_review(review_path=f"{fakes.RECORD_DIR}/other_review.synthetic"),
            id="binding-path-drift",
        ),
        pytest.param(
            record_with_review(review_sha256=OTHER_REVIEW_SHA256),
            id="binding-digest-drift",
        ),
        pytest.param(
            record_with_artifact_of_kind(
                "record_review", path=f"{fakes.RECORD_DIR}/other_review.synthetic"
            ),
            id="artifact-path-drift",
        ),
        pytest.param(
            record_with_artifact_of_kind("record_review", sha256=OTHER_REVIEW_SHA256),
            id="artifact-digest-drift",
        ),
    ],
)
def test_a_record_review_binding_that_drifts_from_its_artifact_refuses(
    admission, record
) -> None:
    """The reviewed bytes are named once: the binding and its artifact are the same file."""
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(record=record))
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_the_reviewed_record_names_exactly_the_required_artifact_inventory(
    admission,
) -> None:
    kinds = tuple(
        artifact["kind"]
        for artifact in documents.synthetic_authorized_record()["evidence"]["artifacts"]
    )
    assert sorted(kinds) == sorted(require_c8_attr(admission, "REQUIRED_ARTIFACT_KINDS"))


@pytest.mark.parametrize(
    "extra",
    [
        pytest.param(
            {
                "kind": "unreviewed_extra",
                "path": f"{fakes.RECORD_DIR}/extra.synthetic",
                "sha256": "e" * 64,
            },
            id="an-unknown-kind",
        ),
        pytest.param(
            {
                "kind": "record_review_v2",
                "path": f"{fakes.RECORD_DIR}/record_review_v2.synthetic",
                "sha256": "f" * 64,
            },
            id="a-near-miss-kind",
        ),
    ],
)
def test_an_artifact_kind_outside_the_reviewed_inventory_fails_shape_and_refuses(
    admission, extra
) -> None:
    record = record_with_extra_artifact(extra)
    assert not require_c8_attr(admission, "validate_record_shape")(record).satisfied
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(record=record))
    assert verdict.admitted is False
    assert adapters.log.count("verifier.verify") == 0


def test_admission_exports_only_decision_and_gate(admission) -> None:
    assert set(require_c8_attr(admission, "__all__")) == {
        "AdmissionDecision",
        "RecordShapeVerdict",
        "decide",
        "validate_record_shape",
    }
