---
name: credit-efficient-workflow
description: Use this for any non-trivial task — multi-step features, refactors, debugging investigations, research, or anything likely to span more than a couple of tool calls or a few back-and-forth turns. Front-loads scope and plan confirmation, keeps context lean, batches work, enforces tight output specs, and self-critiques before declaring done — all to cut wasted tokens/credits and avoid rework. Trigger this proactively at the start of substantial work, not only when the user explicitly asks to "save credits," "be efficient," or "watch usage."
---

# Credit-Efficient Workflow

Every wasted round-trip — a vague plan that gets redone, a search that ranges too wide, an edit sent one tweak at a time, an answer padded past what was asked — burns tokens and the user's patience. This skill is a checklist for avoiding that, organized around where waste actually happens: before a task starts, while gathering context, while executing, in the output itself, and at the finish line.

None of this is about doing less work — it's about not doing the same work twice.

## 1. Before starting: lock scope, don't guess it

- **One goal per task.** If a request bundles several unrelated asks, do them as a clear sequence rather than blurring them into one pass — mixing goals is how partial results and re-do requests happen.
- **Treat the first message as the full brief.** Pull goal, constraints, and desired format from it rather than executing on a partial reading and course-correcting later.
- **For anything multi-step or ambiguous, state a short plan and get a nod before wide execution.** A two-line plan ("I'll do X, touching files A/B, output as Y — sound right?") is far cheaper than redoing a wrong-direction implementation.
- **If scope is genuinely unclear, ask one sharp clarifying question before a long task — not after.** Don't ask about things you can infer from the repo/conversation; ask only what actually changes the approach.
- **Respect any scope limits the user gives** ("just check these 3 files," "don't touch tests") as hard caps, not suggestions to be gently exceeded.

## 2. Gathering context without re-deriving it

- **Prefer exact references over re-discovery.** If the user names a file, function, or doc, go straight there instead of re-searching the codebase to "confirm."
- **Use what's already been provided** — attached files, pasted samples, existing project conventions (CLAUDE.md, style guides, prior decisions in this session) — rather than re-deriving conventions from scratch or asking questions already answered upstream.
- **Notice when context has gone stale or bloated** (long thread, several pivots, contradictory earlier statements) and say so — recommend a fresh session/task rather than dragging a confused context forward, which quietly degrades every subsequent turn.
- **If you genuinely need a sample to match a format or style, ask for one or two examples** rather than iterating blind through several guesses.

## 3. Executing without unnecessary round-trips

- **Once scope is confirmed, run it through rather than pausing for low-value check-ins.** Interrupting a working plan to ask permission for expected sub-steps costs more than it saves — save questions for things that would actually change direction.
- **Batch related changes into one pass.** If five small edits are needed across a file or a request, make all five before reporting back, rather than a loop of one-edit-then-check.
- **When the user corrects something, apply the fix directly rather than regenerating the whole output from scratch.** "Rephrase, don't restart" — a targeted patch preserves everything that was already right.

## 4. Output discipline

- **Match the requested length and format exactly.** Padding a short answer or over-explaining a simple fix wastes tokens on both sides; conversely, don't truncate something that was asked to be thorough.
- **Be as specific as the task allows.** Concrete file names, line numbers, and values beat vague descriptions — vagueness is what causes the next message to be a clarifying question instead of forward progress.

## 5. Before calling it done

- **Self-critique against the original brief before presenting something as final**, especially for anything long-form, structural, or user-facing: does it actually satisfy the stated goal and constraints, or does it just look plausible? Catching a gap here is cheaper than the user catching it after.

## 6. Session and tooling hygiene (worth surfacing to the user, not just self-applying)

These are habits that live outside any single task, but it's worth flagging them when relevant rather than assuming the user already optimizes for them:

- **New topic → suggest a new session/task** rather than one thread accumulating unrelated work; it keeps context focused and cheap.
- **Recurring instructions belong in persistent project config** (CLAUDE.md, project docs, a template) instead of being re-typed each time — if you notice the same brief being given repeatedly, suggest capturing it once.
- **Recurring work belongs in a scheduled/automated task**, not a daily re-prompt — if a request looks like it happens routinely, mention that option.
- **If usage or credits come up, point the user to where they can check consumption** rather than guessing at their budget.

## Quick self-check

Before finishing a substantial task, it should be true that:

- [ ] Scope was confirmed (or was unambiguous) before broad work started
- [ ] Context came from what was given/pointed to, not redundant re-discovery
- [ ] Related changes were batched, not trickled out one at a time
- [ ] The output matches the requested format/length — no padding, no truncation
- [ ] The result was checked against the original ask before being presented as final
