#!/usr/bin/env node
/**
 * project-map.ts
 *
 * Generates a page → component tree for Next.js (app/ and pages/ router).
 * Zero external dependencies — runs with: npx tsx project-map.ts
 *
 * Outputs:
 *   design-audit/project-map.json   — machine-readable, feeds inventory agent
 *   design-audit/project-map.md     — human-readable tree for review
 *
 * Options:
 *   --depth=4          max component recursion depth (default: 4)
 *   --out=path.json    override output path
 *   --skip-shared      omit shared-component section in md
 */

import fs from "fs";
import path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const args = process.argv.slice(2);
const MAX_DEPTH = parseInt(arg("--depth") ?? "4");
const OUT_JSON = arg("--out") ?? "design-audit/project-map.json";
const OUT_MD = OUT_JSON.replace(/\.json$/, ".md");
const SKIP_SHARED = args.includes("--skip-shared");

function arg(name: string): string | undefined {
  const found = args.find((a) => a.startsWith(name + "="));
  return found?.split("=")[1];
}

// ─── Filesystem helpers ───────────────────────────────────────────────────────

function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

const COMPONENT_EXTS = [".tsx", ".ts", ".jsx", ".js"];

function walk(dir: string): string[] {
  if (!exists(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (COMPONENT_EXTS.some((e) => entry.name.endsWith(e)))
      results.push(full);
  }
  return results;
}

// ─── Detect router dirs ───────────────────────────────────────────────────────

function findDir(...candidates: string[]): string | null {
  return candidates.find(exists) ?? null;
}

const appDir = findDir(
  path.join(ROOT, "src", "app"),
  path.join(ROOT, "app")
);
const pagesDir = findDir(
  path.join(ROOT, "src", "pages"),
  path.join(ROOT, "pages")
);
const componentsDir = findDir(
  path.join(ROOT, "src", "components"),
  path.join(ROOT, "components")
);

// ─── tsconfig path aliases ────────────────────────────────────────────────────

type PathMap = Record<string, string[]>;
let tsPaths: PathMap = {};
let tsBaseUrl = "";

try {
  const raw = fs.readFileSync(path.join(ROOT, "tsconfig.json"), "utf8");
  // Strip JSON comments (tsconfig allows them)
  const clean = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const tsconfig = JSON.parse(clean);
  tsPaths = tsconfig.compilerOptions?.paths ?? {};
  tsBaseUrl = tsconfig.compilerOptions?.baseUrl
    ? path.join(ROOT, tsconfig.compilerOptions.baseUrl)
    : ROOT;
} catch {
  // No tsconfig or parse error — continue without aliases
}

// ─── Import extraction (regex-based, no AST needed) ──────────────────────────

interface RawImport {
  specifier: string;
  isStyle: boolean;
  isDynamic: boolean;
}

function extractImports(filePath: string): RawImport[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }

  const imports: RawImport[] = [];
  const seen = new Set<string>();

  function add(specifier: string, isDynamic = false) {
    if (seen.has(specifier)) return;
    seen.add(specifier);
    const isStyle = /\.(css|scss|sass|less|styl)$/.test(specifier);
    imports.push({ specifier, isStyle, isDynamic });
  }

  // Static: import ... from 'x'
  const staticRe =
    /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = staticRe.exec(content))) add(m[1]);

  // Side-effect: import 'x'
  const sideEffectRe = /import\s+['"]([^'"]+)['"]/g;
  while ((m = sideEffectRe.exec(content))) add(m[1]);

  // Dynamic: import('x')
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(content))) add(m[1], true);

  // require('x')
  const reqRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reqRe.exec(content))) add(m[1]);

  return imports;
}

// ─── Specifier → absolute path resolution ────────────────────────────────────

