# Commit

Read `.claude/stack.md` first; use its values; never assume a specific tool; if a needed capability is `none`, skip those steps; if the config is missing, run the `onboarding` skill and stop.

Commit the **staged** changes with a message that follows the project's commit convention (`${commands.commitConvention}` — e.g. Conventional Commits, validated by a commit-lint config such as `commitlint.config.*` if the repo has one).

- Stage the project's tracked changes first: `git add --update --renormalize .`
- Write the message to match `${commands.commitConvention}`. If the config defines a no-attribution rule (`${commands.commitNoAttribution}`), do not mention that the changes were AI-generated or name the tool that produced them.
