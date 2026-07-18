# Onboard Live Observation + Re-runnable Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `onboard` skill observe the project's real PR system and deployment system (layered: git → gh → files → session history) and make re-runs merge observations with existing config `/init`-style instead of guessing.

**Architecture:** All observation lives in a new `observe()` phase in `plugins/loop-stack/skills/onboard/onboard.mjs`, producing an `observed` object of `{ key: { value, source } }` entries. A `mergeObserved()` engine three-way-merges observed values into the config against the previous `stack.json` (fill gaps / keep agreements / surface conflicts). `SKILL.md` gains the Claude gap-fill layer and drops the "one-time" framing. Spec: `docs/superpowers/specs/2026-07-18-onboarding-observation-design.md`.

**Tech Stack:** Node built-ins only (`fs`, `path`, `readline`, `child_process`). No dependencies, no test framework — the script stays a zero-dependency single file; verification is running the script against real repos.

## Global Constraints

- `onboard.mjs` must remain a single ES-module file using **Node built-ins only** — no npm dependencies, no test harness.
- Every external command goes through the existing `tryExec` helper (returns `""` on any failure). **Observation must never throw or make the script exit non-zero** — missing `gh`, no remote, detached HEAD, empty repo, unparsable transcript lines all degrade silently.
- Nothing may assume GitHub: each layer that finds nothing yields to the next; fields nobody could observe are reported as `unobserved`.
- Session-history values are hints: they fill empty fields but **never raise conflicts** against explicitly set config values.
- Idempotence (already in the script — do not break): loop specs copied only if absent, `CLAUDE.md` never clobbered, `.gitignore` append-once.
- Match the file's existing style: terse, compact helpers, `const` arrow functions, no comments except section headers.
- Version bump to 1.2.0 happens **only** in Task 6.
- Run all verification commands from the repo root `/Users/mykhailoshevchenko/Documents/lolibai/claude-development-plugin`.

---

### Task 1: Observation scaffolding + Layer 0 (pure git)

**Files:**
- Modify: `plugins/loop-stack/skills/onboard/onboard.mjs` (insert after the `detectCi()` function, before `function detect()`; also touch the `// ---------- main ----------` block)

**Interfaces:**
- Produces: `setObs(obs, key, value, source)` — records an observation unless `value` is empty or an equal-or-stronger source already set that key (later equal-rank layers win; weaker never override). `RANK = { gh: 3, glab: 3, git: 2, files: 2, sessions: 1 }`.
- Produces: `observe(detected)` → `obs` object `{ key: { value, source } }`; Tasks 2–4 add layers inside it.
- Produces: `OBS_FIELDS` (array of known observation keys) and `renderObservedReport(obs)` → string; unknown-to-this-run keys print `[unobserved]`.
- Produces: `observeGit(obs)` setting keys `integrationBranch`, `mergeStyle`, `envBranches`, `branchNaming` with source `git`.

- [ ] **Step 1: Add the observation section to onboard.mjs**

Insert after `detectCi()`:

