#!/usr/bin/env node
/**
 * element-map.mjs — parses every JSX file (.tsx/.jsx) into a structural tree
 * that captures BOTH component usages and raw HTML tags, since real pages are a
 * mix of the two. Raw HTML tags are where drift hides (ad-hoc className, inline
 * styles, Tailwind arbitrary values) because they bypass the component layer.
 *
 * Uses @babel/parser (real AST — regex cannot handle JSX correctly).
 * Emits design-audit/element-map.json.
 *
 *   node element-map.mjs                 # all JSX files under src dirs
 *   node element-map.mjs --depth 6       # cap tree depth (default 8)
 *   node element-map.mjs --trees         # include full nested trees per file
 *
 * Requires: npm i -D @babel/parser
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MAX_DEPTH = parseInt(getArg("--depth", "8"));
const INCLUDE_TREES = args.includes("--trees");

const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const fw = readJSON(path.join(ROOT, "design-audit", "framework.json")) || { srcDirs: ["src"] };

// Resolve a dependency from the TARGET project (cwd) first. ESM bare imports
// resolve relative to this file (inside the plugin), not the user's project, so
// we anchor a require at the cwd to find project-installed deps.
async function importFromProject(name) {
  try {
    const req = createRequire(path.join(ROOT, "__resolve__.js"));
    return await import(pathToFileURL(req.resolve(name)).href);
  } catch {}
  try { return await import(name); } catch {}
  return null;
}

let parse;
const babel = await importFromProject("@babel/parser");
if (babel) parse = babel.parse || (babel.default && babel.default.parse);
if (!parse) {
  console.error("\n✗ @babel/parser not found. Install it in your project:\n  npm i -D @babel/parser\n");
  process.exit(1);
}

const JSX_EXTS = [".tsx", ".jsx"];

function walkDir(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(f, acc); else acc.push(f);
  }
  return acc;
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

// Top-most JSX nodes within an arbitrary expression (stops descending at JSX).
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

function memberName(n) {
  return n.type === "JSXMemberExpression"
    ? memberName(n.object) + "." + n.property.name
    : n.name;
}

function jsxName(node) {
  if (node.type === "JSXFragment") return { kind: "fragment", name: "<>" };
  const n = node.openingElement.name;
  let name = "unknown";
  if (n.type === "JSXIdentifier") name = n.name;
  else if (n.type === "JSXMemberExpression") name = memberName(n);
  else if (n.type === "JSXNamespacedName") name = n.namespace.name + ":" + n.name.name;
  // Lowercase first letter and not dotted → intrinsic HTML element
  const isHtml = /^[a-z]/.test(name) && !name.includes(".");
  return { kind: isHtml ? "html" : "component", name };
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

const ARBITRARY_RE = /[\w-]*\[[^\]]+\]/g; // Tailwind arbitrary values: bg-[#2e3440], text-[13px], p-[7px]

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

function arbitraryFrom(className) {
  const text = typeof className === "string" ? className : (className && className.expr) || "";
  return [...new Set(text.match(ARBITRARY_RE) || [])];
}

function jsxChildren(node) {
  const kids = [];
  for (const child of node.children || []) {
    if (child.type === "JSXElement" || child.type === "JSXFragment") kids.push(child);
    else if (child.type === "JSXExpressionContainer") topJsxIn(child.expression, kids);
  }
  return kids;
}

function buildNode(jsx, code, depth) {
  const { kind, name } = jsxName(jsx);
  const node = { type: kind, name };
  if (kind !== "fragment") {
    const a = getAttrs(jsx, code);
    if (a.className != null) node.className = a.className;
    if (a.id != null) node.id = a.id;
    if (a.inlineStyle != null) node.inlineStyle = a.inlineStyle;
    const arb = arbitraryFrom(a.className);
    if (arb.length) node.arbitrary = arb;
  }
  if (jsx.loc) node.loc = `${jsx.loc.start.line}:${jsx.loc.start.column}`;
  const kids = depth < MAX_DEPTH ? jsxChildren(jsx).map((k) => buildNode(k, code, depth + 1)) : [];
  if (kids.length) node.children = kids;
  return node;
}

function fileKind(rel) {
  const b = path.basename(rel);
  if (/^layout\.[jt]sx?$/.test(b)) return "layout";
  if (/^(page|route)\.[jt]sx?$/.test(b)) return "page";
  if (/[\\/]pages[\\/]/.test(rel) && !/[\\/]api[\\/]/.test(rel) && !/_app|_document/.test(b)) return "page";
  return "component";
}

function summarize(trees) {
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
  trees.forEach(visit);
  return { htmlTags, components, styledHtmlTags: styled };
}

// ── Run ──────────────────────────────────────────────────────────────────────

const dirs = (fw.srcDirs?.length ? fw.srcDirs : ["src", "app", "components"]).map((d) => path.join(ROOT, d));
const files = [...new Set(dirs.flatMap((d) => walkDir(d)))]
  .filter((f) => JSX_EXTS.some((x) => f.endsWith(x)) && !/\.(test|spec|stories)\./.test(f));

console.log(`\n🌳 Parsing ${files.length} JSX files into element trees\n`);

const fileMap = {};
const htmlFreq = {}, compFreq = {};
let parseErrors = 0, totalHtml = 0, totalComp = 0, totalStyled = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  let code;
  try { code = fs.readFileSync(file, "utf8"); } catch { continue; }

  let ast;
  try {
    ast = parse(code, {
      sourceType: "module",
      errorRecovery: true,
      plugins: ["jsx", "typescript", "decorators-legacy", "classProperties"],
    });
  } catch (e) {
    parseErrors++;
    process.stderr.write(`  ⚠ parse error ${rel}: ${String(e.message).split("\n")[0]}\n`);
    continue;
  }

  // Roots = outermost JSX nodes (not a JSX child of another JSX node)
  const allJsx = [];
  astWalk(ast, (n) => { if (n.type === "JSXElement" || n.type === "JSXFragment") allJsx.push(n); });
  const childSet = new Set();
  for (const j of allJsx) for (const c of jsxChildren(j)) childSet.add(c);
  const roots = allJsx.filter((j) => !childSet.has(j));

  const trees = roots.map((r) => buildNode(r, code, 0));
  const sum = summarize(trees);

  for (const [t, n] of Object.entries(sum.htmlTags)) { htmlFreq[t] = (htmlFreq[t] || 0) + n; totalHtml += n; }
  for (const [c, n] of Object.entries(sum.components)) { compFreq[c] = (compFreq[c] || 0) + n; totalComp += n; }
  totalStyled += sum.styledHtmlTags.length;

  fileMap[rel] = {
    kind: fileKind(rel),
    htmlTags: sum.htmlTags,
    components: sum.components,
    styledHtmlTags: sum.styledHtmlTags,
    ...(INCLUDE_TREES ? { tree: trees } : {}),
  };
}

const sortDesc = (obj) => Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]));

const output = {
  generatedAt: new Date().toISOString(),
  framework: fw.framework || "unknown",
  note: "JSX files only (.tsx/.jsx). styledHtmlTags = raw HTML elements carrying className/style/arbitrary values — the primary source-level drift surface.",
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
