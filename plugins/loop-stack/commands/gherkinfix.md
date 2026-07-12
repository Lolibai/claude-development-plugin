# Gherkin fix

Read `.claude/stack.md` first; use its values; never assume a specific tool; if a needed capability is `none`, skip those steps; if the config is missing, run the `onboarding` skill and stop.

Fix or add Gherkin feature files, step definitions, and related behavior. Always clarify requirements first when the issue or scope is unclear; then implement the fix and run only the tests that are relevant to the change.

> **Capability gates.** This command assumes a BDD/E2E setup (`${testing.e2e.runner}` — e.g. playwright-bdd). If `${testing.e2e.runner}` is `none`, there are no `.feature`/step files to work on: tell the user and stop. Memory steps (`${memory.store}`) and issue-tracker steps (`${issueTracker.tool}`) are no-ops when those are `none` — skip them, don't ask.

**This command MUST assure the user with a fix that verifies all related tests and scenarios pass.** Do not consider the command complete until every related feature spec, scenario, and unit test has been run and is green.

**When a memory / knowledge store is configured (`${memory.store}` ≠ none), use its tools throughout** — do not skip them. They provide semantic search, store read/write, code patterns, and metrics. **Bugs and all other tracker-item implementations must be written to memory and read at command start when there is a match.**

**Reply style:** Prefer **informative table replies** when summarizing test runs, scope, memory results, and final assurance (e.g. a "Tests run" table with Run | Result, and optional Scope / Memory tables). Tables make outcomes and counts easy to scan.

---

## Skills to use (in order)

| Step | Skill | Purpose |
| ------ | ------------- | ------- |
| 0 | **gherkin-memory-at-start** | Load memory at start; match the tracker item/prompt; build on or replace RAG. |
| 1–2 | **gherkin-clarify-and-scope** | Clarify requirements (memory + issue Desc/Comments); identify scope (semantic search, dependencies, paths). |
| 3 | **gherkin-implement-and-store** | Implement fix (patterns, refactor); edit features/steps; run the BDD-gen step; store to memory. |
| 4–5 | **gherkin-run-and-assure** | Run all related tests; verify green; assure user. |

Also use **e2e-narrow-fail-focus-success** when running E2E (one feature or tier at a time), **run-tests** for test suite selection, and **memory-first** for general memory/store patterns.

---

## Subagents (when to delegate)

Use **mcp_task** to delegate when it helps:

| When | subagent_type | Example prompt |
| ------ | ------------- | ------- |
| Broad scope discovery (find all feature files for X) | **explore** | "Find all .feature and .steps.ts files that reference admin users under the project's test dirs." |
| Run test commands (long E2E or isolated run) | **shell** | "From `${testing.e2e.dir}` run: `${testing.e2e.bddStep}` then the e2e runner on `<feature>` with a list reporter; report exit code and last 50 lines." |

Return to the main flow with the subagent’s result; do not consider the command complete until you have verified and assured the user (step 5).

---

## 0. At command start — read memory for matches (when `${memory.store}` ≠ none)

**Use the gherkin-memory-at-start skill.** In addition:

- **Before doing anything else**, check for existing implementation memory:
  - Load structured facts (optional), then run a **semantic memory search** with a query built from the issue key, issue summary, user prompt, or ticket description (e.g. “<KEY> activate card verification email”, “admin order details”).
  - Run a **requirements/decision search** with the same or similar query (issue key, feature name, bug summary).
- **If you find a match**: use the stored implementation to either **build on top of** what RAG (the requirements/semantic searches) will later craft, or **replace** RAG-driven choices when the **issue Description**, **issue Comments**, or **User Prompt** clearly say to do something different. Memory advises; the issue and user instructions take precedence when they conflict.

---

## 1. Clarify requirements (memory + semantic search; issue tracker)

**Use the gherkin-clarify-and-scope skill.** In addition:

