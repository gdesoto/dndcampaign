# CLAUDE.md

Read `AGENTS.md` first. It is the source of truth for architecture, conventions, commands, and testing in this repo. This file only adds what is specific to Claude Code.

## Skills
- `ui-guidelines` — maintained in the sibling [gstack repository](../gstack/plugins/ui-guidelines/skills/ui-guidelines/SKILL.md). Read that source directly for page, component, form, table, or navigation work until `ui-guidelines@gstack` is installed; its plugin invocation is `/ui-guidelines:ui-guidelines`. Read the relevant sections of `docs/StyleGuide.md` for DM Vault identity and project component contracts; see "Frontend conventions" in `AGENTS.md` for precedence.

## Tools
- Use the Nuxt UI MCP tools (`mcp__nuxt-ui__*` or `mcp__nuxt-ui-remote__*`) to verify component props, slots, and `app.config.ts` keys before adding theme overrides. Use the Nuxt MCP tools for config and module questions.

## Working notes
- Windows checkout: the index stores LF but the working copy is CRLF. Normalize files to LF before regex-based bulk edits and restore ending-only diffs afterward.
- Write multi-line scripts to the scratchpad in `docs/planning/` and run them by path; long bash heredocs are unreliable in this shell.
