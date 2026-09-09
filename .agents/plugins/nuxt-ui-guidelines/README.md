# Nuxt UI Guidelines plugin

Design conventions, a full reference application, and the official Nuxt UI documentation MCP connection for Codex and Claude Code.

```text
nuxt-ui-guidelines/
  .codex-plugin/plugin.json
  .claude-plugin/plugin.json
  .mcp.json
  skills/nuxt-ui-guidelines/
    SKILL.md
    agents/
    references/guidelines.md
    references/example-app.md
    references/nuxt-ui-mcp.md
    assets/example-app/
```

Start with [the skill](skills/nuxt-ui-guidelines/SKILL.md) and [core guidelines](skills/nuxt-ui-guidelines/references/guidelines.md). The [reference map](skills/nuxt-ui-guidelines/references/example-app.md) covers the gallery, course and planning workflows, themes, and running the app. All examples are retained. Dependencies, build output, and local environment files are excluded.

## Use the plugin

Keep the entire outer folder together for plugin distribution. Codex uses `.codex-plugin/plugin.json`; Claude Code uses `.claude-plugin/plugin.json`. Both declare the same `skills/` folder and `.mcp.json`. This source package has not been installed globally or published to a marketplace.

For Codex, add the outer folder as a plugin source in your chosen local/team marketplace and install through that marketplace. A plugin is not installed merely by copying it into `.agents/skills`.

For a local Claude Code session, run from the target project:

```sh
claude --plugin-dir "<absolute-path-to-nuxt-ui-guidelines-plugin>"
```

Invoke `/nuxt-ui-guidelines:nuxt-ui-guidelines`. For persistent installation, distribute through a Claude Code plugin marketplace. Check `/mcp` for connection status.

## Use only the skill

Copy the inner `skills/nuxt-ui-guidelines/` into the project's `.agents/skills/` for Codex or `.claude/skills/` for Claude Code. Keep its references/assets together. Standalone installation does not register MCP.

## MCP and existing connections

The shared config connects to `https://ui.nuxt.com/mcp` over HTTP. The plugin does not host the server or need application dependencies to use it. For an existing global connection, see [connection guidance](skills/nuxt-ui-guidelines/references/nuxt-ui-mcp.md). The skill uses available tools regardless of prefix and falls back to installed types and official docs when necessary.

## Maintenance

Update the single inner skill and examples. Keep both manifests' name/version/description and component paths consistent. The guide in `references/` remains canonical; the app imports it directly. Follow the app's guide-copy instructions when extracting it independently. Retain the [example application's MIT license](skills/nuxt-ui-guidelines/assets/example-app/LICENSE) with copied source.
