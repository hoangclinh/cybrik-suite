"""Import-inert unit witnesses for the authored N1-N10 runtime boundaries."""

from __future__ import annotations

import ast
import asyncio
import json
import ssl
import subprocess
import sys
import types
from contextlib import nullcontext
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Self

import pytest
from cybrik_suite_uat_mtls import client, evidence, harness, procedure, store

_CLIENT = Path(__file__).resolve().parents[1] / "src/cybrik_suite_uat_mtls/client.py"


def test_every_inventory_case_has_exactly_one_authored_runtime_handler() -> None:
    assert _CLIENT.is_file(), "D2 client module is not authored"
    tree = ast.parse(_CLIENT.read_text(encoding="utf-8"), filename=str(_CLIENT))
    functions = [
        node.name
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]
    expected = [f"run_{case.case_id.casefold()}" for case in procedure.CASE_INVENTORY]
    assert [name for name in functions if name in expected] == expected


def test_negative_runtime_handlers_have_no_skip_or_false_green_marker() -> None:
    source = _CLIENT.read_text(encoding="utf-8") if _CLIENT.is_file() else ""
    assert source
    lowered = source.casefold()
    for marker in ("pytest.skip", "pytest.xfail", "todo", "authored_not_run"):
        assert marker not in lowered


def test_runtime_cases_prove_persistence_outage_and_secret_boundaries() -> None:
    source = _CLIENT.read_text(encoding="utf-8")
    harness = (_CLIENT.parent / "harness.py").read_text(encoding="utf-8")
    for required in (
        "rejection_code",
        "known_runtime_secret",
        "postgres_replay_row_count",
        "postgres_rls_isolation_verified",
    ):
        assert required in source or required in harness
    assert "if not store.verify_absent()" in harness
    assert 'results.append(execute_case("N9"))' in harness
    assert "store.pause()" not in harness


def test_every_network_negative_requires_the_generic_relying_party_refusal() -> None:
    source = _CLIENT.read_text(encoding="utf-8")
    harness = (_CLIENT.parent / "harness.py").read_text(encoding="utf-8")

    assert "required_rejection_code" in source
    assert 'required_rejection_code="relying_party_refusal"' in source
    assert '"transport_timeout"' in source
    assert '"transport_failure"' in source
    assert "rejection_codes != {plan.required_rejection_code}" in source
    assert "relying_party_refusal_count" in harness
    assert "relying_party_refusal_count != 9" in harness

    network_plans = [plan for plan in client.CASE_PLANS if plan.case_id != "N10"]
    assert len(network_plans) == 9
    assert {plan.required_rejection_code for plan in network_plans} == {
        "relying_party_refusal"
    }
    assert client.run_n10().required_rejection_code is None


@dataclass(frozen=True)
class _FakeBinding:
    value: str


@dataclass(frozen=True)
class _FakeOperation:
    name: str
    max_risk_class: str = "R2"


@dataclass(frozen=True)
class _FakeActor:
    type: str
    id: str
    tenant_id: str
    delegated_by: str


@dataclass(frozen=True)
class _FakeMarking:
    classification: str = "confidential"
    tlp: str = "TLP:AMBER"


@dataclass(frozen=True)
class _FakeMintInput:
    cnf: _FakeBinding
    audience: str
    scope: tuple[str, ...]
    operation: _FakeOperation
    tenant_id: str
    actor: _FakeActor
    org_scope: str
    subject: str
    marking: _FakeMarking = _FakeMarking()


@dataclass(frozen=True)
class _FakeProvenance:
    audience: str
    subject: str
    tenant_id: str
    actor_id: str
    operation: str
    scope: tuple[str, ...]
    classification: str
    tlp: str
    token_sha256: str


@dataclass(frozen=True)
class _FakeMintedToken:
    token: str
    provenance: _FakeProvenance


def _mint_input() -> _FakeMintInput:
    return _FakeMintInput(
        cnf=_FakeBinding("primary"),
        audience="svc:investigation-api",
        scope=("investigation.lifecycle:create",),
        operation=_FakeOperation("investigation.lifecycle.create"),
        tenant_id=str(client.TENANT_ID),
        actor=_FakeActor(
            type="service",
            id=client.WORKLOAD_ID,
            tenant_id=str(client.TENANT_ID),
            delegated_by=str(client.MEMBERSHIP_ID),
        ),
        org_scope=client.ORG_ID,
        subject="soc-workload",
    )


