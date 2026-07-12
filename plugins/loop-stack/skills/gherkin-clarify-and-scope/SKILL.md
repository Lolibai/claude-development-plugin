---
name: gherkin-clarify-and-scope
description: Clarify requirements using the project's knowledge store and issue tracker (read Description and Comments). Identify scope using semantic search and dependency lookups; output API vs UI feature/steps paths. Use after gherkin-memory-at-start in the Gherkin fix command.
---

# Gherkin Clarify and Scope

## Purpose

Clarify what needs to be fixed (requirements, AC, the tracked issue) and identify the exact feature files, step files, and dependencies so the fix targets the right scope.

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** If a needed capability is `none`, skip those steps. If the config is missing, run the `onboarding` skill and stop.

Use the configured knowledge/requirements store `${memory.store}` (e.g. Qdrant, a vector DB) for requirements/AC lookups, the issue tracker `${issueTracker.tool}` (e.g. Jira) for the ticket, and the E2E layout in `${testing.e2e.*}` for feature/step paths. If a capability is `none`, skip it and fall back to repo scanning + the user prompt.

## When to Use

- After **gherkin-memory-at-start** in the Gherkin fix command (steps 1–2).
- Before editing any `.feature` or step-definition files.

## Clarify Requirements (Step 1)

1. **Requirements/AC lookup** — Query `${memory.store}` for business logic, acceptance criteria (AC002, AC003, etc.), and prior decisions. Natural-language query (e.g. "E2E activate-card acceptance criteria", "dependent record auto-activation").
2. **Recent context (optional)** — List recent stored points/decisions from the store for context.
3. **Semantic search** — Search code and requirements by meaning (e.g. "forgot password flow", "admin users list").
4. **Issue tracker** — If an issue link/key is provided: fetch via the `${issueTracker.tool}` connector and **read both Description and Comments**. Use them to drive the fix and align scenarios with the ticket.

## Identify Scope (Step 2)

1. **Semantic search** — Locate existing features and steps (e.g. "admin users feature", "profile update steps", "forgot password BDD") to find `.feature` and step-definition files.
2. **Dependency lookup** — For step files or app code you might touch, check dependencies (e.g. a `find_dependencies`-style call, or a static import scan) to choose the right tests and avoid breaking unrelated flows.
3. **Paths** (fallback or confirm) — derive from `${testing.e2e.dir}` and the project's API/integration test location; the shape:
   - **API / integration tests**: Features under the API-test features dir, Steps under its steps dir, generated specs under its generated/`.features-gen` dir (run `${testing.e2e.bddStep}` from that test dir after editing `.feature` files when the suite is BDD-driven).
   - **UI / E2E**: Features `${testing.e2e.dir}/<features>`, Steps `${testing.e2e.dir}/<steps>`, plus support/pages dirs under `${testing.e2e.dir}`.

## Subagent Option

For broad discovery (e.g. "find all feature files that mention admin users"), consider spawning an exploration subagent (e.g. `subagent_type: explore`) with a prompt that includes the scope question and the paths above; use the result to narrow scope.

## Related Skills

- `gherkin-memory-at-start` — runs before this.
- `gherkin-implement-and-store` — runs after scope is clear.
- `backend-feature-workflow` — if the scope is an API/server procedure, implementation follows that skill's phases.
- `frontend-component-conventions`, `react-frontend-developer` — if the scope is UI, implementation follows those.
- `devfix` — orchestrator; Phase 1–2 of devfix chains this skill into the Gherkin sub-flow.
- `prompt-improver` — when the issue AC is too vague to scope from.
