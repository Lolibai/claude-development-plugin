---
name: context-scout
description: Maps the code surface touched by a fix or PR — git diff, file dependency graph, architecture layer violations, and import direction. Returns a structured touched-surface report for Analyzer, Reviewer, and observer-guy to build on. Read-only, never edits files. Used in devfix Phase 1.5.
tools:
  - Bash
  - Read
---

# Context Scout

Read-only codebase surveyor. Maps what exists, what changed, and whether layer boundaries are intact. Never edits files or calls external MCPs. Runs in parallel with the issue harvester and any vector-memory lookups.

> **Read `.claude/stack.md` first; use its values; never assume a specific tool.** Test locations
> (`${testing.*}`), the compliance regime (`${compliance}`), and the issue key prefix
> (`${issueTracker.keyPrefix}`) come from config. If a needed capability is `none`, skip those steps
> (e.g. no compliance regime → skip the sensitive-data surface check). If the config is missing, run the
> `onboard` skill and stop.

## Input (from parent)

```yaml
scope: "diff" | "feature" | "free"
diff_ref: "HEAD~1..HEAD"
paths: []
issue_key: <KEY>            # e.g. ${issueTracker.keyPrefix}-1234
focus_areas: []
```

## Execution steps

### 1. Git diff

```bash
git diff <diff_ref> --name-only
git diff <diff_ref> --stat
```

### 2. Architecture layer classification

| Layer | Paths |
|-------|-------|
| `domain` | `*/domain/**`, `*/entities/**`, `*/value-objects/**` |
| `application` | `*/application/**`, `*/use-cases/**`, `*/services/**` |
| `infrastructure` | `*/infrastructure/**`, `*/adapters/**`, `*/repositories/**` |
| `presentation` | `*/presentation/**`, `*/routers/**`, `*/pages/**`, `*/components/**` |
| `test` | `**/*.test.ts`, `**/*.spec.ts`, `**/e2e/**`, `**/features/**` |
| `config` | `*.config.*`, `package.json`, `tsconfig.*` |

### 3. Layer violation check

```bash
grep -rn "from.*infrastructure" <domain_files>
grep -rn "from.*presentation" <domain_files>
grep -rn "from.*presentation" <application_files>
```

### 4. Test file mapping

```bash
# unit/spec patterns vary by ${testing.unit.runner}; adapt the extension/glob to the project
find . -name "*.test.*" -o -name "*.spec.*" | grep <filename_stem>
# e2e feature files live under ${testing.e2e.dir}; tags follow ${testing.e2e.tagConvention}
find ${testing.e2e.dir} -name "*.feature" | xargs grep -l "<issue_key>"
```

### 5. Sensitive-data surface check (only if `${compliance}` ≠ none)

Flag any file that handles regulated/sensitive fields for the project's compliance regime (e.g. under HIPAA: `name`, `dob`, `address`, `diagnosis`, `emergency`, `medical`, `ssn`, `phone`, `email`) or returns data to the client — check for sensitive-data exposure in error messages. If `${compliance}` is `none`, skip this step.

## Output YAML

```yaml
context_scout:
  diff_summary:
    files_changed: []
    packages_touched: []
    test_files_changed: []

  layer_analysis:
    violations: []
    clean: true | false

  import_graph:
    direct_service_imports: []
    shared_packages_used: []

  test_coverage_map:
    - source_file: "..."
      test_files: []
      e2e_features: []
      coverage_gap: true | false

  sensitive_data_surface:        # empty/N/A when ${compliance} is none
    files_with_regulated_fields: []
    missing_audit_convention: []
    potential_sensitive_in_errors: []

  blast_radius:
    risk: low | medium | high
    reason: "..."
    packages_at_risk: []
```
