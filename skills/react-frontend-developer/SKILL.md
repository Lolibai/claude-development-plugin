---
name: react-frontend-developer
description: Config-driven frontend implementation partner for the project's frontend monorepo. Reads ${frontend.frameworks} and ${frontend.apps} from .claude/stack.md and follows the project's conventions for hooks, server-state/data fetching, routing, RPC/API client usage, context providers, and state management. Use when building or refactoring page-level features, wiring data fetching, or making cross-cutting frontend decisions. For pure component/styling conventions (the component-library + utility-CSS hybrid, smart/dumb split, inline style/function rules) prefer frontend-component-conventions first.
---

# Frontend Feature Developer

## Purpose

Specializes in frontend feature development, following the project's conventions for components, hooks, state management, and UI patterns. The principles are framework-agnostic; the concrete framework, libraries, and apps come from `.claude/stack.md`.

> **Read `.claude/stack.md` first.** Use its values; never assume a specific tool. Read
> `${frontend.frameworks}` (e.g. react, angular), `${frontend.apps}`, the data-fetching/routing libraries the
> project uses, and `${commands.*}`. Never assume a specific UI/data library — read what the project actually
> uses. If a needed capability is `none`/empty, skip those steps. If `.claude/stack.md` is missing, run the
> **`onboarding`** skill and stop. Concrete tools named below (React, TanStack/React Query, React Router,
> tRPC, react-hook-form, MUI) are **examples** — match the configured stack.

## When to Use

Use this skill when:
- Building components
- Implementing frontend features
- Working on UI/UX
- Handling state management
- Creating hooks or utilities
- Following frontend patterns

## Development Principles

### 0. LEGO Philosophy (mandatory before any markup)

Invoke the **`lego-philosophy`** skill — the single source of truth for the smart/dumb split + component-inventory rule — before writing or refactoring any component. Key rules:
- Ask "does a shared/primitive component already exist for this?" — if yes, reuse it.
- No raw `<div>` stacking as a starting point. Every repeating visual pattern is a named dumb component.
- **Dumb components**: props-only, no RPC/API, no context hooks — live in the shared UI package or app `components/`.
- **Smart components**: one concern (data/orchestration/routing), almost no JSX, pass flat props to dumb children — live in `pages/` or `features/`.
- Red flags: 3+ nested anonymous divs, copied utility classNames, icon+label div, card div, inline style object.

### 1. Component Patterns
- **Functional components**: use function components with hooks (or the framework's idiomatic equivalent).
- **Component structure**: clear separation of concerns.
- **Reusability**: create reusable, composable components.
- **Props interface**: well-defined TypeScript interfaces.

### 2. State Management
- **Local state**: component-local state (e.g. `useState`).
- **Shared state**: the project's chosen state-management solution.
- **Server state**: the project's server-state library (e.g. TanStack/React Query) for server data.
- **Form state**: the project's form library (e.g. react-hook-form).

### 3. Hooks Usage
- **Custom hooks**: extract reusable logic into hooks.
- **Hook dependencies**: proper dependency arrays.
- **Cleanup**: clean up effects properly.
- **Performance**: memoize expensive computations.

### 4. UI Patterns
- **Component library**: follow the project's component-library usage rules.
- **Inline styles**: avoid inline style objects (use theme/utility classes).
- **Inline functions**: avoid inline functions in JSX props.
- **Composition**: prefer composition over inheritance.

## Code Quality

### TypeScript
- Proper typing for all props and state
- Use type inference where appropriate
- Avoid `any` types
- Use proper type guards

### Performance
- Memoize components when needed (e.g. `React.memo`)
- Use memoization hooks (`useMemo` / `useCallback`) appropriately
- Avoid unnecessary re-renders
- Optimize list rendering

### Testing
- Write component tests with the project's testing library
- Test user interactions, not implementation
- Use proper test data
- Follow the project's test conventions (`${testing.unit.runner}`)

## Common Patterns

### Component Structure
```typescript
interface ComponentProps {
  // Props definition
}

export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // Hooks
  const [state, setState] = useState();

  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);

  // Handlers
  const handleClick = useCallback(() => {
    // Handler logic
  }, [dependencies]);

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### API Integration
- Use the project's RPC/API client (e.g. tRPC) for API calls
- Handle loading and error states
- Use the server-state library for caching
- Proper error handling

### Form Handling
- Use the project's form library
- Validate with the project's schema library
- Handle form submission
- Show validation errors

## Anti-Patterns to Avoid

- ❌ Inline style objects in JSX
- ❌ Inline functions in props
- ❌ Unnecessary re-renders
- ❌ Missing TypeScript types
- ❌ Improper hook dependencies
- ❌ Not cleaning up effects

## Best Practices

- ✅ Use TypeScript for all components
- ✅ Follow project component conventions
- ✅ Extract reusable logic to hooks
- ✅ Use proper state management
- ✅ Optimize performance appropriately
- ✅ Write comprehensive tests

## Related skills

- `lego-philosophy` — the single source of truth for the smart/dumb split + component inventory; invoke before any markup.
- `frontend-component-conventions` — component-library + utility-CSS hybrid rules, theme tokens, smart/dumb split, mobile-first, single framework-instance test setup. Always prefer this for pure component/styling concerns.
- `implement-designs` — pixel-perfect design-to-code orchestration; this skill composes what that skill produces at the page level.
- `figma-plan-and-validate` — upstream plan/validate pass before any design-driven work.
- `mobile-friendly-checker` — final mobile audit for pages/components built here.
- `generate-tests-after-implementation`, `run-tests`, `double-check-code` — verification loop.
- `devfix` — the Coder role in devfix will delegate page-level wiring work here.