- **Before editing**, use the memory store (when configured) to avoid guessing:
  - **Requirements/decision search**: business logic, acceptance criteria (AC002, AC003, etc.), and prior decisions. Query in natural language (e.g. “E2E activate-card acceptance criteria”, “dependent card auto-activation”).
  - **List recent stored decisions** (optional): see the latest decisions and context.
  - **Code/requirements semantic search**: search code and requirements by meaning (e.g. “forgot password flow”, “admin users list”) to find existing behavior and requirements.
  - **Linked docs / wiki** (e.g. Confluence): documented requirements and acceptance criteria when available.
- **Issue link provided**
  Use the issue tracker (`${issueTracker.tool}`) to fetch the issue. **It is important to read both the Description and the Comments.** Use them to drive the fix and to align scenarios with the ticket.

---

## 2. Identify scope (semantic search + dependencies)

**Continue with gherkin-clarify-and-scope** (scope phase). In addition:

- **Locate existing features and steps** using a **code/requirements semantic search**: e.g. “admin users feature”, “profile update steps”, “forgot password BDD” to find the right `.feature` and `*.steps.ts` files.
- **Understand impact** with a **dependency lookup**: for the step files or app code you might touch, check dependencies so you run the right tests and don’t break unrelated flows.
- **Paths** (use as fallback or to confirm — read these from `${testing.e2e.dir}` and any API-test dir in config; the examples below show a typical monorepo layout):
  - **API tests (BDD)**
    - Features: `<api-tests>/features/**/*.feature`
    - Steps: `<api-tests>/steps/**/*.steps.ts`
    - Generated specs: `<api-tests>/.features-gen/**/*.feature.spec.js` (do not edit; run `${testing.e2e.bddStep}` after changing `.feature` files).
  - **UI/E2E tests (`${testing.e2e.runner}`, e.g. playwright-bdd)**
    - Features: `${testing.e2e.dir}/e2e/features/**/*.feature`
    - Steps: `${testing.e2e.dir}/e2e/steps/**/*.steps.ts`
    - Support: `${testing.e2e.dir}/e2e/support/`, `e2e/pages/`.
  Use the **e2e-narrow-fail-focus-success** skill when running E2E: run one feature (or tier) at a time instead of the full suite.

---

## 3. Implement the fix (similar code, patterns, refactor, store)

**Use the gherkin-implement-and-store skill.** In addition:

- **Reuse existing patterns** (when the memory store supports it): a **find-similar-code** lookup with a snippet of the step or scenario you’re adding so new steps match existing style and structure.
- **Avoid duplication**: a **find-duplicate-patterns** lookup (e.g. similarity_threshold 0.8) to spot repeated step logic that could be shared or refactored.
- **Consistency**: a **find-code-patterns** lookup (e.g. for step definitions or Gherkin usage) to align with existing patterns or avoid anti-patterns.
- **If touching app/API code**: a **refactoring-suggestions** lookup for the file(s) you change so the fix stays clean and consistent.
- Edit **feature file(s)** and/or **step definition(s)** as needed; keep scenarios aligned with the clarified requirements and the issue (if any).
- For API tests, after changing `.feature` files run **`${testing.e2e.bddStep}`** from the API-tests dir so `.features-gen` is up to date.
- **After any bug fix or tracker-item implementation** (when `${memory.store}` ≠ none): write to memory so the next run can match and reuse a short summary: issue key (if any), what was implemented, key paths, and rationale. Set the store's metadata (e.g. `type` such as `decision`/`pattern`/`incident`, `domain`, `tags` including the issue key, `importance`) so a future search can match at command start. If the store exposes both a "memory" surface and a "requirements" surface, write the same content/metadata to both.
  This applies to **bugs and all other tracker items** — not only “non-trivial” fixes. If the user or the issue Description/Comments say to do something different next time, build on or replace what RAG/memory suggested using that as the source of truth.

---

## 4. Run all related tests (required)

**Use the gherkin-run-and-assure skill.** You MUST run every test and scenario that is related to the fix. Do not skip this step. Run only what’s relevant to the fix (not the full repo suite). Optionally use a **code-metrics** lookup for the area you changed. The user must be assured that all related tests have been executed.

- **API tests (single feature)** — from the API-tests dir:

  ```bash
  ${testing.e2e.bddStep} && <e2e runner> .features-gen/features/<path>/<name>.feature.spec.js --project=bdd
  ```

  (Example with a typical Playwright BDD setup: `<pkg> exec playwright test .features-gen/features/edge-functions/admin/users.feature.spec.js --project=bdd`.)

