# CLAUDE.md

Read `AGENTS.md` first. It is the source of truth for architecture, conventions, commands, and testing in this repo. This file only adds what is specific to Claude Code.

## Skills
- `/nuxt-ui-guidelines` — installed at `.claude/skills/nuxt-ui-guidelines/` (a copy of the plugin under `.agents/plugins/`; keep both in sync when the plugin is updated). Invoke it for any page, component, form, table, or navigation work. Read the relevant sections of `StyleGuide.md` for DM Vault identity and project component contracts; see "Frontend conventions" in `AGENTS.md` for precedence.

## Tools
- Use the Nuxt UI MCP tools (`mcp__nuxt-ui__*` or `mcp__nuxt-ui-remote__*`) to verify component props, slots, and `app.config.ts` keys before adding theme overrides. Use the Nuxt MCP tools for config and module questions.

## Working notes
- Windows checkout: the index stores LF but the working copy is CRLF. Normalize files to LF before regex-based bulk edits and restore ending-only diffs afterward.
- Write multi-line scripts to the scratchpad and run them by path; long bash heredocs are unreliable in this shell.
