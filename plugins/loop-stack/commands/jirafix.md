# Issue fix

Read `.claude/stack.md` first; use its values; never assume a specific tool; if a needed capability is `none`, skip those steps; if the config is missing, run the `onboard` skill and stop.

If the user's prompt contains an issue-tracker link or key, fetch that issue's **description and comments** from the configured issue tracker (`${issueTracker.tool}`, connection `${issueTracker.connection}` — e.g. Jira/GitHub Issues/Linear via its MCP). Use them to drive the work. If `${issueTracker.tool}` is `none`, there is nothing to fetch — proceed from the user's prompt alone.
