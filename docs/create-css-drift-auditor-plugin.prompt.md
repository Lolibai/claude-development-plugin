# Prompt — create the `css-drift-auditor` Claude Code plugin (GitHub-ready)

Paste this entire message into **Claude Code**, running in an **empty directory** where you want the repository to live. It will scaffold a public Claude Code *plugin marketplace* repo containing the `css-drift-auditor` plugin, validate it, and prepare it to push to GitHub.

---

You are scaffolding a public GitHub repository that distributes a Claude Code plugin through a plugin marketplace. A marketplace repo has `.claude-plugin/marketplace.json` at its root listing one or more plugins, each living under `plugins/<name>/`. Follow these steps exactly.

## 1. Target file tree

Create this structure:

```
.
├── .claude-plugin/
│   └── marketplace.json
├── .github/
│   └── workflows/
│       └── validate.yml
├── plugins/
│   └── css-drift-auditor/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── skills/
│       │   └── css-drift-audit/
│       │       └── SKILL.md
│       ├── agents/
│       │   └── drift-fix-agent.md
│       ├── config/
│       │   └── audit.config.json
│       ├── scripts/
│       │   ├── detect-framework.mjs
│       │   ├── project-map.mjs
│       │   ├── generate-stories.mjs
│       │   ├── extract-computed-styles.mjs
│       │   ├── analyze-drift.mjs
│       │   ├── element-map.mjs
│       │   └── parsers/
│       │       ├── shared.mjs
│       │       ├── react.mjs
│       │       └── angular.mjs
│       └── README.md
├── README.md
├── LICENSE
└── .gitignore
```

## 2. Create every file verbatim

Below, each file is delimited by marker lines of the form:

```
===== BEGIN FILE: <path> =====
<exact content>
===== END FILE =====
```

Write each file with the **exact** bytes between its markers. Do not reformat, re-indent, lint, prettify, or "improve" anything — the `.mjs` files contain template literals, regexes, and AST-walking logic that must stay byte-for-byte. Create parent directories as needed.

===== BEGIN FILE: .claude-plugin/marketplace.json =====
{
  "$schema": "https://json.schemastore.org/claude-code-marketplace.json",
  "name": "drift-tools",
  "version": "1.0.0",
  "description": "Tools for auditing and normalizing CSS/design drift across frontend codebases.",
  "owner": {
    "name": "Mykhailo",
    "email": "you@example.com"
  },
  "plugins": [
    {
      "name": "css-drift-auditor",
      "source": "./plugins/css-drift-auditor",
      "description": "Universal, framework-agnostic CSS/design-drift audit pipeline: maps components and raw HTML tags, renders components in Storybook, extracts post-cascade computed styles, and flags inconsistent values for tokenization.",
      "version": "0.3.0",
      "author": { "name": "Mykhailo" },
      "category": "development",
      "keywords": ["css", "design-tokens", "drift", "storybook", "audit", "consistency", "react", "angular"]
    }
  ]
}
===== END FILE =====

===== BEGIN FILE: README.md =====
# drift-tools — Claude Code plugin marketplace

A Claude Code plugin marketplace containing **css-drift-auditor**: a universal, framework-agnostic pipeline for auditing and normalizing CSS/design drift across frontend codebases.

## Install

```bash
# 1. Add this marketplace (replace OWNER/REPO with this repository)
/plugin marketplace add OWNER/REPO

# 2. Install the plugin
/plugin install css-drift-auditor@drift-tools
```

Then, in any project, ask Claude Code to "run a CSS drift audit" — the `css-drift-audit` skill orchestrates the full workflow.

## What's inside

`css-drift-auditor` ([plugin readme](./plugins/css-drift-auditor/README.md)) renders every component in Storybook and reads **post-cascade computed styles** — the real pixel values after Tailwind, theme providers, CSS variables, and inheritance resolve — then clusters them into a token scale and flags low-usage outliers as drift. It also parses source into a mixed html + component tree (React `.tsx`/`.jsx` and Angular `*.component.ts`) to catch raw HTML tags carrying ad-hoc `className`, inline styles, or Tailwind arbitrary values — the elements that bypass the component layer, where drift concentrates. No Figma required.

Per-project prerequisites (Claude Code prompts before installing any of them):
- Storybook (`npx storybook@latest init`)
- Playwright (`npm i -D playwright && npx playwright install chromium`)
- `@babel/parser`, and `parse5` for Angular (`npm i -D @babel/parser parse5`)

## Repository layout

```
.claude-plugin/marketplace.json    # marketplace registry (lists the plugin)
plugins/css-drift-auditor/         # the plugin
.github/workflows/validate.yml     # CI: syntax-checks scripts, validates manifests
```

## License

MIT — see [LICENSE](./LICENSE).
===== END FILE =====

===== BEGIN FILE: LICENSE =====
MIT License

Copyright (c) 2026 Mykhailo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
===== END FILE =====

===== BEGIN FILE: .gitignore =====
node_modules/
design-audit/
storybook-static/
*.log
.DS_Store
.env
.env.*
===== END FILE =====

===== BEGIN FILE: .github/workflows/validate.yml =====
name: validate

on:
  push:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Syntax-check all scripts
        run: |
          for f in $(find plugins -name '*.mjs'); do
            node --check "$f" || { echo "FAIL $f"; exit 1; }
          done

      - name: Validate JSON manifests
        run: |
          node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'))"
          node -e "JSON.parse(require('fs').readFileSync('plugins/css-drift-auditor/.claude-plugin/plugin.json','utf8'))"
          node -e "JSON.parse(require('fs').readFileSync('plugins/css-drift-auditor/config/audit.config.json','utf8'))"
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/.claude-plugin/plugin.json =====
{
  "name": "css-drift-auditor",
  "version": "0.3.0",
  "description": "Universal, framework-agnostic CSS/design-drift audit pipeline. Maps components, renders them in Storybook, extracts post-cascade computed styles, and flags inconsistent design values for systematic normalization into tokens.",
  "author": {
    "name": "Mykhailo"
  },
  "keywords": [
    "css",
    "design-tokens",
    "drift",
    "storybook",
    "audit",
    "consistency"
  ],
  "license": "MIT"
}
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/README.md =====
# css-drift-auditor

Universal, framework-agnostic CSS/design-drift audit pipeline for Claude Code.
It renders every component in Storybook and reads **post-cascade computed
styles** — the real pixel values after Tailwind, theme providers, CSS variables,
and inheritance resolve — then clusters them into a token scale and flags
low-usage outliers as drift. No Figma required. No design source of truth needed;
the codebase *is* the source.

Works on any framework Storybook renders: React, Next.js, Vue, Svelte, Angular.

## Why computed styles

Source-level scanners see `className="text-sm"` and stop. They cannot resolve
what `text-sm` actually is, what the theme injected, or what cascaded in. The
browser already normalizes everything (`#2e2e2e`, `rgb(46,46,46)`, and a theme
var all become `rgb(46, 46, 46)`), so dedup and drift detection are exact.

## Parsers

`element-map.mjs` is an orchestrator that dispatches each file to a framework parser in `scripts/parsers/`, all returning one shared node shape (`{ type: "html" | "component" | "fragment", name, className, inlineStyle, arbitrary, loc, children }`):

| Parser | Files | Engine | Project deps |
|---|---|---|---|
| `parsers/react.mjs` | `.tsx` / `.jsx` | `@babel/parser` (JSX AST) | `@babel/parser` |
| `parsers/angular.mjs` | `*.component.ts` | `@babel/parser` (read `@Component`) + `parse5` (template HTML) | `@babel/parser`, `parse5` |

The Angular parser reads the `@Component` decorator (selector, inline `template` or external `templateUrl`, `styleUrls`), parses the template with parse5 — the HTML5 spec parser, so Angular's `[binding]`, `(event)`, and `*structural` attributes survive — and classifies elements: native tags → html, discovered component selectors and hyphenated custom elements (`app-*`, `mat-*`) → component, `<ng-container>`/`<ng-template>` → fragment. Class/style bindings (`class`, `[ngClass]`, `[class.x]`, `style`, `[style.x]`, `[ngStyle]`) are all folded into `className`/`inlineStyle`, and Tailwind arbitrary values are extracted even out of `[ngClass]` object literals.

Adding Vue or Svelte is a new file in `parsers/` registered in `element-map.mjs`'s `PARSERS` array — no other change.

