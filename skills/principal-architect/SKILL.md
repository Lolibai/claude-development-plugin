---
name: principal-architect
description: Architectural review lens — checks Clean Architecture dependency direction (domain ← application ← infrastructure ← presentation), port/adapter boundaries, the project's data-sensitivity / compliance regime (encryption + audit logging of sensitive data), row-level / authorization policy coverage, and cross-package coupling. Use when the user asks for an "architectural review", proposes a cross-layer change, adds/moves a repository or service, introduces a new bounded context, or when a diff risks leaking domain concepts into infrastructure. For per-PR review with posted comments prefer `github-pr-review`; for runtime/test issues prefer `devfix`.
---

# Principal Architect

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** Backend/data platform
> (`${backend.platform}`), edge platform (`${edge.platform}`), frontend stack (`${frontend.*}`), and any
> project-specific architecture/compliance rules (in the project's rules file or `${recoveryNotes}`) come
> from config — read them and judge against the project's actual stack and regime, not a presumed one. If a
> capability is `none`, skip the checks that depend on it. If `.claude/stack.md` is missing, run the
> **`onboarding`** skill and stop.

## Purpose

Reviews code and design decisions from an architectural perspective, ensuring Clean Architecture principles, proper dependency direction, the project's compliance / data-sensitivity requirements, and system design best practices.

## When to Use

Use this skill when:
- Reviewing code for architectural issues
- Making architectural decisions
- Ensuring the project's compliance / data-sensitivity requirements are met
- Verifying dependency direction
- Assessing system design quality

## Review Areas

### 1. Clean Architecture
- **Dependency Direction**: Verify dependencies flow inward (Domain ← Application ← Infrastructure ← Shared)
- **Layer Separation**: Ensure proper separation of concerns
- **Ports and Adapters**: Verify interfaces are in domain, implementations in infrastructure
- **No Circular Dependencies**: Check for circular imports or dependencies

### 2. Dependency Injection
- **Context-Based**: Services injected via the request/app context, not global singletons (e.g. a tRPC/Nest/Express context)
- **Lazy Instantiation**: Services created on-demand, not at module level
- **Testability**: Easy to mock services in tests
- **No Build-Time Validation**: Avoid environment validation at build time

### 3. Compliance / data-sensitivity (per the project's regime)
> Check against the project's declared regime and sensitive-data classes (e.g. HIPAA PHI, GDPR PII) — read it from the project's rules file / `${recoveryNotes}`. If the project handles no regulated data, this lens is a no-op.
- **Sensitive-data protection**: Regulated/sensitive data encrypted at rest and in transit
- **Access Controls**: Proper RBAC and authorization checks
- **Audit Logging**: All sensitive-data access logged (via the project's audit mechanism, e.g. an audit middleware)
- **Error Messages**: Generic error messages (no user enumeration)
- **Secrets Management**: No secrets in code; use the project's secret store (e.g. a managed key/secret vault)

### 4. Security Architecture
- **Authentication**: Proper JWT/session handling
- **Authorization**: RBAC checks on all endpoints
- **Input Validation**: Validate all external inputs
- **Rate Limiting**: Applied to API endpoints
- **Error Handling**: Generic messages for auth errors

### 5. Type Safety
- **Enum Validation**: Validate external enum values with type guards
- **No Unsafe Types**: Avoid `any` or unsafe assertions
- **Type Guards**: Use type guards for runtime validation
- **Proper Types**: Use domain types, not DTOs in domain layer

## Review Checklist

- [ ] Dependencies flow in correct direction (inward)
- [ ] No circular dependencies
- [ ] Services injected via context, not global
- [ ] Domain layer doesn't depend on outer layers
- [ ] Regulated/sensitive data properly encrypted and protected (per the project's regime)
- [ ] Authorization checks on all endpoints
- [ ] Generic error messages (no user enumeration)
- [ ] No secrets in code
- [ ] External enum values validated
- [ ] Proper type safety throughout

## Common Violations

> Examples below are illustrative (the patterns are language/stack-agnostic). Adapt them to the project's actual language, framework, and persistence layer from `.claude/stack.md`.

### Wrong Dependency Direction
```typescript
// ❌ WRONG: Domain importing from shared
import { SomeUtil } from '../../../shared/utils';

// ✅ CORRECT: Define in domain, shared imports from domain
export interface SomeType { ... }
```

### Module-Level Instantiation
```typescript
// ❌ WRONG: Triggers env validation at build time
const repo = new ConcreteRepository();

// ✅ CORRECT: Lazy instantiation in context
get repository() {
  _repo ??= new ConcreteRepository();
  return _repo;
}
```

### User Enumeration
```typescript
// ❌ WRONG: Leaks user existence
throw new AppError({ message: `User ${email} not found` });

// ✅ CORRECT: Generic message
throw new AppError({ message: 'Invalid email or password' });
```

## Recommendations

When reviewing, provide:
- Specific violations with file/line references
- Correct patterns to follow
- Architectural improvements
- Compliance concerns
- Security issues

## Related skills

- `backend-feature-workflow` — canonical Clean-Architecture layering this skill audits against.
- `database-migration` — row-level / authorization policy coverage this skill validates on sensitive tables (reads `${backend.platform}`).
- `serverless-function` — per-function config + request-handler patterns reviewed here for structural risk (reads `${edge.platform}`).
- `frontend-component-conventions` — component rules and smart/dumb split reviewed on frontend diffs.
- `github-pr-review` — use when the review must produce posted comments on a PR instead of a standalone report.
- `devfix` — Analyzer subagent escalates here when `risks.compliance` or `risks.clean_arch` is `high`.
- `memory-validator` — pair with this skill to check both architectural shape and business-logic alignment.
