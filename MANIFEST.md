# Autonomous Loop Stack — universal, config-driven

A portable set of skills, agents, commands, and loops that drive an autonomous
"my work in the active iteration" workflow in **any** project. Nothing is hardcoded:
project specifics live in **`.claude/stack.md`**, written once by the `onboarding` skill,
and every file reads from it. See `CONVENTIONS.md` for the token → config mapping.

## Bring it to a project (3 steps)

1. Put this stack in the project's `.claude/` (copy `skills/`, `agents/`, `commands/`, `loops/`), or install it as a plugin.
2. Run **`onboarding`** — detects the stack and writes `.claude/stack.md` (issue tracker, branch model, package manager, frameworks, backend/DB, edge, tests, CI/deploy, design).
3. Run **`launch-loop-stack`** — registers the session crons, now driven entirely by your config.

Anything in the config set to `none`/empty is skipped — no deploy gate if you have no CI, no e2e gate if you have no e2e runner, no tracker transitions if you use GitHub Issues, etc.

## Loops (session-only crons created by `launch-loop-stack`)

| Loop | Cadence (cron) | Spec file |
|---|---|---|
| FIX | `*/5 6-20 * * 1-5` | loops/my-bugs-in-sprint-devfix.md |
| VERIFY | `*/5 * * * *` | loops/my-bugs-in-sprint-devfix.md |
| STORY-VERIFY | `2-57/5 * * * *` | loops/my-bugs-in-sprint-devfix.md |
| PR-REVIEW | `*/10 * * * *` | loops/pr-review.md |
| DEPLOY-FIX | `4,14,24,34,44,54 * * * *` | loops/deploy-failure-fix.md (skipped if no deploy workflows) |
| PR-SHEPHERD | `6,16,26,36,46,56 * * * *` | loops/pr-shepherd.md (my open PRs: review-respond / CI-fix / conflict-resolve) |
| DAILY-REPORT | `58 16 * * 1-5` | loops/daily-report.md (read-only standup summary + parked-item escalation) |

Scoping invariant: work is selected by `${issueTracker.myWorkQuery}` — user-scoped + the active iteration, never the whole backlog. Each tick does one action, gates strictly on green tests (+ deploy when configured), and never overrides branch protection.

## Layout

- **skills/onboarding/** — writes `.claude/stack.md` (`onboarding.mjs` + `stack.example.md`) and drops the universal `CLAUDE.template.md` as the project's root `CLAUDE.md`. Run first.
- **skills/lego-philosophy/** — the reusable, project-agnostic UI architecture rule (smart/dumb split + component inventory); the root `CLAUDE.md` and `frontend-component-conventions` reference it.
- **loops/ (5)** — per-tick specs (FIX/VERIFY/STORY-VERIFY, PR-REVIEW, DEPLOY-FIX, PR-SHEPHERD, DAILY-REPORT).
- **skills/ (~30)** — orchestration (launch/stop-loop-stack), the devfix fix-path, the gherkin sub-flow, test/review/memory skills. Tool-specific skills are generic + config-driven (database-migration, serverless-function, memory-first, test-management-sync).
- **agents/ (13)** — the implement/review agent team (analyzer, coder, tester, reviewers, resolver, designer, etc.), tool-agnostic.
- **commands/ (10)** — fix/PR-flow slash commands.
- **CONVENTIONS.md** — how every file stays universal (the config contract + token map).

## The contract every file follows

> Read `.claude/stack.md` first. Use its values; never assume a specific tool. If a needed
> capability is `none`, skip those steps. If the config is missing, run `onboarding` and stop.