## Two drift surfaces

Drift lives in two places, and the plugin captures both. `element-map.mjs` parses every JSX file into a tree that keeps the distinction between components and raw HTML tags — because pages are a mix of the two, and raw `<div>`/`<button>`/`<h1>` tags carrying ad-hoc `className`, inline styles, or Tailwind arbitrary values (`bg-[#2e3440]`) are the **source-level** drift surface (`styledHtmlTags`). `extract-computed-styles.mjs` reads the **runtime** surface — the resolved pixel values after the cascade. A value flagged in both is high-confidence drift; a raw tag with an arbitrary value is a prime candidate to tokenize or lift into a component.

## Install

Unzip into your Claude Code plugins directory, or install the `.plugin` file
directly. Then in any project, ask Claude to "run a CSS drift audit" — the
`css-drift-audit` skill orchestrates the phases.

Per-project prerequisites (Claude will prompt before installing):
- Storybook (`npx storybook@latest init`)
- Playwright (`npm i -D playwright && npx playwright install chromium`)

## Scripts (run from project root with bare `node`)

| Script | Purpose | Output |
|---|---|---|
| `detect-framework.mjs --write` | framework + Storybook preset | `design-audit/framework.json` |
| `project-map.mjs` | component catalog + coverage + routes | `design-audit/project-map.json` |
| `element-map.mjs --trees` | mixed html+component tree (React + Angular), flags styled raw tags | `design-audit/element-map.json` |
| `generate-stories.mjs --write` | scaffold stories for uncovered components | `*.stories.*` |
| `extract-computed-styles.mjs` | **render + read computed styles** | `design-audit/computed-tokens.json` |
| `analyze-drift.mjs` | cluster + flag outliers | `design-audit/drift-report.md`, `suggested-tokens.json` |

## Workflow

`detect → ensure Storybook coverage → extract computed styles → analyze drift →
fix (parallel, scoped agents) → verify (per-story visual diff)`.

Each fix agent is scoped to one domain (color / spacing / typography), commits
per domain, and never auto-merges. Values marked `"intentional": true` in
`suggested-tokens.json` are never touched.

## Config

`config/audit.config.json` (copied to `design-audit/audit.config.json` on first
run): which properties to extract, values to ignore, clustering tolerances
(`colorDistance`, `spacingTolerancePx`, `fontSizeTolerancePx`, `driftMaxUsage`).
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/config/audit.config.json =====
{
  "storybook": {
    "url": "http://localhost:6006",
    "staticDir": "storybook-static"
  },
  "extract": {
    "properties": [
      "color", "backgroundColor", "borderColor",
      "fontSize", "fontWeight", "fontFamily", "lineHeight", "letterSpacing",
      "borderRadius", "borderWidth", "boxShadow", "zIndex",
      "padding", "margin", "gap"
    ],
    "ignoreValues": [
      "rgba(0, 0, 0, 0)", "transparent", "none", "normal", "auto",
      "0px", "rgb(0, 0, 0)"
    ],
    "perStoryTimeoutMs": 8000
  },
  "clustering": {
    "colorDistance": 24,
    "spacingTolerancePx": 2,
    "fontSizeTolerancePx": 1,
    "driftMaxUsage": 2
  },
  "output": { "dir": "design-audit" }
}
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/skills/css-drift-audit/SKILL.md =====
---
name: css-drift-audit
description: >
  Systematically audit and normalize CSS/design drift across any frontend
  codebase using Storybook-rendered computed styles. Use when the user wants to
  find inconsistent colors, spacing, typography, or radii; make a design system
  consistent; extract design tokens from existing components; or run a "design
  drift", "CSS audit", or "style consistency" pass. Framework-agnostic — works on
  React, Vue, Svelte, and Angular through Storybook.
---

# CSS drift audit

Audit design-value drift by rendering every component in Storybook and reading
post-cascade computed styles — the ground-truth pixel values after Tailwind,
theme providers, CSS variables, and inheritance resolve. Source-level regex
misses these; computed styles do not. Storybook is the universal surface, so the
same pipeline works for any framework it renders.

All scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts` and run with bare `node`
(no project TypeScript required). Run them from the target project root. Drive
the phases in order and stop at each CHECKPOINT for user review.

## Phase 0 — Detect environment
Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/detect-framework.mjs --write`.
It writes `design-audit/framework.json` (framework, Storybook preset, component
dirs, package manager). Read it before continuing.

## Phase 1 — Map the surface + Storybook coverage
1. Copy `${CLAUDE_PLUGIN_ROOT}/config/audit.config.json` to
   `design-audit/audit.config.json` if absent; let the user tune thresholds.
2. Map the actual element surface — pages are a mix of components AND raw HTML
   tags, and raw tags are where drift hides:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/element-map.mjs`. It auto-dispatches by
   framework via pluggable parsers in `scripts/parsers/` (React `.tsx`/`.jsx`
   and Angular `*.component.ts` ship today; Vue/Svelte are drop-in additions).
   Deps are resolved from the target project: React needs `@babel/parser`,
   Angular needs `@babel/parser` + `parse5`
   (`npm i -D @babel/parser parse5`). Writes `element-map.json` with a per-file
   html+component tree and a `styledHtmlTags` list — raw HTML elements carrying
   className/inline-style/Tailwind-arbitrary values. This is the source-level
   drift surface.
3. If `framework.json.hasStorybook` is false, tell the user Storybook is
   required and offer `npx storybook@latest init`. Do not install without
   confirmation.
4. Catalog components and find coverage gaps:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-map.mjs` then
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/generate-stories.mjs` (dry run).
   Review the list with the user, then re-run with `--write`. Auto-generated
   stories carry a header marker and may fail to render if the component needs
   required props — that is expected; refine those few by hand.

## Phase 2 — Extract computed styles (the core)
1. Start Storybook: `npm run storybook` (background), or build static with
   `npm run build-storybook` and pass `--static storybook-static`.
2. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/extract-computed-styles.mjs`
   (needs Playwright: `npm i -D playwright && npx playwright install chromium`).
3. Output: `design-audit/computed-tokens.json` — every distinct computed value
   per property, with usage counts and owning components.

CHECKPOINT: surface the per-property distinct-value counts before analysis.

