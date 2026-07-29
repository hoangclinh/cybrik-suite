# W0-B05 inference-plane transport binding — `r3` control-side evidence

Status: `REVIEWED LOCAL UNCOMMITTED PROPOSAL/REPAIR — NOT ACCEPTED — NOT INTEGRATED — NOT CANONICAL — NOT PUSHED/MERGED/RELEASED — GATE W2-I NOT OPENED`

Recorded 2026-07-29 in the control repository, on control base
`eedadc561700d3e1fa052322d44eb63151df0009`. Board §18, register §30.

**Control-record repair state, 2026-07-29.** An independent review of *this control record* —
run `e795221d-6cdb-43ac-a2f5-6844438210dc`, `claude-opus-5`, read-only — returned **`FAIL`** with
**`P0 = 0`, `P1 = 1`, `P2 = 1`, `P3 = 2`**. The `P1`, `P2` and both `P3` findings are remediated in
this revision; the failed review is preserved as dated history and is **not rewritten as `PASS`**.
**A fresh independent re-review is `PENDING`. This control record is not `PASS` and claims no
`PASS`.** Full disposition in §10.

---

## 1. Three objects, never conflated

This record exists because three different things are routinely collapsed into one another, and
collapsing them here would misstate the gate.

| Object | What it is | What it is **not** |
|---|---|---|
| **Proposal bytes** | the `W0-B05` lane's 38-path working tree in `cybrik-worktrees/w1-48/w1-b05-transport-correction-r2` — an uncommitted, locally reviewed transport-binding **proposal and repair** | not a contract, not an accepted profile, not a merged or released artifact, not a runtime behaviour |
| **Control evidence** | this file: an external, control-side measurement of those bytes, plus the lane- and reviewer-supplied statements that this repository cannot itself verify | not the proposal, not a copy of the proposal, not an authority to act on the proposal |
| **Acceptance** | **has not occurred** for any of this | — |

**Gate W2-I is not opened by this record.** No acceptance, no integration, no canonicalization, no
runtime claim and no release claim is made or implied anywhere below. Recording a measurement is
not promoting what was measured.

---

## 2. Live writer measurements — `W0-B05` source lane

Everything in §2 and §3 was **measured live by this control writer** on 2026-07-29 against the
sibling worktree. The measurements themselves were taken with read-only commands — but the
authoring run is **not** entitled to the unqualified claim "using read-only commands only", and
this record no longer makes it. One **forbidden attempted Node execution** occurred with the source
lane as working directory and **failed module-not-found before any validator or test was loaded**.
That process/authority boundary breach, and its independently re-derived **nil** impact, are
disclosed in §10.2 rather than hidden here.

Nothing in the source lane was edited, staged, created, removed, formatted, validated or otherwise
disturbed: **no `W0-B05` test, validator or formatter ever loaded or ran.**

| Item | Live writer measurement |
|---|---|
| Worktree | `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-b05-transport-correction-r2` |
| Branch | `codex/w1-b05-transport-correction-r2` |
| `HEAD` | `55e94c2815ee68ef49a6e10cdc41a76c227b7bd7` |
| Working-tree paths | **exactly 38** — 5 modified tracked, 33 untracked |
| Staged paths | **0** |
| Commits ahead | **0** — the branch has no configured upstream, and no lane commit exists beyond `HEAD` |
| Task identity | `W0-B05`; the lane remains `W0-B05` and no task 49 exists |

`git status --porcelain` collapses untracked directories; the 38-path figure is the expanded
`-uall` enumeration, which is the only enumeration this record uses.

### 2.1 Live per-path measurement — all 38 paths

`M` = modified tracked, `??` = untracked. SHA-256, line count and byte count are this writer's live
measurements of the on-disk bytes.

