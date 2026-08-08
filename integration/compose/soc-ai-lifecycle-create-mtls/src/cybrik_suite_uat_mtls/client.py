"""Separate-process SOC lifecycle-create driver for D2 N1-N10.

Status: ``AUTHORED — NOT RUN``. Product imports and network I/O occur only
after the harness has validated the committed Phase A authorization.
"""

from __future__ import annotations

import asyncio
import dataclasses
import hashlib
import json
import os
import re
import ssl
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from . import evidence
from .pki import certificate_thumbprint_sha256

TENANT_ID: Final = uuid.UUID("11111111-2222-4333-8444-555555555555")
OTHER_TENANT_ID: Final = uuid.UUID("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
USER_ID: Final = uuid.UUID("22222222-3333-4444-8555-666666666666")
MEMBERSHIP_ID: Final = uuid.UUID("33333333-4444-4555-8666-777777777777")
WORKLOAD_ID: Final = "spiffe://soc.internal.cybrik/workload/investigation-api"
ISSUER_ID: Final = "spiffe://soc.internal.cybrik/mint/downstream"
KEY_ID: Final = "soc-lifecycle-d2-ephemeral"
ORG_ID: Final = "org-d2-synthetic"
ORG_PATH: Final = "org:d2/soc/tier2"
_SAFE_FAILURE_CODES: Final = {
    "lifecycle create was rejected by the relying party": "relying_party_refusal",
    "lifecycle create transport timed out": "transport_timeout",
    "lifecycle create transport failed": "transport_failure",
}
_JWT_LIKE: Final = re.compile(
    r"(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{5,}\."
    r"[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])"
)


class ClientBoundaryError(RuntimeError):
    """A D2 case could not complete inside its secret-safe boundary."""


def _write_atomic_evidence(destination: Path, record: object) -> None:
    temporary = destination.with_suffix(".tmp")
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except OSError as exc:
        raise ClientBoundaryError(
            "atomic evidence temporary path is unavailable"
        ) from exc
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(json.dumps(record, sort_keys=True, separators=(",", ":")))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


@dataclass(frozen=True, slots=True)
class CasePlan:
    case_id: str
    token_mutation: str
    expect_accept_count: int
    expect_reject_count: int
    required_rejection_code: str | None


@dataclass(frozen=True, slots=True)
class _Principal:
    user_id: uuid.UUID = USER_ID
    tenant_id: uuid.UUID = TENANT_ID
    membership_id: uuid.UUID | None = MEMBERSHIP_ID
    identity_id: uuid.UUID | None = None


def run_n1() -> CasePlan:
    return CasePlan(
        "N1",
        "replay_exact_token",
        1,
        1,
        required_rejection_code="relying_party_refusal",
    )


def run_n2() -> CasePlan:
    return CasePlan(
        "N2", "alternate_cnf", 0, 1, required_rejection_code="relying_party_refusal"
    )


def run_n3() -> CasePlan:
    return CasePlan(
        "N3", "wrong_audience", 0, 1, required_rejection_code="relying_party_refusal"
    )


def run_n4() -> CasePlan:
    return CasePlan(
        "N4", "wrong_scope", 0, 1, required_rejection_code="relying_party_refusal"
    )


def run_n5() -> CasePlan:
    return CasePlan(
        "N5", "wrong_operation", 0, 1, required_rejection_code="relying_party_refusal"
    )


def run_n6() -> CasePlan:
    return CasePlan(
        "N6", "cross_tenant", 0, 1, required_rejection_code="relying_party_refusal"
    )


def run_n7() -> CasePlan:
    return CasePlan(
        "N7", "org_mismatch", 0, 1, required_rejection_code="relying_party_refusal"
    )


def run_n8() -> CasePlan:
    return CasePlan(
        "N8",
        "missing_tls_extension",
        0,
        1,
        required_rejection_code="relying_party_refusal",
    )


def run_n9() -> CasePlan:
    return CasePlan(
        "N9",
        "postgres_unavailable",
        0,
        1,
        required_rejection_code="relying_party_refusal",
    )


def run_n10() -> CasePlan:
    return CasePlan("N10", "secret_sweep", 0, 0, required_rejection_code=None)


CASE_PLANS: Final = (
    run_n1(),
    run_n2(),
    run_n3(),
    run_n4(),
    run_n5(),
    run_n6(),
    run_n7(),
    run_n8(),
    run_n9(),
    run_n10(),
)


class _PemEs256Signer:
    def __init__(self, private_key_path: Path) -> None:
        from cryptography.hazmat.primitives import serialization

        self._key = serialization.load_pem_private_key(
            private_key_path.read_bytes(), password=None
        )

    @property
    def kid(self) -> str:
        return KEY_ID

    @property
    def algorithm(self) -> str:
        return "ES256"

    def sign(self, signing_input: bytes) -> bytes:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

        der = self._key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
        r, s = decode_dss_signature(der)
        return r.to_bytes(32, "big") + s.to_bytes(32, "big")


class _CaseIssuer:
    def __init__(
        self, *, signer: object, plan: CasePlan, primary_cnf: str, alternate_cnf: str
    ) -> None:
        self._signer = signer
        self._plan = plan
        self._primary_cnf = primary_cnf
        self._alternate_cnf = alternate_cnf
        self._cached: object | None = None

    def mint(self, mint_input: object, *, now: object | None = None) -> object:
        from cybrik_soc.platform.svc_delegation import (
            Actor,
            AsymmetricJwtDelegationIssuer,
            CertBinding,
            DelegationPolicy,
            IssuerContext,
            MintedToken,
            OperationRef,
        )

        if self._plan.case_id == "N1" and self._cached is not None:
            return self._cached

        altered = mint_input
        mutation = self._plan.token_mutation
        if mutation == "alternate_cnf":
            altered = dataclasses.replace(altered, cnf=CertBinding(self._alternate_cnf))
        elif mutation == "wrong_audience":
            altered = dataclasses.replace(altered, audience="svc:wrong-audience")
        elif mutation == "wrong_scope":
            altered = dataclasses.replace(
                altered, scope=("investigation.lifecycle:read",)
            )
        elif mutation == "wrong_operation":
            altered = dataclasses.replace(
                altered,
                operation=OperationRef(
                    name="investigation.status", max_risk_class="R1"
                ),
                scope=("investigation.lifecycle:read",),
            )
        elif mutation == "cross_tenant":
            other = str(OTHER_TENANT_ID)
            altered = dataclasses.replace(
                altered,
                tenant_id=other,
                actor=Actor(
                    type="service",
                    id=WORKLOAD_ID,
                    tenant_id=other,
                    delegated_by=str(MEMBERSHIP_ID),
                ),
            )
        elif mutation == "org_mismatch":
            altered = dataclasses.replace(altered, org_scope="org-d2-other")

        scope_map = {altered.operation.name: tuple(altered.scope)}
        issuer = AsymmetricJwtDelegationIssuer(
            context=IssuerContext(
                issuer=ISSUER_ID,
                default_audience=altered.audience,
                kid=KEY_ID,
                algorithm="ES256",
                signing_key_ref="d2:ephemeral-file",
                ttl_seconds=120,
            ),
            signer=self._signer,
            policy=DelegationPolicy(
                operation_scope_map=scope_map,
                allowed_audiences=frozenset({altered.audience}),
            ),
            jti_factory=lambda: f"svc-d2-{self._plan.case_id.casefold()}-000000000001",
        )
        minted = issuer.mint(altered, now=now)

        # The product client validates its issuer's safe provenance before I/O.
        # Negative injection changes only the signed claims, while provenance is
        # rebound to the original requested authority and exact token digest so
        # the real relying party, not the client-side guard, owns the rejection.
        if altered != mint_input:
            original = mint_input
            provenance = dataclasses.replace(
                minted.provenance,
                audience=original.audience,
                subject=original.subject,
                tenant_id=original.tenant_id,
                actor_id=original.actor.id,
                operation=original.operation.name,
                scope=tuple(original.scope),
                classification=original.marking.classification,
                tlp=original.marking.tlp,
                token_sha256="sha256:"
                + hashlib.sha256(minted.token.encode("ascii")).hexdigest(),
            )
            minted = MintedToken(token=minted.token, provenance=provenance)
        if self._plan.case_id == "N1":
            self._cached = minted
        return minted


def _plan(case_id: str) -> CasePlan:
    matches = [plan for plan in CASE_PLANS if plan.case_id == case_id]
    if len(matches) != 1:
        raise ClientBoundaryError("unknown D2 case")
    return matches[0]


async def _execute_network_case(plan: CasePlan) -> dict[str, object]:
    import httpx
    from cybrik_soc.modules.copilot.lifecycle_create import (
        CreateBudget,
        CreateCommand,
        LifecycleCreateClient,
        LifecycleCreateError,
        OrgScope,
    )
    from cybrik_soc.platform.svc_delegation import CertBinding, DataMarking

    from .harness import assert_child_runtime_authorized

    assert_child_runtime_authorized()
    pki_root = Path(os.environ["CYBRIK_UAT_D2_PKI_ROOT"]).resolve(strict=True)
    primary_cnf = certificate_thumbprint_sha256(pki_root / "client-cert.pem")
    alternate_cnf = certificate_thumbprint_sha256(
        pki_root / "alternate-client-cert.pem"
    )
    signer = _PemEs256Signer(pki_root / "jwt-signing-key.pem")
    issuer = _CaseIssuer(
        signer=signer,
        plan=plan,
        primary_cnf=primary_cnf,
        alternate_cnf=alternate_cnf,
    )
    tls = ssl.create_default_context(cafile=str(pki_root / "ca-cert.pem"))
    tls.minimum_version = ssl.TLSVersion.TLSv1_3
    tls.maximum_version = ssl.TLSVersion.TLSv1_3
    transport = httpx.AsyncHTTPTransport(
        verify=tls,
        cert=(str(pki_root / "client-cert.pem"), str(pki_root / "client-key.pem")),
        retries=0,
    )
    accepted = 0
    rejected = 0
    rejection_codes: set[str] = set()
    async with httpx.AsyncClient(
        transport=transport,
        base_url="https://127.0.0.1:58443",
        timeout=5.0,
        follow_redirects=False,
    ) as http_client:
        client = LifecycleCreateClient(
            http_client=http_client, issuer=issuer, enabled=True
        )
        attempts = plan.expect_accept_count + plan.expect_reject_count
        for ordinal in range(attempts):
            try:
                await client.create(
                    principal=_Principal(),
                    workload_id=WORKLOAD_ID,
                    org_scope=OrgScope(org_id=ORG_ID, org_path=ORG_PATH),
                    marking=DataMarking(
                        "confidential", "TLP:AMBER", handling=("d2.synthetic",)
                    ),
                    cnf=CertBinding(primary_cnf),
                    command=CreateCommand(
                        request_id=f"soc_lifecycle_d2_{plan.case_id.casefold()}_{ordinal}",
                        idempotency_key=f"idem-d2-{plan.case_id.casefold()}-000000000001",
                        objective="Investigate one digest-bound synthetic alert without taking action.",
                        context_refs=(
                            {
                                "type": "soc.alert_snapshot",
                                "id": f"alert-d2-{plan.case_id.casefold()}",
                                "digest": "sha256:" + "a" * 64,
                            },
                        ),
                        budget=CreateBudget(
                            deadline_seconds=60,
                            max_model_calls=0,
                            max_tool_calls=0,
                            max_retrieved_bytes=1_048_576,
                        ),
                    ),
                )
            except LifecycleCreateError as exc:
                rejection_code = _SAFE_FAILURE_CODES.get(str(exc))
                if rejection_code is None:
                    raise ClientBoundaryError(
                        "D2 case returned an unclassified safe failure"
                    ) from exc
                rejection_codes.add(rejection_code)
                rejected += 1
            else:
                accepted += 1
    if accepted != plan.expect_accept_count or rejected != plan.expect_reject_count:
        raise ClientBoundaryError("D2 case outcome did not match the fail-closed plan")
    result: dict[str, object] = {
        "accepted_count": accepted,
        "case_id": plan.case_id,
        "passed": True,
        "rejected_count": rejected,
    }
    if rejected:
        if rejection_codes != {plan.required_rejection_code}:
            raise ClientBoundaryError(
                "D2 case did not return its required relying-party refusal"
            )
        result["rejection_code"] = plan.required_rejection_code
    return result


def _execute_secret_sweep() -> dict[str, object]:
    from .harness import assert_child_runtime_authorized

    assert_child_runtime_authorized()
    evidence_root = Path(os.environ["CYBRIK_UAT_D2_EVIDENCE_DIR"]).resolve(strict=True)
    runtime_root = Path(os.environ["CYBRIK_UAT_D2_RUNTIME_DIR"]).resolve(strict=True)
    known_runtime_secrets = [
        (runtime_root / "postgres-password").read_text(encoding="ascii"),
        *(
            path.read_text(encoding="ascii")
            for path in sorted((runtime_root / "pki").glob("*-key.pem"))
        ),
    ]
    if any(not known_runtime_secret for known_runtime_secret in known_runtime_secrets):
        raise ClientBoundaryError("runtime secret inventory is incomplete")
    scanned = 0
    for path in sorted(evidence_root.rglob("*")):
        if not path.is_file():
            continue
        scanned += 1
        text = path.read_text(encoding="utf-8")
        if any(
            known_runtime_secret in text
            for known_runtime_secret in known_runtime_secrets
        ):
            raise ClientBoundaryError("known runtime secret was detected in evidence")
        for line in text.splitlines():
            reason = evidence.secret_reason(line)
            if reason == evidence.JWT_VALUE and _JWT_LIKE.search(line) is None:
                continue
            if reason is not None:
                raise ClientBoundaryError("secret-bearing runtime output was detected")
    return {"case_id": "N10", "passed": True, "scanned_file_count": scanned}


async def _run(case_id: str) -> dict[str, object]:
    plan = _plan(case_id)
    if plan.case_id == "N10":
        return _execute_secret_sweep()
    return await _execute_network_case(plan)


def main() -> int:
    case_id = os.environ.get("CYBRIK_UAT_D2_CASE_ID", "")
    result_path_raw = os.environ.get("CYBRIK_UAT_D2_CASE_RESULT", "")
    if not case_id or not result_path_raw or not Path(result_path_raw).is_absolute():
        return 2
    result_path = Path(result_path_raw)
    try:
        result = evidence.validate_evidence(asyncio.run(_run(case_id)))
        _write_atomic_evidence(result_path, result)
    except Exception:  # noqa: BLE001 - every runtime failure collapses to a secret-free result
        safe = evidence.validate_evidence({"case_id": case_id, "passed": False})
        _write_atomic_evidence(result_path, safe)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