## Phase 3 — Analyze drift
Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/analyze-drift.mjs`. Outputs
`design-audit/drift-report.md` (clusters, canonical per cluster, low-usage
outliers flagged) and `design-audit/suggested-tokens.json`
(drift value → canonical → token name).

There are two complementary drift surfaces — cross-reference both: the runtime
surface (`computed-tokens.json`, what the cascade actually produced) and the
source surface (`element-map.json` → `styledHtmlTags` / `arbitrary`, the raw
HTML tags and Tailwind arbitrary values authored directly). A value flagged in
both is high-confidence drift; a raw tag with an arbitrary value is a prime
candidate to either tokenize or lift into a component.

CHECKPOINT: the user reviews drift-report.md and marks any intentional one-offs
as `"intentional": true` in suggested-tokens.json. Never modify intentional
values.

## Phase 4 — Fix (parallel, scoped)
For each domain (color, spacing, typography), spawn the `drift-fix-agent`
scoped to ONE property family. Each agent replaces only its domain's drift
values with the approved token, never touches component logic or other domains,
and commits per domain. Never auto-merge — each commit needs review.

## Phase 5 — Verify
1. Re-run extract-computed-styles → confirm flagged drift values are gone.
2. Run Storybook's test-runner or a Playwright screenshot diff per story to
   catch visual regressions — per-component, not whole-page.
Report a short coverage + regression summary.

## Guardrails
- Cluster on browser-normalized computed values, never on raw source strings.
- One domain per fix agent. Commit per domain. No auto-merge.
- Values marked `"intentional": true` are immutable.
- Confirm before installing Storybook or Playwright into the user's project.
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/agents/drift-fix-agent.md =====
---
name: drift-fix-agent
description: >
  Scoped CSS-drift fixer. Spawn one instance per property domain
  (color | spacing | typography) to apply approved design-token replacements
  from suggested-tokens.json.
  <example>Replace all color drift values with their canonical tokens</example>
  <example>Normalize spacing drift to the --space token scale</example>
tools: Read, Edit, Grep, Bash
---

You replace design-drift values with approved canonical tokens for EXACTLY ONE
domain, named in your spawn prompt (color, spacing, or typography).

Domain → property map:
- color → color, background-color, border-color
- spacing → padding, margin, gap, border-radius, border-width
- typography → font-size, font-weight, line-height, letter-spacing, font-family

Rules:
- Read `design-audit/suggested-tokens.json` and `design-audit/drift-report.md`.
- Act ONLY on entries whose `group` belongs to your assigned domain. Ignore every
  other domain entirely.
- Skip any entry where `"intentional": true`.
- For each drift value, Grep its usages and replace the raw value with the token
  (CSS custom property, or the framework's token mechanism — Tailwind config
  value, theme token, etc.). Touch ONLY the style property — never component
  logic, props, JSX/template structure, or imports.
- When your domain is complete, stage and commit with message
  `fix(design): normalize <domain> to tokens`. Do NOT merge.
- Report: number of replacements, files touched, and anything ambiguous you
  skipped and why.
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/detect-framework.mjs =====
#!/usr/bin/env node
/**
 * detect-framework.mjs — universal entry point.
 * Reads package.json + config files to determine framework, the correct
 * Storybook builder preset, component file extensions, and source dirs.
 * Plain Node ESM — no project TypeScript required.
 *
 *   node detect-framework.mjs            # prints JSON
 *   node detect-framework.mjs --write    # also writes design-audit/framework.json
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const has = (p) => { try { fs.accessSync(path.join(ROOT, p)); return true; } catch { return false; } };

const pkg = readJSON(path.join(ROOT, "package.json")) || {};
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const dep = (n) => Boolean(deps[n]);

let framework = "unknown";
if (dep("next")) framework = "nextjs";
else if (dep("@remix-run/react")) framework = "remix";
else if (dep("@angular/core")) framework = "angular";
else if (dep("svelte") || dep("@sveltejs/kit")) framework = "svelte";
else if (dep("vue") || dep("nuxt")) framework = "vue";
else if (dep("react-scripts")) framework = "cra";
else if (dep("vite") && dep("react")) framework = "vite-react";
else if (dep("react")) framework = "react";

const presetFromDeps = [
  "@storybook/nextjs", "@storybook/react-vite", "@storybook/react-webpack5",
  "@storybook/vue3-vite", "@storybook/sveltekit", "@storybook/svelte-vite",
  "@storybook/angular",
].find(dep);

const recommendedPreset = {
  nextjs: "@storybook/nextjs",
  "vite-react": "@storybook/react-vite",
  cra: "@storybook/react-webpack5",
  react: "@storybook/react-vite",
  vue: "@storybook/vue3-vite",
  svelte: "@storybook/svelte-vite",
  angular: "@storybook/angular",
  remix: "@storybook/react-vite",
}[framework] || null;

const componentExts =
  framework === "vue" ? [".vue", ".tsx", ".jsx"] :
  framework === "svelte" ? [".svelte"] :
  framework === "angular" ? [".component.ts"] :
  [".tsx", ".jsx", ".ts", ".js"];

const result = {
  framework,
  sbPreset: presetFromDeps || recommendedPreset,
  hasStorybook: Object.keys(deps).some((d) => d.startsWith("@storybook/")) || has(".storybook"),
  componentExts,
  srcDirs: ["src", "app", "components", "lib"].filter(has),
  routerHint: (has("src/app") || has("app")) ? "app" : ((has("src/pages") || has("pages")) ? "pages" : null),
  packageManager: has("pnpm-lock.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : has("bun.lockb") ? "bun" : "npm",
};

process.stdout.write(JSON.stringify(result, null, 2) + "\n");

if (process.argv.includes("--write")) {
  fs.mkdirSync(path.join(ROOT, "design-audit"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "design-audit", "framework.json"), JSON.stringify(result, null, 2));
  console.error("✓ design-audit/framework.json");
}
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/project-map.mjs =====
#!/usr/bin/env node
/**
 * project-map.mjs — universal component catalog, Storybook coverage, routes.
 * Framework-agnostic (.tsx/.jsx/.vue/.svelte). Emits design-audit/project-map.json.
 * Reads design-audit/framework.json if present.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const fw = readJSON(path.join(ROOT, "design-audit", "framework.json")) ||
  { framework: "react", componentExts: [".tsx", ".jsx", ".ts", ".js"], srcDirs: ["src"] };
const exts = fw.componentExts || [".tsx", ".jsx", ".ts", ".js"];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, acc); else acc.push(f);
  }
  return acc;
}

const dirs = (fw.srcDirs?.length ? fw.srcDirs : ["src", "components", "app"]).map((d) => path.join(ROOT, d));
const files = [...new Set(dirs.flatMap((d) => walk(d)))];

const isStory = (f) => /\.stories\.[jt]sx?$|\.stories\.(vue|svelte)$/.test(f);
const isCode = (f) => exts.some((x) => f.endsWith(x)) || f.endsWith(".vue") || f.endsWith(".svelte");
const isPascal = (f) => /^[A-Z]/.test(path.basename(f).replace(/\.[^.]+$/, ""));

const storyNames = new Set(
  files.filter(isStory).map((f) =>
    path.basename(f).replace(/\.stories\.[jt]sx?$/, "").replace(/\.stories\.(vue|svelte)$/, ""))
);

function importCount(f) {
  try {
    const s = fs.readFileSync(f, "utf8");
    const out = new Set();
    const re = /from\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(s))) if (m[1].startsWith(".") || m[1].startsWith("@/")) out.add(m[1]);
    return out.size;
  } catch { return 0; }
}

const components = files
  .filter((f) => isCode(f) && !isStory(f) && isPascal(f) && !/\.(test|spec|d)\./.test(f))
  .map((f) => {
    const name = path.basename(f).replace(/\.[^.]+$/, "");
    return { name, file: path.relative(ROOT, f), hasStory: storyNames.has(name), localImports: importCount(f) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

let routes = [];
const routeDir = ["src/app", "app", "src/pages", "pages"]
  .map((d) => path.join(ROOT, d)).find(fs.existsSync);
if (routeDir) {
  const pagesStyle = routeDir.includes("pages");
  routes = walk(routeDir)
    .filter((f) => pagesStyle
      ? isCode(f) && !/_app|_document|[\\/]api[\\/]/.test(f)
      : /[\\/](page|route)\.[jt]sx?$/.test(f))
    .map((f) => path.relative(ROOT, f));
}

const out = {
  generatedAt: new Date().toISOString(),
  framework: fw.framework,
  summary: {
    components: components.length,
    withStories: components.filter((c) => c.hasStory).length,
    withoutStories: components.filter((c) => !c.hasStory).length,
    routes: routes.length,
  },
  components,
  routes,
};

fs.mkdirSync(path.join(ROOT, "design-audit"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "design-audit", "project-map.json"), JSON.stringify(out, null, 2));

console.log(`\n✓ design-audit/project-map.json`);
console.log(`  ${out.summary.components} components · ${out.summary.withStories} with stories · ` +
  `${out.summary.withoutStories} need stories · ${out.summary.routes} routes\n`);
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/generate-stories.mjs =====
#!/usr/bin/env node
/**
 * generate-stories.mjs — scaffolds minimal CSF3 stories for components that
 * lack one, so the computed-style extractor can render every component.
 * Idempotent: never overwrites an existing story. Auto-generated files carry a
 * header marker so they are easy to grep and remove later.
 *
 *   node generate-stories.mjs            # dry run, lists what's missing
 *   node generate-stories.mjs --write    # writes the .stories files
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const WRITE = process.argv.includes("--write");
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const fw = readJSON(path.join(ROOT, "design-audit", "framework.json")) ||
  { framework: "react", componentExts: [".tsx", ".jsx"], srcDirs: ["src"] };
const exts = fw.componentExts || [".tsx", ".jsx"];
const MARKER = "// AUTO-GENERATED by css-drift-auditor — safe to delete after audit";

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, acc); else acc.push(f);
  }
  return acc;
}

const isStory = (f) => /\.stories\.[jt]sx?$|\.stories\.(vue|svelte)$/.test(f);
const exportsSomething = (f) => { try { return /export\s+(default|const|function)\s/.test(fs.readFileSync(f, "utf8")); } catch { return false; } };
const isComponent = (f) => {
  const base = path.basename(f);
  if (isStory(f) || /\.(test|spec|d)\.[jt]sx?$/.test(base)) return false;
  if (!/^[A-Z]/.test(base)) return false;
  if (fw.framework === "svelte") return base.endsWith(".svelte");
  if (fw.framework === "vue") return base.endsWith(".vue");
  return exts.some((x) => base.endsWith(x)) && exportsSomething(f);
};

const dirs = (fw.srcDirs?.length ? fw.srcDirs : ["src", "components", "app"]).map((d) => path.join(ROOT, d));
const all = [...new Set(dirs.flatMap((d) => walk(d)))];
const existing = new Set(
  all.filter(isStory).map((f) =>
    path.basename(f).replace(/\.stories\.[jt]sx?$/, "").replace(/\.stories\.(vue|svelte)$/, ""))
);

const components = all.filter(isComponent);
const missing = components.filter((c) => !existing.has(path.basename(c).replace(/\.[^.]+$/, "")));

console.log(`\n📚 ${components.length} components · ${existing.size} have stories · ${missing.length} missing\n`);

const reactStory = (name, imp) =>
  `${MARKER}\nimport ${name} from '${imp}';\n\nexport default { title: 'Audit/${name}', component: ${name} };\n\nexport const Default = {};\n`;
const vueStory = (name, imp) =>
  `${MARKER}\nimport ${name} from '${imp}';\nexport default { title: 'Audit/${name}', component: ${name} };\nexport const Default = { render: () => ({ components: { ${name} }, template: '<${name} />' }) };\n`;

let written = 0;
for (const comp of missing) {
  const name = path.basename(comp).replace(/\.[^.]+$/, "");
  const dir = path.dirname(comp);
  const storyExt = fw.framework === "vue" ? ".stories.js" : (exts[0].includes("ts") ? ".stories.tsx" : ".stories.jsx");
  const storyPath = path.join(dir, name + storyExt);
  const imp = "./" + path.basename(comp).replace(/\.(tsx?|jsx?|vue|svelte)$/, "");
  const content = fw.framework === "vue" ? vueStory(name, imp) : reactStory(name, imp);
  console.log(`  ${WRITE ? "+ " : "(dry) "}${path.relative(ROOT, storyPath)}`);
  if (WRITE && !fs.existsSync(storyPath)) { fs.writeFileSync(storyPath, content); written++; }
}

console.log(`\n${WRITE ? `✓ wrote ${written} stories` : "Dry run — pass --write to create these"}`);
console.log("  Note: components with required props may fail to render; refine those few by hand.\n");
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/extract-computed-styles.mjs =====
#!/usr/bin/env node
/**
 * extract-computed-styles.mjs — THE strengthening.
 *
 * Renders every Storybook story in a headless browser and reads
 * getComputedStyle() off the live DOM. This captures the post-cascade pixel
 * value AFTER Tailwind classes, theme providers, CSS variables, and
 * inheritance resolve — drift that source-level analysis structurally cannot
 * see. The browser also normalizes values (#2e2e2e, rgb(46,46,46), and a
 * theme var all collapse to "rgb(46, 46, 46)"), so dedup is exact.
 *
 *   node extract-computed-styles.mjs                      # dev server @ :6006
 *   node extract-computed-styles.mjs --url http://localhost:6006
 *   node extract-computed-styles.mjs --static storybook-static   # built SB
 *
 * Requires Playwright in the target project:
 *   npm i -D playwright && npx playwright install chromium
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const config = loadConfig();
const SB_URL = getArg("--url", config.storybook.url);
const STATIC_DIR = getArg("--static", null);
const OUT_DIR = path.join(ROOT, config.output.dir);
const PROPS = config.extract.properties;
const IGNORE = config.extract.ignoreValues;
const PER_STORY_TIMEOUT = config.extract.perStoryTimeoutMs || 8000;

function loadConfig() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(ROOT, "design-audit", "audit.config.json"),
    path.join(here, "..", "config", "audit.config.json"),
  ];
  for (const p of candidates) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch {} }
  return {
    storybook: { url: "http://localhost:6006" },
    extract: {
      properties: ["color", "backgroundColor", "fontSize", "fontWeight", "fontFamily", "lineHeight", "borderRadius", "boxShadow", "padding", "margin", "gap"],
      ignoreValues: ["rgba(0, 0, 0, 0)", "none", "normal", "0px", "auto"],
      perStoryTimeoutMs: 8000,
    },
    output: { dir: "design-audit" },
  };
}

async function getChromium() {
  // Resolve Playwright from the target project (cwd), not the plugin dir.
  const tryImport = async (name) => {
    try {
      const req = createRequire(path.join(ROOT, "__resolve__.js"));
      return await import(pathToFileURL(req.resolve(name)).href);
    } catch {}
    try { return await import(name); } catch {}
    return null;
  };
  const pw = await tryImport("playwright");
  if (pw && pw.chromium) return pw.chromium;
  console.error("\n✗ Playwright not found in your project. Install:\n  npm i -D playwright && npx playwright install chromium\n");
  process.exit(1);
}

async function loadStoryIndex() {
  if (STATIC_DIR) {
    for (const f of ["index.json", "stories.json"]) {
      const p = path.join(ROOT, STATIC_DIR, f);
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
    }
    throw new Error(`No index.json in ${STATIC_DIR} — run build-storybook first.`);
  }
  for (const f of ["index.json", "stories.json"]) {
    try { const res = await fetch(`${SB_URL}/${f}`); if (res.ok) return await res.json(); } catch {}
  }
  throw new Error(`Could not fetch story index from ${SB_URL} — is Storybook running?`);
}

function listStories(index) {
  const entries = index.entries || index.stories || {};
  return Object.values(entries)
    .filter((e) => (e.type ? e.type === "story" : true))
    .map((e) => ({ id: e.id, title: e.title, name: e.name }));
}

// Serialized into the browser context per story.
function extractFromDOM(props, ignoreList) {
  const ignore = new Set(ignoreList);
  const root = document.querySelector("#storybook-root") || document.querySelector("#root") || document.body;
  const corner = {
    borderRadius: ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"],
    padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
    margin: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
    gap: ["rowGap", "columnGap"],
    borderColor: ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"],
    borderWidth: ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"],
  };
  const out = {};
  const record = (prop, val) => {
    if (!val || ignore.has(val)) return;
    (out[prop] = out[prop] || {})[val] = (out[prop][val] || 0) + 1;
  };
  for (const el of root.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    for (const prop of props) {
      if (corner[prop]) for (const sub of corner[prop]) record(prop, cs[sub]);
      else record(prop, cs[prop]);
    }
  }
  return out;
}

(async () => {
  const chromium = await getChromium();
  const index = await loadStoryIndex();
  const stories = listStories(index);
  if (!stories.length) { console.error("No stories found in index."); process.exit(1); }

  console.log(`\n🎨 Extracting computed styles from ${stories.length} stories\n`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const agg = {}; // prop -> value -> { count, stories:Set, components:Set }
  const merge = (storyId, title, dom) => {
    for (const [prop, vals] of Object.entries(dom)) {
      const bucket = (agg[prop] = agg[prop] || {});
      for (const [val, n] of Object.entries(vals)) {
        const rec = (bucket[val] = bucket[val] || { count: 0, stories: new Set(), components: new Set() });
        rec.count += n; rec.stories.add(storyId); rec.components.add(title);
      }
    }
  };

  const base = STATIC_DIR ? `file://${path.join(ROOT, STATIC_DIR)}` : SB_URL;
  let done = 0, skipped = 0;
  for (const story of stories) {
    const url = `${base}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: PER_STORY_TIMEOUT });
      await page.waitForSelector("#storybook-root > *, #root > *", { timeout: 3000 }).catch(() => {});
      const dom = await page.evaluate(extractFromDOM, PROPS, IGNORE);
      merge(story.id, story.title, dom);
    } catch (e) {
      skipped++;
      process.stderr.write(`  ⚠ skip ${story.id}: ${String(e.message).split("\n")[0]}\n`);
    }
    done++;
    if (done % 10 === 0 || done === stories.length) process.stdout.write(`  ${done}/${stories.length}\r`);
  }
  await browser.close();

  const output = {
    generatedAt: new Date().toISOString(),
    source: "storybook-computed",
    storyCount: stories.length,
    skipped,
    properties: {},
  };
  for (const [prop, vals] of Object.entries(agg)) {
    output.properties[prop] = Object.entries(vals)
      .map(([value, rec]) => ({ value, count: rec.count, stories: rec.stories.size, components: [...rec.components].sort() }))
      .sort((a, b) => b.count - a.count);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "computed-tokens.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n\n✓ ${path.relative(ROOT, outPath)}  (${skipped} stories skipped)`);
  for (const [prop, list] of Object.entries(output.properties)) {
    console.log(`  ${prop.padEnd(16)} ${list.length} distinct values`);
  }
  console.log("");
})();
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/analyze-drift.mjs =====
#!/usr/bin/env node
/**
 * analyze-drift.mjs — clusters computed values into a token scale and flags
 * low-usage outliers as drift. Dependency-free.
 * Emits design-audit/drift-report.md and design-audit/suggested-tokens.json.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "design-audit");
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

const cfg = (readJSON(path.join(OUT, "audit.config.json")) || {}).clustering ||
  { colorDistance: 24, spacingTolerancePx: 2, fontSizeTolerancePx: 1, driftMaxUsage: 2 };
const data = readJSON(path.join(OUT, "computed-tokens.json"));
if (!data) { console.error("✗ design-audit/computed-tokens.json not found. Run extract-computed-styles.mjs first."); process.exit(1); }
const props = data.properties || {};

const parseRgb = (v) => { const m = v.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map(parseFloat); return [p[0], p[1], p[2]]; };
const colorDist = (a, b) => { const A = parseRgb(a), B = parseRgb(b); if (!A || !B) return Infinity; return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const px = (v) => { const m = String(v).match(/^(-?[\d.]+)px$/); return m ? parseFloat(m[1]) : null; };
const pxDist = (a, b) => { const A = px(a), B = px(b); if (A == null || B == null) return Infinity; return Math.abs(A - B); };
const exactDist = (a, b) => (a === b ? 0 : Infinity);

function pool(propNames) {
  const map = new Map();
  for (const name of propNames) {
    for (const item of (props[name] || [])) {
      const cur = map.get(item.value) || { value: item.value, count: 0, components: new Set() };
      cur.count += item.count;
      (item.components || []).forEach((c) => cur.components.add(c));
      map.set(item.value, cur);
    }
  }
  return [...map.values()].map((x) => ({ ...x, components: [...x.components] })).sort((a, b) => b.count - a.count);
}

function cluster(list, distFn, tol) {
  const clusters = [];
  for (const item of list) {
    const c = clusters.find((c) => distFn(c.canonical.value, item.value) <= tol);
    if (c) c.members.push(item); else clusters.push({ canonical: item, members: [item] });
  }
  return clusters;
}

const groups = [
  { label: "Colors", prefix: "--color", props: ["color", "backgroundColor", "borderColor"], dist: colorDist, tol: cfg.colorDistance },
  { label: "Spacing (padding/margin/gap)", prefix: "--space", props: ["padding", "margin", "gap"], dist: pxDist, tol: cfg.spacingTolerancePx },
  { label: "Font size", prefix: "--font-size", props: ["fontSize"], dist: pxDist, tol: cfg.fontSizeTolerancePx },
  { label: "Border radius", prefix: "--radius", props: ["borderRadius"], dist: pxDist, tol: cfg.spacingTolerancePx },
  { label: "Border width", prefix: "--border-width", props: ["borderWidth"], dist: pxDist, tol: 1 },
  { label: "Font weight", prefix: "--font-weight", props: ["fontWeight"], dist: exactDist, tol: 0 },
  { label: "Line height", prefix: "--line-height", props: ["lineHeight"], dist: exactDist, tol: 0 },
  { label: "Font family", prefix: "--font-family", props: ["fontFamily"], dist: exactDist, tol: 0 },
  { label: "Box shadow", prefix: "--shadow", props: ["boxShadow"], dist: exactDist, tol: 0 },
  { label: "z-index", prefix: "--z", props: ["zIndex"], dist: exactDist, tol: 0 },
];

let md = `# Drift report\n\nGenerated: \`${new Date().toISOString()}\`  \nSource: Storybook computed styles (${data.storyCount} stories)\n\n`;
md += `Values used \u2264 ${cfg.driftMaxUsage}\u00d7 that sit within tolerance of a more-common value are flagged **drift \u2192 canonical**.\n\n---\n\n`;

const suggested = {};
let totalDrift = 0;

for (const g of groups) {
  const list = pool(g.props);
  if (!list.length) continue;
  const clusters = cluster(list, g.dist, g.tol);
  const lines = [];
  let i = 1;
  for (const c of clusters) {
    const token = `${g.prefix}-${i}`;
    const drifts = c.members.filter((m) => m.value !== c.canonical.value && m.count <= cfg.driftMaxUsage);
    for (const d of drifts) {
      suggested[d.value] = { token, canonical: c.canonical.value, group: g.prefix.slice(2), intentional: false };
      const used = d.components.slice(0, 3).join(", ") + (d.components.length > 3 ? "\u2026" : "");
      lines.push(`| \`${token}\` | \`${c.canonical.value}\` (${c.canonical.count}\u00d7) | \`${d.value}\` (${d.count}\u00d7) | ${used} |`);
      totalDrift++;
    }
    i++;
  }
  md += `## ${g.label}\n\n`;
  md += lines.length
    ? `| Token | Canonical | Drift value | Used by |\n|---|---|---|---|\n${lines.join("\n")}\n\n`
    : `_No drift \u2014 ${clusters.length} consistent value(s)._\n\n`;
}

md += `---\n\n**${totalDrift} drift values flagged.** Mark intentional one-offs with \`"intentional": true\` in suggested-tokens.json before running fix agents.\n`;

const suggestedOut = {
  generatedAt: new Date().toISOString(),
  driftCount: totalDrift,
  replacements: Object.entries(suggested).map(([value, info]) => ({ value, ...info })),
};

fs.writeFileSync(path.join(OUT, "drift-report.md"), md);
fs.writeFileSync(path.join(OUT, "suggested-tokens.json"), JSON.stringify(suggestedOut, null, 2));

console.log(`\n✓ design-audit/drift-report.md`);
console.log(`✓ design-audit/suggested-tokens.json`);
console.log(`\n  ${totalDrift} drift values flagged across ${groups.length} token groups\n`);
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/element-map.mjs =====
#!/usr/bin/env node
/**
 * element-map.mjs — orchestrator.
 *
 * Walks the project, dispatches each file to the matching framework parser
 * (parsers/react.mjs, parsers/angular.mjs, …), and aggregates a single
 * element-map.json. Pages are a mix of components AND raw HTML tags; raw tags
 * carrying className/inline-style/Tailwind-arbitrary values are the
 * source-level drift surface (`styledHtmlTags`).
 *
 * Output is framework-agnostic, so adding a parser (Vue, Svelte) needs no
 * change here — just register it in PARSERS below.
 *
 *   node element-map.mjs                 # all parseable files under src dirs
 *   node element-map.mjs --depth 6       # cap tree depth (default 8)
 *   node element-map.mjs --trees         # embed full nested trees per file
 *
 * Deps are resolved from the TARGET project: React needs @babel/parser;
 * Angular needs @babel/parser + parse5.
 */
