# Create PR with Issue-Key prefix

Read `.claude/stack.md` first; use its values; never assume a specific tool; if a needed capability is `none`, skip those steps; if the config is missing, run the `onboard` skill and stop.

Create or update a pull request on the configured VCS host (`${project.vcsHost}` — e.g. GitHub via its MCP, or `gh`), and enforce the title/body rules below. **Do not** enable auto-merge on the PR (no `--auto`, no toggling auto-merge in the host UI).

> **Capability notes.** Steps that read the issue tracker apply only when `${issueTracker.tool}` ≠ none; if it's `none`, skip issue-key/AC harvesting and use a plain descriptive title + the `## What changed` body. The linked-docs sub-step applies only if the tracker links out to a docs/wiki tool (e.g. Confluence); skip it otherwise.

## Step 0 — AC Gate (BLOCKING, runs before anything else)

No PR is created or updated until this passes — regardless of which skill or flow invoked this command, and even if AC were checked earlier in the session (re-verify fresh; earlier phases may have drifted). **If `${issueTracker.tool}` is `none`, skip this gate** and go to Rules.

1. **Harvest AC fresh**:
   - Extract the issue key from the current branch per `${vcs.branchNaming}` (key pattern `${issueTracker.keyPrefix}-<n>`). Fetch the issue (Description + comments) from the issue tracker (`${issueTracker.tool}` — e.g. Jira/GitHub Issues/Linear via its MCP).
   - **Fetch any linked docs and read every linked page** (e.g. remote issue links → wiki/Confluence pages). This is forced: if linked docs exist and were not fetched, the gate is BLOCKED. If the issue has no AC of its own, walk up to the parent / Epic and their linked docs.
   - If the user supplied AC inline in the conversation, merge them in verbatim.
2. **Verify each AC item** against the branch diff (`git diff {base}..HEAD`): implementation pointer (file/component/procedure) + covering test (unit / API BDD / E2E scenario name).
3. **On any gap** (AC item with no implementation or no covering test): **STOP — do not create the PR.** Report the gap to the user and either resolve it or get explicit sign-off to defer it with an issue reference.
4. **Produce the `## ACs covered` table** for the PR body: `criterion | implementation | test | status` with status ∈ `covered | deferred (<KEY>) | n/a (reason)`. Mark docs-sourced criteria with the page title. If the issue genuinely defines no AC anywhere (tracker + linked docs + parent chain), write `## ACs covered: none defined on <KEY>` — silence is not allowed.

```
CHECKPOINT-PR-0: AC GATE  (skip if ${issueTracker.tool} = none)
  REQUIRES:
    - Issue fetched fresh (Description + comments)
    - All linked docs pages fetched and parsed for AC
    - Every AC item mapped to implementation + test, or explicitly deferred with user sign-off
    - "## ACs covered" section built for the PR body
  BLOCKED BY:
    - Linked docs present but not fetched
    - Any unresolved AC gap
    - AC section missing from the planned PR body
```

## Rules

1. **PR title prefix**: When the tracker is configured, always use the **issue key** as the title prefix.
   - Derive the key from the **current Git branch name** per `${vcs.branchNaming}`.
   - Pattern: `${issueTracker.keyPrefix}-?(\d+)` (case-insensitive), e.g. `task/<KEY>-foo` → `<KEY>`.
   - Format: `{KEY} {rest of title}` (e.g. `{KEY} feat(frontend): add navy header CTAs`).
   - If no match in the branch name, use `${issueTracker.keyPrefix}-000` as the prefix.
   - **If a PR already exists** and its title does not start with `{KEY} `, **update** the PR so the title fits this rule (prepend or replace prefix).
   - (If `${issueTracker.tool}` is `none`, use a plain descriptive title with no key prefix.)

2. **PR body — CHANGELOG-style description**: Every PR (new or updated) must have a short **What changed** section in CHANGELOG style.
   - Generate from commits on the branch: `git log <base>..HEAD --oneline` or `git log <base>..HEAD --pretty=format:"- %s"`.
   - Prefer a concise list; one line per logical change is enough. Example:
     ```markdown
     ## What changed
     - feat(frontend): add navy "Be Safe - Activate Card" and "Be Ready - Request Card" buttons in login header
     - feat(frontend): show header CTAs from md breakpoint on login page
     - fix(frontend): remove Login button from header when already on login page
     ```
   - If the user provided a description, merge it with this section (e.g. "## Summary" + user text, then "## What changed" + generated list).
   - **When the tracker is configured, the body must also contain the `## ACs covered` section from Step 0** — such a PR body without it is invalid.
   - When **updating** an existing PR, set the body to this CHANGELOG-style content (replace or append the "What changed" and "ACs covered" parts if the body already has other sections).

3. **Create or update via the VCS host**:
   - **owner** / **repo**: from `git remote get-url origin` (falls back to `${project.repo}`).
   - **head**: current branch (`git branch --show-current`). For listing, use `head: "{owner}:{branch}"`.
   - **base**: `${vcs.integrationBranch}` (or the repo's default branch).
   - **If an open PR exists** for this branch: list open PRs filtered to `head: "{owner}:{branch}"` to get the PR number, then update it with `title: "{KEY} {description}"` (fix title if it lacks the prefix) and `body` = CHANGELOG-style description above.
   - **If no open PR exists**: create the PR with `owner`, `repo`, `title`, `head`, `base`, and `body` (CHANGELOG-style).

## Steps

0. **Run the AC Gate above** (skip if `${issueTracker.tool}` = none) — fetch the issue + all linked docs pages, verify every AC item, build the `## ACs covered` table. Do not continue until CHECKPOINT-PR-0 passes.
1. Get the current branch and extract the issue key (regex `${issueTracker.keyPrefix}-?(\d+)` → `${issueTracker.keyPrefix}-{digits}`); skip if no tracker.
2. Get owner/repo from `git remote get-url origin`; set base = `${vcs.integrationBranch}`.
3. **Check for existing PR**: list open PRs with `head: "{owner}:{currentBranch}"`. If one exists, note its PR number.
4. **Build the body**: run `git log {base}..HEAD --pretty=format:"- %s"` and format as "## What changed" + bullet list (short, one line per change), followed by the "## ACs covered" table from Step 0 (when the tracker is configured).
5. **Title**: `{KEY} {description}` — use last commit subject (strip an existing `${issueTracker.keyPrefix}-XXX` if present) or a one-line summary; no key prefix when there's no tracker.
6. **If PR exists**: update it with `owner`, `repo`, PR number, `title` (with key prefix), `body` (CHANGELOG-style). If the PR already had a body with other sections, keep them and ensure "## What changed" is present/updated.
7. **If no PR**: create it with `owner`, `repo`, `title`, `head`, `base`, `body`.
8. Reply with the PR URL and whether it was created or updated.

## Post-action — Independent PR Review

After the PR URL is confirmed, spawn the `pr-reviewer` agent with:

```yaml
owner: <owner>
repo: <repo>
pull_number: <number>
issue_key: <key extracted from branch, if any>
```

This agent has no `context: fork` — it reviews cold from the host's diff alone, without session history. Wait for it to return, then surface its verdict and `review_url` to the user.
