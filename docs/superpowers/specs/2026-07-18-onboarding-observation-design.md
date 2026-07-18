# Onboarding: live PR/deploy observation + `/init`-style re-runs — design

Date: 2026-07-18
Component: `plugins/loop-stack/skills/onboarding/` (`onboarding.mjs`, `SKILL.md`)

## Problem

Every project has a PR system and a deployment system, but onboarding barely looks at
them: it lists `.github/workflows/` filenames matching `deploy` and takes the *currently
checked-out* branch as the integration branch. It never observes the live systems (real
base branch, merge style, protections, environments, non-Actions deploy platforms), and
its "one-time setup" framing discourages re-running even though the loops depend on
these values being current.

## Goals

1. **Observe, don't guess.** During onboarding, actively observe the project's PR system
   and deployment system; observed facts become the defaults in `.claude/stack.md`.
2. **Universal.** The plugin must apply to any project. No observation layer may be
   required; each degrades gracefully to the next. Nothing assumes GitHub.
3. **Re-runnable like `/init`.** Running onboarding again refreshes observations and
   merges them with the existing config; conflicts are surfaced, never silently
   clobbered, and repeated runs are idempotent.

## Non-goals

- Continuous monitoring of PRs/deploys after onboarding (that's the loops' job).
- Full GitLab/Bitbucket API parity in the script — the Claude gap-fill layer covers
  hosts the CLIs can't observe.
- Changing the `stack.json`/`stack.md` consumer contract (readers keep working unchanged).

## Design

### 1. `observe()` phase in `onboarding.mjs`

Runs after `detect()`. Layered, strongest-available source wins; every probe goes
through `tryExec` (failure ⇒ empty ⇒ next layer). Observation can never fail onboarding.

**Layer 0 — pure git (available in any repo):**
- `git remote show origin` → `HEAD branch` = real integration branch (replaces the
  current-branch guess).
- `git log --merges --first-parent -50` on the integration branch → merge style:
  mostly merge commits ⇒ `merge`; near-linear history ⇒ `squash`/`rebase`.
- `git branch -r` → observed branch-naming pattern (e.g. dominant `<type>/<KEY>`-like
  prefixes) and candidate env branches (`develop`, `stage`, `staging`, `release/*`).

**Layer 1 — host CLI when authenticated (`gh`; `glab` if present):**
- Last ~30 merged PRs → dominant base branch (confirms/overrides layer 0), head-ref
  naming pattern, frequent reviewers → `vcs.prReview`.
- Repo settings → allowed merge methods → `vcs.autoMerge`.
- Branch protection on the integration branch → recorded observation (config already
  hardcodes "respect protection: always").
- `gh api repos/{repo}/environments` → environment names; protection rules on them seed
  `ci.humanGatedEnvs`.
- `gh run list` filtered to deploy workflows → which deploys are actually alive.

**Layer 2 — host-agnostic file sweep (deploy platforms):**
- Parse `.github/workflows/*.yml` (also `.gitlab-ci.yml`, `bitbucket-pipelines.yml`
  presence) for `on.push.branches` + deploy-ish job/workflow names → env → branch →
  workflow mapping (today: filename grep only).
- Config files → `ci.deployPlatforms` (new field, list): `vercel.json`, `netlify.toml`,
  `fly.toml`, `render.yaml`, `Procfile`, `Dockerfile`/`compose.yaml`, `serverless.yml`,
  Supabase config, `app.yaml`, `wrangler.toml`.

**Layer 3 — Claude gap-fill (SKILL.md, not the script):** any field the report marks
`unobserved` (no CLI, exotic host), Claude observes manually with whatever tools exist
or asks the user; then writes the values into the config like any other answer.

**Output:** an `observed` object with per-field values + `source` (`git`/`gh`/`files`/
`unobserved`), printed as a short report; `--detect-only` includes it; stored as
`_observed` (with an ISO timestamp) in `stack.json` for future re-run diffs.

### 2. `/init`-style re-runs (three-way merge)

Replace "previous config as defaults" with a per-field merge of **previous config** vs
**fresh observation**:

| Case | Behavior |
|---|---|
| config empty/`none`, observation has value | fill it; list in the run summary |
| config set, observation agrees (or has nothing) | keep silently |
| config set, observation disagrees | **conflict** |

Conflict handling: interactive mode prompts per field ("observed `squash`, config has
`rebase` — keep config [Enter] / take observed [o]"); `--non-interactive` keeps existing
values and prints each disagreement as a warning line. Fields the user has never set
follow observation freely.

Idempotence guarantees (unchanged from today, restated as requirements): loop specs are
copied only if absent; `CLAUDE.md` never clobbered; `.gitignore` append-once; state dir
`mkdir -p`. A re-run with nothing changed produces zero diffs in `stack.md`
(`_observed.timestamp` in `stack.json` may move).

### 3. `SKILL.md` updates

- Reframe from "one-time" to "run at setup, re-run any time — like `/init`"; add
  re-run trigger phrases ("refresh the stack config", "re-onboard") to the description.
- Add the Layer-3 instruction: after the script runs, read the observation report; for
  each `unobserved` PR/deploy field, observe it manually or ask, then update
  `.claude/stack.md` + `stack.json`.
- Document that the PR and deploy sections are expected to end up populated in every
  project (every project has both systems); onboarding shouldn't finish with them
  `none` without an explicit user confirmation that the project truly lacks one.

## Error handling

- All external commands via `tryExec` (`""` on any failure) — missing `gh`, no auth, no
  remote, detached HEAD, empty repo all degrade to lower layers, never throw.
- YAML "parsing" of workflows is regex-grade extraction (`on:`/`push:`/`branches:`,
  `environment:`) — wrong-but-present YAML yields fewer observations, not errors.
- Conflict prompt only in interactive mode; non-interactive never blocks.

## Testing

Manual verification against real repos (script has no test harness; keep it that way —
zero-dependency single file):

1. This repo: `--detect-only` shows integration branch `main` (from remote HEAD, not
   current branch), merge style observed from history, no deploy platforms.
2. A GitHub project with Actions deploys (user's work repo): env→branch→workflow map
   and environments observed; report shows `gh`-sourced fields.
3. Re-run behavior: run `--non-interactive` into a scratch `--out`, hand-edit a value
   (`autoMerge: rebase`), re-run — warning printed, value kept; interactive re-run —
   per-field prompt appears.
4. Degradation: `PATH` without `gh` → all layer-1 fields `unobserved`, script exits 0.

## Rollout

Bump loop-stack to 1.2.0. No consumer changes: existing `stack.md` readers see the same
sections (plus `deployPlatforms` line in CI/deploy).