import fs from "fs";
import path from "path";
import { summarize } from "./parsers/shared.mjs";
import reactParser from "./parsers/react.mjs";
import angularParser from "./parsers/angular.mjs";

// Register parsers here. First match wins.
const PARSERS = [reactParser, angularParser];

const ROOT = process.cwd();
const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MAX_DEPTH = parseInt(getArg("--depth", "8"));
const INCLUDE_TREES = args.includes("--trees");

const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const fw = readJSON(path.join(ROOT, "design-audit", "framework.json")) || { srcDirs: ["src"] };

function walkDir(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(f, acc); else acc.push(f);
  }
  return acc;
}

function fileKind(rel) {
  const b = path.basename(rel);
  if (/^layout\.[jt]sx?$/.test(b)) return "layout";
  if (/^(page|route)\.[jt]sx?$/.test(b)) return "page";
  if (/[\\/]pages[\\/]/.test(rel) && !/[\\/]api[\\/]/.test(rel) && !/_app|_document/.test(b)) return "page";
  return "component";
}

const dirs = (fw.srcDirs?.length ? fw.srcDirs : ["src", "app", "components", "projects", "libs"])
  .map((d) => path.join(ROOT, d));
const allFiles = [...new Set(dirs.flatMap((d) => walkDir(d)))];