def _install_delegation_fakes(
    monkeypatch: pytest.MonkeyPatch,
) -> list[_FakeMintInput]:
    minted_inputs: list[_FakeMintInput] = []

    class _Issuer:
        def __init__(self, **_: object) -> None:
            pass

        def mint(self, mint_input: _FakeMintInput, *, now: object = None) -> object:
            del now
            minted_inputs.append(mint_input)
            provenance = _FakeProvenance(
                audience=mint_input.audience,
                subject=mint_input.subject,
                tenant_id=mint_input.tenant_id,
                actor_id=mint_input.actor.id,
                operation=mint_input.operation.name,
                scope=mint_input.scope,
                classification=mint_input.marking.classification,
                tlp=mint_input.marking.tlp,
                token_sha256="sha256:" + "0" * 64,
            )
            return _FakeMintedToken("header.payload.signature", provenance)

    delegation = types.ModuleType("cybrik_soc.platform.svc_delegation")
    delegation.Actor = _FakeActor
    delegation.AsymmetricJwtDelegationIssuer = _Issuer
    delegation.CertBinding = _FakeBinding
    delegation.DelegationPolicy = lambda **values: SimpleNamespace(**values)
    delegation.IssuerContext = lambda **values: SimpleNamespace(**values)
    delegation.MintedToken = _FakeMintedToken
    delegation.OperationRef = _FakeOperation
    delegation.DataMarking = _FakeMarking
    monkeypatch.setitem(sys.modules, delegation.__name__, delegation)
    return minted_inputs


@pytest.mark.parametrize(
    ("case_id", "mutation", "assertion"),
    (
        ("N2", "alternate_cnf", lambda value: value.cnf.value == "alternate"),
        ("N3", "wrong_audience", lambda value: value.audience == "svc:wrong-audience"),
        (
            "N4",
            "wrong_scope",
            lambda value: value.scope == ("investigation.lifecycle:read",),
        ),
        (
            "N5",
            "wrong_operation",
            lambda value: (
                value.operation.name == "investigation.status"
                and value.scope == ("investigation.lifecycle:read",)
            ),
        ),
        (
            "N6",
            "cross_tenant",
            lambda value: (
                value.tenant_id == str(client.OTHER_TENANT_ID)
                and value.actor.tenant_id == str(client.OTHER_TENANT_ID)
            ),
        ),
        ("N7", "org_mismatch", lambda value: value.org_scope == "org-d2-other"),
        ("N8", "missing_tls_extension", lambda value: value == _mint_input()),
    ),
)
def test_case_issuer_mutates_only_selected_claim_and_rebinds_provenance(
    monkeypatch: pytest.MonkeyPatch,
    case_id: str,
    mutation: str,
    assertion: object,
) -> None:
    minted_inputs = _install_delegation_fakes(monkeypatch)
    original = _mint_input()
    issuer = client._CaseIssuer(
        signer=object(),
        plan=client.CasePlan(case_id, mutation, 0, 1, "relying_party_refusal"),
        primary_cnf="primary",
        alternate_cnf="alternate",
    )

    minted = issuer.mint(original)

    assert len(minted_inputs) == 1
    assert callable(assertion) and assertion(minted_inputs[0])  # type: ignore[operator]
    expected_token_sha256 = "sha256:" + "0" * 64
    if mutation != "missing_tls_extension":
        expected_token_sha256 = (
            "sha256:"
            + __import__("hashlib").sha256(minted.token.encode("ascii")).hexdigest()
        )
    assert minted.provenance == _FakeProvenance(
        audience=original.audience,
        subject=original.subject,
        tenant_id=original.tenant_id,
        actor_id=original.actor.id,
        operation=original.operation.name,
        scope=original.scope,
        classification=original.marking.classification,
        tlp=original.marking.tlp,
        token_sha256=expected_token_sha256,
    )