| # | St | Path | SHA-256 | Lines | Bytes |
|---:|---|---|---|---:|---:|
| 1 | `??` | `contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json` | `566fb87b7fa31faa2aabd015d208b8356c2ec4c0cf930593adf3cc032a472943` | 401 | 42026 |
| 2 | `??` | `contracts/examples/transport/examples-manifest.json` | `f994f414febb0052ec4f380c7f89c2b77a021a9c982d96ddf6e1bf996b4f212a` | 33 | 11458 |
| 3 | `??` | `contracts/examples/transport/negative/inference-transport-binding.audience-mismatch.json` | `8539a81ae1b82a36c2ae883af6b0b449c50875e130e65abd47e4085f2c47096a` | 96 | 2685 |
| 4 | `??` | `contracts/examples/transport/negative/inference-transport-binding.feature-disabled-served.json` | `51190ee5e52da2ce9c5774e8f8f46b0deb292680fd2bced3d5e60ac675f88ca3` | 96 | 2693 |
| 5 | `??` | `contracts/examples/transport/negative/inference-transport-binding.forwarded-user-token.json` | `96fe2f6fa91f8445b799ac8eee08040e6b1340b94d58b21b955f38e244cd3337` | 97 | 2744 |
| 6 | `??` | `contracts/examples/transport/negative/inference-transport-binding.marking-escalation.json` | `3884ebcfd2e495ab3851e8177831d7ca7073e6ab37ba2efa2577db18fd50fd86` | 96 | 2688 |
| 7 | `??` | `contracts/examples/transport/negative/inference-transport-binding.model-authority.json` | `e99dcfcdd41c72e9f1b82a8a45b2bd951cec1562e3c44738b57dce2e6c65e884` | 100 | 2766 |
| 8 | `??` | `contracts/examples/transport/negative/inference-transport-binding.non-mtls.json` | `4ae589cd1be7a50853fd6e6d0a69e72829e34cccb83aa02706c37e982fa8fb9f` | 96 | 2696 |
| 9 | `??` | `contracts/examples/transport/negative/inference-transport-binding.operation-mismatch.json` | `3a22f2f7507566666c396a1f17a7630a8e733dcb53d363f27e8176b6b5987f8f` | 96 | 2694 |
| 10 | `??` | `contracts/examples/transport/negative/inference-transport-binding.org-mismatch.json` | `92120814d5b7062ee2781a25f98409096ede2bbb73c00801a19ef36139a208e3` | 96 | 2693 |
| 11 | `??` | `contracts/examples/transport/negative/inference-transport-binding.pop-mismatch.json` | `a93eaf32b3ddc1389ac736d0008c035032c7d75f52a401282c2b7f04465b732c` | 96 | 2691 |
| 12 | `??` | `contracts/examples/transport/negative/inference-transport-binding.replay.json` | `00da25f6a11c80c7865fa57482a93835e8cc149ea8b966a6ada73fde3c3d7815` | 96 | 2694 |
| 13 | `??` | `contracts/examples/transport/negative/inference-transport-binding.short-idempotency-key.json` | `4c7d3ff5ba08858eb423e94d8b691080b78f3cbab75766c70cf615c9b22db2cb` | 96 | 2679 |
| 14 | `??` | `contracts/examples/transport/negative/inference-transport-binding.symmetric-token.json` | `d80504eb208ebd5abc823c16b30610d26a88822c38dc72606c682be7939f6362` | 96 | 2696 |
| 15 | `??` | `contracts/examples/transport/negative/inference-transport-binding.tenant-mismatch.json` | `e75ae81c5f80f66cb615ef507b41b9137f1b6a3ab736be14802f01dbca93f276` | 96 | 2698 |
| 16 | `??` | `contracts/examples/transport/negative/inference-transport-binding.unsafe-retry.json` | `1e4b89b071a90db2a27ac64c5e381635c4da569fff5177822ae1a11be70d263b` | 96 | 2700 |
| 17 | `??` | `contracts/examples/transport/negative/transport-authorization-error.bad-status.json` | `f0632a23f2b9f10f3810f42b8a93405e2a27432d1b8aeb29068b7b60f52d0b29` | 8 | 176 |
| 18 | `??` | `contracts/examples/transport/negative/transport-authorization-error.fail-closed-false.json` | `8e93a5f3edba66fdfc9617513c7bc51df3e0e47bbce25ce1698817cb46a01b53` | 8 | 183 |
| 19 | `??` | `contracts/examples/transport/negative/transport-authorization-error.leaked-token.json` | `0f8e577c4121ef487e6bf2f8a0e617196266c2b9454e4845ff9f257cd81c29b2` | 9 | 220 |
| 20 | `??` | `contracts/examples/transport/positive/inference-transport-binding.json` | `aebe3c1d7c9014b989a1a6fe28b898f12d97f327c40c118139d3792245a82b66` | 96 | 2692 |
| 21 | `??` | `contracts/examples/transport/positive/model-class-health-transport-binding.json` | `5a6a976ad439f67eb58bb1820e076885a0bd25374e2e607187d824c5ec52975e` | 88 | 2488 |
| 22 | `??` | `contracts/examples/transport/positive/model-classes-transport-binding.json` | `0d711a28ac222422bf56d19d9c03ed6dd489c208041bb25fdecabdc250b917ef` | 88 | 2442 |
| 23 | `??` | `contracts/examples/transport/positive/summarization-transport-binding.json` | `767c18e90247d62783d858f140326520d3eb12cdf9d5216422a00c079aa10e59` | 96 | 2719 |
| 24 | `??` | `contracts/examples/transport/positive/transport-authorization-error.json` | `5f907f21a2a54b08e6e9e73e2af9d7caa78e7511d83a45aa6f37ca22642d938b` | 10 | 438 |
| 25 | `??` | `contracts/json-schema/cybrik.inference-transport-binding.v1.schema.json` | `7e6324321658d886cd95d5dfa6febb57b01992d7fb3ae0f8db24d96f75e986da` | 148 | 9899 |
| 26 | `??` | `contracts/json-schema/cybrik.transport-authorization-error.v1.schema.json` | `1e548a5b12311e892f8333410689d3cad2af477414eff13b2c3850116c7a0601` | 47 | 3398 |
| 27 | `??` | `contracts/json-schema/cybrik.transport-common-defs.v1.schema.json` | `c12ab37da66485b7cefb1aae3a926c40f23b0030ab17c04fbf68a76380394cda` | 171 | 10733 |
| 28 | `??` | `contracts/openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml` | `f5f01efaaafebe725b635c31fc249d7b06fd49cfed7287f47d98b9bf18f7b6ba` | 349 | 18885 |
| 29 | `??` | `docs/adr/ADR-0011-inference-plane-transport-binding-profile.md` | `f6ec77f8d62db6577988cd57a439d5fca507a97f8ec24f872f120adc1216211d` | 352 | 26764 |
| 30 | `??` | `docs/adr/FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md` | `96f1a58cba2d72588d02a37d34ac4059251ca1e8e124de7651f37d3b286ff07f` | 84 | 4776 |
| 31 | `M` | `docs/adr/README.md` | `b5edb777f9e4fa25d7985a168aa319845689ec12b2355705729017e9f1e4697e` | 50 | 5163 |
| 32 | `??` | `docs/releases/GATE-W2-I-INFERENCE-TRANSPORT-SUCCESSOR-PROPOSAL-2026-07-28.md` | `5151eda3c492adf90863d1475a68fdb809c735ef4c45325402826f3578d67b7c` | 920 | 78110 |
| 33 | `M` | `docs/releases/README.md` | `c19e286a6f3df2ec7dec5a0bd9f779e8a8d9c972279f88e311f6a30c1e0593c6` | 22 | 2906 |
| 34 | `M` | `tools/contract-validation/package.json` | `bd8a3fe3a0d3efa281887af81d56365207cc2b17344ba0f768947f5a50efa6f9` | 28 | 1010 |
| 35 | `??` | `tools/contract-validation/tests/validate-transport.test.mjs` | `b2d722e28ca58776863c36425a8dee741ba1ca7fc591fe74ba169e37d8546efc` | 4250 | 271026 |
| 36 | `M` | `tools/contract-validation/validate-openapi.mjs` | `71fc038cb3d96761abd47e43a83493f0ab68e6891a02667cb561e71b447e12e7` | 33 | 2017 |
| 37 | `??` | `tools/contract-validation/validate-transport.mjs` | `19c0fb5c4a058d9d03c5cfd03685ed59d3e6baa33e08cad8ec4e038f066186f3` | 1288 | 104470 |
| 38 | `M` | `tools/contract-validation/validate.mjs` | `0a13029a242f1a05cf80361b4a04e22ae09ff7b1ea97ca1f0407c0921294fd00` | 28 | 2368 |

