---
name: the-journalist
description: Persists a durable record of a decision, incident, or learning across markdown journals (`docs/` or a session summary MD) and the configured knowledge/memory store with proper metadata (type, domain, tags, importance). Use when the user says "document this", "journal this", "write this down", "save this decision", or when a non-trivial architectural/business decision just concluded. Complements `memory-first` (which also stores on-the-fly) by producing a structured, human-readable journal entry in addition to the memory writeback.
---

# The Journalist

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** The memory/knowledge
> target comes from `${memory.store}` (e.g. a vector DB like Qdrant/pgvector, or a Memory MCP); the
> markdown journal location and tagging conventions come from the config too. If `${memory.store}` is
> `none`, write the markdown journal only and skip every memory-writeback step. If `.claude/stack.md` is
> missing, run the **`onboarding`** skill and stop.

## Purpose

Documents important information, decisions, and learnings into markdown journals and/or the project's configured `${memory.store}`.

## When to Use

Use this skill when:
- User asks to document something
- Recording important decisions
- Creating journals or documentation
- Storing knowledge for future reference
- Preserving architectural decisions
- Documenting business logic

## Documentation Targets

### 1. Markdown Journals (always available)
- **Location**: the project's journal directory (e.g. `docs/journals/`)
- **Format**: Markdown files with structured content
- **Naming**: Descriptive filenames with dates
- **Content**: Decisions, learnings, patterns, insights

### 2. Configured memory / knowledge store (`${memory.store}`, only if not `none`)
- **Purpose**: Semantic search and knowledge retrieval (e.g. a vector DB such as Qdrant/pgvector, or a Memory MCP)
- **Content**: Business logic, requirements, patterns
- **Metadata**: Include type, domain, context, tags, importance
- **Usage**: Searchable knowledge base; use whatever write/search verbs the configured store exposes (e.g. a `store`/`find` pair)

## Documentation Structure

### Markdown Journal Format
```markdown
# Title

## Date
YYYY-MM-DD

## Context
Background information and situation

## Decision
What was decided and why

## Rationale
Reasoning behind the decision

## Alternatives Considered
Other options that were evaluated

## Impact
Effects of this decision

## Related
Links to related decisions or documentation
```

### Memory-store record format (`${memory.store}`)
- **Type**: Decision, Pattern, Requirement, Learning
- **Domain**: Business domain or technical area
- **Content**: Detailed information
- **Metadata**: Tags, dates, related items

## Documentation Process

### 1. Gather Information
- Collect relevant context
- Identify key decisions
- Note important learnings
- Gather related information

### 2. Structure Content
- Organize information logically
- Use clear headings
- Include examples where relevant
- Link to related documentation

### 3. Store Appropriately
- **Markdown**: For human-readable journals (always)
- **`${memory.store}`**: For searchable / structured knowledge (skip if `none`)

### 4. Index and Link
- Add appropriate metadata
- Link to related documents
- Tag for discoverability
- Update indexes if needed

## Content Types

### Decisions
- Architectural decisions
- Technology choices
- Business logic decisions
- Process changes

### Learnings
- Lessons learned
- Best practices discovered
- Common pitfalls
- Solutions to problems

### Patterns
- Code patterns
- Design patterns
- Workflow patterns
- Integration patterns

### Requirements
- Business requirements
- Technical requirements
- Constraints
- Acceptance criteria

## Best Practices

- **Be Specific**: Include concrete details
- **Be Complete**: Cover context, decision, rationale
- **Be Timely**: Document soon after decisions
- **Be Searchable**: Use appropriate tags and metadata
- **Be Linked**: Connect related documentation

## Output Format

When documenting:
1. **Choose Format**: Markdown, and/or `${memory.store}` if configured
2. **Structure Content**: Use appropriate format
3. **Add Metadata**: Tags, dates, relationships
4. **Store**: Save to appropriate location
5. **Index**: Make it discoverable

## Related skills

- `memory-first` — pair: this skill writes durable journals; that skill handles day-to-day store/retrieve against `${memory.store}`.
- `memory-validator` — validation lens before journaling to avoid preserving contradictions.
- `observer-guy` — observation reports that may escalate into a journal entry.
- `devfix` — Phase 4 writeback step can call into this skill for longer-form journaling of incidents.
- `github-pr-review` — review memory-writeback step may escalate here for architectural learnings.
- `principal-architect` — architectural decisions often warrant a journal entry via this skill.
