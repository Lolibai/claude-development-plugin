---
name: pr-ci-failure-triage
description: Use when the user asks to check open pull requests for CI failures, says "check PRs for failing checks", "which PRs have red CI", "triage failing PR checks", or "fix CI on open PRs". Surveys every open PR in the configured repo, identifies which ones have failing required checks, pulls the failing job logs, classifies the root cause, and either fixes it on the PR branch or surfaces a structured report.
---

# PR CI failure triage

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** Repo (`${project.repo}`),
> integration branch (`${vcs.integrationBranch}`), branch naming + commit convention (`${vcs.branchNaming}`,
> `${issueTracker.keyPrefix}`), local check commands (`${commands.*}`), and test runners (`${testing.*}`) all
> come from config. The flow below uses GitHub's `gh` CLI as the example VCS host — if `${vcs.host}` is a
> different host, use its equivalent PR/check/log commands. If a needed capability (e.g. a CI host or a test
> runner) is `none`, skip the steps that depend on it. If `.claude/stack.md` is missing, run the
> **`onboarding`** skill and stop.

End-to-end flow: enumerate open PRs → fetch CI status per PR → for each red PR, drill into the failing job logs → classify (flake vs real) → fix on the PR branch and push, or report.

## When to apply
- User says "check existing PRs for CI failures", "which PRs are red", "triage failing PR checks", "fix CI on open PRs"
- Working a merge train and need a CI-readiness snapshot
- After bumping a shared dep, want to know which PRs broke

## Phase 1 — Enumerate PRs and overall status

```bash
gh pr list --json number,title,headRefName,mergeStateStatus,statusCheckRollup --limit 50
```

For each PR, the rollup contains every check's `name`, `conclusion` (`SUCCESS|FAILURE|CANCELLED|...`), and `status` (`COMPLETED|IN_PROGRESS|QUEUED`).

A PR is **red** if any check has `conclusion: FAILURE`. `IN_PROGRESS`/`QUEUED` are not failures — note them as "pending" but don't act.

Quick filter:
```bash
gh pr list --json number,title,headRefName,statusCheckRollup --limit 50 \
  | jq '.[] | select(.statusCheckRollup[]?.conclusion == "FAILURE") | {number, title, headRefName, failing: [.statusCheckRollup[] | select(.conclusion == "FAILURE") | .name]}'
```

If nothing red, report and stop.

## Phase 2 — Per-PR triage

For each red PR:

1. **List failing checks with run IDs**
   ```bash
   gh pr checks <num>                       # human-readable summary
   gh run list --branch <headRefName> --limit 10 --json databaseId,name,conclusion,headSha
   ```
2. **Fetch failing job logs** (only the failed jobs, not the whole run):
   ```bash
   gh run view <runId> --log-failed
   ```
   For very long logs, pipe through `tail -200` or grep for `error|FAIL|✖|✗`.
3. **Classify the failure** (see heuristics below) and decide:
   - **Real failure on PR code** → fix on the PR branch (Phase 3)
   - **Flake / infra blip** → re-run, don't edit code
   - **Pre-existing on `develop`** → don't fix in this PR; note it
   - **Needs human judgment** → add to report, skip

## Phase 3 — Fix on the PR branch (only for real failures)

```bash
git fetch origin
git checkout <headRefName>
git pull --ff-only origin <headRefName>
```

Apply the fix targeted to the failure class (see heuristics). Then verify locally with the same command CI ran. Map each red CI job to its local equivalent using `${commands.*}` and `${testing.*}` from config — for example:

| CI job (by role) | Local equivalent (from config) |
|---|---|
| Lint | `${commands.lint}` (scope to the failing package if the tool supports it) |
| Typecheck | `${commands.typecheck}` |
| Format | `${commands.format}` (e.g. a `format:check`) |
| Unit tests | `${testing.unit.runner}` in the failing package/dir (`${testing.unit.locations}`) |
| API / contract tests | the project's API-test command, if any |
| E2E | `${testing.e2e.runner}` in `${testing.e2e.dir}` — only run the failing feature; full suite is expensive |
| Aggregate "verify" job | run that workflow's steps locally from its CI definition |

Commit using the project's commit convention — `${vcs.branchNaming}`/`${issueTracker.keyPrefix}` derive the key, and the type/scope must satisfy whatever the repo enforces (e.g. a commitlint config):
```
<commit per the project's convention> fix(<scope>): <one-line root-cause fix>
```

Push:
```bash
git push origin <headRefName>
```

Never bypass commit hooks (e.g. `--no-verify`). Never force-push. If the repo runs a pre-commit hook (e.g. a Husky hook running unit tests), let it complete.

## Phase 4 — Re-runs only

If classified as flake:
```bash
gh run rerun <runId> --failed
```

Annotate in the report that this was a re-run, not a code fix, so a second failure isn't silently retried again.

## Failure classification heuristics

| Symptom in log | Class | Action |
|---|---|---|
| Type-check error (e.g. `Type 'X' is not assignable`) | Type error | Read the file, fix the type. Do not silence with unsafe casts / non-null assertions if the project's lint bans them. |
| Linter rule violation (e.g. unused variable, banned construct) | Lint | Fix the rule violation. Use the linter's autofix where available; manual otherwise. |
| Formatter reports style issues (e.g. "Code style issues found") | Format | Run the formatter's write mode on the files, then commit. Note: a `format:check` typically reads the **working tree** while CI reads the **committed** state — always recommit after writing. |
| `Cannot find module '<workspace pkg>'` after a dep bump | Workspace install | Re-run the package manager's install (`${commands.install}` if set); check the lockfile is committed. |
| `Test failed` with new code on the PR | Real test failure | Fix the code or the test (whichever is wrong); never delete the test. |
| Network errors, `ECONNRESET`, `429`, a local service port not ready | Flake / infra | Re-run. Never paper over with retries inside test code. (Check `${recoveryNotes}` for known infra causes.) |
| E2E timeout on a single scenario that passes on rerun | E2E flake | Re-run once. If it fails twice, treat as real and route to the focused-E2E-fix skill (e.g. `e2e-narrow-fail-focus-success`). |
| Failure also reproduces on latest `${vcs.integrationBranch}` | Pre-existing | Surface separately; don't block this PR's author with it. |
| Commit-message hook rejected locally | Local issue, never CI | Skip — not a CI failure. |

## Guardrails

- **One PR at a time.** Don't batch fixes across branches in a single push.
- **Stay in scope.** Only commit changes that address the failing check. No drive-by refactors.
- **Migrations / data-platform changes** (`${backend.migrationsDir}`): never auto-fix without user confirmation — ordering and authorization/row-level-policy implications need a human.
- **E2E suite**: do not run the full E2E suite; run only the failing feature file (filter `${testing.e2e.runner}` to that path).
- **Secret leakage**: if logs show a token/secret, redact before quoting in the report.

## Final report

After every red PR is processed, print a table:

```
#<num> <title>
  failing: <check names>
  class: <Type error|Lint|Format|Test|Flake|Pre-existing|Unknown>
  action: <fixed (commit <sha>) | rerun queued | needs user | skipped>
```

Close with a one-line totals: `N PRs scanned, M red, K fixed, L pending, P escalated`.
