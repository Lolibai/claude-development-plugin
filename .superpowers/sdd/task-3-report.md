# Task 3 Implementation Report

## What was implemented

Layer 2 host-agnostic file sweep for the loop-stack plugin's `onboard` skill. Added workflow parsing, CI host detection, and deploy platform file detection to the observation phase.

### Files modified

1. **plugins/loop-stack/skills/onboard/onboard.mjs**
   - Added `observeFiles(o)` function after `observeGh` (lines 174-190)
   - Added call to `observeFiles(o)` in `observe()` function after `observeGh` call (line 180)
   - Updated `defaultsFrom` ci line to include `deployPlatforms: (p.ci && p.ci.deployPlatforms) || []` (line 246)
   - Added `renderMd` line to display deploy platforms: `L.push("- Deploy platforms: " + list(c.ci.deployPlatforms));` (line 359)

2. **plugins/loop-stack/skills/onboard/stack.example.md**
   - Added deploy platforms example line after deploy workflows: `- Deploy platforms: docker, supabase` (line 57)

## Verification commands and output

### Test 1: Repo-root detection
```bash
$ node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . 2>&1 | tail -21
Observed (value [source]):
  ...
  ciHost = "github-actions"  [files]
  deployWorkflows = [unobserved]
  deployPlatforms = [unobserved]
  ...
```
✓ Correctly detected: `ciHost = "github-actions"  [files]`, both `deployWorkflows` and `deployPlatforms` are `[unobserved]` since this repo has no matching deploy workflow files or platform config files.

### Test 2: Synthetic workflow parser test
```bash
$ D=$(mktemp -d) && mkdir -p $D/.github/workflows && printf 'on:\n  push:\n    branches: [develop]\n' > $D/.github/workflows/deploy-backend-dev.yml && printf 'on:\n  push:\n    branches:\n      - staging\n' > $D/.github/workflows/deploy-stage.yml && touch $D/vercel.json $D/Dockerfile && cd $D && git init -q && node /Users/mykhailoshevchenko/Documents/lolibai/claude-development-plugin/plugins/loop-stack/skills/onboard/onboard.mjs --detect-only 2>&1 | tail -21
Observed (value [source]):
  ...
  ciHost = "github-actions"  [files]
  deployWorkflows = {"dev":["deploy-backend-dev.yml"],"stage":["deploy-stage.yml"]}  [files]
  deployPlatforms = ["vercel","docker"]  [files]
  envBranches = {"dev":"develop","stage":"staging"}  [files]
  ...
```
✓ Correctly parsed: 
- `deployWorkflows = {"dev":["deploy-backend-dev.yml"],"stage":["deploy-stage.yml"]}  [files]`
- `envBranches = {"dev":"develop","stage":"staging"}  [files]`
- `deployPlatforms = ["vercel","docker"]  [files]`

Both tests exit 0 and produce the expected values.

## Self-review checklist

- [x] Exact transcription: All keys `ciHost`, `deployWorkflows`, `envBranches`, `deployPlatforms` with source `files` ✓
- [x] `observeFiles` function correctly implements workflow file scanning, environment detection, and platform detection ✓
- [x] `observe()` calls `observeFiles(o)` after `observeGh` call (rank semantics: equal rank 2 allows later calls to override) ✓
- [x] `defaultsFrom` ci line includes `deployPlatforms: (p.ci && p.ci.deployPlatforms) || []` ✓
- [x] `renderMd` prints `- Deploy platforms: ` via the existing `list()` helper ✓
- [x] Synthetic test produced exact expected values ✓
- [x] Both test runs exit 0 ✓
- [x] Commit message matches brief: `feat(onboard): host-agnostic file sweep (workflow env->branch map, CI host, deploy platforms)` ✓

## Issues or concerns

None. All verification tests pass, exact implementation matches the brief, and no edge cases or silent failures observed.

## Commit

SHA: `aa75dd6`
Subject: `feat(onboard): host-agnostic file sweep (workflow env->branch map, CI host, deploy platforms)`

## Fix: push-scoped branches regex

### Verification commands

**Test 1: Synthetic workflow with pull_request before push**
```bash
$ D=$(mktemp -d) && mkdir -p $D/.github/workflows && printf 'on:\n  push:\n    branches: [develop]\n' > $D/.github/workflows/deploy-backend-dev.yml && printf 'on:\n  push:\n    branches:\n      - staging\n' > $D/.github/workflows/deploy-stage.yml && printf 'on:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [production]\n' > $D/.github/workflows/deploy-prod.yml && touch $D/vercel.json $D/Dockerfile && cd $D && git init -q && node /Users/mykhailoshevchenko/Documents/lolibai/claude-development-plugin/plugins/loop-stack/skills/onboard/onboard.mjs --detect-only | grep -E "deployWorkflows|envBranches|deployPlatforms"
```

