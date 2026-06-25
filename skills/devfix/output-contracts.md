# Devfix / Implement — Subagent Output Contracts

Full YAML shapes for all five roles, shared by the `devfix` and `implement` flows. Keys, paths, and enum values are verbatim; prose fields use caveman ultra.

---

## Analyzer

```yaml
analyzer:
  scope:
    files: [<path>, ...]          # files the fix must touch
    change_type: feat|fix|refactor|test
    packages: [<pkg>, ...]        # blast-radius packages
  risks:
    data_protection: low|medium|high  # regulated-data exposure + audit trail, where the domain applies (e.g. PHI/HIPAA)
    clean_arch: low|medium|high       # layer-direction violations
    data_access: low|medium|high      # data-access/row-level policy gaps (e.g. RLS on the configured backend)
    tests: low|medium|high            # test surface risk
  coder_brief:
    strategy: <caveman ultra>     # what to change and where
    test_surface: <caveman ultra> # which test types are required
    no_go: [<caveman ultra>, ...] # things to avoid
```

---

## Coder

```yaml
coder:
  round: 1                        # increments on re-spawn
  red_evidence:                   # MANDATORY — captured BEFORE any production fix (gated by CHECKPOINT-2-RED)
    - ac: <AC / issue Gherkin / test-management case tag reproduced>
      test: <test-file:line>
      command: <exact command run>
      failing_output: <verbatim failing assertion output>
      symptom: <caveman ultra>    # why this failure is the bug, not a typo/compile error
  green_evidence:                 # same RED tests captured passing after the minimal fix
    - ac: <same AC>
      command: <exact command run>
      passing_output: <verbatim passing output>
  diff_summary:
    files_changed: [<path>, ...]
    tests_added: [<path>, ...]
    tests_modified: [<path>, ...]
  notes: <caveman ultra>          # decisions, deviations from Analyzer brief
  blockers: []                    # empty or list of unresolved blockers
  reviewer_focus: <caveman ultra> # areas Reviewer should double-check
```

---

## Tester

```yaml
tester:
  round: 1
  verdict: pass|fail|skip|block
  likely_owner: coder|tester|infra  # present only when verdict=fail
  coverage:
    - file: <path>
      pct: <number>               # line coverage %
      delta: +<n>|-<n>|0
  failing:
    - scenario: <name>
      suite: unit|api-bdd|ui-e2e
      first_error: <caveman ultra>
      file: <path>
      line: <number>
  gaps:
    - ac: <AC text>               # Docs AC or issue AC
      reason: <caveman ultra>
      suggestion: <caveman ultra>
  phase_3a_block:                 # present when verdict=skip
    reason: <caveman ultra>       # why Phase 3a could not run
    attempted: [<suite>, ...]
    unresolvable: true|false
  ac_coverage:
    - ac: <AC text>
      status: covered|gap
      test: <file:line>           # present when covered
```

---

## Reviewer

```yaml
reviewer:
  round: 1
  verdict: approve|request_changes|block
  ready_to_push: true|false
  findings:
    - id: R<n>
      severity: critical|major|minor
      rubric: srp|ocp|lsp|isp|dip|dry|kiss|yagni|naming|function_size|comments|clean_arch|data_protection|assertion_integrity|completeness   # use the project's regime tag for data_protection where one applies (e.g. hipaa)
      file: <path>
      line: <number>
      issue: <caveman ultra>
      suggestion: <caveman ultra>
```

---

## Resolver

```yaml
resolver:
  round: 1
  verdict: resolved|partial|rejected
  resolutions:
    - concern_id: R<n>|T<scenario>   # maps to Reviewer finding id or Tester failing scenario
      action: fix-in-app|fix-in-test|refactor|reject-with-rationale
      file: <path>
      line: <number>
      summary: <caveman ultra>
  diff_summary:
    files_changed: [<path>, ...]
    tests_changed: [<path>, ...]
  pushback:
    - concern_id: R<n>
      reason: <caveman ultra>     # why Resolver declined; parent escalates if Reviewer disagrees
  regression_risk: <