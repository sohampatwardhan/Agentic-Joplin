# Agentic-Joplin

[![npm](https://img.shields.io/npm/v/agentic-joplin.svg)](https://www.npmjs.com/package/agentic-joplin) [![CI](https://github.com/sohampatwardhan/Agentic-Joplin/actions/workflows/ci.yml/badge.svg)](https://github.com/sohampatwardhan/Agentic-Joplin/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/sohampatwardhan/Agentic-Joplin/blob/main/LICENSE)

Tooling that lets coding agents integrate with [Joplin](https://joplinapp.org), the open-source note-taking app.

The project has three planned pieces:

| Piece | Status |
|---|---|
| **MCP server** — wraps Joplin's Data API as Model Context Protocol tools | ✅ Published to npm as [`agentic-joplin`](https://www.npmjs.com/package/agentic-joplin) |
| **Joplin plugin** — in-app plugin for capabilities the Data API can't expose | 🔜 planned |
| **Agent skills** — skill files teaching agents how to use Joplin effectively | ✅ Claude Code + Codex plugin |

This repo is an npm-workspaces monorepo; each piece lives under `packages/`.

## MCP server

[`packages/mcp-server`](packages/mcp-server) is a from-scratch [Model Context Protocol](https://modelcontextprotocol.io) server (TypeScript, stdio transport) that gives an agent full CRUD over Joplin notes, notebooks, tags, and resources, plus search, note revision history, and a connectivity check — **26 tools across 7 groups**. It wraps Joplin's local Data API (the REST service exposed by the desktop app's Web Clipper).

### Requirements

- Node.js ≥ 20
- Joplin desktop running with the **Web Clipper service enabled** (Options → Web Clipper).

### Setup

The server is published to npm as [`agentic-joplin`](https://www.npmjs.com/package/agentic-joplin):

```bash
npx -y -p agentic-joplin agentic-joplin-authorize   # one time: click Accept in Joplin; caches a token
```

Then add it to your MCP client (e.g. Claude Code / Claude Desktop) as a stdio server:

```json
{
  "mcpServers": {
    "joplin": { "command": "npx", "args": ["-y", "agentic-joplin"] }
  }
}
```

To run from source instead: `npm install && npm run build --workspace agentic-joplin`, then point the client at `node packages/mcp-server/dist/index.js`.

Environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `JOPLIN_TOKEN` | no | — | API token from Joplin's Web Clipper settings. Falls back to the token cached in `~/.agentic-joplin/token.json`, then to interactive authorization on first request. |
| `JOPLIN_HOST` | no | `127.0.0.1` | Host of the Web Clipper service |
| `JOPLIN_PORT` | no | `41184` | Port of the Web Clipper service |

Joplin must be running with Web Clipper enabled for any tool call to succeed.

### Tool surface

Notes (`create_note`, `get_note`, `update_note`, `delete_note`, `list_notes`), notebooks (`get_notebook`, `list_notebooks`, `create_notebook`, `update_notebook`, `delete_notebook`), tags (`get_tag`, `list_tags`, `create_tag`, `update_tag`, `delete_tag`, `tag_note`, `untag_note`), search (`find_notes`), resources (`attach_resource`, `get_resource`, `update_resource`, `delete_resource`, `list_note_resources`), revisions (`list_note_revisions`, `delete_note_revisions`), and `ping`.

Notes can be created in Markdown (default) or HTML via a `format` parameter. See [`packages/mcp-server/README.md`](packages/mcp-server/README.md) for the full per-tool reference and [`packages/mcp-server/SMOKE_TEST.md`](packages/mcp-server/SMOKE_TEST.md) for the manual release checklist.

## Agent skills plugin

[`packages/plugin`](packages/plugin) is a single plugin — valid for both **Claude Code** and
**Codex** — that bundles the Joplin MCP server with four agent skills (`using-joplin` hub plus
`joplin-capturing-notes`, `joplin-searching-and-updating`, `joplin-organizing`). See
[`packages/plugin/README.md`](packages/plugin/README.md) for install steps on each platform.

To install only the four skills, without the plugin bundle, use the [`skills` CLI](https://github.com/vercel-labs/skills) (Node.js 22.20 or later). It records the source, so `npx skills update` keeps them current. The skills still need the Joplin MCP server above.

```bash
# All four skills, globally
npx skills add sohampatwardhan/Agentic-Joplin -g

# One skill, for chosen agents only
npx skills add sohampatwardhan/Agentic-Joplin -g --skill using-joplin -a claude-code -a codex

# Update later
npx skills update -g
```

### Companion skills for richer notes

Joplin renders Mermaid diagrams and KaTeX math natively. The Joplin skills work on their own,
but when these two optional Agent Skills are installed they defer to them for diagrams and
formulas:

- [`mermaid`](https://github.com/sohampatwardhan/mermaid-skill) — picks a diagram type and
  writes validated Mermaid.
- [`katex`](https://github.com/sohampatwardhan/KaTeX-Agent-Skill) — writes KaTeX-safe math
  with Joplin's `$` / `$$` delimiters.

Install the Joplin skills and both companions together with [`skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add sohampatwardhan/Agentic-Joplin -g
npx skills add sohampatwardhan/mermaid-skill -g
npx skills add sohampatwardhan/KaTeX-Agent-Skill -g
```

If a companion is missing, the agent may offer to install it, but only runs the command after
you say yes.

## Development

```bash
npm run build   # type-check + compile all workspaces
npm test        # run all workspace unit tests (mocked Data API, no Joplin instance needed)
```

Design docs live under [`docs/superpowers/`](docs/superpowers): the [design spec](docs/superpowers/specs/2026-07-08-joplin-mcp-server-design.md) and the [implementation plan](docs/superpowers/plans/2026-07-08-joplin-mcp-server-implementation.md).

## License

[MIT](LICENSE) © Soham Patwardhan
