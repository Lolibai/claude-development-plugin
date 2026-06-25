# Phase DC — Double-Check (shared by devfix + implement)

> Reads project specifics from `.claude/stack.md` — issue tracker (`${issueTracker.*}`) and its key prefix.
> Tracker tools below (Jira/Confluence calls) are **examples**; use the configured tracker's equivalents. If
> `${issueTracker.tool}` is `none`, audit against the user-supplied AC text directly and skip the fetch.

Standalone audit, no code changes. Single source of truth — never copy this phase back into a skill.

**Trigger:** user says "double check `${issueTracker.keyPrefix}-XXXX`" or "double check <ticket-url>". The audit is identical whether the ticket is a bug or a feature; whichever skill triggered runs this same phase, then (on fail + user confirmation) continues with its own Phase 0 onward.

## DC-0: Issue fetch (parent)

Dispatch in **one message** (parallel), using the configured tracker's tools (e.g. Jira):
1. fetch the issue — full description, ACs, status, parent (e.g. `getJiraIssue`)
2. fetch the parent (if subtask) + the issue's remote links (e.g. `getJiraIssueRemoteIssueLinks`)
3. fetch every linked spec/wiki page found (e.g. `getConfluencePage`)

Extract: all ACs from the description + every linked page.

## DC-1: Audit subagent (read-only)

Spawn `context-scout` agent. Inputs: Jira description + AC list.

Subagent prompt template:

> **Caveman mode (full).** Drop articles, filler, hedging. Fragments OK.
>
> Read-only audit. For each AC in the list below, find every file+line that implements it. For each implementation, verify it is correct and complete per the AC text. Check: validation logic, schema constraints, edge cases, backend vs frontend layers. Flag any gap, wrong assumption, or partially-implemented AC. Return a YAML report: one entry per AC.
>
> ACs:
> <paste AC list>
>
> Return shape:
> ```yaml
> acs:
>   - id: AC1
>     text: "<ac text>"
>     verdict: complete | partial | missing | wrong
>     evidence:
>       - file: path/to/file.ts
>         line: 42
>         note: "what it does / what's wrong"
>     gap: "<null or description of what's missing>"
> summary:
>   complete: N
>   partial: N
>   missing: N
>   wrong: N
>   overall: pass | fail
> ```

## DC-2: Parent synthesis

Parent reads the audit report and writes a **DC Summary** directly in the conversation:

```markdown
## DC Summary — <ISSUE_KEY>

### ACs
- AC1 ✅ complete — <file:line>
- AC2 ⚠️ partial — <gap description>
- AC3 ❌ missing — <what's not implemented>

### Verdict
pass | fail

### Gaps found
<null | bulleted list of specific gaps with file+line context>
```

If `verdict: pass` → done, report to user.
If `verdict: fail` → ask user: "Gaps found. Fix now or log only?" Then continue with the active skill's full flow (Phase 0 onward) if user confirms fix.

```
CHECKPOINT-DC: DOUBLE_CHECK
  REQUIRES:
    - issue-fetch result present (or "${issueTracker.tool} = none" noted and user-supplied AC used)
    - All ACs extracted (or "no ACs found" explicitly noted)
    - context-scout YAML report present
    - DC Summary written with per-AC verdict
    - overall: pass | fail stated
  BLOCKED BY:
    - issue fetch failed
    - context-scout returned no evidence
    - DC Summary missing
  ON FAIL: Re-dispatch missing fetches; re-spawn context-scout with tighter prompt
```