- **UI/E2E tests (single feature)** — from `${testing.e2e.dir}`:

  ```bash
  ${testing.e2e.bddStep} && <e2e runner> e2e/features/<name>.feature --reporter=list
  ```

  Prefer running one feature (or one tier) at a time; see **e2e-narrow-fail-focus-success** for tiers and commands.
- **Unit tests for touched code** — if you changed components or modules used by the scenarios, run the corresponding unit tests with `${testing.unit.runner}` for the files you edited (unit-test locations: `${testing.unit.locations}`).

---

## 5. Verify and assure — all related tests and scenarios must pass

**Continue with gherkin-run-and-assure** (verify and assure phase). In addition:

- **MUST**: Confirm that **all** targeted feature(s), scenarios, and related unit tests **pass**. The command is not complete until the user is assured of this.
- If any test or scenario fails, fix the cause and re-run the **same** tests until they pass; only run a broader set if the fix clearly affects more areas.
- **Do not stop** until every related feature spec, scenario, and unit test is green. Then report clearly to the user that all related tests and scenarios pass.

---

## Summary

- **Skills** (in order): **gherkin-memory-at-start** → **gherkin-clarify-and-scope** → **gherkin-implement-and-store** → **gherkin-run-and-assure**. Use **e2e-narrow-fail-focus-success** and **run-tests** where relevant. **Subagents**: use **mcp_task** (explore for scope discovery, shell for running test commands) when delegating helps.
- 0. **At start**: Use **gherkin-memory-at-start**; load facts + semantic memory search + requirements/decision search; if match, build on or replace RAG per issue Description/Comments or User Prompt.
- 1. **Clarify**: Use **gherkin-clarify-and-scope**; requirements/decision search, recent decisions, semantic search; issue: read **Description** and **Comments**.
- 2. **Scope**: Continue **gherkin-clarify-and-scope**; semantic search, dependency lookup; API vs UI feature/steps paths.
- 3. **Fix**: Use **gherkin-implement-and-store**; then **write to memory** (when configured); run `${testing.e2e.bddStep}` for API tests.
- 4. **Run**: Use **gherkin-run-and-assure**; run all affected feature specs, scenarios, and unit tests.
- 5. **Verify and assure**: Continue **gherkin-run-and-assure**; re-run until all green; assure the user.

**Completion criterion:** The command is done only when the user has been explicitly assured that the fix is in place and that all related tests and scenarios pass.

---

## Memory / knowledge store — requirements-side tool checklist (when `${memory.store}` ≠ none)

| Tool | When to use |
| ------ | ------------- |
| **requirements/decision search** | Command start + Clarify: match prior implementations; business logic, AC, prior decisions (natural-language query). |
| **list recent stored points** | Clarify: recent stored points / decisions. |
| **store decision** | After fix: persist **every** bug/tracker-item implementation — decision, rationale, paths, issue key (domain, feature). |
| **code/requirements semantic search** | Clarify + Scope: find requirements and code by meaning (query, optional limit/project/language). |
| **find similar code** | Implement: match existing step/scenario style (code_snippet, limit). |
| **find duplicate patterns** | Implement: reduce duplication (similarity_threshold, min_length). |
| **find code patterns** | Implement: align with patterns, avoid anti-patterns (pattern_type, language). |
| **refactoring suggestions** | Implement: when touching app/API files (file_path). |
| **dependency lookup** | Scope: impact of step/app code (dependencies and callers). |
| **code metrics** | Run/Verify: optional quality check on changed area. |

## Memory / knowledge store — item-memory side (when `${memory.store}` ≠ none)

| Tool | When to use |
| ------ | ------------- |
| **load facts** | Command start (optional): load structured rules. |
| **semantic memory search** | Command start: query by issue key, description, or user prompt; if match, build on or replace RAG per issue/Comments/User. |
| **store memory** | After **every** bug or tracker-item implementation: store summary, issue key, what was done, paths, rationale; set type, domain, tags, importance for future match. |
| **update memory** | When refining or correcting a prior stored implementation. |