**The 38-path list above contains no `W1-C1` path and no `W1-C1` repin.** No alert-context path,
no accepted-baseline artifact and no candidate-correction path appears in the `W0-B05` lane. The
`W1-C1` accepted baseline and its separate local-only correction candidate are untouched by this
record, and nothing here re-points, re-bases or re-measures them.

### 2.2 Aggregate over the 37 non-recorder paths

| Item | Live writer measurement |
|---|---|
| Recorder path | `docs/releases/GATE-W2-I-INFERENCE-TRANSPORT-SUCCESSOR-PROPOSAL-2026-07-28.md` |
| Recorder SHA-256 | `5151eda3c492adf90863d1475a68fdb809c735ef4c45325402826f3578d67b7c` |
| Recorder size | 920 lines, 78110 bytes |
| Frozen transport test SHA-256 | `b2d722e28ca58776863c36425a8dee741ba1ca7fc591fe74ba169e37d8546efc` |
| Frozen transport test size | 4250 lines, 271026 bytes |
| Non-recorder path count | **37** — the 38 lane paths minus the recorder |
| Aggregate label | `SCOPE-AGG-SHA256/v1` |
| Aggregate value | `e2bdf10199e533d611765b8038953a801da599d855073e9389667a3f1caa561e` |

**Recipe, stated so the value is independently reproducible.** Take the 37 non-recorder
worktree-relative paths in **ascending byte order**; for each, concatenate
`sha256hex + "  " + path + "\n"` (two spaces between digest and path, one trailing newline per
entry); SHA-256 the resulting stream. The recorder is excluded because it is the lane's own
narrative artifact and would otherwise fold a document *about* the scope into the scope's own
identity.

