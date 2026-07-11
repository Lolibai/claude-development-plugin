#!/usr/bin/env node
// onboarding.mjs — one-time, per-project stack onboarding for the loop stack.
//
// Detects what it can from the repo, asks you to confirm/fill the rest, then writes
//   .claude/stack.json   (canonical machine-readable config)
//   .claude/stack.md     (human + Claude readable view; every skill reads THIS)
//
// After this runs once, the loop-stack skills/agents/commands/loops read the config
// instead of asking project-specific questions. Re-run any time to update it.
//
// Usage:
//   node onboarding.mjs                 interactive (default)
//   node onboarding.mjs --detect-only   print what was auto-detected, write nothing
//   node onboarding.mjs --non-interactive [--yes]   use detected + defaults, no prompts
//   node onboarding.mjs --out <dir>     output dir (default: .claude)
//   node onboarding.mjs --root <dir>    project root to scan (default: cwd)
//
// No external dependencies — Node built-ins only.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ROOT = path.resolve(opt("--root", process.cwd()));
const OUT = path.resolve(ROOT, opt("--out", ".claude"));
const DETECT_ONLY = has("--detect-only");
const NON_INTERACTIVE = has("--non-interactive") || has("--yes");
const DASH = "—"; // em dash, used in rendered output

// ---------- small helpers ----------
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const exists = (p) => fs.existsSync(path.resolve(ROOT, p));
const tryExec = (cmd) => { try { return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } };
const listWorkflows = () => { try { return fs.readdirSync(path.resolve(ROOT, ".github/workflows")); } catch { return []; } };

const pkg = readJSON(path.resolve(ROOT, "package.json")) || {};
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const dep = (name) => Object.keys(deps).some((d) => d === name || d.startsWith(name + "/") || d.startsWith("@" + name));

// ---------- detection ----------
function detectVcs() {
  const url = tryExec("git remote get-url origin");
  let host = "", repo = "";
  const m = url.match(/(?:github\.com|gitlab\.com|bitbucket\.org)[/:]([^/]+\/[^/.]+)(?:\.git)?/i);
  if (m) repo = m[1];
  if (/github\.com/i.test(url)) host = "github";
  else if (/gitlab/i.test(url)) host = "gitlab";
  else if (url) host = "other";
  const branch = tryExec("git symbolic-ref --short HEAD") || tryExec("git rev-parse --abbrev-ref HEAD");
  const username = tryExec("gh api user --jq .login");
  return { host: host || "github", repo, username, currentBranch: branch };
}
function detectPkgManager() {
  if (exists("pnpm-lock.yaml")) return "pnpm";
  if (exists("yarn.lock")) return "yarn";
  if (exists("bun.lockb")) return "bun";
  if (exists("package-lock.json")) return "npm";
  return pkg.packageManager ? pkg.packageManager.split("@")[0] : "npm";
}
function detectFrontend() {
  const fw = [];
  if (dep("react") || dep("next")) fw.push("react");
  if (dep("@angular")) fw.push("angular");
  if (dep("vue") || dep("nuxt")) fw.push("vue");
  if (dep("svelte")) fw.push("svelte");
  let styling = "none";
  if (dep("tailwindcss") || exists("tailwind.config.js") || exists("tailwind.config.ts")) styling = "tailwind";
  else if (dep("styled-components")) styling = "styled-components";
  else if (dep("@emotion")) styling = "emotion";
  let apps = [];
  for (const dir of ["apps", "packages", "frontend"]) {
    try { apps.push(...fs.readdirSync(path.resolve(ROOT, dir)).filter((d) => { try { return fs.statSync(path.resolve(ROOT, dir, d)).isDirectory(); } catch { return false; } }).map((d) => `${dir}/${d}`)); } catch {}
  }
  return { frameworks: fw, styling, apps };
}
function detectBackend() {
  if (exists("supabase") || dep("supabase")) return { platform: "supabase", migrationsDir: exists("backend/supabase/migrations") ? "backend/supabase/migrations" : "supabase/migrations" };
  if (exists("prisma/schema.prisma") || dep("prisma")) return { platform: "prisma", migrationsDir: "prisma/migrations" };
  if (dep("drizzle-orm")) return { platform: "drizzle", migrationsDir: "drizzle" };
  return { platform: "none", migrationsDir: "" };
}
function detectEdge() {
  if (exists("backend/supabase/functions") || exists("supabase/functions")) return { platform: "supabase-edge-deno", functionsDir: exists("backend/supabase/functions") ? "backend/supabase/functions" : "supabase/functions" };
  if (exists("netlify/functions")) return { platform: "netlify", functionsDir: "netlify/functions" };
  if (dep("aws-lambda") || exists("serverless.yml")) return { platform: "lambda", functionsDir: "" };
  return { platform: "none", functionsDir: "" };
}
function detectTesting() {
  const unit = dep("vitest") ? "vitest" : dep("jest") ? "jest" : dep("mocha") ? "mocha" : "none";
  const e2e = (dep("@playwright/test") || dep("playwright")) ? "playwright" : dep("cypress") ? "cypress" : "none";
  const bdd = (dep("playwright-bdd") || dep("@cucumber/cucumber")) ? "npx bddgen" : "";
  let e2eDir = "";
  for (const d of ["tests/ui-tests", "e2e", "tests/e2e", "cypress"]) if (exists(d)) { e2eDir = d; break; }
  return { unit, e2e, e2eDir, bdd };
}
function detectCi() {
  const wf = listWorkflows();
  const deploy = wf.filter((f) => /deploy/i.test(f));
  return { host: wf.length ? "github-actions" : "none", deployWorkflows: deploy };
}

