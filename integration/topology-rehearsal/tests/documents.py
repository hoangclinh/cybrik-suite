"""Synthetic grant, record and authorization documents for C7 only."""

from __future__ import annotations

import json
from hashlib import sha256
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from typing import Any

import fakes

GRANT_KEYS = (
    "schema", "record", "runner", "topology", "selected_image_identity",
    "observed_image_identity", "repositories", "tools", "window", "attempt",
    "authorizes", "grants_no_authority",
)
GRANT_NO_AUTHORITY = {
    "demo": True, "merge": True, "product_runtime": True,
    "production": True, "release": True, "uat": True,
}
RECORD_PRODUCTION_EXCLUSION = {
    "no_production_credentials": True,
    "no_production_configuration": True,
    "no_production_data": True,
    "no_production_traffic": True,
}

# The grant's `selected_image_identity` is the *required registry selection*. The record's
# `topology.image` is a different object: a selected image observation, which carries the
# same identity fields plus the `resolution_state` that says whether the selection is pinned
# yet. The two are derived from one another and must never be asserted equal — a record that
# is byte-equal to the grant object would carry no resolution state, and a grant that carried
# one would drift from its own pinned schema.
SELECTED_IDENTITY_KEYS = (
    "repository",
    "tag",
    "platform",
    "index_digest",
    "manifest_digest",
    "pull_policy",
)

NOT_BEFORE = "2026-08-05T00:00:00Z"
EXPIRES_AT = "2026-08-05T00:03:00Z"
# Inside the grant window, after the host image observation, before expiry.
RECORDED_AT = "2026-08-05T00:00:30Z"
NOW_INSIDE_WINDOW = "2026-08-05T00:01:00Z"
NOW_BEFORE_NOT_BEFORE = "2026-08-04T23:59:59Z"
NOW_AFTER_EXPIRES_AT = "2026-08-05T00:03:01Z"
# The two exact boundaries. The window is a closed-open interval: an attempt starting exactly
# at `not_before` is inside it, and one starting exactly at `expires_at` is over. Stating only
# the one-second-outside cases would leave both boundaries free to drift by a second.
NOW_AT_NOT_BEFORE = NOT_BEFORE
NOW_AT_EXPIRES_AT = EXPIRES_AT


def grant_document(**overrides: Any) -> dict[str, Any]:
    document = {
        "schema": fakes.GRANT_SCHEMA,
        "record": {"path": fakes.RECORD_PATH, "sha256": fakes.SYNTHETIC_RECORD_SHA256},
        "runner": {"aggregate_sha256": fakes.SYNTHETIC_RUNNER_AGGREGATE_SHA256},
        "topology": {
            "host_ip": fakes.HOST_IP, "host_port": fakes.HOST_PORT,
            "container_port": fakes.CONTAINER_PORT, "protocol": fakes.PORT_PROTOCOL,
            "internal_network": True, "publish_spec": fakes.PUBLISH_SPEC,
        },
        "selected_image_identity": {
            "repository": fakes.IMAGE_REPOSITORY, "tag": fakes.IMAGE_TAG,
            "platform": dict(fakes.IMAGE_PLATFORM),
            "index_digest": fakes.SYNTHETIC_INDEX_DIGEST,
            "manifest_digest": fakes.SYNTHETIC_MANIFEST_DIGEST,
            "pull_policy": fakes.PULL_POLICY,
        },
        "observed_image_identity": {
            "repository": fakes.IMAGE_REPOSITORY, "tag": fakes.IMAGE_TAG,
            "platform": dict(fakes.IMAGE_PLATFORM),
            "index_digest": fakes.SYNTHETIC_INDEX_DIGEST,
            "manifest_digest": fakes.SYNTHETIC_MANIFEST_DIGEST,
            "local_image_id": fakes.SYNTHETIC_HOST_IMAGE_ID,
            "observed_at": fakes.IMAGE_OBSERVED_AT,
        },
        "repositories": {
            name: {
                "commit": commit,
                "tree": fakes.EXPECTED_TREES[name],
                "clean": True,
            }
            for name, commit in fakes.EXPECTED_CONTROLS.items()
        },
        "tools": {
            "docker": {"path": fakes.DOCKER_EXECUTABLE_PATH, "sha256": fakes.SYNTHETIC_DOCKER_SHA256, "version": "29.6.2"},
            "probe": {"path": fakes.PROBE_EXECUTABLE_PATH, "sha256": fakes.PROBE_EXECUTABLE_SHA256, "argv": list(fakes.PROBE_ARGV)},
        },
        "window": {
            "not_before": NOT_BEFORE, "expires_at": EXPIRES_AT,
            "runtime_limit_seconds": fakes.RUNTIME_LIMIT_SECONDS, "extension_cycles": fakes.EXTENSION_CYCLES,
        },
        "attempt": {"ordinal": fakes.ATTEMPT_ORDINAL, "max_attempts": fakes.MAX_ATTEMPTS},
        "authorizes": "topology_rehearsal_single_attempt",
        "grants_no_authority": dict(GRANT_NO_AUTHORITY),
    }
    document.update(overrides)
    return document


def with_fields(value: Mapping[str, Any], patch: Mapping[str, Any]) -> dict[str, Any]:
    return {**value, **patch}


def without_field(value: Mapping[str, Any], key: str) -> dict[str, Any]:
    return {name: item for name, item in value.items() if name != key}


def with_key_order(value: Mapping[str, Any], keys: Sequence[str]) -> dict[str, Any]:
    return {key: value[key] for key in keys}


def with_nested(value: Mapping[str, Any], key: str, patch: Mapping[str, Any]) -> dict[str, Any]:
    return {**value, key: {**value[key], **patch}}


