# Phase 3α — Live render check (shared by devfix + implement)

> Reads project specifics from `.claude/stack.md` — `${frontend.apps}`, dev-server commands (`${commands.*}`),
> and the e2e/screenshot tooling (`${testing.e2e.*}`). Skip this entire phase if `${frontend.frameworks}` is
> empty (no UI). Tools named below (a Playwright screenshot, a Chromium browser) are **examples** — use the
> project's configured runner.

**MANDATORY for any UI-touching diff.** Type-check, lint, and even tagged E2E specs can ALL pass while a duplicate header, broken layout, or stacked footer ships. Every UI-touching diff must end with a real screenshot of the running app, looked at by the parent.

**Trigger:** the diff touches any file in the frontend app tree (`${frontend.apps}`), the shared UI package, or any new/changed route. If only backend/test/skill files changed, skip.

**Steps the parent (not a subagent) executes:**

1. **Enumerate every route the diff touches.** Walk the diff for: new pages, modified pages, new components that render on existing pages, layout/wrapper changes (e.g. `*Route.tsx`, `Layout.tsx`, `App.tsx`). Build a route list.
2. **Ensure the relevant dev server is up.** Start whichever app(s) the routes belong to using the configured dev command(s) for those apps (e.g. an app-scoped `dev:<app>` script). If the user hasn't started one, ask before launching.
3. **Capture a screenshot of each route** with the project's e2e/screenshot runner (`${testing.e2e.runner}`) — example using Playwright:
   ```bash
   <pkg-manager> --dir ${testing.e2e.dir} exec playwright screenshot \
     --full-page --browser=chromium --viewport-size=1280,800 \
     "http://localhost:<port><route>" \
     "assets/rendered-screenshots/<feature>-<timestamp>.png"
   ```
   Authenticate first if the route requires it (e.g. an admin/manage login) — a logged-in storage state or a browser MCP may help for auth'd routes, but the end product must be a PNG on disk.
4. **Read every screenshot PNG with the Read tool** (Claude is multimodal). Look explicitly for:
   - **Duplicate elements** — two headers, two footers, two page titles, two breadcrumbs, two CTA buttons rendering the same action. This is the #1 layout regression class and is invisible to typecheck/lint/E2E.
   - **Broken layout** — overlapping containers, content cut off, mobile viewport breakage.
   - **Missing copy / missing data** — empty state where data was expected, untranslated keys, placeholder text.
   - **Wrong route shell** — page rendered without the expected layout wrapper, or with the wrong one.
5. **If any drift found**, fix it before exiting Phase 3. Do NOT mark Tester pass and rely on Reviewer to catch it — Reviewer reads diffs, not pixels.

```
CHECKPOINT-3α: LIVE RENDER
  REQUIRES:
    - Every UI route touched by the diff has a screenshot PNG attached to Team Briefing
    - Parent has Read each PNG and reported "no duplicates / layout intact" explicitly
  BLOCKED BY:
    - Any duplicate header/footer/title detected
    - Any broken or overlapping layout
    - Any route screenshotted blank or showing wrong shell
  ON FAIL:
    - Fix in product code (parent or re-spawn Coder); re-screenshot; re-verify
    - Backend-only diffs skip this checkpoint entirely
```
