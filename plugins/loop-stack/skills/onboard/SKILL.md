---
name: onboard
description: One-time per-project setup for the loop stack. Detects the project's stack (VCS, issue tracker, package manager, frameworks, backend/DB, edge, tests, CI/deploy) and writes .claude/stack.md — the single config every other skill, agent, command, and loop reads instead of asking project-specific questions. Use when bringing the loop stack to a new project, when the user says "onboard this project", "set up the stack here", "configure for this repo", or when a skill reports that .claude/stack.md is missing.
---

# Onboarding

## Purpose

Make the loop stack portable. Run this **once** in a project and it captures everything project-specific — issue tracker + how "my work" is queried, branch model, package manager, frameworks, backend/DB, edge runtime, test runners + e2e tag convention, CI/deploy workflows, design tool — into **`.claude/stack.md`** (plus a machine-readable `.claude/stack.json`).

Every other skill/agent/command/loop reads `.claude/stack.md` for these values. Nothing is hardcoded, so the same stack works in any repo. Anything left `none`/empty means "this project doesn't use it — skip those steps."

## When to use

- Bringing the loop stack to a new project for the first time.
- User says: "onboard this project", "set up the stack here", "configure for this repo", "re-run onboarding".
- Any skill reports `.claude/stack.md` is missing or incomplete.

## How to run

1. From the project root, run the bundled script:

   ```bash
   node <this-skill-dir>/onboard.mjs
   ```

   - It auto-detects what it can, then prompts you to confirm/fill the rest (Enter accepts each detected default).
   - `--detect-only` prints what it found and writes nothing (use it to preview).
   - `--non-interactive` writes using detected values + defaults (good for CI or a quick first pass).
   - Re-running loads the existing `.claude/stack.json` as defaults, so edits are preserved.

2. If you can't run Node interactively, do **guided onboarding** instead: run `node onboard.mjs --detect-only`, then walk the user through each field (see the sections in the generated `stack.md`) and write `.claude/stack.md` + `.claude/stack.json` yourself from their answers.

3. Open **`.claude/stack.md`** and confirm the issue-tracker section especially — workflow **state names** and (for Jira) **transition ids** can't be auto-detected and matter most to the loops.

## After onboarding

- Tell the user the config path and that they can edit it any time or re-run this skill.
- If the project had no root `CLAUDE.md`, onboarding also drops the universal, config-driven
  `CLAUDE.template.md` as `./CLAUDE.md` (the entry point — invariants + skills map, all specifics
  read from `.claude/stack.md`). An existing `CLAUDE.md` is left untouched; merge from
  `skills/onboard/CLAUDE.template.md` if desired.
- Point them at `launch-loop-stack` to start the autonomous loops, now driven by their config.

## Contract for every other skill

> Read `.claude/stack.md` at the start. Use its values; never assume a specific tool.
> If a needed section is `none`/empty, **skip** those steps (don't ask, don't invent).
> If `.claude/stack.md` is missing, tell the user to run `onboard` and stop.

See `CONVENTIONS.md` at the repo root for the full token → config mapping.
