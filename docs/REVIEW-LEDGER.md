
## Independent Opus verdict on the candidate F87 repair — **NO-GO** (P1=3, P2=3, P3=2)

Commissioned against the uncommitted working tree and returned after `7cc9b7b` was written. Its
measurements are against the **post-trim** bytes (it independently confirmed `preparation.py` at 799
and the 58/1540 census), so its anchors are current. It **confirms F104 and materially widens it**.
Recorded here in full; `7cc9b7b`'s F104 text is corrected rather than re-asserted.

### F104 — **corrected and widened**. The bypass does not need two fields, and four fields have no post-loop check at all.

`7cc9b7b` recorded F104 as requiring the attacker to flip **both** `image` and
`granted_image_identity` consistently. That is true only of those two fields, and it is the *hardest*
case. The independent review measured the general one: the per-field read budget is exact —

| Read | Site |
|---|---|
| 1 | `immutability_findings`'s `value.items()` — `views.py:72` |
| 2 | `stored_entries`'s `dict(mapping.items())` — `views.py:134` |
| 3..N+2 | one `mapping[key]` per key — `views.py:138` |
| **N+3** | **`frozen`'s `value.items()` — `preparation.py:151`** |

so `budget = N+2` leaves every validation read genuine and makes the **freeze** the first hostile
read. The post-loop body re-validates only two of the seven mapping fields. `control_identities` gets
a key-set-only check; **`selected_image_identity`, `docker_executable`, `probe_executable` and
`docker_platform` get nothing at all.** Measured single-field poisonings, all `satisfied=True`:

```
docker_executable      budget 5  -> path '/tmp/evil-docker', sha256 'f'*64
probe_executable       budget 5  -> poisoned
selected_image_identity budget 8 -> repository 'attacker/exfil'
docker_platform        budgets 0-6 -> poisoned
```

`image` and `granted_image_identity` are refused at **every** budget — and the reason is the
**pre-existing** `signed_identity_findings` drift check at `preparation.py:265` → `observe.py:355-362`,
not anything this candidate adds. So the one field the new test exercises is the one field already
covered before the candidate existed.

### F105 — **P1** — `preparation.py:222`. **NEW, OPEN. The divergence check is top-level only.**

`stored_entries` does not recurse, and its identity fast path (`views.py:147`, `if subscripted is
value: continue`) passes trivially for nested proxies, so **every nested mapping is unchecked** and
falls to the same relocated bypass at **budget=1**: read 1 is `immutability_findings`' recursion
(`views.py:72`, honest), read 2 is `frozen`'s recursion (`preparation.py:151`, hostile). Measured on
the `control_identities[<repo>]` inner mapping: accepted with recorded `commit == '0'*40`. That value
is written verbatim into the evidence inventory at `runner.py:589`.

### F106 — **P1** — `views.py:106-111`. **NEW, OPEN. The amended docstring states a falsehood.**

It claims `__post_init__` "now freezes each proved field **before** judging it, which is what makes
the claim hold on every path rather than on the wired one only." Two errors: the code freezes each
field **after** judging it (the freeze is last, `preparation.py:224`), and the claim holds for two of
seven mapping fields and no nested mapping. A docstring asserting a security property the code does
not have is worse than a missing one.

### F107 — **P2** — `preparation.py:252-259`. **NEW, OPEN. Two fail-closed branches made structurally unreachable — F103's vacuity, relocated.**

After the loop, `granted_image_identity` and `image` are frozen proxies over plain `dict`s whose two
views can never diverge, so `if signed_divergence:` and `if read_divergence:` are **dead code**. The
two `test_a_proved_result_refuses_an_unreadable_*_as_a_value_error` tests pass only because the new
pre-freeze check catches the input first: their coverage silently migrated to a different line. This
is the same failure mode F103 named, moved rather than removed — the candidate did not repeat F103's
*acceptance*, but it did reproduce its *vacuity*.

### F108 — **P2** — `views.py:116-118`. **NEW, OPEN.** "that cross-check is now belt-and-braces" inverts the risk posture: the cross-check is the only thing between the live caller object and the record, and it runs one read too early. Calling it redundant invites its removal.

### F109 — **P2** — `preparation.py:222`. **NEW, OPEN.** `isinstance(value, Mapping)` departs from this file's exact-type discipline (`type(value) is MappingProxyType`, `:207`) and silently skips `FROZEN_SEQUENCE_FIELDS` without stating why that is safe. Not a defect — `:207-209` refuses any non-`MappingProxyType` mapping, and exact `tuple` resolves its protocols in C with no overridable hook — but unreviewable breadth.

### F110 — **P3** — `tests/test_preparation.py:1087`. **NEW, OPEN.** The new test is GREEN for a reason other than the one it claims (see F104 as corrected), and its final `assert result.image is not proxy` is exactly the aliasing assertion its own docstring disclaims. It should be parametrised over all seven `FROZEN_MAPPING_FIELDS` and one nested position.

### What the review positively cleared

- **Q2 / F103:** not repeated. Both refusals still arrive as `ValueError`, from the new pre-freeze
  check. Placing the divergence check on the live object *before* `frozen()` is the right shape.
- **Q4 — both previously unmeasured hazards are definitively refuted.** Double-freeze: a `str`/
  `bytes` subclass or `bytearray` is refused by `immutability_findings` (`views.py:64,90`) *before*
  `frozen()` is reached, so `preparation.py:133-141` is unreachable from this loop; the whole
  accepted set passes `frozen()`. DAG-as-cycle: both `frozen` (`:146`) and `immutability_findings`
  (`views.py:68`) thread an **ancestor** trail, not a global visited set, so sibling-shared objects
  are accepted (measured). **Neither hazard exists.** These two open questions are **CLOSED**.
- **Q3:** `Mapping` is bound at `:12`; no top-level hostile sequence can exist.

### The repair shape both the review and the F104 measurement agree on

Read each mapping **exactly once**: `stored, divergence = stored_entries(value, name)`, refuse on
divergence, then build the dead copy **from `stored`** — never by re-reading `value` — and apply that
recursively at every depth. The current three-pass shape (judge, reconcile, then re-read to copy) is
defeated at whatever budget the last read lands on. This is the single design decision the next cycle
owes, and it must carry its own independent verdict before code lands.

### Push gate, corrected

**P0 = 0. P1 OPEN = 7** — F33, F87, F103, F104 (widened), **F105**, **F106**, and the F87 design
itself. **P2 = 32** (adds F107, F108, F109). **P3 = 34** (adds F110). The gate `P0 = P1 = P2 = 0` is
**not met** and moved further from being met. **None of the 91-commit local range is push-eligible.**
RUNTIME remains **HOLD**. PRODUCTION remains **Founder-only**.
