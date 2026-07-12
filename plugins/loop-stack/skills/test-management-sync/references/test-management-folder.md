# Test-management mirror layout (config-driven)

Generalized reference for laying out test-management mirror feature files alongside canonical product
scenarios. Substitute config values from `.claude/stack.md` (`${testing.e2e.*}`, `${issueTracker.keyPrefix}`,
`${testing.testManagement}`). Concrete tools named here (Zephyr/SmartBear, TestRail, Playwright) are
**examples** — match the configured tools.

## Paths (pattern)

Use the e2e features dir from config (`${testing.e2e.dir}`) and group by epic → story → a `mirrors/` (or
`<tool>/`) subfolder so each management case maps 1:1 to one file.

| Role | Path pattern |
|------|--------------|
| Canonical product scenarios | `${testing.e2e.dir}/features/<EPIC>/<STORY-KEY>.feature` |
| Test-management mirror (1:1 case) | `${testing.e2e.dir}/features/<EPIC>/<STORY-KEY>/mirrors/<TestCaseKey>.feature` |
| Read-only exports (optional) | `${testing.e2e.dir}/<tool>-exports/<STORY-KEY>/<TestCaseKey>.feature` |
| Step glue (fixtures, settings/flow) | `${testing.e2e.dir}/steps/<EPIC>/<STORY-KEY>.steps.ts` (+ shared seed/fixture steps) |

`<EPIC>` / `<STORY-KEY>` come from the tracker (keys under `${issueTracker.keyPrefix}`). `<TestCaseKey>` is the
management tool's case key.

## Background vs auth

- **Background** (all mirrors): a stack/readiness check only (e.g. "the app and backend are running") — not auth.
- **Authenticated** scenarios: first executable steps are a login step (e.g. "I am logged in to <app>") then any
  data-fixture step the scenario needs.
- **Unauthenticated** cases: `Background` is still stack-only; the scenario uses an explicit "the user is not
  logged in" step (no login step).

## Tags (copy pattern)

The e2e tag for the issue (per `${testing.e2e.tagConvention}`), an epic tag, the story tag, the target-app tag,
a generic sync tag, and the management-key tag. Example shape:

```
@<EPIC> @<STORY-KEY> @<app> @tm-sync @TestCaseKey=<TestCaseKey>
```

Add `@wip` when a management-case objective assumes a flow not yet seeded in e2e.

## Inventory (management tool API/MCP)

Call the management tool's "list cases linked to issue" API/MCP with the issue key, e.g.:

```json
{ "issueKey": "<STORY-KEY>" }
```

→ returns all linked case keys (e.g. `<TestCaseKey>` values). Re-run after the tracker/management tool changes;
update mirror files only when keys or **names** change.

## Narrow run (e2e)

From `${testing.e2e.dir}`, generate bdd steps if your e2e stack needs it (`${testing.e2e.bddStep}`), then run a
single mirror filtered to one management-key tag (`${testing.e2e.runner}` is the configured runner, e.g.
Playwright):

```bash
${testing.e2e.bddStep} && <e2e-run-cmd> features/<EPIC>/<STORY-KEY>/mirrors/<TestCaseKey>.feature \
  --grep "@TestCaseKey=<TestCaseKey>" --reporter=list
```

## Product vs management gaps (how to reconcile)

When a management case assumes UI/copy the product doesn't have, prefer asserting the product's actual behavior
over forcing the mirror to match stale case text:

- If a "tab" in the case is actually a route + nav item, map the step to navigation (e.g. "I navigate to
  `/settings`") rather than a literal tab control.
- If specific copy may not exist in the UI, assert the **absence** of the contrasting state instead of the exact
  string.
- If a case depends on data the UI doesn't yet surface (e.g. seeded counts), it may need a UI/data-contract
  change — flag it rather than faking the assertion.

## Generalizing to other issues

Use the folder shape `${testing.e2e.dir}/features/<EPIC>/<STORY-KEY>/mirrors/` and the same tag shape
`@TestCaseKey=<KEY>`. Put step glue under `${testing.e2e.dir}/steps/<EPIC>/` next to shared seed/fixture steps.
