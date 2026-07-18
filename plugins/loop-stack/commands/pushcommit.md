# Push commit

Read `.claude/stack.md` first; use its values; never assume a specific tool; if a needed capability is `none`, skip those steps; if the config is missing, run the `onboard` skill and stop.

Commit **all** changes with a message that follows the project's commit convention (`${commands.commitConvention}` — e.g. Conventional Commits, validated by a commit-lint config such as `commitlint.config.*` if the repo has one), then push to the current branch's remote.

- Stage everything, then commit with a message matching `${commands.commitConvention}`. If the config defines a no-attribution rule (`${commands.commitNoAttribution}`), do not point out that the changes were AI-generated or name the tool that produced them.
- `git push` (set the upstream with `-u` if the branch has none).
