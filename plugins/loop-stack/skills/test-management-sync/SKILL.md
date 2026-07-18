---
name: test-management-sync
description: >-
  Config-driven sync between a test-management system's test cases and the
  repo's runnable e2e features, keeping the management tool's case names/keys
  stable (for tool execution updates) while the executable source of truth stays
  in the repo. Reads ${testing.testManagement} from .claude/stack.md (e.g.
  zephyr, testrail, none) and ${testing.e2e.*}; no-ops when test management is
  none. One feature file per test case, tagged by the management key, mapped to
  existing step glue. Use when the user mentions test-management sync, traceability
  from stories to e2e, or mirroring management cases into feature files. For
  greenfield e2e from the tracker/CSV prefer the relevant phase-e2e skill; for
  fixing failing e2e prefer e2e-narrow-fail-focus-success.
---

# Test Management ↔ E2E (mirrors)

## Purpose

Keep **test-management case names and keys stable** for the management tool (so its execution/coverage APIs keep matching) while the **executable source of truth** stays under the repo's e2e features dir.

Deliver **one feature file per management case** under a per-epic mirror subfolder so you can:

- Filter by the management key tag (e.g. `@TestCaseKey=<KEY>`) or a generic sync tag (e.g. `@tm-sync`).
- Leave canonical product scenarios in the parent folder (e.g. `<STORY-KEY>.feature`).
- Avoid editing read-only management exports (manual or CI exports).

> **Read `.claude/stack.md` first.** Use its values; never assume a specific tool. Read
> `${testing.testManagement}` (e.g. zephyr, testrail, `none`), `${testing.e2e.runner}`, `${testing.e2e.dir}`,
> `${testing.e2e.tagConvention}`, `${testing.e2e.bddStep}`, and `${issueTracker.keyPrefix}` for issue keys.
> If `${testing.testManagement}` is **`none`**, this skill is a **no-op** — there is no configured
> test-management system to sync with, so tell the user that and stop. If `${testing.e2e.runner}` is `none`,
> there are no runnable e2e features to mirror into — also a no-op. If `.claude/stack.md` is missing, run the
> **`onboard`** skill and stop. Concrete tools below (Zephyr Scale / SmartBear, TestRail, Playwright,
> playwright-bdd) are **examples** — match the configured tools.

## When to use

- Linking **test-management coverage** to **repo e2e scenarios** for execution logging.
- User provides an **issue key** (under `${issueTracker.keyPrefix}`) with management-linked cases.
- Replacing or complementing **manual CSV exports** with the management tool's API/MCP listing.

## Hard rules

1. **Never rename** the management `Feature:` / `Scenario:` lines in mirror files once written (the tool and its reports match on exact strings).
2. **Do not modify** read-only management exports to "fix" tests — change the **mirrors** or the **product** scenarios instead.
3. **Map steps** to existing phrases in the repo's e2e step-definition files for that feature area; invent **new** steps only when a stable selector (e.g. a `data-testid`) or accessible role exists in the target app.
4. **Tags:** the e2e tag for the issue (per `${testing.e2e.tagConvention}`, e.g. `@<KEY>`), an epic tag, the target-app tag, a generic sync tag (e.g. `@tm-sync`), and the management-key tag (e.g. `@TestCaseKey=<KEY>`). Omit any batch-only tag on mirrors unless you explicitly want them in that batch (avoid duplicate runs).
5. **Background vs auth:** keep `Background` to a stack/readiness check only; put auth (e.g. a login step) inside each scenario that needs it, and omit it for unauthenticated cases.
6. **Union vs split:** a single combined feature would break **1:1 management key ↔ file** traceability; keep **separate files** under the mirror subfolder so the tool can drive each case.

## Progressive disclosure (mandatory)

| Phase | Read / do next |
|-------|----------------|
| 1 — Inventory | Use the management tool's API/MCP to list the test cases linked to the issue key (e.g. a Zephyr/SmartBear `get_issue_link_test_cases` with `{ "issueKey": "<KEY>" }`); optionally fetch each case for its `name`/objective. |
| 2 — Layout | `references/test-management-folder.md` — the mirror folder + tag layout (generalizes to any issue). |
| 3 — Glue | The repo's e2e step-definition files for that feature area; extend glue only with real selectors. |
| 4 — Verify | Narrow run filtered to one management key tag — see the reference for the exact command shape. |

Do **not** load the reference until the issue key is known; do **not** bulk-fetch every case body unless a scenario title is ambiguous.

## Thin checklist

1. Inventory: list the management keys for the issue.
2. For each key, add a mirror feature `<KEY>.feature` (or `<TestCaseKey>.feature`) with the **exact** management titles + tags.
3. Map **Given/When/Then** to repo steps; add a `@wip` tag only when an AC requires an unimplemented flow.
4. Run one narrow slice filtered to a single management-key tag before claiming parity.

## Related

- The project's greenfield-e2e skill (product-first scenarios from the tracker/CSV, not management-key-centric).
- `e2e-narrow-fail-focus-success` — stabilize failing e2e.
- `run-tests` — pick default test targets (`${commands.test}` / `${testing.e2e.*}`).