**No aggregate over this control record's own paths is stated anywhere.** A record cannot contain
a content digest of itself; the four control paths written by this record are enumerated in §7 and
are deliberately left unaggregated. External re-measurement after the fact is the only sound way
to obtain such a value, and this record does not pre-mint one.

---

## 3. What this repository measured versus what it was told

The distinction below is the load-bearing part of this record. Everything in §2 is a **live
control-side measurement of tree state, hashes, sizes and run metadata**. Everything in §3.1 is
**lane-reported and independently-reviewer-confirmed** — it is *not* control-measured, and this
record never calls it control-measured.

### 3.1 Lane-reported, reviewer-confirmed — not control-measured

| Claim | Provenance |
|---|---|
| 197 / 197 transport tests pass | `W0-B05` lane-reported; independent reviewer confirmed |
| Transport validator run reports pass | `W0-B05` lane-reported; independent reviewer confirmed |
| `validate.mjs` seven steps pass | `W0-B05` lane-reported; independent reviewer confirmed |
| Spectral over **3 OpenAPI documents**: **0 errors and 33 warnings total**; the successor document carries **14** of those 33 warnings | lane-reported and independently reviewer-confirmed, not control-measured |
| Of the successor's 14 warnings, **8** are `oas3-unused-component` observations arising from **YAML anchor/alias reuse** | lane-reported and independently reviewer-confirmed, not control-measured |
| Warnings are **permitted at `--fail-severity=error`**, so the run does not fail on them — **but they are not zero** | lane-reported and independently reviewer-confirmed, not control-measured |
| Diff-check clean | `W0-B05` lane-reported; independent reviewer confirmed |