function resolveSpecifier(
  specifier: string,
  fromFile: string
): string | null {
  const tryExts = (base: string): string | null => {
    // Exact file
    if (isFile(base)) return base;
    // With extension
    for (const ext of COMPONENT_EXTS) {
      if (isFile(base + ext)) return base + ext;
    }
    // Index file
    for (const ext of COMPONENT_EXTS) {
      const idx = path.join(base, "index" + ext);
      if (isFile(idx)) return idx;
    }
    return null;
  };

  // 1. Relative import
  if (specifier.startsWith(".")) {
    return tryExts(path.resolve(path.dirname(fromFile), specifier));
  }

  // 2. tsconfig path aliases (e.g. @/components/Button → src/components/Button)
  for (const [alias, targets] of Object.entries(tsPaths)) {
    const aliasPattern = alias.endsWith("/*")
      ? alias.slice(0, -2)
      : alias;
    const isWildcard = alias.endsWith("/*");

    if (
      isWildcard
        ? specifier.startsWith(aliasPattern + "/")
        : specifier === aliasPattern
    ) {
      const suffix = isWildcard
        ? specifier.slice(aliasPattern.length + 1)
        : "";
      for (const target of targets) {
        const targetBase = target.endsWith("/*")
          ? target.slice(0, -2)
          : target;
        const candidate = path.join(ROOT, targetBase, suffix);
        const resolved = tryExts(candidate);
        if (resolved) return resolved;
      }
    }
  }

  // 3. baseUrl resolution (e.g. components/Button without @)
  if (tsBaseUrl) {
    const candidate = path.join(tsBaseUrl, specifier);
    const resolved = tryExts(candidate);
    if (resolved) return resolved;
  }

  // 4. src/ prefix fallback
  for (const base of ["src", ""]) {
    const candidate = path.join(ROOT, base, specifier);
    const resolved = tryExts(candidate);
    if (resolved) return resolved;
  }

  return null;
}

// ─── Component vs utility heuristics ─────────────────────────────────────────

// Files we don't want to recurse into
const SKIP_PATTERNS = [
  /node_modules/,
  /\/(api|hooks?|utils?|helpers?|lib|store|context|providers?|services?|types?|constants?|config)\//i,
  /\.(test|spec|stories|d)\.(tsx?|jsx?)$/,
];

function shouldInclude(filePath: string): boolean {
  const rel = path.relative(ROOT, filePath);
  if (SKIP_PATTERNS.some((p) => p.test(rel))) return false;

  // Must be inside project (not node_modules)
  if (!filePath.startsWith(ROOT)) return false;

  // Prefer files that are plausibly React components:
  // PascalCase name, or lives in a components/ directory
  const basename = path.basename(filePath, path.extname(filePath));
  const inComponentsDir = componentsDir
    ? filePath.startsWith(componentsDir)
    : false;
  const isPascalCase = /^[A-Z]/.test(basename);

  return inComponentsDir || isPascalCase;
}

// ─── Component tree ───────────────────────────────────────────────────────────

export interface ComponentNode {
  name: string;
  relPath: string;
  depth: number;
  styles: string[];       // CSS/module files this component imports
  children: ComponentNode[];
}

// Cache keyed by "filepath:depth" to avoid re-walking shared components
const treeCache = new Map<string, ComponentNode[]>();

function buildTree(
  filePath: string,
  depth: number,
  visited: Set<string>
): ComponentNode[] {
  if (depth <= 0 || visited.has(filePath)) return [];

  const cacheKey = `${filePath}:${depth}`;
  if (treeCache.has(cacheKey)) return treeCache.get(cacheKey)!;

  visited.add(filePath);
  const imports = extractImports(filePath);
  const nodes: ComponentNode[] = [];

  // Collect style imports declared in THIS file
  const styles = imports
    .filter((i) => i.isStyle)
    .map((i) => {
      const resolved = resolveSpecifier(i.specifier, filePath);
      return resolved
        ? path.relative(ROOT, resolved)
        : i.specifier;
    });

  for (const imp of imports) {
    if (imp.isStyle) continue;

    const resolved = resolveSpecifier(imp.specifier, filePath);
    if (!resolved || !shouldInclude(resolved)) continue;
    if (visited.has(resolved)) continue;

    const basename = path.basename(resolved, path.extname(resolved));
    const childImports = extractImports(resolved);
    const childStyles = childImports
      .filter((i) => i.isStyle)
      .map((i) => {
        const r = resolveSpecifier(i.specifier, resolved);
        return r ? path.relative(ROOT, r) : i.specifier;
      });

    nodes.push({
      name: basename,
      relPath: path.relative(ROOT, resolved),
      depth,
      styles: childStyles,
      children: buildTree(resolved, depth - 1, new Set(visited)),
    });
  }

  treeCache.set(cacheKey, nodes);
  return nodes;
}

