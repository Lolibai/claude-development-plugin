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
