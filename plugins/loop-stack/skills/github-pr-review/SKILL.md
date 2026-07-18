---
name: github-pr-review
description: Use when reviewing a PR, leaving PR feedback, triaging a pull request, checking if a PR covers AC, or summarizing backend/API changes for frontend work. Fetches PR diff + CI status via the GitHub MCP/CLI; loads the linked issue-tracker ticket (description, comments, subtask parent, Epic chain, related issues, linked spec/wiki pages) from the issue key in branch/title; checks the configured memory/knowledge store for stored decisions; verifies previous review comments were fixed; gates on the Definition of Done checklist; posts polite blocking/non-blocking GitHub comments; writes critical findings back to the memory store.
---

# GitHub Pull Request Review (MCP + CLI)

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** Repo + reviewer
> (`${project.repo}`, `${vcs.prReview.reviewer}`, `${vcs.prReview.watchAuthors}`), issue tracker
> (`${issueTracker.tool}`, `${issueTracker.connection}`, `${issueTracker.keyPrefix}`, `${issueTracker.states}`),
> memory/knowledge store (`${memory.store}`), and the frontend/backend stack (`${frontend.*}`, `${backend.*}`)
> all come from config. This skill is intentionally **GitHub-centric** (it is GitHub-named) — but if a needed
> capability is `none` (no issue tracker, no memory store, no spec/wiki), **skip** those steps; don't invent
> one. If `.claude/stack.md` is missing, run the **`onboard`** skill and stop.

## When to Use

- User provides a PR link, number, or asks for a PR review; **post polite GitHub comments when warranted** unless they ask for local-only.
- User wants a concise handoff focused on **frontend implementation**.

## Prerequisites

- **GitHub CLI**: `gh auth status` must succeed. If not, stop and note that `gh auth login` is required.
- **GitHub MCP**: Use the GitHub MCP server configured for this workspace. **Before every MCP call**, read that tool’s JSON descriptor (e.g. under the workspace `mcps/` folder) so arguments match the schema.
- **Memory / knowledge MCP(s)**: If `${memory.store}` is set, use its configured server(s) for stored decisions and requirements (e.g. a vector-DB Memory MCP and a Requirements MCP). Same rule: read the JSON schema before invoking. If `${memory.store}` is `none`, skip every memory step below.

## Resolve Target

From input, determine `owner`, `repo`, `pullNumber` (default repo = `${project.repo}` when only a PR number is given). Accept forms:

- `https://github.com/{owner}/{repo}/pull/{n}`
- `{owner}/{repo}#n` or `owner/repo` + separate PR number

## Switch to Source Branch and Pull Latest

Before gathering any context, check out the PR's head branch and pull the latest changes so local reads reflect what is actually under review:

```bash
gh pr checkout <pullNumber> --repo owner/repo
git pull
```

If checkout fails (e.g. local uncommitted changes), stash first (`git stash`) then checkout, and note the stash in the summary so the user can restore it.

## Gather Context (parallel when possible)

**MCP (`pull_request_read`)** — typical sequence:

| `method` | Use for |
|----------|---------|
| `get` | Title, body, branches, mergeability |
| `get_files` | Scope; paginate if large |
| `get_diff` | Full patch (watch size) |
| `get_check_runs` | CI signal |
| `get_reviews` / `get_review_comments` | Existing feedback; avoid piling on duplicates |

## Verify Previous Review Comments Were Fixed

After gathering context, always check whether prior round comments were actually addressed — not just marked resolved:

1. Fetch all review threads via `get_review_comments`.
2. For each thread that was marked resolved or received an author reply claiming "Fixed":
   - Read the **current file** at the relevant path (via `Read` or `get_file_contents`) and confirm the issue is gone from the code.
   - If the thread is **outdated** (line moved), grep or search for the old pattern to confirm it no longer exists anywhere in the file.
3. Report findings in the summary under **"Previous comments — verification"**:
   - ✅ Fixed — confirmed in current code
   - ⚠️ Partially fixed or different approach taken — describe what changed
   - ❌ Not fixed — still present in code despite "Fixed" reply; post a follow-up GitHub comment citing the original thread