**`P1-1` factual correction, 2026-07-29.** An earlier revision of this record stated
`Spectral 0 errors and 0 warnings` / `Spectral 0/0`. **That claim was false.** The truthful carried
evidence is **3 OpenAPI documents, 0 errors, 33 warnings total**, of which the successor document
carries **14**, and **8 of those 14** are `oas3-unused-component` observations from YAML
anchor/alias reuse. Warnings are permitted at `--fail-severity=error`; **they are not zero**. The
correction is applied here, in board §18, in register §30 and in the `docs/operations/README.md`
catalog row. The evidence stays labelled **lane-reported and independently reviewer-confirmed, not
control-measured**.

No transport test, transport validator, `validate.mjs` step, Spectral run or diff-check **loaded or
ran** under this control repository's authority — not in the source lane, not anywhere else. One
**forbidden attempted Node execution** with the source lane as working directory did occur during
the authoring run and **failed module-not-found before loading or running any validator or test**;
see §10.2. Running such tooling in the source lane was forbidden and would have mutated the very
tree this record exists to measure. The rows above are therefore reported evidence carried at
second hand, and are not upgraded by appearing here. **No pass, error or warning figure in this
record is a control measurement.**

### 3.2 Run metadata — repair runs

Run metadata is live control-side fact: these identifiers, models, outcomes and capture flags were
observed directly, not reported by the lane.

| Run | Role | Model | Outcome | `contentCaptured` |
|---|---|---|---|---|
| `9197a6ba-cb7f-4978-aef0-0bb248010f9f` | initial repair writer | `claude-opus-5` | **timeout** | `false` |
| `ceae84f5-71cf-4971-83f5-fcfeffd639f4` | the one final repair continuation | `claude-opus-5` | **timeout** | `false` |

Both repair runs ended in timeout with `contentCaptured=false`, so **no writer transcript was
retained for either**. Exactly one continuation was taken; there was no third repair run. The
coordinator **subsequently re-ran the evidence** to obtain the state recorded here — which is why
the measurements in §2 exist at all despite both writer runs producing no captured content.

### 3.3 Run metadata — independent review

| Run | Role | Outcome |
|---|---|---|
| `24c044bd-aadf-4e0d-a24f-39a008370d02` | initial read-only independent review | **timeout** |
| `7d5fd2cb-2ec6-4f7a-8c59-97535e970d0d` | the one allowed review continuation | **completed** |

The continuation completed with verdict **`PASS` against the current `r3` state**, with
**`P0 = 0`, `P1 = 0`, `P2 = 0`** and **three `P3` findings**. Exactly one continuation was allowed
and exactly one was used.

**That review covered the `W0-B05` proposal bytes. It did not review this control record.**

---

## 4. Retained `P3` findings — not closed, not waived, not regraded

All three `P3` findings are **retained open at `P3`**. This record closes none of them, waives none
of them and regrades none of them.

| ID | Finding | Disposition |
|---|---|---|
| `P3-1` | The ADR README wording should be narrowed so the deliberate gap is stated as being to `ADR-0010` specifically; **no `ADR-0009` backfill** is called for or implied | **retained open** |
| `P3-2` | There is **no conventional `npm test` / CI wiring** for the transport suite | **retained open** |
| `P3-3` | The **original RED transcript is absent**. Only a continuation-start observation of **197 / 194 / 3** and a final **197 / 197** were witnessed. The local run used **Node v26** against a CI pin of **20.18.1**, and that CI configuration was **not run**. There is **no reviewed head, no secret scan, no commit, no integration, no runtime, no UAT and no release evidence** | **retained open** |

`P3-3` in particular is the reason §3.1 exists: the pass figures are witnessed at second hand, the
first RED state was never captured, and the environment that would matter for CI was never
exercised.

---

## 5. Why the recorder is not imported into this repository

The lane recorder `docs/releases/GATE-W2-I-INFERENCE-TRANSPORT-SUCCESSOR-PROPOSAL-2026-07-28.md`
is **deliberately not copied, imported or mirrored** into the control repository.