function detect() {
  const vcs = detectVcs();
  return {
    vcs,
    packageManager: detectPkgManager(),
    frontend: detectFrontend(),
    backend: detectBackend(),
    edge: detectEdge(),
    testing: detectTesting(),
    ci: detectCi(),
  };
}

// ---------- config assembly ----------
function defaultsFrom(d, prev) {
  const p = prev || {};
  const pm = d.packageManager;
  return {
    version: 1,
    project: {
      name: (p.project && p.project.name) || (d.vcs.repo ? d.vcs.repo.split("/")[1] : path.basename(ROOT)),
      vcsHost: d.vcs.host,
      repo: d.vcs.repo,
      username: d.vcs.username || (p.project && p.project.username) || "",
    },
    issueTracker: {
      tool: (p.issueTracker && p.issueTracker.tool) || (d.vcs.host === "github" ? "github" : "none"),
      connection: (p.issueTracker && p.issueTracker.connection) || "",
      keyPrefix: (p.issueTracker && p.issueTracker.keyPrefix) || "",
      myWorkQuery: (p.issueTracker && p.issueTracker.myWorkQuery) || (d.vcs.host === "github" ? "is:open is:issue assignee:@me" : ""),
      issueTypes: (p.issueTracker && p.issueTracker.issueTypes) || { bug: "Bug", story: "Story" },
      states: (p.issueTracker && p.issueTracker.states) || { todo: "To Do", inProgress: "In Progress", inReview: "In Review", verify: "", verified: "", done: "Done" },
      transitionIds: (p.issueTracker && p.issueTracker.transitionIds) || {},
      handoffAssignee: (p.issueTracker && p.issueTracker.handoffAssignee) || "none",
    },
    vcs: {
      integrationBranch: (p.vcs && p.vcs.integrationBranch) || d.vcs.currentBranch || "main",
      envBranches: (p.vcs && p.vcs.envBranches) || {},
      fixBaseBranches: (p.vcs && p.vcs.fixBaseBranches) || {},
      branchNaming: (p.vcs && p.vcs.branchNaming) || "<type>/<KEY>",
      autoMerge: (p.vcs && p.vcs.autoMerge) || "squash",
      respectBranchProtection: true,
      prReview: (p.vcs && p.vcs.prReview) || { watchAuthors: [], reviewer: d.vcs.username || "" },
    },
    commands: (p.commands) || { packageManager: pm, install: pm + " install", typecheck: pm + " typecheck", lint: pm + " lint", format: pm + " format", build: pm + " build", test: pm + " test", commitConvention: "conventional-commits", commitNoAttribution: true },
    frontend: {
      frameworks: d.frontend.frameworks.length ? d.frontend.frameworks : ((p.frontend && p.frontend.frameworks) || []),
      apps: d.frontend.apps.length ? d.frontend.apps : ((p.frontend && p.frontend.apps) || []),
      styling: d.frontend.styling !== "none" ? d.frontend.styling : ((p.frontend && p.frontend.styling) || "none"),
      conventionsNote: (p.frontend && p.frontend.conventionsNote) || "",
    },
    backend: { ...d.backend, migrateCmd: (p.backend && p.backend.migrateCmd) || "" },
    edge: { ...d.edge, localRestart: (p.edge && p.edge.localRestart) || "" },
    testing: {
      unit: { runner: d.testing.unit, locations: (p.testing && p.testing.unit && p.testing.unit.locations) || [] },
      e2e: { runner: d.testing.e2e, dir: d.testing.e2eDir, command: (p.testing && p.testing.e2e && p.testing.e2e.command) || "", tagConvention: (p.testing && p.testing.e2e && p.testing.e2e.tagConvention) || "@<KEY>", bddStep: d.testing.bdd },
      testManagement: (p.testing && p.testing.testManagement) || "none",
    },
    memory: (p.memory) || { store: "none", collectionNaming: "", note: "" },
    ci: { host: d.ci.host, deployWorkflows: (p.ci && p.ci.deployWorkflows) || { default: d.ci.deployWorkflows }, deployGate: (p.ci && typeof p.ci.deployGate === "boolean") ? p.ci.deployGate : false, humanGatedEnvs: (p.ci && p.ci.humanGatedEnvs) || ["prod"] },
    design: (p.design) || { figma: false, note: "" },
    reporting: (p.reporting) || { daily: true, destination: "none" },
    compliance: (p.compliance) || "none",
    recoveryNotes: (p.recoveryNotes) || "",
  };
}