def test_case_issuer_reuses_exact_n1_token_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    minted_inputs = _install_delegation_fakes(monkeypatch)
    issuer = client._CaseIssuer(
        signer=object(),
        plan=client.run_n1(),
        primary_cnf="primary",
        alternate_cnf="alternate",
    )
    original = _mint_input()

    first = issuer.mint(original, now=object())
    second = issuer.mint(original, now=object())

    assert first is second
    assert minted_inputs == [original]


def test_plan_requires_exactly_one_case(monkeypatch: pytest.MonkeyPatch) -> None:
    assert client._plan("N1") == client.run_n1()

    monkeypatch.setattr(client, "CASE_PLANS", ())
    with pytest.raises(client.ClientBoundaryError, match="unknown D2 case"):
        client._plan("N1")

    duplicate = client.run_n1()
    monkeypatch.setattr(client, "CASE_PLANS", (duplicate, duplicate))
    with pytest.raises(client.ClientBoundaryError, match="unknown D2 case"):
        client._plan("N1")


class _KeywordRecord:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.args = args
        self.kwargs = kwargs


def _install_network_fakes(
    monkeypatch: pytest.MonkeyPatch, outcomes: list[object]
) -> type[Exception]:
    class _LifecycleCreateError(RuntimeError):
        pass

    class _LifecycleCreateClient:
        def __init__(self, **_: object) -> None:
            pass

        async def create(self, **_: object) -> None:
            outcome = outcomes.pop(0)
            if isinstance(outcome, BaseException):
                raise outcome

    lifecycle = types.ModuleType("cybrik_soc.modules.copilot.lifecycle_create")
    lifecycle.CreateBudget = _KeywordRecord
    lifecycle.CreateCommand = _KeywordRecord
    lifecycle.LifecycleCreateClient = _LifecycleCreateClient
    lifecycle.LifecycleCreateError = _LifecycleCreateError
    lifecycle.OrgScope = _KeywordRecord
    monkeypatch.setitem(sys.modules, lifecycle.__name__, lifecycle)

    delegation = types.ModuleType("cybrik_soc.platform.svc_delegation")
    delegation.CertBinding = _FakeBinding
    delegation.DataMarking = _KeywordRecord
    monkeypatch.setitem(sys.modules, delegation.__name__, delegation)

    class _AsyncHTTPTransport:
        def __init__(self, **_: object) -> None:
            pass

    class _AsyncClient:
        def __init__(self, **_: object) -> None:
            pass

        async def __aenter__(self) -> object:
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

    httpx = types.ModuleType("httpx")
    httpx.AsyncHTTPTransport = _AsyncHTTPTransport
    httpx.AsyncClient = _AsyncClient
    monkeypatch.setitem(sys.modules, "httpx", httpx)
    return _LifecycleCreateError


def _prepare_network_case(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, outcomes: list[object]
) -> tuple[type[Exception], SimpleNamespace]:
    error_type = _install_network_fakes(monkeypatch, outcomes)
    monkeypatch.setattr(harness, "assert_runtime_authorized", lambda: None)
    monkeypatch.setattr(client, "certificate_thumbprint_sha256", lambda _: "thumbprint")
    monkeypatch.setattr(client, "_PemEs256Signer", lambda _: object())
    tls_context = SimpleNamespace(minimum_version=None, maximum_version=None)
    monkeypatch.setattr(client.ssl, "create_default_context", lambda **_: tls_context)
    monkeypatch.setenv("CYBRIK_UAT_D2_PKI_ROOT", str(tmp_path))
    return error_type, tls_context