def canonical_bytes(value: Mapping[str, Any]) -> bytes:
    return (json.dumps(value, indent=2) + "\n").encode("utf-8")


SIGNATURE_BYTES = b"-----BEGIN SSH SIGNATURE-----\nfake-detached-signature\n-----END SSH SIGNATURE-----\n"
DEFAULT_GRANT_BYTES = canonical_bytes(grant_document())
DEFAULT_GRANT_SHA256 = sha256(DEFAULT_GRANT_BYTES).hexdigest()
SIGNATURE_SHA256 = sha256(SIGNATURE_BYTES).hexdigest()


def selected_image_observation(
    selected: Mapping[str, Any] | None = None,
    *,
    resolution_state: str = fakes.IMAGE_RESOLVED,
) -> dict[str, Any]:
    """The record's `topology.image`, derived from a grant's selected identity.

    The observation is the identity plus its resolution state, and nothing else: it never
    carries `local_image_id`, which belongs to the separate observed host identity.
    """
    identity = dict(selected if selected is not None else grant_document()["selected_image_identity"])
    return {"resolution_state": resolution_state, **identity}


def synthetic_authorized_record(**overrides: Any) -> dict[str, Any]:
    document = {
        "schema_version": "1.0.0", "record_id": fakes.RECORD_ID,
        "recorded_at": RECORDED_AT,
        "identity": {"capability_id": fakes.CAPABILITY_ID, "objective_id": fakes.OBJECTIVE_ID},
        "attempt": {
            "series_id": fakes.SERIES_ID, "attempt_ordinal": fakes.ATTEMPT_ORDINAL,
            "max_attempts": fakes.MAX_ATTEMPTS, "phase": fakes.PHASE_AUTHORIZED,
            "execution_authorized": True, "attempt_consumed": False,
            "outcome": fakes.OUTCOME_NOT_RUN,
        },
        "topology": {
            "host_ip": fakes.HOST_IP, "host_port": fakes.HOST_PORT,
            "container_port": fakes.CONTAINER_PORT, "internal_network": True,
            "runtime_limit_seconds": fakes.RUNTIME_LIMIT_SECONDS,
            "extension_cycles": fakes.EXTENSION_CYCLES,
            "image": selected_image_observation(),
            "probe": {"executable_path": fakes.PROBE_EXECUTABLE_PATH, "executable_sha256": fakes.PROBE_EXECUTABLE_SHA256, "argv": list(fakes.PROBE_ARGV)},
        },
        "production_exclusion": dict(RECORD_PRODUCTION_EXCLUSION),
        "authorization": {
            "signer": fakes.SIGNER, "namespace": fakes.AUTHORIZATION_NAMESPACE,
            "grant_path": fakes.GRANT_PATH,
            "grant_sha256": DEFAULT_GRANT_SHA256,
            "signature_path": f"{fakes.GRANT_PATH}.sig",
            "signature_sha256": SIGNATURE_SHA256,
            "allowed_signers_path": "docs/uat/topology-rehearsal-allowed-signers",
            "allowed_signers_sha256": "8" * 64,
            "trust_path": "docs/uat/topology-rehearsal-authorization-trust.json",
        },
        "evidence": {
            "directory": fakes.RECORD_DIR, "external_bytes_ci_verified": False,
            "artifacts": [
                {"kind": "diagnosis", "path": f"{fakes.RECORD_DIR}/diagnosis.synthetic", "sha256": "a" * 64},
                {"kind": "diagnosis_review", "path": f"{fakes.RECORD_DIR}/diagnosis_review.synthetic", "sha256": "b" * 64},
                {"kind": "record_review", "path": f"{fakes.RECORD_DIR}/record_review.synthetic", "sha256": "c" * 64},
                {"kind": "grant", "path": fakes.GRANT_PATH, "sha256": DEFAULT_GRANT_SHA256},
                {
                    "kind": "authorization_signature",
                    "path": f"{fakes.GRANT_PATH}.sig",
                    "sha256": SIGNATURE_SHA256,
                },
            ],
            "record_review_binding": {
                "review_path": f"{fakes.RECORD_DIR}/record_review.synthetic",
                "review_sha256": "c" * 64, "reviewed_phase": "proposed",
                "reviewed_record_sha256": fakes.SYNTHETIC_RECORD_SHA256,
            },
            "result_controls": None,
        },
        "disposition": {"profile": "HOLD", "rationale": "Synthetic authorized-shape fixture; grants no real authority."},
    }
    document.update(overrides)
    return document


@dataclass(frozen=True)
class Authorization:
    record: Mapping[str, Any] = field(default_factory=synthetic_authorized_record)
    grant: Mapping[str, Any] = field(default_factory=grant_document)
    grant_bytes: bytes = DEFAULT_GRANT_BYTES
    signature_bytes: bytes = SIGNATURE_BYTES
    record_path: str = fakes.RECORD_PATH
    record_sha256: str = fakes.SYNTHETIC_RECORD_SHA256
    # Two further loader observations, taken at exactly the boundary that already supplies
    # `record_path` and `record_sha256`: the entrypoint digests the runner source it is about
    # to execute, and reads one exact UTC instant. Neither is derived from the grant, because
    # a fact copied out of the document it is meant to check proves only that copying works.
    runner_aggregate_sha256: str = fakes.SYNTHETIC_RUNNER_AGGREGATE_SHA256
    observed_at: str = NOW_INSIDE_WINDOW
    expected_controls: Mapping[str, str] = field(default_factory=lambda: dict(fakes.EXPECTED_CONTROLS))


def authorization(**overrides: Any) -> Authorization:
    base = Authorization()
    return replace(base, **overrides) if overrides else base