1. **It is the 38th path of the `W0-B05` lane and its canonical lane home.** The recorder lives in
   the lane it describes; that is where its provenance is well-defined.
2. **Importing it would create a second provenance chain.** Two byte-identical copies in two
   repositories immediately raise the question of which one is authoritative, and any later drift
   in either produces a silent fork of the same evidence.
3. **A control-side copy invites gate-status misreading.** A `docs/releases/`-shaped recorder
   sitting inside the control repository reads as a release-track artifact of the suite. It is
   not. Gate W2-I is not opened, and the recorder must not acquire that appearance by relocation.

**The evidence-file precedent is the correct one.** The control repository records *about* the
lane — measurement, provenance, review outcome, status and posture — and points at the lane bytes
by path and digest rather than reproducing them. That is what this file does, and it is why §2.1
pins every path by SHA-256, line count and byte count instead of embedding content.

---

## 6. Supersession and standing locks

**This record supersedes nothing.** It withdraws, amends, replaces, relaxes and overrides no prior
board section, register section, packet, grant, ADR, contract or gate disposition.

**Board §14.32.3 — the downstream alert-context transport provenance-stale lock — stays in force,
unchanged and unqualified.** Nothing in the `W0-B05` lane touches it, and nothing in this record
narrows it.

`W1-I03` marking-floor and `W1-I03/PF-PERSIST` are **not reopened** by this record. `W0-T11`
remains **`DECIDED` / `PARKED`** until `W1-C1` / `W1-C2` canonical integration.

---

## 7. Exact control write allowlist — four paths

| # | Path | Change made by this record |
|---|---|---|
| 1 | `docs/operations/W0-B05-INFERENCE-TRANSPORT-R3-EVIDENCE.md` | **new file** — this control-side evidence record |
| 2 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | §18 appended only; §1–§17 byte-frozen and re-verified |
| 3 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | §30 appended only; §1–§29 byte-frozen and re-verified |
| 4 | `docs/operations/README.md` | exactly **one** catalog row added, for allowlist entry 1 |

**There is no fifth path.** No file under `docs/releases/` or `docs/adr/`, no validator, no test,
no contract and no file in any other repository was written.

### 7.1 Six frozen control files — precise freeze basis (`P3-1` correction)

An earlier revision said all six frozen files were re-measured "at their pinned digests". That was
imprecise. The accurate statement: **all six were frozen by the coordinator's pre-write baseline
hashes and re-measured unchanged**; only **four** of them additionally have corpus-recorded pins.

| # | Path | Freeze basis |
|---:|---|---|
| 1 | `docs/adr/FOUNDER-DECISION-PACKET-W0-IR01-CONTROLLED-INTEGRATION.md` | coordinator pre-write baseline hash **and** a **corpus-recorded pin** |
| 2 | `docs/adr/FOUNDER-DECISION-PACKET-W0-T11-RESOURCE-BUDGET.md` | coordinator pre-write baseline hash **and** a **corpus-recorded pin** |
| 3 | `docs/operations/W1-I03-MARKING-FLOOR-R2-DECISION-PACKET.md` | coordinator pre-write baseline hash **and** a **corpus-recorded pin** |
| 4 | `docs/operations/W1-I03-PF-PERSIST-GRANT.md` | coordinator pre-write baseline hash **and** a **corpus-recorded pin** |
| 5 | `docs/adr/README.md` | **no corpus pin** — coordinator pre-write baseline hash `2d5c2ea86ced0f54b655a6ae712d5acc8605b06ea194e2a19214e05503a92c51` only |
| 6 | `docs/operations/W1-I03-PF-PERSIST-R2-EVIDENCE.md` | **no corpus pin** — coordinator pre-write baseline hash `1639f87076e6a24f933d012c099a4fee2509c5ceece624445f52f06d053b7fb2` only |

