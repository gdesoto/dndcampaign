# Claude Code usage

Claude Code discovers this skill through `SKILL.md`; this file is a linked usage note, not a Claude agent manifest. The enclosing plugin includes `.claude-plugin/plugin.json` and `.mcp.json`; no separate subagent or duplicate skill is needed.

For skill-only installation, copy the inner `skills/nuxt-ui-guidelines` folder into either:

- Project: `<project>/.claude/skills/nuxt-ui-guidelines/`
- Personal: `~/.claude/skills/nuxt-ui-guidelines/`

Keep `SKILL.md`, `references/`, and `assets/` together. The existing `agents/openai.yaml` may stay for Codex users. Avoid an extra nested `nuxt-ui-guidelines` directory between the installed skill folder and `SKILL.md`.

Invoke the standalone skill in Claude Code:

```text
/nuxt-ui-guidelines Build a records dashboard using the gallery for inspiration and preserve this project's theme.
```

Claude can also select it automatically from its description. Verify discovery by typing `/nuxt-ui-guidelines` in the target project's session.

Use the shared workflow and linked references. Inspect relevant gallery/app pages without loading every example. Install application dependencies only in a working copy. Report any unavailable build or browser checks accurately.

These instructions target Claude Code's local project workflow; they do not install the skill or verify it in a running Claude session.

Format and installation reference: [Claude Code skills documentation](https://code.claude.com/docs/en/skills), checked 2026-09-08.

## Bundled plugin

Load the outer plugin folder in a local session with `claude --plugin-dir "<absolute-plugin-folder>"`. The plugin invocation is `/nuxt-ui-guidelines:nuxt-ui-guidelines`. The shared MCP configuration points to the official Nuxt UI endpoint. Check `/mcp` for connection status. A user-scoped server at the same endpoint takes precedence over the plugin connection in current Claude Code.

Copying only the inner skill does not configure MCP; use an existing connection or follow the linked MCP reference.