def test_network_case_classifies_accept_and_safe_refusal_without_io(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    outcomes: list[object] = []
    error_type, tls_context = _prepare_network_case(monkeypatch, tmp_path, outcomes)
    outcomes.extend(
        [None, error_type("lifecycle create was rejected by the relying party")]
    )

    result = asyncio.run(client._execute_network_case(client.run_n1()))

    assert result == {
        "accepted_count": 1,
        "case_id": "N1",
        "passed": True,
        "rejected_count": 1,
        "rejection_code": "relying_party_refusal",
    }
    assert tls_context.minimum_version is ssl.TLSVersion.TLSv1_3
    assert tls_context.maximum_version is ssl.TLSVersion.TLSv1_3

    outcomes.append(None)
    accepted = asyncio.run(
        client._execute_network_case(client.CasePlan("NX", "none", 1, 0, None))
    )
    assert accepted["accepted_count"] == 1
    assert "rejection_code" not in accepted


@pytest.mark.parametrize(
    ("message", "plan", "expected"),
    (
        (
            "unmapped failure",
            client.CasePlan("NX", "none", 0, 1, "relying_party_refusal"),
            "unclassified safe failure",
        ),
        (
            "lifecycle create was rejected by the relying party",
            client.CasePlan("NX", "none", 1, 0, None),
            "outcome did not match",
        ),
        (
            "lifecycle create transport timed out",
            client.CasePlan("NX", "none", 0, 1, "relying_party_refusal"),
            "required relying-party refusal",
        ),
    ),
)
def test_network_case_fails_closed_on_unclassified_count_or_code_mismatch(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    message: str,
    plan: client.CasePlan,
    expected: str,
) -> None:
    outcomes: list[object] = []
    error_type, _tls_context = _prepare_network_case(monkeypatch, tmp_path, outcomes)
    outcomes.append(error_type(message))

    with pytest.raises(client.ClientBoundaryError, match=expected):
        asyncio.run(client._execute_network_case(plan))


def _secret_roots(tmp_path: Path) -> tuple[Path, Path]:
    evidence_root = tmp_path / "evidence"
    runtime_root = tmp_path / "runtime"
    evidence_root.mkdir()
    (evidence_root / "nested").mkdir()
    (runtime_root / "pki").mkdir(parents=True)
    (runtime_root / "postgres-password").write_text(
        "synthetic-postgres-value", encoding="ascii"
    )
    (runtime_root / "pki/client-key.pem").write_text(
        "synthetic-key-value", encoding="ascii"
    )
    return evidence_root, runtime_root


def test_secret_sweep_is_file_bounded_and_rejects_known_or_classified_secrets(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    evidence_root, runtime_root = _secret_roots(tmp_path)
    artifact = evidence_root / "result.txt"
    real_secret_reason = evidence.secret_reason
    monkeypatch.setattr(harness, "assert_runtime_authorized", lambda: None)
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(runtime_root))

    artifact.write_text("clean evidence", encoding="utf-8")
    monkeypatch.setattr(evidence, "secret_reason", lambda _: None)
    assert client._execute_secret_sweep() == {
        "case_id": "N10",
        "passed": True,
        "scanned_file_count": 1,
    }

    artifact.write_text("synthetic-key-value", encoding="utf-8")
    with pytest.raises(client.ClientBoundaryError, match="known runtime secret"):
        client._execute_secret_sweep()

    artifact.write_text("not-a-jwt", encoding="utf-8")
    monkeypatch.setattr(evidence, "secret_reason", lambda _: evidence.JWT_VALUE)
    assert client._execute_secret_sweep()["scanned_file_count"] == 1

    monkeypatch.setattr(evidence, "secret_reason", real_secret_reason)
    artifact.write_text(
        "eyJhbGciOiJFUzI1NiJ9.AAAAAAAAAAAA.BBBBBBBBBBBB", encoding="utf-8"
    )
    with pytest.raises(client.ClientBoundaryError, match="secret-bearing runtime"):
        client._execute_secret_sweep()

    artifact.write_text("Bearer AAAAAAAAAAAAAAAAAAAA", encoding="utf-8")
    with pytest.raises(client.ClientBoundaryError, match="secret-bearing runtime"):
        client._execute_secret_sweep()

    (runtime_root / "postgres-password").write_text("", encoding="ascii")
    with pytest.raises(client.ClientBoundaryError, match="inventory is incomplete"):
        client._execute_secret_sweep()


def test_client_dispatch_selects_secret_or_network_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_network(plan: client.CasePlan) -> dict[str, object]:
        return {"case_id": plan.case_id}

    monkeypatch.setattr(client, "_execute_network_case", fake_network)
    monkeypatch.setattr(client, "_execute_secret_sweep", lambda: {"case_id": "N10"})

    assert asyncio.run(client._run("N1")) == {"case_id": "N1"}
    assert asyncio.run(client._run("N10")) == {"case_id": "N10"}


def test_client_main_validates_inputs_and_writes_only_safe_results(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(client.os, "environ", {})
    assert client.main() == 2

    writes: list[tuple[Path, object]] = []
    result_path = tmp_path / "result.json"
    monkeypatch.setattr(
        client.os,
        "environ",
        {
            "CYBRIK_UAT_D2_CASE_ID": "N10",
            "CYBRIK_UAT_D2_CASE_RESULT": str(result_path),
        },
    )
    monkeypatch.setattr(
        client,
        "_write_atomic_evidence",
        lambda path, value: writes.append((path, value)),
    )

    def successful_run(coroutine: object) -> object:
        coroutine.close()  # type: ignore[attr-defined]
        return {"case_id": "N10", "passed": True}

    monkeypatch.setattr(client.asyncio, "run", successful_run)
    assert client.main() == 0
    assert writes[-1] == (result_path, {"case_id": "N10", "passed": True})

    def failed_run(coroutine: object) -> object:
        coroutine.close()  # type: ignore[attr-defined]
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(client.asyncio, "run", failed_run)
    assert client.main() == 1
    assert writes[-1] == (result_path, {"case_id": "N10", "passed": False})


def test_client_atomic_writer_cleans_temporary_after_replace_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    destination = tmp_path / "result.json"
    temporary = destination.with_suffix(".tmp")
    monkeypatch.setattr(
        client.os,
        "replace",
        lambda *_args: (_ for _ in ()).throw(OSError("synthetic replace failure")),
    )

    with pytest.raises(OSError, match="synthetic replace failure"):
        client._write_atomic_evidence(destination, {"passed": False})

    assert not temporary.exists()
    assert not destination.exists()


def _install_cryptography_fakes(
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[object, list[tuple[object, ...]]]:
    calls: list[tuple[object, ...]] = []

    class _PrivateKey:
        def sign(self, signing_input: bytes, algorithm: object) -> bytes:
            calls.append(("sign", signing_input, algorithm))
            return b"synthetic-der"

    private_key = _PrivateKey()

    def load_pem_private_key(payload: bytes, *, password: object) -> object:
        calls.append(("load", payload, password))
        return private_key

    class _Sha256:
        pass

    class _Ecdsa:
        def __init__(self, digest: object) -> None:
            self.digest = digest

    cryptography = types.ModuleType("cryptography")
    hazmat = types.ModuleType("cryptography.hazmat")
    primitives = types.ModuleType("cryptography.hazmat.primitives")
    serialization = types.ModuleType("cryptography.hazmat.primitives.serialization")
    hashes = types.ModuleType("cryptography.hazmat.primitives.hashes")
    asymmetric = types.ModuleType("cryptography.hazmat.primitives.asymmetric")
    ec = types.ModuleType("cryptography.hazmat.primitives.asymmetric.ec")
    utils = types.ModuleType("cryptography.hazmat.primitives.asymmetric.utils")

    serialization.load_pem_private_key = load_pem_private_key
    hashes.SHA256 = _Sha256
    ec.ECDSA = _Ecdsa
    utils.decode_dss_signature = lambda value: calls.append(("decode", value)) or (1, 2)
    primitives.serialization = serialization
    primitives.hashes = hashes
    asymmetric.ec = ec
    asymmetric.utils = utils
    hazmat.primitives = primitives
    cryptography.hazmat = hazmat

    for module in (
        cryptography,
        hazmat,
        primitives,
        serialization,
        hashes,
        asymmetric,
        ec,
        utils,
    ):
        monkeypatch.setitem(sys.modules, module.__name__, module)
    return private_key, calls


def test_pem_es256_signer_loads_key_and_emits_fixed_width_raw_signature(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    private_key, calls = _install_cryptography_fakes(monkeypatch)
    key_path = tmp_path / "synthetic-key-input"
    key_path.write_bytes(b"synthetic-key-bytes")

    signer = client._PemEs256Signer(key_path)
    signature = signer.sign(b"signed-input")

    assert signer._key is private_key
    assert signer.kid == client.KEY_ID
    assert signer.algorithm == "ES256"
    assert signature == (1).to_bytes(32, "big") + (2).to_bytes(32, "big")
    assert calls[0] == ("load", b"synthetic-key-bytes", None)
    assert calls[1][0:2] == ("sign", b"signed-input")
    assert calls[2] == ("decode", b"synthetic-der")


class _FakeSocket:
    def __init__(self, connect_result: int) -> None:
        self.connect_result = connect_result
        self.timeout: float | None = None

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def settimeout(self, timeout: float) -> None:
        self.timeout = timeout

    def connect_ex(self, _: object) -> int:
        return self.connect_result


def _runtime(tmp_path: Path, password: str = "p" * 32) -> store.PostgresRuntime:
    repository = tmp_path / "ai"
    repository.mkdir(exist_ok=True)
    return store.PostgresRuntime(password=password, ai_repository=repository)


def test_postgres_runtime_properties_are_exact_and_secret_scoped(
    tmp_path: Path,
) -> None:
    runtime = _runtime(tmp_path)
    assert runtime.admin_dsn == (
        "postgresql+asyncpg://postgres:" + "p" * 32 + "@127.0.0.1:55432/"
        "cybrik_uat_mtls_d2"
    )
    assert runtime.secret_free_identity == {
        "container_id": store.CONTAINER_NAME,
        "database_id": store.POSTGRES_DATABASE,
        "host": store.POSTGRES_HOST,
        "image_id": store.POSTGRES_IMAGE,
        "port": store.POSTGRES_PORT,
        "runtime_role_id": store.RUNTIME_ROLE,
    }
    assert runtime.password not in json.dumps(runtime.secret_free_identity)


def test_store_run_passes_argv_without_shell_and_collapses_process_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []

    def fake_run(argv: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append({"argv": argv, **kwargs})
        return subprocess.CompletedProcess(argv, 0, "ok", "")  # type: ignore[arg-type]

    monkeypatch.setattr(store.subprocess, "run", fake_run)
    result = store._run(("docker", "version"), timeout=3)
    assert result.stdout == "ok"
    assert calls == [
        {
            "argv": ("docker", "version"),
            "check": True,
            "capture_output": True,
            "text": True,
            "timeout": 3,
            "env": None,
            "shell": False,
        }
    ]

    monkeypatch.setattr(
        store.subprocess,
        "run",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("synthetic")),
    )
    with pytest.raises(store.PostgresBoundaryError, match="command failed"):
        store._run(("docker", "version"))


def test_docker_environment_rejects_short_password_and_scopes_required_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(store.PostgresBoundaryError, match="credential is invalid"):
        store._docker_environment("short")

    monkeypatch.setattr(store.os, "environ", {"PATH": "/usr/bin:/bin"})
    environment = store._docker_environment("s" * 32)
    assert environment == {
        "PATH": "/usr/bin:/bin",
        "PGPASSWORD": "s" * 32,
        "POSTGRES_DB": store.POSTGRES_DATABASE,
        "POSTGRES_PASSWORD": "s" * 32,
    }


@pytest.mark.parametrize(("returncode", "expected"), ((0, True), (1, False)))
def test_container_exists_reflects_inspect_return_code(
    monkeypatch: pytest.MonkeyPatch, returncode: int, expected: bool
) -> None:
    monkeypatch.setattr(
        store,
        "_run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=returncode),
    )
    assert store.container_exists() is expected


@pytest.mark.parametrize(
    ("container", "image_code", "port_code", "message"),
    (
        (True, 0, 1, "already exists"),
        (False, 1, 1, "image is absent"),
        (False, 0, 0, "port is already in use"),
    ),
)
def test_postgres_preflight_refuses_existing_container_missing_image_or_bound_port(
    monkeypatch: pytest.MonkeyPatch,
    container: bool,
    image_code: int,
    port_code: int,
    message: str,
) -> None:
    monkeypatch.setattr(store, "container_exists", lambda: container)
    monkeypatch.setattr(
        store,
        "_run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=image_code),
    )
    monkeypatch.setattr(store.socket, "socket", lambda *_args: _FakeSocket(port_code))
    with pytest.raises(store.PostgresBoundaryError, match=message):
        store.assert_preflight()


def test_postgres_preflight_accepts_only_absent_image_present_and_free_port(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(store, "container_exists", lambda: False)
    monkeypatch.setattr(
        store, "_run", lambda *_args, **_kwargs: SimpleNamespace(returncode=0)
    )
    fake_socket = _FakeSocket(1)
    monkeypatch.setattr(store.socket, "socket", lambda *_args: fake_socket)
    store.assert_preflight()
    assert fake_socket.timeout == 0.25


def test_postgres_start_uses_digest_pinned_argv_and_rolls_back_readiness_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    runtime = _runtime(tmp_path)
    calls: list[tuple[object, dict[str, object]]] = []
    monkeypatch.setattr(store, "assert_preflight", lambda: None)
    monkeypatch.setattr(store.os, "environ", {"PATH": "/usr/bin:/bin"})
    monkeypatch.setattr(
        store, "_run", lambda argv, **kwargs: calls.append((argv, kwargs))
    )
    monkeypatch.setattr(store, "wait_ready", lambda _: None)
    store.start(runtime)
    assert calls[0][0][0:3] == (
        store.DOCKER_EXECUTABLE,
        "run",
        "--pull=never",
    )
    assert calls[0][0][-1] == store.POSTGRES_IMAGE
    assert runtime.password not in calls[0][0]

    stopped: list[bool] = []
    monkeypatch.setattr(
        store,
        "wait_ready",
        lambda _: (_ for _ in ()).throw(RuntimeError("not ready")),
    )
    monkeypatch.setattr(store, "stop", lambda: stopped.append(True))
    with pytest.raises(RuntimeError, match="not ready"):
        store.start(runtime)
    assert stopped == [True]


def test_wait_ready_covers_success_socket_retry_and_bounded_timeout_without_sleep(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    runtime = _runtime(tmp_path)
    monkeypatch.setattr(store.os, "environ", {})
    monkeypatch.setattr(store.time, "sleep", lambda _: None)
    results = iter((SimpleNamespace(returncode=0), SimpleNamespace(returncode=0)))
    monkeypatch.setattr(store, "_run", lambda *_args, **_kwargs: next(results))
    connections: list[int] = []

    def connect_once(*_args: object, **_kwargs: object) -> object:
        connections.append(1)
        if len(connections) == 1:
            raise OSError("retry")
        return nullcontext()

    monkeypatch.setattr(store.socket, "create_connection", connect_once)
    store.wait_ready(runtime, attempts=2)
    assert len(connections) == 2

    monkeypatch.setattr(
        store,
        "_run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=1),
    )
    with pytest.raises(store.PostgresBoundaryError, match="readiness timed out"):
        store.wait_ready(runtime, attempts=1)


def _install_alembic_fakes(
    monkeypatch: pytest.MonkeyPatch, calls: list[object], *, fail: bool = False
) -> None:
    class _Config:
        def __init__(self, path: str) -> None:
            calls.append(("config", path))

        def set_main_option(self, key: str, value: str) -> None:
            calls.append((key, value))

    def upgrade(config: object, revision: str) -> None:
        calls.append(("upgrade", config, revision))
        if fail:
            raise RuntimeError("synthetic migration failure")

    alembic = types.ModuleType("alembic")
    config = types.ModuleType("alembic.config")
    alembic.command = SimpleNamespace(upgrade=upgrade)
    config.Config = _Config
    monkeypatch.setitem(sys.modules, "alembic", alembic)
    monkeypatch.setitem(sys.modules, "alembic.config", config)


def test_migrate_requires_config_and_uses_stubbed_alembic_boundary(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    runtime = _runtime(tmp_path)
    with pytest.raises(store.PostgresBoundaryError, match="configuration is absent"):
        store.migrate(runtime)

    migrations = runtime.ai_repository / "services/ai-api/migrations"
    migrations.mkdir(parents=True)
    (migrations / "alembic.ini").write_text("[alembic]", encoding="utf-8")
    calls: list[object] = []
    _install_alembic_fakes(monkeypatch, calls)
    store.migrate(runtime, revision="reviewed")
    assert calls[-1][0] == "upgrade"
    assert calls[-1][2] == "reviewed"

    calls.clear()
    _install_alembic_fakes(monkeypatch, calls, fail=True)
    with pytest.raises(store.PostgresBoundaryError, match="migration failed"):
        store.migrate(runtime)


def test_psql_uses_secret_child_environment_and_returns_stripped_stdout(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    runtime = _runtime(tmp_path)
    monkeypatch.setattr(store.os, "environ", {})
    calls: list[tuple[object, dict[str, object]]] = []

    def fake_run(argv: object, **kwargs: object) -> object:
        calls.append((argv, kwargs))
        return SimpleNamespace(stdout="  7\n")

    monkeypatch.setattr(store, "_run", fake_run)
    assert store._psql(runtime, "SELECT 7", timeout=9) == "7"
    argv, kwargs = calls[0]
    assert argv[-2:] == ("-c", "SELECT 7")
    assert runtime.password not in argv
    assert kwargs["environment"]["PGPASSWORD"] == runtime.password
    assert kwargs["timeout"] == 9


@pytest.mark.parametrize(
    ("responses", "message"),
    (
        (("t|f|f",), "role posture is unsafe"),
        (("f|f|f", "4"), "FORCE RLS posture is incomplete"),
        (("f|f|f", "5", "1"), "RLS isolation probe failed"),
    ),
)
def test_audit_security_posture_rejects_each_unsafe_observation(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    responses: tuple[str, ...],
    message: str,
) -> None:
    runtime = _runtime(tmp_path)
    values = iter(responses)
    monkeypatch.setattr(store, "_psql", lambda *_args, **_kwargs: next(values))
    with pytest.raises(store.PostgresBoundaryError, match=message):
        store.audit_security_posture(runtime)


def test_audit_security_posture_returns_only_safe_verified_flags(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    runtime = _runtime(tmp_path)
    values = iter(("f|f|f", "5", "0"))
    monkeypatch.setattr(store, "_psql", lambda *_args, **_kwargs: next(values))
    assert store.audit_security_posture(runtime) == {
        "postgres_force_rls_table_count": 5,
        "postgres_role_posture_verified": True,
        "postgres_rls_isolation_verified": True,
    }


def test_replay_row_count_validates_tenant_and_decimal_result(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    runtime = _runtime(tmp_path)
    with pytest.raises(store.PostgresBoundaryError, match="identifier is invalid"):
        store.replay_row_count(runtime, tenant_id="not-synthetic")

    monkeypatch.setattr(store, "_psql", lambda *_args, **_kwargs: "not-decimal")
    with pytest.raises(store.PostgresBoundaryError, match="count is invalid"):
        store.replay_row_count(runtime, tenant_id=str(client.TENANT_ID))

    monkeypatch.setattr(store, "_psql", lambda *_args, **_kwargs: "17")
    assert store.replay_row_count(runtime, tenant_id=str(client.TENANT_ID)) == 17


def test_stop_and_verify_absent_are_fully_stubbed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[object] = []
    monkeypatch.setattr(store, "container_exists", lambda: False)
    monkeypatch.setattr(
        store, "_run", lambda *args, **kwargs: calls.append((args, kwargs))
    )
    store.stop()
    assert calls == []

    monkeypatch.setattr(store, "container_exists", lambda: True)
    store.stop()
    assert calls[0][0][0] == (
        store.DOCKER_EXECUTABLE,
        "rm",
        "-f",
        store.CONTAINER_NAME,
    )
    assert store.verify_absent() is False

    monkeypatch.setattr(store, "container_exists", lambda: False)
    monkeypatch.setattr(store.socket, "socket", lambda *_args: _FakeSocket(0))
    assert store.verify_absent() is False
    monkeypatch.setattr(store.socket, "socket", lambda *_args: _FakeSocket(1))
    assert store.verify_absent() is True


def test_store_python_executable_is_canonical() -> None:
    assert store.python_executable() == str(Path(sys.executable).resolve(strict=True))