4. For threads the author **pushed back on** (explained why they won't fix): accept if the technical reasoning is sound; re-raise if it is not.

**CLI** — supplement and verify locally:

```bash
gh pr view <n> --repo owner/repo --json title,body,baseRefName,headRefName,commits,files,state,url
gh pr diff <n> --repo owner/repo
```

Use **`get_file_contents`** (or local `Read`) when the diff is truncated or behavior depends on surrounding code.

## Requirements / memory context (only if `${memory.store}` and/or `${issueTracker.tool}` are set)

Run **in parallel with** GitHub/CLI context when the PR touches product behavior, API contracts, sensitive data, workflows, or cross-app UI. Skip only for trivial chores (typo-only, pure tooling) if time-bound—otherwise prefer always loading memory facts. If `${memory.store}` is `none`, skip this whole subsection and review from code + the project's rules only.

**Order and tools** (use the verbs the configured `${memory.store}` exposes — examples below):

1. **Facts load** (e.g. a `memory_facts` call) — Call first. Injects structured project rules and standing decisions from facts storage.
2. **Semantic search** (e.g. a `memory_search` call) — Build `query` from PR title/body, changed paths, and any **issue key** (`${issueTracker.keyPrefix}-<n>`) from branch name, title, or commits. Use multiple queries if the PR spans domains.
3. **Requirement-vector search** (e.g. a `find`/`qdrant-find` call against a Requirements store) — Natural-language search against requirement vectors. Query the **feature area and user journeys** implied by files and PR description; use hits to check alignment with documented behavior, edge cases, and acceptance criteria.

**Linked spec/wiki pages from the issue ticket (when the PR has an issue key and `${issueTracker.tool}` ≠ none):** If the PR title, branch name, or commits reference a `${issueTracker.keyPrefix}-<n>` key, read the issue from the tracker (e.g. Jira `getJiraIssue` with fields summary/description/comment/status/issuelinks).
- **Subtask:** If the issue is a subtask or carries a parent, fetch the parent (e.g. a Story) and, if it too has a parent (e.g. an Epic), fetch that — run them in parallel. All levels contribute AC context; the most specific level takes precedence on conflicts.
- **Standalone bug:** Include issue links in the fetch. For `"is caused by"` / `"relates to"` / `"duplicates"` / `"clones"` links, fetch those issues in parallel for context. For `"blocks"` / `"is blocked by"` links, surface a warning rather than fetching.
Then scan the full text of all fetched issues for linked spec/wiki page URLs on the tracker's host (`${issueTracker.connection}`) and fetch each one (e.g. Confluence `getConfluencePage(..., bodyFormat="markdown")`) — run all calls in parallel. Treat page content as extended AC when assessing whether the PR covers all acceptance criteria. Note: pages linked via a separate "pages" tab may NOT be discoverable through the tracker's remote-issue-links API — scanning issue text for URLs is the reliable method.

**Optional** (large or ambiguous diffs): a broader semantic search for alternate phrasing; a dependency lookup if the PR introduces or changes a public contract and you need impact hints. Read each tool’s descriptor before calling.

**How to use results in GitHub comments**

- Prefer **accurate, specific** feedback: flag when the patch **conflicts** with stored requirements or team decisions surfaced by the memory store, or when an **edge case** from requirements is unhandled.
- Keep GitHub text **safe**: no regulated/sensitive data, no secrets, no long pasted dumps of internal docs. Paraphrase; link to tickets or public specs when the user has them.
- If the memory store returns **no** relevant hits, say nothing false—fall back to code and the project's rules only.

## Writeback to the memory store (critical findings)

**After** the review (and after posting GitHub feedback if applicable), persist **non-obvious, reusable** knowledge to `${memory.store}` (e.g. a `memory_store` call). Read the tool descriptor before calling. If `${memory.store}` is `none`, skip writeback.

**Store when** the PR reveals something future reviewers or implementers should not rediscover from the diff alone—for example:

- A **pattern** or invariant in how a module must be used (e.g. how the app's request context, audit, or encryption boundaries must be wired).
- A **decision** or trade-off justified in discussion or code (why this approach vs alternatives).
- A **constraint** (platform, compliance regime, authorization/row-level policy, env) that the change encodes or relies on.
- An **incident-class** lesson (subtle bug class, ordering of checks, race) **without** any user or regulated data.

**Do not store**: regulated/sensitive data, credentials, tokens, raw PII, full file dumps, or large patches. Paraphrase at the **concept** level. Prefer **`importance`** ~0.7–1.0 for truly critical items; use **`tags`** (`pr-review`, PR `/owner/repo#n`, the issue key if known, feature domain) and **`domain`** / **`project`** when the schema supports them.

**`type`**: use `pattern`, `decision`, `constraint`, `incident`, or `note` per the store's schema (match semantics to content).

If the semantic search surfaced an entry that the PR **supersedes or corrects**, update that entry in place (e.g. a `memory_update` with its `id`) instead of duplicating; otherwise add a new row.

**Optional**: For requirement-level capture that belongs in the requirement vector store, a `store` call there is acceptable when the project uses it for spec continuity—read that tool’s schema; do not duplicate secrets or regulated data there either.

## Definition of Done gate

Before posting approval or a summary, verify the PR satisfies every item in `skills/shared/definition-of-done.md`. Flag any unmet item as a **blocking** review comment. Pay special attention to the QA handoff block — the PR description must include scenario names, manual verification steps, and out-of-scope notes.

## Evidence Mode — non-negotiable

Every finding MUST be backed by a verbatim diff excerpt at a specific `file:line`. No finding without evidence. Forbidden words in findings: "seems", "probably", "may", "appears", "looks like", "might".

```
GATE — before recording any finding:
  1. LOCATE the exact line(s) in the diff or current file that prove it
  2. QUOTE the verbatim code snippet
  3. CITE file + line number
  4. ONLY THEN write the finding

Skip any step → finding is invalid and must be dropped
```

The same gate applies to **clearing** a check: only write "no issues" after reading every changed line that falls under it. "Didn't notice any" is not evidence.

**Verdict gate:**
- `REQUEST_CHANGES` requires at least one blocking finding with a quoted diff excerpt
- `APPROVE` requires that every lens was checked and every changed line was read — state this explicitly in the review body

Every posted GitHub comment must include an `Evidence:` block with the verbatim snippet. A comment without it is invalid and must not be posted.

## Review Focus

> **Note:** Canonical rules are the invariants below (read them from the project's rules file, e.g. `CLAUDE.md`) and the skills listed in the skills map. Treat any legacy/archived rule sets (e.g. a `.cursor/rules/` folder) as read-only history — do not cite or enforce them.

### Backend invariants (non-negotiable, check on every backend/shared PR)

Read the project's actual invariants from its rules file (e.g. `CLAUDE.md`) and flag violations as **blocking**. The list below is a **template of common invariant classes** — keep the ones the project declares, drop those that don't apply, and substitute the project's concrete tools (the parenthesised tools are examples only):

| # | Invariant class | What to check |
|---|-----------|---------------|
| 1 | **Compliance / sensitive data** | Regulated/sensitive data encrypted at rest (per the project's regime, e.g. HIPAA PHI / GDPR PII); every procedure that mutates it goes through the project's audit mechanism (e.g. an audit middleware); no sensitive data in error messages or logs |
| 2 | **Clean Architecture** | Dependencies flow inward only: `domain` ← `application` ← `infrastructure` ← `presentation`; no `infrastructure` import in `domain` |
| 3 | **Context injection** | Services accessed via the app/request context (e.g. `ctx.services.*`) inside routers/use cases; no direct service or adapter import |
| 4 | **Lazy infra init** | Data-platform clients (`${backend.platform}`), encryption, external APIs initialize lazily (not at module load) |
| 5 | **UTC dates** | All dates UTC at rest, in transit, and in comparisons; no local-time math |
| 6 | **Enums only** | No hardcoded string literals for domain concepts; use enums + validation at boundaries (e.g. `z.nativeEnum()`) |
| 7 | **Language strictness** | Follow the project's strictness rules (e.g. in TS: `??` for null/undefined, `||` only for truthy coercion, no `!` non-null assertion, no `async` without `await`, prefer `satisfies`/`as const`/type guards over `as` casts, unused params prefixed with `_`) |
| 8 | **Generic errors** | Error messages generic and non-enumerating; no "user not found" vs "wrong password" leaks; log detail internally |
| 9 | **Commit format** | Matches the project's commit convention (`${issueTracker.keyPrefix}`/`${vcs.branchNaming}`, e.g. commitlint-enforced); no assistant attribution |

### Clean Code lens (from `devfix` Reviewer role — applies to all code)

Layer on top of the compliance/security checks:

- **SOLID**: single responsibility, open/closed via composition, interface segregation, dependency inversion
- **DRY**: no duplicated logic, option lists, validation rules, or constants — extract to shared
- **KISS / YAGNI**: no abstraction beyond the task; no future-proofing code that isn't needed now
- **Meaningful names**: no abbreviations beyond well-known (`id`, `url`, `db`); booleans `is*/has*/should*/can*`
- **Small functions**: ≤ 40 lines, ≤ 4 params; extract before exceeding
- **No silent swallows**: try/catch must surface or re-throw; no `console.log` left in source

**Explicit frontend pass** on any PR touching:

- the frontend tree, shared UI packages, generated/client API types, API contract output shapes, feature flags, or user-visible copy.

Note API/schema changes that imply UI work (new fields, errors, loading states, empty states).

## Frontend Code-Style Rules (STRICT — enforced on every PR)

> **Config-driven:** apply this section only when `${frontend.frameworks}` is non-empty, against the apps in `${frontend.apps}`, the styling in `${frontend.styling}`, and any project conventions in `${frontend.conventions}`. The concrete tools named below (MUI, Tailwind, react-hook-form, Zod, TanStack Query, Vitest, etc.) are **examples** — substitute the project's actual UI library, styling system, form/validation/query libraries, and test runner (`${testing.unit.runner}`). If the project ships no frontend, skip this entire section.

These rules codify the project's **dominant frontend patterns** (discover them from `${frontend.*}` and existing code). They are **non-negotiable** during PR review once established. Every PR touching the frontend tree MUST be checked against the project's documented norms. No drift, no per-PR re-litigation ("I prefer types", "I want interface here") — pick the documented norm or open a follow-up to amend this rule.

### A. SOLID & file size (Clean Code: A Handbook of Agile Software Craftsmanship)

- **No long files.** Hard cap: **300 lines per `.ts`/`.tsx`** (excl. imports/blank). Soft warn at **200**. Components > 300 lines MUST be split (extract subcomponents, hooks, helpers).
- **Single Responsibility.** A component does one UI thing; a hook owns one piece of state/effect; a util is pure. If a file has two concerns, split it.
- **Functions ≤ 40 lines, ≤ 4 params.** Extract before exceeding.
- **Open/Closed via composition** — extend behavior with new components/hooks/props, not by branching inside existing ones with feature flags inline.
- **Interface segregation** — props interfaces stay narrow; do not pass an entire entity when 2 fields suffice.
- **Dependency inversion** — components depend on the shared API client and shared abstractions, not on concrete adapters.
- **No prop drilling > 2 levels.** Use a feature context, hook composition, or compound components. (E.g. a dialog passing handlers two-plus levels down into nested form fields — flag patterns like this.)

### B. Module / component / file structure

- App layout: `apps/<app>/src/{pages,components,hooks,contexts,lib,navigation,utils,types,theme}` (or the project's equivalent). Pages are routed components; `components/<feature>/` groups feature-scoped UI.
- **One exported component per file**, file name = component name in **PascalCase** (e.g. `EditProfileDialog.tsx`).
- Hooks/utils/lib files in **camelCase** (e.g. `useProfilePhoto.ts`, `validation.ts`).
- **Barrels** (`index.ts`) only at **shared package roots** (e.g. `packages/shared-components/index.ts`). Do **not** add `index.ts` inside feature folders — import the file directly.
- Co-located `types.ts` next to the feature folder is allowed when shared by ≥2 files in that folder; otherwise inline above the component.

### C. Type system

> (TypeScript-flavoured example; apply the analogous rules for the project's language.)
- **Props → `interface`.** Data/payload shapes → `interface`. **`type`** is reserved for unions, intersections, mapped/conditional types, and aliases.
- **Enums: keep them. Keep them simple.** Use `enum` with string values for domain constants (e.g. a status or plan-type enum). Do not refactor existing enums into `as const` objects or string-literal unions. Do not introduce `const enum`. At validation boundaries use the schema lib's enum helper (e.g. `z.nativeEnum(MyEnum)`).
- `as const` for **literal tuples/arrays of options** (e.g. a `VALID_OPTIONS` array).
- `satisfies` preferred over `as` when narrowing object literals.
- **Forbidden:** `any`, `as unknown as X` double-casts, `!` non-null assertion, single-purpose `as X` casts where a type guard works.
- Validation schemas live in `apps/<app>/src/lib/validation*.ts` or a shared validation package.

### D. Component conventions

- **Declaration:** `export function Foo(props: FooProps) { ... }` for components and hooks. Do **not** use `const Foo = (...) => {...}` for top-level components.
- **Exports:** **named exports** for components, hooks, utils. **`export default`** ONLY for routed page components in `pages/`.
- **Props interface** declared **in the same file, directly above the component** (unless promoted to `types.ts` per §B).
- **Styling system per `${frontend.styling}` and `frontend-component-conventions`** (e.g. a UI-library + utility-CSS hybrid: the component library for inputs/overlays/feedback, utility classes for layout/spacing/typography). **No inline `style={{...}}`** except narrowly-scoped dynamic cases the project explicitly allows.
- **No inline arrow functions in JSX props** (`onClick={() => doX()}`) — extract to a named `handleX` or `useCallback`. Same for inline objects/arrays passed to memoized children.
- **No inline arrow functions in hook deps arrays.**
- `forwardRef` only when a parent genuinely needs the DOM ref; do not preemptively forward refs.

### E. Hooks

- Naming `useXxx`. Per-feature hooks live in `apps/<app>/src/hooks/`. Cross-app hooks live in a shared package.
- **Return shape: object, not tuple** (`{ data, isLoading, onSubmit }`). Tuples allowed only for primitive `[value, setter]` pairs.
- One hook = one responsibility. If a hook returns >6 keys, split it.

### F. Data fetching (project's API client + query/cache lib)

> (Example below assumes a typed API client + a query/cache library such as tRPC + TanStack Query; map to the project's actual stack.)
- Always via the typed client's query/mutation hooks (e.g. `trpc.<router>.<proc>.useQuery()` / `.useMutation()`). Never call the raw client in components.
- Mutations destructure `onSuccess` / `onError` inline; invalidate via the cache lib's invalidate API.
- Every query-driven UI handles **loading**, **error**, and **empty** states explicitly. No silent `undefined` renders.
- Stale time follows existing app defaults; do not override per-query without justification in the PR description.

### G. Forms

> (Example below assumes a form lib + schema-resolver such as react-hook-form + a Zod resolver; map to the project's actual libs.)
- Form lib + schema resolver (e.g. `react-hook-form` + `zodResolver(<schema>)`). Schema lives in `lib/validation*.ts` or a shared validation package.
- Use the library's controlled-input wrapper for component-library inputs (e.g. a `Controller`); field errors rendered via the component's error props.
- Submit via a named submit handler (e.g. `form.handleSubmit(onSubmit)`); never inline.

### H. Imports & path aliases

Use the project's configured path aliases (discover them from the workspace `tsconfig`/bundler config). Typical scheme — substitute the project's actual scope (e.g. `@<scope>/...`) and package names:

| Alias (example) | Resolves to | Use for |
|-------|-------------|---------|
| `@/*` | `apps/<app>/src/*` | Anything inside the current app's `src/` |
| `@<scope>/shared-api` | `packages/shared-api` (barrel) | API client, API helpers |
| `@<scope>/shared-components` | `packages/shared-components` (barrel) | Shared UI primitives |
| `@<scope>/shared-contexts` | `packages/shared-contexts` (barrel) | Cross-app contexts |
| `@<scope>/shared-styles` | `packages/shared-styles` (barrel) | Theme, styling base, design tokens |
| `@<scope>/shared-types` | `packages/shared-types` (barrel) | Domain enums and shared types |
| `@<scope>/shared-utils` | `packages/shared-utils` (barrel) | Pure helpers |
| `@<scope>/shared-validation` | `packages/shared-validation` (barrel) | Validation schemas |
| `@tests/*` | `tests/*` | Test-only utilities (test files only) |

**Rules:**

1. **Cross-package: import from the barrel only.** Use the package barrel (e.g. `@<scope>/shared-components`), never a deep path into it and never a `../../packages/...` climb. If a symbol isn't exported from the barrel, fix the barrel — don't deep-import.
2. **Within an app: use the app-absolute alias (`@/`)** for anything outside the current folder. **Never** `../../` to climb out of a feature folder; rewrite as `@/components/...`, `@/hooks/...`, `@/lib/...`.
3. **Relative imports** are allowed **only for direct siblings or children** (`./Foo`, `./types`, `./hooks/useBar`). Two `..` segments (`../../`) is a review block — convert to `@/`.
4. **Tests** use `@tests/*` for shared test fixtures; co-located test files import their subject relatively (`./Foo`).
5. **No `src/` in import paths.** `@/foo`, not `@/src/foo`; the package barrel, not a `.../src/...` path into it.
6. **Order, with a blank line between groups:**
   1. Runtime built-ins / framework core / external libs
   2. `@<scope>/*` shared packages
   3. `@/` app-absolute
   4. `@tests/*` (test files only)
   5. Relative `./` and `../`
7. **Side-effect imports** (`import './foo.css'`) go last in their group.
8. **Type-only imports** use `import type { ... }` when the import is used solely as a type — keeps runtime bundles clean and signals intent.

### I. Testing

- Unit tests **co-located** next to the source: `Foo.tsx` ↔ `Foo.test.tsx` (or the project's `${testing.unit.locations}` convention). Shared package tests follow the same rule.
- Project's unit runner + a component testing library (`${testing.unit.runner}`, e.g. Vitest + Testing Library). File suffix `.test.ts(x)`. One `describe` per unit, `it` reads as a sentence.
- E2E lives in `${testing.e2e.dir}`, not in the frontend app tree.

### J. Naming

- Components, types, interfaces, enums: **PascalCase**.
- Functions, variables, hooks, files (non-component): **camelCase**.
- Module-level constants and option arrays: **UPPER_SNAKE_CASE** (`VALID_GENDERS`, `APPROVED_ZIP_CODES`).
- Booleans: `is* / has* / should* / can*`.
- Event props on components: `onX` (`onClose`, `onSaved`). Internal handlers: `handleX` (`handleSave`).
- No abbreviations beyond well-known (`id`, `url`, `db`).

### K. Anti-patterns — block in review

- `console.log` / `console.debug` (or the language's debug-print equivalent) left in source.
- `// TODO` / `// FIXME` without an issue key (`${issueTracker.keyPrefix}-<n>`) and owner.
- Commented-out code blocks.
- Magic numbers/strings in JSX or logic — extract to a named constant or enum.
- Dead exports / unused props.
- Try/catch that swallows errors silently.
- Date math in local time — must be UTC if that is a project invariant.
- New file > 300 lines without a split plan.

### Review checklist (apply to every frontend PR)

When commenting, reference the rule letter **with its short section name** (e.g. `[D: Component conventions]`, `[K: Anti-patterns]`) so the author understands the context without having to look up the letter. Format: `[<letter>: <section name>]`. Section names for quick reference:

| Letter | Section name |
|--------|-------------|
| A | SOLID & file size |
| B | Module / file structure |
| C | Type system |
| D | Component conventions |
| E | Hooks |
| F | Data fetching |
| G | Forms |
| H | Imports & path aliases |
| I | Testing |
| J | Naming |
| K | Anti-patterns |

Do **not** invent new style preferences in review — if a rule is missing here, propose updating this skill rather than enforcing ad-hoc.

## Posting Feedback (Polite, Actionable)

**Default: post when it helps.** If the review surfaces something the author should see on GitHub—**blocking** issues (correctness, security, compliance/data-sensitivity, broken API contract), **misalignment** with requirements/decisions surfaced from `${memory.store}`, or **specific, non-duplicate** suggestions—use MCP to post **polite** feedback. Do not wait for the user to say “post on GitHub”; **that is part of a normal PR review** when MCP/GitHub access works.

**Approve / Request changes / Comment — decision:**

| Outcome | When | Action |
|---------|------|--------|
| **APPROVE** | No blocking findings after full review | Submit automatically via MCP (`event: APPROVE`) — do not wait for the user to ask |
| **REQUEST_CHANGES** | One or more blocking issues found, user confirms | Submit via MCP (`event: REQUEST_CHANGES`) with a body summarising the blockers — do not ask the user to do it manually |
| **COMMENT** | Non-blocking suggestions only | Submit via MCP (`event: COMMENT`) |

Blocking = correctness bug, compliance/security issue, broken API contract, or confirmed requirement violation. Style nits and optional suggestions are **not** blocking.

**Skip GitHub posting** only when:

- The user **explicitly** asks for a local-only / read-only review (e.g. “don’t post”, “summary only”, “no GitHub comments”), or
- The same point is **already** clearly raised on the PR, or
- There is **nothing** substantive worth a thread (trivial PR with no findings)—then say “None” in the summary and do not spam empty reviews.

If MCP write fails (auth, permissions), note it in the summary and still deliver full feedback to the user in chat.

**Tone**

- Use collaborative language: “Consider…”, “Optional: …”, “Might be worth …”, “For consistency with …”.
- Separate **blocking** concerns (correctness, security, broken builds) from **suggestions**.
- Assume positive intent; avoid blame.

**Where and how to comment — prefer suggestions over prose**

**Default: post a GitHub `suggestion` block whenever the fix is concrete and bounded.** A suggestion lets the author one-click "Commit suggestion" — that is the highest-leverage form of review feedback. Fall back to a plain inline comment only when a suggestion can't represent the change.

1. **Line-level `suggestion` (PREFERRED, default)** — when the fix touches a small, contiguous range and you can write the exact replacement code:
   - Create a **pending** review via `pull_request_review_write` (`method`: `create`, omit `event` to leave pending).
   - Add the comment with `add_comment_to_pending_review`. Set `subjectType: LINE`, supply `path`, `line` (and `start_line` for ranges), `side: RIGHT`.
   - Body format — kind, brief rationale + a fenced ` ```suggestion ` block with the exact replacement lines (no `+`/`-` prefixes; the block must contain the **final** content for the selected line range):
     ````
     [B: Module / file structure] File getting long — consider extracting `<thing>` to its own component.
     For this specific block, here's a tightened version:
     ```suggestion
     export function Foo({ id }: FooProps) {
       return <Bar id={id} />;
     }
     ```
     ````
   - One suggestion = one logical change. Do not stack multiple unrelated suggestions in one block.
   - Submit with `pull_request_review_write` (`method`: `submit_pending`, `event`: `COMMENT` unless the user asked for approve/request-changes).

2. **Plain inline comment (fallback)** — when a suggestion is **not feasible**: cross-file refactor, architectural concern, missing file/test, naming-only debate without an obvious replacement, or the change spans more than ~20 lines. Use the same pending-review flow but skip the ```suggestion block. Be polite, specific, cite the rule letter with its name (`[A: SOLID & file size]`, `[D: Component conventions]`, `[K: Anti-patterns]`...), and propose a direction.

3. **PR conversation comment** — for the overall summary or cross-cutting notes with no line anchor: `add_issue_comment` with the PR number as `issue_number`, **or** the review's overall `body` on submit. Pick one — never both — to avoid duplicate walls of text.

**Tone for every posted item:** kind, polite, collaborative. Open with the rule reference **including its section name**, not a verdict. Examples:
- "[D: Component conventions] Tiny suggestion — extracting this handler avoids the inline arrow in the JSX prop:" + ```suggestion
- "[A: SOLID & file size] This file is at 340 lines. Could we split `<X>` into its own component in a follow-up? Happy to scope it."
- "[H: Imports & path aliases] Nit: this can use the `@/` alias instead of `../../`. Suggestion below."

## Reply to User: Markdown Summary

Always end with a markdown document structured like below. **Prioritize the “Frontend implementation” section** — that is the main deliverable for the team doing UI.

```markdown
## PR review summary

- **PR**: [title](url) — `#n` vs `base` ← `head`
- **Checks**: pass / fail / skipped (brief)
- **Risk**: low | medium | high — one line why

### Highlights (overall)

- Bullet points: what the PR does, notable design or breaking changes.

### Suggestions posted on GitHub

- [ ] **None** — no substantive findings, user requested local-only, write blocked, or thread already covered the same points (**still** complete Frontend TODO / implementation below if applicable)
- Or short list: theme of each posted comment (no need to paste full text)

### Frontend implementation (primary)

**Backend-only or API-only PRs** (no frontend paths in the diff) still need a concrete **Frontend TODO** when they add or change anything the UI must consume: API procedures/endpoints, request/response shapes, enums, errors, generated client/contract types (e.g. OpenAPI), feature flags, or user-visible flows. Use a checklist:

```markdown
### Frontend TODO

- [ ] …
```

Each item should name **screen/route or feature**, **what to wire**, and **procedure/field/error** references.

For PRs that **do** touch `frontend/`, use bullets grouped by **feature / screen / route**. For each item include:

- **What to build or change** (UI behavior, validation, states).
- **API/types** (new procedures, fields, errors) if applicable.
- **Out of scope / follow-up** if deferred.

Only state **“No frontend changes required”** when there is **no** new or changed UI contract and **no** downstream app work (e.g. internal-only refactor, migration with identical API, ops-only). Do not use that phrase for “no files under `frontend/`” alone.

**Nothing posted on GitHub** (no warranted findings, user opted out, or write failed) does **not** mean the summary skips Frontend TODOs—still deliver the checklist or implementation bullets for the UI team.

### Backend / ops notes (short)

- Only items that are not already covered above (migrations, env vars, feature flags).

### Open questions

- Numbered questions for author or PM, or “None”.

### Memory writeback

- **Stored**: list short labels (type + one-line topic) for each store/update written to `${memory.store}`, or **None** if nothing critical warranted persistence (or `${memory.store}` is `none`).
```

### Optional: Frontend handoff file (when requested)

If the user asks for a **durable markdown handoff** for the frontend team (e.g. “todo style”, “MD for frontend”, paste into the tracker/chat):

1. Write **`docs/journals/pr-<n>-frontend-todos.md`** (replace `<n>` with the PR number).
2. Use **checklist syntax** (`- [ ]`) grouped by feature, route, or screen.
3. Each item should name **what to wire**, **procedure(s)**, **input/output fields**, and **error strings or codes** the UI must handle.
4. Include the **PR title + link**, base/head branches, and a one-line note if the PR is backend-only but contract-breaking for the UI.
5. Do **not** duplicate the whole PR review—keep the file actionable for implementers; link to the PR for discussion threads.

If the user specifies another path or filename, use that instead. Skip this section when not asked.

## Verification

- [ ] Checked out PR source branch and pulled latest (`gh pr checkout` + `git pull`) before reading any files.
- [ ] Previous review comments verified in current code (not just resolved/replied); any unfixed items re-raised on GitHub.
- [ ] MCP tool schemas read before writes.
- [ ] `${memory.store}` consulted (facts load, then semantic + requirement-vector search) so blocking notes and frontend handoff match stored requirements and decisions — or skipped because `${memory.store}` is `none`.
- [ ] **GitHub**: when findings warrant it, polite comments were posted (or summary explains skip: user local-only / duplicate / MCP failure); no regulated/sensitive data or secrets in GitHub text.
- [ ] User message includes the full summary with **Frontend implementation** filled in concretely — including **Frontend TODO** checklists for backend/API-only PRs when the UI must consume new or changed contracts.
- [ ] **Frontend handoff file**: if the user asked for a todo-style MD handoff, **`docs/journals/pr-<n>-frontend-todos.md`** (or path they gave) exists and matches the PR contract.
- [ ] **Memory writeback**: if the PR introduced critical reusable knowledge, a store/update was written to `${memory.store}` (skip if `none`); summary documents what was stored or states **None**.

## Related skills

- **Knowledge/memory**: `memory-first`, `memory-validator`, `the-journalist` — Phase 1 context load and post-review writeback (against `${memory.store}`).
- **Frontend review lens**: `react-frontend-developer`, `frontend-component-conventions`, `mobile-friendly-checker` — apply when the diff includes UI changes.
- **Backend review lens**: `backend-feature-workflow`, `database-migration`, `serverless-function` — apply when the diff includes backend changes; use these to evaluate whether the PR follows canonical patterns.
- **Architecture lens**: `principal-architect` — escalate cross-layer / compliance / authorization-policy concerns.
- **Gherkin alignment**: `gherkin-clarify-and-scope` — reuse its memory-store pattern for requirement checks.
- **Post-review implementation**: `devfix` — if review uncovers a bug that must be fixed.