**Output:**
```
    "deployWorkflows": [
  envBranches = {"dev":"develop","prod":"production","stage":"staging"}  [files]
  deployWorkflows = {"dev":["deploy-backend-dev.yml"],"prod":["deploy-prod.yml"],"stage":["deploy-stage.yml"]}  [files]
  deployPlatforms = ["vercel","docker"]  [files]
```

✓ **PASS**: `envBranches` correctly shows `"prod":"production"` (NOT "main" from pull_request trigger).

**Test 2: Plugin repo self-test**
```bash
$ node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root /Users/mykhailoshevchenko/Documents/lolibai/claude-development-plugin >/dev/null && echo ok
```

**Output:**
```
ok
```

✓ **PASS**: Plugin tool runs without error on the plugin repo itself.

### Summary

Both verification tests confirm the fix successfully scopes the branches extraction to the `push:` trigger block. When a workflow has both `pull_request` and `push` triggers with different branches, the tool now correctly extracts branches from `push:` only.

## Fix 2: indentation-scoped push block

Replaced the push-block extraction regex to respect indentation boundaries, preventing sibling triggers at the same level (e.g., `pull_request_target`) from being incorrectly captured as part of the `push:` block.

**Change:** Line 182-183 in `plugins/loop-stack/skills/onboard/onboard.mjs`

Replaced:
```js
    const pushBlock = (txt.match(/(?:^|\n)\s*push:\s*\n((?:[ \t]+.*\n?)*)/) || [])[1] || "";
```

With:
```js
    const pm = txt.match(/(?:^|\n)([ \t]*)push:[ \t]*\n((?:\1[ \t]+.*\n?|[ \t]*\n)*)/);
    const pushBlock = pm ? pm[2] : "";
```

The new regex captures `push:`'s indentation in group 1 (`\1`), then only matches lines that are:
- Indented strictly deeper than `push:` (continuing the block)
- Blank lines (allowed in YAML blocks)
- Stops when encountering a line at equal or lesser indentation (sibling trigger)

### Verification commands

**Test 1: Complex workflow with push and pull_request_target**
```bash
$ D=$(mktemp -d) && mkdir -p $D/.github/workflows && \
  printf 'on:\n  push:\n    branches: [develop]\n' > $D/.github/workflows/deploy-backend-dev.yml && \
  printf 'on:\n  push:\n    branches:\n      - staging\n' > $D/.github/workflows/deploy-stage.yml && \
  printf 'on:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [production]\n' > $D/.github/workflows/deploy-prod.yml && \
  printf 'on:\n  push:\n    tags: ["v*"]\n  pull_request_target:\n    branches: [main]\njobs:\n  x:\n    runs-on: ubuntu\n' > $D/.github/workflows/deploy-tags.yml && \
  touch $D/vercel.json $D/Dockerfile && \
  cd $D && git init -q && node /Users/mykhailoshevchenko/Documents/lolibai/claude-development-plugin/plugins/loop-stack/skills/onboard/onboard.mjs --detect-only | grep -E "deployWorkflows|envBranches|deployPlatforms"
```

**Output:**
```
    "deployWorkflows": [
  envBranches = {"dev":"develop","prod":"production","stage":"staging"}  [files]
  deployWorkflows = {"dev":["deploy-backend-dev.yml"],"prod":["deploy-prod.yml"],"stage":["deploy-stage.yml"],"default":["deploy-tags.yml"]}  [files]
  deployPlatforms = ["vercel","docker"]  [files]
```

✓ **PASS**: 
- `envBranches = {"dev":"develop","prod":"production","stage":"staging"}` — correctly excludes "main" from `pull_request_target`
- `deployWorkflows` correctly places `deploy-tags.yml` in `"default"` (no push branches, only tags)
- "main" does NOT appear in the output (critical: confirms `pull_request_target` was not captured into push block)

**Test 2: Plugin repo self-test**
```bash
$ node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root /Users/mykhailoshevchenko/Documents/lolibai/claude-development-plugin >/dev/null && echo ok
```

**Output:**
```
ok
```

✓ **PASS**: Plugin tool runs without error on the plugin repo itself.

### Summary

The indentation-scoped regex fix prevents sibling YAML triggers from contaminating the `push:` block capture. Test case with `deploy-tags.yml` demonstrates the fix: the workflow has both `push: {tags: ["v*"]}` and `pull_request_target: {branches: [main]}` at the same indentation level. The old regex would incorrectly capture `branches: [main]` into the push block; the new regex correctly stops at the sibling `pull_request_target:` line due to equal indentation.
