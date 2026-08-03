# UAT test signer rotation — 2026-08-04

Status: `PROPOSED UNTIL COMMIT — LOCAL UAT TRUST ROTATION — NOT PRODUCTION AUTHORITY`

Scope: synthetic, loopback-only integrated UAT. This record does not authorize production,
customer data, demo, release, or deployment. Release dates are unchanged.

## Reason and custody boundary

The prior tracked trust descriptor was byte-identical to the repository's public unit-test fixture
identity: both its SSH fingerprint and the digest of the fixture-derived allowed-signers line
matched. That identity was therefore unsuitable as the trust anchor for an evidence-bearing UAT,
regardless of whether a corresponding private identity was available or loaded. The Founder
explicitly authorized creation of a distinct test-only key because this is a synthetic UAT
environment.

The Ed25519 private key is outside every repository under a mode-`0700` local state directory; its
private file is mode `0600`. The repository contains only the external allowed-signers file digest
and public-key fingerprint. The key is labelled `CYBRIK UAT TEST ONLY` and must never be reused for
production or customer environments.

## Public trust identity

- signer principal: `FOUNDER` for the bounded UAT namespace only;
- namespace: `cybrik-uat-soc-ai-fabric-v1`;
- key type: `ssh-ed25519`;
- public fingerprint: `SHA256:kzGy03jJRT74lJ0I1UuN+pIF9wDQ0/ofrUDZNH5TB44`;
- exact allowed-signers SHA-256:
  `0a6a4a6ce0196780e76329dbd4369ca703b3e2b0af5db5a52fb897cc7c1ffe4b`.

The two values were independently recomputed from the external public material before commit with
`shasum -a 256` and `ssh-keygen -lf`. No private bytes, signature bytes, or key path are recorded
in this document.

## Superseded packet disposition

At `2026-08-03T18:28:40Z`, the prior packet had payload SHA-256
`86c92e5fddf709ada88ed186bb5f9b9a9baf68d1045c92a0c3d5644762855371`, had no adjacent detached
signature, and had no consumption record in its exact state root. It therefore never became an
admissible or consumed authorization. The trust rotation changes the tracked Suite tree and blob
aggregate, so that old packet is retained only as superseded preparation evidence and cannot admit
the rotated clean commit.

The old public identity remains visible in Git history and in the unit-test fixture, where it is
public test data only and is forbidden as a runtime trust anchor by a regression test. Disposition
rests on the fact that no packet was signed or admitted under it, not on any assumption that the
old private half was unavailable.

This is corrective UAT identity provisioning, not a compromise response. If compromise is ever
suspected, descriptor rotation alone is insufficient: preserve the consumption ledger, revoke the
old public trust material, quarantine every unexpired packet/signature, and issue a separately
reviewed replacement.

## Verification

- RED: the new test proved the tracked-descriptor `git show` inherited ambient Git config.
- GREEN: the descriptor read now reuses the admission path's isolated Git environment:
  `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, `LC_ALL=C`, and
  `PATH=/usr/bin:/bin`.
- Focused trust, preparation and admission suites: `62 passed`.
- Regression guard: the tracked UAT anchor must differ from both the fingerprint and
  allowed-signers digest derived from the public unit-test fixture identity.
- Secret scan before commit: no leaks found.

A new authorization packet may be emitted only from the clean committed tuple. It must be signed
with this UAT-only key, verified against the exact external allowed-signers bytes, consumed once,
and torn down by the existing admission runner. The prior unsigned packet must not be hand-edited
or reused.