// ---------- prompting ----------
async function prompt(cfg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, d) => new Promise((res) => rl.question(`${q}${d ? ` [${d}]` : ""}: `, (a) => res((a || "").trim() || d || "")));
  console.log("\n- Project stack onboarding - press Enter to accept the detected default -\n");
  cfg.project.name = await ask("Project name", cfg.project.name);
  cfg.project.username = await ask("Your VCS username (for 'my PRs'/'my work')", cfg.project.username);
  cfg.issueTracker.tool = await ask("Issue tracker (github/jira/linear/none)", cfg.issueTracker.tool);
  if (cfg.issueTracker.tool === "jira") {
    cfg.issueTracker.connection = await ask("  Jira cloud (e.g. yourco.atlassian.net)", cfg.issueTracker.connection);
    cfg.issueTracker.keyPrefix = await ask("  Ticket key prefix (e.g. PROJ)", cfg.issueTracker.keyPrefix);
    cfg.issueTracker.myWorkQuery = await ask("  'My active work' JQL", cfg.issueTracker.myWorkQuery || "assignee = currentUser() AND sprint in openSprints()");
    cfg.issueTracker.handoffAssignee = await ask("  On verify, reassign to (reporter/none)", cfg.issueTracker.handoffAssignee);
  } else if (cfg.issueTracker.tool !== "none") {
    cfg.issueTracker.myWorkQuery = await ask("  'My active work' query", cfg.issueTracker.myWorkQuery);
  }
  cfg.vcs.integrationBranch = await ask("Integration branch", cfg.vcs.integrationBranch);
  cfg.commands.packageManager = await ask("Package manager", cfg.commands.packageManager);
  cfg.frontend.frameworks = (await ask("Frontend framework(s), comma-sep", cfg.frontend.frameworks.join(","))).split(",").map((s) => s.trim()).filter(Boolean);
  cfg.frontend.styling = await ask("Styling system", cfg.frontend.styling);
  cfg.backend.platform = await ask("Backend/DB platform (supabase/prisma/postgres/none)", cfg.backend.platform);
  cfg.edge.platform = await ask("Serverless/edge platform (supabase-edge-deno/lambda/netlify/none)", cfg.edge.platform);
  cfg.testing.unit.runner = await ask("Unit test runner", cfg.testing.unit.runner);
  cfg.testing.e2e.runner = await ask("E2E runner (playwright/cypress/none)", cfg.testing.e2e.runner);
  if (cfg.testing.e2e.runner !== "none") cfg.testing.e2e.tagConvention = await ask("  E2E tag convention", cfg.testing.e2e.tagConvention);
  cfg.testing.testManagement = await ask("Test-management sync (zephyr/testrail/none)", cfg.testing.testManagement);
  cfg.memory.store = await ask("Vector-memory store (qdrant/none)", cfg.memory.store);
  cfg.design.figma = /^(y|yes|true)$/i.test(await ask("Use Figma for designs? (y/n)", cfg.design.figma ? "y" : "n"));
  cfg.reporting.destination = await ask("Daily-report destination (none = push notification only; or a channel/page/issue)", cfg.reporting.destination || "none");
  cfg.compliance = await ask("Data-protection regime (none/HIPAA/GDPR/PCI/...)", cfg.compliance || "none");
  cfg.commands.commitNoAttribution = /^(y|yes|true)$/i.test(await ask("Forbid AI-attribution lines in commit messages? (y/n)", cfg.commands.commitNoAttribution ? "y" : "n"));
  rl.close();
  return cfg;
}

