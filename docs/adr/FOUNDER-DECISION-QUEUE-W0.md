# Founder Decision Queue — Wave 0 critical path

- **Prepared:** 2026-07-26
- **Status:** `BUNDLE A/B RECORDED — A1/A2 REVIEWED — SUITE A3 COMMIT AUTHORIZED`
- **Release impact:** none; this queue changes no W0–W6 date and authorizes no push, merge,
  publication, deployment or release action.

This queue records the explicit Founder Bundle A and Bundle B answers received on 2026-07-26. It
does not replace the packets' evidence, boundaries, or required follow-on validation/review, and
it grants no push/merge/release authority.

## 0. Recorded decision evidence

- Decided by: **Founder**
- Decided on: **2026-07-26**
- Recorded by: **D0 Suite docs-only decision recorder**
- Exact answer:

```text
Duyệt W0 Bundle A: W0-I01=A (G-W0I01-1..5=yes); W0-I02/I03=A conditional on completed W0-I01 acceptance (G-W0I23-1..5=yes); W0-I07B=A (G-W0I07B-1..5=yes); W2-I path ownership=A (G-W2I-1..5=yes); MARK-001=A (G-MARK-1..8=yes).
```

Immediate control effect:

1. D0 records and validates the decision, then stops.
2. W0-I01 lifecycle/application and the one-file W0-I07B strict Fabric RED may start at `2/4`
   writers after D0 review.
3. W0-I02/I03 remains dependency-blocked until completed W0-I01 acceptance; after that, I02 RED
   precedes independent review and I03 GREEN.
4. W2-I remains proposed under the W2-D single-owner rule.
5. MARK-001 remains open; only its preparation sequence is authorized.

## 1. Recommended decision bundle

| Order | Decision | Recommended answer | Immediate effect |
|---|---|---|---|
| 1 | [W0-I01 Investigation contract packet](FOUNDER-DECISION-PACKET-W0-I01.md) | Option **A**; G-W0I01-1..5 = **yes** | Authorizes a separate evidence-linked status-flip/application change; does not itself alter accepted bytes |
| 2 | [W0-I02/I03 SOC consumer slice](FOUNDER-DECISION-PACKET-W0-I02-I03-CONSUMER-SLICE.md) | Option **A**; G-W0I23-1..5 = **yes**, conditional on completed I01 acceptance | Opens sequential I02 RED/provenance review, then I03 pure simulated consumer GREEN; no route/DB/UI/runtime |
| 3 | [W0-I07B capability-name canonicalization](FOUNDER-DECISION-PACKET-W0-I07B.md) | Option **A**; G-W0I07B-1..5 = **yes** | Classifies the lexical correction as pre-GA patch v0.1.1 and permits a separate coordinated application packet |
| 4 | [W2-I inference path ownership](FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md) | Option **A**; G-W2I-1..5 = **yes** | Keeps W2-D as sole operation owner; any transport binding must enter through a later compatible revision/supersession |
| 5 | [MARK-001 authoritative marking and redaction binding](FOUNDER-DECISION-PACKET-MARK-001.md) | Option **A**; G-MARK-1..8 = **yes** | Opens proposal packets and later parallel SOURCE/PROFILE prerequisites; does not itself close MARK-001 or authorize migrations |

## 2. Dependency and authority boundary

1. W0-I01 must be explicitly decided first.
2. W0-I02/I03 remains conditional until the I01 status-flip/application evidence is complete.
3. I02 and I03 run sequentially: I02 writes RED/provenance evidence, an independent reviewer
   accepts that RED boundary, and only then may I03 write the pure simulated consumer.
4. W0-I07B approval does not apply v0.1.1. A strict product RED, coordinated suite/Fabric snapshot
   update, rollback evidence, cross-runtime validation, and separate status flip remain required.
5. W2-I approval resolves ownership only. It does not accept the current W2-I proposal or alter
   accepted W2-D OpenAPI bytes.
6. No answer below grants commit, merge, push, publish, deployment, credential, or release-date
   authority.
7. MARK-001 approval opens preparation/implementation sequencing only. Exact QD-13 mapping values,
   production profile bytes, contract status flip, migration execution, and final closure each
   retain their own gates.

## 3. Copy/paste Founder answer

The Founder approved the recommended bundle with this single exact response:

```text
Duyệt W0 Bundle A: W0-I01=A (G-W0I01-1..5=yes); W0-I02/I03=A conditional on completed W0-I01 acceptance (G-W0I23-1..5=yes); W0-I07B=A (G-W0I07B-1..5=yes); W2-I path ownership=A (G-W2I-1..5=yes); MARK-001=A (G-MARK-1..8=yes).
```

The one-line response is an explicit shorthand for every named gate value above; it grants
no merge/push/release authority and does not waive any post-decision evidence. Alternatively, the
Founder may use the expanded equivalent:

```text
W0-I01: Option A
G-W0I01-1: yes
G-W0I01-2: yes
G-W0I01-3: yes
G-W0I01-4: yes
G-W0I01-5: yes

W0-I02/I03: Option A, conditional on completed W0-I01 acceptance
G-W0I23-1: yes
G-W0I23-2: yes
G-W0I23-3: yes
G-W0I23-4: yes
G-W0I23-5: yes

W0-I07B: Option A
G-W0I07B-1: yes
G-W0I07B-2: yes
G-W0I07B-3: yes
G-W0I07B-4: yes
G-W0I07B-5: yes

W2-I path ownership: Option A
G-W2I-1: yes
G-W2I-2: yes
G-W2I-3: yes
G-W2I-4: yes
G-W2I-5: yes

MARK-001: Option A
G-MARK-1: yes
G-MARK-2: yes
G-MARK-3: yes
G-MARK-4: yes
G-MARK-5: yes
G-MARK-6: yes
G-MARK-7: yes
G-MARK-8: yes
```

The decision is now recorded. Each required follow-on change still needs its own implementation,
validation, independent review and any separately named status-flip/application authority; all
underlying contract and release lifecycles remain as stated in their decision packets.

## 4. Follow-on Bundle B

Bundle A's authorized worktree evidence is complete and independently reviewed:

- W0-I01 has a clean 12-entry application allowlist and green standalone/aggregate regression
  evidence, but is not yet integrated into the canonical Suite repository;
- W0-I07B has a strict product RED and revision-bound 4/4-valid, 0-invalid fixture/snapshot
  inventory, but v0.1.1 is not yet applied.

The separate canonical-application/provenance decision is:

- [W0 Bundle B canonical applications](FOUNDER-DECISION-PACKET-W0-BUNDLE-B-APPLICATIONS.md)

It resolves the previously ambiguous per-member hash and packet-snapshot version semantics,
requires exact path-bounded Suite and Fabric commits, and grants no push/merge/release action.

### 4.1 Recorded Bundle B decision

- Option: **A — bounded canonical application**
- G-W0BB-1..10: **yes**
- Decided by: **Founder**
- Decided on: **2026-07-26**
- Authorized commits: exactly two local path-limited provenance commits, ordered Suite A3 then
  Fabric A4.
- Exact answer:

```text
Duyệt W0 Bundle B=A (G-W0BB-1..10=yes); cho phép 2 local path-limited provenance commits; không push/merge/release
```

The authorized execution order is
`I01 → I07B Suite → Suite commit → (I02 RED || Fabric I07B GREEN) → I03 → T10`.
All post-application validators, exact-path audits and independent reviews remain mandatory.

### 4.2 A2 byte-pin correction gate

Execution proved that the approved `278c8837...a71f7` digest is the pre-guard file and still
accepts the trailing-LF defect under Python jsonschema. The required guarded bytes hash to
`7858dc75...cc6155`. A2 is paused before manifest update, staging and commit pending the exact
Founder correction recorded in
`FOUNDER-DECISION-PACKET-W0-BUNDLE-B-APPLICATIONS.md` §7. A1 remains independently reviewed and
green; the two-commit limit, all path allowlists and every release boundary remain unchanged.

The Founder approved the narrow correction on 2026-07-26: replace `278c8837...a71f7` with the
guarded-byte digest `7858dc75...cc6155`, retain the exact `not` guard and all
G-W0BB-1..10=yes, and do not expand scope, commit, push, merge or release authority. A2 may resume
under the original ordered Bundle B execution.

### 4.3 A1/A2 reviewed result

A1 and A2 have passed their exact validators and independent reviews with no remaining P0–P3.
A3 is authorized only as the exact 46-path local Suite provenance commit defined by the Bundle B
packet. I02 and Fabric A4 remain undispatched until that immutable Suite source commit exists.
