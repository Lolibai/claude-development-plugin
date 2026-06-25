---
name: gherkin-implement-and-store
description: Implement the Gherkin fix by reusing existing code patterns and avoiding duplication; edit feature and step files; regenerate BDD specs for API tests; then store the implementation in the project's memory/knowledge store. Use after gherkin-clarify-and-scope.
---

# Gherkin Implement and Store

## Purpose

Implement the fix in feature files and step definitions while reusing patterns, avoiding duplication, and storing the outcome in memory for future command runs.

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** If a needed capability is `none`, skip those steps. If the config is missing, run the `onboarding` skill and stop.

Use the project's code-intelligence tools (pattern/dup/refactor search, if available), the BDD/generation step `${testing.e2e.bddStep}` for the configured E2E runner, and the memory/knowledge store `${memory.store}` for the store phase. If `${memory.store}` is `none`, skip the store phase. If the issue tracker `${issueTracker.tool}` is `none`, omit issue-key tagging.

## When to Use

- After **gherkin-clarify-and-scope** in the Gherkin fix command (step 3).
- When the scope (feature files, steps, and any app code) is known.

## Implement

1. **Find similar code** — With a snippet of the step or scenario you're adding, so new steps match existing style and structure (e.g. a `find_similar_code`-style capability, or a repo search).
2. **Find duplicate patterns** — e.g. similarity threshold 0.8 to spot repeated step logic to share or refactor.
3. **Find code patterns** — for step definitions or Gherkin usage; align with existing patterns or avoid anti-patterns.
4. **Refactoring suggestions** — If touching app/API code, for the file(s) you change.
5. Edit **feature file(s)** and/or **step definition(s)**; keep scenarios aligned with clarified requirements and the tracked issue (if any).
6. For API tests: after changing `.feature` files, run the BDD generation step `${testing.e2e.bddStep}` from the API-tests directory (when that suite is BDD-driven).

## Store (Every Bug or Tracked Implementation)

1. **Memory store** — Save a short summary to `${memory.store}` (e.g. a `memory_store`-style call): issue key (if any), what was implemented, key paths, rationale. Set `type` (e.g. decision, pattern, incident for bugs), `domain`, `tags` (e.g. the issue key), and `importance` so the start-of-command memory search can match.
2. **Requirements/knowledge store** — Write the same content and metadata (e.g. domain, feature, issue key) to the project's requirements/knowledge index (often the same `${memory.store}`) so later searches find it.

If the user or the issue Description/Comments say to do something different next time, build on or replace what RAG/memory suggested using that as the source of truth.

## Related Skills

- `gherkin-clarify-and-scope` — runs before this.
- `gherkin-run-and-assure` — runs after this to execute tests and assure the user.
- `backend-feature-workflow` — canonical patterns when the implementation touches a server router/service/repo.
- `serverless-function` — if implementation touches the configured serverless/edge platform (`${edge.platform}`) config/imports or shared handler.
- `database-migration` — if implementation requires a DB schema change on `${backend.platform}`.
- `frontend-component-conventions`, `react-frontend-developer` — if implementation touches UI.
- `the-journalist`, `memory-first`, `memory-validator` — the store phase of this skill.
- `devfix` — owns the full flow.