// ---------- rendering ----------
// Built with a backtick helper (bt) so the source contains no escaped backticks.
function renderMd(c) {
  const yn = (b) => (b ? "yes" : "no");
  const list = (a) => (a && a.length ? a.join(", ") : DASH);
  const bt = String.fromCharCode(96);
  const v = (x) => (x === 0 || x ? x : DASH);
  const code = (x) => bt + v(x) + bt;
  const states = Object.entries(c.issueTracker.states).map(([k, s]) => k + "=" + (s || DASH)).join(", ");
  const transitions = Object.keys(c.issueTracker.transitionIds).length ? JSON.stringify(c.issueTracker.transitionIds) : DASH;
  const envB = Object.keys(c.vcs.envBranches).length ? JSON.stringify(c.vcs.envBranches) : DASH;
  const fixB = Object.keys(c.vcs.fixBaseBranches).length ? JSON.stringify(c.vcs.fixBaseBranches) : DASH;
  const L = [];
  L.push("# Project stack - " + code(c.project.name));
  L.push("");
  L.push("> Source of truth for the loop-stack skills/agents/commands/loops. Generated by " + code("onboarding") + ".");
  L.push("> Edit freely, or re-run onboarding. " + code("none") + "/empty for a section means \"this project doesn't use it - skip those steps.\"");
  L.push("");
  L.push("## Project");
  L.push("- VCS host: **" + v(c.project.vcsHost) + "**");
  L.push("- Repo: **" + v(c.project.repo) + "**");
  L.push("- Your username: **" + v(c.project.username) + "**");
  L.push("");
  L.push("## Issue tracker");
  L.push("- Tool: **" + v(c.issueTracker.tool) + "**");
  L.push("- Connection: " + v(c.issueTracker.connection));
  L.push("- Ticket key prefix: " + (c.issueTracker.keyPrefix || DASH + " (e.g. GitHub #number)"));
  L.push("- \"My active work\" query: " + code(c.issueTracker.myWorkQuery));
  L.push("- Issue types: bug=" + code(c.issueTracker.issueTypes.bug) + ", story=" + code(c.issueTracker.issueTypes.story));
  L.push("- States: " + states);
  L.push("- Transition ids (if tracker needs them): " + transitions);
  L.push("- On verify, reassign to: " + v(c.issueTracker.handoffAssignee));
  L.push("");
  L.push("## Branching / PR model");
  L.push("- Integration branch: **" + v(c.vcs.integrationBranch) + "**");
  L.push("- Env -> branch: " + envB);
  L.push("- Fix base branches: " + fixB);
  L.push("- Branch naming: " + code(c.vcs.branchNaming));
  L.push("- Auto-merge: " + v(c.vcs.autoMerge) + " | respect branch protection: **always**");
  L.push("- PR-review scope: reviewer=" + code(c.vcs.prReview.reviewer) + ", watch authors=" + list(c.vcs.prReview.watchAuthors));
  L.push("");
  L.push("## Commands");
  L.push("- Package manager: **" + v(c.commands.packageManager) + "** | install: " + code(c.commands.install));
  L.push("- typecheck: " + code(c.commands.typecheck) + " | lint: " + code(c.commands.lint) + " | format: " + code(c.commands.format) + " | build: " + code(c.commands.build) + " | test: " + code(c.commands.test));
  L.push("- Commit convention: " + v(c.commands.commitConvention) + " | forbid AI-attribution in commits: " + yn(c.commands.commitNoAttribution));
  L.push("");
  L.push("## Frontend");
  L.push("- Frameworks: " + list(c.frontend.frameworks));
  L.push("- Apps/packages: " + list(c.frontend.apps));
  L.push("- Styling: " + v(c.frontend.styling));
  L.push("- Conventions: " + v(c.frontend.conventionsNote));
  L.push("");
  L.push("## Backend / database");
  L.push("- Platform: **" + v(c.backend.platform) + "** | migrations dir: " + v(c.backend.migrationsDir) + " | migrate cmd: " + v(c.backend.migrateCmd));
  L.push("");
  L.push("## Serverless / edge");
  L.push("- Platform: **" + v(c.edge.platform) + "** | functions dir: " + v(c.edge.functionsDir) + " | local restart: " + v(c.edge.localRestart));
  L.push("");
  L.push("## Testing");
  L.push("- Unit: **" + v(c.testing.unit.runner) + "** | locations: " + list(c.testing.unit.locations));
  L.push("- E2E: **" + v(c.testing.e2e.runner) + "** | dir: " + v(c.testing.e2e.dir) + " | tag: " + code(c.testing.e2e.tagConvention) + " | bdd: " + v(c.testing.e2e.bddStep));
  L.push("- Test-management sync: " + v(c.testing.testManagement));
  L.push("");
  L.push("## Vector memory / knowledge store");
  L.push("- Store: **" + v(c.memory.store) + "** | collections: " + v(c.memory.collectionNaming) + " | " + (c.memory.note || ""));
  L.push("");
  L.push("## CI / deploy");
  L.push("- CI host: **" + v(c.ci.host) + "**");
  L.push("- Deploy workflows: " + JSON.stringify(c.ci.deployWorkflows));
  L.push("- Deploy gate before verify: " + yn(c.ci.deployGate) + " | human-gated envs: " + list(c.ci.humanGatedEnvs));
  L.push("");
  L.push("## Design");
  L.push("- Figma: " + yn(c.design.figma) + (c.design.note ? " | " + c.design.note : ""));
  L.push("");
  L.push("## Reporting");
  L.push("- Daily report: " + yn(c.reporting.daily) + " | destination: **" + v(c.reporting.destination) + "** (none = push notification only)");
  L.push("");
  L.push("## Compliance / data protection");
  L.push("- Regime: **" + (c.compliance || "none") + "** (reviewers apply data-protection/sensitive-data checks only when this is not \"none\"; e.g. HIPAA, GDPR, PCI)");
  L.push("");
  L.push("## Project recovery / runbook notes");
  L.push(c.recoveryNotes || "_(none - add project-specific recovery steps here; skills reference this section instead of baking them in.)_");
  L.push("");
  return L.join("\n");
}