// Route each file to the first parser that claims it.
const routed = [];
for (const f of allFiles) {
  const parser = PARSERS.find((p) => p.matches(f));
  if (parser) routed.push({ file: f, parser });
}

if (!routed.length) {
  console.error("\n✗ No parseable component files found under: " + dirs.map((d) => path.relative(ROOT, d)).join(", ") + "\n");
  process.exit(1);
}

// Preflight: only check deps for parsers that actually have work to do.
const usedParsers = [...new Set(routed.map((r) => r.parser))];
const missing = new Set();
for (const p of usedParsers) {
  const res = await p.ensureDeps(ROOT);
  if (!res.ok) res.missing.forEach((m) => missing.add(m));
}
if (missing.size) {
  console.error(`\n✗ Missing dependencies in your project. Install:\n  npm i -D ${[...missing].join(" ")}\n`);
  process.exit(1);
}

console.log(`\n🌳 Parsing ${routed.length} files via ${usedParsers.map((p) => p.name).join(" + ")}\n`);

const fileMap = {};
const htmlFreq = {}, compFreq = {};
let parseErrors = 0, totalHtml = 0, totalComp = 0, totalStyled = 0;

for (const { file, parser } of routed) {
  const rel = path.relative(ROOT, file);
  let code;
  try { code = fs.readFileSync(file, "utf8"); } catch { continue; }

  let result;
  try {
    result = await parser.parseFile(file, code, { maxDepth: MAX_DEPTH, root: ROOT });
  } catch (e) {
    parseErrors++;
    process.stderr.write(`  ⚠ ${parser.name} error ${rel}: ${String(e.message).split("\n")[0]}\n`);
    continue;
  }
  if (result.error) { parseErrors++; process.stderr.write(`  ⚠ parse error ${rel}: ${result.error}\n`); }

  const trees = result.trees || [];
  const sum = summarize(trees);

  for (const [t, n] of Object.entries(sum.htmlTags)) { htmlFreq[t] = (htmlFreq[t] || 0) + n; totalHtml += n; }
  for (const [c, n] of Object.entries(sum.components)) { compFreq[c] = (compFreq[c] || 0) + n; totalComp += n; }
  totalStyled += sum.styledHtmlTags.length;

  fileMap[rel] = {
    framework: parser.name,
    kind: result.kind || fileKind(rel),
    htmlTags: sum.htmlTags,
    components: sum.components,
    styledHtmlTags: sum.styledHtmlTags,
    ...(result.meta ? { meta: result.meta } : {}),
    ...(INCLUDE_TREES ? { tree: trees } : {}),
  };
}

