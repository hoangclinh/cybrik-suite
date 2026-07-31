# tests/e2e

Status: `SCAFFOLD` / `TEST-ONLY` / `SOSIM` / `NOT UAT` / `NOT mTLS` /
`NOT deployment` / `NOT release proof`.

## SOC to Cyber AI lifecycle-create golden harness

`test_soc_ai_lifecycle_create.py` calls the real SOC `LifecycleCreateClient`, backed by the
real SOC `AsymmetricJwtDelegationIssuer`, through `httpx.ASGITransport` into the real Cyber AI
FastAPI lifecycle application. It generates an ephemeral ES256 private key at runtime and keeps
it only in process memory. Cyber AI verifies the token with `PinnedTrustProvider`,
`CryptographySignatureVerifier`, and the test/dev-only `InMemoryReplayStore`; the producer uses
only in-memory test stores.

The trusted path injects a test-only fake `TrustedTransportResolver`. It proves no TLS or mTLS
handshake, certificate-chain validation, revocation, socket, container, database, deployment, or
hosted integrated checkout. The deny-all path proves the SOC client's sanitized failure and no
created run. The client surface assertion keeps status, cancel, checkpoint, and bundle methods
absent.

Run with exact pinned, clean SOC and Cyber AI worktrees:

```bash
SOC_REPO=/absolute/path/to/pinned-soc \
CYBER_AI_REPO=/absolute/path/to/pinned-cyber-ai \
PYTHON=/absolute/path/to/python \
tests/e2e/run-soc-ai-lifecycle-create.sh
```

Equivalent flags are available:

```bash
tests/e2e/run-soc-ai-lifecycle-create.sh \
  --soc-repo /absolute/path/to/pinned-soc \
  --ai-repo /absolute/path/to/pinned-cyber-ai
```

The runner rejects relative paths, a dirty Suite or product checkout, product commit/tree
mismatches, and a Suite checkout outside the pinned base lineage before Python starts. It
supplies the three product `src` roots through `PYTHONPATH`. The Python test imports normal
package names and does not modify `sys.path` or use cross-repository relative imports, symlinks,
submodules, or nested repositories.