**Entries 5 and 6 cannot be called corpus-pinned here.** A baseline hash the coordinator captured
immediately before writing is a freeze reference, not a corpus pin, and this record does not
promote one into the other. No self-digest is added for any of the four control paths this record
writes, and none of the two baseline hashes above is claimed as a pin.

The `W0-B05` source lane is **byte-unchanged and git-state-unchanged** by this record: no edit, no
residue file, no staging, no test or validator or formatter that loaded or ran, and no change to
its `HEAD`, branch, index or path counts. The one forbidden attempted Node execution disclosed in
§10.2 failed module-not-found and left no residue. The lane was re-measured after this record's
writes and matched §2 exactly.

---

## 8. Posture — unchanged by this record

| Item | Posture |
|---|---|
| W0 closure | **`COMPLETE = 0` / `NO-GO`** |
| W1 product, integration and live-shadow writers | **`HOLD` / `NO-GO`** |
| G2, G3 | **closed** |
| Runtime, demo, UAT | **`NO-GO`** before `G-C` stable-v1.0 |
| CI | **NOT WIRED** |
| Task identities | **exactly 48**; `W0-B05` remains `W0-B05`; **no task 49** |
| W1 window | 2026-08-01 .. 2026-08-23 |
| Stable go/no-go | 2026-12-20 |
| Release window | 2026-12-21 .. 2026-12-31 |
| Date moves | **none** — no date in any control document is moved by this record |
| Git state | nothing staged, nothing committed, nothing checked out, stashed, reset, reverted, rebased, merged, pushed; no PR, no release, no install, no branch, no worktree and no remote change |

Gate W2-I is **not opened**. No acceptance, integration, canonicalization, runtime or release claim
follows from anything above.

---

## 9. Coverage limitation

`tools/operations/validate-w1-control.mjs` and its test suite are **control-repository-scoped**.
They read control documents inside this repository only. **The control validator cannot inspect
the sibling `W0-B05` worktree**, its 38 paths, its digests, its aggregate or its reported test
results. A `PASS` from the control validator therefore says nothing whatsoever about the `W0-B05`
lane's correctness.

`docs/operations/README.md` is likewise **outside the control validator's document set**, so the
catalog row added by allowlist entry 4 is not machine-checked either.

The guarantees this record does carry are: the §2 measurements were taken live against the source
lane and re-verified unchanged afterwards; the six frozen control files were re-measured unchanged
against the coordinator's pre-write baseline hashes — **four corpus-pinned, two baseline-hashed
only, per §7.1**; and the board and register prefixes ahead of the appended sections were
re-verified byte-identical.

---

## 10. Failed review, remediation and measured control evidence

This section is about **this control record**, not about the `W0-B05` proposal bytes.

### 10.1 Independent review of this control record — `FAIL`, preserved as history

| Item | Value |
|---|---|
| Run | `e795221d-6cdb-43ac-a2f5-6844438210dc` |
| Model | `claude-opus-5` |
| Mode | read-only |
| Verdict | **`FAIL`** |
| Counts | **`P0 = 0`, `P1 = 1`, `P2 = 1`, `P3 = 2`** |

**This `FAIL` is dated review history and is not rewritten as `PASS`.** Remediation does not
retroactively convert a failed review into a passing one.

| Finding | Disposition in this revision |
|---|---|
| `P1-1` — the record claimed Spectral `0 errors and 0 warnings` / `0/0` | **Corrected.** Truthful carried evidence: 3 OpenAPI documents, 0 errors, **33 warnings total**; successor **14**; **8** of those 14 are `oas3-unused-component` from YAML anchor/alias reuse; warnings permitted at `--fail-severity=error` and **not zero**. Applied in §2 preamble, §3.1, board §18.3/§18.7, register §30.3/§30.7 and the `docs/operations/README.md` row. Label kept: lane-reported and independently reviewer-confirmed, not control-measured. **Remediation target — not closed until fresh re-review.** |
| `P2-1` — undisclosed authority/process breach masked by unqualified "read-only" claims | **Disclosed** in §10.2, summarized in board §18.7 and register §30.7; the unqualified claims in §2 and §3.1 were removed or qualified. **Remediation target — not closed until fresh re-review.** |
| `P3-1` — "six frozen files at pinned digests" was imprecise | **Corrected** in §7.1, board §18.7 and register §30.7: six frozen by coordinator pre-write baseline hashes and re-measured unchanged; **four** corpus-pinned; **two** baseline-hashed only and **not** callable corpus-pinned. |
| `P3-2` — no measured-evidence section for the record's own control state | **Added**: this §10, board §18.7, register §30.7. |

