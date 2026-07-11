# Loop: PRs awaiting my review → auto `github-pr-review`

A session-scoped cron that finds open PRs in the configured repo that request **my** review
(optionally narrowed to specific authors), and runs the **`github-pr-review`** skill on one per tick
(reviews the diff, posts a PR review). You own this file — edit it, then re-register the cron.

> **Config-driven.** Read `.claude/stack.md` first. Repo, reviewer handle, and watched authors come
> from `${project.repo}` and `${vcs.prReview.{reviewer,watchAuthors}}`. If the reviewer handle is
> unset, run `onboarding` first. Works with any `${project.vcsHost}` that has a PR review concept;
> the commands below assume GitHub (`gh`) — adapt to the configured host if different.

## Schedule

| Setting | Value |
|---|---|
| Cadence | every **10 minutes** (`*/10 * * * *`) |
| When | **any time** the session is active (not day/hour gated) |
| Scope | repo `${project.repo}`, review-requested `${vcs.prReview.reviewer}`, authors `${vcs.prReview.watchAuthors}` (empty = any author) |
| Persistence | **session-only** (`durable: false`) — dies when the session exits |
| Auto-expiry | recurring cron auto-expires after **7 days** |

> **Idle-gating:** ticks fire only while the REPL is idle, so a long review suppresses overlapping ticks.

## What each tick does

1. List matching open PRs (build the search from config):
   `gh pr list --state open --search "review-requested:${reviewer} [author:<each watchAuthors>]" --json number,title,headRefName,headRefOid,updatedAt`
   (fallback: GitHub MCP `search_pull_requests`, query `repo:${project.repo} is:open is:pr review-requested:${reviewer} [author:…]`). With no `watchAuthors`, omit the author filter to review all your requested PRs.
2. **Dedupe:** skip any PR whose `"<number>@<headRefOid>"` is already in `.claude/loops/state/pr-review-done.txt`
   (already reviewed at that exact commit; re-reviews only if new commits are pushed).
3. None remain → **stop**.
4. Pick **one** (oldest `updatedAt`). Invoke **`github-pr-review`** against it — review the diff cold,
   post findings as a PR review.
5. Append `"<number>@<headRefOid>"` to `.claude/loops/state/pr-review-done.txt`.

**One PR per tick. Review + post only — never merges or changes code.**

Submitting a review usually clears the `review-requested` flag, so the PR drops out of the search next tick.

## Start / Stop / Adjust

- **Stop:** `stop-loop-stack`, or `CronDelete <id>` (`CronList` for ids), or close the session.
- **Re-register** (after editing this file / new session): re-run `launch-loop-stack`.
- **Cadence:** edit the minute field (`*/10` → `*/15`, …).
- **Re-review from scratch:** delete `.claude/loops/state/pr-review-done.txt`.
- **Widen/narrow scope:** edit `${vcs.prReview}` in `.claude/stack.md` (add/remove authors, change reviewer), or tweak the `--search` query (add `label:<x>`, etc.).
- **Survive restarts:** register with `durable: true`. **Survive a closed terminal:** use a cloud `/schedule`.

## Related
- `.claude/loops/my-bugs-in-sprint-devfix.md` — bug fix/verify loop. `github-pr-review` — the skill each tick runs.
