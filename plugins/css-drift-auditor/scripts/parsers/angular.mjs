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