```js
// ---------- observation ----------
const RANK = { gh: 3, glab: 3, git: 2, files: 2, sessions: 1 };
const OBS_FIELDS = ["integrationBranch", "mergeStyle", "branchNaming", "envBranches", "reviewers", "mergeMethods", "branchProtected", "environments", "humanGatedEnvs", "ciHost", "deployWorkflows", "deployPlatforms", "recentWorkflows", "cmdTest", "cmdBuild", "cmdLint", "cmdTypecheck", "migrateCmd", "localRestart"];
const obsEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
const setObs = (o, key, value, source) => {
  if (obsEmpty(value)) return;
  if (o[key] && RANK[o[key].source] > RANK[source]) return;
  o[key] = { value, source };
};

function observeGit(o) {
  const head = (tryExec("git remote show origin").match(/HEAD branch:\s*(\S+)/) || [])[1];
  if (head && head !== "(unknown)") setObs(o, "integrationBranch", head, "git");
  const ref = head ? "origin/" + head : (tryExec("git symbolic-ref --short HEAD") || "HEAD");
  const total = Number(tryExec("git rev-list --count --first-parent --max-count=200 " + ref)) || 0;
  const merges = Number(tryExec("git rev-list --count --merges --first-parent --max-count=200 " + ref)) || 0;
  if (total >= 10) setObs(o, "mergeStyle", merges / total > 0.3 ? "merge" : "squash", "git");
  const remote = tryExec('git branch -r --format="%(refname:short)"').split("\n").map((b) => b.replace(/^origin\//, "").trim()).filter((b) => b && !b.includes("HEAD"));
  const ENV = { develop: "dev", dev: "dev", staging: "stage", stage: "stage", production: "prod", prod: "prod" };
  const envB = {};
  for (const b of remote) if (ENV[b] && b !== head) envB[ENV[b]] = b;
  setObs(o, "envBranches", envB, "git");
  const prefixes = {};
  for (const b of remote) { const p = b.match(/^([a-z]+)\//); if (p) prefixes[p[1]] = (prefixes[p[1]] || 0) + 1; }
  const top = Object.entries(prefixes).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3) {
    const sample = remote.filter((b) => b.startsWith(top[0] + "/"));
    const keyLike = sample.filter((b) => /\/[A-Z]+-\d+/.test(b)).length > sample.length / 2;
    setObs(o, "branchNaming", keyLike ? "<type>/<KEY>" : "<type>/<slug>", "git");
  }
}

function observe(d) {
  const o = {};
  observeGit(o);
  return o;
}

function renderObservedReport(o) {
  const L = ["Observed (value [source]):"];
  for (const k of OBS_FIELDS) L.push("  " + k + " = " + (o[k] ? JSON.stringify(o[k].value) + "  [" + o[k].source + "]" : "[unobserved]"));
  return L.join("\n");
}
```

- [ ] **Step 2: Wire observation into main + `--detect-only`**

In the `// ---------- main ----------` block, replace:

```js
const detected = detect();

if (DETECT_ONLY) {
  console.log(JSON.stringify(detected, null, 2));
  process.exit(0);
}
```

with:

```js
const detected = detect();
const observed = observe(detected);

if (DETECT_ONLY) {
  console.log(JSON.stringify(detected, null, 2));
  console.log("\n" + renderObservedReport(observed));
  process.exit(0);
}
```

- [ ] **Step 3: Verify against this repo**

Run: `node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . | tail -21`
Expected: the `Observed` report prints all 19 `OBS_FIELDS`; `integrationBranch = "main"  [git]` (from remote HEAD, even though other branches may be checked out); `mergeStyle` shows `"merge"` or `"squash"` with `[git]`; keys from later layers (`mergeMethods`, `deployPlatforms`, `cmdTest`, …) all show `[unobserved]`. Exit code 0.

- [ ] **Step 4: Verify degradation without a remote**

Run: `cd "$(mktemp -d)" && git init -q && node /Users/mykhailoshevchenko/Documents/lolibai/claude-development-plugin/plugins/loop-stack/skills/onboard/onboard.mjs --detect-only | tail -3; cd -`
Expected: report prints with everything `[unobserved]` (or only trivial git facts), exit 0, no stack trace.

- [ ] **Step 5: Commit**

```bash
git add plugins/loop-stack/skills/onboard/onboard.mjs
git commit -m "feat(onboard): observation scaffolding + pure-git layer (integration branch, merge style, env branches, branch naming)"
```

---

### Task 2: Layer 1 — host CLI (`gh`)

**Files:**
- Modify: `plugins/loop-stack/skills/onboard/onboard.mjs` (add `observeGh` after `observeGit`; call it from `observe()`)

**Interfaces:**
- Consumes: `setObs`, `tryExec`, `observe(d)` where `d.vcs.repo` is `owner/name` and `d.vcs.host` is `github`/`gitlab`/`other`.
- Produces: `observeGh(obs, repo)` setting `integrationBranch`, `reviewers`, `mergeMethods`, `mergeStyle` (only when exactly one method allowed), `branchProtected`, `environments`, `humanGatedEnvs`, `recentWorkflows` — all source `gh`.
- Scope note: `glab` (GitLab) gets no script layer in v1 — per the spec's non-goals, non-GitHub hosts are covered by the Claude gap-fill layer (Task 6). `RANK` already reserves the `glab` source name for later.