// Flatten a tree to unique rel paths (breadth-first)
function flatten(nodes: ComponentNode[]): string[] {
  const seen = new Set<string>();
  const queue = [...nodes];
  const result: string[] = [];
  while (queue.length) {
    const node = queue.shift()!;
    if (!seen.has(node.relPath)) {
      seen.add(node.relPath);
      result.push(node.relPath);
    }
    queue.push(...node.children);
  }
  return result;
}

// ─── Page discovery ───────────────────────────────────────────────────────────

interface PageEntry {
  route: string;
  file: string;
  segment: string; // 'page' | 'layout' | etc.
}

// App router: any file named page.tsx, layout.tsx, loading.tsx, error.tsx, etc.
const APP_SEGMENTS = [
  "page",
  "layout",
  "template",
  "loading",
  "error",
  "not-found",
  "global-error",
];

function discoverAppPages(): PageEntry[] {
  if (!appDir) return [];
  const pages: PageEntry[] = [];

  for (const file of walk(appDir)) {
    const basename = path.basename(file, path.extname(file));
    if (!APP_SEGMENTS.includes(basename)) continue;

    const rel = path.relative(appDir, path.dirname(file));
    // Strip route groups (parentheses) from route
    const routeParts = rel
      .replace(/\\/g, "/")
      .split("/")
      .filter((p) => p && !p.startsWith("(") && p !== ".");

    const route = "/" + routeParts.join("/");
    pages.push({ route, file, segment: basename });
  }

  return pages;
}

// Pages router: any .tsx/.ts file not in _app, _document, api/
function discoverPagesPages(): PageEntry[] {
  if (!pagesDir) return [];
  const pages: PageEntry[] = [];

  for (const file of walk(pagesDir)) {
    const rel = path.relative(pagesDir, file);
    if (rel.startsWith("api/") || rel.startsWith("_")) continue;

    const withoutExt = rel.replace(/\.(tsx?|jsx?)$/, "").replace(/\\/g, "/");
    const route =
      "/" + (withoutExt === "index" ? "" : withoutExt.replace(/\/index$/, ""));

    pages.push({ route, file, segment: "page" });
  }

  return pages;
}

// ─── Markdown rendering ───────────────────────────────────────────────────────