// ---------- main ----------
const detected = detect();

if (DETECT_ONLY) {
  console.log(JSON.stringify(detected, null, 2));
  process.exit(0);
}

const prev = readJSON(path.resolve(OUT, "stack.json"));
let cfg = defaultsFrom(detected, prev);
if (!NON_INTERACTIVE) cfg = await prompt(cfg);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.resolve(OUT, "stack.json"), JSON.stringify(cfg, null, 2) + "\n");
fs.writeFileSync(path.resolve(OUT, "stack.md"), renderMd(cfg));

// Per-project loop state (park/dedupe files). Lives inside the project so parallel projects
// never share state (global /tmp would collide issue keys, PR numbers, and deploy run IDs
// across repos — and gets wiped on reboot). Gitignored: state is machine-local, not shared.
const stateDir = path.resolve(OUT, "loops", "state");
fs.mkdirSync(stateDir, { recursive: true });
const gitignorePath = path.resolve(ROOT, ".gitignore");
const stateIgnore = ".claude/loops/state/";
const gi = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
if (!gi.split("\n").some((l) => l.trim() === stateIgnore || l.trim() === stateIgnore.slice(0, -1))) {
  fs.writeFileSync(gitignorePath, gi + (gi && !gi.endsWith("\n") ? "\n" : "") + stateIgnore + "\n");
  console.log("  Added " + stateIgnore + " to .gitignore (per-project loop state).");
}

console.log("\nWrote " + path.relative(ROOT, path.resolve(OUT, "stack.json")) + " and " + path.relative(ROOT, path.resolve(OUT, "stack.md")));
console.log("  The loop-stack skills now read this instead of asking project-specific questions.");
console.log("  Review .claude/stack.md and tweak anything (especially issue-tracker states/transitions).");

// Drop the universal, config-driven CLAUDE.md at the project root if one isn't there yet.
// It is project-agnostic (reads .claude/stack.md), so we never clobber an existing file.
const claudeMdPath = path.resolve(ROOT, "CLAUDE.md");
if (!fs.existsSync(claudeMdPath)) {
  const tplPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "CLAUDE.template.md");
  try {
    fs.copyFileSync(tplPath, claudeMdPath);
    console.log("  Wrote " + path.relative(ROOT, claudeMdPath) + " (universal entry point; reads .claude/stack.md).");
  } catch {
    console.log("  Note: copy skills/onboarding/CLAUDE.template.md to ./CLAUDE.md for the universal entry point.");
  }
} else {
  console.log("  CLAUDE.md already exists — left untouched. See skills/onboarding/CLAUDE.template.md for the universal version.");
}
