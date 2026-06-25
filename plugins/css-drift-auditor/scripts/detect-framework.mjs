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
