---
name: memory-first
description: At task start, load existing context from the project's knowledge/memory store before implementing or advising; when the task produces decisions or patterns, store them back so future runs reuse them. Reads ${memory.store} from .claude/stack.md and adapts (e.g. a vector store like Qdrant plus a structured-facts memory); when the store is none, falls back to plain file/notes memory under .claude/. Use when starting non-trivial tasks, documenting decisions, or ensuring business logic aligns with stored knowledge.
---

# Memory First

## Purpose

Before implementing or advising, **load** existing context from the project's knowledge/memory store. When the task produces decisions or patterns, **store** them so future runs can reuse them. This is the same load-then-store loop regardless of which backend holds the knowledge.

> **Read `.claude/stack.md` first.** Use its values; never assume a specific tool. Read `${memory.store}`
> (e.g. a vector store such as Qdrant, an MCP-backed memory, or `none`). If `${memory.store}` is **`none`**,
> there is no configured knowledge store — **fall back to plain file/notes memory**: read any project notes
> under `.claude/` (e.g. `.claude/memory/*.md`, decision logs) at task start, and append new decisions there
> after. Don't invent a tool. If `.claude/stack.md` is missing, run the **`onboard`** skill and stop.
> Concrete stores named below are **examples** — match `${memory.store}`.

## When to Use

- Starting any non-trivial task (feature, fix, refactor).
- User asks about past decisions, incidents, or "how we do X."
- After resolving a bug or making an architectural decision (store it).
- When business logic or requirements are unclear (search the knowledge store).

## Load Sequence (start of task)

Run the loads the configured store supports, in this order. Use the task topic as the query.

1. **Structured facts** — if the store exposes a facts/rules lookup, call it first (e.g. a memory MCP's `memory_facts`). Returns structured rules/preferences.
2. **Memory search** — query with the task topic (e.g. `query: "E2E strategy"`), with optional filter / `top_k` (default ~5), via the configured memory search (e.g. a memory MCP's `memory_search`).
3. **Semantic / knowledge search** — natural-language query for business logic and codebase knowledge (e.g. a vector store's `qdrant-find`: `query: "How does activate card work?"`).

If `${memory.store}` is `none`, the equivalent is: read the project's notes/decision files under `.claude/` and skim for anything touching the task topic.

Use the results to avoid contradicting prior decisions and to align with stored business logic.

## Store When Appropriate

- **Structured memory store**: decisions, constraints, incidents, patterns. Use the store's write call (e.g. a memory MCP's `memory_store`) with `content`, optional `type` (decision|constraint|incident|pattern|note), `project`, `domain`, `tags`, `importance` (0–1).
- **Semantic store**: the same or summarized information for semantic retrieval (e.g. a vector store's `qdrant-store`) with `information` and optional `metadata`.
- **File fallback** (`${memory.store}` = `none`): append a dated entry to a notes/decision file under `.claude/` (e.g. `.claude/memory/decisions.md`).

Prefer **updating an existing memory** (e.g. a memory MCP's `memory_update(id, content)`) over storing a duplicate when refining something already recorded.

## Knowledge-store usage notes

- Read/store/update/search the structured memory for durable rules, preferences, and incidents.
- Use the semantic/vector store for business-logic questions **before** coding.
- Consult the knowledge store (and any wiki/codebase) before starting a new feature.

## Related Skills

- **memory-validator** — validation lens; use after this skill's load/store to confirm the implementation matches stored business logic.
- **the-journalist** — durable markdown + knowledge-store journaling for decisions worth preserving long term.
- **principal-architect** — architecture review that relies on stored memory/knowledge context.
- **devfix** — Phase 1 and Phase 4 of devfix both call into this skill (load then writeback).
- **gherkin-memory-at-start** — specialized version of this skill for the Gherkin sub-flow.
- **figma-plan-and-validate**, **implement-designs** — Phase 0 of each loads via this skill.
- **github-pr-review** — PR context-gathering step uses this skill's load sequence.
