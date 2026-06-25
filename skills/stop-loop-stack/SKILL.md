---
name: stop-loop-stack
description: Tear down the autonomous "my work in the active iteration" loop stack for the current session — delete the FIX, VERIFY, STORY-VERIFY, PR-REVIEW, DEPLOY-FIX, and SYNC-INTEGRATION recurring crons in one shot so no further ticks fire. Use when the user says "stop the loops", "bring the loop stack down", "tear down / halt / kill / pause the loops", "stop the my-work loops", or "disable the autonomous loops". The inverse of `launch-loop-stack`. Stops scheduling only — never touches code, branches, or in-flight issue-tracker/PR state.
---

# Stop Loop Stack

> **Config-driven — read `.claude/stack.md` first; use its values; never assume a specific tool.** This
> skill only deletes session crons, so it works even when most capabilities are `none` — but if
> `.claude/stack.md` is missing, run the **`onboarding`** skill and stop. If a needed capability is
> `none`, the matching loop simply was never launched, so there is nothing to delete for it.

## Purpose

Delete the session-scoped recurring crons that drive the autonomous **"my work in the active iteration"** workflow, so the loops stop firing for the rest of the session. This is the inverse of `launch-loop-stack`.

The loops it tears down (identify by the **prompt signature**, not a fixed count — the set has grown over time and may grow again):

| Loop | Prompt signature (match on this) | Spec |
|---|---|---|
| **FIX** | `— FIX TICK` (matches `Autonomous "my bugs" — FIX TICK` and any title variant) | `.claude/loops/my-bugs-in-sprint-devfix.md` |
| **VERIFY** | `— VERIFY TICK` but NOT `— STORY-VERIFY TICK` (matches `Autonomous "my bugs" — VERIFY TICK`) | `.claude/loops/my-bugs-in-sprint-devfix.md` |
| **STORY-VERIFY** | `— STORY-VERIFY TICK` (matches `Autonomous "my stories" — STORY-VERIFY TICK`) | `.claude/loops/my-bugs-in-sprint-devfix.md` |
| **PR-REVIEW** | `Autonomous PR-REVIEW TICK` | `.claude/loops/pr-review.md` |
| **DEPLOY-FIX** | `Autonomous DEPLOY-FIX TICK` | `.claude/loops/deploy-failure-fix.md` |
| **SYNC-INTEGRATION** | `Autonomous SYNC-INTEGRATION TICK` | (keeps `${vcs.fixBaseBranches}` current with `${vcs.integrationBranch}`) |

## When to use

- User says: "stop the loops", "bring the loop stack down", "tear down / halt / kill / pause the loops", "stop the my-work loops", "disable the autonomous loops".
- Before a maintenance window, release freeze, or when handing the repo to a human who doesn't want background ticks.

## How to stop (do this when invoked)

1. **List first.** Call `CronList`. Read every job's ID and prompt.
2. **Match the loop crons by prompt signature** from the table above. A cron is part of the stack if its prompt **starts with / contains** one of those signatures. Do **NOT** delete crons that don't match — the user may have unrelated scheduled jobs.
3. **Delete each matched cron** with `CronDelete <id>`. One call per job.
4. **Re-list** (`CronList`) to confirm none of the signatures remain.
5. **Report**:
   - Every job ID deleted, grouped by loop name (FIX / VERIFY / STORY-VERIFY / PR-REVIEW / DEPLOY-FIX / SYNC-INTEGRATION).
   - Any stack loop that was **already absent** (nothing to delete).
   - Any **non-stack** crons left untouched (list them so the user knows they're still scheduled).
6. Do **not** delete the `/tmp` loop state files by default (see below).

## In-flight work — what stopping does and does NOT do

- Deleting a cron only stops **future ticks** from being scheduled. It does **not** interrupt a tick already executing in another turn, and it does **not** roll back anything a prior tick already did (a PR it merged, an issue-tracker transition it made, a branch it pushed).
- If the user wants to also abort an *in-progress* devfix or revert a branch, that's a **separate** explicit request — this skill does not touch the VCS or the issue tracker.

## State files (leave intact unless asked)

The loops keep small dedupe / park files under `/tmp`. **Leave them in place** so a later `launch-loop-stack` resumes cleanly without re-parking or re-reviewing:

- `/tmp/my-bugs-verify-parked.txt` — bugs VERIFY has parked (e.g. no AC coverage).
- `/tmp/pr-review-done.txt` — `"<number>@<headRefOid>"` of PRs already reviewed.
- `/tmp/deploy-fix-done.txt` — deploy run IDs already handled.

Only clear these if the user explicitly asks for a **full reset** (e.g. "stop the loops and wipe their state"). If so, `rm -f` the three files and say which were removed.

## Restarting

To bring the stack back up, invoke `launch-loop-stack` (it re-creates only the loops that are missing and reports existing job IDs).

## Related

- `launch-loop-stack` — the inverse; creates the loop crons.
- `.claude/loops/my-bugs-in-sprint-devfix.md` — full FIX + VERIFY spec.
- `.claude/loops/pr-review.md` — full PR-REVIEW spec.
- `.claude/loops/deploy-failure-fix.md` — full DEPLOY-FIX spec.