const sortDesc = (obj) => Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]));

const output = {
  generatedAt: new Date().toISOString(),
  framework: fw.framework || "unknown",
  parsers: usedParsers.map((p) => p.name),
  note: "styledHtmlTags = raw HTML elements carrying className/style/arbitrary values — the primary source-level drift surface. className may be a string (static) or { expr } (dynamic: cn(), [ngClass], etc.).",
  summary: {
    files: Object.keys(fileMap).length,
    parseErrors,
    totalHtmlTags: totalHtml,
    totalComponentUsages: totalComp,
    distinctHtmlTags: Object.keys(htmlFreq).length,
    distinctComponents: Object.keys(compFreq).length,
    styledHtmlTags: totalStyled,
  },
  htmlTagFrequency: sortDesc(htmlFreq),
  componentFrequency: sortDesc(compFreq),
  files: fileMap,
};

fs.mkdirSync(path.join(ROOT, "design-audit"), { recursive: true });
const outPath = path.join(ROOT, "design-audit", "element-map.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`✓ ${path.relative(ROOT, outPath)}`);
console.log(`  ${output.summary.files} files · ${totalHtml} html tags (${output.summary.distinctHtmlTags} distinct) · ` +
  `${totalComp} component usages (${output.summary.distinctComponents} distinct)`);
console.log(`  ${totalStyled} styled html tags flagged as drift surface` +
  (parseErrors ? ` · ${parseErrors} parse errors` : "") + "\n");
console.log(`  Pass --trees to embed full nested trees per file.\n`);
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/parsers/shared.mjs =====
/**
 * parsers/shared.mjs — utilities common to every framework parser.
 * Each parser returns the SAME node shape so the orchestrator and all
 * downstream tooling stay framework-agnostic:
 *
 *   { type: "html" | "component" | "fragment", name,
 *     className?: string | { expr },
 *     inlineStyle?: string | { expr },
 *     id?, arbitrary?: string[], loc?: "line:col",
 *     children?: Node[] }
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createRequire } from "module";

// Tailwind arbitrary values: bg-[#2e3440], text-[13px], p-[7px], gap-[7px]
export const ARBITRARY_RE = /[\w-]*\[[^\]]+\]/g;

export function arbitraryFrom(className) {
  const text = typeof className === "string" ? className : (className && className.expr) || "";
  return [...new Set(text.match(ARBITRARY_RE) || [])];
}

// Intrinsic HTML / SVG elements (lowercase). Anything not here AND not hyphenated
// is still treated as html by default; hyphenated names are custom elements.
export const HTML_TAGS = new Set([
  "a","abbr","address","area","article","aside","audio","b","base","bdi","bdo",
  "blockquote","body","br","button","canvas","caption","cite","code","col",
  "colgroup","data","datalist","dd","del","details","dfn","dialog","div","dl",
  "dt","em","embed","fieldset","figcaption","figure","footer","form","h1","h2",
  "h3","h4","h5","h6","head","header","hgroup","hr","html","i","iframe","img",
  "input","ins","kbd","label","legend","li","link","main","map","mark","menu",
  "meta","meter","nav","noscript","object","ol","optgroup","option","output","p",
  "picture","pre","progress","q","rp","rt","ruby","s","samp","script","section",
  "select","slot","small","source","span","strong","style","sub","summary","sup",
  "table","tbody","td","template","textarea","tfoot","th","thead","time","title",
  "tr","track","u","ul","var","video","wbr",
  // common SVG
  "svg","path","g","circle","rect","line","polyline","polygon","ellipse","text",
  "defs","use","clippath","lineargradient","radialgradient","stop","mask","tspan",
]);

export const isHtmlTag = (name) => HTML_TAGS.has(String(name).toLowerCase());

// Resolve a dependency from the TARGET project (cwd), handling CJS and ESM-only
// packages. ESM bare imports resolve relative to this file (inside the plugin),
// not the user's project, so we resolve against the project's node_modules.
const _cache = new Map();

function pkgEntry(pkgDir) {
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")); } catch { return null; }
  const pick = (e) => {
    if (typeof e === "string") return e;
    if (e && typeof e === "object") return e.import || e.module || e.default || e.require || e.node;
    return null;
  };
  let entry = null;
  if (pkg.exports) entry = pick(pkg.exports) || pick(pkg.exports["."]);
  entry = entry || pkg.module || pkg.main || "index.js";
  return path.join(pkgDir, entry);
}

export async function importFromProject(name, root = process.cwd()) {
  const key = root + "::" + name;
  if (_cache.has(key)) return _cache.get(key);
  let mod = null;

  // 1) manual node_modules resolution (covers ESM-only packages like parse5 v7)
  try {
    const entry = pkgEntry(path.join(root, "node_modules", name));
    if (entry && fs.existsSync(entry)) mod = await import(pathToFileURL(entry).href);
  } catch {}

  // 2) require.resolve anchored at the project
  if (!mod) {
    try {
      const req = createRequire(path.join(root, "__resolve__.js"));
      mod = await import(pathToFileURL(req.resolve(name)).href);
    } catch {}
  }

  // 3) plugin's own resolution as a last resort
  if (!mod) { try { mod = await import(name); } catch {} }

  _cache.set(key, mod);
  return mod;
}

// Aggregate counts + the styled-html drift surface from built trees.
export function summarize(trees) {
  const htmlTags = {}, components = {}, styled = [];
  const visit = (n) => {
    if (n.type === "html") {
      htmlTags[n.name] = (htmlTags[n.name] || 0) + 1;
      if (n.className || n.inlineStyle || n.arbitrary)
        styled.push({ tag: n.name, className: n.className, inlineStyle: n.inlineStyle, arbitrary: n.arbitrary, loc: n.loc });
    } else if (n.type === "component") {
      components[n.name] = (components[n.name] || 0) + 1;
    }
    (n.children || []).forEach(visit);
  };
  (trees || []).forEach(visit);
  return { htmlTags, components, styledHtmlTags: styled };
}
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/parsers/react.mjs =====
/**
 * parsers/react.mjs — React/JSX parser (.tsx/.jsx) built on @babel/parser.
 * Produces the shared node tree: components vs raw HTML tags, with className,
 * inline style, Tailwind arbitrary values, and source location.
 *
 * Requires @babel/parser in the target project: npm i -D @babel/parser
 */
import { importFromProject, arbitraryFrom } from "./shared.mjs";

export const name = "react";
export const deps = ["@babel/parser"];
export const matches = (file) =>
  /\.(tsx|jsx)$/.test(file) && !/\.(test|spec|stories)\./.test(file);

export async function ensureDeps(root) {
  const babel = await importFromProject("@babel/parser", root);
  const parse = babel && (babel.parse || (babel.default && babel.default.parse));
  return parse ? { ok: true } : { ok: false, missing: ["@babel/parser"] };
}

// ── AST helpers ──────────────────────────────────────────────────────────────

function astWalk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) astWalk(n, visit); return; }
  if (typeof node.type === "string") visit(node);
  for (const k in node) {
    if (k === "loc" || k === "start" || k === "end" || k === "range" ||
        k === "leadingComments" || k === "trailingComments") continue;
    const c = node[k];
    if (c && typeof c === "object") astWalk(c, visit);
  }
}

