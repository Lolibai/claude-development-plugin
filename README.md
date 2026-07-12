# dev-tools — Claude Code plugin marketplace

A Claude Code plugin marketplace with two plugins: **loop-stack** (a universal, config-driven autonomous dev loop stack) and **css-drift-auditor** (a framework-agnostic pipeline for auditing and normalizing CSS/design drift).

## Install

```bash
# 1. Add this marketplace
/plugin marketplace add Lolibai/claude-development-plugin

# 2. Install what you need
/plugin install loop-stack@dev-tools
/plugin install css-drift-auditor@dev-tools
```

## loop-stack — autonomous dev loop stack (universal)

A portable, **config-driven** set of skills, agents, commands, and loops that drive a "my work in the active iteration" workflow in **any** project: auto-fix assigned bugs → verify against AC + deploys → review requested PRs → shepherd your own PRs to merge → repair failed deployments → sync fix-base branches → daily standup report with parked-item escalation. Nothing is hardcoded; project specifics live in `.claude/stack.md`.

Bring it to a project:

```bash
# 1. Install the plugin (above), or copy plugins/loop-stack/{skills,agents,commands,loops} into the project's .claude/
# 2. Onboard once — detects your stack, writes .claude/stack.md, prepares .claude/loops/ (specs + gitignored state/)
node plugins/loop-stack/skills/onboarding/onboarding.mjs
# 3. Launch the loops (now driven entirely by your config)
#    → run the `launch-loop-stack` skill
```

Anything the config marks `none` is skipped (no CI → no deploy gate; GitHub Issues → no Jira transitions; no e2e runner → no e2e gate). See [plugins/loop-stack/MANIFEST.md](./plugins/loop-stack/MANIFEST.md) for the loop list and [plugins/loop-stack/CONVENTIONS.md](./plugins/loop-stack/CONVENTIONS.md) for how every file stays project-agnostic.

## css-drift-auditor

`css-drift-auditor` ([plugin readme](./plugins/css-drift-auditor/README.md)) renders every component in Storybook and reads **post-cascade computed styles** — the real pixel values after Tailwind, theme providers, CSS variables, and inheritance resolve — then clusters them into a token scale and flags low-usage outliers as drift. It also parses source into a mixed html + component tree (React `.tsx`/`.jsx` and Angular `*.component.ts`) to catch raw HTML tags carrying ad-hoc `className`, inline styles, or Tailwind arbitrary values — the elements that bypass the component layer, where drift concentrates. No Figma required.

Per-project prerequisites (Claude Code prompts before installing any of them):
- Storybook (`npx storybook@latest init`)
- Playwright (`npm i -D playwright && npx playwright install chromium`)
- `@babel/parser`, and `parse5` for Angular (`npm i -D @babel/parser parse5`)

## Repository layout

```
.claude-plugin/marketplace.json    # marketplace registry (loop-stack + css-drift-auditor)
plugins/loop-stack/                # the autonomous loop stack plugin
plugins/loop-stack/skills/onboarding/  # onboarding.mjs → writes .claude/stack.md
plugins/loop-stack/{MANIFEST,CONVENTIONS}.md  # what the stack contains + how it stays universal
plugins/css-drift-auditor/         # the CSS-drift plugin
.github/workflows/validate.yml     # CI: syntax-checks scripts, validates manifests
```

## License

MIT — see [LICENSE](./LICENSE).
