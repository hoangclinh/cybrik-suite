# js-yaml 4.3.0 → 4.3.1 dependency remediation (`df2b05c`)

In-repo record of the advisory remediation carried by `df2b05c`, so that the evidence travels with
the commit rather than living only in lane state. Located here, rather than in
`docs/REVIEW-LEDGER.md` or repo-root `docs/operations/`, on the independent reviewer's explicit
ruling: the verdict ledger's charter reserves sections carrying a push decision to the reviewer and
any commit to that file re-invalidates its own `(path, blob)` coverage, while `docs/operations/` and
`tools/` lie outside this lane's owned write prefix. This file is inside that prefix.

This lane did not author `df2b05c` and does not own `tools/contract-validation/`. What follows is
measurement and disclosure, not a grade and not an authorisation.

**The change.** `tools/contract-validation/package-lock.json:2339-2341` moves `node_modules/js-yaml`
from `4.3.0` to `4.3.1`, with `resolved` and `integrity` updated to
`sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==`.
Those three lines are the whole change: three insertions, three deletions, one file. They sit inside
the sole `node_modules/js-yaml` entry, which begins at `:2338` and runs to `:2359`; the surrounding
`funding` and `license` keys are unchanged. (The wider `:2336-2344` span a reader may meet in the
diff is the hunk header plus context — `:2336` is the preceding `isarray` entry's `license` line —
and it is not the subject.) js-yaml is not named in `package.json` at all — it is a transitive
dependency whose lone requirement is `^4.1.1` at `package-lock.json:45`, with that single entry at
`:2338`. A lockfile-only edit is therefore the only shape this remediation could take; no declared
range existed to change.

**The advisory.** GHSA-5p4m-2wfm-xmqj, high severity, against the `!!omap` duplicate-key path in
js-yaml 4.x, whose vulnerable form scans a growing array per key and is therefore quadratic. The
hosted gate that consumes it is `npm audit --audit-level=high` at
`.github/workflows/contracts.yml:78`.

**Installed-tree evidence that the fix is present in 4.3.1.** Re-derived from disk on 2026-08-07 by
the security lane, independently of the commit message and of any prior lane's notes, and separately
re-derived by the independent reviewer in `VERDICT-df2b05c`:

- `tools/contract-validation/node_modules/js-yaml/package.json:3` reports version `4.3.1`.
- A worktree-wide search for directories named `js-yaml` returns exactly one path, so there is no
  nested copy pinned at a vulnerable version anywhere in the tree.
- `lib/type/omap.js:11,30-31` resolves duplicate keys with `const objectKeys = {}` plus
  `_hasOwnProperty.call` and `Object.defineProperty` — O(1) per key. The vulnerable array-scan shape
  (`objectKeys.indexOf(pairKey)` over a growing array) is absent.
- `node_modules/` is gitignored at `tools/contract-validation/.gitignore:1`, which is why the
  installed tree never appears in `git status` or in a diff. Its absence from a diff is not evidence
  that it is absent from the worktree; an earlier review round drew that inference and it was wrong.

**The verification actually run.** Figures are transcribed here rather than referenced, because the
driver's evidence channel is rewritten every cycle and a pointer into it does not survive the commit
it describes — the same durability defect this file exists to cure. Each measurement below was taken
by the driver on an isolated checkout of the named commit, never on a working tree:

- On `df2b05c`: pytest 1725 passed and 59 failed against a declared baseline of 59, so 0 unintended
  failures; ruff 12 violations against a baseline of 12; `compileall` exit 0.
- On `24a5c78`, the commit that added this file: the identical figures — 1725/59 with 0 unintended,
  ruff 12, `compileall` 0 — plus the three scripts hosted CI runs, `validate`, `test:w1-contracts`
  and `test:w1-control`, measured and passed.

**What was excluded from it, and why that matters here.** The collector expressly excludes `npm
audit`, on its own recorded ground that the command queries the live advisory database and can turn
red with no change to the tree. Consequence, stated plainly: **the one control this commit exists to
satisfy has been measured by no lane in this scheme.** The commit message of `df2b05c` does assert
that `npm audit --audit-level=high` reported 0 vulnerabilities before it was committed, but that
assertion arrives with the same unresolved provenance as the commit itself (see *Authority* below),
no lane can corroborate it offline, and it is therefore recorded here as a claim and not as
evidence. Nothing in this record should be read as evidence that the hosted audit gate is green. The
failure direction is fail-closed — if audit still reads red, the job fails — so the residual is a CI
outcome, not an exposure.

**A stale in-repo claim about this same gate.** `docs/operations/W1-CI3-DEPENDENCY-REMEDIATION-R1.md`
states at `:72` that `npm audit --audit-level=high` returns 0 vulnerabilities and at `:91-93` that
the advisory database reports no vulnerability after that remediation. Both predate
GHSA-5p4m-2wfm-xmqj and are **superseded on this point** by this record. That file lies outside this
lane's write prefix and is therefore left unedited; this sentence is the supersession relation.

**What this lane cannot witness.** Whether the registry still serves this exact tarball for 4.3.1,
whether the installed tree is byte-identical to what npmjs.org publishes, and the current state of
the advisory's patched-versions field. These are network facts and this lane is offline by policy.
The evidence above is affirmative on-disk code evidence and does not depend on them.

**Authority — OPEN, and the reason this record is incomplete.** `df2b05c` was authored and committed
by `Cybrik Codex Worker <codex@cybrik.invalid>`, a different identity from the
`codex-worker@local.invalid` that authored 157 of the commits in this range, landing after `3a0b66b`
had taken an independent GO. Under which dependency authority a non-owning lane edited
`tools/contract-validation/` is **not answered here, because this lane does not know and will not
invent it.** It has been escalated for three cycles without a recorded answer. This paragraph is the
disclosure that the question is open, not its resolution.

**Known residual.** A reader arriving at `package-lock.json:2339` has no pointer to this file, because
such a pointer would have to live under `tools/`, outside this lane's write prefix. That half of the
finding is blocked by the same open authority question above, not by a separate one.

RUNTIME HOLD. Production remains Founder-only.
