---
name: frontend-component-conventions
description: Canonical, config-driven component/style rules for a frontend monorepo. Reads ${frontend.frameworks}, ${frontend.styling}, ${frontend.apps}, and ${commands.*} from .claude/stack.md and adapts. Enforces a component-library + utility-CSS hybrid (the component lib for interactive controls/overlays/feedback, plain HTML + utility classes for layout/structure), shared theme tokens from the design system, form-library Controller integration, mobile-first breakpoints, touch-friendly 44px targets, no inline style objects, no inline arrow functions in JSX props / hook deps, and a single-framework-instance test setup. Use when building or editing a component, form, modal, page layout, or design-system primitive, or when the user mentions the component library, the styling system, the theme, "mobile first", or "design system". For full page-level feature wiring (data fetching, routing, context) prefer react-frontend-developer; for pixel-perfect design conversion prefer implement-designs.
---

# Frontend Component Conventions

Canonical, **config-driven** guide for every component in the frontend monorepo. The hybrid-styling discipline, smart/dumb split, mobile-first rules, and no-go list are framework-agnostic; the concrete component library, styling system, apps, and commands come from `.claude/stack.md`.

> **Read `.claude/stack.md` first.** Use its values; never assume a specific tool. Read
> `${frontend.frameworks}` (e.g. react, angular), `${frontend.styling}` (e.g. tailwind), `${frontend.apps}`
> (the apps/packages, e.g. manager/admin/card/landing), the unit runner `${testing.unit.runner}`, and
> `${commands.*}`. Never assume a specific UI library — read the design system the project actually uses. If a
> needed capability is `none`/empty, skip those steps. If `.claude/stack.md` is missing, run the
> **`onboarding`** skill and stop. Concrete tools in the examples below (MUI, Tailwind, react-hook-form,
> Vitest) are **examples** — match the configured frontend stack.

## Hybrid rule (global, always-on)

Use **the project's component library** for interactive controls and overlays, and **plain HTML + the project's utility-CSS classes** for layout, structure, and typography. (Example with a component library such as MUI + a utility framework such as Tailwind:)

- **Component library** for interactive controls and overlays: `Button`, `TextField`, `Select`, `Checkbox`, `Radio`, `Switch`, `Dialog`, `Drawer`, `Popover`, `Menu`, `Tooltip`, `Alert`, `Snackbar`, progress indicators, `Tabs`, `Pagination`, table primitives.
- **Plain HTML + utility classes** for layout, structure, and typography: `div / section / header / main / footer`, flex/grid, spacing, sizing, `h1`–`h6`, `p`, `span`.
- **Do not** use the component library's layout wrappers (e.g. MUI `Box` / `Stack` / `Grid` / `Container`) or its `Typography` for structure — the utility framework owns layout. **Do not** replace library controls with custom HTML controls.
- The design tool cannot override the component library's theme. If a design conflicts with the theme, adjust the theme centrally (in the shared `ThemeProvider` / theme config); do not re-skin library internals per component.

## Utility-CSS — monorepo setup

(Example with a utility framework such as Tailwind:)

- Single shared config at the monorepo root. No per-app configs.
- Prefer **semantic tokens** (`bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`, `bg-muted`, `bg-accent`, `bg-destructive`, `bg-success`, `bg-warning`, `bg-info`).
- **Brand palette** when semantic is not enough — use the design system's named brand tokens (e.g. a primary brand color and a dark neutral with their tints).
- **Fonts** — map to the design system's families (a body family and a display family).
- **Breakpoints** — follow the design system's scale (e.g. `sm` 640, `md` 768, `lg` 1024, `xl` 1280).
- **Dark mode** — toggle via the configured strategy (e.g. a `dark` class on root).
- **No `@apply`** in CSS files; utility classes in JSX only. For shared class lists use a class-merge helper (e.g. `cn()` / `tailwind-merge`) in TS.
- Use arbitrary values (e.g. `text-[13px]`, `gap-[14px]`) only as one-offs; extend the shared config when a value repeats.

## Theme (mandatory)

Wrap every app/tree in the component library's theme provider (e.g. `<ThemeProvider theme={theme}>`). The theme tokens must match the design system. (Example MUI theme — the concrete palette/typography values come from the design system, not from this skill:)

```typescript
palette: {
  primary:   { main: '<brand primary>', light: '...', dark: '...', contrastText: '#fff' },
  secondary: { main: '<dark neutral>', light: '...', contrastText: '...' },
  error:     { main: '<error>' },
},
typography: { fontFamily: "'<body font>', sans-serif" },
components: {
  MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 9999, fontFamily: "'<display font>', sans-serif" } } },
  MuiTextField: { /* outlined border + focus in the brand color; label/text tokens from the design system */ },
},
```

Text/border tokens come from the design system (e.g. `textPrimary`, `textSecondary`, `textDisabled`, `borderDefault`, `borderHover` at the design system's opacities).

## Forms — form library + the component library

Always use the form library's binding wrapper (e.g. react-hook-form's `Controller`) when binding component-library form components. Validation via a schema resolver and a shared validation schema.

```tsx
<Controller
  name="email"
  control={control}
  render={({ field }) => (
    <TextField
      {...field}
      label="Email"
      error={!!errors.email}
      helperText={errors.email?.message}
      fullWidth
    />
  )}
/>
```

Select/Checkbox follow the same pattern (`FormControl` + `FormHelperText` around `Select`; `FormControlLabel` wrapping `Checkbox`). Direct `register(...)` is acceptable only for non-library raw inputs.

