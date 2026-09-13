# Nuxt UI MCP

The plugin's root `.mcp.json` declares the official remote HTTP endpoint `https://ui.nuxt.com/mcp` under `nuxt-ui`. No local server binary or node_modules installation is needed for that connection. The example app has separate dependencies, installed only in a working copy.

## Use with the guidelines

- Use the canonical guidelines for design conventions and the bundled gallery/application pages for varied composition examples.
- Use MCP for upstream component discovery, API metadata, documentation, theming and examples. Discover available tools in the current host; prefixes differ between agents and global/plugin connections.
- Prefer focused retrieval: component metadata for props/slots/events, or selected usage/API/theme sections. Do not load the whole catalog for a small change.
- Compare retrieved APIs against the host's installed version and generated types/themes. Live docs may describe a newer version. Do not upgrade merely to fit an upstream example.
- If MCP is unavailable, continue using installed types and official documentation. The design guidance and bundled examples remain usable.

Current official capabilities include component search and metadata, documentation retrieval, examples, templates, icons, and migration guidance. The connected server's discovered tool definitions are authoritative.

## Existing global connection

Use whichever official Nuxt UI connection is available; do not require a plugin-specific tool prefix or register another server from the skill itself.

Claude Code currently deduplicates plugin servers by endpoint against higher-priority scopes, including user scope. The higher-priority entry is used as a whole, without merging settings. Check `/mcp` in the target session.

For Codex, do not assume equivalent endpoint deduplication. If both entries are active, disable the plugin's MCP entry through plugin-scoped configuration while keeping its skill enabled, or choose the plugin connection and disable the global entry. Use the actual installed plugin identifier. Do not change a user's global configuration automatically.

Copying the standalone inner skill does not register MCP. The plugin bundles a connection to Nuxt's hosted service, not server source.

Sources checked 2026-09-08: [Nuxt UI MCP](https://ui.nuxt.com/docs/getting-started/ai/mcp), [Claude MCP precedence](https://code.claude.com/docs/en/mcp#scope-hierarchy-and-precedence), [Codex bundled MCP configuration](https://developers.openai.com/plugins/build/plugins).
