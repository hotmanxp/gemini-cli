# Upstream Sync Protocol — gemini-cli fork

This document records how the `main-api-integration` branch is kept in sync with
`google-gemini/gemini-cli` (`upstream/main`). It also catalogs the provider-skip
policy and per-sync audit trail.

## Source / Target

- **Upstream:** `git@github.com:google-gemini/gemini-cli.git` (remote
  `upstream`), branch `main`
- **Local fork:** `git@github.com:hotmanxp/gemini-cli.git` (remote `origin`),
  branch `main-api-integration`
- **Provider in this fork:** MiniMax (`minimax-api-key` via `MINIMAX_KEY` env
  var), routed through the openai-compatible provider family in
  `packages/core/src/core/openaiContentGenerator/`

## Sync Method

Follow the established fork convention: **single `git merge upstream/main` per
sync**, not per-file `git apply --3way`. Previous syncs on this branch
(`9b9986ff5`, `9cdbc8413`, `ca3686fbf`, `18579cb42`, `3a73a1956`, `a7aa979f8`,
`1ab426353`, `b39d18554`, `5a0d6182e`, `3e406ed15`, `1ab426353`) all used this
exact pattern. Per-file apply is reserved for the rare cases where the merge
strategy fails on a fork-only file.

### Standard sync procedure

```bash
# 1. Update remotes
git fetch upstream main
git fetch origin

# 2. Verify clean state
git status                       # working tree must be clean
git rev-parse HEAD origin/main-api-integration   # must match

# 3. Dry-run merge (--no-commit) to detect conflicts
git merge --no-commit --no-ff upstream/main
git status                       # inspect unmerged files
git merge --abort                # always abort the dry-run

# 4. Apply sync filter
python3 ~/.hermes/skills/devops/upstream-fork-sync/scripts/verify-already-synced.py \
    --upstream-git .git --local . \
    $(git log --oneline origin/main-api-integration..upstream/main | awk '{print $1}')

# 5. Merge with the historical flag
git merge --no-ff upstream/main

# 6. Build + typecheck + test (5-phase)
npm run build
npm run typecheck
npm test
# (TUI smoke if MINIMAX_KEY is set)

# 7. Push
git push origin main-api-integration
```

## Provider Skip Policy

This fork is configured for **openai-compatible** providers (see
`packages/core/src/core/openaiContentGenerator/provider/`): `default.ts`,
`deepseek.ts`, `minimax.ts`, `modelscope.ts`, `openrouter.ts`. The native
`gemini` (Google API) provider is part of upstream but is **not the working
provider** for this fork.

When merging `upstream/main`, file conflicts that introduce or change
Google-specific provider code (`packages/core/src/core/client.ts`,
`packages/core/src/core/contentGenerator.ts`, `packages/core/src/code_assist/`,
`packages/core/src/config/defaultModelConfigs.ts`,
`packages/core/src/routing/strategies/`,
`packages/core/src/services/modelConfigService.ts`,
`packages/core/src/tools/shell.ts`, `schemas/settings.schema.json`,
`docs/reference/configuration.md`) should be evaluated case-by-case:

- **KEEP** if the change is provider-agnostic (refactor, naming, error path that
  all providers share).
- **ADAPT** if the change is Google-specific but the equivalent
  openai-compatible translation is obvious.
- **SKIP** if the change only affects Google's auth/backend routing (e.g. flash
  GA model id, Antigravity banner) and has no openai-compatible analog.

The `git merge --no-ff` step always succeeds in this fork because the
openai-compatible provider layer is in different files from the Google provider
layer. Conflicts are rare.

## Sync History

### 2026-06-06 — 15 commits merged

Upstream commits merged via `git merge --no-ff upstream/main` (commit
`f4d0ea357`):

