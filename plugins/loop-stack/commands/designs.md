# Universal Design Implementation Command

Read `.claude/stack.md` first; use its values; never assume a specific tool; if a needed capability is `none`, skip those steps; if the config is missing, run the `onboard` skill and stop.

## Overview

This command processes design links to implement reusable UI patterns using the **project's configured frontend stack** (`${frontend.frameworks}` for components + `${frontend.styling}` for layout/styling — e.g. a component library such as MUI plus a utility-CSS framework such as Tailwind). It strictly enforces **ONE shared theme / token source** across the project's apps (`${frontend.apps}`) and prioritizes reusability over unique implementations.

> **Capability gates.** Reading a design from a link needs a design tool with an MCP (`${design.figma}` — e.g. Figma); if none is configured, work from the assets/spec the user provides instead. Memory steps (`${memory.store}`) are no-ops when it's `none`. Component-library specifics below are examples — use whatever `${frontend.frameworks}`/`${frontend.styling}` name.

**Core Principle**: components/controls from `${frontend.frameworks}`, layout/styling from `${frontend.styling}`. One theme/token set = source of truth.

---

## Phase 0: READ FIRST — Reusability Discovery (MANDATORY)

**BEFORE any implementation**, explore the project's frontend to find existing patterns. Use the locations from `${frontend.*}` in config; the paths below are an EXAMPLE monorepo layout.

### 1. Shared Components (Read First)
A shared-components package, e.g.:
```
<frontend-root>/packages/shared-components/ui/
├── button, badge, card
├── date-picker, text fields
├── form
└── navigation, sidebar
```

### 2. Shared Styles & Theme
A shared-styles package, e.g.:
```
<frontend-root>/packages/shared-styles/
├── theme/           # Shared theme configuration
├── tokens/          # Design tokens (colors, spacing, typography)
└── utilities/       # Shared utility-CSS helpers
```

### 3. Existing App Patterns (Read Similar)
Look at existing implementations in the **same app** (one of `${frontend.apps}`):
```
<frontend-root>/apps/<app>/src/components/
├── <feature>/steps/   # Form/wizard patterns
├── ui/                # App-specific UI components
└── layout/            # Layout patterns
```

### 4. Single Source of Truth Configs
| Config | Purpose |
|--------|---------|
| the shared utility-CSS config (e.g. `tailwind.config.*`) | **ONE** shared styling config for all apps |
| the shared component-library theme (e.g. an MUI theme file) | **ONE** shared component theme |
| project styling/component rule files | styling + component conventions |

### 5. Search Commands (Use Before Coding)
```bash
# Find similar components (adjust extension to ${frontend.frameworks})
grep -r "className.*rounded-\[" <frontend-root>/apps/<app>/src --include="*.tsx" | head -20

# Find existing modal/dialog patterns
grep -r "Dialog.*className" <frontend-root>/apps/<app>/src --include="*.tsx"

# Find a specific color/token usage
grep -r "<token-or-hex>" <frontend-root>/apps/<app>/src --include="*.tsx"
```

---

## Step 1: Extract Design Information (when `${design.figma}` is configured)

When a design link is provided, ALWAYS use the design tool's MCP (e.g. Figma MCP) — navigating design links via a browser is forbidden:

1. **Standardize node/ID extraction** per the design tool's URL format (e.g. for Figma, from `…/design/:fileKey/:fileName?node-id=1-2`, extract `nodeId` as `1:2`; for branch URLs use the branch key as the file key).

2. **Use the design-tool MCP tools in sequence** (Figma example):
   - design-context call to gather context by node id,
   - variable-defs call to collect design tokens for theming,
   - screenshot call for visual reference.

