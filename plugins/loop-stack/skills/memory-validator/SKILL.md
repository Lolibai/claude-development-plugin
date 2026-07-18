---
name: memory-validator
description: Audits a proposed or completed change against the project's knowledge/memory store to confirm the implementation matches stored business logic, and flags drift when it does not. Reads ${memory.store} from .claude/stack.md (e.g. a vector store like Qdrant, an MCP-backed memory, or none → fall back to project notes under .claude/). Use when the user asks to "validate against requirements / the knowledge store", when a feature touches domain logic, or as a post-implementation gate before pushing. Complements memory-first (which loads/stores context) by providing the validation lens.
---

# Memory Validator

## Purpose

Validates that code aligns with the business logic stored in the project's knowledge/memory store, that the store was actually consulted, and that knowledge-first patterns were followed. This is the validation counterpart to `memory-first`; the reasoning is store-agnostic.

> **Read `.claude/stack.md` first.** Use its values; never assume a specific tool. Read `${memory.store}`
> (e.g. a vector store such as Qdrant, an MCP-backed memory, or `none`). If `${memory.store}` is **`none`**,
> validate against the project's **plain notes/decision files** under `.claude/` instead — read them and
> check the change for contradictions; don't invent a tool. If `.claude/stack.md` is missing, run the
> **`onboard`** skill and stop. Concrete stores named below are **examples** — match `${memory.store}`.

## When to Use

- Implementing new features.
- Reviewing code for business-logic alignment.
- Ensuring knowledge-first patterns are followed.
- Validating business-logic alignment against stored requirements.
- Checking knowledge-store query usage.

## Validation Areas

### 1. Knowledge-first pattern
- **Before implementation**: check the store for existing business logic.
- **During implementation**: use stored knowledge to inform the code.
- **After implementation**: store important decisions back.

### 2. Business-logic alignment
- Verify the code matches stored business rules.
- Check for conflicts with documented requirements.
- Ensure domain knowledge is properly applied.
- Validate against any external requirements source (e.g. a wiki/Confluence).

### 3. Query usage
- Verify knowledge-store queries are used correctly.
- Check semantic-search usage and parameters.
- Ensure proper error handling around store calls.

### 4. Knowledge storage
- Important decisions stored back.
- Business-logic patterns documented.
- Domain knowledge preserved and indexed.

## Validation Checklist

- [ ] Knowledge store searched before implementing business logic
- [ ] Code aligns with stored business rules
- [ ] Store queries used correctly
- [ ] Important decisions stored back
- [ ] Business logic matches requirements
- [ ] Domain knowledge properly applied

## Knowledge-First Workflow

### Before implementation
1. Search the store for relevant business logic.
2. Review external requirements (e.g. a wiki).
3. Check existing implementations.
4. Identify any conflicts.

### During implementation
1. Use stored knowledge to inform code.
2. Follow established patterns.
3. Apply domain knowledge.
4. Ensure compliance with business rules.

### After implementation
1. Store important decisions back.
2. Document business-logic patterns.
3. Update the knowledge base.
4. Index relevant requirements.

## Common Issues

### Missing knowledge-store search
```typescript
// ❌ WRONG: implementing without checking the store
export function createDependent(data: CreateDependentInput) {
  // Assumes business logic without checking stored requirements
}

// ✅ CORRECT: check the store first
// 1. Search the knowledge store for "dependent creation business rules"
// 2. Review requirements
// 3. Implement based on findings
```

### Ignoring business logic
```typescript
// ❌ WRONG: ignoring stored business rules
if (cardId) {
  // Auto-activate without checking requirements
  card.status = 'active';
}

// ✅ CORRECT: follow stored requirements
// AC002: Create with cardId → auto-activate
// AC003: Create without cardId → manual activation
```

## Validation Process

1. **Check store usage**: verify the knowledge store was consulted.
2. **Review business logic**: ensure alignment with stored knowledge.
3. **Validate patterns**: check knowledge-first patterns are followed.
4. **Verify storage**: important decisions stored back.
5. **Report issues**: document any violations or misalignments.

## Related skills

- `memory-first` — the companion skill that loads the store at task start and stores decisions after; this skill provides the validation lens.
- `the-journalist` — when a validation finding must be persisted as a durable journal + knowledge-store entry.
- `principal-architect` — pair for architectural + business-logic dual review.
- `devfix` — Phase 4 writeback step calls into this skill for drift check before declaring done.
- `github-pr-review` — use this skill's lens when reviewing whether a PR honors stored requirements.
- `backend-feature-workflow` — consult the knowledge store per this skill before Phase 1 domain modeling.
