# Toolchain gotchas (shared by devfix + implement)

> **Project-specific gotchas are NOT hardcoded here — they live in the `${recoveryNotes}` section of
> `.claude/stack.md`.** Read that at run start and follow it for anything tied to this project's package
> manager, test runners, edge/data platform, or design tooling. Incident-derived lessons ("we once broke X")
> live in `${memory.store}`, not here: query at run start (e.g. a `memory_search` / facts load) and store new
> ones after. This file holds only **tool-agnostic** advice; any concrete tool below is an **example**, never an
> assumption about the project's stack.

## Tool-agnostic principles

- **Run commands from the directory the tool expects.** Many CLIs (test runners, BDD generators, bundlers)
  resolve config relative to the current working directory and silently no-op or error from the repo root.
  When a tool reports "no config found", check you're in the package/dir that owns its config file before
  anything else. (Example: a BDD generator that must run from the e2e package, not the repo root.)

- **Pin / dedupe dependency versions.** Duplicate copies of a framework in the dependency tree cause
  confusing "loaded twice" / identity-mismatch runtime errors. When a tool complains about being required
  more than once, dedupe the lockfile from the repo root and retry. (Example: two copies of a test framework
  in a package store.)

- **A formatter/linter "check" reads a different state than its "write".** A `format:check` (or lint check)
  typically reads the **working tree** locally but the **committed** state in CI — so a green local check can
  go red in CI if rewrites weren't staged. Always run the write mode, then re-stage, before committing
  (this is what the finish-line Phase 3b enforces).

- **Keep generated artifacts out of formatter/linter scope.** Generated directories (codegen output, build
  artifacts, BDD feature outputs) flooding a format/lint check is almost always a missing ignore-file entry —
  add the path to the tool's ignore file rather than reformatting generated files.

- **Prefer state-based waits over time-based waits in E2E.** Asserting an element's presence/absence with a
  fixed timeout plus a visibility poll is brittle; use the runner's built-in "wait until" expectation with an
  explicit timeout instead. (Example: `expect(locator).not.toBeVisible({ timeout: N })` rather than a sleep +
  manual check.)

- **Treat design-tool output as a snapshot, not a source of truth.** When implementing from a design tool,
  work from an actual rendered image plus a concrete inventory before coding — text-only summaries of design
  context hallucinate colors, spacing, and icons. (Example: capture a screenshot from the design tool first.)

- **Design-tool asset URLs are temporary.** Asset links returned by design integrations are usually
  short-lived CDN URLs and must not be embedded in committed code — download assets locally and reference the
  local copy instead.

- **Hosted design/integration tools are rate- or seat-capped.** When a design or integration MCP returns a
  seat/rate-limit or "could not be accessed" error, fall back to its REST API (or another configured access
  path) rather than retrying the capped call. Record the working fallback in `${recoveryNotes}` so the next
  run skips the dead end.

- **Identifier-format mismatches break tool calls silently.** Some tools expect IDs in a specific separator
  format (e.g. `:` vs `-`); converting an ID copied from a URL into the tool's expected format is a common
  fix for "empty result" responses. Note any such conversion for the project's tools in `${recoveryNotes}`.

## Where project-specific gotchas go

Anything that depends on **this** project's concrete tools — exact CLI flags, container names, local-stack
restart sequences, port-not-ready recovery, design-token REST endpoints — belongs in the `${recoveryNotes}`
section of `.claude/stack.md` (durable, project facts) or in `${memory.store}` (incident-derived lessons).
Do not add project-specific rows to this file.
