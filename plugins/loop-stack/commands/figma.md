# Figma frame — pixel-perfect implement

Read `.claude/stack.md` first; use its values; never assume a specific tool; if a needed capability is `none`, skip those steps; if the config is missing, run the `onboarding` skill and stop.

**Design-tool gate:** This command needs a design tool with an MCP (`${design.figma}` — e.g. Figma). If the config has no design tool, there is nothing to read pixel values from: skip this command and tell the user.

Use the configured design tool's MCP (e.g. Figma MCP) to read exact values; do not navigate design links via a browser.

Target:
- File: <FILE>
- Page: <PAGE>
- Frame: <FRAME>

Execution mode:
- Iterative
- Single-frame only

Loop rules:
1. Implement the frame pixel-perfect using exact values from the design tool's MCP.
2. Re-read all MCP values for the frame.
3. Compare code vs design:
   - spacing
   - typography
   - colors
   - border radius
   - layout alignment
4. If ANY mismatch exists:
   - fix the code
   - repeat from step 2
5. Do NOT stop early.
6. Only exit when ZERO mismatches remain.

Constraints:
- Follow the project's repo rule files / conventions strictly (e.g. `AGENTS.md`, `CLAUDE.md`, editor/agent rule directories).
- No interpretation or refactoring
- No responsiveness
- No abstraction
- Prove correctness numerically before stopping

Failure condition:
- If unable to verify exact match → STOP and ask
