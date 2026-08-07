# js-yaml 4.3.0 → 4.3.1 dependency remediation (`df2b05c`)

In-repo record of the advisory remediation carried by `df2b05c`, so that the evidence travels with
the commit rather than living only in lane state. Located here, rather than in
`docs/REVIEW-LEDGER.md` or repo-root `docs/operations/`, on the independent reviewer's explicit
ruling: the verdict ledger's charter reserves sections carrying a push decision to the reviewer and
any commit to that file re-invalidates its own `(path, blob)` coverage, while `docs/operations/` and
`tools/` lie outside this lane's owned write prefix. This file is inside that prefix.

This lane did not author `df2b05c` and does not own `tools/contract-validation/`. What follows is
measurement and disclosure, not a grade and not an authorisation.

**The change.** `tools/contract-validation/package-lock.json:2336-2344` moves `node_modules/js-yaml`
from `4.3.0` to `4.3.1`, with `resolved` and `integrity` updated to
`sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==`.
Three insertions, three deletions, one file. js-yaml is not named in `package.json` at all — it is a
transitive dependency whose lone requirement is `^4.1.1` at `package-lock.json:45` with a single
entry at `:2338`. A lockfile-only edit is therefore the only shape this remediation could take; no
declared range existed to change.

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

**The verification actually run, and what was excluded from it.** The driver's measurement at
`roles/reviewer/REVIEW-EVIDENCE.json` records `validate`, `test:w1-contracts` and `test:w1-control`
as measured and passed on an isolated checkout of the pinned commit. It expressly **excludes**
`npm audit` at `:40`, on the recorded ground that it queries the live advisory database and can turn
red with no change to the tree. Consequence, stated plainly: **the one control this commit exists to
satisfy has not been measured by any lane.** Nothing in this record should be read as evidence that
the hosted audit gate is green. The failure direction is fail-closed — if audit still reads red, the
job fails — so the residual is a CI outcome, not an exposure.

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
