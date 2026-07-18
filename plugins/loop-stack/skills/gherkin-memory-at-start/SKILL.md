---
name: gherkin-memory-at-start
description: At Gherkin fix command start, load the project's memory/knowledge store and requirements store using the issue key, description, or user prompt. If a match is found, use it to build on or replace what semantic search will later craft, per the issue Description/Comments or User Prompt.
---

# Gherkin Memory at Start

## Purpose

Before doing any Gherkin fix work, check for existing implementation memory so the agent can build on or replace search/RAG output based on prior bugs and tracked implementations.

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** If a needed capability is `none`, skip those steps. If the config is missing, run the `onboard` skill and stop.

This skill reads from whatever memory/knowledge store is configured in `${memory.store}` (e.g. Qdrant, a vector DB, a notes index) and the issue tracker in `${issueTracker.tool}` (e.g. Jira). If `${memory.store}` is `none`, skip the memory load and rely on the issue + user prompt. If `${issueTracker.tool}` is `none`, build the query from the user's prompt alone.

## When to Use

- At the very start of the **Gherkin fix** command (step 0).
- When the user provides an issue key, ticket summary, or prompt that might match a past fix.

## Load Sequence

1. **Structured rules (optional)** — Load any structured rules/facts the memory store exposes (e.g. a `memory_facts`-style call).
2. **Semantic memory search** — Query the memory store (e.g. a `memory_search`-style call) built from the issue key, summary, user prompt, or description (e.g. "<KEY> activate-card verification email", "admin order details"). Use optional filters / top-k.
3. **Requirements / knowledge-store search** — Run the same or a similar natural-language query against the project's requirements store (e.g. a Qdrant `qdrant-find`-style call), keyed by issue key, feature name, or bug summary.

## If You Find a Match

- Use the stored implementation to **build on top of** what later semantic/RAG search returns, or **replace** RAG-driven choices when the **issue Description**, **issue Comments**, or **User Prompt** clearly say to do something different.
- Memory advises; the issue and user instructions take precedence when they conflict.

## Stores

- Memory / knowledge store: `${memory.store}` (the structured + semantic memory the project uses).
- Requirements store: the project's requirements/knowledge index (often the same `${memory.store}`).

## Related Skills

- `memory-first` — general task-start load; this skill is the Gherkin-fix-specific application.
- `memory-validator` — pair to catch drift between the Gherkin scenario and stored business logic.
- `gherkin-clarify-and-scope` — runs after this skill.
- `devfix` — owns the full Gherkin sub-flow; Phase 1 of devfix calls into this skill when a Gherkin scenario is in play.