// Top-most JSX nodes within an expression (stops descending at JSX).
function topJsxIn(node, acc) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => topJsxIn(n, acc)); return; }
  if (node.type === "JSXElement" || node.type === "JSXFragment") { acc.push(node); return; }
  for (const k in node) {
    if (k === "loc" || k === "start" || k === "end" || k === "range") continue;
    const c = node[k];
    if (c && typeof c === "object") topJsxIn(c, acc);
  }
}

const memberName = (n) =>
  n.type === "JSXMemberExpression" ? memberName(n.object) + "." + n.property.name : n.name;

function jsxName(node) {
  if (node.type === "JSXFragment") return { kind: "fragment", name: "<>" };
  const n = node.openingElement.name;
  let nm = "unknown";
  if (n.type === "JSXIdentifier") nm = n.name;
  else if (n.type === "JSXMemberExpression") nm = memberName(n);
  else if (n.type === "JSXNamespacedName") nm = n.namespace.name + ":" + n.name.name;
  const isHtml = /^[a-z]/.test(nm) && !nm.includes(".");
  return { kind: isHtml ? "html" : "component", name: nm };
}

function attrToText(value, code) {
  if (!value) return { kind: "boolean" };
  if (value.type === "StringLiteral") return { kind: "static", text: value.value };
  if (value.type === "JSXExpressionContainer") {
    const e = value.expression;
    if (e.type === "StringLiteral") return { kind: "static", text: e.value };
    if (e.type === "TemplateLiteral" && e.expressions.length === 0)
      return { kind: "static", text: e.quasis.map((q) => q.value.cooked).join("") };
    return { kind: "dynamic", text: code.slice(e.start, e.end).replace(/\s+/g, " ").slice(0, 120) };
  }
  return { kind: "dynamic", text: code.slice(value.start, value.end).slice(0, 120) };
}

function getAttrs(node, code) {
  const out = {};
  const el = node.openingElement;
  if (!el) return out;
  for (const attr of el.attributes || []) {
    if (attr.type !== "JSXAttribute" || !attr.name) continue;
    const key = attr.name.name;
    if (key === "className") {
      const v = attrToText(attr.value, code);
      out.className = v.kind === "static" ? v.text : { expr: v.text };
    } else if (key === "style") {
      out.inlineStyle = attr.value ? code.slice(attr.value.start, attr.value.end).replace(/\s+/g, " ") : true;
    } else if (key === "id") {
      const v = attrToText(attr.value, code);
      if (v.kind === "static") out.id = v.text;
    }
  }
  return out;
}

function jsxChildren(node) {
  const kids = [];
  for (const child of node.children || []) {
    if (child.type === "JSXElement" || child.type === "JSXFragment") kids.push(child);
    else if (child.type === "JSXExpressionContainer") topJsxIn(child.expression, kids);
  }
  return kids;
}

function buildNode(jsx, code, depth, maxDepth) {
  const { kind, name: nm } = jsxName(jsx);
  const node = { type: kind, name: nm };
  if (kind !== "fragment") {
    const a = getAttrs(jsx, code);
    if (a.className != null) node.className = a.className;
    if (a.id != null) node.id = a.id;
    if (a.inlineStyle != null) node.inlineStyle = a.inlineStyle;
    const arb = arbitraryFrom(a.className);
    if (arb.length) node.arbitrary = arb;
  }
  if (jsx.loc) node.loc = `${jsx.loc.start.line}:${jsx.loc.start.column}`;
  const kids = depth < maxDepth ? jsxChildren(jsx).map((k) => buildNode(k, code, depth + 1, maxDepth)) : [];
  if (kids.length) node.children = kids;
  return node;
}

export async function parseFile(filePath, code, { maxDepth = 8, root = process.cwd() } = {}) {
  const babel = await importFromProject("@babel/parser", root);
  const parse = babel.parse || (babel.default && babel.default.parse);
  const ast = parse(code, {
    sourceType: "module",
    errorRecovery: true,
    plugins: ["jsx", "typescript", "decorators-legacy", "classProperties"],
  });

  const allJsx = [];
  astWalk(ast, (n) => { if (n.type === "JSXElement" || n.type === "JSXFragment") allJsx.push(n); });
  const childSet = new Set();
  for (const j of allJsx) for (const c of jsxChildren(j)) childSet.add(c);
  const roots = allJsx.filter((j) => !childSet.has(j));

  return { trees: roots.map((r) => buildNode(r, code, 0, maxDepth)) };
}

export default { name, deps, matches, ensureDeps, parseFile };
===== END FILE =====

===== BEGIN FILE: plugins/css-drift-auditor/scripts/parsers/angular.mjs =====
/**
 * parsers/angular.mjs — Angular parser for *.component.ts files.
 *
 * Angular separates a component's class (the .ts) from its template (inline in
 * the @Component decorator, or an external .html via templateUrl). This parser:
 *   1. uses @babel/parser to read the @Component metadata (selector, template,
 *      templateUrl, styleUrls),
 *   2. resolves the template HTML (inline or the referenced file),
 *   3. parses that HTML with parse5 (the HTML5 spec parser — the same algorithm
 *      browsers use, so Angular's [binding], (event), and *structural attributes
 *      all survive as plain attributes),
 *   4. classifies each element as html / component / fragment and extracts
 *      class + style bindings into the shared node shape.
 *
 * Component vs html: an element is a component if its tag is a discovered
 * component selector OR a hyphenated custom element (app-*, mat-*, etc.).
 * <ng-container>/<ng-template> are treated as fragments; ng-content and other
 * ng-* / hyphenated tags as components.
 *
 * Requires in the target project: npm i -D @babel/parser parse5
 */
import fs from "fs";
import path from "path";
import { importFromProject, arbitraryFrom, isHtmlTag } from "./shared.mjs";

export const name = "angular";
export const deps = ["@babel/parser", "parse5"];
export const matches = (file) => /\.component\.ts$/.test(file) && !/\.(spec|test)\./.test(file);

const NG_FRAGMENTS = new Set(["ng-container", "ng-template"]);

export async function ensureDeps(root) {
  const babel = await importFromProject("@babel/parser", root);
  const parse = babel && (babel.parse || (babel.default && babel.default.parse));
  const p5 = await importFromProject("parse5", root);
  const pf = p5 && (p5.parseFragment || (p5.default && p5.default.parseFragment));
  const missing = [];
  if (!parse) missing.push("@babel/parser");
  if (!pf) missing.push("parse5");
  return missing.length ? { ok: false, missing } : { ok: true };
}

// ── Discover component selectors across the project (memoized) ───────────────

