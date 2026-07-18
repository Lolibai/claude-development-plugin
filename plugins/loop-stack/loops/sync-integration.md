# Loop: fix-base branches → keep synced with their env branches

A session-scoped cron that keeps every configured fix-base branch (`${vcs.fixBaseBranches[env]}`)
current with its environment branch (`${vcs.envBranches[env]}`), so **DEPLOY-FIX never branches a
fix off a stale base**. Without it, the fix base silently drifts (tens of commits behind is typical
after a busy week) and every deploy fix starts from old code. You own this file — edit it, then
re-register the cron.

> **Config-driven.** Read `.claude/stack.md` first. The env→branch and env→fix-base maps come from
> `${vcs.envBranches}` and `${vcs.fixBaseBranches}`. If `${vcs.fixBaseBranches}` is empty, or every
> fix base equals its env branch, this loop has nothing to sync — **don't register it**. If
> `.claude/stack.md` is missing, run `onboard` and stop.

## Schedule

| Setting | Value |
|---|---|
| Cadence | twice hourly (`9,39 * * * *` — staggered off every other loop's minutes) |
| When | **any time** the session is active |
| Persistence | **session-only** (`durable: false`) — dies when the session exits |
| Auto-expiry | recurring cron auto-expires after **7 days** |

> **Idle-gating:** ticks fire only while the REPL is idle, so a long merge suppresses overlapping ticks.

## What each tick does

1. `git fetch origin`. For each env where `${vcs.fixBaseBranches[env]}` is set **and** differs from
   `${vcs.envBranches[env]}`: `git rev-list --count origin/<fixBase>..origin/<envBranch>`. All
   zero → **STOP** (everything in sync — the common case).
2. **Blocked list:** skip any pair listed in `.claude/loops/state/sync-integration-blocked.txt` —
   those need a human (conflicted promote merge or protected branch); clear the line to retry.
3. **Overlap guard** = `git status --porcelain` over the project's source/test dirs (ignoring the
   transient `.claude/scheduled_tasks.lock`) dirty → **STOP** (another loop is mid-work).
4. Pick **ONE** pair (the one most commits behind). Check out `origin/<fixBase>` locally;
   `git merge origin/<envBranch>`:
   - **Clean merge / fast-forward** → if the merge brought code changes, run `${commands.typecheck}`
     (skip for docs-only) — must pass → push to `origin/<fixBase>`. Push rejected by **branch
     protection** → do **not** override: record the pair in the blocked file
     (`# protected: open a promote PR by hand`) and stop.
   - **Conflict** → `git merge --abort`; append
     `"<fixBase> # conflict with <envBranch>: <one-line>"` to
     `.claude/loops/state/sync-integration-blocked.txt` and stop — conflicted promote merges are a
     human decision (they usually mean the fix base carries unpromoted work). The DAILY-REPORT loop
     surfaces every blocked pair until it's cleared.
5. Return to the configured base branch, leave the working tree clean. **STOP.**

**One branch pair per tick. Never force-push, never override branch protection, never delete branches.**

## Interaction with the other loops

- **DEPLOY-FIX** is the consumer: it branches deploy fixes off `${vcs.fixBaseBranches[env]}` — this
  loop is what keeps that base meaningful.
- **DAILY-REPORT** surfaces `.claude/loops/state/sync-integration-blocked.txt` entries daily until a
  human resolves them.

## Start / Stop / Adjust

- **Stop:** `stop-loop-stack`, or `CronDelete <id>` (`CronList` for ids), or close the session.
- **Re-register** (after editing this file / new session): re-run `launch-loop-stack`.
- **Cadence:** edit the minute list (`9,39` → `9` for hourly, …).
- **Retry a blocked pair:** remove its line from `.claude/loops/state/sync-integration-blocked.txt`.
- **Survive restarts:** register with `durable: true`. **Survive a closed terminal:** use a cloud `/schedule`.

## Caveats

- Pushes merge commits to fix-base branches **unattended**. It only ever merges the env branch *into*
  its fix base (one direction), gates on typecheck for code changes, and defers to branch protection
  and humans for anything conflicted.

## Related

- `.claude/loops/deploy-failure-fix.md` — the consumer of the synced base.
- `.claude/loops/daily-report.md` — surfaces blocked pairs.
- `launch-loop-stack` / `stop-loop-stack` — register/tear down all loops.
