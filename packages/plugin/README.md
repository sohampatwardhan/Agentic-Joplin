# Agentic Joplin plugin (Claude Code + Codex)

Bundles the Joplin MCP server with four agent skills. One directory, valid for both Claude Code
and Codex.

## Prerequisites

- Node.js ≥ 20, and this monorepo built: `npm install && npm run build --workspace @agentic-joplin/mcp-server`
- Joplin desktop running with the Web Clipper service enabled (Options → Web Clipper), and an API token.

The bundled `.mcp.json` / `plugin.json` launch the server from `../mcp-server/dist/index.js`
relative to the plugin (`${CLAUDE_PLUGIN_ROOT}`), so build the server before use.

## Claude Code

Install the plugin directory (e.g. `claude plugin install ./packages/plugin` or via a
marketplace entry). Claude Code will prompt for the **Joplin API token** (stored in your
keychain via the plugin's `userConfig`). Non-default host/port: edit the `env` in
`.mcp.json`.

## Codex

Install the plugin directory as a Codex plugin. Export your token so the server picks it up
(the plugin passes `JOPLIN_TOKEN` through via `env_vars`):

```bash
export JOPLIN_TOKEN="<your token>"
```

If you configure MCP manually instead of installing the plugin, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.joplin]
command = "node"
args = ["/absolute/path/to/Agentic-Joplin/packages/mcp-server/dist/index.js"]
env = { JOPLIN_HOST = "127.0.0.1", JOPLIN_PORT = "41184" }
env_vars = ["JOPLIN_TOKEN"]
```

## Skills

- **using-joplin** — hub: connection check, tool map, conventions, routing.
- **joplin-capturing-notes** — create notes (notebook resolution, format, tags).
- **joplin-searching-and-updating** — search, read, update/append.
- **joplin-organizing** — notebooks, tags, cleanup.

## Development

- `npm run test --workspace @agentic-joplin/plugin` — validate skill frontmatter + tool references.
- See `SMOKE_TEST.md` for the manual cross-platform install/verification checklist.
