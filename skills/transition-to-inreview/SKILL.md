---
name: transition-to-inreview
description: Move an issue to its "in review" state via the configured issue tracker. Use when the user says /transition-inreview, "move to In Review", "transition to review", or right after `/pushcommit` / `/create-pr` to flip the ticket. Resolves the issue key from the current branch if not supplied.
---

# transition-to-inreview

Flip an issue's status to its **in-review** state with zero ceremony. Pairs with `/pushcommit` and `/create-pr` so a finished bugfix ends in the right column without manual UI clicks.

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** If a needed capability is `none`, skip those steps. If the config is missing, run the `onboarding` skill and stop.

This skill drives the issue tracker named in `${issueTracker.tool}` (e.g. Jira, GitHub Issues, Linear) via its connector. If `${issueTracker.tool}` is `none`, there is no status to flip — report that and stop. All keys, states, and connection details below come from config, never hardcoded.

## When to use
- User invokes `/transition-inreview`
- User says "move <KEY> to In Review" / "transition to review" / "mark in review"
- Tail end of `devfix` / `/pushcommit` / `/create-pr` flow, once the PR exists

## Inputs
- **issueIdOrKey** — explicit `${issueTracker.keyPrefix}-####` if the user gave one. Otherwise extract from the current git branch (`git rev-parse --abbrev-ref HEAD` → match the key pattern implied by `${vcs.branchNaming}` / `${issueTracker.keyPrefix}`). If no branch match, ask the user once.
- **connection** — `${issueTracker.connection}` (the tracker host/site). Pass it directly; the connector accepts it.

## Steps

1. **Resolve the issue key** (skip if user supplied one):
   ```bash
   git rev-parse --abbrev-ref HEAD
   ```
   Match the `${issueTracker.keyPrefix}-\d+` pattern. If no match: ask the user for the key, do nothing else.

2. **Look up the target transition** — names and ids drift, so always fetch the live transition list for the issue from the tracker (e.g. Jira `getTransitionsForJiraIssue`, passing `${issueTracker.connection}` + the key).
   - Find the transition whose target is the configured in-review state, `${issueTracker.states.inReview}` (match by name, case-sensitive). Use its id (or, for trackers that need a numeric id, the value from `${issueTracker.transitionIds}` for that state).
   - If the in-review state is not in the list, the current status doesn't allow it — surface the available transitions back to the user and stop. **Don't pick a different transition silently.**

3. **Apply the transition** via the tracker's transition call (e.g. Jira `transitionJiraIssue` with `${issueTracker.connection}`, the key, and the resolved transition id).
   - On success, report the new status and the issue URL (build it from `${issueTracker.connection}` + the key).

## Reference — confirming transition ids
Transition ids/names are tracker- and project-specific and are **not** guaranteed stable; the canonical mapping (when the tracker needs numeric ids) lives in `${issueTracker.transitionIds}` and the named states in `${issueTracker.states.*}`. Always confirm against the live transition list (step 2) before applying. Do not hardcode an id table here.

## Output
One sentence: "<KEY> → <in-review state> (<issue URL>)". Nothing else.

## Don'ts
- Don't fetch the issue first to "check status" — the transition list already encodes legality.
- Don't add a comment or change fields. This skill only flips status.
- Don't pick a fallback transition (e.g. the verified/ready state) when the in-review state is unavailable. Report and stop.