3. **Map to existing tokens** (don't create new ones):
   - Colors → map to the project's tokens (e.g. semantic `bg-*`/`text-*` names).
   - Typography → map to the project's font tokens (e.g. `font-display`/`font-body`).
   - Spacing → use the standard scale; arbitrary values only when necessary.
   - Shadows → check the styling config for existing elevation tokens.

If no design tool is configured, take the tokens/specs from the assets the user provides.

---

## Step 2: Query for Reusable Patterns

**MANDATORY**: Query these sources before implementing:

1. **Memory / knowledge store** (`${memory.store}`, when ≠ none): search for similar implemented patterns and past decisions on component patterns.
2. **Codebase grep**: find files with similar class/style patterns.
3. **Shared packages**: check if the component already exists in the shared-components package.

**Rule**: If a pattern exists, use it. If it doesn't, create it generically for future reuse.

---

## Step 3: Technology Stack — Hybrid Approach

Use `${frontend.frameworks}` for controls/complex UI and `${frontend.styling}` for layout/styling. The example below assumes a component library (e.g. MUI) + a utility-CSS framework (e.g. Tailwind).

### Component-library pieces (Controls & Complex UI)
- Buttons, dialogs, inputs, selects, checkboxes, menus, app bars, etc.

### DO NOT use the component library for (use plain HTML + utility CSS instead):
- **Layout containers**: plain `<div>` with utility classes, not library `Box`/`Stack`/`Grid`/`Container`.
- **Typography**: plain `<h1>`–`<h6>`, `<p>`, `<span>` with utility classes, not a library `Typography` component.

### Utility CSS (Layout, Styling & Typography)
- **All** layout: `flex`, `grid`, `gap-*`, `p-*`, `m-*`
- **All** sizing: `w-*`, `h-*`, `min-w-*`, `max-w-*`
- **All** visual styling: `rounded-*`, `shadow-*`, `bg-*`, `text-*`
- **All** responsive: `sm:`, `md:`, `lg:`, `xl:`
- **All** typography: font tokens, `text-*`, `leading-*`, `tracking-*`

### Pattern Example (component library + utility CSS)
```tsx
// ✅ CORRECT: library for controls, utility CSS + plain HTML for layout/typography
import { Button } from '<your component library>';

<div className="flex w-full flex-col items-center gap-4 px-6 py-6">
  <h2 className="font-display text-2xl font-semibold text-foreground">
    Title <span className="text-accent">Highlight</span>
  </h2>
  <p className="font-body text-base leading-[1.5] text-foreground">
    Body text here
  </p>
  <Button className="rounded-full px-6 py-2 font-display text-white bg-accent">
    Action
  </Button>
</div>
```

---

## Step 4: Theme — One Source of Truth

### Utility-CSS config (shared)
Use the project's shared styling config (e.g. `tailwind.config.*`).

**Use the project's tokens** (never hardcode in components): semantic color tokens (e.g. `bg-background`, `text-foreground`, `border-border`), font tokens, and the standard spacing scale.

### Component-library theme (shared)
Use the project's shared component theme (e.g. an MUI theme file).

**Extend, don't override**:
- Add custom variants to existing components.
- Use theme tokens for component-specific styling.
- Keep inline style props minimal; prefer utility `className`.

---

## Step 5: Component Implementation Rules

### 1. Read Existing Patterns First
```bash
# Before creating a new modal, read existing ones in the same app:
cat <frontend-root>/apps/<app>/src/components/<feature>/steps/<Example>.tsx
```

### 2. Use Shared Components
```tsx
// ✅ CORRECT: use shared components from the project's shared package
import { SafeTextField, DatePicker } from '<shared-components package>';

// ❌ WRONG: re-creating new input components
import { TextField } from '<component library>';
const CustomInput = styled(TextField)...
```

### 3. Form Fields
- Use the project's form-state standard (e.g. a `Controller` from a form library) for form fields.
- Use shared form components from the shared-components package.

### 4. Layout Consistency
```tsx
// ✅ CORRECT: same patterns as existing code
<div className="flex w-full flex-col gap-4 px-6 py-6 lg:px-10">

// ❌ WRONG: inventing new spacing schemes
<div className="custom-layout-class">
```

---

## Step 6: File & Folder Structure

### Where to Place Components
| Type | Location |
|------|----------|
| Universal (multi-app) | `<frontend-root>/packages/shared-components/ui/` |
| App-specific shared | `<frontend-root>/apps/<app>/src/components/ui/` |
| Page-specific | `<frontend-root>/apps/<app>/src/pages/<Page>/` |
| Feature-specific | `<frontend-root>/apps/<app>/src/components/<feature>/` |

### Reusability Principle
- If 2+ apps need it → put it in the shared-components package.
- If 2+ pages in the same app need it → put it in the app's `components/ui/`.
- If only 1 page uses it → keep it in the page folder.

---

## Step 7: Verification Checklist

Before marking complete:

- [ ] **Read** existing similar components in the codebase
- [ ] **Checked** the shared-components package for existing implementations
- [ ] **Used** shared styling-config tokens (no hardcoded colors/spacing)
- [ ] **Used** the hybrid pattern (`${frontend.frameworks}` components + `${frontend.styling}` className)
- [ ] **No** new unique components when reusable ones exist
- [ ] **Extended** the shared theme, didn't create new one-off styles
- [ ] **Followed** existing file naming and folder conventions
- [ ] **Typecheck** passes (`${commands.typecheck}`)
- [ ] **Lint** passes (`${commands.lint}`)
- [ ] **Build** passes (`${commands.build}`)

---

## Anti-Patterns to Avoid

- ❌ **Creating unique components** when reusable ones exist in the shared package
- ❌ **Hardcoding colors/spacing** instead of using the project's tokens
- ❌ **Creating new theme files** per app (use the shared config)
- ❌ **Using inline style props for layout** (use utility `className`)
- ❌ **Inventing new class patterns** when existing ones work
- ❌ **Not reading** existing code before implementing
- ❌ **Duplicating** patterns found in the codebase
- ❌ **Mixing arbitrary values** when a standard scale exists

---

## Quick Reference: Read These First

When implementing, **ALWAYS** read these to match existing patterns:

1. The shared styling config (e.g. `tailwind.config.*`) — know your tokens
2. A reference implementation in the same app (`<frontend-root>/apps/<app>/src/components/<feature>/steps/<Example>.tsx`)
3. The shared-components package — available shared components
4. The project's styling + component rule files

---

## Summary

**ONE THEME** → shared styling config + component-library theme
**READ FIRST** → check existing patterns before coding
**REUSE** → extend existing components, don't duplicate
**HYBRID** → `${frontend.frameworks}` components + `${frontend.styling}` layout
**SOURCE OF TRUTH** → the shared styling config and the shared component theme