**The `P1` and `P2` findings are remediation targets, not silently closed items.** They stay open
against this record until a **fresh independent re-review** disposes of them.

### 10.2 `P2-1` — authority/process boundary breach, disclosed

The authoring run `b5f353c1-851d-4c3c-b20e-dc5cdac883b1` was **intended** to use read-only commands
in the `W0-B05` lane. It did not stay within that intent.

| Item | Fact |
|---|---|
| What happened | one command block executed with the `W0-B05` worktree as **working directory** and attempted a **`node` invocation** |
| How it ended | **failed module-not-found** — it did not load or run anything |
| Grant status | **forbidden by the grant**; this is a **real process/authority boundary breach**, not a technicality |
| What did **not** happen | **no `W0-B05` test, validator or formatter was loaded or run** — the failure preceded any such load |
| Transcript | **none** — 1DevTool metadata for the run records `contentCaptured=false`; no command text or transcript content is reproduced or reconstructed here |

**Independently re-derived impact: nil.** After the attempt, the lane's post-state was re-derived
and matched exactly: `HEAD` unchanged, **38** paths, **0** staged, **0** ahead, **every per-path
digest** unchanged, the **recorder** and **frozen-test** hashes unchanged, and the **37-path
aggregate** unchanged. **No residue file was created.** The post-state therefore proves **null byte
impact and null git-state impact**.

Nil impact does **not** excuse the breach. It is recorded here because a control record that hid it
behind "read-only commands only" would be misrepresenting its own provenance — which is exactly
what the failed review found.

### 10.3 Measured control-side evidence — this record, this repository

Measured live in the control worktree on 2026-07-29, after the remediation writes:

| Item | Measured value |
|---|---|
| Control base / `HEAD` | `eedadc561700d3e1fa052322d44eb63151df0009` — **unchanged**, no commit |
| Porcelain entries | **exactly 10** |
| Staged paths | **0** |
| Upstream | **none configured**; nothing pushed |
| `git diff --check` | **clean** — no whitespace or conflict-marker error |
| `node tools/operations/validate-w1-control.mjs` | **`PASS`, `tasks=48`** |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **`tests 179 · pass 179 · fail 0`** (`suites 0`, `cancelled 0`, `skipped 0`, `todo 0`) |
| Paths edited by this remediation | **exactly the four** in §7 — no fifth |
| Board / register prefixes | board §1–§17 and register §1–§29 re-verified **byte-identical** |

**No aggregate over this control record's own bytes is stated** — not in §2.2, not here. A record
cannot contain a content digest of itself; only external re-measurement after these bytes exist can
produce such a value, and this record does not pre-mint one.

**Scope of what the control checks attest.** The validator `PASS` and the 179/179 test result are
static consistency checks over **control documents in this repository only**. They attest nothing
about the `W0-B05` lane, nothing about Spectral, and nothing about this record's factual accuracy.

### 10.4 Status after remediation — no promotion

| Item | Status |
|---|---|
| This control record | **`P1`/`P2`/`P3` remediation applied; fresh independent re-review `PENDING`.** **Not `PASS`.** |
| Prior review `e795221d-…` | **`FAIL`**, retained as dated history, not rewritten |
| `W0-B05` product/proposal | **reviewed local uncommitted only** — not accepted, not integrated, not canonical, not pushed/merged/released |
| Gate W2-I | **not opened** |
| Promotion of any kind | **none** — no status flip, no writer opened, no authority conferred |
