# Bugfix

Read `.claude/stack.md` first; use its values; never assume a specific tool; if a needed capability is `none`, skip those steps; if the config is missing, run the `onboard` skill and stop.

Fix a bug by **aggressively validating the user's prompt** against the project's memory / knowledge store (`${memory.store}` — e.g. a vector store such as Qdrant, exposed via a memory MCP) **before and after** the fix. **Do not implement any code change until that validation is complete.** You may combine this with `gherkinfix` when the bug touches Gherkin/BDD.

> **Memory gate.** If `${memory.store}` is `none`, there is no knowledge store to read or write — skip every memory step (don't ask, don't invent) and go straight to scoping the fix from the user's prompt and the issue tracker.

---

## Memory-first rule

When a memory store is configured, **never skip or shortcut its checks.** If a memory tool is unavailable (error/timeout), state that in your response and continue without it for that tool only; still run all other checks. Consider the command incomplete until you have either run the full validation or explicitly reported which checks could not be run.

---

## 1. Validate the prompt (required when `${memory.store}` ≠ none — no code changes before this)

**You MUST run all of the following before editing any file.** Build multiple queries from the bug description, the issue key (`${issueTracker.keyPrefix}-<KEY>`), the feature name, and the user summary.

### Memory store — structured rules / preferences (all required)

- **Load structured facts/rules first** (the store's "facts" call, if it has one).
- **Semantic memory search** — run at least **two** queries:
  1. Query from the issue key + short summary (e.g. `"<KEY> activate card verification"`).
  2. Query from the bug area or feature (e.g. `"profile update null error"`, `"E2E activate card"`).
  Use a `filter` when relevant (e.g. project/domain) and a `top_k` of at least 5.
- Use every retrieved memory to avoid repeating past fixes and to align with prior decisions and incident notes. If a memory conflicts with the user or the issue, the user/issue wins.

### Memory store — requirements / prior decisions (all required)

- **Requirements/decision search** — run at least **two** natural-language queries:
  1. From the bug summary or issue title (e.g. `"activate card verification email"`, `"profile API error"`).
  2. From the feature/area (e.g. `"dependent card activation"`, `"RLS profile access"`).
- **List recent stored decisions** — fetch the latest stored points (`limit: 5` or more) to see recent decisions and avoid contradicting them.
- **Code/requirements semantic search** — search by meaning (e.g. from the bug description or feature name). Use at least one query; add more if scope is unclear.

**Before implementing:** Produce a short **validation summary** (e.g. a small table or list): what memory matches you found, what the requirements/semantic searches returned, and how you will use that to scope the fix. Do not proceed to code changes until this summary is done.

---

## 2. Scope and implement the fix

- Use the validation summary (or, if `${memory.store}` is `none`, the user's prompt + issue) to scope the fix. Prefer the **relevant layer** (frontend, backend/API, tests, config — see `${frontend.*}`/`${backend.*}`) unless the bug requires another (e.g. DB, infra).
- Follow existing patterns and the project's repo rule files / conventions (e.g. `AGENTS.md`, `CLAUDE.md`, editor/agent rule directories).
- Fix the **root cause** (logic, types, env, tests), not symptoms. Do not weaken assertions to make tests pass.
- Run the project's checks on changed files (`${commands.lint}`, `${commands.typecheck}`, relevant `${commands.test}`) and fix any new issues.

---

## 3. After the fix — re-validate and write back (when `${memory.store}` ≠ none)

- **Re-check (aggressive):** Run the requirements/decision search again with a query that describes the fix (e.g. `"profile API null fix"`, the issue key). Confirm the implementation aligns with stored requirements; if something contradicts, note it or adjust.
- **Write the fix to memory:** Store a short summary — issue key (if any), what was fixed, key paths, rationale. Set the store's metadata (e.g. `type` such as `incident`/`decision`/`pattern`, `domain`, `tags` including the issue key, `importance`) so a future semantic search can match it. If the store exposes both a "memory" surface and a "requirements" surface, write the same content/metadata to both so either search finds it later.

---

## Summary

| Step | Action |
|------|--------|
| 1 | **Aggressive prompt validation** (skip entirely if `${memory.store}` is `none`): load structured facts + semantic memory search (≥2 queries); requirements/decision search (≥2 queries) + list recent decisions + code/requirements semantic search (≥1 query). Write a validation summary; no code changes before this. |
| 2 | Scope and implement the fix using the validation summary; run the project's relevant checks. |
| 3 | **Re-validate:** re-run the requirements/decision search for the fix; then **store** it in the memory store(s). |

**Completion:** The bug is fixed, the project's checks pass, the validation summary was produced (when a memory store is configured), the post-fix re-check was run, and the fix was written back to the memory store(s). If any memory check could not be run, say so explicitly.