function renderTreeMd(nodes: ComponentNode[], indent = 0): string {
  return nodes
    .map((n) => {
      const prefix = "  ".repeat(indent) + "├─ ";
      const styleTag =
        n.styles.length > 0
          ? ` [css: ${n.styles.map((s) => path.basename(s)).join(", ")}]`
          : "";
      const line = prefix + n.name + styleTag + "\n";
      return line + renderTreeMd(n.children, indent + 1);
    })
    .join("");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const allPages: PageEntry[] = [
  ...discoverAppPages(),
  ...discoverPagesPages(),
];

if (allPages.length === 0) {
  console.error(
    "❌  No pages found. Make sure you run this from your Next.js project root."
  );
  process.exit(1);
}

console.log(`\n🗺  Project Map — scanning ${allPages.length} page entries\n`);

const componentUsage: Record<string, string[]> = {};

interface PageMapEntry {
  file: string;
  segment: string;
  componentCount: number;
  components: string[];
  tree: ComponentNode[];
}

const pageMap: Record<string, PageMapEntry> = {};

for (const { route, file, segment } of allPages) {
  const tree = buildTree(file, MAX_DEPTH, new Set());
  const flat = flatten(tree);
  const key = route === "/" ? "/" : route;
  const label = `${key} [${segment}]`;

  pageMap[label] = {
    file: path.relative(ROOT, file),
    segment,
    componentCount: flat.length,
    components: flat,
    tree,
  };

  for (const c of flat) {
    if (!componentUsage[c]) componentUsage[c] = [];
    componentUsage[c].push(label);
  }

  console.log(`  ${label.padEnd(48)} ${flat.length} components`);
}

// Shared components: used on 2+ distinct routes
const sharedComponents = Object.entries(componentUsage)
  .filter(([, pages]) => new Set(pages.map((p) => p.split(" [")[0])).size > 1)
  .sort((a, b) => b[1].length - a[1].length);

// ─── Build JSON output ────────────────────────────────────────────────────────

const output = {
  generatedAt: new Date().toISOString(),
  projectRoot: ROOT,
  options: { maxDepth: MAX_DEPTH },
  summary: {
    totalPages: allPages.length,
    uniqueComponents: Object.keys(componentUsage).length,
    sharedComponents: sharedComponents.length,
    routerType: appDir && pagesDir ? "mixed" : appDir ? "app" : "pages",
  },
  pages: pageMap,
  componentRegistry: Object.fromEntries(
    Object.entries(componentUsage).map(([comp, pages]) => [
      comp,
      { usedOnPages: pages, usageCount: pages.length },
    ])
  ),
};

// ─── Build Markdown output ────────────────────────────────────────────────────

let md = `# Project map\n\n`;
md += `Generated: \`${new Date().toISOString()}\`  \n`;
md += `Root: \`${ROOT}\`  \n`;
md += `Router: \`${output.summary.routerType}\` · depth: \`${MAX_DEPTH}\`\n\n`;
md += `---\n\n`;
md += `## Summary\n\n`;
md += `| | |\n|---|---|\n`;
md += `| Pages | ${output.summary.totalPages} |\n`;
md += `| Unique components | ${output.summary.uniqueComponents} |\n`;
md += `| Shared components | ${output.summary.sharedComponents} |\n\n`;
md += `---\n\n`;
md += `## Pages\n\n`;

for (const [label, entry] of Object.entries(pageMap)) {
  md += `### \`${label}\`\n`;
  md += `\`${entry.file}\` — **${entry.componentCount} components**\n\n`;
  if (entry.tree.length === 0) {
    md += `_No local component imports found_\n\n`;
  } else {
    md += "```\n" + renderTreeMd(entry.tree) + "```\n\n";
  }
}

if (!SKIP_SHARED && sharedComponents.length > 0) {
  md += `---\n\n## Shared components\n\n`;
  md += `Components used on more than one route (high-impact for CSS fixes):\n\n`;
  for (const [comp, pages] of sharedComponents) {
    const routes = [...new Set(pages.map((p) => p.split(" [")[0]))];
    md += `- \`${comp}\` — ${routes.length} routes`;
    if (routes.length <= 4) md += `: ${routes.join(", ")}`;
    md += `\n`;
  }
}

// ─── Write output ─────────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(path.join(ROOT, OUT_JSON)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT_JSON), JSON.stringify(output, null, 2));
fs.writeFileSync(path.join(ROOT, OUT_MD), md);

console.log(`\n✅  Written:`);
console.log(`   ${OUT_JSON}`);
console.log(`   ${OUT_MD}`);
console.log(
  `\n   ${output.summary.uniqueComponents} unique components across ${output.summary.totalPages} pages`
);
console.log(
  `   ${output.summary.sharedComponents} shared components (high CSS audit priority)\n`
);
