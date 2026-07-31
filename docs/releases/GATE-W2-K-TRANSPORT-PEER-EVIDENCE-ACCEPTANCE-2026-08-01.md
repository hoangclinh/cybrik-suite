# Gate W2-K — transport peer-evidence acceptance

Decision date: 2026-08-01 (Asia/Ho_Chi_Minh).

Base commit: `ef61285f7674672007a7c3a76bae08d5b1d0ef70`.

Outcome: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** at v0.1.0. This is not stable v1/GA
and is not an ADR-0001 immutable bundle tag.

## Accepted surface

Gate W2-K accepts the exact server-neutral transport peer-evidence profile and fail-closed TPE
denial vocabulary for contract-first product implementation. A conforming adapter may convey only
an `x5t#S256` thumbprint derived from a serving-side verified mutual-TLS chain. The relying party
must require the three-way transport, relying-party, and token-confirmation thumbprint equality
before applying the separately accepted W2-F authorization checks.

Acceptance is governance-metadata and digest-only. It changes no JSON Schema property, required
field, constraint, `$ref`, denial class, fixture payload, endpoint, route, process, or runtime
behavior. The exact 21-path authority is recorded in the delegated Governor R4 amendment.

## Byte and semantic evidence

- 18 fixture-byte aggregate before and after:
  `5f00075311fd2405ea6933084d87f53ef4e3b74c0c9542d14caf8de26ccd0dec`.
- Evidence-schema semantic projection before and after:
  `815f720d7c88a181e9e6bac03f85b5ed6cf257eb6199dacb692337bfe5a84d4f`.
- Error-schema semantic projection before and after:
  `9c09ddb6875be7af051323de9545b070f8360c5ea61a99f61eaed89bd0a66d4d`.
- The projections remove only the four root governance fields `description`, `x-cybrik-status`,
  `x-cybrik-not-accepted`, and `x-cybrik-not-implemented` before hashing.
- Schema, examples-manifest, compatibility-member, and aggregate digests are recut after the
  atomic lifecycle flip and must pass the canonical validator.

The R4 RED checkpoint is test-only. Canonical merge remains conditional on independent review and
the rendered required hosted checks; no hosted result is pre-claimed by this record.

## Authority boundary

This acceptance grants no runtime, UAT, release, deployment, or production authority. It opens no
socket, listener, database, container, process, or migration and handles no key, certificate,
credential, secret, customer data, or production data.

A1–A7 remain OPEN. N1 and N9 remain `requires_runtime`. Anycorn `0.20.0` remains HOLD, unselected,
uninstalled, and unpinned. Hypercorn and Granian remain unassessed. The trusted-boundary adapter
remains forbidden. Server selection, runtime admission, local integration/UAT, product commits,
release, deployment, and production are all separate gates.

## Rollback

Before any product implementation consumes W2-K, rollback is the atomic reversion of the exact R4
lifecycle carriers and digest recut. Partial lifecycle reversion is forbidden and fails the
cross-carrier tests. Once a product implementation is separately authorized, any incompatible
contract change requires a separately reviewed versioned decision; it must never be silently
rewritten in place.