- [ ] **Step 1: Implement observeGh**

Insert after `observeGit`:

```js
function observeGh(o, repo) {
  if (!repo || !tryExec("gh auth status 2>&1 && echo ok")) return;
  let prs = []; try { prs = JSON.parse(tryExec("gh pr list --state merged --limit 30 --json baseRefName,headRefName,reviews")); } catch {}
  if (prs.length) {
    const bases = {};
    for (const p of prs) bases[p.baseRefName] = (bases[p.baseRefName] || 0) + 1;
    setObs(o, "integrationBranch", Object.entries(bases).sort((a, b) => b[1] - a[1])[0][0], "gh");
    const rev = {};
    for (const p of prs) for (const r of p.reviews || []) if (r.author && r.author.login) rev[r.author.login] = (rev[r.author.login] || 0) + 1;
    setObs(o, "reviewers", Object.entries(rev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l), "gh");
  }
  try {
    const s = JSON.parse(tryExec("gh api repos/" + repo + " --jq '{squash:.allow_squash_merge,merge:.allow_merge_commit,rebase:.allow_rebase_merge}'"));
    const methods = Object.entries(s).filter(([, v]) => v).map(([k]) => k);
    setObs(o, "mergeMethods", methods, "gh");
    if (methods.length === 1) setObs(o, "mergeStyle", methods[0], "gh");
  } catch {}
  const ib = o.integrationBranch && o.integrationBranch.value;
  if (ib) {
    const prot = tryExec("gh api repos/" + repo + "/branches/" + ib + " --jq .protected");
    if (prot === "true" || prot === "false") setObs(o, "branchProtected", prot === "true", "gh");
  }
  try {
    const envs = JSON.parse(tryExec("gh api repos/" + repo + "/environments --jq '[.environments[].name]'"));
    setObs(o, "environments", envs, "gh");
  } catch {}
  try {
    const gated = JSON.parse(tryExec("gh api repos/" + repo + "/environments --jq '[.environments[] | select((.protection_rules | length) > 0) | .name]'"));
    setObs(o, "humanGatedEnvs", gated, "gh");
  } catch {}
  try {
    const runs = JSON.parse(tryExec("gh run list --limit 50 --json workflowName"));
    setObs(o, "recentWorkflows", [...new Set(runs.map((r) => r.workflowName).filter(Boolean))], "gh");
  } catch {}
}
```

- [ ] **Step 2: Call it from observe()**

Replace the body of `observe`:

```js
function observe(d) {
  const o = {};
  observeGit(o);
  if (d.vcs.host === "github") observeGh(o, d.vcs.repo);
  return o;
}
```

- [ ] **Step 3: Verify against this repo**

Run: `node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . | tail -21`
Expected: `integrationBranch = "main"  [gh]` (gh outranks git), `mergeMethods` shows this repo's allowed methods `[gh]`, `recentWorkflows` populated if any Actions ran, `branchProtected` true/false `[gh]`. Exit 0.

- [ ] **Step 4: Verify degradation without gh**

Run: `PATH=/usr/bin:/bin node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . | tail -21`
Expected: gh-only fields (`mergeMethods`, `environments`, `reviewers`, …) back to `[unobserved]`; `integrationBranch` falls back to `[git]`. Exit 0.

- [ ] **Step 5: Commit**

```bash
git add plugins/loop-stack/skills/onboard/onboard.mjs
git commit -m "feat(onboard): gh observation layer (merged-PR patterns, merge methods, protection, environments, runs)"
```

---

### Task 3: Layer 2 — host-agnostic file sweep

**Files:**
- Modify: `plugins/loop-stack/skills/onboard/onboard.mjs` (add `observeFiles` after `observeGh`; call from `observe()`; extend `defaultsFrom` ci block and `renderMd` CI section)
- Modify: `plugins/loop-stack/skills/onboard/stack.example.md` (CI/deploy section)

