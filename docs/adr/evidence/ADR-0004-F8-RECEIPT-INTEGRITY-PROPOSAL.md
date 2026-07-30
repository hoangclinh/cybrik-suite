# ADR-0004 F8 supplement — receipt-integrity signature profile

- Status: `PROPOSED` — **NOT ACCEPTED**. This is a supplementary evidence document, not a decision
  and not an ADR amendment. It informs the still-open ADR-0004 F8 deferral; it does not close it.
  Nothing in the suite is implemented, and no signer, issuer, key store, or ledger exists.
- Date: 2026-07-31
- Backs: the **F8** deferral in [ADR-0004](../ADR-0004-tool-fabric-control-plane-executor-split.md)
  ("Defer the workload-identity issuer, executor transport, **receipt signing envelope**,
  executor-attestation mechanism, and sandbox substrate to explicit spikes/ADRs"), recorded as
  carried unknown #3 in [ADR-0004-EVIDENCE](ADR-0004-EVIDENCE.md) §14.
- Inherits, does not re-decide: **ADR-0006 E5 / ADR-0004 F6** — the Tool Fabric *control plane*
  signs receipts and executors only attest evidence into them. This document proposes the *shape* of
  that signature. It does not reopen *who* signs.
- Scope: one candidate receipt digest profile and one candidate signature envelope, realized as
  contracts so the option can be reviewed against real bytes. Out of scope, deliberately: COSE and
  in-toto prototypes, key lifecycle, issuer selection, ledger design, and executor attestation.
- Artifacts: `cybrik-suite:contracts/compatibility/cybrik-suite-receipt-integrity-proposal.v1.manifest.json`
  and the packet it inventories. No schema body is reproduced here; the contracts are the contract.
- Catalog note: [evidence/README.md](README.md) catalogs one packet per ADR under the name
  `ADR-XXXX-EVIDENCE.md`. This supplement deliberately uses a different name because it backs a
  single deferral inside an already-accepted ADR rather than the ADR as a whole. A catalog row for
  it is **owed** and is not added here; that file is outside this packet's edit scope.

## 0. Source-labelling key

Per [evidence/README.md](README.md): `FACT` (verified against the primary source or reproduced
here), `RESEARCH` (summarized from a primary source, not independently reproduced),
`PROPOSAL` (our position, ours to defend), `INFERENCE` (reasoning from labelled facts; could be
wrong), `UNKNOWN` (open question).

**Access-date honesty.** No external URL was accessed on 2026-07-31. The standards claims below are
carried from the source register of [ADR-0004-EVIDENCE](ADR-0004-EVIDENCE.md) §14.6, whose external
sources — including **RFC 9052 (COSE)** and **RFC 7515 (JWS)** — were accessed **2026-07-24**. They
are therefore labelled `RESEARCH` with that carried access date, never `FACT`. Claims labelled
`FACT` below were reproduced *locally* against `node:crypto` and the repository's own bytes; they
are facts about this machine and this tree, not about a published document.

## 1. Decision criteria

Stated before scoring. Drawn from the F8 deferral text, ADR-0004 criteria F-C1 (blast-radius
containment) and F-C4 (receipt integrity), and ADR-0001 D4 format pins.

| # | Criterion | Why it matters |
|---|---|---|
| R-C1 | Tamper-evidence over the *exact transmitted* bytes | If any layer may re-render a receipt and keep the signature valid, the signature stops being evidence about what was recorded. |
| R-C2 | No in-band key sourcing | A verifier that can be told which key to trust by the message it is verifying has no trust boundary at all. |
| R-C3 | No algorithm downgrade path | `alg=none` and negotiable algorithms are the classic JOSE failure; agility must cost a profile version, not a header field. |
| R-C4 | Reproducible by an independent implementer | A profile a second implementer cannot reproduce byte-for-byte is a description, not a contract. |
| R-C5 | Offline, fail-closed verification | Air-gapped T2 operation (`03 §10`) forbids a verifier that must reach the network to decide. |
| R-C6 | No new dependency, no new format pin | ADR-0001 D4 pins JSON Schema 2020-12; a profile that drags in a new wire format widens the audit surface. |
| R-C7 | Honest about what a signature does *not* prove | Over-reading a valid signature is the failure mode that matters most operationally. |

## 2. What is already fixed, and what F8 actually left open

`RESEARCH` (internal, from the accepted ADRs — no external source):

- ADR-0006 **E5** and ADR-0004 **F6** fix that the control plane signs and executors attest. A
  receipt-signing key never exists on an executor.
- `cybrik.execution-receipt.v1` is accepted at v0.1.0 and already carries `receipt_digest` and a
  `signature` field whose own description says the signing envelope is deferred to F8 and that
  `signature` is a *reference* to it. The receipt contract therefore has a shaped hole; F8 is the
  decision about what fills it.

`FACT` (read from this tree on 2026-07-31): the accepted receipt schema declares `default: []` on
both `input_artifact_digests` and `output_artifacts`. Nothing in the accepted corpus says whether a
digest is taken before or after those defaults are materialized. That silence is a real gap and §5.2
below is where this proposal closes it.

## 3. The proposed profile

`PROPOSAL`. Two parts, both realized as contracts rather than prose.

**Digest — `CYBRIK-RECEIPT-JCS/v1`.** Take the exact transmitted receipt. Remove exactly the two
self-referential top-level keys `receipt_digest` and `signature`, and nothing else. Inject no schema
default. Canonicalize with RFC 8785 JCS. Hash `UTF-8("CYBRIK-RECEIPT-JCS/v1") || 0x00 || JCS-bytes`.

**Envelope — `CYBRIK-RECEIPT-JWS/v1`.** An ordinary compact JWS with an **included** payload, whose
payload is the JCS rendering of a signed statement binding profile + version, the reused receipt
contract `$id` + version, the canonicalization id, `receipt_id`, `receipt_digest`, `kid` and
`signed_at`. EdDSA over Ed25519 only. Protected-header key set exactly `{alg, kid, typ}`.
`signature_locator` is the SHA-256 of the exact compact JWS bytes, and it is the string the
receipt's own `signature` field carries.

### 3.1 Why the profile id is inside the hash input

`INFERENCE`. Putting the profile id *beside* the digest (as a sibling field) lets an attacker who
controls the envelope relabel a digest as having been produced under a different, weaker recipe.
Putting it *inside* the hash input, separated by a byte that cannot occur in JCS output, makes the
recipe part of what was signed. The NUL separator is what stops
`profile="A", bytes="B..."` from colliding with `profile="AB", bytes="..."`.

### 3.2 Why the payload is included, never detached

`RESEARCH` (RFC 7515 / RFC 7797, carried access date 2026-07-24) plus `INFERENCE`: a detached
payload or `b64=false` means the bytes a verifier hashes are supplied out of band, so the same
signature can be presented alongside different bytes depending on what the surrounding system
happens to hand over. For a *receipt*, whose entire job is to be the durable record, that is a
disqualifying property. R-C1.

## 4. Options considered

| Option | R-C1 | R-C2 | R-C3 | R-C4 | R-C5 | R-C6 | Note |
|---|---|---|---|---|---|---|---|
| **A. Compact JWS + JCS (this proposal)** | met | met by exact-key-set rule | met by pinning one alg | met — vector reproduced below | met | met — no new wire format | Widest tooling; JOSE's own footguns must be closed by rule, and are |
| B. COSE / RFC 9052 | met | met | met | not reproduced here | met | **fails** — adds CBOR to a JSON-pinned corpus | Better default posture; `RESEARCH` only, not prototyped |
| C. in-toto-style statement | met | met | met | not reproduced here | met | partial | Strong provenance story; heavier, and its envelope question recurses |
| D. Detached signature over `receipt_digest` alone | **fails** R-C1 | met | met | met | met | met | Signing a digest without binding the recipe lets a re-canonicalized receipt verify |

Option B is *not* scored down on security. It is scored down on exactly one criterion — R-C6 — and
that is a corpus-consistency argument, not a cryptographic one. A reviewer who weighs format
minimalism differently should reach a different answer, and this document does not pretend
otherwise. **No COSE or in-toto implementation was built or measured here**; rows B and C are
`RESEARCH`, and comparing an implemented option against two unimplemented ones is the central bias
in this table.

## 5. Evidence produced

### 5.1 The frozen vector is cryptographically reproducible

`FACT` (reproduced locally on 2026-07-31 against `node:crypto`): the packet freezes one receipt, one
signed statement, one compact JWS, and one locator. The test suite re-derives the Ed25519 key at
runtime from `SHA-256("CYBRIK-F8-TEST-ONLY-ED25519-SEED/v1")`, re-signs the statement from scratch,
and asserts the result is **byte-identical** to the frozen JWS; the validator independently verifies
that JWS under the public JWK alone. The `kid` is checked to be the thumbprint of that same key, so
the identifier and the key cannot drift apart.

**The signing key is TEST-ONLY and is not a credential.** Its private half is recomputable by anyone
who reads the seed label, which is the point: it makes the fixture reproducible with **no PEM, no
PKCS#8 file, and no secret anywhere in the tree**. That kid must never appear in a real trust
bundle.

The five envelope fixture files encode the first ASCII `e` of `jws_compact` as the equivalent JSON
source escape `\u0065`. JSON parsing therefore yields the exact compact JWS bytes used for signing,
verification and locator hashing, while the source file does not trigger gitleaks' generic JWT
lexical detector. The focused test re-signs and byte-compares the parsed value, and the full-tree
secret scan remains active for every actual secret rule.

### 5.2 An absent array is not an empty array

`FACT` (reproduced locally): with `output_artifacts` absent the frozen receipt digests to
`sha256:39ded94c…`; with `output_artifacts: []` explicitly present it digests to `sha256:7d60a76a…`.
Both values are pinned in the examples manifest and both are recomputed on every run.

This matters more than it looks. If the profile materialized the schema default before hashing, then
"the control plane observed no output artifacts" and "the control plane observed an empty list of
output artifacts" would sign to the same digest — and a defaults-normalized *rewrite* of a receipt
would verify against the original signature. R-C1 fails silently in exactly the way that is hardest
to notice after the fact.

### 5.3 The rejection inventory rejects

`FACT` (reproduced locally): seven rules — canonicalization, locator, header grammar, algorithm,
embedded/remote keys, payload tampering, signature tampering — each exercised by at least one
mutation probe, twenty probes in total. Four are additionally frozen as on-disk negative fixtures
(`wrong-canonicalization`, `alg-none`, `embedded-jwk`, `tampered-payload`), and each fixture declares
the **exact** set of rules it must trip; the validator fails if the fired set differs in either
direction, so a rule cannot quietly stop firing.

### 5.4 A finding about an accepted schema

`FACT` (reproduced locally): `cybrik.execution-receipt.v1` writes its conditional requirement as a
bare `then: {"required": ["target_digest"]}` with no sibling property annotation. This is **fully
JSON Schema 2020-12 conformant**; only Ajv's *optional* `strictRequired` house rule objects. The test
suite therefore relaxes that one option — and only that one — when compiling the accepted schema, so
the frozen receipt is checked against the real accepted bytes rather than a copy. Repairing the
accepted schema is out of scope and would change accepted bytes. This is the same class of finding
recorded for the Investigation Bundle under W1-REC-3/4.

## 6. What a valid signature does NOT prove

`PROPOSAL`, and the section this document most wants read. R-C7.

**A receipt is a control-plane observation of an execution, not an executor attestation about one.**
The control plane signs what *it recorded*. An executor contributes evidence that the control plane
then writes down. A verified signature therefore proves that the control plane recorded these bytes
and that they have not changed since. It does **not** prove that an executor behaved as the receipt
describes, that the command in it actually ran, or that its outputs are what a sandbox really
produced. Reading executor behaviour out of a control-plane signature is the specific
over-reading this profile is trying to make hard, and no check in the packet can prevent it —
only this sentence can.

Nor does signature validity say anything about **authorization**. Who was allowed to run the action
remains the policy decision, the approval, and the digest-bound delegation chain that the receipt
binds. A perfectly valid signature over a receipt for an unauthorized action is still a receipt for
an unauthorized action.

## 7. Future prerequisites (`UNKNOWN`, all open)

None of these is addressed by any check in this packet. They are prerequisites for *implementing*
the profile, not follow-ups to it.

1. **Credential lease** — ADR-0004 F5 single-use, scoped, short-lived leases are not designed or
   built. The receipt already carries `credential_lease_id_hash`, but nothing mints, scopes, or
   expires the lease it hashes; today the field is an unbacked promise, and signing it proves only
   that the control plane wrote that hash.
2. **Workload attestation** — ADR-0004 F4 is deferred. `executor.id` is a SPIFFE-shaped string the
   control plane *recorded*, not an identity cryptographically proven at execution time. Until
   attestation exists, a receipt binds which executor the control plane *believed* it dispatched to.
3. **Production issuer and signer** — no issuer, signing service, HSM/KMS placement, availability
   posture, or signing-authorization policy is selected. The only key in this packet is the TEST-ONLY
   value of §5.1.
4. **Key lifecycle** — generation, rotation, revocation, trust-bundle distribution and freshness,
   verification of historical receipts across a rotation, and compromise recovery are **entirely
   undesigned**. This is the largest single gap: the profile pins how a signature is *shaped* and
   says nothing about how the key behind it is *governed over time*. A profile decision taken
   without a lifecycle plan buys less than it appears to.
## 8. RECOMMENDATION

`PROPOSAL`. Take this packet as **one concrete candidate** for the F8 envelope, and read the green
validator as evidence of *internal consistency and reproducibility only*. If the Codex Governor,
acting under the active delegated-governor authority, requires a comparison rather than a
candidate, the honest next step is a COSE packet of the same shape — same frozen vector, same
rejection inventory — so two implemented options can be compared instead of one implemented option
against two descriptions.

Consequences of following this recommendation: the suite gains a reviewable, reproducible envelope
candidate and a resolved answer to the default-injection gap in §5.2; it does **not** gain a
decision, a signer, a key lifecycle, or any implementation. Prerequisite #4 in particular should be
designed **before**, not after, any implementation of whatever envelope is chosen.

## 9. Delegated technical decisions still required

These decisions belong to the Codex Governor under
`docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`. This proposal takes none of them.
Production remains Founder-controlled.

1. **F8-Q1** — Adopt a JWS-shaped envelope, or require a COSE / in-toto packet of equal depth before
   choosing? (A: JWS as proposed / B: require comparison packets first / C: neither)
2. **F8-Q2** — Accept RFC 8785 JCS as the canonicalization? (yes/no)
3. **F8-Q3** — Accept a hex-rendered RFC 7638 thumbprint as `kid`, diverging from the base64url
   rendering the RFC specifies, in exchange for a single-character-class grammar? (yes/no)
4. **F8-Q4** — Accept Ed25519-only with **no** in-band algorithm agility, so migration is a profile
   version rather than a runtime negotiation? (yes/no)
5. **F8-Q5** — Open a design gate for key lifecycle and trust-bundle distribution (§7 items 3 and 4)
   **before** any implementation of the chosen envelope? (yes/no)

## 10. Evidence limitations

1. **No alternative was built.** COSE and in-toto are `RESEARCH` rows in a table scored against one
   implemented option. This is the strongest bias in the document.
2. **No external URL was accessed on 2026-07-31.** Standards claims are carried from the
   ADR-0004-EVIDENCE source register (accessed 2026-07-24) and are labelled `RESEARCH`, never `FACT`.
3. **No interoperability test.** The frozen vector was produced and verified by `node:crypto` only.
   It has not been checked against an independent JOSE library, and the hex-rendered `kid` (§9 F8-Q3)
   is exactly the kind of divergence an interoperability test would surface.
4. **JCS is not independently validated.** Canonicalization reuses the corpus' existing JCS renderer;
   it was not tested against an RFC 8785 conformance suite, and its number-formatting behaviour in
   particular rests on the host `JSON.stringify`.
5. **No threat model was written.** The rejection inventory is a list of attacks this profile blocks,
   assembled from known JOSE failure modes. It is not the output of a systematic threat-modelling
   exercise, and absence from the inventory is not evidence that an attack was considered.
6. **Nothing was measured.** No signing throughput, no verification latency, no receipt-size impact.
7. **The four §7 prerequisites are untouched.** A green validator says nothing about any of them.
8. **Receipt-ledger durability remains an open runtime obligation.** The ledger behind
   `cybrik-ledger://` is a name, not a system. Durability, append-only guarantees, retention, and the
   strategy 05 §11.8 rule that receipt/audit write failure must block R2/R3 side effects are
   unimplemented, so a valid signature currently implies nothing about whether the receipt was
   durably recorded.