let _selectorCache = null;
function collectSelectors(root) {
  if (_selectorCache) return _selectorCache;
  const set = new Set();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.component\.ts$/.test(e.name)) {
        try {
          const code = fs.readFileSync(f, "utf8");
          const m = code.match(/selector\s*:\s*['"]([^'"]+)['"]/);
          if (m) {
            // selector may be "app-foo, [appBar], .x" — keep element-name tokens
            for (const tok of m[1].split(",")) {
              const t = tok.trim();
              if (/^[a-zA-Z][\w-]*$/.test(t)) set.add(t.toLowerCase());
            }
          }
        } catch {}
      }
    }
  };
  for (const d of ["src", "app", "projects", "libs"]) walk(path.join(root, d));
  _selectorCache = set;
  return set;
}

// ── Extract @Component metadata from the .ts via babel AST ───────────────────

function astWalk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) astWalk(n, visit); return; }
  if (typeof node.type === "string") visit(node);
  for (const k in node) {
    if (k === "loc" || k === "start" || k === "end" || k === "range" ||
        k === "leadingComments" || k === "trailingComments") continue;
    const c = node[k];
    if (c && typeof c === "object") astWalk(c, visit);
  }
}

function strOf(node) {
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral") return node.quasis.map((q) => q.value.cooked).join("");
  return null;
}

function extractComponentMeta(ast) {
  let meta = null;
  astWalk(ast, (n) => {
    if (meta) return;
    const isComponentDecorator =
      n.type === "Decorator" &&
      n.expression &&
      n.expression.type === "CallExpression" &&
      n.expression.callee &&
      n.expression.callee.name === "Component";
    if (!isComponentDecorator) return;
    const arg = n.expression.arguments && n.expression.arguments[0];
    if (!arg || arg.type !== "ObjectExpression") return;
    const out = {};
    for (const prop of arg.properties) {
      if (prop.type !== "ObjectProperty" || !prop.key) continue;
      const key = prop.key.name || prop.key.value;
      if (key === "selector") out.selector = strOf(prop.value);
      else if (key === "template") out.template = strOf(prop.value);
      else if (key === "templateUrl") out.templateUrl = strOf(prop.value);
      else if (key === "styleUrls" && prop.value.type === "ArrayExpression")
        out.styleUrls = prop.value.elements.map(strOf).filter(Boolean);
    }
    meta = out;
  });
  return meta;
}

// ── Classify + attribute extraction for Angular elements ─────────────────────

function classify(tag, selectors) {
  const t = tag.toLowerCase();
  if (NG_FRAGMENTS.has(t)) return "fragment";
  if (selectors.has(t) || t.includes("-")) return "component";
  if (isHtmlTag(t)) return "html";
  return "html"; // bare unknown tag → treat as html
}

// parse5 lowercases attribute names, so match lowercase keys.
function ngAttrs(attrs) {
  const out = {};
  let classText = "";
  let dynClass = false, dynStyle = false, styleExpr = "";
  for (const a of attrs || []) {
    const n = a.name;
    if (n === "class") { out.className = a.value; classText += " " + a.value; }
    else if (n === "[ngclass]" || n === "[class]") { dynClass = true; classText += " " + a.value; }
    else if (n.startsWith("[class.")) { classText += " " + n.slice(7, -1); }        // [class.active]
    else if (n === "style") { out.inlineStyle = a.value; }
    else if (n === "[ngstyle]" || n === "[style]") { dynStyle = true; styleExpr += " " + a.value; }
    else if (n.startsWith("[style.")) { dynStyle = true; styleExpr += " " + n + "=" + a.value; } // [style.width.px]
    else if (n === "id") { out.id = a.value; }
  }
  if (out.className == null && dynClass) out.className = { expr: classText.trim().slice(0, 120) };
  if (out.inlineStyle == null && dynStyle) out.inlineStyle = { expr: styleExpr.trim().slice(0, 120) };
  return { out, classText: classText.trim() };
}

function childElements(node) {
  // <ng-template> holds its children under .content (a document fragment)
  const kids = node.tagName === "template" && node.content ? node.content.childNodes : node.childNodes;
  return (kids || []).filter((c) => c.tagName !== undefined);
}

function buildNgNode(el, selectors, depth, maxDepth) {
  const tag = el.tagName;
  const kind = classify(tag, selectors);
  const node = { type: kind, name: tag };
  if (kind !== "fragment") {
    const { out, classText } = ngAttrs(el.attrs);
    if (out.className != null) node.className = out.className;
    if (out.id != null) node.id = out.id;
    if (out.inlineStyle != null) node.inlineStyle = out.inlineStyle;
    const arb = arbitraryFrom(classText);
    if (arb.length) node.arbitrary = arb;
  }
  const loc = el.sourceCodeLocation;
  if (loc) node.loc = `${loc.startLine}:${loc.startCol}`;
  const kids = depth < maxDepth
    ? childElements(el).map((c) => buildNgNode(c, selectors, depth + 1, maxDepth))
    : [];
  if (kids.length) node.children = kids;
  return node;
}

export async function parseFile(filePath, code, { maxDepth = 8, root = process.cwd() } = {}) {
  const babel = await importFromProject("@babel/parser", root);
  const parse = babel.parse || (babel.default && babel.default.parse);
  const p5 = await importFromProject("parse5", root);
  const parseFragment = p5.parseFragment || (p5.default && p5.default.parseFragment);

  let ast;
  try {
    ast = parse(code, {
      sourceType: "module", errorRecovery: true,
      plugins: ["typescript", "decorators-legacy", "classProperties"],
    });
  } catch (e) {
    return { trees: [], kind: "component", error: String(e.message).split("\n")[0] };
  }

  const meta = extractComponentMeta(ast);
  if (!meta) return { trees: [], kind: "component" };

  // Resolve template HTML: inline, or external file via templateUrl.
  let html = meta.template || null;
  if (html == null && meta.templateUrl) {
    const tpath = path.resolve(path.dirname(filePath), meta.templateUrl);
    try { html = fs.readFileSync(tpath, "utf8"); } catch { html = null; }
  }
  if (html == null) {
    return { trees: [], kind: "component", meta: { selector: meta.selector, styleUrls: meta.styleUrls } };
  }

  const selectors = collectSelectors(root);
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true });
  const roots = childElements(fragment).map((el) => buildNgNode(el, selectors, 0, maxDepth));

  return {
    trees: roots,
    kind: "component",
    meta: { selector: meta.selector, styleUrls: meta.styleUrls, templateUrl: meta.templateUrl || null },
  };
}

export default { name, deps, matches, ensureDeps, parseFile };
===== END FILE =====


## 3. Fill in your details

In `.claude-plugin/marketplace.json` and `LICENSE`, replace `owner.name` / `owner.email`, the plugin `author.name`, and the `LICENSE` copyright holder with your own. Keep the marketplace `name` as `drift-tools` and the plugin `name` as `css-drift-auditor` — together they form the install id `css-drift-auditor@drift-tools`. If you rename the marketplace, update the `name` field in `marketplace.json` and tell me the new install id.

## 4. Validate before committing

Run these and confirm everything passes:

```bash
# every script must parse
for f in $(find plugins -name '*.mjs'); do node --check "$f" || { echo "FAIL $f"; exit 1; }; done

# the three manifests must be valid JSON
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('plugins/css-drift-auditor/.claude-plugin/plugin.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('plugins/css-drift-auditor/config/audit.config.json','utf8'))"
```

If the Claude Code CLI is available, also run:

```bash
claude plugin validate plugins/css-drift-auditor/.claude-plugin/plugin.json
```

Fix anything that fails before continuing.

## 5. Initialize git and publish

```bash
git init -b main
git add .
git commit -m "feat: css-drift-auditor plugin v0.3.0"

# Option A — GitHub CLI (creates the repo and pushes in one step):
gh repo create css-drift-auditor --public --source=. --remote=origin --push

# Option B — manual (create an empty PUBLIC repo on GitHub first, then):
# git remote add origin https://github.com/<your-username>/css-drift-auditor.git
# git push -u origin main
```

The repository must be **public** — Claude Code fetches marketplaces directly from GitHub.

## 6. Print the install commands

After pushing, output the two commands a user runs to install this plugin, substituting my GitHub `<owner>/<repo>`:

```
/plugin marketplace add <owner>/<repo>
/plugin install css-drift-auditor@drift-tools
```