**Interfaces:**
- Consumes: `setObs`, `exists`, `ROOT`, `fs`, `path`.
- Produces: `observeFiles(obs)` setting `ciHost`, `deployWorkflows` (env → workflow-file list, key `default` when no env inferred), `envBranches` (from workflow push triggers; same rank as git so this later call wins per key), `deployPlatforms` (string list) — all source `files`.
- Produces: config field `ci.deployPlatforms` (array, default `[]`) rendered in `stack.md` as `- Deploy platforms: …`.

- [ ] **Step 1: Implement observeFiles**

Insert after `observeGh`:

```js
function observeFiles(o) {
  let wfs = []; try { wfs = fs.readdirSync(path.resolve(ROOT, ".github/workflows")).filter((f) => /\.ya?ml$/.test(f)); } catch {}
  const envOf = (s) => (/prod/i.test(s) ? "prod" : /stag/i.test(s) ? "stage" : /dev/i.test(s) ? "dev" : "");
  const BR_ENV = { develop: "dev", dev: "dev", staging: "stage", stage: "stage", production: "prod", prod: "prod" };
  const wfByEnv = {}, envB = {};
  for (const f of wfs) {
    if (!/deploy|release|publish/i.test(f)) continue;
    let txt = ""; try { txt = fs.readFileSync(path.resolve(ROOT, ".github/workflows", f), "utf8"); } catch {}
    const bm = txt.match(/branches:\s*(?:\[([^\]]*)\]|((?:\n\s*-\s*.+)+))/);
    const branches = bm ? (bm[1] !== undefined ? bm[1].split(",") : bm[2].split("\n").map((l) => l.replace(/\s*-\s*/, ""))).map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean) : [];
    const env = envOf(f) || (branches[0] ? BR_ENV[branches[0]] || "" : "");
    (wfByEnv[env || "default"] = wfByEnv[env || "default"] || []).push(f);
    if (env && branches[0]) envB[env] = branches[0];
  }
  setObs(o, "deployWorkflows", wfByEnv, "files");
  setObs(o, "envBranches", envB, "files");
  if (wfs.length) setObs(o, "ciHost", "github-actions", "files");
  else if (exists(".gitlab-ci.yml")) setObs(o, "ciHost", "gitlab-ci", "files");
  else if (exists("bitbucket-pipelines.yml")) setObs(o, "ciHost", "bitbucket-pipelines", "files");
  const PLATFORMS = [["vercel", "vercel.json"], ["netlify", "netlify.toml"], ["fly", "fly.toml"], ["render", "render.yaml"], ["heroku", "Procfile"], ["docker", "Dockerfile"], ["docker", "compose.yaml"], ["docker", "docker-compose.yml"], ["serverless", "serverless.yml"], ["supabase", "supabase/config.toml"], ["supabase", "backend/supabase/config.toml"], ["gae", "app.yaml"], ["cloudflare", "wrangler.toml"]];
  setObs(o, "deployPlatforms", [...new Set(PLATFORMS.filter(([, p]) => exists(p)).map(([n]) => n))], "files");
}
```

And in `observe()` add `observeFiles(o);` after the `observeGh` call.

Note on rank semantics: `envBranches` may already be set by git (rank 2); `files` is also rank 2 and `setObs` lets equal rank override, so the workflow-trigger mapping (more authoritative) wins. This is intentional — do not reorder the calls.

- [ ] **Step 2: Add ci.deployPlatforms to config + rendering**

In `defaultsFrom`, replace the `ci:` line with:

```js
    ci: { host: d.ci.host, deployWorkflows: (p.ci && p.ci.deployWorkflows) || { default: d.ci.deployWorkflows }, deployPlatforms: (p.ci && p.ci.deployPlatforms) || [], deployGate: (p.ci && typeof p.ci.deployGate === "boolean") ? p.ci.deployGate : false, humanGatedEnvs: (p.ci && p.ci.humanGatedEnvs) || ["prod"] },
```

In `renderMd`, after the `Deploy workflows:` line add:

```js
  L.push("- Deploy platforms: " + list(c.ci.deployPlatforms));
```

In `stack.example.md`, after the `- Deploy workflows: …` line add:

```markdown
- Deploy platforms: docker, supabase
```

- [ ] **Step 3: Verify**

