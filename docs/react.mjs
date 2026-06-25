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
