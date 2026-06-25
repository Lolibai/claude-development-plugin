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
