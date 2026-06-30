---
name: lego-philosophy
description: The LEGO philosophy for UI architecture — build every screen from named, reusable components (smart/dumb split), never from anonymous <div> stacks. Use BEFORE writing or editing any UI: a component, screen, page, card, form, modal, list row, badge, or section header — and whenever you're about to type `<div className="...">`. Project-agnostic; reads `${frontend.styling}` and `${frontend.apps}` from .claude/stack.md to locate the shared component library and per-app folders. This is the single source of truth for the smart/dumb split and the component-inventory rule; other skills (frontend-component-conventions, implement-designs, react-frontend-developer) reference it instead of restating it.
---

# LEGO Philosophy

Every UI feature is built from two layers, like LEGO bricks snapping together. **Raw `<div>`
stacking is a last resort, not a starting point.** A screen is assembled from *named* components,
not from anonymous div trees.

> **Read `.claude/stack.md` first** (when present). Use `${frontend.styling}` for the styling
> system (the class examples below assume utility CSS such as Tailwind — adapt to whatever the
> project uses) and `${frontend.apps}` for the app/package names. The *principle* is
> framework-agnostic and applies even with no config. If `.claude/stack.md` is missing and you need
> app/inventory locations, run **`onboarding`** or infer from the repo layout.

## The one rule

**Before you write `<div className="...">`, ask: *does a component for this already exist?***

- **Yes** → import and use it. Never inline what already exists.
- **No** → name it and extract it. Then use the named component.

If the same markup appears twice anywhere in the codebase, that is a defect, not a style choice —
extract it. Duplicated primitives, option lists, validation schemas, or constants are the same
defect.

## The two layers

**Dumb components (presentational).** Receive only props. Zero data-fetching, zero business logic,
zero API/RPC calls, no router hooks. They are reusable, testable in isolation, and live in the
shared component library (a cross-app package) or a feature's local `components/` folder. **Every
repeating visual pattern — a card, a badge, a field row, a section header, an icon+label — must
become a named dumb component.**

**Smart components (containers).** Own exactly one concern: data-fetching **or** orchestration
**or** routing. They call hooks/queries/mutations, derive state, then pass flat props down to dumb
children. One smart component per feature entry point; dumb components below it. A smart component
contains almost no JSX of its own — it returns a tree of dumb components.

Placement:
- Reusable cross-app pieces → the shared component library.
- App-specific variants → that app's `components/` folder (apps from `${frontend.apps}`).
- Smart containers → `pages/` or `features/`.

## The component inventory (per project)

A shared component library only pays off if it's discoverable. **Maintain an inventory** — a table
of the shared/primitive components (name → import → "use for") so anyone (you included) checks it
before stacking divs. Keep it in the project's `CLAUDE.md`, the shared library's `README`, or a
`COMPONENTS.md` — wherever the project already documents conventions.

Before writing any JSX element, scan that inventory. A match exists → use it. No match, but the
pattern repeats → add the component **and** add its row to the inventory. The inventory is part of
"done," not an afterthought.

(This skill deliberately ships **no** fixed component list — each project's primitives differ. The
inventory is the project's, kept current by whoever touches the UI.)

## Red flags — stop and refactor when you see

- A file with more than ~3 levels of nested anonymous `<div>` blocks.
- The same `className` / style pattern copied between two components.
- A `<div>` that wraps an icon + a label — that is a component.
- A `<div>` that renders a card with a border and a title — that is a component.
- Inline `style={{}}` on anything other than a truly dynamic, runtime-computed value.
- A duplicated option list, constant, or validation schema — import the canonical one instead.

## Checklist (run before merging any UI change)

- [ ] Checked the project's component inventory before writing markup.
- [ ] No raw/anonymous `<div>` stacking as a starting point; every repeating pattern is a named
      dumb component.
- [ ] Dumb components take props only — no fetching, business logic, API calls, or router hooks.
- [ ] Each smart component owns exactly one concern and returns mostly a dumb-component tree.
- [ ] Any newly extracted shared component is added to the inventory.
- [ ] No duplicated primitives, constants, option lists, or validation schemas.

## Related skills

- `frontend-component-conventions` — the broader styling/hybrid/mobile-first rules; this skill is
  its architecture half.
- `implement-designs`, `figma-plan-and-validate` — design-to-code; obey this split when assembling
  screens.
- `react-frontend-developer` — feature-level wiring that composes the components defined here.
