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

## Autonomous loop stack (universal)

This repo also ships a portable, **config-driven** autonomous dev loop stack — skills, agents, commands, and loops that drive a "my work in the active iteration" workflow (auto-fix → verify → PR-review → deploy-fix) in **any** project. Nothing is hardcoded; project specifics live in `.claude/stack.md`.

Bring it to a project:

```bash
# 1. Put the stack in the project's .claude/ (copy skills/ agents/ commands/ loops/), or install as a plugin
# 2. Onboard once — detects your stack and writes .claude/stack.md
node skills/onboarding/onboarding.mjs
# 3. Launch the loops (now driven entirely by your config)
#    → run the `launch-loop-stack` skill
```

Anything the config marks `none` is skipped (no CI → no deploy gate; GitHub Issues → no Jira transitions; no e2e runner → no e2e gate). See `MANIFEST.md` for the loop list and `CONVENTIONS.md` for how every file stays project-agnostic.

## Repository layout

```
.claude-plugin/marketplace.json    # marketplace registry (lists css-drift-auditor)
plugins/css-drift-auditor/         # the CSS-drift plugin
skills/  agents/  commands/  loops/ # the universal autonomous loop stack
skills/onboarding/                 # onboarding.mjs → writes .claude/stack.md
CONVENTIONS.md  MANIFEST.md         # how the stack stays universal + what it contains
.github/workflows/validate.yml     # CI: syntax-checks scripts, validates manifests
```

## License

MIT — see [LICENSE](./LICENSE).
