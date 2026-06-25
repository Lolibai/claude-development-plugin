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