Run: `node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . | tail -21`
Expected: `ciHost = "github-actions"  [files]` (this repo has `.github/workflows/`), `deployWorkflows` and `deployPlatforms` observed (likely `{}`-suppressed → `[unobserved]` here since this repo has no deploy workflows or platform files — that is correct).

Then verify the workflow parser on a synthetic case:

```bash
D=$(mktemp -d) && mkdir -p $D/.github/workflows && printf 'on:\n  push:\n    branches: [develop]\n' > $D/.github/workflows/deploy-backend-dev.yml && printf 'on:\n  push:\n    branches:\n      - staging\n' > $D/.github/workflows/deploy-stage.yml && touch $D/vercel.json $D/Dockerfile && cd $D && git init -q && node /Users/mykhailoshevchenko/Documents/lolibai/claude-development-plugin/plugins/loop-stack/skills/onboard/onboard.mjs --detect-only | tail -21; cd -
```

Expected: `deployWorkflows = {"dev":["deploy-backend-dev.yml"],"stage":["deploy-stage.yml"]}  [files]`, `envBranches = {"dev":"develop","stage":"staging"}  [files]`, `deployPlatforms = ["vercel","docker"]  [files]`.

- [ ] **Step 4: Commit**

```bash
git add plugins/loop-stack/skills/onboard/onboard.mjs plugins/loop-stack/skills/onboard/stack.example.md
git commit -m "feat(onboard): host-agnostic file sweep (workflow env->branch map, CI host, deploy platforms)"
```

---

### Task 4: Layer 2.5 — session-history command mining

**Files:**
- Modify: `plugins/loop-stack/skills/onboard/onboard.mjs` (add `observeSessions` after `observeFiles`; call from `observe()` last)

**Interfaces:**
- Consumes: `setObs`; transcripts at `~/.claude/projects/<encoded>/*.jsonl` where `<encoded>` is the absolute project path with every `/` and `.` replaced by `-`.
- Produces: `observeSessions(obs)` setting `cmdTest`, `cmdBuild`, `cmdLint`, `cmdTypecheck`, `migrateCmd`, `localRestart`, and (from `gh pr merge` flags) `mergeStyle` — all source `sessions`.

- [ ] **Step 1: Implement observeSessions**

Insert after `observeFiles`:

```js
function observeSessions(o) {
  const dir = path.join(process.env.HOME || "", ".claude", "projects", ROOT.replace(/[/.]/g, "-"));
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
      .map((f) => { const p = path.join(dir, f); const st = fs.statSync(p); return { p, m: st.mtimeMs, size: st.size }; })
      .filter((f) => f.size < 25 * 1024 * 1024).sort((a, b) => b.m - a.m).slice(0, 20);
  } catch { return; }
  const freq = {};
  for (const { p } of files) {
    let txt = ""; try { txt = fs.readFileSync(p, "utf8"); } catch { continue; }
    for (const line of txt.split("\n")) {
      if (!line.includes('"Bash"')) continue;
      try {
        for (const c of ((JSON.parse(line).message || {}).content || [])) {
          if (c && c.type === "tool_use" && c.name === "Bash" && typeof (c.input || {}).command === "string" && c.input.command.length < 500) {
            const cmd = c.input.command.trim();
            freq[cmd] = (freq[cmd] || 0) + 1;
          }
        }
      } catch {}
    }
  }
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const pick = (re) => ranked.find((c) => re.test(c) && !c.includes("&&") && !c.includes("|")) || "";
  setObs(o, "cmdTest", pick(/^(pnpm|yarn|bun run|npm run|npx)\s+(run\s+)?(test|vitest|jest)\b/), "sessions");
  setObs(o, "cmdBuild", pick(/^(pnpm|yarn|bun run|npm run)\s+(run\s+)?build\b/), "sessions");
  setObs(o, "cmdLint", pick(/^(pnpm|yarn|bun run|npm run|npx)\s+(run\s+)?(lint|eslint)\b/), "sessions");
  setObs(o, "cmdTypecheck", pick(/^(pnpm|yarn|bun run|npm run|npx)\s+(run\s+)?(typecheck|tsc)\b/), "sessions");
  setObs(o, "migrateCmd", pick(/^(supabase db push|npx prisma migrate|pnpm .*migrate|npm run .*migrate)/), "sessions");
  setObs(o, "localRestart", pick(/^(supabase stop|docker compose (up|down|restart))/), "sessions");
  const merge = ranked.find((c) => /^gh pr merge\b/.test(c));
  if (merge) { const m = merge.match(/--(squash|merge|rebase)\b/); if (m) setObs(o, "mergeStyle", m[1], "sessions"); }
}
```