## Mobile-first (non-negotiable for every page)

- Base styles target the smallest viewport. Progressive enhancement with `sm:`, `md:`, `lg:`.
- Grids start at `grid-cols-1`: e.g. `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`. Never `grid-cols-2` alone.
- Containers: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- Headers/heroes: `flex-col` default, `sm:flex-row` / `lg:flex-row` when room allows.
- Headings scale: `text-2xl sm:text-4xl lg:text-[48px]`.
- Buttons: `w-full sm:w-auto`; avoid large `min-w-*` that causes overflow at 320px.
- Touch targets ≥ 44px; never put critical actions behind hover-only.
- Every `index.html` ships: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />`.
- Smoke-test at 320px and 375px before claiming done; no horizontal scroll on 320–640px unless an overflow area is explicitly scrollable.

## Hard no-goes

### No inline style objects

```tsx
// BAD
<div style={{ color: 'red' }}>Alert</div>
<input style={{ border: '1px solid gray' }} />

// GOOD
<div className="text-destructive">Alert</div>
<input className="border border-input" />
```

Exception: dynamic positioning/sizing that must be computed at runtime and cannot be expressed as a utility-class set (e.g. a chart bar height from data). Even then prefer a CSS variable + utility class.

### No inline arrow functions in JSX props or hook deps

```tsx
// BAD — new function each render defeats memoization and churns the framework
<Button onClick={() => handleClick(id)}>Save</Button>
<Child render={() => <Spinner />} /> // BAD — re-renders Child every commit

// GOOD — stable reference
const handleSave = useCallback(() => handleClick(id), [id]);
<Button onClick={handleSave}>Save</Button>

// GOOD — extract component, don't inline it
const RenderSpinner = () => <Spinner />;
<Child render={RenderSpinner} />
```

Inline functions as JSX children or passed to `useCallback` / `useMemo` / `memo` are flagged by the repo's lint/ast rules.

### No mixing the chosen component library with other UI libraries in the same tree.

## Architecture — LEGO philosophy (smart vs dumb split)

**MANDATORY before writing any new component or editing an existing one:** check the project's component conventions (e.g. a CLAUDE.md invariant covering the LEGO philosophy + the shared component inventory). Ask "does a shared/primitive component already exist for this?" If yes, reuse it.

- **Presentational ("dumb") components** live in the shared components package or app-local `components/`. No data fetching, no RPC/API imports, no router hooks — take props, emit events.
- **Container ("smart") components** live in `pages/` or `features/`. They own data queries/mutations, context, routing — render dumb components with almost no JSX of their own.
- Reusable cross-app pieces go in the shared components package. App-specific variants stay in `<app>/src/components/` for the relevant app in `${frontend.apps}`.
- **No raw `<div>` stacking** as a starting point. Every repeating visual pattern is a named dumb component.
- Red flags: 3+ nested anonymous divs, copied utility classNames across files, inline icon+label combos, inline style objects, card-shaped divs without a shared wrapper component.

## Unit tests — single framework instance (required for any frontend test)

Multiple framework instances produce hook/`useRef` errors ("Cannot read properties of null", "Invalid hook call"). The unit runner is `${testing.unit.runner}`. Its config (example with Vitest) must dedupe the framework to a single instance:

```typescript
resolve: {
  alias: {
    'react':                  path.resolve(__dirname, '../../node_modules/react'),
    'react-dom':              path.resolve(__dirname, '../../node_modules/react-dom'),
    'react/jsx-runtime':      path.resolve(__dirname, '../../node_modules/react/jsx-runtime'),
    'react/jsx-dev-runtime':  path.resolve(__dirname, '../../node_modules/react/jsx-dev-runtime'),
  },
  dedupe: ['react', 'react-dom', 'react-hook-form', 'react-router-dom', '@hookform/resolvers'],
  preserveSymlinks: false,
},
optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-hook-form'], force: true },
```

(For a different framework, apply the equivalent single-instance dedupe its tooling provides.) A test setup file must expose the framework globally if the project relies on that, and test files should: import the framework explicitly; register mocks **before** importing the component under test; render via the project's `renderWithProviders` helper, never a raw `render`.

## Component checklist

Before merging a new/edited component:

- [ ] **LEGO check**: read the project's component-conventions invariant; confirmed no existing shared/primitive component covers this; no raw div stacking; every repeating pattern is a named dumb component
- [ ] Component library used for controls, utility classes used for layout (no library layout wrappers/`Typography` for structure)
- [ ] Theme provider wraps the subtree (or inherits from app root)
- [ ] Form fields wrapped in the form library's binding wrapper; validation errors surfaced via `error` + `helperText` / `FormHelperText`
- [ ] Layout is mobile-first (`grid-cols-1 sm:...`, `px-4 sm:px-6`, `text-2xl sm:...`)
- [ ] No inline style objects, no inline arrow functions as JSX props
- [ ] Utility classes use semantic/brand tokens — no raw hex except inside the theme config
- [ ] Touch targets ≥ 44px
- [ ] Tests (if any) use the single-framework-instance config and the project's render helper
- [ ] `${commands.typecheck}` and `${commands.lint}` pass for the touched package

## Related skills

- `implement-designs`, `figma-plan-and-validate` — design-to-code pipeline using this skill's hybrid rules.
- `react-frontend-developer` — feature-level wiring (data fetching, routing, contexts) that composes these components.
- `mobile-friendly-checker` — post-edit audit for responsiveness and touch targets.
- `double-check-code` — final quality gate.
