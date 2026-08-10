# Loop: TRACEABILITY — spec ↔ story ↔ code ↔ test

A session-scoped cron that walks **one issue per tick** across the whole delivery chain and records
where the chain is broken: does the story have a spec page, does the spec's AC match the code, does
the story have a test scenario, does that scenario exist as a runnable test. You own this file — edit
it, then re-register the cron.

> **Config-driven.** Read `.claude/stack.md` first. Tracker + query from `${issueTracker.*}`, docs
> platform from `${docs.*}`, test management from `${testing.testManagement}`, e2e layout from
> `${testing.e2e.*}`, repos from `${project.repo}`. If a section is `none`/empty, **skip that link in
> the chain and record it as not-applicable — never as a gap.** If `.claude/stack.md` is missing, run
> `onboard` and stop.

## Why this loop exists

The other loops answer *"is this ticket done?"*. This one answers a question no single ticket can:
**do the four artefacts still agree with each other?** Drift between them is invisible to FIX,
IMPLEMENT and VERIFY, because each of those looks at one ticket at a time and trusts its AC.

Three failure modes it is specifically built to catch, all of which are silent:

- **A spec that no story implements.** An AC written on a docs page that never became a ticket is
  invisible to a backlog-driven sweep — nothing will ever schedule it.
- **A story whose AC has been superseded by a later fix.** Implementing it as written *reintroduces*
  the bug the later ticket removed. A ticket-at-a-time loop cannot see this; it reads the AC and
  builds it.
- **A test ticket with no runnable test.** Test-management systems track cases, repos hold scenarios,
  and the two drift apart. Coverage looks fine in the tool and does not exist on disk.

## Schedule

| Setting | Value |
|---|---|
| Cadence | every **15 minutes** (`7,22,37,52 * * * *`) |
| When | **any time** the session is active (not day/hour gated) |
| Scope | one issue (or one spec page) per tick, round-robin via a cursor |
| Persistence | **session-only** (`durable: false`) |
| Auto-expiry | recurring cron auto-expires after **7 days** |

> Read-mostly by design: it writes `.claude/loops/state/` and, when configured, **comments** on the
> tracker. It never edits code, never transitions an issue, never touches a PR.

## State files

| File | Holds |
|---|---|
| `.claude/loops/state/trace-cursor.txt` | keys already walked this pass; cleared when the pass completes |
| `.claude/loops/state/trace-matrix.json` | one record per issue: spec / code / test-ticket / test-file links + verdict |
| `.claude/loops/state/trace-report.md` | rebuilt every tick from the matrix — the human-readable picture |
| `.claude/loops/state/trace-blocked.txt` | issues the loop could not decide, with the reason |

## What each tick does

1. **SELECT.** Query `${issueTracker.myWorkQuery}` widened to *all* statuses (this loop audits the
   whole product, not just the active iteration — that is the point). Skip keys in
   `trace-cursor.txt`. None left → clear the cursor, start a new pass, STOP. Pick the oldest-unwalked.

