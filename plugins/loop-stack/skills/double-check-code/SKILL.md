---
name: double-check-code
description: Systematically verify code quality after implementation by running builds, tests, lints, and reviewing for common mistakes. Use after implementing features, fixing bugs, or making any code changes to ensure quality and catch regressions.
---

# Double-Check Code

## Purpose

Systematically verify code quality after implementation by running builds, tests, lints, and reviewing for common mistakes.

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** If a needed capability is `none`, skip those steps. If the config is missing, run the `onboard` skill and stop.

All build/lint/test commands come from `${commands.*}` (e.g. pnpm/npm/yarn `build`, `typecheck`, `lint`, `test`). Run them from the appropriate package/dir for the changed code. Skip any step whose command is `none`.

## When to Use

Use this skill after:
- Implementing new features
- Fixing bugs
- Making any code changes
- Refactoring code
- Before committing changes

## Verification Checklist

### 1. Build Verification
- Run `${commands.build}` or `${commands.typecheck}` from the appropriate directory
- Ensure the project's type/compile step passes
- Check for broken imports or circular dependencies
- Verify no build errors or warnings

### 2. Lint Verification
- Run `${commands.lint}` to check code style and quality
- Fix all linting errors
- Remove unused lint-suppression directives (e.g. `eslint-disable`)
- Ensure code follows project conventions

### 3. Test Verification
- Run relevant test suites (`${commands.test}`, the unit-test script, etc.)
- Ensure all tests pass
- Verify no test regressions were introduced
- Check test coverage if applicable

### 4. Code Review
- Review for common mistakes:
  - Type safety violations
  - Unused variables or imports
  - Missing error handling
  - Security vulnerabilities
  - Performance issues
  - Logic errors

### 5. Integration Check
- Verify changes work with existing code
- Check for breaking changes
- Ensure API contracts are maintained
- Verify environment variable usage

## Workflow

1. **Build**: Run build/typecheck commands
2. **Lint**: Fix all linting issues
3. **Test**: Run and verify tests pass
4. **Review**: Manually review code for issues
5. **Verify**: Ensure integration works correctly

## Common Issues to Check

- Type safety: No `any` types or unsafe assertions
- Error handling: Proper error messages (generic for auth errors)
- Security: No secrets in code, proper RBAC checks
- Architecture: Proper dependency direction, no circular deps
- Performance: No unnecessary re-renders or expensive operations

## Related skills

- `run-tests` — targeted suite runner this skill delegates to.
- `generate-tests-after-implementation` — add missing coverage before the final pass.
- `e2e-narrow-fail-focus-success` — when E2E is red, route there instead of looping here.
- `principal-architect` — escalate here for architecture/security/clean-arch concerns discovered in code review.
- `mobile-friendly-checker` — responsiveness and touch-target audit on frontend changes.
- `memory-validator` — verify implementation aligns with stored business logic before marking done.
- `devfix` — Phase 3 verification step in the devfix loop; Reviewer subagent plays a similar role inside devfix.