And in `observe()` add `observeSessions(o);` as the last call.

- [ ] **Step 2: Verify on this machine**

Run: `node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . | tail -21`
Expected: exit 0. On this machine transcripts exist for this repo; any `cmd*` field that matched shows `[sessions]` (it is fine if none matched — this repo's sessions are mostly git/gh commands). Confirm `mergeStyle` still shows `[gh]` or `[git]`, NOT `[sessions]` (rank 1 must not override rank 2/3).

- [ ] **Step 3: Verify degradation with no transcripts and a corrupt line**

```bash
H=$(mktemp -d) && HOME=$H node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . | tail -3
mkdir -p $H/.claude/projects/$(pwd | tr '/.' '--') && echo 'not json "Bash"' > $H/.claude/projects/$(pwd | tr '/.' '--')/x.jsonl && HOME=$H node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . | tail -3
```

Expected: both runs exit 0; no crash on the invalid JSONL line.

- [ ] **Step 4: Commit**

```bash
git add plugins/loop-stack/skills/onboard/onboard.mjs
git commit -m "feat(onboard): mine recent session transcripts for real commands (hints layer)"
```

---

### Task 5: Merge engine — fill / keep / conflict, `/init`-style re-runs

**Files:**
- Modify: `plugins/loop-stack/skills/onboard/onboard.mjs` (add `OBS_MAP`, `mergeObserved` after `renderObservedReport`; change `prompt` signature; rewrite the top of the main block)

**Interfaces:**
- Consumes: `observed` object from Tasks 1–4; `defaultsFrom(detected, prev)`; `prompt(cfg)`.
- Produces: `mergeObserved(cfg, obs, prev)` → `{ filled: [{path, value, source}], conflicts: [{pathArr, path, current, observed, source}] }`, mutating `cfg` for fills only. `prompt(cfg, conflicts)` resolves conflicts interactively first. `cfg._observed = { at: ISO, ...obs }` persisted in `stack.json` (not rendered in `stack.md`).

- [ ] **Step 1: Implement the merge engine**

Insert after `renderObservedReport`:

```js
const OBS_MAP = [
  ["integrationBranch", ["vcs", "integrationBranch"]],
  ["mergeStyle", ["vcs", "autoMerge"]],
  ["branchNaming", ["vcs", "branchNaming"]],
  ["envBranches", ["vcs", "envBranches"]],
  ["ciHost", ["ci", "host"]],
  ["deployWorkflows", ["ci", "deployWorkflows"]],
  ["humanGatedEnvs", ["ci", "humanGatedEnvs"]],
  ["deployPlatforms", ["ci", "deployPlatforms"]],
  ["cmdTest", ["commands", "test"]],
  ["cmdBuild", ["commands", "build"]],
  ["cmdLint", ["commands", "lint"]],
  ["cmdTypecheck", ["commands", "typecheck"]],
  ["migrateCmd", ["backend", "migrateCmd"]],
  ["localRestart", ["edge", "localRestart"]],
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cfgEmpty = (v) => obsEmpty(v) || v === "none";

function mergeObserved(cfg, obs, prev) {
  const filled = [], conflicts = [];
  for (const [key, pathArr] of OBS_MAP) {
    const ob = obs[key];
    if (!ob) continue;
    const parent = pathArr.slice(0, -1).reduce((n, k) => n[k], cfg);
    const leaf = pathArr[pathArr.length - 1];
    const prevVal = prev ? pathArr.reduce((n, k) => (n ? n[k] : undefined), prev) : undefined;
    if (cfgEmpty(prevVal)) {
      if (!same(parent[leaf], ob.value)) { parent[leaf] = ob.value; filled.push({ path: pathArr.join("."), value: ob.value, source: ob.source }); }
    } else if (!same(prevVal, ob.value)) {
      if (ob.source === "sessions") continue;
      conflicts.push({ pathArr, path: pathArr.join("."), current: prevVal, observed: ob.value, source: ob.source });
    }
  }
  return { filled, conflicts };
}
```

Deliberate semantics: on a **first run** (`prev` null) every observation lands as a fill; on a **re-run**, a field the config already sets non-empty only changes via the conflict flow. `mergeStyle` sourced from sessions can fill but never conflict (Global Constraints).

- [ ] **Step 2: Conflict resolution in prompt() + non-interactive warnings**

Change the `prompt` signature to `async function prompt(cfg, conflicts)` and insert right after the `console.log("\n- Project stack onboarding - ...")` line:

```js
  for (const c of conflicts) {
    const a = await ask("Conflict " + c.path + ": observed " + JSON.stringify(c.observed) + " [" + c.source + "], config has " + JSON.stringify(c.current) + " - keep config (Enter) / take observed (o)", "");
    if (/^o/i.test(a)) { const parent = c.pathArr.slice(0, -1).reduce((n, k) => n[k], cfg); parent[c.pathArr[c.pathArr.length - 1]] = c.observed; }
  }
```

- [ ] **Step 3: Rewire the main block**

Replace:

```js
const prev = readJSON(path.resolve(OUT, "stack.json"));
let cfg = defaultsFrom(detected, prev);
if (!NON_INTERACTIVE) cfg = await prompt(cfg);
```

with:

```js
const prev = readJSON(path.resolve(OUT, "stack.json"));
let cfg = defaultsFrom(detected, prev);
const { filled, conflicts } = mergeObserved(cfg, observed, prev);
for (const f of filled) console.log("  observed " + f.path + " = " + JSON.stringify(f.value) + " [" + f.source + "]");
if (!NON_INTERACTIVE) cfg = await prompt(cfg, conflicts);
else for (const c of conflicts) console.log("  ! " + c.path + ": config keeps " + JSON.stringify(c.current) + " (observed " + JSON.stringify(c.observed) + " [" + c.source + "])");
delete cfg._observed;
cfg._observed = { at: new Date().toISOString(), ...observed };
```

(`defaultsFrom` copies `prev` fields explicitly so `_observed` never round-trips into user-facing sections; the delete guards against a future spread.)

- [ ] **Step 4: Verify first run, re-run idempotence, and conflict flow**

```bash
O=$(mktemp -d)
node plugins/loop-stack/skills/onboard/onboard.mjs --non-interactive --root . --out $O
grep -A2 '"vcs"' $O/stack.json | head -5        # integrationBranch "main" (observed, not current branch)
node plugins/loop-stack/skills/onboard/onboard.mjs --non-interactive --root . --out $O   # re-run: no "!" warnings
node -e "const f='$O/stack.json',j=JSON.parse(require('fs').readFileSync(f));j.vcs.autoMerge='rebase';require('fs').writeFileSync(f,JSON.stringify(j,null,2))"
node plugins/loop-stack/skills/onboard/onboard.mjs --non-interactive --root . --out $O | grep '!'
grep '"autoMerge"' $O/stack.json
```

Expected: first run prints `observed vcs.integrationBranch = "main" [gh]` (or `[git]`) lines; second run prints no `!` lines (agreement is silent); after hand-editing `autoMerge` to `rebase`, the third run prints `! vcs.autoMerge: config keeps "rebase" (observed ...)` and the file still contains `"rebase"`. `stack.json` contains an `_observed` object with `at`; `stack.md` does not mention `_observed`.

Also run the interactive path once: `node plugins/loop-stack/skills/onboard/onboard.mjs --root . --out $O`. The first prompt must be the `Conflict vcs.autoMerge: ... keep config (Enter) / take observed (o)` question. Answer `o`, then press Enter through every remaining prompt so the script writes its output (Ctrl-C would abort before the write). Then `grep '"autoMerge"' $O/stack.json` — it must now show the observed value, not `rebase`.

- [ ] **Step 5: Commit**

```bash
git add plugins/loop-stack/skills/onboard/onboard.mjs
git commit -m "feat(onboard): three-way merge of observations vs config; /init-style re-runs with conflict prompts"
```

---

### Task 6: SKILL.md rewrite, docs, version bump

**Files:**
- Modify: `plugins/loop-stack/skills/onboard/SKILL.md` (frontmatter description + body)
- Modify: `plugins/loop-stack/skills/onboard/onboard.mjs:2` (header comment)
- Modify: `plugins/loop-stack/.claude-plugin/plugin.json` (version + description)
- Modify: `.claude-plugin/marketplace.json` (loop-stack version)
- Modify: `plugins/loop-stack/MANIFEST.md:5`, `plugins/loop-stack/CONVENTIONS.md:4` ("written once" phrasing)

**Interfaces:**
- Consumes: the observation report format `key = value  [source]` / `[unobserved]` from Task 1.

- [ ] **Step 1: Update SKILL.md**

Replace the frontmatter `description:` with:

```yaml
description: Per-project setup for the loop stack — run at setup and re-run any time, like /init. Observes the project's real PR system and deployment system (git history, gh, workflow files, past session commands) plus the rest of the stack (issue tracker, package manager, frameworks, backend/DB, edge, tests) and writes .claude/stack.md — the single config every other skill, agent, command, and loop reads. Re-runs merge fresh observations with the existing config and surface conflicts. Use when bringing the loop stack to a new project, when the user says "onboard this project", "re-run onboarding", "refresh the stack config", "re-onboard", or when a skill reports that .claude/stack.md is missing.
```

In the body: change the `## Purpose` first sentence from "Run this **once** in a project" to "Run this at setup and **re-run any time** — like `/init`, re-running refreshes observations and merges them with your config (conflicts are prompted, never clobbered)."

Add to `## How to run` after item 2:

```markdown
3. **Gap-fill what the script couldn't observe.** The run prints an observation report
   (`key = value [source]` / `[unobserved]`). For each `unobserved` PR or deploy field
   (e.g. non-GitHub host, no CLI auth), observe it yourself with whatever tools exist
   (host CLI, API, asking the user) and write the value into `.claude/stack.md` +
   `.claude/stack.json` like any other answer.
4. **PR + deploy sections must not end up empty.** Every project has a PR system and a
   deployment system. Do not finish onboarding with those sections `none`/`—` unless
   the user explicitly confirms the project truly lacks one.
```

(Renumber the old item 3 to 5.)

- [ ] **Step 2: Update surrounding docs + script header**

- `onboard.mjs` line 2 comment: replace "one-time, per-project stack onboarding" with "per-project stack onboarding (re-runnable, /init-style)".
- `MANIFEST.md` line 5: "written once by the `onboard` skill" → "written and refreshed by the `onboard` skill".
- `CONVENTIONS.md` line 4: "(generated by the `onboard` skill)" stays; no change if already accurate — check and only edit if it says "once".
- `plugin.json` description: "written once by the onboard skill" → "written and refreshed by the onboard skill (re-runnable, observes your PR + deploy systems)"; version → `1.2.0`.
- `marketplace.json` loop-stack entry: version → `1.2.0` (description there already says "written by the onboard skill" — leave).

- [ ] **Step 3: Verify**

```bash
node -e "['plugins/loop-stack/.claude-plugin/plugin.json','.claude-plugin/marketplace.json'].forEach(f=>JSON.parse(require('fs').readFileSync(f)))" && echo JSON ok
grep -rn "written once" plugins/loop-stack .claude-plugin | wc -l   # expect 0
node plugins/loop-stack/skills/onboard/onboard.mjs --detect-only --root . >/dev/null && echo script ok
```

- [ ] **Step 4: Commit**

```bash
git add plugins/loop-stack/skills/onboard/SKILL.md plugins/loop-stack/skills/onboard/onboard.mjs plugins/loop-stack/MANIFEST.md plugins/loop-stack/CONVENTIONS.md plugins/loop-stack/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "feat(onboard): re-runnable /init-style framing, gap-fill instructions; bump loop-stack to 1.2.0"
```