2. **SPEC LINK.** If `${docs.platform}` is `none`, mark `spec: n/a` and skip to 3. Otherwise look for
   a docs URL on the issue (description link, remote link, or the tracker's own doc field). Missing →
   record `spec: MISSING`. Present → fetch the page and extract its acceptance criteria.

3. **CODE LINK.** Verify each AC against the repo(s). **Evidence or it didn't happen:** a `BUILT`
   verdict needs `file:line` per AC, and exact-string matching on user-visible copy (toasts, empty
   states, button labels) — a near-match is `PARTIAL`, not `BUILT`. Record one of
   `BUILT | PARTIAL | MISSING | DECISION | UNCLEAR`.
   - Behaviour you cannot observe statically (performance, generated SQL, rendered layout) →
     say so explicitly rather than guessing.
   - A repo the workspace does not have checked out → `UNCLEAR`, naming the repo. **Absence from the
     workspace is not absence from the product.**

4. **SPEC↔CODE DRIFT.** If the AC and the code disagree, decide *which one is wrong* before calling
   it a gap. Check whether a later issue deliberately changed the behaviour (search the tracker for
   the touched files/feature). If so the AC is **superseded** — record
   `drift: AC-SUPERSEDED-BY-<KEY>`, never `MISSING`. Where the project names an arbiter for
   disagreements (e.g. a frozen legacy app), consult it before escalating.

5. **TEST-TICKET LINK.** If `${testing.testManagement}` is `none`, mark `testTicket: n/a`. Otherwise
   check for a linked case/scenario issue. None → `testTicket: MISSING`.

6. **TEST-FILE LINK.** If `${testing.e2e.runner}` is `none`, mark `testFile: n/a`. Otherwise resolve
   the scenario to a file in `${testing.e2e.dir}`:
   - Prefer the tag convention `${testing.e2e.tagConvention}`.
   - **If the suite does not tag by ticket, say so once and fall back to title matching** — exact
     first, then normalised. Record *how* it matched. A weak fuzzy match is worse than none.
   - Resolve to a file that is **actually collected by the runner**, not merely present on disk. A
     scenario in a staging directory that no project includes is `testFile: NOT-RUNNABLE`, which is a
     different and more dangerous state than `MISSING` — it looks like coverage and is not.

7. **RECORD.** Upsert the issue's record in `trace-matrix.json`, append the key to the cursor, and
   **rebuild** `trace-report.md` from the matrix (always a rebuild, never an append): chain coverage
   (how many issues have all four links), gap counts per link, orphans in both directions
   (test tickets with no story, spec pages no story references), and the drift list.

8. **ESCALATE — comment only, and only on a *new* finding.** If `${reporting.commentOnTracker}` is
   true and this tick found a gap not already recorded for that key, post one comment naming the
   specific broken link and what would close it. Never transition, never reassign, never edit code.
   Dedupe on `<KEY>@<gap-class>` so a standing gap is reported once, not every pass.

9. **NOTIFY ONLY ON A FLIP.** A link that was present and is now broken → one `PushNotification`.
   Steady-state gaps stay in the report and stay silent — otherwise the loop trains you to ignore it.

## The verdicts, and what each one means for planning

| Verdict | Meaning | Action it implies |
|---|---|---|
| `BUILT` | every AC has file:line evidence | close the ticket; stop scheduling it |
| `PARTIAL` | one named AC unimplemented | usually a small, well-scoped fix |
| `MISSING` | genuinely not there, and the loop says where it looked | real work, size it |
| `DECISION` | two opposite valid readings, or the AC contradicts itself | a human must rule; do not build |
| `UNCLEAR` | not decidable from this workspace | fix the workspace, not the ticket |
| `AC-SUPERSEDED` | code is right, the ticket is stale | rewrite or close the AC — **do not build it** |
| `NOT-RUNNABLE` | a test exists on disk but nothing runs it | the most misleading state; treat as no coverage |

## Guardrails

- **Read-mostly.** Code, branches, PRs and issue *state* are never touched. Comments only, and only
  when `${reporting.commentOnTracker}` allows it.
- **One issue per tick.** The cursor makes a full pass eventually; a big backlog is not a reason to
  batch and lose per-issue evidence.
- **Never convert a missing repo into a missing feature.** That is the single easiest way for this
  loop to generate confident nonsense.
- **Never let a tool's coverage number stand in for a runnable test.** Step 6's `NOT-RUNNABLE` exists
  because "97 files / 248 scenarios" can be true while ~6% actually execute.
- Sibling repos the chain depends on but that are not checked out must be listed in the report's
  Limitations section every rebuild, so no reader mistakes silence for coverage.

## Start / stop

Registered by `launch-loop-stack` alongside the other loops; removed by `stop-loop-stack`.
To run a single tick by hand, paste the cron prompt from `launch-loop-stack` into a session.