```
f40498db6 update the max amount of times the Antigravity transition banner can be displayed. (#27676)  [Google-specific, banner]
4196596f7 Changelog for v0.45.0 (#27642)                                                              [release]
dceb2ea30 fix(policy): add EBUSY fallback and TOML parse recovery (#19919) (#21541)                    [policy/engine]
e4315b36e Respect backend definitions for 3.5 flash and Update auto mode to use 3.5 flash when the flag is enabled. (#27645)  [Google-specific, 3.5 flash]
d2cd12a7c Changelog for v0.46.0-preview.0 (#27641)                                                     [release]
ae87e208a chore(release): bump version to 0.47.0-nightly.20260602.gcfcecebe8 (#27644)                  [release bump]
cfcecebe8 fix(ci): use pull_request target trigger to grant write access on fork PRs (#27637)          [CI]
5110bdf56 chore(ci): add optimized PR size labeler and batch workflows (#27616)                        [CI]
665228e98 Transition to flash GA model when experiment flag is present. (#27570)                       [Google-specific, flash GA]
013914071 Adding quote (#27571)                                                                        [doc typo]
211e7d1ae fix(cli): prevent spam loop when preferredEditor is invalid (#25324)                         [CLI/provider-agnostic]
b77beba13 Changelog for v0.44.0 (#27569)                                                               [release]
c82e2b597 Changelog for v0.45.0-preview.0 (#27495)                                                     [release]
bd53951dc fix(core): harden PTY resize against native crashes (#27496)                                  [core/provider-agnostic]
5cac7c10f fix(cli): ignore unmapped vim normal keys (#27102)                                           [CLI/provider-agnostic]
```

Effective net change: only `f40498db6` (banner, 2 files) and a package-version
bump in `ae87e208a` (4 files). The remaining 13 commits are either already
byte-identical on the local branch (cherry-picked in previous syncs) or are
Google-specific. `verify-already-synced.py` reported **10 OK SYNCED + 5
PARTIAL** before the merge; the merge was conflict-free.

#### Verification (5-phase, post-merge)

| Phase                  | Result                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| 1. `npm run build`     | ok, all packages built                                                                           |
| 2. `npm run typecheck` | 0 errors across 5 workspaces                                                                     |
| 3. `npm test`          | pre-existing failures (40 fail / 7669 pass across 402 files) — see "Pre-existing Failures" below |
| 4. TUI smoke           | skipped: `MINIMAX_KEY` not set in this shell                                                     |
| 5. Debug log scan      | n/a (no TUI session run)                                                                         |

#### Pre-existing Failures (NOT introduced by this sync)

The 40 failing tests on the post-merge commit are identical to the failures on
`8f0848650` (pre-merge) — confirmed by running `npm test` on a detached
`HEAD~1`. They are fork-internal test drift:

- **Snapshot drift** in `packages/core/src/core/prompts.test.ts` (18 snapshots
  failed) — system prompt output structure has evolved upstream but the test
  snapshots are stale.
- **Workspace boundary tests** in `src/tools/ls.test.ts`,
  `src/tools/shell.test.ts`, `src/tools/write-file.test.ts`,
  `src/utils/pathReader.test.ts` — tests assert paths-outside-workspace
  rejection, but the implementation now allows the configured memory directory
  and that exception is not reflected in the test expectations.
- **Memory / consent flow** in `src/commands/memory.test.ts`,
  `src/context/memoryContextManager.test.ts`,
  `src/policy/memory-manager-policy.test.ts`,
  `src/services/memoryService.test.ts` — global `~/.gemini/AGENTS.md` patch flow
  has tightened (scoped inbox) but tests still use the loose path.
- **Auth dialog** in `src/ui/auth/AuthDialog.test.tsx` — auth option list
  reordering.
- **Settings dialog** in `src/ui/components/SettingsDialog.test.tsx` — settings
  entry list reordering.
- **CLI exit codes** in `src/gemini.test.tsx` — main function exit semantics for
  "no input" case (expects 42).

These are real regressions in test code relative to current source code, not the
other way around. They predate the 2026-06-06 sync. To fix them would require a
separate "test drift cleanup" task; that is **out of scope** for the sync PR and
should be tracked separately.

### Pre-2026-06-06 syncs

See `git log --grep='upstream/main' main-api-integration` for the full list.
Last sync before 2026-06-06 was commit `9b9986ff5` (2026-05-27).

## Out of Scope (per sync)

- **Fixing pre-existing test failures.** They are recorded here for awareness
  but the sync PR does not touch them.
- **Rebuilding the test fixture baselines** (e.g. memory golden files).
- **Migrating deprecated APIs** flagged in upstream changelogs unless the
  deprecated API is in a fork-modified path.
- **Adopting new upstream features** that conflict with the openai-compatible
  provider abstraction. Track them as follow-up issues.

## Cron Watcher

The cron job `gemini-cli-upstream-watch` runs daily at 9:00 +08:00 and emits a
list of new upstream SHAs. The human reviews the list (filtering out release
chore / changelog-only commits) and then runs the procedure above. The cron does
NOT auto-apply.
