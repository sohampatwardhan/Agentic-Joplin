# Agentic-Joplin

Tooling that lets coding agents integrate with [Joplin](https://joplinapp.org), the open-source note-taking app.

The project has three planned pieces:

| Piece | Status |
|---|---|
| **MCP server** — wraps Joplin's Data API as Model Context Protocol tools | ✅ Phase 1 complete |
| **Joplin plugin** — in-app plugin for capabilities the Data API can't expose | 🔜 planned |
| **Agent skills** — skill files teaching agents how to use Joplin effectively | ✅ Claude Code + Codex plugin |

This repo is an npm-workspaces monorepo; each piece lives under `packages/`.

## MCP server

[`packages/mcp-server`](packages/mcp-server) is a from-scratch [Model Context Protocol](https://modelcontextprotocol.io) server (TypeScript, stdio transport) that gives an agent full CRUD over Joplin notes, notebooks, tags, and resources, plus search, note revision history, and a connectivity check — **26 tools across 7 groups**. It wraps Joplin's local Data API (the REST service exposed by the desktop app's Web Clipper).

### Requirements

- Node.js ≥ 20
- Joplin desktop running with the **Web Clipper service enabled** (Options → Web Clipper), and an API token generated there.

### Setup

```bash
npm install
npm run build --workspace @agentic-joplin/mcp-server
```

Then add it to your MCP client (e.g. Claude Code / Claude Desktop) as a stdio server running `node packages/mcp-server/dist/index.js`, with these environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `JOPLIN_TOKEN` | yes | — | API token from Joplin's Web Clipper settings |
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

## Development

```bash
npm run build   # type-check + compile all workspaces
npm test        # run all workspace unit tests (mocked Data API, no Joplin instance needed)
```

Design docs live under [`docs/superpowers/`](docs/superpowers): the [design spec](docs/superpowers/specs/2026-07-08-joplin-mcp-server-design.md) and the [implementation plan](docs/superpowers/plans/2026-07-08-joplin-mcp-server-implementation.md).

## License

TBD.
